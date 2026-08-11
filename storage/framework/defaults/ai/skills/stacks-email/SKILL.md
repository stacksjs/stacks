---
name: stacks-email
description: Use when working with email in a Stacks application - sending emails via SES/SendGrid/Mailgun/Mailtrap/SMTP, email templates with STX, email drivers, the Mail singleton, the EmailSDK for inbox management, inbound MIME parsing, or email configuration. Covers @stacksjs/email, config/email.ts, and app/Mail/.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Email

Multi-driver email system with template rendering, S3-based inbox management, and 7 built-in drivers.

## Key Paths
- Core package: `storage/framework/core/email/src/`
- Configuration: `config/email.ts`
- Application mail: `app/Mail/`
- Persistence models: `storage/framework/defaults/app/Models/EmailSuppression.ts`, `EmailIdempotency.ts`, `EmailWebhookEvent.ts`
- Email layouts: `storage/framework/defaults/resources/emails/layouts/`
- Email resources: `storage/framework/defaults/resources/emails/`

## Source Files
```
email/src/
├── index.ts          # All exports
├── email.ts          # Email class + Mail singleton
├── template.ts       # Template rendering engine
├── inbound-parser.ts # Bounded RFC MIME parsing for inbound mail
├── types.ts          # Types and interfaces
├── sdk/index.ts      # EmailSDK (send + inbox and attachment management)
└── drivers/
    ├── base.ts       # BaseEmailDriver abstract class
    ├── ses.ts        # AWS SES driver
    ├── sendgrid.ts   # SendGrid driver
    ├── mailgun.ts    # Mailgun driver
    ├── mailtrap.ts   # Mailtrap driver (sandbox/production)
    └── smtp.ts       # Raw SMTP driver (TLS/STARTTLS)
```

`log` and `capture` are also registered by the Mail singleton. `log` writes
messages to `storage/logs/mail/` for local inspection. `capture` keeps messages
in memory for deterministic tests. Unsupported names fail at the first send,
so `MAIL_MAILER` must be one of `smtp`, `ses`, `sendgrid`, `mailgun`,
`mailtrap`, `log`, or `capture`.

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

// Use this when later state depends on successful provider delivery.
await mail.sendOrFail({
  to: 'user@example.com',
  subject: 'Your invitation',
  text: 'Open the invitation link.'
})

// Switch driver
const sendgridMail = mail.use('sendgrid')
await sendgridMail.send(message)
```

`mail.send()` always returns an `EmailResult`. Provider rejection is represented
as `{ success: false, message, provider }`, which is useful for campaign jobs
that aggregate individual outcomes. It may still throw for invalid framework
configuration. `mail.sendOrFail()` returns the same successful result and throws
`EmailDeliveryError` for a structured provider failure. Use `sendOrFail()` when
an action reports that mail was sent, when a caller relies on `.catch()`, or when
delivery status is persisted after the call.

Keep template rendering fallback separate from provider delivery. Resolve HTML
and text first, fall back to plain text only when rendering fails, then call
`sendOrFail()` once outside the template `try` block.

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
await emailSDK.sendTemplate({ to: 'user@example.com', template: 'welcome', data: { name: 'John' } })

// Read inbox (from S3)
const emails = await getInbox('chris', { limit: 20 })
const email = await emailSDK.getEmail('chris', messageId)
const attachments = await emailSDK.getAttachments('chris', messageId)
const download = await emailSDK.getAttachment('chris', messageId, attachments?.[0]?.id || '')

// Search
const results = await searchEmails('chris', { from: 'boss', after: new Date('2024-01-01'), hasAttachments: true })

// Manage
await emailSDK.markAsRead('chris', messageId)
await emailSDK.markAsUnread('chris', messageId)
await deleteEmail('chris', messageId)
```

## Built-in Drivers

### SES Driver
- Uses the `SESClient` from `@stacksjs/ts-cloud`
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

## Environment-backed configuration

The source of truth for dashboard mail settings is `.env`:

- Common: `MAIL_MAILER`, `MAIL_FROM_NAME`, `MAIL_FROM_ADDRESS`
- SMTP: `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`,
  `MAIL_ENCRYPTION`
