import { Platform, VideoDetectionResult } from '@shared/types';

export class UrlDetector {
  detectPlatform(url: string): Platform | null {
    const urlLower = url.toLowerCase();
    if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be')) {
      return 'youtube';
    }
    if (urlLower.includes('tiktok.com') || urlLower.includes('vm.tiktok.com')) {
      return 'tiktok';
    }
    if (urlLower.includes('twitter.com') || urlLower.includes('x.com')) {
      return 'twitter';
    }
    return null;
  }

  extractVideoUrl(): VideoDetectionResult | null {
    const currentUrl = window.location.href;
    const platform = this.detectPlatform(currentUrl);

    if (!platform) return null;

    switch (platform) {
      case 'youtube':
        return this.extractYouTubeUrl(currentUrl);
      case 'tiktok':
        return this.extractTikTokUrl(currentUrl);
      case 'twitter':
        return this.extractTwitterUrl(currentUrl);
      default:
        return null;
    }
  }

  private extractYouTubeUrl(url: string): VideoDetectionResult | null {
    // Standard watch URLs: youtube.com/watch?v=VIDEO_ID
    const watchMatch = url.match(/youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/);
    if (watchMatch) {
      return {
        url: `https://www.youtube.com/watch?v=${watchMatch[1]}`,
        platform: 'youtube',
        videoId: watchMatch[1],
      };
    }

    // Shorts: youtube.com/shorts/VIDEO_ID
    const shortsMatch = url.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]+)/);
    if (shortsMatch) {
      return {
        url: `https://www.youtube.com/shorts/${shortsMatch[1]}`,
        platform: 'youtube',
        videoId: shortsMatch[1],
      };
    }

    // Short URLs: youtu.be/VIDEO_ID
    const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]+)/);
    if (shortMatch) {
      return {
        url: `https://youtu.be/${shortMatch[1]}`,
        platform: 'youtube',
        videoId: shortMatch[1],
      };
    }

    return null;
  }

  private extractTikTokUrl(url: string): VideoDetectionResult | null {
    // Standard video URLs: tiktok.com/@user/video/VIDEO_ID
    const videoMatch = url.match(/tiktok\.com\/@[^/]+\/video\/(\d+)/);
    if (videoMatch) {
      const cleanUrl = url.split('?')[0];
      return {
        url: cleanUrl,
        platform: 'tiktok',
        videoId: videoMatch[1],
      };
    }

    // Photo URLs (some are actually videos): tiktok.com/@user/photo/VIDEO_ID
    const photoMatch = url.match(/tiktok\.com\/@[^/]+\/photo\/(\d+)/);
    if (photoMatch) {
      const cleanUrl = url.split('?')[0];
      return {
        url: cleanUrl,
        platform: 'tiktok',
        videoId: photoMatch[1],
      };
    }

    // TikTok FYP or profile with video modal: extract video ID from URL params
    const videoIdParam = url.match(/[?&]video_id=(\d+)/);
    if (videoIdParam) {
      return {
        url: `https://www.tiktok.com/video/${videoIdParam[1]}`,
        platform: 'tiktok',
        videoId: videoIdParam[1],
      };
    }

    // TikTok short URLs: vm.tiktok.com/XXXXX or tiktok.com/t/XXXXX
    const shortMatch = url.match(/(?:vm\.tiktok\.com|tiktok\.com\/t)\/([a-zA-Z0-9]+)/);
    if (shortMatch) {
      return {
        url: url.split('?')[0],
        platform: 'tiktok',
        videoId: shortMatch[1],
      };
    }

    // If on TikTok with @username, might be viewing their profile/video
    const profileMatch = url.match(/tiktok\.com\/(@[^/?]+)/);
    if (profileMatch) {
      // Return the current URL, backend will handle it
      return {
        url: url.split('?')[0],
        platform: 'tiktok',
        videoId: profileMatch[1],
      };
    }

    return null;
  }

  private extractTwitterUrl(url: string): VideoDetectionResult | null {
    // Status URLs: twitter.com/user/status/TWEET_ID or x.com/user/status/TWEET_ID
    const statusMatch = url.match(/(twitter\.com|x\.com)\/[^/]+\/status\/(\d+)/);
    if (statusMatch) {
      // Normalize to x.com format (current official domain)
      const cleanUrl = url.replace('twitter.com', 'x.com').split('?')[0];
      return {
        url: cleanUrl,
        platform: 'twitter',
        videoId: statusMatch[2],
      };
    }

    // Twitter/X video URLs with /video/ suffix
    const videoStatusMatch = url.match(/(twitter\.com|x\.com)\/[^/]+\/status\/(\d+)\/video/);
    if (videoStatusMatch) {
      const cleanUrl = `https://x.com/${url.split('/')[3]}/status/${videoStatusMatch[2]}`;
      return {
        url: cleanUrl,
        platform: 'twitter',
        videoId: videoStatusMatch[2],
      };
    }

    // Twitter/X i/status format
    const iStatusMatch = url.match(/(twitter\.com|x\.com)\/i\/status\/(\d+)/);
    if (iStatusMatch) {
      const cleanUrl = url.replace('twitter.com', 'x.com').split('?')[0];
      return {
        url: cleanUrl,
        platform: 'twitter',
        videoId: iStatusMatch[2],
      };
    }

    return null;
  }

  // Watch for URL changes in SPAs (YouTube, etc.)
  watchUrlChanges(callback: (result: VideoDetectionResult | null) => void): () => void {
    let lastUrl = window.location.href;

    const checkUrl = () => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        callback(this.extractVideoUrl());
      }
    };

    // MutationObserver for YouTube's SPA navigation
    const observer = new MutationObserver(checkUrl);
    observer.observe(document.body, { childList: true, subtree: true });

    // Listen to popstate for history changes
    window.addEventListener('popstate', checkUrl);

    // Periodic check as fallback
    const interval = setInterval(checkUrl, 1000);

    // Return cleanup function
    return () => {
      observer.disconnect();
      window.removeEventListener('popstate', checkUrl);
      clearInterval(interval);
    };
  }
}
