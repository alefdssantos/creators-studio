export type Platform = 'youtube' | 'tiktok' | 'twitter';

export interface QueuedVideo {
  id: string;
  url: string;
  platform: Platform;
  addedAt: number;
  synced: boolean;
}

export interface VideoDetectionResult {
  url: string;
  platform: Platform;
  videoId?: string;
}

export interface ExtensionSettings {
  overlayEnabled: boolean;
  overlayPosition: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  webAppUrl: string;
}

export interface BroadcastMessage {
  type: 'ADD_URL' | 'REMOVE_URL' | 'CLEAR_QUEUE';
  payload?: QueuedVideo | string;
}
