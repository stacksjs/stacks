export * as email from './drivers/email'
export * as chat from './drivers/chat'
export * as sms from './drivers/sms'

// const driverMap = {
//   email,
//   chat,
//   sms,
// }

// export function useNotification(driver = 'email') {
//   // return driverMap?.[driver as keyof typeof driverMap]
//   if (driver === 'email')
//     return email

//   if (driver === 'chat')
//     return chat

//   if (driver === 'sms')
//     return sms
// }

// export default {
//   useNotification,
// }
