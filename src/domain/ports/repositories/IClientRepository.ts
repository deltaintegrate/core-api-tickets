import { Client } from '../../entities/Client';

export interface IClientRepository {
  findById(id: string): Promise<Client | null>;
  findAll(): Promise<Client[]>;
  save(client: Client): Promise<Client>;
}
