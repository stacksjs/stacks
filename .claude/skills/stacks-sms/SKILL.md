---
name: stacks-sms
description: Use when implementing SMS in Stacks — sending text messages, the SmsBuilder fluent API, SMS templates, phone verification (OTP/2FA), bulk sending, Twilio/Vonage drivers, E.164 formatting, or the SMS facade. Covers @stacksjs/sms and config/sms.ts.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks SMS

Multi-driver SMS system with verification (OTP), templates, bulk sending, and a fluent builder API. Two fully implemented drivers: Twilio and Vonage.

## Key Paths
- Core package: `storage/framework/core/sms/src/`
- SMS facade and builder: `storage/framework/core/sms/src/sms.ts`
- Twilio driver: `storage/framework/core/sms/src/drivers/twilio.ts`
- Vonage driver: `storage/framework/core/sms/src/drivers/vonage.ts`
- Drivers index: `storage/framework/core/sms/src/drivers/index.ts`
- Configuration: `config/sms.ts`

## Package Exports

```typescript
// Main facade and functions
import SMS, { sms, send, sendSms, sendBulk, sendTemplate } from '@stacksjs/sms'
import { startVerification, checkVerification, cancelVerification } from '@stacksjs/sms'
import { formatE164, isValidPhoneNumber, isEnabled, getConfig, configure, getDriver, init } from '@stacksjs/sms'
import { SmsBuilder } from '@stacksjs/sms'

// Drivers
import { TwilioDriver, createTwilioDriver } from '@stacksjs/sms'
import { VonageDriver, createVonageDriver } from '@stacksjs/sms'
```

## SMS Facade Object

The `SMS` default export aggregates all functions:

```typescript
SMS.init()                    // Load config from config/sms.ts
SMS.configure(config)         // Override config at runtime
SMS.isEnabled()               // Check if SMS is enabled (config.enabled)
SMS.getConfig()               // Get current config (returns copy)

SMS.send(message)             // Send single SMS
SMS.sendSms(message)          // Alias for send
SMS.sendBulk(messages)        // Send multiple SMS
SMS.sendTemplate(to, name, vars)  // Send using template

SMS.getStatus(messageId)      // Get delivery status
SMS.getBalance()              // Get account balance
SMS.verifyNumber(phone)       // Lookup/verify phone number

SMS.startVerification(req)    // Start OTP flow
SMS.checkVerification(req)    // Verify OTP code
SMS.cancelVerification(id)    // Cancel pending verification

SMS.formatE164(phone, cc?)    // Format to E.164
SMS.isValidPhoneNumber(phone) // Validate E.164 format

SMS.sms()                     // Create SmsBuilder instance
SMS.getDriver(provider?)      // Get driver instance
SMS.getVerificationDriver(p?) // Get verification driver
```

## SmsBuilder (Fluent API)

```typescript
import { sms } from '@stacksjs/sms'

// Basic SMS
await sms()
  .to('+1234567890')
  .body('Your code is 123456')
  .from('+0987654321')
  .send()

// With provider selection
await sms()
  .to('+1234567890')
  .body('Hello!')
  .via('vonage')
  .send()

// MMS with media and callback
await sms()
  .to(['+1111111111', '+2222222222'])
  .body('Check this out')
  .media(['https://example.com/image.jpg'])
  .callback('https://myapp.com/sms/status')
  .send()

// .text() is an alias for .body()
await sms()
  .to('+1234567890')
  .text('Hello!')
  .send()
```

The builder validates that `to` and `body` are set before sending. If missing, it returns a failed `SmsSendResult` without throwing. If `.via(provider)` is set, it creates a new driver for that provider; otherwise uses the default driver.

## Direct Send Functions

```typescript
import { send, sendBulk } from '@stacksjs/sms'

// SmsMessage shape
await send({
  to: '+1234567890',         // string or string[]
  body: 'Hello!',
  from: '+0987654321',       // optional, falls back to config
  mediaUrls: ['url'],        // optional, for MMS
  statusCallback: 'url',     // optional, webhook for status updates
})

// Bulk send
await sendBulk([msg1, msg2, msg3])  // returns SmsSendResult[]
```

`send()` and all sending functions call `ensureConfig()` first, which lazily loads `config/sms.ts` via dynamic import.

## Message Status & Info

```typescript
import { getStatus, verifyNumber, getBalance } from '@stacksjs/sms'

// Get delivery status for a message
const status = await getStatus('SM_message_id')
// Returns SmsStatusUpdate | null (null if driver doesn't support it)

// Verify/lookup a phone number
const info = await verifyNumber('+1234567890')
// Returns { valid: boolean, carrier?: string, type?: string }

// Get account balance
const balance = await getBalance()
// Returns { balance: number, currency: string } | null
```

