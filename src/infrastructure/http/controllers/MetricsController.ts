import { NextFunction, Request, Response } from 'express';
import { GetMetricsUseCase } from '../../../application/use-cases/metrics/GetMetricsUseCase';

export class MetricsController {
  constructor(private readonly getMetricsUseCase: GetMetricsUseCase) {}

  byStatusAndClient = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.getMetricsUseCase.getByStatusAndClient();
      res.status(200).json({ success: true, data });
    } catch (err) { next(err); }
  };

  staleTickets = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.getMetricsUseCase.getStaleTickets();
      res.status(200).json({ success: true, data });
    } catch (err) { next(err); }
  };

  reassignedTickets = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.getMetricsUseCase.getReassignedTickets();
      res.status(200).json({ success: true, data });
    } catch (err) { next(err); }
  };
}
