import { describe, expect, test } from 'bun:test'
import {
  indexLicenseKeyOptions,
  normalizeLicenseKeyCustomer,
  normalizeLicenseKeyOrder,
  normalizeLicenseKeyProduct,
  normalizeLicenseKeyRecord,
} from './license-key-records'

describe('license key records', () => {
  const customer = normalizeLicenseKeyCustomer({ id: 1, name: 'Ada Lovelace', email: 'ada@example.com' })
  const product = normalizeLicenseKeyProduct({ id: 2, name: 'Native App Kit' })
  const order = normalizeLicenseKeyOrder({ id: 3, status: 'PAID' })
  const customers = indexLicenseKeyOptions([customer])
  const products = indexLicenseKeyOptions([product])
  const orders = indexLicenseKeyOptions([order])

  test('normalizes persisted keys and their relationships', () => {
    expect(normalizeLicenseKeyRecord({
      id: 4,
      key: 'abcd-1234-efgh-5678-ijkl',
      template: 'Premium License',
      expiry_date: '2027-07-29 10:00:00',
      status: 'active',
      customer_id: 1,
      product_id: 2,
      order_id: 3,
      created_at: '2026-07-29 10:00:00',
      updated_at: null,
      uuid: null,
    }, customers, products, orders)).toEqual({
      id: 4,
      key: 'ABCD-1234-EFGH-5678-IJKL',
      template: 'Premium License',
      expiry_date: '2027-07-29T10:00:00.000Z',
      status: 'active',
      customer_id: 1,
      product_id: 2,
      order_id: 3,
      created_at: '2026-07-29T10:00:00.000Z',
      updated_at: '',
      uuid: '',
      customer,
      product,
      order,
    })
  })

  test('rejects malformed keys and missing relationships', () => {
    const base = {
      id: 4,
      key: 'ABCD-1234-EFGH-5678-IJKL',
      template: 'Standard License',
      expiry_date: '2027-07-29 10:00:00',
      status: 'unassigned',
      created_at: '2026-07-29 10:00:00',
    }
    expect(() => normalizeLicenseKeyRecord({ ...base, key: 'not-a-key' }, customers, products, orders))
      .toThrow('LicenseKey 4.key must use five groups')
    expect(() => normalizeLicenseKeyRecord({ ...base, product_id: 99 }, customers, products, orders))
      .toThrow('LicenseKey 4.product_id references missing Product 99')
  })

  test('rejects duplicate relationship options', () => {
    expect(() => indexLicenseKeyOptions([product, product]))
      .toThrow('Duplicate relationship option 2')
  })
})
