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

Payload: `{ body, subject?, data?, action?, locale?, strings? }`. Email treats
body as text and renders it through the framework layout (see "The frame's
language" for `locale`). Use the exported `NotificationAction`
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

## Marketing: unsubscribe links and opt-out lines

Give a marketing notification `payload.unsubscribe`, built per person with
`notificationUnsubscribeLinks(userId, { notice })`:

```ts
await notify(
  { userId, email },
  { subject, body, unsubscribe: notificationUnsubscribeLinks(userId, { notice: 'You get these because marketing email is on.' }) },
  ['email'],
  { category: 'marketing' },
)
```

The email's footer then shows the notice, **Unsubscribe** (`url`, default
`{APP_URL}/unsubscribe?token=`) and **Email preferences** (`/settings`) instead
of "do not reply"; the text part spells the link out; and the message carries
`List-Unsubscribe: <oneClickUrl>` plus `List-Unsubscribe-Post:
List-Unsubscribe=One-Click` (RFC 8058, default
`{APP_URL}/api/notifications/unsubscribe?token=`). `payload.headers` adds
other headers. The pure builders are `notificationEmailMessage`,
`notificationEmailHtml`, `notificationEmailText` and `listUnsubscribeHeaders`.

The token (`notificationUnsubscribeToken`, `parseNotificationUnsubscribeToken`)
is `base64url("{userId}:{channel}:{category}:{hmac}")` signed with `APP_KEY`,
which must be set in production. It does not expire. It turns off one
preference (channel + category), unlike `@stacksjs/email`'s tokens, which
suppress an address for good. The app owns the page and the route; the route's
handler is `unsubscribeWithToken(await unsubscribeTokenFromRequest(request))`,
which reads the query string (one-click form POSTs) before a JSON body, and
answers 422 when it returns null. Ask before unsubscribing on the page, so a
link scanner opening the URL changes nothing.

A `marketing` text ends with "Reply STOP to opt out." (`notificationSmsBody`).
`payload.smsOptOut` replaces the line (and adds it to other categories), and
`false` leaves it out. `payload.smsSender` starts every text with
`{sender}: ` (whitespace collapsed, cut to 30 characters, not repeated when the
body already starts with it); pass it whenever several businesses share one
sending number, so the person can tell who wrote. STOP only becomes an opt-out the app sees when inbound
SMS is wired up; see `stacks-sms`.

## The frame's language

The subject, body and button label are the caller's. The words around them
are the frame's: the transactional footer ("This is an automated message from
{app}. Please do not reply to this email."), the copyright line, the marketing
notice, the **Unsubscribe** / **Email preferences** labels (also in the text
part), the button label when the action has none ("Open") and a marketing
text's opt-out line. `payload.locale` puts all of them in the reader's
language and sets the email's `<html lang>`:

```ts
const language = user.locale // 'de', 'de-AT', 'en', ...
await notify({ userId, email }, { ...templates.render('order_receipt', variables, language), locale: language }, ['email'])
```

- Built in: `en` and `de` (`NOTIFICATION_FRAME_STRINGS`). Fallback like the
  templates: `de-AT` → `de` → `en`. No locale renders exactly the English the
  frame always had (a fixture test holds it byte for byte).
- Another language: pass the whole set as `payload.strings`
  (`NotificationFrameStrings`: `automatedNotice`, `copyright`,
  `unsubscribeNotice`, `unsubscribe`, `preferences`, `action`, `smsOptOut`). A
  partial set overrides only what it names. `{app}` and `{year}` are filled in.
- Precedence: `unsubscribe.notice` and `payload.smsOptOut` still win over the
  frame's notice and opt-out line.
- The builders take the same fields: `notificationEmailMessage`,
  `notificationEmailHtml`, `notificationEmailText`, `notificationSmsBody`;
  `notificationFrameStrings(locale, overrides)` resolves a set.
- An app's own `resources/emails/notification.stx` must read the new props
  (`lang`, `automatedNotice`, `copyrightNotice`, `unsubscribeLabel`,
  `preferencesLabel`) to be localized; `<EmailLayout lang>` sets `<html lang>`.

## Templates: one catalog of localized messages

`@stacksjs/notifications/templates` (pure, browser-safe; also exported from the
root) holds named messages with copy per language and an optional button:

```ts
import { accountNotificationTemplates, commerceNotificationTemplates, createNotificationTemplates, defineNotificationTemplates, subscriptionNotificationTemplates } from '@stacksjs/notifications/templates'

const templates = createNotificationTemplates({
  ...accountNotificationTemplates({ resetPassword: '/forgot-password' }),
  ...commerceNotificationTemplates({ orders: '/purchases' }),
  ...subscriptionNotificationTemplates({ billing: '/billing' }),
  ...defineNotificationTemplates({ /* the app's own: { copy: { en, de }, action?: { path, label: { en, de } } } */ }),
}, { baseUrl: () => process.env.APP_URL || '' })

const { subject, body, action } = templates.render('password_changed', { app: 'HQ', support_email }, locale)
```

- `{{name}}` placeholders; a missing variable renders empty, and a button whose
  path needs a missing variable is dropped rather than sent broken. A path that
  renders absolute (`{{set_password_url}}`) is used as is.
- Locale: exact, then the base language (`de-AT` → `de`), then `fallbackLocale`.
- `templates.names` / `templates.has()` validate input (e.g. a staff API that
  sends a named template).
- Built-ins: account (`password_changed`, `email_changed`, `account_deleted`,
  `account_created`), commerce (`order_receipt`, `order_refunded`, `new_sale`,
  `account_credit_added`), subscription (`subscription_trial_ending`,
  `subscription_payment_failed`, `subscription_ended`). Every one has English
  and German copy with the same variables (a test checks this). They are
  transactional: send them with `ignorePreferences: true`.
- Receipts: build `lines` with `receiptLinesText(lines, currency, locale)` from
  `@stacksjs/commerce/receipt-text` so amounts carry their currency.
- `account_created` carries a credential link: send it directly, not through a
  stored queue that keeps the body.

## Sequences: steps with waits and quiet hours

`@stacksjs/notifications/sequences` (pure; also exported from the root) is the
timing engine for journeys such as "email now, wait two days, text, then a call
task for staff". It never sends or stores anything: the app keeps each
person's next step index and due time, and on each tick asks what to do now.

```ts
import { advanceSequence, sequenceTimeline } from '@stacksjs/notifications/sequences'

const quietHours = { start: '21:00', end: '08:00', timeZone: 'Europe/Berlin' }
const { run, next } = advanceSequence(steps, enrollment.step_index, new Date(), {
  quietHours,
  respectsQuietHours: step => step.type === 'email' || step.type === 'sms',
})
// perform `run` in order, then store next?.index / next?.at (null: finished)
```

- A step is `{ type, minutes? }` plus whatever the app needs. `type: 'wait'`
  with `minutes` sets when the sequence continues; a zero wait is skipped.
- A step that respects quiet hours (default: every non-wait) is held until the
  window ends in its zone (`nextSendableTime`); `isQuietTime` answers for one
  instant. Windows may cross midnight; DST comes from the runtime's tz data.
- `sequenceTimeline(steps, start, options)` lays the steps out in time for a
  preview.
- Consent, unsubscribes and STOP are still the sender's checks (`notify()`,
  preferences); the engine only decides when.

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
`notifications.test.ts`, `delivery-tracking.test.ts`, `sequences.test.ts`,
`broadcast.test.ts`, `email-body.test.ts` and `frame-locale.test.ts` cover
retained behavior; `frame-strings.ts` holds the frame's languages.
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
