# Stacks Notifications

Stacks Notifications is a unified driver system for sending messages/notifications. It supports sending emails, SMS messages, and chat messages.

## ☘️ Features

- 📦 Send Emails
- 🎨 Email Styling
- 📱 Send SMS messages
- 💬 Send Chat messages

## TODO

- [ ] Driver: SNS (Push)
- [ ] Driver: Pushwoosh

## 🤖 Usage

```bash
bun install -d @stacksjs/notifications
```

Set these variables in your env:

```bash
NOTIFICATION_TYPE=email
NOTIFICATION_DRIVER=sendgrid
```

You may now use it in your project:

```ts
import { notification } from '@stacksjs/notifications'

notification.send(options)
```

## 🏎️ Drivers

There are different option types for Chat, Email, and SMS drivers. To use any driver, simply configure the notification `options` object.

```ts
interface ChatOptions {
  providerName?: 'discord' | 'slack'
  webhookUrl: string
  content: string
}

interface EmailOptions {
  providerName?: 'sendgrid' | 'emailjs' | 'mailjet' | 'mandrill' | 'netcore' | 'nodemailer' | 'postmark' | 'ses'
  to: string | string[]
  subject: string
  html: string
  from?: string
  text?: string
  attachments?: AttachmentOptions[]
  id?: string
}

interface SMSOptions {
  providerName?: 'gupshup' | 'nexmo' | 'plivo' | 'sms77' | 'sns' | 'telnyx' | 'termii' | 'twilio'
  to: string
  content: string
  from?: string
  attachments?: AttachmentOptions[]
  id?: string
}
```

Available drivers are listed below, with the proper variables needed to get started.

### Email

Email drivers are configured with the following environment variables:

#### Sendgrid

```bash
SENDGRID_API_KEY=SG123
SENDGRID_FROM=from@example.com
SENDGRID_SENDER_NAME=Sender
```

#### Mailgun

```bash
MAILGUN_API_KEY=MG123
MAILGUN_DOMAIN=example.com
MAILGUN_USERNAME=username
MAILGUN_FROM=from@example.com
```

#### Mailjet

```bash
MAILJET_API_KEY=MJ123
MAILJET_API_SECRET=MJTESTSECRET
MAILJET_FROM_EMAIL=from@example.com
```

#### Netcore

```bash
NETCORE_API_KEY=NC123
NETCORE_FROM=from@example.com
```

#### Nodemailer

```bash
NODEMAILER_FROM_EMAIL=from@example.com
NODEMAILER_HOST=example.com
NODEMAILER_USERNAME=username
NODEMAILER_PASSWORD=password
NODEMAILER_PORT=25
NODEMAILER_SECURE=true
```

#### Postmark

```bash
POSTMARK_API_KEY=PM123
POSTMARK_FROM=from@example.com
```

#### AWS SES

```bash
SES_REGION=US
SES_ACCESS_KEY_ID=testkey123
SES_SECRET_ACCESS_KEY=testaccesskey123
SES_FROM=from@example.com
```

#### Mandrill

```bash
MANDRILL_API_KEY=Ma123
MANDRILL_EMAIL=from@example.com
```

#### EmailJS

```bash
MAIL_FROM_ADDRESS=from@example.com
EMAILJS_HOST=example.com
EMAILJS_USERNAME=username
EMAILJS_PASSWORD=password
EMAILJS_PORT=25
EMAILJS_SECURE=true
```

### SMS

SMS drivers are configured with the following environment variables:

#### Twilio

```bash
TWILIO_ACCOUNT_SID=ACtest
TWILIO_AUTH_TOKEN=testtoken
TWILIO_FROM_NUMBER=+112345
TWILIO_TO_NUMBER=+145678
```

#### Nexmo

```bash
VONAGE_API_KEY=VN123
VONAGE_API_SECRET=testkey
VONAGE_FROM_NUMBER=+112345
```

#### Gupshup

```bash
GUPSHUP_USER_ID=GU123
GUPSHUP_PASSWORD=password
```

#### Plivo

```bash
PLIVO_ACCOUNT_ID=PA123
PLIVO_AUTH_TOKEN=testtoken
PLIVO_FROM_NUMBER=+112345
```

#### SMS77

```bash
SMS77_API_KEY=SA123
SMS77_FROM=from@example.com
```

#### SNS

```bash
SMS77_API_KEY=SA123
SMS77_FROM=from@example.com
```

#### Telnyx

```bash
TELNYX_API_KEY=TA123
TELNYX_MESSAGE_PROFILE_ID=testprofileid
TELNYX_FROM=from@example.com
```

#### Termii

```bash
TERMII_API_KEY=TermA123
TERMII_SENDER=from@example.com
```

### Chat

Chat drivers are configured with the following environment variables:

#### Discord

- None

#### Slack

```
SLACK_APPLICATION_ID=SAID123
SLACK_CLIENT_ID=SCID123
SLACK_SECRET_KEY=SSK123
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
