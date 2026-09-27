#!/usr/bin/env node
// Knowledge consistency guard: catches cross-entry collisions in
// knowledge.json that validate-knowledge.js's per-entry schema check can't
// see, because they only show up when comparing entries against each other.
//
// The retrieval engine (code.html's TWIN-ENGINE block) matches keywords with
// plain substring checks and no tie-breaking: scoreEntry() and
// detectProjectEntities() both just test whether the query contains a
// keyword string. If two entries declare the same keyword, whichever entry
// happens to be checked/scored first wins silently, and the other entry's
// intended trigger stops working — with no error anywhere.
//
// Checks:
//   1. The same keyword string used by two or more different entries
//      (cross-entry collision — the real functional risk described above).
//   2. The same keyword repeated more than once inside one entry's own
//      keywords array (harmless to retrieval, but a sign of copy-paste
//      drift worth flagging).
//   3. The same `chip` question text used by two or more entries (would
//      render a duplicate quick-question button, and one entry's chip would
//      never be reachable by clicking).
'use strict';

const fs = require('fs');
const path = require('path');

const KNOWLEDGE_PATH = path.join(__dirname, '..', 'knowledge.json');

let knowledge;
try {
  knowledge = JSON.parse(fs.readFileSync(KNOWLEDGE_PATH, 'utf8'));
} catch (err) {
  console.error(`Could not read/parse knowledge.json: ${err.message}`);
  process.exit(2);
}

const entries = Array.isArray(knowledge.entries) ? knowledge.entries : [];

const errors = [];
const warnings = [];

// 1 & 2: keyword collisions, cross-entry (error) and within-entry (warning).
const keywordOwners = new Map(); // normalized keyword -> [entry ids]

entries.forEach((entry) => {
  const id = entry && entry.id ? entry.id : '(missing id)';
  const keywords = Array.isArray(entry.keywords) ? entry.keywords : [];

  const seenInThisEntry = new Set();
  keywords.forEach((kw) => {
    if (typeof kw !== 'string' || kw.trim() === '') return;
    const norm = kw.trim().toLowerCase();

    if (seenInThisEntry.has(norm)) {
      warnings.push(`entry "${id}" repeats the keyword "${norm}" more than once in its own keywords array.`);
    }
    seenInThisEntry.add(norm);

    if (!keywordOwners.has(norm)) keywordOwners.set(norm, []);
    keywordOwners.get(norm).push(id);
  });
});

keywordOwners.forEach((owners, keyword) => {
  const distinctOwners = [...new Set(owners)];
  if (distinctOwners.length > 1) {
    errors.push(`keyword "${keyword}" is declared by more than one entry (${distinctOwners.join(', ')}) — the retrieval engine matches keywords with a plain substring check and no tie-break, so one entry's trigger will silently shadow the other's.`);
  }
});

// 3: duplicate chip text.
const chipOwners = new Map(); // normalized chip text -> [entry ids]

entries.forEach((entry) => {
  const id = entry && entry.id ? entry.id : '(missing id)';
  if (typeof entry.chip !== 'string' || entry.chip.trim() === '') return;
  const norm = entry.chip.trim().toLowerCase();
  if (!chipOwners.has(norm)) chipOwners.set(norm, []);
  chipOwners.get(norm).push(id);
});

chipOwners.forEach((owners, chip) => {
  const distinctOwners = [...new Set(owners)];
  if (distinctOwners.length > 1) {
    errors.push(`chip text "${chip}" is declared by more than one entry (${distinctOwners.join(', ')}) — quick-question buttons would be indistinguishable and only one entry would ever be reachable by clicking.`);
  }
});

if (warnings.length > 0) {
  console.warn('Knowledge consistency guard warnings:\n');
  warnings.forEach((w) => console.warn(`  - ${w}`));
  console.warn('');
}

if (errors.length > 0) {
  console.error('Knowledge consistency guard failed:\n');
  errors.forEach((e) => console.error(`  - ${e}`));
  console.error('');
  process.exit(2);
}

console.log(`Knowledge consistency guard passed: no cross-entry keyword or chip collisions found (${entries.length} entries, ${keywordOwners.size} distinct keywords).`);
