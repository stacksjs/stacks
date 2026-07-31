import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'
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
      return response.json({
        message: error instanceof Error ? error.message : 'Captured emails could not be loaded.',
      }, 503)
    }
  },
})
