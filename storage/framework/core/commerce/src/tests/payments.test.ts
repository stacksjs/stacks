import { beforeEach, describe, expect, it, mock } from 'bun:test'
import { db } from '@stacksjs/database'
import { bulkDestroy, destroy } from '../payments/destroy'
import { fetchMonthlyPaymentTrends, fetchPaymentStats, fetchPaymentStatsByMethod } from '../payments/fetch'
import { store } from '../payments/store'

// Mock the database
mock.module('@stacksjs/database', () => ({
  db: {
    selectFrom: mock(() => ({
      select: mock(() => ({
        where: mock(() => ({
          where: mock(() => ({
            where: mock(() => ({
              executeTakeFirst: mock(() => Promise.resolve({
                transaction_count: 15,
                total_revenue: 1500,
              })),
            })),
          })),
        })),
      })),
      where: mock(() => ({
        where: mock(() => ({
          where: mock(() => ({
            groupBy: mock(() => ({
              groupBy: mock(() => ({
                orderBy: mock(() => ({
                  orderBy: mock(() => ({
                    execute: mock(() => Promise.resolve([
                      { year: 2023, month: 1, transactions: 10, revenue: 1000 },
                      { year: 2023, month: 2, transactions: 12, revenue: 1200 },
                    ])),
                  })),
                })),
              })),
            })),
          })),
        })),
      })),
      // Separate function for payment method stats
      selectAll: mock(() => ({
        executeTakeFirst: mock(() => Promise.resolve({
          id: 1,
          order_id: 1,
          customer_id: 1,
          amount: 100,
          method: 'credit_card',
          status: 'completed',
          currency: 'USD',
          reference_number: 'REF123',
          card_last_four: '4242',
          card_brand: 'Visa',
          billing_email: 'test@example.com',
          transaction_id: 'TRX123',
          payment_provider: 'stripe',
          created_at: new Date(),
          updated_at: new Date(),
        })),
      })),
      // Payment method stats
      selectMethod: mock(() => ({
        where: mock(() => ({
          where: mock(() => ({
            where: mock(() => ({
              groupBy: mock(() => ({
                execute: mock(() => Promise.resolve([
                  { method: 'credit_card', count: 10, revenue: 1000 },
                  { method: 'paypal', count: 5, revenue: 500 },
                ])),
              })),
            })),
          })),
        })),
      })),
    })),
    insertInto: mock(() => ({
      values: mock(() => ({
        executeTakeFirst: mock(() => Promise.resolve({ insertId: 1 })),
      })),
    })),
    deleteFrom: mock(() => ({
      where: mock(() => ({
        executeTakeFirst: mock(() => Promise.resolve({ numDeletedRows: 1 })),
      })),
    })),
    fn: {
      count: (column: string) => `COUNT(${column})`,
      sum: (column: string) => `SUM(${column})`,
    },
  },
  sql: (strings: TemplateStringsArray, ...values: any[]) => ({ text: strings.join('?'), values }),
}))

// Mock the request validation
class MockRequest {
  private data: Record<string, any> = {}

  constructor(data: Record<string, any>) {
    this.data = data
  }

  validate() {
    return Promise.resolve()
  }

  get<T = any>(key: string): T {
    return this.data[key] as T
  }
}

