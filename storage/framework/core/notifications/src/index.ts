import { log } from '@stacksjs/cli'
import { notification as _notification } from '@stacksjs/config'
import { err } from '@stacksjs/error-handling'
import { chat, email, sms } from './drivers'
import { DatabaseNotificationDriver } from './drivers/database'

const config: any = _notification

export function useChat(driver = 'slack'): any {
  return chat[driver as keyof typeof chat]
}

export function useEmail(driver = 'mailtrap'): any {
  return email[driver as keyof typeof email]
}

export function useSMS(driver = 'twilio'): any {
  return sms[driver as keyof typeof sms]
}

export function useDatabase(): typeof DatabaseNotificationDriver {
  return DatabaseNotificationDriver
}

export function useNotification(typeParam = 'email', driverParam = 'mailtrap'): any {
  if (!config.default) {
    log.error('No default notification type set in config/notification.ts')
    throw new Error('No default notification type set in config/notification.ts')
  }

  const type = typeParam || config.default
  const driver = driverParam || config.default

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
      return err(`Type ${type} not supported`)
  }
}

export function notification(): any {
  return useNotification()
}

export { DatabaseNotificationDriver } from './drivers/database'
export type { CreateNotificationOptions, DatabaseNotification } from './drivers/database'
