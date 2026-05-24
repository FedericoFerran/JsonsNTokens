# Design: Split app.js into Multiple Files

**Date:** 2026-05-23  
**Status:** Approved  
**Scope:** Pure file relocation — no logic changes, no behavior changes.

---

## Problem

`app.js` has grown to 1,176 lines across 13 logical sections. As optimizer phases 8–10 are implemented it will continue to grow. A single file makes navigation, review, and future splitting harder.

---

## Approach

Classic multi-script tags. No build step, no module system, no namespace objects. All files share the global scope. Files are loaded in dependency order via `defer` on each `<script>` tag.

`defer` downloads scripts in parallel but executes them in declaration order, after the DOM is fully parsed — matching the behavior of the existing single `<script src="app.js" defer>`.

---

## File Structure

All files move into a `js/` subdirectory.

```
js/
  utils.js           (~22 lines)
  tokenizer.js       (~70 lines)
  prices.js          (~60 lines)
  optimizer.js       (~650 lines)
  json-prettifier.js (~235 lines)
  app.js             (~110 lines)
```

---

## File Contents

### `js/utils.js`
Shared helpers. No dependencies. Loaded first.

- `escapeHtml(str)`
- `escapeAttr(str)`
- `copyToClipboard(text, btn)`

---

### `js/tokenizer.js`
Everything token-counting and cost calculation.  
Dependencies: none (utils not needed here).

- `tiktokenEncoders` — Map, caches loaded encoders by encoding name
- `tiktokenLoading` — flag (declared but currently unused; kept for future use)
- `tiktokenFailed` — flag, set on tiktoken load failure
- `loadTiktoken(encoding)`
- `countWithTiktoken(text, encoding)`
- `countTokens(text, model)`
- `formatCost(usd)`
- `calcCost(tokens, per1M)`

---

### `js/prices.js`
Model pricing data and model selector UI.  
Dependencies: none.

- `MODELS` — object populated at runtime by `loadPrices()`
- `FALLBACK_MODELS` — hardcoded fallback if `prices.json` fails
- `loadPrices()`
- `showPricesError()`
- `populateModelSelector()`
- `getSelectedModel()`

---

### `js/optimizer.js`
Everything optimization: data, technique logic, helper functions, and suggestion UI.  
Dependencies: `utils.js` (`escapeHtml`), `tokenizer.js` (`countTokens`), `prices.js` (`getSelectedModel`).  
Note: calls `updateTokenCount()` at runtime — defined in `app.js`, loaded after. Safe because the call only happens on user interaction, not at declaration time.

- `FILLER_PHRASES` — array
- `VERBOSE_PATTERNS` — array
- `OVERQUALIFY_PATTERNS` — array
- `HEDGING_PATTERNS` — array
- `PROFITABILITY_THRESHOLD` — constant (default: 1)
- `TECHNIQUES` — array of technique objects (detect + apply)
- `tryParseJson(text)`
- `assertValidJson(output, original, label)`
- `collectJsonKeys(value, counts)`
- `findRepeatableKeysInObj(obj)`
- `renameJsonKeys(value, mapping)`
- `abbreviateKey(key, usedAbbrs)`
- `previousText` — one-level undo state
- `initSuggestions()`
- `toggleSelectAll()`
- `refreshApplyButton()`
- `updateSuggestions(text, model, beforeCount)`
- `handleApplyOrUndo()`

---

### `js/json-prettifier.js`
JSON tree renderer and prettifier UI.  
Dependencies: `utils.js` (`escapeHtml`, `copyToClipboard`).

- `renderJsonTree(value)`
- `renderTreeNode(key, value, isLast)`
- `renderPrimitive(value)`
- `syntaxHighlight(json)` — currently unused; retained
- `JSON_ACTION_BTNS` — array of button IDs
- `setActiveJsonBtn(activeId)`
- `initJsonPrettifier()`
- `getJsonInput()`
- `setJsonOutput(html, isError)`
- `parseJsonSafely(text)`
- `jsonFormat()`
- `jsonMinify()`
- `jsonValidate()`
- `jsonCopy()`
- `countJsonKeys(obj)`

---

### `js/app.js`
Entry point. Theme, tabs, init, token counter UI.  
Dependencies: all other files.

- `THEME_KEY` — constant
- `getInitialTheme()`
- `applyTheme(theme)`
- `toggleTheme()`
- `switchTab(tabId)`
- `DOMContentLoaded` listener → calls `initApp()`
- `initApp()` — async, calls `loadPrices`, `initTokenCounter`, `initSuggestions`, `initJsonPrettifier`
- `countDebounceTimer` — debounce handle
- `initTokenCounter()`
- `updateTokenCount()` — async

---

## Load Order and Dependency Graph

```html
<script src="js/utils.js" defer></script>
<script src="js/tokenizer.js" defer></script>
<script src="js/prices.js" defer></script>
<script src="js/optimizer.js" defer></script>
<script src="js/json-prettifier.js" defer></script>
<script src="js/app.js" defer></script>
```

```
utils.js
    ↑
tokenizer.js    prices.js
    ↑               ↑
    └───────────────┤
                optimizer.js    json-prettifier.js
                    ↑               ↑
                    └───────────────┤
                                app.js
```

---

## Cross-File Runtime Calls

All cross-file calls happen inside function bodies — never at declaration time. Load order governs declaration; call order governs execution.

| Caller file | Function called | Defined in |
|---|---|---|
| `app.js` | `countTokens()`, `calcCost()`, `formatCost()` | `tokenizer.js` |
| `app.js` | `getSelectedModel()`, `loadPrices()` | `prices.js` |
| `app.js` | `updateSuggestions()`, `initSuggestions()` | `optimizer.js` |
| `app.js` | `initJsonPrettifier()` | `json-prettifier.js` |
| `optimizer.js` | `countTokens()`, `getSelectedModel()` | `tokenizer.js`, `prices.js` |
| `optimizer.js` | `updateTokenCount()` | `app.js` ← loads after optimizer.js; safe at runtime |
| `optimizer.js` | `escapeHtml()` | `utils.js` |
| `json-prettifier.js` | `escapeHtml()`, `copyToClipboard()` | `utils.js` |

---

## index.html Change

Replace one `<script>` tag with six, at the same location in the file (bottom of `<body>`):

```html
<!-- before -->
<script src="app.js" defer></script>

<!-- after -->
<script src="js/utils.js" defer></script>
<script src="js/tokenizer.js" defer></script>
<script src="js/prices.js" defer></script>
<script src="js/optimizer.js" defer></script>
<script src="js/json-prettifier.js" defer></script>
<script src="js/app.js" defer></script>
```

---

## What Does Not Change

- No logic changes of any kind
- No variable renames
- No behavior changes
- No build step introduced
- `style.css` and `prices.json` untouched
- `vercel.json` untouched

---

## Success Criteria

- App loads and works identically after the split
- Each file contains exactly the functions/variables listed above
- No function is defined in two files
- No `import` or `export` keywords anywhere
- Old `app.js` at the root is deleted
