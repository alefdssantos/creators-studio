export const STORAGE_KEY = 'downloader_extension_queue';
export const SETTINGS_KEY = 'downloader_extension_settings';
export const BROADCAST_CHANNEL = 'downloader_sync';
export const PENDING_URLS_KEY = 'downloader_pending_urls';
export const DEFAULT_WEB_APP_URL = 'http://localhost:3000';

export const PLATFORM_COLORS: Record<string, string> = {
  youtube: '#FF0000',
  tiktok: '#000000',
  twitter: '#1DA1F2',
};

export const DEFAULT_SETTINGS = {
  overlayEnabled: true,
  overlayPosition: 'bottom-right' as const,
  webAppUrl: DEFAULT_WEB_APP_URL,
};
