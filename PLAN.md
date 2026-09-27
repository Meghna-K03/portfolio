# PLAN.md — Digital Twin Build Spec

Read `CLAUDE.md` first for the non-negotiable rule: the twin only answers
from the knowledge base, else it returns the fallback string.

---

## 1. Core features

### 1.1 Knowledge base (`knowledge.json`) — DONE
Single source of truth for every fact the twin can state. Lives at the
project root (`knowledge.json`, sibling to `code.html`). Two entry
shapes:

```json
{
  "meta": {
    "twinName": "Portfolio Twin",
    "fallback": "I don't have that information in my portfolio knowledge yet."
  },
  "entries": [
    {
      "id": "who",
      "topics": ["identity", "about"],
      "keywords": ["who is", "who are you", "introduce", "about"],
      "chip": "Who is Meghna?",
      "answer": "A simple fixed answer, for one-shot facts."
    },
    {
      "id": "tasteorbit",
      "topics": ["project", "tasteorbit", "data-science"],
      "keywords": ["tasteorbit", "taste orbit", "zomato"],
      "data": {
        "name": "TasteOrbit",
        "summary": "...",
        "purpose": "...",
        "problem": "...",
        "technologies": ["Python", "Scikit-Learn", "Pandas"],
        "features": ["..."],
        "implementation": "...",
        "outcome": "...",
        "githubUrl": "..."
      }
    }
  ]
}
```
- `entries[].keywords` / `entries[].topics` — as before: substring
  matching for entity/topic detection.
- `entries[].chip` — optional quick-question chip, unchanged.
- **Simple entries** (`answer`): identity, education, interests, a
  portfolio overview, a projects overview, a skills/stack summary, and
  location — one fixed sentence or two.
- **Project entries** (`data`): a structured object per project — `name`
  is required, every other field (`fullName`, `domain`, `summary`,
  `purpose`, `problem`, `technologies`, `features`, `implementation`,
  `outcome`, `role`, `builtWhen`, `status`, `githubUrl`) is present only
  when the portfolio actually documents it. A missing field means the
  retrieval engine answers that specific question with the exact
  fallback — it never fabricates "not documented" text or a guess.
- 11 entries currently: identity, education, interests, a portfolio
  overview, a projects overview, all four individual projects (structured
  `data`), a skills/stack summary, and location.
- See the `twin-knowledge-base` skill for the full authoring guide and
  the "never invent" rules for each `data` field.

### 1.2 Retrieval / answer engine — DONE
Lives in `code.html`'s final `<script>` block, between the
`<!-- TWIN-ENGINE:START -->` / `<!-- TWIN-ENGINE:END -->` markers (also
mirrored in `index.html`). Intent-aware and entity-aware, not a single
flat keyword match:

1. `knowledge.json` is fetched once on page init (`loadTwinKnowledge()`)
   and cached in `twinKnowledge` — never re-fetched per message.
2. **Comparison** — a trigger phrase ("compare", "vs", "difference
   between", ...) plus two explicitly named projects builds a comparison
   using only the `data` fields present on *both* projects; with fewer
   than two named projects it returns the exact fallback rather than
   guessing which two are meant.
3. **Project entity + intent** — `detectProjectEntities()` checks the
   query against every project's `keywords`; if a project is named (or a
   follow-up pronoun like "it"/"this project" resolves via the lightweight
   `twinContext.currentTopic`), an ordered regex table (`INTENT_PATTERNS`)
   classifies the question as one of: tech stack, features, purpose,
   problem, role, timeline, domain, outcome, implementation, short
   summary, detailed summary, explanation, or a default overview. Each
   intent reads one or more `data` fields (`INTENT_HANDLERS`) and returns
   `null` (→ exact fallback) when the field is absent — no new `if` branch
   is added per fact.
4. **Cross-project logical search** — only reached when no specific
   project was named: "which project(s) use/involve/relate to X?" is
   parsed down to a search phrase and matched, case-insensitively, against
   every project's combined `data` text. No hand-authored synonym map
   (e.g. no "computer vision" → "OpenCV" mapping) — a query that isn't
   literally supported by the text returns the fallback, by design.
