/**
 * Schema Validation — validates tool arguments against the discovered JSON Schema.
 *
 * Uses a lightweight manual approach (no heavy AJV dependency) that covers
 * the common cases: required fields, type checking, and extra fields.
 *
 * For a production system you would replace this with AJV.
 */

'use strict';

/**
 * Validate `args` against a JSON Schema `inputSchema`.
 *
 * Returns { valid: true } or { valid: false, errors: string[] }.
 */
function validateArgs(inputSchema, args) {
  if (!inputSchema || typeof inputSchema !== 'object') return { valid: true };

  const errors = [];
  const required = inputSchema.required ?? [];
  const properties = inputSchema.properties ?? {};

  // Check required fields
  for (const field of required) {
    if (args[field] === undefined || args[field] === null) {
      errors.push(`Missing required field: "${field}"`);
    }
  }

  // Check type of provided fields
  for (const [key, value] of Object.entries(args)) {
    const propSchema = properties[key];
    if (!propSchema) continue; // unknown extra field — server will validate
    const expected = propSchema.type;
    if (!expected) continue;
    const actual = Array.isArray(value) ? 'array' : typeof value;
    if (actual !== expected) {
      errors.push(`Field "${key}": expected ${expected}, got ${actual}`);
    }
  }

  return errors.length === 0 ? { valid: true } : { valid: false, errors };
}

module.exports = { validateArgs };
