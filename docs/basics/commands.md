---
title: Commands
description: Learn how to create and use CLI commands in Stacks applications
---

# Commands

Stacks provides a powerful CLI framework for building command-line tools. Commands can automate tasks, run maintenance operations, generate code, and interact with your application from the terminal.

## Introduction

CLI commands in Stacks use a fluent, chainable API inspired by popular CLI libraries. Commands are stored in `app/Commands/` and registered in `app/Commands.ts`. They can be executed using the `buddy` CLI tool.

## Creating Commands

### Basic Command Structure

```typescript
// app/Commands/Inspire.ts
import type { CLI } from '@stacksjs/types'
import process from 'node:process'
import { log, quotes } from '@stacksjs/cli'
import { ExitCode } from '@stacksjs/types'

export default function (cli: CLI) {
  cli
    .command('inspire', 'Inspire yourself with a random quote')
    .action(() => {
      const quote = quotes.random(1).first()
      console.log(`\n"${quote}"\n`)
      process.exit(ExitCode.Success)
    })

  return cli
}
```

### Command with Options

```typescript
// app/Commands/Greet.ts
import type { CLI } from '@stacksjs/types'
import process from 'node:process'
import { ExitCode } from '@stacksjs/types'

interface GreetOptions {
  name: string
  shout: boolean
  times: number
}

export default function (cli: CLI) {
  cli
    .command('greet', 'Greet someone')
    .option('--name, -n <name>', 'Name to greet', { default: 'World' })
    .option('--shout, -s', 'Shout the greeting', { default: false })
    .option('--times, -t <count>', 'Number of times to greet', { default: 1 })
    .action((options: GreetOptions) => {
      for (let i = 0; i < options.times; i++) {
        let message = `Hello, ${options.name}!`
        if (options.shout) {
          message = message.toUpperCase()
        }
        console.log(message)
      }
      process.exit(ExitCode.Success)
    })

  return cli
}
```

### Command with Arguments

```typescript
// app/Commands/Copy.ts
import type { CLI } from '@stacksjs/types'
import { copy } from '@stacksjs/storage'
import { log } from '@stacksjs/cli'

export default function (cli: CLI) {
  cli
    .command('copy <source> <destination>', 'Copy a file')
    .action(async (source: string, destination: string) => {
      try {
        await copy(source, destination)
        log.success(`Copied ${source} to ${destination}`)
      } catch (error) {
        log.error(`Failed to copy: ${error}`)
        process.exit(1)
      }
    })

  return cli
}
```

## Registering Commands

### Command Registry

Register commands in `app/Commands.ts`:

```typescript
// app/Commands.ts
export interface CommandConfig {
  /** The command file name (without .ts extension) */
  file: string
  /** Whether the command is enabled */
  enabled?: boolean
  /** Command aliases */
  aliases?: string[]
}

export type CommandRegistry = Record<string, string | CommandConfig>

export default {
  // Simple registration (file name)
  'inspire': 'Inspire',

  // With configuration
  'greet': {
    file: 'Greet',
    enabled: true,
    aliases: ['hello', 'hi'],
  },

  // Database commands
  'db:seed': {
    file: 'DatabaseSeed',
    enabled: true,
  },

  // Maintenance commands
  'cache:clear': 'CacheClear',
  'queue:work': 'QueueWork',

} satisfies CommandRegistry
```

### File Location

Commands are loaded from `app/Commands/`. The file name should match the value in the registry:

```
app/
  Commands/
    Inspire.ts          # Registered as 'inspire': 'Inspire'
    Greet.ts            # Registered as 'greet': 'Greet'
    DatabaseSeed.ts     # Registered as 'db:seed': 'DatabaseSeed'
    CacheClear.ts       # Registered as 'cache:clear': 'CacheClear'
```

## Arguments

### Required Arguments

Use angle brackets for required arguments:

```typescript
cli.command('user:create <email>', 'Create a new user')
  .action((email: string) => {
    console.log(`Creating user: ${email}`)
  })
```

