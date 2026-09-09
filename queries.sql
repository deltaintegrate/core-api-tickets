-- ============================================================
-- queries.sql — Consultas SQL requeridas por la prueba técnica
-- Base de datos: clientsupport_tickets (PostgreSQL)
-- ============================================================

-- 1. Cantidad de tickets por estado para cada cliente
SELECT
    c.id          AS client_id,
    c.name        AS client_name,
    t.status,
    COUNT(t.id)   AS ticket_count
FROM tickets t
JOIN clients c ON t.client_id::uuid = c.id
GROUP BY c.id, c.name, t.status
ORDER BY c.name, t.status;

-- ============================================================

-- 2. Top 5 clientes con mayor cantidad de tickets de prioridad alta o crítica
SELECT
    c.id        AS client_id,
    c.name      AS client_name,
    COUNT(t.id) AS high_priority_tickets
FROM tickets t
JOIN clients c ON t.client_id::uuid = c.id
WHERE t.priority IN ('HIGH', 'CRITICAL')
GROUP BY c.id, c.name
ORDER BY high_priority_tickets DESC
LIMIT 5;

-- ============================================================

-- 3. Tickets con más de 48 horas sin actualización y que no están cerrados
SELECT
    t.id,
    t.title,
    t.status,
    t.priority,
    t.assigned_to,
    t.updated_at,
    EXTRACT(EPOCH FROM (NOW() - t.updated_at)) / 3600 AS hours_since_update
FROM tickets t
WHERE t.status != 'CLOSED'
  AND t.updated_at < NOW() - INTERVAL '48 hours'
ORDER BY t.updated_at ASC;

-- ============================================================

-- 4. Usuario con mayor cantidad de tickets resueltos durante el último mes
-- Requiere: CREATE EXTENSION IF NOT EXISTS dblink;  (ejecutar una vez en clientsupport_tickets)
SELECT
    t.assigned_to                AS user_id,
    u.name                       AS user_name,
    COUNT(t.id)                  AS resolved_count
FROM tickets t
JOIN (
    SELECT id, name
    FROM dblink(
        'host=localhost port=5433 dbname=clientsupport_users user=postgres password=postgres',
        'SELECT id::text, name FROM users'
    ) AS d(id text, name text)
) u ON t.assigned_to::text = u.id
WHERE t.status = 'RESOLVED'
  AND t.resolved_at >= NOW() - INTERVAL '1 month'
  AND t.assigned_to IS NOT NULL
GROUP BY t.assigned_to, u.name
ORDER BY resolved_count DESC
LIMIT 1;

-- ============================================================

-- 5. Tiempo promedio de resolución de tickets por prioridad (en horas)
SELECT
    t.priority,
    ROUND(
        AVG(
            EXTRACT(EPOCH FROM (t.resolved_at - t.created_at)) / 3600
        )::numeric,
        2
    ) AS avg_resolution_hours
FROM tickets t
WHERE t.resolved_at IS NOT NULL
GROUP BY t.priority
ORDER BY
    CASE t.priority
        WHEN 'CRITICAL' THEN 1
        WHEN 'HIGH'     THEN 2
        WHEN 'MEDIUM'   THEN 3
        WHEN 'LOW'      THEN 4
    END;

-- ============================================================

-- 6. Cantidad de tickets abiertos por agente (usuario asignado)
-- Requiere: CREATE EXTENSION IF NOT EXISTS dblink;  (ya ejecutado por el seed)
SELECT
    t.assigned_to            AS agent_id,
    u.name                   AS agent_name,
    COUNT(t.id)              AS open_tickets
FROM tickets t
JOIN (
    SELECT id, name
    FROM dblink(
        'host=localhost port=5433 dbname=clientsupport_users user=postgres password=postgres',
        'SELECT id::text, name FROM users'
    ) AS d(id text, name text)
) u ON t.assigned_to::text = u.id
WHERE t.status = 'OPEN'
  AND t.assigned_to IS NOT NULL
GROUP BY t.assigned_to, u.name
ORDER BY open_tickets DESC;

-- ============================================================

-- 7. Tickets que han sido reasignados más de dos veces
SELECT
    ah.ticket_id,
    t.title,
    COUNT(ah.id) AS reassignment_count
FROM assignment_history ah
JOIN tickets t ON ah.ticket_id = t.id
GROUP BY ah.ticket_id, t.title
HAVING COUNT(ah.id) > 2
ORDER BY reassignment_count DESC;

-- ============================================================

-- 8. Porcentaje de tickets cerrados frente al total de tickets creados en los últimos 30 días
SELECT
    COUNT(*)                                                           AS total_tickets,
    COUNT(*) FILTER (WHERE status = 'CLOSED')                         AS closed_tickets,
    ROUND(
        (COUNT(*) FILTER (WHERE status = 'CLOSED'))::numeric
        / NULLIF(COUNT(*), 0) * 100,
        2
    )                                                                  AS closure_percentage
FROM tickets
WHERE created_at >= NOW() - INTERVAL '30 days';
