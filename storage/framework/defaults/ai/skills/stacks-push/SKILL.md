---
name: stacks-push
description: Use when implementing push notifications in Stacks - sending via Expo Push Service or Firebase Cloud Messaging (FCM v1 API), configuring push drivers, batch sending, multicast, topic subscriptions, push notification payloads, token validation, or receipt checking. Covers @stacksjs/push.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Push Notifications

Push notification support with Expo Push Service and FCM (Firebase Cloud Messaging) drivers.

FCM is the v1 service account API only. The legacy server-key API was
decommissioned on 2024-06-20 and its endpoint answers 404, so a `serverKey` is
no longer a way to configure this driver and there is no fallback to it.

## Key Paths
- Core package: `storage/framework/core/push/src/`
- Types: `storage/framework/core/types/src/push.ts`

## Source Files
```
push/src/
├── index.ts              # send(), configureFCM(), configureExpo(), PushNotification type
└── drivers/
    ├── index.ts          # re-exports expo and fcm
    ├── expo.ts           # Expo Push Service driver
    └── fcm.ts            # FCM v1 API driver
```

## Main send() Function

```typescript
async function send(
  to: string | string[],
  notification: PushNotification,
  options?: SendOptions,
): Promise<PushResult>
```

Routes to the appropriate driver based on `options.driver` (default: `'expo'`).

- For **Expo**: Passes the notification directly to `expo.send()` with all fields mapped.
- For **FCM** with single token: Calls `fcm.send()` with notification mapped to `{ to, notification: { title, body }, data, priority }`.
- For **FCM** with multiple tokens: Calls `fcm.sendMulticast()` and returns an aggregated result with success count.
- FCM priority mapping: `'default'` is converted to `'normal'`; `'high'` and `'normal'` pass through.

## PushNotification Interface (index.ts)

```typescript
interface PushNotification {
  title?: string
  body: string                           // required
  data?: Record<string, any>
  badge?: number
  sound?: 'default' | null
  priority?: 'high' | 'normal' | 'default'
}
```

## PushResult Interface (from @stacksjs/types)

```typescript
interface PushResult {
  success: boolean
  provider: string          // 'expo' | 'fcm'
  message: string
  messageId?: string
  data?: Record<string, any>
}
```

## Types

```typescript
type PushDriver = 'expo' | 'fcm'

interface SendOptions {
  driver?: PushDriver       // default: 'expo'
}
```

## Expo Push Driver (expo.ts)

### ExpoPushMessage
```typescript
interface ExpoPushMessage {
  to: string | string[]
  title?: string
  body: string
  data?: Record<string, any>
  sound?: 'default' | null
  badge?: number
  channelId?: string         // Android notification channel
  priority?: 'default' | 'normal' | 'high'
  ttl?: number               // time-to-live in seconds
}
```

### ExpoPushTicket
```typescript
interface ExpoPushTicket {
  id?: string
  status: 'ok' | 'error'
  message?: string
  details?: {
    error?: 'DeviceNotRegistered' | 'MessageTooBig' | 'MessageRateExceeded' | 'InvalidCredentials'
  }
}
```

### ExpoPushReceipt
```typescript
interface ExpoPushReceipt {
  status: 'ok' | 'error'
  message?: string
  details?: { error?: string }
}
```

### Functions

#### send()
```typescript
async function send(message: ExpoPushMessage): Promise<PushResult>
```

- Endpoint: `https://exp.host/--/api/v2/push/send`
- Validates tokens with `isExpoPushToken()` before sending
- Filters out invalid tokens and warns via `log.warn()`
- Returns early with failure if no valid tokens remain
- Creates one payload entry per token (fans out `to` array into individual messages)
- Default `sound: 'default'`, default `priority: 'high'`
- Returns `PushResult` with `data: { tickets }` containing the full ticket array
- `success` is `true` only if zero tickets have `status: 'error'`
- `messageId` is the first ticket's `id` (if any)

#### isExpoPushToken()
```typescript
function isExpoPushToken(token: string): boolean
```
Validates token format: matches `Expo(nent)?PushToken[...]` pattern OR alphanumeric with hyphens/underscores.

#### getReceipts()
```typescript
async function getReceipts(ticketIds: string[]): Promise<Record<string, ExpoPushReceipt>>
```
Endpoint: `https://exp.host/--/api/v2/push/getReceipts`. Checks delivery status for previously sent notifications.

