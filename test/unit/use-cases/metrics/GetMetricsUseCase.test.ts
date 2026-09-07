import { GetMetricsUseCase } from '../../../../src/application/use-cases/metrics/GetMetricsUseCase';
import { IMetricsRepository } from '../../../../src/domain/ports/repositories/IMetricsRepository';
import { Ticket } from '../../../../src/domain/entities/Ticket';
import { TicketStatus } from '../../../../src/domain/value-objects/TicketStatus';
import { TicketPriority } from '../../../../src/domain/value-objects/TicketPriority';

const makeRepo = (): jest.Mocked<IMetricsRepository> => ({
  countByStatusAndClient: jest.fn().mockResolvedValue([
    { clientId: 'c1', status: 'OPEN', count: 5 },
    { clientId: 'c1', status: 'CLOSED', count: 2 },
  ]),
  findStale: jest.fn().mockResolvedValue([
    new Ticket('t-1', 'Old ticket', 'No update in 3 days', TicketStatus.OPEN, TicketPriority.LOW, 'c1', 'u1', null, new Date(), new Date()),
  ]),
  findReassignedMoreThan: jest.fn().mockResolvedValue([
    { ticketId: 't-2', count: 3 },
  ]),
});

describe('GetMetricsUseCase', () => {
  it('should return status counts grouped by client', async () => {
    const useCase = new GetMetricsUseCase(makeRepo());
    const result = await useCase.getByStatusAndClient();

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ clientId: 'c1', status: 'OPEN', count: 5 });
  });

  it('should return stale tickets as DTOs', async () => {
    const useCase = new GetMetricsUseCase(makeRepo());
    const result = await useCase.getStaleTickets(48);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('t-1');
    expect(result[0].status).toBe(TicketStatus.OPEN);
  });

  it('should delegate hoursWithoutUpdate param to repo', async () => {
    const repo = makeRepo();
    const useCase = new GetMetricsUseCase(repo);
    await useCase.getStaleTickets(72);

    expect(repo.findStale).toHaveBeenCalledWith(72);
  });

  it('should return reassigned tickets', async () => {
    const useCase = new GetMetricsUseCase(makeRepo());
    const result = await useCase.getReassignedTickets(2);

    expect(result).toHaveLength(1);
    expect(result[0].ticketId).toBe('t-2');
    expect(result[0].count).toBe(3);
  });

  it('should delegate moreThan param to repo', async () => {
    const repo = makeRepo();
    const useCase = new GetMetricsUseCase(repo);
    await useCase.getReassignedTickets(5);

    expect(repo.findReassignedMoreThan).toHaveBeenCalledWith(5);
  });
});
