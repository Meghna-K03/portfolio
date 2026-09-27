# CLAUDE.md — Portfolio Digital Twin

This file is read by Claude Code at the start of every session in this repo.

## What this repo is

A single-page portfolio site with a "Digital Twin" chat widget embedded in
it. The chat widget answers visitor questions about the portfolio owner.
It is **not** a general chatbot — it's a narrow Q&A widget over one small,
hand-maintained knowledge base.

## The one non-negotiable rule

> The Digital Twin only answers from `knowledge.json`. It never uses
> outside/general/model knowledge. If the knowledge base doesn't cover a
> question, it replies with the fallback string, verbatim:
> **"I don't have that information in my portfolio knowledge yet."**

This applies no matter how the question is phrased or how plausible a
guessed answer would sound. If this is ever wired to an LLM instead of
keyword matching, the system prompt must state this rule explicitly and
the knowledge base content must be the *only* context given to the model —
never let it fill gaps from training data.

Check every change to the answer logic against this rule before merging.
When in doubt, prefer the fallback over a plausible-sounding guess.

## Repo layout

- `code.html` — the whole site (HTML + Tailwind CDN config + inline `<script>`)
- `index.html` — kept byte-identical to `code.html` (the site's actual
  entry point for static hosting). Any edit to one must be mirrored to
  the other — verify with `diff code.html index.html`.
- `DESIGN.md` — design system spec (colors, type, spacing)
- `knowledge.json` — the Digital Twin's single source of truth
- `PLAN.md` — build spec: features, plugin components, done/pending
- `scripts/` — Node validation/test tooling (schema check, grounding
  guard, fallback guard, functional retrieval tests, chip sync). Run via
  `npm run validate:knowledge`, `npm run validate:twin`,
  `npm run test:twin`, `npm run sync:twin`, or `npm run precommit` for
  all of them. Zero npm dependencies — plain Node scripts, not a build
  step for the site itself.
- `.claude/` — the `twin-knowledge-base` skill, the `/add-project` and
  `/sync-twin` commands, and the `PostToolUse` hook that runs the guard
  scripts automatically after edits to `knowledge.json`/`code.html`/
  `index.html`.

No build step, no backend, no dependencies beyond the Tailwind CDN script
and web fonts loaded in `<head>`. Keep it that way unless a task
explicitly calls for a backend — this should stay a static file that's
easy to host anywhere (GitHub Pages, Netlify, Vercel static). Note:
`knowledge.json` is loaded via `fetch()`, so local testing needs an
http(s) server (e.g. `npx serve` or `python -m http.server`) —
opening the file directly via `file://` will fail the fetch under
browser CORS rules.

## Working conventions

- **Content vs. code stay separate.** Every fact the twin can state (bio,
  education, projects, links, stack) lives in `knowledge.json`, never
  hardcoded inside `<script>` tags. New fact → new knowledge base entry
  first; the UI just renders/queries it.
- **Placeholders are placeholders.** Contact links may start as `href="#"`
  or example emails. When real links/projects are added, update them in
  the markup *and* in `knowledge.json` — don't add a fact in only one
  place.
- **Don't restyle from memory.** Pull colors/type/spacing from `DESIGN.md`
  or the existing Tailwind config rather than inventing new values.
- **Keep it a single HTML file** unless a task says otherwise.
- **Every new fact needs a fallback-safe test.** After adding entries,
  check that a few adjacent-but-uncovered questions still return the
  fallback string instead of a nearby-but-wrong answer.

## Where to look before making changes

- Read `PLAN.md` for current feature status before starting, and update it
  when you finish something.
- Read `DESIGN.md` before touching any visual styling.
- The twin's logic lives in the final `<script>` block of `code.html`.

## Plugin components

This project uses a small Claude Code plugin (skills/commands/hooks) to
keep the knowledge base and the UI in sync. Full specs are in `PLAN.md`
under "Plugin components." Skills and commands never write facts directly
into `code.html`'s `<script>` block — they write to `knowledge.json` and
regenerate the rendered bits (quick-question chips, project cards) from it.
