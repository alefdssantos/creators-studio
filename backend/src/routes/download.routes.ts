/**
 * Download routes
 */

import { Router, Request, Response } from 'express';
import fs from 'fs';
import { rateLimitDownload } from '../middleware/rate-limit.middleware.js';
import * as downloadService from '../services/download.service.js';
import { ErrorClassifier } from '../errors/error-classifier.js';
import { DownloadStatus } from '../types/download.types.js';

const router = Router();

// Start download
router.post('/download', rateLimitDownload, async (req: Request, res: Response) => {
  try {
    const { url, type, ext, quality } = req.body;

    const result = await downloadService.startDownload({
      url,
      type: type || 'video',
      ext,
      quality,
    });

    res.json(result);
  } catch (error) {
    if (error && typeof error === 'object' && 'toStructuredError' in error) {
      const appError = error as { toStructuredError: () => unknown; message: string; code: string };
      const statusCode = ErrorClassifier.getHttpStatus(appError.code as any);
      res.status(statusCode).json({
        error: appError.message,
        details: appError.toStructuredError(),
      });
      return;
    }

    const structuredError = ErrorClassifier.classify(
      error instanceof Error ? error.message : String(error)
    );
    res.status(500).json({
      error: structuredError.message,
      details: structuredError,
    });
  }
});

// Get download progress
router.get('/progress/:downloadId', (req: Request, res: Response) => {
  const { downloadId } = req.params;
  const progress = downloadService.getProgress(downloadId);

  if (!progress) {
    res.status(404).json({ error: 'Download não encontrado' });
    return;
  }

  // Map to legacy format for frontend compatibility
  res.json({
    progress: progress.progress,
    status: progress.status,
    filename: progress.filename,
    downloadUrl: progress.downloadUrl,
    error: progress.error?.message,
    position: progress.position,
  });
});

// Download file
router.get('/file/:downloadId', (req: Request, res: Response) => {
  const { downloadId } = req.params;
  const progress = downloadService.getProgress(downloadId);

  if (!progress || progress.status !== DownloadStatus.COMPLETED) {
    res.status(404).json({ error: 'Arquivo não disponível' });
    return;
  }

  const filePath = downloadService.getFilePath(downloadId);
  if (!filePath || !fs.existsSync(filePath)) {
    res.status(404).json({ error: 'Arquivo não encontrado' });
    return;
  }

  // Send file
  res.download(filePath, progress.filename!, (err) => {
    if (err) {
      console.error('Error sending file:', err);
    }

    // Schedule cleanup after download
    setTimeout(() => {
      downloadService.deleteDownload(downloadId);
    }, 30000);
  });
});

export default router;
