# Stacks CLI

The simple way to build beautiful CLIs.

## ☘️ Features

- 🎨 Easily create beautiful CLI apps
- ⚡️ Lightweight, user-friendly, interactive prompts
- 🚦 Elegant terminal spinners
- ⛑️ Helper methods to run commands

## Forwarding shutdown signals

For a supervised, long-running command, pass `forwardSignals: true` to `exec`
or `runCommand`. On POSIX, SIGINT and SIGTERM received by the parent are forwarded
to its direct child; the child remains responsible for draining its work and
exiting. Forwarding listeners are removed when the child exits. This is opt-in
and does not terminate a process tree or impose a drain deadline.

`buddy queue:work` enables forwarding automatically so a supervisor that signals
only Buddy still reaches the queue worker. Importing CLI prompts does not install
an exit handler; Ctrl+C exits an active interactive prompt only.

## Capturing bounded command output

Use the narrow `@stacksjs/cli/process` entry for a finite command whose text
output needs explicit limits. Arguments are passed directly to the executable.
Both output streams are drained concurrently, and nonzero exit codes are returned
with their bounded diagnostics.

```ts
import { runBoundedProcess } from '@stacksjs/cli/process'

const result = await runBoundedProcess(['git', 'rev-parse', 'HEAD'], {
  cwd: '/trusted/source',
  timeoutMs: 10000,
  stdoutBytes: 65536,
  stderrBytes: 65536,
  label: 'Source revision',
  strictUtf8: true,
})

if (result.exitCode !== 0)
  throw new Error('Source inspection failed', { cause: result })
```

All three limits are required positive integers. Timeouts are at most 120,000 ms;
each stream is capped at 2,000,000 bytes before UTF-8 decoding. Stdin is ignored.
Set `strictUtf8: true` to reject malformed or truncated UTF-8 on either stream,
including when the producer is still running. Valid text retains its byte-order
mark. Omit the option or pass `false` to keep replacement decoding.
Output overflow, read errors and deadlines reject after owned cleanup. Original
failure values and cleanup errors are retained without coercing them to strings.
On POSIX the command gets its own process group, which is terminated on completion
or failure, including descendants holding inherited pipes. On Windows cleanup
covers the direct process and readers. Use this API for finite inspection or build
probes whose descendants should end with the command.

### Request cancellation

Pass a native `AbortSignal` as `signal`, for example an HTTP request's
`request.signal`. An already-aborted signal rejects before launching a process.
Later cancellation terminates the owned process scope and waits for the child
and readers to settle before rejecting with `Error('<label> canceled')`.
The signal's reason is retained as `cause` without converting it to text.

The first observed failure wins when cancellation overlaps an output or deadline
failure. Listeners are removed after settlement, so later cancellation cannot
change a completed capture. Nonzero exits still return the original result
shape. Cancellation keeps the same POSIX process-group and Windows direct-child
cleanup scope described above; it does not contain a descendant that deliberately
escapes that group.

## 🤖 Usage

```bash
bun install -d @stacksjs/cli
```

Now, you can use it in your project:

```js
// command.ts
// you may create create a relatively complex CLI UI/UX via the following:
import { command, ExitCode, italic, prompts, spawn, spinner } from '@stacksjs/cli'

const stacks = command('stacks')

stacks
  .command('example', 'A dummy command') // bun buddy example
  .option('-i, --install', 'The install option', { default: true })
  .action(async (options) => {
    if (options.install)
      await install()

    const answer = await prompts.select({
      type: 'select',
      message: 'Are you trying to run this command?',
      choices: [
        { title: 'Run the command', value: 'run' },
        { title: 'Do not run the command', value: 'do-not-run' },
      ],
    })

    if (answer === 'run')
      install()
    else if (answer === 'do-not-run')
      log.info('Not running the command')
    else process.exit(ExitCode.InvalidArgument)
  })

async function install() {
  try {
    const spin = spinner('Running...').start()
    setTimeout(() => {
      spin.text = italic('This may take a few moments...')
    }, 5000)
    await spawn('bun install')
    spin.stop()
  }
  catch (error) {
    log.error(error)
  }
}

command.help() // automatically expose a -h and --help flag
command.version(version) // automatically expose a -v and --version flag
command.parse() // parse the command
```

You may now run the command via:

```bash
bun command.ts
```

## CLI Apps

### Setup

The `intro` and `outro` functions will print a message to begin or end a prompt session, respectively.

```js
import { intro, outro } from '@stacksjs/cli'

intro(`create-my-app`)
// Do stuff
outro(`You're all set!`)
```

### Cancellation

The `isCancel` function is a guard that detects when a user cancels a question with `CTRL + C`. You should handle this situation for each prompt, optionally providing a nice cancellation message with the `cancel` utility.

```js
import { cancel, isCancel, text } from '@stacksjs/cli'

const value = await text(/* TODO */)

if (isCancel(value)) {
  cancel('Operation cancelled.')
  process.exit(0)
}
```

## Components

### Text

The text component accepts a single line of text.

```js
import { text } from '@stacksjs/cli'

