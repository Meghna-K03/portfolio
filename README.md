# Portfolio

A single-page portfolio site for Meghna K. (B.Tech AI & ML, Atria
University, Bengaluru) with an embedded "Digital Twin" chat widget that
answers visitor questions about her background, studies, and projects.

## Features

- Artistic, single-page portfolio with an editorial, botanical-illustrated
  visual style (soft warm colors, elegant typography, smooth scrolling,
  subtle animations — see `DESIGN.md`).
- Five sections: **Hero**, **About Myself**, **My Projects**, **Digital
  Twin**, **Contact**.
- A project showcase with four real projects, each linking out to its own
  GitHub repository.
- A portfolio-grounded **Digital Twin** chat widget with quick-question
  chips and free-text input.
- No build step, no backend, no framework — plain static HTML, Tailwind
  (via CDN), and inline JavaScript.

## Digital Twin

The chat widget in the **Digital Twin** section is a narrow Q&A widget,
not a general chatbot. It answers **only** from `knowledge.json` — the
single source of truth for every fact it can state — via a scored,
intent-aware keyword/topic retrieval engine in `code.html`'s final
`<script>` block (between the `<!-- TWIN-ENGINE:START -->` /
`<!-- TWIN-ENGINE:END -->` markers).

It can answer questions about:

- Meghna (identity, education, interests, location)
- her skills / tech stack across projects
- the portfolio itself
- each of the four projects individually — overview, purpose, problem,
  technologies, features, implementation, outcome, short or detailed
  summaries, and (where documented) role/timeline
- cross-project questions ("which project uses OCR?") and comparisons
  between two named projects
- simple follow-ups ("tell me about Memory of a City" → "what
  technologies did it use?" → "summarize it")

**Strict grounding rule:** every answer is built only from fields that
exist in `knowledge.json`. It never calls an external AI API, never
searches the internet, and never pulls from GitHub or LinkedIn. If a
question isn't covered — or a specific field (e.g. a project's `role` or
`builtWhen`) simply isn't documented — the reply is the exact fallback
string, verbatim:

> I don't have that information in my portfolio knowledge yet.

## Projects

- **TasteOrbit** — Restaurant Insights & Quality Prediction: a
  classification model predicting whether Bengaluru restaurants are
  highly rated, using a Zomato dataset (location, cuisine, cost, vote
  count) and Logistic Regression.
- **Project Panopticon** — Intelligent Exam Proctoring: a precision-first
  exam-proctoring pipeline (built during an AI internship) that merges
  video and system-event telemetry and raises the decision threshold to
  90% confidence to reduce false cheating accusations.
- **Automated Invoice Processing & Anomaly Detection** — an end-to-end
  pipeline that reads invoice images, extracts fields (invoice number,
  vendor, amount) via OpenCV/Tesseract OCR, and flags suspicious invoices
  with Z-score and Isolation Forest anomaly detection.
- **Memory of a City** — a Bengaluru-focused urban intelligence site
  exploring how Indiranagar, Koramangala, and Whitefield changed between
  2010 and 2026, including an AI "City Change Investigator" grounded only
  in the site's own prepared dataset.

See each project's card in the **My Projects** section for its GitHub
link, or ask the Digital Twin about any of them by name.

## Agentic / Claude Components

- **Skill — `twin-knowledge-base`** (`.claude/skills/twin-knowledge-base/SKILL.md`):
  teaches how to add/edit `knowledge.json` entries correctly — schema,
  keyword/topic selection, and the strict grounding rule.
- **Command — `/add-project`** (`.claude/commands/add-project.md`): adds a
  new project card to `code.html`/`index.html` and a matching
  `knowledge.json` entry, kept in sync.
- **Command — `/sync-twin`** (`.claude/commands/sync-twin.md`):
  regenerates the quick-question chip buttons from `knowledge.json`.
