/**
 * 依捲動位置挑出目前閱讀中的章節（目錄反白用）。
 *
 * 判定線平時在視窗上緣附近（baseLine），章節頂端越過它就算進入該節。
 * 但頁尾幾節通常太矮，捲到底也碰不到這條線；所以進入「最後一個視窗高度」
 * 的捲動範圍後，判定線會隨捲動進度從 baseLine 滑到視窗底部——尾端每一節
 * 依序都輪得到，捲到底時必定是最後一節。
 *
 * @param {number[]} tops 各節頂端相對視窗的位置（getBoundingClientRect().top），依文件順序
 * @param {{ viewportHeight: number, baseLine: number, scrollY: number, maxScroll: number }} metrics
 * @returns {number} 目前章節的索引；還沒捲到第一節時為 -1
 */
export function activeIndex(tops, { viewportHeight, baseLine, scrollY, maxScroll }) {
  const remaining = Math.max(0, maxScroll - scrollY);
  const progress = Math.max(0, 1 - remaining / viewportHeight);
  const line = baseLine + (viewportHeight - baseLine) * progress;

  let index = -1;
  tops.forEach((top, i) => {
    if (top <= line) index = i;
  });
  return index;
}
