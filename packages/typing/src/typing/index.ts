import { ControlType, Editor, ElementType } from '@hufe921/canvas-editor'
import type { IElement } from '@hufe921/canvas-editor'
import {
  DEFAULT_LOCALE,
  STATS_SLOTS,
  TYPING_COLOR,
  TYPING_LANG_MAP
} from './constant'
import type {
  ITypingGameOption,
  ITypingLang,
  ITypingOption,
  ITypingResult
} from './interface'

declare module '@hufe921/canvas-editor' {
  interface Command {
    executeTyping(options?: ITypingGameOption): void
  }
}

// 判定行元素标记：conceptId 在编辑器逐码点拆分与取值拷贝中均被保留，id 则会丢失
function feedbackConceptId(gameId: string, index: number): string {
  return `${gameId}::${index}`
}

// 统计条：固定槽位的单字符 conceptId 元素，仅用 updateElementById 逐字符
// 更新（isSetCursor: false，不接管输入代理）——控件重绘会抢占光标，故弃用
function statsSlotConceptId(gameId: string, index: number): string {
  return `${gameId}::s${index}`
}

// 按码点切分并补齐到固定槽位数（emoji 等代理对视为一个字符）
function padStatsSlots(text: string): string[] {
  const chars = Array.from(text)
  while (chars.length < STATS_SLOTS) chars.push(' ')
  return chars.slice(0, STATS_SLOTS)
}

interface ITypingGame {
  gameId: string
  passages: string[]
  level: number // 当前关（1 开始）
  levelCount: number
  lang: ITypingLang
  inputLabel: string // 插入时的输入行标签，用于提取已输入内容
  chars: string[]
  state: 'idle' | 'running' | 'finished'
  startedAt: number
  finishedAt: number
  lastStatus: number[]
  lastStatsText: string
  timer: number | undefined
  run: ITypingRun
}

// 一场闯关的各关成绩，用于全部结束后汇总平均分
interface ITypingRun {
  levelCount: number
  results: { durationSec: number; total: number; correct: number }[]
}

// 生成元素 id（非安全上下文下 crypto.randomUUID 不可用时降级）
function createId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ||
    `${Date.now()}-${Math.random().toString(36).slice(2)}`
  )
}

