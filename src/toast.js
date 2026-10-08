// ---------------------------------------------------------------------------
// glass-toast 核心 — 純 JS 生成，惰性容器，零相依
// ---------------------------------------------------------------------------

import { ICONS } from './icons.js';
import cssText from './styles.css?inline';

/**
 * @typedef {'success' | 'error' | 'warning' | 'info'} ToastType
 * @typedef {'top-right' | 'bottom-right' | 'bottom-center'} ToastPosition
 *
 * @typedef {Object} ToastAction
 * @property {string} label 按鈕文字
 * @property {() => void} onClick 點擊後執行（執行完自動 dismiss）
 *
 * @typedef {Object} ToastOptions
 * @property {ToastType} [type='info'] 變體
 * @property {ToastPosition} [position='top-right'] 顯示位置
 * @property {boolean} [persistent=false] true 時不自動消失、無進度條
 * @property {number} [duration] 自動消失毫秒數（未指定時 error 為 10000、其餘 5500）；
 *   ≤ 0 視為 persistent
 * @property {ToastAction} [action] 內嵌操作按鈕（如「重試」）；未顯式給 duration 時預設 persistent
 *
 * @typedef {Object} ToastApi
 * @property {typeof show} show
 * @property {typeof success} success
 * @property {typeof error} error
 * @property {typeof warning} warning
 * @property {typeof info} info
 * @property {typeof dismissAll} dismissAll
 * @property {typeof resume} resume
 */

const TOAST_ANIM_MS = 280;       // 對齊 .glass-toast--animated 的 transition duration
const TOAST_STACK_GAP_PX = 12;   // 對齊容器 gap（0.75rem）
const GLOW_DURATION_MS = 1400;   // 進場 glow ring 脈衝時長

// 每變體預設自動消失毫秒；error 停留更久供閱讀，其餘走 fallback
const DEFAULT_DURATION_MS = { error: 10000 };
const FALLBACK_DURATION_MS = 5500;

// 同一位置同時可見的 toast 上限；超過則先關掉最舊的，避免無限堆疊溢出視窗
const MAX_VISIBLE_PER_POSITION = 4;

const DEFAULT_TYPE = 'info';
const DEFAULT_POSITION = 'top-right';

// role + aria-live 等級 + glow ring RGB 後備值：
//   role="alert"（隱含 assertive）僅給 error；其餘用 role="status"（隱含 polite），
//   避免 role 與 aria-live 語意衝突。
// ringRgb 後備供 jsdom / 極舊瀏覽器：getComputedStyle 不解析自訂屬性時（回空字串）
// el.animate 仍要有色可用。
const VARIANTS = {
  success: { role: 'status', live: 'polite',    ringRgb: '16, 185, 129' },
  error:   { role: 'alert',  live: 'assertive', ringRgb: '239, 68, 68'  },
  warning: { role: 'status', live: 'polite',    ringRgb: '245, 158, 11' },
  info:    { role: 'status', live: 'polite',    ringRgb: '76, 112, 144' },
};

const POSITION_CLASS = {
  'top-right':     'glass-toast-container--top-right',
  'bottom-right':  'glass-toast-container--bottom-right',
  'bottom-center': 'glass-toast-container--bottom-center',
};

// 需與 styles.css 的 --gt-shadow 同值；glow ring 把脈衝疊在 base shadow 上，
// CSS 變數讀不到時退這份字面值，避免動畫期間丟失原陰影
const TOAST_BASE_SHADOW = '0 4px 24px -4px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)';

// --- 樣式注入 ---

let autoInjectStyles = true;

/**
 * 確保套件樣式已載入（冪等；SSR 無 document 時 no-op）。
 * 顯式 import style.css 的專案可在自己的 <link> / <style> 加 data-glass-toast
 * 屬性讓本函式跳過注入，或呼叫 register({ injectStyles: false }) 全面停用。
 */
export function ensureStyles() {
  if (typeof document === 'undefined') return;
  if (document.querySelector('style[data-glass-toast], link[data-glass-toast]')) return;

  const style = document.createElement('style');
  style.setAttribute('data-glass-toast', '');
  style.textContent = cssText;
  // prepend 讓消費端 stylesheet（含 --gt-* 變數覆蓋）排在本套件之後而勝出；
  // 注入 <head> 而非 <body>，避開 Astro ViewTransitions 等 SPA 的 body swap
  document.head.prepend(style);
}

// --- Media query 偵測 ---

const prefersReducedMotion = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// --- 惰性容器快取 ---

const containerMap = new Map();

