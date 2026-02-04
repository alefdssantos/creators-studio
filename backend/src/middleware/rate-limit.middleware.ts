/**
 * Rate limiting middleware
 */

import { Request, Response, NextFunction } from 'express';
import { RateLimiter } from '../infrastructure/rate-limiter.js';
import { appConfig } from '../config/app.config.js';
import { logEvents } from '../logging/logger.js';

// Create rate limiters
const infoRateLimiter = new RateLimiter({
  windowMs: appConfig.rateLimit.info.windowMs,
  maxRequests: appConfig.rateLimit.info.max,
  name: 'info-rate-limiter',
});

const downloadRateLimiter = new RateLimiter({
  windowMs: appConfig.rateLimit.download.windowMs,
  maxRequests: appConfig.rateLimit.download.max,
  name: 'download-rate-limiter',
});

function getClientIp(req: Request): string {
  return (
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.ip ||
    req.socket.remoteAddress ||
    'unknown'
  );
}

export function rateLimitInfo(req: Request, res: Response, next: NextFunction): void {
  const ip = getClientIp(req);
  const result = infoRateLimiter.check(ip);

  res.setHeader('X-RateLimit-Limit', appConfig.rateLimit.info.max.toString());
  res.setHeader('X-RateLimit-Remaining', result.remaining.toString());
  res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetIn / 1000).toString());

  if (!result.allowed) {
    logEvents.rateLimited({ requestId: req.headers['x-request-id'] as string }, { type: 'info', remaining: 0 });
    res.status(429).json({
      error: 'Limite de buscas excedido',
      message: 'Aguarde um momento antes de tentar novamente',
      remaining: 0,
      retryAfter: Math.ceil(result.resetIn / 1000),
    });
    return;
  }

  next();
}

export function rateLimitDownload(req: Request, res: Response, next: NextFunction): void {
  const ip = getClientIp(req);
  const result = downloadRateLimiter.check(ip);

  res.setHeader('X-RateLimit-Limit', appConfig.rateLimit.download.max.toString());
  res.setHeader('X-RateLimit-Remaining', result.remaining.toString());
  res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetIn / 1000).toString());

  if (!result.allowed) {
    logEvents.rateLimited({ requestId: req.headers['x-request-id'] as string }, { type: 'download', remaining: 0 });
    res.status(429).json({
      error: 'Limite de downloads excedido',
      message: 'Aguarde um momento antes de tentar novamente',
      remaining: 0,
      retryAfter: Math.ceil(result.resetIn / 1000),
    });
    return;
  }

  next();
}

export default {
  rateLimitInfo,
  rateLimitDownload,
};
