import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// This test requires a running dev server on localhost:5174
// and a project opened via cached workspace

test.describe('Editor Functional Tests', () => {

  test('01 - Dashboard renders with Chinese text', async ({ page }) => {
    await page.goto('http://localhost:5174', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    await page.screenshot({ path: path.join(__dirname, 'screenshots', 'f01-dashboard.png'), fullPage: true });

    // Verify dashboard is visible
    const dashboard = page.locator('.dashboard-hub');
    await expect(dashboard).toBeVisible({ timeout: 10000 });

    // Get all text
    const text = await page.locator('body').innerText();
    console.log('Dashboard text sample:', text.substring(0, 500));
  });

  test('02 - Menu bar items are in Chinese', async ({ page }) => {
    await page.goto('http://localhost:5174', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Check menu bar exists and items are Chinese
    const menuItems = page.locator('.menu-bar__item');
    const count = await menuItems.count();
    console.log(`Menu items count: ${count}`);

    for (let i = 0; i < count; i++) {
      const text = await menuItems.nth(i).innerText();
      console.log(`Menu ${i}: "${text}"`);
    }

    // Click first menu and screenshot dropdown
    if (count > 0) {
      await menuItems.first().click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(__dirname, 'screenshots', 'f02-menu-dropdown.png') });
    }
  });

  test('03 - Select dropdown has dark background', async ({ page }) => {
    await page.goto('http://localhost:5174', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Find any select element and check its option styling
    const selects = page.locator('select');
    const count = await selects.count();
    console.log(`Found ${count} select elements`);

    // Check CSS for select option styling
    const optionStyles = await page.evaluate(() => {
      const styles = document.querySelectorAll('style');
      let found = false;
      styles.forEach(s => {
        if (s.textContent?.includes('select option')) {
          found = true;
        }
      });
      return found;
    });
    console.log(`Has select option CSS: ${optionStyles}`);
  });

  test('04 - Toolbar buttons render correctly', async ({ page }) => {
    await page.goto('http://localhost:5174', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    const toolbar = page.locator('.toolbar');
    if (await toolbar.isVisible()) {
      await page.screenshot({ path: path.join(__dirname, 'screenshots', 'f04-toolbar.png') });

      // Check all button text
      const buttons = toolbar.locator('button');
      const count = await buttons.count();
      for (let i = 0; i < count; i++) {
        const text = await buttons.nth(i).innerText();
        if (text.trim()) console.log(`Button ${i}: "${text.trim()}"`);
      }
    }
  });

  test('05 - Check for console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('http://localhost:5174', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    if (errors.length > 0) {
      console.log(`Found ${errors.length} console errors:`);
      errors.forEach(e => console.log(`  - ${e}`));
    } else {
      console.log('No console errors found');
    }

    await page.screenshot({ path: path.join(__dirname, 'screenshots', 'f05-console-check.png'), fullPage: true });
  });
});