// dismissAll() 後鎖住新的 toast；頁面重載後 module 重建會自動歸零，
// SPA 不重載時用 resume() 解鎖
let suppressed = false;

function getContainer(position) {
  // SPA 換頁（如 Astro ViewTransitions）會替換 body 內容，cached container
  // 會被卸下；用 isConnected 判斷後重建
  const cached = containerMap.get(position);
  if (cached && cached.isConnected) return cached;

  const el = document.createElement('div');
  el.className = `glass-toast-container ${POSITION_CLASS[position]}`;
  el.dataset.toastContainer = position;
  document.body.appendChild(el);
  containerMap.set(position, el);
  return el;
}

// 數量上限：加入新 toast 前，把最舊的（非退場中）關到剩 MAX-1，加完剛好 MAX
function enforceCap(container) {
  const live = [...container.children].filter((c) => !c.dataset.dismissing);
  while (live.length >= MAX_VISIBLE_PER_POSITION) {
    const oldest = live.shift();
    if (typeof oldest.__dismiss === 'function') oldest.__dismiss();
    else oldest.remove();
  }
}

// --- 焦點交還 ---
// toast 移除時若焦點還在其中（鍵盤使用者停在關閉/action 鈕），把焦點交還
// 觸發者，否則交給任一仍存在的 toast 關閉鈕，避免焦點掉回 body 頂端
function restoreFocus(invoker) {
  if (invoker && invoker.isConnected && typeof invoker.focus === 'function') {
    invoker.focus();
    return;
  }
  const nextBtn = document.querySelector('.glass-toast__close');
  if (nextBtn) nextBtn.focus();
}

// --- 建立 Toast DOM ---

function createToastEl(message, { type, position, persistent, duration, action }) {
  const variant = VARIANTS[type];
  const noMotion = prefersReducedMotion();

  // 外殼：毛玻璃 + 多層陰影；進場隱藏態 --enter 帶位移（軸向由 data-position
  // 決定）、reduced motion 用 --faded 純淡入
  const el = document.createElement('div');
  el.setAttribute('role', variant.role);
  el.setAttribute('aria-live', variant.live);
  el.dataset.position = position;
  el.className = [
    'glass-toast',
    `glass-toast--${type}`,
    noMotion ? 'glass-toast--faded' : 'glass-toast--animated glass-toast--enter',
  ].join(' ');

  // 圖示：彩色藥丸底
  const iconWrap = document.createElement('span');
  iconWrap.className = 'glass-toast__icon';
  iconWrap.innerHTML = ICONS[type];

  // 訊息文字（textContent，不經 HTML）
  const msg = document.createElement('p');
  msg.className = 'glass-toast__message';
  msg.textContent = message;

  el.append(iconWrap, msg);

  // 可選 action 按鈕（label 走 textContent，安全）
  let actionBtn = null;
  if (action && action.label) {
    actionBtn = document.createElement('button');
    actionBtn.type = 'button';
    actionBtn.className = 'glass-toast__action';
    actionBtn.textContent = action.label;
    el.appendChild(actionBtn);
  }

  // 關閉按鈕：in-flow、靠右、圓形帶圈
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'glass-toast__close';
  btn.setAttribute('aria-label', '關閉通知');
  btn.innerHTML = ICONS.close;
  el.appendChild(btn);

  // 倒數進度條（非 persistent）
  if (!persistent) {
    const bar = document.createElement('div');
    bar.className = 'glass-toast__bar';
    bar.style.width = '100%';
    // 進度條在 reduced motion 下仍保留（線性寬度是時間指示，非位移動畫），
    // 讓非動態使用者也看得到剩餘時間
    bar.style.transition = `width ${duration}ms linear`;

    el.appendChild(bar);

    // 下一幀啟動進度條動畫
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        bar.style.width = '0%';
      });
    });
  }

  return { el, btn, actionBtn };
}

// --- 進場 glow ring 脈衝 ---
// 直接 animate toast 本身的 box-shadow（疊在 base shadow 上）；
// 不用獨立 ring element，避免被外殼 overflow-hidden 切掉

