/**
 * Application configuration
 */

export const appConfig = {
  server: {
    port: parseInt(process.env.PORT || '3001', 10),
    host: process.env.HOST || '0.0.0.0',
  },

  queue: {
    maxConcurrentDownloads: parseInt(process.env.MAX_CONCURRENT_DOWNLOADS || '3', 10),
    maxConcurrentInfo: parseInt(process.env.MAX_CONCURRENT_INFO || '5', 10),
  },

  cache: {
    ttlMinutes: parseInt(process.env.CACHE_TTL_MINUTES || '30', 10),
    maxSize: parseInt(process.env.CACHE_MAX_SIZE || '1000', 10),
  },

  rateLimit: {
    info: {
      windowMs: 60000,
      max: parseInt(process.env.RATE_LIMIT_INFO || '20', 10),
    },
    download: {
      windowMs: 60000,
      max: parseInt(process.env.RATE_LIMIT_DOWNLOAD || '10', 10),
    },
  },

  limits: {
    maxVideoDuration: parseInt(process.env.MAX_VIDEO_DURATION || '3600', 10),
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '1073741824', 10),
  },

  cleanup: {
    maxAge: parseInt(process.env.CLEANUP_MAX_AGE || '300000', 10),
    interval: parseInt(process.env.CLEANUP_INTERVAL || '60000', 10),
  },

  downloads: {
    directory: process.env.DOWNLOADS_DIR || './downloads',
  },

  ytdlp: {
    path: process.env.YTDLP_PATH || 'yt-dlp',
    autoUpdate: process.env.YTDLP_AUTO_UPDATE !== 'false',
    updateCooldown: parseInt(process.env.YTDLP_UPDATE_COOLDOWN || '300000', 10),
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
    pretty: process.env.NODE_ENV !== 'production',
  },
} as const;

export type AppConfig = typeof appConfig;
