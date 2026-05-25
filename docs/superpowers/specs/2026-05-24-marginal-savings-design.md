# Marginal Savings per Technique — Design Spec

**Date:** 2026-05-24  
**Branch:** feat/suggestion-expand-preview  
**Status:** Approved for implementation

---

## Problem

Each suggestion card shows the token savings that technique would produce **applied alone to the original text** (individual savings). When multiple techniques are checked, these numbers don't add up to the combined savings shown on the Apply button — because techniques interact (e.g. `linebreaks` absorbs most of what `whitespace` would have done). Users interpret this as a bug.

The fix: checked card badges should show the **marginal contribution** of each technique — what it adds on top of all checked techniques that run before it in the pipeline. Unchecked cards continue showing individual savings ("what you'd gain by adding this").

---

## Scope

Changes are isolated to `js/optimizer.js`. No new files. No changes to HTML, CSS, or other JS modules.

---

## Architecture

### What changes

**`_refreshSavingsDisplay`** (core change) — currently runs the checked pipeline once to get a final token count for the Apply button. Extended to also capture the marginal token delta at each pipeline step and push it to that technique's card badge.

**`refreshApplyButton`** (small addition) — already fires synchronously on every checkbox toggle. Two additions:
1. Each **checked** card's savings badge → `…` (loading indicator)
2. Each **unchecked** card's savings badge → individual savings from `data-savings` attribute

Nothing else changes. Gating logic, profitability threshold, undo handling, and `updateSuggestions` are untouched.

---

## Data Flow

```
checkbox toggled
    → refreshApplyButton() [sync]
        checked cards: badge = "…"
        unchecked cards: badge = data-savings individual value
        calls _refreshSavingsDisplay() (debounced 300ms)

    → _refreshSavingsDisplay() [async, 300ms later]
        prevCount = currentTokenCount
        for each id in PIPELINE_ORDER:
            if not in checkedIds → skip
            out = tech.apply(out)
            afterCount = countTokens(out)
            marginal = max(0, prevCount − afterCount)
            find card badge by data-id → update to marginal label
            prevCount = afterCount
        combined = currentTokenCount − final afterCount
        → update Apply button savings text (unchanged)
```

One pipeline run per debounce tick. No extra tokenizer calls beyond what already happens.

---

## DOM Targeting

Technique card badges are reached from the technique ID:

```js
const card  = document.querySelector(`.technique-cb[data-id="${id}"]`)?.closest('.technique-card');
const badge = card?.querySelector('.technique-savings');
if (badge) badge.textContent = marginalLabel;
```

The `data-savings` attribute (already on each `.technique-cb`) stores the individual savings number for unchecked-state restoration.

---

## Badge Label Format

Same format as today — the number's meaning changes, not its presentation.

| State | Badge | Meaning |
|---|---|---|
| Unchecked | `↓ ~320 tokens` | Individual savings (what adding this would gain) |
| Checked, only one checked | `↓ ~320 tokens` | Marginal = individual — no visible difference |
| Checked, multiple checked | `↓ ~42 tokens` | Contribution on top of earlier checked techniques |
| Checked, absorbed by prior | `↓ ~0 tokens` | Honest zero — prior technique already handled this |

- Approximate methods (Anthropic/Gemini): `↓ ~X tokens`
- Exact (tiktoken): `↓ X tokens`
- Zero marginal: `↓ ~0 tokens` — shown, never hidden (gating uses individual savings, not marginal)

---

## Loading State

`refreshApplyButton` (sync, fires immediately on checkbox change):
- Checked cards → `…`
- Unchecked cards → individual savings from `data-savings`

`_refreshSavingsDisplay` (300ms debounce, async):
- Updates checked card badges to real marginals
- Updates Apply button savings text

The `…` window is ≤300ms + one async tokenizer call — short enough that no spinner or skeleton is needed.

---

## Edge Cases

| Case | Behaviour |
|---|---|
| Undo mode | `_refreshSavingsDisplay` bails early (existing guard); card badges untouched |
| All unchecked | `_refreshSavingsDisplay` returns early; `refreshApplyButton` restores all badges to individual savings |
| Zero marginal (profitable technique absorbed by prior) | Shows `↓ ~0 tokens` — card stays visible; gating uses individual savings only |
| ID not in PIPELINE_ORDER | Badge retains last displayed value (safe fallback, should never occur) |

---

## What Does NOT Change

- Profitability gating — still uses individual savings measured at render time
- `updateSuggestions` — still measures individual savings in parallel; still stores them in `data-savings`
- Undo/apply logic — `handleApplyOrUndo` is untouched
- The combined savings on the Apply button — still produced by `_refreshSavingsDisplay`, still correct
- All other JS files, HTML, CSS
