import { Ticket } from '../../entities/Ticket';
import { TicketStatus } from '../../value-objects/TicketStatus';
import { TicketPriority } from '../../value-objects/TicketPriority';

export interface TicketFilters {
  status?: TicketStatus;
  priority?: TicketPriority;
  assignedTo?: string;
  clientId?: string;
  createdBy?: string;
}

export interface ITicketRepository {
  findById(id: string): Promise<Ticket | null>;
  findAll(filters?: TicketFilters): Promise<Ticket[]>;
  save(ticket: Ticket): Promise<Ticket>;
  delete(id: string): Promise<void>;
}
