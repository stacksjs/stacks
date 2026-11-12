import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions/runtime'
import { licensing } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'
import { answer } from './license-response'

/**
 * Where a license stands for a device, with a fresh token when it is good.
 *
 * Always a 200 when the question could be answered: `valid: false` with a
 * reason (`revoked`, `refunded`, `expired`, `released`, `not-found`) is an
 * answer, and a client drops its stored token on it. Only a 5xx means "ask
 * again later", which is why a refusal is not an error status here.
 */
export default new Action({
  name: 'License Check',
  description: 'Answer a license\'s standing for a device, with a fresh signed token.',
  method: 'POST',
  apiResponse: true,

  async handle(request: RequestInstance) {
    return answer(async () => {
      const result = await licensing.checkLicense({
        key: request.get('key'),
        deviceHash: request.get('deviceHash'),
        appVersion: request.get('appVersion'),
      })
      return response.json({ ok: true, ...result })
    })
  },
})
