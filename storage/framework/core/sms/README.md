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

[Join the Stacks Discord Server](https://stacksjs.com/discord)

## 🙏🏼 Credits

Many thanks to the following core technologies & people who have contributed to this package:

- [Chris Breuer](https://github.com/chrisbbreuer)
- [All Contributors](../../contributors)

## 📄 License

The MIT License (MIT). Please see [LICENSE](https://github.com/stacksjs/stacks/tree/main/LICENSE.md) for more information.

Made with 💙

### Scoped transport and exact Twilio receipts

`TwilioDriver(config, verifyServiceSid?, { fetch?, maxRetries? })` keeps a copy
of its credentials and accepts an instance-specific transport. A send result
adds `outcome: 'accepted' | 'rejected' | 'unknown'`. Message-creation retries
apply only to an explicit HTTP 429 rejection. Timeouts, disconnects, malformed
acknowledgements and 5xx responses stay unknown, since repeating an accepted
POST can send the message twice. Reconcile using provider callbacks and
persisted operations before attempting another send.

`getReceipt(messageSid)` returns authoritative status, raw decimal `price`,
`currency`, segments and `priceMicros`. `twilioPriceMicros` parses a quoted
absolute decimal price exactly into millionths of the quoted currency, with
at most six fractional places. For example `-0.007900` becomes `7900`.
An absent/unparseable price remains undefined, never a fabricated zero.
The existing numeric `price` field remains available for display. Applications
must check currency and apply their own billing/markup once to the exact
provider cost. Provider acceptance is distinct from recipient delivery.

### WhatsApp Cloud text replies

`WhatsAppCloudClient({ accessToken, phoneNumberId, apiVersion }, { fetch? })`
uses a scoped token and explicit Graph API version. `identity()` verifies the
configured phone-number ID; `sendText(to, text, { replyTo?, callbackData? })`
sends session text and returns `accepted`, `rejected` or `unknown`, plus a
provider message ID when acknowledged. It never blindly retries a POST.
The opaque callback value is for correlating a signed status callback with a
persisted operation, including a lost HTTP acknowledgement.

This low-level client does not grant permission to message a customer. The
application must enforce consent, opt-outs, provider registration and messaging
windows. Templates and proactive campaigns require their own explicit flow.
Phone recipients are international numbers; text is limited to 4,096 characters.
These clients do not use the local desktop WhatsApp database/inbox driver.

Protocol references: [Meta WhatsApp Cloud API](https://www.postman.com/meta/whatsapp-business-platform/documentation/wlk6lh4/whatsapp-cloud-api)
and [Meta text-message object](https://whatsapp.github.io/WhatsApp-Nodejs-SDK/api-reference/messages/text/).
The latter SDK is archived; this package implements the HTTP client and does
not depend on that SDK. Provider protocol fixtures are not live delivery
qualification.
