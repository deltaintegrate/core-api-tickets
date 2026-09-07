import { UpdateTicketUseCase } from '../../../../src/application/use-cases/tickets/UpdateTicketUseCase';
import { ITicketRepository } from '../../../../src/domain/ports/repositories/ITicketRepository';
import { Ticket } from '../../../../src/domain/entities/Ticket';
import { TicketStatus } from '../../../../src/domain/value-objects/TicketStatus';
import { TicketPriority } from '../../../../src/domain/value-objects/TicketPriority';

const makeTicket = (assignedTo: string | null = 'agent-1') =>
  new Ticket(
    'ticket-1',
    'Original Title',
    'Original description text',
    TicketStatus.OPEN,
    TicketPriority.MEDIUM,
    'client-1',
    'user-1',
    assignedTo,
    new Date(),
    new Date(),
  );

const makeRepo = (ticket: Ticket | null = makeTicket()): jest.Mocked<ITicketRepository> => ({
  findById: jest.fn().mockResolvedValue(ticket),
  findAll: jest.fn(),
  save: jest.fn().mockImplementation(async (t: Ticket) => t),
  delete: jest.fn(),
});

describe('UpdateTicketUseCase', () => {
  it('should update title for ADMIN', async () => {
    const useCase = new UpdateTicketUseCase(makeRepo());
    const result = await useCase.execute('ticket-1', { title: 'New Title' }, 'any-user', 'ADMIN');
    expect(result.title).toBe('New Title');
  });

  it('should allow AGENT to update their own assigned ticket', async () => {
    const useCase = new UpdateTicketUseCase(makeRepo(makeTicket('agent-1')));
    const result = await useCase.execute('ticket-1', { title: 'Agent Update' }, 'agent-1', 'AGENT');
    expect(result.title).toBe('Agent Update');
  });

  it('should block AGENT from updating a ticket assigned to another agent', async () => {
    const useCase = new UpdateTicketUseCase(makeRepo(makeTicket('other-agent')));
    await expect(
      useCase.execute('ticket-1', { title: 'Hacked' }, 'agent-1', 'AGENT'),
    ).rejects.toMatchObject({ statusCode: 403, code: 'FORBIDDEN' });
  });

  it('should update status to RESOLVED and set resolvedAt', async () => {
    const repo = makeRepo();
    const useCase = new UpdateTicketUseCase(repo);
    await useCase.execute('ticket-1', { status: TicketStatus.RESOLVED }, 'user-1', 'ADMIN');

    const savedTicket: Ticket = repo.save.mock.calls[0][0];
    expect(savedTicket.status).toBe(TicketStatus.RESOLVED);
    expect(savedTicket.resolvedAt).toBeInstanceOf(Date);
  });

  it('should throw 404 if ticket not found', async () => {
    const useCase = new UpdateTicketUseCase(makeRepo(null));
    await expect(
      useCase.execute('bad-id', { title: 'X' }, 'user-1', 'ADMIN'),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
