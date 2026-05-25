# JS File Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the monolithic `app.js` (1,176 lines) into six focused files in a `js/` subdirectory, loaded via classic `<script defer>` tags.

**Architecture:** Pure file relocation — no logic changes, no renames, no behavior changes. All files share the global scope. Load order is enforced by tag order in `index.html`. The old root-level `app.js` is deleted once the new files are verified.

**Tech Stack:** Vanilla JS, no build step, no modules. Browser verification via `npx serve .`.

---

## File Map

| File | Source lines in current `app.js` | Purpose |
|---|---|---|
| `js/utils.js` | 920–941 | Shared helpers |
| `js/tokenizer.js` | 132–203 | Token counting and cost |
| `js/prices.js` | 72–131 | Pricing data and model selector |
| `js/optimizer.js` | 269–919 | Techniques, helpers, suggestion UI |
| `js/json-prettifier.js` | 942–1176 | JSON tree renderer and prettifier UI |
| `js/app.js` | 9–71 then 204–268 | Theme, tabs, init, token counter UI |

> Lines 1–7 (old file header + `'use strict'`) are **discarded** — each new file gets its own header.

---

## Task 1: Create `js/utils.js`

**Files:**
- Create: `js/utils.js`

- [ ] **Step 1: Create the file with header**

```js
/* ============================================================
   JsonsNTokens — utils.js
   Shared helpers: escapeHtml, escapeAttr, copyToClipboard
   ============================================================ */

'use strict';
```

- [ ] **Step 2: Append lines 920–941 from `app.js`**

Copy from `app.js` starting at `// ── UTILS ──` (line 920) through line 941 (end of `copyToClipboard`). The block to append:

```js
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
```

- [ ] **Step 3: Commit**

```bash
git add js/utils.js
git commit -m "refactor: extract utils.js from app.js"
```

---

## Task 2: Create `js/tokenizer.js`

**Files:**
- Create: `js/tokenizer.js`

- [ ] **Step 1: Create the file with header**

```js
/* ============================================================
   JsonsNTokens — tokenizer.js
   Token counting: countTokens, tiktoken, formatCost, calcCost
   ============================================================ */

'use strict';
```

- [ ] **Step 2: Append lines 132–203 from `app.js`**

Copy from `app.js` starting at `// ── TOKENIZER ──` (line 132) through line 203 (end of `calcCost`). The block starts with:

```js
// ── TOKENIZER ──────────────────────────────────────────────────────────────

const tiktokenEncoders = new Map(); // cached tiktoken encoders by encoding name
let tiktokenLoading = false;
let tiktokenFailed = false;
```

and ends with:

```js
async function loadTiktoken(encoding) {
  // Dynamically load tiktoken from CDN
  const { get_encoding } = await import(
    'https://cdn.jsdelivr.net/npm/tiktoken@1.0.15/+esm'
  );
  return get_encoding(encoding);
}
```

- [ ] **Step 3: Verify `formatCost` and `calcCost` are included**

`formatCost` and `calcCost` live between `loadTiktoken` and line 203 — they are included in the Step 2 range. Confirm the file ends with:

```js
/**
 * Calculate cost given token count and price per 1M tokens.
 */
function calcCost(tokens, per1M) {
  return (tokens / 1_000_000) * per1M;
}
```

- [ ] **Step 4: Commit**

```bash
git add js/tokenizer.js
git commit -m "refactor: extract tokenizer.js from app.js"
```

---

## Task 3: Create `js/prices.js`

**Files:**
- Create: `js/prices.js`

- [ ] **Step 1: Create the file with header**

```js
/* ============================================================
   JsonsNTokens — prices.js
   Model pricing data, model selector UI
   ============================================================ */

'use strict';
```

- [ ] **Step 2: Append lines 72–131 from `app.js`**

Copy from `app.js` starting at `// ── PRICES & MODEL SELECTOR ──` (line 72) through line 131 (end of `getSelectedModel`). The block starts with:

