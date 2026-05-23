# JsonsNTokens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static HTML/CSS/JS web tool with a Token Counter (Anthropic, OpenAI, Gemini) and JSON Prettifier, deployed on Vercel.

**Architecture:** Four files — `index.html` (markup + tabs), `style.css` (design tokens + all component styles), `app.js` (all logic), `prices.json` (model pricing). No build step. tiktoken loaded via CDN for OpenAI; Anthropic and Gemini use character-based approximations. All state is in-memory; theme preference is in `localStorage`.

**Tech Stack:** Vanilla HTML/CSS/JS, tiktoken WASM via CDN (jsDelivr), Vercel static hosting.

---

## File Map

| File | Responsibility |
|------|---------------|
| `index.html` | Full document markup — header, tabs, token counter panel, JSON prettifier panel |
| `style.css` | All CSS — design tokens (light/dark), layout, every component style |
| `app.js` | All JS — theme, tabs, prices loading, tokenization, token counter, suggestions, JSON tools |
| `prices.json` | Model list with provider, label, inputPer1M, outputPer1M, tokenizer type |
| `.gitignore` | Ignore `.superpowers/`, `node_modules/`, `.DS_Store`, `Thumbs.db` |

---

## Task 1: Project scaffold + git init

**Files:**
- Create: `.gitignore`
- Create: `README.md`

- [ ] **Step 1: Initialise git repo**

```bash
cd C:/Users/feder/Documents/Repos/JsonsNTokens
git init
```

Expected output: `Initialized empty Git repository in ...`

- [ ] **Step 2: Create `.gitignore`**

Create `.gitignore` with this content:

```
.superpowers/
node_modules/
.DS_Store
Thumbs.db
```

- [ ] **Step 3: Create `README.md`**

Create `README.md` with this content:

```markdown
# JsonsNTokens

A static web tool for LLM developers.

- **Token Counter** — count tokens for Anthropic, OpenAI, and Gemini models with live cost estimates and prompt optimization tips.
- **JSON Prettifier** — format, minify, validate, and copy JSON with syntax highlighting.

## Usage

Open `index.html` in a browser, or deploy to Vercel by pushing to GitHub.

## Updating prices

Edit `prices.json` and push — Vercel redeploys automatically.
```

- [ ] **Step 4: Commit**

```bash
git add .gitignore README.md docs/
git commit -m "chore: project scaffold and spec docs"
```

---

## Task 2: `prices.json` — model pricing data

**Files:**
- Create: `prices.json`

- [ ] **Step 1: Create `prices.json`**

```json
{
  "claude-haiku-4-5": {
    "provider": "Anthropic",
    "label": "Claude Haiku 4.5",
    "inputPer1M": 0.80,
    "outputPer1M": 4.00,
    "tokenizer": "approximate",
    "charsPerToken": 4.0
  },
  "claude-sonnet-4-6": {
    "provider": "Anthropic",
    "label": "Claude Sonnet 4.6",
    "inputPer1M": 3.00,
    "outputPer1M": 15.00,
    "tokenizer": "approximate",
    "charsPerToken": 4.0
  },
  "claude-opus-4-7": {
    "provider": "Anthropic",
    "label": "Claude Opus 4.7",
    "inputPer1M": 15.00,
    "outputPer1M": 75.00,
    "tokenizer": "approximate",
    "charsPerToken": 4.0
  },
  "gpt-3.5-turbo": {
    "provider": "OpenAI",
    "label": "GPT-3.5 Turbo",
    "inputPer1M": 0.50,
    "outputPer1M": 1.50,
    "tokenizer": "tiktoken",
    "encoding": "cl100k_base"
  },
  "gpt-4": {
    "provider": "OpenAI",
    "label": "GPT-4",
    "inputPer1M": 30.00,
    "outputPer1M": 60.00,
    "tokenizer": "tiktoken",
    "encoding": "cl100k_base"
  },
  "gpt-4o": {
    "provider": "OpenAI",
    "label": "GPT-4o",
    "inputPer1M": 2.50,
    "outputPer1M": 10.00,
    "tokenizer": "tiktoken",
    "encoding": "o200k_base"
  },
  "gpt-4o-mini": {
    "provider": "OpenAI",
    "label": "GPT-4o Mini",
    "inputPer1M": 0.15,
    "outputPer1M": 0.60,
    "tokenizer": "tiktoken",
    "encoding": "o200k_base"
  },
  "gemini-1.5-flash": {
    "provider": "Gemini",
    "label": "Gemini 1.5 Flash",
    "inputPer1M": 0.075,
    "outputPer1M": 0.30,
    "tokenizer": "approximate",
    "charsPerToken": 3.5
  },
  "gemini-1.5-pro": {
    "provider": "Gemini",
    "label": "Gemini 1.5 Pro",
    "inputPer1M": 1.25,
    "outputPer1M": 5.00,
    "tokenizer": "approximate",
    "charsPerToken": 3.5
  },
  "gemini-2.0-flash": {
    "provider": "Gemini",
    "label": "Gemini 2.0 Flash",
    "inputPer1M": 0.10,
    "outputPer1M": 0.40,
    "tokenizer": "approximate",
    "charsPerToken": 3.5
  },
  "gemini-2.5-pro": {
    "provider": "Gemini",
    "label": "Gemini 2.5 Pro",
    "inputPer1M": 1.25,
    "outputPer1M": 10.00,
    "tokenizer": "approximate",
    "charsPerToken": 3.5
  }
}
```

- [ ] **Step 2: Verify JSON is valid**

Open a browser console and run:
```js
fetch('prices.json').then(r => r.json()).then(d => console.log(Object.keys(d)))
```
Expected: array of 11 model keys logged with no errors.

- [ ] **Step 3: Commit**

```bash
git add prices.json
git commit -m "feat: add model pricing data"
```

---

## Task 3: `style.css` — design tokens and base styles

**Files:**
- Create: `style.css`

- [ ] **Step 1: Create `style.css` with reset, design tokens, and base styles**

