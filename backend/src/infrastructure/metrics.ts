/**
 * System metrics collection
 */

import { Platform } from '../types/platform.types.js';

export interface DownloadMetrics {
  total: number;
  completed: number;
  failed: number;
  inProgress: number;
  byPlatform: Record<Platform, { total: number; completed: number; failed: number }>;
}

export interface InfoMetrics {
  total: number;
  cached: number;
  fetched: number;
  failed: number;
  byPlatform: Record<Platform, { total: number; cached: number }>;
}

export interface SystemMetrics {
  uptime: string;
  uptimeSeconds: number;
  downloads: DownloadMetrics;
  infos: InfoMetrics;
  cacheHitRate: string;
  queues: {
    info: { running: number; queued: number };
    download: { running: number; queued: number };
  };
  cache: { size: number; hitRate: string };
}

export class Metrics {
  private startTime = Date.now();
  private downloads: DownloadMetrics = {
    total: 0,
    completed: 0,
    failed: 0,
    inProgress: 0,
    byPlatform: {
      [Platform.YOUTUBE]: { total: 0, completed: 0, failed: 0 },
      [Platform.TIKTOK]: { total: 0, completed: 0, failed: 0 },
      [Platform.TWITTER]: { total: 0, completed: 0, failed: 0 },
    },
  };
  private infos: InfoMetrics = {
    total: 0,
    cached: 0,
    fetched: 0,
    failed: 0,
    byPlatform: {
      [Platform.YOUTUBE]: { total: 0, cached: 0 },
      [Platform.TIKTOK]: { total: 0, cached: 0 },
      [Platform.TWITTER]: { total: 0, cached: 0 },
    },
  };

  /**
   * Record download start
   */
  recordDownloadStart(platform?: Platform): void {
    this.downloads.total++;
    this.downloads.inProgress++;
    if (platform) {
      this.downloads.byPlatform[platform].total++;
    }
  }

  /**
   * Record download completion
   */
  recordDownloadComplete(success: boolean, platform?: Platform): void {
    this.downloads.inProgress = Math.max(0, this.downloads.inProgress - 1);
    if (success) {
      this.downloads.completed++;
      if (platform) {
        this.downloads.byPlatform[platform].completed++;
      }
    } else {
      this.downloads.failed++;
      if (platform) {
        this.downloads.byPlatform[platform].failed++;
      }
    }
  }

  /**
   * Record info request
   */
  recordInfoRequest(fromCache: boolean, platform?: Platform): void {
    this.infos.total++;
    if (fromCache) {
      this.infos.cached++;
    } else {
      this.infos.fetched++;
    }
    if (platform) {
      this.infos.byPlatform[platform].total++;
      if (fromCache) {
        this.infos.byPlatform[platform].cached++;
      }
    }
  }

  /**
   * Record info request failure
   */
  recordInfoFailed(): void {
    this.infos.failed++;
  }

  /**
   * Get formatted uptime
   */
  getUptime(): { formatted: string; seconds: number } {
    const uptimeSeconds = Math.floor((Date.now() - this.startTime) / 1000);
    const hours = Math.floor(uptimeSeconds / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const seconds = uptimeSeconds % 60;

    return {
      formatted: `${hours}h ${minutes}m ${seconds}s`,
      seconds: uptimeSeconds,
    };
  }

  /**
   * Get cache hit rate
   */
  getCacheHitRate(): string {
    if (this.infos.total === 0) return '0%';
    return ((this.infos.cached / this.infos.total) * 100).toFixed(1) + '%';
  }

  /**
   * Get all stats
   */
  getStats(queueStatus?: {
    info: { running: number; queued: number };
    download: { running: number; queued: number };
  }, cacheStats?: { size: number; hitRate: string }): SystemMetrics {
    const uptime = this.getUptime();

    return {
      uptime: uptime.formatted,
      uptimeSeconds: uptime.seconds,
      downloads: { ...this.downloads },
      infos: { ...this.infos },
      cacheHitRate: this.getCacheHitRate(),
      queues: queueStatus || {
        info: { running: 0, queued: 0 },
        download: { running: 0, queued: 0 },
      },
      cache: cacheStats || { size: 0, hitRate: '0%' },
    };
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.startTime = Date.now();
    this.downloads = {
      total: 0,
      completed: 0,
      failed: 0,
      inProgress: 0,
      byPlatform: {
        [Platform.YOUTUBE]: { total: 0, completed: 0, failed: 0 },
        [Platform.TIKTOK]: { total: 0, completed: 0, failed: 0 },
        [Platform.TWITTER]: { total: 0, completed: 0, failed: 0 },
      },
    };
    this.infos = {
      total: 0,
      cached: 0,
      fetched: 0,
      failed: 0,
      byPlatform: {
        [Platform.YOUTUBE]: { total: 0, cached: 0 },
        [Platform.TIKTOK]: { total: 0, cached: 0 },
        [Platform.TWITTER]: { total: 0, cached: 0 },
      },
    };
  }
}

// Singleton instance
export const metrics = new Metrics();

export default metrics;
