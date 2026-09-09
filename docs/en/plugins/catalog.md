# Catalog

Catalog (outline) plugin. Pass a mount container DOM when registering; the catalog renders inside it and fills the container — its placement and size are fully decided by your layout (sidebar, tool area, etc.).

Catalog features:

- **Level indent**: items are indented by heading level (first to sixth), one heading per line
- **Click to locate**: click a catalog item to jump to the corresponding title
- **Scroll follow**: while scrolling the document, the chapter at the current browsing position is highlighted automatically
- **Cursor sync**: when you click or move the cursor in the editor, the chapter containing the cursor is highlighted automatically
- **Auto refresh**: the catalog refreshes automatically when the document content changes (debounced 300ms)

## Installation

```bash
npm install @hufe921/canvas-editor-plugin-catalog
```

## Usage

```javascript
import Editor from '@hufe921/canvas-editor'
import catalogPlugin from '@hufe921/canvas-editor-plugin-catalog'

const instance = new Editor()
instance.use(catalogPlugin, {
  container: document.querySelector('#sidebar')
})
```

## Parameters

Options when registering the plugin:

| Parameter | Type                    | Required | Description                                                            |
| --------- | ----------------------- | -------- | ---------------------------------------------------------------------- |
| container | HTMLElement             | Yes      | Mount container; the catalog renders inside it and fills the container |
| locale    | string                  | No       | Catalog language (built-in zhCN and en), defaults to the editor locale |
| lang      | Partial\<ICatalogLang\> | No       | Overrides the catalog text of the corresponding language               |

```javascript
instance.use(catalogPlugin, {
  container: document.querySelector('#sidebar'),
  locale: 'en',
  lang: {
    emptyText: 'No headings yet'
  }
})
```

## Type Definition

```typescript
interface ICatalogLang {
  // Panel title text
  titleText: string
  // Placeholder text when no headings exist
  emptyText: string
}
```

## Notes

- The catalog data comes from the title elements in the document and refreshes automatically when the content changes
- The catalog and its event listeners are removed automatically when the editor is destroyed (`editor.destroy()`)
