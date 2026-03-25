import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'MailboxIndexAction',
  description: 'Returns mailbox data for the dashboard.',
  method: 'GET',
  async handle() {
    // TODO: replace with model query when Mailbox model is available
    const mailboxes = [
      { email: 'hello@stacks.dev', type: 'Primary', storage: '2.3 GB', quota: '10 GB', status: 'active' },
      { email: 'support@stacks.dev', type: 'Shared', storage: '1.8 GB', quota: '10 GB', status: 'active' },
      { email: 'sales@stacks.dev', type: 'Shared', storage: '0.5 GB', quota: '10 GB', status: 'active' },
      { email: 'noreply@stacks.dev', type: 'Send-only', storage: '0.1 GB', quota: '1 GB', status: 'active' },
    ]

    const aliases = [
      { alias: 'info@stacks.dev', forwards: 'hello@stacks.dev' },
      { alias: 'contact@stacks.dev', forwards: 'hello@stacks.dev' },
      { alias: 'help@stacks.dev', forwards: 'support@stacks.dev' },
    ]

    const stats = [
      { label: 'Mailboxes', value: '4' },
      { label: 'Aliases', value: '3' },
      { label: 'Sent Today', value: '234' },
      { label: 'Received Today', value: '567' },
    ]

    const domains = [
      { domain: 'stacks.dev', mailboxes: 4, status: 'verified', dkim: 'valid', spf: 'valid' },
    ]

    return {
      mailboxes,
      aliases,
      stats,
      domains,
    }
  },
})
