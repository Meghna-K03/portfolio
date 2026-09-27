# PLAN.md — Digital Twin Build Spec

Read `CLAUDE.md` first for the non-negotiable rule: the twin only answers
from the knowledge base, else it returns the fallback string.

---

## 1. Core features

### 1.1 Knowledge base (`knowledge.json`) — DONE
Single source of truth for every fact the twin can state. Lives at the
project root (`knowledge.json`, sibling to `code.html`).

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
      "answer": "..."
    }
  ]
}
```
- `entries[].keywords` — phrases/substrings used for matching.
- `entries[].topics` — tags for grouping (education, projects, links,
  stack, interests) so quick-question chips can be generated from them.
- `entries[].chip` — optional; entries with this field generate a
  quick-question chip button via `/sync-twin`.
- Every project, link, and skill added later becomes a new entry here —
  never a new `if` branch hand-written into the script. See the
  `twin-knowledge-base` skill for the full authoring guide.
- 10 entries currently: identity, education, interests, a projects
  overview, all four individual projects, a skills/stack summary, and
  location.

### 1.2 Retrieval / answer engine — DONE
Lives in `code.html`'s final `<script>` block, between the
`<!-- TWIN-ENGINE:START -->` / `<!-- TWIN-ENGINE:END -->` markers (also
mirrored in `index.html`).
1. `knowledge.json` is fetched once on page init (`loadTwinKnowledge()`)
   and cached in `twinKnowledge` — never re-fetched per message.
2. `scoreEntry(query, entry)` counts case-insensitive keyword substring
   matches (+1 each) plus a smaller topic-word bonus (+0.5 each).
3. `retrieveAnswer(knowledge, query)` picks the highest-scoring entry; if
   its score is at or above `TWIN_MATCH_THRESHOLD` (1), its `answer` is
   returned.
4. Otherwise it returns `knowledge.meta.fallback` **exactly as written** —
   never a second, hand-typed fallback string.
- `retrieveAnswer` is a pure function (knowledge + query in, answer out)
  with no DOM/network dependency, so it's directly unit-testable — see
  `scripts/test-twin-engine.js`.
- No network calls beyond fetching the local `knowledge.json`, no
  external APIs — stays static and dependency-free.

### 1.3 Chat UI — DONE (wired to knowledge base)
Message log, quick-question chips, and free-text input + submit all call
`generateTwinResponse()` → `retrieveAnswer()`, the same single path for
both chip clicks (`handleTwinQuestion`) and typed questions
(`handleChatSubmit`). There is no separate hardcoded answer path anymore.

### 1.4 Strict-grounding fallback — DONE
The fallback text is exactly:
**"I don't have that information in my portfolio knowledge yet."**
It lives only in `knowledge.json`'s `meta.fallback` and is read from
there by the retrieval engine — verified by
`scripts/check-fallback.js` and `scripts/test-twin-engine.js` (TEST5/6).

### 1.5 Real content — DONE (contact links remain pending)
- Real project descriptions with a matching knowledge-base entry for
  each, so the twin can answer project-specific questions, not just a
  category summary — done for TasteOrbit, Project Panopticon, Automated
  Invoice Processing & Anomaly Detection, and Memory of a City.
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
failure. There's no `.git` directory yet, so a real git `pre-commit` hook
isn't wired up yet — `hooks/pre-commit` is ready to install once `git
init` happens (`cp hooks/pre-commit .git/hooks/pre-commit`).

### Hook: fallback-string guard — DONE
`scripts/check-fallback.js`. Fails if `knowledge.json`'s `meta.fallback`
is missing/empty, if the twin engine block never reads
`<knowledge>.meta.fallback`, or if the fallback sentence also appears as
a second, hand-typed string literal anywhere in that block. Wired into
the same `PostToolUse` hook as the knowledge-base guard.

### Validation & testing — DONE
```
npm run validate:knowledge   # schema check
npm run validate:twin        # grounding guard + fallback guard
npm run test:twin            # functional retrieval tests (TEST1-11 below)
npm run sync:twin            # regenerate quick-question chips
npm run precommit            # all of the above, in order
```
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
- `knowledge.json` as the single source of truth (10 entries: identity,
  education, interests, projects overview, all 4 individual projects,
  skills/stack, location).
- Retrieval engine rewritten as a scored-match function reading
  `knowledge.json`, with a hard floor (`TWIN_MATCH_THRESHOLD`) that
  returns `meta.fallback` below threshold. No hardcoded facts remain in
  `code.html`'s script.
- Exact required fallback string, sourced only from
  `knowledge.meta.fallback`.
- Real project knowledge entries: TasteOrbit, Project Panopticon,
  Automated Invoice Processing & Anomaly Detection, and Memory of a City.
- `twin-knowledge-base` skill, `/add-project` command, `/sync-twin`
  command.
- Knowledge-base guard + fallback-string guard, wired into a Claude Code
  `PostToolUse` hook (`.claude/settings.json` →
  `scripts/twin-guard-hook.js`), plus a `hooks/pre-commit` script ready
  for when `git init` happens.
- Validation/testing: `npm run validate:knowledge`,
  `npm run validate:twin`, `npm run test:twin` — all passing (see
  "Validation & testing" above for the 11 test cases covered).

**Pending**
- Replace placeholder contact links (email/GitHub/LinkedIn) —
  intentionally left alone; no real links were provided.
- Decide on deploy target (GitHub Pages / Netlify / Vercel — no backend
  needed for the current client-side-only design). Note: `knowledge.json`
  is fetched via `fetch()`, so the site must be served over http(s) to
  test locally (e.g. `npx serve` or `python -m http.server`) — opening
  `code.html` directly via `file://` will fail the fetch due to browser
  CORS restrictions on local files. This works fine once hosted.
