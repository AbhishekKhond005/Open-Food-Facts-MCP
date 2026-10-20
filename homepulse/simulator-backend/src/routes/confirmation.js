'use strict';

const express = require('express');
const { handleConfirmation } = require('../conversation/orchestrator');

const router = express.Router();

router.post('/', async (req, res) => {
  const { conversationId, confirmationId, decision } = req.body ?? {};

  if (!conversationId || !confirmationId) {
    return res.status(400).json({
      error:  'Bad request',
      detail: '"conversationId" and "confirmationId" are required.',
    });
  }

  if (decision !== 'approve' && decision !== 'reject') {
    return res.status(400).json({
      error:  'Bad request',
      detail: '"decision" must be "approve" or "reject".',
    });
  }

  try {
    const result = await handleConfirmation(conversationId, confirmationId, decision);
    return res.json(result);
  } catch (err) {
    console.error('[/api/v1/chat/confirm] Unexpected error:', err);
    return res.status(500).json({
      conversationId,
      status:          'failed',
      assistantMessage: 'An unexpected error occurred during confirmation. No action was taken.',
      toolCalls:       [],
    });
  }
});

module.exports = router;
