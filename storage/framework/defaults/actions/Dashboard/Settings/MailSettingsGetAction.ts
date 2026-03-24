import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'MailSettingsGetAction',
  description: 'Returns the current mail settings.',
  method: 'GET',
  async handle() {
    return {
      data: {
        from: '',
        to: '',
        driver: 'SMTP',
        host: '',
        port: 587,
        username: '',
        password: '',
      },
    }
  },
})