- SES: `AWS_SES_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
- SendGrid: `SENDGRID_API_KEY`
- Mailgun: `MAILGUN_API_KEY`, `MAILGUN_DOMAIN`, `MAILGUN_ENDPOINT`
- Mailtrap: `MAILTRAP_HOST`, `MAILTRAP_TOKEN`, `MAILTRAP_INBOX_ID`

The dashboard endpoints are `GET` and `PUT` at
`/api/dashboard/mail-settings`. They are guarded outside local development,
return no stored secret values, preserve a secret when its input is blank, and
require an explicit clear flag to remove one. Writes use the shared atomic
environment-file service, create a machine-local backup under
`storage/framework/runtime/dashboard/`, and reject stale revisions instead of
overwriting concurrent edits.

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
  default: 'ses',  // 'ses' | 'sendgrid' | 'mailgun' | 'mailtrap' | 'smtp' | 'log' | 'capture'
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

  await mail.sendOrFail({
    from: { name: config.app.name, address: config.email.from.address },
    to,
    subject: 'Confirm your subscription',
    html,
    text
  })
}
```

## Delivery persistence models

Stacks ships three internal models and their generated migrations:

- `EmailSuppression` uses `email_suppressions` and uniquely keys `email + type`.
- `EmailIdempotency` uses `email_idempotency` and uniquely keys `idempotency_key`.
- `EmailWebhookEvent` uses `email_webhook_events` and uniquely keys `provider + event_id`.

Each model declares authenticated `useApi` index, show, and destroy routes, but
sets `dashboard.enabled` to false so operational records do not clutter the
generic model catalog. Sensitive idempotency keys, recipients, subjects, and
provider event IDs are hidden from generated responses. Run `buddy migrate`
after upgrading so suppression, send deduplication, and webhook deduplication
are enforced rather than using their legacy warn-once compatibility path.

## Inbound MIME and attachment storage

`parseInboundEmail()` parses RFC messages with bounded header, nesting, total-size, and attachment-count limits. It returns normalized sender and recipient data, text and HTML bodies, and binary-safe attachments. Attachment filenames are sanitized before they become S3 keys.

`buddy email:reprocess` reads raw messages with `getObjectBytes()`, parses them through this shared helper, and writes:

- `raw.eml`
- `metadata.json`
- `body.txt` and `body.html` when present
- binary objects under `attachments/`
- the per-mailbox `inbox.json` index

Reprocessing refreshes existing messages instead of skipping them, preserves their read state, and repairs body and attachment metadata written by older versions. The dashboard receives opaque attachment IDs, resolves them against the stored message before download, and never accepts arbitrary S3 keys from a client.

## CLI Commands
- `buddy email` / `buddy mail` - email management
- `buddy email:verify` - check domain verification
- `buddy email:test [recipient]` - send test email
- `buddy email:list` - list mailboxes
- `buddy email:logs -n 50` - view logs
- `buddy email:status` - server status
- `buddy email:inbox [mailbox]` - view inbox from S3
- `buddy email:reprocess` - parse raw S3 mail into mailbox bodies and attachments
- `buddy mail:user:add <email>` - add mail user
- `buddy mail:user:list` - list mail users
- `buddy mail:user:delete <email>` - delete mail user

## Gotchas
- Default driver is `ses` - requires AWS credentials
- Template rendering supports both `.stx` and `.html` files
- Variable interpolation uses `{{ }}` double-brace syntax
- The `mail` singleton auto-registers all 5 drivers on initialization
- SMTP driver handles TLS handshake manually (not via node:tls)
- SendGrid/Mailgun retry with exponential backoff on failure
- `mail.send()` returns structured failures; use `mail.sendOrFail()` when success is required
- Suppression, send idempotency, and webhook dedup are backed by built-in `useApi` models
- Mailtrap requires `inboxId` for sandbox mode
- EmailSDK reads inbox from S3 (bucket configured via env)
- EmailSDK attachment downloads use binary-safe S3 reads and opaque IDs
- `buddy email:reprocess` preserves existing read state and exits nonzero on failure
- Email categorization auto-sorts incoming mail by domain/substring patterns
- The `text` fallback is auto-generated from HTML via `htmlToText()`
