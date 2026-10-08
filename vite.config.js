import { defineConfig } from 'vite';

// 兩段 build：
//   vite build              → ESM 多入口（glass-toast.js + auto.js，共用 chunk 自動拆分）
//   vite build --mode umd   → UMD 單入口（glass-toast.umd.cjs，全域 GlassToast，給 <script> / require）
// UMD 不支援多入口，故拆兩段；--mode umd 不清 dist 以保留 ESM 產物
export default defineConfig(({ mode }) => {
  if (mode === 'umd') {
    return {
      build: {
        emptyOutDir: false,
        lib: {
          entry: 'src/index.js',
          name: 'GlassToast',
          formats: ['umd'],
          fileName: 'glass-toast',
        },
      },
    };
  }

  return {
    build: {
      lib: {
        entry: {
          'glass-toast': 'src/index.js',
          auto: 'src/auto.js',
        },
        formats: ['es'],
      },
    },
  };
});