```css
/* ===== RESET ===== */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

/* ===== DESIGN TOKENS — LIGHT MODE ===== */
:root {
  --bg: #fafafa;
  --surface: #ffffff;
  --surface-2: #f3f4f6;
  --border: #e5e7eb;
  --text: #111827;
  --text-muted: #6b7280;
  --accent: #6366f1;
  --accent-hover: #4f46e5;
  --accent-subtle: #eef2ff;
  --accent-text: #4f46e5;
  --success: #059669;
  --success-subtle: #ecfdf5;
  --error: #dc2626;
  --error-subtle: #fef2f2;
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow: 0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06);
  --radius: 8px;
}

/* ===== DESIGN TOKENS — DARK MODE ===== */
[data-theme="dark"] {
  --bg: #09090b;
  --surface: #18181b;
  --surface-2: #27272a;
  --border: #3f3f46;
  --text: #fafafa;
  --text-muted: #a1a1aa;
  --accent: #818cf8;
  --accent-hover: #6366f1;
  --accent-subtle: #1e1b4b;
  --accent-text: #a5b4fc;
  --success: #34d399;
  --success-subtle: #022c22;
  --error: #f87171;
  --error-subtle: #450a0a;
}

/* ===== BASE ===== */
body {
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  background: var(--bg);
  color: var(--text);
  min-height: 100vh;
  transition: background 0.2s ease, color 0.2s ease;
  line-height: 1.5;
}

.app-wrapper {
  max-width: 860px;
  margin: 0 auto;
  padding: 0 20px 80px;
}

a { color: var(--accent-text); text-decoration: none; }
a:hover { text-decoration: underline; }

/* ===== TYPOGRAPHY HELPERS ===== */
.label {
  display: block;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  margin-bottom: 6px;
}

.subtitle {
  font-size: 13px;
  color: var(--text-muted);
}

/* ===== HEADER ===== */
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28px 0 22px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 28px;
}

.brand-name {
  font-size: 22px;
  font-weight: 800;
  letter-spacing: -0.5px;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.brand-tagline {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 2px;
}

.theme-btn {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  border: 1px solid var(--border);
  background: var(--surface);
  cursor: pointer;
  font-size: 17px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow-sm);
  transition: border-color 0.15s, box-shadow 0.15s;
  flex-shrink: 0;
}

.theme-btn:hover {
  border-color: var(--accent);
  box-shadow: var(--shadow);
}

/* ===== TABS ===== */
.tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 28px;
  background: var(--surface-2);
  padding: 4px;
  border-radius: 10px;
  width: fit-content;
  border: 1px solid var(--border);
}

.tab-btn {
  padding: 8px 22px;
  border-radius: 7px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: all 0.15s ease;
  color: var(--text-muted);
  background: transparent;
  font-family: inherit;
}

.tab-btn.active {
  background: var(--accent);
  color: #ffffff;
  box-shadow: var(--shadow);
}

.tab-btn:not(.active):hover {
  color: var(--text);
  background: var(--surface);
}

/* ===== PANELS ===== */
.panel { display: none; }
.panel.active { display: block; }

/* ===== FORM ELEMENTS ===== */
.form-row { margin-bottom: 18px; }

select,
textarea,
input[type="text"] {
  width: 100%;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text);
  font-family: inherit;
  font-size: 14px;
  padding: 10px 12px;
  box-shadow: var(--shadow-sm);
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
  appearance: none;
  -webkit-appearance: none;
}

select {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%236b7280' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  padding-right: 36px;
  cursor: pointer;
}

select:focus,
textarea:focus,
input[type="text"]:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
}

textarea { resize: vertical; line-height: 1.6; }

/* ===== BUTTONS ===== */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 9px 18px;
  border-radius: var(--radius);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: all 0.15s ease;
  font-family: inherit;
  white-space: nowrap;
}

.btn-primary {
  background: var(--accent);
  color: #ffffff;
  box-shadow: var(--shadow-sm);
}
.btn-primary:hover { background: var(--accent-hover); box-shadow: var(--shadow); }
.btn-primary:active { transform: translateY(1px); }

.btn-secondary {
  background: var(--surface);
  color: var(--text);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-sm);
}
.btn-secondary:hover { border-color: var(--accent); color: var(--accent-text); }

.btn-ghost {
  background: transparent;
  color: var(--text-muted);
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 600;
  border: 1px solid var(--border);
  border-radius: 5px;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.15s;
  white-space: nowrap;
}
.btn-ghost:hover { color: var(--text); border-color: var(--text-muted); }

.btn-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 20px;
}

/* ===== RESULT CARD ===== */
.result-card {
  background: var(--accent-subtle);
  border: 1px solid var(--accent);
  border-left: 4px solid var(--accent);
  border-radius: var(--radius);
  padding: 18px 20px;
  margin: 20px 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 80px;
}

.result-card.hidden { display: none; }

.result-count {
  font-size: 2.5rem;
  font-weight: 800;
  color: var(--accent-text);
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  letter-spacing: -1px;
  line-height: 1;
}

.result-count .unit {
  font-size: 1rem;
  font-weight: 500;
  color: var(--text-muted);
  letter-spacing: 0;
  margin-left: 4px;
}

.result-costs {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
  margin-top: 6px;
}

.result-cost-item {
  font-size: 12px;
  color: var(--text-muted);
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
}

.result-cost-item strong { color: var(--text); font-weight: 600; }

.result-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
}

.badge {
  display: inline-block;
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 600;
  background: var(--surface-2);
  color: var(--text-muted);
  border: 1px solid var(--border);
}

.result-icon { font-size: 26px; line-height: 1; }

/* ===== SUGGESTIONS PANEL ===== */
.suggestions {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
  box-shadow: var(--shadow-sm);
  margin-top: 4px;
}

.suggestions.hidden { display: none; }

.suggestions-header {
  padding: 12px 16px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
  background: var(--surface-2);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  gap: 8px;
}

.suggestions-section { padding: 14px 16px; }
.suggestions-section + .suggestions-section { border-top: 1px solid var(--border); }

.suggestions-section-title {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  margin-bottom: 12px;
}

.tip-item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid var(--border);
}
.tip-item:last-of-type { border-bottom: none; }

.tip-item-label { font-size: 13px; color: var(--text); }
.tip-item-savings { font-size: 11px; color: var(--success); font-weight: 600; margin-top: 2px; }

.clean-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
}

.clean-savings { font-size: 12px; color: var(--text-muted); }

.output-tip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid var(--border);
  font-size: 13px;
  color: var(--text);
}
.output-tip:last-child { border-bottom: none; }

.output-tip code {
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 12px;
  background: var(--surface-2);
  padding: 2px 7px;
  border-radius: 4px;
  color: var(--accent-text);
  border: 1px solid var(--border);
}

.copy-snippet-btn {
  flex-shrink: 0;
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 600;
  border-radius: 5px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-muted);
  cursor: pointer;
  font-family: inherit;
  transition: all 0.15s;
}
.copy-snippet-btn:hover { border-color: var(--accent); color: var(--accent-text); }

/* ===== PRICES FOOTER ===== */
.prices-note {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 16px;
  text-align: right;
}

/* ===== JSON PRETTIFIER ===== */
.json-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.json-panel { display: flex; flex-direction: column; gap: 6px; }

.json-output {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 12px 14px;
  min-height: 260px;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 12.5px;
  line-height: 1.7;
  overflow: auto;
  box-shadow: var(--shadow-sm);
  white-space: pre;
  word-break: break-all;
}

.json-output.error {
  background: var(--error-subtle);
  border-color: var(--error);
  color: var(--error);
  font-size: 13px;
  white-space: pre-wrap;
}

/* JSON syntax highlight colours */
.jk { color: #6366f1; }                         /* key */
.js { color: #059669; }                          /* string value */
.jn { color: #d97706; }                          /* number */
.jb { color: #dc2626; }                          /* boolean / null */

[data-theme="dark"] .jk { color: #a5b4fc; }
[data-theme="dark"] .js { color: #34d399; }
[data-theme="dark"] .jn { color: #fbbf24; }
[data-theme="dark"] .jb { color: #f87171; }

.json-copy-row {
  display: flex;
  justify-content: flex-end;
}

.json-copy-btn {
  padding: 5px 14px;
  font-size: 12px;
  font-weight: 600;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-muted);
  cursor: pointer;
  font-family: inherit;
  transition: all 0.15s;
}
.json-copy-btn:hover { border-color: var(--accent); color: var(--accent-text); }

/* ===== RESPONSIVE ===== */
@media (max-width: 640px) {
  .json-grid { grid-template-columns: 1fr; }
  .result-card { flex-direction: column; align-items: flex-start; }
  .result-meta { align-items: flex-start; flex-direction: row; }
  .tabs { width: 100%; }
  .tab-btn { flex: 1; text-align: center; padding: 8px 12px; }
}
```

