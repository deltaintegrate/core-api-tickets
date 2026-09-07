/**
 * Seed script — ClientSupport
 *
 * Crea:
 *   - 3 usuarios (Admin, Agent, Supervisor) vía core-api-users (ECDH)
 *   - Cliente Infinivirt en clientsupport_tickets
 *   - 8 tickets de prueba con distintas prioridades y estados
 *
 * Uso:
 *   pnpm seed
 *   USERS_API=http://localhost:8080/users-api TICKETS_API=http://localhost:8080/tickets-api pnpm seed
 */

import crypto     from 'crypto';
import pg         from 'pg';
import { execSync } from 'child_process';

const { Pool } = pg;

const USERS_API   = process.env.USERS_API   ?? 'http://localhost:3001';
const TICKETS_API = process.env.TICKETS_API ?? 'http://localhost:3002';
const DB_URL      = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/clientsupport_tickets';
const PG_CONTAINER = process.env.PG_CONTAINER ?? 'clientsupport_postgres';

// ─── Datos ───────────────────────────────────────────────────────────────────

const USERS = [
  { name: 'Admin',      email: 'admin@example.com',      password: 'password123', role: 'ADMIN'     },
  { name: 'Agent One',  email: 'agent@example.com',      password: 'password123', role: 'AGENT'     },
  { name: 'Supervisor', email: 'supervisor@example.com', password: 'password123', role: 'SUPERVISOR' },
];

const CLIENT = { name: 'Infinivirt', email: 'contact@infinivirt.com' };

// Se completan con clientId una vez conocido
const TICKET_TEMPLATES = [
  {
    title:       'Error de login en producción',
    description: 'Los usuarios no pueden autenticarse después del último deploy. El endpoint /auth/login retorna 500.',
    priority:    'CRITICAL',
    status:      'OPEN',
    createdBy:   'admin',
  },
  {
    title:       'Dashboard no carga métricas',
    description: 'La página de métricas queda en spinner infinito. Parece un problema con el endpoint /metrics/by-status.',
    priority:    'HIGH',
    status:      'IN_PROGRESS',
    createdBy:   'agent',
  },
  {
    title:       'Exportar reportes a PDF',
    description: 'Los clientes necesitan descargar sus reportes de tickets en formato PDF mensualmente.',
    priority:    'MEDIUM',
    status:      'OPEN',
    createdBy:   'agent',
  },
  {
    title:       'Actualizar contraseña no funciona',
    description: 'El formulario de cambio de contraseña muestra éxito pero no persiste el cambio.',
    priority:    'HIGH',
    status:      'RESOLVED',
    createdBy:   'admin',
  },
  {
    title:       'Notificaciones por email no llegan',
    description: 'Los usuarios no reciben emails al asignarles un ticket. El servicio de email devuelve 200 pero no despacha.',
    priority:    'MEDIUM',
    status:      'IN_PROGRESS',
    createdBy:   'agent',
  },
  {
    title:       'Error 500 en API de pagos',
    description: 'Intermitentemente la integración con el proveedor de pagos retorna 500. Ocurre ~3 veces por hora en peak.',
    priority:    'CRITICAL',
    status:      'OPEN',
    createdBy:   'admin',
  },
  {
    title:       'Lentitud en carga de listado de tickets',
    description: 'El listado de tickets tarda más de 8 segundos cuando hay más de 500 registros. Falta índice en la tabla.',
    priority:    'LOW',
    status:      'CLOSED',
    createdBy:   'agent',
  },
  {
    title:       'Integración con Slack para alertas',
    description: 'Enviar notificación a canal #soporte cuando se crea un ticket de prioridad CRITICAL o HIGH.',
    priority:    'LOW',
    status:      'OPEN',
    createdBy:   'admin',
  },
];

// ─── ECDH helpers ─────────────────────────────────────────────────────────────

async function getPublicKey(baseUrl) {
  const res = await fetch(`${baseUrl}/api/v1/crypto/public-key`);
  return (await res.json()).data.publicKey;
}

async function encryptBody(serverPubKeyB64, body) {
  const ecdh = crypto.createECDH('prime256v1');
  ecdh.generateKeys();

  const sharedSecret = ecdh.computeSecret(Buffer.from(serverPubKeyB64, 'base64'));
  const aesKey       = crypto.createHash('sha256').update(sharedSecret).digest();
  const iv           = crypto.randomBytes(12);
  const cipher       = crypto.createCipheriv('aes-256-gcm', aesKey, iv);
  const enc          = Buffer.concat([cipher.update(Buffer.from(JSON.stringify(body), 'utf8')), cipher.final()]);

  return {
    publicKey:     ecdh.getPublicKey('base64'),
    iv:            iv.toString('base64'),
    authTag:       cipher.getAuthTag().toString('base64'),
    encryptedData: enc.toString('base64'),
  };
}

async function encryptedPost(baseUrl, path, body, token) {
  const pubKey  = await getPublicKey(baseUrl);
  const payload = await encryptBody(pubKey, body);
  const headers = { 'Content-Type': 'application/json', 'X-Encrypted': 'true' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${baseUrl}${path}`, { method: 'POST', headers, body: JSON.stringify(payload) });
  return res.json();
}

async function encryptedPatch(baseUrl, path, body, token) {
  const pubKey  = await getPublicKey(baseUrl);
  const payload = await encryptBody(pubKey, body);
  const headers = { 'Content-Type': 'application/json', 'X-Encrypted': 'true' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${baseUrl}${path}`, { method: 'PATCH', headers, body: JSON.stringify(payload) });
  return res.json();
}

