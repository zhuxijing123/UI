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
  - edit core properties in inspector
  - add / remove child nodes
  - save as `json` or `lua`
- Atlas / plist inspection:
  - parse frames
  - overlay selected frame on the source image when available
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
    presets.ts
    types.ts
    view-model.ts
    workspace.ts
    components/
      AssetBrowserTree.tsx
      EmptyState.tsx
      HierarchyTree.tsx
      InspectorPane.tsx
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
```

## Smoke Test

Start the editor first, then run:

```bash
pnpm test:smoke
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
- `pnpm build`
- `pnpm test:smoke` against a live `vite` dev server
- `pnpm test:smoke` against a live `vite preview` server

Smoke verification currently covers:

- editor shell render
- folder import via `webkitdirectory`
- Avatar Lab render on real legacy fixture assets
- Effect Lab render on real legacy fixture assets
- creating a new UI layout
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
