# Suggestion UX — Expand Cards with Full Item List + Before/After Preview

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Inline-expand each suggestion card to show the full list of detected items and a live before/after preview of the technique's `apply()` logic on the user's real input.

**Architecture:** Extend the technique contract (`detect()` gains an `items` array, each technique gets a `preview(text)` method), restructure the card HTML in `updateSuggestions()` to wrap each card in a `.technique-card` div with an expand toggle and a hidden `.technique-expanded` section. Event delegation on `#input-tips-list` drives expand/collapse. State is per-card, in-memory, resets on re-render.

**Tech Stack:** Vanilla JS (no framework), plain CSS custom properties.

---

## File Map

| File | Change |
|---|---|
| `js/optimizer.js` | Add `items` to every technique's `detect()` return; add `preview(text)` method to every technique; add `findMiniObjectWithKeys`, `getValueAtPath`, `renderTechniqueItems`, `renderTechniquePreview` helpers; restructure card template in `updateSuggestions()`; add event delegation |
| `style.css` | Add `.technique-card`, `.technique-toggle`, `.technique-expanded`, `.technique-items`, `.technique-preview`, `.preview-before`, `.preview-after` rules; migrate border from `.technique-item` to `.technique-card` |

---

## Task 1: Add `items` arrays to every TECHNIQUES `detect()` method

**Files:**
- Modify: `js/optimizer.js` — the `TECHNIQUES` array (lines ~131–483)

Each technique's `detect()` must now return an optional `items` array. Every item has at minimum a `label: string` (pre-formatted for display) and a `count: number` (for sorting).

- [ ] **Step 1: Update `filler` detect()**

Replace the existing `filler` detect() body with:

```js
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
```

- [ ] **Step 2: Update `verbose` detect()**

Replace the existing `verbose` detect() body with:

```js
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
```

- [ ] **Step 3: Update `overqualify` detect()**

Replace the existing `overqualify` detect() body with:

```js
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
```

- [ ] **Step 4: Update `hedging` detect()**

Replace the existing `hedging` detect() body with:

```js
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
```

- [ ] **Step 5: Update `repetition` detect()**

Replace the existing `repetition` detect() body with:

```js
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
```

- [ ] **Step 6: Update `whitespace` detect()**

Replace the existing `whitespace` detect() body with:

```js
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
    hasMultiNewlines  && { label: `multiple blank lines ×${(text.match(/\n{3,}/g) || []).length}`,     count: (text.match(/\n{3,}/g) || []).length },
    hasMultiSpaces    && { label: `consecutive spaces ×${(text.match(/[ \t]{2,}/g) || []).length}`,    count: (text.match(/[ \t]{2,}/g) || []).length },
    hasTrailingSpaces && { label: `trailing whitespace ×${(text.match(/[ \t]+$/gm) || []).length} lines`, count: (text.match(/[ \t]+$/gm) || []).length },
  ].filter(Boolean);
  return {
    label: 'Redundant whitespace detected',
    example: issues.join(', '),
    savings: 2,
    items,
  };
},
```

- [ ] **Step 7: Update `linebreaks` detect()**

Replace the existing `linebreaks` detect() body with:

```js
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
```

- [ ] **Step 8: Update `json-keys` detect()**

Inside the existing `json-keys` detect(), find the final `return { label, example, savings, metadataCost }` statement and replace it with:

```js
return {
  label: candidates.length + ' repeated key' + (candidates.length > 1 ? 's' : '') + ' found',
  example: candidates[0].key + ' ×' + candidates[0].count,
  savings: netSavings,
  metadataCost: envelopeCost,
  items: candidates.map(({ key, count }) => ({
    label: `${key} ×${count} → ${mapping.get(key)}`,
    count,
  })),
};
```

- [ ] **Step 9: Update `schema-arrays` detect()**

Inside the existing `schema-arrays` detect(), find the final `return { label, example, savings: estimatedSavings }` statement and replace it with:

```js
return {
  label,
  example,
  savings: estimatedSavings,
  items: candidates.map(c => ({
    label: (c.path === 'root' ? 'root' : c.path) + ' · ' + c.count + ' rows × ' + c.keys.length + ' keys',
    count: c.count * c.keys.length,
  })),
};
```

- [ ] **Step 10: Commit**

