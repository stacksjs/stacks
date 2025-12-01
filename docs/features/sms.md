# SMS Service

Stacks provides SMS capabilities powered by AWS Pinpoint.

## Configuration

Configure your SMS settings in `config/sms.ts`:

```typescript
export default {
  enabled: true,

  provider: 'pinpoint',

  senderId: 'MyApp', // Sender ID (where supported)
  originationNumber: '+1234567890', // Dedicated number

  defaultCountryCode: 'US',
  messageType: 'TRANSACTIONAL', // or 'PROMOTIONAL'

  maxSpendPerMonth: 100, // Budget limit in USD

  optOut: {
    enabled: true,
    keywords: ['STOP', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT'],
  },

  templates: [
    {
      name: 'verification',
      body: 'Your verification code is {{code}}. Valid for 10 minutes.',
      variables: ['code'],
    },
  ],

  twoWay: {
    enabled: false,
    webhookUrl: 'https://your-app.com/api/sms/webhook',
  },
}
```

## Deployment

Deploy your SMS infrastructure with:

```bash
./buddy deploy
```

This creates:

- Pinpoint application
- SMS channel configuration
- Lambda functions for sending/receiving
- DynamoDB tables for message logs and opt-outs
- SNS topics for delivery status

## CLI Commands

```bash
# Check SMS service status
./buddy sms:status

# Send a test SMS
./buddy sms:send +1234567890 "Hello from Stacks!"

# Initialize SMS infrastructure
./buddy sms:setup
```

## SDK Usage

### Sending SMS

```typescript
import { sendSms } from '@stacksjs/communication'

await sendSms({
  to: '+1234567890',
  body: 'Hello from Stacks!',
  messageType: 'TRANSACTIONAL',
})
```

### Templated SMS

```typescript
import { SmsSDK } from '@stacksjs/communication'

const sms = new SmsSDK()

await sms.sendTemplate({
  to: '+1234567890',
  template: 'Your code is {{code}}',
  data: { code: '123456' },
})
```

### Bulk SMS

```typescript
import { SmsSDK } from '@stacksjs/communication'

const sms = new SmsSDK()

const results = await sms.sendBulk([
  { to: '+1111111111', body: 'Message 1' },
  { to: '+2222222222', body: 'Message 2' },
  { to: '+3333333333', body: 'Message 3' },
])
```

## Architecture

```text
Outbound SMS Flow:
┌─────────┐    ┌──────────┐    ┌────────┐    ┌───────────┐
│   App   │───▶│  Lambda  │───▶│Pinpoint│───▶│ Recipient │
└─────────┘    └──────────┘    └────────┘    └───────────┘
                    │
                    ▼
              ┌──────────┐
              │ DynamoDB │
              └──────────┘

Inbound SMS Flow (Two-Way):
┌───────────┐    ┌────────┐    ┌─────┐    ┌────────┐
│  Sender   │───▶│Pinpoint│───▶│ SNS │───▶│ Lambda │
└───────────┘    └────────┘    └─────┘    └────────┘
                                               │
                    ┌──────────────────────────┤
                    ▼                          ▼
              ┌──────────┐              ┌─────────────┐
              │ DynamoDB │              │   Webhook   │
              └──────────┘              └─────────────┘
```

## Opt-Out Handling

Stacks automatically handles opt-out keywords:

| Keyword | Action |
|---------|--------|
| STOP | Opt out |
| UNSUBSCRIBE | Opt out |
| CANCEL | Opt out |
| END | Opt out |
| QUIT | Opt out |
| START | Opt in |
| SUBSCRIBE | Opt in |

Opted-out numbers are stored in DynamoDB and automatically excluded from sends.

## Compliance

### US Regulations (TCPA)

- Always obtain consent before sending
- Honor opt-out requests immediately
- Include opt-out instructions
- Respect quiet hours (8am-9pm local time)

### 10DLC Registration

For A2P messaging in the US:

1. Register your brand with The Campaign Registry
2. Register your campaign/use case
3. Associate with your phone number

### Sender ID

Some countries require registered Sender IDs:

- UK, Germany, France require registration
- US does not support Sender ID for most carriers

## Troubleshooting

### SMS Not Delivered

1. Check phone number format (E.164)
2. Verify Pinpoint app is configured
3. Check delivery status in logs
4. Verify recipient hasn't opted out

### Delivery Failures

| Status | Cause | Solution |
|--------|-------|----------|
| OPTED_OUT | Recipient opted out | Remove from list |
| INVALID | Invalid phone number | Validate format |
| BLOCKED | Carrier blocked | Check content |
| UNREACHABLE | Phone unreachable | Retry later |

### Rate Limiting

Default limits:

- 20 messages/second (soft limit)
- 200 messages/second (hard limit)

Request limit increase via AWS Support.

## Cost Considerations

| Resource | Cost |
|----------|------|
| Outbound SMS (US) | $0.00645/message |
| Outbound SMS (Intl) | $0.01-$0.10/message |
| Inbound SMS | $0.0075/message |
| Long Code | ~$1/month |
| Toll-Free | ~$2/month |
| Short Code | ~$1,000/month |
