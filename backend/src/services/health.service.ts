/**
 * Health check service
 */

import { ytdlpEngine } from '../engines/ytdlp.engine.js';
import { circuitBreaker, CircuitState } from '../infrastructure/circuit-breaker.js';
import { metrics } from '../infrastructure/metrics.js';
import * as infoService from './info.service.js';
import * as downloadService from './download.service.js';
import { Platform } from '../types/platform.types.js';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  components: {
    ytdlp: {
      healthy: boolean;
      version?: string;
      error?: string;
    };
    queues: {
      info: { running: number; queued: number };
      download: { running: number; queued: number };
    };
    circuitBreakers: Record<Platform, CircuitState>;
  };
}

export interface DetailedHealthStatus extends HealthStatus {
  metrics: ReturnType<typeof metrics.getStats>;
  cache: ReturnType<typeof infoService.getCacheStats>;
}

/**
 * Get basic health status
 */
export async function getHealth(): Promise<HealthStatus> {
  const ytdlpHealth = ytdlpEngine.getHealthStatus();
  const infoQueue = infoService.getQueueStatus();
  const downloadQueue = downloadService.getQueueStatus();

  // Get circuit breaker states
  const cbStates: Record<Platform, CircuitState> = {
    [Platform.YOUTUBE]: circuitBreaker.getState(Platform.YOUTUBE),
    [Platform.TIKTOK]: circuitBreaker.getState(Platform.TIKTOK),
    [Platform.TWITTER]: circuitBreaker.getState(Platform.TWITTER),
  };

  // Determine overall status
  let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

  if (!ytdlpHealth.healthy) {
    status = 'unhealthy';
  } else {
    // Check if any circuit breaker is open
    const hasOpenCircuit = Object.values(cbStates).some(s => s === CircuitState.OPEN);
    if (hasOpenCircuit) {
      status = 'degraded';
    }
  }

  return {
    status,
    timestamp: new Date().toISOString(),
    components: {
      ytdlp: {
        healthy: ytdlpHealth.healthy,
        version: ytdlpHealth.version,
        error: ytdlpHealth.error,
      },
      queues: {
        info: { running: infoQueue.running, queued: infoQueue.queued },
        download: { running: downloadQueue.running, queued: downloadQueue.queued },
      },
      circuitBreakers: cbStates,
    },
  };
}

/**
 * Get detailed health with metrics
 */
export async function getDetailedHealth(): Promise<DetailedHealthStatus> {
  const basicHealth = await getHealth();
  const infoQueue = infoService.getQueueStatus();
  const downloadQueue = downloadService.getQueueStatus();
  const cacheStats = infoService.getCacheStats();

  return {
    ...basicHealth,
    metrics: metrics.getStats(
      {
        info: infoQueue,
        download: downloadQueue,
      },
      cacheStats
    ),
    cache: cacheStats,
  };
}

/**
 * Check yt-dlp health
 */
export async function checkYtDlpHealth(): Promise<boolean> {
  const health = await ytdlpEngine.checkHealth();
  return health.healthy;
}

/**
 * Update yt-dlp
 */
export async function updateYtDlp(): Promise<boolean> {
  return ytdlpEngine.update();
}

export default {
  getHealth,
  getDetailedHealth,
  checkYtDlpHealth,
  updateYtDlp,
};
