import 'reflect-metadata';
import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { DataSource } from 'typeorm';
import { AppError } from './shared/errors/AppError';
import { DomainError } from './shared/errors/DomainError';
import { EcdhCryptoService } from './infrastructure/services/EcdhCryptoService';
import { TicketRepository } from './infrastructure/persistence/postgres/repositories/TicketRepository';
import { CommentRepository } from './infrastructure/persistence/postgres/repositories/CommentRepository';
import { ClientRepository } from './infrastructure/persistence/postgres/repositories/ClientRepository';
import { CreateTicketUseCase } from './application/use-cases/tickets/CreateTicketUseCase';
import { GetTicketUseCase } from './application/use-cases/tickets/GetTicketUseCase';
import { GetTicketsUseCase } from './application/use-cases/tickets/GetTicketsUseCase';
import { UpdateTicketUseCase } from './application/use-cases/tickets/UpdateTicketUseCase';
import { DeleteTicketUseCase } from './application/use-cases/tickets/DeleteTicketUseCase';
import { AssignTicketUseCase } from './application/use-cases/tickets/AssignTicketUseCase';
import { AddCommentUseCase } from './application/use-cases/comments/AddCommentUseCase';
import { GetCommentsUseCase } from './application/use-cases/comments/GetCommentsUseCase';
import { GetMetricsUseCase } from './application/use-cases/metrics/GetMetricsUseCase';
import { TicketController } from './infrastructure/http/controllers/TicketController';
import { CommentController } from './infrastructure/http/controllers/CommentController';
import { MetricsController } from './infrastructure/http/controllers/MetricsController';
import { createAuthMiddleware } from './infrastructure/http/middlewares/AuthMiddleware';
import { createTicketRoutes } from './infrastructure/http/routes/TicketRoutes';
import { createCommentRoutes } from './infrastructure/http/routes/CommentRoutes';
import { createMetricsRoutes } from './infrastructure/http/routes/MetricsRoutes';
import { createCryptoRoutes } from './infrastructure/http/routes/CryptoRoutes';

export const createApp = (dataSource: DataSource): express.Application => {
  const app = express();

  // --- Infrastructure services ---
  const cryptoService = new EcdhCryptoService(process.env.ECDH_CURVE ?? 'prime256v1');
  const authMiddleware = createAuthMiddleware(process.env.JWT_SECRET!);

  // --- Repositories ---
  const ticketRepo = new TicketRepository(dataSource);
  const commentRepo = new CommentRepository(dataSource);
  const clientRepo = new ClientRepository(dataSource);

  // --- Use cases ---
  const createTicketUseCase = new CreateTicketUseCase(ticketRepo, clientRepo);
  const getTicketUseCase = new GetTicketUseCase(ticketRepo);
  const getTicketsUseCase = new GetTicketsUseCase(ticketRepo);
  const updateTicketUseCase = new UpdateTicketUseCase(ticketRepo);
  const deleteTicketUseCase = new DeleteTicketUseCase(ticketRepo);
  const assignTicketUseCase = new AssignTicketUseCase(ticketRepo);
  const addCommentUseCase = new AddCommentUseCase(ticketRepo, commentRepo);
  const getCommentsUseCase = new GetCommentsUseCase(commentRepo);
  const getMetricsUseCase = new GetMetricsUseCase(ticketRepo);

  // --- Controllers ---
  const ticketController = new TicketController(
    createTicketUseCase, getTicketUseCase, getTicketsUseCase,
    updateTicketUseCase, deleteTicketUseCase, assignTicketUseCase,
  );
  const commentController = new CommentController(addCommentUseCase, getCommentsUseCase);
  const metricsController = new MetricsController(getMetricsUseCase);

  // --- Global middlewares ---
  app.use(helmet());
  app.use(cors());
  app.use(express.json());

  // --- Health check ---
  app.get('/api/v1/health', (_req, res) => {
    res.status(200).json({ status: 'ok', service: 'core-api-tickets' });
  });

  // --- Routes ---
  app.use('/api/v1/tickets', createTicketRoutes(ticketController, cryptoService, authMiddleware));
  app.use('/api/v1/tickets/:ticketId/comments', createCommentRoutes(commentController, cryptoService, authMiddleware));
  app.use('/api/v1/metrics', createMetricsRoutes(metricsController, authMiddleware));
  app.use('/api/v1/crypto', createCryptoRoutes(cryptoService));

  // --- 404 ---
  app.use((_req, res) => {
    res.status(404).json({ success: false, error: 'Not Found' });
  });

  // --- Global error handler ---
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ success: false, error: err.message, code: err.code });
      return;
    }
    if (err instanceof DomainError) {
      res.status(422).json({ success: false, error: err.message, code: 'DOMAIN_ERROR' });
      return;
    }
    console.error(err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  });

  return app;
};
