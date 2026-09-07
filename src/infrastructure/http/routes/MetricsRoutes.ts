import { RequestHandler, Router } from 'express';
import { MetricsController } from '../controllers/MetricsController';
import { requireRole } from '../middlewares/RoleMiddleware';

export const createMetricsRoutes = (
  metricsController: MetricsController,
  authMiddleware: RequestHandler,
): Router => {
  const router = Router();

  router.get('/by-status', authMiddleware, requireRole('ADMIN', 'SUPERVISOR'), metricsController.byStatusAndClient);
  router.get('/stale', authMiddleware, requireRole('ADMIN', 'SUPERVISOR'), metricsController.staleTickets);
  router.get('/reassigned', authMiddleware, requireRole('ADMIN', 'SUPERVISOR'), metricsController.reassignedTickets);

  return router;
};
