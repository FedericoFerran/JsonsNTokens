/* ============================================================
   JsonsNTokens — markdown-editor.js
   Live Markdown editor: split-pane source + rendered preview,
   formatting toolbar, view modes, upload/download, doc stats.
   ============================================================ */

'use strict';

let mdRenderTimer = null;
let mdTokenTimer = null;
let mdTokenRunId = 0;
let mdSyncingScroll = false; // guard against scroll-sync feedback loops

function initMarkdownEditor() {
  const input = document.getElementById('md-input');
  if (!input) return;

  // Configure marked once (GitHub-flavored: line breaks + GFM tables/tasklists).
  if (window.marked && typeof marked.setOptions === 'function') {
    marked.setOptions({ gfm: true, breaks: true });
  }

  input.addEventListener('input', scheduleMarkdownRender);

  // Formatting toolbar (event delegation).
  document.querySelector('.md-format-bar').addEventListener('click', e => {
    const btn = e.target.closest('.md-fmt');
    if (!btn) return;
    applyMarkdownFormat(btn.dataset.fmt);
  });

  // Keyboard shortcuts inside the textarea.
  input.addEventListener('keydown', e => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    const key = e.key.toLowerCase();
    const map = { b: 'bold', i: 'italic', k: 'link' };
    if (map[key]) {
      e.preventDefault();
      applyMarkdownFormat(map[key]);
    }
  });

  // View modes.
  document.getElementById('md-view-split').addEventListener('click', () => setMarkdownView('split'));
  document.getElementById('md-view-editor').addEventListener('click', () => setMarkdownView('editor'));
  document.getElementById('md-view-preview').addEventListener('click', () => setMarkdownView('preview'));
  document.getElementById('md-fullscreen-btn').addEventListener('click', toggleMarkdownFullscreen);

  // File actions.
  document.getElementById('md-upload-btn').addEventListener('click', () => document.getElementById('md-file').click());
  document.getElementById('md-file').addEventListener('change', handleMarkdownUpload);
  document.getElementById('md-download-btn').addEventListener('click', downloadMarkdown);
  document.getElementById('md-copy-btn').addEventListener('click', e => {
    copyToClipboard(input.value, e.currentTarget);
  });
  document.getElementById('md-clear-btn').addEventListener('click', clearMarkdown);

  // Proportional scroll sync between the two panes.
  input.addEventListener('scroll', () => syncMarkdownScroll('input'));
  document.getElementById('md-preview').addEventListener('scroll', () => syncMarkdownScroll('preview'));

  renderMarkdown();
}

function scheduleMarkdownRender() {
  clearTimeout(mdRenderTimer);
  mdRenderTimer = setTimeout(renderMarkdown, 120);
}

function renderMarkdown() {
  const text = document.getElementById('md-input').value;
  const preview = document.getElementById('md-preview');

  if (!text.trim()) {
    preview.innerHTML = '';
    preview.classList.add('md-empty');
  } else if (window.marked && window.DOMPurify) {
    // Parse then sanitize — never inject raw marked output.
    preview.innerHTML = DOMPurify.sanitize(marked.parse(text));
    preview.classList.remove('md-empty');
  } else {
    preview.textContent = text; // libraries still loading
    preview.classList.remove('md-empty');
  }

  updateMarkdownStats(text);
}

// ── STATS ──────────────────────────────────────────────────────────────────

function updateMarkdownStats(text) {
  const words = (text.trim().match(/\S+/g) || []).length;
  const chars = text.length;
  const lines = text ? text.split('\n').length : 0;
  const minutes = Math.max(1, Math.round(words / 200)); // ~200 wpm

  document.getElementById('md-stat-words').textContent = words.toLocaleString() + ' words';
  document.getElementById('md-stat-chars').textContent = chars.toLocaleString() + ' chars';
  document.getElementById('md-stat-lines').textContent = lines.toLocaleString() + ' lines';
  document.getElementById('md-stat-reading').textContent =
    words === 0 ? '0 min read' : '~' + minutes + ' min read';

  updateMarkdownTokens(text);
}

// Reuse the site tokenizer + the model chosen in the Token Counter tab.
function updateMarkdownTokens(text) {
  const badge = document.getElementById('md-stat-tokens');
  if (typeof countTokens !== 'function' || typeof getSelectedModel !== 'function') return;
  if (!text.trim()) {
    badge.textContent = '⚡ 0 tokens';
    return;
  }
  clearTimeout(mdTokenTimer);
  const runId = ++mdTokenRunId;
  mdTokenTimer = setTimeout(async () => {
    const model = getSelectedModel();
    const { count, method } = await countTokens(text, model);
    if (runId !== mdTokenRunId) return; // stale
    badge.textContent = '⚡ ' + count.toLocaleString() + ' tokens' + (method === 'approximate' ? ' (est.)' : '');
    badge.title = 'Token count for ' + model.label + ' (from Token Counter model)';
  }, 200);
}

