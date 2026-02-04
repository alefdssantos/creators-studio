/**
 * Request logging middleware
 */

import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../logging/logger.js';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  // Generate request ID
  const requestId = (req.headers['x-request-id'] as string) || uuidv4();
  req.headers['x-request-id'] = requestId;
  res.setHeader('X-Request-Id', requestId);

  const startTime = Date.now();

  // Log request
  logger.info(
    {
      requestId,
      method: req.method,
      path: req.path,
      query: req.query,
      ip: req.ip,
    },
    `${req.method} ${req.path}`
  );

  // Log response on finish
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const level = res.statusCode >= 400 ? 'warn' : 'info';

    logger[level](
      {
        requestId,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        durationMs: duration,
      },
      `${req.method} ${req.path} ${res.statusCode} ${duration}ms`
    );
  });

  next();
}

export default requestLogger;
