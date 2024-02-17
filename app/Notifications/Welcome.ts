import { Email } from '@stacksjs/emails'

export default new Email({ // or Sms or PushNotification or Webhook or Chat or Notification
  name: 'welcome',
  type: 'email',
  subject: 'Welcome to Stacks',
  to: ({ user }) => user.email,
  from: ({ config }) => config.email.from,
  template: 'Welcome', // TODO: this can be typed
})
