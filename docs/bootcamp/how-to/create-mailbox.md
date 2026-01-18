# Create Mailbox

This guide covers setting up email functionality in your Stacks application, including SMTP configuration, sending emails, and creating custom mailboxes using AWS SES and S3.

## Getting Started

Stacks provides a streamlined email solution leveraging AWS SES for email handling and S3 for storage, offering a serverless email server solution.

## Benefits

- Unmanaged email server
- Unlimited email addresses/mailboxes
- Easily organize messages
- No server installation or configuration
- No server maintenance

## SMTP Configuration

### Environment Variables

```env
# SMTP Configuration
MAIL_MAILER=ses
MAIL_FROM_ADDRESS=hello@yourdomain.com
MAIL_FROM_NAME="Your App Name"

# AWS SES Configuration
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_DEFAULT_REGION=us-east-1

# Optional: Custom SMTP
MAIL_HOST=smtp.mailtrap.io
MAIL_PORT=587
MAIL_USERNAME=your_username
MAIL_PASSWORD=your_password
MAIL_ENCRYPTION=tls
```

### Mail Configuration

```ts
// config/email.ts
export default {
  default: 'ses',

  mailers: {
    ses: {
      transport: 'ses',
      region: process.env.AWS_DEFAULT_REGION,
    },

    smtp: {
      transport: 'smtp',
      host: process.env.MAIL_HOST,
      port: parseInt(process.env.MAIL_PORT || '587'),
      encryption: process.env.MAIL_ENCRYPTION,
      username: process.env.MAIL_USERNAME,
      password: process.env.MAIL_PASSWORD,
    },

    log: {
      transport: 'log',
    },
  },

  from: {
    address: process.env.MAIL_FROM_ADDRESS,
    name: process.env.MAIL_FROM_NAME,
  },
}
```

## AWS SES Setup

### Step 1: Verify Your Domain

```bash
# Using AWS CLI
aws ses verify-domain-identity --domain yourdomain.com
```

Add the verification TXT record to your DNS:

```
Type: TXT
Name: _amazonses.yourdomain.com
Value: <verification-token-from-aws>
```

### Step 2: Configure DKIM

```bash
aws ses verify-domain-dkim --domain yourdomain.com
```

Add CNAME records for DKIM:

```
<token1>._domainkey.yourdomain.com -> <token1>.dkim.amazonses.com
<token2>._domainkey.yourdomain.com -> <token2>.dkim.amazonses.com
<token3>._domainkey.yourdomain.com -> <token3>.dkim.amazonses.com
```

### Step 3: Set Up MX Record for Receiving

```
Type: MX
Name: yourdomain.com
Value: 10 inbound-smtp.us-east-1.amazonaws.com
```

## Sending Emails

### Basic Email

```ts
import { mail } from '@stacksjs/email'

await mail.send({
  to: 'user@example.com',
  subject: 'Welcome to our app!',
  html: '<h1>Welcome!</h1><p>Thanks for signing up.</p>',
})
```

### Using Templates

```ts
await mail.send({
  to: 'user@example.com',
  subject: 'Welcome to our app!',
  template: 'welcome',
  data: {
    name: 'John',
    verificationUrl: 'https://yourapp.com/verify?token=abc123',
  },
})
```

### Template File

```html
<!-- resources/emails/welcome.html -->
<!DOCTYPE html>
<html>
<head>
  <style>
    .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
    .header { background: #4F46E5; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; }
    .button { display: inline-block; padding: 12px 24px; background: #4F46E5; color: white; text-decoration: none; border-radius: 6px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Welcome, {{ name }}!</h1>
    </div>
    <div class="content">
      <p>Thanks for signing up. Please verify your email address:</p>
      <p><a href="{{ verificationUrl }}" class="button">Verify Email</a></p>
    </div>
  </div>
</body>
</html>
```

### Sending with Attachments

```ts
await mail.send({
  to: 'user@example.com',
  subject: 'Your Invoice',
  template: 'invoice',
  data: { invoiceNumber: 'INV-001' },
  attachments: [
    {
      filename: 'invoice.pdf',
      content: pdfBuffer,
      contentType: 'application/pdf',
    },
  ],
})
```

### Bulk Emails

```ts
import { mail } from '@stacksjs/email'

const recipients = [
  { email: 'user1@example.com', name: 'User 1' },
  { email: 'user2@example.com', name: 'User 2' },
]

for (const recipient of recipients) {
  await mail.send({
    to: recipient.email,
    subject: 'Newsletter',
    template: 'newsletter',
    data: { name: recipient.name },
  })

  // Add delay to respect rate limits
  await new Promise(resolve => setTimeout(resolve, 100))
}
```

## Receiving Emails

### SES Receipt Rules

Set up SES to store incoming emails in S3:

```ts
// infrastructure/email-receiving.ts
import * as ses from 'aws-cdk-lib/aws-ses'
import * as actions from 'aws-cdk-lib/aws-ses-actions'
import * as s3 from 'aws-cdk-lib/aws-s3'

const emailBucket = new s3.Bucket(this, 'EmailBucket', {
  bucketName: 'your-email-bucket',
})

const receiptRuleSet = new ses.ReceiptRuleSet(this, 'RuleSet', {
  receiptRuleSetName: 'default-rule-set',
})

new ses.ReceiptRule(this, 'ReceiptRule', {
  ruleSet: receiptRuleSet,
  recipients: ['yourdomain.com'],
  actions: [
    new actions.S3({
      bucket: emailBucket,
      objectKeyPrefix: 'emails/',
    }),
  ],
})
```

