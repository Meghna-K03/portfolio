---
description: Add a new project to the portfolio's Projects section AND the Digital Twin's knowledge.json, kept in sync. Usage — /add-project <short description of the project, including title, what it does, and technologies used>
---

# /add-project

Add a new project end-to-end from the description the user gives after
this command. The project must land in **two** places, kept in sync — it
is not done if only one is updated:

1. A new project card in `code.html`'s `#projects` section (and the
   identical mirror in `index.html`).
2. A matching entry in `knowledge.json` so the Digital Twin can answer
   questions about it (see the `twin-knowledge-base` skill for the schema
   and grounding rule — load it before writing the entry).

## Steps

1. **Read what's already there.** Read `code.html`'s `#projects` section
   to see the existing card markup (look at the four existing `CARD 0N`
   blocks) and find the
   `<!-- PROJECTS-GRID:APPEND-NEW-CARDS-ABOVE-THIS-LINE -->` marker —
   new cards are inserted immediately above it. Also read `knowledge.json`
   to see the existing entry shape and pick a numbering/id that doesn't
   collide.

2. **Extract only what the user actually gave you.** From the user's
   description, identify: project title, one/two-sentence description,
   category label (e.g. "Data Science", "Machine Learning", "Automation",
   "Full-Stack / AI" — reuse an existing category if it fits, don't
   invent a new visual style of badge), technology tags, and a project
   link if one was given.
   - **Never invent** a missing fact (accuracy metric, dataset name,
     GitHub link, etc.). If the user didn't give you a project link, use
     `href="#"` and leave a `<!-- TODO: add project link -->` comment
     next to it — do not fabricate a URL.
   - Only use a placeholder where the user explicitly left something out;
     do not pad the description with generic filler to make it sound more
     complete.

3. **Add the card to `code.html`.** Copy the structure of an existing
   card exactly (same Tailwind classes, same `space-y-3.5` /
   `pt-4 border-t` structure, same numbered badge style bumped to the
   next number, same tag-pill markup for the technology list). Pick an
   icon name for the `material-symbols-outlined` thumbnail that fits the
   project's domain (e.g. `insights`, `smart_toy`, `dataset`) — check
   https://fonts.google.com/icons naming conventions used by the existing
   four cards (`restaurant`, `visibility`, `receipt_long`,
   `location_city`) for the icon style, but don't fetch the URL — just
   follow the naming pattern. Insert the new card immediately above the
   `PROJECTS-GRID:APPEND-NEW-CARDS-ABOVE-THIS-LINE` marker.

4. **Mirror the change into `index.html`.** These two files must stay
   byte-identical (confirm with `diff code.html index.html` after
   editing) — copy the same card into the same position there.

5. **Add the knowledge.json entry.** Use the `twin-knowledge-base` skill's
   project schema (a structured `data` object, not a single `answer`
   string — see that skill for the full field list). Generate:
   - `id`: kebab-case, derived from the project title, unique.
   - `topics`: `["project", "<id>", "<category-tag>"]` matching the card's
     category.
   - `keywords`: the project's title (and a natural variant or two, e.g.
     with/without spaces), plus one or two domain-specific terms from the
     description — mirror how the existing four project entries do this.
   - `data.name` (required) and `data.fullName`/`data.domain` from the
     title/category the user gave.
   - `data.summary`: reuse the same description you put on the card, near
     verbatim.
   - `data.technologies`: the technology tag list.
   - `data.purpose` / `data.problem` / `data.features` / `data.implementation`
     / `data.outcome` / `data.role`: only include the ones the user's
     description actually supports — decomposing one sentence into a
     `features` bullet is fine, inventing a new claim is not. Omit the key
     entirely (do not write a placeholder value) for anything not given.
   - `data.githubUrl`: only if the user gave a link; otherwise omit it —
     don't invent one (matches the card's own `href="#"` + TODO rule
     above).

6. **Validate.** Run, in order:
   - `npm run validate:knowledge`
   - `npm run test:twin`
   - `npm run validate:twin`
   Fix anything that fails before considering this done.

7. **Report back** which id/keywords/topics you chose and where the card
   was inserted, and flag anything you used a placeholder for (so the
   user knows what to fill in later) — same rule as the rest of this
   project: GitHub/LinkedIn placeholder replacement elsewhere on the page
   is out of scope unless the user is talking about this new project's
   own link.
