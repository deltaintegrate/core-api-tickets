import { TicketPriority } from '../value-objects/TicketPriority';
import { TicketStatus } from '../value-objects/TicketStatus';
import { DomainError } from '../../shared/errors/DomainError';

export class Ticket {
  constructor(
    public readonly id: string,
    public title: string,
    public description: string,
    public status: TicketStatus,
    public priority: TicketPriority,
    public readonly clientId: string,
    public readonly createdBy: string,
    public assignedTo: string | null,
    public readonly createdAt: Date,
    public updatedAt: Date,
    public resolvedAt: Date | null = null,
    public closedAt: Date | null = null,
  ) {}

  assign(userId: string): void {
    this.assignedTo = userId;
    this.updatedAt = new Date();
  }

  updateStatus(status: TicketStatus): void {
    if (this.status === TicketStatus.CLOSED) {
      throw new DomainError('Cannot change status of a closed ticket');
    }
    this.status = status;
    this.updatedAt = new Date();

    if (status === TicketStatus.RESOLVED) {
      this.resolvedAt = new Date();
    }
    if (status === TicketStatus.CLOSED) {
      this.closedAt = new Date();
    }
  }

  updateTitle(title: string): void {
    this.title = title;
    this.updatedAt = new Date();
  }

  updateDescription(description: string): void {
    this.description = description;
    this.updatedAt = new Date();
  }

  updatePriority(priority: TicketPriority): void {
    this.priority = priority;
    this.updatedAt = new Date();
  }

  reopen(): void {
    if (this.status !== TicketStatus.CLOSED && this.status !== TicketStatus.RESOLVED) {
      throw new DomainError('Only closed or resolved tickets can be reopened');
    }
    this.status = TicketStatus.OPEN;
    this.closedAt = null;
    this.resolvedAt = null;
    this.updatedAt = new Date();
  }
}
