/**
 * Base provider interface for platform-specific implementations
 */

import { Platform, PlatformConfig, PlatformDetectionResult, PLATFORM_CONFIGS } from '../types/platform.types.js';
import { VideoFormat, AudioFormat, VideoInfo, RawYtDlpInfo } from '../types/video.types.js';
import { DownloadRequest } from '../types/download.types.js';

export interface ValidationResult {
  valid: boolean;
  error?: string;
  normalizedUrl?: string;
  videoId?: string;
}

export interface InfoOptions {
  timeout?: number;
  userAgent?: string;
}

export interface DownloadArgs {
  args: string[];
  outputPath: string;
  outputFilename: string;
}

export abstract class BaseProvider {
  abstract readonly platform: Platform;
  abstract readonly config: PlatformConfig;

  /**
   * Validate URL belongs to this platform
   */
  abstract validateUrl(url: string): ValidationResult;

  /**
   * Extract video ID from URL
   */
  abstract extractVideoId(url: string): string | null;

  /**
   * Normalize URL to canonical form
   */
  abstract normalizeUrl(url: string): string;

  /**
   * Parse raw yt-dlp info into standardized format
   */
  abstract parseVideoInfo(raw: RawYtDlpInfo): VideoInfo;

  /**
   * Parse raw yt-dlp formats into video formats
   */
  abstract parseVideoFormats(raw: RawYtDlpInfo): VideoFormat[];

  /**
   * Parse raw yt-dlp formats into audio formats
   */
  abstract parseAudioFormats(raw: RawYtDlpInfo): AudioFormat[];

  /**
   * Build yt-dlp arguments for download
   */
  abstract buildDownloadArgs(request: DownloadRequest, outputDir: string, filename: string): DownloadArgs;

  /**
   * Select best format based on available options and preferences
   */
  abstract selectBestFormat(formats: VideoFormat[], preferredQuality: string): VideoFormat | null;

  /**
   * Get fallback qualities when preferred is not available
   */
  getFallbackQualities(quality: string): string[] {
    const allQualities = this.config.supportedQualities;
    const qualityIndex = allQualities.indexOf(quality);
    if (qualityIndex === -1) {
      return [this.config.defaultQuality, ...allQualities.slice(allQualities.indexOf(this.config.defaultQuality))];
    }
    return allQualities.slice(qualityIndex);
  }

  /**
   * Get recommended quality based on available formats
   */
  getRecommendedQuality(formats: VideoFormat[]): string {
    const preferredOrder = ['720p', '1080p', '480p', '360p'];
    const availableQualities = formats.map(f => f.quality);

    for (const quality of preferredOrder) {
      if (availableQualities.includes(quality)) {
        return quality;
      }
    }

    return formats[0]?.quality || this.config.defaultQuality;
  }

  /**
   * Get custom headers for this platform
   */
  getCustomHeaders(): Record<string, string> {
    return this.config.customHeaders || {};
  }

  /**
   * Get extractor args for yt-dlp
   */
  getExtractorArgs(): string[] {
    return this.config.extractorArgs || [];
  }

  /**
   * Check if platform requires audio merge for video downloads
   */
  requiresAudioMerge(): boolean {
    return this.config.requiresAudioMerge;
  }
}

/**
 * Detect platform from URL
 */
export function detectPlatform(url: string): PlatformDetectionResult | null {
  const urlLower = url.toLowerCase();

  for (const [platform, config] of Object.entries(PLATFORM_CONFIGS)) {
    for (const pattern of config.patterns) {
      const match = url.match(pattern);
      if (match) {
        return {
          platform: platform as Platform,
          confidence: 1.0,
          videoId: match[1] || null,
          originalUrl: url,
          normalizedUrl: url, // Will be set by provider
        };
      }
    }
  }

  // Fallback to simple hostname check
  if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be')) {
    return {
      platform: Platform.YOUTUBE,
      confidence: 0.8,
      videoId: null,
      originalUrl: url,
      normalizedUrl: url,
    };
  }

  if (urlLower.includes('tiktok.com')) {
    return {
      platform: Platform.TIKTOK,
      confidence: 0.8,
      videoId: null,
      originalUrl: url,
      normalizedUrl: url,
    };
  }

  if (urlLower.includes('twitter.com') || urlLower.includes('x.com')) {
    return {
      platform: Platform.TWITTER,
      confidence: 0.8,
      videoId: null,
      originalUrl: url,
      normalizedUrl: url,
    };
  }

  return null;
}

export default BaseProvider;
