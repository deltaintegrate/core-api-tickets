import { NextFunction, Request, Response } from 'express';
import { CreateTicketUseCase } from '../../../application/use-cases/tickets/CreateTicketUseCase';
import { GetTicketUseCase } from '../../../application/use-cases/tickets/GetTicketUseCase';
import { GetTicketsUseCase } from '../../../application/use-cases/tickets/GetTicketsUseCase';
import { UpdateTicketUseCase } from '../../../application/use-cases/tickets/UpdateTicketUseCase';
import { DeleteTicketUseCase } from '../../../application/use-cases/tickets/DeleteTicketUseCase';
import { AssignTicketUseCase } from '../../../application/use-cases/tickets/AssignTicketUseCase';
import { CreateTicketDto } from '../../../application/dtos/CreateTicketDto';
import { UpdateTicketDto } from '../../../application/dtos/UpdateTicketDto';
import { AppError } from '../../../shared/errors/AppError';
import { TicketStatus } from '../../../domain/value-objects/TicketStatus';
import { TicketPriority } from '../../../domain/value-objects/TicketPriority';
import { validateDto } from '../../../shared/utils/validateDto';

export class TicketController {
  constructor(
    private readonly createTicketUseCase: CreateTicketUseCase,
    private readonly getTicketUseCase: GetTicketUseCase,
    private readonly getTicketsUseCase: GetTicketsUseCase,
    private readonly updateTicketUseCase: UpdateTicketUseCase,
    private readonly deleteTicketUseCase: DeleteTicketUseCase,
    private readonly assignTicketUseCase: AssignTicketUseCase,
  ) {}

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dto = await validateDto(CreateTicketDto, req.body);
      const result = await this.createTicketUseCase.execute(dto, req.user!.id);
      res.status(201).json({ success: true, data: result });
    } catch (err) { next(err); }
  };

  getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { status, priority, assignedTo, clientId } = req.query;
      const tickets = await this.getTicketsUseCase.execute({
        status: status as TicketStatus | undefined,
        priority: priority as TicketPriority | undefined,
        assignedTo: assignedTo as string | undefined,
        clientId: clientId as string | undefined,
      });
      res.status(200).json({ success: true, data: tickets });
    } catch (err) { next(err); }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ticket = await this.getTicketUseCase.execute(req.params.id);
      res.status(200).json({ success: true, data: ticket });
    } catch (err) { next(err); }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dto = await validateDto(UpdateTicketDto, req.body);
      const result = await this.updateTicketUseCase.execute(
        req.params.id,
        dto,
        req.user!.id,
        req.user!.role,
      );
      res.status(200).json({ success: true, data: result });
    } catch (err) { next(err); }
  };

  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.deleteTicketUseCase.execute(req.params.id);
      res.status(204).send();
    } catch (err) { next(err); }
  };

  assign = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { assignedTo } = req.body as { assignedTo?: string };
      if (!assignedTo) throw new AppError('assignedTo is required', 400, 'VALIDATION_ERROR');
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(assignedTo)) throw new AppError('assignedTo must be a valid UUID', 400, 'VALIDATION_ERROR');
      const result = await this.assignTicketUseCase.execute(req.params.id, assignedTo);
      res.status(200).json({ success: true, data: result });
    } catch (err) { next(err); }
  };
}
