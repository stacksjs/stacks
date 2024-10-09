# Stacks CLI

The simple way to build beautiful CLIs.

## ☘️ Features

- 🎨 Easily create beautiful CLI apps
- ⚡️ Lightweight, user-friendly, interactive prompts
- 🚦 Elegant terminal spinners
- ⛑️ Helper methods to run commands

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

_You may also use any of the following CLI utilities:_

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

To view the full documentation, please visit [https://stacksjs.org/cli](https://stacksjs.org/cli).

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

[Join the Stacks Discord Server](https://discord.gg/stacksjs)

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
