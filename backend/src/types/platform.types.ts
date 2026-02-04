/**
 * Platform types and configurations
 */

export enum Platform {
  YOUTUBE = 'youtube',
  TIKTOK = 'tiktok',
  TWITTER = 'twitter',
}

export interface PlatformConfig {
  name: Platform;
  patterns: RegExp[];
  displayName: string;
  defaultQuality: string;
  supportedQualities: string[];
  requiresAudioMerge: boolean;
  extractorArgs?: string[];
  customHeaders?: Record<string, string>;
}

export interface PlatformDetectionResult {
  platform: Platform;
  confidence: number;
  videoId: string | null;
  originalUrl: string;
  normalizedUrl: string;
}

export const PLATFORM_CONFIGS: Record<Platform, PlatformConfig> = {
  [Platform.YOUTUBE]: {
    name: Platform.YOUTUBE,
    patterns: [
      /(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([\w-]{11})/i,
      /youtube\.com\/watch\?.*v=([\w-]{11})/i,
    ],
    displayName: 'YouTube',
    defaultQuality: '720p',
    supportedQualities: ['2160p', '1440p', '1080p', '720p', '480p', '360p', '240p', '144p'],
    requiresAudioMerge: true,
    extractorArgs: ['youtube:player_client=web'],
  },
  [Platform.TIKTOK]: {
    name: Platform.TIKTOK,
    patterns: [
      /tiktok\.com\/@[\w.-]+\/video\/(\d+)/i,
      /tiktok\.com\/t\/([\w-]+)/i,
      /vm\.tiktok\.com\/([\w-]+)/i,
    ],
    displayName: 'TikTok',
    defaultQuality: '720p',
    supportedQualities: ['1080p', '720p', '480p', '360p'],
    requiresAudioMerge: false,
  },
  [Platform.TWITTER]: {
    name: Platform.TWITTER,
    patterns: [
      /(?:twitter\.com|x\.com)\/[\w]+\/status\/(\d+)/i,
    ],
    displayName: 'Twitter/X',
    defaultQuality: '720p',
    supportedQualities: ['1080p', '720p', '480p', '360p'],
    requiresAudioMerge: false,
  },
};
