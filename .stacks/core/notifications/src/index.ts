import * as email from './drivers/email'
import * as chat from './drivers/chat'
import * as sms from './drivers/sms'

const driverMap = {
  email,
  chat,
  sms,
}

const useNotification = (driver = 'email') => {
  // return driverMap?.[driver as keyof typeof driverMap]
  if (driver === 'email')
    return email

  if (driver === 'chat')
    return chat

  if (driver === 'sms')
    return sms
}

export {
  email,
  chat,
  sms,
  useNotification,
}
