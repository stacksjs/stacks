import * as email from './drivers/email'
import * as chat from './drivers/chat'
import * as sms from './drivers/sms'

const driverMap = {
  email,
  chat,
  sms,
}

const useNotification = (driver = 'email') => {
  return driverMap?.[driver as keyof typeof driverMap]
}

export {
  email,
  chat,
  sms,
  useNotification,
}
