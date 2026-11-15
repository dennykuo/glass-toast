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

test('320px 下長操作文字、訊息與關閉鈕都放得下', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await load(page, 'light');
  await page.evaluate(() => {
    window.GlassToast.show('狹窄畫面中的訊息仍應清楚可見', {
      action: { label: '重新檢查連線並再次上傳檔案', onClick() {} },
    });
  });
  const toast = page.locator('.glass-toast');
  await expect(toast).toHaveCSS('opacity', '1');
  const shell = await toast.boundingBox();
  const message = await toast.getByText('狹窄畫面中的訊息仍應清楚可見').boundingBox();
  expect(message.width).toBeGreaterThan(100);
  for (const button of await toast.getByRole('button').all()) {
    const bounds = await button.boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(shell.x);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(shell.x + shell.width);
  }
  const close = toast.getByRole('button', { name: 'Close', exact: true });
  expect(await contrast(close)).toBeGreaterThanOrEqual(3);
  await close.click();
  await expect(toast).toHaveCount(0);
});

test('快速雙擊重試只執行一次', async ({ page }) => {
  await load(page, 'light');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => {
    window.GlassToast.error('Upload failed', {
      action: {
        label: 'Retry',
        onClick() { document.querySelector('#other').textContent += '!'; },
      },
    });
  });
  await page.getByRole('button', { name: 'Retry' }).dblclick();
  await expect(page.getByRole('button', { name: 'Retry' })).toHaveCount(0);
  await expect(page.locator('#other')).toHaveText('Another action!');
});

test('非同步重試等待結果，失敗可再試且不產生未處理的例外', async ({ page }) => {
  await load(page, 'light');
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.evaluate(() => {
    window.GlassToast.error('Upload failed', {
      action: {
        label: 'Retry',
        onClick() {
          document.querySelector('#other').textContent += '!';
          return new Promise((resolve, reject) => {
            window.finishRetry = (ok) => ok ? resolve() : reject(new Error('Upload failed'));
          });
        },
      },
    });
  });
  const action = page.getByRole('button', { name: 'Retry' });
  await action.focus();
  await action.press('Enter');
  await expect(action).toBeDisabled();
  await expect(action).toBeFocused();
  await action.press('Enter');
  await expect(page.locator('#other')).toHaveText('Another action!');
  await page.evaluate(() => window.finishRetry(false));
  await expect(action).toBeEnabled();
  await expect(action).toBeFocused();
  await action.press('Enter');
  await page.evaluate(() => window.finishRetry(true));
  await expect(action).toHaveCount(0);
  await expect(page.locator('#other')).toHaveText('Another action!!');
  expect(errors).toEqual([]);
});

test('短螢幕的置底堆疊讓最新通知可操作，較早通知仍能捲動及用鍵盤關閉', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await load(page, 'light');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => {
    const message = '需重新確認付款資料與收件地址，確認完成後才能重新送出訂單。'.repeat(6);
    const action = { label: '重新檢查付款資料與聯絡資訊之後，再送出這筆訂單', onClick() {} };
    for (let i = 1; i <= 4; i++) {
      window.GlassToast.error(`通知 ${i}：${message}`, { position: 'bottom-center', action });
    }
  });
  const close = (number) => page.locator('.glass-toast').filter({ hasText: `通知 ${number}：` })
    .getByRole('button', { name: 'Close', exact: true });
  const stack = page.locator('[data-toast-container="bottom-center"]');
  await expect(stack).toBeInViewport({ ratio: 1 });
  await expect(close(4)).toBeInViewport({ ratio: 1 });
  await close(4).hover();
  await page.mouse.wheel(0, -1000);
  await expect(close(1)).toBeInViewport({ ratio: 1 });
  await close(1).focus();
  await page.keyboard.press('Escape');
  await expect(close(1)).toHaveCount(0);
  await expect(close(4)).toHaveCount(1);
});

test('文字放大時，鍵盤能將短螢幕堆疊中較早的通知捲入畫面', async ({ page, browserName }) => {
  await page.setViewportSize({ width: 390, height: 448 });
  await load(page, 'light');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addStyleTag({ content: 'html { font-size: 200%; }' });
  await page.evaluate(() => {
    for (let i = 1; i <= 4; i++) {
      window.GlassToast.info(`Notification ${i}`, { persistent: true });
    }
  });
  const firstClose = page.locator('.glass-toast').filter({ hasText: 'Notification 1' })
    .getByRole('button', { name: 'Close', exact: true });
  const previous = page.locator('#other');
  await previous.focus();
  await page.keyboard.press('Tab');
  // macOS WebKit 預設以 Option+Tab 走訪按鈕。
  if (browserName === 'webkit' && !await firstClose.evaluate((el) => document.activeElement === el)) {
    await previous.focus();
    await page.keyboard.press('Alt+Tab');
  }
  await expect(firstClose).toBeFocused();
  await expect(firstClose).toBeInViewport({ ratio: 1 });
  await page.keyboard.press('Escape');
  await expect(firstClose).toHaveCount(0);
});

test('原生 modal 內的通知可宣告與操作，關閉 modal 不會留下舊通知', async ({ page }) => {
  await load(page, 'light');
  await page.evaluate(() => {
    const dialog = document.createElement('dialog');
    dialog.setAttribute('aria-label', 'Upload');
    const submit = document.createElement('button');
    submit.textContent = 'Submit';
    dialog.append(submit);
    document.body.append(dialog);
    window.GlassToast.info('Outside notification', { persistent: true });
    dialog.showModal();
    submit.focus();
    window.GlassToast.error('Upload failed', {
      dialog,
      action: { label: 'Retry', onClick() { submit.textContent = 'Retried'; } },
    });
  });
  const dialog = page.getByRole('dialog', { name: 'Upload' });
  await expect(dialog.getByRole('alert')).toHaveText('Upload failed');
  const retry = dialog.getByRole('button', { name: 'Retry' });
  await retry.focus();
  await expect(retry).toBeFocused();
  await retry.click({ trial: true });
  await retry.press('Enter');
  await expect(dialog.getByRole('button', { name: 'Retried' })).toBeFocused();
  await page.evaluate(() => {
    const dialog = document.querySelector('dialog');
    window.GlassToast.error('Unsaved', { dialog, persistent: true });
    dialog.close();
  });
  await expect(page.locator('dialog .glass-toast')).toHaveCount(0);
  await expect(page.locator('body > [data-toast-container] .glass-toast')).toHaveText('Outside notification');
  await page.locator('dialog').evaluate((el) => el.showModal());
  await expect(dialog.getByText('Unsaved')).toHaveCount(0);
});