### Processing Incoming Emails

```ts
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { simpleParser } from 'mailparser'

const s3Client = new S3Client({ region: 'us-east-1' })

async function processIncomingEmail(bucketName: string, key: string) {
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
  })

  const response = await s3Client.send(command)
  const rawEmail = await response.Body?.transformToString()

  if (!rawEmail) return

  const parsed = await simpleParser(rawEmail)

  return {
    from: parsed.from?.text,
    to: parsed.to?.text,
    subject: parsed.subject,
    text: parsed.text,
    html: parsed.html,
    attachments: parsed.attachments,
    date: parsed.date,
  }
}
```

## Endless Email Addresses

Once your domain is verified with SES, you can use any email address format:

### Service-Based Organization

```
facebook@yourdomain.com
instagram@yourdomain.com
linkedin@yourdomain.com
```

### Using + for Organization

The `+` character creates folder structures in S3:

```
accounts+social+facebook@yourdomain.com
accounts+social+instagram@yourdomain.com
accounts+travel+car+hertz@yourdomain.com
accounts+money+paypal@yourdomain.com
```

### Client Organization

```
clients+company_name+aws+account_name@yourdomain.com
clients+company_name+stripe@yourdomain.com
clients+company_name+sentry@yourdomain.com
```

### Alert Organization

```
alarms+company_name+aws+account_name+alarm_type@yourdomain.com
alarms+company_name+sentry+alarm_type@yourdomain.com
```

## Email Queuing

### Queue Configuration

```ts
// config/queue.ts
export default {
  default: 'database',

  connections: {
    database: {
      driver: 'database',
      table: 'jobs',
      queue: 'default',
      retry_after: 90,
    },
  },
}
```

### Queue Email Jobs

```ts
import { queue } from '@stacksjs/queue'

interface SendEmailJob {
  to: string
  subject: string
  template: string
  data: Record<string, any>
}

// Queue an email
await queue.push<SendEmailJob>('send-email', {
  to: 'user@example.com',
  subject: 'Welcome!',
  template: 'welcome',
  data: { name: 'John' },
})

// Process email jobs
queue.process<SendEmailJob>('send-email', async (job) => {
  await mail.send({
    to: job.data.to,
    subject: job.data.subject,
    template: job.data.template,
    data: job.data.data,
  })
})
```

## Email Tracking

### Track Opens

```ts
async function sendTrackableEmail(userId: number, emailType: string) {
  const trackingId = randomUUIDv7()

  await EmailTracking.create({
    id: trackingId,
    user_id: userId,
    email_type: emailType,
    sent_at: new Date().toISOString(),
  })

  const trackingPixel = `<img src="${process.env.APP_URL}/api/email/track/${trackingId}" width="1" height="1" />`

  await mail.send({
    to: user.email,
    subject: 'Your newsletter',
    html: `<p>Content here...</p>${trackingPixel}`,
  })
}

// Tracking endpoint
router.get('/api/email/track/:id', async (request) => {
  const { id } = request.params

  await EmailTracking.where('id', '=', id).update({
    opened_at: new Date().toISOString(),
  })

  // Return 1x1 transparent GIF
  const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64')

  return new Response(pixel, {
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store',
    },
  })
})
```

### Track Clicks

```ts
async function trackClickUrl(originalUrl: string, trackingId: string): string {
  const encodedUrl = encodeURIComponent(originalUrl)
  return `${process.env.APP_URL}/api/email/click/${trackingId}?url=${encodedUrl}`
}

router.get('/api/email/click/:id', async (request) => {
  const { id } = request.params
  const url = new URL(request.url)
  const redirectUrl = url.searchParams.get('url')

  await EmailClick.create({
    tracking_id: id,
    url: redirectUrl,
    clicked_at: new Date().toISOString(),
  })

  return Response.redirect(decodeURIComponent(redirectUrl!))
})
```

## Testing Emails

### Development Mode

```ts
// Use log mailer in development
// config/email.ts
export default {
  default: process.env.NODE_ENV === 'development' ? 'log' : 'ses',
}
```

### Email Preview

```ts
// Preview emails in browser during development
router.get('/dev/email-preview/:template', async (request) => {
  if (process.env.NODE_ENV !== 'development') {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  const { template } = request.params

  const html = await renderEmailTemplate(template, {
    name: 'Test User',
    verificationUrl: 'https://example.com/verify',
  })

  return new Response(html, {
    headers: { 'Content-Type': 'text/html' },
  })
})
```

## Error Handling

```ts
try {
  await mail.send({
    to: 'user@example.com',
    subject: 'Hello',
    html: '<p>Content</p>',
  })
} catch (error) {
  if (error.code === 'MessageRejected') {
    console.error('Email rejected by SES:', error.message)
  } else if (error.code === 'InvalidParameterValue') {
    console.error('Invalid email parameter:', error.message)
  } else {
    console.error('Failed to send email:', error)
  }
}
```

## Best Practices

1. **Use templates** - Keep email content in separate template files
2. **Queue emails** - Don't send emails synchronously in request handlers
3. **Handle bounces** - Set up SNS notifications for bounces and complaints
4. **Respect rate limits** - SES has sending limits; add delays for bulk emails
5. **Validate addresses** - Verify email addresses before adding to mailing lists
6. **Test thoroughly** - Use the log mailer in development

This documentation covers the essential email and mailbox functionality. Each function is designed for reliable email delivery using AWS SES.
