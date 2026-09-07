import { ITicketRepository } from '../../../domain/ports/repositories/ITicketRepository';
import { AppError } from '../../../shared/errors/AppError';
import { TicketResponseDto } from '../../dtos/TicketResponseDto';

export class AssignTicketUseCase {
  constructor(private readonly ticketRepo: ITicketRepository) {}

  async execute(ticketId: string, assignedTo: string): Promise<TicketResponseDto> {
    const ticket = await this.ticketRepo.findById(ticketId);
    if (!ticket) throw new AppError('Ticket not found', 404, 'TICKET_NOT_FOUND');

    ticket.assign(assignedTo);
    const saved = await this.ticketRepo.save(ticket);
    return TicketResponseDto.fromDomain(saved);
  }
}
