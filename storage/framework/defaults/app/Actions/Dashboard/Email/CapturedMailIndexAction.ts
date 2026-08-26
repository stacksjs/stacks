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
      // `problems` carries the captures that could not be parsed. They are
      // reported rather than thrown so one stale file cannot 503 the inbox,
      // and reported rather than dropped so the operator can still see that
      // something in the capture directory needs attention.
      const { messages, problems } = await listCapturedMail()
      return {
        captureDriver: 'log',
        activeDriver: process.env.MAIL_MAILER || 'log',
        total: messages.length,
        messages,
        unreadable: problems.length,
        problems,
      }
    }
    catch (error) {
      return dashboardOperationalError(error, 'Captured emails could not be loaded.', 'CapturedMailIndexAction')
    }
  },
})
