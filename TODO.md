# glass-toast 後續工作清單

更新日期：2026-11-14（Asia/Taipei）。文件站已上線，`0.1.1` 的追加修正已在本機驗證。

本清單接續 Polyscope 副本的 `.context/next-steps.md`，供原專案後續開發使用。
歷史紀錄仍保留在原副本；以下狀態以本次核對為準。

## 目前狀態

- 本輪變更接續 `develop` 上從 Polyscope 恢復的 8 個提交。
- 每筆推送的驗證結果見 [develop 的 GitHub Actions](https://github.com/dennykuo/glass-toast/actions?query=branch%3Adevelop)。
- 本機待發布版本為 `0.1.1`，npm 上的 `latest` 仍為 `0.1.0`。
- `0.1.1` 準備變更已收錄於本機 `develop` 和 `main`，待推送。
- 目前正式文件站的部署提交為 `d9b5e12`。
- [GitHub Pages 文件站](https://dennykuo.github.io/glass-toast/) 已上線，發布來源為 GitHub Actions。

## 本輪五項已完成

- [x] **關閉通知時保留使用者已移走的焦點。**
  `src/toast.js` 改在實際移除前判斷焦點是否仍在通知內，避免 280ms 退場期間搶回焦點。
  一般與 reduced motion 的回歸測試均在修正前失敗、修正後通過；正常交還焦點的測試保留。

- [x] **改善 action 文字對比，保留 CSS 變數覆寫能力。**
  深色 action 使用訊息文字色與中性 hover 底色；淺色 error action 使用 red-700，
  修正原有 hover 底色上的對比不足。未變更圖示顏色、版面或公開 API。
  Playwright 測試四種變體的一般、hover、鍵盤焦點狀態，要求至少 4.5:1；
  同時涵蓋 OS 外觀、`data-theme`、`.dark`／`.light` 與宿主 CSS 變數覆寫。
  兩份 README 與文件站已同步說明新的預設值。

- [x] **補強 hover 與鍵盤焦點交錯操作的測試。**
  新增只剩 hover、只剩焦點、action 與關閉鈕間移動焦點的測試。
  於暫存副本把 `!hovered && !focused` 改成 `!hovered || !focused` 後，
  新增的兩個交錯操作測試會失敗；修正前的 84 個測試無法抓到此變異。

- [x] **對齊 develop 的 CI 與 Pages 部署門檻。**
  `main`、`develop` 的 push 與 PR 都由 CI 呼叫 `.github/workflows/checks.yml`。
  lint、單元測試、依賴掃描、Chromium／Firefox／WebKit 測試、套件檢查及文件站建置都成功，
  才會上傳 Pages 產物；部署 job 依賴整個檢查完成，使用同次驗證的產物。
  每次 `main` 只跑一次共用檢查，確認 npm 已有該版本才部署。手動執行也只允許 `main` 部署。Node 版本集中於 `.nvmrc`（24），
  `engines.node` 與工具需求對齊為 `^22.13.0 || >=24.0.0`。
  workflow 通過 actionlint。GitHub 上的結果以各次工作流程執行紀錄為準。

- [x] **更新有通報的開發依賴，掃描降至 0 項。**
  Vite 8.0.14 → 8.3.5、Vitest 4.1.7 → 4.1.12、ESLint 9.39.5 → 10.14.0，
  並更新相關傳遞依賴，包括 Undici 7.30.1、PostCSS 8.5.32、source-map-js 1.2.2。
  原本的 14 項（7 high、7 moderate）已清除；未使用 `npm audit fix --force`。
  新增的 Playwright 僅為開發依賴，套件執行期仍無第三方依賴。

### Minimatch override 的原因與後續維護

ESLint 10 的依賴仍要求 Minimatch 10；
[官方通報 GHSA-g3hv-75wg-m249](https://github.com/isaacs/minimatch/security/advisories/GHSA-g3hv-75wg-m249)
列出的修補版為 11.0.1。因此暫以 `overrides.minimatch: ^11.0.1`，lockfile 鎖定 11.0.3。
已核對 ESLint 使用的 `Minimatch.match` 介面，並確認更新前後選取相同 13 個 lint 檔案、
忽略規則不變，且未定義變數仍會觸發 `no-undef`。README 已記錄這項相容性維護責任。

- [ ] 後續更新 ESLint 時複查 override；上游直接採用修補版後移除。
  若截至 2026-12-01 尚未更新 ESLint，也應複查一次。

## 舊清單已完成

- [x] 文件站與互動 Demo，含公開 API、選項與 CSS 變數的文件覆蓋測試。
- [x] CommonJS 主入口的 `.d.cts`、publint 與 attw 檢查。
- [x] 文件／Demo 跨頁保留外觀與背景，窄螢幕程式碼讓出複製鈕位置。
- [x] `register({ closeLabel })`，預設 `Close`，中文文件站使用「關閉通知」。
- [x] 英文 README 與繁中 README；文件站維持繁體中文。

## 品質檢查補強

- [x] 文件首頁、Demo、外觀初始化和其餘文件站 JavaScript 已納入 ESLint。
  外觀腳本仍在 head 同步執行；Vite 建置後使用相對路徑，支援子目錄部署。
- [x] Chromium、Firefox、WebKit 在 1440px 和 390px 各跑 9 項，共 54 項通過。
  Firefox 與 WebKit 也用這兩種寬度開啟建置後的文件與 Demo，確認深色跨頁保留、
  「重試」回呼、子路徑資源載入與 Demo 無水平溢出。
  macOS Safari 26.6.2 另外確認深色跨頁保留、錯誤通知與「重試」回呼。
- [x] Node 22.13.0 完成乾淨安裝、lint、90 項單元測試、建置與套件檢查。
  從 tarball 安裝後，主入口和 `/auto` 均通過 ESM／CommonJS 載入及 TypeScript 型別檢查；
  `/auto` 在無 DOM 時可載入，有 DOM 時會掛載 `window.toast`、注入樣式並可顯示通知。

## 操作驗收

- [x] 開發站伺服器紀錄在 Safari 和 Chromium 首次載入時捕捉到 `GET /favicon.ico` 回傳 404。
  共用 head 已加上分頁圖示。開發站根路徑與建置後的 `/glass-toast/` 子路徑均回傳 200。
- [x] Chromium（Pixel 7 模擬）、WebKit（iPhone 13 模擬）及 Firefox（390px 觸控）各驗證開發版及建置版。
  六組驗證均可觸控關閉與重試，錯誤通知不移走目前焦點，Esc 關閉後交還觸發按鈕。
  一般、錯誤通知分別檢查 `status/polite` 和 `alert/assertive`。
  macOS Safari 開啟 VoiceOver 時，通知文字及「重試」「關閉通知」可在無障礙樹中讀取，且重試可執行。
- [ ] 確認螢幕閱讀器實際朗讀一般通知及錯誤通知。已改用預先建立的朗讀區域，並重新確認 Safari 無障礙樹有通知文字及操作按鈕。這次未取得 macOS VoiceOver 的朗讀內容。
- [ ] 用 iPhone／Android 實機確認通知的觸控、重試、關閉和朗讀（VoiceOver／TalkBack）。
  本次環境未偵測到可用的手機。

## 後續上線工作

1. [x] 確認 `develop` 對應提交的 CI 通過後，快轉合併至 `main`；[main CI](https://github.com/dennykuo/glass-toast/actions/runs/43583615857) 通過。
2. [x] 啟用 GitHub Pages，[Docs 工作流程](https://github.com/dennykuo/glass-toast/actions/runs/43583615849) 部署成功。
   正式首頁與 Demo 回傳 200，Chromium 桌面和 WebKit 390px 均通過資源載入、深色跨頁保留及「重試」操作。
3. [x] `package.json` 的 `homepage` 已指向 GitHub Pages，英文與繁中 README 均已加入文件站與互動 Demo 連結。
4. [x] 準備 `0.1.1` 版本與 CHANGELOG，檢查最終 npm 封裝及型別。
5. [ ] 依舊清單由使用者執行 `npm publish`，再驗證 npm／CDN 實際安裝與載入。若 `main` 的 CI 已因版本未發布略過部署，發布後在 `main` 手動執行 CI，確認線上文件版號、安裝與 CDN 範例一致。

## 本輪驗證紀錄

- Node 24.10.0；以 `npm ci --ignore-scripts` 乾淨重裝成功，lockfile 雜湊未變。
  本次亦使用 Node 22.13.0 驗證最低支援版本，CI 目前使用 Node 24。
- `npm test`：5 個測試檔、90 個測試通過；`npm run lint` 通過。
- `npm run test:browser`：先建置套件，60 項跨瀏覽器測試通過，含 320px 的長操作文字與關閉圖示對比。
  對比測試等待 hover transition 完成後才量測，避免只讀到變色前的一幀。
- `npm run build:docs`、`npm run check:package` 通過；actionlint v1.7.12 通過。
- `npm audit --audit-level=moderate` 與乾淨安裝時的掃描均為 0 項。
- `0.1.1` tarball 含編譯產物、JavaScript 與 CSS 入口的型別、套件資訊、兩份 README、CHANGELOG 及授權。
- 對 tarball 執行 publint 與 attw，另從暫存消費專案驗證 Node 22.13.0 的 ESM／CommonJS 載入、
  TypeScript 5.9 的 Node 與 bundler 模式，以及封裝內瀏覽器 ESM／UMD 與 CSS 的通知顯示和關閉。
  CI 的 `check:package` 會安裝當次 tarball，開啟 `noUncheckedSideEffectImports` 編譯兩份 README 的 CSS 匯入範例。
- 建置後文件／Demo 以 `/glass-toast/` 子路徑提供，在 320／390／768／1440px
  均無水平溢出；深色／背景選擇跨頁保留，未觀察到 JavaScript 錯誤或失敗資源請求。
- attw 沿用原有例外：略過 node10、排除 CSS 入口，忽略 `cjs-resolves-to-esm`。
  `/auto` 保持 ESM，CommonJS 載入另以 Node 22.13.0 實際安裝 tarball 驗證。
