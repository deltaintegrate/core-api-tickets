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

function makeToken(id: string, role: string): string {
  return jwt.sign({ id, role }, JWT_SECRET, { expiresIn: '1h' });
}

const adminToken = makeToken('admin-1', 'ADMIN');
const agentToken = makeToken('agent-1', 'AGENT');
const supervisorToken = makeToken('supervisor-1', 'SUPERVISOR');

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function createTicket(token: string, overrides = {}) {
  const body = {
    title: 'Test ticket title here',
    description: 'Test ticket description with enough length',
    clientId,
    ...overrides,
  };
  const encrypted = await encryptBody(app, body);
  return supertest(app)
    .post('/api/v1/tickets')
    .set('Authorization', `Bearer ${token}`)
    .set('X-Encrypted', 'true')
    .send(encrypted);
}

// ─── POST /api/v1/tickets ─────────────────────────────────────────────────────

describe('POST /api/v1/tickets', () => {
  it('should create a ticket and persist it in the mock DB', async () => {
    const res = await createTicket(adminToken);

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('OPEN');
    expect(res.body.data.clientId).toBe(clientId);

    // Verify in DB
    const row = await dataSource.query('SELECT * FROM tickets WHERE id = $1', [res.body.data.id]);
    expect(row).toHaveLength(1);
    expect(row[0].title).toBe('Test ticket title here');
  });

  it('should return 404 if client does not exist', async () => {
    const res = await createTicket(adminToken, { clientId: '00000000-0000-0000-0000-000000000000' });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('CLIENT_NOT_FOUND');
  });

  it('should return 401 without token', async () => {
    const res = await supertest(app).post('/api/v1/tickets').send({});
    expect(res.status).toBe(401);
  });

  it('should allow AGENT to create a ticket', async () => {
    const res = await createTicket(agentToken);
    expect(res.status).toBe(201);
    expect(res.body.data.createdBy).toBe('agent-1');
  });
});

// ─── GET /api/v1/tickets ──────────────────────────────────────────────────────

describe('GET /api/v1/tickets', () => {
  beforeEach(async () => {
    await createTicket(adminToken);
    await createTicket(agentToken, { priority: 'HIGH' });
  });

  it('should return all tickets', async () => {
    const res = await supertest(app)
      .get('/api/v1/tickets')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
  });

  it('should filter by priority', async () => {
    const res = await supertest(app)
      .get('/api/v1/tickets?priority=HIGH')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].priority).toBe('HIGH');
  });

  it('should filter by status', async () => {
    const res = await supertest(app)
      .get('/api/v1/tickets?status=OPEN')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.every((t: any) => t.status === 'OPEN')).toBe(true);
  });
});

// ─── GET /api/v1/tickets/:id ──────────────────────────────────────────────────

describe('GET /api/v1/tickets/:id', () => {
  it('should return a specific ticket', async () => {
    const createRes = await createTicket(adminToken);
    const id = createRes.body.data.id;

    const res = await supertest(app)
      .get(`/api/v1/tickets/${id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(id);
  });

  it('should return 404 for unknown ticket', async () => {
    const res = await supertest(app)
      .get('/api/v1/tickets/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });
});

// ─── PATCH /api/v1/tickets/:id ────────────────────────────────────────────────

describe('PATCH /api/v1/tickets/:id', () => {
  it('should update a ticket title and persist in mock DB', async () => {
    const createRes = await createTicket(adminToken);
    const id = createRes.body.data.id;

    const encrypted = await encryptBody(app, { title: 'Updated Title Here' });
    const res = await supertest(app)
      .patch(`/api/v1/tickets/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('X-Encrypted', 'true')
      .send(encrypted);

    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('Updated Title Here');

    const row = await dataSource.query('SELECT title FROM tickets WHERE id = $1', [id]);
    expect(row[0].title).toBe('Updated Title Here');
  });

  it('should block AGENT updating a ticket not assigned to them', async () => {
    const createRes = await createTicket(adminToken);
    const id = createRes.body.data.id;

    const encrypted = await encryptBody(app, { title: 'Agent Hack' });
    const res = await supertest(app)
      .patch(`/api/v1/tickets/${id}`)
      .set('Authorization', `Bearer ${agentToken}`)
      .set('X-Encrypted', 'true')
      .send(encrypted);

    expect(res.status).toBe(403);
  });

  it('should close a ticket and set closedAt in DB', async () => {
    const createRes = await createTicket(adminToken);
    const id = createRes.body.data.id;

    const encrypted = await encryptBody(app, { status: 'CLOSED' });
    await supertest(app)
      .patch(`/api/v1/tickets/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('X-Encrypted', 'true')
      .send(encrypted);

    const row = await dataSource.query('SELECT status, closed_at FROM tickets WHERE id = $1', [id]);
    expect(row[0].status).toBe('CLOSED');
    expect(row[0].closed_at).not.toBeNull();
  });
});

// ─── PATCH /api/v1/tickets/:id/assign ────────────────────────────────────────

describe('PATCH /api/v1/tickets/:id/assign', () => {
  it('should assign a ticket to an agent and persist in mock DB', async () => {
    const createRes = await createTicket(adminToken);
    const id = createRes.body.data.id;

    const encrypted = await encryptBody(app, { assignedTo: 'agent-1' });
    const res = await supertest(app)
      .patch(`/api/v1/tickets/${id}/assign`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('X-Encrypted', 'true')
      .send(encrypted);

    expect(res.status).toBe(200);
    expect(res.body.data.assignedTo).toBe('agent-1');

    const row = await dataSource.query('SELECT assigned_to FROM tickets WHERE id = $1', [id]);
    expect(row[0].assigned_to).toBe('agent-1');
  });

  it('should block AGENT from assigning tickets', async () => {
    const createRes = await createTicket(adminToken);
    const id = createRes.body.data.id;

    const encrypted = await encryptBody(app, { assignedTo: 'agent-2' });
    const res = await supertest(app)
      .patch(`/api/v1/tickets/${id}/assign`)
      .set('Authorization', `Bearer ${agentToken}`)
      .set('X-Encrypted', 'true')
      .send(encrypted);

    expect(res.status).toBe(403);
  });
});

// ─── DELETE /api/v1/tickets/:id ───────────────────────────────────────────────

describe('DELETE /api/v1/tickets/:id', () => {
  it('should delete a ticket from mock DB', async () => {
    const createRes = await createTicket(adminToken);
    const id = createRes.body.data.id;

    const res = await supertest(app)
      .delete(`/api/v1/tickets/${id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(204);

    const row = await dataSource.query('SELECT id FROM tickets WHERE id = $1', [id]);
    expect(row).toHaveLength(0);
  });

  it('should return 403 when AGENT tries to delete', async () => {
    const createRes = await createTicket(adminToken);
    const id = createRes.body.data.id;

    const res = await supertest(app)
      .delete(`/api/v1/tickets/${id}`)
      .set('Authorization', `Bearer ${agentToken}`);

    expect(res.status).toBe(403);
  });
});
