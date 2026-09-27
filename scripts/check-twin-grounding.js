#!/usr/bin/env node
// Knowledge-base guard (grounding half): scans the Digital Twin engine block
// in code.html / index.html for hardcoded factual answers that would bypass
// knowledge.json.
//
// What this checks, concretely, inside the <!-- TWIN-ENGINE:START --> ...
// <!-- TWIN-ENGINE:END --> marker block only (never the rest of the page —
// this keeps it from flagging ordinary UI copy, labels or placeholders):
//
//   1. `if (...includes(...)) { return "..." }` — the exact brittle
//      keyword-branch pattern this project used before the retrieval engine
//      existed. Any reappearance means someone hand-added a fact again.
//   2. `return` immediately followed by a quoted string literal of 15+
//      characters — a plain-language sentence returned directly from a
//      function, instead of `entry.answer` / `knowledge.meta.fallback`.
//
// A short literal (`return '';`, `return false` is not even a string) does
// not trigger this; neither does `return someVariable.property`.
'use strict';

const fs = require('fs');
const path = require('path');

const FILES = ['code.html', 'index.html'];
const START_MARKER = '<!-- TWIN-ENGINE:START -->';
const END_MARKER = '<!-- TWIN-ENGINE:END -->';

const HARDCODED_BRANCH = /if\s*\([^)]*\.includes\([^)]*\)\)[^{]*\{\s*return\s*["'`]/;
const HARDCODED_RETURN_LITERAL = /return\s*["'`][^"'`]{15,}["'`]/g;

let failed = false;

FILES.forEach((file) => {
  const filePath = path.join(__dirname, '..', file);
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, 'utf8');
  const startIdx = content.indexOf(START_MARKER);
  const endIdx = content.indexOf(END_MARKER);

  if (startIdx === -1 || endIdx === -1) {
    console.error(`${file}: could not find TWIN-ENGINE markers — has the digital twin script been restructured?`);
    failed = true;
    return;
  }

  const block = content.slice(startIdx, endIdx);

  if (HARDCODED_BRANCH.test(block)) {
    console.error(`${file}: found a hardcoded "if (...includes(...)) { return \\"...\\" }" branch in the twin engine block. Move this fact into knowledge.json instead.`);
    failed = true;
  }

  const matches = block.match(HARDCODED_RETURN_LITERAL) || [];
  if (matches.length > 0) {
    console.error(`${file}: found ${matches.length} hardcoded string literal return(s) in the twin engine block:`);
    matches.forEach((m) => console.error(`  ${m.slice(0, 80)}...`));
    console.error('  Factual answers must come from entry.answer or knowledge.meta.fallback.');
    failed = true;
  }
});

if (failed) {
  process.exit(2);
}

console.log('Twin grounding guard passed: no hardcoded answers found in the digital twin engine block.');
