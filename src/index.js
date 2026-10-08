// 公開 API（純淨入口：不碰 window、不注入樣式，可 tree-shake）
// 需要 window.toast + 自動樣式的專案改 import '@dennykuo/glass-toast/auto'
export {
  show,
  success,
  error,
  warning,
  info,
  dismissAll,
  resume,
  register,
  ensureStyles,
} from './toast.js';
