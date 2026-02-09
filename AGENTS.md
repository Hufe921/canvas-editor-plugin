# AGENTS.md - Agentic Coding Guidelines

## Project Overview

This is a **monorepo** for canvas-editor plugins. It uses:
- **Package Manager**: pnpm (with workspaces)
- **Monorepo Tool**: Lerna
- **Language**: TypeScript
- **Build Tool**: Vite (with @rollup/plugin-typescript)
- **Linting**: ESLint with @typescript-eslint
- **Formatting**: Prettier

## Build / Lint / Test Commands

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Build single package
cd packages/<name> && pnpm build

# Development mode (all packages)
pnpm dev

# Type checking (all packages)
pnpm type:check

# Lint all packages
pnpm lint

# Lint auto-fix
pnpm lint -- --fix

# Test all packages
pnpm test

# Clean node_modules
pnpm clean

# Clean dist folders
pnpm clean:dist
```

### Running Single Package Commands

Each package is independent. To work on a single package:

```bash
cd packages/barcode1d  # or any package
pnpm dev       # Start dev server
pnpm build     # Build the package
pnpm type:check # TypeScript check
```

## Code Style Guidelines

### TypeScript Configuration
- **Target**: ESNext
- **Module**: ESNext (type: "module")
- **Strict mode**: Enabled
- **Unused locals/parameters**: Error
- **Implicit returns**: Error

### Formatting (Prettier)
- **Semicolons**: Never
- **Quotes**: Single
- **Print width**: 80
- **Trailing commas**: None
- **Arrow parens**: Avoid
- **End of line**: LF

### ESLint Rules
- Semicolons: Never (warning)
- Quotes: Single (warning)
- Console: Allowed
- Explicit any: Allowed
- Non-null assertions: Allowed
- Empty interfaces: Allowed
- `@ts-comment`: Allowed

### Naming Conventions
- **Files**: camelCase (e.g., `importDocx.ts`, `exportDocx.ts`)
- **Functions**: camelCase
- **Constants**: UPPER_SNAKE_CASE for true constants
- **Enums**: PascalCase for name, UPPER for values or camelCase strings
- **Types/Interfaces**: PascalCase
- **Plugin functions**: camelCase ending with "Plugin" (e.g., `barcodePlugin`, `docxPlugin`)

### Import Style
```typescript
// Use single quotes
import { Editor, ElementType } from '@hufe921/canvas-editor'
import Editor from '@hufe921/canvas-editor'
import exportDocx from './exportDocx'

// Use @rollup/plugin-typescript for building
// External deps are marked in vite.config.ts rollupOptions.external
```

### Code Patterns

#### Plugin Structure
```typescript
import { Editor } from '@hufe921/canvas-editor'

declare module '@hufe921/canvas-editor' {
  interface Command {
    executeMyCommand(): void
  }
}

export default function myPlugin(editor: Editor) {
  const command = editor.command
  command.executeMyCommand = () => {
    // implementation
  }
}
```

#### Comments
- Use `// ` for inline comments (with Chinese allowed in existing code)
- Keep comments concise

## Git Hooks

- **pre-commit**: Runs `npm run lint`
- **commit-msg**: Validates commit message format

## Commit Message Format

Format: `<type>(<scope>): <subject>`

**Types:** feat, fix, docs, dx, style, refactor, perf, test, workflow, build, ci, chore, types, wip, release, improve

**Examples:**
```
feat: add new plugin for diagrams
fix: correct barcode rendering offset
refactor(barcode1d): simplify svg conversion
```

**Revert:**
```
revert: feat: add diagram plugin
```

## Package Structure

Each package follows this structure:
```
packages/<name>/
├── src/
│   ├── main.ts              # Entry point
│   └── <name>/
│       ├── index.ts         # Main plugin
│       ├── interface/       # TypeScript interfaces
│       ├── enum/            # Enums
│       ├── constant/        # Constants
│       └── style/           # CSS/styles
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## VS Code Settings

Recommended settings (in `.vscode/settings.json`):
- Format on save: Enabled
- Default formatter: esbenp.prettier-vscode
- Fix ESLint on save: Enabled
- TypeScript SDK: node_modules/typescript/lib
