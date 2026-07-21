# Stacks Desktop

## Features

- Native macOS, Linux, and Windows windows powered by Craft
- Pretty development URLs through the Stacks rpx and tlsx integration
- Hot reload and native developer tools
- Multi-recipient invite delivery with application-owned token and mail callbacks
- HTTPS update checks with SHA-256 verification and atomic staging

## Usage

```bash
bun install -d @stacksjs/desktop
```

Now, you can use it in your project:

```js
import { openDevWindow } from '@stacksjs/desktop'

await openDevWindow(3000, {
  title: 'My Stacks App',
})
```

`APP_URL` is used by default, so a normal Stacks project opens its pretty HTTPS URL. Pass `url` only when embedding another development server.

Craft is provisioned by Pantry from `config/deps.ts`. Run `pantry install` if the native binary is not available yet.

Invite delivery stays transport-neutral so applications can use their configured Stacks mail provider:

```ts
import { sendDesktopInvites } from '@stacksjs/desktop'

await sendDesktopInvites(users, {
  baseUrl: 'https://app.example.com',
  createToken: user => inviteTokens.create(user),
  send: invite => mail.send(invite.recipient.email, invite.url),
})
```

The updater never executes unverified downloads. Check the signed release channel, then stage the checksum-verified artifact for the platform installer:

```ts
import { checkForDesktopUpdate, stageDesktopUpdate } from '@stacksjs/desktop'

const update = await checkForDesktopUpdate({
  currentVersion: '1.4.0',
  manifestUrl: 'https://app.example.com/desktop/updates/stable.json',
})

if (update)
  await stageDesktopUpdate(update, '/path/to/update.bin')
```

## Testing

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
