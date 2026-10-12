// 示範站共用腳本（demo + 文件）：外觀 / 背景切換、程式碼高亮與複製、進場動畫。
// import 即生效；各頁只處理自己的互動。
import { register } from '../src/index.js';

// 樣式自動注入 + window.toast；站台是中文介面，關閉鈕的無障礙名稱跟著用中文
export const toast = register({ closeLabel: '關閉通知' });

const html = document.documentElement;
const mqDark = window.matchMedia('(prefers-color-scheme: dark)');

// --- 外觀與背景 ---

const APPEARANCE_EVENT = 'site:appearance';

/** 外觀改變（手動切換或系統偏好變動）時呼叫 fn */
export function onAppearanceChange(fn) {
  document.addEventListener(APPEARANCE_EVENT, fn);
}

const emitAppearance = () => document.dispatchEvent(new Event(APPEARANCE_EVENT));

document.querySelectorAll('input[name="theme"]').forEach((el) => {
  el.addEventListener('change', () => {
    if (el.value === 'system') delete html.dataset.theme;
    else html.dataset.theme = el.value;
    emitAppearance();
  });
});
mqDark.addEventListener('change', emitAppearance);

document.querySelectorAll('input[name="backdrop"]').forEach((el) => {
  el.addEventListener('change', () => { html.dataset.backdrop = el.value; });
});

// --- 程式碼高亮：只處理站上自己寫的範例，全程 textContent，不碰 innerHTML ---

const TOKEN_RE = {
  js: /(?<com>\/\/[^\n]*)|(?<str>'[^']*'|"[^"]*"|`[^`]*`)|(?<kw>\b(?:import|from|export|const|let|await|async|return|new|true|false|undefined|null)\b)|(?<fn>\b[A-Za-z_$][\w$]*(?=\s*\())|(?<num>\b\d+\b)/g,
  css: /(?<com>\/\*[\s\S]*?\*\/)|(?<fn>--[\w-]+)|(?<kw>@[\w-]+)|(?<num>#[\da-fA-F]{3,8}\b|\b\d*\.?\d+(?:rem|px|ms|%)?\b)/g,
};

/** 把 text 依 lang 的 token 規則切成 span 寫進 el；不認得的 lang 原樣輸出 */
export function highlight(el, text, lang = 'js') {
  el.textContent = '';
  const re = TOKEN_RE[lang];
  if (!re) {
    el.textContent = text;
    return;
  }
  let cursor = 0;
  for (const match of text.matchAll(re)) {
    if (match.index > cursor) el.append(text.slice(cursor, match.index));
    const kind = Object.keys(match.groups).find((k) => match.groups[k] !== undefined);
    const span = document.createElement('span');
    span.className = `tok-${kind}`;
    span.textContent = match[0];
    el.append(span);
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) el.append(text.slice(cursor));
}

// --- 複製：用套件自己的通知回報結果，順便示範成功與失敗兩種狀態 ---

async function copy(text, label) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`已複製${label}`);
  } catch {
    toast.error(`無法存取剪貼簿，請手動複製${label}`);
  }
}

// [data-copy-target="id"]：複製該 id 元素的文字；[data-copy-label] 為回報用的名稱
document.querySelectorAll('[data-copy-target]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const target = document.getElementById(btn.dataset.copyTarget);
    copy(target.textContent, btn.dataset.copyLabel ?? '程式碼');
  });
});

// 靜態範例 <pre class="code" data-lang="js"><code>…</code></pre>：
// 上色並補一顆複製鈕，HTML 裡只寫程式碼本身
document.querySelectorAll('pre.code[data-lang]').forEach((pre) => {
  const code = pre.querySelector('code');
  highlight(code, code.textContent, pre.dataset.lang);

  const block = document.createElement('div');
  block.className = 'code-block';
  pre.replaceWith(block);

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn btn--mini code-block__copy';
  btn.setAttribute('aria-label', '複製程式碼');
  btn.textContent = '複製';
  btn.addEventListener('click', () => copy(code.textContent, '程式碼'));

  block.append(pre, btn);
});

// --- 進場（IntersectionObserver，不掛 scroll 監聽） ---

const rises = document.querySelectorAll('.rise');
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('is-in');
      io.unobserve(entry.target);
    }
  }, { threshold: 0.15 });
  rises.forEach((el) => io.observe(el));
} else {
  rises.forEach((el) => el.classList.add('is-in'));
}
