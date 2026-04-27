import { Router } from 'express';
import authRoutes from './api/auth.js';
import userRoutes from './api/users.js';
import gamesRoutes from './api/games.js';
import challengesRoutes from './api/challenges.js';
import submissionsRoutes from './api/submissions.js';
import messagesRoutes from './api/messages.js';
import systemRoutes from './api/system.js';

const router = Router();

// Mount all sub-routers
router.use(authRoutes);
router.use(userRoutes);
router.use(gamesRoutes);
router.use(challengesRoutes);
router.use(submissionsRoutes);
router.use(messagesRoutes);
router.use(systemRoutes);

// Export router
export default router;

// Re-export utility functions that were previously exported from api.ts
export { getTodayEST, calculateScore, resolveGameData } from '../utils/gameUtils.js';