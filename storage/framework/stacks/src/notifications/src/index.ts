import process from 'node:process'
import { err } from 'src/error-handling/src'
import { notification as config } from 'src/config/src'
import { log } from 'src/cli/src'
import { ExitCode } from 'src/types/src'
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

export {
  useEmail,
  useChat,
  useSMS,
  useNotification,
  notification,
}
