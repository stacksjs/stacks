import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'MailSettingsUpdateAction',
  description: 'Updates the mail settings.',
  method: 'PUT',
  async handle() {
    return { success: true, message: 'Mail settings updated' }
  },
})
