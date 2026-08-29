---
name: stacks-cli
description: Use when building CLI commands or tools with Stacks - the @stacksjs/cli package for creating commands with argument parsing, option handling, colored output, tables, progress indicators, prompts, or integrating with the buddy command system. Covers @stacksjs/cli and app/Commands/.
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
- Optional registry: `app/Commands.ts` (not needed - see below)

## Creating Commands

Every `.ts` file in `app/Commands/` is a command. There is no registration step
and no generated registry file: drop the file in and it is live, nested
directories included (`app/Commands/Archive/Run.ts`).

### Declarative form (preferred)

`defineCommand()` infers the handler's `options` from the flags declared above
it, so there is no hand-written options interface to drift out of step.

```typescript
// app/Commands/Greet.ts
import { defineCommand, log } from '@stacksjs/cli'

export default defineCommand({
  name: 'greet <who>',
  description: 'Greet a user',
  aliases: ['g'],
  options: {
    '--loud, -l': { description: 'Shout the greeting', default: false },
    '--title <title>': 'Prefix the name',
    '--times <n>': { description: 'How often', default: 1, type: [Number] },
  },
  handle(options, who) {
    // options.loud   -> boolean
    // options.title  -> string | undefined
    // options.times  -> number
    const greeting = `Hello, ${options.title ?? ''}${who}!`

    for (let i = 0; i < options.times; i++)
      log.info(options.loud ? greeting.toUpperCase() : greeting)
  },
})
```

Flag to property: `--dry-run` -> `dryRun`, `--two, -t` -> `two`, `--no-cache`
-> `cache`. Value type: `<x>` -> `string`, `[x]` -> `string | true`, `<x...>`
-> `string[]`, no argument -> `boolean`. A `default` makes the property always
present; a `type: [Number]` makes it a `number`.

### Imperative form

For a file that registers several commands or needs `cli.on()`:

```typescript
import { defineCommand, log } from '@stacksjs/cli'

export default defineCommand((cli) => {
  cli.command('inspire', 'Inspire yourself').alias('insp').action(() => {})
  cli.command('inspire:two', 'Two quotes').action(() => {})

  cli.on('inspire:*', () => log.error('Invalid command'))
})
```

### Per-file configuration

Named exports beside the default one, so a command owns its own configuration:

```typescript
export const aliases = ['emails', 'mail'] // extra aliases
export const enabled = false              // keep the file, hide the command
```

### The optional registry (`app/Commands.ts`)

Only worth keeping when you want to control the order commands are listed in,
or to alias/disable a command without editing its file. A command file the
registry never mentions still loads.

```typescript
import { defineCommands } from '@stacksjs/cli'

export default defineCommands({
  'send-emails <type>': { file: 'SendEmails', aliases: ['emails'] },
  'legacy': { file: 'Legacy', enabled: false },
})
```

### Registration Methods
1. **Drop a file in `app/Commands/`** — auto-discovered, nothing else to do
2. **Event listeners** — CLI events in `app/Listeners/Console.ts`
3. **`app/Commands.ts`** — optional, for ordering / aliases / disabling

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
- Commands are auto-discovered from `app/Commands/`; `app/Commands.ts` is optional and additive
- CLI events support wildcards (`*`) and default handlers (`!`)
- The buddy CLI lazy-loads commands — not all load at startup
- Output formatting uses ANSI colors from `@stacksjs/utils`
- Custom CLIs can be compiled to platform-specific binaries
- The CLI framework is separate from buddy — buddy uses it internally
