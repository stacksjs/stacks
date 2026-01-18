# Build a CLI

This tutorial will guide you through building command-line interfaces (CLIs) with Stacks. You will learn how to create commands, handle options and arguments, display prompts, and format output.

## Overview

Stacks makes it easy to create powerful CLIs:

- **Automatic Registration** - Commands are auto-discovered
- **Type-Safe** - Full TypeScript support with excellent IDE integration
- **Rich Output** - Colorful output, tables, progress bars, and more
- **Interactive Prompts** - Confirmations, selections, and text input
- **Distributable** - Ship as a binary or npm package

## Configuration

Configure your CLI in `config/cli.ts`:

```typescript
// config/cli.ts
import type { BinaryConfig } from '@stacksjs/types'

export default {
  name: 'My Custom CLI',
  command: 'my-cli',        // enables `my-cli <command> <options>`
  description: 'A powerful CLI tool for my project',
  deploy: true,             // deploys CLI setup endpoint
} satisfies BinaryConfig
```

## Creating Commands

Commands live in the `app/Commands/` directory and are automatically registered.

### Generate a Command

```bash
buddy make:command SendEmails
```

### Basic Command Structure

```typescript
// app/Commands/SendEmails.ts
import type { CLI } from '@stacksjs/types'
import process from 'node:process'
import { log } from '@stacksjs/cli'
import { ExitCode } from '@stacksjs/types'

export default function (cli: CLI) {
  cli
    .command('send-emails', 'Send pending emails to users')
    .action(() => {
      log.info('Sending emails...')

      // Your logic here

      log.success('Emails sent successfully!')
      process.exit(ExitCode.Success)
    })

  return cli
}
```

### Using the Command

```bash
# Using Buddy
buddy send-emails

# Using your custom CLI (after deployment)
my-cli send-emails
```

## Options and Arguments

### Adding Options

Options are flags that modify command behavior:

```typescript
// app/Commands/Greet.ts
import type { CLI } from '@stacksjs/types'
import process from 'node:process'
import { log } from '@stacksjs/cli'
import { ExitCode } from '@stacksjs/types'

interface GreetOptions {
  name: string
  uppercase: boolean
  times: number
}

export default function (cli: CLI) {
  cli
    .command('greet', 'Greet someone')
    .option('--name, -n <name>', 'Name to greet', { default: 'World' })
    .option('--uppercase, -u', 'Output in uppercase', { default: false })
    .option('--times, -t <count>', 'Number of times to greet', { default: 1 })
    .action((options: GreetOptions) => {
      let message = `Hello, ${options.name}!`

      if (options.uppercase) {
        message = message.toUpperCase()
      }

      for (let i = 0; i < options.times; i++) {
        log.info(message)
      }

      process.exit(ExitCode.Success)
    })

  return cli
}
```

Usage:

```bash
buddy greet                        # Hello, World!
buddy greet --name Alice           # Hello, Alice!
buddy greet -n Alice -u            # HELLO, ALICE!
buddy greet --name Bob --times 3   # Prints 3 times
```

### Adding Arguments

Arguments are positional values:

```typescript
// app/Commands/Copy.ts
import type { CLI } from '@stacksjs/types'
import process from 'node:process'
import { log } from '@stacksjs/cli'
import { ExitCode } from '@stacksjs/types'

export default function (cli: CLI) {
  cli
    .command('copy <source> <destination>', 'Copy files from source to destination')
    .option('--recursive, -r', 'Copy recursively', { default: false })
    .option('--force, -f', 'Overwrite existing files', { default: false })
    .action((source: string, destination: string, options) => {
      log.info(`Copying from ${source} to ${destination}`)

      if (options.recursive) {
        log.info('Copying recursively...')
      }

      if (options.force) {
        log.info('Overwriting existing files...')
      }

      // Perform copy operation

      log.success('Copy completed!')
      process.exit(ExitCode.Success)
    })

  return cli
}
```

Usage:

```bash
buddy copy ./src ./dist
buddy copy ./src ./dist --recursive --force
buddy copy ./src ./dist -rf
```

### Optional Arguments

Use square brackets for optional arguments:

