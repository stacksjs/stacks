import { defineEmailConfig } from '../.stacks/core/types/src/email'
import { env } from '../.stacks/core/validation/src'
import app from './app'

/**
 * **Email Configuration**
 *
 * This configuration defines all of your email options. Because Stacks is fully-typed,
 * you may hover any of the options below and the definitions will be provided. In case
 * you have any questions, feel free to reach out via Discord or GitHub Discussions.
 */
export default defineEmailConfig({
  domain: app.url,

  from: {
    name: env.MAIL_FROM_NAME || 'Stacks',
    address: env.MAIL_FROM_ADDRESS || 'no-reply@stacksjs.dev',
  },

  mailboxes: {
    hi: 'your@mailbox.com', // enables hi@domain and forwards incoming mail to your mailbox
  },
})
