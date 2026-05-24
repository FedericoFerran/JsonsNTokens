/* ============================================================
   JsonsNTokens — optimizer.js
   Token reduction: phrase lists, TECHNIQUES, helpers, suggestion UI
   ============================================================ */

'use strict';

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

// ── PROFITABILITY THRESHOLD ────────────────────────────────────────────────
//
// Minimum real token savings a technique must produce to appear in suggestions.
// Techniques measured below this value are suppressed — they would not improve
// (or may worsen) the token count after accounting for metadata overhead.
//
// This constant is intentionally module-level so compression profiles (Phase 10)
// can override it without touching technique logic.
//
const PROFITABILITY_THRESHOLD = 1;

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
      // Find all sentence positions in the original string.
      // Using exec() gives us the match index, which string.replace() does not.
      const re = /[^.!?\n]{25,}[.!?]\s*/g;
      const seen = new Map(); // canonical key → index of first occurrence start
      const toRemove = []; // array of { start, end } ranges to excise

      let m;
      while ((m = re.exec(text)) !== null) {
        const raw = m[0];
        const key = raw.trim().toLowerCase().replace(/\s+/g, ' ');
        if (seen.has(key)) {
          // This is a duplicate — mark its range for removal
          toRemove.push({ start: m.index, end: m.index + raw.length });
        } else {
          seen.set(key, m.index);
        }
      }

      if (!toRemove.length) return text;

      // Reconstruct the string by keeping only non-removed character ranges.
      // Sort ascending by start position to allow a single linear pass.
      toRemove.sort((a, b) => a.start - b.start);
      let out = '';
      let cursor = 0;
      for (const { start, end } of toRemove) {
        if (cursor < start) out += text.slice(cursor, start);
        cursor = end;
      }
      out += text.slice(cursor);

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
  {
    id: 'linebreaks',
    category: 'Structure',
    name: 'Line breaks',
    description: 'Each newline is a token. Collapsing to a single line removes all of them.',
    detect(text) {
      const count = (text.match(/\n/g) || []).length;
      if (count < 5) return null;
      return {
        label: count + ' line break' + (count !== 1 ? 's' : '') + ' found',
        example: null,
        savings: count,
      };
    },
    apply(text) {
      return text.replace(/\r?\n/g, ' ').replace(/[ \t]{2,}/g, ' ').trim();
    },
  },
  {
    id: 'json-keys',
    category: 'Structure',
    name: 'Repeated JSON keys',
    description: 'Keys appearing 3+ times (common in arrays) can be abbreviated. Output is a JSON envelope: __key_map holds the abbreviation dictionary, __data holds the optimized payload.',
    detect(text) {
      const { obj, isJson } = tryParseJson(text);
      if (!isJson) return null;
      const candidates = findRepeatableKeysInObj(obj);
      if (!candidates.length) return null;

      // Build abbreviation mapping with proper collision tracking — mirrors apply()
      // so that gross savings reflects actual abbreviation lengths, not optimistic estimates.
      const allKeys = collectJsonKeys(obj);
      const candidateSet = new Set(candidates.map(c => c.key));
      const usedAbbrs = new Set();
      for (const key of allKeys.keys()) {
        if (!candidateSet.has(key)) usedAbbrs.add(key);
      }
      const sorted = [...candidates].sort((a, b) => b.key.length - a.key.length);
      const abbrs = new Map();
      const keyMapObj = {};
      sorted.forEach(({ key }) => {
        const abbr = abbreviateKey(key, usedAbbrs);
        usedAbbrs.add(abbr);
        abbrs.set(key, abbr);
        keyMapObj[abbr] = key;
      });

      // Gross savings: character delta per key × occurrences → approximate tokens.
      // Uses 4 chars/token as a model-agnostic approximation (detect is synchronous).
      const CHARS_PER_TOKEN = 4;
      const grossSavings = candidates.reduce((acc, { key, count }) => {
        const abbr = abbrs.get(key);
        return acc + Math.floor((key.length - abbr.length) * count / CHARS_PER_TOKEN);
      }, 0);

      // Envelope overhead: approximate token cost of {"__key_map":{...},"__data":...}.
      // Serialize the key_map portion and add the wrapper skeleton (~11 chars for ,"__data":}).
      const keyMapJson = JSON.stringify({ __key_map: keyMapObj });
      const envelopeCost = Math.ceil((keyMapJson.length + 11) / CHARS_PER_TOKEN);

      // Net savings may be zero — Math.max(0,...) is honest; Phase 7 gates on this value.
      const netSavings = Math.max(0, grossSavings - envelopeCost);

      return {
        label: candidates.length + ' repeated key' + (candidates.length > 1 ? 's' : '') + ' found',
        example: candidates[0].key + ' ×' + candidates[0].count,
        savings: netSavings,
        metadataCost: envelopeCost,  // exposed for Phase 7 profitability gating
      };
    },
    apply(text) {
      const { obj, isJson } = tryParseJson(text);
      if (!isJson) return text;

      const candidates = findRepeatableKeysInObj(obj);
      if (!candidates.length) return text;

      // Pre-seed usedAbbrs with all keys that will NOT be renamed, to prevent collisions
      const allKeys = collectJsonKeys(obj);
      const candidateSet = new Set(candidates.map(c => c.key));
      const usedAbbrs = new Set();
      for (const key of allKeys.keys()) {
        if (!candidateSet.has(key)) usedAbbrs.add(key);
      }

      // Build key → abbreviation mapping
      // Sort longest key first to ensure deterministic collision avoidance
      const sorted = [...candidates].sort((a, b) => b.key.length - a.key.length);
      const mapping = new Map();
      sorted.forEach(({ key }) => {
        const abbr = abbreviateKey(key, usedAbbrs);
        usedAbbrs.add(abbr);
        mapping.set(key, abbr);
      });

      // Structurally rename keys — never touches values
      const renamed = renameJsonKeys(obj, mapping);

      // Wrap in a JSON-legal envelope so the entire output is valid JSON.
      // __key_map: { abbr → original } — machine-readable and reversible
      // __data:    the optimized payload (object or array)
      const keyMapObj = {};
      for (const [key, abbr] of mapping.entries()) keyMapObj[abbr] = key;
      const envelope = { __key_map: keyMapObj, __data: renamed };
      return assertValidJson(JSON.stringify(envelope), text, 'json-keys');
    },
  },
];

