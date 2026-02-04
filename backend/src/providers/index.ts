/**
 * Provider exports and factory
 */

import { Platform } from '../types/platform.types.js';
import { BaseProvider, detectPlatform } from './base.provider.js';
import { youtubeProvider } from './youtube.provider.js';
import { tiktokProvider } from './tiktok.provider.js';
import { twitterProvider } from './twitter.provider.js';

// Provider registry
const providers: Record<Platform, BaseProvider> = {
  [Platform.YOUTUBE]: youtubeProvider,
  [Platform.TIKTOK]: tiktokProvider,
  [Platform.TWITTER]: twitterProvider,
};

/**
 * Get provider for a specific platform
 */
export function getProvider(platform: Platform): BaseProvider {
  const provider = providers[platform];
  if (!provider) {
    throw new Error(`No provider found for platform: ${platform}`);
  }
  return provider;
}

/**
 * Get provider from URL
 */
export function getProviderFromUrl(url: string): BaseProvider | null {
  const detection = detectPlatform(url);
  if (!detection) return null;
  return providers[detection.platform] || null;
}

/**
 * Get all available providers
 */
export function getAllProviders(): BaseProvider[] {
  return Object.values(providers);
}

// Re-exports
export { BaseProvider, detectPlatform } from './base.provider.js';
export { YouTubeProvider, youtubeProvider } from './youtube.provider.js';
export { TikTokProvider, tiktokProvider } from './tiktok.provider.js';
export { TwitterProvider, twitterProvider } from './twitter.provider.js';
