# Stacks SMS

Stacks Email is driver system for sending Emails.

## ☘️ Features

- 📦 Send Email

## 🤖 Usage

```bash
bun install -d @stacksjs/email
```

You may now use it in your project:

```ts
import * as email from '@stacksjs/email'

/* Then choose a driver. E.g for sendgrid */
const notification = email.sendgrid

notification.send(EmailOptions)

interface EmailOptions {
  to: string | string[]
  subject: string
  html: string
  from?: string
  text?: string
  attachments?: AttachmentOptions[]
  id?: string
}
```

### Drivers

Drivers are configured with the following environment variables:

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
EMAILJS_FROM_EMAIL=from@example.com
EMAILJS_HOST=example.com
EMAILJS_USERNAME=username
EMAILJS_PASSWORD=password
EMAILJS_PORT=25
EMAILJS_SECURE=true
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
