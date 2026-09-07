import { CreateTicketUseCase } from '../../../../src/application/use-cases/tickets/CreateTicketUseCase';
import { ITicketRepository } from '../../../../src/domain/ports/repositories/ITicketRepository';
import { IClientRepository } from '../../../../src/domain/ports/repositories/IClientRepository';
import { Ticket } from '../../../../src/domain/entities/Ticket';
import { Client } from '../../../../src/domain/entities/Client';
import { TicketStatus } from '../../../../src/domain/value-objects/TicketStatus';
import { TicketPriority } from '../../../../src/domain/value-objects/TicketPriority';

const mockClient = new Client('client-1', 'Acme', 'acme@test.com', new Date());

const makeTicketRepo = (): jest.Mocked<ITicketRepository> => ({
  findById: jest.fn(),
  findAll: jest.fn(),
  save: jest.fn().mockImplementation(async (t: Ticket) => t),
  delete: jest.fn(),
});

const makeClientRepo = (client: Client | null = mockClient): jest.Mocked<IClientRepository> => ({
  findById: jest.fn().mockResolvedValue(client),
  findAll: jest.fn(),
  save: jest.fn(),
});

describe('CreateTicketUseCase', () => {
  it('should create a ticket with OPEN status and MEDIUM priority by default', async () => {
    const useCase = new CreateTicketUseCase(makeTicketRepo(), makeClientRepo());
    const result = await useCase.execute(
      { title: 'Login bug', description: 'Cannot login at all', clientId: 'client-1' },
      'user-1',
    );

    expect(result.status).toBe(TicketStatus.OPEN);
    expect(result.priority).toBe(TicketPriority.MEDIUM);
    expect(result.clientId).toBe('client-1');
    expect(result.createdBy).toBe('user-1');
  });

  it('should use provided priority', async () => {
    const useCase = new CreateTicketUseCase(makeTicketRepo(), makeClientRepo());
    const result = await useCase.execute(
      { title: 'Critical bug', description: 'System is down completely', clientId: 'client-1', priority: TicketPriority.CRITICAL },
      'user-1',
    );
    expect(result.priority).toBe(TicketPriority.CRITICAL);
  });

  it('should assign ticket if assignedTo is provided', async () => {
    const useCase = new CreateTicketUseCase(makeTicketRepo(), makeClientRepo());
    const result = await useCase.execute(
      { title: 'Bug', description: 'Some description here', clientId: 'client-1', assignedTo: 'agent-1' },
      'user-1',
    );
    expect(result.assignedTo).toBe('agent-1');
  });

  it('should throw 404 if client does not exist', async () => {
    const useCase = new CreateTicketUseCase(makeTicketRepo(), makeClientRepo(null));
    await expect(
      useCase.execute({ title: 'Bug', description: 'Description here ok', clientId: 'unknown' }, 'user-1'),
    ).rejects.toMatchObject({ statusCode: 404, code: 'CLIENT_NOT_FOUND' });
  });
});
