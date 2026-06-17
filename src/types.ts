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
  | { kind: 'style'; styleId: string; styleName: string }
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
  // Top position relative to the frame root, used to sort lists top-to-bottom.
  y: number;
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
  y?: number;
  // pathKey of the top-level group this finding belongs to (common outer path
  // — frame/wrappers — stripped). Empty string => belongs to the stripped
  // wrapper itself and is excluded from grouped views. Set by compare().
  groupKey?: string;
  // True when the A/B layers were paired by name (within the same group) after
  // exact path matching failed, rather than by exact pathKey.
  nameMatched?: boolean;
}

export interface StructureEntry {
  pathKey: string;
  nodeId: string;
  y?: number;
}

export interface HardcodedEntry {
  pathKey: string;
  nodeId: string;
  prop: string;
  rawValue: string;
  y?: number;
}

// Every layer that exists (matched) in BOTH frames, keyed by pathKey. Lets the
// UI resolve a top-level layer's node ids even when it has no finding of its own.
export interface MatchedPair {
  pathKey: string;
  nodeIdA: string;
  nodeIdB: string;
  y?: number;
}

export interface Report {
  framesOk: boolean;
  frameAName: string;
  frameBName: string;
  structureOnlyInA: StructureEntry[];
  structureOnlyInB: StructureEntry[];
  findings: Finding[];
  matchedPairs: MatchedPair[];
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
  // `previews` maps a nodeId to a base64 PNG data URL (matched-pair thumbnails).
  // `bgA`/`bgB` are each frame's mode-resolved background color (hex) for the
  // thumbnail backdrop.
  | {
      type: 'report';
      report: Report;
      previews?: Record<string, string>;
      bgA?: string;
      bgB?: string;
    }
  | { type: 'selection'; ids: string[] }
  | { type: 'error'; message: string };

export type UiToCodeMessage =
  | { type: 'run' }
  | { type: 'select-node'; nodeId: string }
  | { type: 'select-pair'; nodeIdA?: string; nodeIdB?: string }
  // Rename matched layer pairs. `name` empty => sync B's name to A's existing name.
  | {
      type: 'rename';
      pairs: { nodeIdA?: string; nodeIdB?: string }[];
      name: string;
    }
  | { type: 'resize'; width: number; height: number };
