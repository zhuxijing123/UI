# BRM UI Studio

TypeScript-based integrated editor for the BRM legacy game pipeline. The project is intended to become a professional workstation for:

- UI layout authoring and round-trip save
- `plist` / atlas inspection
- `biz` animation bank inspection
- character / NPC / monster preview
- skill / effect preview
- `mapo` map logic editing
- legacy text resource editing (`lua`, `diz`, `tiz`, `ini`, `csv`, `json`)

The current milestone delivers the first working editor shell in React + Vite and establishes a real browser smoke-test loop with Playwright.

## Current Capabilities

- File-system based workspace open via File System Access API
- Directory import fallback for browser automation and read-only inspection
- Asset scanning with legacy-aware type detection
  - `.fnt` bitmap font descriptors are imported as legacy text assets and usable by the layout viewport
  - `.fnt` bitmap font descriptors can also be opened directly as dedicated preview documents
- Creator-style workbench layout:
  - top toolbar
  - asset browser
  - document tabs
  - hierarchy panel
  - viewport / preview surface
  - inspector
  - log panel
- UI layout editing:
  - parse `uilayout/*.lua` and `uilayout-json/*.json`
  - view hierarchy
  - select nodes
  - drag nodes in the viewport
  - render imported legacy image assets directly inside the viewport
  - resolve atlas frame names from imported `uipic/*.plist` / atlas data and crop them into viewport-ready previews
  - render legacy bitmap-font labels from imported `.fnt + .png` pairs
  - render legacy rich text and loading bar nodes inside the editor viewport
  - edit core properties in inspector
  - add / remove child nodes
  - save as `json` or `lua`
- Atlas / plist inspection:
  - parse frames
  - overlay selected frame on the source image when available
- Bitmap font inspection:
  - open `.fnt` as a first-class document
  - parse BMFont metrics and linked page image
  - preview glyph sheet and printable sample text
  - inspect glyph count, line height, scale and page file metadata
- BIZ inspection:
  - parse animation bank metadata
  - inspect file groups and frames
  - overlay selected frame on sibling image when available
- Avatar Lab:
  - parse `gameinfo.diz` and `action.diz`
  - resolve cloth / weapon previews from `cloth.biz`, `weapon.biz`, `cloth/*.png`, `weapon/*.png`
  - animate real avatar frames inside the workbench
- Effect Lab:
  - parse `effect.tiz` and `nodir.diz`
  - resolve effect previews from `effect.biz` and `effect/*.png`
  - animate real effect frames inside the workbench
- MAPO editing:
  - parse logic grid
  - decode legacy `long/*.csv` metadata with UTF-8 / GB18030 fallback
  - overlay NPC / teleport / monster points from `mapinfo.csv`, `npcgen.csv`, `mongen.csv`
  - enrich monster overlays with `mondef.csv` names and model ids
  - expose overlay summaries directly under the map canvas for deterministic inspection
  - show teleport target map names plus script / openUI / talk metadata in the overlay detail list
  - paint cell values
  - save back as RLE-encoded `.mapo`
- Text editing:
  - edit `diz`, `tiz`, `lua`, `ini`, `csv`, `json`, `xml`, `md`
- Smoke testing:
  - local Playwright-based browser smoke script
  - screenshot + browser log + state dump artifacts

## Project Structure

```text
src/
  App.tsx
  App.css
  index.css
  editor/
    app-utils.ts
    formats.ts
    legacy-layout-resources.ts
    legacy-map-data.ts
    presets.ts
    types.ts
    view-model.ts
    workspace.ts
    components/
      AssetBrowserTree.tsx
      EmptyState.tsx
      HierarchyTree.tsx
      InspectorPane.tsx
      LegacyUiLayoutViewport.tsx
      MapDocumentCanvas.tsx
      PreviewPane.tsx
      WelcomeHome.tsx
scripts/
  smoke-editor.mjs
fixtures/
  legacy-sample/
```

## Development

```bash
pnpm install
pnpm typecheck
pnpm build
pnpm dev --host 127.0.0.1 --port 3100
pnpm test:smoke:sequential
```

## Smoke Test

Start the editor first, then run:

```bash
pnpm test:smoke
```

For the full sequential workflow with auto-selected free ports and automatic server cleanup:

```bash
pnpm test:smoke:sequential
```

Optional environment variables:

```bash
BRM_UI_STUDIO_URL=http://127.0.0.1:3100
BRM_UI_STUDIO_OUTDIR=./output/playwright
BRM_UI_STUDIO_FIXTURE_DIR=./fixtures/legacy-sample
```

Artifacts are written to `output/playwright/`.

When `fixtures/legacy-sample/` exists, the smoke script automatically imports it and validates real legacy assets.

Important workflow rule:

- Run `build` and browser smoke tests sequentially, not in parallel.
- Run only one long-lived server at a time (`dev` or `preview`) to avoid port confusion and stale artifacts.

## Verified

The current repository has been verified with:

- `pnpm typecheck`
- `pnpm lint`
- `pnpm build`
- `pnpm test:smoke:sequential`

Smoke verification currently covers:

- editor shell render
- folder import via `webkitdirectory`
- imported legacy layout preview render
- atlas-frame backed layout image render
- bitmap-font backed layout label render
- direct bitmap-font document open and preview
- rich text and loading bar render in the layout viewport
- viewport node selection and drag coordinate updates
- map overlay render from `long/*.csv`
- monster overlay enrichment from `mondef.csv`
- teleport overlay detail render from `mapinfo.csv` + `npcgen.csv`
- map brush change and logic-cell paint verification
- Avatar Lab render on real legacy fixture assets
- read-only save feedback on non-savable document types
- Effect Lab render on real legacy fixture assets
- creating a new UI layout
- starter layout auto-selection of the main editable panel
- entering UI viewport mode
- adding a child node
- screenshot capture
- browser console / request failure collection
- `window.render_game_to_text()` state capture

## Planned Next Stages

- Extract legacy runtime preview modules from `phaser-legend-migration`
- Add true avatar / NPC / monster preview module
- Add skill / effect preview module driven by `gameinfo.diz`, `action.diz`, `effect.tiz`, `nodir.diz`
- Improve atlas binding so UI nodes can pick real frames from workspace assets
- Add save models for `diz` / `tiz`
- Add richer `mapo` overlays and static feature layers
- Implement packaging/export tooling for atlas and `biz` workflows
- Add undo / redo and multi-selection