// ── Key abbreviation helpers ───────────────────────────────────────────────

/**
 * Attempt to parse text as JSON.
 * Returns { obj, isJson: true } on success, { obj: null, isJson: false } on failure.
 */
function tryParseJson(text) {
  try {
    return { obj: JSON.parse(text), isJson: true };
  } catch {
    return { obj: null, isJson: false };
  }
}

/**
 * Post-transform validation guard for JSON optimization passes.
 *
 * Every JSON technique apply() should call this before returning its result.
 * If the serialized output fails to parse, the original input is returned
 * unchanged and a warning is logged — corrupt output is never surfaced.
 *
 * Usage:
 *   return assertValidJson(JSON.stringify(result), originalText, 'technique-id');
 *
 * @param {string} output      - The serialized transformation result to validate.
 * @param {string} original    - The original input text to fall back to on failure.
 * @param {string} label       - Technique identifier for the warning message.
 * @returns {string}           - output if valid, original if not.
 */
function assertValidJson(output, original, label) {
  if (!tryParseJson(output).isJson) {
    console.warn('[optimizer:' + label + '] post-transform validation failed — returning original input');
    return original;
  }
  return output;
}

/**
 * Recursively collect all object key names from a parsed JSON value.
 * Returns a Map of key → occurrence count.
 * Only counts multi-segment keys (snake_case or camelCase).
 */