- **Plugin — knowledge consistency guard** (`scripts/check-knowledge-consistency.js`,
  `npm run check:consistency`): validates `knowledge.json` for cross-entry
  problems the schema check alone can't catch — the same keyword or `chip`
  question declared by two different entries, which would silently break
  retrieval or produce a duplicate chip button. See "Knowledge Base" below.
- **Hook — `PostToolUse`** (`.claude/settings.json` →
  `scripts/twin-guard-hook.js`): runs the schema check, the knowledge
  consistency guard, the grounding guard, and the fallback guard
  automatically whenever Claude edits `knowledge.json`, `code.html`, or
  `index.html`, blocking the edit on failure.
- **`hooks/pre-commit`**: a plain git pre-commit hook mirroring the same
  checks, for anyone who wants it wired into `.git/hooks/` directly.

## Tech Stack

- HTML5 + Tailwind CSS (loaded via CDN, configured inline in `code.html`)
- Vanilla JavaScript (no framework, no bundler)
- Google Fonts / Material Symbols (loaded in `<head>`)
- Node.js — used only for the dependency-free `scripts/` validation/test
  tooling, not for building or serving the site itself

## Project Structure

```
portfolio/
├── code.html                # the whole site (source of truth)
├── index.html                # byte-identical mirror; static-hosting entry point
├── knowledge.json            # Digital Twin's single source of truth
├── DESIGN.md                 # design system spec (colors, type, spacing)
├── PLAN.md                   # build spec: features, plugin components, done/pending
├── package.json               # npm scripts for the validation/test tooling
├── profile.png, bot-avatar.jpg
├── scripts/
│   ├── validate-knowledge.js         # knowledge.json schema check
│   ├── check-knowledge-consistency.js # cross-entry keyword/chip collision guard (plugin)
│   ├── check-twin-grounding.js       # no hardcoded answers in the twin engine
│   ├── check-fallback.js             # fallback sourced only from knowledge.json
│   ├── test-twin-engine.js           # functional retrieval tests
│   ├── sync-twin-chips.js            # regenerates quick-question chips
│   └── twin-guard-hook.js            # PostToolUse hook entry point
├── hooks/
│   └── pre-commit                    # git pre-commit mirror of the same checks
└── .claude/
    ├── settings.json                 # wires the PostToolUse hook
    ├── skills/twin-knowledge-base/SKILL.md
    └── commands/{add-project.md,sync-twin.md}
```

## Running Locally

`knowledge.json` is loaded via `fetch()`, so the site must be served over
http(s) — opening `index.html` directly via `file://` fails the fetch
under browser CORS rules:

```
npx serve .
# or
python -m http.server
```

## Testing

All tooling is dependency-free (plain Node scripts, zero npm packages):

```
npm run validate:knowledge   # knowledge.json schema check
npm run check:consistency    # cross-entry keyword/chip collision guard
npm run validate:twin        # grounding guard + fallback guard
npm run test:twin            # functional retrieval tests
npm run sync:twin            # regenerate quick-question chips from knowledge.json
npm run precommit            # all of the above, in order
```

## Knowledge Base

`knowledge.json` is the single source of truth for everything the Digital
Twin can say. It holds simple fact entries (`answer`) for identity/
education/interests/skills/location, and structured `data` entries for
each project (summary, purpose, problem, technologies, features,
implementation, outcome, and — where documented — role/timeline). A
missing `data` field means the twin falls back rather than guessing. See
`.claude/skills/twin-knowledge-base/SKILL.md` for the full schema and
authoring rules, and `npm run check:consistency` for the automated guard
against duplicate keywords/chips.

## Grounding

The Digital Twin does not retrieve information from external sources. It
never calls an LLM or external AI API, never searches the internet, and
never reads from GitHub or LinkedIn at runtime — every answer is built
from `knowledge.json` alone, and unsupported questions get the exact
fallback string above. See `CLAUDE.md` for the full non-negotiable rule.
