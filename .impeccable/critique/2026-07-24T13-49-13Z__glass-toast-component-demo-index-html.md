---
target: 審視套件有沒有什麼建議 (glass-toast component)
total_score: 31
p0_count: 0
p1_count: 2
timestamp: 2026-07-24T13-49-13Z
slug: glass-toast-component-demo-index-html
---
Method: dual-agent (A: design-review ✓ 獨立子代理 · B: detector 於主流程確定性補跑 — 子代理觸及 session 限制被截斷；瀏覽器渲染 → 靜態 fallback，Playwright 未安裝)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | 倒數條/glow/aria-live 齊全，但 hover 暫停無提示、reduced-motion 失去倒數條 |
| 2 | Match System / Real World | 4 | 語意色 + Heroicons 完全符合慣例 |
| 3 | User Control and Freedom | 3 | 有關閉/hover 暫停/dismissAll，但無 Esc、無鍵盤暫停、無 undo |
| 4 | Consistency and Standards | 3 | dark 深色關閉鈕浮白卡；role=alert + aria-live=polite 語意衝突；進場 500ms 超產品慣例 |
| 5 | Error Prevention | 3 | textContent 防注入佳；dismissAll 預設靜音是陷阱 |
| 6 | Recognition Rather Than Recall | 3 | 圖示+色可辨；hover 暫停與 dismissAll 副作用靠記憶 |
| 7 | Flexibility and Efficiency | 3 | 三入口/變數主題靈活；無 action/id/update/promise/鍵盤加速 |
| 8 | Aesthetic and Minimalist Design | 3 | toast 乾淨；1400ms glow 偏久、平底背景 glass 白做、warning 對比弱 |
| 9 | Error Recovery | 2 | error 同 success 5.5s 消失、無 retry/action、消失後無法重讀 — 最弱環節 |
| 10 | Help and Documentation | 4 | README 極完整 |
| **Total** | | **31/40** | **Good（體質扎實，需補弱項）** |

## Anti-Patterns Verdict

**LLM 評估**：不會被立刻看穿是 AI 產物。textContent 防注入、非法值 fallback、@supports 退不透明底、reduced-motion 全降級、SPA isConnected 重建、--gt-* 變數不污染 :root、dark 用 :where() 壓零 specificity — 都是一線庫級別的細節。唯一命中的絕對禁令是「glassmorphism 作為預設」，但這是產品存在理由且有 fallback，屬目的性使用，放行。

**確定性掃描（detector）**：`demo/index.html` 命中 2 筆 warning — `overused-font`(Inter, line 15) 與 `single-font`。兩者都在 **demo 開發頁**，對函式庫本身屬**誤報**（元件不帶自有字型、繼承宿主）。但點出 demo 作為發布櫥窗過於樸素。

**瀏覽器佐證**：Playwright 未安裝，無實際渲染截圖。靜態 fallback 確認 dist 產物含 @supports fallback、:where() dark、prefers-color-scheme 三段特性，8 個發佈檔齊全。**無 user-visible overlay。**

## Overall Impression

工程用心遠高於平均，可信度基石（安全/韌性/主題 DX）做得非常好，README 是最強資產。最大機會不在視覺而在**錯誤時刻的行為**與**無障礙暫停/鍵盤路徑**：error 與 success 同樣 5.5s 蒸發、且只有 hover 能暫停（觸控/鍵盤完全無暫停），是與一線 toast 庫的關鍵差距，也是公開發布前最該補的洞。

## What's Working

1. **安全預設 + 韌性 fallback**：textContent 強制、非法值靜默 fallback、@supports 退不透明底、reduced-motion 全降級、SPA isConnected 重建 + head.prepend 保 cascade。公開包最該做對的都做了。
2. **主題系統 DX 教科書級**：--gt-* scope 在 .glass-toast；dark 用 :where() 壓零 specificity，消費端覆蓋永不需比權重。
3. **退場坍縮回流**：讀 offsetHeight 觸發 layout commit → height:0 + 負 marginTop 抵消 gap，堆疊平滑上移不 jump。

## Priority Issues

