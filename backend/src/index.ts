/**
 * Application entry point
 */

import app from './app.js';
import { appConfig } from './config/app.config.js';
import { logEvents, logger } from './logging/logger.js';
import { ytdlpEngine } from './engines/ytdlp.engine.js';
import { FileCleanup } from './infrastructure/file-cleanup.js';
import { downloadService } from './services/index.js';
import { createServer } from 'net';

const PREFERRED_PORT = appConfig.server.port;
const HOST = appConfig.server.host;

// Initialize file cleanup
const fileCleanup = new FileCleanup({
  directory: downloadService.getDownloadsDir(),
  maxAgeMs: appConfig.cleanup.maxAge,
  intervalMs: appConfig.cleanup.interval,
});

// Find an available port starting from the preferred one
function findAvailablePort(startPort: number, maxAttempts = 10): Promise<number> {
  return new Promise((resolve, reject) => {
    let attempts = 0;

    function tryPort(port: number) {
      if (attempts >= maxAttempts) {
        reject(new Error(`Could not find available port after ${maxAttempts} attempts`));
        return;
      }

      const server = createServer();
      server.once('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          attempts++;
          logger.warn(`Port ${port} in use, trying ${port + 1}...`);
          tryPort(port + 1);
        } else {
          reject(err);
        }
      });

      server.once('listening', () => {
        server.close(() => resolve(port));
      });

      server.listen(port, HOST);
    }

    tryPort(startPort);
  });
}

// Startup sequence
async function startup() {
  // Check yt-dlp health
  logger.info('Checking yt-dlp...');
  const health = await ytdlpEngine.checkHealth();

  if (!health.healthy) {
    logger.warn('yt-dlp not found or not working, attempting install...');
    await ytdlpEngine.update();
  }

  // Start file cleanup
  fileCleanup.start(appConfig.cleanup.interval);
  logger.info(
    `File cleanup started (every ${appConfig.cleanup.interval / 1000}s, max age ${appConfig.cleanup.maxAge / 1000}s)`
  );

  // Find available port
  const PORT = await findAvailablePort(PREFERRED_PORT);

  if (PORT !== PREFERRED_PORT) {
    logger.info(`Using alternative port ${PORT} (preferred port ${PREFERRED_PORT} was in use)`);
  }

  // Start server
  app.listen(PORT, HOST, () => {
    logEvents.serverStarted({ port: PORT, host: HOST });

    console.log(`
╔════════════════════════════════════════════════════════════╗
║                    DOWNLOADER SERVER                       ║
╠════════════════════════════════════════════════════════════╣
║  URL:          http://${HOST}:${PORT.toString().padEnd(4)}                        ║
║  Downloads:    Max ${appConfig.queue.maxConcurrentDownloads} simultâneos                       ║
║  Info Queue:   Max ${appConfig.queue.maxConcurrentInfo} simultâneos                       ║
║  Cache:        ${appConfig.cache.ttlMinutes} minutos TTL                          ║
║  Rate Limit:   ${appConfig.rateLimit.download.max} downloads/min, ${appConfig.rateLimit.info.max} buscas/min     ║
║  Cleanup:      Arquivos > ${appConfig.cleanup.maxAge / 60000} min são deletados           ║
╚════════════════════════════════════════════════════════════╝
    `);
  });
}

// Graceful shutdown
function shutdown() {
  logEvents.serverShutdown();
  logger.info('Shutting down...');
  fileCleanup.stop();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.fatal({ error: error.message, stack: error.stack }, 'Uncaught exception');
  shutdown();
});

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled rejection');
});

// Start the application
startup().catch((error) => {
  logger.fatal({ error: error.message }, 'Failed to start application');
  process.exit(1);
});
