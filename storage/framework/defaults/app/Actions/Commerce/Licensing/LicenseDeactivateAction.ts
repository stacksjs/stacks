import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions/runtime'
import { licensing } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'
import { refusal } from './license-response'

/** Release a device's slot on a license, so another device can take it. */
export default new Action({
  name: 'License Deactivate',
  description: 'Release a device from a license key.',
  method: 'POST',
  apiResponse: true,

  async handle(request: RequestInstance) {
    const result = await licensing.deactivateLicense({ key: request.get('key'), deviceHash: request.get('deviceHash') })
    if (!result.ok)
      return refusal('not-found', 'That license key was not found.')
    return response.json({ ok: true, released: result.released })
  },
})
