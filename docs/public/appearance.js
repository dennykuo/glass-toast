// 放在 head、首次繪製前執行，避免「先顯示再改掉」的閃爍：
//   1. 沒有 IntersectionObserver 就不藏進場內容，一律直接顯示
//   2. 套用上次選的外觀 / 背景（localStorage，文件與 Demo 共用），並在選單出現後同步勾選
(() => {
  const root = document.documentElement;
  if ('IntersectionObserver' in window) root.classList.add('js-reveal');

  const KEY = 'glass-toast-site:appearance';
  const FIELDS = ['theme', 'backdrop'];
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(KEY)) ?? {};
  } catch {
    // 資料損毀或無法存取 storage（隱私模式等）：用預設值
  }

  // theme 的「系統」= 不帶 data-theme，交給 prefers-color-scheme
  if (saved.theme && saved.theme !== 'system') root.dataset.theme = saved.theme;
  if (saved.backdrop) root.dataset.backdrop = saved.backdrop;

  document.addEventListener('DOMContentLoaded', () => {
    for (const name of FIELDS) {
      const value = name === 'theme' ? (root.dataset.theme ?? 'system') : root.dataset[name];
      const radio = document.querySelector(`input[name="${name}"][value="${value}"]`);
      if (radio) radio.checked = true;
    }
  });

  document.addEventListener('change', (e) => {
    if (!FIELDS.includes(e.target.name)) return;
    saved[e.target.name] = e.target.value;
    try {
      localStorage.setItem(KEY, JSON.stringify(saved));
    } catch {
      // 存不了就只在這一頁生效
    }
  });
})();
