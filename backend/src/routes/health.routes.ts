/**
 * Health check routes
 */

import { Router, Request, Response } from 'express';
import * as healthService from '../services/health.service.js';

const router = Router();

// Basic health check
router.get('/health', async (_req: Request, res: Response) => {
  const health = await healthService.getHealth();
  const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;
  res.status(statusCode).json(health);
});

// Detailed metrics
router.get('/metrics', async (_req: Request, res: Response) => {
  const health = await healthService.getDetailedHealth();
  res.json(health.metrics);
});

export default router;
