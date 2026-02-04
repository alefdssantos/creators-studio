/**
 * Video info cache with LRU eviction
 */

import { logger } from '../logging/logger.js';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
}

export interface CacheOptions {
  ttlMs: number;
  maxSize: number;
  name?: string;
}

export interface CacheStats {
  size: number;
  maxSize: number;
  ttlMs: number;
  hits: number;
  misses: number;
  hitRate: string;
}

export class LRUCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private ttlMs: number;
  private maxSize: number;
  private name: string;
  private hits = 0;
  private misses = 0;

  constructor(options: CacheOptions) {
    this.ttlMs = options.ttlMs;
    this.maxSize = options.maxSize;
    this.name = options.name || 'cache';
  }

  /**
   * Generate normalized cache key from URL
   */
  generateKey(url: string): string {
    try {
      const urlObj = new URL(url);

      // YouTube - extract video ID
      if (urlObj.hostname.includes('youtube') || urlObj.hostname.includes('youtu.be')) {
        const videoId =
          urlObj.searchParams.get('v') ||
          urlObj.pathname.split('/').pop()?.split('?')[0];
        return `youtube:${videoId}`;
      }

      // TikTok - extract video ID
      if (urlObj.hostname.includes('tiktok')) {
        const match = url.match(/video\/(\d+)/);
        return match ? `tiktok:${match[1]}` : `tiktok:${urlObj.pathname}`;
      }

      // Twitter - extract tweet ID
      if (urlObj.hostname.includes('twitter') || urlObj.hostname.includes('x.com')) {
        const match = url.match(/status\/(\d+)/);
        return match ? `twitter:${match[1]}` : `twitter:${urlObj.pathname}`;
      }

      return url;
    } catch {
      return url;
    }
  }

  /**
   * Get item from cache
   */
  get(url: string): T | null {
    const key = this.generateKey(url);
    const entry = this.cache.get(key);

    if (!entry) {
      this.misses++;
      return null;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }

    // Update access info
    entry.accessCount++;
    entry.lastAccessed = Date.now();
    this.hits++;

    return entry.data;
  }

  /**
   * Set item in cache
   */
  set(url: string, data: T): void {
    const key = this.generateKey(url);

    // Evict if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      accessCount: 1,
      lastAccessed: Date.now(),
    });
  }

  /**
   * Check if key exists and is not expired
   */
  has(url: string): boolean {
    const key = this.generateKey(url);
    const entry = this.cache.get(key);

    if (!entry) return false;
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Delete item from cache
   */
  delete(url: string): boolean {
    const key = this.generateKey(url);
    return this.cache.delete(key);
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
    logger.info({ cache: this.name }, 'Cache cleared');
  }

  /**
   * Evict least recently used item
   */
  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestAccess = Infinity;

    for (const [key, entry] of this.cache) {
      if (entry.lastAccessed < oldestAccess) {
        oldestAccess = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Remove expired entries
   */
  cleanup(): number {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp > this.ttlMs) {
        this.cache.delete(key);
        removed++;
      }
    }

    return removed;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.hits + this.misses;
    const hitRate = total > 0 ? ((this.hits / total) * 100).toFixed(1) + '%' : '0%';

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      ttlMs: this.ttlMs,
      hits: this.hits,
      misses: this.misses,
      hitRate,
    };
  }

  /**
   * Get all keys
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }
}

export default LRUCache;
