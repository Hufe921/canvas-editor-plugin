# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is a monorepo for canvas-editor plugins, managed with Lerna and pnpm workspaces. Each plugin is a separate package under `packages/`.

## Common Commands

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build
# or: lerna run build

# Build single package
cd packages/<name> && pnpm build

# Development mode (runs all packages in dev mode)
pnpm dev

# Type checking
pnpm type:check

# Linting
pnpm lint

# Clean all node_modules
pnpm clean

# Clean all dist folders
pnpm clean:dist
```

## Package Structure

Each plugin in `packages/` follows this structure:

```
packages/<name>/
├── package.json              # Package config with name @hufe921/canvas-editor-plugin-<name>
├── vite.config.ts            # Vite config for building (lib mode)
├── tsconfig.json             # Extends ../../tsconfig.json
├── src/
│   ├── main.ts               # Dev/test entry point
│   └── <name>/
│       ├── index.ts          # Main plugin export (default function)
│       ├── index.css         # Plugin styles
│       ├── interface/        # TypeScript interfaces
│       └── ...
└── dist/                     # Build output
```

## Plugin Architecture

A typical plugin follows this pattern:

```typescript
import { Editor, EDITOR_COMPONENT, EditorComponent } from '@hufe921/canvas-editor'
import './index.css'

declare module '@hufe921/canvas-editor' {
  interface Command {
    executePluginName(options?: IPluginOption): void
  }
}

class PluginClass {
  constructor(options?: IPluginOption) {
    // Create dialog/UI
  }

  private createDialog() {
    // Must set attribute for editor integration:
    element.setAttribute(EDITOR_COMPONENT, EditorComponent.COMPONENT)
  }
}

export default function pluginName(editor: Editor) {
  editor.command.executePluginName = (options) => {
    new PluginClass(options)
  }
}
```

Key patterns:
- Extend `Command` interface via module declaration
- Export default function that receives `Editor` instance
- Add command method to `editor.command`
- Use `EDITOR_COMPONENT` and `EditorComponent.COMPONENT` attributes on UI elements
- CSS is injected via `vite-plugin-css-injected-by-js`
- External dependency: `@hufe921/canvas-editor` (not bundled)

## Build Configuration

Each package uses Vite with lib mode:
- Entry: `src/<name>/index.ts`
- Output: `dist/<name>.js` and `dist/<name>.umd.cjs`
- Types: `dist/src/<name>/index.d.ts`
- CSS injected into JS bundle

## Release Workflow

```bash
# 1. Build all packages
pnpm build

# 2. Publish (lerna handles versioning)
pnpm release:publish    # from-git
# or
pnpm release:package    # from-package
```

## Git Hooks

Pre-commit runs linting. Commit messages are verified via `scripts/verifyCommit.js`.

## Existing Plugins Reference

See `README.md` for list of all plugins and their usage examples.

Key examples:
- **diagram**: Complex dialog with iframe communication
- **specialCharacters**: Dialog with category tabs
- **menstrualHistory**: Custom form layout with fraction display
- **case**: Simple command without UI (uppercase/lowercase)
