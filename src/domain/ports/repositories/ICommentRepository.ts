import { Comment } from '../../entities/Comment';

export interface ICommentRepository {
  findByTicketId(ticketId: string): Promise<Comment[]>;
  save(comment: Comment): Promise<Comment>;
}
