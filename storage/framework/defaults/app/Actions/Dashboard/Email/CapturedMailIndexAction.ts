import { Action } from '@stacksjs/actions'
import { dashboardOperationalError } from '../dashboard-response'
import { listCapturedMail } from './captured-mail'

export default new Action({
  name: 'CapturedMailIndexAction',
  description: 'Returns outbound emails captured by the local log mail driver.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    try {
      const messages = await listCapturedMail()
      return {
        captureDriver: 'log',
        activeDriver: process.env.MAIL_MAILER || 'log',
        total: messages.length,
        messages,
      }
    }
    catch (error) {
      return dashboardOperationalError(error, 'Captured emails could not be loaded.', 'CapturedMailIndexAction')
    }
  },
})
