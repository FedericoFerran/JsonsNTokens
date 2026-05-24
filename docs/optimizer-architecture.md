# Optimizer Architecture

# Goals

Design a modular token optimization engine capable of:
- structural optimization
- tokenizer-aware optimization
- reversible transformations
- configurable compression profiles

---

# High-Level Pipeline

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

# Core Concepts

## Optimization Passes

Each optimization should exist as an independent pass.

Examples:
- whitespace pass
- alias compression pass
- repeated value pass
- schema extraction pass

Each pass should support:
- enabled/disabled
- aggressiveness
- profitability threshold
- profile compatibility

---

# Tokenizer Awareness

The engine must estimate:
- original token cost
- optimized token cost
- metadata overhead

Never rely exclusively on character count.

---

# Profitability Formula

benefit =
(tokens_saved_per_occurrence * frequency)
- metadata_cost
- decompression_overhead

Only apply optimizations when:
benefit > threshold

---

# Structural Compression

Repeated object schemas should be detected.

Potential transformations:
- schema extraction
- compact arrays
- subtree factoring
- repeated object references

---

# Validation Requirements

Every optimization pipeline should validate:
- JSON integrity
- reversibility
- semantic equivalence
- schema consistency

---

# Alias Strategies

Support pluggable alias generators:
- readable
- balanced
- aggressive

Avoid aliases such as:
- no_de_de
- nu_to_de_em_en_la_em

Prefer:
- nom_dep
- fec_ini
- a/b/c for aggressive modes

---

# Long-Term Architectural Goals

The optimizer should evolve toward:
- modular passes
- profile-driven optimization
- tokenizer-aware profitability scoring
- adaptive compression
- model-specific optimization strategies

---

# Recommended Pass Ordering

1. Normalization
2. Structural analysis
3. Token estimation
4. Candidate generation
5. Profitability scoring
6. Structural optimization
7. Validation
8. Serialization
9. Metrics generation

---

# Important Principle

Not all token reduction is beneficial.

Some aggressive transformations may:
- reduce readability
- increase semantic risk
- degrade LLM comprehension

Optimization should balance:
- token reduction
- semantic preservation
- maintainability
- debugging usability