function playGlowRing(el, type) {
  if (prefersReducedMotion()) return;
  if (typeof el.animate !== 'function') return;

  // ring RGB / base shadow 優先讀 CSS 變數（消費端可覆蓋），讀不到退 JS 常數；
  // RGB 三元組正規化為「R, G, B」，避免 CSS minify 壓掉空白造成輸出漂移
  const styles = getComputedStyle(el);
  const ringRgb =
    styles.getPropertyValue('--gt-ring').trim().replace(/\s*,\s*/g, ', ') ||
    VARIANTS[type].ringRgb;
  const baseShadow = styles.getPropertyValue('--gt-shadow').trim() || TOAST_BASE_SHADOW;

  // 用 blur radius 讓邊界羽化，spread 較小避免硬邊；起點亮終點淡
  // 中段 offset 0.35 維持近似亮度，營造「保留」感後再淡出
  el.animate(
    [
      { boxShadow: `0 0 18px 6px rgba(${ringRgb}, 0.75), ${baseShadow}`, offset: 0 },
      { boxShadow: `0 0 22px 8px rgba(${ringRgb}, 0.7), ${baseShadow}`,  offset: 0.35 },
      { boxShadow: `0 0 56px 26px rgba(${ringRgb}, 0), ${baseShadow}`,   offset: 1 },
    ],
    { duration: GLOW_DURATION_MS, easing: 'ease-out', fill: 'none' }
  );
}

// --- Dismiss ---

function removeAndCleanup(el, position) {
  el.remove();
  const container = containerMap.get(position);
  if (container && container.children.length === 0) {
    container.remove();
    containerMap.delete(position);
  }
}

function dismissToast(el, position, invoker) {
  if (el.dataset.dismissing) return;
  el.dataset.dismissing = 'true';

  // 移除前記錄焦點是否還在 toast 內，移除後才好交還
  const hadFocus = el.contains(document.activeElement);
  const finish = () => {
    removeAndCleanup(el, position);
    if (hadFocus) restoreFocus(invoker);
  };

  if (prefersReducedMotion()) {
    el.classList.add('glass-toast--faded');
    setTimeout(finish, TOAST_ANIM_MS);
    return;
  }

  // 退場改 ease-in（進場的 ease-out 在 --animated 裡設定）
  el.classList.add('glass-toast--leaving');

  // 同時坍縮 height/padding/border + marginTop 抵消父 gap，
  // 讓堆疊中下方 toast 順滑往上、且 remove 後不會再 jump 12px
  const startHeight = el.offsetHeight; // read 觸發 layout commit
  el.style.height = `${startHeight}px`;
  void el.offsetHeight;                // 強迫瀏覽器把上一行 commit 為 transition 起點

  el.classList.add('glass-toast--enter');
  el.style.height = '0px';
  el.style.paddingTop = '0';
  el.style.paddingBottom = '0';
  el.style.borderTopWidth = '0';
  el.style.borderBottomWidth = '0';
  el.style.marginTop = `-${TOAST_STACK_GAP_PX}px`;

  setTimeout(finish, TOAST_ANIM_MS);
}

// --- 主入口 ---

/**
 * 顯示一則 toast。
 * @param {string} message 訊息文字
 * @param {ToastOptions} [options]
 * @returns {() => void} 手動 dismiss 函式
 */
