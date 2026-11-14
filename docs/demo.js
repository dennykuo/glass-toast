import { toast, highlight, onAppearanceChange } from './site.js';
import { ICONS } from '../src/icons.js';

const MESSAGES = {
  success: '資料已成功儲存，變更即刻生效。',
  error: '連線逾時，請稍後再試一次。',
  warning: '尚有未儲存的變更，離開前請先確認。',
  info: '系統將於今晚 23:00 進行例行維護。',
};

const RETRY_ACTION = { label: '重試', onClick: () => toast.success('已重新送出') };

// --- 目前設定 ---

const checked = (name) => document.querySelector(`input[name="${name}"]:checked`).value;
const durationInput = document.getElementById('duration');
const persistentInput = document.getElementById('persistent');
const actionInput = document.getElementById('action');

function currentOptions() {
  const raw = durationInput.value.trim();
  return {
    position: checked('position'),
    // 留空 = 不傳 duration，讓變體預設生效
    duration: raw === '' ? undefined : Number(raw),
    persistent: persistentInput.checked,
    withAction: actionInput.checked,
  };
}

let lastType = 'success'; // 程式碼區塊顯示的變體，跟著最近一次觸發走

function fire(type) {
  lastType = type;
  const { position, duration, persistent, withAction } = currentOptions();
  toast.show(MESSAGES[type], {
    type,
    position,
    persistent,
    ...(duration === undefined ? {} : { duration }),
    ...(withAction ? { action: RETRY_ACTION } : {}),
  });
  renderSnippet();
}

// --- 程式碼產生（只列出偏離預設的選項，順便把預設值教出來） ---

function buildSnippet() {
  const { position, duration, persistent, withAction } = currentOptions();
  const entries = [];
  if (position !== 'top-right') entries.push(`  position: '${position}',`);
  if (duration !== undefined && !Number.isNaN(duration)) entries.push(`  duration: ${duration},`);
  if (persistent) entries.push('  persistent: true,');
  if (withAction) entries.push("  action: { label: '重試', onClick: () => retryUpload() },");

  const head = [
    `import { register } from '${import.meta.env.PKG_NAME}';`,
    '',
    'const toast = register();',
    '',
  ];
  const call = entries.length
    ? [`toast.${lastType}('${MESSAGES[lastType]}', {`, ...entries, '});']
    : [`toast.${lastType}('${MESSAGES[lastType]}');`];

  return [...head, ...call].join('\n');
}

const snippetEl = document.getElementById('snippet');
const renderSnippet = () => highlight(snippetEl, buildSnippet());

// --- Hero 樣張：用套件實際的 class 與圖示組出真元件，不是仿造截圖 ---

function sampleToast(type, message, actionLabel) {
  const el = document.createElement('div');
  el.className = `glass-toast glass-toast--${type}`;
  el.dataset.position = 'top-right';

  const icon = document.createElement('span');
  icon.className = 'glass-toast__icon';
  icon.innerHTML = ICONS[type];

  const msg = document.createElement('p');
  msg.className = 'glass-toast__message';
  msg.textContent = message;

  el.append(icon, msg);

  if (actionLabel) {
    const action = document.createElement('button');
    action.type = 'button';
    action.className = 'glass-toast__action';
    action.tabIndex = -1;
    action.textContent = actionLabel;
    el.append(action);
  }

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'glass-toast__close';
  close.tabIndex = -1;
  close.innerHTML = ICONS.close;
  el.append(close);

  return el;
}

// 樣張文字刻意與 MESSAGES 不同：真通知飄到附近時才不會看起來像重複渲染
document.getElementById('sample').append(
  sampleToast('success', '設定已同步到所有裝置。'),
  sampleToast('error', '上傳失敗，是否重試？', '重試'),
);

// --- 事件 ---

document.querySelectorAll('[data-type]').forEach((btn) => {
  btn.addEventListener('click', () => fire(btn.dataset.type));
});

document.getElementById('hero-try').addEventListener('click', () => fire('success'));

document.getElementById('burst').addEventListener('click', () => {
  for (const type of ['success', 'error', 'warning', 'info']) fire(type);
});

document.getElementById('dismiss-all').addEventListener('click', () => toast.dismissAll());
document.getElementById('suppress').addEventListener('click', () => {
  toast.dismissAll({ suppress: true });
});
document.getElementById('resume').addEventListener('click', () => {
  toast.resume();
  toast.info('已解除靜音，show() 恢復作用。');
});

for (const el of [durationInput, persistentInput, actionInput]) {
  el.addEventListener('input', renderSnippet);
}
document.querySelectorAll('input[name="position"]').forEach((el) => {
  el.addEventListener('change', renderSnippet);
});

// --- 環境讀數 ---

const html = document.documentElement;
const mqDark = window.matchMedia('(prefers-color-scheme: dark)');
const mqMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const supportsBlur =
  CSS.supports('backdrop-filter', 'blur(1px)') ||
  CSS.supports('-webkit-backdrop-filter', 'blur(1px)');

const setEnv = (id, value, note) => {
  document.getElementById(`env-${id}`).textContent = value;
  document.getElementById(`env-${id}-note`).textContent = note;
};

function renderEnv() {
  setEnv('blur', supportsBlur ? '支援' : '不支援',
    supportsBlur ? '毛玻璃生效，外殼半透明。' : '自動退回不透明底，維持可讀性。');

  setEnv('motion', mqMotion.matches ? 'reduce' : 'no-preference',
    mqMotion.matches ? '純淡入、無位移與 glow，倒數條保留。' : '完整進退場與 glow 脈衝。');

  setEnv('scheme', mqDark.matches ? 'dark' : 'light', '作業系統目前的偏好設定。');

  const manual = html.dataset.theme;
  const isDark = manual ? manual === 'dark' : mqDark.matches;
  setEnv('applied', isDark ? '深色毛玻璃' : '淺色毛玻璃',
    manual ? `由 data-theme="${manual}" 指定，覆蓋系統偏好。` : '未指定 data-theme，跟隨系統偏好。');
}

onAppearanceChange(renderEnv);
mqMotion.addEventListener('change', renderEnv);

// --- 起始狀態 ---

renderSnippet();
renderEnv();

// 開場先送一則真通知：比任何靜態說明都快讓人看懂這個元件在做什麼。
// 窄視窗跳過：toast 寬度接近滿版會蓋住頂列控制項，且「游標 / Tab」對觸控裝置無意義
if (window.matchMedia('(min-width: 768px)').matches) {
  setTimeout(() => {
    toast.info('這就是 glass-toast。游標移上來或用 Tab 聚焦，倒數會暫停。');
  }, 800);
}
