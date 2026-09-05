export interface ITypingResult {
  duration: number // 秒
  speed: number // 字/分
  accuracy: number // 0-100
  total: number // 本关范文总字数
  correct: number // 正确字数
  level: number // 当前关（1 开始）
  levelCount: number // 总关数
}

// 界面文案（支持函数以承载带参数的模板）
export interface ITypingLang {
  title: string
  sampleLabel: string
  inputLabel: string
  stage: (level: number, levelCount: number) => string
  stats: (info: {
    durationSec: number
    speed: number
    accuracy: number
    state: string
  }) => string
  statsReady: string
  statsRunning: string
  stageCleared: (level: number) => string
  allCleared: string
  runSummary: (info: {
    levelCount: number
    durationSec: number
    avgSpeed: number
    avgAccuracy: number
  }) => string
}

export interface ITypingOption {
  // 闯关题目（每项一关），题目完全由外部传入，插件不内置内容
  passages?: string[]
  // 界面语言（内置 zhCN、en），默认取编辑器 locale 配置
  locale?: string
  // 覆盖对应语言的界面文案
  lang?: Partial<ITypingLang>
  onFinished?: (result: ITypingResult) => void
}

export interface ITypingGameOption {
  // 单次调用的闯关题目，优先级高于插件默认题目
  passages?: string[]
  // 自定义单关范文，优先级低于 passages
  text?: string
  locale?: string
  lang?: Partial<ITypingLang>
}
