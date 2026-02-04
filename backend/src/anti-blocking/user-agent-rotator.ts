/**
 * User-Agent rotation for anti-blocking
 */

import { Platform } from '../types/platform.types.js';

// Realistic User-Agent strings from common browsers
const USER_AGENTS = {
  chrome: [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  ],
  firefox: [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0',
  ],
  safari: [
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
  ],
  edge: [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0',
  ],
  mobile: [
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  ],
};

// All User-Agents flattened
const ALL_USER_AGENTS = Object.values(USER_AGENTS).flat();

// Platform-specific User-Agent preferences
const PLATFORM_PREFERENCES: Record<Platform, (keyof typeof USER_AGENTS)[]> = {
  [Platform.YOUTUBE]: ['chrome', 'firefox', 'edge'],
  [Platform.TIKTOK]: ['chrome', 'mobile', 'safari'],
  [Platform.TWITTER]: ['chrome', 'firefox', 'safari'],
};

export class UserAgentRotator {
  private currentIndex = 0;
  private platformIndices: Map<Platform, number> = new Map();

  /**
   * Get the next User-Agent in rotation
   */
  getNext(): string {
    const ua = ALL_USER_AGENTS[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % ALL_USER_AGENTS.length;
    return ua;
  }

  /**
   * Get a random User-Agent
   */
  getRandom(): string {
    return ALL_USER_AGENTS[Math.floor(Math.random() * ALL_USER_AGENTS.length)];
  }

  /**
   * Get a User-Agent optimized for a specific platform
   */
  getForPlatform(platform: Platform): string {
    const preferences = PLATFORM_PREFERENCES[platform] || ['chrome'];
    const preferredAgents = preferences.flatMap((type) => USER_AGENTS[type]);

    // Rotate through preferred agents for this platform
    let index = this.platformIndices.get(platform) || 0;
    const ua = preferredAgents[index];
    this.platformIndices.set(platform, (index + 1) % preferredAgents.length);

    return ua;
  }

  /**
   * Get User-Agent from a specific browser type
   */
  getFromType(type: keyof typeof USER_AGENTS): string {
    const agents = USER_AGENTS[type];
    return agents[Math.floor(Math.random() * agents.length)];
  }

  /**
   * Get all available User-Agents
   */
  getAll(): string[] {
    return [...ALL_USER_AGENTS];
  }

  /**
   * Reset rotation indices
   */
  reset(): void {
    this.currentIndex = 0;
    this.platformIndices.clear();
  }
}

// Singleton instance
export const userAgentRotator = new UserAgentRotator();

// Default export for convenience
export default userAgentRotator;