- [ ] **Step 2: Verify tokens file loads correctly**

Create a minimal `index.html` for quick visual check:

```html
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><link rel="stylesheet" href="style.css"></head>
<body>
  <div class="app-wrapper">
    <p style="margin-top:20px">CSS loads — background should be #fafafa</p>
    <button class="btn btn-primary">Primary</button>
    <button class="btn btn-secondary">Secondary</button>
  </div>
</body>
</html>
```

Open in browser. Background should be near-white (#fafafa), buttons styled.

- [ ] **Step 3: Commit**

```bash
git add style.css
git commit -m "feat: add design tokens and base styles"
```

---

## Task 4: `index.html` — full document markup

**Files:**
- Create/Replace: `index.html`

- [ ] **Step 1: Write `index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>JsonsNTokens — Token Counter & JSON Prettifier</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="style.css" />
</head>
<body>
<div class="app-wrapper">

  <!-- HEADER -->
  <header>
    <div>
      <div class="brand-name">JsonsNTokens</div>
      <div class="brand-tagline">Token counter &amp; JSON prettifier for LLM developers</div>
    </div>
    <button class="theme-btn" id="theme-btn" title="Toggle light/dark mode" aria-label="Toggle theme">
      <span id="theme-icon">🌙</span>
    </button>
  </header>

  <!-- TABS -->
  <div class="tabs" role="tablist">
    <button class="tab-btn active" id="tab-tokens" role="tab" aria-selected="true" aria-controls="panel-tokens">
      ⚡ Token Counter
    </button>
    <button class="tab-btn" id="tab-json" role="tab" aria-selected="false" aria-controls="panel-json">
      { } JSON Prettifier
    </button>
  </div>

  <!-- ===== TOKEN COUNTER PANEL ===== -->
  <div class="panel active" id="panel-tokens" role="tabpanel" aria-labelledby="tab-tokens">

    <div class="form-row">
      <label class="label" for="model-select">Model</label>
      <select id="model-select">
        <!-- populated by app.js from prices.json -->
      </select>
    </div>

    <div class="form-row">
      <label class="label" for="token-input">Your text or prompt</label>
      <textarea
        id="token-input"
        rows="7"
        placeholder="Paste your prompt or text here — token count updates as you type…"
      ></textarea>
    </div>

    <!-- Result card (hidden until text entered) -->
    <div class="result-card hidden" id="result-card">
      <div>
        <div class="result-count">
          <span id="result-count-num">0</span><span class="unit">tokens</span>
        </div>
        <div class="result-costs">
          <div class="result-cost-item">
            <strong>Input cost:</strong> <span id="result-input-cost">—</span>
          </div>
          <div class="result-cost-item">
            <strong>Output / 1M:</strong> <span id="result-output-rate">—</span>
          </div>
        </div>
      </div>
      <div class="result-meta">
        <span class="result-icon">⚡</span>
        <span class="badge" id="result-badge" style="display:none">~ estimated</span>
      </div>
    </div>

    <!-- Suggestions panel (hidden until text entered) -->
    <div class="suggestions hidden" id="suggestions-panel">
      <div class="suggestions-header">
        💡 Token Reduction Tips
        <span class="badge" id="tips-count-badge">0 suggestions</span>
      </div>

      <!-- Input tips -->
      <div class="suggestions-section" id="input-tips-section">
        <div class="suggestions-section-title">Input Analysis</div>
        <div id="input-tips-list">
          <!-- populated by app.js -->
        </div>
        <div class="clean-row" id="clean-row" style="display:none">
          <button class="btn btn-primary" id="clean-btn">✨ Clean it</button>
          <span class="clean-savings" id="clean-savings-text"></span>
        </div>
      </div>

      <!-- Output tips -->
      <div class="suggestions-section">
        <div class="suggestions-section-title">Output Reduction Tips</div>
        <div id="output-tips-list">
          <!-- populated by app.js -->
        </div>
      </div>
    </div>

    <div class="prices-note" id="prices-note" style="display:none">
      Prices as of May 2026 —
      <a href="https://www.anthropic.com/pricing" target="_blank" rel="noopener">Anthropic</a> ·
      <a href="https://openai.com/pricing" target="_blank" rel="noopener">OpenAI</a> ·
      <a href="https://cloud.google.com/vertex-ai/generative-ai/pricing" target="_blank" rel="noopener">Gemini</a>
    </div>

  </div><!-- /panel-tokens -->

  <!-- ===== JSON PRETTIFIER PANEL ===== -->
  <div class="panel" id="panel-json" role="tabpanel" aria-labelledby="tab-json">

    <div class="btn-row">
      <button class="btn btn-primary" id="json-format-btn">Format</button>
      <button class="btn btn-secondary" id="json-minify-btn">Minify</button>
      <button class="btn btn-secondary" id="json-validate-btn">Validate</button>
    </div>

    <div class="json-grid">
      <div class="json-panel">
        <span class="label">Input</span>
        <textarea
          id="json-input"
          rows="14"
          style="font-family:'JetBrains Mono','Fira Code',monospace;font-size:13px;"
          placeholder='Paste your JSON here…'
        ></textarea>
      </div>

      <div class="json-panel">
        <span class="label">Output</span>
        <div class="json-output" id="json-output" aria-live="polite">
          <!-- populated by app.js -->
        </div>
        <div class="json-copy-row">
          <button class="json-copy-btn" id="json-copy-btn">📋 Copy</button>
        </div>
      </div>
    </div>

  </div><!-- /panel-json -->

</div><!-- /app-wrapper -->

<script src="app.js" defer></script>
</body>
</html>
```

- [ ] **Step 2: Verify markup in browser**

Open `index.html`. You should see:
- Gradient brand name "JsonsNTokens"
- Tagline below it
- Moon icon button top-right
- Two pill tabs: "⚡ Token Counter" (active/indigo) and "{ } JSON Prettifier"
- Model select (empty — JS not loaded yet) and textarea below
- No JS errors in console

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: add HTML markup skeleton"
```

---

## Task 5: `app.js` — theme toggle and tab switching

**Files:**
- Create: `app.js`

- [ ] **Step 1: Create `app.js` with theme and tab logic**

```js
/* ============================================================
   JsonsNTokens — app.js
   Sections: Theme | Tabs | Prices | Tokenizer | Token Counter
             Suggestions | JSON Prettifier
   ============================================================ */

'use strict';

// ── THEME ──────────────────────────────────────────────────────────────────

const THEME_KEY = 'jnt-theme';

function getInitialTheme() {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored) return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.getElementById('theme-icon').textContent = theme === 'dark' ? '☀️' : '🌙';
  localStorage.setItem(THEME_KEY, theme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

// ── TABS ───────────────────────────────────────────────────────────────────

function switchTab(tabId) {
  // Deactivate all tabs and panels
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
    btn.setAttribute('aria-selected', 'false');
  });
  document.querySelectorAll('.panel').forEach(panel => {
    panel.classList.remove('active');
  });

  // Activate chosen tab and panel
  const tab = document.getElementById('tab-' + tabId);
  const panel = document.getElementById('panel-' + tabId);
  tab.classList.add('active');
  tab.setAttribute('aria-selected', 'true');
  panel.classList.add('active');
}

