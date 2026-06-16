"use strict";
(() => {
  // src/compare.ts
  function indexBy(items, key) {
    const map = /* @__PURE__ */ new Map();
    for (const item of items) map.set(key(item), item);
    return map;
  }
  function findingVerdict(a, b) {
    if (a.kind === "variable" && b.kind === "variable") {
      return a.variableId === b.variableId ? "ok" : "diff-token";
    }
    if (a.kind === "hardcoded" && b.kind === "hardcoded") return "both-hardcoded";
    if (a.kind === "variable" && b.kind === "hardcoded" || a.kind === "hardcoded" && b.kind === "variable") {
      return "one-hardcoded";
    }
    return "structure-prop";
  }
  function compareNodes(a, b, varCache2) {
    const propsA = indexBy(a.props, (p) => p.prop);
    const propsB = indexBy(b.props, (p) => p.prop);
    const propKeys = /* @__PURE__ */ new Set([...propsA.keys(), ...propsB.keys()]);
    const findings = [];
    for (const prop of propKeys) {
      const bindA = propsA.get(prop)?.binding ?? { kind: "absent" };
      const bindB = propsB.get(prop)?.binding ?? { kind: "absent" };
      if (bindA.kind === "absent" && bindB.kind === "absent") continue;
      const verdict = findingVerdict(bindA, bindB);
      const finding = {
        pathKey: a.pathKey,
        nodeIdA: a.nodeId,
        nodeIdB: b.nodeId,
        prop,
        verdict,
        a: bindA,
        b: bindB
      };
      if (verdict === "ok" && bindA.kind === "variable") {
        const v = varCache2[bindA.variableId];
        if (v) finding.varInfo = v;
      } else if (verdict === "diff-token" && bindA.kind === "variable") {
        const v = varCache2[bindA.variableId];
        if (v) finding.varInfo = v;
      }
      findings.push(finding);
    }
    return findings;
  }
  function collectHardcoded(snap) {
    const entries = [];
    for (const node of snap.nodes) {
      for (const prop of node.props) {
        if (prop.binding.kind === "hardcoded") {
          entries.push({
            pathKey: node.pathKey,
            nodeId: node.nodeId,
            prop: prop.prop,
            rawValue: prop.binding.rawValue
          });
        }
      }
    }
    return entries;
  }
  function compare(a, b, varCache2 = {}) {
    const nodesA = indexBy(a.nodes, (n) => n.pathKey);
    const nodesB = indexBy(b.nodes, (n) => n.pathKey);
    const keys = /* @__PURE__ */ new Set([...nodesA.keys(), ...nodesB.keys()]);
    const structureOnlyInA = [];
    const structureOnlyInB = [];
    const findings = [];
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
      if (na && nb) findings.push(...compareNodes(na, nb, varCache2));
    }
    let ok = 0;
    let mismatch = 0;
    let warn = 0;
    for (const f of findings) {
      switch (f.verdict) {
        case "ok":
          ok++;
          break;
        case "diff-token":
        case "one-hardcoded":
        case "structure-prop":
          mismatch++;
          break;
        case "both-hardcoded":
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
        structureDiff: structureOnlyInA.length + structureOnlyInB.length
      }
    };
  }

  // src/code.ts
  figma.showUI(__html__, { width: 460, height: 640 });
  var SCALAR_NODE_PROPS = [
    "cornerRadius",
    "topLeftRadius",
    "topRightRadius",
    "bottomLeftRadius",
    "bottomRightRadius",
    "opacity",
    "paddingLeft",
    "paddingRight",
    "paddingTop",
    "paddingBottom",
    "itemSpacing"
  ];
  var TEXT_SCALAR_PROPS = [
    "fontSize",
    "lineHeight",
    "letterSpacing",
    "fontWeight"
  ];
  function isContainer(n) {
    return "children" in n;
  }
  function rgbaToHex(r, g, b, a) {
    const toByte = (n) => Math.max(0, Math.min(255, Math.round(n * 255))).toString(16).padStart(2, "0").toUpperCase();
    const base = `#${toByte(r)}${toByte(g)}${toByte(b)}`;
    if (a !== void 0 && a < 1) return base + toByte(a);
    return base;
  }
  function variableValueToString(value) {
    if (typeof value === "number") return String(value);
    if (typeof value === "string") return value;
    if (typeof value === "boolean") return String(value);
    if (value && typeof value === "object") {
      if ("type" in value && value.type === "VARIABLE_ALIAS") {
        return "(alias)";
      }
      if ("r" in value && "g" in value && "b" in value) {
        const c = value;
        return rgbaToHex(c.r, c.g, c.b, "a" in c ? c.a : void 0);
      }
    }
    return String(value);
  }
  var varCache = /* @__PURE__ */ new Map();
  async function resolveAliasValue(value, visited) {
    if (value && typeof value === "object" && "type" in value && value.type === "VARIABLE_ALIAS") {
      const aliasId = value.id;
      if (visited.has(aliasId)) return "(cyclic alias)";
      visited.add(aliasId);
      const aliased = await figma.variables.getVariableByIdAsync(aliasId);
      if (!aliased) return "(missing alias)";
      const collection = await figma.variables.getVariableCollectionByIdAsync(
        aliased.variableCollectionId
      );
      const modeId = collection?.defaultModeId ?? Object.keys(aliased.valuesByMode)[0];
      if (modeId === void 0) return "(no mode)";
      return resolveAliasValue(aliased.valuesByMode[modeId], visited);
    }
    return value;
  }
  async function getCachedVar(id) {
    const hit = varCache.get(id);
    if (hit) return hit;
    const v = await figma.variables.getVariableByIdAsync(id);
    if (!v) return null;
    const collection = await figma.variables.getVariableCollectionByIdAsync(
      v.variableCollectionId
    );
    const collectionName = collection?.name ?? "(unknown collection)";
    const modes = [];
    if (collection) {
      for (const mode of collection.modes) {
        const raw = v.valuesByMode[mode.modeId];
        if (raw === void 0) {
          modes.push({ modeName: mode.name, value: "(unset)" });
          continue;
        }
        const resolved = await resolveAliasValue(raw, /* @__PURE__ */ new Set([id]));
        modes.push({
          modeName: mode.name,
          value: variableValueToString(resolved)
        });
      }
    }
    const cached = {
      variable: v,
      info: { variableName: v.name, collectionName, modes }
    };
    varCache.set(id, cached);
    return cached;
  }
  async function bindingFromAlias(alias) {
    const cached = await getCachedVar(alias.id);
    if (!cached) {
      return {
        kind: "variable",
        variableId: alias.id,
        variableName: "(missing)",
        resolvedType: "STRING"
      };
    }
    return {
      kind: "variable",
      variableId: alias.id,
      variableName: cached.info.variableName,
      resolvedType: cached.variable.resolvedType
    };
  }
  function flattenWithKeys(root) {
    const out = [];
    const walk = (node, key) => {
      out.push({ node, key });
      if (!isContainer(node)) return;
      const total = {};
      for (const c of node.children) total[c.name] = (total[c.name] ?? 0) + 1;
      const seen = {};
      for (const c of node.children) {
        const t = total[c.name];
        let childKey;
        if (t > 1) {
          const idx = seen[c.name] ?? 0;
          seen[c.name] = idx + 1;
          childKey = `${key}/${c.name}[${idx}]`;
        } else {
          childKey = `${key}/${c.name}`;
        }
        walk(c, childKey);
      }
    };
    walk(root, root.name);
    return out;
  }
  async function extractPaintProps(prefix, paints) {
    if (paints === figma.mixed) {
      return [{ prop: prefix, binding: { kind: "mixed" } }];
    }
    const out = [];
    for (let i = 0; i < paints.length; i++) {
      const p = paints[i];
      if (p.visible === false) continue;
      const propKey = `${prefix}[${i}].color`;
      if (p.type === "SOLID") {
        const alias = p.boundVariables?.color;
        if (alias) {
          out.push({ prop: propKey, binding: await bindingFromAlias(alias) });
        } else {
          out.push({
            prop: propKey,
            binding: {
              kind: "hardcoded",
              rawValue: rgbaToHex(p.color.r, p.color.g, p.color.b, p.opacity)
            }
          });
        }
      } else {
        out.push({
          prop: `${prefix}[${i}].${p.type.toLowerCase()}`,
          binding: { kind: "hardcoded", rawValue: `(${p.type.toLowerCase()})` }
        });
      }
    }
    return out;
  }
  async function extractScalarProp(node, propName) {
    if (!(propName in node)) return null;
    const bv = node.boundVariables ?? {};
    const alias = bv[propName];
    if (alias && !Array.isArray(alias) && "id" in alias) {
      return { prop: propName, binding: await bindingFromAlias(alias) };
    }
    const raw = node[propName];
    if (raw === void 0 || raw === null) return null;
    if (raw === figma.mixed) {
      return { prop: propName, binding: { kind: "mixed" } };
    }
    if (typeof raw === "number") {
      return { prop: propName, binding: { kind: "hardcoded", rawValue: String(raw) } };
    }
    if (typeof raw === "object" && "value" in raw) {
      const r = raw;
      return {
        prop: propName,
        binding: {
          kind: "hardcoded",
          rawValue: `${r.value}${r.unit ? r.unit.toLowerCase() : ""}`
        }
      };
    }
    return null;
  }
  async function extractProps(node) {
    const props = [];
    const anyNode = node;
    if ("fills" in node) {
      const fills = node.fills;
      props.push(...await extractPaintProps("fills", fills));
    }
    if ("strokes" in node) {
      const strokes = node.strokes;
      props.push(...await extractPaintProps("strokes", strokes));
    }
    for (const propName of SCALAR_NODE_PROPS) {
      const snap = await extractScalarProp(anyNode, propName);
      if (snap) props.push(snap);
    }
    if (node.type === "TEXT") {
      for (const propName of TEXT_SCALAR_PROPS) {
        const snap = await extractScalarProp(anyNode, propName);
        if (snap) props.push(snap);
      }
    }
    return props;
  }
  async function snapshotFrame(root) {
    const keyed = flattenWithKeys(root);
    const nodes = [];
    for (const { node, key } of keyed) {
      nodes.push({
        nodeId: node.id,
        pathKey: key,
        name: node.name,
        type: node.type,
        props: await extractProps(node)
      });
    }
    return { name: root.name, rootId: root.id, nodes };
  }
  function post(msg) {
    figma.ui.postMessage(msg);
  }
  function varCacheToRecord() {
    const rec = {};
    for (const [id, cached] of varCache) rec[id] = cached.info;
    return rec;
  }
  async function run() {
    const sel = figma.currentPage.selection;
    if (sel.length !== 2) {
      post({
        type: "error",
        message: `\uD504\uB808\uC784\uC744 \uC815\uD655\uD788 2\uAC1C \uC120\uD0DD\uD558\uC138\uC694. (\uD604\uC7AC ${sel.length}\uAC1C \uC120\uD0DD\uB428)`
      });
      return;
    }
    const [a, b] = sel;
    try {
      const snapA = await snapshotFrame(a);
      const snapB = await snapshotFrame(b);
      const report = compare(snapA, snapB, varCacheToRecord());
      post({ type: "report", report });
    } catch (e) {
      post({
        type: "error",
        message: e instanceof Error ? e.message : String(e)
      });
    }
  }
  figma.ui.onmessage = async (msg) => {
    if (msg.type === "run") {
      await run();
      return;
    }
    if (msg.type === "select-node") {
      const node = await figma.getNodeByIdAsync(msg.nodeId);
      if (node && node.type !== "PAGE" && node.type !== "DOCUMENT") {
        const scene = node;
        figma.currentPage.selection = [scene];
        figma.viewport.scrollAndZoomIntoView([scene]);
      }
    }
  };
  run();
})();
