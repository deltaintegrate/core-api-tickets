import { DataSource, Repository } from 'typeorm';
import { Comment } from '../../../../domain/entities/Comment';
import { ICommentRepository } from '../../../../domain/ports/repositories/ICommentRepository';
import { CommentOrmEntity } from '../entities/CommentOrmEntity';

export class CommentRepository implements ICommentRepository {
  private readonly repo: Repository<CommentOrmEntity>;

  constructor(dataSource: DataSource) {
    this.repo = dataSource.getRepository(CommentOrmEntity);
  }

  async findByTicketId(ticketId: string): Promise<Comment[]> {
    const entities = await this.repo.find({
      where: { ticketId },
      order: { createdAt: 'ASC' },
    });
    return entities.map((e) => e.toDomain());
  }

  async save(comment: Comment): Promise<Comment> {
    const entity = CommentOrmEntity.fromDomain(comment);
    const saved = await this.repo.save(entity);
    return saved.toDomain();
  }
}
