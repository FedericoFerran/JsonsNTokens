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
  { pattern: /for (your|our) (information|reference),?\s*/gi,       label: '"for your/our information/reference"' },
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

// ── COMPRESSION PROFILES ───────────────────────────────────────────────────
//
// Each profile lists the technique IDs it enables. Profiles are orchestration
// layers only — they contain no transformation logic of their own.
// applyProfile() checks/unchecks technique checkboxes to match the profile;
// the existing apply pipeline runs unchanged.
//
const PROFILES = {
  whitespace_only: {
    label: 'Whitespace Only',
    description: 'Collapses extra spaces and blank lines — no semantic changes',
    techniques: ['whitespace'],
  },
  text_cleanup: {
    label: 'Text Cleanup',
    description: 'Removes filler, verbose phrasing, hedging, and duplicate sentences — text only, no JSON transforms',
    techniques: ['filler', 'verbose', 'overqualify', 'hedging', 'repetition', 'whitespace'],
  },
  full_optimization: {
    label: 'Full Optimization',
    description: 'All passes — JSON key aliasing, schema extraction, and line break removal on top of text cleanup',
    techniques: ['filler', 'verbose', 'overqualify', 'hedging', 'repetition', 'json-keys', 'schema-arrays', 'linebreaks', 'whitespace'],
  },
};

// ── TECHNIQUES — each is detectable, applicable, and selectable ──
//
// TECHNIQUE CONTRACT:
//
// detect(text) → result | null
//   Returns a result object if the technique has something to suggest, null otherwise.
//   Result shape: { label, example, savings }
//   The `savings` field in detect() is used ONLY for infoOnly techniques (displayed as
//   an informational estimate). For all other techniques, savings is measured with the
//   real tokenizer in updateSuggestions() and the detect() value is discarded. Do not
//   spend effort on accurate savings estimates in detect() for non-infoOnly techniques.
//
// apply(text) → string
//   Applies the transformation and returns the result. Must never return corrupted output:
//   JSON techniques must call assertValidJson(); text techniques must be idempotent and safe.
//   For infoOnly techniques, apply() is never called — return text unchanged with a comment.
//
// infoOnly: true (optional)
//   Marks a technique as detection-only. It is shown in the UI as a non-selectable notice
//   (ℹ️ icon, no checkbox). It bypasses real savings measurement and profitability gating.
//   Its apply() is never called.
//
// ORDERING NOTE: The order of entries in this array is the UI display order only.
// The apply pipeline order is defined separately in handleApplyOrUndo — do not assume
// they match. See the comment there before adding a new technique.

