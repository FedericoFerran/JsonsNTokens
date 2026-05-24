# Optimizer Refactor Roadmap

> **Canonical implementation order — do not reorder phases unless explicitly instructed.**
> Each phase must be stable and validated before the next begins.

## Status Summary

| Phase | Status | Description |
|---|---|---|
| 1 | ✅ Done | Safety — Structural JSON traversal |
| 2 | ✅ Done | Safety — Valid legend format |
| 3 | ✅ Done | Safety — Post-transform validation |
| 4 | ✅ Done | Safety — repetition.apply fix |
| 5 | ✅ Done | Accuracy — Real token counting |
| 6 | ✅ Done | Correctness — Metadata cost subtraction |
| 7 | ✅ Done | UX — Profitability threshold |
| 8 | ✅ Done | Structure — Repeated value detection |
| 9A | ✅ Done | Structure — Schema detection |
| 9B | ✅ Done | Structure — Schema transformation |
| 10 | ⬜ Next | Extension — Compression profiles |

---

# Architectural Priority Order

The optimizer must evolve in this strict priority sequence:

1. Safety and correctness first
2. Measurement accuracy second
3. Profitability intelligence third
4. Structural optimization fourth
5. Orchestration and features last

**Rationale:**
- structural optimizations without profitability controls may over-optimize
- metadata overhead can exceed savings if unchecked
- unsafe transformations can corrupt JSON silently
- compression profiles should orchestrate mature, stable logic — not unstable logic

---

# Implementation Constraints

- Implement incrementally
- Keep the application stable after every phase
- Avoid large rewrites
- Preserve backward compatibility whenever possible
- Minimize disruption to existing UI behavior
- Prefer modular, isolated changes

---

# Workflow Per Phase

For each phase:
1. Analyze current implementation
2. Explain weaknesses
3. Propose minimal-impact changes
4. Identify risks and edge cases
5. Implement incrementally
6. Review critically

---

# Deliverables Per Phase

After each phase provide:
- summary of changes
- architectural rationale
- edge cases handled
- remaining risks
- future improvement opportunities

---

# Phase 1 — Safety: Structural JSON Traversal ✅

**Goal:** Eliminate raw-text JSON manipulation in `json-keys`.

**Problem:** `json-keys.apply()` operates on raw JSON text via regex. This can:
- replace key text inside string values
- corrupt JSON silently
- produce output that is not valid JSON

**Required change:** Rewrite `json-keys` to:
1. `JSON.parse()` the input
2. Traverse the object recursively
3. Build the key→abbreviation map from structural key positions only
4. Rebuild the object with abbreviated keys
5. `JSON.stringify()` the output

---

# Phase 2 — Safety: Valid Legend Format ✅

**Goal:** Replace the JS-comment legend (`/* key_map: ... */`) with a JSON-legal format.

**Problem:** The current legend makes the output immediately invalid as JSON. A JS block
comment is not legal JSON syntax.

**Options:**
- Wrap output in `{"__key_map": {...}, "__data": <original>}` envelope
- Emit a separate plain-text legend alongside the optimized JSON output
- Prepend the map as a JSON object on its own line with a clear delimiter

**Required:** Whatever format is chosen must be parseable and reversible.

---

# Phase 3 — Safety: Post-Transform Validation ✅

**Goal:** Add a `JSON.parse()` guard after every JSON optimization pass.

**Problem:** There is currently no check that the output of `json-keys.apply()` is valid
JSON. Corruption is silent.

**Required change:**
- After transformation, attempt `JSON.parse(output)`
- On failure: log warning, return original input unmodified
- Never surface corrupted output to the user

---

# Phase 4 — Safety: repetition.apply Fix ✅

**Goal:** Ensure `repetition.apply()` removes the correct (duplicate) occurrence.

**Problem:** `out.replace(s, '')` removes the **first** occurrence, not the second.
For identical sentences this deletes the original and keeps the copy — or corrupts
output when the sentence text is a substring of a larger passage.

**Required change:** Track sentence positions; remove the second and later occurrences only.

---

# Phase 5 — Accuracy: Real Token Counting ✅

**Goal:** Wire `countTokens()` into the savings display.

**Problem:** All savings estimates are fabricated:
- `filler`: `word_count × 0.8`
- `verbose`: `found.length × 2`
- `json-keys`: `char_delta / 4`
- None use the actual tokenizer selected in the UI

**Required change:**
- After applying a technique, measure `before` and `after` token counts
  using the currently selected model and `countTokens()`
- Replace estimated savings badges with measured deltas
- This applies to both individual technique previews and the final applied result

