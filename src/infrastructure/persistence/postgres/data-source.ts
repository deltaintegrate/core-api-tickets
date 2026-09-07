import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { TicketOrmEntity } from './entities/TicketOrmEntity';
import { CommentOrmEntity } from './entities/CommentOrmEntity';
import { ClientOrmEntity } from './entities/ClientOrmEntity';

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  synchronize: process.env.NODE_ENV === 'development',
  logging: process.env.NODE_ENV === 'development',
  entities: [TicketOrmEntity, CommentOrmEntity, ClientOrmEntity],
  migrations: ['dist/infrastructure/persistence/postgres/migrations/*.js'],
});
