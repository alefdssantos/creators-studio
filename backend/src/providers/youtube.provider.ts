/**
 * YouTube provider implementation
 */

import path from 'path';
import { BaseProvider, ValidationResult } from './base.provider.js';
import { Platform, PlatformConfig, PLATFORM_CONFIGS } from '../types/platform.types.js';
import { VideoFormat, AudioFormat, VideoInfo, RawYtDlpInfo } from '../types/video.types.js';
import { DownloadRequest } from '../types/download.types.js';

export class YouTubeProvider extends BaseProvider {
  readonly platform = Platform.YOUTUBE;
  readonly config: PlatformConfig = PLATFORM_CONFIGS[Platform.YOUTUBE];

  validateUrl(url: string): ValidationResult {
    const videoId = this.extractVideoId(url);
    if (!videoId) {
      return {
        valid: false,
        error: 'URL do YouTube inválida',
      };
    }

    // Validate video ID format (11 characters, alphanumeric + _ and -)
    if (!/^[\w-]{11}$/.test(videoId)) {
      return {
        valid: false,
        error: 'ID do vídeo inválido',
      };
    }

    return {
      valid: true,
      normalizedUrl: this.normalizeUrl(url),
      videoId,
    };
  }

  extractVideoId(url: string): string | null {
    // Try various YouTube URL formats
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([\w-]{11})/,
      /youtube\.com\/watch\?.*v=([\w-]{11})/,
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
    const videoId = this.extractVideoId(url);
    if (videoId) {
      return `https://www.youtube.com/watch?v=${videoId}`;
    }
    return url;
  }

  parseVideoInfo(raw: RawYtDlpInfo): VideoInfo {
    return {
      title: raw.title || 'Sem título',
      duration: raw.duration || 0,
      thumbnail: raw.thumbnail || raw.thumbnails?.[0]?.url || '',
      uploader: raw.uploader || raw.channel || 'Desconhecido',
      description: raw.description?.substring(0, 200),
      uploadDate: raw.upload_date,
      viewCount: raw.view_count,
      likeCount: raw.like_count,
    };
  }

  parseVideoFormats(raw: RawYtDlpInfo): VideoFormat[] {
    const formats = raw.formats || [];

    // Filter video formats with height
    const videoFormats = formats
      .filter(f => f.vcodec && f.vcodec !== 'none' && f.height && f.height > 0)
      .map(f => ({
        formatId: f.format_id,
        quality: `${f.height}p`,
        height: f.height!,
        width: f.width,
        ext: 'mp4',
        filesize: f.filesize || f.filesize_approx,
        hasAudio: !!f.acodec && f.acodec !== 'none',
        hasVideo: true,
        vcodec: f.vcodec,
        acodec: f.acodec,
        tbr: f.tbr,
        fps: f.fps,
      }))
      .sort((a, b) => b.height - a.height);

    // Deduplicate by height (keep first occurrence which is highest quality)
    const seenHeights = new Set<number>();
    const deduped: VideoFormat[] = [];
    for (const format of videoFormats) {
      if (!seenHeights.has(format.height)) {
        seenHeights.add(format.height);
        deduped.push(format);
      }
    }

    // Filter to common qualities
    const commonHeights = [2160, 1440, 1080, 720, 480, 360, 240, 144];
    return deduped
      .filter(f => commonHeights.includes(f.height))
      .slice(0, 8);
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

    // Add extractor args
    if (this.config.extractorArgs) {
      args.push('--extractor-args', this.config.extractorArgs.join(','));
    }

    const ext = request.type === 'audio' ? (request.ext || 'mp3') : 'mp4';
    const outputFilename = `${filename}.${ext}`;
    const outputPath = path.join(outputDir, outputFilename);

    if (request.type === 'audio') {
      args.push('-x');
      args.push('--audio-format', request.ext || 'mp3');
      args.push('--audio-quality', '0');
      args.push('-o', outputPath.replace(`.${ext}`, '.%(ext)s'));
    } else {
      const height = request.quality ? parseInt(request.quality.replace('p', '')) : 720;
      // YouTube format selection with progressive fallbacks:
      // Prefer https protocol (m3u8 streams are often broken/Untested)
      // 1. Try https mp4+m4a at requested height
      // 2. Try https video at requested height + https audio
      // 3. Try any https video at height + any audio
      // 4. Fall back to best combined format
      // 5. Ultimate fallback to best single format
      args.push(
        '-f',
        `bestvideo[height<=${height}][ext=mp4][protocol=https]+bestaudio[ext=m4a][protocol=https]/` +
        `bestvideo[height<=${height}][protocol=https]+bestaudio[protocol=https]/` +
        `bestvideo[height<=${height}][protocol=https]+bestaudio/` +
        `bestvideo[height<=${height}]+bestaudio/` +
        `best[height<=${height}]/` +
        `bestvideo+bestaudio/` +
        `best`
      );
      args.push('--merge-output-format', 'mp4');
      args.push('-o', outputPath);
    }

    args.push(request.url);

    return { args, outputPath, outputFilename };
  }

  selectBestFormat(formats: VideoFormat[], preferredQuality: string): VideoFormat | null {
    // Try to find exact match
    const exact = formats.find(f => f.quality === preferredQuality);
    if (exact) return exact;

    // Find closest lower quality
    const preferredHeight = parseInt(preferredQuality.replace('p', ''));
    const sorted = formats.filter(f => f.height <= preferredHeight).sort((a, b) => b.height - a.height);

    return sorted[0] || formats[0] || null;
  }
}

export const youtubeProvider = new YouTubeProvider();

export default youtubeProvider;
