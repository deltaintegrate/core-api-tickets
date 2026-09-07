import { NextFunction, Request, Response } from 'express';
import * as jwt from 'jsonwebtoken';
import { JwtPayload } from '../../../shared/types/express';
import { AppError } from '../../../shared/errors/AppError';

export const createAuthMiddleware =
  (jwtSecret: string) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return next(new AppError('Missing authorization token', 401, 'MISSING_TOKEN'));
    }

    const token = authHeader.split(' ')[1];
    try {
      const payload = jwt.verify(token, jwtSecret) as JwtPayload;
      req.user = payload;
      next();
    } catch {
      next(new AppError('Invalid or expired token', 401, 'INVALID_TOKEN'));
    }
  };
