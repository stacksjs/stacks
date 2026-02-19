import { Action } from '@stacksjs/actions'

export interface NotifyUserParams {
  id: number
  name: string
}

export default new Action({
  name: 'NotifyUser',
  description: 'Notify User After Creation',

  async handle({ id, name }: NotifyUserParams) {
    console.log(`[NotifyUser] User created:`, { id, name })

    return { success: true }
  },
})
