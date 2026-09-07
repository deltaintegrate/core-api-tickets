import { RequestHandler, Router } from 'express';
import { CommentController } from '../controllers/CommentController';
import { ICryptoService } from '../../../domain/ports/services/ICryptoService';
import { ecdhDecryptMiddleware } from '../middlewares/EcdhDecryptMiddleware';

export const createCommentRoutes = (
  commentController: CommentController,
  cryptoService: ICryptoService,
  authMiddleware: RequestHandler,
): Router => {
  const router = Router({ mergeParams: true });
  const decrypt = ecdhDecryptMiddleware(cryptoService);

  router.post('/', authMiddleware, decrypt, commentController.add);
  router.get('/', authMiddleware, commentController.getAll);

  return router;
};
