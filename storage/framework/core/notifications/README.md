# Stacks Notifications

Send email, SMS, chat, push, database inbox messages and realtime broadcasts
through `@stacksjs/notifications`.

```ts
import { ensureSuccessfulNotificationResults, notify } from '@stacksjs/notifications'

const results = await notify(
  { userId: 7, email: 'athlete@example.com', phone: '+15555550100' },
  { subject: 'Training reminder', body: 'Your session starts soon.' },
  ['email', 'sms'],
  { category: 'training' },
)
ensureSuccessfulNotificationResults(results)
```

Channels run independently. A provider's structured failure is returned as
`success: false` even when its send promise resolves. Broadcast also reports
failure when no realtime server is running. Success means provider acceptance,
not a final device or mailbox receipt. The result checker rejects empty results
and partial failure; with several failures it throws an `AggregateError`.

## Transports

| Channel | Recipient | Configuration |
| --- | --- | --- |
| email | `email` | `config/email.ts`, Mail singleton |
| sms | `phone` | `config/sms.ts`, Twilio or Vonage |
| chat | `chatRecipient` (channel/user id or array) | `config/services.ts`, Slack by default |
| push | `pushTokens` (token or array) | Expo by default, `config/services.ts` |
| database | `userId` | Apply notification model migrations |
| broadcast | `broadcastChannel` or `userId` | Running realtime server |

`useEmail()`, `useSMS()`, `useChat()`, `usePush()`, `useDatabase()` and
`useBroadcast()` expose native transports. `useSMS()` honors the configured
provider; `useSMS('twilio')` or `useSMS('vonage')` overrides it. Runtime SMS
configuration survives lazy initialization. Chat maps `body` to the transport's
`content` and `chatRecipient` to `to`; delivery tracking records that destination.
Use `useChat('discord')` or `useChat('teams')` for direct alternative transports.
Unknown SMS/chat driver names throw.

## Preferences and tracking

Absent preferences allow a channel. A global opt-out wins over a category
opt-in. `getNotificationPreferences`, `setNotificationPreference` and
`bulkSetPreferences` provide persistent preferences; writes serialize on the
user row, and bulk changes are atomic. `options.ignorePreferences: true`
explicitly bypasses preferences and SMS opt-outs. Preference lookup failures
currently log and allow sends, so this filter is not a fail-closed consent gate.

The database inbox and `notification_deliveries` tracking log are separate.
Apply their model-driven migrations before relying on persistence. Inspect the
returned channel results; the tracking log is not a final receipt.

## Inbox ownership

```ts
import { useDatabase } from '@stacksjs/notifications'

const inbox = useDatabase()
await inbox.send({ userId: 7, type: 'training.reminder', data: { body: 'See you soon' } })
const messages = await inbox.getUnreadNotifications(7)
await inbox.markAsRead(messages[0]!.id, 7)
await inbox.deleteNotification(messages[0]!.id, 7)
```

Supply the authenticated user ID to single-row mutations to enforce ownership in
the update/delete statement. Id-only calls remain available for trusted internal
use. `markAllAsRead(userId)`, `deleteAllNotifications(userId)` and
`unreadCount(userId)` are already scoped. Repeated reads preserve `read_at`.

## Verification

`tests/provider-outcomes.test.ts` exercises the real SMS, chat and push drivers
with only external HTTP replaced, including acceptance and rejection.
`tests/preferences-runtime.test.ts` verifies persistence, atomic preference
changes, ownership and read timestamp preservation on SQLite and optional local
PostgreSQL (`STACKS_PREFERENCE_TEST_POSTGRES_URL`).
