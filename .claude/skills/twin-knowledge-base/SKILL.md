---
name: twin-knowledge-base
description: Add or edit Digital Twin knowledge in knowledge.json — schema, keyword/topic selection, and the strict portfolio-grounding rule. Use whenever a task adds a fact, project, link, or skill the Digital Twin should be able to answer about.
---

# Twin Knowledge Base

The Digital Twin (the chat widget in `code.html`'s `#digital-twin` section)
answers **only** from `knowledge.json`. This skill covers how to add or edit
entries in that file correctly. Read `CLAUDE.md`'s "one non-negotiable rule"
section before using it if you haven't already.

## The strict grounding rule

- Every factual statement the twin can make must already be explicitly
  stated somewhere in the portfolio (`code.html`'s visible content, or a
  fact the user gives you directly for this task).
- **Never invent** personal facts, project details, technologies,
  experience, links, or achievements — even ones that would sound
  plausible or impressive.
- Never embellish an answer with adjectives or claims ("passionate about",
  "expert in") unless that exact framing is already present in the
  portfolio content.
- If a fact isn't available, leave it out of the entry rather than guess.
  An unmatched question should fall through to `meta.fallback`, not to a
  best-effort guess.

## Schema

There are two entry shapes. A **simple fact** (identity, education,
interests, skills, location, a portfolio overview) answers with one fixed
`answer` string. A **project** entry answers many different questions
(purpose, tech stack, features, ...) built at query time from a
structured `data` object — never invent a project's `answer` field by
hand.

```json
{
  "meta": {
    "twinName": "Portfolio Twin",
    "fallback": "I don't have that information in my portfolio knowledge yet."
  },
  "entries": [
    {
      "id": "kebab-case-unique-id",
      "topics": ["one-or-more", "grouping-tags"],
      "keywords": ["phrases", "or substrings", "used for matching"],
      "chip": "Optional: a short question for the quick-question chips",
      "answer": "The exact, portfolio-grounded answer text (simple facts only)."
    },
    {
      "id": "project-kebab-id",
      "topics": ["project", "project-kebab-id", "category-tag"],
      "keywords": ["project name", "aliases", "domain-specific terms"],
      "data": {
        "name": "Short display name",
        "fullName": "Full title, if different from name",
        "domain": "Category shown on the project card (e.g. Data Science)",
        "summary": "1-2 sentence description, reused from the project card.",
        "purpose": "What the project is for — only if distinctly documented.",
        "problem": "What problem/challenge it addresses — only if documented.",
        "technologies": ["Only", "technologies", "actually listed"],
        "features": ["Decomposed, factual bullet points from the description"],
        "implementation": "How it works — only if documented.",
        "outcome": "A stated result/metric — only if documented.",
        "role": "Meghna's stated role/context — only if documented.",
        "builtWhen": "A stated build date — only if documented (rare).",
        "status": "A stated project status — only if documented (rare).",
        "githubUrl": "The project's own repo link, if shown on its card."
      }
    }
  ]
}
```

Field rules (both shapes):
- `id` — kebab-case, unique across all entries. Validated by
  `scripts/validate-knowledge.js`.
- `topics` — non-empty array of lowercase tag strings. For a project
  entry, include `"project"` plus the entry's own id plus a category tag
  matching the project card (`"data-science"`, `"machine-learning"`,
  `"automation"`, `"full-stack"`, etc.).
- `keywords` — non-empty array of lowercase phrases or substrings a user
  might type. This is also how the retrieval engine's entity detector
  recognizes "the user is asking about this specific project" before
  looking at intent — so cover the name, common variants, and 1-2
  domain-specific terms (a dataset name, a technique).
- `chip` — optional, quick-question chip. Unchanged from before.

`data` object rules (project entries only):
- `name` is required; everything else is optional and MUST be omitted
  entirely — not left as an empty string or a guess — when the portfolio
  doesn't state it. The retrieval engine checks for the field's presence
  and returns the *exact* `meta.fallback` string when it's missing; it
  never fabricates a placeholder sentence like "not documented".
- `technologies` and `features` are arrays of short, factual strings.
  `features` may be the project's description decomposed into bullet
  points (that's re-segmenting a documented fact, not inventing one) —
  but never add a bullet that states something beyond what's written.
- Common miss: don't invent `builtWhen`/`role`/`status`/`outcome` just
  because the schema has a slot for them. Leave the key out.

## Choosing keywords

- Look at what's actually written in `code.html` for that fact (about
  text, a project card's title/description/tags) and lift the phrasing
  used there — don't paraphrase into something that sounds better.
- Include the obvious direct phrasing ("tasteorbit", "taste orbit") plus
  1–2 adjacent terms someone might use instead (a technology name, a
  domain word like "zomato" or "restaurant").
- Avoid single common words as the *only* keyword for a specific-fact
  entry (e.g. don't key the TasteOrbit entry only on "restaurant" if that
  word could plausibly appear in an unrelated question) — pair specific
  and general terms.
- For a project entry, a keyword that's also a distinguishing fact (e.g.
  "ocr", "anomaly detection") lets a logical question like "which project
  uses OCR?" resolve straight to that project. That's fine and intended.
- Don't reuse a keyword another entry already declares — run
  `npm run check:consistency` after adding keywords to catch this
  automatically rather than reading every existing entry by hand.

## Choosing topics

- Reuse existing topic tags already in `knowledge.json` where the new
  entry fits one (`projects`, `identity`, `education`, `interests`,
  `skills`, `location`, `portfolio`) instead of inventing near-duplicates.
- A project entry should include `"project"` plus its own id plus one
  category tag matching the project card.

## Writing simple-fact answers

- State only what's on the page. Keep it to 1–3 sentences. This is a chat
  bubble, not a full page.
- Never write a second, slightly different fallback message here — the
  fallback always comes from `meta.fallback` alone.

## Writing project `data` fields

- Reuse the project card's description almost verbatim for `summary` —
  that text is already approved and fact-checked.
- Where the description has clearly separable ideas (e.g. "merges video
  and telemetry" vs. "raises the threshold to 90% confidence"), split
  them across `implementation`/`features`/`outcome` rather than repeating
  one undivided paragraph in every field — but do not add words that
  change the meaning.
- Never write a value for `purpose`, `role`, `builtWhen`, `outcome`, or
  `status` that isn't a direct restatement of something already written
  somewhere in the portfolio.

## The retrieval engine's intent system (for context, not to hand-edit)

`code.html`'s twin engine block (between `<!-- TWIN-ENGINE:START -->` and
`<!-- TWIN-ENGINE:END -->`) does, in order: (1) comparison detection —
"compare X and Y" — using only fields present on both named projects; (2)
explicit project-name / follow-up-pronoun detection, then an "intent"
regex table (tech stack, features, purpose, problem, role, timeline,
domain, outcome, implementation, short/detailed summary) picks which
`data` field(s) to answer from; (3) a generic cross-project search
("which project uses OCR?") over all projects' `data` fields, used only
when no specific project was named; (4) the old keyword/topic scored
match against the simple `answer` entries; (5) `meta.fallback`. None of
this branches on individual facts — it only reads `entry.data.<field>` —
so adding a new project's `data` object is enough; you should not need to
touch the engine itself for a new project or fact.

## After editing knowledge.json

1. Run `npm run validate:knowledge` — schema check (unique ids, required
   fields, non-empty arrays/strings, and — for project entries — at least
   one descriptive `data` field).
2. Run `npm run check:consistency` — the knowledge consistency guard
   (`scripts/check-knowledge-consistency.js`). This catches problems
   `validate-knowledge.js` can't see because they only show up when
   comparing entries against each other: the same keyword declared by two
   different entries, or the same `chip` question text used twice. Both
   are real bugs, not style nits — the retrieval engine matches keywords
   with a plain substring check and no tie-break
   (`scoreEntry`/`detectProjectEntities` in `code.html`'s TWIN-ENGINE
   block), so a duplicated keyword means one entry's trigger silently
   shadows the other's, and a duplicated chip means one entry's quick
   question is never reachable. It also warns (without failing) if one
   entry repeats the same keyword twice in its own array — harmless, but
   worth cleaning up. Run this after adding or renaming any `keywords` or
   `chip` value, not just after adding a whole new entry.
3. Run `npm run test:twin` — confirms the retrieval engine still resolves
   sample questions to the right entries and unrelated questions still
   fall through to the fallback.
4. If you added or changed a `chip` field, run `npm run sync:twin` (or use
   the `/sync-twin` command) to regenerate the chip buttons in `code.html`
   and `index.html`.

All four checks (plus the grounding/fallback guards) run in one shot via
`npm run precommit`, and automatically via the `PostToolUse` hook whenever
Claude edits `knowledge.json`, `code.html`, or `index.html` — see the
"Knowledge consistency guard" entry in `PLAN.md`'s plugin section.

## What never to do

- Never add a new `if (query.includes(...)) { return "..." }` branch, or
  a new hardcoded per-fact `if`/`else` in the intent handling, to the
  twin's `<script>` block in `code.html` — that's exactly the hardcoded
  pattern this project moved away from, and
  `scripts/check-twin-grounding.js` will fail on a reintroduced literal
  keyword branch.
- Never write a fact directly into `code.html`'s script and skip
  `knowledge.json` — the UI only renders/queries the knowledge base, it
  never states facts itself.
- Never duplicate the fallback sentence as a second string literal
  anywhere — `scripts/check-fallback.js` will fail on it.
- Never fill a missing `data` field with a guess, a placeholder sentence,
  or an inferred category (e.g. don't label a project "computer vision"
  just because it uses OpenCV, unless the portfolio itself says so) — an
  unanswerable field must fall through to the exact fallback string.
