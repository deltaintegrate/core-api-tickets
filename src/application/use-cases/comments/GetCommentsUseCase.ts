import { Comment } from '../../../domain/entities/Comment';
import { ICommentRepository } from '../../../domain/ports/repositories/ICommentRepository';

export class GetCommentsUseCase {
  constructor(private readonly commentRepo: ICommentRepository) {}

  async execute(ticketId: string): Promise<Comment[]> {
    return this.commentRepo.findByTicketId(ticketId);
  }
}
