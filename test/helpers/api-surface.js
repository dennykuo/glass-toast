// 從原始碼掃出套件的對外介面，給各份文件的覆蓋率守門共用。
// 掃描結果為空代表原始碼格式變了、regex 失效——直接丟錯，不能當成「全部有寫」。
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// 不用 new URL(`…${path}`, import.meta.url)：Vite 會把這個寫法當成資產引用改寫掉
export const read = (path) => readFileSync(resolve(import.meta.dirname, '..', '..', path), 'utf8');

const toastSrc = read('src/toast.js');
const cssSrc = read('src/styles.css');

function nonEmpty(list, what) {
  if (list.length === 0) throw new Error(`掃不到任何${what}，原始碼格式可能變了`);
  return list;
}

/** src/index.js 的公開 export 名稱 */
export async function publicExports() {
  return nonEmpty(Object.keys(await import('../../src/index.js')), '公開 export');
}

/** show() 的選項（ToastOptions 的 JSDoc @property） */
export function showOptions() {
  const block = toastSrc.match(/@typedef \{Object\} ToastOptions([\s\S]*?)@typedef/)?.[1] ?? '';
  return nonEmpty([...block.matchAll(/@property \{[^}]*\} \[(\w+)/g)].map((m) => m[1]), ' show() 選項');
}

/** register() 的選項（JSDoc @param [options.x]） */
export function registerOptions() {
  return nonEmpty(
    [...toastSrc.matchAll(/@param \{[^}]*\} \[options\.(\w+)/g)].map((m) => m[1]),
    ' register() 選項',
  );
}

/** styles.css 宣告或引用的 --gt-* 變數 */
export function cssVars() {
  return nonEmpty([...new Set(cssSrc.match(/--gt-[\w-]+/g))], ' --gt-* 變數');
}
