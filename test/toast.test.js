// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// jsdom 不實作 Element.animate — 用 stub 讓 toast.js 的 feature detect 通過
// stub 不會真的執行動畫；onfinish 由測試手動觸發或測試不依賴
const originalAnimate = Element.prototype.animate;

beforeEach(() => {
  document.body.innerHTML = '';
  document.head.querySelectorAll('[data-glass-toast]').forEach((n) => n.remove());
  delete window.toast;
  vi.resetModules();
  Element.prototype.animate = function () {
    return { onfinish: null, cancel() {} };
  };
});

afterEach(() => {
  vi.useRealTimers();
  if (originalAnimate) Element.prototype.animate = originalAnimate;
  else delete Element.prototype.animate;
});

async function loadToast() {
  return import('../src/index.js');
}

describe('show', () => {
  it('建立 toast 並加入 DOM，含正確 role 和 aria-live', async () => {
    const { show } = await loadToast();
    show('測試訊息', { type: 'info' });

    const toast = document.querySelector('.glass-toast');
    expect(toast).not.toBeNull();
    expect(toast.getAttribute('role')).toBe('status'); // 非 error 用 status（隱含 polite）
    expect(toast.getAttribute('aria-live')).toBe('polite');
    expect(toast.textContent).toContain('測試訊息');
  });

  it('回傳 dismiss 函式能移除 toast', async () => {
    vi.useFakeTimers();
    const { show } = await loadToast();
    const dismiss = show('測試', { persistent: true });

    expect(document.querySelectorAll('.glass-toast').length).toBe(1);

    dismiss();
    vi.advanceTimersByTime(500);

    expect(document.querySelectorAll('.glass-toast').length).toBe(0);
  });
});

describe('type variants', () => {
  it.each([
    ['success'],
    ['error'],
    ['warning'],
    ['info'],
  ])('%s 套用對應變體 class 且圖示藥丸存在', async (type) => {
    const { show } = await loadToast();
    show('msg', { type, persistent: true });

    const toast = document.querySelector('.glass-toast');
    expect(toast.classList.contains(`glass-toast--${type}`)).toBe(true);
    const pill = toast.querySelector('.glass-toast__icon');
    expect(pill).not.toBeNull();
    expect(pill.querySelector('svg')).not.toBeNull();
  });

  it('error 類型 role=alert 且 aria-live=assertive', async () => {
    const { show } = await loadToast();
    show('err', { type: 'error' });

    const toast = document.querySelector('.glass-toast');
    expect(toast.getAttribute('role')).toBe('alert');
    expect(toast.getAttribute('aria-live')).toBe('assertive');
  });

  it('未知 type 退回 info', async () => {
    const { show } = await loadToast();
    show('unknown', { type: 'nope', persistent: true });

    const toast = document.querySelector('.glass-toast');
    expect(toast.classList.contains('glass-toast--info')).toBe(true);
  });
});

describe('structure', () => {
  it('外殼帶 glass-toast class，含圖示 / 訊息 / 關閉鈕子元素', async () => {
    const { show } = await loadToast();
    show('glass', { persistent: true });

    const toast = document.querySelector('.glass-toast');
    expect(toast.classList.contains('glass-toast')).toBe(true);
    expect(toast.querySelector('.glass-toast__icon')).not.toBeNull();
    expect(toast.querySelector('.glass-toast__message')).not.toBeNull();
    expect(toast.querySelector('.glass-toast__close')).not.toBeNull();
  });

  it('訊息走 textContent，HTML 不被解析', async () => {
    const { show } = await loadToast();
    show('<img src=x onerror=alert(1)>', { persistent: true });

    const msg = document.querySelector('.glass-toast__message');
    expect(msg.textContent).toBe('<img src=x onerror=alert(1)>');
    expect(msg.querySelector('img')).toBeNull();
  });
});

