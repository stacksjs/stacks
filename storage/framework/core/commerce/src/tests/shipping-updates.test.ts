import { beforeEach, describe, expect, it } from 'bun:test'
import { update as updateRoute } from '../shippings/delivery-routes/update'
import { update as updateDigitalDelivery } from '../shippings/digital-deliveries/update'
import { update as updateCourier } from '../shippings/couriers/update'
import { update as updateLicenseKey } from '../shippings/license-keys/update'
import { update as updateMethod } from '../shippings/shipping-methods/update'
import { update as updateRate } from '../shippings/shipping-rates/update'
import { update as updateZone } from '../shippings/shipping-zones/update'
import { refreshDatabase } from './setup'

beforeEach(async () => {
  await refreshDatabase()
})

describe('Shipping update contracts', () => {
  it('returns undefined for missing shipping records', async () => {
    expect(await updateMethod(99999999, {})).toBeUndefined()
    expect(await updateRate(99999999, {})).toBeUndefined()
    expect(await updateZone(99999999, {})).toBeUndefined()
    expect(await updateRoute(99999999, {})).toBeUndefined()
    expect(await updateCourier(99999999, {})).toBeUndefined()
    expect(await updateDigitalDelivery(99999999, {})).toBeUndefined()
    expect(await updateLicenseKey(99999999, {})).toBeUndefined()
  })
})
