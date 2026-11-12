import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions/runtime'
import { licensing } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'
import { refusal } from './license-response'

/**
 * Hand a license to another person.
 *
 * The caller names the key and the address it is registered to. Every device
 * is released and the key is emailed to the new owner.
 */
export default new Action({
  name: 'License Transfer',
  description: 'Transfer a license key to a new owner\'s email address.',
  method: 'POST',
  apiResponse: true,

  async handle(request: RequestInstance) {
    const result = await licensing.transferLicense({
      key: request.get('key'),
      fromEmail: request.get('email'),
      toEmail: request.get('toEmail'),
    })
    if (!result.ok) {
      // "No such key" and "not yours" are one answer, so a key cannot be probed for its owner.
      const reason = result.reason === 'not-owner' ? 'not-found' : result.reason
      return refusal(reason, result.message)
    }
    return response.json({ ok: true, email: result.license.email })
  },
})