```bash
git add js/optimizer.js
git commit -m "feat: add items arrays to all technique detect() results"
```

---

## Task 2: Add `preview()` methods to text techniques

**Files:**
- Modify: `js/optimizer.js` — add `preview(text)` to `filler`, `verbose`, `overqualify`, `hedging`, `repetition`, `whitespace`, `linebreaks`

Each `preview(text)` returns `{ before: string, after: string }` — a short (~80 char) excerpt from the user's real input showing the transformation. Returns `null` if no preview is possible.

- [ ] **Step 1: Add `preview()` to `filler` technique**

Add this method to the `filler` technique object (after the `apply()` method):

```js
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
    .replace(new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '')
    .replace(/\s{2,}/g, ' ').trim();
  return {
    before: (ctxStart > 0 ? '…' : '') + slice    + (ctxEnd < text.length ? '…' : ''),
    after:  (ctxStart > 0 ? '…' : '') + after     + (ctxEnd < text.length ? '…' : ''),
  };
},
```

- [ ] **Step 2: Add `preview()` to `verbose` technique**

Add after `verbose` apply():

```js
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
  pattern.lastIndex = 0;
  return {
    before: (ctxStart > 0 ? '…' : '') + slice + (ctxEnd < text.length ? '…' : ''),
    after:  (ctxStart > 0 ? '…' : '') + after + (ctxEnd < text.length ? '…' : ''),
  };
},
```

- [ ] **Step 3: Add `preview()` to `overqualify` technique**

Add after `overqualify` apply():

```js
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
  pattern.lastIndex = 0;
  return {
    before: (ctxStart > 0 ? '…' : '') + slice + (ctxEnd < text.length ? '…' : ''),
    after:  (ctxStart > 0 ? '…' : '') + after + (ctxEnd < text.length ? '…' : ''),
  };
},
```

- [ ] **Step 4: Add `preview()` to `hedging` technique**

Add after `hedging` apply():

```js
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
  pattern.lastIndex = 0;
  return {
    before: (ctxStart > 0 ? '…' : '') + slice + (ctxEnd < text.length ? '…' : ''),
    after:  (ctxStart > 0 ? '…' : '') + after + (ctxEnd < text.length ? '…' : ''),
  };
},
```

- [ ] **Step 5: Add `preview()` to `repetition` technique**

Add after `repetition` apply():

```js
preview(text) {
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
```

- [ ] **Step 6: Add `preview()` to `whitespace` technique**

Add after `whitespace` apply(). Uses `·` (middle dot, U+00B7) for spaces and `↵` for newlines to make invisible whitespace visible:

```js
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
```

- [ ] **Step 7: Add `preview()` to `linebreaks` technique**

Add after `linebreaks` apply():

```js
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
```

- [ ] **Step 8: Commit**

```bash
git add js/optimizer.js
git commit -m "feat: add preview() methods to all text techniques"
```

---

## Task 3: Add `preview()` to JSON techniques + helper functions

**Files:**
- Modify: `js/optimizer.js` — add `preview(text)` to `json-keys` and `schema-arrays`, add two helper functions

- [ ] **Step 1: Add `findMiniObjectWithKeys()` helper**

Add this function after `abbreviateKey()` (around line 759), before `let previousText = null`:

```js
/**
 * Walk a parsed JSON value and return the first object that contains at least
 * one key from affectedKeys. Used to build a compact before/after preview.
 * Returns a shallow copy with only the first 2 affected keys, values replaced
 * with "…" for readability. Returns null if no qualifying object is found.
 */
function findMiniObjectWithKeys(value, affectedKeys) {
  if (value === null || typeof value !== 'object') return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const r = findMiniObjectWithKeys(item, affectedKeys);
      if (r) return r;
    }
    return null;
  }
  const hitKeys = Object.keys(value).filter(k => affectedKeys.has(k));
  if (hitKeys.length > 0) {
    const mini = {};
    hitKeys.slice(0, 2).forEach(k => { mini[k] = '…'; });
    return mini;
  }
  for (const val of Object.values(value)) {
    const r = findMiniObjectWithKeys(val, affectedKeys);
    if (r) return r;
  }
  return null;
}
```

- [ ] **Step 2: Add `getValueAtPath()` helper**

