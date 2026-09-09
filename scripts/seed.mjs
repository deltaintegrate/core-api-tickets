/**
 * Seed script — ClientSupport (expanded)
 *
 * Crea suficiente data para que queries.sql arroje resultados en los 8 puntos:
 *
 *   Q1  — tickets por estado por cliente          → 6 clientes, múltiples estados
 *   Q2  — top 5 clientes HIGH/CRITICAL            → distribución clara entre los 6
 *   Q3  — tickets sin actualizar >48h             → 6 tickets backdateados vía SQL
 *   Q4  — agente con más RESOLVED último mes      → Agent One tiene 6 RESOLVED
 *   Q5  — tiempo promedio de resolución           → al menos 1 RESOLVED por prioridad
 *   Q6  — tickets OPEN por agente asignado        → OPEN tickets asignados a agentes
 *   Q7  — tickets reasignados >2 veces            → 3 tickets con 3 reasignaciones c/u
 *   Q8  — % CLOSED en últimos 30 días             → mix CLOSED / no-CLOSED recientes
 *
 * Uso:
 *   pnpm seed
 *   USERS_API=http://localhost:8080/users-api TICKETS_API=http://localhost:8080/tickets-api pnpm seed
 */

import crypto from 'crypto';
import pg from 'pg';
import { execSync } from 'child_process';

const { Pool } = pg;

const USERS_API    = process.env.USERS_API    ?? 'http://localhost:8080/users-api';
const TICKETS_API  = process.env.TICKETS_API  ?? 'http://localhost:8080/tickets-api';
const DB_URL       = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/clientsupport_tickets';
const PG_CONTAINER = process.env.PG_CONTAINER ?? 'clientsupport_postgres';

// ─── Usuarios ────────────────────────────────────────────────────────────────

const USERS = [
  { name: 'Admin',       email: 'admin@example.com',      password: 'password123', role: 'ADMIN'      },
  { name: 'Agent One',   email: 'agent@example.com',      password: 'password123', role: 'AGENT'      },
  { name: 'Agent Two',   email: 'agent2@example.com',     password: 'password123', role: 'AGENT'      },
  { name: 'Agent Three', email: 'agent3@example.com',     password: 'password123', role: 'AGENT'      },
  { name: 'Supervisor',  email: 'supervisor@example.com', password: 'password123', role: 'SUPERVISOR'  },
];

// ─── Clientes ────────────────────────────────────────────────────────────────

const CLIENTS = [
  { key: 'infinivirt', name: 'Infinivirt',          email: 'contact@infinivirt.com'  },
  { key: 'techcorp',   name: 'TechCorp Solutions',  email: 'contact@techcorp.com'    },
  { key: 'datasoft',   name: 'DataSoft Inc',        email: 'contact@datasoft.com'    },
  { key: 'cloudnet',   name: 'CloudNet Systems',    email: 'contact@cloudnet.com'    },
  { key: 'megastore',  name: 'MegaStore Global',    email: 'contact@megastore.com'   },
  { key: 'finserv',    name: 'FinServ Capital',     email: 'contact@finserv.com'     },
];

// ─── Tickets ─────────────────────────────────────────────────────────────────
//
// Campos:
//   client   — key del cliente (CLIENTS[].key)
//   createdBy — 'admin' | 'agent' | 'agent2' | 'agent3'  (quién crea)
//   status    — estado final deseado (OPEN/IN_PROGRESS/RESOLVED/CLOSED)
//   assignTo  — clave del agente al que se asigna tras crear (opcional)
//   stale     — true → se backdatea updated_at >48h (para Q3)
//   reassign  — true → se reasigna 3 veces seguidas (para Q7)
//
// Nota: los tickets RESOLVED obtienen resolved_at automáticamente al hacer PATCH status.

