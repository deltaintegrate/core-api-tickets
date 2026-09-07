import { v4 as uuidv4 } from 'uuid';
import { Comment } from '../../../domain/entities/Comment';
import { ITicketRepository } from '../../../domain/ports/repositories/ITicketRepository';
import { ICommentRepository } from '../../../domain/ports/repositories/ICommentRepository';
import { AppError } from '../../../shared/errors/AppError';

export interface AddCommentDto {
  content: string;
  isInternal?: boolean;
}

export class AddCommentUseCase {
  constructor(
    private readonly ticketRepo: ITicketRepository,
    private readonly commentRepo: ICommentRepository,
  ) {}

  async execute(ticketId: string, dto: AddCommentDto, authorId: string): Promise<Comment> {
    const ticket = await this.ticketRepo.findById(ticketId);
    if (!ticket) throw new AppError('Ticket not found', 404, 'TICKET_NOT_FOUND');

    const comment = new Comment(
      uuidv4(),
      ticketId,
      authorId,
      dto.content,
      dto.isInternal ?? false,
      new Date(),
    );

    return this.commentRepo.save(comment);
  }
}