// ── INIT ───────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  // Theme
  applyTheme(getInitialTheme());
  document.getElementById('theme-btn').addEventListener('click', toggleTheme);

  // Tabs
  document.getElementById('tab-tokens').addEventListener('click', () => switchTab('tokens'));
  document.getElementById('tab-json').addEventListener('click', () => switchTab('json'));

  // Load everything else (prices → model selector → token counter → suggestions → JSON)
  initApp();
});

async function initApp() {
  await loadPrices();
  initTokenCounter();
  initSuggestions();
  initJsonPrettifier();
}
```

- [ ] **Step 2: Verify in browser**

Open `index.html`. Test:
1. Page loads with correct theme (follows OS setting on first visit)
2. Clicking 🌙 toggles to dark mode, icon becomes ☀️
3. Reload — dark mode persists
4. Clicking tabs switches visible panel (Token Counter ↔ JSON Prettifier)
5. No console errors

- [ ] **Step 3: Commit**

```bash
git add app.js
git commit -m "feat: theme toggle and tab switching"
```

---

## Task 6: `app.js` — prices loading and model selector

**Files:**
- Modify: `app.js` (append after the init section)

- [ ] **Step 1: Append prices + model selector code to `app.js`**

Add this after the `initApp` function:

```js
// ── PRICES & MODEL SELECTOR ────────────────────────────────────────────────

let MODELS = {};  // populated by loadPrices()