describe('glow ring', () => {
  // 等兩個 RAF tick：show() 用 double RAF 才 trigger transition + glow animate
  const flushDoubleRaf = () =>
    new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );

  it('進場時對 toast 觸發 box-shadow animate（duration 1400 / ease-out）', async () => {
    const animateSpy = vi.spyOn(Element.prototype, 'animate');
    const { show } = await loadToast();
    show('ring', { type: 'success', persistent: true });
    await flushDoubleRaf();

    expect(animateSpy).toHaveBeenCalled();
    const lastCall = animateSpy.mock.calls.at(-1);
    const [keyframes, opts] = lastCall;
    expect(keyframes[0].boxShadow).toContain('rgba(16, 185, 129'); // emerald-500
    expect(opts.duration).toBe(1400);
    expect(opts.easing).toBe('ease-out');
    animateSpy.mockRestore();
  });

  it('每種 type 的 ring 顏色不同', async () => {
    const animateSpy = vi.spyOn(Element.prototype, 'animate');
    const { show } = await loadToast();
    show('s', { type: 'success', persistent: true });
    show('e', { type: 'error',   persistent: true });
    show('w', { type: 'warning', persistent: true });
    show('i', { type: 'info',    persistent: true });
    await flushDoubleRaf();

    const colors = animateSpy.mock.calls.map((c) => c[0][0].boxShadow);
    expect(colors.some((s) => s.includes('rgba(16, 185, 129'))).toBe(true); // success
    expect(colors.some((s) => s.includes('rgba(239, 68, 68'))).toBe(true);  // error
    expect(colors.some((s) => s.includes('rgba(245, 158, 11'))).toBe(true); // warning
    expect(colors.some((s) => s.includes('rgba(76, 112, 144'))).toBe(true); // info
    animateSpy.mockRestore();
  });

  it('reduced motion 時不觸發 animate', async () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockReturnValue({ matches: true });
    const animateSpy = vi.spyOn(Element.prototype, 'animate');
    try {
      const { show } = await loadToast();
      show('no glow', { type: 'error', persistent: true });
      await flushDoubleRaf();

      expect(animateSpy).not.toHaveBeenCalled();
    } finally {
      window.matchMedia = originalMatchMedia;
      animateSpy.mockRestore();
    }
  });

  it('Element.animate 不存在時不爆且 toast 仍顯示', async () => {
    Element.prototype.animate = undefined;
    const { show } = await loadToast();
    expect(() => show('no api', { type: 'success', persistent: true })).not.toThrow();
    await flushDoubleRaf();

    expect(document.querySelector('.glass-toast')).not.toBeNull();
  });
});

describe('slide-in', () => {
  it('top-right 帶 data-position 與進場隱藏態 class', async () => {
    const { show } = await loadToast();
    show('slide', { position: 'top-right', persistent: true });

    const toast = document.querySelector('.glass-toast');
    expect(toast.dataset.position).toBe('top-right');
    expect(toast.classList.contains('glass-toast--enter')).toBe(true);
  });

  it('進場帶 280ms transition class（--animated）', async () => {
    const { show } = await loadToast();
    show('dur', { persistent: true });

    const toast = document.querySelector('.glass-toast');
    expect(toast.classList.contains('glass-toast--animated')).toBe(true);
  });

  it('double RAF 後移除進場隱藏態', async () => {
    const { show } = await loadToast();
    show('entered', { persistent: true });

    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );

    const toast = document.querySelector('.glass-toast');
    expect(toast.classList.contains('glass-toast--enter')).toBe(false);
  });
});

describe('progress bar', () => {
  it('非 persistent 模式顯示進度條', async () => {
    const { show } = await loadToast();
    show('bar', { duration: 3000 });

    const bar = document.querySelector('.glass-toast .glass-toast__bar');
    expect(bar).not.toBeNull();
    expect(bar.style.width).toBe('100%');
  });

  it('persistent 模式不顯示進度條', async () => {
    const { show } = await loadToast();
    show('no bar', { persistent: true });

    const bar = document.querySelector('.glass-toast .glass-toast__bar');
    expect(bar).toBeNull();
  });
});

