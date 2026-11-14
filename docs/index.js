import { toast, onAppearanceChange } from './site.js';
import { activeIndex } from './scrollspy.js';

// --- 試試看：每個按鈕對應旁邊那段範例程式碼 ---

const SAMPLE = {
  success: '儲存成功',
  error: '連線失敗',
  warning: '尚有未儲存的變更',
  info: '有新版本可用',
};

let lastDismiss = null;

const DEMOS = {
  show: () => {
    lastDismiss = toast.show('匯出完成', { type: 'success', position: 'bottom-right' });
  },
  'show-dismiss': () => lastDismiss?.(),
  variant: (btn) => toast[btn.dataset.type](SAMPLE[btn.dataset.type]),
  action: () => toast.error('上傳失敗，是否重試？', {
    action: { label: '重試', onClick: () => toast.success('已重新上傳') },
  }),
  burst: () => {
    for (const type of Object.keys(SAMPLE)) toast[type](SAMPLE[type]);
  },
  'dismiss-all': () => toast.dismissAll(),
  suppress: () => toast.dismissAll({ suppress: true }),
  resume: () => {
    toast.resume();
    toast.info('已解鎖，show() 恢復作用');
  },
  duration: () => toast.info('2 秒後消失', { duration: 2000 }),
  persistent: () => toast.info('不會自動消失，按右側關閉', { persistent: true }),
  position: (btn) => toast.info(btn.dataset.position, { position: btn.dataset.position }),
  cap: () => {
    for (let i = 1; i <= 6; i += 1) toast.info(`第 ${i} 則`, { position: 'bottom-right' });
  },
};

document.querySelectorAll('[data-demo]').forEach((btn) => {
  btn.addEventListener('click', () => DEMOS[btn.dataset.demo](btn));
});

// --- CSS 變數實際值：讀隱藏探針元素的 computed style，跟著外觀即時更新 ---

const probes = { base: document.createElement('div') };
probes.base.className = 'glass-toast';
for (const type of Object.keys(SAMPLE)) {
  probes[type] = document.createElement('div');
  probes[type].className = `glass-toast glass-toast--${type}`;
}
const probeRoot = document.createElement('div');
probeRoot.hidden = true;
probeRoot.append(...Object.values(probes));
document.body.append(probeRoot);

const isColor = (value) => /^(#|rgba?\(|hsla?\(|oklch\(|color\()/.test(value);

function renderVars() {
  document.querySelectorAll('[data-var-value]').forEach((cell) => {
    const name = cell.dataset.varValue;
    const probe = probes[cell.dataset.variant ?? 'base'];
    let value = getComputedStyle(probe).getPropertyValue(name).trim();
    const isRing = name === '--gt-ring';
    if (isRing) value = value.replace(/\s*,\s*/g, ', ');

    const wrap = document.createElement('span');
    wrap.className = 'val';
    if (isRing || isColor(value)) {
      const swatch = document.createElement('span');
      swatch.className = 'swatch';
      swatch.style.background = isRing ? `rgb(${value})` : value;
      wrap.append(swatch);
    }
    const code = document.createElement('code');
    code.textContent = value || '—';
    wrap.append(code);
    cell.replaceChildren(wrap);
  });
}

renderVars();
onAppearanceChange(renderVars);

// --- 目錄：依內文的 .group / .doc 產生，標題改了目錄自動跟上 ---

const toc = document.getElementById('toc');
const tocNav = document.getElementById('toc-nav');
const tocLinks = new Map();

for (const group of document.querySelectorAll('.prose .group')) {
  const block = document.createElement('div');
  block.className = 'toc__group';

  const title = document.createElement('p');
  title.className = 'toc__title';
  title.textContent = group.querySelector('h2').textContent;

  const list = document.createElement('ul');
  for (const doc of group.querySelectorAll('.doc[id]')) {
    const a = document.createElement('a');
    a.href = `#${doc.id}`;
    a.textContent = doc.dataset.toc ?? doc.querySelector('h3').textContent.trim();
    const li = document.createElement('li');
    li.append(a);
    list.append(li);
    tocLinks.set(doc.id, a);
  }

  block.append(title, list);
  tocNav.append(block);
}
toc.hidden = false;

// 寬視窗常駐展開；窄視窗預設收合，點了連結就收起來讓出畫面
const mqWide = window.matchMedia('(min-width: 960px)');
const syncToc = () => { toc.open = mqWide.matches; };
syncToc();
mqWide.addEventListener('change', syncToc);
tocNav.addEventListener('click', (e) => {
  if (e.target.closest('a') && !mqWide.matches) toc.open = false;
});

// --- 捲動同步：判斷規則見 scrollspy.js ---

const SPY_BASELINE = 0.15; // 判定線平時位置：視窗高度的比例
const sections = [...document.querySelectorAll('.prose .doc[id]')];
let current = null;

// 點連結跳到某一節時先釘住它：頁尾的節捲不到可以「越過判定線」的位置，
// 不釘的話點了也亮不起來。使用者自己動手捲動（滾輪、觸控、按鍵、拖捲軸）就解除
let pinned = location.hash ? tocLinks.get(location.hash.slice(1)) ?? null : null;

function setCurrent(link) {
  if (link === current) return;
  current?.removeAttribute('aria-current');
  link?.setAttribute('aria-current', 'location');
  current = link;
}

function syncCurrent() {
  if (pinned) {
    setCurrent(pinned);
    return;
  }
  const index = activeIndex(sections.map((el) => el.getBoundingClientRect().top), {
    viewportHeight: innerHeight,
    baseLine: innerHeight * SPY_BASELINE,
    scrollY,
    maxScroll: document.documentElement.scrollHeight - innerHeight,
  });
  setCurrent(index < 0 ? null : tocLinks.get(sections[index].id));
}

// 目錄與內文裡的 #錨點 都算；pointerdown / keydown 先解除、click 再釘住，順序剛好。
// 釘住後立刻更新：已經捲到底時再點頁尾的另一節，頁面不會動、不會有 scroll 事件
document.addEventListener('click', (e) => {
  const id = e.target.closest('a[href^="#"]')?.getAttribute('href').slice(1);
  if (!tocLinks.has(id)) return;
  pinned = tocLinks.get(id);
  setCurrent(pinned);
});
for (const type of ['wheel', 'touchstart', 'keydown', 'pointerdown']) {
  addEventListener(type, () => { pinned = null; }, { passive: true });
}

let ticking = false;
addEventListener('scroll', () => {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    ticking = false;
    syncCurrent();
  });
}, { passive: true });
addEventListener('resize', syncCurrent);
syncCurrent();
