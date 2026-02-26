import { beforeEach, describe, expect, it } from 'bun:test'
import { formatDate } from '@stacksjs/orm'
import { refreshDatabase } from '@stacksjs/testing'
import { fetchActive, fetchAll } from '../coupons/fetch'
import { store } from '../coupons/store'

beforeEach(async () => {
  await refreshDatabase()
})

describe('Coupon Module', () => {
  describe('fetchById and fetchByCode', () => {
    it('should fetch all coupons', async () => {
      // Create multiple coupons
      const codes = []
      for (let i = 0; i < 3; i++) {
        const code = `COUPON-ALL-${i}-${Date.now()}`
        codes.push(code)

        const couponData = {
          code,
          discount_type: 'percentage',
          discount_value: 10 + i,
          product_id: 1,
          start_date: formatDate(new Date('2023-01-01')),
          end_date: formatDate(new Date('2023-12-31')),
        }

        await store(couponData)
      }

      // Fetch all coupons
      const allCoupons = await fetchAll()

      // Verify all coupons are fetched
      expect(allCoupons.length).toBeGreaterThanOrEqual(3)

      // Check if our created coupons are in the results
      for (const code of codes) {
        const found = allCoupons.some(coupon => coupon.code === code)
        expect(found).toBe(true)
      }
    })

    it('should fetch active coupons', async () => {
      // Create an active coupon (current date within range)
      const today = new Date()
      const futureDate = new Date(today)
      futureDate.setMonth(today.getMonth() + 1)

      const activeCode = `COUPON-ACTIVE-${Date.now()}`
      const activeData = {
        code: activeCode,
        discount_type: 'percentage',
        discount_value: 20,
        product_id: 1,
        start_date: formatDate(today),
        end_date: formatDate(futureDate),
        is_active: true,
      }

      await store(activeData)

      // Create an inactive coupon (same date range but is_active = false)
      const inactiveCode = `COUPON-INACTIVE-${Date.now()}`
      const inactiveData = {
        code: inactiveCode,
        discount_type: 'percentage',
        discount_value: 20,
        product_id: 1,
        start_date: formatDate(today),
        end_date: formatDate(futureDate),
        is_active: false,
      }

      await store(inactiveData)

      // Fetch active coupons
      const activeCoupons = await fetchActive()

      // Check that active coupon is included
      const hasActiveCoupon = activeCoupons.some(coupon => coupon.code === activeCode)
      expect(hasActiveCoupon).toBe(true)

      // Check that inactive coupon is not included
      const hasInactiveCoupon = activeCoupons.some(coupon => coupon.code === inactiveCode)
      expect(hasInactiveCoupon).toBe(false)
    })
  })
})