// ─── Main ────────────────────────────────────────────────────────────────────

console.log('╔══════════════════════════════════╗');
console.log('║     ClientSupport — Seed DB      ║');
console.log('╚══════════════════════════════════╝\n');

// ── 1. Usuarios ──────────────────────────────────────────────────────────────
console.log('▸ Registrando usuarios...\n');

let usersPubKey;
try {
  usersPubKey = await getPublicKey(USERS_API);
} catch {
  console.error(`✗ No se pudo conectar a ${USERS_API}`);
  console.error('  Asegúrate de que core-api-users esté corriendo.\n');
  process.exit(1);
}

const tokens = {};  // { admin, agent, supervisor }

for (const user of USERS) {
  // Registrar (puede ya existir)
  const payload = await encryptBody(usersPubKey, user);
  const regRes  = await fetch(`${USERS_API}/api/v1/auth/register`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'X-Encrypted': 'true' },
    body:    JSON.stringify(payload),
  });
  const regJson = await regRes.json();

  if (regJson.success) {
    tokens[user.role.toLowerCase()] = regJson.data.token;
    console.log(`  ✓ ${user.role.padEnd(12)} ${user.email}`);
  } else if (regJson.code === 'EMAIL_CONFLICT') {
    // Ya existe → hacer login para obtener token
    const loginJson = await encryptedPost(USERS_API, '/api/v1/auth/login', {
      email: user.email, password: user.password,
    });
    if (loginJson.success) {
      tokens[user.role.toLowerCase()] = loginJson.data.token;
      console.log(`  · ${user.role.padEnd(12)} ${user.email}  (ya existe)`);
    } else {
      console.log(`  ✗ ${user.role.padEnd(12)} ${user.email}  — login fallido`);
    }
  } else {
    console.log(`  ✗ ${user.role.padEnd(12)} ${user.email}  — ${regJson.error}`);
  }
}

// ── 2. Cliente Infinivirt ────────────────────────────────────────────────────
console.log('\n▸ Creando cliente Infinivirt...\n');

function seedClientViaDocker() {
  const sql =
    `INSERT INTO clients (name, email) VALUES ('${CLIENT.name}', '${CLIENT.email}') ` +
    `ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name RETURNING id, name, email;`;
  const raw = execSync(
    `docker exec ${PG_CONTAINER} psql -U postgres -d clientsupport_tickets -t -A -F '|' -c "${sql}"`,
    { encoding: 'utf8' },
  );
  const line = raw.split('\n').find((l) => l.includes('|'));
  const [id, name, email] = line.split('|');
  return { id, name, email };
}

async function seedClient() {
  const pool = new Pool({ connectionString: DB_URL, connectionTimeoutMillis: 3000 });
  try {
    const result = await pool.query(
      `INSERT INTO clients (name, email)
       VALUES ($1, $2)
       ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
       RETURNING id, name, email`,
      [CLIENT.name, CLIENT.email],
    );
    await pool.end();
    return result.rows[0];
  } catch {
    await pool.end().catch(() => {});
    return seedClientViaDocker();
  }
}

let clientId;
try {
  const row = await seedClient();
  clientId = row.id;
  console.log(`  ✓ ${row.name}`);
  console.log(`    ID    : ${row.id}`);
  console.log(`    Email : ${row.email}`);
} catch (err) {
  console.error('  ✗ Error insertando cliente:', err.message);
  process.exit(1);
}

// ── 3. Tickets ───────────────────────────────────────────────────────────────
console.log('\n▸ Creando tickets...\n');

let ticketsPubKey;
try {
  ticketsPubKey = await getPublicKey(TICKETS_API);
} catch {
  console.error(`✗ No se pudo conectar a ${TICKETS_API}`);
  console.error('  Asegúrate de que core-api-tickets esté corriendo.\n');
  process.exit(1);
}

for (const t of TICKET_TEMPLATES) {
  const token = tokens[t.createdBy];
  if (!token) {
    console.log(`  ✗ Sin token para ${t.createdBy} — omitiendo "${t.title}"`);
    continue;
  }

  // Crear ticket (siempre OPEN al principio)
  const createJson = await encryptedPost(TICKETS_API, '/api/v1/tickets', {
    title:       t.title,
    description: t.description,
    priority:    t.priority,
    clientId,
  }, token);

  if (!createJson.success) {
    console.log(`  ✗ Error creando "${t.title}": ${createJson.error}`);
    continue;
  }

  const ticketId = createJson.data.id;

  // Actualizar estado si no es OPEN
  if (t.status !== 'OPEN') {
    const updateToken = t.status === 'RESOLVED' || t.status === 'CLOSED'
      ? tokens.admin
      : token;

    await encryptedPatch(TICKETS_API, `/api/v1/tickets/${ticketId}/status`, {
      status: t.status,
    }, updateToken);
  }

  const statusTag = t.status.padEnd(12);
  const prioTag   = t.priority.padEnd(8);
  console.log(`  ✓ [${prioTag}] [${statusTag}] ${t.title}`);
}

// ── Resumen ──────────────────────────────────────────────────────────────────
console.log('\n✔ Seed completado.\n');
console.log('  Credenciales:');
for (const u of USERS) {
  console.log(`    ${u.role.padEnd(12)} ${u.email} / ${u.password}`);
}
console.log(`\n  Cliente ID (Infinivirt): ${clientId}`);
