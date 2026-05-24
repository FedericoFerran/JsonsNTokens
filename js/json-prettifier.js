/* ============================================================
   JsonsNTokens — json-prettifier.js
   JSON tree renderer and prettifier UI
   ============================================================ */

'use strict';

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
  document.getElementById('json-clear-btn').addEventListener('click', () => {
    document.getElementById('json-input').value = '';
    const out = document.getElementById('json-output');
    out.innerHTML = '';
    out.className = 'json-output json-empty';
    JSON_ACTION_BTNS.forEach(id => document.getElementById(id).classList.remove('json-active'));
  });

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