describe('auto dismiss', () => {
  it('非 persistent 模式在指定時間後自動移除', async () => {
    vi.useFakeTimers();
    const { show } = await loadToast();
    show('auto', { duration: 2000 });

    expect(document.querySelectorAll('.glass-toast').length).toBe(1);

    vi.advanceTimersByTime(2000);
    expect(document.querySelectorAll('.glass-toast').length).toBe(1); // 還在淡出

    vi.advanceTimersByTime(500);
    expect(document.querySelectorAll('.glass-toast').length).toBe(0);
  });

  it('persistent: true 不會自動消失', async () => {
    vi.useFakeTimers();
    const { show } = await loadToast();
    show('persist', { persistent: true });

    vi.advanceTimersByTime(10000);
    expect(document.querySelectorAll('.glass-toast').length).toBe(1);
  });
});

describe('close button', () => {
  it('點擊關閉按鈕會 dismiss', async () => {
    vi.useFakeTimers();
    const { show } = await loadToast();
    show('close me', { persistent: true });

    const btn = document.querySelector('[aria-label="關閉通知"]');
    btn.click();
    vi.advanceTimersByTime(500);

    expect(document.querySelectorAll('.glass-toast').length).toBe(0);
  });
});

describe('stack reflow on dismiss', () => {
  it('dismiss 時設定 inline style 坍縮 height / padding / border / marginTop', async () => {
    const { show } = await loadToast();
    const dismiss = show('collapse', { persistent: true });
    const toast = document.querySelector('.glass-toast');

    dismiss();

    expect(toast.classList.contains('glass-toast--leaving')).toBe(true);
    expect(toast.style.height).toBe('0px');
    expect(toast.style.paddingTop).toBe('0px');
    expect(toast.style.paddingBottom).toBe('0px');
    expect(toast.style.borderTopWidth).toBe('0px');
    expect(toast.style.borderBottomWidth).toBe('0px');
    expect(toast.style.marginTop).toBe('-12px'); // 對齊容器 gap 0.75rem
  });

  it('reduced motion 時不套用坍縮（避免動畫）', async () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockReturnValue({ matches: true });
    try {
      const { show } = await loadToast();
      const dismiss = show('no collapse', { persistent: true });
      const toast = document.querySelector('.glass-toast');

      dismiss();

      expect(toast.style.height).toBe('');
      expect(toast.style.marginTop).toBe('');
      expect(toast.classList.contains('glass-toast--faded')).toBe(true);
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });
});

describe('stacking', () => {
  it('多個 toast 堆疊在同一容器', async () => {
    const { show } = await loadToast();
    show('first', { persistent: true });
    show('second', { persistent: true });
    show('third', { persistent: true });

    const container = document.querySelector('[data-toast-container="top-right"]');
    expect(container.children.length).toBe(3);
  });
});

describe('lazy container', () => {
  it('容器惰性建立（首次呼叫才出現）', async () => {
    await loadToast();

    expect(document.querySelector('[data-toast-container]')).toBeNull();

    const { show } = await loadToast();
    show('hello', { persistent: true });

    expect(document.querySelector('[data-toast-container]')).not.toBeNull();
  });
});

