/* ============================================================
   JsonsNTokens — app.js
   Sections: Theme | Tabs | Prices | Tokenizer | Token Counter
             Suggestions | JSON Prettifier
   ============================================================ */

'use strict';

// ── THEME ──────────────────────────────────────────────────────────────────

const THEME_KEY = 'jnt-theme';

function getInitialTheme() {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored) return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.getElementById('theme-icon').textContent = theme === 'dark' ? '☀️' : '🌙';
  localStorage.setItem(THEME_KEY, theme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

// ── TABS ───────────────────────────────────────────────────────────────────

function switchTab(tabId) {
  // Deactivate all tabs and panels
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
    btn.setAttribute('aria-selected', 'false');
  });
  document.querySelectorAll('.panel').forEach(panel => {
    panel.classList.remove('active');
  });

  // Activate chosen tab and panel
  const tab = document.getElementById('tab-' + tabId);
  const panel = document.getElementById('panel-' + tabId);
  tab.classList.add('active');
  tab.setAttribute('aria-selected', 'true');
  panel.classList.add('active');
}

// ── INIT ───────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  // Theme
  applyTheme(getInitialTheme());
  document.getElementById('theme-btn').addEventListener('click', toggleTheme);

  // Tabs
  document.getElementById('tab-tokens').addEventListener('click', () => switchTab('tokens'));
  document.getElementById('tab-json').addEventListener('click', () => switchTab('json'));

  // Load everything else (prices → model selector → token counter → suggestions → JSON)
  initApp();
});

async function initApp() {
  await loadPrices();
  initTokenCounter();
  initSuggestions();
  initJsonPrettifier();
}

// ── PRICES & MODEL SELECTOR ────────────────────────────────────────────────

let MODELS = {};  // populated by loadPrices()

// Fallback model list used if prices.json fails to load
const FALLBACK_MODELS = {
  'claude-sonnet-4-6': { provider: 'Anthropic', label: 'Claude Sonnet 4.6', inputPer1M: 3.00, outputPer1M: 15.00, tokenizer: 'approximate', charsPerToken: 4.0 },
  'gpt-4o':            { provider: 'OpenAI',    label: 'GPT-4o',            inputPer1M: 2.50, outputPer1M: 10.00, tokenizer: 'tiktoken',    encoding: 'o200k_base' },
  'gemini-2.0-flash':  { provider: 'Gemini',    label: 'Gemini 2.0 Flash',  inputPer1M: 0.10, outputPer1M: 0.40,  tokenizer: 'approximate', charsPerToken: 3.5 },
};

async function loadPrices() {
  try {
    const res = await fetch('prices.json');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    MODELS = await res.json();
  } catch (err) {
    console.warn('prices.json failed to load, using fallback:', err.message);
    MODELS = FALLBACK_MODELS;
    showPricesError();
  }
  populateModelSelector();
}

function showPricesError() {
  const note = document.getElementById('prices-note');
  note.textContent = '⚠ Could not load prices.json — using a limited model list.';
  note.style.display = 'block';
  note.style.color = 'var(--error)';
}

function populateModelSelector() {
  const select = document.getElementById('model-select');
  select.innerHTML = '';

  // Group by provider
  const groups = {};
  for (const [id, model] of Object.entries(MODELS)) {
    if (!groups[model.provider]) groups[model.provider] = [];
    groups[model.provider].push({ id, ...model });
  }

  for (const [provider, models] of Object.entries(groups)) {
    const group = document.createElement('optgroup');
    group.label = provider;
    for (const m of models) {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = m.label;
      group.appendChild(opt);
    }
    select.appendChild(group);
  }
}

function getSelectedModel() {
  const id = document.getElementById('model-select').value;
  return { id, ...MODELS[id] };
}

// ── TOKENIZER ──────────────────────────────────────────────────────────────

const tiktokenEncoders = new Map(); // cached tiktoken encoders by encoding name
let tiktokenLoading = false;
let tiktokenFailed = false;

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
  if (tiktokenFailed) {
    // Fallback to approximation if tiktoken couldn't load
    const count = Math.ceil(text.length / 4.0);
    return { count, method: 'approximate' };
  }

  try {
    if (!tiktokenEncoders.has(encoding)) {
      tiktokenEncoders.set(encoding, await loadTiktoken(encoding));
    }
    const encoder = tiktokenEncoders.get(encoding);
    const tokens = encoder.encode(text);
    return { count: tokens.length, method: 'exact' };
  } catch (err) {
    console.warn('tiktoken error, falling back to approximation:', err.message);
    tiktokenFailed = true;
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
  if (usd === 0) return '$0.00';
  if (usd < 0.0001) return '<$0.0001';
  if (usd < 0.01)   return '$' + usd.toFixed(4);
  return '$' + usd.toFixed(4);
}

/**
 * Calculate cost given token count and price per 1M tokens.
 */
function calcCost(tokens, per1M) {
  return (tokens / 1_000_000) * per1M;
}

// ── TOKEN COUNTER UI ───────────────────────────────────────────────────────

let countDebounceTimer = null;

function initTokenCounter() {
  const input = document.getElementById('token-input');
  const modelSelect = document.getElementById('model-select');

  input.addEventListener('input', () => {
    clearTimeout(countDebounceTimer);
    countDebounceTimer = setTimeout(updateTokenCount, 120);
  });

  modelSelect.addEventListener('change', updateTokenCount);

  // Show prices note once model is selected
  document.getElementById('prices-note').style.display = 'block';
}

async function updateTokenCount() {
  const text = document.getElementById('token-input').value;
  const model = getSelectedModel();

  if (!text.trim()) {
    document.getElementById('result-card').classList.add('hidden');
    document.getElementById('suggestions-panel').classList.add('hidden');
    return;
  }

  const { count, method } = await countTokens(text, model);

  // Update result card
  document.getElementById('result-count-num').textContent = count.toLocaleString();

  const inputCost = calcCost(count, model.inputPer1M);
  document.getElementById('result-input-cost').textContent = formatCost(inputCost);
  document.getElementById('result-output-rate').textContent = '$' + model.outputPer1M.toFixed(2);

  const badge = document.getElementById('result-badge');
  if (method === 'approximate') {
    badge.style.display = 'inline-block';
  } else {
    badge.style.display = 'none';
  }

  document.getElementById('result-card').classList.remove('hidden');

  // Trigger suggestions update
  updateSuggestions(text);
}