## Phone Verification (OTP/2FA)

```typescript
import { startVerification, checkVerification, cancelVerification } from '@stacksjs/sms'

// Start -- sends OTP code via SMS (or 'call', 'email' for Twilio; 'sms', 'whatsapp' for Vonage)
const result = await startVerification({
  to: '+1234567890',
  channel: 'sms',        // default: 'sms'
  codeLength: 6,          // optional
  locale: 'en',           // optional
  customMessage: 'Your code: {code}',  // optional, Twilio only
})
// Returns { success: boolean, verificationId?: string, status: 'pending' | 'denied', error?: string }

// Check -- verify the code the user entered
const check = await checkVerification({
  to: '+1234567890',           // Twilio requires 'to'
  verificationId: result.verificationId,  // Vonage requires this
  code: '123456',
})
// Returns { success: boolean, verificationId?: string, status: 'approved' | 'denied', error?: string }

// Cancel -- cancel a pending verification
const cancelled = await cancelVerification(result.verificationId!)
// Returns boolean
```

**Twilio** uses the Verify service (`verify.twilio.com/v2`) and requires `verifyServiceSid` passed to the TwilioDriver constructor.

**Vonage** uses the Verify V2 API (`api.nexmo.com/v2/verify`). Whatsapp channel maps to `whatsapp_interactive`.

## SMS Templates

```typescript
import { sendTemplate } from '@stacksjs/sms'

await sendTemplate('+1234567890', 'order-confirmation', {
  orderNumber: '#12345',
  total: '$29.99',
})
```

Templates are defined in `config/sms.ts` under `templates[]`. Each template has `name`, `body`, and optional `variables`. Variables use single-brace syntax `{variableName}` in the template body. The function finds the template by name, replaces variables, and sends via the default driver.

Returns a failed result (without throwing) if the template is not found.

## Phone Number Utilities

```typescript
import { formatE164, isValidPhoneNumber } from '@stacksjs/sms'

// Normalize to E.164 format
formatE164('+1 (234) 567-890')        // '+12345678900'
formatE164('2345678900', '1')          // '+12345678900'
formatE164('002345678900')             // '+2345678900' (00 prefix stripped)

// Validate E.164 format (regex: /^\+[1-9]\d{6,14}$/)
isValidPhoneNumber('+1234567890')      // true
isValidPhoneNumber('1234567890')       // true (formatted first, then validated)
```

`formatE164()` strips spaces, dashes, and parentheses. If the number starts with `+`, returns as-is. If it starts with `00`, replaces with `+`. Otherwise prepends `+` and the default country code (from `config.defaultCountryCode` or `'1'` for US).

## Twilio Driver

```typescript
import { TwilioDriver, createTwilioDriver } from '@stacksjs/sms'

const driver = new TwilioDriver({
  accountSid: 'AC...',
  authToken: '...',
  from: '+1234567890',
  messagingServiceSid: 'MG...',    // optional, used instead of 'from'
  statusCallback: 'https://...',   // optional, default callback URL
}, 'VA_verify_service_sid')         // optional second arg for verification

// Or use factory
const driver = createTwilioDriver(config, verifyServiceSid?)
```

Uses REST API at `https://api.twilio.com/2010-04-01`. Auth via HTTP Basic (`accountSid:authToken`).

Features:
- `send(message)` -- sends via Messages API, supports MMS (mediaUrls), statusCallback, messagingServiceSid
- `sendBulk(messages)` -- sends in parallel via `Promise.all`
- `getStatus(messageId)` -- retrieves message status
- `verify(phoneNumber)` -- uses Twilio Lookup API v2 with line_type_intelligence
- `getBalance()` -- retrieves account balance
- `startVerification(req)` -- Twilio Verify service
- `checkVerification(req)` -- check OTP code
- `cancelVerification(id)` -- cancel pending verification

Status mapping: queued, sending, sent, delivered, undelivered -> `SmsStatus`; canceled -> 'failed'.

## Vonage Driver

```typescript
import { VonageDriver, createVonageDriver } from '@stacksjs/sms'

const driver = new VonageDriver({
  apiKey: '...',
  apiSecret: '...',
  from: 'MyApp',
  applicationId: '...',    // optional, for JWT auth
  privateKey: '...',        // optional, for JWT auth
}, true)                    // optional: useMessagesApi (default: false)

// Or use factory
const driver = createVonageDriver(config, useMessagesApi?)
```

Two send modes:
- **SMS API** (legacy, default) -- `https://rest.nexmo.com/sms/json`, uses API key/secret in body
- **Messages API** (newer) -- `https://api.nexmo.com/v1/messages`, uses Basic auth or JWT

