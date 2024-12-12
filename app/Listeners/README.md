# What are Listeners?

Currently, only one specific kind of listener is allowed: `Console.ts`.

## Get Started

A simple example of how Console listeners work. _For a closer look, take a peak at the [Console.ts](./Console.ts) file._

```ts
export default function (cli: CLI) {
  // Listen to the `inspire:three` command
  cli.on('inspire:three', () => {
    console.log('not yet implemented...')
  })

  // Listen to the default command
  cli.on('inspire:!', () => {
    // Do something
  })

  // Listen to unknown commands
  cli.on('inspire:*', () => {
    console.error('Invalid command: %s', cli.args.join(' '))
    process.exit(1)
  })
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