// Fallback model list used if prices.json fails to load
const FALLBACK_MODELS = {
  'claude-sonnet-4-6': { provider: 'Anthropic', label: 'Claude Sonnet 4.6', inputPer1M: 3.00, outputPer1M: 15.00, tokenizer: 'approximate', charsPerToken: 4.0 },
  'gpt-4o':            { provider: 'OpenAI',    label: 'GPT-4o',            inputPer1M: 2.50, outputPer1M: 10.00, tokenizer: 'tiktoken',    encoding: 'o200k_base' },
  'gemini-2.0-flash':  { provider: 'Gemini',    label: 'Gemini 2.0 Flash',  inputPer1M: 0.10, outputPer1M: 0.40,  tokenizer: 'approximate', charsPerToken: 3.5 },
};

async function loadPrices() {
  try {
    const res = await fetch('prices.json');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    MODELS = await res.json();
  } catch (err) {
    console.warn('prices.json failed to load, using fallback:', err.message);
    MODELS = FALLBACK_MODELS;
    showPricesError();
  }
  populateModelSelector();
}

function showPricesError() {
  const note = document.getElementById('prices-note');
  note.textContent = '⚠ Could not load prices.json — using a limited model list.';
  note.style.display = 'block';
  note.style.color = 'var(--error)';
}

function populateModelSelector() {
  const select = document.getElementById('model-select');
  select.innerHTML = '';

  // Group by provider
  const groups = {};
  for (const [id, model] of Object.entries(MODELS)) {
    if (!groups[model.provider]) groups[model.provider] = [];
    groups[model.provider].push({ id, ...model });
  }

  for (const [provider, models] of Object.entries(groups)) {
    const group = document.createElement('optgroup');
    group.label = provider;
    for (const m of models) {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = m.label;
      group.appendChild(opt);
    }
    select.appendChild(group);
  }
}

function getSelectedModel() {
  const id = document.getElementById('model-select').value;
  return { id, ...MODELS[id] };
}
```

- [ ] **Step 2: Verify in browser**

Open `index.html`. The model dropdown should now show:
- Optgroup "Anthropic" with 3 models
- Optgroup "OpenAI" with 4 models
- Optgroup "Gemini" with 4 models

- [ ] **Step 3: Commit**

```bash
git add app.js
git commit -m "feat: load prices.json and populate model selector"
```

---

## Task 7: `app.js` — tokenizer (approximate + tiktoken)

**Files:**
- Modify: `app.js` (append)

- [ ] **Step 1: Append tokenizer code to `app.js`**

```js
// ── TOKENIZER ──────────────────────────────────────────────────────────────

let tiktokenEncoder = null;     // cached tiktoken encoder instance
let tiktokenLoading = false;
let tiktokenFailed = false;

/**
 * Count tokens for the given text using the selected model.
 * Returns { count: number, method: 'exact' | 'approximate' }
 */
async function countTokens(text, model) {
  if (!text) return { count: 0, method: 'exact' };

  if (model.tokenizer === 'tiktoken') {
    return await countWithTiktoken(text, model.encoding);
  }

  // Approximate: chars / charsPerToken, minimum 1 token per word
  const charsPerToken = model.charsPerToken || 4.0;
  const charBased = Math.ceil(text.length / charsPerToken);
  const wordBased = text.trim().split(/\s+/).filter(Boolean).length;
  const count = Math.max(charBased, wordBased);
  return { count, method: 'approximate' };
}

async function countWithTiktoken(text, encoding) {
  if (tiktokenFailed) {
    // Fallback to approximation if tiktoken couldn't load
    const count = Math.ceil(text.length / 4.0);
    return { count, method: 'approximate' };
  }

  try {
    if (!tiktokenEncoder) {
      tiktokenEncoder = await loadTiktoken(encoding);
    }
    const tokens = tiktokenEncoder.encode(text);
    return { count: tokens.length, method: 'exact' };
  } catch (err) {
    console.warn('tiktoken error, falling back to approximation:', err.message);
    tiktokenFailed = true;
    const count = Math.ceil(text.length / 4.0);
    return { count, method: 'approximate' };
  }
}

async function loadTiktoken(encoding) {
  // Dynamically load tiktoken from CDN
  const { get_encoding } = await import(
    'https://cdn.jsdelivr.net/npm/tiktoken@1.0.15/+esm'
  );
  return get_encoding(encoding);
}

/**
 * Format a cost in USD. Shows 4 decimal places for small values.
 */
function formatCost(usd) {
  if (usd === 0) return '$0.00';
  if (usd < 0.0001) return '<$0.0001';
  if (usd < 0.01)   return '$' + usd.toFixed(4);
  return '$' + usd.toFixed(4);
}

/**
 * Calculate cost given token count and price per 1M tokens.
 */
function calcCost(tokens, per1M) {
  return (tokens / 1_000_000) * per1M;
}
```

- [ ] **Step 2: Verify in browser console**

Open browser DevTools console on `index.html` and test:

```js
// After page loads, run manually in console:
countTokens("Hello world, this is a test.", { tokenizer: 'approximate', charsPerToken: 4.0 })
  .then(r => console.log(r));
// Expected: { count: 8 (approx), method: 'approximate' }

countTokens("Hello world", { tokenizer: 'tiktoken', encoding: 'o200k_base' })
  .then(r => console.log(r));
// Expected: { count: 3, method: 'exact' } (tiktoken loads from CDN)
```

- [ ] **Step 3: Commit**

```bash
git add app.js
git commit -m "feat: tokenizer with tiktoken + approximation fallback"
```

---

## Task 8: `app.js` — live token counter UI

**Files:**
- Modify: `app.js` (append)

- [ ] **Step 1: Append token counter UI logic to `app.js`**

```js
// ── TOKEN COUNTER UI ───────────────────────────────────────────────────────

let countDebounceTimer = null;

function initTokenCounter() {
  const input = document.getElementById('token-input');
  const modelSelect = document.getElementById('model-select');

  input.addEventListener('input', () => {
    clearTimeout(countDebounceTimer);
    countDebounceTimer = setTimeout(updateTokenCount, 120);
  });

  modelSelect.addEventListener('change', updateTokenCount);

  // Show prices note once model is selected
  document.getElementById('prices-note').style.display = 'block';
}

