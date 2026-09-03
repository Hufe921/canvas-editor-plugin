import { Editor, ElementType, IElement } from '@hufe921/canvas-editor'
import katex from 'katex'
import katexCSS from 'katex/dist/katex.min.css?inline'
import { IFormulaLang, IFormulaOption } from './interface'
import { DEFAULT_LOCALE, PLUGIN_LANG_MAP } from './constant'

declare module '@hufe921/canvas-editor' {
  interface Command {
    executeInsertFormula(latex: string): Promise<void>
  }
}

// 文档内注入的 KaTeX 样式元素 id
const KATEX_STYLE_ELEMENT_ID = 'canvas-editor-plugin-formula-katex-style'

interface IFormulaSize {
  width: number
  height: number
}

// 剔除 woff/truetype 格式字体，仅保留 woff2，减小内联体积
function keepOnlyWoff2Font(css: string): string {
  return css.replace(
    /,?\s*url\([^)]*\)\s*format\(['"](?:woff|truetype)['"]\)/g,
    ''
  )
}

const katexWoff2CSS = keepOnlyWoff2Font(katexCSS)

// 向文档注入 KaTeX 样式，用于离屏渲染测量公式尺寸
function injectKatexStyle() {
  if (document.getElementById(KATEX_STYLE_ELEMENT_ID)) return
  const style = document.createElement('style')
  style.id = KATEX_STYLE_ELEMENT_ID
  style.textContent = katexWoff2CSS
  document.head.appendChild(style)
}

let fontEmbeddedCSSPromise: Promise<string> | null = null

function convertURLToDataURI(url: string): Promise<string> {
  return fetch(url)
    .then(response => response.blob())
    .then(
      blob =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(blob)
        })
    )
}

