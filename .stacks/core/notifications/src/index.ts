import { err } from '@stacksjs/error-handling'
import { notification as config } from '@stacksjs/config'
import { email } from './drivers/email'
import { chat } from './drivers/chat'
import { sms } from './drivers/sms'

const useChat = (driver = 'slack') => {
  return chat[driver as keyof typeof chat]
}

const useEmail = (driver = 'sendgrid') => {
  return email[driver as keyof typeof email]
}

const useSMS = (driver = 'twilio') => {
  return sms[driver as keyof typeof sms]
}

function useNotification(typeParam = 'email', driverParam = 'sendgrid'): any {
  const type = typeParam || config.type
  const driver = driverParam || config.driver

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

function notification(): any {
  return useNotification()
}

export {
  email,
  chat,
  sms,
  notification,
  useEmail,
  useChat,
  useSMS,
  useNotification,
}
