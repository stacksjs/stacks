import { Email } from '@stacksjs/emails'

export default new Email({ // or Sms or Push or Webhook or Chat
  name: 'welcome',
  subject: 'Welcome to Stacks',
  to: ({ user }) => user.email,
  from: ({ config }) => config.email.from,
  template: 'Welcome', // TODO: this can be typed
})
