# Stacks Socials

A simple and elegant social authentication package for Stacks, inspired by Laravel's Socialite.

## ☘️ Features

- 🔑 Easy OAuth Authentication
- 🔌 Support for Multiple Providers (GitHub, Google, Facebook, etc.)
- ⚡️ Simple & Intuitive API
- 🛠️ Customizable Provider Configuration
- 🔒 Secure Token Handling
- 🎯 TypeScript Support

## 🤖 Usage

```bash
bun install -d @stacksjs/socials
```

Now, you can use it in your project:

```js
import { Socials } from '@stacksjs/socials'

// Configure your social provider
const github = Socials.driver('github')

// Redirect to provider
const authUrl = await github.redirect()

// Handle callback
const user = await github.user()
```

Learn more in the docs.

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

## 📄 License

The MIT License (MIT). Please see [LICENSE](https://github.com/stacksjs/stacks/tree/main/LICENSE.md) for more information.

Made with 💙
