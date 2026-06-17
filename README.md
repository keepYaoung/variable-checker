# Variable Token Checker

> 🇰🇷 한국어 문서: [README.ko.md](README.ko.md)

A Figma plugin that compares **two frames** (e.g. Light / Dark, or before / after)
and checks whether matching layers bind the **same design tokens** — variables
**and** color styles. It flags **hardcoded** values, **token mismatches**, and
**structural** differences, and can sync layer names between the two frames.

## Why

When you build a screen and a variant next to it, both frames should reference the
same token on every layer — only the resolved value differs. Drift creeps in: a
color gets hardcoded, a token is swapped for a similar-looking one, a Color Style
replaces a variable, or a layer is added to one frame and not the other. This
plugin surfaces all of it.

## What it checks

A **token** is a referenced design token — a **variable** or a **color style**.
Each matched property gets a verdict:

| A side | B side | Verdict |
|---|---|---|
| token X | token X | **Matched** |
| token X | token Y (incl. variable vs style) | **diff-token** |
| token | hardcoded | **one-hardcoded** |
| hardcoded | hardcoded | **both-hardcoded** (warn) |
| token | absent / mixed | **structure-prop** |

- **Variables** are read per-paint (`fills[i].color`, `strokes[i].color`) and on
  scalar props; matched bindings show a **Mode × Value** table with color swatches.
- **Color styles** (node-level `fillStyle` / `strokeStyle`) are detected and
  compared as tokens, so styled layers are no longer mistaken for hardcoded.

### Property scope

| Group | Properties |
|---|---|
| Color | `fills[i].color`, `strokes[i].color` (SOLID); fill / stroke **color styles** |
| Scalars | `cornerRadius` (+ four corners), `opacity`, `paddingLeft/Right/Top/Bottom`, `itemSpacing` |
| Text | `fontSize`, `lineHeight`, `letterSpacing`, `fontWeight` |

Gradient / image paints are detected but not deep-compared.

## Layer pairing

1. **Exact path** — the layer-name chain from the root, with same-name siblings
   disambiguated by `[0]`, `[1]`, … indexes.
2. **Name fallback** — layers that don't match by path are re-paired by **layer
   name within the same group** and compared anyway (shown with a `name` tag).

## UI

- **Tabs**: Matched · Mismatches · Structure · Hardcoded.
- **Grouped by top-level component** — the shared frame/wrapper path is stripped
  automatically, so grouping starts where layers actually diverge.
- **Collapsible cards** with A/B **thumbnails** whose backgrounds follow each
  frame's resolved mode (light / dark token), for easy identification.
- Lists are **sorted top-to-bottom by Y** position.
- **Click a card** to select the matched layer pair (no viewport jump); the
  current Figma selection is highlighted live. Click a sub-row to select that
  specific sub-layer.
- **Unify Layer Names** — rename each matched pair's B-side layer to A's name.
- **Compare** re-runs the analysis; drag the bottom-right handle to resize.

## Install (development)

1. `npm install`
2. `npm run build` — produces `dist/code.js` and `dist/ui.html`.
3. In Figma desktop: **Plugins → Development → Import plugin from manifest…**
   and pick this folder's `manifest.json`.

`dist/` is committed, so steps 1–2 are only needed if you change the source.

## Usage

1. Select **exactly two** frames that should share token bindings.
2. Run **Plugins → Development → Variable Token Checker**.
3. Inspect the tabs; expand a card to see each layer's findings.
4. Click items to select the corresponding layers on the canvas.
5. Change the selection and hit **Compare**.

## Development

```bash
npm run watch       # esbuild watch (rebuild + copy ui.html)
npm run typecheck   # tsc --noEmit
npm test            # node --test against the pure compare() function
```

### Layout

```
variable-token-checker/
├─ manifest.json
├─ package.json
├─ tsconfig.json
├─ build.mjs              # esbuild bundle + ui.html copy
├─ src/
│  ├─ code.ts             # Figma main thread (snapshot, variable/style resolution, previews)
│  ├─ compare.ts          # pure comparison + grouping (Figma-API-free, unit-testable)
│  ├─ types.ts            # shared schema + ui<->code message types
│  └─ ui.html             # UI thread (report renderer)
├─ test/
│  └─ compare.test.mjs    # verdict matrix, grouping, name fallback, styles
└─ dist/                  # build output (committed; referenced by manifest)
```

### Edit loop

Edit a file under `src/` → `npm run build` → re-run the plugin in Figma.
Run `npm run typecheck` after type changes, `npm test` after touching `compare.ts`.

## Manifest notes

- `documentAccess: "dynamic-page"` — variable/style lookups go through the
  **async** API (`getVariableByIdAsync`, `getStyleByIdAsync`, …).
- `networkAccess: { allowedDomains: ["none"] }` — no outbound traffic.

## License

Source-available, MIT-based with one added restriction: **distributing this
code as a Figma plugin** (Community publish, private/org plugin, or any other
form of plugin distribution to third parties) **requires prior written
permission** from the copyright holder. Reading, learning, forking for
contribution, internal evaluation, and personal modification are free.

See [LICENSE](LICENSE) for the full text.

## Known limits

- Effects / gradient / image paints are *detected*, not deep-compared.
- Text styles (`textStyleId`) and effect styles are not yet compared (color
  styles for fill / stroke are).
- 3+ modes / cross-collection checks are out of scope.
