# CLI Package

A powerful command-line interface framework for building interactive CLI applications, featuring command parsing, prompts, spinners, and beautiful output formatting.

## Installation

```bash
bun add @stacksjs/cli
```

## Basic Usage

```typescript
import { CLI, Command, log, prompt, spin } from '@stacksjs/cli'

// Create a simple command
const cli = new CLI('myapp')
  .command('greet', 'Greet a user')
  .option('-n, --name <name>', 'Name to greet')
  .action((options) => {
    log.info(`Hello, ${options.name || 'World'}!`)
  })

cli.run()
```

## Creating Commands

### Basic Command

```typescript
import { Command } from '@stacksjs/cli'

const command = new Command('deploy')
  .description('Deploy the application')
  .action(() => {
    console.log('Deploying...')
  })
```

### Command with Options

```typescript
const command = new Command('build')
  .description('Build the application')
  .option('-e, --env <environment>', 'Target environment', 'production')
  .option('-m, --minify', 'Minify output', false)
  .option('-w, --watch', 'Watch for changes')
  .action((options) => {
    console.log(`Building for ${options.env}`)
    if (options.minify) console.log('Minification enabled')
    if (options.watch) console.log('Watch mode enabled')
  })
```

### Command with Arguments

```typescript
const command = new Command('generate')
  .description('Generate a resource')
  .argument('<type>', 'Resource type (model, controller, action)')
  .argument('<name>', 'Resource name')
  .argument('[path]', 'Optional path')
  .action((type, name, path, options) => {
    console.log(`Generating ${type}: ${name}`)
    if (path) console.log(`At path: ${path}`)
  })
```

### Subcommands

```typescript
const cli = new CLI('buddy')

cli.command('make')
  .description('Generate resources')
  .command('model')
    .description('Generate a model')
    .argument('<name>')
    .action((name) => {
      console.log(`Creating model: ${name}`)
    })
  .command('controller')
    .description('Generate a controller')
    .argument('<name>')
    .action((name) => {
      console.log(`Creating controller: ${name}`)
    })
```

## Prompts

### Text Input

```typescript
import { prompt } from '@stacksjs/cli'

const name = await prompt.text({
  message: 'What is your name?',
  placeholder: 'Enter your name',
  defaultValue: 'Anonymous',
  validate: (value) => {
    if (value.length < 2) return 'Name must be at least 2 characters'
  }
})
```

### Password Input

```typescript
const password = await prompt.password({
  message: 'Enter your password:',
  mask: '*',
  validate: (value) => {
    if (value.length < 8) return 'Password must be at least 8 characters'
  }
})
```

### Confirm

```typescript
const confirmed = await prompt.confirm({
  message: 'Are you sure you want to continue?',
  initialValue: false
})

if (confirmed) {
  // Proceed
}
```

### Select (Single Choice)

```typescript
const framework = await prompt.select({
  message: 'Choose a framework:',
  options: [
    { value: 'vue', label: 'Vue.js', hint: 'Recommended' },
    { value: 'react', label: 'React' },
    { value: 'svelte', label: 'Svelte' },
  ],
  initialValue: 'vue'
})
```

### Multi-Select

```typescript
const features = await prompt.multiselect({
  message: 'Select features to install:',
  options: [
    { value: 'auth', label: 'Authentication' },
    { value: 'api', label: 'API Routes' },
    { value: 'queue', label: 'Queue System' },
    { value: 'cache', label: 'Caching' },
  ],
  required: true,
  initialValues: ['auth']
})
```

### Autocomplete

```typescript
const project = await prompt.autocomplete({
  message: 'Select a project:',
  options: async (input) => {
    const projects = await fetchProjects(input)
    return projects.map(p => ({
      value: p.id,
      label: p.name
    }))
  },
  placeholder: 'Type to search...'
})
```

### Group Prompts

```typescript
const answers = await prompt.group({
  name: () => prompt.text({ message: 'Project name:' }),
  type: () => prompt.select({
    message: 'Project type:',
    options: ['app', 'library', 'plugin']
  }),
  features: () => prompt.multiselect({
    message: 'Features:',
    options: ['typescript', 'eslint', 'prettier']
  }),
}, {
  onCancel: () => {
    log.error('Setup cancelled')
    process.exit(1)
  }
})
```

### Path Selection

```typescript
const file = await prompt.path({
  message: 'Select a file:',
  type: 'file',
  validate: (path) => {
    if (!path.endsWith('.ts')) return 'Must be a TypeScript file'
  }
})

const directory = await prompt.path({
  message: 'Select output directory:',
  type: 'directory'
})
```

