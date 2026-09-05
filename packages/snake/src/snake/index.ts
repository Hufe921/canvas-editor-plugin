import {
  BlockType,
  ControlType,
  Editor,
  ElementType
} from '@hufe921/canvas-editor'
import type { IElement } from '@hufe921/canvas-editor'
import {
  createSnakeGameHTML,
  DEFAULT_HEIGHT,
  DEFAULT_SPEED,
  DEFAULT_THEME,
  DEFAULT_WIDTH,
  SNAKE_MESSAGE_TYPE,
  SNAKE_SCORE_MESSAGE_TYPE
} from './constant'
import type { ISnakeGameOption, ISnakeOption, ISnakeResult } from './interface'

declare module '@hufe921/canvas-editor' {
  interface Command {
    executeSnake(options?: ISnakeGameOption): void
  }
}

// 生成元素 id（非安全上下文下 crypto.randomUUID 不可用时降级）
function createUUID(): string {
  return (
    globalThis.crypto?.randomUUID?.() ||
    `${Date.now()}-${Math.random().toString(36).slice(2)}`
  )
}

interface IScoreControl {
  blockId: string
  controlId: string
}

function makeScoreValue(result: ISnakeResult): IElement[] {
  return [
    {
      value: `🏆 得分 ${result.score} 分 · ⏱ ${result.duration} 秒`,
      color: '#16a34a',
      bold: true
    }
  ]
}

function snakePlugin(editor: Editor, defaultOptions?: ISnakeOption) {
  const command = editor.command
  // 记录每局游戏的游戏区与实时成绩控件
  const gameRegistry = new Map<string, IScoreControl>()

  function updateLiveLine(
    gameId: string,
    result: ISnakeResult,
    refocus = true
  ) {
    const entry = gameRegistry.get(gameId)
    if (!entry) return
    // 该局游戏区已被删除时不再更新
    if (!command.getElementById({ id: entry.blockId }).length) return
    // 通过控件值原地更新，不触碰光标与选区，不打断游戏焦点
    command.executeSetControlValue({
      id: entry.controlId,
      value: makeScoreValue(result),
      isSubmitHistory: false
    })
    if (!refocus) return
    // 控件重绘会把键盘焦点抢回编辑器的隐藏输入框，且抢焦点发生在渲染的
    // rAF 回调中——延迟归还焦点以覆盖它，保证方向键持续可控
    window.setTimeout(() => {
      const iframe = editor.command
        .getContainer()
        .querySelector<HTMLIFrameElement>(`iframe[data-id="${entry.blockId}"]`)
      iframe?.focus()
      iframe?.contentWindow?.focus()
    }, 80)
  }

  const watchMessage = (evt: MessageEvent) => {
    const data = evt.data
    if (!data || typeof data.type !== 'string' || !data.gameId) return
    if (
      data.type !== SNAKE_MESSAGE_TYPE &&
      data.type !== SNAKE_SCORE_MESSAGE_TYPE
    ) {
      return
    }
    const result = {
      score: Number(data.score) || 0,
      duration: Number(data.duration) || 0
    }
    // 游玩中的分数更新需要把焦点还给游戏；游戏结束的最后一次更新则把焦点留在文档
    updateLiveLine(data.gameId, result, data.type === SNAKE_SCORE_MESSAGE_TYPE)
    if (data.type === SNAKE_MESSAGE_TYPE) {
      defaultOptions?.onGameOver?.(result)
    }
  }
  window.addEventListener('message', watchMessage)

  command.executeSnake = (options?: ISnakeGameOption) => {
    const width = options?.width ?? defaultOptions?.width ?? DEFAULT_WIDTH
    const height = options?.height ?? defaultOptions?.height ?? DEFAULT_HEIGHT
    const speed = options?.speed ?? defaultOptions?.speed ?? DEFAULT_SPEED
    const theme = { ...DEFAULT_THEME, ...defaultOptions?.theme }
    const gameId = createUUID()
    const blockId = createUUID()
    const controlId = createUUID()
    // 编辑器从未建立光标时插入会被静默跳过，兜底定位到文档末尾
    const { startIndex } = command.getRange()
    if (startIndex < 0) {
      const end = Math.max(0, command.getValue().data.main.length - 1)
      command.executeSetRange(end, end)
    }
    const element: IElement = {
      id: blockId,
      type: ElementType.BLOCK,
      value: '',
      width,
      height,
      block: {
        type: BlockType.IFRAME,
        iframeBlock: {
          srcdoc: createSnakeGameHTML({ gameId, width, height, speed, theme })
        }
      }
    }
    // 游戏区上方插入文本控件存放成绩，游玩时由游戏消息实时驱动控件值更新
    // prefix/postfix 用空格替代默认的 { } 边框
    const scoreControl: IElement = {
      controlId,
      type: ElementType.CONTROL,
      value: '',
      control: {
        type: ControlType.TEXT,
        prefix: ' ',
        postfix: ' ',
        value: makeScoreValue({ score: 0, duration: 0 })
      }
    }
    // 先插一个换行符，保证成绩控件与游戏区独立成行、不拆散光标所在语句
    command.executeInsertElementList([{ value: '\n' }, scoreControl])
    command.executeInsertElementList([element])
    gameRegistry.set(gameId, { blockId, controlId })
  }
}

export default snakePlugin