// SVG 作为图片加载时处于隔离环境，无法访问外部资源，
// 需将样式中引用的字体转换为 dataURI 内联
function getFontEmbeddedCSS(): Promise<string> {
  if (!fontEmbeddedCSSPromise) {
    fontEmbeddedCSSPromise = (async () => {
      const urlReg = /url\((['"]?)(?!data:)([^'")]+)\1\)/g
      const urlList = [...katexWoff2CSS.matchAll(urlReg)].map(match => match[2])
      const dataURIList = await Promise.all(urlList.map(convertURLToDataURI))
      return katexWoff2CSS.replace(urlReg, () => `url(${dataURIList.shift()})`)
    })()
  }
  return fontEmbeddedCSSPromise
}

// 预加载全部 KaTeX 字体，仅在首次测量时执行一次
let fontsLoadedPromise: Promise<unknown> | null = null
function loadKatexFonts(): Promise<unknown> {
  if (!fontsLoadedPromise) {
    injectKatexStyle()
    const loadList: Promise<unknown>[] = []
    document.fonts.forEach(fontFace => {
      loadList.push(fontFace.load().catch(() => null))
    })
    fontsLoadedPromise = Promise.all(loadList)
  }
  return fontsLoadedPromise
}

// 离屏渲染公式并测量自然尺寸
async function measureFormula(html: string): Promise<IFormulaSize> {
  injectKatexStyle()
  const container = document.createElement('div')
  container.style.cssText =
    'position:fixed;top:0;left:0;visibility:hidden;pointer-events:none;z-index:-1;'
  const wrapper = document.createElement('div')
  wrapper.style.display = 'inline-block'
  wrapper.innerHTML = html
  container.appendChild(wrapper)
  document.body.appendChild(container)
  // 预加载全部 KaTeX 字体（仅首次生效），确保测量结果准确
  await loadKatexFonts()
  const rect = wrapper.getBoundingClientRect()
  container.remove()
  return {
    width: Math.max(Math.ceil(rect.width), 1),
    height: Math.max(Math.ceil(rect.height), 1)
  }
}

function buildFormulaSVG(
  latex: string,
  html: string,
  css: string,
  size: IFormulaSize
): string {
  return (
    // LaTeX 源码存放在 data-latex 属性中，随 SVG 图片一同持久化，用于二次编辑
    `<svg xmlns="http://www.w3.org/2000/svg" data-latex="${encodeURIComponent(
      latex
    )}" width="${size.width}" height="${size.height}">` +
    `<foreignObject width="100%" height="100%">` +
    `<div xmlns="http://www.w3.org/1999/xhtml">` +
    `<style>${css}</style>` +
    `<div>${html}</div>` +
    `</div>` +
    `</foreignObject>` +
    `</svg>`
  )
}

// 从公式图片值（SVG dataURL）中提取 LaTeX 源码
function extractFormulaLatex(value: string): string | null {
  if (!value.startsWith('data:image/svg+xml')) return null
  const match = value.match(/data-latex%3D%22(.*?)%22/)
  if (!match) return null
  try {
    return decodeURIComponent(decodeURIComponent(match[1]))
  } catch {
    return null
  }
}

// 渲染 LaTeX 为内嵌字体的 SVG 图片
async function renderFormula(
  latex: string
): Promise<{ value: string } & IFormulaSize> {
  const html = katex.renderToString(latex, {
    throwOnError: true,
    output: 'html',
    displayMode: false
  })
  const size = await measureFormula(html)
  const css = await getFontEmbeddedCSS()
  const svg = buildFormulaSVG(latex, html, css, size)
  return {
    value: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
    ...size
  }
}

// 打开公式编辑弹窗，确认后回调新的 LaTeX 源码
function openFormulaEditor(
  latex: string,
  lang: IFormulaLang,
  onConfirm: (latex: string) => void
) {
  const overlay = document.createElement('div')
  overlay.style.cssText =
    'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.3);display:flex;align-items:flex-start;justify-content:center;'
  const panel = document.createElement('div')
  panel.style.cssText =
    'margin-top:120px;background:#fff;border-radius:4px;box-shadow:0 2px 12px rgba(0,0,0,.15);padding:16px;width:420px;box-sizing:border-box;'
  const textarea = document.createElement('textarea')
  textarea.value = latex
  textarea.rows = 4
  textarea.style.cssText =
    'width:100%;box-sizing:border-box;resize:vertical;font-family:monospace;font-size:13px;line-height:1.5;padding:8px;border:1px solid #dcdfe6;border-radius:4px;outline:none;'
  const error = document.createElement('div')
  error.style.cssText =
    'display:none;color:#f54a45;font-size:12px;margin-top:8px;word-break:break-all;'
  const footer = document.createElement('div')
  footer.style.cssText =
    'display:flex;justify-content:flex-end;gap:8px;margin-top:12px;'
  const cancelButton = document.createElement('button')
  cancelButton.textContent = lang.cancelText
  cancelButton.style.cssText =
    'padding:6px 16px;font-size:13px;border:1px solid #dcdfe6;border-radius:4px;background:#fff;cursor:pointer;'
  const confirmButton = document.createElement('button')
  confirmButton.textContent = lang.confirmText
  confirmButton.style.cssText =
    'padding:6px 16px;font-size:13px;border:none;border-radius:4px;background:#5175f4;color:#fff;cursor:pointer;'
  const close = () => overlay.remove()
  cancelButton.onclick = close
  overlay.onmousedown = evt => {
    if (evt.target === overlay) close()
  }
  confirmButton.onclick = () => {
    const value = textarea.value.trim()
    if (!value) {
      close()
      return
    }
    // 校验 LaTeX 语法，非法时提示且不关闭弹窗
    try {
      katex.renderToString(value, { throwOnError: true })
    } catch (err) {
      error.textContent = `${lang.errorText}: ${(err as Error).message}`
      error.style.display = 'block'
      return
    }
    close()
    onConfirm(value)
  }
  footer.append(cancelButton, confirmButton)
  panel.append(textarea, error, footer)
  overlay.appendChild(panel)
  document.body.appendChild(overlay)
  textarea.focus()
}

export default function formulaPlugin(
  editor: Editor,
  options: IFormulaOption = {}
) {
  const command = editor.command

  // 国际化：优先插件 locale 配置，其次编辑器 locale 配置，回退 zhCN
  const getLang = (): IFormulaLang => {
    // 低版本编辑器（<1.0.2）无 command.getOptions 方法，做兼容处理
    const editorLocale = (command as any).getOptions?.().locale as
      | string
      | undefined
    const currentLocale = (options.locale || editorLocale || DEFAULT_LOCALE)
      .toLowerCase()
      .replace(/[-_]/g, '')
    const sourceLang =
      Object.entries(PLUGIN_LANG_MAP).find(
        ([key]) => key.toLowerCase() === currentLocale
      )?.[1] || PLUGIN_LANG_MAP[DEFAULT_LOCALE]
    return {
      ...sourceLang,
      ...options.lang
    }
  }

  // 插入行内公式
  command.executeInsertFormula = async (latex: string) => {
    const formula = await renderFormula(latex)
    const element: IElement = {
      type: ElementType.IMAGE,
      ...formula
    }
    command.executeInsertElementList([element])
  }

  // 公式编辑右键菜单
  const { isRegisterEditContextMenu = true } = options
  if (isRegisterEditContextMenu) {
    editor.register.contextMenuList([
      {
        name: getLang().editMenuText,
        when: payload => {
          const element = payload.startElement
          return (
            !payload.isReadonly &&
            payload.startElement === payload.endElement &&
            element?.type === ElementType.IMAGE &&
            !!element.value &&
            extractFormulaLatex(element.value) !== null
          )
        },
        callback: (_, context) => {
          const element = context.startElement
          const latex = element?.value
            ? extractFormulaLatex(element.value)
            : null
          if (!element || latex === null) return
          openFormulaEditor(latex, getLang(), async newLatex => {
            try {
              const formula = await renderFormula(newLatex)
              // 原地更新公式元素，保持文档内位置不变
              element.width = formula.width
              element.height = formula.height
              command.executeReplaceImageElement(formula.value)
            } catch (err) {
              console.error(err)
            }
          })
        }
      }
    ])
  }
}
