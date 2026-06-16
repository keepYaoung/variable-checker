// Shared types between code.ts (Figma main thread), compare.ts (pure logic),
// and ui.html (UI thread). Kept Figma-API-free so compare.ts stays testable.

export type ResolvedType = 'COLOR' | 'FLOAT' | 'STRING' | 'BOOLEAN';

export type Binding =
  | {
      kind: 'variable';
      variableId: string;
      variableName: string;
      resolvedType: ResolvedType;
    }
  | { kind: 'hardcoded'; rawValue: string }
  | { kind: 'mixed' }
  | { kind: 'absent' };

export interface PropSnapshot {
  prop: string;
  binding: Binding;
}

export interface NodeSnapshot {
  nodeId: string;
  pathKey: string;
  name: string;
  type: string;
  props: PropSnapshot[];
}

export interface FrameSnapshot {
  name: string;
  rootId: string;
  nodes: NodeSnapshot[];
}

export interface ModeValue {
  modeName: string;
  value: string;
}

export interface VarInfo {
  variableName: string;
  collectionName: string;
  modes: ModeValue[];
}

export type Verdict =
  | 'ok'
  | 'diff-token'
  | 'one-hardcoded'
  | 'both-hardcoded'
  | 'structure-prop';

export interface Finding {
  pathKey: string;
  nodeIdA?: string;
  nodeIdB?: string;
  prop: string;
  verdict: Verdict;
  a: Binding;
  b: Binding;
  varInfo?: VarInfo;
}

export interface StructureEntry {
  pathKey: string;
  nodeId: string;
}

export interface HardcodedEntry {
  pathKey: string;
  nodeId: string;
  prop: string;
  rawValue: string;
}

export interface Report {
  framesOk: boolean;
  frameAName: string;
  frameBName: string;
  structureOnlyInA: StructureEntry[];
  structureOnlyInB: StructureEntry[];
  findings: Finding[];
  hardcodedInA: HardcodedEntry[];
  hardcodedInB: HardcodedEntry[];
  summary: {
    ok: number;
    mismatch: number;
    warn: number;
    hardcoded: number;
    structureDiff: number;
  };
}

// VarInfo cache populated during snapshot in code.ts. compare.ts receives it
// alongside FrameSnapshots so 'ok' / 'diff-token' findings can carry mode tables.
export type VarInfoCache = Record<string, VarInfo>;

// Messages exchanged between code.ts and ui.html.
export type CodeToUiMessage =
  | { type: 'report'; report: Report }
  | { type: 'error'; message: string };

export type UiToCodeMessage =
  | { type: 'run' }
  | { type: 'select-node'; nodeId: string };
