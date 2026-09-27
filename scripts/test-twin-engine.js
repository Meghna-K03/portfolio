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

// TEST 12: tech-stack question variants all resolve to the same project + field
test('TEST12 tech-stack question variants -> tasteorbit technologies', () => {
  const variants = [
    'What technologies were used in TasteOrbit?',
    'What is the tech stack of TasteOrbit?',
    'What was TasteOrbit built with?',
    'What tools were used for TasteOrbit?',
  ];
  variants.forEach((q) => {
    const { text, entryId } = TwinEngine.retrieveAnswer(knowledge, q, {});
    assert.strictEqual(entryId, 'tasteorbit', `for "${q}"`);
    assert.ok(text.includes('Scikit-Learn'), `for "${q}" got: ${text}`);
  });
});

// TEST 13: features question -> documented features only
test('TEST13 "What are the features of Project Panopticon?" -> documented features', () => {
  const { text, entryId } = TwinEngine.retrieveAnswer(knowledge, 'What are the main features of Project Panopticon?', {});
  assert.strictEqual(entryId, 'panopticon');
  assert.ok(text.includes('rolling-window'));
});

// TEST 14: purpose/problem questions
test('TEST14 purpose/problem questions -> documented purpose/problem', () => {
  const purpose = TwinEngine.retrieveAnswer(knowledge, 'What is the purpose of TasteOrbit?', {});
  assert.strictEqual(purpose.entryId, 'tasteorbit');
  assert.ok(purpose.text.toLowerCase().includes('predict'));

  const problem = TwinEngine.retrieveAnswer(knowledge, 'What problem does the invoice processing project solve?', {});
  assert.strictEqual(problem.entryId, 'invoice-processing');
});

// TEST 15: summarization variants produce project-specific, non-identical answers
test('TEST15 short vs detailed summary differ and stay grounded', () => {
  const short = TwinEngine.retrieveAnswer(knowledge, 'Summarize TasteOrbit.', {});
  const detailed = TwinEngine.retrieveAnswer(knowledge, 'Give me a detailed explanation of TasteOrbit.', {});
  assert.strictEqual(short.entryId, 'tasteorbit');
  assert.strictEqual(detailed.entryId, 'tasteorbit');
  assert.notStrictEqual(short.text, detailed.text);
  assert.ok(detailed.text.length > short.text.length);
});

// TEST 16: role/timeline — documented (Panopticon role) vs undocumented (TasteOrbit role, any builtWhen) -> exact fallback
test('TEST16 role/timeline: documented answers, undocumented falls back exactly', () => {
  const role = TwinEngine.retrieveAnswer(knowledge, "What was Meghna's role in Project Panopticon?", {});
  assert.strictEqual(role.entryId, 'panopticon');
  assert.ok(role.text.includes('internship'));

  const noRole = TwinEngine.retrieveAnswer(knowledge, "What was Meghna's role in TasteOrbit?", {});
  assert.strictEqual(noRole.text, knowledge.meta.fallback);

  const noDate = TwinEngine.retrieveAnswer(knowledge, 'When was TasteOrbit built?', {});
  assert.strictEqual(noDate.text, knowledge.meta.fallback);
});

// TEST 17: logical/cross-project questions
test('TEST17 logical questions resolve from documented fields only', () => {
  const ocr = TwinEngine.retrieveAnswer(knowledge, 'Which project uses OCR?', {});
  assert.ok(ocr.text.includes('Invoice'), `got: ${ocr.text}`);

  const anomaly = TwinEngine.retrieveAnswer(knowledge, 'Which project involves anomaly detection?', {});
  assert.ok(anomaly.text.includes('Invoice'), `got: ${anomaly.text}`);

  const urban = TwinEngine.retrieveAnswer(knowledge, 'Which project is related to urban change?', {});
  assert.ok(urban.text.includes('Memory of a City'), `got: ${urban.text}`);

  const unsupported = TwinEngine.retrieveAnswer(knowledge, 'Which project uses computer vision?', {});
  assert.strictEqual(unsupported.text, knowledge.meta.fallback, 'computer vision is not literally documented, must fall back');
});

// TEST 18: comparison — only documented, shared fields; ambiguous compare -> fallback
test('TEST18 comparison uses only documented shared fields', () => {
  const cmp = TwinEngine.retrieveAnswer(knowledge, 'Compare TasteOrbit and Memory of a City.', {});
  assert.ok(cmp.text.includes('TasteOrbit') && cmp.text.includes('Memory of a City'));

  const ambiguous = TwinEngine.retrieveAnswer(knowledge, 'What is similar between these two projects?', {});
  assert.strictEqual(ambiguous.text, knowledge.meta.fallback, 'cannot compare without two named projects');
});

// TEST 19: follow-up context — "it" resolves to the last project discussed
test('TEST19 follow-up pronoun resolves via lightweight context', () => {
  let ctx = {};
  let r = TwinEngine.retrieveAnswer(knowledge, 'Tell me about Memory of a City.', ctx);
  ctx.currentTopic = r.topic;
  assert.strictEqual(ctx.currentTopic, 'memory-of-a-city');

  r = TwinEngine.retrieveAnswer(knowledge, 'What technologies did it use?', ctx);
  ctx.currentTopic = r.topic;
  assert.strictEqual(r.entryId, 'memory-of-a-city');
  assert.ok(r.text.includes('Gemini'));

  // Switching topic updates context.
  r = TwinEngine.retrieveAnswer(knowledge, 'Tell me about TasteOrbit.', ctx);
  ctx.currentTopic = r.topic;
  assert.strictEqual(ctx.currentTopic, 'tasteorbit');

  r = TwinEngine.retrieveAnswer(knowledge, 'Summarize it.', ctx);
  assert.strictEqual(r.entryId, 'tasteorbit');
});

// TEST 20: unknown personal/off-topic questions still fall back exactly
test('TEST20 unknown personal questions -> exact fallback', () => {
  const questions = [
    "What is Meghna's favorite movie?",
    "What is Meghna's favorite food?",
    'What is Meghna planning to build next year?',
  ];
  questions.forEach((q) => {
    const { text } = TwinEngine.retrieveAnswer(knowledge, q, {});
    assert.strictEqual(text, knowledge.meta.fallback, `for "${q}"`);
  });
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
