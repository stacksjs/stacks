# What are Commands?

Stacks allows you to easily create & manage CLIs. This is done through the use of commands. Commands—_a framework primitive, built on CAC_—are responsible for defining the signature and behavior of a command-line interface.

> [!TIP]
> You may ship your CLI as a binary, or you may also use `buddy` to run your commands.

## Get Started

The following command will bootstrap a new action file in the `app/Commands` directory.

```sh
buddy make:command SendEmails
```

Because commands are automatically registered, you can use them in your CLI immediately.

```sh

### Example

A simple example of a command that prints a random quote to the console. _For a closer look, take a peak at the [Inspire.ts](./Inspire.ts) command._

```ts
interface InspireOptions {
  two: boolean
}

export default function (cli: CLI) {
  cli
    .command('inspire', 'Inspire yourself with a random quote')
    .option('--two, -t', 'Inspire yourself with two random quotes', { default: false })
    .alias('insp')
    .action((options: InspireOptions) => {
      if (options.two)
        // @ts-expect-error - this is safe because we hard-coded the quotes
        quotes.random(2).map((quote, index) => log.info(`${index + 1}. ${quote}`))
      else
        log.info(quotes.random())

      log.success('Have a great day!')
      process.exit(ExitCode.Success)
    })

  cli
    .command('inspire:two', 'Inspire yourself with two random quotes')
    .action(() => {
      // @ts-expect-error - this is safe because we hard-coded the quotes
      quotes.random(2).map((quote, index) => log.info(`${index + 1}. ${quote}`))

      log.success('Have a great day!')
      process.exit(ExitCode.Success)
    })

  cli.on('inspire:*', () => {
    log.error('Invalid command: %s\nSee --help for a list of available commands.', cli.args.join(' '))
    process.exit(1)
  })

  return cli
}
```

## 🚜 Contributing

Please review the [Contributing Guide](https://github.com/stacksjs/contributing) for details.

## 🏝 Community

For help, discussion about best practices, or any other conversation that would benefit from being searchable:

[Discussions on GitHub](https://github.com/stacksjs/stacks/discussions)

For casual chit-chat with others using this package:

[Join the Stacks Discord Server](https://discord.gg/stacksjs)

## 📄 License

The MIT License (MIT). Please see [LICENSE](../../LICENSE.md) for more information.

Made with 💙
