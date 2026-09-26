# OFD 导入导出

OFD 版式文档（GB/T 33190-2016）的导入和导出插件，基于 [jsOFD](https://github.com/hufe921/jsOFD) 生成标准合规的 OFD 文件，适合电子公文、电子证照等法定场景。

## 安装

```bash
npm install @hufe921/canvas-editor-plugin-ofd
```

## 使用

```javascript
import Editor from '@hufe921/canvas-editor'
import ofdPlugin from '@hufe921/canvas-editor-plugin-ofd'

const instance = new Editor()
instance.use(ofdPlugin)
```

## 导入 OFD

```javascript
command.executeImportOfd({
  arrayBuffer: buffer
})
```

## 导出 OFD

```javascript
await command.executeExportOfd({
  fileName: 'canvas-editor'
})
```

## 参数

### 导入参数

| 参数 | 类型 | 说明 |
|------|------|------|
| arrayBuffer | ArrayBuffer | OFD 文件的 ArrayBuffer |
| isAppend | boolean | 可选。追加模式，导入内容插入到当前文档末尾，不覆盖已有内容 |

### 导出参数

| 参数 | 类型 | 说明 |
|------|------|------|
| fileName | string | 导出的文件名 |
| embedFonts | object[] | 可选。自定义嵌入字体，`{ family, url?, data? }`，字节与地址二选一 |
| fontBaseUrl | string / null | 可选。默认嵌入字体的获取地址前缀；传 `null` 关闭默认嵌入 |

## 字体策略

- **内置中文字体**（微软雅黑/苹方/黑体/宋体/楷体/仿宋）：自动映射并默认嵌入
  Noto 字体，任何设备渲染一致；来源依次尝试同源 `/fonts`、`/ofd/fonts` 与
  unpkg CDN，可通过 `fontBaseUrl` 自定义
- **其他字体**（如霞鹜文楷、阿里巴巴普惠体）：以原字体名写入 OFD，阅读器本机
  有该字体则正常显示；需要保证一致时通过 `embedFonts` 嵌入：

```javascript
await command.executeExportOfd({
  fileName: 'doc',
  embedFonts: [
    // 地址方式：插件拉取并缓存
    { family: 'LXGW WenKai', url: '/fonts/LXGW-WenKai.ttf' },
    // 字节方式：适合打包进应用或用户上传的字体（优先级更高）
    { family: 'Alibaba PuHuiTi', data: puhuiTtfArrayBuffer }
  ]
})
```

::: tip
嵌入字体必须为 TrueType（.ttf）格式，CFF 轮廓的 OTF 会被部分严格阅读器
（数科、WPS）拒绝加载；完整中文字体体积较大（数 MB），建议按需子集化。
:::

## 能力说明

### 导出

- 文本：加粗、斜体、颜色、高亮、上下标、下划线、删除线、字间距、中英文混排断行
- 段落：左/中/右对齐、两端对齐、行距与页边距跟随编辑器
- 标题（含书签大纲）、列表、分隔线、分页符
- 表格：合并单元格、背景色、垂直对齐、跨页按行拆分
- 图片（内联与浮动）、公式（LaTeX SVG 栅格化）
- 复选框/单选框、超链接、控件（含占位与签名线）
- 页面信息：边距、页眉（top/禁用/按页禁用）、页脚、页码
  （bottom/fromPageNo/中文页码）、水印、横竖向
- 页面配置以标准附件写入包内，供导入精确还原

### 导入

- 文本样式与段落结构按坐标聚类还原、图片、分页符
- 页眉/页脚自动剥离、页码还原为模板、旋转文本还原为水印
- 本插件导出的文件可精确还原页面配置；第三方 OFD 保守推断

::: warning
OFD 是固定版式格式，导入按坐标重排为流式内容：表格还原为文本（无边框）、
下划线/高亮等装饰不还原。公式栅格化与导入依赖浏览器环境。
:::
