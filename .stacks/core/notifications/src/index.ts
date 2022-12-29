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

const useNotification = (driver = 'email') => {
  switch (driver) {
    case 'email':
      return useEmail()
    case 'chat':
      return useChat()
    case 'sms':
      return useSMS()
    default:
      throw new Error(`Driver ${driver} not supported`)
  }
}

export {
  email,
  chat,
  sms,
  useEmail,
  useChat,
  useSMS,
  useNotification,
}
