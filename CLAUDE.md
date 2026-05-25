# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A plain static site (no build step, no framework, no package.json). The core files:

- `index.html` — markup and tab structure for both panels
- `style.css` — all styles; uses CSS custom properties for light/dark theming
- `js/utils.js` — shared helpers (escapeHtml, escapeAttr, copyToClipboard)
- `js/tokenizer.js` — token counting, tiktoken integration, cost calculation
- `js/prices.js` — model pricing data, model selector UI
- `js/optimizer.js` — token reduction techniques, suggestion UI, profitability gating
- `js/json-prettifier.js` — JSON tree renderer and prettifier UI
- `js/app.js` — entry point: theme, tabs, init, token counter UI
- `prices.json` — model pricing data fetched at runtime; edit this to update prices without touching code

Deployed on Vercel as a static site. `vercel.json` handles SPA-style routing.

## Running locally

Open `index.html` directly in a browser, or use any static file server:

```bash
npx serve .
```

No build, no install, no compile step.

## Architecture decisions to know

**Theme system** — `[data-theme="dark"]` on `<html>` overrides all CSS custom properties. An inline IIFE in `<head>` (before the stylesheet) applies the theme from `localStorage` to prevent flash of unstyled content on load.

**Tokenization** — OpenAI models use tiktoken (WASM, loaded via dynamic `import()` from jsDelivr CDN, lazy-loaded on first use, cached in `tiktokenEncoders` Map keyed by encoding name). Anthropic and Gemini use character-based approximation (~4 and ~3.5 chars/token respectively).

**Token reduction suggestions** — defined in the `TECHNIQUES` array in `js/optimizer.js`. Each entry has `id`, `detect(text)` → result or null, and `apply(text)` → cleaned text. Adding a new technique only requires adding to this array and to the ordered list in `handleApplyOrUndo()`.

**JSON tree renderer** — `renderJsonTree()` / `renderTreeNode()` build an HTML string of collapsible `<div class="jt-collapsible">` nodes. Toggle state is managed via a `folded` CSS class; click events use delegation on `#json-output`.

**Prices** — `prices.json` is fetched at load time. If it fails, `FALLBACK_MODELS` (3 hardcoded models) are used silently. To add a model: add an entry to `prices.json`; `tokenizer` must be `"tiktoken"` (with `"encoding"`) or `"approximate"` (with `"charsPerToken"`).

## Key element IDs

`token-input`, `model-select`, `result-card`, `suggestions-panel`, `clean-btn`, `select-all-btn`, `json-input`, `json-output`, `json-format-btn`, `json-minify-btn`, `json-validate-btn`

---

# Token Optimization Engine Guidelines

## Project Direction

This project is evolving from a simple token utility into a production-grade token optimization engine focused on:
- LLM prompt optimization
- JSON optimization
- structured AI payload optimization
- AI-to-AI communication efficiency

The primary goal is reducing REAL TOKEN consumption, not merely character count.

---

# Critical Optimization Principles

## Tokenizer Awareness

Never assume:
- character count == token count

Optimization decisions should become tokenizer-aware whenever possible.

Current state:
- OpenAI models use tiktoken
- Anthropic/Gemini currently use approximations

Future optimization work should be designed to support:
- provider-specific token estimators
- tokenizer abstraction layers
- real token profitability analysis

---

## JSON Safety Rules

Never manipulate raw JSON using:
- regex replacement
- substring replacement
- unsafe text replacement

Always:
1. Parse JSON
2. Traverse recursively
3. Transform structurally
4. Serialize safely

The optimizer must preserve:
- JSON validity
- semantic equivalence
- reversibility

---

# Optimization Philosophy

Priority order for optimization work:

1. Safe whitespace optimization
2. Structural deduplication
3. Repeated value optimization
4. Schema extraction
5. Token-profitable aliasing
6. Aggressive compression

Avoid premature aggressive aliasing.

---

# Compression Modes

The optimizer should support multiple compression profiles with different tradeoffs between:
- token reduction
- readability
- maintainability
- semantic safety
- debugging capability

Current/planned profiles:

## safe_readable
Prioritize:
- readability
- debugging
- maintainability

Allow:
- minification
- whitespace cleanup
- lightweight readable aliases

Avoid:
- aggressive structural compaction

---

## balanced
Prioritize:
- meaningful token reduction
- acceptable readability

Allow:
- moderate aliasing
- repeated value optimization
- schema extraction
- structural deduplication

---

## maximum_compression
Prioritize:
- lowest token count possible

Allow:
- aggressive aliases
- compact structural formats
- subtree factoring
- dictionary-heavy optimization

---

## ai_to_ai
Prioritize:
- efficient payload transmission between agents/models

Humans are not the primary audience.

Allow:
- ultra aggressive optimization
- minimal readability
- highly compact representations

---

## prompt_preservation
Prioritize:
- preserving prompt clarity
- preserving instruction quality
- minimizing semantic degradation

Avoid:
- semantic rewriting
- transformations that may reduce model understanding

---

# Alias Strategy Guidelines

Avoid aliases such as:
- no_de_de
- nu_to_de_em_en_la_em

These are:
- hard to debug
- visually noisy
- not necessarily token-efficient
- poor for tokenizer segmentation

Prefer aliases that are:
- short
- semantically recognizable
- tokenizer-friendly

Examples:
- nombre_del_departamento -> nom_dep
- fecha_de_inicio -> fec_ini

Aggressive modes may use:
- a
- b
- c

---

# Profitability Rules

Do not optimize blindly.

Every structural optimization should eventually consider:

benefit =
(tokens_saved_per_occurrence * frequency)
- metadata_cost
- dictionary_cost
- decompression_overhead

Avoid optimizations where metadata costs exceed savings.

---

# Structural Optimization Priorities

The biggest token savings likely come from:
- repeated structures
- repeated schemas
- repeated arrays
- repeated values
- repeated prompts/descriptions

Not merely from shortening keys.

Optimization work should prioritize structural gains first.

---

# Validation Requirements

Optimization changes should preserve:
- JSON validity
- reversibility
- schema consistency
- semantic equivalence

Optimization passes should be testable independently.

---

# Refactoring Philosophy

Prefer:
- incremental improvements
- modular optimization passes
- low-risk refactors
- backward compatibility
- evolutionary architecture

Avoid:
- massive rewrites
- tightly coupled optimization logic
- unsafe transformations

---

# Desired Future Architecture

Long-term direction:

Input
↓
Normalization Passes
↓
Structural Analysis
↓
Token Cost Estimation
↓
Optimization Candidate Discovery
↓
Profitability Evaluation
↓
Optimization Pipeline Execution
↓
Validation
↓
Serialization
↓
Metrics Report

---

# Metrics Goals

Future optimization work should expose:
- original token estimate
- optimized token estimate
- reduction percentage
- metadata overhead
- readability score
- semantic risk estimate

---

# Important Engineering Principle

This is NOT a generic compression engine.

This is an LLM-oriented token optimization engine.

Sometimes:
- a larger character output
may still:
- produce fewer tokens

Optimization logic should always prioritize tokenizer behavior over raw character reduction.
