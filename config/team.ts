import type { Team } from '@stacksjs/types'

/**
 * **Team Members**
 *
 * This configuration defines all of your team members. The key is the name of the team member
 * and the value is their email address. This will automatically generate IAM permissions
 * for each team member, email them their credentials, and add them to the team.
 */
export default {
  name: 'Stacks',

  // Our group of awesome team members
  members: {
    chris: 'chris@stacksjs.org',
    blake: 'blake@stacksjs.org',
    zoltan: 'zoltan@stacksjs.org',
    freddy: 'freddy@stacksjs.org',
    glenn: 'glenn@stacksjs.org',
    dorell: 'dorell@stacksjs.org',
    avery: 'avery@stacksjs.org',
    adelino: 'adelino@stacksjs.org',
    germaine: 'germaine@stacksjs.org',
    harley: 'harley@stacksjs.org',
    michael: 'michael@stacksjs.org',
  },
} satisfies Team
