/* ============================================================
   JsonsNTokens — prices.js
   Model pricing data, model selector UI
   ============================================================ */

'use strict';

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
