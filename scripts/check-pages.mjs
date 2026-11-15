import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';
import { chromium, expect } from '@playwright/test';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

async function retry(check) {
  const attempts = 12;
  for (let attempt = 1; attempt < attempts; attempt++) {
    try {
      return await check();
    } catch {
      await delay(10_000);
    }
  }
  return check();
}

const liveToast = (page, message) => page.locator('[data-toast-container] .glass-toast').filter({ hasText: message });

export async function checkPages(context, url) {
  const spec = `${pkg.name}@${pkg.version}`;
  const cdns = [`https://unpkg.com/${spec}`, `https://cdn.jsdelivr.net/npm/${spec}`];
  const home = new URL(url.endsWith('/') ? url : `${url}/`);
  const page = await context.newPage();
  try {
    await retry(async () => {
      const response = await page.goto(home.href, { timeout: 15_000 });
      assert.equal(response?.status(), 200);
      await expect(page.locator('.brand__version')).toHaveText(`v${pkg.version}`);
    });
    await expect(page.locator('#install-cmd')).toHaveText(`npm i ${spec}`);
    const usage = await page.locator('#usage pre[data-lang="html"] code').textContent();
    const urls = [...usage.matchAll(/<script src="([^"]+)">/g)].map(([, src]) => src);
    assert.deepEqual(urls, cdns);

    await page.locator('a[data-page="demo"]').click();
    await expect(page).toHaveURL(new URL('demo.html', home).href);
    await expect(page.locator('.brand__version')).toHaveText(`v${pkg.version}`);
    await page.locator('#action').check();
    await page.locator('#playground').getByRole('button', { name: 'error', exact: true }).click();
    await liveToast(page, '連線逾時').getByRole('button', { name: '重試', exact: true }).click();
    await expect(liveToast(page, '已重新送出')).toBeVisible();

    for (const src of cdns) {
      await retry(async () => {
        await page.goto('about:blank');
        await page.addScriptTag({ url: src });
        await page.evaluate(() => window.GlassToast.success('CDN ready', { persistent: true }));
        await expect(liveToast(page, 'CDN ready')).toBeVisible();
      });
      console.log(`Loaded ${src}`);
    }
    console.log(`Verified Pages ${pkg.version}, install example and demo retry action`);
  } finally {
    await page.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const url = process.env.PAGES_URL;
  assert(url, 'Set PAGES_URL to the deployed site URL.');
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    await checkPages(context, url);
  } finally {
    await browser.close();
  }
}
