import { NextFunction, Request, Response } from 'express';
import { AppError } from '../../../shared/errors/AppError';

export const requireRole =
  (...roles: string[]) =>
  (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) return next(new AppError('Unauthenticated', 401, 'UNAUTHENTICATED'));
    if (!roles.includes(req.user.role)) return next(new AppError('Insufficient permissions', 403, 'FORBIDDEN'));
    next();
  };