const meaning = await text({
  message: 'What is the meaning of life?',
  placeholder: 'Not sure',
  initialValue: '42',
  validate(value) {
    if (value.length === 0)
      return `Value is required!`
  },
})
```

### Confirm

The confirm component accepts a yes or no answer. The result is a boolean value of `true` or `false`.

```js
import { confirm } from '@stacksjs/cli'

const shouldContinue = await confirm({
  message: 'Do you want to continue?',
})
```

### Select

The select component allows a user to choose one value from a list of options. The result is the `value` prop of a given option.

```js
import { select } from '@stacksjs/cli'

const projectType = await select({
  message: 'Pick a project type.',
  options: [
    { value: 'ts', label: 'TypeScript' },
    { value: 'js', label: 'JavaScript' },
    { value: 'coffee', label: 'CoffeeScript', hint: 'oh no' },
  ],
})
```

### Multi-Select

The `multiselect` component allows a user to choose many values from a list of options. The result is an array with all selected `value` props.

```js
import { multiselect } from '@stacksjs/cli'

const additionalTools = await multiselect({
  message: 'Select additional tools.',
  options: [
    { value: 'eslint', label: 'ESLint', hint: 'recommended' },
    { value: 'prettier', label: 'Prettier' },
    { value: 'gh-action', label: 'GitHub Action' },
  ],
  required: false,
})
```

### Spinner

The spinner component surfaces a pending action, such as a long-running download or dependency installation.

```js
import { spinner } from '@stacksjs/cli'

const s = spinner()
s.start('Installing via npm')
// Do installation here
s.stop('Installed via npm')
```

## Utilities

### Grouping

Grouping prompts together is a great way to keep your code organized. This accepts a JSON object with a name that can be used to reference the group later. The second argument is an optional but has a `onCancel` callback that will be called if the user cancels one of the prompts in the group.

```js
import * as p from '@stacksjs/cli'

const group = await p.group(
  {
    name: () => p.text({ message: 'What is your name?' }),
    age: () => p.text({ message: 'What is your age?' }),
    color: ({ results }) =>
      p.multiselect({
        message: `What is your favorite color ${results.name}?`,
        options: [
          { value: 'red', label: 'Red' },
          { value: 'green', label: 'Green' },
          { value: 'blue', label: 'Blue' },
        ],
      }),
  },
  {
    // On Cancel callback that wraps the group
    // So if the user cancels one of the prompts in the group this function will be called
    onCancel: ({ results }) => {
      p.cancel('Operation cancelled.')
      process.exit(0)
    },
  }
)

console.log(group.name, group.age, group.color)
```

### Tasks

Execute multiple tasks in spinners.

```js
await p.tasks([
  {
    title: 'Installing via npm',
    task: async (message) => {
      // Do installation here
      return 'Installed via npm'
    },
  },
])
```

To view a more detailed example, check out [Buddy](../../buddy/).

*You may also use any of the following CLI utilities:*

```js
import {
  ansi256Bg,
  bgBlack,
  bgBlue,
  bgCyan,
  bgGray,
  bgGreen,
  bgLightBlue,
  bgLightCyan,
  bgLightGray,
  bgLightGreen,
  bgLightMagenta,
  bgLightRed,
  bgLightYellow,
  bgMagenta,
  bgRed,
  bgWhite,
  bgYellow,
  black,
  blue,
  bold,
  cyan,
  dim,
  gray,
  green,
  hidden,
  inverse,
  italic,
  lightBlue,
  lightCyan,
  lightGray,
  lightGreen,
  lightMagenta,
  lightRed,
  lightYellow,
  link,
  magenta,
  red,
  reset,
  strikethrough,
  underline,
  white,
  yellow
} from '@stacksjs/cli'

log.info(`hello ${bold(italic('world'))}`)
```

To view the full documentation, please visit [<https://stacksjs.com/cl>i](https://stacksjs.com/cli).

## 🧪 Testing

```bash
bun test
```

## 📈 Changelog

Please see our [releases](https://github.com/stacksjs/stacks/releases) page for more information on what has changed recently.

## 🚜 Contributing

Please review the [Contributing Guide](https://github.com/stacksjs/contributing) for details.

## 🏝 Community

For help, discussion about best practices, or any other conversation that would benefit from being searchable:

[Discussions on GitHub](https://github.com/stacksjs/stacks/discussions)

For casual chit-chat with others using this package:

[Join the Stacks Discord Server](https://stacksjs.com/discord)

## 🙏🏼 Credits

Many thanks to the following core technologies & people who have contributed to this package:

- [CAC](https://github.com/cacjs/cac)
- [Clack](https://github.com/bombshell-dev/clack)
- [Ora](https://github.com/sindresorhus/ora)
- [Consola](https://github.com/unjs/consola)
- [Chris Breuer](https://github.com/chrisbbreuer)
- [All Contributors](../../contributors)

## 📄 License

The MIT License (MIT). Please see [LICENSE](https://github.com/stacksjs/stacks/tree/main/LICENSE.md) for more information.

Made with 💙