```typescript
cli
  .command('deploy [environment]', 'Deploy to an environment')
  .action((environment: string = 'production') => {
    log.info(`Deploying to ${environment}...`)
  })
```

### Variadic Arguments

Accept multiple values:

```typescript
cli
  .command('install <packages...>', 'Install packages')
  .action((packages: string[]) => {
    packages.forEach(pkg => {
      log.info(`Installing ${pkg}...`)
    })
  })
```

Usage:

```bash
buddy install lodash axios vue
```

## Interactive Prompts

Stacks provides interactive prompts for user input.

### Confirmation Prompt

```typescript
import { confirm } from '@stacksjs/cli'

const shouldContinue = await confirm('Are you sure you want to continue?')

if (shouldContinue) {
  log.info('Continuing...')
} else {
  log.info('Cancelled.')
  process.exit(ExitCode.Success)
}
```

### Text Input

```typescript
import { prompt } from '@stacksjs/cli'

const name = await prompt('What is your name?')
const email = await prompt('What is your email?', {
  default: 'user@example.com',
})

log.info(`Hello, ${name} (${email})!`)
```

### Password Input

```typescript
import { password } from '@stacksjs/cli'

const secret = await password('Enter your password:')
```

### Selection List

```typescript
import { select } from '@stacksjs/cli'

const choice = await select('Choose an environment:', [
  'development',
  'staging',
  'production',
])

log.info(`Selected: ${choice}`)
```

### Multi-Select

```typescript
import { multiselect } from '@stacksjs/cli'

const features = await multiselect('Select features to enable:', [
  { name: 'TypeScript', value: 'typescript', checked: true },
  { name: 'ESLint', value: 'eslint', checked: true },
  { name: 'Testing', value: 'testing' },
  { name: 'Docker', value: 'docker' },
])

log.info(`Selected features: ${features.join(', ')}`)
```

### Complete Interactive Example

```typescript
// app/Commands/Init.ts
import type { CLI } from '@stacksjs/types'
import process from 'node:process'
import { confirm, log, multiselect, prompt, select } from '@stacksjs/cli'
import { ExitCode } from '@stacksjs/types'

export default function (cli: CLI) {
  cli
    .command('init', 'Initialize a new project')
    .action(async () => {
      log.info('Welcome to the project initializer!')
      console.log('')

      // Get project name
      const projectName = await prompt('Project name:', {
        default: 'my-project',
      })

      // Choose template
      const template = await select('Choose a template:', [
        'minimal',
        'with-auth',
        'full-stack',
        'api-only',
      ])

      // Select features
      const features = await multiselect('Select additional features:', [
        { name: 'Database (SQLite)', value: 'database', checked: true },
        { name: 'Authentication', value: 'auth' },
        { name: 'Testing', value: 'testing', checked: true },
        { name: 'Docker', value: 'docker' },
        { name: 'CI/CD', value: 'cicd' },
      ])

      // Confirm
      console.log('')
      log.info('Configuration:')
      log.info(`  Project: ${projectName}`)
      log.info(`  Template: ${template}`)
      log.info(`  Features: ${features.join(', ') || 'none'}`)
      console.log('')

      const confirmed = await confirm('Create project with these settings?')

      if (!confirmed) {
        log.warning('Project creation cancelled.')
        process.exit(ExitCode.Success)
      }

      // Create project
      log.info('Creating project...')
      // ... project creation logic

      log.success(`Project "${projectName}" created successfully!`)
      console.log('')
      log.info('Next steps:')
      log.info(`  cd ${projectName}`)
      log.info('  bun install')
      log.info('  buddy dev')

      process.exit(ExitCode.Success)
    })

  return cli
}
```

## Output Formatting

### Log Levels

```typescript
import { log } from '@stacksjs/cli'

log.info('Information message')      // Blue text
log.success('Success message')       // Green text
log.warning('Warning message')       // Yellow text
log.error('Error message')           // Red text
log.debug('Debug message')           // Gray text (only in verbose mode)
```

### Tables

