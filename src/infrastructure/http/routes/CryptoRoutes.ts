import { Router, Request, Response } from 'express';
import { ICryptoService } from '../../../domain/ports/services/ICryptoService';

export const createCryptoRoutes = (cryptoService: ICryptoService): Router => {
  const router = Router();
  router.get('/public-key', (_req: Request, res: Response) => {
    res.status(200).json({ success: true, data: { publicKey: cryptoService.getPublicKey() } });
  });
  return router;
};