**[P1] 錯誤 toast 自動消失且無 action affordance**
Why：高風險訊息在使用者反應前蒸發、無法重讀/重試，情緒曲線最大谷，與一線庫關鍵功能差距。
Fix：error 變體預設 persistent 或大幅拉長 duration；API 增 `action: { label, onClick }` 渲染成 toast 內按鈕（順帶解鍵盤可達性）。

**[P1] 自動消失只在 hover 暫停，鍵盤/觸控/焦點無法暫停（WCAG 2.2.1）**
Why：鍵盤/SR 使用者與所有手機使用者被 5.5s 硬倒數綁死；焦點在關閉鈕時 timer 觸發移除還會丟焦點。
Fix：加 focusin/focusout 走與 hover 相同暫停/恢復；Esc 關閉聚焦中 toast；移除前 focus return。

**[P2] Warning 圖示對比未達 3:1，暖色三變體全部貼線**
Why：amber-600 #dd7400 on amber-100 #fef3c6 ≈ 2.9:1（未過 3:1）；success ≈3.3、error ≈3.1 勉強過；info ≈5.8 舒適。低視力難辨變體語意。
Fix：warning icon 加深到 amber-700 #b45309（dark 態已用此值）；success/error 各加深一階。

**[P2] Dark mode 是刺眼白卡且丟失毛玻璃身分**
Why：dark 外殼 rgba(255,255,255,0.96) 近不透明 + 黑字，在深色頁是高亮白卡、blur 幾乎不可見；深色圓鈕浮白卡像 bug。
Fix：改真正的「深色毛玻璃」（低亮度半透明底 + 淺字），關閉鈕與外殼同色系。

**[P2] dismissAll() 預設靜音後續是開發者陷阱**
Why：方法名「清空」副作用卻是「永久靜音」到 resume()/重載，SPA 不重載易讓後續 toast 全消失且無報錯。
Fix：預設反轉為 suppress:false，或拆成 dismissAll() 與 suppressUntilReload() 兩明確方法；suppress 生效時 console.warn 一次。

## Persona Red Flags

**Sam（無障礙）**：自動消失只 hover 暫停（WCAG 2.2.1）；role=alert 卻覆寫 aria-live=polite 語意衝突（polite 類應改 role=status）；無 Esc、timer 移除丟焦點無 return；warning ≈2.9:1；reduced-motion 讓倒數條瞬間歸零。

**Riley（壓力測試）**：無同時 toast 數量上限，連續呼叫無限堆疊溢出；dismissAll 預設靜音無提示；超長字串無 line-clamp/max-height；duration:0 無法表達「不消失」與 persistent 語意重疊。

**Casey（行動）**：關閉鈕 36px（手機）/28px（桌機）未達 44px；觸控無 hover ⇒ 手機完全無暫停；無 swipe-to-dismiss；toast 與關閉鈕遠離拇指區。

## Minor Observations

- 容器 z-index:200 偏低，易被 app modal（1000+）蓋住。
- 新 toast appendChild 到末端，部分使用者預期新訊息最靠錨點。
- Demo 純色 #f9fafb 背景，backdrop-filter 背後無內容可模糊，招牌毛玻璃在櫥窗看不出來（發布前最該修的行銷面）。
- 進/退場 500ms 略慢於產品慣例 150–250ms。
- 缺 toast id/update/promise 類 API（相對一線庫的差距，雖屬刻意精簡）。
- Focus ring #6f92ad 對白底 ≈3.3:1 勉強過、無 offset。
- 玻璃底 rgba(255,255,255,.8) 疊在作者無法控制的頁面背景：純白 ≈7.3:1、純黑降到 ≈4.7:1，中亮度雜訊背景可能跌破 4.5:1（body 對比背景相依）。
- Detector 的 Inter/single-font 屬 demo 誤報，非元件問題。

## Questions to Consider

- 錯誤（assertive、高風險）真的該和成功一樣 5.5s 蒸發嗎？error 預設 persistent + action/retry 會不會才是「值得信任」的分水嶺？
- Dark mode 近純白卡片是刻意，還是把玻璃身分連同夜間眩光一起犧牲了？
- 毛玻璃在平色背景上等於白做：對作者無法掌控背後畫面的通知元件，glassmorphism 該是核心賣點，還是可關的加分項？
