// dist/glass-toast.css：與 ?inline 進 JS 的同一份 src/styles.css，僅 minify
// （-webkit- 前綴已在 source 手寫，不做 prefix 管理避免被目標矩陣移除）
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { transform } from 'lightningcss';

const src = new URL('../src/styles.css', import.meta.url);
const outDir = new URL('../dist/', import.meta.url);
const out = new URL('../dist/glass-toast.css', import.meta.url);

const { code } = transform({
  filename: 'styles.css',
  code: readFileSync(src),
  minify: true,
});

mkdirSync(outDir, { recursive: true });
writeFileSync(out, code);
console.log(`dist/glass-toast.css — ${code.length} bytes`);