function collectJsonKeys(value, counts = new Map()) {
  if (value === null || typeof value !== 'object') return counts;
  if (Array.isArray(value)) {
    for (const item of value) collectJsonKeys(item, counts);
    return counts;
  }
  for (const key of Object.keys(value)) {
    // Only care about multi-segment keys (has _ or camelCase transition)
    if (/_/.test(key) || /[A-Z]/.test(key)) {
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    collectJsonKeys(value[key], counts);
  }
  return counts;
}

/**
 * Find snake_case or camelCase JSON keys that appear 3+ times.
 * Accepts a parsed JSON object. Returns array of { key, count } sorted by count descending.
 */
function findRepeatableKeysInObj(obj) {
  const counts = collectJsonKeys(obj);
  return [...counts.entries()]
    .filter(([, c]) => c >= 3)
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Recursively rename all object keys according to the mapping.
 * Never touches values — only key names.
 * Returns a new object; does not mutate the input.
 */
function renameJsonKeys(value, mapping) {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value.map(item => renameJsonKeys(item, mapping));
  }
  const result = {};
  for (const [key, val] of Object.entries(value)) {
    const renamedKey = mapping.has(key) ? mapping.get(key) : key;
    result[renamedKey] = renameJsonKeys(val, mapping);
  }
  return result;
}

/**
 * Generate a short unique abbreviation for a key.
 * Tries 2 chars per segment, then 3 if there's a collision.
 */
function abbreviateKey(key, usedAbbrs) {
  const segments = key.split('_').length > 1
    ? key.split('_')
    : key.replace(/([A-Z])/g, '_$1').toLowerCase().split('_').filter(Boolean);

  for (let len = 2; len <= 6; len++) {
    const candidate = segments.map(s => s.slice(0, len)).join('_');
    if (!usedAbbrs.has(candidate)) return candidate;
  }
  // Fallback: append index (should rarely happen)
  let i = 1;
  while (usedAbbrs.has(key.slice(0, 4) + i)) i++;
  return key.slice(0, 4) + i;
}

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
    // Match both exact "↓ N tokens" and approximate "↓ ~N tokens" formats
    const match = cb.closest('label').querySelector('.technique-savings').textContent.match(/(\d+)\s*token/);
    return acc + (match ? parseInt(match[1]) : 0);
  }, 0);

  // Total is always shown with ~ because the combined effect of multiple techniques
  // is not simply additive — interactions between passes mean the real saving may differ.
  document.getElementById('clean-savings-text').textContent =
    total > 0 ? 'saves ~' + total + ' token' + (total !== 1 ? 's' : '') : '';

  btn.textContent = checked.length > 0 ? '✨ Apply (' + checked.length + ' selected)' : '✨ Apply selected';
  btn.disabled = checked.length === 0;
}

