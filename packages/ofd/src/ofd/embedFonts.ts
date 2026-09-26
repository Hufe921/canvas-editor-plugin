interface EmbedFontDef {
  file: string
  // FontFile 内 name 表的家族名，需与 familyName 一致避免阅读器二次匹配失败
  family: string
  // 覆盖的内建非嵌入字体键
  keys: string[]
}

const EMBED_FONTS: EmbedFontDef[] = [
  {
    file: 'NotoSansSC-Regular.ttf',
    family: 'Noto Sans SC',
    keys: ['simhei']
  },
  {
    file: 'NotoSerifSC-Regular.ttf',
    family: 'Noto Serif SC',
    keys: ['simsun', 'kaiti', 'fangsong']
  }
]

// 候选来源：同源静态目录（自托管 / vite dev base）、unpkg CDN 兜底
const DEFAULT_FONT_BASES = [
  '/fonts',
  '/ofd/fonts',
  'https://unpkg.com/@hufe921/canvas-editor-plugin-ofd@latest/dist/fonts'
]

// 字节缓存（含失败缓存，避免每次导出重复请求）
const fontBytesCache = new Map<string, Uint8Array | null>()

async function fetchFontBytes(
  file: string,
  bases: string[]
): Promise<Uint8Array | null> {
  for (const base of bases) {
    try {
      const res = await fetch(`${base.replace(/\/$/, '')}/${file}`)
      if (!res.ok) continue
      const buffer = await res.arrayBuffer()
      if (buffer.byteLength < 1024) continue
      return new Uint8Array(buffer)
    } catch {
      // 尝试下一个来源
    }
  }
  return null
}

export interface FontRegistrar {
  addFontTtf(
    postScriptName: string,
    fontName: string,
    ttfData: Uint8Array
  ): string
}

// 按完整地址获取字体字节（带缓存，含失败缓存）
export async function fetchFontUrl(url: string): Promise<Uint8Array | null> {
  if (fontBytesCache.has(url)) {
    return fontBytesCache.get(url) ?? null
  }
  let bytes: Uint8Array | null = null
  try {
    const res = await fetch(url)
    if (res.ok) {
      const buffer = await res.arrayBuffer()
      if (buffer.byteLength >= 1024) {
        bytes = new Uint8Array(buffer)
      }
    }
  } catch {
    // 地址不可达：返回 null 由调用方告警
  }
  fontBytesCache.set(url, bytes)
  return bytes
}

// 拉取默认字体并注册；任何失败仅告警并退回非嵌入模式（不阻塞导出）
export async function registerDefaultEmbedFonts(
  doc: FontRegistrar,
  baseUrl?: string | null
): Promise<void> {
  if (baseUrl === null) return
  const bases = baseUrl ? [baseUrl] : DEFAULT_FONT_BASES
  // 并行拉取后统一注册（串行会叠加两个字体的下载耗时）
  const loaded = await Promise.all(
    EMBED_FONTS.map(async def => {
      let bytes = fontBytesCache.get(def.file)
      if (bytes === undefined) {
        bytes = await fetchFontBytes(def.file, bases)
        fontBytesCache.set(def.file, bytes)
      }
      return { def, bytes: bytes ?? null }
    })
  )
  for (const { def, bytes } of loaded) {
    if (bytes) {
      for (const key of def.keys) {
        doc.addFontTtf(key, def.family, bytes)
      }
    } else {
      console.warn(
        `[canvas-editor-plugin-ofd] 默认嵌入字体 ${def.file} 获取失败，` +
          '当前导出依赖阅读器本机字体，中文可能显示异常；' +
          '可通过 embedFonts 选项传入字体字节，或将字体文件部署后设置 fontBaseUrl'
      )
    }
  }
}

// 预取默认字体：仅填充字节缓存（不依赖文档实例），供使用方在空闲时机
// 调用以消除首次导出的字体下载等待；不影响页面首屏（由调用方选择时机）
export async function prefetchOfdFonts(baseUrl?: string): Promise<void> {
  const bases = baseUrl ? [baseUrl] : DEFAULT_FONT_BASES
  await Promise.all(
    EMBED_FONTS.map(async def => {
      if (!fontBytesCache.has(def.file)) {
        fontBytesCache.set(def.file, await fetchFontBytes(def.file, bases))
      }
    })
  )
}