```typescript
import { table } from '@stacksjs/cli'

const users = [
  { id: 1, name: 'Alice', email: 'alice@example.com', role: 'Admin' },
  { id: 2, name: 'Bob', email: 'bob@example.com', role: 'User' },
  { id: 3, name: 'Charlie', email: 'charlie@example.com', role: 'User' },
]

table(users, {
  columns: ['id', 'name', 'email', 'role'],
  headers: ['ID', 'Name', 'Email', 'Role'],
})
```

Output:
```
┌────┬─────────┬─────────────────────────┬───────┐
│ ID │ Name    │ Email                   │ Role  │
├────┼─────────┼─────────────────────────┼───────┤
│ 1  │ Alice   │ alice@example.com       │ Admin │
│ 2  │ Bob     │ bob@example.com         │ User  │
│ 3  │ Charlie │ charlie@example.com     │ User  │
└────┴─────────┴─────────────────────────┴───────┘
```

### Progress Bars

```typescript
import { progress } from '@stacksjs/cli'

const bar = progress('Processing files', { total: 100 })

for (let i = 0; i <= 100; i++) {
  await sleep(50) // Simulate work
  bar.update(i)
}

bar.stop('Processing complete!')
```

### Spinners

```typescript
import { spinner } from '@stacksjs/cli'

const spin = spinner('Loading data...')
spin.start()

// Simulate async work
await fetchData()

spin.stop('Data loaded!')
// Or on error:
// spin.fail('Failed to load data')
```

### Colored Output

```typescript
import { colors } from '@stacksjs/cli'

console.log(colors.blue('Blue text'))
console.log(colors.red('Red text'))
console.log(colors.green('Green text'))
console.log(colors.yellow('Yellow text'))
console.log(colors.bold('Bold text'))
console.log(colors.dim('Dimmed text'))
console.log(colors.underline('Underlined text'))

// Combine styles
console.log(colors.bold(colors.red('Bold red text')))
```

### Boxes

```typescript
import { box } from '@stacksjs/cli'

box('Important Message', {
  title: 'Notice',
  padding: 1,
  borderStyle: 'round',
  borderColor: 'yellow',
})
```

Output:
```
╭──────────────────────────────╮
│                              │
│  Notice                      │
│                              │
│  Important Message           │
│                              │
╰──────────────────────────────╯
```

## Command Aliases

Create shorthand aliases for commands:

```typescript
cli
  .command('database:migrate', 'Run database migrations')
  .alias('migrate')
  .alias('db:m')
  .action(() => {
    // Migration logic
  })
```

Usage:

```bash
buddy database:migrate
buddy migrate
buddy db:m
```

## Sub-Commands

Organize related commands with namespaces:

```typescript
// app/Commands/Database.ts
export default function (cli: CLI) {
  // Main namespace command
  cli
    .command('database', 'Database management commands')
    .action(() => {
      log.info('Available commands:')
      log.info('  database:migrate  - Run migrations')
      log.info('  database:seed     - Seed database')
      log.info('  database:reset    - Reset database')
    })

  // Sub-commands
  cli
    .command('database:migrate', 'Run database migrations')
    .option('--fresh', 'Drop all tables first')
    .action((options) => {
      if (options.fresh) {
        log.warning('Dropping all tables...')
      }
      log.info('Running migrations...')
    })

  cli
    .command('database:seed', 'Seed the database')
    .option('--class <name>', 'Specific seeder to run')
    .action((options) => {
      log.info('Seeding database...')
    })

  cli
    .command('database:reset', 'Reset the database')
    .action(async () => {
      const confirmed = await confirm('This will delete all data. Continue?')
      if (confirmed) {
        log.info('Resetting database...')
      }
    })

  // Handle unknown sub-commands
  cli.on('database:*', () => {
    log.error('Unknown database command')
    log.info('Run `buddy database` for available commands')
    process.exit(1)
  })

  return cli
}
```

## Error Handling

Handle errors gracefully:

