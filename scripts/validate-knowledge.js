#!/usr/bin/env node
// Knowledge-base guard: validates knowledge.json against the schema
// documented in CLAUDE.md / PLAN.md. Run via `npm run validate:knowledge`.
'use strict';

const fs = require('fs');
const path = require('path');

const KNOWLEDGE_PATH = path.join(__dirname, '..', 'knowledge.json');

function fail(errors) {
  console.error('knowledge.json validation failed:\n');
  errors.forEach((e) => console.error(`  - ${e}`));
  console.error('');
  process.exit(2);
}

let raw;
try {
  raw = fs.readFileSync(KNOWLEDGE_PATH, 'utf8');
} catch (err) {
  fail([`Could not read ${KNOWLEDGE_PATH}: ${err.message}`]);
  return;
}

let data;
try {
  data = JSON.parse(raw);
} catch (err) {
  fail([`knowledge.json is not valid JSON: ${err.message}`]);
  return;
}

const errors = [];

if (!data || typeof data !== 'object' || Array.isArray(data)) {
  fail(['Root of knowledge.json must be an object']);
}

if (!data.meta || typeof data.meta !== 'object') {
  errors.push('meta must be an object');
} else {
  if (typeof data.meta.fallback !== 'string' || data.meta.fallback.trim() === '') {
    errors.push('meta.fallback must be a non-empty string');
  }
  if (typeof data.meta.twinName !== 'string' || data.meta.twinName.trim() === '') {
    errors.push('meta.twinName must be a non-empty string');
  }
}

if (!Array.isArray(data.entries)) {
  errors.push('entries must be an array');
} else {
  const seenIds = new Set();
  data.entries.forEach((entry, i) => {
    const where = `entries[${i}]`;
    if (!entry || typeof entry !== 'object') {
      errors.push(`${where} must be an object`);
      return;
    }
    if (typeof entry.id !== 'string' || entry.id.trim() === '') {
      errors.push(`${where}.id must be a non-empty string`);
    } else if (seenIds.has(entry.id)) {
      errors.push(`${where}.id "${entry.id}" is not unique`);
    } else {
      seenIds.add(entry.id);
    }

    if (!Array.isArray(entry.topics) || entry.topics.length === 0 || !entry.topics.every((t) => typeof t === 'string' && t.trim() !== '')) {
      errors.push(`${where}.topics must be a non-empty array of non-empty strings`);
    }

    if (!Array.isArray(entry.keywords) || entry.keywords.length === 0 || !entry.keywords.every((k) => typeof k === 'string' && k.trim() !== '')) {
      errors.push(`${where}.keywords must be a non-empty array of non-empty strings`);
    }

    // An entry is either a simple fact (`answer`: string) or a structured
    // project entry (`data`: object) — never both missing, never both empty.
    const hasAnswer = typeof entry.answer === 'string' && entry.answer.trim() !== '';
    const hasData = entry.data && typeof entry.data === 'object' && !Array.isArray(entry.data);

    if (!hasAnswer && !hasData) {
      errors.push(`${where} must have a non-empty "answer" string or a "data" object`);
    }

    if (hasData) {
      const data = entry.data;
      if (typeof data.name !== 'string' || data.name.trim() === '') {
        errors.push(`${where}.data.name must be a non-empty string`);
      }

      const descriptiveStringFields = ['fullName', 'domain', 'summary', 'purpose', 'problem', 'implementation', 'outcome', 'role', 'builtWhen', 'status', 'githubUrl'];
      descriptiveStringFields.forEach((field) => {
        if (field in data && (typeof data[field] !== 'string' || data[field].trim() === '')) {
          errors.push(`${where}.data.${field} must be a non-empty string when present`);
        }
      });

      const descriptiveListFields = ['technologies', 'features'];
      descriptiveListFields.forEach((field) => {
        if (field in data && (!Array.isArray(data[field]) || data[field].length === 0 || !data[field].every((v) => typeof v === 'string' && v.trim() !== ''))) {
          errors.push(`${where}.data.${field} must be a non-empty array of non-empty strings when present`);
        }
      });

      const hasAnyDescriptiveContent = descriptiveStringFields.some((f) => f in data) || descriptiveListFields.some((f) => f in data);
      if (!hasAnyDescriptiveContent) {
        errors.push(`${where}.data must include at least one descriptive field (e.g. summary)`);
      }
    }
  });
}

if (errors.length > 0) {
  fail(errors);
}

console.log(`knowledge.json is valid (${data.entries.length} entries).`);
