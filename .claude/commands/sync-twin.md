---
description: Regenerate the Digital Twin's quick-question chip buttons in code.html/index.html from knowledge.json, so suggested questions always match what's actually in the knowledge base.
---

# /sync-twin

Regenerate the quick-question chip buttons from `knowledge.json`. This
command has a plain, deterministic implementation — run it rather than
hand-writing chip HTML:

```
node scripts/sync-twin-chips.js
```

This script:
- Reads every entry in `knowledge.json` that has a `chip` field.
- Rebuilds the button markup between the
  `<!-- TWIN-CHIPS:START --> ... <!-- TWIN-CHIPS:END -->` markers in both
  `code.html` and `index.html`, preserving the existing button classes/
  styling exactly (it does not touch anything outside those markers, so
  the visual design is untouched).
- Never invents a chip for a topic/entry that doesn't exist — chips only
  come from entries that explicitly declare `chip` in `knowledge.json`.

## When to add/remove a chip

Chips are data, not code: to add, remove, or reorder a suggested
question, edit the relevant entry's `chip` field in `knowledge.json`
(add `"chip": "..."` to make an entry suggestible, delete the field to
stop suggesting it), then re-run this command. Do not hardcode a new
question directly into the button markup in `code.html`.

## After running

1. Confirm `diff code.html index.html` reports no differences (the two
   files must stay identical).
2. Run `npm run test:twin` to confirm the retrieval engine still answers
   each generated chip's question correctly.
3. Report which chips changed (added/removed/reordered) compared to
   before.
