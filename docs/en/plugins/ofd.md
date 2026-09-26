# OFD Import/Export

Import and export plugin for OFD fixed-layout documents (GB/T 33190-2016), powered by [jsOFD](https://github.com/hufe921/jsOFD). Suitable for official documents, licenses and other statutory scenarios.

## Installation

```bash
npm install @hufe921/canvas-editor-plugin-ofd
```

## Usage

```javascript
import Editor from '@hufe921/canvas-editor'
import ofdPlugin from '@hufe921/canvas-editor-plugin-ofd'

const instance = new Editor()
instance.use(ofdPlugin)
```

## Import OFD

```javascript
command.executeImportOfd({
  arrayBuffer: buffer
})
```

## Export OFD

```javascript
await command.executeExportOfd({
  fileName: 'canvas-editor'
})
```

## Parameters

### Import Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| arrayBuffer | ArrayBuffer | ArrayBuffer of the OFD file |
| isAppend | boolean | Optional. Append mode: insert content at the end of the document instead of replacing it |

### Export Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| fileName | string | Exported file name |
| embedFonts | object[] | Optional. Custom embedded fonts, `{ family, url?, data? }` — provide either bytes or a URL |
| fontBaseUrl | string / null | Optional. Base URL for the default embedded fonts; pass `null` to disable default embedding |

## Font Strategy

- **Built-in Chinese fonts** (Microsoft YaHei / PingFang / SimHei / SimSun / KaiTi /
  FangSong): automatically mapped and embedded with Noto fonts by default so every
  device renders identically. Sources are tried in order: same-origin `/fonts`,
  `/ofd/fonts`, then unpkg CDN; customize with `fontBaseUrl`
- **Other fonts** (e.g. LXGW WenKai, Alibaba PuHuiTi): written into the OFD under
  the original family name — readers render them when installed locally. To guarantee
  consistent rendering, embed them via `embedFonts`:

```javascript
await command.executeExportOfd({
  fileName: 'doc',
  embedFonts: [
    // URL form: fetched and cached by the plugin
    { family: 'LXGW WenKai', url: '/fonts/LXGW-WenKai.ttf' },
    // Bytes form: for bundled or user-uploaded fonts (takes precedence)
    { family: 'Alibaba PuHuiTi', data: puhuiTtfArrayBuffer }
  ]
})
```

::: tip
Embedded fonts must be TrueType (.ttf). CFF-flavored OTF files are rejected by
strict readers such as ShuKe and WPS. Full Chinese fonts are several MB —
subset them when file size matters.
:::

## Capabilities

### Export

- Text: bold, italic, color, highlight, super/subscript, underline, strikethrough,
  letter spacing, CJK/Latin mixed line breaking
- Paragraphs: left/center/right alignment, justification, line height and margins
  following the editor
- Titles (with bookmark outline), lists, separators, page breaks
- Tables: merged cells, cell backgrounds, vertical alignment, row-wise page splitting
- Images (inline and floating), formulas (LaTeX SVG rasterization)
- Checkboxes/radios, hyperlinks, controls (placeholder and signature line)
- Page setup: margins, header (top/disable/per-page), footer, page number
  (bottom/fromPageNo/Chinese numerals), watermark, orientation
- Page setup is written into the package as a standard attachment for exact import

### Import

- Text styles and paragraph structure recovered by coordinate clustering,
  images, page breaks
- Header/footer automatically separated from the body, page numbers recovered
  as templates, rotated text recovered as watermark
- Files exported by this plugin restore the page setup exactly; third-party
  OFD files use conservative inference

::: warning
OFD is a fixed-layout format; import reflows content by coordinates: tables are
recovered as text (without borders), decorations such as underlines and highlights
are not preserved. Formula rasterization and import require a browser environment.
:::
