import { RequestHandler, Router } from 'express';
import { TicketController } from '../controllers/TicketController';
import { ICryptoService } from '../../../domain/ports/services/ICryptoService';
import { requireRole } from '../middlewares/RoleMiddleware';
import { ecdhDecryptMiddleware } from '../middlewares/EcdhDecryptMiddleware';

export const createTicketRoutes = (
  ticketController: TicketController,
  cryptoService: ICryptoService,
  authMiddleware: RequestHandler,
): Router => {
  const router = Router();
  const decrypt = ecdhDecryptMiddleware(cryptoService);

  router.post('/', authMiddleware, requireRole('AGENT', 'ADMIN', 'SUPERVISOR'), decrypt, ticketController.create);
  router.get('/', authMiddleware, ticketController.getAll);
  router.get('/:id', authMiddleware, ticketController.getById);
  router.patch('/:id', authMiddleware, decrypt, ticketController.update);
  router.delete('/:id', authMiddleware, requireRole('ADMIN'), ticketController.delete);
  router.patch('/:id/assign', authMiddleware, requireRole('ADMIN', 'SUPERVISOR'), decrypt, ticketController.assign);

  return router;
};