Add immediately after `findMiniObjectWithKeys`:

```js
/**
 * Retrieve a nested value from a parsed JSON object by dot-separated path.
 * path 'root' returns the value itself.
 * Paths containing '[' (array indices) return null — not needed for preview.
 */
function getValueAtPath(obj, path) {
  if (path === 'root') return obj;
  if (path.includes('[')) return null;
  return path.split('.').reduce((acc, k) => (acc && typeof acc === 'object' ? acc[k] : null), obj);
}
```

- [ ] **Step 3: Add `preview()` to `json-keys` technique**

Add after `json-keys` apply():

```js
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
```

- [ ] **Step 4: Add `preview()` to `schema-arrays` technique**

Add after `schema-arrays` apply():

```js
preview(text) {
  const { obj, isJson } = tryParseJson(text);
  if (!isJson) return null;
  const candidates = findHomogeneousArrays(obj, 'root', [], 1);
  if (!candidates.length) return null;
  candidates.sort((a, b) => (b.count * b.keys.length) - (a.count * a.keys.length));
  const best = candidates[0];
  const arr = getValueAtPath(obj, best.path);
  if (!Array.isArray(arr)) return null;

  const slice = arr.slice(0, 2);
  const moreNote = arr.length > 2 ? `\n// … ${arr.length - 2} more rows` : '';
  const before = JSON.stringify(slice, null, 2) + moreNote;
  const transformed = applySchemaExtraction(slice);
  const after = JSON.stringify(transformed, null, 2);
  return { before, after };
},
```

- [ ] **Step 5: Verify helpers are in scope**

Confirm the call order in `optimizer.js`:
- `findMiniObjectWithKeys` is called inside `json-keys` `preview()` ✓ (defined just above in the helpers section)
- `getValueAtPath` is called inside `schema-arrays` `preview()` ✓
- Both helpers appear BEFORE `initSuggestions` in the file so they are hoisted correctly (they are regular function declarations, not arrow functions — if added as `function` declarations, hoisting isn't needed anyway).

- [ ] **Step 6: Commit**

```bash
git add js/optimizer.js
git commit -m "feat: add preview() methods to JSON techniques + path/mini-object helpers"
```

---

## Task 4: Add render helpers and restructure card HTML in `updateSuggestions()`

**Files:**
- Modify: `js/optimizer.js` — add two helpers, restructure the card template inside `updateSuggestions()`

- [ ] **Step 1: Add `renderTechniqueItems()` helper**

Add this function just before `initSuggestions()`:

```js
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
```

- [ ] **Step 2: Add `renderTechniquePreview()` helper**

Add immediately after `renderTechniqueItems`:

```js
/**
 * Render a before/after preview pane for a technique expanded section.
 * Calls t.preview(text) — returns '' if no preview method or no match.
 * @param {Object} t     - Technique object (must have t.preview function)
 * @param {string} text  - Current user input (from updateSuggestions scope)
 * @returns {string} HTML string
 */
