---
name: stacks-mail
description: Use when creating mail classes in app/Mail/ - defining email content and templates, using the template() function with STX or HTML templates, variable interpolation, email layouts, or the app-level mail sending pattern. For the email framework itself (drivers, Mail singleton, EmailSDK, inbox management), see stacks-email. Covers app/Mail, Mailable, resources/emails and mail previews.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Mail Classes

Application-level email definitions in `app/Mail/`.

## Key Paths
- Application mail: `app/Mail/`
- Email templates: `resources/emails/` (or `storage/framework/defaults/resources/emails/`)
- Email layouts: `storage/framework/defaults/resources/emails/layouts/`

## Creating a Mail Class

```typescript
// app/Mail/WelcomeEmail.ts
import { mail, template } from '@stacksjs/email'
import { config } from '@stacksjs/config'

interface WelcomeEmailOptions {
  to: string
  name: string
}

export async function sendWelcomeEmail({ to, name }: WelcomeEmailOptions) {
  const { html, text } = await template('welcome', {
    variables: { name, appName: config.app.name },
    layout: 'base'
  })

  await mail.sendOrFail({
    from: { name: config.app.name, address: config.email.from.address },
    to,
    subject: `Welcome to ${config.app.name}!`,
    html,
    text
  })
}
```

## Template Rendering

```typescript
import { template, renderHtml, templateExists, listTemplates } from '@stacksjs/email'

// From template file (welcome.stx or welcome.html)
const { html, text } = await template('welcome', {
  variables: { name: 'John', url: 'https://app.com/verify' },
  layout: 'base',     // HTML layout (or false); STX templates own their layout
  subject: 'Welcome'
})

// From raw HTML
const { html, text } = renderHtml('<h1>Hello {{ name }}</h1>', { name: 'John' })

// Check templates
templateExists('welcome')   // boolean
listTemplates()              // string[]
```

Variable syntax: `{{ variableName }}` (double braces with spaces).

## Example: Subscription Confirmation

```typescript
// app/Mail/SubscriptionConfirmation.ts
import { mail, template } from '@stacksjs/email'
import { url } from '@stacksjs/router'
import { config } from '@stacksjs/config'

export async function sendSubscriptionConfirmation({ to, subscriberUuid }: Options) {
  const { html, text } = await template('subscription-confirmation', {
    variables: {
      unsubscribeUrl: url('email.unsubscribe', { token: subscriberUuid }),
      appName: config.app.name
    }
  })

  await mail.send({
    from: { name: config.app.name, address: config.email.from.address },
    to,
    subject: 'Confirm your subscription',
    html,
    text
  })
}
```

## Using Mail in Actions/Events

```typescript
// In an action
import { sendWelcomeEmail } from '../../app/Mail/WelcomeEmail'

export default {
  name: 'SendWelcomeEmail',
  async handle(event: { email: string, name: string }) {
    await sendWelcomeEmail({ to: event.email, name: event.name })
    return { success: true }
  }
}
```

## The base design: email components

STX templates build on a bundled component library (`defaults/resources/components/Email`),
which every bundled template uses and which gives an app a finished look with a few props:

```html
<EmailLayout
  title="Your license key"
  preheader="Shown after the subject in the inbox"
  brand="Uplink" brandUrl="https://uplink.example" accent="#f59e0b"
  footer="You are getting this because you bought Uplink."
>
  <EmailText size="heading">You have Uplink Monthly.</EmailText>
  <EmailText>Here is your license key.</EmailText>
  <EmailCode>UPLK-7RKR-Z2BJ-V6QV-4PUH</EmailCode>
  <EmailButton href="https://uplink.example/activate" bg="#f59e0b" color="#18181b">Activate</EmailButton>
  <EmailDivider />
  <EmailText size="sm">Small print.</EmailText>
</EmailLayout>
```

- `<EmailLayout>`: a muted page with one bordered card (a border, not a shadow: Gmail strips
  shadows), an optional brand header and footer, a hidden `preheader`, and `@media` rules for
  dark mode and phones on the class hooks the other components carry. Clients that ignore
  `@media` keep the inline light design.
- `<EmailText size="heading|lg|md|sm">`, `<EmailButton>`, `<EmailDivider>`, `<EmailSection>`,
  `<EmailImage>`, `<EmailLink>`.
- `<EmailCode>`: a key or one-time code, large and monospace, selectable in one tap, wrapping at
  hyphens on a phone.

A colour passed as a prop is the template's own choice: that element gets no dark-mode hook.

Two stx traps when writing a component or template: never put the literal text of a style
tag inside a `<script server>` comment (the parser takes it for one), and write head CSS as a
raw string (`{!! css !!}`) rather than a style element, which stx lifts out as component CSS.

## Template Locations
- STX templates: `.stx` files processed by STX engine
- HTML templates: `.html` files with `{{ }}` variable interpolation
- Layouts: base HTML wrapping templates (header, footer, styles)

## Gotchas
- Plain sending functions and typed Mailable classes are both native. Prefer Mailable for reusable email types and preview/scaffold integration
- Templates support server-rendered .stx and interpolated .html; email recipients do not execute a reactive browser runtime
- Variable interpolation uses `{{ }}` - not `${}`
- `text` output is auto-generated from HTML via `htmlToText()`
- Layouts wrap the template content with shared structure (header/footer)
- For the email driver system (SES, SendGrid, etc.), see the `stacks-email` skill


## Typed Mailable and previews

~~~ts
import { Mailable } from '@stacksjs/email'

export default class WelcomeMail extends Mailable<{ name: string }> {
  constructor(private recipient: { name: string, email: string }) {
    super()
  }

  build() {
    return this.to(this.recipient.email)
      .subject('Welcome')
      .template('welcome', { name: this.recipient.name })
  }
}
~~~

`new WelcomeMail(recipient).send({ driver? })` returns EmailResult; inspect
success and throw when the caller relies on delivery. `Mailable.send()`
does not use sendOrFail internally. Setters also support cc/bcc/from/replyTo,
text/html, attach(path, name?) and attachData(bytes, name, mime?).
`inspect()` exposes the built preview state. Typed props are required at
template(), and template names are derived by buddy generate from app/default
email directories. Read the exported EmailTemplateReference type for extensions.

`buddy make:mail Name` creates a Mailable and its template. Native
`buddy mail:preview` discovers these without delivery; sample constructor
props live in `resources/emails/_previews/<kebab-name>.ts`. Preview routes are
development-only. Verify rendered HTML/text and attachments rather than sending
test mail to a real recipient as an automatic review step.

Source: `storage/framework/core/email/src/mailable.ts`,
`preview.ts`, `mime-preview.ts`; tests `mailable-types.test.ts`,
`preview.test.ts`, `template-resolution.test.ts` under
`core/email/tests/`. For provider failures, suppression, unsubscribe and
idempotency, read `stacks-email`.