5. **Simple entries** — `scoreEntry(query, entry)` (unchanged keyword/topic
   substring scoring) against the plain `answer` entries, for identity/
   education/interests/portfolio/skills/location questions.
6. Otherwise it returns `knowledge.meta.fallback` **exactly as written** —
   never a second, hand-typed fallback string.
- `retrieveAnswer(knowledge, query, context)` is a pure function (no DOM/
  network dependency) that also accepts/returns a lightweight `{
  currentTopic }` context object for follow-up resolution — the caller
  (`generateTwinResponse` in the chat UI) owns updating it between turns;
  the function itself never holds hidden state. Directly unit-testable —
  see `scripts/test-twin-engine.js`.
- No network calls beyond fetching the local `knowledge.json`, no
  external APIs, no synonym/classification tables that inject outside
  knowledge — stays static, dependency-free, and strictly grounded.

### 1.3 Chat UI — DONE (wired to knowledge base)
Message log, quick-question chips, and free-text input + submit all call
`generateTwinResponse()` → `retrieveAnswer()`, the same single path for
both chip clicks (`handleTwinQuestion`) and typed questions
(`handleChatSubmit`). There is no separate hardcoded answer path anymore.
`generateTwinResponse()` also owns the lightweight `twinContext` object
(just `{ currentTopic }`) so a follow-up like "summarize it" resolves
against the last project discussed — no backend, no persistence beyond
the current page load.

### 1.4 Strict-grounding fallback — DONE
The fallback text is exactly:
**"I don't have that information in my portfolio knowledge yet."**
It lives only in `knowledge.json`'s `meta.fallback` and is read from
there by the retrieval engine — verified by
`scripts/check-fallback.js` and `scripts/test-twin-engine.js` (TEST5/6/
16/18/20). Every project-specific intent handler returns this exact
string (never a custom "not documented" message) whenever the requested
`data` field is absent — e.g. `builtWhen`/`role` are undocumented for
most projects, so "when was X built?" and "what was Meghna's role in X?"
correctly fall back except for Project Panopticon's documented role.

### 1.5 Real content — DONE (contact links remain pending)
- Real, structured project knowledge for each of the four projects
  (TasteOrbit, Project Panopticon, Automated Invoice Processing &
  Anomaly Detection, Memory of a City): summary, purpose, problem,
  technologies, features, implementation, and outcome where documented —
  so the twin can answer project-specific, per-field questions, not just
  return one fixed paragraph per project.
- Intent-aware retrieval so the same project can be asked about from many
  angles (tech stack, features, purpose, problem, timeline, role, domain,
  outcome, implementation, short/detailed summary) without a new
  knowledge-base entry or a new `if` branch per question.
