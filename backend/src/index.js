import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { getDb, closeDb } from './db.js';
import { info, warn, error } from './logger.js';

const PORT = process.env.PORT || 8080;

const metrics = {
  requests: 0,
  simulationsSaved: 0,
  errors: 0,
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function sendJson(res, status, body, traceId) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (traceId) res.setHeader('X-Trace-Id', traceId);
  res.end(JSON.stringify(body));
}

function handle(req, res) {
  const traceId = req.headers['x-trace-id'] || randomUUID();
  metrics.requests += 1;
  const started = Date.now();
  const url = new URL(req.url, 'http://localhost');

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,X-Trace-Id');
    res.end();
    return;
  }

  try {
    if (req.method === 'GET' && url.pathname === '/health') {
      sendJson(res, 200, { status: 'ok', service: 'adtech-flow-backend', traceId }, traceId);
      info('health', { traceId, ms: Date.now() - started });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/metrics') {
      const body = [
        '# HELP adtech_requests_total Total HTTP requests',
        '# TYPE adtech_requests_total counter',
        `adtech_requests_total ${metrics.requests}`,
        '# HELP adtech_simulations_saved_total Simulations persisted',
        '# TYPE adtech_simulations_saved_total counter',
        `adtech_simulations_saved_total ${metrics.simulationsSaved}`,
        '# HELP adtech_errors_total Total errors',
        '# TYPE adtech_errors_total counter',
        `adtech_errors_total ${metrics.errors}`,
      ].join('\n') + '\n';
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/plain; version=0.0.4');
      res.setHeader('X-Trace-Id', traceId);
      res.end(body);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/simulations') {
      readBody(req).then((raw) => {
        let payload;
        try { payload = JSON.parse(raw || '{}'); } catch (e) {
          metrics.errors += 1;
          warn('bad json', { traceId, error: e.message });
          sendJson(res, 400, { error: 'invalid json', traceId }, traceId);
          return;
        }
        const config = payload.config || payload;
        const result = payload.result || {};
        const db = getDb();
        const stmt = db.prepare('INSERT INTO simulations (trace_id, config, result) VALUES (?, ?, ?)');
        const info2 = stmt.run(traceId, JSON.stringify(config), JSON.stringify(result));
        metrics.simulationsSaved += 1;
        info('simulation saved', { traceId, id: info2.lastInsertRowid, ms: Date.now() - started });
        sendJson(res, 201, { id: info2.lastInsertRowid, traceId }, traceId);
      }).catch((e) => {
        metrics.errors += 1;
        error('save failed', { traceId, error: e.message });
        sendJson(res, 500, { error: e.message, traceId }, traceId);
      });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/simulations') {
      const db = getDb();
      const rows = db.prepare('SELECT id, created_at, trace_id, config, result FROM simulations ORDER BY id DESC LIMIT 50').all();
      const simulations = rows.map((r) => ({
        id: r.id,
        createdAt: r.created_at,
        traceId: r.trace_id,
        config: JSON.parse(r.config),
        result: JSON.parse(r.result),
      }));
      sendJson(res, 200, { simulations, traceId }, traceId);
      return;
    }

    const match = url.pathname.match(/^\/api\/simulations\/(\d+)$/);
    if (req.method === 'GET' && match) {
      const db = getDb();
      const row = db.prepare('SELECT id, created_at, trace_id, config, result FROM simulations WHERE id = ?').get(match[1]);
      if (!row) {
        sendJson(res, 404, { error: 'not found', traceId }, traceId);
        return;
      }
      sendJson(res, 200, {
        id: row.id,
        createdAt: row.created_at,
        traceId: row.trace_id,
        config: JSON.parse(row.config),
        result: JSON.parse(row.result),
      }, traceId);
      return;
    }

    // legacy simulate endpoint
    if (req.method === 'POST' && url.pathname === '/api/auction/simulate') {
      sendJson(res, 200, {
        auctionId: 'auc-synthetic-' + Date.now(),
        winningBidder: 'thetradedesk',
        winningCpm: 3.45,
        currency: 'USD',
        status: 'completed',
        traceId,
      }, traceId);
      return;
    }

    metrics.errors += 1;
    sendJson(res, 404, { error: 'Endpoint not found', traceId }, traceId);
  } catch (e) {
    metrics.errors += 1;
    error('unhandled', { traceId, error: e.message });
    sendJson(res, 500, { error: e.message, traceId }, traceId);
  }
}

export function createServer() {
  return http.createServer(handle);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const server = createServer();
  server.listen(PORT, () => {
    info('backend listening', { port: PORT });
  });
  process.on('SIGTERM', () => { closeDb(); server.close(); });
}
