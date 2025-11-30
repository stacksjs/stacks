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
    chris: 'chris@stacksjs.com',
    blake: 'blake@stacksjs.com',
    zoltan: 'zoltan@stacksjs.com',
    freddy: 'freddy@stacksjs.com',
    glenn: 'glenn@stacksjs.com',
    dorell: 'dorell@stacksjs.com',
    avery: 'avery@stacksjs.com',
    adelino: 'adelino@stacksjs.com',
    germaine: 'germaine@stacksjs.com',
    harley: 'harley@stacksjs.com',
    michael: 'michael@stacksjs.com',
  },
} satisfies Team