## Output and Logging

### Log Levels

```typescript
import { log } from '@stacksjs/cli'

log.info('Information message')
log.success('Operation completed successfully')
log.warn('Warning: Something might be wrong')
log.error('Error: Something went wrong')
log.debug('Debug information')
```

### Styled Output

```typescript
import { log, style } from '@stacksjs/cli'

// Colors
console.log(style.red('Error text'))
console.log(style.green('Success text'))
console.log(style.yellow('Warning text'))
console.log(style.blue('Info text'))
console.log(style.cyan('Highlighted text'))

// Formatting
console.log(style.bold('Bold text'))
console.log(style.dim('Dimmed text'))
console.log(style.italic('Italic text'))
console.log(style.underline('Underlined text'))

// Combinations
console.log(style.bold.red('Bold red text'))
console.log(style.dim.yellow('Dim yellow text'))
```

### Notes and Messages

```typescript
import { note, outro, intro } from '@stacksjs/cli'

intro('Welcome to the CLI')

note('Some important information', 'Note')

outro('Setup complete!')
```

## Spinners

### Basic Spinner

```typescript
import { spin } from '@stacksjs/cli'

const spinner = spin('Loading...')

try {
  await performTask()
  spinner.success('Task completed!')
} catch (error) {
  spinner.error('Task failed!')
}
```

### Spinner with Messages

```typescript
const spinner = spin('Initializing...')

spinner.message('Downloading dependencies...')
await downloadDeps()

spinner.message('Building project...')
await build()

spinner.message('Running tests...')
await runTests()

spinner.success('All done!')
```

### Multiple Spinners

```typescript
import { Spinner } from '@stacksjs/cli'

const spinner1 = new Spinner('Task 1')
const spinner2 = new Spinner('Task 2')

spinner1.start()
spinner2.start()

await Promise.all([
  task1().then(() => spinner1.success('Task 1 done')),
  task2().then(() => spinner2.success('Task 2 done'))
])
```

## Progress Bars

```typescript
import { progress } from '@stacksjs/cli'

const bar = progress({
  total: 100,
  format: 'Progress |{bar}| {percentage}% | {value}/{total}'
})

for (let i = 0; i <= 100; i++) {
  bar.update(i)
  await sleep(50)
}

bar.stop()
```

## Tasks

### Task Lists

```typescript
import { tasks } from '@stacksjs/cli'

await tasks([
  {
    title: 'Installing dependencies',
    task: async () => {
      await installDependencies()
    }
  },
  {
    title: 'Building project',
    task: async () => {
      await buildProject()
    }
  },
  {
    title: 'Running tests',
    enabled: (ctx) => ctx.runTests,
    task: async () => {
      await runTests()
    }
  }
])
```

### Task with Context

```typescript
await tasks([
  {
    title: 'Fetch data',
    task: async (ctx) => {
      ctx.data = await fetchData()
    }
  },
  {
    title: 'Process data',
    task: async (ctx) => {
      await processData(ctx.data)
    }
  }
], { concurrent: false })
```

## Command Execution

### Running Commands

```typescript
import { runCommand, exec } from '@stacksjs/cli'

// Run a command and get result
const result = await runCommand('npm install')

if (result.isOk) {
  console.log('Success:', result.value)
} else {
  console.error('Error:', result.error)
}

// Execute with options
const output = await exec('ls -la', {
  cwd: '/path/to/dir',
  env: { NODE_ENV: 'production' }
})
```

### Streaming Output

```typescript
import { exec } from '@stacksjs/cli'

const proc = exec('npm run build', {
  stdout: 'pipe',
  stderr: 'pipe'
})

for await (const chunk of proc.stdout) {
  process.stdout.write(chunk)
}
```

## Argument Parsing

```typescript
import { parseArgs } from '@stacksjs/cli'

const args = parseArgs(process.argv.slice(2), {
  string: ['name', 'output'],
  boolean: ['verbose', 'force'],
  alias: {
    n: 'name',
    o: 'output',
    v: 'verbose',
    f: 'force'
  },
  default: {
    verbose: false
  }
})

// buddy command -n myproject -v --force
// args = { name: 'myproject', verbose: true, force: true, _: ['command'] }
```

## Helper Functions

### Dump and Die