const TICKET_TEMPLATES = [
  // ── Infinivirt (10 tickets — mayor peso HIGH/CRITICAL para Q2) ──────────────
  {
    client: 'infinivirt', createdBy: 'admin',
    title: 'Error de login en producción',
    description: 'Los usuarios no pueden autenticarse tras el último deploy. El endpoint /auth/login retorna 500.',
    priority: 'CRITICAL', status: 'OPEN', assignTo: 'agent', stale: true,
  },
  {
    client: 'infinivirt', createdBy: 'admin',
    title: 'Error 500 en API de pagos',
    description: 'Intermitentemente la integración con el proveedor de pagos retorna 500. Ocurre ~3 veces/hora en peak.',
    priority: 'CRITICAL', status: 'IN_PROGRESS', assignTo: 'agent2', reassign: true,
  },
  {
    client: 'infinivirt', createdBy: 'agent',
    title: 'Dashboard no carga métricas',
    description: 'La página de métricas queda en spinner infinito. Parece un problema con /metrics/by-status.',
    priority: 'HIGH', status: 'IN_PROGRESS', assignTo: 'agent',
  },
  {
    client: 'infinivirt', createdBy: 'agent',
    title: 'Actualizar contraseña no funciona',
    description: 'El formulario de cambio de contraseña muestra éxito pero no persiste el cambio.',
    priority: 'HIGH', status: 'RESOLVED', assignTo: 'agent',
  },
  {
    client: 'infinivirt', createdBy: 'agent',
    title: 'Notificaciones por email no llegan',
    description: 'Los usuarios no reciben emails al asignarles un ticket. El servicio devuelve 200 pero no despacha.',
    priority: 'HIGH', status: 'RESOLVED', assignTo: 'agent',
  },
  {
    client: 'infinivirt', createdBy: 'admin',
    title: 'Sesiones expiradas prematuramente',
    description: 'Los tokens JWT expiran antes de los 24h configurados. Usuarios son deslogueados cada ~2h.',
    priority: 'HIGH', status: 'RESOLVED', assignTo: 'agent',
  },
  {
    client: 'infinivirt', createdBy: 'agent',
    title: 'Exportar reportes a PDF',
    description: 'Los clientes necesitan descargar sus reportes de tickets en formato PDF mensualmente.',
    priority: 'MEDIUM', status: 'OPEN', assignTo: 'agent3', stale: true,
  },
  {
    client: 'infinivirt', createdBy: 'agent',
    title: 'Integración con Slack para alertas',
    description: 'Enviar notificación a #soporte cuando se crea un ticket CRITICAL o HIGH.',
    priority: 'LOW', status: 'CLOSED',
  },
  {
    client: 'infinivirt', createdBy: 'agent',
    title: 'Lentitud en listado de tickets',
    description: 'El listado tarda >8 segundos con más de 500 registros. Falta índice en la tabla.',
    priority: 'LOW', status: 'RESOLVED', assignTo: 'agent',
  },
  {
    client: 'infinivirt', createdBy: 'admin',
    title: 'Filtro por fecha no funciona en historial',
    description: 'El filtro de rango de fechas en historial de tickets ignora la fecha de fin seleccionada.',
    priority: 'MEDIUM', status: 'CLOSED',
  },

  // ── TechCorp (7 tickets — 4 HIGH/CRITICAL para Q2) ──────────────────────────
  {
    client: 'techcorp', createdBy: 'admin',
    title: 'Base de datos cae bajo carga alta',
    description: 'PostgreSQL se queda sin conexiones disponibles en horas pico. Pool mal configurado.',
    priority: 'CRITICAL', status: 'IN_PROGRESS', assignTo: 'agent2', reassign: true,
  },
  {
    client: 'techcorp', createdBy: 'agent',
    title: 'Backup automático no se ejecuta',
    description: 'El cron de backup nocturno lleva 5 días sin correr. Riesgo de pérdida de datos.',
    priority: 'CRITICAL', status: 'OPEN', assignTo: 'agent2', stale: true,
  },
  {
    client: 'techcorp', createdBy: 'agent',
    title: 'API Gateway rechaza requests válidos',
    description: 'El API Gateway retorna 403 para tokens JWT correctamente formados en ciertos endpoints.',
    priority: 'HIGH', status: 'RESOLVED', assignTo: 'agent2',
  },
  {
    client: 'techcorp', createdBy: 'agent',
    title: 'Pipeline de CI/CD roto',
    description: 'Los deploys automáticos fallan en el paso de tests de integración desde ayer.',
    priority: 'HIGH', status: 'RESOLVED', assignTo: 'agent',
  },
  {
    client: 'techcorp', createdBy: 'agent',
    title: 'Reportes de ventas inconsistentes',
    description: 'Los reportes mensuales muestran cifras distintas dependiendo del navegador utilizado.',
    priority: 'MEDIUM', status: 'OPEN', assignTo: 'agent3',
  },
  {
    client: 'techcorp', createdBy: 'agent',
    title: 'Log rotation no configurado',
    description: 'Los logs de aplicación están consumiendo todo el espacio en disco del servidor.',
    priority: 'MEDIUM', status: 'CLOSED',
  },
  {
    client: 'techcorp', createdBy: 'admin',
    title: 'UI no responsive en móvil',
    description: 'El panel de administración no se adapta correctamente a pantallas menores de 768px.',
    priority: 'LOW', status: 'CLOSED',
  },

  // ── DataSoft (6 tickets — 3 HIGH/CRITICAL para Q2) ──────────────────────────
  {
    client: 'datasoft', createdBy: 'admin',
    title: 'Pérdida de datos en importación masiva',
    description: 'Al importar más de 10.000 registros via CSV los últimos 200 se corrompen silenciosamente.',
    priority: 'CRITICAL', status: 'OPEN', assignTo: 'agent3', stale: true, reassign: true,
  },
  {
    client: 'datasoft', createdBy: 'agent',
    title: 'Search full-text devuelve resultados incorrectos',
    description: 'La búsqueda con caracteres especiales (ñ, á, é) no retorna los documentos esperados.',
    priority: 'HIGH', status: 'IN_PROGRESS', assignTo: 'agent3',
  },
  {
    client: 'datasoft', createdBy: 'agent',
    title: 'Rate limiting demasiado agresivo',
    description: 'Los clientes legítimos son bloqueados después de 10 requests por minuto.',
    priority: 'HIGH', status: 'RESOLVED', assignTo: 'agent',
  },
  {
    client: 'datasoft', createdBy: 'agent',
    title: 'Webhook no dispara en eventos de actualización',
    description: 'Los webhooks registrados no se disparan cuando un registro es actualizado, solo en creación.',
    priority: 'MEDIUM', status: 'OPEN', assignTo: 'agent2',
  },
  {
    client: 'datasoft', createdBy: 'agent',
    title: 'Caché de Redis no se invalida correctamente',
    description: 'Después de actualizar un recurso, las respuestas cacheadas siguen devolviendo datos viejos por horas.',
    priority: 'MEDIUM', status: 'CLOSED',
  },
  {
    client: 'datasoft', createdBy: 'admin',
    title: 'Documentación de API desactualizada',
    description: 'El Swagger/OpenAPI no refleja los cambios de los últimos 3 sprints.',
    priority: 'LOW', status: 'CLOSED',
  },

  // ── CloudNet (5 tickets — 2 HIGH/CRITICAL para Q2) ──────────────────────────
  {
    client: 'cloudnet', createdBy: 'admin',
    title: 'Certificado SSL expirado en producción',
    description: 'El certificado TLS expiró esta mañana. Los browsers muestran advertencia de seguridad.',
    priority: 'CRITICAL', status: 'RESOLVED', assignTo: 'agent',
  },
  {
    client: 'cloudnet', createdBy: 'agent',
    title: 'Instancias EC2 se reinician solas',
    description: 'Tres instancias de producción se reinician aleatoriamente cada 4-6 horas sin causa aparente.',
    priority: 'HIGH', status: 'IN_PROGRESS', assignTo: 'agent2', stale: true,
  },
  {
    client: 'cloudnet', createdBy: 'agent',
    title: 'VPN no conecta desde redes corporativas',
    description: 'Los empleados que usan redes de oficina no pueden establecer la conexión VPN.',
    priority: 'MEDIUM', status: 'OPEN', assignTo: 'agent3',
  },
  {
    client: 'cloudnet', createdBy: 'agent',
    title: 'Monitoreo de uptime no alerta correctamente',
    description: 'El sistema de alertas de uptime no notifica cuando un servicio cae. Detectado manualmente.',
    priority: 'MEDIUM', status: 'CLOSED',
  },
  {
    client: 'cloudnet', createdBy: 'admin',
    title: 'Rotación de claves AWS mal documentada',
    description: 'El proceso de rotación de credenciales IAM no está documentado y genera confusión.',
    priority: 'LOW', status: 'CLOSED',
  },

  // ── MegaStore (4 tickets — 2 HIGH para Q2) ──────────────────────────────────
  {
    client: 'megastore', createdBy: 'admin',
    title: 'Pasarela de pago caída en checkout',
    description: 'Stripe retorna error 402 en el 30% de las transacciones durante las últimas 2 horas.',
    priority: 'CRITICAL', status: 'RESOLVED', assignTo: 'agent',
  },
  {
    client: 'megastore', createdBy: 'agent',
    title: 'Stock no se actualiza en tiempo real',
    description: 'Tras una compra el stock visible en el catálogo tarda hasta 5 minutos en actualizarse.',
    priority: 'HIGH', status: 'OPEN', assignTo: 'agent2',
  },
  {
    client: 'megastore', createdBy: 'agent',
    title: 'Cupones de descuento no aplican correctamente',
    description: 'Los cupones con condición de monto mínimo no se validan bien cuando hay productos en oferta.',
    priority: 'MEDIUM', status: 'IN_PROGRESS', assignTo: 'agent3',
  },
  {
    client: 'megastore', createdBy: 'admin',
    title: 'SEO: URLs canónicas duplicadas',
    description: 'Varias páginas de producto tienen URLs canónicas duplicadas, afectando el posicionamiento.',
    priority: 'LOW', status: 'CLOSED',
  },

  // ── FinServ (3 tickets — 1 HIGH para Q2) ────────────────────────────────────
  {
    client: 'finserv', createdBy: 'admin',
    title: 'Auditoría de accesos falla en reporte mensual',
    description: 'El reporte de auditoría de accesos del mes de agosto está incompleto: faltan 3 días.',
    priority: 'HIGH', status: 'OPEN', assignTo: 'agent', stale: true,
  },
  {
    client: 'finserv', createdBy: 'agent',
    title: 'Cálculo de intereses incorrecto para cuentas en USD',
    description: 'Las cuentas en dólares muestran un cálculo de interés 0.5% por encima del valor real.',
    priority: 'MEDIUM', status: 'IN_PROGRESS', assignTo: 'agent2',
  },
  {
    client: 'finserv', createdBy: 'agent',
    title: 'Exportar estado de cuenta en PDF falla para algunos clientes',
    description: 'El PDF de estado de cuenta se genera vacío para clientes con más de 500 movimientos.',
    priority: 'LOW', status: 'RESOLVED', assignTo: 'agent',
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
  const aesKey = crypto.createHash('sha256').update(sharedSecret).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', aesKey, iv);
  const enc = Buffer.concat([cipher.update(Buffer.from(JSON.stringify(body), 'utf8')), cipher.final()]);
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

// ─── DB helpers ───────────────────────────────────────────────────────────────

function execDocker(sql) {
  return execSync(
    `docker exec ${PG_CONTAINER} psql -U postgres -d clientsupport_tickets -t -A -F '|' -c "${sql}"`,
    { encoding: 'utf8' },
  );
}

async function withPool(fn) {
  const pool = new Pool({ connectionString: DB_URL, connectionTimeoutMillis: 3000 });
  try {
    const result = await fn(pool);
    await pool.end();
    return result;
  } catch (err) {
    await pool.end().catch(() => {});
    throw err;
  }
}

async function seedClients() {
  const ids = {};
  for (const c of CLIENTS) {
    const sql =
      `INSERT INTO clients (name, email) VALUES ('${c.name}', '${c.email}') ` +
      `ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name RETURNING id;`;
    try {
      const row = await withPool(async (pool) => {
        const r = await pool.query(
          `INSERT INTO clients (name, email) VALUES ($1, $2) ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
          [c.name, c.email],
        );
        return r.rows[0];
      });
      ids[c.key] = row.id;
    } catch {
      const raw  = execDocker(sql);
      const line = raw.split('\n').find((l) => l.trim());
      ids[c.key] = line.trim().split('|')[0];
    }
    console.log(`  ✓ ${c.name.padEnd(22)} → ${ids[c.key]}`);
  }
  return ids;
}

async function enableDblink() {
  const sql = 'CREATE EXTENSION IF NOT EXISTS dblink;';
  try {
    await withPool(async (pool) => pool.query(sql));
  } catch {
    execDocker(sql);
  }
  console.log('  ✓ Extensión dblink habilitada');
}

async function backdateStale(staleIds) {
  if (!staleIds.length) return;
  const list = staleIds.map((id) => `'${id}'`).join(', ');
  const sql  = `UPDATE tickets SET updated_at = NOW() - INTERVAL '72 hours' WHERE id IN (${list});`;
  try {
    await withPool(async (pool) => pool.query(sql));
  } catch {
    execDocker(sql);
  }
  console.log(`  ✓ Backdateados ${staleIds.length} tickets (updated_at -72h)`);
}

// ─── Main ────────────────────────────────────────────────────────────────────

console.log('╔══════════════════════════════════════════╗');
console.log('║      ClientSupport — Seed DB (full)      ║');
console.log('╚══════════════════════════════════════════╝\n');

// ── 1. Usuarios ──────────────────────────────────────────────────────────────
console.log('▸ Registrando usuarios...\n');

let usersPubKey;
try {
  usersPubKey = await getPublicKey(USERS_API);
} catch {
  console.error(`✗ No se pudo conectar a ${USERS_API}\n`);
  process.exit(1);
}

// tokens: { admin, agent, agent2, agent3, supervisor }
// userIds: { admin, agent, agent2, agent3, supervisor }
const tokens  = {};
const userIds = {};

for (const user of USERS) {
  const key     = user.role === 'AGENT'
    ? (user.email.includes('agent2') ? 'agent2' : user.email.includes('agent3') ? 'agent3' : 'agent')
    : user.role.toLowerCase();

  const payload = await encryptBody(usersPubKey, user);
  const regRes  = await fetch(`${USERS_API}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Encrypted': 'true' },
    body: JSON.stringify(payload),
  });
  const regJson = await regRes.json();

  if (regJson.success) {
    tokens[key]  = regJson.data.token;
    userIds[key] = regJson.data.user.id;
    console.log(`  ✓ ${user.role.padEnd(12)} ${user.email}`);
  } else if (regJson.code === 'EMAIL_CONFLICT') {
    const loginJson = await encryptedPost(USERS_API, '/api/v1/auth/login', {
      email: user.email, password: user.password,
    });
    if (loginJson.success) {
      tokens[key]  = loginJson.data.token;
      userIds[key] = loginJson.data.user.id;
      console.log(`  · ${user.role.padEnd(12)} ${user.email}  (ya existe)`);
    } else {
      console.log(`  ✗ ${user.role.padEnd(12)} ${user.email}  — login fallido`);
    }
  } else {
    console.log(`  ✗ ${user.role.padEnd(12)} ${user.email}  — ${regJson.error}`);
  }
}

// ── 2. Extensión dblink (necesaria para Q4 en queries.sql) ───────────────────
console.log('\n▸ Habilitando extensión dblink...\n');
await enableDblink();

// ── 3. Clientes ──────────────────────────────────────────────────────────────
console.log('\n▸ Creando clientes...\n');

let clientIds;
try {
  clientIds = await seedClients();
} catch (err) {
  console.error('  ✗ Error insertando clientes:', err.message);
  process.exit(1);
}

// ── 4. Tickets ───────────────────────────────────────────────────────────────
console.log('\n▸ Creando tickets...\n');

let ticketsPubKey;
try {
  ticketsPubKey = await getPublicKey(TICKETS_API);
} catch {
  console.error(`✗ No se pudo conectar a ${TICKETS_API}\n`);
  process.exit(1);
}

const staleIds   = [];  // IDs a backdatear (Q3)
const reassignIds = []; // IDs a reasignar múltiples veces (Q7)

for (const t of TICKET_TEMPLATES) {
  const token = tokens[t.createdBy];
  if (!token) {
    console.log(`  ✗ Sin token para ${t.createdBy} — omitiendo "${t.title}"`);
    continue;
  }

  const clientId = clientIds[t.client];
  if (!clientId) {
    console.log(`  ✗ Sin clientId para ${t.client} — omitiendo "${t.title}"`);
    continue;
  }

  // Crear ticket (siempre OPEN al principio)
  const createJson = await encryptedPost(TICKETS_API, '/api/v1/tickets', {
    title: t.title,
    description: t.description,
    priority: t.priority,
    clientId,
  }, token);

  if (!createJson.success) {
    console.log(`  ✗ Error creando "${t.title}": ${createJson.error}`);
    continue;
  }

  const ticketId = createJson.data.id;

  // Asignar agente (Q4 / Q6 — necesario antes de cambiar status)
  if (t.assignTo && userIds[t.assignTo]) {
    await encryptedPatch(TICKETS_API, `/api/v1/tickets/${ticketId}/assign`, {
      assignedTo: userIds[t.assignTo],
    }, tokens.supervisor ?? tokens.admin);
  }

  // Actualizar estado si no es OPEN
  if (t.status !== 'OPEN') {
    const updateToken = t.status === 'RESOLVED' || t.status === 'CLOSED'
      ? (tokens.admin ?? token)
      : token;

    await encryptedPatch(TICKETS_API, `/api/v1/tickets/${ticketId}`, {
      status: t.status,
    }, updateToken);
  }

  // Marcar para backdate (Q3)
  if (t.stale) staleIds.push(ticketId);

  // Marcar para reasignaciones múltiples (Q7)
  if (t.reassign) reassignIds.push({ ticketId, assignTo: t.assignTo });

  const statusTag = t.status.padEnd(12);
  const prioTag   = t.priority.padEnd(8);
  const staleTag  = t.stale    ? ' [stale]'   : '';
  const reassTag  = t.reassign ? ' [reassign]' : '';
  console.log(`  ✓ [${prioTag}] [${statusTag}] ${t.title}${staleTag}${reassTag}`);
}

// ── 5. Reasignaciones múltiples (Q7 — tickets reasignados >2 veces) ──────────
if (reassignIds.length) {
  console.log('\n▸ Aplicando reasignaciones múltiples (Q7)...\n');

  const agentCycle = ['agent', 'agent2', 'agent3'];
  const supToken   = tokens.supervisor ?? tokens.admin;

  for (const { ticketId } of reassignIds) {
    for (let i = 0; i < 3; i++) {
      const agentKey = agentCycle[i];
      if (!userIds[agentKey]) continue;
      await encryptedPatch(TICKETS_API, `/api/v1/tickets/${ticketId}/assign`, {
        assignedTo: userIds[agentKey],
      }, supToken);
    }
    console.log(`  ✓ Ticket ${ticketId} reasignado 3 veces`);
  }
}

// ── 6. Backdate tickets stale (Q3 — >48h sin actualización) ──────────────────
if (staleIds.length) {
  console.log('\n▸ Backdateando tickets stale (Q3)...\n');
  await backdateStale(staleIds);
}

// ── Resumen ───────────────────────────────────────────────────────────────────
const totalTickets    = TICKET_TEMPLATES.length;
const resolvedCount   = TICKET_TEMPLATES.filter((t) => t.status === 'RESOLVED').length;
const closedCount     = TICKET_TEMPLATES.filter((t) => t.status === 'CLOSED').length;
const highCritCount   = TICKET_TEMPLATES.filter((t) => ['HIGH', 'CRITICAL'].includes(t.priority)).length;

console.log('\n✔ Seed completado.\n');
console.log('  Resumen de datos:');
console.log(`    Usuarios   : ${USERS.length} (admin, agent x3, supervisor)`);
console.log(`    Clientes   : ${CLIENTS.length}`);
console.log(`    Tickets    : ${totalTickets} total`);
console.log(`      RESOLVED : ${resolvedCount}  (Q4, Q5)`);
console.log(`      CLOSED   : ${closedCount}  (Q8)`);
console.log(`      HIGH/CRIT: ${highCritCount}  (Q2)`);
console.log(`      Stale    : ${staleIds.length}  (Q3)`);
console.log(`      Reassign : ${reassignIds.length}  (Q7)`);
console.log('\n  Credenciales:');
for (const u of USERS) {
  console.log(`    ${u.email.padEnd(30)} / ${u.password}`);
}
console.log('\n  IDs de clientes:');
for (const [key, id] of Object.entries(clientIds)) {
  console.log(`    ${key.padEnd(12)} → ${id}`);
}
