# What are Commands

Stacks allows you to easily create & manage CLIs. This is done through the use of commands. Commands—_a framework primitive, built on CAC_—are responsible for defining the signature and behavior of a command-line interface.

> [!TIP]
> You may ship your CLI as a binary, or you may also use `buddy` to run your commands.

## Get Started

The following command will bootstrap a new command file in the `app/Commands` directory.

```sh
buddy make:command SendEmails
```

Every `.ts` file in this directory is a command. There is no registration step and no generated
registry file - drop the file in and it is live, nested directories included
(`app/Commands/Archive/Run.ts`).

### Example

`defineCommand()` infers the handler's `options` from the flags declared above it, so there is no
hand-written options interface to keep in step.

```ts
import { defineCommand, log } from '@stacksjs/cli'

export default defineCommand({
  name: 'send-emails <type>',
  description: 'Send the queued emails of one type',
  aliases: ['emails'],
  options: {
    '--dry-run': { description: 'Report what would be sent, send nothing', default: false },
    '--limit <n>': { description: 'Stop after this many', default: 100, type: [Number] },
  },
  async handle(options, type) {
    // options.dryRun -> boolean, options.limit -> number, type -> string
    log.info(`Sending ${options.limit} ${type} emails${options.dryRun ? ' (dry run)' : ''}`)
  },
})
```

For a file that registers several commands, or needs `cli.on()`, take the CLI directly - it is typed
either way:

```ts
import { defineCommand, log } from '@stacksjs/cli'

export default defineCommand((cli) => {
  cli.command('inspire', 'Inspire yourself with a random quote').alias('insp').action(() => {})
  cli.command('inspire:two', 'Inspire yourself with two random quotes').action(() => {})

  cli.on('inspire:*', () => log.error('Invalid command.'))
})
```

### Configuring a command

Named exports beside the default one, so a command owns its own configuration:

```ts
export const aliases = ['emails', 'mail'] // extra aliases
export const enabled = false              // keep the file, hide the command
```

`app/Commands.ts` is optional. Keep one only to control the order commands are listed in, or to
alias or disable a command without editing its file - a command it never mentions still loads.

```ts
import { defineCommands } from '@stacksjs/cli'

export default defineCommands({
  'send-emails <type>': { file: 'SendEmails', aliases: ['emails'] },
})
```

## 🚜 Contributing

Please review the [Contributing Guide](https://github.com/stacksjs/contributing) for details.

## 🏝 Community

For help, discussion about best practices, or any other conversation that would benefit from being searchable:

[Discussions on GitHub](https://github.com/stacksjs/stacks/discussions)

For casual chit-chat with others using this package:

[Join the Stacks Discord Server](https://stacksjs.com/discord)

## 📄 License

The MIT License (MIT). Please see [LICENSE](../../LICENSE.md) for more information.

Made with 💙