Features:
- `send(message)` -- sends via chosen API mode
- `sendBulk(messages)` -- sends in parallel
- `getStatus(messageId)` -- Messages API only
- `verify(phoneNumber)` -- Vonage Number Insight API (basic)
- `getBalance()` -- account balance in EUR
- `startVerification(req)` -- Vonage Verify V2 API
- `checkVerification(req)` -- requires `verificationId`
- `cancelVerification(id)` -- DELETE request to cancel

The `nexmo` export is a legacy alias for `vonage`.

## Other Drivers (Commented Out / Placeholder)

The `drivers/` directory contains placeholder files for: `gupshup`, `nexmo` (alias for vonage), `plivo`, `sms77`, `sns`, `telnyx`, `termii`. These are all commented out and not functional. Only Twilio and Vonage are active.

## config/sms.ts

```typescript
{
  enabled: false,                    // Must explicitly enable
  provider: 'twilio',               // 'twilio' | 'vonage'
  from: env.SMS_FROM_NUMBER || '',
  defaultCountryCode: 'US',
  messageType: 'TRANSACTIONAL',     // TRANSACTIONAL or PROMOTIONAL

  drivers: {
    twilio: {
      accountSid: env.TWILIO_ACCOUNT_SID || '',
      authToken: env.TWILIO_AUTH_TOKEN || '',
      from: env.TWILIO_FROM_NUMBER || '',
      messagingServiceSid: env.TWILIO_MESSAGING_SERVICE_SID || '',
    },
    vonage: {
      apiKey: env.VONAGE_API_KEY || '',
      apiSecret: env.VONAGE_API_SECRET || '',
      from: env.VONAGE_FROM_NUMBER || '',
    },
    pinpoint: {
      region: env.AWS_REGION || 'us-east-1',
      accessKeyId: env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY || '',
      senderId: env.SMS_SENDER_ID || '',
      originationNumber: env.SMS_ORIGINATION_NUMBER || '',
    },
  },

  maxSpendPerMonth: 100,
  optOut: {
    enabled: true,
    keywords: ['STOP', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT'],
  },
  templates: [],                     // Array of { name, body, variables }
  twoWay: {
    enabled: false,
  },
} satisfies SmsConfig
```

## Type Interfaces (from @stacksjs/types)

```typescript
interface SmsMessage {
  to: string | string[]
  body: string
  from?: string
  mediaUrls?: string[]
  statusCallback?: string
}

interface SmsSendResult {
  success: boolean
  messageId?: string
  status?: SmsStatus
  to: string
  provider: string
  error?: string
  segments?: number
  price?: number
  currency?: string
}

type SmsStatus = 'queued' | 'sending' | 'sent' | 'delivered' | 'undelivered' | 'failed' | 'unknown'

interface SmsStatusUpdate {
  messageId: string
  to: string
  status: SmsStatus
  timestamp: Date
  errorCode?: string
  errorMessage?: string
}

type SmsProvider = 'twilio' | 'vonage' | 'pinpoint'

interface VerificationRequest {
  to: string
  channel?: string        // 'sms' | 'call' | 'email' | 'whatsapp'
  codeLength?: number
  locale?: string
  customMessage?: string  // Twilio only
}

interface VerificationCheckRequest {
  to: string
  code: string
  verificationId?: string
}

interface VerificationResult {
  success: boolean
  verificationId?: string
  status: 'pending' | 'approved' | 'denied'
  error?: string
}
```

## Gotchas
- SMS is **disabled by default** (`enabled: false`) -- must set to `true` in `config/sms.ts`
- Provider API keys go in `.env`, not config files
- Config is loaded lazily via dynamic import on first `send()`/operation -- `init()` pre-loads it
- Only Twilio and Vonage drivers are fully implemented; other drivers (gupshup, plivo, sns, telnyx, etc.) are commented-out placeholders
- `pinpoint` appears in config but has no driver implementation in `getDriver()` -- using it throws `'Unsupported SMS provider: pinpoint'`
- The `defaultCountryCode` in config is `'US'` but `formatE164()` uses it as a numeric code prefix (the fallback is `'1'`), so the actual behavior uses the number `'1'` for US
- Template variables use single-brace syntax `{variableName}`, NOT double-brace
- `sendBulk()` sends all messages in parallel via `Promise.all` -- no rate limiting
- Twilio verification requires a `verifyServiceSid` passed to the driver constructor, which is not part of the standard config structure
- Vonage JWT authentication is a simplified placeholder -- real RS256 signing is not fully implemented
- `getDriver()` creates a new driver instance each time unless accessed through the cached `getDefaultDriver()`
- `sendTemplate()` returns a failed result (not an exception) if the template name is not found
