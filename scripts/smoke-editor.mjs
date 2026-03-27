import fs from "node:fs";
import path from "node:path";

import { chromium } from "playwright";

const baseUrl = process.env.BRM_UI_STUDIO_URL ?? "http://127.0.0.1:3100";
const outDir = process.env.BRM_UI_STUDIO_OUTDIR ?? path.join(process.cwd(), "output", "playwright");
const fixtureDir = process.env.BRM_UI_STUDIO_FIXTURE_DIR ?? path.join(process.cwd(), "fixtures", "legacy-sample");
const layoutStorageKey = "brm-ui-studio-layout-v1";

fs.mkdirSync(outDir, { recursive: true });

const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 1600, height: 980 } });
const logs = [];
let lastState = null;

page.on("console", (message) => logs.push(`[console:${message.type()}] ${message.text()}`));
page.on("pageerror", (error) => logs.push(`[pageerror] ${error.stack || error.message}`));
page.on("requestfailed", (request) =>
  logs.push(`[requestfailed] ${request.url()} ${request.failure()?.errorText || ""}`)
);

try {
  await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 60000 });
  await page.locator(".toolbar__brand strong").waitFor({ timeout: 10000 });
  await page.evaluate((storageKey) => window.localStorage.removeItem(storageKey), layoutStorageKey);
  await page.reload({ waitUntil: "networkidle", timeout: 60000 });
  await page.locator(".toolbar__brand strong").waitFor({ timeout: 10000 });
  await page.waitForFunction(
    () => !document.querySelector(".toolbar__progress") && !document.querySelector(".welcome__progress-card"),
    { timeout: 10000 }
  );
  await page.getByRole("heading", { name: "Choose a BRM workspace", exact: true }).waitFor({ timeout: 10000 });
  await page.locator("[data-dashboard-nav]").getByRole("button", { name: "Projects", exact: true }).waitFor({ timeout: 10000 });
  await page.screenshot({ path: path.join(outDir, "dev-home.png"), fullPage: true });

  if (fs.existsSync(fixtureDir)) {
    await page.locator("#workspace-upload").setInputFiles(fixtureDir);
    await page.locator(".toolbar__status").getByText("Workspace: legacy-sample", { exact: true }).waitFor({ timeout: 15000 });
    await page.waitForFunction(
      () => !document.querySelector(".toolbar__progress"),
      { timeout: 15000 }
    );
    await page.getByRole("heading", { name: "legacy-sample", exact: true }).waitFor({ timeout: 15000 });
    await page.screenshot({ path: path.join(outDir, "dev-imported.png"), fullPage: true });

    await page.locator(".panel--asset-browser .panel__subtabs").getByRole("button", { name: "UI" }).click();
    const stageToolbar = page.locator(".panel__toolbar--stage");
    await stageToolbar.getByRole("button", { name: "Scale" }).click();
    await stageToolbar.getByRole("button", { name: "Preview" }).click();
    await stageToolbar.getByRole("button", { name: "100%" }).click();
    await page.locator(".panel--logs .panel__subtabs").getByRole("button", { name: "Project" }).click();
    await page.locator(".panel--inspector .panel__subtabs").getByRole("button", { name: "Document" }).click();
    await page.locator(".panel--asset-browser .panel__dock-button").click();
    await page.locator(".panel--logs .panel__dock-button").click();
    await page.locator(".panel--inspector .panel__dock-button").click();
    await page.waitForFunction(
      () => {
        if (typeof window.render_game_to_text !== "function") return false;
        const state = JSON.parse(window.render_game_to_text());
        return state.dashboardMode === false &&
          state.assetWorkbenchFilter === "ui" &&
          state.leftDockCollapsed === true &&
          state.bottomDockCollapsed === true &&
          state.rightDockCollapsed === true &&
          state.sceneTool === "scale" &&
          state.sceneZoom === "100" &&
          state.stageWorkbenchMode === "preview" &&
          state.bottomDockTab === "project" &&
          state.inspectorDockTab === "document";
      },
      { timeout: 15000 }
    );
    await page.reload({ waitUntil: "networkidle", timeout: 60000 });
    await page.locator(".toolbar__brand strong").waitFor({ timeout: 10000 });
    await page.waitForFunction(
      () => {
        if (typeof window.render_game_to_text !== "function") return false;
        const state = JSON.parse(window.render_game_to_text());
        return state.dashboardMode === true &&
          state.assetWorkbenchFilter === "ui" &&
          state.leftDockCollapsed === true &&
          state.bottomDockCollapsed === true &&
          state.rightDockCollapsed === true &&
          state.sceneTool === "scale" &&
          state.sceneZoom === "100" &&
          state.stageWorkbenchMode === "preview" &&
          state.bottomDockTab === "project" &&
          state.inspectorDockTab === "document";
      },
      { timeout: 15000 }
    );
    await page.locator("#workspace-upload").setInputFiles(fixtureDir);
    await page.locator(".toolbar__status").getByText("Workspace: legacy-sample", { exact: true }).waitFor({ timeout: 15000 });
    await page.locator('[data-panel-rail="left"]').getByRole("button", { name: "Assets" }).click();
    await page.locator('[data-panel-rail="bottom"]').getByRole("button", { name: "Project" }).click();
    await page.locator('[data-panel-rail="right"]').getByRole("button", { name: "Document" }).click();
    await page.waitForFunction(
      () => {
        if (typeof window.render_game_to_text !== "function") return false;
        const state = JSON.parse(window.render_game_to_text());
        return state.leftDockCollapsed === false &&
          state.bottomDockCollapsed === false &&
          state.rightDockCollapsed === false &&
          state.bottomDockTab === "project" &&
          state.inspectorDockTab === "document";
      },
      { timeout: 15000 }
    );
    await page.locator(".panel--asset-browser .panel__subtabs").getByRole("button", { name: "All" }).click();

    await page.locator(".tree__asset", { hasText: "sample-layout.json" }).dblclick();
    await page.getByRole("heading", { name: "Legacy Layout Preview", exact: true }).waitFor({ timeout: 15000 });
    await stageToolbar.getByRole("button", { name: "Maximize" }).click();
    await page.waitForFunction(
      () => {
        if (typeof window.render_game_to_text !== "function") return false;
        const state = JSON.parse(window.render_game_to_text());
        return state.sceneFocusMode === true;
      },
      { timeout: 15000 }
    );
    await stageToolbar.getByRole("button", { name: "Restore" }).click();
    await page.waitForFunction(
      () => {
        if (typeof window.render_game_to_text !== "function") return false;
        const state = JSON.parse(window.render_game_to_text());
        return state.sceneFocusMode === false;
      },
      { timeout: 15000 }
    );
    await stageToolbar.getByRole("button", { name: "Preview" }).click();
    await stageToolbar.getByRole("button", { name: "100%" }).click();
    await page.waitForFunction(
      () => {
        if (typeof window.render_game_to_text !== "function") return false;
        const state = JSON.parse(window.render_game_to_text());
        return state.stageWorkbenchMode === "preview" && state.sceneZoom === "100";
      },
      { timeout: 15000 }
    );
    await stageToolbar.getByRole("button", { name: "Scene" }).click();
    await stageToolbar.getByRole("button", { name: "Fit" }).click();
    await page.waitForFunction(
      () => {
        if (typeof window.render_game_to_text !== "function") return false;
        const state = JSON.parse(window.render_game_to_text());
        return state.stageWorkbenchMode === "scene" && state.sceneZoom === "fit";
      },
      { timeout: 15000 }
    );
    await stageToolbar.getByRole("button", { name: "Move" }).click();
    await page.waitForFunction(
      () => {
        const atlasSkin = document.querySelector('[data-node-name="AtlasBadge"] .legacy-ui-node__skin');
        const progressFill = document.querySelector('[data-node-name="ProgressBar"] .legacy-ui-node__loading-fill');
        const richNote = document.querySelector('[data-node-name="RichNote"] .legacy-ui-node__text');
        const bitmapGlyphs = document.querySelectorAll('[data-node-name="BitmapDigits"] [data-bitmap-glyph]');
        if (
          !(atlasSkin instanceof HTMLElement) ||
          !(progressFill instanceof HTMLElement) ||
          !(richNote instanceof HTMLElement) ||
          bitmapGlyphs.length < 4
        ) {
          return false;
        }
        const atlasBackground = window.getComputedStyle(atlasSkin).backgroundImage;
        const progressWidth = parseFloat(window.getComputedStyle(progressFill).width);
        return atlasBackground !== "none" && progressWidth > 40 && richNote.textContent?.includes("Atlas");
      },
      { timeout: 15000 }
    );
    const draggableNode = page.locator('[data-node-name="AtlasBadge"]').first();
    await draggableNode.waitFor({ timeout: 15000 });
    await draggableNode.scrollIntoViewIfNeeded();
    await draggableNode.click();
    await page.waitForFunction(
      () => {
        if (typeof window.render_game_to_text !== "function") return false;
        const state = JSON.parse(window.render_game_to_text());
        return state.selectedUiNode?.description?.includes("AtlasBadge");
      },
      { timeout: 15000 }
    );
    const beforeDrag = await readEditorState(page);
    lastState = beforeDrag;
    const draggableBox = await draggableNode.boundingBox();
    if (!draggableBox) throw new Error("AtlasBadge bounding box unavailable");
    await page.mouse.move(draggableBox.x + draggableBox.width / 2, draggableBox.y + draggableBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(draggableBox.x + draggableBox.width / 2 + 48, draggableBox.y + draggableBox.height / 2 - 28, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(150);
    const afterDrag = await readEditorState(page);
    lastState = afterDrag;
    if (
      !beforeDrag.selectedUiNode ||
      !afterDrag.selectedUiNode ||
      afterDrag.selectedUiNode.x === beforeDrag.selectedUiNode.x ||
      afterDrag.selectedUiNode.y === beforeDrag.selectedUiNode.y
    ) {
      throw new Error(`ui node drag did not update coordinates: ${JSON.stringify({ beforeDrag, afterDrag })}`);
    }

    await stageToolbar.getByRole("button", { name: "Rect" }).click();
    const beforeRect = await readEditorState(page);
    await draggableNode.scrollIntoViewIfNeeded();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowUp");
    const afterRect = await readEditorState(page);
    lastState = afterRect;
    if (
      !beforeRect.selectedUiNode ||
      !afterRect.selectedUiNode ||
      afterRect.selectedUiNode.w === beforeRect.selectedUiNode.w ||
      afterRect.selectedUiNode.h === beforeRect.selectedUiNode.h
    ) {
      throw new Error(`rect tool did not update size: ${JSON.stringify({ beforeRect, afterRect })}`);
    }

    await stageToolbar.getByRole("button", { name: "Scale" }).click();
    const beforeScale = await readEditorState(page);
    await draggableNode.scrollIntoViewIfNeeded();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowUp");
    const afterScale = await readEditorState(page);
    lastState = afterScale;
    if (
      !beforeScale.selectedUiNode ||
      !afterScale.selectedUiNode ||
      afterScale.selectedUiNode.sx === beforeScale.selectedUiNode.sx ||
      afterScale.selectedUiNode.sy === beforeScale.selectedUiNode.sy
    ) {
      throw new Error(`scale tool did not update node scale: ${JSON.stringify({ beforeScale, afterScale })}`);
    }

    await stageToolbar.getByRole("button", { name: "Rotate" }).click();
    const beforeRotate = await readEditorState(page);
    await draggableNode.scrollIntoViewIfNeeded();
    await page.keyboard.press("ArrowRight");
    const afterRotate = await readEditorState(page);
    lastState = afterRotate;
    if (
      !beforeRotate.selectedUiNode ||
      !afterRotate.selectedUiNode ||
      afterRotate.selectedUiNode.r === beforeRotate.selectedUiNode.r
    ) {
      throw new Error(`rotate tool did not update node rotation: ${JSON.stringify({ beforeRotate, afterRotate })}`);
    }

    await stageToolbar.getByRole("button", { name: "Move" }).click();
    await page.screenshot({ path: path.join(outDir, "dev-sample-layout.png"), fullPage: true });

    await page.locator(".tree__asset", { hasText: "2000100.png" }).dblclick();
    await page.getByText("Avatar Preview Lab", { exact: true }).waitFor({ timeout: 15000 });
    await page.getByText("Linked source: legacy-sample/cloth/2000100.png", { exact: true }).waitFor({ timeout: 15000 });
    await page.locator('[data-preview-dir-strip] button', { hasText: "Dir 6" }).click();
    await page.waitForFunction(
      () => {
        if (typeof window.render_game_to_text !== "function") return false;
        const state = JSON.parse(window.render_game_to_text());
        return state.activeDocument?.kind === "avatar-preview" && state.activeDocument?.name?.includes("Avatar");
      },
      { timeout: 15000 }
    );
    await page.screenshot({ path: path.join(outDir, "dev-linked-avatar.png"), fullPage: true });

    await page.locator(".tree__asset", { hasText: "fifteenNum.fnt" }).dblclick();
    await page.getByText("Bitmap Font Preview", { exact: true }).waitFor({ timeout: 15000 });
    await page.waitForFunction(
      () => {
        const preview = document.querySelector("[data-bitmap-font-preview]");
        const chars = document.querySelectorAll("[data-bitmap-char]");
        return preview instanceof HTMLElement && chars.length >= 10;
      },
      { timeout: 15000 }
    );
    await page.screenshot({ path: path.join(outDir, "dev-bitmap-font.png"), fullPage: true });

    await page.locator(".tree__asset", { hasText: "50012.mapo" }).dblclick();
    await page.getByText("NPC 2", { exact: true }).waitFor({ timeout: 15000 });
    await page.getByText("Monster 1", { exact: true }).waitFor({ timeout: 15000 });
    await page.waitForFunction(
      () => {
        if (typeof window.render_game_to_text !== "function") return false;
        const state = JSON.parse(window.render_game_to_text());
        return Array.isArray(state.mapOverlayPreview) &&
          state.mapOverlayPreview.some(
            (entry) =>
              entry.kind === "monster" &&
              entry.label === "Master Tutor" &&
              String(entry.subtitle ?? "").includes("model 32006")
          );
      },
      { timeout: 15000 }
    );
    await page.getByText("Master Tutor", { exact: true }).waitFor({ timeout: 15000 });
    await page.waitForFunction(
      () => {
        if (typeof window.render_game_to_text !== "function") return false;
        const state = JSON.parse(window.render_game_to_text());
        return Array.isArray(state.mapOverlayPreview) &&
          state.mapOverlayPreview.some(
            (entry) =>
              entry.kind === "teleport" &&
              entry.label === "Gatekeeper" &&
              entry.targetMapId === "nextmap" &&
              entry.targetMapName === "Training Hall" &&
              Array.isArray(entry.details) &&
              entry.details.some((detail) => String(detail).includes("PanelTransfer")) &&
              entry.details.some((detail) => String(detail).includes("npc.teleport"))
          );
      },
      { timeout: 15000 }
    );
    await page.getByText("Training Hall -> 8, 9", { exact: true }).waitFor({ timeout: 15000 });
    await page.locator(".panel--inspector .panel__subtabs").getByRole("button", { name: "Properties" }).click();
    await page.locator(".inspector__section", { hasText: "Brush" }).locator("select").selectOption("3");
    const mapCanvas = page.locator(".map-canvas canvas");
    await mapCanvas.scrollIntoViewIfNeeded();
    await mapCanvas.click({ position: { x: 4, y: 4 } });
    await page.waitForFunction(
      () => {
        if (typeof window.render_game_to_text !== "function") return false;
        const state = JSON.parse(window.render_game_to_text());
        return state.mapSelection?.x === 0 && state.mapSelection?.y === 0 && state.mapSelection?.value === 3;
      },
      { timeout: 15000 }
    );
    lastState = await readEditorState(page);
    await page.screenshot({ path: path.join(outDir, "dev-map-overlay.png"), fullPage: true });

    await page.getByRole("button", { name: "Avatar Lab" }).click();
    await page.getByText("Avatar Preview Lab", { exact: true }).waitFor({ timeout: 15000 });
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await page.waitForFunction(
      () => {
        if (typeof window.render_game_to_text !== "function") return false;
        const state = JSON.parse(window.render_game_to_text());
        return Array.isArray(state.logs) && state.logs.some((line) => line.includes("read-only"));
      },
      { timeout: 15000 }
    );
    lastState = await readEditorState(page);
    await page.screenshot({ path: path.join(outDir, "dev-avatar-lab.png"), fullPage: true });

    await page.getByRole("button", { name: "Effect Lab" }).click();
    await page.getByText("Effect Preview Lab", { exact: true }).waitFor({ timeout: 15000 });
    await page.screenshot({ path: path.join(outDir, "dev-effect-lab.png"), fullPage: true });
  }

  await page.locator("header.toolbar").getByRole("button", { name: "New UI Layout", exact: true }).click();
  await page.getByRole("heading", { name: "Legacy Layout Preview", exact: true }).waitFor({ timeout: 10000 });
  const newLayoutState = await readEditorState(page);
  lastState = newLayoutState;
  if (!newLayoutState.selectedUiNode?.description?.includes("PanelBg")) {
    throw new Error(`starter layout should preselect PanelBg: ${JSON.stringify(newLayoutState.selectedUiNode)}`);
  }
  await page.screenshot({ path: path.join(outDir, "dev-layout.png"), fullPage: true });

  await page.getByRole("button", { name: "Node" }).click();
  await page.locator(".toolbar__menu-popover").getByRole("menuitem", { name: /Add Child/i }).click();
  const childState = await readEditorState(page);
  lastState = childState;
  if (!childState.selectedUiNode || childState.selectedUiNode.parent !== 2) {
    throw new Error(`added child should attach under PanelBg: ${JSON.stringify(childState.selectedUiNode)}`);
  }
  await page.screenshot({ path: path.join(outDir, "dev-layout-child.png"), fullPage: true });

  const dirtyModal = page.locator("[data-dirty-action-modal]");
  await page.locator("#workspace-upload").evaluate((input) => {
    if (!(input instanceof HTMLInputElement)) return;
    const transfer = new DataTransfer();
    transfer.items.add(new File(["guard"], "guard.txt", { type: "text/plain" }));
    Object.defineProperty(input, "files", { configurable: true, value: transfer.files });
    window.setTimeout(() => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }, 0);
  });
  await dirtyModal.waitFor({ timeout: 15000 });
  await page.waitForFunction(
    () => {
      if (typeof window.render_game_to_text !== "function") return false;
      const state = JSON.parse(window.render_game_to_text());
      return state.dirtyActionPrompt?.mode === "workspace-switch" && state.dirtyActionPrompt?.dirtyCount >= 1;
    },
    { timeout: 15000 }
  );
  await dirtyModal.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.waitForFunction(
    () => {
      if (typeof window.render_game_to_text !== "function") return false;
      const state = JSON.parse(window.render_game_to_text());
      return state.activeDocument?.name === "NewLayout1.json" &&
        Array.isArray(state.dirtyTabs) &&
        state.dirtyTabs.includes("NewLayout1.json") &&
        Array.isArray(state.logs) &&
        state.logs.some((line) => line.includes("Import folder cancelled because there are unsaved documents"));
    },
    { timeout: 15000 }
  );

  await page.evaluate(() => {
    window.showSaveFilePicker = async () => ({
      name: "SavedNewLayout1.json",
      createWritable: async () => {
        let buffer = "";
        return {
          close: async () => {
            window.__smokeSavedDocuments = [...(window.__smokeSavedDocuments ?? []), buffer];
          },
          write: async (value) => {
            if (typeof value === "string") {
              buffer += value;
            } else if (value instanceof ArrayBuffer) {
              buffer += new TextDecoder().decode(value);
            }
          }
        };
      }
    });
  });
  await page.locator(".tab--active .tab__close").click();
  await dirtyModal.waitFor({ timeout: 15000 });
  await page.waitForFunction(
    () => {
      if (typeof window.render_game_to_text !== "function") return false;
      const state = JSON.parse(window.render_game_to_text());
      return state.dirtyActionPrompt?.mode === "close-tab" && state.dirtyActionPrompt?.dirtyCount === 1;
    },
    { timeout: 15000 }
  );
  await dirtyModal.getByRole("button", { name: "Save", exact: true }).click();
  await page.waitForFunction(
    () => {
      if (typeof window.render_game_to_text !== "function") return false;
      const state = JSON.parse(window.render_game_to_text());
      return state.activeDocument?.name !== "NewLayout1.json" &&
        Array.isArray(state.dirtyTabs) &&
        !state.dirtyTabs.includes("NewLayout1.json") &&
        Array.isArray(state.logs) &&
        state.logs.some((line) => line.includes("Closed dirty tab after saving: NewLayout1.json"));
    },
    { timeout: 15000 }
  );
  await page.waitForFunction(
    () => Array.isArray(window.__smokeSavedDocuments) && window.__smokeSavedDocuments.length >= 1,
    { timeout: 15000 }
  );

  await page.locator("header.toolbar").getByRole("button", { name: "New UI Layout", exact: true }).click();
  await page.waitForFunction(
    () => {
      if (typeof window.render_game_to_text !== "function") return false;
      const state = JSON.parse(window.render_game_to_text());
      return state.activeDocument?.name === "NewLayout2.json" && Array.isArray(state.dirtyTabs) && state.dirtyTabs.includes("NewLayout2.json");
    },
    { timeout: 15000 }
  );
  await page.locator(".tab--active .tab__close").click();
  await dirtyModal.waitFor({ timeout: 15000 });
  await dirtyModal.getByRole("button", { name: "Close Without Saving", exact: true }).click();
  await page.waitForFunction(
    () => {
      if (typeof window.render_game_to_text !== "function") return false;
      const state = JSON.parse(window.render_game_to_text());
      return state.activeDocument?.name !== "NewLayout2.json" &&
        Array.isArray(state.dirtyTabs) &&
        !state.dirtyTabs.includes("NewLayout2.json") &&
        Array.isArray(state.logs) &&
        state.logs.some((line) => line.includes("Closed dirty tab without saving: NewLayout2.json"));
    },
    { timeout: 15000 }
  );
  await page.locator(".tab__select", { hasText: "sample-layout.json" }).click();
  await page.waitForFunction(
    () => {
      if (typeof window.render_game_to_text !== "function") return false;
      const state = JSON.parse(window.render_game_to_text());
      return state.activeDocument?.kind === "ui-layout" && state.activeDocument?.name === "sample-layout.json";
    },
    { timeout: 15000 }
  );

  const state = await page.evaluate(() =>
    typeof window.render_game_to_text === "function" ? window.render_game_to_text() : null
  );
  lastState = state ? JSON.parse(state) : lastState;

  if (logs.some((line) => line.startsWith("[pageerror]") || line.startsWith("[requestfailed]"))) {
    throw new Error("browser log contains pageerror or requestfailed");
  }
  if (!state || !String(state).includes("ui-layout")) {
    throw new Error(`unexpected editor state: ${state}`);
  }
} finally {
  if (!lastState) {
    try {
      lastState = await page.evaluate(() =>
        typeof window.render_game_to_text === "function" ? JSON.parse(window.render_game_to_text()) : null
      );
    } catch {
      lastState = null;
    }
  }
  fs.writeFileSync(path.join(outDir, "dev-browser.log"), logs.join("\n"), "utf8");
  fs.writeFileSync(path.join(outDir, "dev-state.json"), JSON.stringify(lastState, null, 2), "utf8");
  await browser.close();
}

async function launchBrowser() {
  try {
    return await chromium.launch({ channel: "chrome", headless: true });
  } catch {
    return chromium.launch({ headless: true });
  }
}

async function readEditorState(page) {
  const state = await page.evaluate(() =>
    typeof window.render_game_to_text === "function" ? JSON.parse(window.render_game_to_text()) : null
  );
  if (!state) {
    throw new Error("window.render_game_to_text() returned null");
  }
  return state;
}
