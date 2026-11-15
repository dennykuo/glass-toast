import { copyFileSync, readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const pkg = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'));
// CDN 依副檔名提供 JavaScript MIME，CommonJS 入口仍須使用 .cjs。
for (const entry of new Set([pkg.unpkg, pkg.jsdelivr])) {
  copyFileSync(new URL(pkg.main, root), new URL(entry, root));
}