describe('Payment Module', () => {
  beforeEach(() => {
    // Reset mocks before each test
    mock.restore()
  })

  describe('fetchPaymentStats', () => {
    it('should fetch payment statistics for the default period (30 days)', async () => {
      const stats = await fetchPaymentStats()

      expect(stats).toBeDefined()
      expect(stats.total_transactions).toBe(15)
      expect(stats.total_revenue).toBe(1500)
      expect(stats.average_transaction).toBe(100)
      expect(stats.comparison).toBeDefined()
      expect(stats.comparison.transactions).toBeDefined()
      expect(stats.comparison.revenue).toBeDefined()
      expect(stats.comparison.average).toBeDefined()

      // Verify db was called correctly
      expect(db.selectFrom).toHaveBeenCalledWith('payments')
    })

    it('should fetch payment statistics for a custom period', async () => {
      const stats = await fetchPaymentStats(60)

      expect(stats).toBeDefined()
      expect(stats.total_transactions).toBe(15)
      expect(stats.total_revenue).toBe(1500)

      // Verify db was called correctly
      expect(db.selectFrom).toHaveBeenCalledWith('payments')
    })
  })

  describe('fetchPaymentStatsByMethod', () => {
    it('should fetch payment statistics by payment method', async () => {
      // Override selectFrom for this specific test
      mock.module('@stacksjs/database', () => ({
        db: {
          selectFrom: mock(() => ({
            select: mock(() => ({
              where: mock(() => ({
                where: mock(() => ({
                  where: mock(() => ({
                    groupBy: mock(() => ({
                      execute: mock(() => Promise.resolve([
                        { method: 'credit_card', count: 10, revenue: 1000 },
                        { method: 'paypal', count: 5, revenue: 500 },
                      ])),
                    })),
                  })),
                })),
              })),
            })),
          })),
        },
      }))

      const methodStats = await fetchPaymentStatsByMethod()

      expect(methodStats).toBeDefined()
      expect(methodStats.credit_card).toBeDefined()
      expect(methodStats.credit_card.count).toBe(10)
      expect(methodStats.credit_card.revenue).toBe(1000)
      expect(methodStats.paypal).toBeDefined()
      expect(methodStats.paypal.count).toBe(5)
      expect(methodStats.paypal.revenue).toBe(500)

      // Verify db was called correctly
      expect(db.selectFrom).toHaveBeenCalledWith('payments')
    })
  })

  describe('fetchMonthlyPaymentTrends', () => {
    it('should fetch monthly payment trends for the last 12 months', async () => {
      const trends = await fetchMonthlyPaymentTrends()

      expect(trends).toBeDefined()
      expect(trends.length).toBe(2)
      expect(trends[0].month).toBe('Jan')
      expect(trends[0].year).toBe(2023)
      expect(trends[0].transactions).toBe(10)
      expect(trends[0].revenue).toBe(1000)
      expect(trends[0].average).toBe(100)
      expect(trends[1].month).toBe('Feb')

      // Verify db was called correctly
      expect(db.selectFrom).toHaveBeenCalledWith('payments')
    })
  })

  describe('store', () => {
    it('should create a new payment', async () => {
      const requestData = {
        order_id: 1,
        user_id: 1,
        amount: 100,
        method: 'credit_card',
        status: 'PENDING',
        currency: 'USD',
        reference_number: 'REF123',
        card_last_four: '4242',
        card_brand: 'Visa',
        billing_email: 'test@example.com',
        transaction_id: 'TRX123',
        payment_provider: 'stripe',
      }

      const request = new MockRequest(requestData)
      const payment = await store(request as any)

      expect(payment).toBeDefined()
      expect(payment?.id).toBe(1)
      expect(payment?.order_id).toBe(1)
      expect(payment?.amount).toBe(100)
      expect(payment?.method).toBe('credit_card')

      // Verify db was called correctly
      expect(db.insertInto).toHaveBeenCalledWith('payments')
      expect(db.insertInto('payments').values).toHaveBeenCalledTimes(1)
    })

    it('should throw an error if transaction ID already exists', async () => {
      // Mock the database to throw a duplicate entry error
      mock.module('@stacksjs/database', () => ({
        db: {
          insertInto: mock(() => ({
            values: mock(() => ({
              executeTakeFirst: mock(() => {
                throw new Error('Duplicate entry for key transaction_id')
              }),
            })),
          })),
        },
      }))

      const requestData = {
        order_id: 1,
        user_id: 1,
        amount: 100,
        method: 'credit_card',
        transaction_id: 'DUPLICATE_TRX',
      }

      const request = new MockRequest(requestData)

      await expect(store(request as any)).rejects.toThrow('A payment with this transaction ID already exists')
    })

    it('should throw an error for insufficient funds', async () => {
      // Mock the database to throw an insufficient funds error
      mock.module('@stacksjs/database', () => ({
        db: {
          insertInto: mock(() => ({
            values: mock(() => ({
              executeTakeFirst: mock(() => {
                throw new Error('Insufficient funds')
              }),
            })),
          })),
        },
      }))

      const requestData = {
        order_id: 1,
        user_id: 1,
        amount: 10000,
        method: 'credit_card',
      }

      const request = new MockRequest(requestData)

      await expect(store(request as any)).rejects.toThrow('Insufficient funds for this payment')
    })
  })

  describe('destroy', () => {
    it('should delete a payment by ID', async () => {
      const result = await destroy(1)

      expect(result).toBe(true)

      // Verify db was called correctly
      expect(db.deleteFrom).toHaveBeenCalledWith('payments')
      expect(db.deleteFrom('payments').where).toHaveBeenCalledWith('id', '=', 1)
    })

    it('should return false if no payment was deleted', async () => {
      // Mock the database to return 0 deleted rows
      mock.module('@stacksjs/database', () => ({
        db: {
          deleteFrom: mock(() => ({
            where: mock(() => ({
              executeTakeFirst: mock(() => Promise.resolve({ numDeletedRows: 0 })),
            })),
          })),
        },
      }))

      const result = await destroy(999)

      expect(result).toBe(false)

      // Verify db was called correctly
      expect(db.deleteFrom).toHaveBeenCalledWith('payments')
      expect(db.deleteFrom('payments').where).toHaveBeenCalledWith('id', '=', 999)
    })

    it('should throw an error if delete operation fails', async () => {
      // Mock the database to throw an error
      mock.module('@stacksjs/database', () => ({
        db: {
          deleteFrom: mock(() => ({
            where: mock(() => ({
              executeTakeFirst: mock(() => {
                throw new Error('Database error')
              }),
            })),
          })),
        },
      }))

      await expect(destroy(1)).rejects.toThrow('Failed to delete order: Database error')
    })
  })

  describe('bulkDestroy', () => {
    it('should delete multiple payments by ID', async () => {
      const result = await bulkDestroy([1, 2, 3])

      expect(result).toBe(1) // The mock returns 1 deleted row

      // Verify db was called correctly
      expect(db.deleteFrom).toHaveBeenCalledWith('payments')
      expect(db.deleteFrom('payments').where).toHaveBeenCalledWith('id', 'in', [1, 2, 3])
    })

    it('should return 0 if no IDs are provided', async () => {
      const result = await bulkDestroy([])

      expect(result).toBe(0)

      // Verify db was not called
      expect(db.deleteFrom).not.toHaveBeenCalled()
    })

    it('should throw an error if bulk delete operation fails', async () => {
      // Mock the database to throw an error
      mock.module('@stacksjs/database', () => ({
        db: {
          deleteFrom: mock(() => ({
            where: mock(() => ({
              executeTakeFirst: mock(() => {
                throw new Error('Database error')
              }),
            })),
          })),
        },
      }))

      await expect(bulkDestroy([1, 2, 3])).rejects.toThrow('Failed to delete payments: Database error')
    })
  })
})
