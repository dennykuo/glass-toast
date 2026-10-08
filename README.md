# @dennykuo/glass-toast

毛玻璃質感的 toast 通知元件 — vanilla JS、零 runtime 相依、不需要 Tailwind 或任何框架，開箱即用。

- 4 種變體（success / error / warning / info）：彩色圖示藥丸 + 進場 glow ring 脈衝 + 倒數進度條
- 3 個位置（top-right / bottom-right / bottom-center），各自獨立堆疊容器
- 毛玻璃外殼（backdrop-filter + 多層陰影），dismiss 時堆疊平滑坍縮回流
- hover **與鍵盤焦點**皆暫停自動消失（含進度條同步暫停）；`Esc` 關閉聚焦中的 toast、關閉後焦點交還觸發者（WCAG 2.2.1）
- 內建 dark 外觀（**深色毛玻璃 + 淺字**，保留玻璃身分、避免夜間眩光），自動命中 `prefers-color-scheme` / `[data-theme="dark"]` / `.dark` 三種慣例
- `prefers-reduced-motion` 完整降級（純淡入、無位移、無 glow；倒數進度條保留，仍提供時間指示）
- a11y：`role="status"`（一般）/ `role="alert"`（error）+ 對應 `aria-live`（error 為 assertive，其餘 polite），圖示對藥丸底達 ≥3:1 對比
- 內嵌 `action` 按鈕（如「重試」）；error 未指定時停留較久（10s），同位置最多同時 4 則、超量自動收合最舊
- SPA 友善：容器與樣式在 body/head 被替換後自動重建（Astro ViewTransitions 實測）

## 安裝

```bash
npm install @dennykuo/glass-toast
```

## 快速開始

### 1. side-effect 入口（最省事）

```js
import '@dennykuo/glass-toast/auto';

// 樣式已注入、window.toast 已掛載
toast.success('儲存成功');
toast.error('連線失敗', { position: 'bottom-center' });
```

### 2. 具名 import（可 tree-shake、不碰 window）

```js
import { success, show } from '@dennykuo/glass-toast';

success('儲存成功');                 // 首次使用時自動注入樣式
show('自訂', { type: 'warning', duration: 8000 });
```

搭配顯式樣式（正規做法，CSP / SSR 友善）：

```js
import '@dennykuo/glass-toast/style.css';
import { register, success } from '@dennykuo/glass-toast';

register({ global: false, injectStyles: false }); // 停用自動注入
success('儲存成功');
```

### 3. `<script>` 直接引入（UMD，全域 `GlassToast`）

```html
<script src="https://unpkg.com/@dennykuo/glass-toast"></script>
<script>
  GlassToast.register(); // 掛 window.toast + 注入樣式
  toast.info('哈囉');
</script>
```

## API

### `show(message, options?) => dismiss`

回傳手動關閉函式。快捷方法 `success` / `error` / `warning` / `info` 同簽名（省略 `type`）。

| option | 型別 | 預設 | 說明 |
|---|---|---|---|
| `type` | `'success' \| 'error' \| 'warning' \| 'info'` | `'info'` | 變體 |
| `position` | `'top-right' \| 'bottom-right' \| 'bottom-center'` | `'top-right'` | 顯示位置 |
| `persistent` | `boolean` | `false` | `true` 時不自動消失、無進度條 |
| `duration` | `number` | `error` 為 `10000`、其餘 `5500` | 自動消失毫秒數；`≤ 0` 視為 `persistent` |
| `action` | `{ label, onClick }` | — | 內嵌操作按鈕；點擊執行 `onClick` 後自動關閉。未顯式給 `duration` 時預設 `persistent`（需使用者操作） |

訊息走 `textContent`，不解析 HTML，塞什麼字串都安全（`action.label` 亦然）。

```js
import { error } from '@dennykuo/glass-toast';

error('上傳失敗，是否重試？', {
  action: { label: '重試', onClick: () => retryUpload() },
});
```

### `dismissAll(options?)`

清空所有 toast。**預設只清空、不影響後續 `show()`**。若要鎖住後續 toast（供「session 過期 → 硬導航登入頁」情境，避免 redirect 與 unload 之間閃現新 toast）傳 `{ suppress: true }`；整頁重載後自動解鎖，SPA 不重載時用 `resume()` 解鎖：

