import { describe, expect, it } from 'bun:test'
import { ModelUnavailableError } from '../../storage/framework/core/orm/src/index'
import { dashboardOperationalError } from '../../storage/framework/defaults/app/Actions/Dashboard/dashboard-response'

/**
 * stacksjs/stacks#3184: with commerce off, every commerce page answered
 * "Order records could not be read." with a 503, the same as a database
 * outage, which sent people looking at their database. A model whose feature
 * is off now says so, and anything else keeps the operational 503.
 */

async function answer(error: unknown): Promise<{ status: number, message: string }> {
  const res = dashboardOperationalError(error, 'Order records could not be read.', 'CommerceOrdersAction')
  return { status: res.status, message: (await res.json() as { message: string }).message }
}

describe('dashboardOperationalError', () => {
  it('names the feature that is off', async () => {
    expect(await answer(new ModelUnavailableError('Order', 'commerce'))).toEqual({
      status: 404,
      message: 'Commerce is turned off for this app, so this page has no data. Set `enabled: true` in config/commerce.ts to use it.',
    })
  })

  it('recognises the error by name, across module instances', async () => {
    const copy = Object.assign(new Error('Model "Post" is not available in this process.'), { name: 'ModelUnavailableError', feature: 'cms' })
    expect((await answer(copy)).status).toBe(404)
  })

  it('keeps the operational 503 for everything else', async () => {
    expect(await answer(new Error('connection refused'))).toEqual({ status: 503, message: 'Order records could not be read.' })
    // A model with no feature gate is missing, not switched off.
    expect(await answer(new ModelUnavailableError('Ghost', undefined))).toEqual({ status: 503, message: 'Order records could not be read.' })
  })
})
