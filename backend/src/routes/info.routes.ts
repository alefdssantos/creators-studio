/**
 * Video info routes
 */

import { Router, Request, Response } from 'express';
import { rateLimitInfo } from '../middleware/rate-limit.middleware.js';
import { validateUrl } from '../services/validation.service.js';
import { fetchVideoInfo } from '../services/info.service.js';
import { ErrorClassifier } from '../errors/error-classifier.js';

const router = Router();

// Get video info
router.post('/info', rateLimitInfo, async (req: Request, res: Response) => {
  try {
    const { url } = req.body;
    const requestId = req.headers['x-request-id'] as string;

    // Validate URL
    const validation = validateUrl(url);
    if (!validation.valid || !validation.platform) {
      const statusCode = ErrorClassifier.getHttpStatus(validation.error!.code);
      res.status(statusCode).json({
        error: validation.error!.message,
        details: validation.error!.toStructuredError(),
      });
      return;
    }

    // Fetch info
    const result = await fetchVideoInfo(url, validation.platform, { requestId });

    if (result.success && result.data) {
      res.json(result.data);
    } else {
      const statusCode = result.error ? ErrorClassifier.getHttpStatus(result.error.code) : 500;
      res.status(statusCode).json({
        error: result.error?.message || 'Erro ao buscar informações do vídeo',
        details: result.error,
      });
    }
  } catch (error) {
    const structuredError = ErrorClassifier.classify(
      error instanceof Error ? error.message : String(error)
    );
    res.status(500).json({
      error: structuredError.message,
      details: structuredError,
    });
  }
});

export default router;
