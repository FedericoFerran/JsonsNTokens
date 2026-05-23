# JsonsNTokens — Design Spec

**Date:** 2026-05-23  
**Status:** Approved

---

## Overview

A static web tool with two utilities in a tabbed interface:

1. **Token Counter** — paste text, select an LLM model, see token count + estimated cost, and get suggestions for reducing token usage.
2. **JSON Prettifier** — paste raw JSON to format, minify, validate, or copy it.

Deployed as a static site on Vercel. No build step, no backend, no API keys required.

---

## Architecture

### File Structure

```
JsonsNTokens/
├── index.html       — markup, tab structure, both section panels
├── style.css        — CSS custom properties for theming, layout, all component styles
├── app.js           — all JS: tab switching, token counting, JSON logic, theme toggle, suggestions
└── prices.json      — model definitions with input/output pricing per 1M tokens
```

### Libraries (CDN)

- **tiktoken** (via jsDelivr/unpkg) — accurate BPE tokenization for OpenAI models
- No other external libraries. JSON parsing, syntax highlighting, and token approximations use browser-native APIs and lightweight regex.

### Tokenization Strategy

| Provider  | Method                                                                 |
|-----------|------------------------------------------------------------------------|
| OpenAI    | tiktoken (exact BPE tokenization, WASM-based)                          |
| Anthropic | Character-based approximation (~4 chars/token, tuned per model family) |
| Gemini    | SentencePiece-like approximation (~3.5 chars/token)                    |

A small disclaimer is shown in the UI when approximation is used.

---

## Pricing Data (`prices.json`)

Prices are stored in a `prices.json` file fetched by `app.js` at load time. Structure:

```json
{
  "claude-haiku-4-5": {
    "provider": "Anthropic",
    "label": "Claude Haiku 4.5",
    "inputPer1M": 0.80,
    "outputPer1M": 4.00,
    "tokenizer": "approximate"
  },
  "gpt-4o": {
    "provider": "OpenAI",
    "label": "GPT-4o",
    "inputPer1M": 2.50,
    "outputPer1M": 10.00,
    "tokenizer": "tiktoken"
  }
}
```

To update pricing: edit `prices.json`, commit, and push — Vercel redeploys automatically.

The UI shows a "Prices as of May 2026 — verify at provider" note with links to official pricing pages.

### Supported Models (initial list)

**Anthropic:** claude-haiku-4-5, claude-sonnet-4-6, claude-opus-4-7  
**OpenAI:** gpt-3.5-turbo, gpt-4, gpt-4o, gpt-4o-mini  
**Gemini:** gemini-1.5-flash, gemini-1.5-pro, gemini-2.0-flash, gemini-2.5-pro

---

## Visual Design Direction

**Minimal / Modern** — clean sans-serif typography (Inter or system-ui), indigo/violet accent palette, soft shadows, generous whitespace. Polished and approachable, like a premium SaaS tool. Works beautifully in both light and dark modes.

### Design Tokens

```css
:root {
  /* Light mode */
  --bg: #fafafa;
  --surface: #ffffff;
  --surface-2: #f3f4f6;
  --border: #e5e7eb;
  --text: #111827;
  --text-muted: #6b7280;
  --accent: #6366f1;          /* indigo */
  --accent-hover: #4f46e5;
  --accent-subtle: #eef2ff;
  --accent-text: #4f46e5;
  --success: #059669;
  --success-subtle: #ecfdf5;
  --error: #dc2626;
  --error-subtle: #fef2f2;
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
  --shadow: 0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06);
  --radius: 8px;
}

[data-theme="dark"] {
  --bg: #09090b;
  --surface: #18181b;
  --surface-2: #27272a;
  --border: #3f3f46;
  --text: #fafafa;
  --text-muted: #a1a1aa;
  --accent: #818cf8;          /* lighter indigo for dark bg */
  --accent-hover: #6366f1;
  --accent-subtle: #1e1b4b;
  --accent-text: #a5b4fc;
  --success: #34d399;
  --success-subtle: #022c22;
  --error: #f87171;
  --error-subtle: #450a0a;
}
```

### Typography

- **Font:** `Inter, system-ui, sans-serif` for UI; `'JetBrains Mono', 'Fira Code', monospace` for code/JSON/token output
- **App name:** bold, slight negative letter-spacing (-0.5px), gradient text (indigo → violet)
- **Labels:** small, uppercase, letter-spaced (`font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em`)
- **Token count result:** large (2.5rem), bold, accent color — the hero number

### Component Style

