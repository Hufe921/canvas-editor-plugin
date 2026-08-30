import {
  Editor,
  EditorComponent,
  EDITOR_COMPONENT
} from '@hufe921/canvas-editor'
import type { IRangeStyle } from '@hufe921/canvas-editor'
import './style'
import {
  CARD_GAP,
  DEFAULT_HIGHLIGHT_COLOR,
  DEFAULT_LINE_COLOR,
  DEFAULT_LOCALE,
  DEFAULT_RAIL_WIDTH,
  DEFAULT_USER_COLOR,
  PLUGIN_LANG_MAP,
  PLUGIN_PREFIX
} from './constant'
import type { IComment, ICommentLang, ICommentOptions } from './interface'

declare module '@hufe921/canvas-editor' {
  interface Command {
    executeAddComment(): void
    executeRemoveComment(id?: string): void
    executeGetCommentList(): IComment[]
    executeSetCommentList(list: IComment[]): void
  }
}

interface IPendingEdit {
  groupId: string
  startIndex: number
  endIndex: number
  card: HTMLDivElement
  top: number
}

interface ILayoutItem {
  id: string
  anchorX: number
  anchorY: number
  card: HTMLDivElement
  fixedTop?: number
  top: number
}

const SVG_NS = 'http://www.w3.org/2000/svg'

