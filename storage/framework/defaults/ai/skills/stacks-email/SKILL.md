---
name: stacks-email
description: Use when working with email in a Stacks application — sending emails via SES/SendGrid/Mailgun/Mailtrap/SMTP, email templates with STX, email drivers, the Mail singleton, the EmailSDK for inbox management, or email configuration. Covers @stacksjs/email, config/email.ts, and app/Mail/.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Email

Multi-driver email system with template rendering, S3-based inbox management, and 5 built-in drivers.

## Key Paths
- Core package: `storage/framework/core/email/src/`
- Configuration: `config/email.ts`
- Application mail: `app/Mail/`
- Email layouts: `storage/framework/defaults/layouts/emails/`
- Email resources: `storage/framework/defaults/resources/emails/`

## Source Files
```
email/src/
├── index.ts          # All exports
├── email.ts          # Email class + Mail singleton
├── template.ts       # Template rendering engine
├── types.ts          # Types and interfaces
├── sdk/index.ts      # EmailSDK (send + inbox management)
└── drivers/
    ├── base.ts       # BaseEmailDriver abstract class
    ├── ses.ts        # AWS SES driver
    ├── sendgrid.ts   # SendGrid driver
    ├── mailgun.ts    # Mailgun driver
    ├── mailtrap.ts   # Mailtrap driver (sandbox/production)
    └── smtp.ts       # Raw SMTP driver (TLS/STARTTLS)
```

## Mail Singleton

```typescript
import { mail } from '@stacksjs/email'

await mail.send({
  from: { name: 'App', address: 'noreply@app.com' },
  to: 'user@example.com',
  subject: 'Welcome',
  html: '<h1>Hello!</h1>',
  text: 'Hello!'
})

// Switch driver
const sendgridMail = mail.use('sendgrid')
await sendgridMail.send(message)
```

## Email Class

```typescript
const email = new Email({
  name: 'WelcomeEmail',
  subject: 'Welcome!',
  to: 'user@example.com',
  from: { name: 'App', address: 'noreply@app.com' },
  template: 'welcome',     // looks for welcome.stx or welcome.html
  handle: async () => ({ message: 'sent' }),
  onError: async (err) => ({ message: err.message }),
  onSuccess: () => console.log('Sent!')
})

const html = await email.renderTemplate()
await email.send()
await email.send('override@email.com')
```

## Template Rendering

```typescript
import { template, renderHtml, templateExists, listTemplates } from '@stacksjs/email'

const { html, text } = await template('welcome', {
  variables: { name: 'John', url: 'https://app.com' },
  layout: 'default',   // or false to skip layout
  subject: 'Welcome'
})

// Raw HTML rendering
const { html, text } = renderHtml('<h1>Hello {{name}}</h1>', { name: 'World' })

templateExists('welcome')   // boolean
listTemplates()              // string[]
```

Variable interpolation uses `{{ variable }}` syntax. Templates can be `.stx` (processed by STX engine) or `.html`.

## EmailSDK (Inbox Management via S3)

```typescript
import { emailSDK, sendEmail, getInbox, searchEmails, deleteEmail } from '@stacksjs/email'

// Send
await sendEmail({ from: { address: 'a@b.com' }, to: 'c@d.com', subject: 'Hi', html: '<p>Hello</p>' })

// Send with template
await emailSDK.sendTemplate({ to: 'user@example.com', templateName: 'welcome', data: { name: 'John' } })

// Read inbox (from S3)
const emails = await getInbox('chris', { limit: 20 })
const email = await emailSDK.getEmail('chris', messageId)

// Search
const results = await searchEmails('chris', { from: 'boss', after: '2024-01-01', hasAttachments: true })

// Manage
await emailSDK.markAsRead('chris', messageId)
await emailSDK.markAsUnread('chris', messageId)
await deleteEmail('chris', messageId)
```

## Built-in Drivers

### SES Driver
- Uses `@aws-sdk/client-ses` SESClient
- Lazy-loads client on first send
- Supports `Source` formatting: `"Name" <address>`

### SendGrid Driver
- API key from config/env
- Multipart content (HTML + text)
- Attachment support (base64 encoding)
- Retry with exponential backoff

### Mailgun Driver
- FormData construction with recipients
- CC/BCC support
- Attachment handling via FormData
- Configurable domain and endpoint

### Mailtrap Driver
- Inbox-aware sending
- Sandbox and production modes
- Host default: `sandbox.api.mailtrap.io`

### SMTP Driver
- Raw TCP/TLS socket connection
- STARTTLS upgrade support
- AUTH LOGIN authentication
- MIME multipart (text + HTML)
- 30-second connection timeout
- Command queue-based protocol

## Driver Interface

```typescript
abstract class BaseEmailDriver {
  abstract name: string
  abstract send(message: EmailMessage, options?: TemplateOptions): Promise<EmailResult>
  protected validateMessage(message): boolean
  protected formatAddresses(...): string[]
  protected handleError(error, message): Promise<EmailResult>
  protected handleSuccess(message, messageId?): Promise<EmailResult>
}
```

## config/email.ts

```typescript
{
  from: { name: env.MAIL_FROM_NAME, address: env.MAIL_FROM_ADDRESS },
  domain: 'stacksjs.com',
  mailboxes: ['chris', 'blake', 'glenn'],
  url: env.APP_URL,
  charset: 'UTF-8',
  default: 'ses',  // 'ses' | 'sendgrid' | 'mailgun' | 'mailtrap' | 'smtp' | 'postmark'
  server: {
    enabled: true,
    scan: { enabled: true },
    subdomain: 'mail',
    mode: 'server',  // 'server' | 'serverless'
    ports: { smtp: 25, smtps: 465, submission: 587, imap: 143, imaps: 993 },
    features: { imap: true, pop3: false, webmail: false, calDAV: false },
    categorization: {
      enabled: true,
      social: { domains: ['facebook', 'twitter', ...] },
      forums: { domains: ['reddit', ...] },
      updates: { substrings: ['noreply', 'no-reply', ...] },
      promotions: { substrings: ['unsubscribe', 'promo', ...] }
    }
  },
  notifications: { newEmail: true, bounces: true, complaints: true }
}
```

## Application Mail Example

```typescript
// app/Mail/SubscriptionConfirmation.ts
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

## CLI Commands
- `buddy email` / `buddy mail` — email management
- `buddy email:verify` — check domain verification
- `buddy email:test [recipient]` — send test email
- `buddy email:list` — list mailboxes
- `buddy email:logs -n 50` — view logs
- `buddy email:status` — server status
- `buddy email:inbox [mailbox]` — view inbox from S3
- `buddy mail:user:add <email>` — add mail user
- `buddy mail:user:list` — list mail users
- `buddy mail:user:delete <email>` — delete mail user

## Gotchas
- Default driver is `ses` — requires AWS credentials
- Template rendering supports both `.stx` and `.html` files
- Variable interpolation uses `{{ }}` double-brace syntax
- The `mail` singleton auto-registers all 5 drivers on initialization
- SMTP driver handles TLS handshake manually (not via node:tls)
- SendGrid/Mailgun retry with exponential backoff on failure
- Mailtrap requires `inboxId` for sandbox mode
- EmailSDK reads inbox from S3 (bucket configured via env)
- Email categorization auto-sorts incoming mail by domain/substring patterns
- The `text` fallback is auto-generated from HTML via `htmlToText()`
