import { ITicketRepository } from '../../../domain/ports/repositories/ITicketRepository';
import { AppError } from '../../../shared/errors/AppError';
import { TicketResponseDto } from '../../dtos/TicketResponseDto';

export class GetTicketUseCase {
  constructor(private readonly ticketRepo: ITicketRepository) {}

  async execute(id: string): Promise<TicketResponseDto> {
    const ticket = await this.ticketRepo.findById(id);
    if (!ticket) throw new AppError('Ticket not found', 404, 'TICKET_NOT_FOUND');
    return TicketResponseDto.fromDomain(ticket);
  }
}
