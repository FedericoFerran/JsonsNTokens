/* ============================================================
   JsonsNTokens — app.js
   Entry point: theme, tabs, init, token counter UI
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
  document.getElementById('tab-markdown').addEventListener('click', () => switchTab('markdown'));

  // Load everything else (prices → model selector → token counter → suggestions → JSON)
  initApp();
});

async function initApp() {
  await loadPrices();
  initTokenCounter();
  initSuggestions();
  initJsonPrettifier();
  initMarkdownEditor();
}

// ── TOKEN COUNTER UI ───────────────────────────────────────────────────────

let countDebounceTimer = null;
let comparatorRunId = 0;
let tokenDiffState = null;

function initTokenCounter() {
  const input = document.getElementById('token-input');
  const modelSelect = document.getElementById('model-select');

  document.getElementById('token-clear-btn').addEventListener('click', () => {
    input.value = '';
    previousText = null;
    resetTokenDiff();
    hideModelComparator();
    document.getElementById('result-card').classList.add('hidden');
    document.getElementById('suggestions-panel').classList.add('hidden');
  });

  input.addEventListener('input', () => {
    // If user manually edits after an Apply, discard the undo state
    if (previousText !== null) {
      previousText = null;
      resetTokenDiff();
      const cleanBtn = document.getElementById('clean-btn');
      if (cleanBtn) { cleanBtn.textContent = '✨ Apply selected'; cleanBtn.disabled = false; }
    }
    clearTimeout(countDebounceTimer);
    countDebounceTimer = setTimeout(updateTokenCount, 120);
  });

  document.getElementById('token-diff-toggle').addEventListener('click', () => toggleCollapsiblePanel('token-diff-card', 'token-diff-toggle'));
  document.getElementById('model-comparator-toggle').addEventListener('click', () => toggleCollapsiblePanel('model-comparator', 'model-comparator-toggle'));

  modelSelect.addEventListener('change', () => {
    updateTokenCount();
    rerenderTokenDiffForCurrentModel();
  });

  // Show prices note once model is selected
  document.getElementById('prices-note').style.display = 'block';
}

async function updateTokenCount() {
  const text = document.getElementById('token-input').value;
  const model = getSelectedModel();

  if (!text.trim()) {
    document.getElementById('result-card').classList.add('hidden');
    document.getElementById('suggestions-panel').classList.add('hidden');
    hideModelComparator();
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

  updateModelComparator(text);

  // Trigger suggestions update — pass model and current count so savings can be
  // measured with the real tokenizer rather than character-based estimates.
  await updateSuggestions(text, model, count);
}

function toggleCollapsiblePanel(panelId, toggleId) {
  const panel = document.getElementById(panelId);
  const toggle = document.getElementById(toggleId);
  if (!panel || !toggle) return;
  const collapsed = panel.classList.toggle('collapsed');
  toggle.textContent = collapsed ? '+' : '−';
  toggle.setAttribute('aria-expanded', String(!collapsed));
}

function hideModelComparator() {
  comparatorRunId++;
  document.getElementById('model-comparator').classList.add('hidden');
  document.getElementById('model-comparator-body').innerHTML = '';
  document.getElementById('model-comparator-count').textContent = '0 models';
}

async function updateModelComparator(text) {
  const trimmed = text.trim();
  if (!trimmed) {
    hideModelComparator();
    return;
  }

  const runId = ++comparatorRunId;
  const selectedId = getSelectedModel().id;
  const rows = await Promise.all(
    Object.entries(MODELS).map(async ([id, model]) => {
      const { count, method } = await countTokensForComparator(text, model);
      return {
        id,
        model,
        count,
        method,
        cost: calcCost(count, model.inputPer1M),
      };
    })
  );

  if (runId !== comparatorRunId) return;

  rows.sort((a, b) => a.cost - b.cost || a.count - b.count || a.model.label.localeCompare(b.model.label));

  const body = document.getElementById('model-comparator-body');
  body.innerHTML = rows.map(row => `
    <tr class="${row.id === selectedId ? 'current-model' : ''}">
      <td>${escapeHtml(row.model.label)}</td>
      <td>${escapeHtml(row.model.provider)}</td>
      <td>${row.count.toLocaleString()}</td>
      <td>${formatCost(row.cost)}</td>
      <td>${row.method === 'exact' ? 'exact' : 'estimated'}</td>
    </tr>
  `).join('');

  document.getElementById('model-comparator-count').textContent =
    rows.length + ' model' + (rows.length !== 1 ? 's' : '');
  document.getElementById('model-comparator').classList.remove('hidden');
}

async function countTokensForComparator(text, model) {
  const fallback = () => ({
    count: estimateTokensLocally(text, model),
    method: 'approximate',
  });

  if (model.tokenizer !== 'tiktoken') return await countTokens(text, model);

  return await Promise.race([
    countTokens(text, model),
    new Promise(resolve => setTimeout(() => resolve(fallback()), 1200)),
  ]);
}

function estimateTokensLocally(text, model) {
  const charsPerToken = model.charsPerToken || 4.0;
  const charBased = Math.ceil(text.length / charsPerToken);
  const wordBased = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(charBased, wordBased);
}

function resetTokenDiff() {
  tokenDiffState = null;
  document.getElementById('token-diff-card').classList.add('hidden');
}

function setTokenDiffState(originalText, optimizedText) {
  tokenDiffState = { originalText, optimizedText };
  rerenderTokenDiffForCurrentModel();
}

async function rerenderTokenDiffForCurrentModel() {
  if (!tokenDiffState) return;
  const model = getSelectedModel();
  const [{ count: beforeCount, method: beforeMethod }, { count: afterCount, method: afterMethod }] = await Promise.all([
    countTokensForComparator(tokenDiffState.originalText, model),
    countTokensForComparator(tokenDiffState.optimizedText, model),
  ]);
  updateTokenDiff({
    model,
    beforeCount,
    afterCount,
    method: beforeMethod === 'exact' && afterMethod === 'exact' ? 'exact' : 'estimated',
  });
}

function updateTokenDiff({ model, beforeCount, afterCount, method }) {
  const savedTokens = Math.max(0, beforeCount - afterCount);
  const reduction = beforeCount > 0 ? (savedTokens / beforeCount) * 100 : 0;
  const beforeCost = calcCost(beforeCount, model.inputPer1M);
  const afterCost = calcCost(afterCount, model.inputPer1M);
  const savedCost = Math.max(0, beforeCost - afterCost);

  document.getElementById('token-diff-model').textContent = model.label;
  document.getElementById('diff-before-tokens').textContent = beforeCount.toLocaleString() + ' tokens';
  document.getElementById('diff-after-tokens').textContent = afterCount.toLocaleString() + ' tokens';
  document.getElementById('diff-saved-tokens').textContent = savedTokens.toLocaleString() + ' tokens';
  document.getElementById('diff-reduction').textContent = reduction.toFixed(reduction >= 10 ? 0 : 1) + '%';
  document.getElementById('diff-before-cost').textContent = formatCost(beforeCost);
  document.getElementById('diff-after-cost').textContent = formatCost(afterCost);
  document.getElementById('diff-saved-cost').textContent = formatCost(savedCost) + ' saved';
  document.getElementById('diff-method').textContent = method === 'exact' ? 'exact token count' : 'estimated token count';
  document.getElementById('token-diff-card').classList.remove('hidden');
}
