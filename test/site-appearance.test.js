// 文件站的外觀 / 背景選擇要跨頁（文件 ↔ Demo）與重新載入保留。
// 直接用真正的 head / topbar partial 組頁面，在 jsdom 裡跑 head 的 inline script。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';

const read = (path) => readFileSync(resolve(import.meta.dirname, '..', path), 'utf8');
const PAGE = `<!doctype html><html data-backdrop="aurora"><head>${read('docs/partials/head.html')}</head>`
  + `<body>${read('docs/partials/topbar.html')}</body></html>`;

/** 載入一頁並等到 DOMContentLoaded；storage 帶入上一頁留下的 localStorage 內容（模擬換頁 / 重新載入） */
async function load(storage = {}) {
  const dom = new JSDOM(PAGE, {
    url: 'https://docs.example/',
    runScripts: 'dangerously',
    beforeParse(window) {
      for (const [key, value] of Object.entries(storage)) window.localStorage.setItem(key, value);
    },
  });
  const { document, localStorage } = dom.window;
  if (document.readyState === 'loading') {
    await new Promise((done) => document.addEventListener('DOMContentLoaded', done));
  }
  return {
    root: document.documentElement,
    checked: (name) => document.querySelector(`input[name="${name}"]:checked`).value,
    choose(name, value) {
      const radio = document.querySelector(`input[name="${name}"][value="${value}"]`);
      radio.checked = true;
      radio.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    },
    storage: () => Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)])),
  };
}

describe('文件站外觀選擇的保留', () => {
  it('選過的外觀與背景，換頁後在繪製前就套用，選單也同步勾選', async () => {
    const first = await load();
    first.choose('theme', 'dark');
    first.choose('backdrop', 'photo');

    const next = await load(first.storage());
    expect(next.root.dataset.theme).toBe('dark');
    expect(next.root.dataset.backdrop).toBe('photo');
    expect(next.checked('theme')).toBe('dark');
    expect(next.checked('backdrop')).toBe('photo');
  });

  it('選回「系統」後換頁，不帶 data-theme（跟隨系統偏好）', async () => {
    const first = await load();
    first.choose('theme', 'light');
    first.choose('theme', 'system');

    const next = await load(first.storage());
    expect(next.root.dataset.theme).toBeUndefined();
    expect(next.checked('theme')).toBe('system');
  });

  it('從沒選過時維持預設', async () => {
    const page = await load();
    expect(page.root.dataset.theme).toBeUndefined();
    expect(page.root.dataset.backdrop).toBe('aurora');
    expect(page.checked('theme')).toBe('system');
  });

  it('儲存的資料損毀時退回預設，不丟錯', async () => {
    const first = await load();
    first.choose('backdrop', 'photo');
    const corrupted = Object.fromEntries(Object.keys(first.storage()).map((k) => [k, '{oops']));
    expect(Object.keys(corrupted)).not.toHaveLength(0); // 確實有東西可以弄壞

    const page = await load(corrupted);
    expect(page.root.dataset.backdrop).toBe('aurora');
    expect(page.checked('backdrop')).toBe('aurora');
  });
});