```js
// ── PRICES & MODEL SELECTOR ────────────────────────────────────────────────

let MODELS = {};  // populated by loadPrices()

// Fallback model list used if prices.json fails to load
const FALLBACK_MODELS = {
```

and ends with:

```js
function getSelectedModel() {
  const id = document.getElementById('model-select').value;
  return { id, ...MODELS[id] };
}
```

- [ ] **Step 3: Commit**

```bash
git add js/prices.js
git commit -m "refactor: extract prices.js from app.js"
```

---

## Task 4: Create `js/optimizer.js`

**Files:**
- Create: `js/optimizer.js`

- [ ] **Step 1: Create the file with header**

```js
/* ============================================================
   JsonsNTokens — optimizer.js
   Token reduction: phrase lists, TECHNIQUES, helpers, suggestion UI
   ============================================================ */

'use strict';
```

- [ ] **Step 2: Append lines 269–919 from `app.js`**

Copy from `app.js` starting at `// ── TOKEN REDUCTION SUGGESTIONS ──` (line 269) through line 919 (closing `}` of `handleApplyOrUndo`).

The block starts with:

```js
// ── TOKEN REDUCTION SUGGESTIONS ────────────────────────────────────────────

// ── Phrase lists used by TECHNIQUES ──

const FILLER_PHRASES = [
```

and ends with:

```js
  btn.textContent = '↩ Undo' + deltaLabel;
  btn.disabled = false;
  updateTokenCount();
}
```

This is the largest file (~651 lines). After copying, verify these names are present in the file by searching:
- `PROFITABILITY_THRESHOLD`
- `const TECHNIQUES = [`
- `function tryParseJson`
- `function assertValidJson`
- `function updateSuggestions`
- `async function handleApplyOrUndo`

- [ ] **Step 3: Commit**

```bash
git add js/optimizer.js
git commit -m "refactor: extract optimizer.js from app.js"
```

---

## Task 5: Create `js/json-prettifier.js`

**Files:**
- Create: `js/json-prettifier.js`

- [ ] **Step 1: Create the file with header**

```js
/* ============================================================
   JsonsNTokens — json-prettifier.js
   JSON tree renderer and prettifier UI
   ============================================================ */

'use strict';
```

- [ ] **Step 2: Append lines 942–1176 from `app.js`**

Copy from `app.js` starting at `// ── JSON TREE RENDERER ──` (line 942) through line 1176 (end of file, closing `}` of `syntaxHighlight`).

The block starts with:

```js
// ── JSON TREE RENDERER ─────────────────────────────────────────────────────

/**
 * Entry point — renders a parsed JS value as a collapsible HTML tree.
 */
function renderJsonTree(value) {
```

and ends with:

```js
      return `<span class="${cls}">${match}</span>`;
    }
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add js/json-prettifier.js
git commit -m "refactor: extract json-prettifier.js from app.js"
```

---

## Task 6: Create `js/app.js`

**Files:**
- Create: `js/app.js`

- [ ] **Step 1: Create the file with header**

```js
/* ============================================================
   JsonsNTokens — app.js
   Entry point: theme, tabs, init, token counter UI
   ============================================================ */

'use strict';
```

- [ ] **Step 2: Append lines 9–71 from the old `app.js`**

Copy from the old root `app.js` starting at `// ── THEME ──` (line 9) through line 71 (closing `}` of `initApp`).

The block starts with:

```js
// ── THEME ──────────────────────────────────────────────────────────────────

const THEME_KEY = 'jnt-theme';
```

and ends with:

```js
async function initApp() {
  await loadPrices();
  initTokenCounter();
  initSuggestions();
  initJsonPrettifier();
}
```

- [ ] **Step 3: Append lines 204–268 from the old `app.js`**

Immediately after the content above (no blank separator needed beyond a single newline), append from `// ── TOKEN COUNTER UI ──` (line 204) through line 268 (closing `}` of `updateTokenCount`).

