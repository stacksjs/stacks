import type { PushResult } from '@stacksjs/types'
import * as expo from './drivers/expo'
import * as fcm from './drivers/fcm'

export * from './drivers'

export interface PushNotification {
  title?: string
  body: string
  data?: Record<string, any>
  badge?: number
  sound?: 'default' | null
  priority?: 'high' | 'normal' | 'default'
}

export type PushDriver = 'expo' | 'fcm'

export interface SendOptions {
  driver?: PushDriver
}

/**
 * Send a push notification using the specified driver
 */
export async function send(
  to: string | string[],
  notification: PushNotification,
  options: SendOptions = {},
): Promise<PushResult> {
  const driver = options.driver ?? 'expo'

  if (driver === 'expo') {
    return expo.send({
      to,
      title: notification.title,
      body: notification.body,
      data: notification.data,
      badge: notification.badge,
      sound: notification.sound,
      priority: notification.priority,
    })
  }

  if (driver === 'fcm') {
    const tokens = Array.isArray(to) ? to : [to]
    if (tokens.length === 1) {
      return fcm.send({
        to: tokens[0],
        notification: {
          title: notification.title ?? '',
          body: notification.body,
        },
        data: notification.data as Record<string, string>,
        priority: notification.priority === 'default' ? 'normal' : notification.priority,
      })
    }
    const results = await fcm.sendMulticast(tokens, {
      notification: {
        title: notification.title ?? '',
        body: notification.body,
      },
      data: notification.data as Record<string, string>,
      priority: notification.priority === 'default' ? 'normal' : notification.priority,
    })
    // Return combined result
    const success = results.every(r => r.success)
    return {
      success,
      provider: 'fcm',
      message: `Sent to ${results.filter(r => r.success).length}/${results.length} devices`,
    }
  }

  return {
    success: false,
    provider: driver,
    message: `Unknown push driver: ${driver}`,
  }
}

/**
 * Configure FCM with credentials
 */
export function configureFCM(config: fcm.FCMConfig): void {
  fcm.configure(config)
}

export { expo, fcm }