describe('positions', () => {
  it('三種 position 各自建立獨立容器（帶語義 modifier class）', async () => {
    const { show } = await loadToast();
    show('a', { position: 'top-right', persistent: true });
    show('b', { position: 'bottom-right', persistent: true });
    show('c', { position: 'bottom-center', persistent: true });

    const containers = document.querySelectorAll('[data-toast-container]');
    expect(containers.length).toBe(3);

    const positions = [...containers].map(c => c.dataset.toastContainer);
    expect(positions).toContain('top-right');
    expect(positions).toContain('bottom-right');
    expect(positions).toContain('bottom-center');

    for (const c of containers) {
      expect(c.classList.contains('glass-toast-container')).toBe(true);
      expect(c.classList.contains(`glass-toast-container--${c.dataset.toastContainer}`)).toBe(true);
    }
  });

  it('bottom-center 的 data-position 決定滑入軸向', async () => {
    const { show } = await loadToast();
    show('center', { position: 'bottom-center', persistent: true });

    const toast = document.querySelector('.glass-toast');
    expect(toast.dataset.position).toBe('bottom-center');
    expect(toast.classList.contains('glass-toast--enter')).toBe(true);
  });

  it('未知 position 退回 top-right', async () => {
    const { show } = await loadToast();
    show('fallback', { position: 'middle-left', persistent: true });

    const container = document.querySelector('[data-toast-container]');
    expect(container.dataset.toastContainer).toBe('top-right');
  });
});

describe('accessibility', () => {
  it('關閉按鈕有 aria-label 且為 button 元素', async () => {
    const { show } = await loadToast();
    show('a11y', { persistent: true });

    const btn = document.querySelector('.glass-toast__close');
    expect(btn.tagName).toBe('BUTTON');
    expect(btn.getAttribute('aria-label')).toBe('關閉通知');
  });

  it('reduced motion 時不加位移隱藏態，改純淡入', async () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true });
    const { show } = await loadToast();
    show('no motion', { persistent: true });

    const toast = document.querySelector('.glass-toast');
    expect(toast.classList.contains('glass-toast--enter')).toBe(false);
    expect(toast.classList.contains('glass-toast--animated')).toBe(false);
    expect(toast.classList.contains('glass-toast--faded')).toBe(true);
  });
});

describe('register / window.toast', () => {
  it('主入口 import 不自動掛 window.toast', async () => {
    await loadToast();

    expect(window.toast).toBeUndefined();
  });

  it('register() 掛載 window.toast，快捷方法正確委派', async () => {
    const { register } = await loadToast();
    register();

    expect(window.toast).toBeDefined();
    expect(typeof window.toast.show).toBe('function');
    expect(typeof window.toast.success).toBe('function');
    expect(typeof window.toast.error).toBe('function');
    expect(typeof window.toast.warning).toBe('function');
    expect(typeof window.toast.info).toBe('function');
    expect(typeof window.toast.dismissAll).toBe('function');
    expect(typeof window.toast.resume).toBe('function');

    window.toast.success('ok', { persistent: true });
    const toast = document.querySelector('.glass-toast');
    expect(toast.classList.contains('glass-toast--success')).toBe(true);
  });

  it('register({ global: false }) 不掛 window.toast', async () => {
    const { register } = await loadToast();
    register({ global: false });

    expect(window.toast).toBeUndefined();
  });

  it('register({ target }) 掛到自訂目標', async () => {
    const { register } = await loadToast();
    const target = {};
    register({ target });

    expect(typeof target.toast.show).toBe('function');
    expect(window.toast).toBeUndefined();
  });

  it('auto 入口 import 即掛載 window.toast + 注入樣式', async () => {
    await import('../src/auto.js');

    expect(window.toast).toBeDefined();
    expect(typeof window.toast.show).toBe('function');
    expect(document.querySelector('style[data-glass-toast]')).not.toBeNull();
  });
});

describe('styles injection', () => {
  it('show() 自動注入樣式到 <head>，多次呼叫不重複', async () => {
    const { show } = await loadToast();
    show('a', { persistent: true });
    show('b', { persistent: true });

    const styles = document.head.querySelectorAll('style[data-glass-toast]');
    expect(styles.length).toBe(1);
    expect(styles[0].textContent).toContain('.glass-toast');
  });

  it('已有 data-glass-toast 標記（顯式 import）時不重複注入', async () => {
    const link = document.createElement('link');
    link.setAttribute('data-glass-toast', '');
    document.head.appendChild(link);

    const { show } = await loadToast();
    show('marked', { persistent: true });

    expect(document.head.querySelectorAll('style[data-glass-toast]').length).toBe(0);
  });

  it('register({ injectStyles: false }) 停用自動注入', async () => {
    const { register, show } = await loadToast();
    register({ global: false, injectStyles: false });
    show('no styles', { persistent: true });

    expect(document.head.querySelectorAll('style[data-glass-toast]').length).toBe(0);
  });
});

