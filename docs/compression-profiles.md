# Compression Profiles

# safe_readable

Goals:
- readability
- maintainability
- debugging

Allowed:
- whitespace normalization
- JSON minification
- readable aliases
- lightweight enum normalization

Avoid:
- aggressive aliasing
- structural array transformations
- subtree factoring

Example aliases:
- nombre_del_departamento -> nom_dep
- fecha_de_inicio -> fec_ini

---

# balanced

Goals:
- balanced token reduction
- acceptable readability

Allowed:
- moderate aliasing
- repeated value dictionaries
- schema extraction
- structural deduplication
- compact representations when profitable

Example aliases:
- nombre_del_departamento -> ndep
- fecha_de_inicio -> fini

---

# maximum_compression

Goals:
- minimize tokens aggressively

Allowed:
- aggressive aliases
- schema extraction
- compact arrays
- subtree factoring
- repeated structure optimization

Example aliases:
- nombre_del_departamento -> a
- fecha_de_inicio -> b

---

# ai_to_ai

Goals:
- machine-oriented payload optimization
- efficient inter-agent communication

Humans are not the primary audience.

Allowed:
- ultra aggressive optimization
- minimal readability
- highly compact schemas
- advanced structural compression

---

# prompt_preservation

Goals:
- preserve prompt quality
- preserve semantic clarity
- preserve instruction-following capability

Avoid:
- semantic rewriting
- transformations that may reduce model understanding
- aggressive compaction of natural language

---

# Adaptive Compression

Future versions may support:
- automatic profile selection
- payload-size-aware optimization
- context-aware compression
- model-specific optimization strategies

Examples:
- small payloads -> conservative optimization
- huge payloads -> aggressive optimization
- human-edited prompts -> readable mode
- AI-to-AI payloads -> maximum compression

---

# Metrics

Each profile should expose:
- estimated token reduction
- readability score
- semantic risk estimate
- metadata overhead
- reversibility guarantees
