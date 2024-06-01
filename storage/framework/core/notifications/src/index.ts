import process from 'node:process'
import { log } from '@stacksjs/cli'
import { notification as config } from '@stacksjs/config'
import { err } from '@stacksjs/error-handling'
import { ExitCode } from '@stacksjs/types'
import { chat, email, sms } from './drivers'

function useChat(driver = 'slack') {
  return chat[driver as keyof typeof chat]
}

function useEmail(driver = 'mailtrap') {
  return email[driver as keyof typeof email]
}

function useSMS(driver = 'twilio') {
  return sms[driver as keyof typeof sms]
}

function useNotification(typeParam = 'email', driverParam = 'mailtrap') {
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

function notification() {
  return useNotification()
}

export { useEmail, useChat, useSMS, useNotification, notification }
