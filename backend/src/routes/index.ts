/**
 * Route aggregator
 */

import { Router } from 'express';
import healthRoutes from './health.routes.js';
import infoRoutes from './info.routes.js';
import downloadRoutes from './download.routes.js';
import adminRoutes from './admin.routes.js';

const router = Router();

// Mount routes
router.use(healthRoutes);
router.use(infoRoutes);
router.use(downloadRoutes);
router.use(adminRoutes);

export default router;
