// side-effect 入口：import '@dennykuo/glass-toast/auto' 即完成
// window.toast 掛載 + 樣式注入（等價 register() 預設值）
import { register } from './toast.js';

register();

export * from './toast.js';
