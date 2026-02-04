/**
 * TikTok provider implementation
 */

import path from 'path';
import { BaseProvider, ValidationResult } from './base.provider.js';
import { Platform, PlatformConfig, PLATFORM_CONFIGS } from '../types/platform.types.js';
import { VideoFormat, AudioFormat, VideoInfo, RawYtDlpInfo } from '../types/video.types.js';
import { DownloadRequest } from '../types/download.types.js';

export class TikTokProvider extends BaseProvider {
  readonly platform = Platform.TIKTOK;
  readonly config: PlatformConfig = PLATFORM_CONFIGS[Platform.TIKTOK];

  validateUrl(url: string): ValidationResult {
    const videoId = this.extractVideoId(url);

    // TikTok URLs might not always have extractable IDs due to redirects
    // Accept if it looks like a TikTok URL
    if (!url.toLowerCase().includes('tiktok.com')) {
      return {
        valid: false,
        error: 'URL do TikTok inválida',
      };
    }

    return {
      valid: true,
      normalizedUrl: url, // TikTok URLs can have various formats
      videoId: videoId || undefined,
    };
  }

  extractVideoId(url: string): string | null {
    // TikTok video ID patterns
    const patterns = [
      /tiktok\.com\/@[\w.-]+\/video\/(\d+)/,
      /vm\.tiktok\.com\/([\w-]+)/,
      /tiktok\.com\/t\/([\w-]+)/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return null;
  }

  normalizeUrl(url: string): string {
    // TikTok URLs can redirect, so we keep the original
    return url;
  }

  parseVideoInfo(raw: RawYtDlpInfo): VideoInfo {
    return {
      title: raw.title || 'Vídeo TikTok',
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

    // Filter out watermarked versions and get video formats
    const videoFormats = formats
      .filter(f => {
        const hasWatermark =
          (f.format_note && f.format_note.toLowerCase().includes('watermark')) ||
          (f.format_id && f.format_id.toLowerCase().includes('watermark'));
        return f.vcodec && f.vcodec !== 'none' && !hasWatermark;
      })
      .map(f => ({
        formatId: f.format_id,
        quality: f.height ? `${f.height}p` : (f.format_note || 'Melhor'),
        height: f.height || 720,
        width: f.width,
        ext: 'mp4',
        filesize: f.filesize || f.filesize_approx,
        hasAudio: true, // TikTok videos usually have audio included
        hasVideo: true,
        vcodec: f.vcodec,
        acodec: f.acodec,
        formatNote: f.format_note,
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
      // TikTok: prefer no watermark, best quality
      args.push('-f', 'best');
      args.push('-o', outputPath);
    }

    args.push(request.url);

    return { args, outputPath, outputFilename };
  }

  selectBestFormat(formats: VideoFormat[], preferredQuality: string): VideoFormat | null {
    // For TikTok, usually just pick the best available
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

export const tiktokProvider = new TikTokProvider();

export default tiktokProvider;
