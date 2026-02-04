/**
 * yt-dlp engine wrapper with health checks and process management
 */

import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import { Platform } from '../types/platform.types.js';
import { RawYtDlpInfo } from '../types/video.types.js';
import { ErrorClassifier } from '../errors/error-classifier.js';
import { appConfig } from '../config/app.config.js';
import { resilienceConfig } from '../config/resilience.config.js';
import { logger, logEvents } from '../logging/logger.js';
import { userAgentRotator } from '../anti-blocking/user-agent-rotator.js';

const execAsync = promisify(exec);

export interface YtDlpHealthStatus {
  healthy: boolean;
  version?: string;
  error?: string;
  lastChecked: number;
}

export interface YtDlpInfoResult {
  success: boolean;
  data?: RawYtDlpInfo;
  error?: string;
}

export interface YtDlpDownloadProgress {
  percent: number;
  downloaded?: string;
  total?: string;
  speed?: string;
  eta?: string;
}

export class YtDlpEngine {
  private healthStatus: YtDlpHealthStatus = {
    healthy: false,
    lastChecked: 0,
  };
  private isUpdating = false;
  private lastUpdate = 0;
  private ytdlpPath: string;

  constructor() {
    this.ytdlpPath = appConfig.ytdlp.path;
  }

  /**
   * Check yt-dlp health
   */
  async checkHealth(): Promise<YtDlpHealthStatus> {
    try {
      const { stdout } = await execAsync(`${this.ytdlpPath} --version`, {
        timeout: 10000,
      });
      const version = stdout.trim();

      this.healthStatus = {
        healthy: true,
        version,
        lastChecked: Date.now(),
      };

      logEvents.ytdlpHealthCheck({ healthy: true, version });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.healthStatus = {
        healthy: false,
        error: errorMessage,
        lastChecked: Date.now(),
      };

      logEvents.ytdlpHealthCheck({ healthy: false, error: errorMessage });
    }

    return this.healthStatus;
  }

  /**
   * Update yt-dlp
   */
  async update(): Promise<boolean> {
    // Prevent concurrent updates
    if (this.isUpdating) {
      logger.info('yt-dlp update already in progress');
      return false;
    }

    // Check cooldown
    const cooldown = appConfig.ytdlp.updateCooldown;
    if (Date.now() - this.lastUpdate < cooldown) {
      logger.info('yt-dlp update cooldown active');
      return false;
    }

    this.isUpdating = true;
    logEvents.ytdlpUpdateStarted();

    try {
      // Try direct update first
      try {
        const { stdout } = await execAsync(`${this.ytdlpPath} -U`, {
          timeout: resilienceConfig.timeout.updateYtdlp,
        });
        this.lastUpdate = Date.now();
        logEvents.ytdlpUpdateCompleted({ method: 'direct', version: stdout.trim() });
        return true;
      } catch {
        // Fallback to pip
        await execAsync('pip3 install -U yt-dlp', {
          timeout: resilienceConfig.timeout.updateYtdlp,
        });
        this.lastUpdate = Date.now();
        logEvents.ytdlpUpdateCompleted({ method: 'pip' });
        return true;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logEvents.ytdlpUpdateFailed({ error: errorMessage });
      return false;
    } finally {
      this.isUpdating = false;
    }
  }

  /**
   * Get video info using yt-dlp
   */
  async getInfo(url: string, platform?: Platform): Promise<YtDlpInfoResult> {
    const userAgent = platform
      ? userAgentRotator.getForPlatform(platform)
      : userAgentRotator.getRandom();

    const args = [
      '--dump-json',
      '--no-warnings',
      '--no-check-certificates',
      '--user-agent', userAgent,
      // Enable remote components for solving YouTube's JavaScript challenges
      '--remote-components', 'ejs:github',
    ];

    return new Promise<YtDlpInfoResult>((resolve) => {
      const process = spawn(this.ytdlpPath, [...args, url], { shell: false });
      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0 && stdout.trim()) {
          try {
            // Parse first JSON line (in case of multiple)
            const info = JSON.parse(stdout.trim().split('\n')[0]) as RawYtDlpInfo;
            resolve({ success: true, data: info });
          } catch (e) {
            resolve({
              success: false,
              error: `Failed to parse yt-dlp output: ${e instanceof Error ? e.message : String(e)}`,
            });
          }
        } else {
          resolve({
            success: false,
            error: stderr || `yt-dlp exited with code ${code}`,
          });
        }
      });

      process.on('error', (err) => {
        resolve({ success: false, error: err.message });
      });
    });
  }

  /**
   * Execute download with progress tracking
   */
  executeDownload(
    args: string[],
    callbacks: {
      onProgress?: (progress: YtDlpDownloadProgress) => void;
      onComplete?: (success: boolean, error?: string) => void;
      onStderr?: (data: string) => void;
    }
  ): {
    abort: () => void;
    process: ReturnType<typeof spawn>;
  } {
    const userAgent = userAgentRotator.getRandom();
    const fullArgs = [
      '--user-agent', userAgent,
      // Enable remote components for solving YouTube's JavaScript challenges
      '--remote-components', 'ejs:github',
      ...args,
    ];

    const process = spawn(this.ytdlpPath, fullArgs, {
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stderrBuffer = '';

    // yt-dlp writes progress and info to stderr, not stdout
    // Parse progress from both streams to be safe
    const parseProgress = (data: Buffer) => {
      const output = data.toString();
      const progressMatch = output.match(/\[download\]\s+(\d+\.?\d*)%(?:\s+of\s+~?(\S+))?(?:\s+at\s+(\S+))?(?:\s+ETA\s+(\S+))?/);
      if (progressMatch && callbacks.onProgress) {
        callbacks.onProgress({
          percent: parseFloat(progressMatch[1]),
          total: progressMatch[2],
          speed: progressMatch[3],
          eta: progressMatch[4],
        });
      }
    };

    process.stdout.on('data', (data) => {
      parseProgress(data);
    });

    process.stderr.on('data', (data) => {
      const msg = data.toString();
      stderrBuffer += msg;
      parseProgress(data);
      if (callbacks.onStderr) {
        callbacks.onStderr(msg);
      }
    });

    process.on('close', (code) => {
      if (callbacks.onComplete) {
        callbacks.onComplete(code === 0, code !== 0 ? stderrBuffer : undefined);
      }
    });

    process.on('error', (err) => {
      if (callbacks.onComplete) {
        callbacks.onComplete(false, err.message);
      }
    });

    return {
      abort: () => {
        process.kill('SIGTERM');
      },
      process,
    };
  }

  /**
   * Check if error indicates yt-dlp needs update
   */
  needsUpdate(errorMessage: string): boolean {
    return ErrorClassifier.needsYtDlpUpdate(errorMessage);
  }

  /**
   * Get current health status
   */
  getHealthStatus(): YtDlpHealthStatus {
    return { ...this.healthStatus };
  }

  /**
   * Check if healthy
   */
  isHealthy(): boolean {
    return this.healthStatus.healthy;
  }
}

// Singleton instance
export const ytdlpEngine = new YtDlpEngine();

export default ytdlpEngine;
