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
SLACK*APPLICATION*ID=SAID123
SLACK*CLIENT*ID=SCID123
SLACK*SECRET*KEY=SSK123
```

### Inbox: read and archive conversations

```ts
import { inbox } from '@stacksjs/chat'

const slack = inbox.createInboxDriver('slack', { token: process.env.SLACK_USER_TOKEN! })
for (const conversation of await slack.conversations())
  console.log(conversation.title, conversation.archive.mode) // 'native' | 'confirm' | 'unsupported'
await slack.archive('D0123') // closes the DM in Slack
```

Drivers for iMessage (macOS chat.db), WhatsApp (WhatsApp for Mac's database), Slack (user token) and Discord (bot token).

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

## 🙏🏼 Credits

Many thanks to the following core technologies & people who have contributed to this package:

- [Chris Breuer](https://github.com/chrisbbreuer)
- [All Contributors](../../contributors)

## 📄 License

The MIT License (MIT). Please see [LICENSE](https://github.com/stacksjs/stacks/tree/main/LICENSE.md) for more information.

Made with 💙
