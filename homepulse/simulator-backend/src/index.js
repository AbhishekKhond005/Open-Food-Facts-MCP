'use strict';

require('dotenv').config();

const express = require('express');
const cors    = require('cors');

const chatRoute         = require('./routes/chat');
const confirmationRoute = require('./routes/confirmation');
const statusRoute       = require('./routes/status');

const PORT       = process.env.PORT       || 3001;
const WEB_ORIGIN = process.env.WEB_ORIGIN || 'http://localhost:5173';

const app = express();

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(cors({
  origin:      WEB_ORIGIN,
  credentials: true,
}));

app.use(express.json());

// Request logger (safe — no body dumping)
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ─── Routes ───────────────────────────────────────────────────────────────────

app.use('/api/v1/chat/confirm', confirmationRoute);
app.use('/api/v1/chat',         chatRoute);
app.use('/api/v1/status',       statusRoute);

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// 404
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`FoodPulse simulator backend running on http://localhost:${PORT}`);
  console.log(`MCP server target: ${process.env.MCP_SERVER_URL || 'http://localhost:8081/mcp'}`);
  console.log(`Allowed CORS origin: ${WEB_ORIGIN}`);
});

module.exports = app;