---

# Phase 6 — Correctness: Metadata Cost Subtraction ✅

**Goal:** Subtract legend/dictionary overhead from `json-keys` savings.

**Problem:** The key map prepended by `json-keys` costs tokens. This overhead is never
subtracted from the savings estimate. For short JSON with few repetitions, net savings
may be zero or negative.

**Required change:**
- Measure the token cost of the legend/dictionary block itself
- Net savings = gross_savings − legend_cost
- Surface the legend cost in the UI if useful for debugging

---

# Phase 7 — UX: Profitability Threshold ✅

**Goal:** Suppress techniques whose measured net savings are below a minimum threshold.

**Problem:** Techniques with zero or negative real token savings are currently always shown
and applied. This misleads users and may make prompts longer.

**Required change:**
- After Phase 5 measurement is in place, add a minimum threshold (e.g. 1 token)
- Techniques below threshold are hidden from suggestions (or shown as "no gain")
- Threshold should be configurable for future profile use

---

# Phase 8 — Structure: Repeated Value Detection ✅

**Goal:** Detect and report repeated values inside JSON (not just repeated keys).

**Problem:** There is no analysis of repeated values. A field like `"status": "active"`
appearing 50 times across an array is the biggest structural opportunity, yet invisible
to the current engine.

**Required change:**
- Add a new TECHNIQUE (or structural analysis pass) that:
  - parses JSON
  - traverses recursively
  - counts value frequency by value+path pattern
  - reports candidates with frequency ≥ threshold

**Note:** Detection only in this phase. Transformation comes after schema work is validated.

---

# Phase 9A — Structure: Schema Detection ✅

**Goal:** Detect homogeneous array schemas (arrays where every object has the same key set).

**Problem:** Arrays of objects with identical schemas are a major structural redundancy.
The schema is serialized once per object. Detection must come before any transformation.

**Required change:**
- Inspect arrays of objects
- Compute key-set fingerprint for each element
- Report arrays where ≥ 80% of elements share the same key set
- Report estimated token savings from extracting the schema once

**Constraint:** Detection and reporting only. No transformation until 9B is validated.

---

# Phase 9B — Structure: Schema Transformation ✅

**Goal:** Transform detected homogeneous arrays into schema + values format.

**Prerequisite:** Phase 9A must be complete and validated.

**Problem:** Homogeneous arrays repeat the same keys N times. Extracting the schema once
and serializing only values can yield large savings for large arrays.

**Example:**

Before:
```json
[{"name": "Alice", "age": 30}, {"name": "Bob", "age": 25}]
```

After (balanced profile example):
```json
{"__schema": ["name", "age"], "__rows": [["Alice", 30], ["Bob", 25]]}
```

**Required change:**
- Implement structural transformation for detected homogeneous arrays
- Validate output is parseable and reversible
- Gate behind profitability check (Phase 7 threshold must pass)

---

# Phase 10 — Extension: Compression Profiles

**Goal:** Implement the five compression profiles as configurable orchestration layers.

**Prerequisite:** Phases 1–9B must be stable and validated.

**Profiles:**
- `safe_readable` — whitespace, lightweight aliases, no structural transforms
- `balanced` — moderate aliasing, repeated value opt, schema extraction
- `maximum_compression` — aggressive aliases, schema transform, subtree factoring
- `ai_to_ai` — ultra-aggressive, minimal readability, compact schemas
- `prompt_preservation` — no semantic transforms, whitespace only

**Required change:**
- Profile object defines: which passes are enabled, aggressiveness level, alias strategy
- Each TECHNIQUE gains profile compatibility flags
- UI exposes a profile selector
- Profiles orchestrate existing, validated passes — they add no new transformation logic

---

# Future Work (Post Phase 10)

Potential directions after the canonical sequence is complete:

- adaptive profile selection (auto-select based on payload size and content type)
- AI-to-AI optimized transport format
- provider-specific tokenizer optimization (OpenAI vs Anthropic vs Gemini passes)
- hybrid structural/language optimization for mixed prompt+JSON payloads
- subtree factoring for repeated nested objects
- regression and benchmark suite

---

# Refactoring Philosophy

Prefer:
- incremental improvements
- modular passes
- backward compatibility
- low-risk migration

Avoid:
- massive rewrites
- tightly coupled logic
- unsafe transformations
- implementing later phases before earlier ones are validated

---

# Success Metrics

Track per phase and across the pipeline:
- token reduction percentage (measured, not estimated)
- reversibility success rate
- semantic equivalence rate
- metadata overhead ratio
- optimization speed
- profile effectiveness
