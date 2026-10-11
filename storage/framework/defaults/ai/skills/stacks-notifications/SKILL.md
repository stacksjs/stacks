---
name: stacks-notifications
description: Use when implementing notifications in Stacks - multi-channel notifications (email, SMS, push, chat, database), the database notification driver with read/unread tracking, notification factories (useEmail, useSMS, useChat, useDatabase), or notification configuration. Covers @stacksjs/notifications and config/notification.ts.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Notifications

Use `notify` for application fan-out and the channel packages for their
provider-specific APIs. The database inbox and delivery log are different data.

## Application notification

~~~ts
import { notify } from '@stacksjs/notifications'

const results = await notify(
  { userId: 7, email: 'customer@example.com' },
  { subject: 'Order shipped', body: 'Your order is on its way.', data: { orderId: 42 } },
  ['email', 'database'],
)
for (const result of results) {
  if (!result.success)
    console.error(result.channel, result.error)
}
~~~

`notify(recipient, payload, channels = ['email'], options = {})` returns
`Promise<NotifyResult[]>`. Channels run with `Promise.allSettled` so one
failure does not block another. Each result has `channel`, `success` and an
optional `error`. A resolved call does not imply every channel succeeded.

| Channel | Required recipient data | Native package |
|---|---|---|
| email | email | `@stacksjs/email` |
| sms | phone | `@stacksjs/sms` |
| chat | chatRecipient, a channel/user id or array | `@stacksjs/chat` |
| database | userId | database notification inbox |
| push | pushTokens, a string or string array | `@stacksjs/push`, default Expo |
| broadcast | broadcastChannel or userId | `@stacksjs/realtime` |

Payload: `{ body, subject?, data?, action? }`. Email treats body as text and
renders it through the framework layout. Use the exported `NotificationAction`
type for an action link. The broadcast fallback is `private-user.{userId}` or
public `notifications` when no user/channel is supplied. Its delivery is
best-effort; a missing realtime server is not a durable notification queue.
Read `stacks-chat` to configure transport credentials. Notify maps body to
ChatMessage.content and chatRecipient to ChatMessage.to. Email, SMS, chat and
push structured failures and broadcast delivered:false produce failed
NotifyResult entries. Provider acceptance is not a final delivery receipt.
`ensureSuccessfulNotificationResults(results)` throws for an empty result list
or any failed channel, and accepts only a non-empty list of successes. Use it
when a queued worker must retry partial fan-out instead of marking it sent.

## Preferences and delivery tracking

When userId exists, `notify` filters disabled channels using
`notification_preferences`. An absent preference allows the channel.
`options.category` selects category-specific preferences. Global opt-outs still
disable a channel even when a category opts in; omitting a category reads only
global preferences.
`options.ignorePreferences: true` explicitly bypasses the filter for a
required transactional send. A lookup failure logs and sends the unfiltered
list, so this is not a fail-closed consent boundary.

Use `getNotificationPreferences`, `setNotificationPreference` and
`bulkSetPreferences` with their exported types. Writes use a transaction and
lock the user row; a bulk save is atomic across its whole preference matrix.
SMS also consults persistent
phone opt-outs unless ignorePreferences is true. Ordinary direct SMS sends have
their own contract; see `stacks-sms`.

Every effective channel outcome is recorded through
`recordNotificationDelivery(makeDeliveryRecord(...))`. The source distinguishes
missing optional schema compatibility from real persistence failures. Apply
model-driven migrations before relying on persistence. Inspect channel results
and transport results rather than assuming a delivery log is provider proof.

## Channel factories

- `useEmail(driver?)` returns a sendable transport. Without a driver it uses
  the Mail singleton and `config/email.ts`. Unknown explicit drivers warn and
  fall back to that singleton.
- `useSMS()` uses the configured SMS facade; `useSMS('twilio' | 'vonage')`
  explicitly selects a provider after loading configuration. `useChat(driver?)`
  selects Slack (default), Discord or Teams. Unknown drivers throw. Configure
  those packages before sending.
- `useDatabase()` returns DatabaseNotificationDriver.
- `usePush()` returns the push namespace, and `useBroadcast()` the broadcast driver.
- `useNotification(type?, driver?)`/`notification()` select email, sms, chat
  or database only. The default type comes from `config/notification.ts`,
  falling back to email. Push/broadcast fan-out is through `notify` or their
  dedicated factories, not this older type selector.

## Database inbox

~~~ts
import { useDatabase } from '@stacksjs/notifications'

const inbox = useDatabase()
await inbox.send({ userId: 7, type: 'order.shipped', data: { orderId: 42 } })
const unread = await inbox.getUnreadNotifications(7)
const count = await inbox.unreadCount(7)
await inbox.markAllAsRead(7)
~~~

Also available: `getUserNotifications(userId)`, `markAsRead(id, userId?)`,
`deleteNotification(id, userId?)` and `deleteAllNotifications(userId)`. These
single-row mutations accept an optional authenticated userId. Supply it to
enforce ownership in the mutation statement; id-only calls retain their trusted
internal-use behavior. Reads and mark-all/delete-all already require userId.

Rows contain id, user_id, type, data (JSON string), read_at, created_at and
updated_at. Parse data when reading; null read_at means unread. The native
Notification model adds the User relation and timestamps; keep it aligned with
`database/src/notification-tables.ts`. Provider attempts belong in the separate
delivery log, not extra columns on the inbox.

## Sources and evidence

`storage/framework/core/notifications/src/index.ts` defines the real
signatures. `preferences.ts`, `delivery.ts` and `drivers/database.ts`
own their persistence; the query builder is bun-query-builder.
`notifications.test.ts`, `delivery-tracking.test.ts`,
`broadcast.test.ts` and `email-body.test.ts` cover retained behavior.
For provider status, consult `config/src/capabilities.ts` and each channel
skill; a constructed send request is not a live delivery assertion.

## Live, retry-safe database notifications

`useDatabase().send()` accepts an optional `idempotencyKey` (1–255 characters).
Retries for the same user, notification type and producer key return the
original inbox row, including concurrent retries. It uses the existing uuid
column and a recipient row lock. Use a stable message/event identifier.

New inbox rows broadcast `notifications.created` with `{ id }` on
`notificationChannel(userId)` (`private-user.{id}`) when the native realtime
engine is initialized. Delivery waits for transaction commit and carries no
message body. Duplicated keys do not emit again. Set `broadcast: false` to
suppress this invalidation. Serve an authenticated native broadcast stream for
the server-selected user channel and reconcile the durable inbox on reconnect.
