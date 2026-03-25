import { Action } from '@stacksjs/actions'
// import { Action as ActionModel } from '@stacksjs/orm'

export default new Action({
  name: 'GetActions',
  description: 'Gets your actions.',
  method: 'GET',
  async handle() {
    // TODO: replace with ActionModel.all() when ORM is ready
    return {
      actions: [
        { name: 'SendWelcomeEmail', type: 'email', runs: 1247, avgTime: '234ms', status: 'active' },
        { name: 'ProcessPayment', type: 'payment', runs: 892, avgTime: '1.2s', status: 'active' },
        { name: 'GenerateReport', type: 'report', runs: 156, avgTime: '4.5s', status: 'active' },
        { name: 'SyncInventory', type: 'sync', runs: 48, avgTime: '12s', status: 'paused' },
      ],
    }
  },
})
