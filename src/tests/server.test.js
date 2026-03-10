'use strict';

const { test, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');

// Stub env vars before requiring server
process.env.PORT = '3001';
process.env.DB_HOST = 'localhost';
process.env.DB_NAME = 'test';
process.env.DB_USER = 'test';
process.env.DB_PASSWORD = 'test';

const { app, server } = require('../server');

after(() => server.close());

test('GET /health returns 200 with healthy status', async () => {
  const res = await request(app).get('/health');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.status, 'healthy');
  assert.ok(res.body.timestamp);
});

test('GET /status returns 200 with ok status', async () => {
  const res = await request(app).get('/status');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.status, 'ok');
  assert.ok(typeof res.body.uptime === 'number');
  assert.ok(['connected', 'unreachable'].includes(res.body.db));
});

test('POST /process returns 200 with processed result', async () => {
  const res = await request(app)
    .post('/process')
    .send({ input: 'test' });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.status, 'processed');
  assert.deepStrictEqual(res.body.input, { input: 'test' });
  assert.ok(res.body.processedAt);
});

test('POST /process returns 400 for empty body', async () => {
  const res = await request(app)
    .post('/process')
    .send({});
  assert.strictEqual(res.status, 400);
});