const TECHNIQUES = [
  {
    id: 'filler',
    category: 'Filler',
    name: 'Filler phrases',
    description: 'Common courtesy phrases that add no information to the prompt',
    hint: 'Will remove these phrases — they carry no meaning for the model',
    detect(text) {
      const found = FILLER_PHRASES.filter(p => text.toLowerCase().includes(p.toLowerCase()));
      if (!found.length) return null;
      const savings = found.reduce((acc, p) => acc + Math.ceil(p.split(' ').length * 0.8), 0);
      const items = found.map(phrase => {
        const re = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        const count = (text.match(re) || []).length;
        return { label: `"${phrase}" ×${count}`, count };
      }).sort((a, b) => b.count - a.count);
      return {
        label: found.length + ' filler phrase' + (found.length > 1 ? 's' : '') + ' found',
        example: found[0],
        savings,
        items,
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
    preview(text) {
      const phrase = FILLER_PHRASES.find(p => text.toLowerCase().includes(p.toLowerCase()));
      if (!phrase) return null;
      const re = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const m = re.exec(text);
      if (!m) return null;
      const ctxStart = Math.max(0, m.index - 40);
      const ctxEnd   = Math.min(text.length, m.index + phrase.length + 40);
      const slice = text.slice(ctxStart, ctxEnd);
      const after = slice
        .replace(new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), '')
        .replace(/\s{2,}/g, ' ').trim();
      return {
        before: (ctxStart > 0 ? '…' : '') + slice    + (ctxEnd < text.length ? '…' : ''),
        after:  (ctxStart > 0 ? '…' : '') + after     + (ctxEnd < text.length ? '…' : ''),
      };
    },
  },
  {
    id: 'verbose',
    category: 'Verbosity',
    name: 'Verbose phrases',
    description: 'Long-winded expressions with shorter, equivalent alternatives',
    hint: 'Will replace each with a shorter equivalent — same meaning, fewer tokens',
    detect(text) {
      const found = VERBOSE_PATTERNS.filter(({ pattern }) => {
        const r = pattern.test(text); pattern.lastIndex = 0; return r;
      });
      if (!found.length) return null;
      const items = found.map(({ pattern, label }) => {
        const matches = text.match(pattern) || [];
        pattern.lastIndex = 0;
        return { label: `${label} ×${matches.length}`, count: matches.length };
      });
      return {
        label: found.length + ' verbose phrase' + (found.length > 1 ? 's' : '') + ' found',
        example: found[0].label,
        savings: found.length * 2,
        items,
      };
    },
    apply(text) {
      let out = text;
      VERBOSE_PATTERNS.forEach(({ pattern, replacement }) => {
        out = out.replace(pattern, replacement); pattern.lastIndex = 0;
      });
      return out;
    },
    preview(text) {
      const match = VERBOSE_PATTERNS.find(({ pattern }) => {
        const r = pattern.test(text); pattern.lastIndex = 0; return r;
      });
      if (!match) return null;
      const { pattern, replacement } = match;
      const m = pattern.exec(text);
      pattern.lastIndex = 0;
      if (!m) return null;
      const ctxStart = Math.max(0, m.index - 40);
      const ctxEnd   = Math.min(text.length, m.index + m[0].length + 40);
      const slice = text.slice(ctxStart, ctxEnd);
      const after = slice.replace(pattern, replacement);
      return {
        before: (ctxStart > 0 ? '…' : '') + slice + (ctxEnd < text.length ? '…' : ''),
        after:  (ctxStart > 0 ? '…' : '') + after + (ctxEnd < text.length ? '…' : ''),
      };
    },
  },
  {
    id: 'overqualify',
    category: 'Verbosity',
    name: 'Over-qualification',
    description: 'Hedging words that soften statements without changing their meaning',
    hint: 'Will remove these words — statements become more direct without losing meaning',
    detect(text) {
      const found = OVERQUALIFY_PATTERNS.filter(({ pattern }) => {
        const r = pattern.test(text); pattern.lastIndex = 0; return r;
      });
      if (!found.length) return null;
      const items = found.map(({ pattern, label }) => {
        const matches = text.match(pattern) || [];
        pattern.lastIndex = 0;
        return { label: `${label} ×${matches.length}`, count: matches.length };
      });
      return {
        label: found.length + ' over-qualification phrase' + (found.length > 1 ? 's' : '') + ' found',
        example: found[0].label,
        savings: found.length * 2,
        items,
      };
    },
    apply(text) {
      let out = text;
      OVERQUALIFY_PATTERNS.forEach(({ pattern }) => {
        out = out.replace(pattern, ' '); pattern.lastIndex = 0;
      });
      return out.replace(/[ \t]{2,}/g, ' ').replace(/[ \t]+$/gm, '');
    },
    preview(text) {
      const match = OVERQUALIFY_PATTERNS.find(({ pattern }) => {
        const r = pattern.test(text); pattern.lastIndex = 0; return r;
      });
      if (!match) return null;
      const { pattern } = match;
      const m = pattern.exec(text);
      pattern.lastIndex = 0;
      if (!m) return null;
      const ctxStart = Math.max(0, m.index - 40);
      const ctxEnd   = Math.min(text.length, m.index + m[0].length + 40);
      const slice = text.slice(ctxStart, ctxEnd);
      const after = slice.replace(pattern, ' ').replace(/\s{2,}/g, ' ').trim();
      return {
        before: (ctxStart > 0 ? '…' : '') + slice + (ctxEnd < text.length ? '…' : ''),
        after:  (ctxStart > 0 ? '…' : '') + after + (ctxEnd < text.length ? '…' : ''),
      };
    },
  },
  {
    id: 'hedging',
    category: 'Verbosity',
    name: 'Meta-commentary',
    description: 'Phrases that announce what you\'re about to say instead of just saying it',
    hint: 'Will remove these phrases — the sentence that follows stands on its own',
    detect(text) {
      const found = HEDGING_PATTERNS.filter(({ pattern }) => {
        const r = pattern.test(text); pattern.lastIndex = 0; return r;
      });
      if (!found.length) return null;
      const items = found.map(({ pattern, label }) => {
        const matches = text.match(pattern) || [];
        pattern.lastIndex = 0;
        return { label: `${label} ×${matches.length}`, count: matches.length };
      });
      return {
        label: found.length + ' meta-commentary phrase' + (found.length > 1 ? 's' : '') + ' found',
        example: found[0].label,
        savings: found.length * 3,
        items,
      };
    },
    apply(text) {
      let out = text;
      HEDGING_PATTERNS.forEach(({ pattern }) => {
        out = out.replace(pattern, ''); pattern.lastIndex = 0;
      });
      return out.replace(/[ \t]{2,}/g, ' ').replace(/[ \t]+$/gm, '');
    },
    preview(text) {
      const match = HEDGING_PATTERNS.find(({ pattern }) => {
        const r = pattern.test(text); pattern.lastIndex = 0; return r;
      });
      if (!match) return null;
      const { pattern } = match;
      const m = pattern.exec(text);
      pattern.lastIndex = 0;
      if (!m) return null;
      const ctxStart = Math.max(0, m.index - 40);
      const ctxEnd   = Math.min(text.length, m.index + m[0].length + 40);
      const slice = text.slice(ctxStart, ctxEnd);
      const after = slice.replace(pattern, '').replace(/\s{2,}/g, ' ').trim();
      return {
        before: (ctxStart > 0 ? '…' : '') + slice + (ctxEnd < text.length ? '…' : ''),
        after:  (ctxStart > 0 ? '…' : '') + after + (ctxEnd < text.length ? '…' : ''),
      };
    },
  },
  {
    id: 'repetition',
    category: 'Redundancy',
    name: 'Repeated sentences',
    description: 'Sentences that appear more than once — the model only needs to see them once',
    hint: 'Will remove the duplicate occurrence(s) — the first is kept, later copies deleted',
    detect(text) {
      if (tryParseJson(text).isJson) return null;
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
      // Group by canonical key: count = total appearances (first + duplicates)
      const snippetMap = new Map();
      dupes.forEach(s => {
        const key = s.trim().toLowerCase().replace(/\s+/g, ' ');
        snippetMap.set(key, (snippetMap.get(key) || 0) + 1);
      });
      const items = [...snippetMap.entries()].map(([key, extraCount]) => ({
        label: (key.length > 80 ? key.slice(0, 79) + '…' : key) + ' ×' + (extraCount + 1),
        count: extraCount + 1,
      })).sort((a, b) => b.count - a.count);
      return {
        label: dupes.length + ' repeated sentence' + (dupes.length > 1 ? 's' : '') + ' found',
        example: null,
        savings,
        items,
      };
    },
    apply(text) {
      if (tryParseJson(text).isJson) return text;
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
    preview(text) {
      if (tryParseJson(text).isJson) return null;
      // Find the first sentence that appears more than once
      const sentences = text.match(/[^.!?\n]{25,}[.!?]/g) || [];
      const seen = new Set();
      let dupe = null;
      for (const s of sentences) {
        const key = s.trim().toLowerCase().replace(/\s+/g, ' ');
        if (seen.has(key)) { dupe = s.trim(); break; }
        seen.add(key);
      }
      if (!dupe) return null;
      // Find the second occurrence (the one that will be removed)
      const firstIdx  = text.indexOf(dupe);
      const secondIdx = firstIdx !== -1 ? text.indexOf(dupe, firstIdx + 1) : -1;
      if (secondIdx === -1) return null;
      const ctxStart = Math.max(0, secondIdx - 15);
      const ctxEnd   = Math.min(text.length, secondIdx + dupe.length + 15);
      const slice    = text.slice(ctxStart, ctxEnd);
      const after    = slice.replace(dupe, '[removed]').replace(/\s{2,}/g, ' ').trim();
      return {
        before: (ctxStart > 0 ? '…' : '') + slice + (ctxEnd < text.length ? '…' : ''),
        after:  (ctxStart > 0 ? '…' : '') + after + (ctxEnd < text.length ? '…' : ''),
      };
    },
  },
  {
    id: 'whitespace',
    category: 'Whitespace',
    name: 'Redundant whitespace',
    description: 'Multiple blank lines, trailing spaces, and consecutive spaces each cost tokens',
    hint: 'Will collapse consecutive spaces, trim trailing spaces, and reduce runs of 3+ blank lines to one',
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
      const items = [
        hasMultiNewlines  && { label: `multiple blank lines ×${(text.match(/\n{3,}/g) || []).length}`,        count: (text.match(/\n{3,}/g) || []).length },
        hasMultiSpaces    && { label: `consecutive spaces ×${(text.match(/[ \t]{2,}/g) || []).length}`,       count: (text.match(/[ \t]{2,}/g) || []).length },
        hasTrailingSpaces && { label: `trailing whitespace ×${(text.match(/[ \t]+$/gm) || []).length} lines`, count: (text.match(/[ \t]+$/gm) || []).length },
      ].filter(Boolean);
      return {
        label: 'Redundant whitespace detected',
        example: issues.join(', '),
        savings: 2,
        items,
      };
    },
    apply(text) {
      return text
        .replace(/[ \t]{2,}/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/[ \t]+$/gm, '')
        .trim();
    },
    preview(text) {
      const m = /[ \t]{2,}|[ \t]+$|\n{3,}/.exec(text);
      if (!m) return null;
      const ctxStart = Math.max(0, m.index - 10);
      const ctxEnd   = Math.min(text.length, m.index + m[0].length + 10);
      const slice    = text.slice(ctxStart, ctxEnd);
      const visualize = s => s.replace(/ /g, '·').replace(/\t/g, '→').replace(/\n/g, '↵\n');
      const afterSlice = slice
        .replace(/[ \t]{2,}/g, ' ')
        .replace(/[ \t]+$/gm, '')
        .replace(/\n{3,}/g, '\n\n');
      return { before: visualize(slice), after: visualize(afterSlice) };
    },
  },
  {
    id: 'linebreaks',
    category: 'Structure',
    name: 'Line breaks',
    description: 'Each newline is a token. Collapsing to a single line removes all of them.',
    hint: 'Will collapse all line breaks into spaces — output becomes one continuous line',
    detect(text) {
      const count = (text.match(/\n/g) || []).length;
      if (count < 5) return null;
      return {
        label: count + ' line break' + (count !== 1 ? 's' : '') + ' found',
        example: null,
        savings: count,
        items: [{ label: `${count} line breaks → collapsed to spaces`, count }],
      };
    },
    apply(text) {
      return text.replace(/\r?\n/g, ' ').replace(/[ \t]{2,}/g, ' ').trim();
    },
    preview(text) {
      const idx = text.indexOf('\n');
      if (idx === -1) return null;
      const ctxStart = Math.max(0, idx - 30);
      const ctxEnd   = Math.min(text.length, idx + 31);
      const slice    = text.slice(ctxStart, ctxEnd);
      const visualize = s => s.replace(/ /g, '·').replace(/\n/g, '↵\n');
      const afterSlice = slice.replace(/\r?\n/g, ' ').replace(/[ \t]{2,}/g, ' ');
      return { before: visualize(slice), after: visualize(afterSlice) };
    },
  },
  {
    id: 'json-keys',
    category: 'Structure',
    name: 'Repeated JSON keys',
    description: 'Keys appearing 3+ times (common in arrays) can be abbreviated. Output is a JSON envelope: __key_map holds the abbreviation dictionary, __data holds the optimized payload.',
    hint: 'Will shorten each repeated key and prepend a lookup dictionary — output remains valid JSON',
    detect(text) {
      const { obj, isJson } = tryParseJson(text);
      if (!isJson) return null;
      const candidates = findRepeatableKeysInObj(obj);
      if (!candidates.length) return null;

      // buildKeyMapping produces the same mapping that apply() will use,
      // so the savings estimate uses the actual abbreviation lengths.
      const { mapping, keyMapObj } = buildKeyMapping(obj, candidates);

      // Gross savings: character delta per key × occurrences → approximate tokens.
      // Uses 4 chars/token as a model-agnostic approximation (detect is synchronous).
      const CHARS_PER_TOKEN = 4;
      const grossSavings = candidates.reduce((acc, { key, count }) => {
        const abbr = mapping.get(key);
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
        example: null,
        savings: netSavings,
        metadataCost: envelopeCost,
        items: candidates.map(({ key, count }) => ({
          label: `${key} ×${count} → ${mapping.get(key)}`,
          count,
        })),
      };
    },
    apply(text) {
      const { obj, isJson } = tryParseJson(text);
      if (!isJson) return text;

      const candidates = findRepeatableKeysInObj(obj);
      if (!candidates.length) return text;

      const { mapping, keyMapObj } = buildKeyMapping(obj, candidates);

      // Structurally rename keys — never touches values
      const renamed = renameJsonKeys(obj, mapping);

      // Wrap in a JSON-legal envelope so the entire output is valid JSON.
      // __key_map: { abbr → original } — machine-readable and reversible
      // __data:    the optimized payload (object or array)
      const envelope = { __key_map: keyMapObj, __data: renamed };
      return assertValidJson(JSON.stringify(envelope), text, 'json-keys');
    },
    preview(text) {
      const { obj, isJson } = tryParseJson(text);
      if (!isJson) return null;
      const candidates = findRepeatableKeysInObj(obj);
      if (!candidates.length) return null;
      const { mapping, keyMapObj } = buildKeyMapping(obj, candidates);

      // Build a synthetic mini-object from the top-2 affected keys so the preview
      // is always compact regardless of input size.
      const topKeys = candidates.slice(0, 2);
      const mini = {};
      topKeys.forEach(({ key }) => { mini[key] = '…'; });

      const before = JSON.stringify(mini, null, 2);

      const renamed = renameJsonKeys(mini, mapping);
      const miniKeyMap = {};
      topKeys.forEach(({ key }) => { miniKeyMap[mapping.get(key)] = key; });
      const envelope = { __key_map: miniKeyMap, __data: renamed };
      const after = JSON.stringify(envelope, null, 2);

      return { before, after };
    },
  },
  {
    id: 'repeated-values',
    category: 'Structure',
    name: 'Repeated values',
    description: 'String values appearing 3+ times are candidates for aliasing — value replacement is planned for a future phase.',
    infoOnly: true,  // detection only; apply() is a no-op; bypasses profitability filter
    detect(text) {
      const { obj, isJson } = tryParseJson(text);
      if (!isJson) return null;

      const counts = collectRepeatedValues(obj);
      const candidates = [...counts.entries()]
        .filter(([, c]) => c >= 3)
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count || b.value.length - a.value.length);

      if (!candidates.length) return null;

      // Estimate token savings if each candidate were aliased to a 1-char value.
      // Informational only — Phase 8 detects; transformation is Phase 9B+.
      // Serialized string: value.length + 2 (quotes). Alias: '"x"' = 3 chars.
      const CHARS_PER_TOKEN = 4;
      const estimatedSavings = candidates.reduce((acc, { value, count }) => {
        const serialized = value.length + 2;
        return acc + Math.max(0, Math.floor((serialized - 3) * (count - 1) / CHARS_PER_TOKEN));
      }, 0);

      return {
        label: candidates.length + ' repeated value' + (candidates.length !== 1 ? 's' : '') + ' found',
        example: '"' + candidates[0].value + '" ×' + candidates[0].count,
        savings: estimatedSavings,
      };
    },
    apply(text) {
      // infoOnly — no transformation. apply() should never be called because
      // infoOnly techniques are excluded from checkedIds in handleApplyOrUndo.
      return text;
    },
  },
  {
    id: 'schema-arrays',
    category: 'Structure',
    name: 'Homogeneous arrays',
    description: 'Arrays where every element shares the same key set repeat those key names once per object — schema extraction stores keys once and serializes only values per row.',
    hint: 'Will extract the shared key names into a single header — each row then stores only values, not keys',
    detect(text) {
      const { obj, isJson } = tryParseJson(text);
      if (!isJson) return null;

      // Only report arrays that apply() will actually transform: 100% uniform coverage.
      // Arrays with 80–99% coverage (outlier rows) are not yet handled.
      const candidates = findHomogeneousArrays(obj, 'root', [], 1);
      if (!candidates.length) return null;

      // Sort by savings potential: more rows × more keys = more savings.
      candidates.sort((a, b) => (b.count * b.keys.length) - (a.count * a.keys.length));
      const best = candidates[0];

      // Estimate token savings across ALL qualifying arrays (not just the best).
      // Current cost per row: each key is serialized as "key": (key.length + 3 chars).
      // After extraction: keys appear once in __schema; __rows contain only values.
      // Per array: gross savings = key overhead × (rows − 1), minus __schema cost.
      const CHARS_PER_TOKEN = 4;
      const estimatedSavings = candidates.reduce((total, c) => {
        const keyOverhead = c.keys.reduce((acc, k) => acc + k.length + 3, 0);
        const gross = Math.floor(keyOverhead * (c.count - 1) / CHARS_PER_TOKEN);
        const schemaCost = Math.ceil((keyOverhead + 15) / CHARS_PER_TOKEN);
        return total + Math.max(0, gross - schemaCost);
      }, 0);

      const label = candidates.length === 1
        ? '1 homogeneous array found'
        : candidates.length + ' homogeneous arrays found';

      const loc     = best.path === 'root' ? '' : best.path + ': ';
      const example = loc + best.count + ' objects × ' + best.keys.length + ' keys';

      return {
        label,
        example: null,
        savings: estimatedSavings,
        items: candidates.map(c => ({
          label: (c.path === 'root' ? 'root' : c.path) + ' · ' + c.count + ' rows × ' + c.keys.length + ' keys',
          count: c.count * c.keys.length,
        })),
      };
    },
    apply(text) {
      const { obj, isJson } = tryParseJson(text);
      if (!isJson) return text;
      const transformed = applySchemaExtraction(obj);
      return assertValidJson(JSON.stringify(transformed), text, 'schema-arrays');
    },
    preview(text) {
      const { obj, isJson } = tryParseJson(text);
      if (!isJson) return null;
      const candidates = findHomogeneousArrays(obj, 'root', [], 1);
      if (!candidates.length) return null;
      candidates.sort((a, b) => (b.count * b.keys.length) - (a.count * a.keys.length));
      const best = candidates[0];
      const arr = getValueAtPath(obj, best.path);
      if (!Array.isArray(arr)) return null;

      const slice = arr.slice(0, 3);
      const extraRows = arr.length > 3 ? arr.length - 3 : 0;
      const before = JSON.stringify(slice, null, 2) + (extraRows > 0 ? `\n… and ${extraRows} more row${extraRows !== 1 ? 's' : ''}` : '');
      const transformed = applySchemaExtraction(slice);
      const after = JSON.stringify(transformed, null, 2);
      return { before, after };
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
 * Build the key → abbreviation mapping for a parsed JSON object.
 *
 * Shared by json-keys detect() and apply() to guarantee they use exactly the same
 * mapping. Divergence between detect and apply would mean savings estimates are wrong.
 *
 * Algorithm:
 * 1. Pre-seed usedAbbrs with all non-candidate keys, to prevent collisions.
 * 2. Sort candidates longest-first for deterministic collision avoidance.
 * 3. Abbreviate each candidate key, add the abbreviation to usedAbbrs.
 *
 * @param {*}     obj        - Parsed JSON value (as returned by JSON.parse)
 * @param {Array} candidates - Array of { key, count } from findRepeatableKeysInObj
 * @returns {{ mapping: Map<string,string>, keyMapObj: Object }}
 *   mapping:   key → abbreviation (used by renameJsonKeys)
 *   keyMapObj: { abbreviation → original key } (used in the __key_map envelope)
 */
function buildKeyMapping(obj, candidates) {
  const allKeys = collectJsonKeys(obj);
  const candidateSet = new Set(candidates.map(c => c.key));

  // Pre-seed with non-candidate keys so abbreviations don't collide with existing keys.
  const usedAbbrs = new Set();
  for (const key of allKeys.keys()) {
    if (!candidateSet.has(key)) usedAbbrs.add(key);
  }

  // Sort longest first — ensures the longest keys get first pick of short abbreviations.
  const sorted = [...candidates].sort((a, b) => b.key.length - a.key.length);
  const mapping = new Map();
  const keyMapObj = {};
  sorted.forEach(({ key }) => {
    const abbr = abbreviateKey(key, usedAbbrs);
    usedAbbrs.add(abbr);
    mapping.set(key, abbr);
    keyMapObj[abbr] = key;
  });

  return { mapping, keyMapObj };
}

/**
 * Recursively collect all string values from a parsed JSON value.
 * Returns a Map of string_value → occurrence count.
 * Only tracks strings of length >= 3 — short strings are not candidates for aliasing.
 */
function collectRepeatedValues(value, counts = new Map()) {
  if (typeof value === 'string') {
    if (value.length >= 3) counts.set(value, (counts.get(value) || 0) + 1);
    return counts;
  }
  if (value === null || typeof value !== 'object') return counts;
  if (Array.isArray(value)) {
    for (const item of value) collectRepeatedValues(item, counts);
    return counts;
  }
  for (const val of Object.values(value)) collectRepeatedValues(val, counts);
  return counts;
}

/**
 * Find homogeneous arrays in a parsed JSON value.
 *
 * A homogeneous array is one where at least `minCoverage` fraction of its elements
 * are objects sharing the same sorted key set (schema fingerprint). Arrays with
 * fewer than 3 total elements or schemas with fewer than 2 keys are not reported.
 *
 * @param {*}      value       - Parsed JSON value to inspect
 * @param {string} path        - JSON path for display (e.g. "root", "root.items")
 * @param {Array}  results     - Accumulator for discovered arrays
 * @param {number} minCoverage - Minimum fraction [0–1] of elements that must share
 *                               the dominant key set. Pass 1 for fully uniform arrays
 *                               only (required by applySchemaExtraction). Default 0.8
 *                               is preserved for future partial-array support.
 * @returns {Array} results — each entry: { path, count, keys, coverage }
 */
function findHomogeneousArrays(value, path = 'root', results = [], minCoverage = 0.8) {
  if (value === null || typeof value !== 'object') return results;

  if (Array.isArray(value)) {
    if (value.length >= 3) {
      // Compute a key-set fingerprint for every object element.
      const fingerprints = value.map(el =>
        (el !== null && typeof el === 'object' && !Array.isArray(el))
          ? Object.keys(el).sort().join('\0')
          : null
      );

      // Find the most common fingerprint.
      const freq = new Map();
      fingerprints.forEach(fp => {
        if (fp !== null) freq.set(fp, (freq.get(fp) || 0) + 1);
      });

      if (freq.size > 0) {
        const [dominantFp, dominantCount] = [...freq.entries()]
          .sort((a, b) => b[1] - a[1])[0];
        const coverage = dominantCount / value.length;
        const keys = dominantFp.split('\0');

        if (coverage >= minCoverage && keys.length >= 2) {
          results.push({ path, count: value.length, keys, coverage: Math.round(coverage * 100) });
        }
      }
    }

    // Recurse into elements (nested arrays / objects inside arrays).
    value.forEach((el, i) => findHomogeneousArrays(el, path + '[' + i + ']', results, minCoverage));
    return results;
  }

  // Object: recurse into each property value.
  for (const [key, val] of Object.entries(value)) {
    findHomogeneousArrays(val, path === 'root' ? key : path + '.' + key, results, minCoverage);
  }
  return results;
}

/**
 * Recursively transform homogeneous arrays into schema + rows format.
 *
 * Only transforms arrays where ALL elements are objects sharing the same key set
 * (100% uniform) and the schema has ≥ 2 keys. Partial arrays (< 100% uniform)
 * are left unchanged — they require outlier handling not yet implemented.
 *
 * Output format for each qualifying array:
 *   { "__schema": ["key1", "key2", …], "__rows": [[v1, v2, …], …] }
 *
 * The format is valid JSON and machine-reversible: given __schema and __rows,
 * the original array of objects can be reconstructed exactly.
 * Nested values inside each row are recursed into, so nested homogeneous arrays
 * are also extracted.
 *
 * @param {*} value - Parsed JSON value to transform
 * @returns {*} Transformed value (new object/array — input is never mutated)
 */
function applySchemaExtraction(value) {
  if (value === null || typeof value !== 'object') return value;

  if (Array.isArray(value)) {
    // Only transform if every element is a non-array object with the same sorted key set.
    if (value.length >= 3) {
      const allObjects = value.every(
        el => el !== null && typeof el === 'object' && !Array.isArray(el)
      );
      if (allObjects) {
        const schema = Object.keys(value[0]).sort();
        const fp = schema.join('\0');
        const uniform = value.every(el => Object.keys(el).sort().join('\0') === fp);
        if (uniform && schema.length >= 2) {
          // Recurse into each cell value before assembling rows.
          const rows = value.map(el => schema.map(k => applySchemaExtraction(el[k])));
          return { __schema: schema, __rows: rows };
        }
      }
    }
    // Not transformable — recurse into elements to catch nested homogeneous arrays.
    return value.map(el => applySchemaExtraction(el));
  }

  // Object: recurse into each property value.
  const result = {};
  for (const [key, val] of Object.entries(value)) {
    result[key] = applySchemaExtraction(val);
  }
  return result;
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
  const snakeSegments = key.split('_');
  const segments = snakeSegments.length > 1
    ? snakeSegments
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

/**
 * Retrieve a nested value from a parsed JSON object by dot-separated path.
 * 'root' returns the value itself. Paths containing '[' (array indices) return null.
 */
function getValueAtPath(obj, path) {
  if (path === 'root') return obj;
  if (path.includes('[')) return null;
  return path.split('.').reduce((acc, k) => (acc && typeof acc === 'object' ? acc[k] : null), obj);
}

let previousText = null;      // one-level undo
let currentTokenCount = 0;   // token count of the current input; used to cap savings display

/**
 * Render a compact monospace list of detected items inside an expanded card.
 * Shows up to 10 items; a "show more" button reveals the rest.
 * @param {Array|undefined} items  - Array of { label, count } from detect()
 * @returns {string} HTML string, or '' if items is empty/undefined
 */
function renderTechniqueItems(items) {
  if (!items || !items.length) return '';
  const visible = items.slice(0, 10);
  const extra   = items.slice(10);
  let html = '<div class="technique-items">';
  html += visible.map(item =>
    `<div class="technique-item-entry">${escapeHtml(item.label)}</div>`
  ).join('');
  if (extra.length) {
    html += `<button class="technique-items-more" type="button">+ ${extra.length} more</button>`;
    html += extra.map(item =>
      `<div class="technique-item-entry technique-item-hidden">${escapeHtml(item.label)}</div>`
    ).join('');
  }
  html += '</div>';
  return html;
}

/**
 * Render a before/after preview pane for a technique expanded section.
 * Calls t.preview(text) — returns '' if no preview method or no match.
 * @param {Object} t     - Technique object (must have t.preview function)
 * @param {string} text  - Current user input
 * @returns {string} HTML string
 */
function renderTechniquePreview(t, text) {
  if (!t.preview) return '';
  let result;
  try { result = t.preview(text); } catch (e) { console.warn('[renderTechniquePreview ' + t.id + ']', e); return ''; }
  if (!result) return '';
  const { before, after } = result;
  return `
    <div class="technique-preview">
      <div class="technique-preview-pane">
        <div class="technique-preview-label">Before</div>
        <pre class="preview-before">${escapeHtml(before)}</pre>
      </div>
      <div class="technique-preview-pane">
        <div class="technique-preview-label">After</div>
        <pre class="preview-after">${escapeHtml(after)}</pre>
      </div>
    </div>`;
}

function initSuggestions() {
  document.getElementById('clean-btn').addEventListener('click', handleApplyOrUndo);
  document.getElementById('select-all-btn').addEventListener('click', toggleSelectAll);
  initProfileSelector();

  // ── Expand / collapse cards (delegated, registered once) ─────────────────
  // Handles .technique-toggle (expand/collapse) and .technique-items-more
  // (show hidden items). Registered once on the persistent list container so
  // re-renders via list.innerHTML do not accumulate duplicate listeners.
  document.getElementById('input-tips-list').addEventListener('click', e => {
    // "Show N more" button inside .technique-items
    const moreBtn = e.target.closest('.technique-items-more');
    if (moreBtn) {
      const container = moreBtn.closest('.technique-items');
      if (!container) return;
      container.querySelectorAll('.technique-item-hidden').forEach(el => {
        el.classList.remove('technique-item-hidden');
      });
      moreBtn.remove();
      return;
    }

    // Expand / collapse toggle
    const toggle = e.target.closest('.technique-toggle');
    if (!toggle) return;
    const card     = toggle.closest('.technique-card');
    const expanded = card.querySelector('.technique-expanded');
    if (!expanded) return;
    const opening  = expanded.hidden;
    expanded.hidden = !opening;
    toggle.setAttribute('aria-expanded', String(opening));
    toggle.textContent = opening ? '▾' : '▸';
  });
}

// Inject the profile <select> once into the suggestions panel at init time.
// It sits above #input-tips-list and persists across updateSuggestions() re-renders
// because updateSuggestions only writes to list.innerHTML, not the surrounding structure.
function initProfileSelector() {
  const section = document.getElementById('input-tips-section');
  const list    = document.getElementById('input-tips-list');

  const wrapper = document.createElement('div');
  wrapper.id = 'profile-selector-row';
  wrapper.style.cssText = 'display:flex;align-items:center;gap:8px;padding:6px 0 8px;';

  const lbl = document.createElement('label');
  lbl.htmlFor = 'profile-select';
  lbl.className = 'label';
  lbl.style.cssText = 'margin-bottom:0;white-space:nowrap;font-size:13px;';
  lbl.textContent = 'Profile:';

  const sel = document.createElement('select');
  sel.id = 'profile-select';
  sel.className = 'profile-select';
  // Only override layout/size here. Background, color, border, etc. come from the
  // global `select` CSS rule — the same rule that styles #model-select correctly in
  // both light and dark mode. Defining background/color as inline styles would
  // override that rule and make option text invisible in the native popup (the browser
  // renders the popup with a light background, so white text becomes invisible in dark mode).
  sel.style.flex = '1';

  // "Custom" sentinel — selected whenever the user overrides checkboxes manually.
  const customOpt = document.createElement('option');
  customOpt.value = '';
  customOpt.textContent = 'Custom';
  sel.appendChild(customOpt);

  for (const [id, profile] of Object.entries(PROFILES)) {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = profile.label;
    opt.title = profile.description;
    sel.appendChild(opt);
  }

  sel.addEventListener('change', () => {
    if (sel.value) applyProfile(sel.value);
  });

  wrapper.appendChild(lbl);
  wrapper.appendChild(sel);
  section.insertBefore(wrapper, list);
}

// Check/uncheck technique checkboxes to match the selected profile.
// Only affects techniques that are currently rendered (profitable ones).
// Techniques not present in the current list are silently skipped.
function applyProfile(profileId) {
  const profile = PROFILES[profileId];
  if (!profile) return;
  const techniqueSet = new Set(profile.techniques);
  document.querySelectorAll('.technique-cb').forEach(cb => {
    cb.checked = techniqueSet.has(cb.dataset.id);
  });
  refreshApplyButton();
}

function toggleSelectAll() {
  const checkboxes = [...document.querySelectorAll('.technique-cb')];
  const allChecked = checkboxes.every(cb => cb.checked);
  checkboxes.forEach(cb => { cb.checked = !allChecked; });
  // Property assignment doesn't fire change events, so reset the profile selector manually.
  const profileSel = document.getElementById('profile-select');
  if (profileSel) profileSel.value = '';
  refreshApplyButton();
}

function refreshApplyButton() {
  const btn = document.getElementById('clean-btn');
  if (btn.textContent.startsWith('↩')) return;  // undo mode — don't overwrite

  const checked = [...document.querySelectorAll('.technique-cb:checked')];
  // Read savings from data-savings attribute set at render time — not from scraped text.
  // Individual savings are measured independently on the original text, so their sum can
  // exceed the actual token count when overlapping techniques are all selected.
  // Cap at currentTokenCount to prevent displaying "saves more than you have".
  const rawTotal = checked.reduce((acc, cb) => acc + (parseInt(cb.dataset.savings) || 0), 0);
  const total = currentTokenCount > 0 ? Math.min(rawTotal, currentTokenCount) : rawTotal;

  // Total is always shown with ~ because the combined effect of multiple techniques
  // is not simply additive — interactions between passes mean the real saving may differ.
  document.getElementById('clean-savings-text').textContent =
    total > 0 ? 'saves ~' + total + ' token' + (total !== 1 ? 's' : '') : '';

  btn.textContent = checked.length > 0 ? '✨ Apply (' + checked.length + ' selected)' : '✨ Apply selected';
  btn.disabled = checked.length === 0;
}

async function updateSuggestions(text, model, beforeCount) {
  currentTokenCount = beforeCount;
  const panel      = document.getElementById('suggestions-panel');
  const badge      = document.getElementById('tips-count-badge');
  const list       = document.getElementById('input-tips-list');
  const actionRow  = document.getElementById('clean-row');
  const cleanBtn   = document.getElementById('clean-btn');

  // While in undo mode, don't re-render the list — just keep the Undo button visible.
  // Disable the profile selector: changing profiles while in undo mode would toggle
  // checkboxes without any effect, then leave the dropdown in an inconsistent state
  // once Undo restores the text and re-renders the suggestions.
  if (previousText !== null) {
    panel.classList.remove('hidden');
    actionRow.style.display = 'flex';
    document.getElementById('clean-savings-text').textContent = '';
    const profileSelUndo = document.getElementById('profile-select');
    if (profileSelUndo) profileSelUndo.disabled = true;
    return;
  }

  // Normal render path — ensure profile selector is enabled.
  const profileSel = document.getElementById('profile-select');
  if (profileSel) profileSel.disabled = false;

  // Detect which techniques apply. infoOnly techniques are excluded from the UI
  // until their corresponding transformation is implemented — showing a finding
  // the user cannot act on is confusing. The detection code is preserved for
  // future use; only the rendering is suppressed here.
  const actionableRaw = TECHNIQUES
    .filter(t => !t.infoOnly)
    .map(t => { const r = t.detect(text); return r ? { t, r } : null; })
    .filter(Boolean);

  // Measure real token savings for each actionable technique.
  const actionable = await Promise.all(
    actionableRaw.map(async ({ t, r }) => {
      const applied = t.apply(text);
      const { count: afterCount, method } = await countTokens(applied, model);
      const realSavings = Math.max(0, beforeCount - afterCount);
      return { t, r: { ...r, savings: realSavings, exact: method === 'exact' } };
    })
  );

  // Filter by the profitability threshold — techniques whose savings are offset
  // by metadata overhead (e.g. json-keys envelope cost) are suppressed.
  const profitable = actionable.filter(({ r }) => r.savings >= PROFITABILITY_THRESHOLD);

  badge.textContent = profitable.length + (profitable.length === 1 ? ' issue found' : ' issues found');
  panel.classList.remove('hidden');

  if (actionableRaw.length === 0) {
    // Nothing actionable detected.
    list.innerHTML = '<p class="subtitle" style="padding:8px 0 4px;">✅ No obvious verbosity detected — prompt looks clean.</p>';
    actionRow.style.display = 'none';
    return;
  }

  let html = '';

  if (profitable.length === 0) {
    // Either no actionable patterns detected, or all savings are offset by overhead.
    const msg = actionableRaw.length > 0
      ? '✅ Patterns detected but savings are offset by overhead — no profitable optimizations found.'
      : '✅ No profitable text optimizations found.';
    html += `<p class="subtitle" style="padding:8px 0 4px;">${msg}</p>`;
  }

  // Render selectable, actionable techniques.
  html += profitable.map(({ t, r }) => {
    // r.savings >= PROFITABILITY_THRESHOLD here, so the zero-savings branch is unreachable.
    // Kept for defensive completeness in case threshold is later set to 0.
    const savingsLabel = r.savings === 0
      ? 'no token savings'
      : (r.exact ? `↓ ${r.savings} token${r.savings !== 1 ? 's' : ''}` : `↓ ~${r.savings} token${r.savings !== 1 ? 's' : ''}`);

    const itemsHtml   = renderTechniqueItems(r.items);
    const previewHtml = renderTechniquePreview(t, text);
    const hasExpanded = itemsHtml || previewHtml;

    return `
    <div class="technique-card">
      <div class="technique-card-row">
        <label class="technique-item">
          <input type="checkbox" class="technique-cb" data-id="${t.id}" data-savings="${r.savings}" checked>
          <div class="technique-body">
            <div class="technique-label">
              ${escapeHtml(r.label)}${r.example ? ' <span class="technique-example">(' + escapeHtml(r.example) + ')</span>' : ''}
            </div>
            ${t.hint ? '<div class="technique-hint">' + escapeHtml(t.hint) + '</div>' : ''}
            <div class="technique-meta">
              <span class="technique-category">${escapeHtml(t.category)}</span>
              <span class="technique-savings">${escapeHtml(savingsLabel)}</span>
            </div>
          </div>
        </label>
        ${hasExpanded ? '<button class="technique-toggle" type="button" aria-expanded="false">▸</button>' : ''}
      </div>
      ${hasExpanded ? `<div class="technique-expanded" hidden>${itemsHtml}${previewHtml}</div>` : ''}
    </div>`;
  }).join('');

  list.innerHTML = html;

  list.querySelectorAll('.technique-cb').forEach(cb => {
    cb.addEventListener('change', () => {
      // Manual checkbox toggle → profile no longer matches any preset → reset to "Custom".
      const profileSel = document.getElementById('profile-select');
      if (profileSel) profileSel.value = '';
      refreshApplyButton();
    });
  });

  if (profitable.length > 0) {
    actionRow.style.display = 'flex';
    cleanBtn.textContent = '';  // will be set by refreshApplyButton
    cleanBtn.disabled = false;
    refreshApplyButton();
  } else {
    actionRow.style.display = 'none';
  }
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

  // Apply in logical order: verbosity → redundancy → structure → whitespace last.
  // NOTE: This order is independent of the TECHNIQUES array order — do not assume
  // that TECHNIQUES array position implies apply position. Adding a new technique
  // requires placing it in BOTH the TECHNIQUES array (for detection/UI) AND here
  // (for the apply pipeline), in the correct position for each.
  // schema-arrays runs before json-keys: schema extraction eliminates key repetition in
  // arrays first, then json-keys abbreviates any multi-segment keys still remaining.
  let text = originalText;
  ['filler', 'verbose', 'overqualify', 'hedging', 'repetition', 'schema-arrays', 'json-keys', 'linebreaks', 'whitespace'].forEach(id => {
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
