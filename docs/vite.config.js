import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import pkg from '../package.json' with { type: 'json' };

// 文件站設定：`vite docs` 以 docs/ 為 root 會自動讀這支。
// 套件本體的 build 走根目錄的 vite.config.js，兩者互不影響。
//
// 注意：文件站與套件共用根目錄 package.json，其 sideEffects 白名單必須包含
// "./docs/**"，否則 build 時頁面腳本會被當成無副作用整段 tree-shake 掉。

const ROOT = import.meta.dirname;
const PARTIALS_DIR = resolve(ROOT, 'partials');

// 頁面一律平放在 docs/ 根目錄（<name>.html），partial 裡的站內連結因此都寫 ./ 即可；
// 導覽連結以 data-page 對應檔名
const PAGES = ['index', 'demo'];

// 套件後設資料統一來自 package.json，HTML 以 Vite 內建的 %KEY% 語法取用
const SITE_ENV = {
  PKG_NAME: pkg.name,
  PKG_SPEC: `${pkg.name}@${pkg.version}`,
  PKG_SHORT_NAME: pkg.name.split('/').pop(),
  PKG_VERSION: pkg.version,
  PKG_LICENSE: pkg.license,
  PKG_AUTHOR: pkg.author,
  PKG_REPO: pkg.repository.url.replace(/^git\+/, '').replace(/\.git$/, ''),
};

/**
 * `<!-- partial:name -->` 換成 partials/name.html，並替目前頁面的導覽連結
 * （data-page 與檔名相同者）補上 aria-current。order: 'pre' 讓插入的內容
 * 也吃得到後面 Vite 內建的 %KEY% 替換。
 */
function htmlPartials() {
  return {
    name: 'docs:html-partials',
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        const page = basename(ctx.filename, '.html');
        return html
          .replace(/<!--\s*partial:([\w-]+)\s*-->/g, (_, name) =>
            readFileSync(resolve(PARTIALS_DIR, `${name}.html`), 'utf8'))
          .replace(`data-page="${page}"`, `data-page="${page}" aria-current="page"`);
      },
    },
    // partial 不在模組圖裡，改了要手動通知整頁重載
    configureServer(server) {
      server.watcher.on('change', (file) => {
        if (file.startsWith(PARTIALS_DIR)) server.ws.send({ type: 'full-reload' });
      });
    },
  };
}

export default defineConfig({
  base: './', // 相對路徑：部署到任何子路徑（如 GitHub Pages）都不用改
  define: Object.fromEntries(
    Object.entries(SITE_ENV).map(([key, value]) => [`import.meta.env.${key}`, JSON.stringify(value)]),
  ),
  plugins: [htmlPartials()],
  build: {
    outDir: '../dist-docs',
    emptyOutDir: true,
    // CSS 變數表直接讀 computed style；壓縮會把 rgba(255, 255, 255, 0.8)
    // 改寫成 #fffc，數值相同但讀者看不懂。站台 CSS 才十幾 KB，不壓縮換可讀性
    cssMinify: false,
    rolldownOptions: {
      input: Object.fromEntries(PAGES.map((page) => [page, resolve(ROOT, `${page}.html`)])),
    },
  },
});
