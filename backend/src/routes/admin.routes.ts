/**
 * Admin routes - update, cache clear, etc.
 */

import { Router, Request, Response } from 'express';
import * as healthService from '../services/health.service.js';
import * as infoService from '../services/info.service.js';

const router = Router();

// Update yt-dlp
router.post('/update', async (_req: Request, res: Response) => {
  try {
    const success = await healthService.updateYtDlp();
    if (success) {
      res.json({ success: true, message: 'yt-dlp atualizado' });
    } else {
      res.status(500).json({ error: 'Erro ao atualizar yt-dlp' });
    }
  } catch (error) {
    res.status(500).json({
      error: 'Erro ao atualizar yt-dlp',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

// Clear cache
router.post('/cache/clear', (_req: Request, res: Response) => {
  infoService.clearCache();
  res.json({ success: true, message: 'Cache limpo' });
});

export default router;
