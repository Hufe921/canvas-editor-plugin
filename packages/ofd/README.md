<h1 align="center">canvas-editor-plugin-ofd</h1>

<p align="center">ofd plugin for canvas-editor（基于 @hufe921/jsofd，GB/T 33190-2016 版式文档导入/导出）</p>

## usage

```bash
npm i @hufe921/canvas-editor-plugin-ofd --save
```

```javascript
import Editor from '@hufe921/canvas-editor'
import ofdPlugin from '@hufe921/canvas-editor-plugin-ofd'

const instance = new Editor(container, {
  main: []
})
instance.use(ofdPlugin)

// 导入 OFD（.ofd 文件的 ArrayBuffer）
instance.command.executeImportOfd({
  arrayBuffer: buffer
})

// 导出 OFD（触发浏览器下载，并返回 Blob）
const blob = await instance.command.executeExportOfd({
  fileName: 'canvas-editor'
})
```

## 导出 options

```typescript
interface IExportOfdOption {
  fileName: string
  // 自定义嵌入字体（TTF 字节），family 需与编辑器中使用的字体名一致
  // （且与字体文件内部 name 表家族名一致）；与默认 Noto 嵌入并存，同名覆盖
  embedFonts?: { family: string; data: ArrayBuffer | Uint8Array }[]
  // 默认嵌入字体的获取地址前缀（目录需包含 NotoSansSC-Regular.ttf、
  // NotoSerifSC-Regular.ttf）；默认依次尝试同源 /fonts、/ofd/fonts 与
  // unpkg CDN；传 null 关闭默认嵌入（退回本机字体名引用，可能出现乱码）
  fontBaseUrl?: string | null
}
```

### 任意字体的处理策略

- **内置中文字体**（微软雅黑/苹方/黑体/宋体/楷体/仿宋）：自动映射到宋/黑/楷/仿宋，
  默认嵌入 Noto 字体渲染
- **其他字体**（如霞鹜文楷、阿里巴巴普惠体）：以原字体名写入 OFD——阅读器本机
  有该字体则正常显示，没有则替换（导出时控制台告警提示）；需要保证任何设备
  渲染一致时，通过 `embedFonts` 嵌入，多个自定义字体各自独立注册、同内容自动去重：

```typescript
await instance.command.executeExportOfd({
  fileName: 'doc',
  embedFonts: [
    // 地址方式：插件拉取并缓存（适合部署在静态服务/CDN 的字体）
    { family: 'LXGW WenKai', url: '/fonts/LXGW-WenKai.ttf' },
    // 字节方式：适合打包进应用或用户上传的字体（与 url 二选一，优先级更高）
    { family: 'Alibaba PuHuiTi', data: puhuiTtfArrayBuffer }
  ]
})
```

## 导入 options

```typescript
interface IImportOfdOption {
  arrayBuffer: ArrayBuffer
  // 追加模式：导入内容插入到当前文档末尾，不覆盖已有内容
  isAppend?: boolean
}
```

## features

### 导出

- 文本：加粗、斜体、颜色、高亮、上下标、下划线、删除线、字间距、中英文混排自动断行
- 段落：左/中/右对齐、两端对齐、行距与页边距跟随编辑器配置
- 标题（含书签大纲）、有序/无序列表、分隔线（支持虚线）、分页符
- 表格：合并单元格（colspan/rowspan）、单元格背景、垂直对齐、跨页按行拆分
- 图片（内联与浮动定位）、公式（LaTeX SVG 栅格化）
- 复选框/单选框、超链接（链接注释）、控件（文本/复选/单选，含占位与签名线）
- 页面信息完整处理：
  - 页边距、纸张尺寸与横竖向
  - 页眉：从 `header.top` 排版、`disabled`/`disabledPages` 按页禁用
  - 页脚：底对齐 `footer.bottom`、按页禁用
  - 页码：基线 `pageNumber.bottom`、`fromPageNo` 起始页、`startPageNo`、
    中文页码（含总页数转换）、`{pageNo}`/`{pageCount}` 模板
  - 水印（文字旋转/平铺、图片水印）
  - 页面配置以 OFD 标准附件（`canvas-editor.json`）写入包内，供导入精确还原
- 自动分页，逐字坐标（DeltaX）精确定位

### 导入

- 文本样式（字体/字号/加粗/斜体/颜色）、行/段落结构按坐标聚类还原
- 图片（PNG/JPEG/GIF/BMP）、分页符
- 页眉/页脚自动剥离（不再混入正文），页码行还原为页码模板
- 旋转文本还原为编辑器水印（内容/颜色/透明度/字号）
- 页面信息还原：
  - 本插件导出的文件：通过附件精确还原页边距、页眉/页脚（含禁用状态与
    按页禁用）、页码（位置/起始页/中文页码）、水印、默认字体字号
  - 第三方 OFD：还原页面尺寸与横竖向；页码无则禁用、有则还原模板与位置；
    边距按正文范围保守推断（上/左取正文起点，下/右仅当内容覆盖过半时采用）

> OFD 是固定版式格式，导入按坐标重排为流式内容：表格还原为文本（无边框）、
> 下划线/高亮等装饰不还原；导出时被断行的英文单词导入后表现为换行。

## notes

- 输出基于 [jsOFD](https://github.com/hufe921/jsOFD)（jsPDF 风格 API 的 OFD 生成库），产物符合 GB/T 33190-2016
- **默认嵌入 Noto Sans SC / Noto Serif SC（TrueType）**：不嵌入字体时渲染依赖阅读器本机
  字体表，中文在数科、WPS 等阅读器中可能乱码/空白；嵌入后所有设备渲染一致。
  字体文件随包发布（`dist/fonts`），运行时按需加载并缓存，同一份字节按内容哈希去重，
  仅实际用到的字体会写入 OFD 包
- 默认字体来源依次为：同源 `/fonts`、`/ofd/fonts`、unpkg CDN；离线环境可通过
  `embedFonts` 直接传入字体字节，或将字体部署到自建静态服务后设置 `fontBaseUrl`
- 导出文件以 DEFLATE 重新打包（jsofd 默认 STORE 不压缩）：嵌入字体的文档约
  2.3MB 降至约 1.4MB；不嵌入字体（`fontBaseUrl: null`）时仅数十 KB
- 公式栅格化与文件导入依赖浏览器环境（`DOMParser`、`Image` + `canvas`）
