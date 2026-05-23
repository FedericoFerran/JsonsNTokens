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