describe('dismissAll', () => {
  it('移除所有 toast 容器與元素', async () => {
    const { show, dismissAll } = await loadToast();
    show('a', { position: 'top-right', persistent: true });
    show('b', { position: 'bottom-right', persistent: true });

    expect(document.querySelectorAll('[data-toast-container]').length).toBe(2);
    expect(document.querySelectorAll('.glass-toast').length).toBe(2);

    dismissAll();

    expect(document.querySelectorAll('[data-toast-container]').length).toBe(0);
    expect(document.querySelectorAll('.glass-toast').length).toBe(0);
  });

  it('預設（不帶 suppress）只清空、不鎖 show()', async () => {
    const { show, dismissAll } = await loadToast();
    show('a', { persistent: true });

    dismissAll();
    expect(document.querySelectorAll('.glass-toast').length).toBe(0);

    show('b', { persistent: true });
    expect(document.querySelectorAll('.glass-toast').length).toBe(1);
  });

  it('suppress: true 時 show() 變 noop 不產生新 toast', async () => {
    const { show, dismissAll } = await loadToast();

    dismissAll({ suppress: true });
    const dismiss = show('after', { persistent: true });

    expect(typeof dismiss).toBe('function');
    expect(document.querySelectorAll('.glass-toast').length).toBe(0);
    expect(document.querySelectorAll('[data-toast-container]').length).toBe(0);
  });

  it('resume() 解除 suppress:true 造成的靜音鎖', async () => {
    const { show, dismissAll, resume } = await loadToast();

    dismissAll({ suppress: true });
    resume();
    show('back', { persistent: true });

    expect(document.querySelectorAll('.glass-toast').length).toBe(1);
  });

  it('dismissAll({ suppress: false }) 清空但不鎖 show()', async () => {
    const { show, dismissAll } = await loadToast();
    show('a', { persistent: true });

    dismissAll({ suppress: false });
    expect(document.querySelectorAll('.glass-toast').length).toBe(0);

    show('again', { persistent: true });
    expect(document.querySelectorAll('.glass-toast').length).toBe(1);
  });
});

describe('aria role per variant', () => {
  it.each([['success'], ['warning'], ['info']])('%s 用 role=status（隱含 polite）', async (type) => {
    const { show } = await loadToast();
    show('x', { type, persistent: true });

    const toast = document.querySelector('.glass-toast');
    expect(toast.getAttribute('role')).toBe('status');
  });
});

describe('action button', () => {
  it('渲染 action 按鈕，點擊執行 onClick 後 dismiss', async () => {
    vi.useFakeTimers();
    const onClick = vi.fn();
    const { show } = await loadToast();
    show('act', { type: 'error', action: { label: '重試', onClick } });

    const actionBtn = document.querySelector('.glass-toast__action');
    expect(actionBtn).not.toBeNull();
    expect(actionBtn.tagName).toBe('BUTTON');
    expect(actionBtn.textContent).toBe('重試');

    actionBtn.click();
    expect(onClick).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(280);
    expect(document.querySelectorAll('.glass-toast').length).toBe(0);
  });

  it('有 action 且未給 duration 時預設 persistent（無進度條）', async () => {
    const { show } = await loadToast();
    show('act', { action: { label: 'x', onClick() {} } });

    expect(document.querySelector('.glass-toast__bar')).toBeNull();
  });

  it('有 action 但顯式給 duration 時仍自動消失（有進度條）', async () => {
    const { show } = await loadToast();
    show('act', { duration: 3000, action: { label: 'x', onClick() {} } });

    expect(document.querySelector('.glass-toast__bar')).not.toBeNull();
  });

  it('無 label 的 action 不渲染按鈕', async () => {
    const { show } = await loadToast();
    show('no label', { action: { onClick() {} }, persistent: true });

    expect(document.querySelector('.glass-toast__action')).toBeNull();
  });
});

