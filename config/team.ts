import type { Team } from '@stacksjs/types'

/**
 * **Team Members**
 *
 * This configuration defines all of your team members. The key is the name of the team member
 * and the value is their email address. This will automatically generate IAM permissions
 * for each team member, email them their credentials, and add them to the team.
 */
export default {
  avery: 'avery@stacksjs.org',
  brian: 'brian@stacksjs.org',
  chris: 'chris@stacksjs.org',
  germaine: 'germaine@stacksjs.org',
  glenn: 'glenn@stacksjs.org',
  harley: 'harley@stacksjs.org',
  royce: 'royce@stacksjs.org',
} satisfies Team
