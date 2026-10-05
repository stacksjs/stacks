import { Action } from '@stacksjs/actions/runtime'
import { config } from '@stacksjs/config'
import { getDashboardMailboxSnapshot } from './mailbox-overview'

export default new Action({
  name: 'MailboxIndexAction',
  description: 'Returns mailbox configuration from config files.',
  method: 'GET',
  async handle() {
    return getDashboardMailboxSnapshot(config.email)
  },
})
