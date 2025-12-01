# Email Server

Stacks provides a fully serverless email infrastructure powered by AWS SES, S3, and Lambda.

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
