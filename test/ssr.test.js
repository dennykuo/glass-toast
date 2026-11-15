// @vitest-environment node
import { expect, it } from 'vitest';
import { dismissAll, register, show } from '../src/index.js';

it('SSR 可呼叫 show 與語法糖，並沿用回傳的關閉函式', () => {
  expect(typeof document).toBe('undefined');
  const api = register({ global: false });
  expect(() => show('Server message')()).not.toThrow();
  expect(() => api.error('Server error')()).not.toThrow();
  expect(() => dismissAll()).not.toThrow();
});
