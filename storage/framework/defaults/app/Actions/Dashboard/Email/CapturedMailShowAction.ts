import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'
import { showCapturedMail } from './captured-mail'

export default new Action({
  name: 'CapturedMailShowAction',
  description: 'Returns one outbound email captured by the local log mail driver.',
  method: 'GET',
  apiResponse: true,

  async handle(request: RequestInstance) {
    const id = request.params?.id
    if (typeof id !== 'string' || !id)
      return response.json({ message: 'Captured email id is required.' }, 422)
    if (!/^disk:[^/\\]+\.html$/.test(id) && !/^mem:\d+:\d+$/.test(id))
      return response.json({ message: 'Captured email id must use the disk or memory format.' }, 422)

    try {
      const message = await showCapturedMail(id)
      if (!message)
        return response.json({ message: 'Captured email not found.' }, 404)
      return { message }
    }
    catch (error) {
      return response.json({
        message: error instanceof Error ? error.message : 'Captured email could not be loaded.',
      }, 503)
    }
  },
})
