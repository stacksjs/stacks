import { app } from './app'

export default {
  from: {
    name: 'My App',
    address: '',
  },

  domain: app.url,
  mailboxes: [
    {
      username: 'hi', // enables hi@domain
      forwardTo: 'your@mailbox', // forwards all emails from hi@domain to your mailbox (e.g. stacksjs@gmail.com)
    },
  ],
}
