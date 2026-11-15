// README 覆蓋率守門：英文版（README.md，npm 頁面顯示的那份）與繁中版各自要涵蓋
// 所有公開 API 與選項，並互相連結。只改一份、另一份沒跟上時這裡會紅。
import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { read, publicExports, showOptions, registerOptions } from './helpers/api-surface.js';

const { name: packageName, version } = JSON.parse(read('package.json'));
const READMES = {
  'README.md': 'README.zh-TW.md',
  'README.zh-TW.md': 'README.md',
};

// 以 `name` 或 name( 出現才算有寫到（避免一般英文單字 type、action 誤判）
const mentions = (text, name) => new RegExp(`\`${name}\\b|\\b${name}\\(`).test(text);

describe.each(Object.entries(READMES))('%s', (file, counterpart) => {
  const exists = existsSync(resolve(import.meta.dirname, '..', file));
  const text = exists ? read(file) : '';
  const missing = (names) => names.filter((name) => !mentions(text, name));

  it('檔案存在', () => {
    expect(exists).toBe(true);
  });

  it(`連到另一個語言版本（${counterpart}）`, () => {
    expect(text).toContain(`](${counterpart})`);
  });

  it('安裝與 CDN 範例使用 package.json 的版本', () => {
    const spec = `${packageName}@${version}`;
    expect(text).toContain(`npm install ${spec}\n`);
    expect([...text.matchAll(/<script src="(https:\/\/(?:unpkg\.com\/|cdn\.jsdelivr\.net\/npm\/)[^"]+)">/g)]
      .map(([, url]) => new URL(url).pathname)).toEqual([`/${spec}`, `/npm/${spec}`]);
  });

  it('涵蓋每個公開 export', async () => {
    expect(missing(await publicExports())).toEqual([]);
  });

  it('涵蓋 show() 與 register() 的每個選項', () => {
    expect(missing([...showOptions(), ...registerOptions()])).toEqual([]);
  });
});
