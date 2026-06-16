// Pure comparison logic. No Figma API dependency. Testable from Node.

import type {
  Binding,
  Finding,
  FrameSnapshot,
  HardcodedEntry,
  NodeSnapshot,
  PropSnapshot,
  Report,
  StructureEntry,
  VarInfoCache,
  Verdict,
} from './types';

function indexBy<T, K extends string>(items: T[], key: (item: T) => K): Map<K, T> {
  const map = new Map<K, T>();
  for (const item of items) map.set(key(item), item);
  return map;
}

function findingVerdict(a: Binding, b: Binding): Verdict {
  if (a.kind === 'variable' && b.kind === 'variable') {
    return a.variableId === b.variableId ? 'ok' : 'diff-token';
  }
  if (a.kind === 'hardcoded' && b.kind === 'hardcoded') return 'both-hardcoded';
  if (
    (a.kind === 'variable' && b.kind === 'hardcoded') ||
    (a.kind === 'hardcoded' && b.kind === 'variable')
  ) {
    return 'one-hardcoded';
  }
  // mixed / absent on one side while the other has a meaningful binding
  return 'structure-prop';
}

function compareNodes(
  a: NodeSnapshot,
  b: NodeSnapshot,
  varCache: VarInfoCache,
): Finding[] {
  const propsA = indexBy(a.props, (p) => p.prop);
  const propsB = indexBy(b.props, (p) => p.prop);
  const propKeys = new Set<string>([...propsA.keys(), ...propsB.keys()]);
  const findings: Finding[] = [];

  for (const prop of propKeys) {
    const bindA: Binding = propsA.get(prop)?.binding ?? { kind: 'absent' };
    const bindB: Binding = propsB.get(prop)?.binding ?? { kind: 'absent' };

    if (bindA.kind === 'absent' && bindB.kind === 'absent') continue;

    const verdict = findingVerdict(bindA, bindB);

    const finding: Finding = {
      pathKey: a.pathKey,
      nodeIdA: a.nodeId,
      nodeIdB: b.nodeId,
      prop,
      verdict,
      a: bindA,
      b: bindB,
    };

    if (verdict === 'ok' && bindA.kind === 'variable') {
      const v = varCache[bindA.variableId];
      if (v) finding.varInfo = v;
    } else if (verdict === 'diff-token' && bindA.kind === 'variable') {
      const v = varCache[bindA.variableId];
      if (v) finding.varInfo = v;
    }

    findings.push(finding);
  }

  return findings;
}

function collectHardcoded(snap: FrameSnapshot): HardcodedEntry[] {
  const entries: HardcodedEntry[] = [];
  for (const node of snap.nodes) {
    for (const prop of node.props) {
      if (prop.binding.kind === 'hardcoded') {
        entries.push({
          pathKey: node.pathKey,
          nodeId: node.nodeId,
          prop: prop.prop,
          rawValue: prop.binding.rawValue,
        });
      }
    }
  }
  return entries;
}

export function compare(
  a: FrameSnapshot,
  b: FrameSnapshot,
  varCache: VarInfoCache = {},
): Report {
  const nodesA = indexBy(a.nodes, (n) => n.pathKey);
  const nodesB = indexBy(b.nodes, (n) => n.pathKey);
  const keys = new Set<string>([...nodesA.keys(), ...nodesB.keys()]);

  const structureOnlyInA: StructureEntry[] = [];
  const structureOnlyInB: StructureEntry[] = [];
  const findings: Finding[] = [];

  for (const key of keys) {
    const na = nodesA.get(key);
    const nb = nodesB.get(key);
    if (na && !nb) {
      structureOnlyInA.push({ pathKey: key, nodeId: na.nodeId });
      continue;
    }
    if (nb && !na) {
      structureOnlyInB.push({ pathKey: key, nodeId: nb.nodeId });
      continue;
    }
    if (na && nb) findings.push(...compareNodes(na, nb, varCache));
  }

  let ok = 0;
  let mismatch = 0;
  let warn = 0;
  for (const f of findings) {
    switch (f.verdict) {
      case 'ok':
        ok++;
        break;
      case 'diff-token':
      case 'one-hardcoded':
      case 'structure-prop':
        mismatch++;
        break;
      case 'both-hardcoded':
        warn++;
        break;
    }
  }

  const hardcodedInA = collectHardcoded(a);
  const hardcodedInB = collectHardcoded(b);

  return {
    framesOk: true,
    frameAName: a.name,
    frameBName: b.name,
    structureOnlyInA,
    structureOnlyInB,
    findings,
    hardcodedInA,
    hardcodedInB,
    summary: {
      ok,
      mismatch,
      warn,
      hardcoded: hardcodedInA.length + hardcodedInB.length,
      structureDiff: structureOnlyInA.length + structureOnlyInB.length,
    },
  };
}

export const __test__ = { findingVerdict, compareNodes, collectHardcoded };

// Convenience for fixture construction in tests.
export function makeProp(prop: string, binding: Binding): PropSnapshot {
  return { prop, binding };
}
