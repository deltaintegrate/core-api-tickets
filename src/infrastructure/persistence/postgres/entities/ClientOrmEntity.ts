import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { Client } from '../../../../domain/entities/Client';

@Entity('clients')
export class ClientOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column({ unique: true })
  email!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  static fromDomain(client: Client): ClientOrmEntity {
    const e = new ClientOrmEntity();
    e.id = client.id;
    e.name = client.name;
    e.email = client.email;
    e.createdAt = client.createdAt;
    return e;
  }

  toDomain(): Client {
    return new Client(this.id, this.name, this.email, this.createdAt);
  }
}
