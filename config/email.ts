import { defineEmailConfig } from '../.stacks/core/utils/src'
import app from './app'

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
      username: 'hi', // enables hi@domain.com
      forwardTo: 'your@mailbox.com', // forwards all emails from hi@domain.com to your@mailbox.com (e.g. stacksjs@gmail.com)
    },
  ],
})
