/**
 * Custom headers management per platform
 */

import { Platform } from '../types/platform.types.js';
import { userAgentRotator } from './user-agent-rotator.js';

export interface RequestHeaders {
  'User-Agent': string;
  Accept: string;
  'Accept-Language': string;
  'Accept-Encoding'?: string;
  Referer?: string;
  Origin?: string;
  'Sec-Ch-Ua'?: string;
  'Sec-Ch-Ua-Mobile'?: string;
  'Sec-Ch-Ua-Platform'?: string;
  'Sec-Fetch-Dest'?: string;
  'Sec-Fetch-Mode'?: string;
  'Sec-Fetch-Site'?: string;
  Cookie?: string;
  [key: string]: string | undefined;
}

// Platform-specific header configurations
const PLATFORM_HEADERS: Record<Platform, Partial<RequestHeaders>> = {
  [Platform.YOUTUBE]: {
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9,pt-BR;q=0.8,pt;q=0.7',
    Referer: 'https://www.youtube.com/',
    Origin: 'https://www.youtube.com',
    'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'same-origin',
  },
  [Platform.TIKTOK]: {
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    Referer: 'https://www.tiktok.com/',
    Origin: 'https://www.tiktok.com',
    'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
  },
  [Platform.TWITTER]: {
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    Referer: 'https://x.com/',
    Origin: 'https://x.com',
    'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
  },
};

export class HeadersManager {
  private customHeaders: Map<string, string> = new Map();

  /**
   * Get headers for a specific platform
   */
  getForPlatform(platform: Platform, options?: { includeUserAgent?: boolean }): RequestHeaders {
    const baseHeaders = PLATFORM_HEADERS[platform] || {};
    const userAgent = userAgentRotator.getForPlatform(platform);

    const headers: RequestHeaders = {
      'User-Agent': options?.includeUserAgent !== false ? userAgent : '',
      Accept: baseHeaders.Accept || '*/*',
      'Accept-Language': baseHeaders['Accept-Language'] || 'en-US,en;q=0.9',
      ...baseHeaders,
    };

    // Add custom headers
    for (const [key, value] of this.customHeaders) {
      headers[key] = value;
    }

    // Remove empty values
    return Object.fromEntries(
      Object.entries(headers).filter(([_, v]) => v !== undefined && v !== '')
    ) as RequestHeaders;
  }

  /**
   * Get headers as array for yt-dlp
   */
  getAsYtDlpArgs(platform: Platform): string[] {
    const headers = this.getForPlatform(platform);
    const args: string[] = [];

    for (const [key, value] of Object.entries(headers)) {
      if (value) {
        args.push('--add-header', `${key}:${value}`);
      }
    }

    return args;
  }

  /**
   * Get User-Agent argument for yt-dlp
   */
  getUserAgentArg(platform: Platform): string[] {
    const userAgent = userAgentRotator.getForPlatform(platform);
    return ['--user-agent', userAgent];
  }

  /**
   * Set a custom header
   */
  setCustomHeader(key: string, value: string): void {
    this.customHeaders.set(key, value);
  }

  /**
   * Remove a custom header
   */
  removeCustomHeader(key: string): void {
    this.customHeaders.delete(key);
  }

  /**
   * Clear all custom headers
   */
  clearCustomHeaders(): void {
    this.customHeaders.clear();
  }

  /**
   * Get all custom headers
   */
  getCustomHeaders(): Map<string, string> {
    return new Map(this.customHeaders);
  }
}

// Singleton instance
export const headersManager = new HeadersManager();

export default headersManager;
