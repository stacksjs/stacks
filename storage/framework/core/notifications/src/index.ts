import { log } from '@stacksjs/cli'
import { notification as _notification } from '@stacksjs/config'
import type { NotificationOptions } from '@stacksjs/types'
import { chat, email, sms } from './drivers'
import { DatabaseNotificationDriver } from './drivers/database'

const config = _notification as NotificationOptions | undefined

export type NotificationChannel = 'email' | 'sms' | 'chat' | 'database'

export interface NotificationPayload {
  subject?: string
  body: string
  data?: Record<string, any>
}

export interface NotificationRecipient {
  email?: string
  phone?: string
  userId?: number
}

export interface NotifyResult {
  channel: NotificationChannel
  success: boolean
  error?: Error
}

export function useChat(driver?: string): typeof chat[keyof typeof chat] {
  const resolvedDriver = driver || 'slack'
  return chat[resolvedDriver as keyof typeof chat]
}

export function useEmail(driver?: string): typeof email[keyof typeof email] {
  const resolvedDriver = driver || config?.default || 'ses'
  return email[resolvedDriver as keyof typeof email]
}

export function useSMS(driver?: string): typeof sms[keyof typeof sms] {
  const resolvedDriver = driver || 'twilio'
  return sms[resolvedDriver as keyof typeof sms]
}

export function useDatabase(): typeof DatabaseNotificationDriver {
  return DatabaseNotificationDriver
}

export function useNotification(typeParam?: string, driverParam?: string): typeof chat[keyof typeof chat] | typeof email[keyof typeof email] | typeof sms[keyof typeof sms] | typeof DatabaseNotificationDriver {
  const type = typeParam || config?.default || 'email'
  const driver = driverParam

  switch (type) {
    case 'email':
      return useEmail(driver)
    case 'chat':
      return useChat(driver)
    case 'sms':
      return useSMS(driver)
    case 'database':
      return useDatabase()
    default:
      throw new Error(`Notification type "${type}" is not supported`)
  }
}

/**
 * Send a notification through multiple channels simultaneously.
 * Uses Promise.allSettled so one channel failure doesn't block others.
 */
export async function notify(
  recipient: NotificationRecipient,
  payload: NotificationPayload,
  channels: NotificationChannel[] = ['email'],
): Promise<NotifyResult[]> {
  const results = await Promise.allSettled(
    channels.map(async (channel) => {
      switch (channel) {
        case 'email': {
          const driver = useEmail()
          if (driver && typeof driver === 'object' && 'send' in driver) {
            await (driver as any).send({
              to: recipient.email,
              subject: payload.subject,
              body: payload.body,
            })
          }
          break
        }
        case 'sms': {
          const driver = useSMS()
          if (driver && typeof driver === 'object' && 'send' in driver) {
            await (driver as any).send({
              to: recipient.phone,
              body: payload.body,
            })
          }
          break
        }
        case 'chat': {
          const driver = useChat()
          if (driver && typeof driver === 'object' && 'send' in driver) {
            await (driver as any).send({
              body: payload.body,
            })
          }
          break
        }
        case 'database': {
          if (recipient.userId) {
            await DatabaseNotificationDriver.create({
              userId: recipient.userId,
              type: payload.subject || 'notification',
              data: { body: payload.body, ...payload.data },
            })
          }
          break
        }
        default:
          throw new Error(`Unsupported notification channel: ${channel}`)
      }
    }),
  )

  return results.map((result, index) => ({
    channel: channels[index],
    success: result.status === 'fulfilled',
    error: result.status === 'rejected' ? result.reason : undefined,
  }))
}

export function notification(): ReturnType<typeof useNotification> {
  return useNotification()
}

export { DatabaseNotificationDriver } from './drivers/database'
export type { CreateNotificationOptions, DatabaseNotification } from './drivers/database'
