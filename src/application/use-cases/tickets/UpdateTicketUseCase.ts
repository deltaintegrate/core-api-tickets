import { ITicketRepository } from '../../../domain/ports/repositories/ITicketRepository';
import { AppError } from '../../../shared/errors/AppError';
import { UpdateTicketDto } from '../../dtos/UpdateTicketDto';
import { TicketResponseDto } from '../../dtos/TicketResponseDto';

export class UpdateTicketUseCase {
  constructor(private readonly ticketRepo: ITicketRepository) {}

  async execute(
    id: string,
    dto: UpdateTicketDto,
    requesterId: string,
    requesterRole: string,
  ): Promise<TicketResponseDto> {
    const ticket = await this.ticketRepo.findById(id);
    if (!ticket) throw new AppError('Ticket not found', 404, 'TICKET_NOT_FOUND');

    // AGENTs can only update tickets assigned to them
    if (requesterRole === 'AGENT' && ticket.assignedTo !== requesterId) {
      throw new AppError('You can only update tickets assigned to you', 403, 'FORBIDDEN');
    }

    if (dto.title !== undefined) ticket.updateTitle(dto.title);
    if (dto.description !== undefined) ticket.updateDescription(dto.description);
    if (dto.priority !== undefined) ticket.updatePriority(dto.priority);
    if (dto.status !== undefined) ticket.updateStatus(dto.status);
    if (dto.assignedTo !== undefined) ticket.assign(dto.assignedTo);

    const updated = await this.ticketRepo.save(ticket);
    return TicketResponseDto.fromDomain(updated);
  }
}
