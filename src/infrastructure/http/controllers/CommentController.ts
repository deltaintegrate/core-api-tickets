import { NextFunction, Request, Response } from 'express';
import { AddCommentUseCase } from '../../../application/use-cases/comments/AddCommentUseCase';
import { GetCommentsUseCase } from '../../../application/use-cases/comments/GetCommentsUseCase';
import { AppError } from '../../../shared/errors/AppError';

export class CommentController {
  constructor(
    private readonly addCommentUseCase: AddCommentUseCase,
    private readonly getCommentsUseCase: GetCommentsUseCase,
  ) {}

  add = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { content, isInternal } = req.body as { content?: string; isInternal?: boolean };
      if (!content) throw new AppError('content is required', 400, 'VALIDATION_ERROR');

      const comment = await this.addCommentUseCase.execute(
        req.params.ticketId,
        { content, isInternal },
        req.user!.id,
      );
      res.status(201).json({ success: true, data: comment });
    } catch (err) { next(err); }
  };

  getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const comments = await this.getCommentsUseCase.execute(req.params.ticketId);
      res.status(200).json({ success: true, data: comments });
    } catch (err) { next(err); }
  };
}
