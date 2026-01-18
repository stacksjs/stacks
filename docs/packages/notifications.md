# Notifications Package

A multi-channel notification system supporting email, SMS, and chat (Slack) notifications with a unified API.

## Installation

```bash
bun add @stacksjs/notifications
```

## Basic Usage

```typescript
import { useNotification, useEmail, useSMS, useChat } from '@stacksjs/notifications'

// Use default notification channel
const notifier = useNotification()
await notifier.send({
  to: 'user@example.com',
  subject: 'Welcome!',
  message: 'Welcome to our platform.'
})

// Use specific channels
const email = useEmail()
const sms = useSMS()
const chat = useChat()
```

## Configuration

Configure notifications in `config/notification.ts`:

```typescript
export default {
  // Default notification type
  default: 'email',

  // Email configuration
  email: {
    default: 'mailtrap',

    drivers: {
      mailtrap: {
        host: 'smtp.mailtrap.io',
        port: 587,
        username: process.env.MAILTRAP_USERNAME,
        password: process.env.MAILTRAP_PASSWORD,
      },

      ses: {
        region: 'us-east-1',
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },

      resend: {
        apiKey: process.env.RESEND_API_KEY,
      },

      sendgrid: {
        apiKey: process.env.SENDGRID_API_KEY,
      },
    },
  },

  // SMS configuration
  sms: {
    default: 'twilio',

    drivers: {
      twilio: {
        accountSid: process.env.TWILIO_ACCOUNT_SID,
        authToken: process.env.TWILIO_AUTH_TOKEN,
        from: process.env.TWILIO_FROM_NUMBER,
      },

      nexmo: {
        apiKey: process.env.NEXMO_API_KEY,
        apiSecret: process.env.NEXMO_API_SECRET,
        from: process.env.NEXMO_FROM_NUMBER,
      },
    },
  },

  // Chat configuration
  chat: {
    default: 'slack',

    drivers: {
      slack: {
        webhookUrl: process.env.SLACK_WEBHOOK_URL,
        channel: '#notifications',
      },

      discord: {
        webhookUrl: process.env.DISCORD_WEBHOOK_URL,
      },

      teams: {
        webhookUrl: process.env.TEAMS_WEBHOOK_URL,
      },
    },
  },
}
```

## Email Notifications

### Using Email Driver

```typescript
import { useEmail } from '@stacksjs/notifications'

// Get email driver (uses default from config)
const email = useEmail()

// Send email
await email.send({
  to: 'user@example.com',
  subject: 'Order Confirmation',
  html: '<h1>Thank you for your order!</h1>',
  text: 'Thank you for your order!'
})
```

### Specifying Email Driver

```typescript
import { useEmail } from '@stacksjs/notifications'

// Use specific driver
const sesEmail = useEmail('ses')
const resendEmail = useEmail('resend')
const sendgridEmail = useEmail('sendgrid')

await sesEmail.send({
  to: 'user@example.com',
  from: 'noreply@myapp.com',
  subject: 'Welcome',
  html: '<p>Welcome to our platform!</p>'
})
```

### Email Options

```typescript
await email.send({
  // Recipients
  to: 'user@example.com',
  // Or multiple recipients
  to: ['user1@example.com', 'user2@example.com'],

  // Optional CC and BCC
  cc: 'manager@example.com',
  bcc: 'audit@example.com',

  // Sender
  from: 'noreply@myapp.com',
  fromName: 'My App',
  replyTo: 'support@myapp.com',

  // Content
  subject: 'Important Notification',
  html: '<h1>Hello</h1><p>This is the HTML content.</p>',
  text: 'Hello. This is the plain text content.',

  // Attachments
  attachments: [
    {
      filename: 'report.pdf',
      content: pdfBuffer,
      contentType: 'application/pdf'
    },
    {
      filename: 'image.png',
      path: '/path/to/image.png'
    }
  ],

  // Custom headers
  headers: {
    'X-Custom-Header': 'value'
  }
})
```

### Email Templates

```typescript
import { useEmail } from '@stacksjs/notifications'

const email = useEmail()

// Using template
await email.sendTemplate({
  to: 'user@example.com',
  template: 'welcome',
  data: {
    name: 'John',
    activationLink: 'https://myapp.com/activate/abc123'
  }
})

// Templates are stored in resources/views/emails/
// resources/views/emails/welcome.html
```

## SMS Notifications

### Using SMS Driver

