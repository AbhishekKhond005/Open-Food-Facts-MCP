'use strict';

const express   = require('express');
const mcpClient = require('../mcp/client');

const router = express.Router();

router.get('/', async (_req, res) => {
  const status = await mcpClient.getStatus();
  return res.json(status);
});

module.exports = router;
