import { ITicketRepository, TicketFilters } from '../../../domain/ports/repositories/ITicketRepository';
import { TicketResponseDto } from '../../dtos/TicketResponseDto';

export class GetTicketsUseCase {
  constructor(private readonly ticketRepo: ITicketRepository) {}

  async execute(filters?: TicketFilters): Promise<TicketResponseDto[]> {
    const tickets = await this.ticketRepo.findAll(filters);
    return tickets.map(TicketResponseDto.fromDomain);
  }
}
