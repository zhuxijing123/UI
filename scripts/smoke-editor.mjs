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
    await page.screenshot({ path: path.join(outDir, "dev-sample-layout.png"), fullPage: true });

    await page.locator(".tree__asset", { hasText: "50012.mapo" }).dblclick();
    await page.getByText("NPC 2", { exact: true }).waitFor({ timeout: 15000 });
    await page.getByText("Monster 1", { exact: true }).waitFor({ timeout: 15000 });
    await page.screenshot({ path: path.join(outDir, "dev-map-overlay.png"), fullPage: true });

    await page.getByRole("button", { name: "Avatar Lab" }).click();
    await page.getByText("Avatar Preview Lab", { exact: true }).waitFor({ timeout: 15000 });
    await page.screenshot({ path: path.join(outDir, "dev-avatar-lab.png"), fullPage: true });

    await page.getByRole("button", { name: "Effect Lab" }).click();
    await page.getByText("Effect Preview Lab", { exact: true }).waitFor({ timeout: 15000 });
    await page.screenshot({ path: path.join(outDir, "dev-effect-lab.png"), fullPage: true });
  }

  await page.getByRole("button", { name: "New UI Layout" }).click();
  await page.getByText("UI Layout Viewport", { exact: true }).waitFor({ timeout: 10000 });
  await page.screenshot({ path: path.join(outDir, "dev-layout.png"), fullPage: true });

  await page.getByRole("button", { name: "Add Child" }).click();
  await page.screenshot({ path: path.join(outDir, "dev-layout-child.png"), fullPage: true });

  const state = await page.evaluate(() =>
    typeof window.render_game_to_text === "function" ? window.render_game_to_text() : null
  );

  fs.writeFileSync(path.join(outDir, "dev-browser.log"), logs.join("\n"), "utf8");
  fs.writeFileSync(path.join(outDir, "dev-state.json"), String(state ?? "null"), "utf8");

  if (logs.some((line) => line.startsWith("[pageerror]") || line.startsWith("[requestfailed]"))) {
    throw new Error("browser log contains pageerror or requestfailed");
  }
  if (!state || !String(state).includes("ui-layout")) {
    throw new Error(`unexpected editor state: ${state}`);
  }
} finally {
  await browser.close();
}

async function launchBrowser() {
  try {
    return await chromium.launch({ channel: "chrome", headless: true });
  } catch {
    return chromium.launch({ headless: true });
  }
}
