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
      "answer": "The exact, portfolio-grounded answer text."
    }
  ]
}
```

Field rules:
- `id` — kebab-case, unique across all entries. Validated by
  `scripts/validate-knowledge.js`.
- `topics` — non-empty array of lowercase tag strings (e.g. `projects`,
  `education`, `skills`). Used for light topic-word scoring and for
  grouping in future tooling.
- `keywords` — non-empty array of lowercase phrases or substrings a user
  might type. The retrieval engine does case-insensitive substring
  matching, so prefer natural phrases ("who is meghna", "what does she
  study") over single generic words where possible, to avoid
  over-matching unrelated questions.
- `chip` — optional. Only set this for entries that should appear as a
  quick-question suggestion button. `/sync-twin` regenerates the chip
  buttons from every entry that has this field, in `knowledge.json` order.
- `answer` — the exact text the twin will send back verbatim. Write it in
  complete sentences; it's shown as-is in the chat bubble.

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

## Choosing topics

- Reuse existing topic tags already in `knowledge.json` where the new
  entry fits one (`projects`, `identity`, `education`, `interests`,
  `skills`, `location`) instead of inventing near-duplicates.
- A project entry should include `"projects"` plus one more specific tag
  (`"data-science"`, `"machine-learning"`, `"automation"`,
  `"full-stack"`, etc.) matching the category shown on its project card.

## Writing the answer

- State only what's on the page. Reuse the project card's description
  almost verbatim for project entries — that description is already the
  approved, fact-checked text.
- Keep it to 1–3 sentences. This is a chat bubble, not a full page.
- Never write a second, slightly different fallback message here — the
  fallback always comes from `meta.fallback` alone.

## After editing knowledge.json

1. Run `npm run validate:knowledge` — schema check (unique ids, required
   fields, non-empty arrays/strings).
2. Run `npm run test:twin` — confirms the retrieval engine still resolves
   sample questions to the right entries and unrelated questions still
   fall through to the fallback.
3. If you added or changed a `chip` field, run `npm run sync:twin` (or use
   the `/sync-twin` command) to regenerate the chip buttons in `code.html`
   and `index.html`.

## What never to do

- Never add a new `if (query.includes(...)) { return "..." }` branch to
  the twin's `<script>` block in `code.html` — that's exactly the
  hardcoded pattern this project moved away from, and
  `scripts/check-twin-grounding.js` will fail on it.
- Never write a fact directly into `code.html`'s script and skip
  `knowledge.json` — the UI only renders/queries the knowledge base, it
  never states facts itself.
- Never duplicate the fallback sentence as a second string literal
  anywhere — `scripts/check-fallback.js` will fail on it.
