import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'NotifyUser',
  description: 'Notify User After Creation',

  async handle(data: Record<string, any>) {
    console.log(`[NotifyUser] User created:`, data)

    return { success: true }
  },
})
