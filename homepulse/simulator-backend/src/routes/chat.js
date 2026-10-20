'use strict';

const express    = require('express');
const { handleChat } = require('../conversation/orchestrator');

const router = express.Router();

router.post('/', async (req, res) => {
  const { message, conversationId } = req.body ?? {};

  if (!message || typeof message !== 'string' || message.trim() === '') {
    return res.status(400).json({
      error: 'Bad request',
      detail: '"message" is required and must be a non-empty string.',
    });
  }

  try {
    const result = await handleChat(message.trim(), conversationId);
    return res.json(result);
  } catch (err) {
    console.error('[/api/v1/chat] Unexpected error:', err);
    return res.status(500).json({
      conversationId: conversationId ?? null,
      status:         'failed',
      assistantMessage: 'An unexpected error occurred. Please try again.',
      toolCalls:      [],
    });
  }
});

module.exports = router;
