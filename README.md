# core-api-tickets

> Microservicio de gestión de tickets, comentarios, asignaciones y métricas operativas de la plataforma **ClientSupport**.
> Puerto **3002** · TypeScript · Express · TypeORM · PostgreSQL · ECDH P-256 · JWT offline

---

## Tabla de contenidos

1. [Descripción](#descripción)
2. [Arquitectura hexagonal](#arquitectura-hexagonal)
3. [Diagrama MER](#diagrama-mer)
4. [Cifrado ECDH Diffie-Hellman](#cifrado-ecdh-diffie-hellman)
5. [Principios SOLID aplicados](#principios-solid-aplicados)
6. [Rutas de la API](#rutas-de-la-api)
7. [Consultas SQL requeridas](#consultas-sql-requeridas)
8. [Tests](#tests)
9. [Variables de entorno](#variables-de-entorno)
10. [Inicio rápido](#inicio-rápido)
11. [Dockerfile](#dockerfile)

---

## Descripción

`core-api-tickets` es el microservicio responsable de:

- **CRUD completo de tickets**: creación, consulta, actualización, eliminación.
- **Sistema de comentarios**: comentarios públicos e internos (solo agentes/admin).
- **Asignación y reasignación de tickets** con historial trazable.
- **Métricas operativas**: 8 consultas SQL expuestas como endpoints REST.
- **Validación JWT offline**: verifica tokens emitidos por `core-api-users` sin llamadas HTTP (secreto compartido).
- **Cifrado ECDH**: mismo mecanismo que `core-api-users` — clave pública independiente.

---

## Arquitectura hexagonal

```
src/
├── domain/                                   # Núcleo de negocio — cero dependencias externas
│   ├── entities/
│   │   ├── Ticket.ts                         # Entidad principal con comportamiento (assign, close, resolve)
│   │   ├── Comment.ts                        # Comentario con flag isInternal
│   │   └── Client.ts                         # Cliente asociado al ticket
│   ├── value-objects/
│   │   ├── TicketStatus.ts                   # Enum: OPEN | IN_PROGRESS | RESOLVED | CLOSED
│   │   └── TicketPriority.ts                 # Enum: LOW | MEDIUM | HIGH | CRITICAL
│   └── ports/                                # Interfaces — Dependency Inversion
│       ├── repositories/
│       │   ├── ITicketRepository.ts          # findById, findAll, save, delete
│       │   ├── ICommentRepository.ts         # findByTicketId, save
│       │   ├── IClientRepository.ts          # findById
│       │   └── IMetricsRepository.ts         # countByStatusAndClient, findStale, findReassignedMoreThan
│       └── services/
│           └── ICryptoService.ts             # getPublicKey, encrypt, decrypt
│
├── application/                              # Casos de uso — orquestación sin frameworks
│   ├── use-cases/
│   │   ├── tickets/
│   │   │   ├── CreateTicketUseCase.ts        # Valida cliente, crea ticket con estado OPEN
│   │   │   ├── GetTicketUseCase.ts           # Busca ticket por ID, 404 si no existe
│   │   │   ├── GetTicketsUseCase.ts          # Lista tickets con filtros opcionales
│   │   │   ├── UpdateTicketUseCase.ts        # Actualiza campos, gestiona resolved_at/closed_at
│   │   │   ├── DeleteTicketUseCase.ts        # Elimina ticket (solo ADMIN)
│   │   │   └── AssignTicketUseCase.ts        # Asigna ticket + registra en assignment_history
│   │   ├── comments/
│   │   │   ├── AddCommentUseCase.ts          # Valida que el ticket existe, crea comentario
│   │   │   └── GetCommentsUseCase.ts         # Lista comentarios de un ticket
│   │   └── metrics/
│   │       └── GetMetricsUseCase.ts          # getByStatusAndClient, getStaleTickets, getReassignedTickets
│   └── dtos/
│       ├── CreateTicketDto.ts                # { title, description, priority, clientId }
│       ├── UpdateTicketDto.ts                # Campos parciales opcionales
│       ├── TicketResponseDto.ts              # Respuesta normalizada + fromDomain()
│       ├── CommentDto.ts                     # { content, isInternal }
│       └── MetricsDto.ts                     # Tipos de respuesta de métricas
│
├── infrastructure/                           # Adaptadores — implementaciones concretas
│   ├── persistence/postgres/
│   │   ├── entities/
│   │   │   ├── TicketOrmEntity.ts            # @Entity('tickets') — mapeo TypeORM ↔ dominio
│   │   │   ├── CommentOrmEntity.ts           # @Entity('comments')
│   │   │   └── ClientOrmEntity.ts            # @Entity('clients')
│   │   ├── repositories/
│   │   │   ├── TicketRepository.ts           # Implementa ITicketRepository + IMetricsRepository
│   │   │   ├── CommentRepository.ts          # Implementa ICommentRepository
│   │   │   └── ClientRepository.ts           # Implementa IClientRepository
│   │   └── data-source.ts                    # DataSource TypeORM
│   ├── services/
│   │   └── EcdhCryptoService.ts              # Implementa ICryptoService con node:crypto P-256
│   └── http/
│       ├── controllers/
│       │   ├── TicketController.ts           # create, getAll, getById, update, delete, assign
│       │   ├── CommentController.ts          # add, getAll
│       │   └── MetricsController.ts          # byStatusAndClient, staleTickets, reassignedTickets
│       ├── middlewares/
│       │   ├── EcdhDecryptMiddleware.ts      # Descifra body si X-Encrypted: true
│       │   ├── AuthMiddleware.ts             # Verifica JWT offline → req.user
│       │   └── RoleMiddleware.ts             # requireRole(...roles) → 403 si sin permisos
│       └── routes/
│           ├── TicketRoutes.ts               # POST|GET|PATCH|DELETE /tickets y variantes
│           ├── CommentRoutes.ts              # POST|GET /tickets/:id/comments
│           ├── MetricsRoutes.ts              # GET /metrics/*
│           └── CryptoRoutes.ts              # GET /crypto/public-key
│
├── shared/
│   ├── errors/
│   │   ├── AppError.ts                       # Error HTTP con statusCode + code
│   │   └── DomainError.ts                    # Error de dominio → 422
│   ├── utils/
│   │   └── validateDto.ts                    # Validación con class-validator
│   └── types/
│       └── express.d.ts                      # Augmenta Request con req.user
│
├── app.ts                                    # Factory createApp(dataSource) — DI manual
└── server.ts                                 # Entry point
```

### Flujo de una request de asignación de ticket

```
PATCH /api/v1/tickets/:id/assign
Header: Authorization: Bearer <jwt>
Header: X-Encrypted: true
Body: { publicKey, iv, authTag, encryptedData }
            │
            ▼
   EcdhDecryptMiddleware
   → descifra body → req.body = { assignedTo: "user-uuid", assignedBy: "user-uuid" }
            │
            ▼
   AuthMiddleware
   → jwt.verify(token, JWT_SECRET) → req.user = { id, role }
            │
            ▼
   RoleMiddleware  requireRole('ADMIN', 'SUPERVISOR')
   → 403 si rol insuficiente
            │
            ▼
   TicketController.assign()
   → valida DTO, llama AssignTicketUseCase
            │
            ▼
   AssignTicketUseCase.execute(ticketId, assignedTo, assignedBy)
   → ticketRepo.findById(id)  → Ticket entity
   → ticket.assign(userId)    → mutación de dominio
   → ticketRepo.save(ticket)  → PostgreSQL UPDATE + INSERT assignment_history
   → return TicketResponseDto
```

---

## Diagrama MER

Base de datos: `clientsupport_tickets`

```
┌──────────────────────────┐         ┌─────────────────────────────────────┐
│          clients          │         │                tickets               │
├─────────────┬────────────┤         ├───────────────┬─────────────────────┤
│ id          │ UUID PK    │◄────────┤ client_id     │ UUID  NOT NULL  FK   │
│ name        │ VARCHAR    │         │ id            │ UUID  PK             │
│ email       │ VARCHAR UK │         │ title         │ VARCHAR(255)         │
│ created_at  │ TIMESTAMP  │         │ description   │ TEXT                 │
└─────────────┴────────────┘         │ status        │ VARCHAR(50)          │
                                     │               │  CHECK OPEN|IN_PROGRESS│
                                     │               │  |RESOLVED|CLOSED    │
                                     │ priority      │ VARCHAR(50)          │
                                     │               │  CHECK LOW|MEDIUM    │
                                     │               │  |HIGH|CRITICAL      │
                                     │ created_by    │ UUID  (externo)      │
                                     │ assigned_to   │ UUID  (externo, null)│
                                     │ created_at    │ TIMESTAMP            │
                                     │ updated_at    │ TIMESTAMP            │
                                     │ resolved_at   │ TIMESTAMP (nullable) │
                                     │ closed_at     │ TIMESTAMP (nullable) │
                                     └───────────────┴─────────────────────┘
                                               │                │
                    ┌──────────────────────────┘                │
                    │                                           │
                    ▼                                           ▼
    ┌─────────────────────────────┐         ┌──────────────────────────────┐
    │       assignment_history     │         │           comments            │
    ├──────────────┬──────────────┤         ├────────────┬─────────────────┤
    │ id           │ UUID PK      │         │ id         │ UUID PK          │
    │ ticket_id    │ UUID FK→tick.│         │ ticket_id  │ UUID FK→tickets  │
    │ assigned_from│ UUID (null)  │         │ author_id  │ UUID (externo)   │
    │ assigned_to  │ UUID         │         │ content    │ TEXT             │
    │ assigned_by  │ UUID         │         │ is_internal│ BOOLEAN          │
    │ assigned_at  │ TIMESTAMP    │         │ created_at │ TIMESTAMP        │
    └──────────────┴──────────────┘         └────────────┴─────────────────┘
```

```mermaid
erDiagram
    CLIENTS {
        uuid id PK
        varchar name
        varchar email UK
        timestamp created_at
    }

    TICKETS {
        uuid id PK
        varchar title
        text description
        varchar status
        varchar priority
        uuid client_id FK
        uuid created_by
        uuid assigned_to
        timestamp created_at
        timestamp updated_at
        timestamp resolved_at
        timestamp closed_at
    }

    COMMENTS {
        uuid id PK
        uuid ticket_id FK
        uuid author_id
        text content
        boolean is_internal
        timestamp created_at
    }

    ASSIGNMENT_HISTORY {
        uuid id PK
        uuid ticket_id FK
        uuid assigned_from
        uuid assigned_to
        uuid assigned_by
        timestamp assigned_at
    }

    CLIENTS ||--o{ TICKETS : "tiene"
    TICKETS ||--o{ COMMENTS : "tiene"
    TICKETS ||--o{ ASSIGNMENT_HISTORY : "registra"
```

### Índices optimizados

```sql
-- Consultas frecuentes: filtrar por estado, prioridad, cliente, agente
idx_tickets_status       ON tickets (status)
idx_tickets_priority     ON tickets (priority)
idx_tickets_client_id    ON tickets (client_id)
idx_tickets_assigned_to  ON tickets (assigned_to)
idx_tickets_created_by   ON tickets (created_by)
idx_tickets_updated_at   ON tickets (updated_at)   -- para query de tickets stale

-- JOIN en métricas de reasignación
idx_assignment_history_ticket_id ON assignment_history (ticket_id)

-- Comentarios por ticket
idx_comments_ticket_id ON comments (ticket_id)
```

---

## Cifrado ECDH Diffie-Hellman

`core-api-tickets` implementa el **mismo mecanismo ECDH** que `core-api-users` pero con su **propio par de claves independiente**. Esto significa que un atacante que comprometa la clave de un microservicio no puede descifrar el tráfico del otro.

### Algoritmos

| Etapa | Algoritmo | Parámetros |
|-------|-----------|------------|
| Intercambio de claves | ECDH | Curva `prime256v1` (P-256, NIST) |
| Derivación de clave simétrica | SHA-256 | Input: shared secret (32-64 bytes) → output: 32 bytes |
| Cifrado | AES-256-GCM | Clave: 256 bits, IV: 96 bits (12 bytes), AuthTag: 128 bits |

### Endpoints de cifrado

```
GET /api/v1/crypto/public-key
→ { publicKey: "BHj...base64..." }
```

### Header requerido en requests cifrados

```
X-Encrypted: true
Content-Type: application/json
```

### Flujo de descifrado en el middleware

```typescript
// EcdhDecryptMiddleware.ts
export const ecdhDecryptMiddleware = (cryptoService: ICryptoService) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (req.headers['x-encrypted'] !== 'true') {
      return next();       // ← no cifrado, pasa directo
    }
    const { publicKey, iv, authTag, encryptedData } = req.body;
    req.body = cryptoService.decrypt({ publicKey, iv, authTag, encryptedData });
    next();
  };
```

---

## Principios SOLID aplicados

### S — Single Responsibility
- `CreateTicketUseCase`: sólo crea tickets.
- `AssignTicketUseCase`: sólo gestiona asignaciones.
- `TicketRepository`: sólo accede a `tickets` + `assignment_history` en PostgreSQL.
- `MetricsController`: sólo delega llamadas de métricas.

### O — Open/Closed
`IMetricsRepository` define el contrato de consultas métricas. Para agregar una métrica nueva se escribe un método nuevo en la interfaz y su implementación — sin modificar el use case existente.

### L — Liskov Substitution
`TicketRepository` implementa tanto `ITicketRepository` como `IMetricsRepository`. Cualquier implementación alternativa (e.g., para MongoDB) puede sustituirla sin que el dominio cambie.

### I — Interface Segregation
`ITicketRepository`, `ICommentRepository`, `IClientRepository` e `IMetricsRepository` son interfaces separadas. Un use case que sólo necesita comentarios recibe `ICommentRepository`, no un repositorio monolítico.

### D — Dependency Inversion
```typescript
// En app.ts — composición manual de dependencias
const ticketRepo        = new TicketRepository(dataSource);
const commentRepo       = new CommentRepository(dataSource);
const clientRepo        = new ClientRepository(dataSource);

const createTicketUseCase = new CreateTicketUseCase(ticketRepo, clientRepo); // ← DI
const assignTicketUseCase = new AssignTicketUseCase(ticketRepo);             // ← DI
const getMetricsUseCase   = new GetMetricsUseCase(ticketRepo);               // ← DI
```

### Comportamiento en entidades de dominio (Rich Domain Model)

Las entidades no son simples bolsas de datos — tienen comportamiento:

```typescript
// domain/entities/Ticket.ts
export class Ticket {
  assign(userId: string): void {
    this.assignedTo = userId;
    this.updatedAt = new Date();
  }

  resolve(): void {
    this.status = TicketStatus.RESOLVED;
    this.resolvedAt = new Date();
    this.updatedAt = new Date();
  }

  close(): void {
    this.status = TicketStatus.CLOSED;
    this.closedAt = new Date();
    this.updatedAt = new Date();
  }
}
```

---

## Rutas de la API

Base path: `/api/v1`

### Tickets

| Método  | Ruta | Body cifrado | Auth | Roles | Descripción |
|---------|------|:------------:|:----:|-------|-------------|
| `POST`  | `/tickets` | ✅ | ✅ JWT | AGENT, ADMIN, SUPERVISOR | Crea nuevo ticket |
| `GET`   | `/tickets` | ❌ | ✅ JWT | Todos | Lista tickets (filtros: status, priority) |
| `GET`   | `/tickets/:id` | ❌ | ✅ JWT | Todos | Detalle de ticket |
| `PATCH` | `/tickets/:id` | ✅ | ✅ JWT | Todos | Actualiza ticket |
| `DELETE`| `/tickets/:id` | ❌ | ✅ JWT | ADMIN | Elimina ticket |
| `PATCH` | `/tickets/:id/assign` | ✅ | ✅ JWT | ADMIN, SUPERVISOR | Asigna/reasigna ticket |

**Request crear ticket**:
```json
// Body cifrado → descifrado:
{
  "title": "Error en facturación",
  "description": "El cliente no puede ver su factura del mes de agosto",
  "priority": "HIGH",
  "clientId": "uuid-del-cliente"
}
```

**Response ticket**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "title": "Error en facturación",
    "status": "OPEN",
    "priority": "HIGH",
    "clientId": "uuid",
    "createdBy": "uuid",
    "assignedTo": null,
    "createdAt": "2026-09-06T10:00:00.000Z",
    "updatedAt": "2026-09-06T10:00:00.000Z",
    "resolvedAt": null,
    "closedAt": null
  }
}
```

### Comentarios

| Método | Ruta | Body cifrado | Auth | Roles | Descripción |
|--------|------|:------------:|:----:|-------|-------------|
| `POST` | `/tickets/:id/comments` | ✅ | ✅ JWT | Todos | Agrega comentario al ticket |
| `GET`  | `/tickets/:id/comments` | ❌ | ✅ JWT | Todos | Lista comentarios del ticket |

**Request comentario**:
```json
{
  "content": "Revisando el problema con el equipo de facturación",
  "isInternal": true
}
```

### Métricas

> Requieren rol **ADMIN** o **SUPERVISOR**.

| Método | Ruta | Descripción | Query SQL |
|--------|------|-------------|-----------|
| `GET` | `/metrics/by-status` | Tickets por estado por cliente | Query #1 |
| `GET` | `/metrics/stale` | Tickets sin actualización > 48h | Query #3 |
| `GET` | `/metrics/reassigned` | Tickets reasignados > 2 veces | Query #7 |

### Crypto

| Método | Ruta | Auth | Descripción |
|--------|------|:----:|-------------|
| `GET` | `/crypto/public-key` | ❌ | Clave pública ECDH del servidor |

### Health check

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/health` | `{ status: "ok", service: "core-api-tickets" }` |

---

## Consultas SQL requeridas

Archivo: `queries.sql` (en la raíz del microservicio)

### Query 1 — Tickets por estado por cliente

```sql
SELECT c.id AS client_id, c.name AS client_name, t.status, COUNT(t.id) AS ticket_count
FROM tickets t
JOIN clients c ON t.client_id = c.id
GROUP BY c.id, c.name, t.status
ORDER BY c.name, t.status;
```

### Query 2 — Top 5 clientes con tickets de prioridad alta/crítica

```sql
SELECT c.id, c.name, COUNT(t.id) AS high_priority_tickets
FROM tickets t
JOIN clients c ON t.client_id = c.id
WHERE t.priority IN ('HIGH', 'CRITICAL')
GROUP BY c.id, c.name
ORDER BY high_priority_tickets DESC LIMIT 5;
```

### Query 3 — Tickets sin actualización > 48h y no cerrados

```sql
SELECT id, title, status, priority, assigned_to, updated_at,
       EXTRACT(EPOCH FROM (NOW() - updated_at)) / 3600 AS hours_since_update
FROM tickets
WHERE status != 'CLOSED' AND updated_at < NOW() - INTERVAL '48 hours'
ORDER BY updated_at ASC;
```

### Query 4 — Usuario con más tickets resueltos en el último mes

```sql
SELECT assigned_to AS user_id, COUNT(id) AS resolved_count
FROM tickets
WHERE status = 'RESOLVED' AND resolved_at >= NOW() - INTERVAL '1 month'
  AND assigned_to IS NOT NULL
GROUP BY assigned_to ORDER BY resolved_count DESC LIMIT 1;
```

### Query 5 — Tiempo promedio de resolución por prioridad (horas)

```sql
SELECT priority,
       ROUND(AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600)::numeric, 2) AS avg_resolution_hours
FROM tickets WHERE resolved_at IS NOT NULL
GROUP BY priority
ORDER BY CASE priority WHEN 'CRITICAL' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 WHEN 'LOW' THEN 4 END;
```

### Query 6 — Tickets abiertos por agente

```sql
SELECT assigned_to AS agent_id, COUNT(id) AS open_tickets
FROM tickets WHERE status = 'OPEN' AND assigned_to IS NOT NULL
GROUP BY assigned_to ORDER BY open_tickets DESC;
```

### Query 7 — Tickets reasignados más de 2 veces

```sql
SELECT ah.ticket_id, t.title, COUNT(ah.id) AS reassignment_count
FROM assignment_history ah
JOIN tickets t ON ah.ticket_id = t.id
GROUP BY ah.ticket_id, t.title HAVING COUNT(ah.id) > 2
ORDER BY reassignment_count DESC;
```

### Query 8 — % tickets cerrados en los últimos 30 días

```sql
SELECT COUNT(*) AS total_tickets,
       COUNT(*) FILTER (WHERE status = 'CLOSED') AS closed_tickets,
       ROUND((COUNT(*) FILTER (WHERE status = 'CLOSED'))::numeric / NULLIF(COUNT(*),0) * 100, 2) AS closure_percentage
FROM tickets WHERE created_at >= NOW() - INTERVAL '30 days';
```

---

## Tests

Framework: **Jest 29** + **ts-jest** + **pg-mem** (PostgreSQL en memoria) + **Supertest**.

### Cobertura: 46 / 46 ✓

| Archivo de test | Tipo | Tests | Qué cubre |
|-----------------|------|:-----:|-----------|
| `test/unit/domain/entities/Ticket.test.ts` | Unit | 8 | Entidad Ticket, value objects, métodos de dominio |
| `test/unit/use-cases/tickets/CreateTicketUseCase.test.ts` | Unit | 5 | Creación, cliente inválido, validaciones |
| `test/unit/use-cases/tickets/UpdateTicketUseCase.test.ts` | Unit | 4 | Actualización parcial, cambios de estado |
| `test/unit/use-cases/metrics/GetMetricsUseCase.test.ts` | Unit | 5 | Métricas por estado, stale, reasignados |
| `test/integration/tickets.integration.test.ts` | Integration | 12 | CRUD E2E, asignación, control de roles, JWT |
| `test/integration/comments.integration.test.ts` | Integration | 12 | Comentarios E2E, filtro isInternal, auth |

### Particularidades de los tests

```typescript
// pg-mem con FK y cascadas
const db = newDb({ autoCreateForeignKeyIndices: true });

// assignment_history con ON DELETE CASCADE (soportado por pg-mem)
// REFERENCES tickets(id) ON DELETE CASCADE

// Las columnas created_by, author_id, assigned_by se declaran como VARCHAR
// porque los tokens de test no son UUID válidos
// Esto es una adaptación de test, no afecta producción
```

### Ejecutar tests

```bash
pnpm test                    # Todos los tests
pnpm test:unit               # Solo tests unitarios
pnpm test:integration        # Solo tests de integración
pnpm test:coverage           # Con reporte de cobertura (v8)
```

---

## Variables de entorno

```env
# .env.example
PORT=3002
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/clientsupport_tickets
JWT_SECRET=<mismo secreto que core-api-users — validación offline>
ECDH_CURVE=prime256v1
NODE_ENV=development
```

> `JWT_SECRET` debe ser **idéntico** al de `core-api-users`. No hay llamada HTTP entre servicios — el ticket service verifica el JWT con `jwt.verify(token, secret)` directamente.

---

## Inicio rápido

### Desarrollo local

```bash
cd Backend/core-api-tickets
cp .env.example .env
pnpm install
pnpm dev          # ts-node-dev con hot-reload en :3002
```

### Seed de datos de prueba

```bash
# Con Docker corriendo
USERS_API=http://localhost:8080/users-api \
TICKETS_API=http://localhost:8080/tickets-api \
pnpm seed

# En desarrollo local
pnpm seed
```

El script `scripts/seed.mjs` crea:
- 3 usuarios (admin, agent, supervisor) — idempotente (login si ya existen)
- 1 cliente empresarial (Infinivirt)
- 8 tickets con estados y prioridades variadas

---

## Dockerfile

Multi-stage build con Node 20 Alpine:

```
Stage 1 — builder
  node:20-alpine
  Instala todas las dependencias (incluyendo devDeps)
  Compila TypeScript → dist/

Stage 2 — production
  node:20-alpine (imagen limpia)
  Copia solo dist/ y node_modules de producción
  EXPOSE 3002
  CMD ["node", "dist/server.js"]
```

---

## Dependencias

### Production

| Paquete | Versión | Uso |
|---------|---------|-----|
| `express` | 4.21.2 | Framework HTTP |
| `typeorm` | 0.3.20 | ORM PostgreSQL |
| `pg` | 8.12.0 | Driver PostgreSQL nativo |
| `jsonwebtoken` | 9.0.2 | Verificación JWT offline |
| `class-validator` | 0.14.1 | Validación de DTOs |
| `class-transformer` | 0.5.1 | Transformación de instancias |
| `helmet` | 7.1.0 | Headers de seguridad HTTP |
| `cors` | 2.8.5 | Cross-Origin Resource Sharing |
| `reflect-metadata` | 0.2.2 | Requerido por TypeORM |
| `uuid` | 10.0.0 | Generación de UUIDs |

### Development / Testing

| Paquete | Versión | Uso |
|---------|---------|-----|
| `jest` | 29.7.0 | Framework de testing |
| `ts-jest` | 29.2.2 | TypeScript en Jest |
| `pg-mem` | 2.8.1 | PostgreSQL en memoria para tests |
| `supertest` | 6.3.4 | Testing HTTP |
| `ts-node-dev` | 2.0.0 | Dev server con hot-reload |
| `typescript` | 5.5.4 | Compilador |
