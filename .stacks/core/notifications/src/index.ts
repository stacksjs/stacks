import { err } from '@stacksjs/error-handling'
import { notification as env } from '@stacksjs/config'
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

const useNotification = () => {
  switch (env.type) {
    case 'email':
      return useEmail(env.driver)
    case 'chat':
      return useChat(env.driver)
    case 'sms':
      return useSMS(env.driver)
    default:
      return err(`Type ${env.type} not supported`)
  }
}

const notification = () => {
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
