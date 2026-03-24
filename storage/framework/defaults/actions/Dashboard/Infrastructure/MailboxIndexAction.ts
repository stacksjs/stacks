import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'MailboxIndexAction',
  description: 'Returns mailbox data for the dashboard.',
  method: 'GET',
  async handle() {
    return {
      data: [
        { id: 1, address: 'hello@stacksjs.com', name: 'General', messageCount: 234, unread: 12, status: 'active' },
        { id: 2, address: 'support@stacksjs.com', name: 'Support', messageCount: 567, unread: 45, status: 'active' },
        { id: 3, address: 'sales@stacksjs.com', name: 'Sales', messageCount: 123, unread: 3, status: 'active' },
      ],
    }
  },
})
