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

// ── TOKEN COUNTER UI ───────────────────────────────────────────────────────

let countDebounceTimer = null;

function initTokenCounter() {
  const input = document.getElementById('token-input');
  const modelSelect = document.getElementById('model-select');

  input.addEventListener('input', () => {
    // If user manually edits after an Apply, discard the undo state
    if (previousText !== null) {
      previousText = null;
      const cleanBtn = document.getElementById('clean-btn');
      if (cleanBtn) { cleanBtn.textContent = '✨ Apply selected'; cleanBtn.disabled = false; }
    }
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

// ── TOKEN REDUCTION SUGGESTIONS ────────────────────────────────────────────

// ── Phrase lists used by TECHNIQUES ──

const FILLER_PHRASES = [
  'could you please',
  'i would like you to',
  'as an ai language model',
  'as an ai',
  'as a language model',
  'feel free to',
  'certainly,',
  'of course,',
  'please note that',
  'i want you to',
  'kindly',
];

const VERBOSE_PATTERNS = [
  { pattern: /\bin order to\b/gi,             replacement: 'to',       label: '"in order to" → "to"' },
  { pattern: /\bdue to the fact that\b/gi,    replacement: 'because',  label: '"due to the fact that" → "because"' },
  { pattern: /\bat this point in time\b/gi,   replacement: 'now',      label: '"at this point in time" → "now"' },
  { pattern: /\bin the event that\b/gi,       replacement: 'if',       label: '"in the event that" → "if"' },
  { pattern: /\bfor the purpose of\b/gi,      replacement: 'to',       label: '"for the purpose of" → "to"' },
  { pattern: /\bwith regard to\b/gi,          replacement: 'about',    label: '"with regard to" → "about"' },
  { pattern: /\bprior to\b/gi,                replacement: 'before',   label: '"prior to" → "before"' },
  { pattern: /\bsubsequent to\b/gi,           replacement: 'after',    label: '"subsequent to" → "after"' },
  { pattern: /\ba large number of\b/gi,       replacement: 'many',     label: '"a large number of" → "many"' },
  { pattern: /\bthe majority of\b/gi,         replacement: 'most',     label: '"the majority of" → "most"' },
  { pattern: /\bmake use of\b/gi,             replacement: 'use',      label: '"make use of" → "use"' },
  { pattern: /\bprovide assistance\b/gi,      replacement: 'help',     label: '"provide assistance" → "help"' },
  { pattern: /\bat the present time\b/gi,     replacement: 'now',      label: '"at the present time" → "now"' },
  { pattern: /\bhas the ability to\b/gi,      replacement: 'can',      label: '"has the ability to" → "can"' },
  { pattern: /\bis able to\b/gi,              replacement: 'can',      label: '"is able to" → "can"' },
];

// Hedging words that weaken statements without adding information
const OVERQUALIFY_PATTERNS = [
  { pattern: /\bI think,?\s+/gi,              label: '"I think"' },
  { pattern: /\bI believe,?\s+/gi,            label: '"I believe"' },
  { pattern: /\bI feel,?\s+/gi,               label: '"I feel"' },
  { pattern: /\bI suppose,?\s+/gi,            label: '"I suppose"' },
  { pattern: /\bperhaps\s+/gi,                label: '"perhaps"' },
  { pattern: /\bmaybe\s+/gi,                  label: '"maybe"' },
  { pattern: /\bit seems\s+/gi,               label: '"it seems"' },
  { pattern: /\bit appears that\s+/gi,        label: '"it appears that"' },
];

// Meta-commentary: phrases that announce what you're about to say
const HEDGING_PATTERNS = [
  { pattern: /it is important to note that\s*/gi,                   label: '"it is important to note that"' },
  { pattern: /it should be noted that\s*/gi,                        label: '"it should be noted that"' },
  { pattern: /please be aware that\s*/gi,                           label: '"please be aware that"' },
  { pattern: /it is worth (noting|mentioning)\s*(that\s*)?/gi,      label: '"it is worth noting/mentioning"' },
  { pattern: /needless to say,?\s*/gi,                              label: '"needless to say"' },
  { pattern: /as (mentioned|discussed|stated) (above|earlier|before|previously),?\s*/gi, label: '"as mentioned/discussed above"' },
  { pattern: /as (I|we) (said|mentioned|noted),?\s*/gi,             label: '"as I/we said/mentioned"' },
  { pattern: /to reiterate,?\s*/gi,                                 label: '"to reiterate"' },
  { pattern: /for (your|your) (information|reference),?\s*/gi,      label: '"for your information/reference"' },
];

// ── TECHNIQUES — each is detectable, applicable, and selectable ──

const TECHNIQUES = [
  {
    id: 'filler',
    category: 'Filler',
    name: 'Filler phrases',
    description: 'Common courtesy phrases that add no information to the prompt',
    detect(text) {
      const found = FILLER_PHRASES.filter(p => text.toLowerCase().includes(p.toLowerCase()));
      if (!found.length) return null;
      const savings = found.reduce((acc, p) => acc + Math.ceil(p.split(' ').length * 0.8), 0);
      return {
        label: found.length + ' filler phrase' + (found.length > 1 ? 's' : '') + ' found',
        example: found[0],
        savings,
      };
    },
    apply(text) {
      let out = text;
      FILLER_PHRASES.forEach(phrase => {
        const re = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        out = out.replace(re, '');
      });
      return out;
    },
  },
  {
    id: 'verbose',
    category: 'Verbosity',
    name: 'Verbose phrases',
    description: 'Long-winded expressions with shorter, equivalent alternatives',
    detect(text) {
      const found = VERBOSE_PATTERNS.filter(({ pattern }) => {
        const r = pattern.test(text); pattern.lastIndex = 0; return r;
      });
      if (!found.length) return null;
      return {
        label: found.length + ' verbose phrase' + (found.length > 1 ? 's' : '') + ' found',
        example: found[0].label,
        savings: found.length * 2,
      };
    },
    apply(text) {
      let out = text;
      VERBOSE_PATTERNS.forEach(({ pattern, replacement }) => {
        out = out.replace(pattern, replacement); pattern.lastIndex = 0;
      });
      return out;
    },
  },
  {
    id: 'overqualify',
    category: 'Verbosity',
    name: 'Over-qualification',
    description: 'Hedging words that soften statements without changing their meaning',
    detect(text) {
      const found = OVERQUALIFY_PATTERNS.filter(({ pattern }) => {
        const r = pattern.test(text); pattern.lastIndex = 0; return r;
      });
      if (!found.length) return null;
      return {
        label: found.length + ' over-qualification phrase' + (found.length > 1 ? 's' : '') + ' found',
        example: found[0].label,
        savings: found.length * 2,
      };
    },
    apply(text) {
      let out = text;
      OVERQUALIFY_PATTERNS.forEach(({ pattern }) => {
        out = out.replace(pattern, ' '); pattern.lastIndex = 0;
      });
      return out.replace(/[ \t]{2,}/g, ' ').replace(/[ \t]+$/gm, '');
    },
  },
  {
    id: 'hedging',
    category: 'Verbosity',
    name: 'Meta-commentary',
    description: 'Phrases that announce what you\'re about to say instead of just saying it',
    detect(text) {
      const found = HEDGING_PATTERNS.filter(({ pattern }) => {
        const r = pattern.test(text); pattern.lastIndex = 0; return r;
      });
      if (!found.length) return null;
      return {
        label: found.length + ' meta-commentary phrase' + (found.length > 1 ? 's' : '') + ' found',
        example: found[0].label,
        savings: found.length * 3,
      };
    },
    apply(text) {
      let out = text;
      HEDGING_PATTERNS.forEach(({ pattern }) => {
        out = out.replace(pattern, ''); pattern.lastIndex = 0;
      });
      return out.replace(/[ \t]{2,}/g, ' ').replace(/[ \t]+$/gm, '');
    },
  },
  {
    id: 'repetition',
    category: 'Redundancy',
    name: 'Repeated sentences',
    description: 'Sentences that appear more than once — the model only needs to see them once',
    detect(text) {
      const sentences = text.match(/[^.!?\n]{25,}[.!?]/g) || [];
      const seen = new Set();
      const dupes = [];
      sentences.forEach(s => {
        const key = s.trim().toLowerCase().replace(/\s+/g, ' ');
        if (seen.has(key)) dupes.push(s);
        else seen.add(key);
      });
      if (!dupes.length) return null;
      const savings = dupes.reduce((acc, s) => acc + Math.ceil(s.split(/\s+/).length * 0.75), 0);
      return {
        label: dupes.length + ' repeated sentence' + (dupes.length > 1 ? 's' : '') + ' found',
        example: null,
        savings,
      };
    },
    apply(text) {
      const sentences = text.match(/[^.!?\n]{25,}[.!?]\s*/g) || [];
      const seen = new Set();
      let out = text;
      sentences.forEach(s => {
        const key = s.trim().toLowerCase().replace(/\s+/g, ' ');
        if (seen.has(key)) {
          out = out.replace(s, '');
        } else {
          seen.add(key);
        }
      });
      return out.replace(/\n{3,}/g, '\n\n').trim();
    },
  },
  {
    id: 'whitespace',
    category: 'Whitespace',
    name: 'Redundant whitespace',
    description: 'Multiple blank lines, trailing spaces, and consecutive spaces each cost tokens',
    detect(text) {
      const hasMultiNewlines  = /\n{3,}/.test(text);
      const hasMultiSpaces    = /[ \t]{2,}/.test(text);
      const hasTrailingSpaces = /[ \t]+$/m.test(text);
      if (!hasMultiNewlines && !hasMultiSpaces && !hasTrailingSpaces) return null;
      const issues = [
        hasMultiNewlines  && 'multiple blank lines',
        hasMultiSpaces    && 'consecutive spaces',
        hasTrailingSpaces && 'trailing whitespace',
      ].filter(Boolean);
      return {
        label: 'Redundant whitespace detected',
        example: issues.join(', '),
        savings: 2,
      };
    },
    apply(text) {
      return text
        .replace(/[ \t]{2,}/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/[ \t]+$/gm, '')
        .trim();
    },
  },
];

let previousText = null;  // one-level undo

function initSuggestions() {
  document.getElementById('clean-btn').addEventListener('click', handleApplyOrUndo);
  document.getElementById('select-all-btn').addEventListener('click', toggleSelectAll);
}

function toggleSelectAll() {
  const checkboxes = [...document.querySelectorAll('.technique-cb')];
  const allChecked = checkboxes.every(cb => cb.checked);
  checkboxes.forEach(cb => { cb.checked = !allChecked; });
  refreshApplyButton();
}

function refreshApplyButton() {
  const btn = document.getElementById('clean-btn');
  if (btn.textContent.startsWith('↩')) return;  // undo mode — don't overwrite

  const checked = [...document.querySelectorAll('.technique-cb:checked')];
  const total = checked.reduce((acc, cb) => {
    const match = cb.closest('label').querySelector('.technique-savings').textContent.match(/~(\d+)/);
    return acc + (match ? parseInt(match[1]) : 0);
  }, 0);

  document.getElementById('clean-savings-text').textContent =
    total > 0 ? 'saves ~' + total + ' token' + (total !== 1 ? 's' : '') : '';

  btn.textContent = checked.length > 0 ? '✨ Apply (' + checked.length + ' selected)' : '✨ Apply selected';
  btn.disabled = checked.length === 0;
}

function updateSuggestions(text) {
  const panel      = document.getElementById('suggestions-panel');
  const badge      = document.getElementById('tips-count-badge');
  const list       = document.getElementById('input-tips-list');
  const actionRow  = document.getElementById('clean-row');
  const cleanBtn   = document.getElementById('clean-btn');

  const detected = TECHNIQUES
    .map(t => { const r = t.detect(text); return r ? { t, r } : null; })
    .filter(Boolean);

  badge.textContent = detected.length + (detected.length === 1 ? ' issue found' : ' issues found');
  panel.classList.remove('hidden');

  if (detected.length === 0) {
    list.innerHTML = '<p class="subtitle" style="padding:8px 0 4px;">✅ No obvious verbosity detected — prompt looks clean.</p>';
    actionRow.style.display = 'none';
    return;
  }

  list.innerHTML = detected.map(({ t, r }) => `
    <label class="technique-item">
      <input type="checkbox" class="technique-cb" data-id="${t.id}" checked>
      <div class="technique-body">
        <div class="technique-label">
          ${escapeHtml(r.label)}${r.example ? ' <span class="technique-example">(' + escapeHtml(r.example) + ')</span>' : ''}
        </div>
        <div class="technique-meta">
          <span class="technique-category">${escapeHtml(t.category)}</span>
          <span class="technique-savings">↓ ~${r.savings} token${r.savings !== 1 ? 's' : ''}</span>
        </div>
      </div>
    </label>
  `).join('');

  list.querySelectorAll('.technique-cb').forEach(cb => {
    cb.addEventListener('change', refreshApplyButton);
  });

  actionRow.style.display = 'flex';

  if (previousText === null) {
    cleanBtn.textContent = '';  // will be set by refreshApplyButton
    cleanBtn.disabled = false;
  }

  refreshApplyButton();
}

function handleApplyOrUndo() {
  const btn   = document.getElementById('clean-btn');
  const input = document.getElementById('token-input');

  if (previousText !== null) {
    // Undo
    input.value = previousText;
    previousText = null;
    btn.textContent = '✨ Apply selected';
    btn.disabled = false;
    updateTokenCount();
    return;
  }

  // Collect selected technique IDs
  const checkedIds = new Set(
    [...document.querySelectorAll('.technique-cb:checked')].map(cb => cb.dataset.id)
  );
  if (checkedIds.size === 0) return;

  previousText = input.value;

  // Apply in logical order (verbosity first, whitespace normalisation last)
  let text = input.value;
  ['filler', 'verbose', 'overqualify', 'hedging', 'repetition', 'whitespace'].forEach(id => {
    if (checkedIds.has(id)) {
      const tech = TECHNIQUES.find(t => t.id === id);
      if (tech) text = tech.apply(text);
    }
  });

  // Final whitespace normalisation pass
  text = text.replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

  input.value = text;
  btn.textContent = '↩ Undo';
  updateTokenCount();
}

// ── UTILS ──────────────────────────────────────────────────────────────────

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeAttr(str) {
  return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function copyToClipboard(text, btn) {
  if (!navigator.clipboard) {
    btn.textContent = 'Not supported';
    return;
  }
  navigator.clipboard.writeText(text).then(() => {
    const original = btn.textContent;
    btn.textContent = 'Copied ✓';
    setTimeout(() => { btn.textContent = original; }, 2000);
  });
}

// ── JSON TREE RENDERER ─────────────────────────────────────────────────────

/**
 * Entry point — renders a parsed JS value as a collapsible HTML tree.
 */
function renderJsonTree(value) {
  return '<div class="jt-root">' + renderTreeNode(null, value, true) + '</div>';
}

/**
 * Render a single node (key-value pair or array item).
 * key:    string key name, or null for root/array items
 * value:  any JS value
 * isLast: true if no trailing comma needed
 */
function renderTreeNode(key, value, isLast) {
  const keyHtml = key !== null
    ? '<span class="jk">' + escapeHtml(JSON.stringify(key)) + '</span><span class="jt-p">: </span>'
    : '';
  const comma = isLast ? '' : '<span class="jt-p">,</span>';

  // Leaf (primitive) — single line
  if (value === null || typeof value !== 'object') {
    return '<div class="jt-line">' + keyHtml + renderPrimitive(value) + comma + '</div>';
  }

  const isArr = Array.isArray(value);
  const entries = isArr ? value : Object.keys(value);
  const count = entries.length;
  const ob = isArr ? '[' : '{';
  const cb = isArr ? ']' : '}';

  // Empty object / array — single line
  if (count === 0) {
    return '<div class="jt-line">' + keyHtml + '<span class="jt-p">' + ob + cb + '</span>' + comma + '</div>';
  }

  const summary = isArr
    ? '[… ' + count + ' item' + (count !== 1 ? 's' : '') + ']'
    : '{… ' + count + ' key' + (count !== 1 ? 's' : '') + '}';

  const children = isArr
    ? value.map((v, i) => renderTreeNode(null, v, i === count - 1)).join('')
    : Object.keys(value).map((k, i) => renderTreeNode(k, value[k], i === count - 1)).join('');

  return (
    '<div class="jt-collapsible">' +
      '<div class="jt-open-line">' +
        '<button class="jt-toggle" title="Collapse">−</button>' +
        keyHtml +
        '<span class="jt-p">' + ob + '</span>' +
        '<span class="jt-summary">' + escapeHtml(summary) + comma + '</span>' +
      '</div>' +
      '<div class="jt-children">' + children + '</div>' +
      '<div class="jt-close-line"><span class="jt-p">' + cb + '</span>' + comma + '</div>' +
    '</div>'
  );
}

function renderPrimitive(value) {
  if (value === null)            return '<span class="jb">null</span>';
  if (typeof value === 'boolean') return '<span class="jb">' + value + '</span>';
  if (typeof value === 'number')  return '<span class="jn">' + escapeHtml(String(value)) + '</span>';
  if (typeof value === 'string')  return '<span class="js">' + escapeHtml(JSON.stringify(value)) + '</span>';
  return escapeHtml(String(value));
}

// ── JSON PRETTIFIER ────────────────────────────────────────────────────────

const JSON_ACTION_BTNS = ['json-format-btn', 'json-minify-btn', 'json-validate-btn'];

function setActiveJsonBtn(activeId) {
  JSON_ACTION_BTNS.forEach(id => {
    document.getElementById(id).classList.toggle('json-active', id === activeId);
  });
}

function initJsonPrettifier() {
  document.getElementById('json-format-btn').addEventListener('click', jsonFormat);
  document.getElementById('json-minify-btn').addEventListener('click', jsonMinify);
  document.getElementById('json-validate-btn').addEventListener('click', jsonValidate);
  document.getElementById('json-copy-btn').addEventListener('click', jsonCopy);

  // Auto-format when JSON is pasted into the input
  document.getElementById('json-input').addEventListener('paste', () => {
    setTimeout(() => {
      if (document.getElementById('json-input').value.trim()) {
        jsonFormat();
      }
    }, 10);
  });

  // Toggle collapse/expand on tree nodes (event delegation)
  document.getElementById('json-output').addEventListener('click', e => {
    const btn = e.target.closest('.jt-toggle');
    if (!btn) return;
    const node = btn.closest('.jt-collapsible');
    if (!node) return;
    const folded = node.classList.toggle('folded');
    btn.textContent = folded ? '+' : '−';
    btn.title = folded ? 'Expand' : 'Collapse';
  });
}

function getJsonInput() {
  return document.getElementById('json-input').value;
}

function setJsonOutput(html, isError = false) {
  const out = document.getElementById('json-output');
  out.innerHTML = isError ? escapeHtml(html) : html;
  out.classList.toggle('error', isError);
  out.classList.remove('json-empty', 'jt-mode');
}

function parseJsonSafely(text) {
  try {
    return { value: JSON.parse(text), error: null };
  } catch (err) {
    const msg = err.message;
    // Try to extract position info from the error message
    const posMatch = msg.match(/position (\d+)/i) || msg.match(/at (\d+)/i);
    if (posMatch) {
      const pos = parseInt(posMatch[1], 10);
      const before = text.substring(0, pos);
      const line = (before.match(/\n/g) || []).length + 1;
      const col = pos - before.lastIndexOf('\n');
      return { value: null, error: `${msg}\n\nLine ${line}, column ${col}` };
    }
    return { value: null, error: msg };
  }
}

function jsonFormat() {
  setActiveJsonBtn('json-format-btn');
  const text = getJsonInput().trim();
  if (!text) return setJsonOutput('');

  const { value, error } = parseJsonSafely(text);
  if (error) {
    setJsonOutput('❌ Invalid JSON\n\n' + error, true);
    return;
  }

  const out = document.getElementById('json-output');
  out.innerHTML = renderJsonTree(value);
  out.classList.remove('error', 'json-empty');
  out.classList.add('jt-mode');
}

function jsonMinify() {
  setActiveJsonBtn('json-minify-btn');
  const text = getJsonInput().trim();
  if (!text) return setJsonOutput('');

  const { value, error } = parseJsonSafely(text);
  if (error) {
    setJsonOutput('❌ Invalid JSON\n\n' + error, true);
    return;
  }

  setJsonOutput(escapeHtml(JSON.stringify(value)));
}

function jsonValidate() {
  setActiveJsonBtn('json-validate-btn');
  const text = getJsonInput().trim();
  if (!text) return setJsonOutput('');

  const { value, error } = parseJsonSafely(text);
  if (error) {
    setJsonOutput('❌ Invalid JSON\n\n' + error, true);
  } else {
    const keys = countJsonKeys(value);
    setJsonOutput(`✅ Valid JSON\n\n${keys} key${keys !== 1 ? 's' : ''} · ${text.length.toLocaleString()} chars`);
  }
}

function countJsonKeys(obj) {
  if (typeof obj !== 'object' || obj === null) return 0;
  if (Array.isArray(obj)) {
    // Arrays have no keys — only recurse into elements
    return obj.reduce((acc, v) => acc + countJsonKeys(v), 0);
  }
  let count = Object.keys(obj).length;
  for (const v of Object.values(obj)) count += countJsonKeys(v);
  return count;
}

function jsonCopy() {
  const out = document.getElementById('json-output');
  const btn = document.getElementById('json-copy-btn');

  // In tree mode, copy clean formatted JSON rather than DOM text
  if (out.classList.contains('jt-mode')) {
    const text = getJsonInput().trim();
    if (!text) return;
    const { value, error } = parseJsonSafely(text);
    if (error) return;
    copyToClipboard(JSON.stringify(value, null, 2), btn);
    return;
  }

  const text = out.innerText || out.textContent;
  if (!text.trim()) return;
  copyToClipboard(text, btn);
}

/**
 * Syntax-highlight a JSON string by wrapping tokens in <span> tags.
 * Works on the output of JSON.stringify(), which is always valid.
 */
function syntaxHighlight(json) {
  // Escape HTML first, then wrap tokens
  const escaped = escapeHtml(json);
  return escaped.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
    match => {
      let cls = 'jn'; // number
      if (/^"/.test(match)) {
        cls = /:$/.test(match) ? 'jk' : 'js'; // key or string
      } else if (/true|false|null/.test(match)) {
        cls = 'jb';
      }
      return `<span class="${cls}">${match}</span>`;
    }
  );
}
