/* ============================================================
   JsonsNTokens — utils.js
   Shared helpers: escapeHtml, escapeAttr, copyToClipboard
   ============================================================ */

'use strict';

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
