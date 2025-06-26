import { beforeEach, describe, expect, it } from 'bun:test'
import { formatDate } from '@stacksjs/orm'
import { refreshDatabase } from '@stacksjs/testing'
import { deleteCoupon, deleteExpiredCoupons } from '../coupons/destroy'
import { fetchActive, fetchAll, fetchByCode, fetchById } from '../coupons/fetch'
import { store } from '../coupons/store'
import { update } from '../coupons/update'

beforeEach(async () => {
  await refreshDatabase()
})

describe('Coupon Module', () => {
  describe('store', () => {
    it('should create a new coupon in the database', async () => {
      // Create a unique code to avoid conflicts
      const uniqueCode = `COUPON-${Date.now()}`

      const couponData = {
        code: uniqueCode,
        description: 'Test coupon',
        discount_type: 'percentage',
        discount_value: 10,
        product_id: 1,
        is_active: true,
        start_date: formatDate(new Date('2023-01-01')),
        end_date: formatDate(new Date('2023-12-31')),
      }

      const coupon = await store(couponData)

      expect(coupon).toBeDefined()
      expect(coupon?.code).toBe(uniqueCode)
      expect(coupon?.discount_type).toBe('percentage')
      expect(coupon?.discount_value).toBe(10)
      expect(Boolean(coupon?.is_active)).toBe(true)

      // Save the ID and convert from Generated<number> to number
      const couponId = coupon?.id !== undefined ? Number(coupon.id) : undefined

      // Verify we can fetch the coupon we just created
      if (couponId) {
        const fetchedCoupon = await fetchById(couponId)
        expect(fetchedCoupon).toBeDefined()
        expect(fetchedCoupon?.id).toBe(couponId)
      }
    })

    it('should throw an error when trying to create a coupon with a duplicate code', async () => {
      // Create a unique code to avoid conflicts
      const uniqueCode = `COUPON-DUPLICATE-${Date.now()}`

      // Create first coupon
      const firstCouponData = {
        code: uniqueCode,
        description: 'First test coupon',
        discount_type: 'percentage',
        discount_value: 10,
        product_id: 1,
        start_date: formatDate(new Date('2023-01-01')),
        end_date: formatDate(new Date('2023-12-31')),
      }

      const firstCoupon = await store(firstCouponData)
      expect(firstCoupon).toBeDefined()

      // Try to create a second coupon with the same code
      const secondCouponData = {
        code: uniqueCode, // Same code as the first coupon
        description: 'Second test coupon',
        discount_type: 'fixed',
        discount_value: 5,
        product_id: 2,
        start_date: formatDate(new Date('2023-01-01')),
        end_date: formatDate(new Date('2023-12-31')),
      }

      try {
        await store(secondCouponData)
        // If we get here, the test should fail as we expect an error
        expect(true).toBe(false) // This line should not be reached
      }
      catch (error) {
        expect(error).toBeDefined()
        expect(error instanceof Error).toBe(true)
        expect((error as Error).message).toContain('Failed to create coupon: UNIQUE constraint failed: coupons.code')
      }
    })

    it('should create a coupon with default values when optional fields are missing', async () => {
      // Create a coupon with only required fields
      const uniqueCode = `COUPON-DEFAULT-${Date.now()}`

      const minimalCouponData = {
        code: uniqueCode,
        discount_type: 'percentage',
        discount_value: 15,
        product_id: 1,
        start_date: formatDate(new Date('2023-01-01')),
        end_date: formatDate(new Date('2023-12-31')),
        // Other fields are omitted to test defaults
      }

      const coupon = await store(minimalCouponData)

      expect(coupon).toBeDefined()
      expect(coupon?.code).toBe(uniqueCode)
      expect(coupon?.discount_type).toBe('percentage')
      expect(coupon?.discount_value).toBe(15)
    })
  })

  describe('fetchById and fetchByCode', () => {
    it('should fetch a coupon by ID', async () => {
      // First create a coupon to fetch
      const uniqueCode = `COUPON-FETCH-${Date.now()}`
      const couponData = {
        code: uniqueCode,
        description: 'Fetch test coupon',
        discount_type: 'percentage',
        discount_value: 10,
        product_id: 1,
        start_date: formatDate(new Date('2023-01-01')),
        end_date: formatDate(new Date('2023-12-31')),
      }

      const coupon = await store(couponData)
      const couponId = coupon?.id !== undefined ? Number(coupon.id) : undefined

      // Make sure we have a valid coupon ID before proceeding
      expect(couponId).toBeDefined()
      if (!couponId) {
        throw new Error('Failed to create test coupon')
      }

      // Now fetch the coupon by ID
      const fetchedCoupon = await fetchById(couponId)

      expect(fetchedCoupon).toBeDefined()
      expect(fetchedCoupon?.id).toBe(couponId)
      expect(fetchedCoupon?.code).toBe(uniqueCode)
      expect(fetchedCoupon?.discount_value).toBe(10)
    })

    it('should fetch a coupon by code', async () => {
      // Create a coupon with a unique code
      const uniqueCode = `COUPON-FETCH-CODE-${Date.now()}`
      const couponData = {
        code: uniqueCode,
        description: 'Fetch by code test coupon',
        discount_type: 'fixed',
        discount_value: 5,
        product_id: 1,
        start_date: formatDate(new Date('2023-01-01')),
        end_date: formatDate(new Date('2023-12-31')),
      }

      const coupon = await store(couponData)
      expect(coupon).toBeDefined()

      // Now fetch the coupon by code
      const fetchedCoupon = await fetchByCode(uniqueCode)

      expect(fetchedCoupon).toBeDefined()
      expect(fetchedCoupon?.code).toBe(uniqueCode)
      expect(fetchedCoupon?.discount_type).toBe('fixed')
      expect(fetchedCoupon?.discount_value).toBe(5)
    })

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

  describe('update', () => {
    it('should update an existing coupon', async () => {
      // First create a coupon to update
      const uniqueCode = `COUPON-UPDATE-${Date.now()}`
      const initialData = {
        code: uniqueCode,
        description: 'Initial description',
        discount_type: 'percentage',
        discount_value: 10,
        product_id: 1,
        start_date: formatDate(new Date('2023-01-01')),
        end_date: formatDate(new Date('2023-12-31')),
      }

      // Create the coupon
      const coupon = await store(initialData)
      const couponId = coupon?.id !== undefined ? Number(coupon.id) : undefined

      // Make sure we have a valid coupon ID before proceeding
      expect(couponId).toBeDefined()
      if (!couponId) {
        throw new Error('Failed to create test coupon')
      }

      // Update the coupon with new data
      const updateData = {
        description: 'Updated description',
        discount_value: 15,
        is_active: true,
      }

      const updatedCoupon = await update(couponId, updateData)

      // Verify the update was successful
      expect(updatedCoupon).toBeDefined()
      expect(updatedCoupon?.id).toBe(couponId)
      expect(updatedCoupon?.description).toBe('Updated description')
      expect(updatedCoupon?.discount_value).toBe(15)
      expect(updatedCoupon?.is_active).toBe(true)

      // Check JSON arrays are properly parsed

      // The original fields should remain unchanged
      expect(updatedCoupon?.code).toBe(uniqueCode)
      expect(updatedCoupon?.discount_type).toBe('percentage')
    })

    it('should throw an error when trying to update a coupon with an existing code', async () => {
      // Create two coupons with unique codes
      const code1 = `COUPON-UPDATE-CONFLICT-1-${Date.now()}`
      const code2 = `COUPON-UPDATE-CONFLICT-2-${Date.now()}`

      // Create first coupon
      const firstCouponData = {
        code: code1,
        discount_type: 'percentage',
        discount_value: 10,
        product_id: 1,
        start_date: formatDate(new Date('2023-01-01')),
        end_date: formatDate(new Date('2023-12-31')),
      }

      const firstCoupon = await store(firstCouponData)
      const firstCouponId = firstCoupon?.id !== undefined ? Number(firstCoupon.id) : undefined
      expect(firstCouponId).toBeDefined()

      // Create second coupon
      const secondCouponData = {
        code: code2,
        discount_type: 'fixed',
        discount_value: 5,
        product_id: 1,
        start_date: formatDate(new Date('2023-01-01')),
        end_date: formatDate(new Date('2023-12-31')),
      }

      const secondCoupon = await store(secondCouponData)
      const secondCouponId = secondCoupon?.id !== undefined ? Number(secondCoupon.id) : undefined
      expect(secondCouponId).toBeDefined()

      if (!firstCouponId || !secondCouponId)
        throw new Error('Failed to create test coupons')

      // Try to update the second coupon with the first coupon's code
      const updateData = {
        code: code1, // This should conflict with the first coupon
      }

      try {
        await update(secondCouponId, updateData)
        // If we get here, the test should fail as we expect an error
        expect(true).toBe(false) // This line should not be reached
      }
      catch (error) {
        expect(error).toBeDefined()
        expect(error instanceof Error).toBe(true)
        expect((error as Error).message).toContain('Failed to update coupon: UNIQUE constraint failed: coupons.code')
      }
    })
  })

  describe('delete', () => {
    it('should delete a coupon from the database', async () => {
      // First create a coupon to delete
      const uniqueCode = `COUPON-DELETE-${Date.now()}`
      const couponData = {
        code: uniqueCode,
        discount_type: 'percentage',
        discount_value: 10,
        product_id: 1,
        start_date: formatDate(new Date('2023-01-01')),
        end_date: formatDate(new Date('2023-12-31')),
      }

      // Create the coupon
      const coupon = await store(couponData)
      const couponId = coupon?.id !== undefined ? Number(coupon.id) : undefined

      // Make sure we have a valid coupon ID before proceeding
      expect(couponId).toBeDefined()
      if (!couponId) {
        throw new Error('Failed to create test coupon')
      }

      // Verify the coupon exists
      let fetchedCoupon = await fetchById(couponId)
      expect(fetchedCoupon).toBeDefined()

      // Delete the coupon
      const result = await deleteCoupon(couponId)
      expect(result).toBe(true)

      // Verify the coupon no longer exists
      fetchedCoupon = await fetchById(couponId)
      expect(fetchedCoupon).toBeUndefined()
    })

    it('should delete expired coupons', async () => {
      // Create expired coupons (end_date in the past)
      const pastDate = new Date()
      pastDate.setMonth(pastDate.getMonth() - 1)
      const pastDateStr = formatDate(pastDate)

      const expiredCoupons = []
      const expiredCouponIds = []

      // Create 3 expired coupons
      for (let i = 0; i < 3; i++) {
        const uniqueCode = `COUPON-EXPIRED-${i}-${Date.now()}`
        const couponData = {
          code: uniqueCode,
          discount_type: 'percentage',
          discount_value: 10,
          product_id: 1,
          start_date: formatDate(new Date('2022-01-01')),
          end_date: pastDateStr,
        }

        const coupon = await store(couponData)
        expect(coupon).toBeDefined()

        const couponId = coupon?.id !== undefined ? Number(coupon.id) : undefined
        if (couponId) {
          expiredCouponIds.push(couponId)
          expiredCoupons.push(coupon)
        }
      }

      // Create a non-expired coupon
      const futureDate = new Date()
      futureDate.setMonth(futureDate.getMonth() + 1)
      const futureDateStr = formatDate(futureDate)

      const validCode = `COUPON-VALID-${Date.now()}`
      const validData = {
        code: validCode,
        discount_type: 'percentage',
        discount_value: 10,
        product_id: 1,
        start_date: formatDate(new Date('2022-01-01')),
        end_date: futureDateStr,
      }

      const validCoupon = await store(validData)
      const validCouponId = validCoupon?.id !== undefined ? Number(validCoupon.id) : undefined

      // Delete expired coupons
      const deletedCount = await deleteExpiredCoupons()
      expect(deletedCount).toBeGreaterThanOrEqual(expiredCoupons.length)

      // Verify expired coupons no longer exist
      for (const id of expiredCouponIds) {
        const fetchedCoupon = await fetchById(id)
        expect(fetchedCoupon).toBeUndefined()
      }

      // Verify non-expired coupon still exists
      if (validCouponId) {
        const fetchedValidCoupon = await fetchById(validCouponId)
        expect(fetchedValidCoupon).toBeDefined()
      }
    })
  })
})
