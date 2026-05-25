# Marginal Savings per Technique Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Per-card savings badges show each technique's marginal contribution in the combined pipeline — what it adds on top of all checked techniques before it — instead of its individual savings in isolation.

**Architecture:** Two functions in `js/optimizer.js` change. `_refreshSavingsDisplay` is rewritten from a synchronous `forEach` to an async `for...of` that captures the token delta at each pipeline step and pushes it to the card badge. `refreshApplyButton` gains two new lines: set checked cards to `…` (loading) and restore unchecked cards to their stored individual savings.

**Tech Stack:** Vanilla JS, no build step. Open `index.html` directly in a browser to test.

---

## File Map

| File | Change |
|---|---|
| `js/optimizer.js` | Three edits: checkbox template (add `data-exact`), `_refreshSavingsDisplay` (full rewrite), `refreshApplyButton` (add badge block) |

---

### Task 1: Add `data-exact` to the checkbox render template

The restored-badge logic in Task 3 needs to know whether a technique's individual savings were measured exactly (tiktoken) or approximately, so it can format the label correctly. This is stored as a `data-exact` attribute alongside the existing `data-savings`.

**Files:**
- Modify: `js/optimizer.js` — line 1297 (the `<input type="checkbox" …>` inside the `profitable.map(…)` template string)

- [ ] **Step 1: Edit the checkbox template**

Find this line (inside the `profitable.map(({ t, r }) => { … })` block, around line 1297):

```js
          <input type="checkbox" class="technique-cb" data-id="${t.id}" data-savings="${r.savings}" checked>
```

Replace with:

```js
          <input type="checkbox" class="technique-cb" data-id="${t.id}" data-savings="${r.savings}" data-exact="${r.exact ? 'true' : 'false'}" checked>
```

- [ ] **Step 2: Verify in the browser**

Open `index.html`, type some text with whitespace/linebreaks, open DevTools → Elements, click a `.technique-cb` checkbox element. Confirm it has both `data-savings="320"` (or similar) and `data-exact="false"` (or `"true"` for tiktoken models).

- [ ] **Step 3: Commit**

```bash
git add js/optimizer.js
git commit -m "feat: add data-exact attr to technique checkboxes for badge restoration"
```

---

### Task 2: Rewrite `_refreshSavingsDisplay` to compute per-step marginals

Replace the synchronous `forEach` loop (which made one tokenizer call at the end) with an async `for...of` loop that awaits a tokenizer call after each technique, derives the marginal, and updates that technique's card badge. A final normalisation pass + one extra tokenizer call produces the combined savings for the Apply button — same as before.

**Files:**
- Modify: `js/optimizer.js` — `_refreshSavingsDisplay` function (lines 1053–1082)

- [ ] **Step 1: Replace `_refreshSavingsDisplay` entirely**

Find the entire function (starts at `const _refreshSavingsDisplay = debounce(async function() {`, ends at `}, 300);`):

```js
const _refreshSavingsDisplay = debounce(async function() {
  const btn = document.getElementById('clean-btn');
  if (!btn || btn.textContent.startsWith('↩')) return; // undo mode — leave as-is
  const savingsEl = document.getElementById('clean-savings-text');
  if (!savingsEl) return;

  const checked = [...document.querySelectorAll('.technique-cb:checked')];
  if (!checked.length || !currentInputText || !currentInputModel) {
    savingsEl.textContent = '';
    return;
  }

  // Run the same apply pipeline as handleApplyOrUndo for the checked techniques.
  const checkedIds = new Set(checked.map(cb => cb.dataset.id));
  let out = currentInputText;
  ['filler', 'verbose', 'overqualify', 'hedging', 'repetition', 'schema-arrays', 'json-keys', 'linebreaks', 'whitespace'].forEach(id => {
    if (checkedIds.has(id)) {
      const tech = TECHNIQUES.find(t => t.id === id);
      if (tech) out = tech.apply(out);
    }
  });
  out = out.replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

  const { count: afterCount } = await countTokens(out, currentInputModel);
  const saved = Math.max(0, currentTokenCount - afterCount);

  // Guard: discard result if we've entered undo mode while counting
  if (!btn || btn.textContent.startsWith('↩')) return;
  savingsEl.textContent = saved > 0 ? 'saves ' + saved + ' token' + (saved !== 1 ? 's' : '') : '';
}, 300);
```

