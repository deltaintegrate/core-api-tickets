import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Comment } from '../../../../domain/entities/Comment';

@Entity('comments')
export class CommentOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'ticket_id' })
  ticketId!: string;

  @Column({ name: 'author_id' })
  authorId!: string;

  @Column('text')
  content!: string;

  @Column({ name: 'is_internal', default: false })
  isInternal!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  static fromDomain(comment: Comment): CommentOrmEntity {
    const e = new CommentOrmEntity();
    e.id = comment.id;
    e.ticketId = comment.ticketId;
    e.authorId = comment.authorId;
    e.content = comment.content;
    e.isInternal = comment.isInternal;
    e.createdAt = comment.createdAt;
    return e;
  }

  toDomain(): Comment {
    return new Comment(this.id, this.ticketId, this.authorId, this.content, this.isInternal, this.createdAt);
  }
}
