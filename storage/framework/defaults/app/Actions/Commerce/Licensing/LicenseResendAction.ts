import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions/runtime'
import { licensing } from '@stacksjs/commerce'
import { rateLimit, response } from '@stacksjs/router'
import { sendLicenseKeys } from '../../../Mail/LicenseEmail'

/** Take a slot in a resend bucket; false once it is full. */
async function allow(bucket: 'ip' | 'email', identity?: string): Promise<boolean> {
  const limit = licensing.RESEND_LIMITS[bucket]
  try {
    // No identity for the IP bucket: the limiter reads the client address itself.
    await rateLimit(`license-resend-${bucket}`, limit.max, bucket === 'email' ? { identity: `email:${identity}` } : {}).over(limit.windowSeconds)
    return true
  }
  catch (error) {
    if ((error as { status?: number, statusCode?: number })?.status === 429 || (error as { statusCode?: number })?.statusCode === 429)
      return false
    throw error
  }
}

/**
 * "Email me my license key again."
 *
 * The answer is the same whether or not the address bought anything, and is
 * given before the lookup runs, so neither the body nor the timing says which.
 * Keys only ever go to the address on the license.
 */
export default new Action({
  name: 'License Resend',
  description: 'Send the license keys bought with an address to that address again.',
  method: 'POST',
  apiResponse: true,

  async handle(request: RequestInstance) {
    const { outcome } = await licensing.requestLicenseResend(request.get('email'), {
      allow,
      active: email => licensing.activeLicensesFor(email),
      send: licenses => sendLicenseKeys(licenses),
    })
    if (outcome === 'invalid')
      return response.json({ ok: false, reason: 'invalid-email', message: 'Enter the email address you bought with.' }, 422)
    if (outcome === 'limited')
      return response.json({ ok: false, reason: 'limited', message: 'Too many requests. Try again in an hour.' }, 429)
    return response.json({ ok: true, message: 'If that address has a license, its key is on the way.' })
  },
})
