/* ============================================================
   JsonsNTokens — tokenizer.js
   Token counting: countTokens, tiktoken, formatCost, calcCost
   ============================================================ */

'use strict';

// ── TOKENIZER ──────────────────────────────────────────────────────────────

// Cache of resolved tiktoken encoder instances, keyed by encoding name.
// Stores Promises while loading so concurrent callers share the same load.
// This prevents duplicate WASM instantiation if countTokens is called concurrently
// for the same encoding before the first load completes.
const tiktokenEncoders = new Map();

// Per-encoding failure flags. Using a Set (not a single boolean) so that a failure
// for one encoding (e.g. cl100k_base) does not disable a different encoding
// (e.g. o200k_base) that may load successfully in the same session.
const tiktokenFailed = new Set();

/**
 * Count tokens for the given text using the selected model.
 * Returns { count: number, method: 'exact' | 'approximate' }
 */
async function countTokens(text, model) {
  if (!text) return { count: 0, method: 'exact' };

  if (model.tokenizer === 'tiktoken') {
    return await countWithTiktoken(text, model.encoding);
  }

  // Approximate: chars / charsPerToken, minimum 1 token per word
  const charsPerToken = model.charsPerToken || 4.0;
  const charBased = Math.ceil(text.length / charsPerToken);
  const wordBased = text.trim().split(/\s+/).filter(Boolean).length;
  const count = Math.max(charBased, wordBased);
  return { count, method: 'approximate' };
}

async function countWithTiktoken(text, encoding) {
  if (tiktokenFailed.has(encoding)) {
    // This encoding failed previously — fall back to approximation for the session.
    const count = Math.ceil(text.length / 4.0);
    return { count, method: 'approximate' };
  }

  try {
    if (!tiktokenEncoders.has(encoding)) {
      // Store the Promise immediately so concurrent calls share this load
      // rather than each firing their own import() and WASM instantiation.
      tiktokenEncoders.set(encoding, loadTiktoken(encoding));
    }
    const encoder = await tiktokenEncoders.get(encoding);
    const tokens = encoder.encode(text);
    return { count: tokens.length, method: 'exact' };
  } catch (err) {
    console.warn('tiktoken error for encoding "' + encoding + '", falling back to approximation:', err.message);
    tiktokenFailed.add(encoding);
    tiktokenEncoders.delete(encoding); // remove the failed Promise from the cache
    const count = Math.ceil(text.length / 4.0);
    return { count, method: 'approximate' };
  }
}

async function loadTiktoken(encoding) {
  // Dynamically load tiktoken from CDN
  const { get_encoding } = await import(
    'https://cdn.jsdelivr.net/npm/tiktoken@1.0.15/+esm'
  );
  return get_encoding(encoding);
}

/**
 * Format a cost in USD. Shows 4 decimal places for small values.
 */
function formatCost(usd) {
  if (usd === 0)    return '$0.00';
  if (usd < 0.0001) return '<$0.0001';
  if (usd < 0.01)   return '$' + usd.toFixed(4);
  return '$' + usd.toFixed(2);
}

/**
 * Calculate cost given token count and price per 1M tokens.
 */
function calcCost(tokens, per1M) {
  return (tokens / 1_000_000) * per1M;
}