async function updateTokenCount() {
  const text = document.getElementById('token-input').value;
  const model = getSelectedModel();

  if (!text.trim()) {
    document.getElementById('result-card').classList.add('hidden');
    document.getElementById('suggestions-panel').classList.add('hidden');
    return;
  }

  const { count, method } = await countTokens(text, model);

  // Update result card
  document.getElementById('result-count-num').textContent = count.toLocaleString();

  const inputCost = calcCost(count, model.inputPer1M);
  document.getElementById('result-input-cost').textContent = formatCost(inputCost);
  document.getElementById('result-output-rate').textContent = '$' + model.outputPer1M.toFixed(2);

  const badge = document.getElementById('result-badge');
  if (method === 'approximate') {
    badge.style.display = 'inline-block';
  } else {
    badge.style.display = 'none';
  }

  document.getElementById('result-card').classList.remove('hidden');

  // Trigger suggestions update
  updateSuggestions(text);
}
```

- [ ] **Step 2: Verify in browser**

Open `index.html`, switch to Token Counter tab:
1. Type "Hello world" in textarea → result card appears with a token count and cost
2. Select a different model → count and costs update
3. Select an OpenAI model → badge disappears (exact count); select Anthropic → badge shows "~ estimated"
4. Clear the textarea → result card disappears

- [ ] **Step 3: Commit**

```bash
git add app.js
git commit -m "feat: live token counter with cost display"
```

---

## Task 9: `app.js` — token reduction suggestions

**Files:**
- Modify: `app.js` (append)

- [ ] **Step 1: Append suggestions logic to `app.js`**

```js
// ── TOKEN REDUCTION SUGGESTIONS ────────────────────────────────────────────

// Filler phrases to detect and remove (case-insensitive)
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
  'it is worth noting that',
  'i want you to',
];

// Verbose → concise substitutions
const VERBOSE_PATTERNS = [
  { pattern: /\bin order to\b/gi,             replacement: 'to',        label: '"in order to" → "to"' },
  { pattern: /\bdue to the fact that\b/gi,    replacement: 'because',   label: '"due to the fact that" → "because"' },
  { pattern: /\bat this point in time\b/gi,   replacement: 'now',       label: '"at this point in time" → "now"' },
  { pattern: /\bin the event that\b/gi,       replacement: 'if',        label: '"in the event that" → "if"' },
  { pattern: /\bfor the purpose of\b/gi,      replacement: 'to',        label: '"for the purpose of" → "to"' },
  { pattern: /\bwith regard to\b/gi,          replacement: 'about',     label: '"with regard to" → "about"' },
  { pattern: /\bprior to\b/gi,                replacement: 'before',    label: '"prior to" → "before"' },
  { pattern: /\bsubsequent to\b/gi,           replacement: 'after',     label: '"subsequent to" → "after"' },
  { pattern: /\ba large number of\b/gi,       replacement: 'many',      label: '"a large number of" → "many"' },
  { pattern: /\bthe majority of\b/gi,         replacement: 'most',      label: '"the majority of" → "most"' },
  { pattern: /\bmake use of\b/gi,             replacement: 'use',       label: '"make use of" → "use"' },
  { pattern: /\bprovide assistance\b/gi,      replacement: 'help',      label: '"provide assistance" → "help"' },
];

// Static output tips shown in the second subsection
const OUTPUT_TIPS = [
  { snippet: 'Be concise.',                              label: 'Reduces response length significantly' },
  { snippet: 'Answer in bullet points.',                 label: 'Eliminates padding prose' },
  { snippet: 'Limit your response to 3 sentences.',      label: 'Hard cap on output tokens' },
  { snippet: 'Answer only with JSON.',                   label: 'Prevents explanatory prose around structured data' },
  { snippet: 'Skip preamble. Go straight to the answer.',label: 'Removes "Sure! Here is..." openers' },
  { snippet: 'Avoid repeating the question.',            label: 'Models often restate it — this stops that' },
];

let previousText = null;  // for one-level undo of Clean it

function initSuggestions() {
  // Render static output tips once
  const outputList = document.getElementById('output-tips-list');
  outputList.innerHTML = OUTPUT_TIPS.map(tip => `
    <div class="output-tip">
      <div>
        <code>${escapeHtml(tip.snippet)}</code>
        <div class="subtitle" style="margin-top:3px;font-size:11px;">${escapeHtml(tip.label)}</div>
      </div>
      <button class="copy-snippet-btn" data-snippet="${escapeAttr(tip.snippet)}">Copy</button>
    </div>
  `).join('');

  outputList.querySelectorAll('.copy-snippet-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      copyToClipboard(btn.dataset.snippet, btn);
    });
  });

  // Clean it / Undo button
  document.getElementById('clean-btn').addEventListener('click', handleCleanOrUndo);
}

function analyzeText(text) {
  const findings = [];

  // Filler phrases
  const fillerFound = FILLER_PHRASES.filter(p =>
    text.toLowerCase().includes(p.toLowerCase())
  );
  if (fillerFound.length > 0) {
    const savings = fillerFound.reduce((acc, p) => acc + Math.ceil(p.split(' ').length * 0.8), 0);
    findings.push({
      label: `${fillerFound.length} filler phrase${fillerFound.length > 1 ? 's' : ''} found (e.g. "${fillerFound[0]}")`,
      savings,
      type: 'filler',
    });
  }

  // Verbose patterns
  VERBOSE_PATTERNS.forEach(({ pattern, label }) => {
    if (pattern.test(text)) {
      pattern.lastIndex = 0;
      findings.push({ label, savings: 2, type: 'verbose' });
    }
    pattern.lastIndex = 0;
  });

  // Redundant whitespace
  if (/\n{3,}/.test(text)) {
    findings.push({ label: 'Multiple consecutive blank lines', savings: 1, type: 'whitespace' });
  }
  if (/[ \t]{2,}/m.test(text)) {
    findings.push({ label: 'Consecutive spaces/tabs', savings: 1, type: 'whitespace' });
  }

  return findings;
}