```typescript
import { ExitCode } from '@stacksjs/types'

export default function (cli: CLI) {
  cli
    .command('risky-operation', 'Perform a risky operation')
    .action(async () => {
      try {
        log.info('Starting operation...')

        const result = await riskyFunction()

        if (!result.success) {
          log.error(`Operation failed: ${result.error}`)
          process.exit(ExitCode.FatalError)
        }

        log.success('Operation completed!')
        process.exit(ExitCode.Success)
      }
      catch (error) {
        log.error('An unexpected error occurred:')
        console.error(error)
        process.exit(ExitCode.FatalError)
      }
    })

  return cli
}
```

## Complete Example: Deployment CLI

```typescript
// app/Commands/Deploy.ts
import type { CLI } from '@stacksjs/types'
import process from 'node:process'
import {
  box,
  colors,
  confirm,
  log,
  progress,
  select,
  spinner,
  table,
} from '@stacksjs/cli'
import { ExitCode } from '@stacksjs/types'

interface DeployOptions {
  environment: string
  force: boolean
  skipTests: boolean
}

export default function (cli: CLI) {
  cli
    .command('deploy [environment]', 'Deploy the application')
    .option('--force, -f', 'Force deployment without confirmation', { default: false })
    .option('--skip-tests', 'Skip running tests before deployment', { default: false })
    .action(async (environment: string | undefined, options: DeployOptions) => {
      // Select environment if not provided
      const env = environment || await select('Select deployment environment:', [
        'development',
        'staging',
        'production',
      ])

      // Show deployment info
      box(`Deploying to ${colors.bold(env)}`, {
        title: 'Deployment',
        borderColor: env === 'production' ? 'red' : 'blue',
      })

      console.log('')

      // Confirm for production
      if (env === 'production' && !options.force) {
        const confirmed = await confirm(
          colors.yellow('You are deploying to PRODUCTION. Are you sure?')
        )

        if (!confirmed) {
          log.warning('Deployment cancelled.')
          process.exit(ExitCode.Success)
        }
      }

      // Run tests
      if (!options.skipTests) {
        const testSpinner = spinner('Running tests...')
        testSpinner.start()

        try {
          await runTests()
          testSpinner.stop('Tests passed!')
        }
        catch (error) {
          testSpinner.fail('Tests failed!')
          log.error('Fix failing tests before deployment.')
          process.exit(ExitCode.FatalError)
        }
      }

      // Build
      const buildSpinner = spinner('Building application...')
      buildSpinner.start()

      try {
        await buildApplication()
        buildSpinner.stop('Build complete!')
      }
      catch (error) {
        buildSpinner.fail('Build failed!')
        process.exit(ExitCode.FatalError)
      }

      // Deploy
      log.info('Deploying...')
      const bar = progress('Uploading files', { total: 100 })

      for (let i = 0; i <= 100; i += 10) {
        await sleep(200) // Simulate upload
        bar.update(i)
      }

      bar.stop('Upload complete!')

      // Show deployment summary
      console.log('')
      log.success('Deployment successful!')
      console.log('')

      table([
        { key: 'Environment', value: env },
        { key: 'Version', value: '1.2.3' },
        { key: 'URL', value: `https://${env}.example.com` },
        { key: 'Deployed at', value: new Date().toISOString() },
      ], {
        columns: ['key', 'value'],
        headers: ['Property', 'Value'],
      })

      process.exit(ExitCode.Success)
    })

  return cli
}

// Helper functions
async function runTests() {
  await sleep(2000)
}

async function buildApplication() {
  await sleep(1500)
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
```

## Distributing Your CLI

### As npm Package

Your CLI can be distributed as an npm package:

```json
// package.json
{
  "name": "my-cli",
  "version": "1.0.0",
  "bin": {
    "my-cli": "./dist/cli.js"
  }
}
```

### As Binary

Build a standalone binary:

```bash
buddy build:cli
```

This creates platform-specific binaries in the `dist/` directory.

## Next Steps

Now that you know how to build CLIs, continue to:

- [Build a Desktop App](/bootcamp/desktop) - Package your app as a desktop application
- [Testing How-To](/bootcamp/how-to/testing) - Test your CLI commands
- [Deployment How-To](/bootcamp/how-to/deploy) - Distribute your CLI

## Related Documentation

- [Commands Guide](/basics/commands)
- [CLI Package](/packages/cli)
