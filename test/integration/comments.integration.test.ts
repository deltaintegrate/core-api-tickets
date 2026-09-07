import { Application as Express } from 'express';
import supertest from 'supertest';
import { DataSource } from 'typeorm';
import * as jwt from 'jsonwebtoken';
import { createApp } from '../../src/app';
import { createMockDataSource, clearDatabase, seedClient } from './setup/mockDataSource';
import { encryptBody } from '../helpers/ecdhClient';

let app: Express;
let dataSource: DataSource;
let clientId: string;

const JWT_SECRET = process.env.JWT_SECRET!;

function makeToken(id: string, role: string) {
  return jwt.sign({ id, role }, JWT_SECRET, { expiresIn: '1h' });
}

const adminToken = makeToken('admin-1', 'ADMIN');
const agentToken = makeToken('agent-1', 'AGENT');

beforeAll(async () => {
  dataSource = await createMockDataSource();
  app = createApp(dataSource);
});

beforeEach(async () => {
  await clearDatabase(dataSource);
  clientId = await seedClient(dataSource);
});

afterAll(async () => {
  await dataSource.destroy();
});

// ─── Helper ───────────────────────────────────────────────────────────────────

async function createTicketAndGetId(token: string): Promise<string> {
  const body = {
    title: 'Ticket for comments test',
    description: 'Description long enough to pass validation',
    clientId,
  };
  const encrypted = await encryptBody(app, body);
  const res = await supertest(app)
    .post('/api/v1/tickets')
    .set('Authorization', `Bearer ${token}`)
    .set('X-Encrypted', 'true')
    .send(encrypted);
  return res.body.data.id as string;
}

// ─── POST /api/v1/tickets/:ticketId/comments ──────────────────────────────────

describe('POST /api/v1/tickets/:ticketId/comments', () => {
  it('should add a public comment and persist it in mock DB', async () => {
    const ticketId = await createTicketAndGetId(adminToken);

    const encrypted = await encryptBody(app, { content: 'First public comment', isInternal: false });
    const res = await supertest(app)
      .post(`/api/v1/tickets/${ticketId}/comments`)
      .set('Authorization', `Bearer ${agentToken}`)
      .set('X-Encrypted', 'true')
      .send(encrypted);

    expect(res.status).toBe(201);
    expect(res.body.data.content).toBe('First public comment');
    expect(res.body.data.isInternal).toBe(false);
    expect(res.body.data.authorId).toBe('agent-1');

    // Verify persisted in mock DB
    const rows = await dataSource.query('SELECT * FROM comments WHERE ticket_id = $1', [ticketId]);
    expect(rows).toHaveLength(1);
    expect(rows[0].content).toBe('First public comment');
  });

  it('should add an internal comment visible only to staff', async () => {
    const ticketId = await createTicketAndGetId(adminToken);

    const encrypted = await encryptBody(app, { content: 'Internal note', isInternal: true });
    const res = await supertest(app)
      .post(`/api/v1/tickets/${ticketId}/comments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('X-Encrypted', 'true')
      .send(encrypted);

    expect(res.status).toBe(201);
    expect(res.body.data.isInternal).toBe(true);

    const rows = await dataSource.query('SELECT is_internal FROM comments WHERE ticket_id = $1', [ticketId]);
    expect(rows[0].is_internal).toBe(true);
  });

  it('should return 404 for a non-existent ticket', async () => {
    const encrypted = await encryptBody(app, { content: 'Orphan comment' });
    const res = await supertest(app)
      .post('/api/v1/tickets/00000000-0000-0000-0000-000000000000/comments')
      .set('Authorization', `Bearer ${agentToken}`)
      .set('X-Encrypted', 'true')
      .send(encrypted);

    expect(res.status).toBe(404);
  });

  it('should return 400 when content is missing', async () => {
    const ticketId = await createTicketAndGetId(adminToken);

    const encrypted = await encryptBody(app, {});
    const res = await supertest(app)
      .post(`/api/v1/tickets/${ticketId}/comments`)
      .set('Authorization', `Bearer ${agentToken}`)
      .set('X-Encrypted', 'true')
      .send(encrypted);

    expect(res.status).toBe(400);
  });

  it('should return 401 without token', async () => {
    const ticketId = await createTicketAndGetId(adminToken);
    const res = await supertest(app)
      .post(`/api/v1/tickets/${ticketId}/comments`)
      .send({ content: 'Unauthorized' });

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/v1/tickets/:ticketId/comments ───────────────────────────────────

describe('GET /api/v1/tickets/:ticketId/comments', () => {
  it('should return all comments for a ticket in order', async () => {
    const ticketId = await createTicketAndGetId(adminToken);

    // Add two comments sequentially
    for (const content of ['First comment', 'Second comment']) {
      const encrypted = await encryptBody(app, { content });
      await supertest(app)
        .post(`/api/v1/tickets/${ticketId}/comments`)
        .set('Authorization', `Bearer ${agentToken}`)
        .set('X-Encrypted', 'true')
        .send(encrypted);
    }

    const res = await supertest(app)
      .get(`/api/v1/tickets/${ticketId}/comments`)
      .set('Authorization', `Bearer ${agentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].content).toBe('First comment');
    expect(res.body.data[1].content).toBe('Second comment');
  });

  it('should return empty array when no comments exist', async () => {
    const ticketId = await createTicketAndGetId(adminToken);

    const res = await supertest(app)
      .get(`/api/v1/tickets/${ticketId}/comments`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  it('should delete all comments when ticket is deleted', async () => {
    const ticketId = await createTicketAndGetId(adminToken);

    const encrypted = await encryptBody(app, { content: 'Will be deleted' });
    await supertest(app)
      .post(`/api/v1/tickets/${ticketId}/comments`)
      .set('Authorization', `Bearer ${agentToken}`)
      .set('X-Encrypted', 'true')
      .send(encrypted);

    // Delete the ticket (CASCADE should remove comments)
    await supertest(app)
      .delete(`/api/v1/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    const rows = await dataSource.query('SELECT * FROM comments WHERE ticket_id = $1', [ticketId]);
    expect(rows).toHaveLength(0);
  });
});