function typingPlugin(editor: Editor, defaultOptions?: ITypingOption) {
  const command = editor.command
  const gameRegistry = new Map<string, ITypingGame>()

  // 国际化：优先单次调用 locale 配置，其次插件默认 locale 配置，
  // 再次编辑器 locale 配置，回退 zhCN；lang 支持逐项覆盖
  function getLang(options?: ITypingGameOption): ITypingLang {
    const editorLocale = (editor.command as any).getOptions?.().locale as
      | string
      | undefined
    const currentLocale = (
      options?.locale ||
      defaultOptions?.locale ||
      editorLocale ||
      DEFAULT_LOCALE
    )
      .toLowerCase()
      .replace(/[-_]/g, '')
    const sourceLang =
      Object.entries(TYPING_LANG_MAP).find(
        ([key]) => key.toLowerCase() === currentLocale
      )?.[1] || TYPING_LANG_MAP[DEFAULT_LOCALE]
    return {
      ...sourceLang,
      ...defaultOptions?.lang,
      ...options?.lang
    }
  }

  // IME 组合期间插件任何重绘都会重建编辑器隐藏输入框状态、打断输入法，
  // 未上屏的拼音会以字母形式落入文档；组合中只标脏，组合结束立即补刷
  let composing = false
  const inputArea = command
    .getContainer()
    .querySelector<HTMLTextAreaElement>('.ce-inputarea')
  inputArea?.addEventListener('compositionstart', () => {
    composing = true
  })
  inputArea?.addEventListener('compositionend', () => {
    composing = false
    scheduleSync()
  })

  // 本插件触发的重绘会在渲染的 rAF 回调中再次广播 contentChange，
  // 用两帧窗口抑制自激；同步按差量计算，多执行一次也无副作用
  let applying = false
  function suppressNextEmit() {
    applying = true
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        applying = false
      })
    })
  }

  // 击键高频触发 contentChange，插件的重绘若在编辑器处理输入的同一任务链
  // 内同步执行会与下一次击键相竞；延迟合并到独立任务中错峰执行
  let syncPending = false
  // 本轮同步是否执行过插件写入；编辑器整页重绘会隐藏光标 DOM
  // （render → recoveryCursor），写过之后需要用轻量渲染把它画回来
  let didWrite = false
  function scheduleSync() {
    if (syncPending) return
    syncPending = true
    window.setTimeout(() => {
      syncPending = false
      if (applying) {
        scheduleSync()
        return
      }
      gameRegistry.forEach(syncGame)
      if (didWrite) {
        didWrite = false
        restoreCursor()
      }
    }, 50)
  }

  // 编辑器的不带 curIndex 的渲染会隐藏光标且不自动恢复；用一次轻量渲染
  // （isCompute: false，不触发 contentChange）在当前选区上把光标画回并滚入可视区
  function restoreCursor() {
    if (composing) return
    const { startIndex, endIndex } = command.getRange()
    if (startIndex < 0) return
    command.executeFocus({
      range: { startIndex, endIndex },
      isMoveCursorToVisible: true
    })
  }

  function disposeGame(game: ITypingGame) {
    if (game.timer) {
      window.clearInterval(game.timer)
      game.timer = undefined
    }
    gameRegistry.delete(game.gameId)
  }

  // 从取值拷贝中提取玩家已输入的文本：判定行 conceptId 为锚点向后找
  // 输入行标签（打字后会与标签元素合并，需前缀匹配），其后直至换行/
  // 文档末尾即输入内容，全程不依赖绝对索引
  function extractTypedText(game: ITypingGame): string | null {
    const main = command.getValue().data.main
    let anchor = -1
    for (let i = 0; i < main.length; i++) {
      if (main[i]?.conceptId === feedbackConceptId(game.gameId, 0)) {
        anchor = i
        break
      }
    }
    // 锚点不存在说明该局已被删除
    if (anchor < 0) return null
    let labelIdx = anchor + game.chars.length
    while (labelIdx < main.length) {
      const value = main[labelIdx].value
      if (value === game.inputLabel || value.startsWith(game.inputLabel)) {
        break
      }
      labelIdx++
    }
    if (labelIdx >= main.length) return ''
    const chars: string[] = []
    const first = String(main[labelIdx].value).slice(game.inputLabel.length)
    if (first) chars.push(first)
    for (let i = labelIdx + 1; i < main.length; i++) {
      const element = main[i]
      if (!element || element.value === '\n') break
      chars.push(element.value)
    }
    return chars.join('')
  }

  // 按码点计算已输入内容与范文的正确字符数
  function diffTyped(
    game: ITypingGame,
    typed: string
  ): { typedChars: string[]; correctLen: number } {
    const typedChars = Array.from(typed)
    let correctLen = 0
    for (let i = 0; i < typedChars.length && i < game.chars.length; i++) {
      if (typedChars[i] === game.chars[i]) correctLen++
    }
    return { typedChars, correctLen }
  }

  function buildStatsText(
    game: ITypingGame,
    typedLen: number,
    correctLen: number,
    finished = false
  ): string {
    const endTime = finished ? game.finishedAt : Date.now()
    const durationSec =
      game.state === 'idle'
        ? 0
        : Math.max(1, Math.round((endTime - game.startedAt) / 1000))
    const speed =
      durationSec > 0 ? Math.round(typedLen / (durationSec / 60)) : 0
    const accuracy =
      typedLen > 0
        ? Math.round((correctLen / Math.min(typedLen, game.chars.length)) * 100)
        : 100
    const levelPrefix =
      game.levelCount > 1
        ? `${game.lang.stage(game.level, game.levelCount)} · `
        : ''
    const stateText = finished
      ? game.level < game.levelCount
        ? game.lang.stageCleared(game.level)
        : game.lang.allCleared
      : game.state === 'running'
        ? game.lang.statsRunning
        : game.lang.statsReady
    const statsText = game.lang.stats({
      durationSec,
      speed,
      accuracy,
      state: stateText
    })
    return `${levelPrefix}${statsText}`
  }

  function updateStats(
    game: ITypingGame,
    typedLen: number,
    correctLen: number,
    finished = false
  ) {
    const text = buildStatsText(game, typedLen, correctLen, finished)
    if (text === game.lastStatsText) return
    // IME 组合期间不渲染（完成后除外）；本次变更留给计时器或
    // compositionend 触发的下一次同步补刷
    if (composing && !finished) return
    const prev = padStatsSlots(game.lastStatsText)
    const next = padStatsSlots(text)
    game.lastStatsText = text
    // 统计条按槽位差量更新：只刷新变化的字符，且全部走安全的
    // updateElementById 路径（不接管输入代理、不抢光标）
    const updates: { conceptId: string; properties: Partial<IElement> }[] = []
    for (let i = 0; i < STATS_SLOTS; i++) {
      if (prev[i] === next[i]) continue
      const properties: Partial<IElement> = { value: next[i] }
      if (finished) properties.bold = true
      properties.color = finished ? TYPING_COLOR.done : TYPING_COLOR.stats
      updates.push({
        conceptId: statsSlotConceptId(game.gameId, i),
        properties
      })
    }
    if (updates.length) {
      didWrite = true
      suppressNextEmit()
      for (const update of updates) {
        command.executeUpdateElementById(update)
      }
    }
  }

  function finishGame(game: ITypingGame, typedLen: number, correctLen: number) {
    game.state = 'finished'
    game.finishedAt = Date.now()
    if (game.timer) {
      window.clearInterval(game.timer)
      game.timer = undefined
    }
    updateStats(game, typedLen, correctLen, true)
    const durationSec = Math.max(
      1,
      Math.round((game.finishedAt - game.startedAt) / 1000)
    )
    const result: ITypingResult = {
      duration: durationSec,
      speed: Math.round(typedLen / (durationSec / 60)),
      accuracy: Math.round((correctLen / game.chars.length) * 100),
      total: game.chars.length,
      correct: correctLen,
      level: game.level,
      levelCount: game.levelCount
    }
    defaultOptions?.onFinished?.(result)
    // 累计本场成绩；全部关卡结束后追加总成绩行
    game.run.results.push({
      durationSec,
      total: game.chars.length,
      correct: correctLen
    })
    // 闯关模式：稍作停顿后自动在文档末尾追加下一关（避开 IME 组合期）；
    // 全部结束后追加总成绩行
    if (game.level < game.levelCount) {
      const passages = game.passages
      const nextLevelIndex = game.level // game.level 为 1 开始，恰为下一关的 0 基索引
      const tryAppend = () => {
        if (!gameRegistry.has(game.gameId)) return
        if (composing) {
          window.setTimeout(tryAppend, 200)
          return
        }
        insertLevel(passages, nextLevelIndex, game.run, game.lang)
      }
      window.setTimeout(tryAppend, 600)
    } else if (game.levelCount > 1) {
      appendRunSummary(game.run, game.lang)
    }
  }

  // 全部关卡结束后，在文档末尾追加总成绩行（总用时、平均速度、平均正确率）
  function appendRunSummary(run: ITypingRun, lang: ITypingLang) {
    const totalDurationSec = run.results.reduce(
      (sum, r) => sum + r.durationSec,
      0
    )
    const totalChars = run.results.reduce((sum, r) => sum + r.total, 0)
    const totalCorrect = run.results.reduce((sum, r) => sum + r.correct, 0)
    const avgSpeed =
      totalDurationSec > 0
        ? Math.round(totalChars / (totalDurationSec / 60))
        : 0
    const avgAccuracy =
      totalChars > 0 ? Math.round((totalCorrect / totalChars) * 100) : 100
    command.executeAppendElementList([
      { value: '\n' },
      {
        value: lang.runSummary({
          levelCount: run.levelCount,
          durationSec: totalDurationSec,
          avgSpeed,
          avgAccuracy
        }),
        bold: true,
        color: TYPING_COLOR.done
      }
    ])
  }

  function syncGame(game: ITypingGame) {
    // IME 组合期间不做任何插件写入，组合结束后由 compositionend 补刷
    if (game.state === 'finished' || composing) return
    const typed = extractTypedText(game)
    if (typed == null) {
      disposeGame(game)
      return
    }
    const { typedChars, correctLen } = diffTyped(game, typed)
    const typedLen = typedChars.length
    // 判定行差量更新：只刷新状态翻转的字符，避免每次击键全量重绘
    const updates: { conceptId: string; properties: Partial<IElement> }[] = []
    for (let i = 0; i < game.chars.length; i++) {
      const status =
        i < typedLen ? (typedChars[i] === game.chars[i] ? 1 : -1) : 0
      if (status === game.lastStatus[i]) continue
      game.lastStatus[i] = status
      updates.push({
        conceptId: feedbackConceptId(game.gameId, i),
        properties: {
          value: status === -1 ? typedChars[i] : game.chars[i],
          color:
            status === 1
              ? TYPING_COLOR.correct
              : status === -1
                ? TYPING_COLOR.wrong
                : TYPING_COLOR.pending
        }
      })
    }
    if (updates.length) {
      didWrite = true
      suppressNextEmit()
      for (const update of updates) {
        command.executeUpdateElementById(update)
      }
    }
    if (game.state === 'idle' && typedLen > 0) {
      game.state = 'running'
      game.startedAt = Date.now()
      game.timer = window.setInterval(() => {
        if (game.state !== 'running') return
        const current = extractTypedText(game)
        if (current == null) return
        const { typedChars: currentChars, correctLen } = diffTyped(
          game,
          current
        )
        updateStats(game, currentChars.length, correctLen)
        if (didWrite) {
          didWrite = false
          restoreCursor()
        }
      }, 500)
    }
    updateStats(game, typedLen, correctLen)
    if (typedLen >= game.chars.length) {
      finishGame(game, typedLen, correctLen)
    }
  }

  editor.eventBus.on('contentChange', scheduleSync)

  // 在文档末尾追加一关：标题 / 范文控件 / 判定行 / 统计条 / 输入行，
  // 输入行放在最后，追加完成后光标天然停在冒号后待输入处
  function insertLevel(
    passages: string[],
    levelIndex: number,
    run: ITypingRun,
    lang: ITypingLang
  ) {
    const target = passages[levelIndex].trim()
    const chars = Array.from(target)
    const level = levelIndex + 1
    const gameId = createId()
    const title =
      passages.length > 1
        ? `${lang.title}（${lang.stage(level, passages.length)}）`
        : lang.title
    // 范文用 disabled 文本控件承载：即使光标误入也无法改写游戏数据
    const sampleControl: IElement = {
      type: ElementType.CONTROL,
      value: '',
      control: {
        type: ControlType.TEXT,
        disabled: true,
        prefix: lang.sampleLabel,
        postfix: ' ',
        value: [{ value: target, color: TYPING_COLOR.sample }]
      }
    }
    const game: ITypingGame = {
      gameId,
      passages,
      level,
      levelCount: passages.length,
      lang,
      inputLabel: lang.inputLabel,
      chars,
      state: 'idle',
      startedAt: 0,
      finishedAt: 0,
      lastStatus: chars.map(() => 0),
      lastStatsText: '',
      timer: undefined,
      run
    }
    const statsInit = buildStatsText(game, 0, 0)
    const elementList: IElement[] = [
      // 前置换行，避免与文档末段挤在同一行
      { value: '\n' },
      { value: title, bold: true, color: TYPING_COLOR.title },
      { value: '\n' },
      sampleControl,
      { value: '\n' },
      // 判定行：与范文同文浅灰，随输入逐字符变绿/变红
      ...chars.map((char, i) => ({
        value: char,
        conceptId: feedbackConceptId(gameId, i),
        color: TYPING_COLOR.pending
      })),
      { value: '\n' },
      // 统计条：固定槽位单字符元素，更新走安全的 updateElementById 路径
      ...padStatsSlots(statsInit).map((char, i) => ({
        value: char,
        conceptId: statsSlotConceptId(gameId, i),
        color: TYPING_COLOR.stats
      })),
      { value: '\n' },
      { value: lang.inputLabel, color: TYPING_COLOR.label }
    ]
    // 追加到文档末尾，不依赖当前光标；追加完成后光标停在文档末尾（输入行）
    command.executeAppendElementList(elementList)
    gameRegistry.set(gameId, game)
    const docEnd = command.getRange().startIndex
    command.executeSetRange(docEnd, docEnd)
    command.executeFocus()
    // 追加的新关卡可能在视口下方，把光标滚入可视区中央
    command
      .getContainer()
      .querySelector('.ce-cursor')
      ?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }

  command.executeTyping = (options?: ITypingGameOption) => {
    const lang = getLang(options)
    // 题目完全由外部传入：单次调用 passages 优先，其次插件默认题目
    const passages = (
      options?.passages?.length
        ? options.passages
        : defaultOptions?.passages || []
    )
      .map(p => String(p).trim())
      .filter(p => p)
    const singlePassage = options?.text?.trim()
    const finalPassages = singlePassage ? [singlePassage] : passages
    if (!finalPassages.length) {
      console.warn(
        '[canvas-editor-plugin-typing] passages is required: configure it via plugin options or executeTyping options'
      )
      return
    }
    insertLevel(
      finalPassages,
      0,
      {
        levelCount: finalPassages.length,
        results: []
      },
      lang
    )
  }
}

export default typingPlugin
