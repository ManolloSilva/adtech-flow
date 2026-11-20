import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from '../src/index.js';

process.env.DB_PATH = join(mkdtempSync(tmpdir() + '/adtech-'), 'test.db');

const server = createServer();
const portPromise = new Promise((resolve) => {
  server.listen(0, () => resolve(server.address().port));
});
const port = await portPromise;
after(() => server.close());

test('health endpoint returns ok', async () => {
  const res = await fetch(`http://localhost:${port}/health`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, 'ok');
  assert.ok(body.traceId);
});

test('metrics endpoint returns prometheus text', async () => {
  const res = await fetch(`http://localhost:${port}/metrics`);
  assert.equal(res.status, 200);
  const text = await res.text();
  assert.match(text, /adtech_requests_total/);
});

test('save and retrieve simulation', async () => {
  const traceId = 'test-trace-1';
  const res = await fetch(`http://localhost:${port}/api/simulations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Trace-Id': traceId },
    body: JSON.stringify({ config: { floor: 2.5 }, result: { winner: 'ttd' } }),
  });
  assert.equal(res.status, 201);
  const saved = await res.json();
  assert.ok(saved.id);

  const list = await fetch(`http://localhost:${port}/api/simulations`);
  const body = await list.json();
  assert.ok(body.simulations.length >= 1);

  const one = await fetch(`http://localhost:${port}/api/simulations/${saved.id}`);
  const detail = await one.json();
  assert.equal(detail.config.floor, 2.5);
  assert.equal(detail.result.winner, 'ttd');
});