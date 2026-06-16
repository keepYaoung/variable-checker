// Run with: npm test
// Tests the pure compare() function against hand-built FrameSnapshots.
// We import directly from the bundled compare module (built by test runner).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compare } from './compare.bundle.mjs';

function variable(id, name = id, resolvedType = 'COLOR') {
  return { kind: 'variable', variableId: id, variableName: name, resolvedType };
}
function hardcoded(raw) {
  return { kind: 'hardcoded', rawValue: raw };
}
function node(pathKey, props, nodeId = pathKey) {
  return { nodeId, pathKey, name: pathKey, type: 'FRAME', props };
}
function frame(name, nodes) {
  return { name, rootId: name, nodes };
}

test('same variable on both sides -> ok and attaches varInfo', () => {
  const varCache = {
    'var:bg': {
      variableName: 'color/bg',
      collectionName: 'Theme',
      modes: [
        { modeName: 'Light', value: '#FFFFFF' },
        { modeName: 'Dark', value: '#000000' },
      ],
    },
  };
  const a = frame('Light', [node('Card', [{ prop: 'fills[0].color', binding: variable('var:bg') }])]);
  const b = frame('Dark', [node('Card', [{ prop: 'fills[0].color', binding: variable('var:bg') }])]);
  const r = compare(a, b, varCache);
  assert.equal(r.findings.length, 1);
  assert.equal(r.findings[0].verdict, 'ok');
  assert.equal(r.findings[0].varInfo?.variableName, 'color/bg');
  assert.equal(r.summary.ok, 1);
  assert.equal(r.summary.mismatch, 0);
});

test('different variable ids -> diff-token', () => {
  const a = frame('A', [node('Card', [{ prop: 'fills[0].color', binding: variable('var:x') }])]);
  const b = frame('B', [node('Card', [{ prop: 'fills[0].color', binding: variable('var:y') }])]);
  const r = compare(a, b);
  assert.equal(r.findings[0].verdict, 'diff-token');
  assert.equal(r.summary.mismatch, 1);
});

test('variable vs hardcoded -> one-hardcoded', () => {
  const a = frame('A', [node('Card', [{ prop: 'fills[0].color', binding: variable('var:x') }])]);
  const b = frame('B', [node('Card', [{ prop: 'fills[0].color', binding: hardcoded('#FF0000') }])]);
  const r = compare(a, b);
  assert.equal(r.findings[0].verdict, 'one-hardcoded');
  assert.equal(r.summary.mismatch, 1);
  assert.equal(r.hardcodedInB.length, 1);
  assert.equal(r.summary.hardcoded, 1);
});

test('hardcoded on both sides -> both-hardcoded (warn)', () => {
  const a = frame('A', [node('Card', [{ prop: 'fills[0].color', binding: hardcoded('#FFFFFF') }])]);
  const b = frame('B', [node('Card', [{ prop: 'fills[0].color', binding: hardcoded('#000000') }])]);
  const r = compare(a, b);
  assert.equal(r.findings[0].verdict, 'both-hardcoded');
  assert.equal(r.summary.warn, 1);
  assert.equal(r.summary.hardcoded, 2);
});

test('structure: layer only in A is reported, not compared', () => {
  const a = frame('A', [
    node('Card', [{ prop: 'fills[0].color', binding: variable('var:x') }]),
    node('Card/Extra', [{ prop: 'fills[0].color', binding: variable('var:y') }]),
  ]);
  const b = frame('B', [
    node('Card', [{ prop: 'fills[0].color', binding: variable('var:x') }]),
  ]);
  const r = compare(a, b);
  assert.equal(r.structureOnlyInA.length, 1);
  assert.equal(r.structureOnlyInA[0].pathKey, 'Card/Extra');
  assert.equal(r.structureOnlyInB.length, 0);
  // Only the matched 'Card' node yields a finding (the ok one).
  assert.equal(r.findings.length, 1);
  assert.equal(r.findings[0].verdict, 'ok');
  assert.equal(r.summary.structureDiff, 1);
});

test('prop only on A side -> structure-prop (mismatch)', () => {
  const a = frame('A', [
    node('Card', [
      { prop: 'fills[0].color', binding: variable('var:x') },
      { prop: 'strokes[0].color', binding: variable('var:s') },
    ]),
  ]);
  const b = frame('B', [
    node('Card', [{ prop: 'fills[0].color', binding: variable('var:x') }]),
  ]);
  const r = compare(a, b);
  const strokeFinding = r.findings.find((f) => f.prop === 'strokes[0].color');
  assert.ok(strokeFinding);
  assert.equal(strokeFinding.verdict, 'structure-prop');
  assert.equal(strokeFinding.b.kind, 'absent');
  assert.equal(r.summary.mismatch, 1);
});

test('mixed on one side -> structure-prop', () => {
  const a = frame('A', [node('Card', [{ prop: 'fills[0].color', binding: { kind: 'mixed' } }])]);
  const b = frame('B', [node('Card', [{ prop: 'fills[0].color', binding: variable('var:x') }])]);
  const r = compare(a, b);
  assert.equal(r.findings[0].verdict, 'structure-prop');
});

test('multiple props on same node aggregate correctly', () => {
  const a = frame('A', [
    node('Card', [
      { prop: 'fills[0].color', binding: variable('var:bg') },
      { prop: 'cornerRadius', binding: variable('var:radius') },
      { prop: 'opacity', binding: hardcoded('1') },
    ]),
  ]);
  const b = frame('B', [
    node('Card', [
      { prop: 'fills[0].color', binding: variable('var:bg') },
      { prop: 'cornerRadius', binding: variable('var:radius') },
      { prop: 'opacity', binding: hardcoded('0.5') },
    ]),
  ]);
  const r = compare(a, b);
  assert.equal(r.summary.ok, 2);
  assert.equal(r.summary.warn, 1);
});
