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

### Scoped provider clients and acknowledgement failures

`new slack.SlackDriver({ botToken }, { fetch? })` and
`new discord.DiscordDriver({ botToken }, { fetch? })` keep explicit credentials
on the instance. They do not change `configureSlack`/`configureDiscord` or
inherit another instance's webhook. Instances without credentials still read
application configuration. The optional transport is scoped to that instance.

A result's `data.outcome` distinguishes `accepted`, `rejected` and `unknown`.
A network failure, malformed acknowledgement or server error can follow a
successful send; these POSTs are not repeated automatically. Only an explicit
429 rejection is retried. Persist an unknown outcome for reconciliation rather
than sending the same text again. Discord webhook requests use `wait=true` to
request the message receipt; legacy empty 204 responses have no message ID.
Slack webhook acceptance likewise provides no message ID. Bot sends require
the provider's receipt ID. Callback failures can set `success=false` after
provider acceptance; retain `data.outcome` and the provider receipt separately.
Oversized message text is rejected instead of silently truncated.

`MetaMessagingClient` sends scoped text replies through Messenger, Instagram
Login, or Instagram with Facebook Login. It requires an explicit Graph API
version and account ID. `identity()` verifies that token's account access;
it does not assert app-review approval, consent, messaging-window eligibility,
or live recipient delivery. `sendText` returns the same three outcomes and
never retries a creation POST. The application must enforce customer consent
and reply-window policy before calling it. Text is limited to 1,000 characters
by this client.

```ts
import { MetaMessagingClient } from '@stacksjs/chat'

const client = new MetaMessagingClient({
  provider: 'messenger', // 'instagram' or 'instagram-facebook'
  accountId: pageId,
  apiVersion: approvedGraphVersion,
  accessToken: pageToken,
})
const identity = await client.identity()
const result = await client.sendText(scopedRecipientId, 'Thanks for your message')
```

Protocol references: [Meta Messenger Send API](https://www.postman.com/meta/messenger-platform-api/documentation/iyp204x/messenger-platform-api),
[Meta Instagram Send API](https://www.postman.com/meta/instagram/request/xru3vzm/generic-template),
and [Meta account permissions and app review](https://developers.facebook.com/docs/graph-api/reference/message).
The transport fixtures exercise these request/response formats; they do not
qualify a live provider account.