The block starts with:

```js
// ── TOKEN COUNTER UI ───────────────────────────────────────────────────────

let countDebounceTimer = null;
```

and ends with:

```js
  // Trigger suggestions update — pass model and current count so savings can be
  // measured with the real tokenizer rather than character-based estimates.
  await updateSuggestions(text, model, count);
}
```

- [ ] **Step 4: Commit**

```bash
git add js/app.js
git commit -m "refactor: extract app.js (entry point) from root app.js"
```

---

## Task 7: Update `index.html` and verify

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Replace the script tag**

In `index.html`, find this line near the bottom of `<body>`:

```html
<script src="app.js" defer></script>
```

Replace it with:

```html
<script src="js/utils.js" defer></script>
<script src="js/tokenizer.js" defer></script>
<script src="js/prices.js" defer></script>
<script src="js/optimizer.js" defer></script>
<script src="js/json-prettifier.js" defer></script>
<script src="js/app.js" defer></script>
```

- [ ] **Step 2: Start a local server**

```bash
npx serve .
```

Open the URL printed (usually `http://localhost:3000`).

- [ ] **Step 3: Verify the console is clean**

Open browser DevTools → Console. There should be **zero errors** and **zero warnings** (except the existing prices.json/tiktoken network notes which are expected).

- [ ] **Step 4: Verify token counter**

- Type a sentence into the textarea → token count and cost appear
- Change the model → count updates
- Click ✕ Clear → input empties, cards hide

- [ ] **Step 5: Verify optimizer suggestions**

- Paste a verbose paragraph containing phrases like "in order to" or "due to the fact that"
- Suggestions panel appears with detected issues and real token savings
- Check one or more items and click Apply → text changes, Undo button shows token delta
- Click ↩ Undo → original text restored

- [ ] **Step 6: Verify JSON prettifier**

- Switch to JSON Prettifier tab
- Paste `{"name":"Alice","age":30}` → click Format → tree renders
- Click Minify → minified output shown
- Click Validate → "Valid JSON" message shown
- Click 📋 Copy → clipboard receives the JSON

- [ ] **Step 7: Verify theme toggle**

- Click the 🌙/☀️ button → theme switches
- Reload the page → theme is remembered

- [ ] **Step 8: Commit**

```bash
git add index.html
git commit -m "refactor: update index.html to load split JS files"
```

---

## Task 8: Delete old `app.js` and final commit

**Files:**
- Delete: `app.js` (root level)

- [ ] **Step 1: Delete the old root-level file**

```bash
git rm app.js
```

- [ ] **Step 2: Verify the app still works**

Reload `http://localhost:3000` with DevTools open. Confirm no errors. The deleted file is no longer referenced by `index.html` so this is safe.

- [ ] **Step 3: Update `CLAUDE.md`**

In `CLAUDE.md`, the file list currently reads:

```
- `app.js` — all logic; sections are clearly delimited with `// ── SECTION ──` comments
```

Replace with:

```
- `js/utils.js` — shared helpers (escapeHtml, copyToClipboard)
- `js/tokenizer.js` — token counting, tiktoken integration, cost calculation
- `js/prices.js` — model pricing data, model selector UI
- `js/optimizer.js` — token reduction techniques, suggestion UI, profitability gating
- `js/json-prettifier.js` — JSON tree renderer and prettifier UI
- `js/app.js` — entry point: theme, tabs, init, token counter UI
```

- [ ] **Step 4: Final commit**

```bash
git add CLAUDE.md
git commit -m "refactor: delete root app.js, update CLAUDE.md for split structure"
```

---

## Self-check after completion

Confirm all of the following:

- `app.js` no longer exists at the project root
- `js/` directory contains exactly six `.js` files
- Browser console shows no errors
- All features verified in Task 7 still work
- `CLAUDE.md` reflects the new file structure
- `git log --oneline -8` shows one commit per task
