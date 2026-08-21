---
title: Email Server
description: "Stacks provides a fully serverless email infrastructure powered by AWS SES, S3, and Lambda."
---
# Email Server

Stacks provides a fully serverless email infrastructure powered by AWS SES, S3, and Lambda.

> Just need to route outgoing mail through SES (no inbox needed)? See [Sending email via AWS SES](./email-ses.md) for the env-var + DNS + sandbox checklist.

## Local development

```bash
buddy mail:dev
```

That runs the [mail server](https://github.com/mail-os/mail) as a **catcher**:
it accepts every message your app sends, delivers none of them onward, and shows
them all in its webmail UI.

| | |
| --- | --- |
| SMTP | `127.0.0.1:1025` |
| Webmail | `http://localhost:8025` — sign in as `dev` / `dev` |
| Mailboxes | `storage/framework/mail/` |

Every recipient is accepted, whatever domain it is addressed to, and everything
lands in one inbox — so what you see is the list of what your app just sent.

`.env.example` already points at it, so nothing else has to be configured:

```bash
MAIL_MAILER=smtp
MAIL_HOST=127.0.0.1
MAIL_PORT=1025
```

### Why not mailpit

Because a development mail trap and a production mail server being two different
programs is where mail breaks. A message that renders in mailpit has been
through a parser nothing in production will ever run; a `From` header mailpit
accepts is one no real MTA would. The bugs that costs are the ones nobody can
reproduce locally, which is the worst kind to own.

`buddy mail:dev` is the same binary that runs in production, with delivery
switched off, authentication switched off, and bound to loopback — one parser,
one Maildir, one UI, from a laptop to production. It listens on 1025 and serves
its UI on 8025, which are mailpit's ports, so anything already pointed at a
mailpit is already pointed at this.

It binds `127.0.0.1` and does not offer that as an option — the server itself
refuses to start in trap mode on any other interface. A process that accepts
every message for every recipient and shows them in a UI is an open relay's more
embarrassing cousin: it does not forward the spam, it files it.

### Deploying one

`ts-cloud` provisions the same server for real from
`managedServices: { mail: true }` — see
[its mail documentation](https://ts-cloud.stacksjs.com/features/mail). Production
gets an MTA with DKIM and ACME TLS; every other environment gets the catcher
above, on the same ports, with `MAIL_*` written into the app's `.env` for you.

## Configuration

Configure your email settings in `config/email.ts`:

```typescript
export default {
  from: {
    name: 'Your App',
    address: 'no-reply@yourdomain.com',
  },

  domain: 'yourdomain.com',

  mailboxes: ['user@yourdomain.com', 'support@yourdomain.com'],

  server: {
    enabled: true,
    scan: true, // spam/virus scanning
    storage: {
      retentionDays: 90,
      archiveAfterDays: 30,
    },
  },

  notifications: {
    newEmail: true,
    bounces: true,
    complaints: true,
  },

  default: 'ses',
}
```

## Deployment

Deploy your email infrastructure with:

```bash
./buddy deploy
```

This creates:

- SES domain identity with DKIM
- S3 bucket for email storage
- Lambda functions for processing
- Receipt rules for inbound email
- SNS topics for notifications

## CLI Commands

```bash
# Run the local mail catcher (SMTP 1025, webmail 8025)
./buddy mail:dev

# Check domain verification status
./buddy email:verify

# Send a test email
./buddy email:test recipient@example.com

# List configured mailboxes
./buddy email:list

# View email processing logs
./buddy email:logs

# Check email server status
./buddy email:status
```

## SDK Usage

### Sending Emails

```typescript
import { sendEmail } from '@stacksjs/email/sdk'

await sendEmail({
  to: 'recipient@example.com',
  subject: 'Hello',
  html: '<p>Hello World!</p>',
  text: 'Hello World!',
})
```

### Reading Inbox

```typescript
import { getInbox, searchEmails } from '@stacksjs/email/sdk'

// Get inbox emails
const emails = await getInbox('user@yourdomain.com', { limit: 50 })

// Search emails
const results = await searchEmails('user@yourdomain.com', {
  from: 'sender@example.com',
  subject: 'important',
  after: new Date('2024-01-01'),
})
```

### Templated Emails

```typescript
import { EmailSDK } from '@stacksjs/email/sdk'

const email = new EmailSDK()

await email.sendTemplate({
  to: 'user@example.com',
  template: 'Welcome to {{appName}}!',
  data: { appName: 'My App' },
})
```

## Architecture

```
Inbound Email Flow:
┌─────────┐    ┌─────┐    ┌────────┐    ┌────────┐
│ Sender  │───▶│ SES │───▶│   S3   │───▶│ Lambda │
└─────────┘    └─────┘    └────────┘    └────────┘
                                              │
                                              ▼
                                        ┌─────────┐
                                        │   SNS   │
                                        └─────────┘

Outbound Email Flow:
┌─────────┐    ┌────────┐    ┌─────┐    ┌───────────┐
│   App   │───▶│   S3   │───▶│ SES │───▶│ Recipient │
└─────────┘    └────────┘    └─────┘    └───────────┘
```

## Troubleshooting

### Domain Not Verified

1. Check DNS records are properly configured
2. Run `./buddy email:verify` to see required DKIM records
3. Wait up to 72 hours for DNS propagation

### Emails Not Received

1. Check SES receipt rules are active
2. Verify MX records point to SES
3. Check Lambda logs: `./buddy email:logs`

### Bounce/Complaint Issues

1. Monitor bounce rates in SES console
2. Check suppression list
3. Review email content for spam triggers

## API Reference

### EmailSDK

| Method | Description |
|--------|-------------|
| `send(message)` | Send an email |
| `sendTemplate(options)` | Send templated email |
| `getInbox(mailbox, options)` | Get inbox emails |
| `getEmail(mailbox, messageId)` | Get specific email |
| `search(mailbox, options)` | Search emails |
| `delete(mailbox, messageId)` | Delete email |
| `markAsRead(mailbox, messageId)` | Mark as read |
| `markAsUnread(mailbox, messageId)` | Mark as unread |
