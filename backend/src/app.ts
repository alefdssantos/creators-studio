/**
 * Express application configuration
 */

import express from 'express';
import cors from 'cors';
import routes from './routes/index.js';
import { errorHandler, requestLogger } from './middleware/index.js';
import { downloadService } from './services/index.js';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(requestLogger);

// Static files for downloads
app.use('/downloads', express.static(downloadService.getDownloadsDir()));

// API routes
app.use('/api', routes);

// Error handling
app.use(errorHandler);

export default app;
