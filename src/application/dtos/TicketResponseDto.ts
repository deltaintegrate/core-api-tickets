import { Ticket } from '../../domain/entities/Ticket';

export class TicketResponseDto {
  id!: string;
  title!: string;
  description!: string;
  status!: string;
  priority!: string;
  clientId!: string;
  assignedTo!: string | null;
  createdBy!: string;
  createdAt!: Date;
  updatedAt!: Date;
  resolvedAt!: Date | null;
  closedAt!: Date | null;

  static fromDomain(ticket: Ticket): TicketResponseDto {
    const dto = new TicketResponseDto();
    dto.id = ticket.id;
    dto.title = ticket.title;
    dto.description = ticket.description;
    dto.status = ticket.status;
    dto.priority = ticket.priority;
    dto.clientId = ticket.clientId;
    dto.assignedTo = ticket.assignedTo;
    dto.createdBy = ticket.createdBy;
    dto.createdAt = ticket.createdAt;
    dto.updatedAt = ticket.updatedAt;
    dto.resolvedAt = ticket.resolvedAt;
    dto.closedAt = ticket.closedAt;
    return dto;
  }
}
