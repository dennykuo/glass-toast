import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    css: true, // 讓 styles.css?inline 回真實內容（預設被存根成空字串）
  },
});