#### sendBatch()
```typescript
async function sendBatch(messages: ExpoPushMessage[], chunkSize?: number): Promise<PushResult[]>
```
Sends multiple messages in chunks (default chunk size: 100, per Expo's recommendation). Processes chunks sequentially, messages within each chunk in parallel via `Promise.all`.

### Exports
- `send`, `sendBatch`, `getReceipts`, `isExpoPushToken` functions
- `Send` alias for `send`

## FCM Driver (fcm.ts)

One API: **v1** (`https://fcm.googleapis.com/v1/projects/{projectId}/messages:send`),
using a service account with an OAuth2 JWT. Everything needs `serviceAccount`
and `projectId`; nothing accepts a server key.

### FCMConfig
```typescript
interface FCMConfig {
  projectId?: string
  serviceAccount?: {
    clientEmail: string
    privateKey: string                  // PEM format
  }
}
```

### FCMMessage
```typescript
interface FCMMessage {
  to?: string                           // single device token
  topic?: string                        // topic name
  condition?: string                    // topic condition expression
  notification?: {
    title: string
    body: string
    icon?: string
    image?: string
    sound?: string
    badge?: string
    clickAction?: string
    tag?: string
  }
  data?: Record<string, string>         // NOTE: values must be strings for FCM
  priority?: 'high' | 'normal'
  ttl?: number
  collapseKey?: string
}
```

### Functions

#### configure()
```typescript
function configure(options: FCMConfig): void
```
Sets module-level config. Called by `configureFCM()` from the main index.
Optional: anything it does not set is read from `config/services.ts` on each
send (see Configuration), and anything it does set wins.

#### send()
```typescript
async function send(message: FCMMessage): Promise<PushResult>
```
Requires `serviceAccount` and `projectId`. Without them it returns a failed
`PushResult` naming what is missing, rather than falling back - the legacy
endpoint it used to fall back to is gone.

**v1 API flow:**
1. Generates JWT with RS256 signing using the service account private key
2. Exchanges JWT for OAuth2 access token at `https://oauth2.googleapis.com/token`
3. Sends to `https://fcm.googleapis.com/v1/projects/{projectId}/messages:send`
4. Includes Android priority settings and APNS headers (`apns-priority: 10` for high, `5` for normal)
5. Supports `to` (token), `topic`, or `condition` targeting

**JWT generation details:**
- Scope: `https://www.googleapis.com/auth/firebase.messaging`
- Algorithm: RS256 (RSASSA-PKCS1-v1_5 with SHA-256)
- Expiry: 1 hour
- Key imported via `crypto.subtle.importKey('pkcs8', ...)`

#### sendMulticast()
```typescript
async function sendMulticast(
  tokens: string[],
  message: Omit<FCMMessage, 'to'>,
): Promise<PushResult[]>
```
Sends individually to each token via `Promise.all`: the v1 API has no native
multicast, and the legacy API that did is decommissioned.

#### sendToTopic()
```typescript
async function sendToTopic(
  topic: string,
  message: Omit<FCMMessage, 'to' | 'topic'>,
): Promise<PushResult>
```
Convenience wrapper that sets the `topic` field and calls `send()`.

#### subscribeToTopic()
```typescript
async function subscribeToTopic(tokens: string[], topic: string): Promise<boolean>
```
`POST {FCM_V1_URL}/{projectId}/registrations/{token}/topicSubscriptions?topic_name={topic}`,
authenticated with the same OAuth token `send()` uses. Needs `serviceAccount` and
`projectId`; a legacy `serverKey` is not accepted. The v1 API acts on one
registration, so the batch is one request per token, and a 409 counts as success
because it means the subscription already exists.

It used to call `https://iid.googleapis.com/iid/v1:batchAdd`. Those Instance ID
endpoints stop serving on 2027-09-29 and admit no new projects from 2027-01-01
(stacksjs/stacks#2856).

#### unsubscribeFromTopic()
```typescript
async function unsubscribeFromTopic(tokens: string[], topic: string): Promise<boolean>
```
`DELETE {FCM_V1_URL}/{projectId}/registrations/{token}/topicSubscriptions/{topic}`.
The topic is a query parameter when subscribing and a path segment when
unsubscribing; that asymmetry is the API's.

### Exports
- `send`, `sendMulticast`, `sendToTopic`, `subscribeToTopic`, `unsubscribeFromTopic`, `configure`, `buildServiceAccountAssertion` functions
- `Send` alias for `send`

## Configuration

Set the env vars `config/services.ts` reads and both drivers pick them up on the
next send. No code is needed:

```bash
FCM_PROJECT_ID=my-firebase-project
FCM_CLIENT_EMAIL=firebase@project.iam.gserviceaccount.com
# Paste the key from the service account JSON as-is: its literal \n escapes
# are turned back into newlines.
FCM_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Only needed once "enhanced push security" is on for the Expo project:
# Expo then rejects every send and receipt request without it.
EXPO_ACCESS_TOKEN=...
```

The values are read lazily, after the app's config has loaded, never at
import - a value captured at import would be the framework default.

`configureFCM()` / `configureExpo()` override config, for an app that keeps
credentials somewhere else:

```typescript
import { configureExpo, configureFCM } from '@stacksjs/push'

configureFCM({
  projectId: 'my-firebase-project',
  serviceAccount: {
    clientEmail: 'firebase@project.iam.gserviceaccount.com',
    privateKey: '-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----'
  }
})

configureExpo({ accessToken: '...' })
```

FCM access tokens are cached per service account until a minute before they
expire, so a multicast exchanges one token, not one per device.
`fcm.resetConfiguration()` drops both the configured credentials and the cache.

## Usage Examples

```typescript
import { send } from '@stacksjs/push'

// Expo (default driver)
await send('ExponentPushToken[xxxxxx]', {
  title: 'New Order',
  body: 'You have a new order #1234',
  data: { orderId: 1234 },
  badge: 1,
  sound: 'default',
  priority: 'high',
})

// Multiple Expo tokens
await send(
  ['ExponentPushToken[aaa]', 'ExponentPushToken[bbb]'],
  { title: 'Announcement', body: 'Maintenance at 3pm' },
)

// FCM single device
await send('fcm-device-token', notification, { driver: 'fcm' })

// FCM multiple devices
await send(
  ['token1', 'token2', 'token3'],
  { title: 'Alert', body: 'New message' },
  { driver: 'fcm' },
)
```

### Direct driver access
```typescript
import { expo, fcm } from '@stacksjs/push'

// Expo batch
await expo.sendBatch(messages, 100)

// Expo receipt check
const receipts = await expo.getReceipts(['ticket-id-1', 'ticket-id-2'])

// FCM topic
await fcm.sendToTopic('news', { notification: { title: 'Breaking', body: '...' } })

// FCM topic subscription
await fcm.subscribeToTopic(['token1', 'token2'], 'news')
await fcm.unsubscribeFromTopic(['token1'], 'news')
```

## Dependencies
- `@stacksjs/types` -- `PushResult`, `PushMessage`, `PushTicket`
- `@stacksjs/cli` -- `log` for info/warn/error logging
- Web Crypto API -- used by FCM for JWT signing (`crypto.subtle`)

## Gotchas
- Default driver is `'expo'`, not FCM
- Expo token validation accepts both `ExponentPushToken[...]` format and plain alphanumeric strings
- Expo `send()` fans out array tokens into individual payload entries (one per token)
- Expo default `sound` is `'default'` and default `priority` is `'high'` (set in the driver, not the main send)
- FCM `data` values must be `Record<string, string>` (strings only, not arbitrary JSON)
- FCM `send()` fails with a message naming the missing config rather than falling back; the legacy endpoint was decommissioned 2024-06-20 and answers 404
- FCM v1 API does not support native multicast -- `sendMulticast()` sends individually via `Promise.all`
- `subscribeToTopic()` and `unsubscribeFromTopic()` require `serviceAccount` + `projectId`, and throw on a `serverKey`-only config. They return a single boolean for the whole batch, so a partial failure reads as `false`; the per-token status is logged
- The v1 topic API takes the topic as a **query parameter** on subscribe and a **path segment** on unsubscribe
- The main `send()` converts `priority: 'default'` to `'normal'` for FCM
- Expo `sendBatch()` processes chunks sequentially but messages within each chunk in parallel
- FCM v1 JWT tokens expire after 1 hour -- a new token is generated for each `send()` call (no caching)
- FCM v1 includes both Android and APNS-specific priority headers automatically
- `badge` only works on iOS -- Android uses notification channels (set via `channelId` on Expo)
- `sound: null` sends a silent notification
