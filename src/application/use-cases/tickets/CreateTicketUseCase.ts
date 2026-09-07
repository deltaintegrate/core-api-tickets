import { v4 as uuidv4 } from 'uuid';
import { Ticket } from '../../../domain/entities/Ticket';
import { ITicketRepository } from '../../../domain/ports/repositories/ITicketRepository';
import { IClientRepository } from '../../../domain/ports/repositories/IClientRepository';
import { TicketPriority } from '../../../domain/value-objects/TicketPriority';
import { TicketStatus } from '../../../domain/value-objects/TicketStatus';
import { AppError } from '../../../shared/errors/AppError';
import { CreateTicketDto } from '../../dtos/CreateTicketDto';
import { TicketResponseDto } from '../../dtos/TicketResponseDto';

export class CreateTicketUseCase {
  constructor(
    private readonly ticketRepo: ITicketRepository,
    private readonly clientRepo: IClientRepository,
  ) {}

  async execute(dto: CreateTicketDto, createdBy: string): Promise<TicketResponseDto> {
    const client = await this.clientRepo.findById(dto.clientId);
    if (!client) throw new AppError('Client not found', 404, 'CLIENT_NOT_FOUND');

    const now = new Date();
    const ticket = new Ticket(
      uuidv4(),
      dto.title,
      dto.description,
      TicketStatus.OPEN,
      dto.priority ?? TicketPriority.MEDIUM,
      dto.clientId,
      createdBy,
      dto.assignedTo ?? null,
      now,
      now,
    );

    const saved = await this.ticketRepo.save(ticket);
    return TicketResponseDto.fromDomain(saved);
  }
}