- Cross-project logical questions ("which project uses OCR?", "which
  projects use Python?") and project comparisons ("compare X and Y"),
  both built from the same structured `data` — no separate lookup table.
- Lightweight single-topic follow-up context ("it"/"this project"
  resolves to the last project discussed).
- Replace placeholder email/GitHub/LinkedIn contact links — **still
  pending, intentionally** (no real links were provided).

---

## 2. Plugin components (skills / commands / hooks)

### Skill: `twin-knowledge-base` — DONE
`.claude/skills/twin-knowledge-base/SKILL.md`. Teaches Claude how to
add/edit entries correctly: schema shape, how to pick `keywords`/`topics`,
and the grounding rule (never write an `answer` that states something not
literally provided). Triggered whenever a task mentions adding a fact,
project, or link to the twin.

### Command: `/add-project` — DONE
`.claude/commands/add-project.md`. Scaffolds a new project end-to-end
from a short description: adds a card to the Projects section of
`code.html` (mirrored into `index.html`) *and* a matching
`knowledge.json` entry (with sensible `keywords`/`topics`) so the twin can
immediately answer questions about it. Never invents a missing fact —
uses an explicit `<!-- TODO -->` placeholder instead.

### Command: `/sync-twin` — DONE
`.claude/commands/sync-twin.md`, backed by
`scripts/sync-twin-chips.js`. Regenerates the quick-question chip buttons
from every `knowledge.json` entry that declares a `chip` field, between
the `<!-- TWIN-CHIPS:START/END -->` markers in both `code.html` and
`index.html`, so suggested questions always match what's actually in the
knowledge base.

### Hook: knowledge-base guard — DONE
`scripts/validate-knowledge.js` validates `knowledge.json` against the
schema in 1.1 (meta/fallback present, entries array, unique ids, non-empty
topics/keywords/answer). `scripts/check-twin-grounding.js` scans the
`<!-- TWIN-ENGINE:START/END -->` block in `code.html`/`index.html` for a
reintroduced `if (...includes(...)) { return "..." }` branch or any
`return` of a 15+ character string literal — either would mean a fact
bypassing `knowledge.json`. Both run automatically via the
`PostToolUse` hook in `.claude/settings.json`
(`scripts/twin-guard-hook.js`) whenever Claude edits `knowledge.json`,
`code.html`, or `index.html`, and block (exit 2) with a clear message on
failure. `hooks/pre-commit` mirrors the same checks as a real git hook;
it isn't installed into `.git/hooks/` automatically (`cp hooks/pre-commit
.git/hooks/pre-commit` to opt in) — the Claude Code `PostToolUse` hook
covers the same ground in the meantime.

### Hook: fallback-string guard — DONE
`scripts/check-fallback.js`. Fails if `knowledge.json`'s `meta.fallback`
is missing/empty, if the twin engine block never reads
`<knowledge>.meta.fallback`, or if the fallback sentence also appears as
a second, hand-typed string literal anywhere in that block. Wired into
the same `PostToolUse` hook as the knowledge-base guard.

### Plugin: knowledge consistency guard — DONE
`scripts/check-knowledge-consistency.js`, run via `npm run
check:consistency`. `validate-knowledge.js` checks each entry in
isolation (does *this* entry have a unique id, non-empty keywords, a
required `data.name`, ...); this plugin instead compares entries
*against each other*, catching collisions the per-entry check structurally
can't see:
- The same keyword string declared by two different entries. The
  retrieval engine's `scoreEntry()` and `detectProjectEntities()`
  (`code.html`'s TWIN-ENGINE block) both match keywords with a plain
  substring check and no tie-break, so a duplicated keyword means one
  entry's trigger silently shadows the other's — a real retrieval bug,
  not a style nit.
- The same `chip` question text declared by two different entries — would
  render an indistinguishable duplicate quick-question button, and one
  entry's chip would never be reachable by clicking it.
- (Warning only, non-blocking) the same keyword repeated twice inside one
  entry's own `keywords` array — harmless to retrieval, flagged as
  copy-paste drift worth cleaning up.
It exits 2 (blocking) on either error case, printing which entries
collide and why, and exits 0 with a summary line otherwise. Wired into
`npm run precommit`, `hooks/pre-commit`, and the same `PostToolUse` hook
(`scripts/twin-guard-hook.js`) as the other two guards, so it runs
automatically whenever `knowledge.json` is edited. The `add-project`
command and the `twin-knowledge-base` skill both call it out as a
required step after adding/editing keywords or a chip.
**Tested**: verified it passes cleanly against the real 11-entry
`knowledge.json` (81 distinct keywords, 0 collisions), and — against three
temporary broken copies, restored immediately after — correctly catches
(1) a keyword duplicated across two entries, exit 2; (2) a `chip` string
duplicated across two entries, exit 2; (3) a keyword repeated within one
entry, warns but still exits 0. The three PostToolUse guards, run via a
simulated hook payload, still pass in sequence (validate-knowledge →
check-knowledge-consistency → check-twin-grounding → check-fallback), and
an unrelated file path still no-ops the hook.

### Validation & testing — DONE
```
npm run validate:knowledge   # schema check (simple `answer` OR structured `data`)
npm run check:consistency    # cross-entry keyword/chip collision guard
npm run validate:twin        # grounding guard + fallback guard
npm run test:twin            # functional retrieval tests (TEST1-20 below)
npm run sync:twin            # regenerate quick-question chips
npm run precommit            # all of the above, in order
```
`scripts/test-twin-engine.js` TEST12-20 cover the newer intent-aware
capabilities specifically: tech-stack question variants (TEST12),
features (TEST13), purpose/problem (TEST14), short vs. detailed
summarization (TEST15), documented-vs-undocumented role/timeline falling
back exactly (TEST16), cross-project logical questions including a
deliberately-unsupported one ("computer vision") to confirm it still
falls back rather than guessing (TEST17), comparison using only
shared/documented fields plus an ambiguous-compare-still-falls-back case
(TEST18), and follow-up pronoun context switching between two projects in
one conversation (TEST19).
`package.json` has no dependencies (zero npm packages) — these are plain
Node scripts, consistent with the project staying a dependency-free
static site.

---

## 3. Done vs. pending — summary

**Done**
- Full page layout and visual design (Hero, About, Projects, Digital
  Twin, Contact sections) — unchanged.
- Chat UI: message log, styled bubbles, quick-question chips, text input,
  fade-in animation — unchanged visually, now wired to the retrieval
  engine.
- `knowledge.json` as the single source of truth (11 entries: identity,
  education, interests, a portfolio overview, projects overview, all 4
  individual projects as structured `data` objects, skills/stack,
  location).
- Retrieval engine rewritten as an intent-aware, entity-aware pipeline
  reading `knowledge.json`: project-name/follow-up-pronoun detection →
  intent classification (tech stack, features, purpose, problem, role,
  timeline, domain, outcome, implementation, short/detailed summary) →
  answer built from the matching `data` field(s), plus a separate
  comparison path and a cross-project logical-search path — all falling
  through to `meta.fallback` when a field or match is missing. No
  hardcoded facts and no per-fact `if` branches remain in `code.html`'s
  script; a new project only needs a new `data` object.
- Lightweight single-topic follow-up context (`twinContext.currentTopic`)
  so "summarize it" / "what tech did it use" resolves to the last project
  named, entirely client-side, never persisted beyond the page session.
- Exact required fallback string, sourced only from
  `knowledge.meta.fallback`, including for every "field not documented"
  case (role, timeline, outcome, etc. per project) and every
  unsupported logical/comparison question.
- Real, structured project knowledge for TasteOrbit, Project Panopticon,
  Automated Invoice Processing & Anomaly Detection, and Memory of a City
  — summary, purpose, problem, technologies, features, implementation,
  and outcome where documented; Project Panopticon additionally has a
  documented `role` ("built during an AI internship").
- `twin-knowledge-base` skill, `/add-project` command, `/sync-twin`
  command — all updated for the structured project schema and the
  intent-based retrieval pipeline.
- Knowledge-base guard + fallback-string guard + knowledge consistency
  guard, all three wired into a Claude Code `PostToolUse` hook
  (`.claude/settings.json` → `scripts/twin-guard-hook.js`), plus
  `hooks/pre-commit` (this repo now has `.git`, so it can be installed
  with `cp hooks/pre-commit .git/hooks/pre-commit` if a live git hook is
  wanted — the Claude Code hook covers the same checks in the meantime).
  All three guards were updated/verified to understand the current
  11-entry `data`-object schema.
- **Plugin: knowledge consistency guard** (`scripts/
  check-knowledge-consistency.js`, `npm run check:consistency`) — new.
  Catches cross-entry keyword collisions and duplicate `chip` text that
  the per-entry schema check can't see (see "Plugin components" above for
  why this is a real retrieval bug, not a lint nit). Verified against the
  real knowledge base (0 collisions) and against three deliberately broken
  temporary copies (each correctly caught, originals restored).
- Validation/testing: `npm run validate:knowledge`, `npm run
  check:consistency`, `npm run validate:twin`, `npm run test:twin` — all
  passing, 19 test cases (see "Validation & testing" above), plus a manual
  sweep across every question type in this task's test matrix (all four
  projects × identity/tech-stack/features/purpose/problem/summary/
  timeline/role, logical questions, comparisons, and follow-up context)
  confirmed correct, grounded output or the exact fallback.

**Pending**
- Replace placeholder contact links (email/GitHub/LinkedIn) —
  intentionally left alone; no real links were provided.
- Decide on deploy target (GitHub Pages / Netlify / Vercel — no backend
  needed for the current client-side-only design). Note: `knowledge.json`
  is fetched via `fetch()`, so the site must be served over http(s) to
  test locally (e.g. `npx serve` or `python -m http.server`) — opening
  `code.html` directly via `file://` will fail the fetch due to browser
  CORS restrictions on local files. This works fine once hosted.
