import { config } from '@stacksjs/config'
import { Email } from '@stacksjs/email'
import { log } from '@stacksjs/logging'

export default new Email({
  // or Sms or Push or Webhook or Chat
  name: 'welcome', // optional, defaults to the file name
  subject: 'Welcome to Stacks', // optional, but recommended
  to: 'some@email.com', // optional, has to be defined here or set when sending
  from: config.email.from, // optional, defaults to the config value
  template: 'Welcome', // resources/emails/Welcome.stx

  handle: async () => {
    // if needed, trigger some custom logic here
    // or simply return a custom HTTP message
    return {
      message: 'Email sent',
    }
  },

  onError: async (error: Error) => {
    log.error(error)
    // if needed, trigger some custom logic here
    return {
      message: 'Email failed to send',
    }
  },

  onSuccess: () => {
    log.info('Some additional logging here...')
  },
})
