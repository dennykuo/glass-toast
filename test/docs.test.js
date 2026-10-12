// @vitest-environment jsdom
// 文件頁覆蓋率守門：公開 API、選項、CSS 變數一律從原始碼掃出來，
// 逐一確認 docs/index.html 有對應的 [data-doc] 條目。新增 API 卻沒寫文件時這裡會紅。
import { describe, it, expect } from 'vitest';
import { read, publicExports, showOptions, registerOptions, cssVars } from './helpers/api-surface.js';

const docs = new DOMParser().parseFromString(read('docs/index.html'), 'text/html');

const missingIn = (keys) => keys.filter((key) => !docs.querySelector(`[data-doc="${key}"]`));

describe('docs 覆蓋率', () => {
  it('每個公開 export 都有 API 條目', async () => {
    expect(missingIn((await publicExports()).map((name) => `api:${name}`))).toEqual([]);
  });

  it('show() 的每個選項都有說明', () => {
    expect(missingIn(showOptions().map((name) => `option:${name}`))).toEqual([]);
  });

  it('register() 的每個選項都有說明', () => {
    expect(missingIn(registerOptions().map((name) => `register:${name}`))).toEqual([]);
  });

  it('styles.css 宣告或引用的每個 --gt-* 變數都有說明', () => {
    expect(missingIn(cssVars().map((name) => `var:${name}`))).toEqual([]);
  });
});