export default function commentPlugin(
  editor: Editor,
  defaultOptions?: ICommentOptions
) {
  const command = editor.command
  const container = command.getContainer()
  // 批注元数据，key 为成组 groupId
  const commentMap = new Map<string, IComment>()
  // 已渲染的批注卡片，key 为批注 id
  const cardMap = new Map<string, HTMLDivElement>()
  let activeCommentId: string | null = null
  // 新增批注编辑态（编辑中卡片位置固定）
  let pendingEdit: IPendingEdit | null = null

  const railWidth = defaultOptions?.railWidth || DEFAULT_RAIL_WIDTH
  const lineColor = defaultOptions?.lineColor || DEFAULT_LINE_COLOR

  // 国际化：优先插件默认 locale 配置，其次编辑器 locale 配置，回退 zhCN
  const getLang = (): ICommentLang => {
    // 低版本编辑器无 command.getOptions 方法，做兼容处理
    const editorLocale = (command as any).getOptions?.().locale as
      string | undefined
    const currentLocale = (
      defaultOptions?.locale ||
      editorLocale ||
      DEFAULT_LOCALE
    )
      .toLowerCase()
      .replace(/[-_]/g, '')
    const sourceLang =
      Object.entries(PLUGIN_LANG_MAP).find(
        ([key]) => key.toLowerCase() === currentLocale
      )?.[1] || PLUGIN_LANG_MAP[DEFAULT_LOCALE]
    return {
      ...sourceLang,
      ...defaultOptions?.lang
    }
  }

  // 右侧批注栏（无批注时隐藏）
  const rail = document.createElement('div')
  rail.setAttribute(EDITOR_COMPONENT, EditorComponent.COMPONENT)
  rail.classList.add(`${PLUGIN_PREFIX}-rail`)
  rail.style.width = `${railWidth}px`
  rail.style.display = 'none'

  // 连接线 SVG 覆盖层（无批注时隐藏）
  const lineLayer = document.createElementNS(SVG_NS, 'svg')
  lineLayer.setAttribute(EDITOR_COMPONENT, EditorComponent.COMPONENT)
  lineLayer.classList.add(`${PLUGIN_PREFIX}-line-layer`)
  lineLayer.style.display = 'none'

  // 批注栏挂在编辑器根容器（编辑器容器的父元素）中：
  // 编辑器会把容器宽度强制设为页面宽度（Draw._formatContainer），
  // 容器内不存在页面右侧空白区，挂容器内必然压页面
  const root = container.parentElement
  const mountRoot = root || container
  // 绝对定位需要非 static 的包含块，轻度侵入消费方节点
  if (getComputedStyle(mountRoot).position === 'static') {
    mountRoot.style.position = 'relative'
  }
  mountRoot.append(lineLayer, rail)

  // 找最近的滚动祖先作为可视视口（无则退化为窗口）
  const getScrollViewport = () => {
    let el = container.parentElement
    while (el && el !== document.body) {
      const overflowY = getComputedStyle(el).overflowY
      if (overflowY === 'auto' || overflowY === 'scroll') {
        return { top: el.getBoundingClientRect().top, height: el.clientHeight }
      }
      el = el.parentElement
    }
    return { top: 0, height: window.innerHeight }
  }

  // 停靠批注栏：容器宽度即页面宽度，容器右缘即页面右缘；
  // 高度对齐可视滚动视口（mountRoot 不一定是视口高度）
  const dockRail = () => {
    const rootRect = mountRoot.getBoundingClientRect()
    // 停靠在页面右缘之外 8px（用实时 rect 换算，兼容任意祖先滚动/偏移）
    const railLeft = container.getBoundingClientRect().right - rootRect.left + 8
    // 垂直方向对齐可视视口。注意：绝对定位的子元素处于 mountRoot 的
    // 内容坐标系，mountRoot 自身就是滚动容器时要补回它的 scrollTop，
    // 批注栏才能钉在可视区域而不是随内容滚走
    const viewport = getScrollViewport()
    const railTop = viewport.top - rootRect.top + mountRoot.scrollTop
    rail.style.top = `${railTop}px`
    rail.style.bottom = 'auto'
    rail.style.height = `${viewport.height}px`
    lineLayer.style.top = `${railTop}px`
    lineLayer.style.height = `${viewport.height}px`
    if (railLeft + railWidth <= mountRoot.clientWidth) {
      rail.style.left = `${railLeft}px`
      rail.style.right = 'auto'
      rail.classList.remove(`${PLUGIN_PREFIX}-rail--overlay`)
    } else {
      // 根容器宽度不足以容纳批注栏时以半透明浮层贴右缘覆盖
      rail.style.left = 'auto'
      rail.style.right = '0'
      rail.classList.add(`${PLUGIN_PREFIX}-rail--overlay`)
    }
  }
  dockRail()

  // 从一组 groupIds 中匹配已知批注 id
  const matchCommentId = (
    groupIds: string[] | null | undefined
  ): string | undefined => groupIds?.find(id => commentMap.has(id))

  // 清除批注文档标记：高亮 + 成组
  const removeCommentMark = (id: string) => {
    const main = command.getValue().data.main
    let first = -1
    let last = -1
    main.forEach((element, index) => {
      if (element.groupIds?.includes(id)) {
        if (first < 0) first = index
        last = index
      }
    })
    if (first < 0) return
    command.executeSetRange(first, last)
    command.executeHighlight(null)
    command.executeDeleteGroup(id)
  }

  const getCommentIdAtCursor = (): string | undefined => {
    const { startIndex } = command.getRange()
    const main = command.getValue().data.main
    // 光标处取前后元素，兼容光标落在批注边界的情况
    return (
      matchCommentId(main[startIndex]?.groupIds) ||
      matchCommentId(main[startIndex - 1]?.groupIds)
    )
  }

  // 时间格式缩短为 M/D HH:mm
  const formatTime = (iso: string): string => {
    const date = new Date(iso)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${date.getMonth() + 1}/${date.getDate()} ${pad(
      date.getHours()
    )}:${pad(date.getMinutes())}`
  }

  // 创建批注查看卡片（作者/时间/内容 + 删除按钮）
  const createViewCard = (comment: IComment): HTMLDivElement => {
    const lang = getLang()
    const card = document.createElement('div')
    card.setAttribute(EDITOR_COMPONENT, EditorComponent.COMPONENT)
    card.classList.add(`${PLUGIN_PREFIX}-card`)

    // 右上角 × 删除按钮
    const closeBtn = document.createElement('button')
    closeBtn.classList.add(`${PLUGIN_PREFIX}-card__close`)
    closeBtn.innerText = '×'
    closeBtn.title = lang.removeCommentText
    closeBtn.onclick = evt => {
      evt.stopPropagation()
      command.executeRemoveComment(comment.id)
    }

    const header = document.createElement('div')
    header.classList.add(`${PLUGIN_PREFIX}-card__header`)
    const userSpan = document.createElement('span')
    userSpan.classList.add(`${PLUGIN_PREFIX}-card__user`)
    userSpan.innerText = comment.user || ''
    userSpan.style.color = defaultOptions?.userColor || DEFAULT_USER_COLOR
    const timeSpan = document.createElement('span')
    timeSpan.classList.add(`${PLUGIN_PREFIX}-card__time`)
    timeSpan.innerText = formatTime(comment.createdAt)
    header.append(userSpan, timeSpan)

    const content = document.createElement('div')
    content.classList.add(`${PLUGIN_PREFIX}-card__content`)
    content.innerText = comment.content

    card.append(closeBtn, header, content)
    // 点击卡片定位到批注文本
    card.onclick = () => {
      command.executeLocationGroup(comment.id)
    }
    return card
  }

  // 重布局：卡片防重叠排布 + 连接线重绘
  const layout = () => {
    // rect.y 是纯内容坐标（主仓 getPageOffset 只累加页高，不含滚动）。
    // 排布在内容坐标系计算；渲染时换算为「相对可视视口」的坐标——
    // 批注栏/连线层已钉在视口顶部，offsetY = 文档原点的视口相对位置，
    // 与滚动发生在哪个元素上彻底解耦
    const containerRect = container.getBoundingClientRect()
    const viewport = getScrollViewport()
    const offsetY = containerRect.top - container.scrollTop - viewport.top
    const baseX =
      containerRect.left -
      mountRoot.getBoundingClientRect().left -
      container.scrollLeft
    const items: ILayoutItem[] = []
    const visibleIds = new Set<string>()

    // 收集可见批注锚点（取第一个矩形的右边缘中点）
    commentMap.forEach((comment, id) => {
      const rect = command.getGroupRectList(id)?.[0]
      if (!rect) return
      let card = cardMap.get(id)
      if (!card) {
        card = createViewCard(comment)
        cardMap.set(id, card)
        rail.append(card)
      }
      card.classList.toggle(
        `${PLUGIN_PREFIX}-card--active`,
        id === activeCommentId
      )
      visibleIds.add(id)
      items.push({
        id,
        anchorX: baseX + rect.x + rect.width,
        anchorY: rect.y + rect.height / 2,
        card,
        top: 0
      })
    })

    // 编辑中卡片参与排布但位置固定
    if (pendingEdit) {
      const rect = command.getGroupRectList(pendingEdit.groupId)?.[0]
      if (rect) {
        items.push({
          id: pendingEdit.groupId,
          anchorX: baseX + rect.x + rect.width,
          anchorY: rect.y + rect.height / 2,
          card: pendingEdit.card,
          fixedTop: pendingEdit.top,
          top: pendingEdit.top
        })
      }
    }

    // 移除已不可见的卡片（批注删除或矩形丢失）
    cardMap.forEach((card, id) => {
      if (!visibleIds.has(id)) {
        card.remove()
        cardMap.delete(id)
      }
    })

    // 无可见批注时隐藏批注栏与连接线层
    const hasVisible = items.length > 0
    rail.style.display = hasVisible ? '' : 'none'
    lineLayer.style.display = hasVisible ? '' : 'none'
    if (!hasVisible) {
      lineLayer.innerHTML = ''
      return
    }

    // 先停靠批注栏，再取其真实左缘
    dockRail()
    const railLeftX = rail.offsetLeft

    // 按锚点 y 排序，防重叠下推（内容坐标系）
    items.sort((a, b) => a.anchorY - b.anchorY)
    let prevBottom: number | null = null
    items.forEach(item => {
      if (item.fixedTop == null) {
        item.top = Math.max(
          item.anchorY,
          prevBottom == null ? 0 : prevBottom + CARD_GAP
        )
      }
      // 渲染时换算为可视 y
      item.card.style.top = `${item.top + offsetY}px`
      prevBottom = item.top + item.card.offsetHeight
    })

    // 重绘连接线（可视坐标系）：先从文本水平到批注栏前的固定通道 x，再斜插进卡片。
    // 斜线段起点 x 固定、两端 y 均按序单调，多条批注时不会交叉（WPS 同款规则）
    lineLayer.innerHTML = ''
    const channelX = railLeftX - 16
    items.forEach(item => {
      const cardLeftX = railLeftX + item.card.offsetLeft
      const anchorViewY = item.anchorY + offsetY
      const centerViewY = item.top + item.card.offsetHeight / 2 + offsetY
      // 锚点在通道右侧时（浮层兜底场景）省略水平段，直接斜连
      const d =
        item.anchorX < channelX
          ? `M ${item.anchorX} ${anchorViewY} L ${channelX} ${anchorViewY} L ${cardLeftX} ${centerViewY}`
          : `M ${item.anchorX} ${anchorViewY} L ${cardLeftX} ${centerViewY}`
      const path = document.createElementNS(SVG_NS, 'path')
      path.setAttribute('d', d)
      path.setAttribute('fill', 'none')
      path.setAttribute('stroke', lineColor)
      const isActive = item.id === activeCommentId
      // 默认细虚线，光标所在批注的连接线加粗并转实线
      path.setAttribute('stroke-width', isActive ? '1.5' : '1')
      if (!isActive) {
        path.setAttribute('stroke-dasharray', '4 3')
      }
      lineLayer.append(path)
    })
  }

  // 回滚新增批注：清除高亮并解除成组
  const rollbackPendingEdit = () => {
    if (!pendingEdit) return
    const { groupId, startIndex, endIndex, card } = pendingEdit
    pendingEdit = null
    card.remove()
    command.executeSetRange(startIndex, endIndex)
    command.executeHighlight(null)
    command.executeDeleteGroup(groupId)
    layout()
  }

  // 新增批注编辑卡片
  const showEditCard = (
    groupId: string,
    startIndex: number,
    endIndex: number
  ) => {
    const rect = command.getGroupRectList(groupId)?.[0]
    if (!rect) {
      // 取不到矩形直接回滚
      command.executeSetRange(startIndex, endIndex)
      command.executeHighlight(null)
      command.executeDeleteGroup(groupId)
      return
    }
    const lang = getLang()
    const card = document.createElement('div')
    card.setAttribute(EDITOR_COMPONENT, EditorComponent.COMPONENT)
    card.classList.add(
      `${PLUGIN_PREFIX}-card`,
      `${PLUGIN_PREFIX}-card--editing`
    )

    // 头部行与查看卡片一致：作者名 + 当前时间
    const header = document.createElement('div')
    header.classList.add(`${PLUGIN_PREFIX}-card__header`)
    const userSpan = document.createElement('span')
    userSpan.classList.add(`${PLUGIN_PREFIX}-card__user`)
    userSpan.innerText = defaultOptions?.user || ''
    userSpan.style.color = defaultOptions?.userColor || DEFAULT_USER_COLOR
    const timeSpan = document.createElement('span')
    timeSpan.classList.add(`${PLUGIN_PREFIX}-card__time`)
    timeSpan.innerText = formatTime(new Date().toISOString())
    header.append(userSpan, timeSpan)

    const textarea = document.createElement('textarea')
    textarea.classList.add(`${PLUGIN_PREFIX}-card__textarea`)
    textarea.placeholder = lang.placeholderText
    // 输入时自适应高度并刷新连接线
    textarea.oninput = () => {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.max(textarea.scrollHeight, 60)}px`
      layout()
    }

    const footer = document.createElement('div')
    footer.classList.add(`${PLUGIN_PREFIX}-card__footer`)

    const cancelBtn = document.createElement('button')
    cancelBtn.classList.add(`${PLUGIN_PREFIX}-card__button`)
    cancelBtn.innerText = lang.cancelText
    cancelBtn.onclick = evt => {
      evt.stopPropagation()
      rollbackPendingEdit()
    }

    const confirmBtn = document.createElement('button')
    confirmBtn.classList.add(
      `${PLUGIN_PREFIX}-card__button`,
      `${PLUGIN_PREFIX}-card__button--primary`
    )
    confirmBtn.innerText = lang.confirmText
    confirmBtn.onclick = evt => {
      evt.stopPropagation()
      const content = textarea.value.trim()
      if (!content) {
        textarea.focus()
        return
      }
      const comment: IComment = {
        id: groupId,
        content,
        createdAt: new Date().toISOString(),
        user: defaultOptions?.user
      }
      commentMap.set(groupId, comment)
      defaultOptions?.onAdd?.(comment)
      // 恢复选区，便于后续操作
      command.executeSetRange(startIndex, endIndex)
      // 编辑卡片移除，重布局渲染正式卡片
      pendingEdit?.card.remove()
      pendingEdit = null
      layout()
    }

    footer.append(cancelBtn, confirmBtn)
    card.append(header, textarea, footer)

    // 内容坐标系的固定位置，可视位置由 layout 统一渲染
    const top = Math.max(rect.y + rect.height / 2, 0)
    rail.append(card)
    pendingEdit = { groupId, startIndex, endIndex, card, top }
    layout()
    textarea.focus()
  }

  command.executeAddComment = () => {
    const { startIndex, endIndex } = command.getRange()
    if (!~startIndex || !~endIndex || startIndex === endIndex) return
    // 存在编辑中的批注先回滚
    rollbackPendingEdit()
    // 成组作为批注范围标记
    const groupId = command.executeSetGroup()
    if (!groupId) return
    command.executeHighlight(
      defaultOptions?.highlightColor || DEFAULT_HIGHLIGHT_COLOR
    )
    showEditCard(groupId, startIndex, endIndex)
  }

  command.executeRemoveComment = (id?: string) => {
    const commentId = id || getCommentIdAtCursor()
    if (!commentId || !commentMap.has(commentId)) return
    commentMap.delete(commentId)
    removeCommentMark(commentId)
    defaultOptions?.onRemove?.(commentId)
    if (activeCommentId === commentId) {
      activeCommentId = null
    }
    layout()
  }

  command.executeGetCommentList = () => Array.from(commentMap.values())

  command.executeSetCommentList = (list: IComment[]) => {
    commentMap.clear()
    list.forEach(comment => commentMap.set(comment.id, comment))
    layout()
  }

  // 注册右键菜单
  const lang = getLang()
  editor.register.contextMenuList([
    {
      name: lang.addCommentText,
      when: context => context.editorHasSelection && !context.isReadonly,
      callback: () => {
        command.executeAddComment()
      }
    },
    {
      name: lang.removeCommentText,
      when: context =>
        !context.isReadonly && !!matchCommentId(context.startElement?.groupIds),
      callback: (_command, context) => {
        const id = matchCommentId(context.startElement?.groupIds)
        if (id) {
          command.executeRemoveComment(id)
        }
      }
    }
  ])

  // 光标所在批注高亮强调
  editor.eventBus.on('rangeStyleChange', (payload: IRangeStyle) => {
    activeCommentId = matchCommentId(payload.groupIds) || null
    layout()
  })

  // 孤儿清理 + 内容变化重布局
  editor.eventBus.on('contentChange', () => {
    if (commentMap.size) {
      const existingIds = new Set<string>()
      command.getValue().data.main.forEach(element => {
        element.groupIds?.forEach(id => existingIds.add(id))
      })
      Array.from(commentMap.keys()).forEach(id => {
        // 内容删除导致的消失，不触发 onRemove
        if (!existingIds.has(id)) {
          commentMap.delete(id)
        }
      })
    }
    layout()
  })

  // 缩放变化重布局
  editor.eventBus.on('pageScaleChange', () => {
    layout()
  })

  // 页面尺寸变化重新停靠
  editor.eventBus.on('pageSizeChange', () => {
    layout()
  })

  // 任意祖先元素滚动都要重布局（document 捕获阶段监听，rAF 节流）
  let layoutRafId = 0
  document.addEventListener(
    'scroll',
    () => {
      if (layoutRafId) return
      layoutRafId = requestAnimationFrame(() => {
        layoutRafId = 0
        layout()
      })
    },
    true
  )

  // 容器尺寸变化重新停靠 + 重布局（插件无销毁钩子，观察器随容器销毁回收）
  const resizeObserver = new ResizeObserver(() => {
    layout()
  })
  resizeObserver.observe(mountRoot)
}

export type { IComment, ICommentLang, ICommentOptions }
