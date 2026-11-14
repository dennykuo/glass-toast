import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';

// 直接測建置後的套件，純色宿主可明確量測半透明通知的合成底色。
async function load(page, theme, scheme = theme, marker = '') {
  await page.emulateMedia({ colorScheme: scheme });
  await page.setContent(`<html ${marker}><body style="background:${theme === 'dark' ? '#070a11' : '#e8edf4'}">
    <div style="position:fixed;bottom:1rem;left:1rem"><button id="invoker">Show</button>
    <button id="other">Another action</button></div></body></html>`);
  await page.addScriptTag({ path: resolve('dist/glass-toast.umd.cjs') });
}

async function show(page, type = 'error') {
  await page.evaluate((type) => {
    window.GlassToast.dismissAll();
    window.GlassToast.show('Upload failed', {
      type, persistent: true, action: { label: 'Retry', onClick() {} },
    });
  }, type);
  const toast = page.locator('.glass-toast');
  await expect(toast).toHaveCSS('opacity', '1');
  return toast;
}

function composite(front, back) {
  const alpha = front[3] ?? 1;
  return front.slice(0, 3).map((channel, i) => channel * alpha + back[i] * (1 - alpha));
}

function luminance(rgb) {
  const linear = rgb.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return linear.reduce((sum, value, i) => sum + value * [0.2126, 0.7152, 0.0722][i], 0);
}

async function contrast(button) {
  const colors = await button.evaluate(async (el) => {
    // 等 hover 的顏色 transition 完成，避免只量到變色前的第一幀。
    getComputedStyle(el).backgroundColor;
    await Promise.all(el.getAnimations().map((animation) => animation.finished));
    const parse = (value) => value.match(/[\d.]+/g).map(Number);
    return {
      text: parse(getComputedStyle(el).color),
      button: parse(getComputedStyle(el).backgroundColor),
      toast: parse(getComputedStyle(el.closest('.glass-toast')).backgroundColor),
      page: parse(getComputedStyle(document.body).backgroundColor),
    };
  });
  const background = composite(colors.button, composite(colors.toast, colors.page));
  const values = [luminance(composite(colors.text, background)), luminance(background)].sort((a, b) => a - b);
  return (values[1] + 0.05) / (values[0] + 0.05);
}

const appearances = [
  { theme: 'light', scheme: 'light', marker: '' },
  { theme: 'dark', scheme: 'dark', marker: '' },
  { theme: 'dark', scheme: 'light', marker: 'data-theme="dark"' },
  { theme: 'dark', scheme: 'light', marker: 'class="dark"' },
  { theme: 'light', scheme: 'dark', marker: 'data-theme="light"' },
  { theme: 'light', scheme: 'dark', marker: 'class="light"' },
];

for (const { theme, scheme, marker } of appearances) {
  test(`${theme} ${marker || 'system'} action 各互動狀態均達 4.5:1`, async ({ page }) => {
    await load(page, theme, scheme, marker);
    for (const type of ['success', 'error', 'warning', 'info']) {
      await page.locator('#other').hover();
      const toast = await show(page, type);
      const action = toast.getByRole('button', { name: 'Retry' });
      expect(await contrast(action), `${theme} ${type}`).toBeGreaterThanOrEqual(4.5);
      await action.hover();
      expect(await contrast(action), `${theme} ${type} hover`).toBeGreaterThanOrEqual(4.5);
      await page.locator('#other').hover();
      await action.focus();
      expect(await contrast(action), `${theme} ${type} focus`).toBeGreaterThanOrEqual(4.5);
    }
  });
}

test('宿主仍可覆寫 action 的文字、背景與 hover CSS 變數', async ({ page }) => {
  await load(page, 'dark');
  await page.addStyleTag({ content: `.glass-toast {
    --gt-action-text: #ffffff; --gt-action-bg: #222222; --gt-action-bg-hover: #333333;
  }` });
  const toast = await show(page);
  const action = toast.getByRole('button', { name: 'Retry' });
  await expect(action).toHaveCSS('color', 'rgb(255, 255, 255)');
  await expect(action).toHaveCSS('background-color', 'rgb(34, 34, 34)');
  await action.hover();
  await expect(action).toHaveCSS('background-color', 'rgb(51, 51, 51)');
});

for (const reducedMotion of ['no-preference', 'reduce']) {
  test(`關閉時保留使用者的新焦點（${reducedMotion}）`, async ({ page }) => {
    await load(page, 'light');
    await page.emulateMedia({ reducedMotion });
    await page.locator('#invoker').focus();
    const toast = await show(page);
    await toast.getByRole('button', { name: 'Close', exact: true }).focus();
    await page.keyboard.press('Escape');
    await page.locator('#other').focus();
    await expect(toast).toHaveCount(0);
    await expect(page.locator('#other')).toBeFocused();
  });
}
