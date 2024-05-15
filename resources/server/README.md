# What is this "server" directory?

Currently, the Server directory is used to define the preloaded functionality by the Bun process. It is broken into two parts, `Preloader/main.ts` and `Preloader/test.ts`. In other words, ...

1. **Main**: The main preloader is triggered before the main local Bun process is started
2. **Test**: The test preloader is triggered before tests are run

_Soon, the server directory will also be used to define the Cloud container._

## 🚜 Contributing

Please review the [Contributing Guide](https://github.com/stacksjs/contributing) for details.

## 🏝 Community

For help, discussion about best practices, or any other conversation that would benefit from being searchable:

[Discussions on GitHub](https://github.com/stacksjs/stacks/discussions)

For casual chit-chat with others using this package:

[Join the Stacks Discord Server](https://discord.gg/stacksjs)

## 📄 License

The MIT License (MIT). Please see [LICENSE](../LICENSE.md) for more information.

Made with 💙
