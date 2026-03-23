---
name: stacks-scaffolding
description: Use when generating new code with Stacks — buddy make commands, project scaffolding, component/page/store/layout generation, or project templates. Covers buddy make:* commands and STX scaffolding utilities.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Scaffolding

## Key Paths
- Buddy commands: `storage/framework/core/buddy/src/commands/make.ts`
- Default templates: `storage/framework/defaults/`
- STX scaffolding: `@stacksjs/stx` (scaffolding module)

## CLI Make Commands

```bash
buddy make:component <name>     # Create a new STX component
buddy make:function <name>      # Create a new function/composable
buddy make:migration <name>     # Create a new database migration
buddy make:notification <name>  # Create a notification class
buddy make:factory <name>       # Create a model factory
buddy make:lang <name>          # Create a language/locale file
buddy make:stack <name>         # Create a new stack
```

## STX Scaffolding API

```typescript
import { createProject, addComponent, addPage, addStore, addLayout } from '@stacksjs/stx'
```

### Create Project

```typescript
async function createProject(name: string, options?: CreateProjectOptions): Promise<ScaffoldResult>

interface CreateProjectOptions {
  template?: 'default' | 'minimal' | 'full' | 'blog' | 'dashboard' | 'landing'
  skipGit?: boolean
  skipInstall?: boolean
  packageManager?: 'bun' | 'npm' | 'pnpm' | 'yarn'
  typescript?: boolean
  examples?: boolean
  pwa?: boolean
  tailwind?: boolean
}
```

### Add Component

```typescript
async function addComponent(name: string, options?: AddComponentOptions): Promise<ScaffoldResult>

interface AddComponentOptions {
  dir?: string       // Custom directory (default: componentsDir)
  props?: boolean    // Include props section
  styles?: boolean   // Include style block
  script?: boolean   // Include script block
  force?: boolean    // Overwrite existing
}
```

### Add Page

```typescript
async function addPage(name: string, options?: AddPageOptions): Promise<ScaffoldResult>

interface AddPageOptions {
  dir?: string       // Custom directory
  layout?: string    // Layout to use
  dynamic?: boolean  // Dynamic route parameter
  loader?: boolean   // Include data loader
  force?: boolean
}
```

### Add Store

```typescript
async function addStore(name: string, options?: AddStoreOptions): Promise<ScaffoldResult>

interface AddStoreOptions {
  dir?: string
  persist?: boolean   // Persist state to storage
  actions?: boolean   // Include action methods
  force?: boolean
}
```

### Add Layout

```typescript
async function addLayout(name: string, options?: AddLayoutOptions): Promise<ScaffoldResult>

interface AddLayoutOptions {
  dir?: string
  nav?: boolean      // Include navigation
  footer?: boolean   // Include footer
  force?: boolean
}
```

### Scaffold Result

```typescript
interface ScaffoldResult {
  success: boolean
  message: string
  files: string[]     // Created file paths
  errors: string[]
}
```

## Project Templates

| Template | Description |
|----------|-------------|
| `default` | Standard project with common features |
| `minimal` | Bare minimum setup |
| `full` | All features enabled |
| `blog` | Blog-focused with CMS |
| `dashboard` | Admin dashboard |
| `landing` | Marketing landing page |

## Generated File Locations

| Type | Location |
|------|----------|
| Components | `resources/components/` |
| Functions | `resources/functions/` |
| Migrations | `database/migrations/` |
| Notifications | `app/Notifications/` |
| Language files | `locales/` |
| Layouts | `resources/layouts/` |
| Pages | `resources/views/` |
| Stores | `resources/stores/` |

## Default Templates

Templates for generated code are in `storage/framework/defaults/`:
- `defaults/components/` — component templates
- `defaults/models/` — model templates
- `defaults/app/Middleware/` — middleware templates
- `defaults/layouts/` — layout templates
- `defaults/views/` — view templates

## Gotchas
- **Always use make commands** — ensures consistent file structure and naming
- **Templates are customizable** — modify files in `storage/framework/defaults/` to change scaffolding output
- **Run pickier after generating** — `bunx --bun pickier . --fix` to format generated code
- **`force` flag overwrites** — without it, existing files are not overwritten
- **STX scaffolding vs buddy make** — `addComponent()` is the programmatic API, `buddy make:component` is the CLI equivalent