```typescript
import { useSMS } from '@stacksjs/notifications'

// Get SMS driver
const sms = useSMS()

// Send SMS
await sms.send({
  to: '+1234567890',
  message: 'Your verification code is: 123456'
})
```

### Specifying SMS Driver

```typescript
import { useSMS } from '@stacksjs/notifications'

// Use Twilio
const twilio = useSMS('twilio')
await twilio.send({
  to: '+1234567890',
  message: 'Hello from Twilio!'
})

// Use Nexmo/Vonage
const nexmo = useSMS('nexmo')
await nexmo.send({
  to: '+1234567890',
  message: 'Hello from Nexmo!'
})
```

### SMS Options

```typescript
await sms.send({
  // Recipient phone number
  to: '+1234567890',

  // Message content (160 char limit for single SMS)
  message: 'Your order has shipped!',

  // Optional sender ID (if supported)
  from: 'MYAPP',

  // Optional callback URL for delivery status
  statusCallback: 'https://myapp.com/webhooks/sms-status'
})
```

## Chat Notifications

### Using Chat Driver

```typescript
import { useChat } from '@stacksjs/notifications'

// Get chat driver (uses Slack by default)
const chat = useChat()

// Send message
await chat.send({
  channel: '#alerts',
  message: 'New user registered!',
  username: 'MyApp Bot'
})
```

### Specifying Chat Driver

```typescript
import { useChat } from '@stacksjs/notifications'

// Slack
const slack = useChat('slack')
await slack.send({
  channel: '#general',
  message: 'Hello Slack!'
})

// Discord
const discord = useChat('discord')
await discord.send({
  message: 'Hello Discord!'
})

// Microsoft Teams
const teams = useChat('teams')
await teams.send({
  message: 'Hello Teams!'
})
```

### Rich Slack Messages

```typescript
import { useChat } from '@stacksjs/notifications'

const slack = useChat('slack')

await slack.send({
  channel: '#orders',
  text: 'New Order Received',
  blocks: [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: 'New Order #12345'
      }
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: '*Customer:*\nJohn Doe'
        },
        {
          type: 'mrkdwn',
          text: '*Total:*\n$299.99'
        }
      ]
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'View Order'
          },
          url: 'https://admin.myapp.com/orders/12345'
        }
      ]
    }
  ]
})
```

## Unified Notification API

### Using useNotification

```typescript
import { useNotification, notification } from '@stacksjs/notifications'

// Get notification helper with default type
const notifier = useNotification()

// Or specify type and driver
const emailNotifier = useNotification('email', 'ses')
const smsNotifier = useNotification('sms', 'twilio')
const chatNotifier = useNotification('chat', 'slack')
```

### notification Function

```typescript
import { notification } from '@stacksjs/notifications'

// Quick access to default notification channel
const notifier = notification()
```

## Creating Notification Classes

Create reusable notification classes:

```typescript
// app/Notifications/OrderShipped.ts
import { useEmail, useSMS, useChat } from '@stacksjs/notifications'

export default class OrderShipped {
  private order: Order
  private user: User

  constructor(order: Order, user: User) {
    this.order = order
    this.user = user
  }

  // Define notification channels
  via(): string[] {
    return ['email', 'sms', 'chat']
  }

  // Email notification
  async toEmail() {
    const email = useEmail()
    await email.send({
      to: this.user.email,
      subject: `Your Order #${this.order.id} Has Shipped!`,
      html: `
        <h1>Great news!</h1>
        <p>Your order has been shipped and is on its way.</p>
        <p>Tracking number: ${this.order.trackingNumber}</p>
      `
    })
  }

  // SMS notification
  async toSMS() {
    const sms = useSMS()
    await sms.send({
      to: this.user.phone,
      message: `Your order #${this.order.id} has shipped! Track: ${this.order.trackingNumber}`
    })
  }

  // Chat notification (for internal team)
  async toChat() {
    const chat = useChat()
    await chat.send({
      channel: '#fulfillment',
      message: `Order #${this.order.id} shipped to ${this.user.name}`
    })
  }

  // Send all notifications
  async send() {
    const channels = this.via()

    if (channels.includes('email')) {
      await this.toEmail()
    }
    if (channels.includes('sms')) {
      await this.toSMS()
    }
    if (channels.includes('chat')) {
      await this.toChat()
    }
  }
}

// Usage
const notification = new OrderShipped(order, user)
await notification.send()
```

## Queued Notifications

Send notifications asynchronously via queue:

```typescript
import { dispatch } from '@stacksjs/queue'

