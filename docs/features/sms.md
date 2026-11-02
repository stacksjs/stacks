---
title: SMS Service
description: Send SMS messages through the Stacks Twilio and Vonage drivers.
---
# SMS Service

`@stacksjs/sms` provides Twilio and Vonage drivers, a shared sending API,
configured templates, bulk sending, and phone verification. Select a provider
and configure its account before enabling delivery.

## Configuration

Edit `config/sms.ts`. Keep credentials in environment variables:

```typescript
import type { SmsConfig } from '@stacksjs/types'
import { env } from '@stacksjs/env'

export default {
  enabled: false,
  provider: 'twilio',
  from: String(env.SMS_FROM_NUMBER || ''),
  defaultCountryCode: '1',
  drivers: {
    twilio: {
      accountSid: String(env.TWILIO_ACCOUNT_SID || ''),
      authToken: String(env.TWILIO_AUTH_TOKEN || ''),
      from: String(env.TWILIO_FROM_NUMBER || ''),
      messagingServiceSid: String(env.TWILIO_MESSAGING_SERVICE_SID || ''),
      verifyServiceSid: String(env.TWILIO_VERIFY_SERVICE_SID || ''),
    },
    vonage: {
      apiKey: String(env.VONAGE_API_KEY || ''),
      apiSecret: String(env.VONAGE_API_SECRET || ''),
      from: String(env.VONAGE_FROM_NUMBER || ''),
    },
  },
  bulk: {
    concurrency: 10,
    delayMs: 100,
  },
  templates: [
    {
      name: 'order-confirmation',
      body: 'Order {orderNumber} is confirmed.',
      variables: ['orderNumber'],
    },
  ],
} satisfies SmsConfig
```

Set `enabled: true` when your application is ready to dispatch messages.
For Vonage, select `provider: 'vonage'` and supply its API key, secret, and
sender. Twilio phone verification also requires a Verify service SID.

`pinpoint` remains a configuration type option, but the SMS facade has no
Pinpoint driver. Selecting it throws an unsupported-provider error. Installing
this package or deploying an application does not provision provider accounts
or messaging infrastructure.

## Sending SMS

Load configuration before checking whether your application enables delivery:

```typescript
import { SMS } from '@stacksjs/sms'

await SMS.init()

if (SMS.isEnabled()) {
  const result = await SMS.sendSms({
    to: '+12025550123',
    body: 'Your order is ready.',
  })

  if (!result.success)
    throw new Error(result.error || 'SMS delivery request failed')
}
```

`sendSms` is an alias for `send`. Both accept `to`, `body`, and optional
`from`, `mediaUrls`, and `statusCallback` fields. Sending operations load
configuration lazily; `init()` loads it before synchronous helpers such as
`isEnabled()` or `getConfig()`. Explicit `configure()` overrides survive
configuration loading.

Low-level send methods do not enforce `enabled`, quiet hours, monthly budgets,
or recipient consent. Apply those policies at your application entrypoint.
A successful result records provider acceptance of the request; delivery status
may change afterward.

## Templates

Templates are selected by name from `config/sms.ts`. Their variables use single
braces, such as `{orderNumber}`:

```typescript
import { SMS } from '@stacksjs/sms'

await SMS.init()

if (SMS.isEnabled()) {
  const result = await SMS.sendTemplate('+12025550123', 'order-confirmation', {
    orderNumber: '12345',
  })

  if (!result.success)
    throw new Error(result.error || 'SMS template request failed')
}
```

A missing template returns a failed result without contacting a provider.

## Bulk SMS

```typescript
import { SMS } from '@stacksjs/sms'

await SMS.init()

if (SMS.isEnabled()) {
  const results = await SMS.sendBulk([
    { to: '+12025550123', body: 'Order 12345 is ready.' },
    { to: '+12025550124', body: 'Order 12346 is ready.' },
  ])

  const failed = results.filter(result => !result.success)
  console.log(`${failed.length} SMS requests failed`)
}
```

The facade splits messages into chunks using `bulk.concurrency` and waits
`bulk.delayMs` between chunks. Provider driver methods send each chunk
concurrently. These settings control dispatch concurrency, not a guaranteed
messages-per-second quota. Configure them for your provider account and traffic.

## Incoming Messages and Opt-Outs

The native Twilio inbound handler, `handleTwilioInbound`, validates webhook
signatures and processes STOP, START, and HELP messages. The shared
`handleInboundSms` workflow persists opt-out and opt-in state in the
`sms_opt_outs` database table. Apply the associated model migration before using
persistent opt-out handling.

The generic notification SMS channel checks persisted opt-outs. Direct driver
and facade sends require the caller to apply the relevant consent checks.
Adding an inbound URL to configuration alone does not register a webhook with
your provider.

## Troubleshooting

- Check the selected provider and its credentials when initialization succeeds
  but driver creation reports incomplete configuration.
- Use an E.164 recipient number, such as `+12025550123`.
- Inspect `SmsSendResult.success` and `error` for request failures. Use
  `SMS.getStatus(messageId)` where the selected driver supports status lookup.
- Check provider delivery events and account limits when an accepted request
  does not reach the recipient.

See the [SMS API reference](/skills/messaging/sms) for fluent builders,
verification methods, inbound handlers, and provider-specific capabilities.
