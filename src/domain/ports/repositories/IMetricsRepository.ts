import { Ticket } from '../../entities/Ticket';

export interface TicketsByStatusAndClient {
  clientId: string;
  status: string;
  count: number;
}

export interface ReassignedTicket {
  ticketId: string;
  count: number;
}

export interface IMetricsRepository {
  countByStatusAndClient(): Promise<TicketsByStatusAndClient[]>;
  findStale(hoursWithoutUpdate: number): Promise<Ticket[]>;
  findReassignedMoreThan(times: number): Promise<ReassignedTicket[]>;
}
