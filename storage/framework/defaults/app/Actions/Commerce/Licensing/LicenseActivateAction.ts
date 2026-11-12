import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions/runtime'
import { licensing } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'
import { answer, refusal } from './license-response'

/**
 * Activate a license key on a device.
 *
 * The key is the credential: whoever holds it may use one of its device
 * slots. The device is named only by the SHA-256 of an id the app chose.
 * Answers the signed token the app keeps for offline use, or, beyond the
 * device limit, a 409 naming the devices holding the slots.
 */
export default new Action({
  name: 'License Activate',
  description: 'Activate a license key on a device and answer its signed offline token.',
  method: 'POST',
  apiResponse: true,

  async handle(request: RequestInstance) {
    return answer(async () => {
      const result = await licensing.activateLicense({
        key: request.get('key'),
        deviceHash: request.get('deviceHash'),
        deviceName: request.get('deviceName'),
        platform: request.get('platform'),
        appVersion: request.get('appVersion'),
        email: request.get('email'),
      })
      if (!result.ok)
        return refusal(result.reason, result.message, result.devices ? { devices: result.devices } : {})
      return response.json({ ok: true, valid: true, key: result.key, token: result.token, license: result.license })
    })
  },
})
