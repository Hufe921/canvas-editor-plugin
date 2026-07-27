/**
 * canvas-editor-pdf 浏览器平台实现模块
 *
 * 本模块提供浏览器环境下的平台抽象实现，
 * Node 环境下应替换为基于 `@napi-rs/canvas` 的实现。
 */

/**
 * 字体信息接口
 */
export interface IPlatformFont {
  fileName: string
  base64: string
  id: string
  type: string
}

/**
 * 平台抽象接口
 */
export interface IPlatform {
  defaultFontSource: 'cdn' | 'bundled'
  createMeasurementCanvas(): HTMLCanvasElement
  createCanvas(width: number, height: number): HTMLCanvasElement
  getBundledFontPath(fileName: string): string
  loadFontAsBase64(source: string): Promise<string>
  registerFontForMeasurement(font: IPlatformFont, base64: string): void
  svgToPngDataUrl(svg: string, width: number, height: number): Promise<string>
}

/**
 * 浏览器平台实现
 *
 * Node 环境下若未注入 `globalThis.document` 会抛错，
 * 使用方在 Node 中应替换为基于 `@napi-rs/canvas` 的实现。
 */
export const platform: IPlatform = {
  defaultFontSource: 'cdn',

  /**
   * 创建测量用 canvas 元素
   *
   * @returns HTMLCanvasElement 实例
   */
  createMeasurementCanvas(): HTMLCanvasElement {
    return document.createElement('canvas')
  },

  /**
   * 创建指定尺寸的 canvas 元素
   *
   * @param width canvas 宽度
   * @param height canvas 高度
   * @returns HTMLCanvasElement 实例
   */
  createCanvas(width: number, height: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    return canvas
  },

  /**
   * 获取打包字体路径
   *
   * 浏览器构建不支持 'bundled' 模式，会抛出错误。
   *
   * @param fileName 字体文件名
   * @returns 字体路径（浏览器环境下会抛出错误）
   * @throws Error 浏览器环境不支持 bundled 模式
   */
  getBundledFontPath(fileName: string): string {
    throw new Error(
      `fontSource 'bundled' is not supported in the browser build (looking up ${fileName}). ` +
        `Use 'cdn' (default) or host the TTFs and pass { dir: '/your/url/base' }.`
    )
  },

  /**
   * 从 URL 加载字体文件并转换为 base64 编码
   *
   * @param source 字体文件 URL
   * @returns base64 编码的字体数据
   * @throws Error 字体加载失败时抛出错误
   */
  async loadFontAsBase64(source: string): Promise<string> {
    const response = await fetch(source)
    if (!response.ok) {
      throw new Error(
        `Font fetch failed: ${response.status} ${response.statusText}`
      )
    }
    const blob = await response.blob()
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const dataUrl = reader.result as string
        const base64 = dataUrl.split('base64,')[1]
        resolve(base64)
      }
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(blob)
    })
  },

  /**
   * 注册字体用于测量
   *
   * 浏览器环境下测量直接走 DOM canvas，无需预注册字体，故为空实现。
   *
   * @param font 字体信息
   * @param base64 base64 编码的字体数据
   */
  registerFontForMeasurement(): void {
    // no-op: browser 测量直接走 DOM canvas，无需预注册字体
  },

  /**
   * 将 SVG 字符串转换为 PNG 图片的 data URL
   *
   * 用于 LaTeX 元素的渲染，将 SVG 公式转换为图片。
   *
   * @param svg SVG 字符串
   * @param width 目标宽度
   * @param height 目标高度
   * @returns PNG 图片的 data URL
   * @throws Error SVG 转换失败时抛出错误
   */
  svgToPngDataUrl(svg: string, width: number, height: number): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')!
      const img = new Image()
      img.onload = () => {
        ctx.clearRect(0, 0, width, height)
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/png'))
      }
      img.onerror = () =>
        reject(new Error('canvas-editor-pdf: failed to rasterize SVG'))
      img.src = svg.startsWith('data:image/svg+xml')
        ? svg
        : 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)))
    })
  }
}
