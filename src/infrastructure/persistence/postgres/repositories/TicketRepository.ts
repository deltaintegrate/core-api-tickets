import { DataSource, FindOptionsWhere, Repository } from 'typeorm';
import { Ticket } from '../../../../domain/entities/Ticket';
import { ITicketRepository, TicketFilters } from '../../../../domain/ports/repositories/ITicketRepository';
import {
  IMetricsRepository,
  ReassignedTicket,
  TicketsByStatusAndClient,
} from '../../../../domain/ports/repositories/IMetricsRepository';
import { TicketStatus } from '../../../../domain/value-objects/TicketStatus';
import { TicketOrmEntity } from '../entities/TicketOrmEntity';

export class TicketRepository implements ITicketRepository, IMetricsRepository {
  private readonly repo: Repository<TicketOrmEntity>;

  constructor(dataSource: DataSource) {
    this.repo = dataSource.getRepository(TicketOrmEntity);
  }

  async findById(id: string): Promise<Ticket | null> {
    const entity = await this.repo.findOne({ where: { id } });
    return entity ? entity.toDomain() : null;
  }

  async findAll(filters?: TicketFilters): Promise<Ticket[]> {
    const where: FindOptionsWhere<TicketOrmEntity> = {};
    if (filters?.status) where.status = filters.status;
    if (filters?.priority) where.priority = filters.priority;
    if (filters?.assignedTo) where.assignedTo = filters.assignedTo;
    if (filters?.clientId) where.clientId = filters.clientId;
    if (filters?.createdBy) where.createdBy = filters.createdBy;

    const entities = await this.repo.find({ where, order: { createdAt: 'DESC' } });
    return entities.map((e) => e.toDomain());
  }

  async save(ticket: Ticket): Promise<Ticket> {
    const entity = TicketOrmEntity.fromDomain(ticket);
    const saved = await this.repo.save(entity);
    return saved.toDomain();
  }

  async delete(id: string): Promise<void> {
    await this.repo.delete(id);
  }

  async countByStatusAndClient(): Promise<TicketsByStatusAndClient[]> {
    const rows = await this.repo
      .createQueryBuilder('t')
      .select('t.client_id', 'clientId')
      .addSelect('t.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('t.client_id')
      .addGroupBy('t.status')
      .getRawMany<{ clientId: string; status: string; count: string }>();

    return rows.map((r) => ({
      clientId: r.clientId,
      status: r.status,
      count: parseInt(r.count, 10),
    }));
  }

  async findStale(hoursWithoutUpdate: number): Promise<Ticket[]> {
    const cutoff = new Date(Date.now() - hoursWithoutUpdate * 60 * 60 * 1000);
    const entities = await this.repo
      .createQueryBuilder('t')
      .where('t.updated_at < :cutoff', { cutoff })
      .andWhere('t.status != :closed', { closed: TicketStatus.CLOSED })
      .getMany();

    return entities.map((e) => e.toDomain());
  }

  async findReassignedMoreThan(times: number): Promise<ReassignedTicket[]> {
    const rows = await this.repo.manager.query<{ ticket_id: string; count: string }[]>(
      `SELECT ticket_id, COUNT(*) as count
       FROM assignment_history
       GROUP BY ticket_id
       HAVING COUNT(*) > $1`,
      [times],
    );
    return rows.map((r) => ({ ticketId: r.ticket_id, count: parseInt(r.count, 10) }));
  }
}