### Optional Arguments

Use square brackets for optional arguments:

```typescript
cli.command('greet [name]', 'Greet someone')
  .action((name: string = 'World') => {
    console.log(`Hello, ${name}!`)
  })
```

### Variadic Arguments

Use `...` for variadic arguments:

```typescript
cli.command('install <packages...>', 'Install packages')
  .action((packages: string[]) => {
    console.log(`Installing: ${packages.join(', ')}`)
  })
```

### Multiple Arguments

Combine multiple arguments:

```typescript
cli.command('move <source> <destination> [options...]', 'Move files')
  .action((source: string, destination: string, options: string[]) => {
    console.log(`Moving ${source} to ${destination}`)
    if (options.length > 0) {
      console.log(`Options: ${options.join(', ')}`)
    }
  })
```

## Options

### Boolean Options

```typescript
cli.command('build', 'Build the project')
  .option('--verbose, -v', 'Enable verbose output')
  .option('--watch, -w', 'Watch for changes')
  .option('--minify, -m', 'Minify output')
  .action((options) => {
    if (options.verbose) {
      console.log('Verbose mode enabled')
    }
    // Build logic
  })
```

### Options with Values

```typescript
cli.command('serve', 'Start the server')
  .option('--port, -p <port>', 'Port to listen on', { default: 3000 })
  .option('--host, -h <host>', 'Host to bind to', { default: 'localhost' })
  .action((options) => {
    console.log(`Starting server on ${options.host}:${options.port}`)
  })
```

### Required Options

```typescript
cli.command('deploy', 'Deploy the application')
  .option('--environment, -e <env>', 'Deployment environment', { required: true })
  .action((options) => {
    console.log(`Deploying to ${options.environment}`)
  })
```

### Option Types

```typescript
cli.command('process', 'Process data')
  // String option
  .option('--format, -f <format>', 'Output format', { default: 'json' })

  // Number option (parsed automatically)
  .option('--count, -c <count>', 'Number of items', { default: 10 })

  // Boolean option (flag)
  .option('--dry-run, -d', 'Perform dry run')

  // Array option
  .option('--include, -i <patterns...>', 'Patterns to include')

  .action((options) => {
    console.log('Format:', options.format)    // string
    console.log('Count:', options.count)       // number
    console.log('Dry run:', options.dryRun)   // boolean
    console.log('Include:', options.include)   // string[]
  })
```

### Option Validation

```typescript
cli.command('resize', 'Resize an image')
  .option('--width, -w <width>', 'Image width', {
    default: 100,
    validate: (value) => {
      const num = parseInt(value, 10)
      if (isNaN(num) || num < 1) {
        return 'Width must be a positive number'
      }
      return true
    },
  })
  .action((options) => {
    console.log(`Resizing to width: ${options.width}`)
  })
```

## Input/Output

### Console Output

```typescript
import { log } from '@stacksjs/cli'

export default function (cli: CLI) {
  cli.command('status', 'Check status')
    .action(() => {
      // Standard log levels
      log.info('Information message')
      log.success('Success message')
      log.warn('Warning message')
      log.error('Error message')
      log.debug('Debug message')

      // Formatted output
      console.log('')  // Empty line
      console.log('Plain output')
    })
}
```

### Styled Output

```typescript
import { bold, green, red, yellow, italic, dim } from '@stacksjs/cli'

export default function (cli: CLI) {
  cli.command('styled', 'Show styled output')
    .action(() => {
      console.log(bold('Bold text'))
      console.log(green('Green text'))
      console.log(red('Red text'))
      console.log(yellow('Yellow text'))
      console.log(italic('Italic text'))
      console.log(dim('Dimmed text'))

      // Combine styles
      console.log(bold(green('Bold and green')))
    })
}
```

### Progress Indicators

