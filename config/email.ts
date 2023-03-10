import { app } from '../.stacks/core/config/src'
import { defineEmailConfig } from '../.stacks/core/config/src/helpers'

/**
 * **Email Configuration**
 *
 * This configuration defines all of your email options. Because Stacks is fully-typed,
 * you may hover any of the options below and the definitions will be provided. In case
 * you have any questions, feel free to reach out via Discord or GitHub Discussions.
 */
export default defineEmailConfig({
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
})
