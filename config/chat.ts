import { defineChat } from 'stacks/utils'
import { env } from 'stacks/validation'

/**
 * **Chat Configuration**
 *
 * This configuration defines all of your email options. Because Stacks is fully-typed,
 * you may hover any of the options below and the definitions will be provided. In case
 * you have any questions, feel free to reach out via Discord or GitHub Discussions.
 */
export default defineChat({
  default: 'slack',

  from: env.SLACK_FROM || '',

  drivers: {
    slack: {
      appId: env.SLACK_APPLICATION_ID || '',
      clientId: env.SLACK_CLIENT_ID || '',
      secret: env.SLACK_SECRET_KEY || '',
    },

    msTeams: {
      appId: env.MICROSOFT_TEAMS_APPLICATION_ID || '',
      clientId: env.MICROSOFT_TEAMS_CLIENT_ID || '',
      secret: env.MICROSOFT_TEAMS_SECRET || '',
    },

    discord: {},
  },
})
