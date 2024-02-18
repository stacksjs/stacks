import { log } from '@stacksjs/logging'
import { Email } from '@stacksjs/email'

export default new Email({ // or Sms or Push or Webhook or Chat
  name: 'welcome',
  subject: 'Welcome to Stacks',
  to: 'user.email',
  from: 'config.email.from',
  template: 'Welcome',

  handle: async () => {
    // if needed, trigger some custom logic here
    // or simply return a custom HTTP message
    return {
      message: 'Email sent',
    }
  },

  onError: (error: Error) => {
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
