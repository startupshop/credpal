'use strict';

require('dotenv').config();
const express = require('express');
const { healthCheck } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Structured request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(
      `[${new Date().toISOString()}] ${req.method} ${req.path} ${res.statusCode} ${Date.now() - start}ms`
    );
  });
  next();
});

// GET /health — liveness probe, no DB check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// GET /status — readiness probe, includes DB check
app.get('/status', async (req, res) => {
  const dbOk = await healthCheck();
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    db: dbOk ? 'connected' : 'unreachable',
  });
});

// POST /process — accepts JSON body, returns processed result
app.post('/process', (req, res) => {
  const body = req.body;
  if (!body || Object.keys(body).length === 0) {
    return res.status(400).json({ error: 'Request body is required' });
  }
  res.json({
    status: 'processed',
    input: body,
    processedAt: new Date().toISOString(),
  });
});

const server = app.listen(PORT, () => {
  console.log(`[${new Date().toISOString()}] Server running on port ${PORT}`);
});

process.on('SIGTERM', () => {
  console.log(`[${new Date().toISOString()}] SIGTERM received, shutting down`);
  server.close(() => process.exit(0));
});

module.exports = { app, server };
