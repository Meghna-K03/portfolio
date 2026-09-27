#!/usr/bin/env node
// Fallback-string guard: makes sure knowledge.json's meta.fallback and the
// fallback the answer engine actually returns can never diverge.
//
// Checks:
//   1. knowledge.json has a non-empty meta.fallback.
//   2. The twin engine block references `knowledge.meta.fallback` (or
//      `<var>.meta.fallback`) rather than a separately typed string.
//   3. The exact fallback sentence does not also appear as a quoted string
//      literal elsewhere in the twin engine block — that would mean a
//      second, hand-typed copy that could drift from knowledge.json.
'use strict';

const fs = require('fs');
const path = require('path');

const FILES = ['code.html', 'index.html'];
const START_MARKER = '<!-- TWIN-ENGINE:START -->';
const END_MARKER = '<!-- TWIN-ENGINE:END -->';

let failed = false;

let knowledge;
try {
  knowledge = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'knowledge.json'), 'utf8'));
} catch (err) {
  console.error(`Could not read/parse knowledge.json: ${err.message}`);
  process.exit(2);
}

const fallback = knowledge && knowledge.meta && knowledge.meta.fallback;
if (typeof fallback !== 'string' || fallback.trim() === '') {
  console.error('knowledge.json meta.fallback is missing or empty.');
  process.exit(2);
}

const REFERENCES_FALLBACK_PROPERTY = /\w+\.meta\.fallback/;

FILES.forEach((file) => {
  const filePath = path.join(__dirname, '..', file);
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, 'utf8');
  const startIdx = content.indexOf(START_MARKER);
  const endIdx = content.indexOf(END_MARKER);

  if (startIdx === -1 || endIdx === -1) {
    console.error(`${file}: could not find TWIN-ENGINE markers.`);
    failed = true;
    return;
  }

  const block = content.slice(startIdx, endIdx);

  if (!REFERENCES_FALLBACK_PROPERTY.test(block)) {
    console.error(`${file}: the twin engine block never reads "<knowledge>.meta.fallback" — the fallback isn't wired to knowledge.json.`);
    failed = true;
  }

  // Look for the fallback sentence typed out as a second, separate string
  // literal (a sign it was hardcoded instead of read from knowledge.json).
  const escaped = fallback.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const literalFallbackRe = new RegExp(`["'\`]${escaped}["'\`]`);
  if (literalFallbackRe.test(block)) {
    console.error(`${file}: the fallback sentence appears as a hardcoded string literal in the twin engine block — it must only be read from knowledge.meta.fallback.`);
    failed = true;
  }
});

if (failed) {
  process.exit(2);
}

console.log('Fallback-string guard passed: fallback is sourced only from knowledge.meta.fallback.');