describe('duration defaults', () => {
  it('error 未指定 duration 時預設停留較久（10000ms）', async () => {
    vi.useFakeTimers();
    const { show } = await loadToast();
    show('err', { type: 'error' });

    vi.advanceTimersByTime(5500);
    expect(document.querySelectorAll('.glass-toast').length).toBe(1); // 一般變體早退場，error 不會

    vi.advanceTimersByTime(4500); // 累計 10000 → 觸發退場
    vi.advanceTimersByTime(280);
    expect(document.querySelectorAll('.glass-toast').length).toBe(0);
  });

  it('duration ≤ 0 視為 persistent（不自動消失、無進度條）', async () => {
    vi.useFakeTimers();
    const { show } = await loadToast();
    show('sticky', { duration: 0 });

    expect(document.querySelector('.glass-toast__bar')).toBeNull();

    vi.advanceTimersByTime(60000);
    expect(document.querySelectorAll('.glass-toast').length).toBe(1);
  });
});

describe('max visible cap', () => {
  it('同位置超過上限（4）時自動關掉最舊的 toast', async () => {
    vi.useFakeTimers();
    const { show } = await loadToast();
    for (let i = 0; i < 5; i++) show(`t${i}`, { persistent: true });

    vi.advanceTimersByTime(280); // 讓被關掉的最舊 toast 退場完成移除

    const container = document.querySelector('[data-toast-container="top-right"]');
    expect(container.children.length).toBe(4);
  });
});

describe('pause on keyboard focus', () => {
  it('focusin 暫停自動消失，focusout 後恢復', async () => {
    vi.useFakeTimers();
    const { show } = await loadToast();
    show('focus', { duration: 2000 });
    const toast = document.querySelector('.glass-toast');

    toast.dispatchEvent(new FocusEvent('focusin'));
    vi.advanceTimersByTime(2000);
    expect(document.querySelectorAll('.glass-toast').length).toBe(1); // 暫停中不消失

    toast.dispatchEvent(new FocusEvent('focusout', { relatedTarget: null }));
    vi.advanceTimersByTime(2000);
    vi.advanceTimersByTime(280);
    expect(document.querySelectorAll('.glass-toast').length).toBe(0);
  });
});

describe('escape to dismiss', () => {
  it('Esc 關閉聚焦中的 toast', async () => {
    vi.useFakeTimers();
    const { show } = await loadToast();
    show('esc', { persistent: true });
    const toast = document.querySelector('.glass-toast');

    toast.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    vi.advanceTimersByTime(280);

    expect(document.querySelectorAll('.glass-toast').length).toBe(0);
  });
});

describe('focus return', () => {
  it('dismiss 後把焦點交還觸發者', async () => {
    vi.useFakeTimers();
    const { show } = await loadToast();
    const invoker = document.createElement('button');
    document.body.appendChild(invoker);
    invoker.focus();

    const dismiss = show('fr', { persistent: true });
    const closeBtn = document.querySelector('.glass-toast__close');
    closeBtn.focus();
    expect(document.activeElement).toBe(closeBtn);

    dismiss();
    vi.advanceTimersByTime(280);

    expect(document.activeElement).toBe(invoker);
  });
});

describe('reduced motion progress bar', () => {
  it('reduced motion 下進度條仍保留寬度 transition（時間指示）', async () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true });
    const { show } = await loadToast();
    show('bar', { duration: 3000 });

    const bar = document.querySelector('.glass-toast__bar');
    expect(bar).not.toBeNull();
    expect(bar.style.transition).toContain('width');
  });
});