async function updateSuggestions(text, model, beforeCount) {
  const panel      = document.getElementById('suggestions-panel');
  const badge      = document.getElementById('tips-count-badge');
  const list       = document.getElementById('input-tips-list');
  const actionRow  = document.getElementById('clean-row');
  const cleanBtn   = document.getElementById('clean-btn');

  // While in undo mode, don't re-render the list — just keep the Undo button visible
  if (previousText !== null) {
    panel.classList.remove('hidden');
    actionRow.style.display = 'flex';
    document.getElementById('clean-savings-text').textContent = '';
    return;
  }

  // Detect which techniques apply, then measure real token savings for each
  // by applying the technique to a copy and counting the result.
  const detectedRaw = TECHNIQUES
    .map(t => { const r = t.detect(text); return r ? { t, r } : null; })
    .filter(Boolean);

  const detected = await Promise.all(
    detectedRaw.map(async ({ t, r }) => {
      const applied = t.apply(text);
      const { count: afterCount, method } = await countTokens(applied, model);
      const realSavings = Math.max(0, beforeCount - afterCount);
      return { t, r: { ...r, savings: realSavings, exact: method === 'exact' } };
    })
  );

  // Filter to techniques whose real savings meet the profitability threshold.
  // Zero-savings techniques (e.g. json-keys whose envelope cost exceeds key savings)
  // are suppressed here — they would not improve, and may worsen, the token count.
  const profitable = detected.filter(({ r }) => r.savings >= PROFITABILITY_THRESHOLD);

  badge.textContent = profitable.length + (profitable.length === 1 ? ' issue found' : ' issues found');
  panel.classList.remove('hidden');

  if (detectedRaw.length === 0) {
    // Nothing matched any technique pattern at all.
    list.innerHTML = '<p class="subtitle" style="padding:8px 0 4px;">✅ No obvious verbosity detected — prompt looks clean.</p>';
    actionRow.style.display = 'none';
    return;
  }

  if (profitable.length === 0) {
    // Patterns were found but all savings are offset by overhead or measurement.
    list.innerHTML = '<p class="subtitle" style="padding:8px 0 4px;">✅ Patterns detected but savings are offset by overhead — no profitable optimizations found.</p>';
    actionRow.style.display = 'none';
    return;
  }

  list.innerHTML = profitable.map(({ t, r }) => {
    // r.savings >= PROFITABILITY_THRESHOLD here, so the zero-savings branch is unreachable.
    // Kept for defensive completeness in case threshold is later set to 0.
    const savingsLabel = r.savings === 0
      ? 'no token savings'
      : (r.exact ? `↓ ${r.savings} token${r.savings !== 1 ? 's' : ''}` : `↓ ~${r.savings} token${r.savings !== 1 ? 's' : ''}`);
    return `
    <label class="technique-item">
      <input type="checkbox" class="technique-cb" data-id="${t.id}" checked>
      <div class="technique-body">
        <div class="technique-label">
          ${escapeHtml(r.label)}${r.example ? ' <span class="technique-example">(' + escapeHtml(r.example) + ')</span>' : ''}
        </div>
        <div class="technique-meta">
          <span class="technique-category">${escapeHtml(t.category)}</span>
          <span class="technique-savings">${escapeHtml(savingsLabel)}</span>
        </div>
      </div>
    </label>`;
  }).join('');

  list.querySelectorAll('.technique-cb').forEach(cb => {
    cb.addEventListener('change', refreshApplyButton);
  });

  actionRow.style.display = 'flex';

  cleanBtn.textContent = '';  // will be set by refreshApplyButton
  cleanBtn.disabled = false;
  refreshApplyButton();
}

async function handleApplyOrUndo() {
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

  // Disable immediately to prevent double-fire during async measurement
  btn.disabled = true;

  const originalText = input.value;
  previousText = originalText;

  // Apply in logical order: verbosity → redundancy → structure → whitespace last
  let text = originalText;
  ['filler', 'verbose', 'overqualify', 'hedging', 'repetition', 'json-keys', 'linebreaks', 'whitespace'].forEach(id => {
    if (checkedIds.has(id)) {
      const tech = TECHNIQUES.find(t => t.id === id);
      if (tech) text = tech.apply(text);
    }
  });

  // Final whitespace normalisation pass (plain-text techniques only).
  // Safe for JSON technique output because JSON.stringify produces minified output
  // (no consecutive spaces, no extra newlines) making these replacements no-ops.
  // If any JSON technique is ever changed to emit pretty-printed output, this pass
  // must be made JSON-aware or skipped for JSON inputs.
  text = text.replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

  input.value = text;

  // Measure real before/after token counts to show an accurate delta on the Undo button
  const model = getSelectedModel();
  const [{ count: beforeCount }, { count: afterCount, method }] = await Promise.all([
    countTokens(originalText, model),
    countTokens(text, model),
  ]);
  const saved = beforeCount - afterCount;
  const deltaLabel = saved > 0
    ? ' (−' + saved + (method === 'approximate' ? '~' : '') + ' tokens)'
    : '';

  btn.textContent = '↩ Undo' + deltaLabel;
  btn.disabled = false;
  updateTokenCount();
}
