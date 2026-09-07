import { ITicketRepository } from '../../../domain/ports/repositories/ITicketRepository';
import { AppError } from '../../../shared/errors/AppError';

export class DeleteTicketUseCase {
  constructor(private readonly ticketRepo: ITicketRepository) {}

  async execute(id: string): Promise<void> {
    const ticket = await this.ticketRepo.findById(id);
    if (!ticket) throw new AppError('Ticket not found', 404, 'TICKET_NOT_FOUND');
    await this.ticketRepo.delete(id);
  }
}
