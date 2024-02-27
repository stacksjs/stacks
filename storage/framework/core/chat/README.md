# Stacks Chat

Stacks Chat is driver system for sending messages through chat apps.

## ☘️ Features

- 📦 Send Chats

## 🤖 Usage

```bash
bun install -d @stacksjs/chat
```

You may now use it in your project:

```ts
import * as chat from '@stacksjs/chat'

/* Then choose a driver. E.g for Slack */
const notification = chat.slack

notification.send(ChatOptions)

interface ChatOptions {
  webhookUrl: string
  content: string
}
```

### Drivers

Drivers are configured with the following environment variables:

#### Discord

- None

#### Slack

```bash
SLACK_APPLICATION_ID=SAID123
SLACK_CLIENT_ID=SCID123
SLACK_SECRET_KEY=SSK123
```

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

- [Chris Breuer](https://github.com/chrisbbreuer)
- [All Contributors](../../contributors)

## 📄 License

The MIT License (MIT). Please see [LICENSE](https://github.com/stacksjs/stacks/tree/main/LICENSE.md) for more information.

Made with 💙
