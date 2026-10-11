// @vitest-environment jsdom
// 文件頁覆蓋率守門：公開 API、選項、CSS 變數一律從原始碼掃出來，
// 逐一確認 docs/index.html 有對應的 [data-doc] 條目。新增 API 卻沒寫文件時這裡會紅。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// 不用 new URL(`…${path}`, import.meta.url)：Vite 會把這個寫法當成資產引用改寫掉
const read = (path) => readFileSync(resolve(import.meta.dirname, '..', path), 'utf8');

const docs = new DOMParser().parseFromString(read('docs/index.html'), 'text/html');
const toastSrc = read('src/toast.js');
const cssSrc = read('src/styles.css');

const missingIn = (keys) => keys.filter((key) => !docs.querySelector(`[data-doc="${key}"]`));

// 掃描結果為空代表原始碼格式變了、regex 失效，不能當成「全部有寫」
const nonEmpty = (list) => {
  expect(list.length).toBeGreaterThan(0);
  return list;
};

describe('docs 覆蓋率', () => {
  it('每個公開 export 都有 API 條目', async () => {
    const exports = nonEmpty(Object.keys(await import('../src/index.js')));
    expect(missingIn(exports.map((name) => `api:${name}`))).toEqual([]);
  });

  it('show() 的每個選項都有說明', () => {
    const block = toastSrc.match(/@typedef \{Object\} ToastOptions([\s\S]*?)@typedef/)?.[1] ?? '';
    const options = nonEmpty([...block.matchAll(/@property \{[^}]*\} \[(\w+)/g)].map((m) => m[1]));
    expect(missingIn(options.map((name) => `option:${name}`))).toEqual([]);
  });

  it('register() 的每個選項都有說明', () => {
    const options = nonEmpty([...toastSrc.matchAll(/@param \{[^}]*\} \[options\.(\w+)/g)].map((m) => m[1]));
    expect(missingIn(options.map((name) => `register:${name}`))).toEqual([]);
  });

  it('styles.css 宣告或引用的每個 --gt-* 變數都有說明', () => {
    const vars = nonEmpty([...new Set(cssSrc.match(/--gt-[\w-]+/g))]);
    expect(missingIn(vars.map((name) => `var:${name}`))).toEqual([]);
  });
});