Replace with:

```js
const _refreshSavingsDisplay = debounce(async function() {
  const btn = document.getElementById('clean-btn');
  if (!btn || btn.textContent.startsWith('↩')) return; // undo mode — leave as-is
  const savingsEl = document.getElementById('clean-savings-text');
  if (!savingsEl) return;

  const checked = [...document.querySelectorAll('.technique-cb:checked')];
  if (!checked.length || !currentInputText || !currentInputModel) {
    savingsEl.textContent = '';
    return;
  }

  // Run the apply pipeline sequentially, capturing the marginal token delta at each step.
  // Each checked technique is applied on top of the previous output so marginals reflect
  // real additive contributions — they sum to (approximately) the combined savings.
  const checkedIds = new Set(checked.map(cb => cb.dataset.id));
  const PIPELINE_ORDER = ['filler', 'verbose', 'overqualify', 'hedging', 'repetition',
                          'schema-arrays', 'json-keys', 'linebreaks', 'whitespace'];

  let out       = currentInputText;
  let prevCount = currentTokenCount;

  for (const id of PIPELINE_ORDER) {
    if (!checkedIds.has(id)) continue;
    const tech = TECHNIQUES.find(t => t.id === id);
    if (!tech) continue;

    out = tech.apply(out);
    const { count: afterCount, method } = await countTokens(out, currentInputModel);

    // Guard mid-loop: bail if undo mode was entered while awaiting the tokenizer
    if (!btn || btn.textContent.startsWith('↩')) return;

    const marginal = Math.max(0, prevCount - afterCount);
    const card  = document.querySelector(`.technique-cb[data-id="${id}"]`)?.closest('.technique-card');
    const badge = card?.querySelector('.technique-savings');
    if (badge) {
      badge.textContent = marginal === 0
        ? '↓ ~0 tokens'
        : (method === 'exact'
            ? `↓ ${marginal} token${marginal !== 1 ? 's' : ''}`
            : `↓ ~${marginal} token${marginal !== 1 ? 's' : ''}`);
    }

    prevCount = afterCount;
  }

  // Apply the same normalisation pass as handleApplyOrUndo, then count once more for the
  // Apply button combined figure. This keeps the Apply button consistent with what the user
  // actually gets when they click it. (If `whitespace` was the last checked technique this
  // count is effectively a no-op since whitespace already normalises.)
  out = out.replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  const { count: finalCount } = await countTokens(out, currentInputModel);

  // Guard: discard if undo mode entered during final count
  if (!btn || btn.textContent.startsWith('↩')) return;

  const saved = Math.max(0, currentTokenCount - finalCount);
  savingsEl.textContent = saved > 0 ? 'saves ' + saved + ' token' + (saved !== 1 ? 's' : '') : '';
}, 300);
```

- [ ] **Step 2: Verify manually — all checked**

1. Open `index.html`, paste a multi-line text (at least 10 lines with some redundant whitespace).
2. Wait for suggestions to appear — all checked by default.
3. After ~300ms the card badges update. Confirm:
   - If both **Line breaks** and **Whitespace** are shown and both checked, whitespace should now show a small number (or `↓ ~0 tokens`) while line breaks shows the larger number.
   - The Apply button savings text (e.g. `saves 352 tokens`) is consistent with what you get after clicking Apply → Undo.

- [ ] **Step 3: Verify manually — uncheck one technique**

1. Uncheck **Line breaks**. The card badges for remaining checked techniques should update within ~300ms.
2. Re-check **Line breaks**. Whitespace should again show near-zero marginal.

- [ ] **Step 4: Commit**

```bash
git add js/optimizer.js
git commit -m "feat: compute per-card marginal savings in pipeline order via async for-loop"
```

---

