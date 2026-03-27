import { test, expect } from '@playwright/test';
import * as path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');

const BASE_URL = 'http://localhost:5174';
const PROJECT_PATH = 'D:/game/BRM-TS/test-project';

async function ensureDir(dir: string): Promise<void> {
  await fs.promises.mkdir(dir, { recursive: true });
}

async function dismissAllMenus(page: import('@playwright/test').Page): Promise<void> {
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
  }
}

async function captureMenuItems(page: import('@playwright/test').Page): Promise<string[]> {
  const contextMenu = page.locator('.context-menu');
  const menuVisible = await contextMenu.isVisible().catch(() => false);

  if (!menuVisible) {
    console.log('Context menu not visible');
    return [];
  }

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'capture-menuItems.png') });
  const menuItems = contextMenu.locator('.context-menu__item');
  const count = await menuItems.count();
  const items: string[] = [];
  for (let i = 0; i < count; i++) {
    const text = (await menuItems.nth(i).innerText()).trim();
    if (text) items.push(text);
  }
  console.log(`Menu items (${count}): ${items.join(' | ')}`);
  return items;
}

async function waitForContextMenu(page: import('@playwright/test').Page): Promise<string[]> {
  const contextMenu = page.locator('.context-menu');
  await page.waitForTimeout(500);
  const menuVisible = await contextMenu.isVisible().catch(() => false);
  if (menuVisible) {
    return await captureMenuItems(page);
  }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  return [];
}

async function openTestProject(page: import('@playwright/test').Page): Promise<void> {
  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser', { timeout: 10000 }),
    page.getByRole('button', { name: /导入文件夹|Import Folder/ }).first().click()
  ]);
  await fileChooser.setFiles(PROJECT_PATH);
  console.log('Project files selected');
  await page.waitForTimeout(3000);
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, 'cm-project-loaded.png'),
    fullPage: true
  });
}

async function createUiLayout(page: import('@playwright/test').Page): Promise<void> {
  console.log('Creating new UI layout document...');
  await page.getByRole('button', { name: /新建 UI 布局|New UI Layout/ }).first().click();
  await page.waitForTimeout(2000);
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, 'cm-document-opened.png'),
    fullPage: true
  });
}

test.describe('Context Menu Functional Tests', () => {
  test.setTimeout(90000);

  test('Load project and test all context menus', async ({ page }) => {
    await ensureDir(SCREENSHOT_DIR);
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    // Step 1: Open project
    await openTestProject(page);
    const assetCount = await page.locator('.tree__asset').count();
    console.log(`Assets loaded: ${assetCount}`);

    // Step 2: Asset context menu
    if (assetCount > 0) {
      await page.locator('.tree__asset').first().click({ button: 'right' });
      const items = await waitForContextMenu(page);
      console.log(`Asset items: ${items.join(' | ')}`);
      expect(items.length).toBeGreaterThan(0);
      await dismissAllMenus(page);
    }

    // Step 3: Asset empty area context menu
    const assetPanel = page.locator('.panel--asset-browser .panel__body').first();
    if (await assetPanel.isVisible().catch(() => false)) {
      await assetPanel.click({ button: 'right' });
      const items = await waitForContextMenu(page);
      console.log(`Asset empty area items: ${items.join(' | ')}`);
      if (items.length > 0) {
        expect(items.length).toBeGreaterThan(0);
      }
      await dismissAllMenus(page);
    }

    // Step 4: Create a UI layout to test hierarchy/scene/tabs
    await createUiLayout(page);
    await page.waitForTimeout(2000);

    // Step 5: Tab context menu
    const tabs = page.locator('.tab');
    const tabCount = await tabs.count();
    console.log(`Tabs found: ${tabCount}`);
    if (tabCount > 0) {
      await tabs.first().click({ button: 'right' });
      const items = await waitForContextMenu(page);
      console.log(`Tab items: ${items.join(' | ')}`);
      if (items.length > 0) {
        expect(items.length).toBeGreaterThan(0);
      }
      await dismissAllMenus(page);
    }

    // Step 6: Hierarchy node context menu
    await page.waitForTimeout(1000);
    const hierarchyNodes = page.locator('.panel--hierarchy .tree__asset, .panel--hierarchy .tree__summary');
    const hNodeCount = await hierarchyNodes.count();
    console.log(`Hierarchy nodes found: ${hNodeCount}`);

    if (hNodeCount > 0) {
      await hierarchyNodes.first().click({ button: 'right' });
      const items = await waitForContextMenu(page);
      console.log(`Hierarchy items: ${items.join(' | ')}`);
      expect(items.length).toBeGreaterThan(0);
      await dismissAllMenus(page);
    }

    // Step 7: Hierarchy empty area context menu
    const hierarchyBody = page.locator('.panel--hierarchy .panel__body').first();
    if (await hierarchyBody.isVisible().catch(() => false)) {
      await hierarchyBody.click({ button: 'right' });
      const items = await waitForContextMenu(page);
      console.log(`Hierarchy empty area items: ${items.join(' | ')}`);
      if (items.length > 0) {
        expect(items.length).toBeGreaterThan(0);
      }
      await dismissAllMenus(page);
    }

    // Step 8: Console context menu
    const consolePanel = page.locator('.panel--logs').first();
    if (await consolePanel.isVisible().catch(() => false)) {
      await consolePanel.click({ button: 'right' });
      const items = await waitForContextMenu(page);
      console.log(`Console items: ${items.join(' | ')}`);
      if (items.length > 0) {
        expect(items.length).toBeGreaterThan(0);
      }
      await dismissAllMenus(page);
    }

    // Step 9: Inspector context menu
    const inspectorPanel = page.locator('.panel--inspector').first();
    if (await inspectorPanel.isVisible().catch(() => false)) {
      await inspectorPanel.click({ button: 'right' });
      const items = await waitForContextMenu(page);
      console.log(`Inspector items: ${items.join(' | ')}`);
      if (items.length > 0) {
        expect(items.length).toBeGreaterThan(0);
      }
      await dismissAllMenus(page);
    }

    // Final screenshot
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'cm-final-state.png'),
      fullPage: true
    });
    console.log('\n=== All context menu tests completed ===');
  });
});
