# Comment

Comment plugin based on the editor's group mechanism, with Word-style presentation: commented ranges are marked with a highlight color, comment cards are listed in a margin rail on the right side of the editor, and each highlighted range is connected to its card with a dashed connector line. The card and connector of the comment under the cursor are emphasized. Comments can be added/removed via the context menu, and clicking a card locates the corresponding text.

## Installation

```bash
npm install @hufe921/canvas-editor-plugin-comment
```

## Usage

```javascript
import Editor from '@hufe921/canvas-editor'
import commentPlugin from '@hufe921/canvas-editor-plugin-comment'

const instance = new Editor()
instance.use(commentPlugin, {
  highlightColor?: string,
  railWidth?: number,
  lineColor?: string,
  userColor?: string,
  user?: string,
  locale?: string,
  lang?: Partial<ICommentLang>,
  onAdd?: (comment: IComment) => void,
  onRemove?: (id: string) => void
})
```

## Commands

```javascript
// Add a comment to the current selection (pops up an input card)
command.executeAddComment()

// Remove a comment; removes the comment at the cursor when id is omitted
command.executeRemoveComment(id?: string)

// Get the comment list (for persistence)
const list = command.executeGetCommentList()

// Restore the comment list (must match groupIds in the document)
command.executeSetCommentList(list)
```

## Options

| Option         | Type                    | Description                                                             |
| -------------- | ----------------------- | ----------------------------------------------------------------------- |
| highlightColor | string                  | Optional, comment highlight color, default `#fde7e9`                    |
| railWidth      | number                  | Optional, width of the right comment rail (px), default 220             |
| lineColor      | string                  | Optional, connector line color, default `#f54a45`                       |
| userColor      | string                  | Optional, author name color on the comment card, default `#f54a45`      |
| user           | string                  | Optional, current user name (stored in comment metadata)                |
| locale         | string                  | Optional, popup language (built-in zhCN, en), defaults to editor locale |
| lang           | Partial\<ICommentLang\> | Optional, override popup texts of the corresponding language            |
| onAdd          | function                | Optional, callback when a comment is added                              |
| onRemove       | function                | Optional, callback when a comment is removed                            |

## Type Definitions

```typescript
interface IComment {
  // Comment id, i.e. the editor group groupId
  id: string
  content: string
  createdAt: string
  user?: string
}

interface ICommentLang {
  // Context menu - add comment
  addCommentText: string
  // Context menu / card button - remove comment
  removeCommentText: string
  // Comment input placeholder
  placeholderText: string
  // Confirm button text
  confirmText: string
  // Cancel button text
  cancelText: string
}
```

## Notes

- The comment range is marked via the editor group; comment metadata (content/author/time) is maintained in plugin memory. For persistence, save the list via `executeGetCommentList` / `executeSetCommentList` together with the document data.
- When the comment range is removed by document edits, the plugin automatically cleans up the corresponding comment metadata.
- The comment rail is rendered inside the editor root container, in the blank area to the right of the page (no reserved width needed, never overlapping the document); when the root container is not wide enough to hold the rail, it is displayed as a semi-transparent overlay.

## Example

```javascript
instance.use(commentPlugin, {
  user: 'John',
  onAdd: comment => {
    console.log('comment added', comment)
  },
  onRemove: id => {
    console.log('comment removed', id)
  }
})
```
