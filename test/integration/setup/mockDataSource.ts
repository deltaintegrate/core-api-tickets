import { DataSource } from 'typeorm';
import { newDb, DataType } from 'pg-mem';
import { TicketOrmEntity } from '../../../src/infrastructure/persistence/postgres/entities/TicketOrmEntity';
import { CommentOrmEntity } from '../../../src/infrastructure/persistence/postgres/entities/CommentOrmEntity';
import { ClientOrmEntity } from '../../../src/infrastructure/persistence/postgres/entities/ClientOrmEntity';

export async function createMockDataSource(): Promise<DataSource> {
  const db = newDb({ autoCreateForeignKeyIndices: true });

  db.public.registerFunction({
    name: 'gen_random_uuid',
    returns: DataType.uuid,
    implementation: () => require('uuid').v4(),
    impure: true,
  });

  db.public.registerFunction({
    name: 'current_database',
    returns: DataType.text,
    implementation: () => 'test',
  });

  db.public.registerFunction({
    name: 'version',
    returns: DataType.text,
    implementation: () => 'PostgreSQL 16.0 (pg-mem)',
  });

  db.public.registerFunction({
    name: 'current_schema',
    returns: DataType.text,
    implementation: () => 'public',
  });

  const dataSource: DataSource = await db.adapters.createTypeormDataSource({
    type: 'postgres',
    entities: [TicketOrmEntity, CommentOrmEntity, ClientOrmEntity],
    synchronize: false,
    logging: false,
  });

  await dataSource.initialize();

  await dataSource.query(`
    CREATE TABLE IF NOT EXISTS clients (
      id         UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
      name       VARCHAR   NOT NULL,
      email      VARCHAR   NOT NULL UNIQUE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await dataSource.query(`
    CREATE TABLE IF NOT EXISTS tickets (
      id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      title       VARCHAR     NOT NULL,
      description TEXT        NOT NULL,
      status      VARCHAR(50) NOT NULL DEFAULT 'OPEN',
      priority    VARCHAR(50) NOT NULL DEFAULT 'MEDIUM',
      client_id   UUID        NOT NULL,
      created_by  VARCHAR     NOT NULL,
      assigned_to VARCHAR,
      created_at  TIMESTAMP   NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMP   NOT NULL DEFAULT NOW(),
      resolved_at TIMESTAMP,
      closed_at   TIMESTAMP
    )
  `);

  await dataSource.query(`
    CREATE TABLE IF NOT EXISTS comments (
      id          UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
      ticket_id   UUID      NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      author_id   VARCHAR   NOT NULL,
      content     TEXT      NOT NULL,
      is_internal BOOLEAN   NOT NULL DEFAULT false,
      created_at  TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await dataSource.query(`
    CREATE TABLE IF NOT EXISTS assignment_history (
      id            UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
      ticket_id     UUID      NOT NULL,
      assigned_from VARCHAR,
      assigned_to   VARCHAR   NOT NULL,
      assigned_by   VARCHAR   NOT NULL,
      assigned_at   TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  return dataSource;
}

export async function clearDatabase(dataSource: DataSource): Promise<void> {
  await dataSource.query('DELETE FROM assignment_history');
  await dataSource.query('DELETE FROM comments');
  await dataSource.query('DELETE FROM tickets');
  await dataSource.query('DELETE FROM clients');
}

export async function seedClient(
  dataSource: DataSource,
  data: { name: string; email: string } = { name: 'Acme Corp', email: 'acme@corp.com' },
): Promise<string> {
  const result = await dataSource.query(
    `INSERT INTO clients (id, name, email, created_at) VALUES (gen_random_uuid(), $1, $2, NOW()) RETURNING id`,
    [data.name, data.email],
  );
  return result[0].id as string;
}