```typescript
import { spinner } from '@stacksjs/cli'

export default function (cli: CLI) {
  cli.command('download', 'Download files')
    .action(async () => {
      const spin = spinner('Downloading...')
      spin.start()

      try {
        await downloadFiles()
        spin.succeed('Download complete')
      } catch (error) {
        spin.fail('Download failed')
      }
    })
}
```

### Interactive Prompts

```typescript
import { prompt, confirm, select, multiselect } from '@stacksjs/cli'

export default function (cli: CLI) {
  cli.command('setup', 'Interactive setup')
    .action(async () => {
      // Text input
      const name = await prompt('What is your name?')

      // Confirmation
      const proceed = await confirm('Do you want to continue?')

      // Single selection
      const framework = await select('Choose a framework:', [
        'Vue',
        'React',
        'Svelte',
      ])

      // Multiple selection
      const features = await multiselect('Select features:', [
        { name: 'TypeScript', value: 'ts', checked: true },
        { name: 'ESLint', value: 'eslint', checked: true },
        { name: 'Prettier', value: 'prettier' },
      ])

      console.log({ name, proceed, framework, features })
    })
}
```

## Command Aliases

### Single Alias

```typescript
cli.command('inspire', 'Inspire yourself')
  .alias('insp')
  .action(() => {
    // Can be run as `buddy inspire` or `buddy insp`
  })
```

### Multiple Aliases

```typescript
cli.command('generate:component', 'Generate a component')
  .alias('g:c')
  .alias('gc')
  .action(() => {
    // Can be run as any of the aliases
  })
```

## Subcommands

### Creating Subcommands

```typescript
// app/Commands/User.ts
export default function (cli: CLI) {
  // Main command group
  cli.command('user', 'User management commands')

  // Subcommands
  cli.command('user:create <email>', 'Create a new user')
    .option('--admin', 'Create as admin')
    .action(async (email, options) => {
      await createUser(email, options.admin)
    })

  cli.command('user:delete <id>', 'Delete a user')
    .option('--force', 'Skip confirmation')
    .action(async (id, options) => {
      if (!options.force) {
        const confirmed = await confirm('Are you sure?')
        if (!confirmed) return
      }
      await deleteUser(id)
    })

  cli.command('user:list', 'List all users')
    .option('--format, -f <format>', 'Output format', { default: 'table' })
    .action(async (options) => {
      const users = await getUsers()
      displayUsers(users, options.format)
    })

  // Catch unknown subcommands
  cli.on('user:*', () => {
    log.error('Invalid command. See --help for available commands.')
    process.exit(1)
  })

  return cli
}
```

## Calling Commands Programmatically

### From Actions

```typescript
// app/Actions/MaintenanceAction.ts
import { runCommand } from '@stacksjs/cli'

export default new Action({
  async handle() {
    // Run a CLI command
    await runCommand('buddy cache:clear')
    await runCommand('buddy queue:restart')

    return response.json({ message: 'Maintenance complete' })
  },
})
```

### From Other Commands

```typescript
export default function (cli: CLI) {
  cli.command('reset', 'Reset the application')
    .action(async () => {
      const { runCommand } = await import('@stacksjs/cli')

      log.info('Clearing cache...')
      await runCommand('buddy cache:clear')

      log.info('Running migrations...')
      await runCommand('buddy migrate:fresh')

      log.info('Seeding database...')
      await runCommand('buddy db:seed')

      log.success('Application reset complete!')
    })
}
```

### Using exec

```typescript
import { exec } from '@stacksjs/cli'

export default function (cli: CLI) {
  cli.command('deploy', 'Deploy application')
    .action(async () => {
      // Run shell commands
      const result = await exec('git status')

      if (result.isOk()) {
        console.log(result.value.stdout)
      } else {
        console.error(result.error)
      }
    })
}
```

## Error Handling

### Exit Codes

```typescript
import { ExitCode } from '@stacksjs/types'

export default function (cli: CLI) {
  cli.command('check', 'Check something')
    .action(() => {
      try {
        // Check logic
        process.exit(ExitCode.Success)        // 0
      } catch (error) {
        process.exit(ExitCode.FatalError)     // 1
      }
    })
}
```