// Queue notification for async processing
await dispatch('send-notification', {
  type: 'email',
  driver: 'ses',
  payload: {
    to: 'user@example.com',
    subject: 'Welcome',
    html: '<p>Welcome!</p>'
  }
})
```

Create the job handler:

```typescript
// app/Jobs/SendNotification.ts
import { Job } from '@stacksjs/queue'
import { useNotification } from '@stacksjs/notifications'

export default class SendNotification extends Job {
  queue = 'notifications'
  tries = 3

  async handle(data: {
    type: string
    driver?: string
    payload: any
  }) {
    const notifier = useNotification(data.type, data.driver)
    await notifier.send(data.payload)
  }
}
```

## Error Handling

```typescript
import { useEmail } from '@stacksjs/notifications'

const email = useEmail()

try {
  await email.send({
    to: 'user@example.com',
    subject: 'Test',
    html: '<p>Test</p>'
  })
} catch (error) {
  if (error.code === 'INVALID_RECIPIENT') {
    // Handle invalid email address
    console.error('Invalid email address')
  } else if (error.code === 'RATE_LIMITED') {
    // Handle rate limiting
    console.error('Too many emails, try again later')
  } else {
    // Handle other errors
    console.error('Failed to send email:', error.message)
  }
}
```

## Edge Cases

### Handling Bounced Emails

```typescript
// Configure bounce webhook
// POST /webhooks/email-bounce
router.post('/webhooks/email-bounce', async (req) => {
  const { email, bounceType, timestamp } = req.body

  // Mark email as bounced in database
  await User.where('email', '=', email)
    .update({ email_bounced: true })

  // Don't send to bounced addresses
})
```

### Rate Limiting

```typescript
import { useEmail } from '@stacksjs/notifications'
import { cache } from '@stacksjs/cache'

async function sendWithRateLimit(to: string, subject: string, html: string) {
  const key = `email:rate:${to}`
  const sent = await cache.get(key) || 0

  if (sent >= 10) {
    throw new Error('Rate limit exceeded for this recipient')
  }

  const email = useEmail()
  await email.send({ to, subject, html })

  await cache.set(key, sent + 1, 3600) // 1 hour window
}
```

### Retry Failed Notifications

```typescript
import { useEmail } from '@stacksjs/notifications'

async function sendWithRetry(
  payload: any,
  maxRetries = 3,
  delay = 1000
) {
  const email = useEmail()

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await email.send(payload)
      return // Success
    } catch (error) {
      if (attempt === maxRetries) {
        throw error // Final failure
      }
      await new Promise(r => setTimeout(r, delay * attempt))
    }
  }
}
```

### Handling Large Recipient Lists

```typescript
import { useEmail } from '@stacksjs/notifications'

async function sendBulkEmail(
  recipients: string[],
  subject: string,
  html: string
) {
  const email = useEmail()
  const batchSize = 50

  for (let i = 0; i < recipients.length; i += batchSize) {
    const batch = recipients.slice(i, i + batchSize)

    await Promise.all(
      batch.map(to => email.send({ to, subject, html }))
    )

    // Delay between batches to avoid rate limits
    await new Promise(r => setTimeout(r, 1000))
  }
}
```

## API Reference

### Functions

| Function | Description |
|----------|-------------|
| `useNotification(type?, driver?)` | Get notification driver |
| `notification()` | Get default notifier |
| `useEmail(driver?)` | Get email driver |
| `useSMS(driver?)` | Get SMS driver |
| `useChat(driver?)` | Get chat driver |

### Email Options

| Option | Type | Description |
|--------|------|-------------|
| `to` | string/string[] | Recipient(s) |
| `from` | string | Sender address |
| `subject` | string | Email subject |
| `html` | string | HTML content |
| `text` | string | Plain text content |
| `cc` | string/string[] | CC recipients |
| `bcc` | string/string[] | BCC recipients |
| `replyTo` | string | Reply-to address |
| `attachments` | array | File attachments |

### SMS Options

| Option | Type | Description |
|--------|------|-------------|
| `to` | string | Phone number |
| `message` | string | SMS content |
| `from` | string | Sender ID |

### Chat Options

| Option | Type | Description |
|--------|------|-------------|
| `channel` | string | Channel name |
| `message` | string | Message text |
| `username` | string | Bot username |
| `blocks` | array | Rich message blocks |