export function show(message, options = {}) {
  if (suppressed) return () => {};

  let {
    type = DEFAULT_TYPE,
    position = DEFAULT_POSITION,
    persistent = false,
    action,
  } = options;

  if (!VARIANTS[type]) type = DEFAULT_TYPE;
  if (!POSITION_CLASS[position]) position = DEFAULT_POSITION;

  // duration 未指定 → 變體預設（error 停留更久）
  const durationGiven = options.duration !== undefined;
  let duration = durationGiven
    ? options.duration
    : (DEFAULT_DURATION_MS[type] ?? FALLBACK_DURATION_MS);

  // 有 action 需使用者操作、或 duration ≤ 0（語意：不自動消失）→ 視為 persistent
  if ((action && action.label && !durationGiven) || duration <= 0) persistent = true;

  if (autoInjectStyles) ensureStyles(); // SPA swap 可能拔掉注入的 <style>，每次 cheap re-check

  const container = getContainer(position);
  enforceCap(container); // 數量上限：加入前先關掉超量的最舊 toast

  const { el, btn, actionBtn } = createToastEl(message, { type, position, persistent, duration, action });

  // 記錄觸發者，dismiss 後把焦點交還（若焦點曾停在 toast 內）
  const invoker = typeof document !== 'undefined' ? document.activeElement : null;

  container.appendChild(el);

  // 觸發進場動畫（reduced motion 時僅淡入，不位移）
  // double RAF：第一幀讓 initial state（--enter / --faded）被瀏覽器 commit，
  // 第二幀 remove class 才會觸發 transition；single RAF 在某些時序下會直接跳到終態
  const enterClass = prefersReducedMotion() ? 'glass-toast--faded' : 'glass-toast--enter';
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      el.classList.remove(enterClass);
      playGlowRing(el, type);
    });
  });

  const dismiss = () => dismissToast(el, position, invoker);
  el.__dismiss = dismiss; // 供 enforceCap 關掉最舊 toast

  // 關閉按鈕
  btn.addEventListener('click', dismiss);

  // action 按鈕：執行 onClick 後 dismiss
  if (actionBtn) {
    actionBtn.addEventListener('click', () => {
      action.onClick?.();
      dismiss();
    });
  }

  // Esc 關閉聚焦中的 toast（keydown 由焦點元素冒泡到 el；不劫持全域 Esc）
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      dismiss();
    }
  });

  // 自動消失 + 暫停（hover 與鍵盤焦點皆暫停，含進度條同步；WCAG 2.2.1）
  if (!persistent) {
    const bar = el.querySelector('.glass-toast__bar');
    let remaining = duration;
    let startTime = Date.now();
    let timerId = setTimeout(dismiss, remaining);
    let paused = false;
    let hovered = false;
    let focused = false;

    const pause = () => {
      if (paused) return;
      paused = true;
      clearTimeout(timerId);
      remaining -= Date.now() - startTime;
      if (bar) {
        const currentWidth = bar.getBoundingClientRect().width;
        bar.style.transition = 'none';
        bar.style.width = `${currentWidth}px`;
      }
    };

    const resumeTimer = () => {
      if (!paused) return;
      paused = false;
      if (remaining <= 0) { dismiss(); return; }
      startTime = Date.now();
      timerId = setTimeout(dismiss, remaining);
      if (bar) {
        requestAnimationFrame(() => {
          bar.style.transition = `width ${remaining}ms linear`;
          bar.style.width = '0%';
        });
      }
    };

    // 只有 hover 與焦點都離開才恢復倒數
    const maybeResume = () => { if (!hovered && !focused) resumeTimer(); };

    el.addEventListener('mouseenter', () => { hovered = true; pause(); });
    el.addEventListener('mouseleave', () => { hovered = false; maybeResume(); });
    el.addEventListener('focusin', () => { focused = true; pause(); });
    el.addEventListener('focusout', (e) => {
      // 焦點仍在 toast 內部移動（關閉↔action）不算離開
      if (el.contains(e.relatedTarget)) return;
      focused = false;
      maybeResume();
    });
  }

  return dismiss;
}

/**
 * 清空所有 toast。預設只清空、不影響後續 show()。
 * 若要鎖住後續 show()（供 session 過期硬導航前，避免 redirect 與 unload 之間
 * 閃現新 toast）傳 { suppress: true }；頁面重載後自動解鎖，SPA 不重載時呼叫 resume()。
 * @param {{ suppress?: boolean }} [options]
 */
export function dismissAll({ suppress = false } = {}) {
  if (suppress) suppressed = true;
  for (const container of containerMap.values()) {
    container.remove();
  }
  containerMap.clear();
}

/** 解除 dismissAll() 造成的 show() 靜音鎖 */
export function resume() {
  suppressed = false;
}

// --- 快捷方法 ---

/** @param {string} message @param {Omit<ToastOptions, 'type'>} [options] */
export function success(message, options) { return show(message, { ...options, type: 'success' }); }
/** @param {string} message @param {Omit<ToastOptions, 'type'>} [options] */
export function error(message, options)   { return show(message, { ...options, type: 'error' }); }
/** @param {string} message @param {Omit<ToastOptions, 'type'>} [options] */
export function warning(message, options) { return show(message, { ...options, type: 'warning' }); }
/** @param {string} message @param {Omit<ToastOptions, 'type'>} [options] */
export function info(message, options)    { return show(message, { ...options, type: 'info' }); }

/** @type {ToastApi} */
const api = { show, success, error, warning, info, dismissAll, resume };

// --- 掛載（opt-in） ---

/**
 * 掛載全域 toast + 注入樣式。import '@dennykuo/glass-toast/auto' 等價
 * register() 預設值；只 import 具名 API 的專案不需要呼叫。
 * @param {Object} [options]
 * @param {boolean} [options.global=true] 是否掛 target.toast
 * @param {boolean} [options.injectStyles=true] false 時全面停用自動樣式注入（CSP / 顯式 import style.css 場景）
 * @param {Object} [options.target=window] 全域掛載目標
 * @returns {ToastApi}
 */
export function register({ global = true, injectStyles = true, target } = {}) {
  autoInjectStyles = injectStyles;
  if (injectStyles) ensureStyles();
  if (global) {
    const t = target ?? (typeof window !== 'undefined' ? window : undefined);
    if (t) t.toast = api;
  }
  return api;
}