```js
dismissAll();                   // 只清空（預設）
dismissAll({ suppress: true }); // 清空並鎖住後續 show()（硬導航前）
resume();                       // SPA 不重載時手動解鎖
```

### `register(options?) => api`

掛載全域 + 注入樣式（`/auto` 入口等價於無參數呼叫本函式）。

| option | 預設 | 說明 |
|---|---|---|
| `global` | `true` | 掛 `target.toast` |
| `injectStyles` | `true` | `false` 時全面停用自動樣式注入 |
| `target` | `window` | 全域掛載目標 |

### `ensureStyles()`

冪等注入樣式（`show()` 每次都會 cheap re-check，SPA 換頁把 `<head>` 注入的樣式拔掉也會自我修復）。SSR（無 `document`）為 no-op。

## 樣式客製（CSS 變數）

所有顏色走 `--gt-*` custom properties，scope 在 `.glass-toast` 上、不污染 `:root`。在你的 stylesheet 覆蓋即可：

```css
.glass-toast { --gt-text: #333; --gt-radius: 0.5rem; }
.glass-toast--success { --gt-icon: #0a7d4f; --gt-ring: 10, 125, 79; }
```

| 變數 | 預設（light） | 說明 |
|---|---|---|
| `--gt-bg` | `rgba(255,255,255,.8)` | 外殼底色 |
| `--gt-bg-opaque` | `rgba(255,255,255,.96)` | backdrop-filter 不支援時的後備底色 |
| `--gt-border` | `rgba(229,231,235,.4)` | 外殼邊線 |
| `--gt-text` | `#4a5565` | 訊息文字 |
| `--gt-blur` | `24px` | 毛玻璃模糊半徑 |
| `--gt-radius` | `1rem` | 外殼圓角 |
| `--gt-shadow` | 多層陰影 | 外殼陰影（glow ring 疊加其上） |
| `--gt-close-*` | gray 系 | 關閉鈕 bg / border / text（含 `-hover`） |
| `--gt-focus-ring` | `#2563eb`（dark `#93c5fd`） | 關閉鈕 / action 鈕 focus-visible ring |
| `--gt-action-*` | 承變體色 | action 鈕 bg / border / text（含 `-bg-hover`）；預設透明底 + 變體色字 |
| `--gt-pill-bg` / `--gt-icon` / `--gt-bar` | 依變體 | 圖示藥丸底 / 圖示色 / 進度條色 |
| `--gt-ring` | 依變體 | glow ring 的 `R, G, B` 三元組（餵給 `el.animate()`） |

### Dark 外觀

dark 為**深色毛玻璃**（低亮度半透明底 `rgba(28,28,30,.72)` + 淺字），保留玻璃身分、避免夜間白卡眩光；變體藥丸/圖示沿用 base（淺色亮片 + 700 階圖示在深底上仍清晰），只覆寫外殼、關閉鈕與 focus ring。

以下三種慣例任一成立即套用（頁面明示 `data-theme="light"` / `.light` 時 OS 深色讓路）：

1. `@media (prefers-color-scheme: dark)`
2. `<html data-theme="dark">`
3. `<html class="dark">`（Tailwind 慣例）

dark 覆寫全部走 `:where()` 壓成與 base 相同的 specificity，你的覆蓋規則永遠不需要跟套件比權重。

## CSP / SSR 註記

- 嚴格 CSP（禁 inline `<style>`）：改顯式 `import '@dennykuo/glass-toast/style.css'` + `register({ injectStyles: false })`
- 已自行載入 style.css 且想避免重複注入：在你的 `<link>` / `<style>` 加 `data-glass-toast` 屬性即可被偵測跳過
- SSR：所有入口在無 `document` 環境安全 no-op，`show()` 請在 client 端呼叫

## 開發

```bash
npm run dev     # vite demo（互動 playground：四變體 × 三位置 × 深淺外觀 × 三種背景底圖）
npm test        # vitest + jsdom（58 tests）
npm run lint    # eslint
npm run build   # dist/：ESM + UMD + CSS + .d.ts
```

## License

MIT © Denny
