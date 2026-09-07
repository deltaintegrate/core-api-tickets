import {
  IMetricsRepository,
  ReassignedTicket,
  TicketsByStatusAndClient,
} from '../../../domain/ports/repositories/IMetricsRepository';
import { TicketResponseDto } from '../../dtos/TicketResponseDto';

export class GetMetricsUseCase {
  constructor(private readonly metricsRepo: IMetricsRepository) {}

  async getByStatusAndClient(): Promise<TicketsByStatusAndClient[]> {
    return this.metricsRepo.countByStatusAndClient();
  }

  async getStaleTickets(hoursWithoutUpdate = 48): Promise<TicketResponseDto[]> {
    const tickets = await this.metricsRepo.findStale(hoursWithoutUpdate);
    return tickets.map(TicketResponseDto.fromDomain);
  }

  async getReassignedTickets(moreThan = 2): Promise<ReassignedTicket[]> {
    return this.metricsRepo.findReassignedMoreThan(moreThan);
  }
}
