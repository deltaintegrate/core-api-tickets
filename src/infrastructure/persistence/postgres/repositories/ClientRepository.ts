import { DataSource, Repository } from 'typeorm';
import { Client } from '../../../../domain/entities/Client';
import { IClientRepository } from '../../../../domain/ports/repositories/IClientRepository';
import { ClientOrmEntity } from '../entities/ClientOrmEntity';

export class ClientRepository implements IClientRepository {
  private readonly repo: Repository<ClientOrmEntity>;

  constructor(dataSource: DataSource) {
    this.repo = dataSource.getRepository(ClientOrmEntity);
  }

  async findById(id: string): Promise<Client | null> {
    const e = await this.repo.findOne({ where: { id } });
    return e ? e.toDomain() : null;
  }

  async findAll(): Promise<Client[]> {
    const entities = await this.repo.find();
    return entities.map((e) => e.toDomain());
  }

  async save(client: Client): Promise<Client> {
    const entity = ClientOrmEntity.fromDomain(client);
    const saved = await this.repo.save(entity);
    return saved.toDomain();
  }
}
