---
name: stacks-enums
description: Use when working with framework constants in a Stacks application — NpmScript commands, Action identifiers, or any enumerated constants used across the build system, CLI, and actions. Covers @stacksjs/enums.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Enums

## Key Paths
- Core package: `storage/framework/core/enums/src/`
- Source: `storage/framework/core/enums/src/index.ts`
- Package: `@stacksjs/enums`

## NpmScript Enum (45 values)

Used by the CLI and build system to run specific npm scripts:

```typescript
import { NpmScript } from '@stacksjs/enums'
```

### Build Scripts
| Value | Script |
|-------|--------|
| `Build` | `'build'` |
| `BuildComponents` | `'vite build --config ./src/vite-config/src/components.ts'` |
| `BuildWebComponents` | `'build:web-components'` |
| `BuildFunctions` | `'build:functions'` |
| `BuildDocs` | `'build:docs'` |
| `BuildStacks` | `'build:stacks'` |

### Dev Scripts
| Value | Script |
|-------|--------|
| `Dev` | `'dev'` |
| `DevApi` | `'dev:api'` |
| `DevDocs` | `'dev:docs'` |
| `DevDesktop` | `'dev:desktop'` |
| `DevFunctions` | `'dev:functions'` |

### Test Scripts
| Value | Script |
|-------|--------|
| `Test` | `'test'` |
| `TestUnit` | `'test:unit'` |
| `TestFeature` | `'test:feature'` |
| `TestUi` | `'test:ui'` |
| `TestTypes` | `'test:types'` |

### Maintenance Scripts
`Clean`, `Fresh`, `Lint`, `LintFix`, `Upgrade`, `Generate`, `GenerateTypes`, `GenerateEntries`, `GenerateWebTypes`, `GenerateIdeHelpers`, `GenerateComponentMeta`, `Commit`, `Release`, `KeyGenerate`, `Preinstall`, `Prepublish`

## Action Enum (60+ values)

Used to dispatch framework actions via the action runner:

```typescript
import { Action } from '@stacksjs/enums'
```

### Build Actions
`BuildViews`, `BuildStacks`, `BuildComponentLibs`, `BuildVueComponentLib`, `BuildWebComponentLib`, `BuildFunctionLib`, `BuildCli`, `BuildCore`, `BuildDesktop`, `BuildDocs`, `BuildServer`

### Dev Actions
`DevComponents`, `DevDashboard`, `DevSystemTray`, `Dev`, `DevApi`, `DevDesktop`, `DevDocs`

### Database Actions
`Migrate`, `MigrateFresh`, `MigrateDns`, `Seed`

### Queue Actions
`QueueTable`, `QueueWork`, `QueueRetry`, `QueueFailed`, `QueueClear`, `QueueStatus`, `QueueFlush`, `QueueMonitor`, `QueueInspect`, `QueueSchedule`, `QueueScheduleList`

### Domain Actions
`DomainsAdd`, `DomainsPurchase`, `DomainsRemove`

### Search Engine Actions
`SearchEngineImport`, `SearchEngineFlush`, `SearchEngineListSettings`, `SearchEnginePushSettings`

### Other Actions
`Lint`, `LintFix`, `Test`, `TestUnit`, `TestFeature`, `TestUi`, `Typecheck`, `Deploy`, `ScheduleRun`, `Release`, `RouteList`, `Upgrade`, `UpgradeDeps`

## Usage

```typescript
import { Action, NpmScript } from '@stacksjs/enums'

// Used in buddy CLI commands
runAction(Action.Migrate, options)

// Used in build system
runNpmScript(NpmScript.BuildComponents)
```

## Gotchas
- **Action values use path format** — e.g., `Action.BuildViews = 'build/views'`, `Action.QueueWork = 'queue/work'`
- **NpmScript values are actual script commands** — some are full vite commands, not just script names
- **Used throughout the framework** — CLI, build system, and actions all reference these enums
- **Adding new actions** — requires adding the enum value AND creating the action handler file
