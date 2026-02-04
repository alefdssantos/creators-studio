/**
 * Error handling middleware
 */

import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/base.error.js';
import { ErrorClassifier } from '../errors/error-classifier.js';
import { logger } from '../logging/logger.js';

export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Log error
  logger.error(
    {
      error: error.message,
      stack: error.stack,
      path: req.path,
      method: req.method,
    },
    'Request error'
  );

  // Handle AppError
  if (error instanceof AppError) {
    const statusCode = ErrorClassifier.getHttpStatus(error.code);
    res.status(statusCode).json({
      error: error.message,
      details: error.toStructuredError(),
    });
    return;
  }

  // Handle validation errors (e.g., from zod)
  if (error.name === 'ZodError') {
    res.status(400).json({
      error: 'Dados inválidos',
      details: error,
    });
    return;
  }

  // Default error response
  const structuredError = ErrorClassifier.classify(error.message);
  const statusCode = ErrorClassifier.getHttpStatus(structuredError.code);

  res.status(statusCode).json({
    error: structuredError.message,
    details: structuredError,
  });
}

export default errorHandler;
