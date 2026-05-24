# Suggestion UX — Expand cards with full item list + before/after preview

## Context

Today's suggestions panel (rendered by `updateSuggestions()` in `js/optimizer.js`) shows one card per detected technique with a label, a hint, and a single `example` value. This is misleading and unclear:

- "1 repeated key found (`user_name ×4`)" looks like only one key was detected, when in reality multiple were found — the full list is computed by `findRepeatableKeysInObj()` but never surfaced.
- The same happens for "Homogeneous array found": only the best candidate's path is shown.
- For filler/verbose/hedging passes, users can't see which phrases were detected.
- Users have no way to know what the transformation will actually do to their text until they click Apply and inspect the result — risky for JSON techniques that wrap output in an envelope.

The goal: make every suggestion self-explanatory by exposing the full list of detected items AND a small live before/after preview of `apply()` run on a slice of the user's actual input.

## Approach

Inline-expand each suggestion card. Collapsed cards remain exactly as today (no visual change until the user clicks). A chevron on each card opens an expanded section with:

1. **Full list of detected items** (capped at 10 with "+ N more")
2. **Before → After preview** built from the user's real input, transformed by the technique's actual `apply()` logic

State is per-card, in-memory, resets on re-render.

## Files modified

- `js/optimizer.js` — technique contract extension, preview helpers, expanded-card markup in `updateSuggestions()`
- `style.css` — expand/collapse styling, monospace blocks for items and previews
- `index.html` — no changes expected (markup generated dynamically)

## Technique contract change

Extend `detect()` to return an optional `items` array:

```
detect(text) → { label, example, savings, items?: [...] }
```

Per-technique `items` shapes:

| Technique | Item shape | Source |
|---|---|---|
| `json-keys` | `{ key, count, abbr }` | `buildKeyMapping()` already computes this |
| `schema-arrays` | `{ path, count, keys }` | `findHomogeneousArrays()` already returns this |
| `filler` | `{ phrase, count }` | Collected during existing filter scan |
| `verbose` | `{ phrase, replacement, count }` | From `VERBOSE_PATTERNS` matches |
| `overqualify` / `hedging` | `{ phrase, count }` | From pattern matches |
| `repetition` | `{ snippet, count }` | Already collected in `dupes` |
| `whitespace` | `{ issue, count }` | From the three boolean checks |
| `linebreaks` | `{ count }` | Already counted |

Add an optional `preview(text)` method per technique that returns `{ before, after }` strings:

- **Text techniques**: find the first match, take ~80 chars of surrounding context (snap to sentence boundary if possible), apply transformation to the slice.
- **JSON techniques**:
  - `json-keys`: pick a minimal object containing 1–2 affected keys, run the same `buildKeyMapping` + `renameJsonKeys` + envelope wrapping on that subtree.
  - `schema-arrays`: take the array, truncate to 2 rows + `…`, run `applySchemaExtraction` on the slice.
- **Whitespace / linebreaks**: synthetic visualization with `·` for spaces and `↵` for newlines (real text preview is invisible).

Techniques without `items` or `preview` fall back to a minimal expanded body (just the existing hint).

## UI changes in `updateSuggestions()`

The collapsed card markup is unchanged. Add to the rendered template:

```
<button class="technique-toggle" aria-expanded="false">▸</button>
<div class="technique-expanded" hidden>
  <div class="technique-items">… list of detected items …</div>
  <div class="technique-preview">
    <div class="preview-before">Before: …</div>
    <div class="preview-after">After: …</div>
  </div>
</div>
```

Event delegation on `#input-tips-list`: clicking the toggle or the card header (outside the checkbox) toggles `hidden` and flips `aria-expanded`.

Header badge fix: the card label uses `items.length` when available, so "1 repeated key found" becomes "3 repeated keys found" when 3 are detected.

## Detected-items rendering

- Up to 10 items visible; if more, show a `+ N more` link that reveals the rest.
- Sort by impact: occurrence count desc for keys/phrases; `count × keys.length` for arrays.
- Tight monospace block, reuses `.technique-example` typography so theming is inherited.
- Per-item:
  - Keys: `user_name ×12 → us_na`
  - Arrays: `root.orders · 24 rows × 6 keys`
  - Phrases: `"in order to" → "to"  ×5`
  - Sentences: truncated to ~80 chars with `…` and count badge

## Preview rendering

- Side-by-side or stacked, depending on width (CSS flex with wrap).
- Monospace, pre-wrap, max-height with scroll.
- For text techniques: removed spans rendered with `<del>` styling; inserted spans with `<ins>` styling. Theming via existing CSS custom properties.
- For JSON: pretty-printed (`JSON.stringify(value, null, 2)`), syntax-neutral.
- Whitespace markers: `·` (middle dot) for space, `↵` (return symbol) for newline, rendered with a muted color.

## Behavior preserved

- Profitability gating, profile selector, select-all, undo flow — unchanged.
- Collapsed view of each card is byte-identical to today's render.
- No persistence of expanded state across re-renders (intentional simplicity).

## Verification

Open `index.html` in the browser (`npx serve .` if needed) and paste these test inputs into the token counter tab:

1. **JSON with repeated keys** — confirm the expanded card lists every repeated multi-segment key with its abbreviation, and the preview shows a valid envelope `{__key_map, __data}`.
2. **JSON with a homogeneous array of ≥5 objects** — confirm path + count + key count appear, and the preview shows the `{__schema, __rows}` form on a truncated slice.
3. **Text with multiple filler phrases** — confirm every phrase appears once with its count, and the preview shows a sentence with the phrase struck through.
4. **Text with duplicate sentences** — confirm each duplicate snippet is listed.
5. **Text with mixed whitespace issues** — confirm each issue type is enumerated; preview shows `·` and `↵` markers in affected regions.
6. **Toggle interaction** — chevron click expands/collapses; checkbox click does NOT expand; aria-expanded flips correctly.
7. **Dark mode** — every expanded element reads cleanly; no hardcoded colors.
8. **Header label** — "N repeated keys found" reflects the real `items.length`.
9. **Collapsed appearance** — diff against current main branch shows no visual regression when no card is expanded.
10. **Profile switching / undo** — unaffected; expanded state resets on re-render as expected.
