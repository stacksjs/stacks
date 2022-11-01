# Stacks CLI

The simple way to build beautiful CLIs.

## ☘️ Features

- [x] Easily create pretty CLIs
- [x] Prompts—"A beautiful command-line prompt"
- [x] Spinners for use in the terminal
- [x] Helper methods to run commands

## 🤖 Usage

```bash
pnpm i -D @stacksjs/cli
```

Now, you can use it in your project:

```js
// you may create create a relatively complex CLI UI/UX via the following:
import { command, consola, prompts, spawn, spinner, ExitCode, italic } from '@stacksjs/cli'

const stacks = command('stacks')

stacks
  .command('example', 'A dummy command') // pnpm stacks example
  .option('-i, --install', 'The install options', { default: true })
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
      consola.info('Not running the command')
    else process.exit(ExitCode.InvalidArgument)
  })

async function install() {
  try {
    const spin = spinner('Running...').start()
    setTimeout(() => {
      spin.text = italic('This may take a little while...')
    }, 5000)
    await spawn.async('pnpm install')
    spin.stop()
    process.exit(ExitCode.Success)
  } catch (error) {
    consola.error(error)
    process.exit(ExitCode.Error)
  }
}

command.help() // automatically expose a -h and --help flag
command.version(version) // automatically expose a -v and --version flag
command.parse() // parse the command
```

To view a more detailed example, check out the Stacks Runtime.

_You may also use any of the following CLI utilities:_

```js
import {
  consola,
  ansi256Bg, bold, dim, hidden, inverse, italic, link, reset, strikethrough, underline,
  bgBlack, bgBlue, bgCyan, bgGray, bgGreen, bgLightBlue, bgLightCyan, bgLightGray, bgLightGreen, bgLightMagenta, bgLightRed, bgLightYellow, bgMagenta, bgRed, bgWhite, bgYellow,
  black, blue, cyan, gray, green, lightBlue, lightCyan, lightGray, lightGreen, lightMagenta, lightRed, lightYellow, magenta, red, white, yellow,
} from '@stacksjs/cli'

consola.log(`hello ${bold(italic('world'))`)
```

To view the full documentation, please visit [https://stacks.js.org/cli](https://stacksjs.dev/cli).

## 🧪 Testing

```bash
pnpm test
```

## 📈 Changelog

Please see our [releases](https://github.com/stacksjs/stacks/releases) page for more information on what has changed recently.

## 💪🏼 Contributing

Please see [CONTRIBUTING](../../../.github/CONTRIBUTING.md) for details.

## 🏝 Community

For help, discussion about best practices, or any other conversation that would benefit from being searchable:

[Discussions on GitHub](https://github.com/stacksjs/stacks/discussions)

For casual chit-chat with others using this package:

[Join the Open Web Discord Server](https://discord.ow3.org)

## 📄 License

The MIT License (MIT). Please see [LICENSE](https://github.com/stacksjs/stacks/tree/main/LICENSE.md) for more information.

Made with ❤️