function cleanText(text) {
  let cleaned = text;

  // Remove filler phrases (replace with empty string, fix double spaces after)
  FILLER_PHRASES.forEach(phrase => {
    const re = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    cleaned = cleaned.replace(re, '');
  });

  // Apply verbose → concise substitutions
  VERBOSE_PATTERNS.forEach(({ pattern, replacement }) => {
    cleaned = cleaned.replace(pattern, replacement);
    pattern.lastIndex = 0;
  });

  // Normalise whitespace
  cleaned = cleaned.replace(/[ \t]{2,}/g, ' ');       // multi-spaces → one
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');        // 3+ newlines → two
  cleaned = cleaned.replace(/[ \t]+$/gm, '');          // trailing spaces per line
  cleaned = cleaned.trim();

  return cleaned;
}

function updateSuggestions(text) {
  const findings = analyzeText(text);
  const totalSavings = findings.reduce((acc, f) => acc + f.savings, 0);

  const panel = document.getElementById('suggestions-panel');
  const badge = document.getElementById('tips-count-badge');
  const list = document.getElementById('input-tips-list');
  const cleanRow = document.getElementById('clean-row');
  const cleanBtn = document.getElementById('clean-btn');
  const savingsText = document.getElementById('clean-savings-text');

  badge.textContent = (findings.length + OUTPUT_TIPS.length) + ' suggestions';
  panel.classList.remove('hidden');

  if (findings.length === 0) {
    list.innerHTML = '<p class="subtitle" style="padding:4px 0;">✅ No obvious verbosity detected.</p>';
    cleanRow.style.display = 'none';
  } else {
    list.innerHTML = findings.map(f => `
      <div class="tip-item">
        <div>
          <div class="tip-item-label">${escapeHtml(f.label)}</div>
          <div class="tip-item-savings">↓ saves ~${f.savings} token${f.savings !== 1 ? 's' : ''}</div>
        </div>
      </div>
    `).join('');

    cleanRow.style.display = 'flex';
    savingsText.textContent = `saves ~${totalSavings} token${totalSavings !== 1 ? 's' : ''} total`;

    // Reset button to "Clean it" if text changed since last undo
    if (previousText === null) {
      cleanBtn.textContent = '✨ Clean it';
    }
  }
}

function handleCleanOrUndo() {
  const btn = document.getElementById('clean-btn');
  const input = document.getElementById('token-input');

  if (previousText !== null) {
    // Undo
    input.value = previousText;
    previousText = null;
    btn.textContent = '✨ Clean it';
    updateTokenCount();
  } else {
    // Clean
    previousText = input.value;
    input.value = cleanText(input.value);
    btn.textContent = '↩ Undo';
    updateTokenCount();
  }
}

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

- [ ] **Step 2: Verify in browser**

Open `index.html`, Token Counter tab:

1. Type `Please could you please provide assistance in order to analyze this document carefully.`
   - Result card should appear
   - Suggestions panel should appear with filler phrase and verbose pattern findings
   - "Clean it" button and savings estimate visible

2. Click "✨ Clean it"
   - Text in textarea changes to cleaned version (fillers removed, "in order to" → "to")
   - Button changes to "↩ Undo"
   - Token count decreases

3. Click "↩ Undo"
   - Original text restored
   - Button reverts to "✨ Clean it"

4. Output tips section shows 6 static items, each with a working Copy button
   - Click a Copy button → label changes to "Copied ✓" for 2 seconds

- [ ] **Step 3: Commit**

```bash
git add app.js
git commit -m "feat: token reduction suggestions with Clean it / Undo"
```

---

## Task 10: `app.js` — JSON prettifier

**Files:**
- Modify: `app.js` (append)

- [ ] **Step 1: Append JSON prettifier logic to `app.js`**

```js
// ── JSON PRETTIFIER ────────────────────────────────────────────────────────

function initJsonPrettifier() {
  document.getElementById('json-format-btn').addEventListener('click', jsonFormat);
  document.getElementById('json-minify-btn').addEventListener('click', jsonMinify);
  document.getElementById('json-validate-btn').addEventListener('click', jsonValidate);
  document.getElementById('json-copy-btn').addEventListener('click', jsonCopy);
}

function getJsonInput() {
  return document.getElementById('json-input').value;
}

function setJsonOutput(html, isError = false) {
  const out = document.getElementById('json-output');
  out.innerHTML = html;
  out.classList.toggle('error', isError);
}

function parseJsonSafely(text) {
  try {
    return { value: JSON.parse(text), error: null };
  } catch (err) {
    const msg = err.message;
    // Try to extract position info from the error message
    const posMatch = msg.match(/position (\d+)/i) || msg.match(/at (\d+)/i);
    if (posMatch) {
      const pos = parseInt(posMatch[1], 10);
      const before = text.substring(0, pos);
      const line = (before.match(/\n/g) || []).length + 1;
      const col = pos - before.lastIndexOf('\n');
      return { value: null, error: `${msg}\n\nLine ${line}, column ${col}` };
    }
    return { value: null, error: msg };
  }
}

function jsonFormat() {
  const text = getJsonInput().trim();
  if (!text) return setJsonOutput('');

  const { value, error } = parseJsonSafely(text);
  if (error) {
    setJsonOutput('❌ Invalid JSON\n\n' + error, true);
    return;
  }

  const pretty = JSON.stringify(value, null, 2);
  setJsonOutput(syntaxHighlight(pretty));
}

function jsonMinify() {
  const text = getJsonInput().trim();
  if (!text) return setJsonOutput('');

  const { value, error } = parseJsonSafely(text);
  if (error) {
    setJsonOutput('❌ Invalid JSON\n\n' + error, true);
    return;
  }

  setJsonOutput(escapeHtml(JSON.stringify(value)));
}

function jsonValidate() {
  const text = getJsonInput().trim();
  if (!text) return setJsonOutput('');

  const { value, error } = parseJsonSafely(text);
  if (error) {
    setJsonOutput('❌ Invalid JSON\n\n' + error, true);
  } else {
    const keys = countJsonKeys(value);
    setJsonOutput(`✅ Valid JSON\n\n${keys} key${keys !== 1 ? 's' : ''} · ${text.length.toLocaleString()} chars`);
  }
}

function countJsonKeys(obj) {
  if (typeof obj !== 'object' || obj === null) return 0;
  let count = Object.keys(obj).length;
  for (const v of Object.values(obj)) count += countJsonKeys(v);
  return count;
}

function jsonCopy() {
  const out = document.getElementById('json-output');
  const btn = document.getElementById('json-copy-btn');
  const text = out.innerText || out.textContent;
  if (!text.trim()) return;
  copyToClipboard(text, btn);
}

/**
 * Syntax-highlight a JSON string by wrapping tokens in <span> tags.
 * Works on the output of JSON.stringify(), which is always valid.
 */
function syntaxHighlight(json) {
  // Escape HTML first, then wrap tokens
  const escaped = escapeHtml(json);
  return escaped.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
    match => {
      let cls = 'jn'; // number
      if (/^"/.test(match)) {
        cls = /:$/.test(match) ? 'jk' : 'js'; // key or string
      } else if (/true|false|null/.test(match)) {
        cls = 'jb';
      }
      return `<span class="${cls}">${match}</span>`;
    }
  );
}
```

