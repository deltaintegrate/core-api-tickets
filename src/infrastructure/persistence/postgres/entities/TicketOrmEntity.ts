import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Ticket } from '../../../../domain/entities/Ticket';
import { TicketPriority } from '../../../../domain/value-objects/TicketPriority';
import { TicketStatus } from '../../../../domain/value-objects/TicketStatus';

@Entity('tickets')
export class TicketOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  title!: string;

  @Column('text')
  description!: string;

  @Column({ type: 'varchar', length: 50, default: TicketStatus.OPEN })
  status!: TicketStatus;

  @Column({ type: 'varchar', length: 50, default: TicketPriority.MEDIUM })
  priority!: TicketPriority;

  @Column({ name: 'client_id' })
  clientId!: string;

  @Column({ name: 'created_by' })
  createdBy!: string;

  @Column({ name: 'assigned_to', nullable: true, type: 'uuid' })
  assignedTo!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @Column({ name: 'resolved_at', nullable: true, type: 'timestamp' })
  resolvedAt!: Date | null;

  @Column({ name: 'closed_at', nullable: true, type: 'timestamp' })
  closedAt!: Date | null;

  static fromDomain(ticket: Ticket): TicketOrmEntity {
    const e = new TicketOrmEntity();
    e.id = ticket.id;
    e.title = ticket.title;
    e.description = ticket.description;
    e.status = ticket.status;
    e.priority = ticket.priority;
    e.clientId = ticket.clientId;
    e.createdBy = ticket.createdBy;
    e.assignedTo = ticket.assignedTo;
    e.createdAt = ticket.createdAt;
    e.updatedAt = ticket.updatedAt;
    e.resolvedAt = ticket.resolvedAt;
    e.closedAt = ticket.closedAt;
    return e;
  }

  toDomain(): Ticket {
    return new Ticket(
      this.id,
      this.title,
      this.description,
      this.status,
      this.priority,
      this.clientId,
      this.createdBy,
      this.assignedTo,
      this.createdAt,
      this.updatedAt,
      this.resolvedAt,
      this.closedAt,
    );
  }
}