function renderTechniquePreview(t, text) {
  if (!t.preview) return '';
  let result;
  try { result = t.preview(text); } catch { return ''; }
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
```

- [ ] **Step 3: Restructure the card template inside `updateSuggestions()`**

Find this block in `updateSuggestions()`:

```js
  html += profitable.map(({ t, r }) => {
    // r.savings >= PROFITABILITY_THRESHOLD here, so the zero-savings branch is unreachable.
    // Kept for defensive completeness in case threshold is later set to 0.
    const savingsLabel = r.savings === 0
      ? 'no token savings'
      : (r.exact ? `↓ ${r.savings} token${r.savings !== 1 ? 's' : ''}` : `↓ ~${r.savings} token${r.savings !== 1 ? 's' : ''}`);
    return `
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
    </label>`;
  }).join('');
```

Replace it with:

```js
  html += profitable.map(({ t, r }) => {
    const savingsLabel = r.savings === 0
      ? 'no token savings'
      : (r.exact ? `↓ ${r.savings} token${r.savings !== 1 ? 's' : ''}` : `↓ ~${r.savings} token${r.savings !== 1 ? 's' : ''}`);

    const itemsHtml   = renderTechniqueItems(r.items);
    const previewHtml = renderTechniquePreview(t, text);
    const hasExpanded = itemsHtml || previewHtml;

    return `
    <div class="technique-card">
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
        ${hasExpanded ? '<button class="technique-toggle" type="button" aria-expanded="false">▸</button>' : ''}
      </label>
      ${hasExpanded ? `<div class="technique-expanded" hidden>${itemsHtml}${previewHtml}</div>` : ''}
    </div>`;
  }).join('');
```

- [ ] **Step 4: Commit**

```bash
git add js/optimizer.js
git commit -m "feat: add renderTechniqueItems/Preview helpers and restructure card markup"
```

---

## Task 5: Add event delegation for expand/collapse and "show more"

**Files:**
- Modify: `js/optimizer.js` — inside `updateSuggestions()`, after `list.innerHTML = html`

- [ ] **Step 1: Add event delegation block after `list.innerHTML = html`**

Find this line in `updateSuggestions()`:

```js
  list.innerHTML = html;

  list.querySelectorAll('.technique-cb').forEach(cb => {
```

Add the delegation block between `list.innerHTML = html;` and the checkbox listener loop:

```js
  list.innerHTML = html;

  // ── Expand / collapse cards ───────────────────────────────────────────────
  // Single delegated listener handles both the toggle chevron and the "show more"
  // button inside expanded sections. e.preventDefault() stops the parent <label>
  // from toggling the checkbox when the toggle button is clicked.
  list.addEventListener('click', e => {
    // "Show N more" button inside .technique-items
    const moreBtn = e.target.closest('.technique-items-more');
    if (moreBtn) {
      e.preventDefault();
      const container = moreBtn.closest('.technique-items');
      container.querySelectorAll('.technique-item-hidden').forEach(el => {
        el.classList.remove('technique-item-hidden');
      });
      moreBtn.remove();
      return;
    }

    // Expand / collapse toggle
    const toggle = e.target.closest('.technique-toggle');
    if (!toggle) return;
    e.preventDefault();  // stop <label> from toggling the checkbox
    const card     = toggle.closest('.technique-card');
    const expanded = card.querySelector('.technique-expanded');
    if (!expanded) return;
    const opening  = expanded.hidden;
    expanded.hidden = !opening;
    toggle.setAttribute('aria-expanded', String(opening));
    toggle.textContent = opening ? '▾' : '▸';
  });

  list.querySelectorAll('.technique-cb').forEach(cb => {
```

- [ ] **Step 2: Verify checkbox change handler is still wired correctly**

The checkbox handler block immediately follows (no change needed):

```js
  list.querySelectorAll('.technique-cb').forEach(cb => {
    cb.addEventListener('change', () => {
      const profileSel = document.getElementById('profile-select');
      if (profileSel) profileSel.value = '';
      refreshApplyButton();
    });
  });
```

Confirm it is still there unchanged.

- [ ] **Step 3: Commit**

```bash
git add js/optimizer.js
git commit -m "feat: add event delegation for expand/collapse and show-more"
```

---

## Task 6: Add CSS for expand/collapse elements

**Files:**
- Modify: `style.css` — migrate border from `.technique-item` to `.technique-card`; add new rules

- [ ] **Step 1: Update `.technique-item` — remove the border**

Find in `style.css`:

```css
.technique-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 0;
  border-bottom: 1px solid var(--border);
  cursor: pointer;
}
.technique-item:last-of-type { border-bottom: none; }
```

Replace with:

```css
.technique-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 0;
  cursor: pointer;
}
```

(The `:last-of-type` rule is deleted; border is now owned by `.technique-card`.)

- [ ] **Step 2: Add `.technique-card` and all new expand/collapse rules**

Immediately after the updated `.technique-item` block, add:

```css
/* Wrapper that groups the collapsed label + the hidden expanded section.
   Owns the separator border so the expanded content sits above the border. */
.technique-card {
  border-bottom: 1px solid var(--border);
}
.technique-card:last-of-type { border-bottom: none; }

/* Chevron toggle button — sits after .technique-body inside the <label> */
.technique-toggle {
  flex-shrink: 0;
  align-self: flex-start;
  margin-top: 2px;
  background: none;
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 11px;
  line-height: 1;
  padding: 2px 6px;
  transition: color 0.15s, border-color 0.15s, background 0.15s;
  font-family: inherit;
}
.technique-toggle:hover {
  color: var(--accent-text);
  border-color: var(--accent);
  background: var(--accent-subtle);
}

/* Expanded section — hidden by default, shown via JS toggle */
.technique-expanded {
  padding: 8px 12px 10px 25px;
  border-top: 1px dashed var(--border);
  margin-bottom: 2px;
}

/* Detected items list */
.technique-items {
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 11.5px;
  color: var(--text-muted);
  margin-bottom: 8px;
}
.technique-item-entry {
  padding: 2px 0;
  line-height: 1.5;
}
.technique-item-hidden { display: none; }
.technique-items-more {
  display: inline-block;
  margin-top: 4px;
  font-size: 11px;
  color: var(--accent-text);
  background: none;
  border: none;
  cursor: pointer;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  padding: 0;
  text-decoration: underline;
}
.technique-items-more:hover { color: var(--accent-hover); }

/* Before/After preview panes */
.technique-preview {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.technique-preview-pane { flex: 1; min-width: 160px; }
.technique-preview-label {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  margin-bottom: 4px;
}
.preview-before,
.preview-after {
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 11.5px;
  white-space: pre-wrap;
  word-break: break-word;
  padding: 6px 8px;
  border-radius: 4px;
  max-height: 120px;
  overflow-y: auto;
  line-height: 1.5;
  border: 1px solid var(--border);
  margin: 0;
}
.preview-before {
  background: var(--error-subtle);
  color: var(--error);
  border-color: var(--error);
}
.preview-after {
  background: var(--success-subtle);
  color: var(--success);
  border-color: var(--success);
}
```

- [ ] **Step 3: Commit**

```bash
git add style.css
git commit -m "feat: add CSS for technique card expand/collapse and before/after preview"
```

---

## Task 7: Verify all scenarios in the browser

**Files:** no code changes

Start a local server:

```bash
npx serve .
```

Open `http://localhost:3000` in a browser with DevTools console visible.

- [ ] **Test 1 — JSON with repeated keys**

Paste this into the token counter textarea:

```json
[{"user_name":"Alice","created_at":"2024-01","status":"active"},{"user_name":"Bob","created_at":"2024-02","status":"active"},{"user_name":"Carol","created_at":"2024-03","status":"inactive"}]
```

Expected:
- "Repeated JSON keys" card appears
- Card has a `▸` chevron on the right
- Click `▸` → expands; shows items like `user_name ×3 → us_na`, `created_at ×3 → cr_at`, `status ×3 → st`
- Preview Before shows `{"user_name":"…","created_at":"…"}`, After shows `{"__key_map":{…},"__data":{…}}`
- Chevron becomes `▾`; clicking again collapses

- [ ] **Test 2 — JSON with homogeneous array**

Paste:

```json
{"orders":[{"id":1,"product":"Widget","qty":5},{"id":2,"product":"Gadget","qty":3},{"id":3,"product":"Donut","qty":12}]}
```

Expected:
- "Homogeneous arrays" card appears with chevron
- Expand → items list shows `orders · 3 rows × 3 keys`
- Preview Before shows the array truncated to 2 rows + "// … 1 more rows", After shows `{"__schema":[…],"__rows":[…]}`

- [ ] **Test 3 — Multiple filler phrases**

Paste:

```
Could you please help me? Of course, I would like you to summarize this. Feel free to be concise.
```

Expected:
- "Filler phrases" card with chevron
- Expand → items list: `"could you please" ×1`, `"of course," ×1`, `"i would like you to" ×1`, `"feel free to" ×1`
- Preview Before: `…Could you please help…`, After: `…help…`

- [ ] **Test 4 — Verbose phrases**

Paste:

```
In order to complete this task, you need to make use of the API. Prior to calling it, due to the fact that errors occur, handle exceptions.
```

Expected:
- "Verbose phrases" card with chevron
- Expand → items like `"in order to" → "to" ×1`, `"make use of" → "use" ×1`, `"prior to" → "before" ×1`, `"due to the fact that" → "because" ×1`
- Preview shows first match with surrounding context

- [ ] **Test 5 — Whitespace issues**

Paste a text with 3+ blank lines between paragraphs and multiple consecutive spaces.

Expected:
- "Redundant whitespace" card with chevron
- Expand → items like `multiple blank lines ×1`, `consecutive spaces ×N`
- Preview shows `·` (middle dots) for spaces and `↵` symbols for newlines in both Before and After panes

- [ ] **Test 6 — Repeated sentences**

Paste:

```
The quick brown fox jumps over the lazy dog. Some other text here. The quick brown fox jumps over the lazy dog.
```

Expected:
- "Repeated sentences" card with chevron
- Expand → items list shows the sentence with ×2
- Preview Before shows the duplicate occurrence in context; After shows `[removed]`

- [ ] **Test 7 — Toggle interaction**

With any of the above inputs:
- Click `▸` → expands, aria-expanded becomes `"true"`, chevron becomes `▾`
- Click `▾` → collapses, aria-expanded becomes `"false"`, chevron becomes `▸`
- Click the checkbox directly → checkbox toggles, card does NOT expand
- Click outside the checkbox on the label body → checkbox toggles, card does NOT expand (only the chevron expands)

- [ ] **Test 8 — "Show more" button**

Create input with 11+ filler phrases by pasting a very verbose text, OR temporarily lower the FILLER_PHRASES threshold to trigger many items. Confirm the `+ N more` button appears, clicking it reveals all items, and the button disappears.

- [ ] **Test 9 — Dark mode**

Toggle dark mode. Confirm:
- Chevron button border/hover renders correctly against dark background
- Expanded section background matches `--surface`
- Before pane: dark red background (`--error-subtle`) with light red text
- After pane: dark green background (`--success-subtle`) with light green text

- [ ] **Test 10 — Collapsed visual regression**

With no card expanded, visually compare against the pre-change collapsed state. The cards should look identical to before (same borders, same spacing, same label/hint/meta layout). The only addition is the `▸` chevron button on the right of each card.

- [ ] **Test 11 — Profile switching and undo**

Apply a profile (e.g. "Text Cleanup"), apply optimizations, then undo. Confirm:
- Expanded state is NOT preserved after undo (all cards collapse on re-render)
- Profile selector still works after expanding/collapsing cards

- [ ] **Final commit**

```bash
git add .
git commit -m "chore: verify suggestion UX expand/collapse feature complete"
```

---

## Self-Review

**Spec coverage:**
- ✅ Full list of detected items (capped at 10 with "+ N more") — Task 1 + 4
- ✅ Before/After preview from real input via technique's `apply()` logic — Task 2 + 3 + 4
- ✅ Inline expand — chevron toggle, `hidden` attribute, `aria-expanded` — Task 5
- ✅ Collapsed view unchanged — `technique-item` markup and padding preserved — Task 4 + 6
- ✅ Checkbox click does NOT expand — `e.preventDefault()` on toggle only — Task 5
- ✅ Items sorted by impact (count desc) — all detect() methods sort before returning — Task 1
- ✅ Header label uses `items.length` — detect() already computes the correct `found.length` / `candidates.length`; the label string is set in detect() from those values ✓
- ✅ Whitespace markers `·` and `↵` for invisible-whitespace preview — Task 2 step 6–7
- ✅ JSON techniques: synthetic mini-object for json-keys, 2-row slice for schema-arrays — Task 3
- ✅ Dark mode — preview panes use CSS custom properties (`--error-subtle`, `--success-subtle`) — Task 6
- ✅ No persistence of expanded state across re-renders — `list.innerHTML = html` resets everything — no extra work needed
- ✅ Profitability gating, profile selector, select-all, undo flow — unchanged

**Placeholder scan:** No TBDs, TODOs, or "similar to above" references found.

**Type consistency:**
- `renderTechniqueItems(r.items)` — `r.items` is `Array<{label:string, count:number}> | undefined`, function handles undefined ✓
- `renderTechniquePreview(t, text)` — `t` has optional `preview(text)` method; function checks `if (!t.preview)` ✓
- `findMiniObjectWithKeys(obj, affectedKeys)` — `affectedKeys` is a `Set<string>`, used in `json-keys` preview with `new Set(candidates.map(c => c.key))` ✓
- `getValueAtPath(obj, path)` — path is the string from `findHomogeneousArrays`, e.g. `'orders'` or `'root'` ✓
- All `preview()` methods return `{ before: string, after: string } | null` — `renderTechniquePreview` handles null ✓