### Graceful Error Handling

```typescript
import { handleError } from '@stacksjs/error-handling'

export default function (cli: CLI) {
  cli.command('risky', 'Risky operation')
    .action(async () => {
      try {
        await riskyOperation()
        log.success('Operation completed')
      } catch (error) {
        handleError(error)
        log.error('Operation failed')
        process.exit(1)
      }
    })
}
```

### Validation Errors

```typescript
export default function (cli: CLI) {
  cli.command('process <file>', 'Process a file')
    .action(async (file) => {
      // Validate input
      if (!file.endsWith('.json')) {
        log.error('File must be a JSON file')
        process.exit(1)
      }

      // Check file exists
      if (!await exists(file)) {
        log.error(`File not found: ${file}`)
        process.exit(1)
      }

      // Process file
      await processFile(file)
    })
}
```

## Best Practices

### Command Structure

```typescript
// Recommended command structure
export default function (cli: CLI) {
  cli
    .command('namespace:action', 'Description of what this command does')
    .option('--option, -o <value>', 'Option description', { default: 'default' })
    .alias('n:a')
    .action(async (options) => {
      try {
        // 1. Validate inputs
        validateInputs(options)

        // 2. Show progress
        const spin = spinner('Processing...')
        spin.start()

        // 3. Perform action
        const result = await performAction(options)

        // 4. Show success
        spin.succeed('Complete!')
        displayResult(result)

        // 5. Exit cleanly
        process.exit(ExitCode.Success)
      } catch (error) {
        // 6. Handle errors gracefully
        handleError(error)
        process.exit(ExitCode.FatalError)
      }
    })

  return cli
}
```

### Help Text

```typescript
cli.command('complex', 'A complex command')
  .option('--input, -i <file>', 'Input file path')
  .option('--output, -o <file>', 'Output file path')
  .example('buddy complex -i data.json -o result.json')
  .example('buddy complex --input=data.json --output=result.json')
```

## Edge Cases and Gotchas

### Option Name Conflicts

Avoid using reserved option names:

```typescript
// Avoid these (used by CLI framework)
// --help, -h
// --version, -v (if version is enabled)
```

### Async Actions

Always handle async operations properly:

```typescript
// Correct: await async operations
cli.command('async', 'Async command')
  .action(async () => {
    await someAsyncOperation()
    process.exit(0)
  })

// Incorrect: missing await causes early exit
cli.command('async', 'Async command')
  .action(() => {
    someAsyncOperation()  // Command exits before this completes
    process.exit(0)
  })
```

### Environment Variables

Access environment variables in commands:

```typescript
cli.command('config', 'Show configuration')
  .action(() => {
    const env = process.env.NODE_ENV || 'development'
    const debug = process.env.DEBUG === 'true'

    console.log(`Environment: ${env}`)
    console.log(`Debug: ${debug}`)
  })
```

## API Reference

### CLI Methods

| Method | Description |
|--------|-------------|
| `command(name, description)` | Define a command |
| `option(flags, description, config?)` | Add an option |
| `alias(name)` | Add a command alias |
| `action(handler)` | Set the action handler |
| `example(text)` | Add an example |
| `on(event, handler)` | Listen for events |

### Exit Codes

| Code | Constant | Description |
|------|----------|-------------|
| 0 | `ExitCode.Success` | Successful execution |
| 1 | `ExitCode.FatalError` | General error |

### Log Methods

| Method | Description |
|--------|-------------|
| `log.info(message)` | Information message |
| `log.success(message)` | Success message |
| `log.warn(message)` | Warning message |
| `log.error(message)` | Error message |
| `log.debug(message)` | Debug message |

## Related Documentation

- [Actions](/basics/actions) - HTTP request handlers
- [Jobs](/basics/jobs) - Background job processing
- [Logging](/basics/logging) - Application logging
- [Error Handling](/basics/error-handling) - Error management