### Task 3: Extend `refreshApplyButton` to show loading state and restore unchecked badges

When a checkbox changes, `refreshApplyButton` fires synchronously. Add two new behaviours: checked cards immediately show `…` (so users see feedback before the 300ms debounce fires), and unchecked cards immediately revert to their individual savings (read from `data-savings` + `data-exact`).

**Files:**
- Modify: `js/optimizer.js` — `refreshApplyButton` function (lines 1192–1204)

- [ ] **Step 1: Replace `refreshApplyButton` entirely**

Find:

```js
function refreshApplyButton() {
  const btn = document.getElementById('clean-btn');
  if (btn.textContent.startsWith('↩')) return;  // undo mode — don't overwrite

  const checked = [...document.querySelectorAll('.technique-cb:checked')];

  btn.textContent = checked.length > 0 ? '✨ Apply (' + checked.length + ' selected)' : '✨ Apply selected';
  btn.disabled = checked.length === 0;

  // Clear stale savings text immediately; real combined savings loads asynchronously.
  document.getElementById('clean-savings-text').textContent = '';
  if (checked.length > 0) _refreshSavingsDisplay();
}
```

Replace with:

```js
function refreshApplyButton() {
  const btn = document.getElementById('clean-btn');
  if (btn.textContent.startsWith('↩')) return;  // undo mode — don't overwrite

  const checked = [...document.querySelectorAll('.technique-cb:checked')];

  btn.textContent = checked.length > 0 ? '✨ Apply (' + checked.length + ' selected)' : '✨ Apply selected';
  btn.disabled = checked.length === 0;

  // Clear stale combined savings text immediately; real combined savings loads asynchronously.
  document.getElementById('clean-savings-text').textContent = '';

  // Per-card badges: checked → loading indicator while marginals recompute;
  // unchecked → individual savings ("what you'd gain by adding this").
  document.querySelectorAll('.technique-cb').forEach(cb => {
    const badge = cb.closest('.technique-card')?.querySelector('.technique-savings');
    if (!badge) return;
    if (cb.checked) {
      badge.textContent = '…';
    } else {
      const s     = parseInt(cb.dataset.savings, 10) || 0;
      const exact = cb.dataset.exact === 'true';
      badge.textContent = s > 0
        ? (exact ? `↓ ${s} token${s !== 1 ? 's' : ''}` : `↓ ~${s} token${s !== 1 ? 's' : ''}`)
        : 'no token savings';
    }
  });

  if (checked.length > 0) _refreshSavingsDisplay();
}
```

- [ ] **Step 2: Verify loading state**

1. Open `index.html`, paste multi-line text, wait for suggestions.
2. Uncheck any card. Its badge should immediately show `↓ ~Nnn tokens` (its individual savings).
3. Re-check it. Its badge should immediately show `…`, then update to a marginal number ~300ms later.

- [ ] **Step 3: Verify unchecked badge content**

1. With linebreaks and whitespace both checked, note the whitespace marginal (should be near zero).
2. Uncheck whitespace. Its badge should immediately revert to `↓ ~320 tokens` (or its individual savings value) — the number it would contribute if selected alone.
3. Re-check whitespace. Badge goes back to `…` then updates to marginal again.

- [ ] **Step 4: Verify undo mode is unaffected**

1. Click Apply. The Undo button appears.
2. Manually toggle a checkbox (if available — in undo mode suggestions are frozen).
3. The Undo button text should remain unchanged. No badge updates should occur.

- [ ] **Step 5: Commit**

```bash
git add js/optimizer.js
git commit -m "feat: show loading indicator and restore individual savings on checkbox toggle"
```

---

## Final Integration Verification

- [ ] Paste a large JSON payload (100+ objects in an array). Check all four suggestion cards. Confirm marginals sum to approximately the Apply button combined savings.
- [ ] Select only **Whitespace**. Badge should show the same number as before (marginal = individual when only one technique is checked).
- [ ] Apply → Undo. Confirm the undo delta matches the Apply button savings that was shown before clicking.
- [ ] Switch model (if multiple are available). Confirm all badges update with the new model's savings.
