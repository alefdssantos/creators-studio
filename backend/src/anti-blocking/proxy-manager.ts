/**
 * Proxy management for optional proxy rotation
 */

import { Platform } from '../types/platform.types.js';
import { logger } from '../logging/logger.js';

export interface ProxyConfig {
  url: string;
  protocol: 'http' | 'https' | 'socks4' | 'socks5';
  host: string;
  port: number;
  username?: string;
  password?: string;
  platforms?: Platform[];
  priority?: number;
  healthy: boolean;
  lastChecked?: number;
  failureCount: number;
}

export class ProxyManager {
  private proxies: ProxyConfig[] = [];
  private currentIndex = 0;
  private enabled = false;

  /**
   * Initialize proxy manager with configuration
   */
  initialize(options?: { enabled?: boolean; proxies?: ProxyConfig[] }): void {
    this.enabled = options?.enabled ?? false;
    this.proxies = options?.proxies ?? [];

    // Load from environment if available
    const envProxy = process.env.YTDLP_PROXY || process.env.HTTP_PROXY || process.env.HTTPS_PROXY;
    if (envProxy && this.proxies.length === 0) {
      const parsed = this.parseProxyUrl(envProxy);
      if (parsed) {
        this.proxies.push(parsed);
        this.enabled = true;
      }
    }

    if (this.enabled && this.proxies.length > 0) {
      logger.info(
        { proxyCount: this.proxies.length },
        `Proxy manager initialized with ${this.proxies.length} proxies`
      );
    }
  }

  /**
   * Parse proxy URL into config
   */
  private parseProxyUrl(url: string): ProxyConfig | null {
    try {
      const parsed = new URL(url);
      return {
        url,
        protocol: (parsed.protocol.replace(':', '') as ProxyConfig['protocol']) || 'http',
        host: parsed.hostname,
        port: parseInt(parsed.port, 10) || 8080,
        username: parsed.username || undefined,
        password: parsed.password || undefined,
        healthy: true,
        failureCount: 0,
      };
    } catch {
      logger.error({ url }, 'Failed to parse proxy URL');
      return null;
    }
  }

  /**
   * Check if proxy is enabled
   */
  isEnabled(): boolean {
    return this.enabled && this.proxies.length > 0;
  }

  /**
   * Get the next available proxy
   */
  getNext(): ProxyConfig | null {
    if (!this.enabled || this.proxies.length === 0) {
      return null;
    }

    // Find next healthy proxy
    const startIndex = this.currentIndex;
    do {
      const proxy = this.proxies[this.currentIndex];
      this.currentIndex = (this.currentIndex + 1) % this.proxies.length;

      if (proxy.healthy) {
        return proxy;
      }
    } while (this.currentIndex !== startIndex);

    // No healthy proxies, reset all and try first
    this.resetAllProxies();
    return this.proxies[0] || null;
  }

  /**
   * Get proxy for specific platform
   */
  getForPlatform(platform: Platform): ProxyConfig | null {
    if (!this.enabled || this.proxies.length === 0) {
      return null;
    }

    // Find proxy that supports this platform
    const platformProxy = this.proxies.find(
      (p) => p.healthy && (!p.platforms || p.platforms.includes(platform))
    );

    return platformProxy || this.getNext();
  }

  /**
   * Get proxy URL formatted for yt-dlp
   */
  getProxyUrl(proxy?: ProxyConfig | null): string | null {
    const p = proxy || this.getNext();
    if (!p) return null;

    let url = `${p.protocol}://`;
    if (p.username && p.password) {
      url += `${encodeURIComponent(p.username)}:${encodeURIComponent(p.password)}@`;
    }
    url += `${p.host}:${p.port}`;

    return url;
  }

  /**
   * Get yt-dlp proxy arguments
   */
  getYtDlpArgs(platform?: Platform): string[] {
    const proxy = platform ? this.getForPlatform(platform) : this.getNext();
    const url = this.getProxyUrl(proxy);

    if (!url) return [];

    return ['--proxy', url];
  }

  /**
   * Mark proxy as failed
   */
  markFailed(proxy: ProxyConfig): void {
    proxy.failureCount++;
    if (proxy.failureCount >= 3) {
      proxy.healthy = false;
      proxy.lastChecked = Date.now();
      logger.warn(
        { proxy: proxy.host, failures: proxy.failureCount },
        'Proxy marked unhealthy'
      );
    }
  }

  /**
   * Mark proxy as successful
   */
  markSuccess(proxy: ProxyConfig): void {
    proxy.failureCount = 0;
    proxy.healthy = true;
    proxy.lastChecked = Date.now();
  }

  /**
   * Reset all proxies to healthy
   */
  resetAllProxies(): void {
    for (const proxy of this.proxies) {
      proxy.healthy = true;
      proxy.failureCount = 0;
    }
    logger.info('All proxies reset to healthy');
  }

  /**
   * Add a new proxy
   */
  addProxy(config: Partial<ProxyConfig> & { url: string }): boolean {
    const parsed = this.parseProxyUrl(config.url);
    if (!parsed) return false;

    this.proxies.push({
      ...parsed,
      ...config,
      healthy: true,
      failureCount: 0,
    });
    this.enabled = true;
    return true;
  }

  /**
   * Remove a proxy
   */
  removeProxy(url: string): boolean {
    const index = this.proxies.findIndex((p) => p.url === url);
    if (index === -1) return false;

    this.proxies.splice(index, 1);
    if (this.proxies.length === 0) {
      this.enabled = false;
    }
    return true;
  }

  /**
   * Get all proxies
   */
  getAll(): ProxyConfig[] {
    return [...this.proxies];
  }

  /**
   * Get healthy proxy count
   */
  getHealthyCount(): number {
    return this.proxies.filter((p) => p.healthy).length;
  }
}

// Singleton instance
export const proxyManager = new ProxyManager();

export default proxyManager;
