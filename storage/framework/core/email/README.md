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

## 🧱 Email components (`<EmailLayout>` & co.)

Bundled stx components for composing Outlook / Gmail-safe HTML in
`resources/components/Email/`. Drop them into any `.stx` template;
the framework auto-discovers them when rendering through
`@stacksjs/email`'s `template()` helper.

| Component         | Slot/content | Notable props |
|---|---|---|
| `<EmailLayout>`   | default + `head`/`header`/`footer` slots | `title`, `width` (px), `bodyBg`, `contentBg` |
| `<EmailSection>`  | default      | `padding`, `background` |
| `<EmailText>`     | default      | `size` (`sm`/`md`/`lg`/`heading`), `align`, `color`, `spacing` |
| `<EmailButton>`   | default = button label | `href` (required), `color`, `bg`, `padX`, `padY` |
| `<EmailDivider>`  | none         | `color`, `spacing` |
| `<EmailImage>`    | none         | `src` (required), `alt` (required), `width`, `height`, `display` |
| `<EmailLink>`     | default      | `href` (required), `color`, `underline` |

Each one renders bulletproof table-based markup with inline styles
so it works in Outlook 2007-2019, Gmail (web + Android), and Apple
Mail without an inliner pass. Example:

```stx
<script server>
const userName = props.userName || 'there'
const appUrl = props.appUrl || 'https://stacksjs.com'
</script>

<EmailLayout title="Welcome">
  <EmailText size="heading">Welcome aboard, {{ userName }}!</EmailText>
  <EmailText>Thanks for signing up — here's a button to get started:</EmailText>
  <EmailButton href="{{ appUrl }}">Open the app</EmailButton>
  <EmailDivider />
  <EmailText size="sm" color="#6b7280" spacing="0">Reply to this email if you have questions.</EmailText>
</EmailLayout>
```

The bundled `welcome.stx`, `password-reset.stx`, `password-changed.stx`,
and `email-verification.stx` are written using these components — they
double as worked examples. Copy + edit for app-specific designs.

## 🎨 CSS inlining

Gmail (especially the Android app) and older Outlook clients strip
or ignore `<style>` blocks, so styles have to ride on each element via
`style="…"`. Stacks ships a pass-through inliner that runs after
`renderEmail()` and before the result hands back:

- **On by default in production** (`APP_ENV` or `NODE_ENV` is
  `production`). Off in dev so previews show the un-mutated stx
  output.
- **Per-call opt-out** via `template(name, { inline: false })`.
- **Per-block opt-out** via `<style data-inline="false">…</style>` —
  those blocks pass through untouched. Useful for `@media`-queried
  responsive rules that aren't inline-friendly anyway.

The inliner handles class / id / tag / chained selectors (`.btn`,
`#cta`, `p`, `a.btn`, `.btn.primary`). Selectors with descendant
combinators, pseudo-classes, or `@media` queries stay in a slimmed
`<style>` block so clients that DO support styles still pick them up.

The bundled `<EmailLayout>` & co. components are already inline-styled
by construction, so the inliner is mainly a safety net for userland
CSS — drop a `<style>` block in your template and let it rip.

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
