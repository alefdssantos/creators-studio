/**
 * Twitter/X provider implementation
 */

import path from 'path';
import { BaseProvider, ValidationResult } from './base.provider.js';
import { Platform, PlatformConfig, PLATFORM_CONFIGS } from '../types/platform.types.js';
import { VideoFormat, AudioFormat, VideoInfo, RawYtDlpInfo } from '../types/video.types.js';
import { DownloadRequest } from '../types/download.types.js';

export class TwitterProvider extends BaseProvider {
  readonly platform = Platform.TWITTER;
  readonly config: PlatformConfig = PLATFORM_CONFIGS[Platform.TWITTER];

  validateUrl(url: string): ValidationResult {
    const tweetId = this.extractVideoId(url);
    const urlLower = url.toLowerCase();

    if (!urlLower.includes('twitter.com') && !urlLower.includes('x.com')) {
      return {
        valid: false,
        error: 'URL do Twitter/X inválida',
      };
    }

    if (!tweetId) {
      return {
        valid: false,
        error: 'ID do tweet não encontrado na URL',
      };
    }

    return {
      valid: true,
      normalizedUrl: this.normalizeUrl(url),
      videoId: tweetId,
    };
  }

  extractVideoId(url: string): string | null {
    const pattern = /(?:twitter\.com|x\.com)\/[\w]+\/status\/(\d+)/;
    const match = url.match(pattern);
    return match ? match[1] : null;
  }

  normalizeUrl(url: string): string {
    const tweetId = this.extractVideoId(url);
    if (tweetId) {
      // Extract username if possible
      const userMatch = url.match(/(?:twitter\.com|x\.com)\/([\w]+)\/status/);
      const username = userMatch ? userMatch[1] : 'user';
      return `https://x.com/${username}/status/${tweetId}`;
    }
    return url;
  }

  parseVideoInfo(raw: RawYtDlpInfo): VideoInfo {
    return {
      title: raw.title || 'Vídeo Twitter',
      duration: raw.duration || 0,
      thumbnail: raw.thumbnail || raw.thumbnails?.[0]?.url || '',
      uploader: raw.uploader || raw.channel || 'Desconhecido',
      description: raw.description?.substring(0, 200),
      viewCount: raw.view_count,
      likeCount: raw.like_count,
    };
  }

  parseVideoFormats(raw: RawYtDlpInfo): VideoFormat[] {
    const formats = raw.formats || [];

    const videoFormats = formats
      .filter(f => f.vcodec && f.vcodec !== 'none')
      .map(f => ({
        formatId: f.format_id,
        quality: f.height ? `${f.height}p` : (f.format_note || 'Melhor'),
        height: f.height || 720,
        width: f.width,
        ext: 'mp4',
        filesize: f.filesize || f.filesize_approx,
        hasAudio: true, // Twitter videos have audio
        hasVideo: true,
        vcodec: f.vcodec,
        acodec: f.acodec,
        tbr: f.tbr,
      }))
      .sort((a, b) => (b.height || 0) - (a.height || 0));

    // Deduplicate by quality
    const seenQualities = new Set<string>();
    const deduped: VideoFormat[] = [];
    for (const format of videoFormats) {
      if (!seenQualities.has(format.quality)) {
        seenQualities.add(format.quality);
        deduped.push(format);
      }
    }

    return deduped.slice(0, 4);
  }

  parseAudioFormats(_raw: RawYtDlpInfo): AudioFormat[] {
    return [
      { formatId: 'bestaudio', quality: 'Melhor qualidade', ext: 'mp3' },
      { formatId: 'bestaudio', quality: 'Melhor qualidade', ext: 'm4a' },
    ];
  }

  buildDownloadArgs(request: DownloadRequest, outputDir: string, filename: string): {
    args: string[];
    outputPath: string;
    outputFilename: string;
  } {
    const args: string[] = [
      '--no-warnings',
      '--no-check-certificates',
    ];

    const ext = request.type === 'audio' ? (request.ext || 'mp3') : 'mp4';
    const outputFilename = `${filename}.${ext}`;
    const outputPath = path.join(outputDir, outputFilename);

    if (request.type === 'audio') {
      args.push('-x');
      args.push('--audio-format', request.ext || 'mp3');
      args.push('--audio-quality', '0');
      args.push('-o', outputPath.replace(`.${ext}`, '.%(ext)s'));
    } else {
      // Twitter: best quality available
      args.push('-f', 'best');
      args.push('-o', outputPath);
    }

    args.push(request.url);

    return { args, outputPath, outputFilename };
  }

  selectBestFormat(formats: VideoFormat[], preferredQuality: string): VideoFormat | null {
    const preferredHeight = parseInt(preferredQuality.replace('p', '')) || 720;

    // Find closest to preferred
    const sorted = [...formats].sort((a, b) => {
      const diffA = Math.abs(a.height - preferredHeight);
      const diffB = Math.abs(b.height - preferredHeight);
      return diffA - diffB;
    });

    return sorted[0] || formats[0] || null;
  }
}

export const twitterProvider = new TwitterProvider();

export default twitterProvider;
