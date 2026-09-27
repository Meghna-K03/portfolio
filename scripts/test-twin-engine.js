#!/usr/bin/env node
// Functional test harness for the Digital Twin retrieval engine.
//
// This does NOT re-implement the scoring logic in a separate copy — it
// extracts the actual <script> block between the TWIN-ENGINE markers in
// code.html and executes it in a Node vm sandbox (stubbing `window` and
// `fetch`, since no browser/DOM is available here), then calls the real
// `TwinEngine.retrieveAnswer` it exposes, against the real knowledge.json.
//
// Run via `npm run test:twin`.
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const { execFileSync } = require('child_process');
const os = require('os');

const ROOT = path.join(__dirname, '..');
const START_MARKER = '<!-- TWIN-ENGINE:START -->';
const END_MARKER = '<!-- TWIN-ENGINE:END -->';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
    passed += 1;
  } catch (err) {
    console.error(`  FAIL  ${name}`);
    console.error(`        ${err.message}`);
    failed += 1;
  }
}

function loadTwinEngine() {
  const html = fs.readFileSync(path.join(ROOT, 'code.html'), 'utf8');
  const startIdx = html.indexOf(START_MARKER);
  const endIdx = html.indexOf(END_MARKER);
  if (startIdx === -1 || endIdx === -1) {
    throw new Error('Could not find TWIN-ENGINE markers in code.html');
  }
  const block = html.slice(startIdx, endIdx);
  const scriptStart = block.indexOf('<script>');
  const scriptEnd = block.lastIndexOf('</script>');
  const scriptContent = block.slice(scriptStart + '<script>'.length, scriptEnd);

  const sandbox = {
    window: {},
    fetch: () => Promise.reject(new Error('no network in test sandbox')),
    console,
  };
  vm.createContext(sandbox);
  vm.runInContext(scriptContent, sandbox, { filename: 'twin-engine-extracted.js' });

  if (!sandbox.window.TwinEngine) {
    throw new Error('TwinEngine was not exposed on window by the extracted script');
  }
  return sandbox.window.TwinEngine;
}

const knowledge = JSON.parse(fs.readFileSync(path.join(ROOT, 'knowledge.json'), 'utf8'));
const TwinEngine = loadTwinEngine();

console.log('Digital Twin retrieval engine tests\n');

// TEST 1: known identity question
test('TEST1 known identity question -> knowledge-base answer', () => {
  const { text, entryId } = TwinEngine.retrieveAnswer(knowledge, 'Who is Meghna?');
  assert.strictEqual(entryId, 'who');
  assert.ok(text.includes('Atria University'));
});

// TEST 2: project question (Memory of a City)
test('TEST2 "Tell me about Memory of a City." -> memory-of-a-city entry', () => {
  const { entryId } = TwinEngine.retrieveAnswer(knowledge, 'Tell me about Memory of a City.');
  assert.strictEqual(entryId, 'memory-of-a-city');
});

// TEST 3: another project (TasteOrbit)
test('TEST3 "What is TasteOrbit?" -> tasteorbit entry', () => {
  const { entryId } = TwinEngine.retrieveAnswer(knowledge, 'What is TasteOrbit?');
  assert.strictEqual(entryId, 'tasteorbit');
});

// TEST 4: technology/skill question
test('TEST4 technology question -> skills-stack entry', () => {
  const { entryId } = TwinEngine.retrieveAnswer(knowledge, 'What is her tech stack?');
  assert.strictEqual(entryId, 'skills-stack');
});

// TEST 5: unknown question -> exact fallback
test('TEST5 unknown question -> exact fallback string', () => {
  const { text, entryId } = TwinEngine.retrieveAnswer(knowledge, "What is Meghna's favorite movie?");
  assert.strictEqual(entryId, null);
  assert.strictEqual(text, "I don't have that information in my portfolio knowledge yet.");
});

// TEST 6: unrelated question -> fallback
test('TEST6 unrelated question -> exact fallback string', () => {
  const { text, entryId } = TwinEngine.retrieveAnswer(knowledge, 'What is the weather today?');
  assert.strictEqual(entryId, null);
  assert.strictEqual(text, knowledge.meta.fallback);
});

// TEST 7: case-insensitivity
test('TEST7 case-insensitive variants all match the same entry', () => {
  const variants = ['WHO IS MEGHNA?', 'who is meghna?', 'Who Is Meghna?'];
  const results = variants.map((q) => TwinEngine.retrieveAnswer(knowledge, q).entryId);
  assert.ok(results.every((id) => id === 'who'), `expected all "who", got ${JSON.stringify(results)}`);
});

// TEST 8 & 9: structural guards (no hardcoded answers / fallback sourced from
// knowledge.meta.fallback) are enforced by scripts/check-twin-grounding.js
// and scripts/check-fallback.js — run via `npm run validate:twin`.
test('TEST8/9 structural guards are present as separate scripts', () => {
  assert.ok(fs.existsSync(path.join(ROOT, 'scripts', 'check-twin-grounding.js')));
  assert.ok(fs.existsSync(path.join(ROOT, 'scripts', 'check-fallback.js')));
});

// TEST 10: schema validation catches an invalid knowledge.json
test('TEST10 validate-knowledge.js rejects a malformed knowledge.json', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'twin-validate-test-'));
  const badKnowledge = { meta: { twinName: 'X' }, entries: [{ id: 'a' }] }; // missing fallback, keywords, answer
  fs.writeFileSync(path.join(tmpDir, 'knowledge.json'), JSON.stringify(badKnowledge));
  fs.copyFileSync(path.join(ROOT, 'scripts', 'validate-knowledge.js'), path.join(tmpDir, 'validate-knowledge.js'));
  fs.mkdirSync(path.join(tmpDir, 'scripts'));
  fs.renameSync(path.join(tmpDir, 'validate-knowledge.js'), path.join(tmpDir, 'scripts', 'validate-knowledge.js'));

  let threw = false;
  try {
    execFileSync(process.execPath, [path.join(tmpDir, 'scripts', 'validate-knowledge.js')], { stdio: 'pipe' });
  } catch (err) {
    threw = true;
    assert.strictEqual(err.status, 2);
  }
  assert.ok(threw, 'expected validate-knowledge.js to exit non-zero on malformed knowledge.json');

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// TEST 11: project knowledge completeness
test('TEST11 all four current projects have knowledge entries', () => {
  const required = ['tasteorbit', 'panopticon', 'invoice-processing', 'memory-of-a-city'];
  const ids = new Set(knowledge.entries.map((e) => e.id));
  required.forEach((id) => assert.ok(ids.has(id), `missing knowledge entry for "${id}"`));
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
