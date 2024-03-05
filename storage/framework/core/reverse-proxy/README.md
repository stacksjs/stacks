# Reverse Proxy

A modern reverse proxy. Pretty dev URLs for your local projects, with simplicity and flexibility.

## ☘️ Features

- Reverse Proxy
- SSL Support
- Custom Domains
- Auto HTTP to HTTPS Redirection
- Dependency-free Binary

## 🤖 Usage

```bash
bun install -d bun-reverse-proxy
# brew install reverse-proxy
# pkgx install reverse-proxy
```

Now, you can use it in your project:

```js
import { startProxy } from 'bun-reverse-proxy'

startProxy({
  from: 'localhost:3000',
  to: 'my-project.localhost'
})
```

### CLI

```bash
reverse-proxy --from localhost:3000 --to my-project.localhost
reverse-proxy --from localhost:3000 --to my-project.test --keyPath ./key.pem --certPath ./cert.pem
reverse-proxy --help
reverse-proxy --version
```

### Configuration

You can also use a configuration file:

```ts
export default {
  'localhost:3000': 'stacksjs.localhost'
}
```

Then run:

```bash
reverse-proxy start
```

And your config will be loaded from `reverse-proxy.config.ts` _(or `reverse-proxy.config.js`)_. Learn more in the docs.

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

## 📄 License

The MIT License (MIT). Please see [LICENSE](https://github.com/stacksjs/stacks/tree/main/LICENSE.md) for more information.

Made with 💙
