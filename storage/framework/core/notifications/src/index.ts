import process from 'node:process'
import { log } from '@stacksjs/cli'
import { notification as config } from '@stacksjs/config'
import { err } from '@stacksjs/error-handling'
import { ExitCode } from '@stacksjs/types'
import { chat, email, sms } from './drivers'

export function useChat(driver = 'slack'): any {
  return chat[driver as keyof typeof chat]
}

export function useEmail(driver = 'mailtrap'): any {
  return email[driver as keyof typeof email]
}

export function useSMS(driver = 'twilio'): any {
  return sms[driver as keyof typeof sms]
}

export function useNotification(typeParam = 'email', driverParam = 'mailtrap'): any {
  if (!config.default) {
    log.error('No default notification type set in config/notification.ts')
    return process.exit(ExitCode.InvalidArgument)
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
    default:
      return err(`Type ${type} not supported`)
  }
}

export function notification(): any {
  return useNotification()
}
