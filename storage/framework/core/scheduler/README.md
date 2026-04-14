# Stacks SMS

Stacks SMS is driver system for sending SMS messages.

## ☘️ Features

- 📦 Send SMS

## 🤖 Usage

```bash
bun install -d @stacksjs/sms
```

You may now use it in your project:

```ts
import * as sms from '@stacksjs/sms'

/* Then choose a driver. E.g for twilio */
const notification = sms.twilio

notification.send(SMSOptions)

interface SMSOptions {
  to: string
  content: string
  from?: string
  attachments?: AttachmentOptions[]
  id?: string
}
```

### Drivers

Drivers are configured with the following environment variables:

#### Twilio

```bash
TWILIO*ACCOUNT*SID=ACtest
TWILIO*AUTH*TOKEN=testtoken
TWILIO*FROM*NUMBER=+112345
TWILIO*TO*NUMBER=+145678
```

#### Nexmo

```bash
VONAGE*API*KEY=VN123
VONAGE*API*SECRET=testkey
VONAGE*FROM*NUMBER=+112345
```

#### Gupshup

```bash
GUPSHUP*USER*ID=GU123
GUPSHUP*PASSWORD=password
```

#### Plivo

```bash
PLIVO*ACCOUNT*ID=PA123
PLIVO*AUTH*TOKEN=testtoken
PLIVO*FROM*NUMBER=+112345
```

#### SMS77

```bash
SMS77*API*KEY=SA123
SMS77*FROM=from@example.com
```

#### SNS

```bash
SMS77*API*KEY=SA123
SMS77*FROM=from@example.com
```

#### Telnyx

```bash
TELNYX*API*KEY=TA123
TELNYX*MESSAGE*PROFILE*ID=testprofileid
TELNYX*FROM=from@example.com
```

#### Termii

```bash
TERMII*API*KEY=TermA123
TERMII*SENDER=from@example.com
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

[Join the Stacks Discord Server](https://discord.gg/stacksjs)

## 🙏🏼 Credits

Many thanks to the following core technologies & people who have contributed to this package:

- [Chris Breuer](https://github.com/chrisbbreuer)
- [All Contributors](../../contributors)

## 📄 License

The MIT License (MIT). Please see [LICENSE](https://github.com/stacksjs/stacks/tree/main/LICENSE.md) for more information.

Made with 💙
