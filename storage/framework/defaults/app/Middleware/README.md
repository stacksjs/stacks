# What is a Middleware?

Middleware is a way to define logic that should be executed before or after a specific event inside the request lifecycle.

## Get Started

The following command will bootstrap a new middleware file in the `app/Middleware` directory.

```sh
buddy make:middleware Logger
```

### Example

A simple example of a middleware that logs a message. _For a closer look, take a peak at the [Logger.ts](./Logger.ts) file._

```ts
const options: MiddlewareOtions = {
  name: 'Logger', // optional, defaults to the file name
  description: 'A demo listener that logs a message', // optional, used in the dashboard for context
  priority: 2, // optional, defaults to 0
  handle: () => {
    log.info('Hi, from the Logger middleware 👋')
  },
}

export default new Middleware(options)
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
