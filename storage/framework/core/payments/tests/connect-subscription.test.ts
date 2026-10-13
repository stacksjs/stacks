import { describe, expect, test } from 'bun:test'
import { connect } from '../src/connect'
import { manageDestinationSubscription } from '../src/connect/subscription'

const { feePercentFor, subscriptionData, lineItem, destinationOf } = manageDestinationSubscription

describe('@stacksjs/payments - Connect destination subscriptions', () => {
  describe('subscriptionData', () => {
    test('settles every invoice to the connected account', () => {
      expect(subscriptionData('acct_coach', { platformFeePercent: 0 })).toEqual({ transfer_data: { destination: 'acct_coach' } })
    })

    test('takes the platform cut as a percentage, not an amount', () => {
      // A subscription's invoices vary (prorations, coupons, a trial's zero),
      // so Stripe takes the fee as a percentage of each one.
      expect(subscriptionData('acct_coach', { platformFeePercent: 12.5 })).toEqual({
        transfer_data: { destination: 'acct_coach' },
        application_fee_percent: 12.5,
      })
    })

    test('carries a trial, metadata and on_behalf_of', () => {
      expect(subscriptionData('acct_coach', { platformFeePercent: 0, trialDays: 14, onBehalfOf: true, metadata: { product_id: '7' } })).toEqual({
        transfer_data: { destination: 'acct_coach' },
        on_behalf_of: 'acct_coach',
        trial_period_days: 14,
        metadata: { product_id: '7' },
      })
    })

    test('refuses an id that is not a connected account', () => {
      expect(() => subscriptionData('cus_123')).toThrow(/acct_/)
    })

    test('refuses a trial Stripe would reject', () => {
      expect(() => subscriptionData('acct_coach', { platformFeePercent: 0, trialDays: 0 })).toThrow(/trialDays/)
      expect(() => subscriptionData('acct_coach', { platformFeePercent: 0, trialDays: 731 })).toThrow(/trialDays/)
      expect(() => subscriptionData('acct_coach', { platformFeePercent: 0, trialDays: 1.5 })).toThrow(/trialDays/)
    })
  })

  describe('feePercentFor', () => {
    test('zero takes nothing, so Stripe gets no fee field at all', () => {
      expect(feePercentFor({ platformFeePercent: 0 })).toBeUndefined()
    })

    test('refuses a percentage out of range or finer than Stripe takes', () => {
      expect(() => feePercentFor({ platformFeePercent: 101 })).toThrow(/between 0 and 100/)
      expect(() => feePercentFor({ platformFeePercent: -1 })).toThrow(/between 0 and 100/)
      expect(() => feePercentFor({ platformFeePercent: 2.555 })).toThrow(/two decimal places/)
    })
  })

  describe('lineItem', () => {
    test('passes a catalog price through', () => {
      expect(lineItem('price_123')).toEqual({ price: 'price_123', quantity: 1 })
    })

    test('builds a recurring price from an amount and an interval', () => {
      expect(lineItem({ amount: 9900, currency: 'EUR', interval: 'month', productName: 'Coaching', productDescription: 'Weekly check-ins' })).toEqual({
        quantity: 1,
        price_data: {
          currency: 'eur',
          unit_amount: 9900,
          recurring: { interval: 'month' },
          product_data: { name: 'Coaching', description: 'Weekly check-ins' },
        },
      })
    })

    test('bills every N intervals', () => {
      const item = lineItem({ amount: 25000, currency: 'usd', interval: 'month', intervalCount: 3, productName: 'Quarterly' })
      expect(item.price_data?.recurring).toEqual({ interval: 'month', interval_count: 3 })
    })

    test('refuses a price that is not recurring-shaped', () => {
      expect(() => lineItem({ amount: 0, currency: 'usd', interval: 'month', productName: 'Free' })).toThrow(/positive amount/)
      expect(() => lineItem({ amount: 19.99, currency: 'usd', interval: 'month', productName: 'Float' })).toThrow(/positive amount/)
      expect(() => lineItem({ amount: 100, currency: 'usd', interval: 'fortnight' as never, productName: 'X' })).toThrow(/interval/)
      expect(() => lineItem({ amount: 100, currency: 'usd', interval: 'month', productName: ' ' })).toThrow(/productName/)
      expect(() => lineItem('prod_123')).toThrow(/price_/)
    })
  })

  describe('destinationOf', () => {
    test('reads the merchant off a subscription, expanded or not', () => {
      expect(destinationOf({ transfer_data: { destination: 'acct_1' } })).toBe('acct_1')
      expect(destinationOf({ transfer_data: { destination: { id: 'acct_2' } } })).toBe('acct_2')
    })

    test('null for the platform\'s own subscription', () => {
      expect(destinationOf({ transfer_data: null })).toBeNull()
      expect(destinationOf({})).toBeNull()
    })
  })

  test('is reachable on the grouped Connect surface', () => {
    expect(connect.subscriptionCheckout).toBe(manageDestinationSubscription.checkout)
    expect(connect.subscriptionFeePercent).toBe(feePercentFor)
    expect(connect.subscriptionDestination).toBe(destinationOf)
    expect(connect.subscription).toBe(manageDestinationSubscription)
  })
})