- [ ] **Step 2: Verify in browser**

Open `index.html`, switch to JSON Prettifier tab.

**Test 1 — Format:**
Input: `{"name":"JsonsNTokens","version":1,"active":true}`
Click Format → output panel shows syntax-highlighted pretty JSON with 2-space indentation. Keys in indigo, strings in green, numbers in amber.

**Test 2 — Minify:**
With formatted JSON in input, click Minify → output is compact single line.

**Test 3 — Validate valid:**
Input valid JSON, click Validate → output shows "✅ Valid JSON" with key count.

**Test 4 — Validate invalid:**
Input `{"broken":}`, click Validate → output shows "❌ Invalid JSON" in red with error message and line/column.

**Test 5 — Copy:**
Format some JSON, click 📋 Copy → button shows "Copied ✓" for 2 seconds.

**Test 6 — Dark mode:**
Toggle dark mode → JSON syntax colours update correctly (lighter indigo for keys, brighter green for strings).

- [ ] **Step 3: Commit**

```bash
git add app.js
git commit -m "feat: JSON prettifier with format, minify, validate, copy, and syntax highlighting"
```

---

## Task 11: Final polish and Vercel deployment config

**Files:**
- Create: `vercel.json`

- [ ] **Step 1: Add `vercel.json` for clean URL routing**

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

- [ ] **Step 2: Add Google Fonts fallback in `style.css`**

At the top of `style.css`, before the reset, add:

```css
/* Load Inter + JetBrains Mono — fallbacks to system fonts if unavailable */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
```

- [ ] **Step 3: Smoke-test full app in browser**

Open `index.html` and run through all features:

| Feature | Input | Expected |
|---------|-------|----------|
| Theme toggle | Click sun/moon | Switches light↔dark, persists on reload |
| Tab switching | Click tabs | Correct panel shows |
| Token counter | Type 100 words of text, select `claude-sonnet-4-6` | Count shown, cost shown, "~ estimated" badge visible |
| Token counter | Switch to `gpt-4o` | Count updates, no "~ estimated" badge |
| Clean it | Paste "Please could you please in order to help" | Filler and verbose findings appear; Clean it removes them |
| Undo | After Clean it | Original text restored |
| Output tips | — | 6 tips visible, Copy buttons work |
| Format JSON | `{"a":1,"b":[2,3]}` | Pretty-printed with syntax highlighting |
| Minify JSON | Same input | Single-line compact output |
| Validate invalid | `{broken}` | Red error with message |
| Copy JSON | After Format | Clipboard contains text |

- [ ] **Step 4: Commit**

```bash
git add vercel.json style.css
git commit -m "feat: vercel config and font import polish"
```

- [ ] **Step 5: Push to GitHub and deploy on Vercel**

```bash
# Create a new GitHub repo at github.com (name: JsonsNTokens), then:
git remote add origin https://github.com/YOUR_USERNAME/JsonsNTokens.git
git branch -M main
git push -u origin main
```

Then at [vercel.com](https://vercel.com):
1. Import the GitHub repo
2. Framework preset: **Other** (static site)
3. Build command: _(leave empty)_
4. Output directory: _(leave empty / `.`)_
5. Click Deploy

Vercel will serve `index.html` as the root. Future price updates: edit `prices.json`, push → auto-redeploy.

---

## Self-Review

**Spec coverage:**
- ✅ Token Counter: textarea, model selector, live count, cost display, approximation badge
- ✅ Pricing: `prices.json`, fetched at load, fallback on error, prices note with links
- ✅ Models: all 11 models across 3 providers
- ✅ Token suggestions: input analysis (fillers, verbose, whitespace), Clean it / Undo (one level), output tips with copy
- ✅ JSON Prettifier: format, minify, validate, copy, syntax highlighting, error display with position
- ✅ Theme: CSS custom properties, toggle, localStorage persistence, OS preference on first visit
- ✅ Tabs: pill style, active state, panel switching
- ✅ Dark mode: all colours defined for both modes including JSON syntax colours
- ✅ Responsive: media query for mobile in `style.css`
- ✅ Error handling: tiktoken failure, prices.json failure, clipboard unavailable, JSON parse errors
- ✅ Vercel deployment

**Placeholder scan:** No TBDs, TODOs, or vague steps found.

**Type consistency:** `getSelectedModel()` returns `{ id, provider, label, inputPer1M, outputPer1M, tokenizer, charsPerToken?, encoding? }` — used consistently in `countTokens`, `updateTokenCount`, and `calcCost`. `copyToClipboard(text, btn)` signature used identically in both output tips and JSON copy. `escapeHtml` defined once in utils and used in suggestions, output tips, and JSON highlighter.
