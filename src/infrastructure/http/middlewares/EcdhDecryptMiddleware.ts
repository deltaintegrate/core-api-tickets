import { NextFunction, Request, Response } from 'express';
import { ICryptoService } from '../../../domain/ports/services/ICryptoService';
import { AppError } from '../../../shared/errors/AppError';

export const ecdhDecryptMiddleware =
  (cryptoService: ICryptoService) =>
  (req: Request, res: Response, next: NextFunction): void => {
    if (req.headers['x-encrypted'] !== 'true') return next();

    try {
      const { publicKey, iv, authTag, encryptedData } = req.body as {
        publicKey?: string; iv?: string; authTag?: string; encryptedData?: string;
      };

      if (!publicKey || !iv || !authTag || !encryptedData) {
        throw new AppError('Missing encrypted payload fields', 400, 'INVALID_ENCRYPTED_PAYLOAD');
      }

      req.body = cryptoService.decrypt({ publicKey, iv, authTag, encryptedData });
      next();
    } catch (err) {
      if (err instanceof AppError) return next(err);
      next(new AppError('Failed to decrypt request body', 400, 'DECRYPTION_FAILED'));
    }
  };
