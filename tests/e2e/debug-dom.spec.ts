/**
 * Diagnostic: dumps the DOM structure around the Devvit game embed
 * to figure out the correct selectors.
 *
 * Usage: npx playwright test tests/e2e/debug-dom.spec.ts --headed
 */
import { test } from '@playwright/test';

const POST_URL = process.env.REDDIT_POST_URL ?? 'https://www.reddit.com/r/valcordia_space_dev/';

test('dump DOM structure', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(POST_URL, { waitUntil: 'load', timeout: 60_000 });
  await page.waitForTimeout(10_000); // let Reddit fully render

  // Dump all iframes
  const frameInfo = page.frames().map(f => ({
    name: f.name(),
    url: f.url(),
    parent: f.parentFrame()?.name() ?? '(top)',
  }));
  console.log('\n=== ALL FRAMES ===');
  for (const f of frameInfo) {
    console.log(`  [${f.parent}] → "${f.name}" → ${f.url}`);
  }

  // Look for any custom elements that might be the embed
  const customElements = await page.evaluate(() => {
    const all = document.querySelectorAll('*');
    const customs = new Set<string>();
    for (const el of all) {
      if (el.tagName.includes('-')) customs.add(el.tagName.toLowerCase());
    }
    return Array.from(customs).sort();
  });
  console.log('\n=== CUSTOM ELEMENTS ON PAGE ===');
  console.log(customElements.join(', '));

  // Look for iframes specifically
  const iframes = await page.evaluate(() => {
    const frames = document.querySelectorAll('iframe');
    return Array.from(frames).map(f => ({
      src: f.src || '(empty)',
      id: f.id || '(none)',
      name: f.name || '(none)',
      className: f.className || '(none)',
      parent: f.parentElement?.tagName?.toLowerCase() || '(none)',
      grandparent: f.parentElement?.parentElement?.tagName?.toLowerCase() || '(none)',
    }));
  });
  console.log('\n=== IFRAMES ===');
  for (const f of iframes) {
    console.log(`  parent=${f.grandparent}>${f.parent} id=${f.id} name=${f.name} src=${f.src.substring(0, 120)}`);
  }

  // Check shadow roots
  const shadowHosts = await page.evaluate(() => {
    const all = document.querySelectorAll('*');
    const hosts: string[] = [];
    for (const el of all) {
      if (el.shadowRoot) hosts.push(`${el.tagName.toLowerCase()}#${el.id || '(no-id)'}`);
    }
    return hosts;
  });
  console.log('\n=== SHADOW DOM HOSTS ===');
  console.log(shadowHosts.join(', '));

  // Try to find game canvas in any frame
  console.log('\n=== SEARCHING FOR #game-canvas IN FRAMES ===');
  for (const frame of page.frames()) {
    try {
      const hasCanvas = await frame.evaluate(() => !!document.querySelector('#game-canvas'));
      if (hasCanvas) {
        console.log(`  FOUND in frame: "${frame.name()}" url=${frame.url()}`);
      }
    } catch {
      // cross-origin or detached
    }
  }

  // Take a screenshot for reference
  await page.screenshot({ path: 'tests/e2e/debug-screenshot.png', fullPage: false });
  console.log('\nScreenshot saved to tests/e2e/debug-screenshot.png');
});