```typescript
import { dump, dd } from '@stacksjs/cli'

// Dump variables for debugging
dump(someObject)
dump(anotherObject, 'Label')

// Dump and exit
dd(object) // Logs and exits with code 1
```

### Echo

```typescript
import { echo } from '@stacksjs/cli'

echo('Simple output message')
echo(object) // Pretty prints objects
```

## CLI Configuration

### Global Options

```typescript
const cli = new CLI('myapp')
  .version('1.0.0')
  .description('My awesome CLI application')
  .option('-v, --verbose', 'Enable verbose output')
  .option('-c, --config <path>', 'Config file path')

// Global options are available to all commands
cli.command('build')
  .action((options) => {
    if (options.verbose) log.info('Verbose mode enabled')
  })
```

### Help Generation

```typescript
const cli = new CLI('myapp')
  .command('serve')
  .description('Start the development server')
  .option('-p, --port <number>', 'Port to listen on', '3000')
  .option('-h, --host <hostname>', 'Host to bind to', 'localhost')
  .example('myapp serve --port 8080')
  .example('myapp serve -h 0.0.0.0')
```

### Error Handling

```typescript
cli.command('deploy')
  .action(async () => {
    try {
      await deploy()
    } catch (error) {
      log.error('Deployment failed:', error.message)
      process.exit(1)
    }
  })

// Global error handler
cli.catch((error) => {
  log.error('An unexpected error occurred:', error)
  process.exit(1)
})
```

## Edge Cases

### Handling Cancellation

```typescript
const name = await prompt.text({
  message: 'Enter name:'
})

// User pressed Ctrl+C
if (prompt.isCancel(name)) {
  log.warn('Operation cancelled')
  process.exit(0)
}
```

### Handling Empty Input

```typescript
const value = await prompt.text({
  message: 'Enter value:',
  validate: (v) => {
    if (!v || v.trim() === '') {
      return 'Value cannot be empty'
    }
  }
})
```

### Terminal Size

```typescript
import { getTerminalSize } from '@stacksjs/cli'

const { columns, rows } = getTerminalSize()

if (columns < 80) {
  log.warn('Terminal is too narrow for optimal display')
}
```

### Non-Interactive Mode

```typescript
import { isInteractive } from '@stacksjs/cli'

if (!isInteractive()) {
  // Running in CI or piped
  log.info('Running in non-interactive mode')
  // Use default values instead of prompts
} else {
  const name = await prompt.text({ message: 'Name:' })
}
```

## API Reference

### CLI Class

| Method | Description |
|--------|-------------|
| `command(name)` | Add a command |
| `option(flags, desc, default?)` | Add global option |
| `version(version)` | Set version |
| `description(desc)` | Set description |
| `run()` | Parse and execute |
| `catch(handler)` | Set error handler |

### Command Class

| Method | Description |
|--------|-------------|
| `description(desc)` | Set description |
| `argument(name, desc?)` | Add argument |
| `option(flags, desc, default?)` | Add option |
| `action(handler)` | Set action handler |
| `example(text)` | Add example |
| `alias(name)` | Add command alias |

### Prompt Functions

| Function | Description |
|----------|-------------|
| `prompt.text(options)` | Text input |
| `prompt.password(options)` | Password input |
| `prompt.confirm(options)` | Yes/no confirmation |
| `prompt.select(options)` | Single selection |
| `prompt.multiselect(options)` | Multiple selection |
| `prompt.autocomplete(options)` | Autocomplete input |
| `prompt.path(options)` | File/directory path |
| `prompt.group(prompts)` | Group multiple prompts |

### Log Functions

| Function | Description |
|----------|-------------|
| `log.info(msg)` | Info message |
| `log.success(msg)` | Success message |
| `log.warn(msg)` | Warning message |
| `log.error(msg)` | Error message |
| `log.debug(msg)` | Debug message |
| `log.dump(obj)` | Dump object |
| `log.dd(obj)` | Dump and die |

### Spinner Functions

| Method | Description |
|--------|-------------|
| `spin(message)` | Create spinner |
| `spinner.start()` | Start spinning |
| `spinner.stop()` | Stop spinning |
| `spinner.success(msg)` | Stop with success |
| `spinner.error(msg)` | Stop with error |
| `spinner.message(msg)` | Update message |

### Execution Functions

| Function | Description |
|----------|-------------|
| `runCommand(cmd)` | Run shell command |
| `exec(cmd, opts)` | Execute with options |
| `parseArgs(args, opts)` | Parse CLI arguments |