- **Inputs/textareas:** white background (light) / `--surface` (dark), `1px solid --border`, `--radius`, subtle `--shadow-sm`, focus ring using `--accent` at 30% opacity
- **Buttons (primary):** `--accent` background, white text, `--radius`, transitions on hover/active, subtle shadow
- **Buttons (secondary):** outlined (`1px solid --border`), `--text-muted` text
- **Tabs:** pill-style active tab with `--accent` background and white text; inactive tabs are plain text
- **Result card:** `--accent-subtle` background with left border in `--accent`, rounded corners
- **Suggestions panel:** subtle card with `--surface-2` background, divided into two subsections

---

## UI & Layout

### Header

- App name (gradient indigo→violet, bold) and tagline on the left
- Dark/light theme toggle button (sun/moon icon) on the right — smooth icon transition
- Theme preference saved to `localStorage` and restored on load
- Max-width container (`860px`) centered on page with horizontal padding

### Tab Bar

Two pill-style tabs below the header: **Token Counter** | **JSON Prettifier**  
Active tab has `--accent` background with white text; inactive is plain. Clicking switches the visible panel. State is in-memory only (no URL routing needed).

---

## Token Counter Section

### Inputs

- **Textarea** — user pastes or types text; token count updates live on `input` event
- **Model selector** — `<select>` with `<optgroup>` grouping by provider (Anthropic / OpenAI / Gemini)

### Results Display

Shows immediately below the inputs:

- Token count (large, prominent)
- Estimated input cost at current pricing
- Estimated output cost (informational — shows cost per 1M output tokens for the selected model)
- Disclaimer label when using approximation: "~estimated (no public tokenizer)"

### Token Reduction Suggestions Panel

Appears below the results. Two subsections:

#### Input Tips (dynamic — analyzed from pasted text)

Regex-based analysis flags:
- Filler phrases: "please", "could you please", "I would like you to", "as an AI", "as a language model", "feel free to", "certainly", "of course"
- Verbose patterns: "in order to" → "to", "due to the fact that" → "because", "at this point in time" → "now"
- Redundant whitespace: multiple consecutive blank lines, trailing spaces
- Repeated punctuation or excessive capitalization

Each finding shows: description + estimated token savings.

**"Clean it" button:** applies all safe automatic reductions (filler removal, whitespace normalization, verbose phrase substitution) directly to the textarea. The original text is stored in a single `previousText` variable. The button label changes to **"↩ Undo"**. Clicking Undo restores the original text and resets the button. One level of undo only.

#### Output Tips (static — best practices checklist)

A fixed list of prompt additions that reduce output token consumption:

- Add `"Be concise."` to the prompt
- Add `"Answer in bullet points."`
- Add `"Limit your response to X words/sentences."`
- Use `"Answer only with [format]"` to constrain output shape
- Prefer structured output (JSON, XML) over prose when the consumer is code
- Avoid open-ended questions at the end of prompts (they invite elaboration)

Shown as a styled list with copy icons per item so users can quickly grab individual instructions.

---

## JSON Prettifier Section

### Inputs

- **Textarea** — user pastes raw JSON

### Action Buttons

| Button       | Behavior                                                                 |
|--------------|--------------------------------------------------------------------------|
| **Format**   | `JSON.parse()` + `JSON.stringify(null, 2)` — pretty-prints with 2-space indent |
| **Minify**   | `JSON.parse()` + `JSON.stringify()` — compact, no whitespace             |
| **Validate** | Attempts `JSON.parse()`; on failure shows friendly error with line/column |
| **Copy**     | Copies output to clipboard; button label changes to "Copied ✓" for 2s   |

### Output Panel

- Monospace font
- Syntax highlighting via lightweight regex highlighter (no library):
  - Keys — one accent color
  - String values — another color
  - Numbers, booleans, null — distinct color
- Error messages shown inline in the output panel with red styling

---

## Theme System

CSS custom properties on `:root` define all design tokens (see Visual Design Direction above). A `[data-theme="dark"]` selector on `<html>` overrides them. JS toggles the attribute and writes to `localStorage`. Default theme is detected from `prefers-color-scheme` on first visit.

---

## Error Handling

- **JSON parse errors:** caught with `try/catch`, error message parsed for line/column, shown in output panel
- **tiktoken load failure:** graceful fallback to character-based approximation with a UI notice
- **prices.json fetch failure:** fallback to a hardcoded minimal model list with a UI notice
- **Clipboard API unavailable:** Copy button shows "Not supported" instead of erroring silently

---

## Deployment

- Push to GitHub → Vercel auto-detects static site (no framework), serves `index.html` as root
- No environment variables, no build config needed
- `.superpowers/` added to `.gitignore`
