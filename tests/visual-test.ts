import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');

test.beforeAll(async () => {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
});

test.describe('BRM UI Studio Visual Tests', () => {

  test('01 - Welcome/Dashboard page loads correctly', async ({ page }) => {
    await page.goto('http://localhost:5174', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Take full page screenshot
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '01-welcome-dashboard.png'),
      fullPage: true
    });

    // Check that the dashboard renders
    const dashboard = page.locator('.dashboard-hub');
    await expect(dashboard).toBeVisible({ timeout: 10000 });

    // Check nav items exist
    const navItems = page.locator('.dashboard-hub__nav-item');
    await expect(navItems).toHaveCount(3);

    // Check sidebar status
    const sidebarStatus = page.locator('.dashboard-hub__sidebar-status');
    await expect(sidebarStatus).toBeVisible();
  });

  test('02 - Open project and scan workspace', async ({ page }) => {
    await page.goto('http://localhost:5174', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // Click "Open Project" button
    const openBtn = page.locator('text=打开项目').first();
    if (await openBtn.isVisible()) {
      await openBtn.click();
    } else {
      // Try English fallback
      const openBtnEn = page.locator('text=Open Project').first();
      if (await openBtnEn.isVisible()) {
        await openBtnEn.click();
      }
    }

    // File dialog will open - we can't interact with native file dialogs
    // So we use the cached workspace restore approach instead
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '02-file-dialog.png'),
      fullPage: true
    });
  });

  test('03 - Check dashboard sections navigation', async ({ page }) => {
    await page.goto('http://localhost:5174', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Click each nav item and take screenshots
    const sections = ['home', 'projects', 'editors'];
    // Try to find nav items - they might be in Chinese or English
    const navItems = page.locator('.dashboard-hub__nav-item');
    const count = await navItems.count();

    for (let i = 0; i < count; i++) {
      await navItems.nth(i).click();
      await page.waitForTimeout(500);
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `03-section-${sections[i] || i}.png`),
        fullPage: true
      });
    }
  });

  test('04 - Check all text is Chinese (zh-CN)', async ({ page }) => {
    await page.goto('http://localhost:5174', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Get all visible text content
    const bodyText = await page.locator('body').innerText();

    // Save text content for analysis
    fs.writeFileSync(
      path.join(SCREENSHOT_DIR, '04-text-content.txt'),
      bodyText,
      'utf-8'
    );

    // Check for common English strings that should be translated
    const englishStrings = [
      'Dashboard', 'Creator-style project center', 'Home', 'Projects', 'Editors',
      'Status', 'Recent', 'Latest', 'Project', 'Choose a BRM workspace',
      'Search projects', 'Recently Opened', 'Name',
      'Workspace Tools', 'UI Layout Editor', 'Avatar / Effect Labs',
      'Atlas / BMFont / Map', 'Project List', 'Installed Editor Modules',
      'BRM UI Studio', 'Legacy Labs', 'No cached projects', 'No projects available',
      'Open or import', 'Open Project', 'Import Folder', 'New UI Layout'
    ];

    const untranslated: string[] = [];
    for (const str of englishStrings) {
      if (bodyText.includes(str)) {
        untranslated.push(str);
      }
    }

    fs.writeFileSync(
      path.join(SCREENSHOT_DIR, '04-untranslated-strings.json'),
      JSON.stringify(untranslated, null, 2),
      'utf-8'
    );

    console.log(`Found ${untranslated.length} potentially untranslated strings`);
    if (untranslated.length > 0) {
      console.log('Untranslated:', untranslated.join(', '));
    }
  });

  test('05 - Check menu bar rendering', async ({ page }) => {
    await page.goto('http://localhost:5174', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    const menuBar = page.locator('.menu-bar');
    if (await menuBar.isVisible()) {
      // Click each menu and take screenshot
      const menuItems = page.locator('.menu-bar__item');
      const count = await menuItems.count();

      for (let i = 0; i < Math.min(count, 8); i++) {
        await menuItems.nth(i).click();
        await page.waitForTimeout(300);
        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, `05-menu-${i}.png`)
        });
      }
    } else {
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, '05-no-menu-bar.png')
      });
    }
  });

  test('06 - Check CSS dark theme consistency', async ({ page }) => {
    await page.goto('http://localhost:5174', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Check background colors
    const bodyBg = await page.locator('body').evaluate(el =>
      window.getComputedStyle(el).backgroundColor
    );

    // Check for white backgrounds (should be dark theme)
    const whiteElements = await page.locator('body').evaluate(() => {
      const all = document.querySelectorAll('*');
      const whiteBg: string[] = [];
      all.forEach(el => {
        const style = window.getComputedStyle(el);
        const bg = style.backgroundColor;
        // Check for pure white or near-white backgrounds
        if (bg === 'rgb(255, 255, 255)' || bg === 'rgba(255, 255, 255, 1)') {
          const tag = el.tagName;
          const cls = el.className?.toString().substring(0, 50) || '';
          whiteBg.push(`${tag}.${cls}: ${bg}`);
        }
      });
      return whiteBg.slice(0, 20); // Limit to 20
    });

    fs.writeFileSync(
      path.join(SCREENSHOT_DIR, '06-white-bg-elements.json'),
      JSON.stringify({ bodyBg, whiteElements }, null, 2),
      'utf-8'
    );

    console.log(`Found ${whiteElements.length} elements with white background`);
  });
});
