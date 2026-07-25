---
name: stacks-cli
description: Use when building CLI commands or tools with Stacks — the @stacksjs/cli package for creating commands with argument parsing, option handling, colored output, tables, progress indicators, prompts, or integrating with the buddy command system. Covers @stacksjs/cli and app/Commands/.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks CLI Framework

The `@stacksjs/cli` package provides the foundation for building CLI commands, used internally by the buddy CLI.

## Key Paths
- Core package: `storage/framework/core/cli/src/`
- CLI configuration: `config/cli.ts`
- Application commands: `app/Commands/`
- Command registry: `app/Commands.ts`

## Creating Commands

### Simple Command
```typescript
// app/Commands/Greet.ts
export default {
  name: 'greet',
  description: 'Greet a user',
  alias: 'g',
  options: {
    name: { alias: 'n', description: 'Name to greet', default: 'World' },
    loud: { alias: 'l', description: 'Shout the greeting', type: 'boolean' }
  },
  handle: async ({ options }) => {
    const greeting = `Hello, ${options.name}!`
    console.log(options.loud ? greeting.toUpperCase() : greeting)
  }
}
```

### Register in app/Commands.ts
```typescript
export default {
  'greet': 'Greet',
  'inspire': 'Inspire',
}
```

### Three Registration Methods
1. **app/Commands.ts** — name → file mapping
2. **Event listeners** — CLI events in `app/Listeners/Console.ts`
3. **Inline** — direct command definitions

## CLI Event Listeners

```typescript
// app/Listeners/Console.ts
export default function(cli: CLI) {
  cli.on('custom:command', () => {
    console.log('Custom command executed!')
  })

  cli.on('my:*', () => {
    // Wildcard — matches my:anything
  })

  cli.on('unknown:!', () => {
    // Default/fallback handler
  })
}
```

## Output Formatting

Via `@stacksjs/utils` color functions (available in CLI context):
```typescript
import { bold, green, red, yellow, dim, underline } from '@stacksjs/utils'

console.log(green('✓ Success'))
console.log(red('✗ Error'))
console.log(yellow('⚠ Warning'))
console.log(bold('Important'))
console.log(dim('Subtle info'))
```

## config/cli.ts (BinaryConfig)

```typescript
{
  name: 'My Custom CLI',
  command: 'mycli',
  description: 'My custom CLI tool',
  deploy: true
}
```

## CLI Commands
- `buddy make:command [name]` — scaffold a new command

## Compiled Binaries

```bash
buddy build:cli                    # build CLI binary
# Compiles for: linux-x64, linux-arm64, windows-x64, darwin-x64, darwin-arm64
```

## Gotchas
- Application commands go in `app/Commands/`, framework commands in `storage/framework/core/buddy/src/commands/`
- Commands are auto-discovered from `app/Commands.ts` registry
- CLI events support wildcards (`*`) and default handlers (`!`)
- The buddy CLI lazy-loads commands — not all load at startup
- Output formatting uses ANSI colors from `@stacksjs/utils`
- Custom CLIs can be compiled to platform-specific binaries
- The CLI framework is separate from buddy — buddy uses it internally
