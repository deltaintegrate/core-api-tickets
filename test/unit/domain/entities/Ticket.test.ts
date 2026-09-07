import { Ticket } from '../../../../src/domain/entities/Ticket';
import { TicketStatus } from '../../../../src/domain/value-objects/TicketStatus';
import { TicketPriority } from '../../../../src/domain/value-objects/TicketPriority';
import { DomainError } from '../../../../src/shared/errors/DomainError';

const makeTicket = (status = TicketStatus.OPEN) =>
  new Ticket(
    'ticket-1',
    'Bug in login',
    'Login fails with correct credentials',
    status,
    TicketPriority.HIGH,
    'client-1',
    'user-1',
    null,
    new Date('2024-01-01'),
    new Date('2024-01-01'),
  );

describe('Ticket entity', () => {
  it('should assign a user and update updatedAt', () => {
    const ticket = makeTicket();
    const before = ticket.updatedAt;
    ticket.assign('agent-1');
    expect(ticket.assignedTo).toBe('agent-1');
    expect(ticket.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
  });

  it('should update status to IN_PROGRESS', () => {
    const ticket = makeTicket();
    ticket.updateStatus(TicketStatus.IN_PROGRESS);
    expect(ticket.status).toBe(TicketStatus.IN_PROGRESS);
  });

  it('should set resolvedAt when status is RESOLVED', () => {
    const ticket = makeTicket();
    ticket.updateStatus(TicketStatus.RESOLVED);
    expect(ticket.resolvedAt).toBeInstanceOf(Date);
  });

  it('should set closedAt when status is CLOSED', () => {
    const ticket = makeTicket();
    ticket.updateStatus(TicketStatus.CLOSED);
    expect(ticket.closedAt).toBeInstanceOf(Date);
  });

  it('should throw DomainError when updating status of a CLOSED ticket', () => {
    const ticket = makeTicket(TicketStatus.CLOSED);
    expect(() => ticket.updateStatus(TicketStatus.OPEN)).toThrow(DomainError);
  });

  it('should reopen a closed ticket', () => {
    const ticket = makeTicket(TicketStatus.CLOSED);
    ticket.reopen();
    expect(ticket.status).toBe(TicketStatus.OPEN);
    expect(ticket.closedAt).toBeNull();
  });

  it('should throw DomainError reopening a ticket that is not closed or resolved', () => {
    const ticket = makeTicket(TicketStatus.OPEN);
    expect(() => ticket.reopen()).toThrow(DomainError);
  });

  it('should update title and description', () => {
    const ticket = makeTicket();
    ticket.updateTitle('New Title');
    ticket.updateDescription('New Description');
    expect(ticket.title).toBe('New Title');
    expect(ticket.description).toBe('New Description');
  });
});
