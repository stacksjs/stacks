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
import { ExitCode, command, italic, prompts, spawn, spinner } from '@stacksjs/cli'

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
- [Ora](https://github.com/sindresorhus/ora)
- [Consola](https://github.com/unjs/consola)
- [Chris Breuer](https://github.com/chrisbbreuer)
- [All Contributors](../../contributors)

## 📄 License

The MIT License (MIT). Please see [LICENSE](https://github.com/stacksjs/stacks/tree/main/LICENSE.md) for more information.

Made with 💙
