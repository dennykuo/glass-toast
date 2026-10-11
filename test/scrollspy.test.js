import { describe, it, expect } from 'vitest';
import { activeIndex } from '../docs/scrollspy.js';

// 視窗 900px、判定線在上緣 90px；頁面總共可捲 3000px
const metrics = (scrollY) => ({ viewportHeight: 900, baseLine: 90, maxScroll: 3000, scrollY });

describe('activeIndex（目錄捲動同步）', () => {
  it('取頂端已越過判定線的最後一節', () => {
    expect(activeIndex([-400, 60, 500], metrics(1000))).toBe(1);
  });

  it('還沒捲到第一節時為 -1', () => {
    expect(activeIndex([300, 900, 1500], metrics(0))).toBe(-1);
  });

  it('捲到底一定是最後一節，即使它矮到碰不到判定線', () => {
    // 倒數兩節在頁底：頂端分別在 200 與 600，永遠到不了 90
    expect(activeIndex([-800, 200, 600], metrics(3000))).toBe(2);
  });

  it('接近頁底時，矮的倒數第二節也輪得到', () => {
    // 從底部往回捲 250px：所有頂端往下移 250
    expect(activeIndex([-550, 450, 850], metrics(2750))).toBe(1);
  });

  it('離頁底超過一個視窗高度時，判定線不受頁尾影響', () => {
    // 第二節頂端 400 遠低於判定線 90，不該被選中
    expect(activeIndex([-300, 400], metrics(1500))).toBe(0);
  });
});