// ── FORMATTING ─────────────────────────────────────────────────────────────

function applyMarkdownFormat(fmt) {
  const ta = document.getElementById('md-input');
  const { selectionStart: start, selectionEnd: end, value } = ta;
  const selected = value.slice(start, end);

  const wrap = (before, after = before) =>
    setMarkdownSelection(ta, value.slice(0, start) + before + selected + after + value.slice(end),
      start + before.length, end + before.length);

  const linePrefix = prefix => {
    const lineStart = value.lastIndexOf('\n', start - 1) + 1;
    const block = value.slice(lineStart, end);
    const replaced = block.split('\n').map(l => prefix + l).join('\n');
    setMarkdownSelection(ta, value.slice(0, lineStart) + replaced + value.slice(end),
      lineStart, lineStart + replaced.length);
  };

  const insert = snippet =>
    setMarkdownSelection(ta, value.slice(0, start) + snippet + value.slice(end),
      start + snippet.length, start + snippet.length);

  switch (fmt) {
    case 'bold':      return wrap('**');
    case 'italic':    return wrap('*');
    case 'strike':    return wrap('~~');
    case 'code':      return wrap('`');
    case 'h1':        return linePrefix('# ');
    case 'h2':        return linePrefix('## ');
    case 'h3':        return linePrefix('### ');
    case 'ul':        return linePrefix('- ');
    case 'ol':        return linePrefix('1. ');
    case 'task':      return linePrefix('- [ ] ');
    case 'quote':     return linePrefix('> ');
    case 'link':      return wrapLink(ta, value, start, end, selected);
    case 'codeblock': return wrap('```\n', '\n```');
    case 'hr':        return insert('\n\n---\n\n');
    case 'table':     return insert(
      '\n| Column A | Column B |\n| --- | --- |\n| Cell 1 | Cell 2 |\n| Cell 3 | Cell 4 |\n');
  }
}

function wrapLink(ta, value, start, end, selected) {
  const label = selected || 'text';
  const snippet = '[' + label + '](url)';
  setMarkdownSelection(ta, value.slice(0, start) + snippet + value.slice(end),
    start + snippet.length - 4, start + snippet.length - 1); // select "url"
}

function setMarkdownSelection(ta, newValue, selStart, selEnd) {
  ta.value = newValue;
  ta.focus();
  ta.setSelectionRange(selStart, selEnd);
  renderMarkdown();
}

// ── VIEW MODES ─────────────────────────────────────────────────────────────

function setMarkdownView(mode) {
  const editor = document.getElementById('md-editor');
  editor.classList.remove('md-split', 'md-editor-only', 'md-preview-only');
  editor.classList.add(mode === 'editor' ? 'md-editor-only' : mode === 'preview' ? 'md-preview-only' : 'md-split');
  const active = { split: 'md-view-split', editor: 'md-view-editor', preview: 'md-view-preview' }[mode];
  document.querySelectorAll('.md-view-btn').forEach(b => b.classList.toggle('md-active', b.id === active));
}

function toggleMarkdownFullscreen() {
  const on = document.getElementById('md-editor').classList.toggle('md-fullscreen');
  document.body.classList.toggle('md-fullscreen-lock', on);
  document.getElementById('md-fullscreen-btn').classList.toggle('md-active', on);
}

// ── FILE I/O ───────────────────────────────────────────────────────────────

function handleMarkdownUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    document.getElementById('md-input').value = reader.result;
    renderMarkdown();
  };
  reader.readAsText(file);
  e.target.value = ''; // allow re-uploading the same file
}

function downloadMarkdown() {
  const text = document.getElementById('md-input').value;
  if (!text.trim()) return;
  const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'document.md';
  a.click();
  URL.revokeObjectURL(url);
}

function clearMarkdown() {
  document.getElementById('md-input').value = '';
  renderMarkdown();
  document.getElementById('md-input').focus();
}

// ── SCROLL SYNC ────────────────────────────────────────────────────────────

function syncMarkdownScroll(source) {
  if (mdSyncingScroll) return;
  const input = document.getElementById('md-input');
  const preview = document.getElementById('md-preview');
  const from = source === 'input' ? input : preview;
  const to = source === 'input' ? preview : input;
  const range = from.scrollHeight - from.clientHeight;
  if (range <= 0) return;
  mdSyncingScroll = true;
  to.scrollTop = (from.scrollTop / range) * (to.scrollHeight - to.clientHeight);
  requestAnimationFrame(() => { mdSyncingScroll = false; });
}
