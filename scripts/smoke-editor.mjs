import fs from "node:fs";
import path from "node:path";

import { chromium } from "playwright";

const baseUrl = process.env.BRM_UI_STUDIO_URL ?? "http://127.0.0.1:3100";
const outDir = process.env.BRM_UI_STUDIO_OUTDIR ?? path.join(process.cwd(), "output", "playwright");
const fixtureDir = process.env.BRM_UI_STUDIO_FIXTURE_DIR ?? path.join(process.cwd(), "fixtures", "legacy-sample");

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
  await page.screenshot({ path: path.join(outDir, "dev-home.png"), fullPage: true });

  if (fs.existsSync(fixtureDir)) {
    await page.locator("#workspace-upload").setInputFiles(fixtureDir);
    await page.getByText(/Workspace: legacy-sample/i).waitFor({ timeout: 15000 });
    await page.screenshot({ path: path.join(outDir, "dev-imported.png"), fullPage: true });

    await page.locator(".tree__asset", { hasText: "sample-layout.json" }).dblclick();
    await page.getByText("Legacy Layout Preview", { exact: true }).waitFor({ timeout: 15000 });
    const buttonNode = page.locator('[data-node-name="ActionButton"]').first();
    await buttonNode.waitFor({ timeout: 15000 });
    await buttonNode.scrollIntoViewIfNeeded();
    await buttonNode.click();
    await page.waitForFunction(
      () => {
        if (typeof window.render_game_to_text !== "function") return false;
        const state = JSON.parse(window.render_game_to_text());
        return state.selectedUiNode?.description?.includes("ActionButton");
      },
      { timeout: 15000 }
    );
    const beforeDrag = await readEditorState(page);
    lastState = beforeDrag;
    const buttonBox = await buttonNode.boundingBox();
    if (!buttonBox) throw new Error("ActionButton bounding box unavailable");
    await page.mouse.move(buttonBox.x + buttonBox.width / 2, buttonBox.y + buttonBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(buttonBox.x + buttonBox.width / 2 + 48, buttonBox.y + buttonBox.height / 2 - 28, { steps: 10 });
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
    await page.screenshot({ path: path.join(outDir, "dev-sample-layout.png"), fullPage: true });

    await page.locator(".tree__asset", { hasText: "50012.mapo" }).dblclick();
    await page.getByText("NPC 2", { exact: true }).waitFor({ timeout: 15000 });
    await page.getByText("Monster 1", { exact: true }).waitFor({ timeout: 15000 });
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
    await page.getByRole("button", { name: "Save" }).click();
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

  await page.getByRole("button", { name: "New UI Layout" }).click();
  await page.getByText("UI Layout Viewport", { exact: true }).waitFor({ timeout: 10000 });
  const newLayoutState = await readEditorState(page);
  lastState = newLayoutState;
  if (!newLayoutState.selectedUiNode?.description?.includes("PanelBg")) {
    throw new Error(`starter layout should preselect PanelBg: ${JSON.stringify(newLayoutState.selectedUiNode)}`);
  }
  await page.screenshot({ path: path.join(outDir, "dev-layout.png"), fullPage: true });

  await page.getByRole("button", { name: "Add Child" }).click();
  const childState = await readEditorState(page);
  lastState = childState;
  if (!childState.selectedUiNode || childState.selectedUiNode.parent !== 2) {
    throw new Error(`added child should attach under PanelBg: ${JSON.stringify(childState.selectedUiNode)}`);
  }
  await page.screenshot({ path: path.join(outDir, "dev-layout-child.png"), fullPage: true });

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
