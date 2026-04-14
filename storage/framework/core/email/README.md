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
SENDGRID*API*KEY=SG123
SENDGRID*FROM=from@example.com
SENDGRID*SENDER*NAME=Sender
```

#### Mailgun

```bash
MAILGUN*API*KEY=MG123
MAILGUN*DOMAIN=example.com
MAILGUN*USERNAME=username
MAILGUN*FROM=from@example.com
```

#### Mailjet

```bash
MAILJET*API*KEY=MJ123
MAILJET*API*SECRET=MJTESTSECRET
MAILJET*FROM*EMAIL=from@example.com
```

#### Netcore

```bash
NETCORE*API*KEY=NC123
NETCORE*FROM=from@example.com
```

#### Nodemailer

```bash
NODEMAILER*FROM*EMAIL=from@example.com
NODEMAILER*HOST=example.com
NODEMAILER*USERNAME=username
NODEMAILER*PASSWORD=password
NODEMAILER*PORT=25
NODEMAILER*SECURE=true
```

#### Postmark

```bash
POSTMARK*API*KEY=PM123
POSTMARK*FROM=from@example.com
```

#### AWS SES

```bash
SES*REGION=US
SES*ACCESS*KEY*ID=testkey123
SES*SECRET*ACCESS*KEY=testaccesskey123
SES*FROM=from@example.com
```

#### Mandrill

```bash
MANDRILL*API*KEY=Ma123
MANDRILL*EMAIL=from@example.com
```

#### EmailJS

```bash
EMAILJS*FROM*EMAIL=from@example.com
EMAILJS*HOST=example.com
EMAILJS*USERNAME=username
EMAILJS*PASSWORD=password
EMAILJS*PORT=25
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
