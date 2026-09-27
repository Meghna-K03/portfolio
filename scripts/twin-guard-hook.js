#!/usr/bin/env node
// Claude Code PostToolUse hook entry point. Reads the tool-call JSON Claude
// Code pipes on stdin, and — only when the edited file is knowledge.json,
// code.html or index.html — runs the three guard scripts. Exits 2 (blocking
// error, per Claude Code hook conventions) with the guards' own stderr if
// any of them fail; exits 0 otherwise (including when the edited file is
// unrelated, so this hook is a no-op on every other edit).
'use strict';

const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const RELEVANT = /(?:^|[\\/])(?:knowledge\.json|code\.html|index\.html)$/;

function readStdin() {
  try {
    const fs = require('fs');
    return fs.readFileSync(0, 'utf8');
  } catch (err) {
    return '';
  }
}

let payload = {};
try {
  payload = JSON.parse(readStdin() || '{}');
} catch (err) {
  // No/invalid stdin — nothing to gate on, exit quietly.
  process.exit(0);
}

const filePath = (payload.tool_input && payload.tool_input.file_path)
  || (payload.tool_response && payload.tool_response.filePath)
  || '';

if (!RELEVANT.test(filePath)) {
  process.exit(0);
}

const guards = [
  ['scripts/validate-knowledge.js'],
  ['scripts/check-twin-grounding.js'],
  ['scripts/check-fallback.js'],
];

for (const [script] of guards) {
  const result = spawnSync(process.execPath, [script], { cwd: ROOT, encoding: 'utf8' });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.status !== 0) {
    if (result.stderr) process.stderr.write(result.stderr);
    process.exit(2);
  }
}

process.exit(0);
