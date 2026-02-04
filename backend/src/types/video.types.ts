/**
 * Video and format types
 */

import { Platform } from './platform.types.js';

export interface VideoFormat {
  formatId: string;
  quality: string;
  height: number;
  width?: number;
  ext: string;
  filesize?: number;
  filesizeApprox?: number;
  hasAudio: boolean;
  hasVideo: boolean;
  vcodec?: string;
  acodec?: string;
  tbr?: number;
  abr?: number;
  vbr?: number;
  fps?: number;
  formatNote?: string;
}

export interface AudioFormat {
  formatId: string;
  quality: string;
  ext: string;
  filesize?: number;
  abr?: number;
  acodec?: string;
}

export interface VideoInfo {
  title: string;
  duration: number;
  thumbnail: string;
  uploader: string;
  description?: string;
  uploadDate?: string;
  viewCount?: number;
  likeCount?: number;
}

export interface VideoInfoResponse {
  success: boolean;
  platform: Platform;
  videoInfo: VideoInfo;
  formats: {
    video: VideoFormat[];
    audio: AudioFormat[];
  };
  availableQualities: string[];
  recommendedQuality: string;
}

export interface RawYtDlpInfo {
  id: string;
  title: string;
  description?: string;
  thumbnail?: string;
  thumbnails?: Array<{ url: string; width?: number; height?: number }>;
  uploader?: string;
  channel?: string;
  duration?: number;
  view_count?: number;
  like_count?: number;
  upload_date?: string;
  formats?: RawYtDlpFormat[];
  requested_formats?: RawYtDlpFormat[];
}

export interface RawYtDlpFormat {
  format_id: string;
  format_note?: string;
  ext: string;
  width?: number;
  height?: number;
  filesize?: number;
  filesize_approx?: number;
  vcodec?: string;
  acodec?: string;
  tbr?: number;
  abr?: number;
  vbr?: number;
  fps?: number;
  quality?: number;
}
