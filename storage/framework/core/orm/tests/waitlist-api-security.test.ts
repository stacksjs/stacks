import { describe, expect, it } from 'bun:test'
import WaitlistProduct from '../../../defaults/app/Models/commerce/WaitlistProduct'
import WaitlistRestaurant from '../../../defaults/app/Models/commerce/WaitlistRestaurant'

describe('waitlist model API security', () => {
  it.each([
    ['product', WaitlistProduct],
    ['restaurant', WaitlistRestaurant],
  ])('protects every %s waitlist API route', (_kind, model) => {
    expect(model.traits.useApi).toMatchObject({
      routes: ['index', 'store', 'show', 'update', 'destroy'],
      middleware: ['auth'],
    })
  })
})
