import type { ITypingLang } from '../interface'

export const DEFAULT_LOCALE = 'zhCN'

// 统计条固定槽位数：按码点占位，文本变化时只差量更新变化过的槽位
export const STATS_SLOTS = 52

// 内置语言目录；题目（passages）不在此列，完全由外部传入
export const TYPING_LANG_MAP: Record<string, ITypingLang> = {
  zhCN: {
    title: '打字挑战',
    sampleLabel: '范文：',
    inputLabel: '输入：',
    stage: (level, levelCount) => `第 ${level}/${levelCount} 关`,
    stats: ({ durationSec, speed, accuracy, state }) =>
      `⏱ ${durationSec} 秒 · ⚡ ${speed} 字/分 · 🎯 ${accuracy}% · ${state}`,
    statsReady: '等待输入',
    statsRunning: '进行中',
    stageCleared: level => `🎉 第 ${level} 关完成！`,
    allCleared: '🎉 全部完成！',
    runSummary: ({ levelCount, durationSec, avgSpeed, avgAccuracy }) =>
      `🏆 总成绩 · 共 ${levelCount} 关 · ⏱ ${durationSec} 秒 · ⚡ 平均 ${avgSpeed} 字/分 · 🎯 平均正确率 ${avgAccuracy}%`
  },
  en: {
    title: 'Typing Challenge',
    sampleLabel: 'Sample:',
    inputLabel: 'Input:',
    stage: (level, levelCount) => `Stage ${level}/${levelCount}`,
    stats: ({ durationSec, speed, accuracy, state }) =>
      `⏱ ${durationSec}s · ⚡ ${speed} cpm · 🎯 ${accuracy}% · ${state}`,
    statsReady: 'Ready',
    statsRunning: 'In progress',
    stageCleared: level => `🎉 Stage ${level} cleared!`,
    allCleared: '🎉 All stages cleared!',
    runSummary: ({ levelCount, durationSec, avgSpeed, avgAccuracy }) =>
      `🏆 Summary · ${levelCount} stages · ⏱ ${durationSec}s · ⚡ avg ${avgSpeed} cpm · 🎯 avg accuracy ${avgAccuracy}%`
  }
}

// 范文、判定行与统计条配色
export const TYPING_COLOR = {
  title: '#0f172a',
  label: '#64748b',
  sample: '#334155',
  pending: '#cbd5e1',
  correct: '#16a34a',
  wrong: '#dc2626',
  stats: '#2563eb',
  done: '#16a34a'
}
