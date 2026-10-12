// dist/*.d.cts：給 require 條件用的型別。內容與 tsc 產出的 .d.ts 相同，
// 只把相對 import 的 ./x.js 改成 ./x.cjs，讓 TypeScript 在 CJS 情境下
// 一路解析到 .d.cts（package.json 有 "type": "module"，.d.ts 一律被視為 ESM）
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';

const dist = new URL('../dist/', import.meta.url);
const files = readdirSync(dist).filter((name) => name.endsWith('.d.ts'));

for (const name of files) {
  const source = readFileSync(new URL(name, dist), 'utf8');
  const cts = source.replace(/(from\s+["']\.\/[^"']+)\.js(["'])/g, '$1.cjs$2');
  writeFileSync(new URL(name.replace(/\.d\.ts$/, '.d.cts'), dist), cts);
}

console.log(`dist/*.d.cts — ${files.length} files`);
