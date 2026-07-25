---
name: stacks-notifications
description: Use when implementing notifications in Stacks — multi-channel notifications (email, SMS, push, chat, database), the database notification driver with read/unread tracking, notification factories (useEmail, useSMS, useChat, useDatabase), or notification configuration. Covers @stacksjs/notifications and config/notification.ts.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Notifications

Multi-channel notification system with 5 channel types: email, SMS, chat, push, and database.

## Key Paths
- Core package: `storage/framework/core/notifications/src/`
- Main entry: `storage/framework/core/notifications/src/index.ts`
- Drivers: `storage/framework/core/notifications/src/drivers/`
- Database driver: `storage/framework/core/notifications/src/drivers/database.ts`
- Configuration: `config/notification.ts`
- Notification model: `storage/framework/models/Notification.ts`

## Package Exports

```typescript
import {
  useChat,
  useEmail,
  useSMS,
  useDatabase,
  useNotification,
  notification,
  DatabaseNotificationDriver,
} from '@stacksjs/notifications'

// Types
import type { CreateNotificationOptions, DatabaseNotification } from '@stacksjs/notifications'
```

## Channel Factories

Each factory returns the underlying driver module for that channel.

```typescript
// Email -- defaults to 'mailtrap', returns @stacksjs/email driver
const emailDriver = useEmail('ses')
const emailDriver = useEmail('sendgrid')
const emailDriver = useEmail('mailgun')
const emailDriver = useEmail('mailtrap')
const emailDriver = useEmail('smtp')

// SMS -- defaults to 'twilio', returns @stacksjs/sms driver
const smsDriver = useSMS('twilio')
const smsDriver = useSMS('vonage')

// Chat -- defaults to 'slack', returns @stacksjs/chat driver
const chatDriver = useChat('slack')
const chatDriver = useChat('discord')
const chatDriver = useChat('teams')

// Database -- returns DatabaseNotificationDriver object
const dbDriver = useDatabase()

// Auto-detect by type -- dispatches to the correct factory
const driver = useNotification('email', 'ses')
const driver = useNotification('sms', 'twilio')
const driver = useNotification('chat', 'slack')
const driver = useNotification('database')

// Default (uses config.default, falls back to 'email' + 'mailtrap')
const driver = notification()
```

`useNotification()` reads `config/notification.ts` for the default type. If no default is set, it throws `'No default notification type set in config/notification.ts'`.

The channel drivers are re-exports from their respective packages:
- `email` driver: `@stacksjs/email`
- `sms` driver: `@stacksjs/sms`
- `chat` driver: `@stacksjs/chat`
- `push` driver: `@stacksjs/push`

## Database Notification Driver

The `DatabaseNotificationDriver` provides CRUD operations for notifications stored in the `notifications` database table using Kysely query builder.

### Send a Notification

```typescript
const db = useDatabase()

const notification = await db.send({
  userId: 1,
  type: 'order.shipped',
  data: { orderId: 42, trackingNumber: 'ABC123' },
})
// Returns the created DatabaseNotification with auto-generated id, timestamps
```

`send()` inserts a row into the `notifications` table with:
- `user_id` from `options.userId`
- `type` from `options.type`
- `data` -- JSON.stringify'd from `options.data`
- `read_at` set to `null`
- `created_at` and `updated_at` set to current ISO timestamp

### Query Notifications

```typescript
// All notifications for a user, ordered by created_at desc
const all = await db.getUserNotifications(userId)

// Only unread (where read_at is null), ordered by created_at desc
const unread = await db.getUnreadNotifications(userId)

// Count of unread notifications
const count = await db.unreadCount(userId)
```

### Mark as Read

```typescript
// Mark a single notification as read (sets read_at to current timestamp)
await db.markAsRead(notificationId)

// Mark all unread notifications for a user as read
await db.markAllAsRead(userId)
```

`markAllAsRead()` only updates rows where `read_at` is null.

### Delete Notifications

```typescript
// Delete a single notification by ID
await db.deleteNotification(notificationId)

// Delete all notifications for a user
await db.deleteAllNotifications(userId)
```

### DatabaseNotification Interface

```typescript
interface DatabaseNotification {
  id: number
  user_id: number
  type: string          // e.g., 'order.shipped', 'payment.received'
  data: string          // JSON stringified -- parse with JSON.parse() when reading
  read_at: string | null  // ISO timestamp or null if unread
  created_at: string    // ISO timestamp
  updated_at: string | null  // ISO timestamp
}
```

### CreateNotificationOptions Interface

```typescript
interface CreateNotificationOptions {
  userId: number
  type: string
  data: Record<string, any>
}
```

## Notification Model Fields

The Notification model (at `storage/framework/models/Notification.ts`) defines:
- `type` -- notification type: email, sms, push, slack, webhook
- `channel` -- delivery channel
- `recipient` -- target email, phone, or user
- `subject` -- notification subject line
- `body` -- notification body content
- `status` -- pending, sent, delivered, failed, read
- `readAt`, `sentAt`, `metadata`

Note: The Notification model uses 30 seeded records by default.

## CLI Commands
- `buddy make:notification [name]` -- scaffold a new notification

## config/notification.ts

```typescript
import type { NotificationConfig } from '@stacksjs/types'

export default {
  default: 'email',
} satisfies NotificationConfig
```

The `default` field controls which channel type `useNotification()` and `notification()` use when no type is specified. Valid values: `'email'`, `'sms'`, `'chat'`, `'database'`.

## Architecture

The notifications package is a thin aggregation layer. Each channel delegates to its own dedicated package:

- **Email channel** (`useEmail`) -- re-exports `@stacksjs/email` (configured via `config/email.ts`)
- **SMS channel** (`useSMS`) -- re-exports `@stacksjs/sms` (configured via `config/sms.ts`)
- **Chat channel** (`useChat`) -- re-exports `@stacksjs/chat` (configured via `config/chat.ts`)
- **Push channel** -- re-exports `@stacksjs/push`
- **Database channel** (`useDatabase`) -- built-in driver using `@stacksjs/database`

The driver modules (`drivers/email.ts`, `drivers/sms.ts`, etc.) are single-line re-exports: `export * as email from '@stacksjs/email'`, `export * as sms from '@stacksjs/sms'`, etc.

## Gotchas
- The `data` field in database notifications is stored as a JSON string -- always `JSON.parse()` when reading
- `read_at` is `null` for unread notifications -- use this to filter unread
- The database driver uses Kysely's query builder with `as any` type casts on table/column names since the notifications table is dynamically referenced
- Channel-specific configuration (SMTP credentials, Twilio keys, Slack tokens) lives in each channel's own config file, not in `config/notification.ts`
- `useNotification()` throws if `config.default` is not set in `config/notification.ts`
- The `notification()` function (without arguments) is a shorthand for `useNotification()` with defaults
- The `nexmo` driver is a legacy alias for `vonage` in the SMS drivers index
