import { beforeEach, describe, expect, it, mock } from 'bun:test'
import { db } from '@stacksjs/database'
import { deactivate, remove } from '../gift-cards/destroy'
import { checkBalance, fetchByCode, fetchById } from '../gift-cards/fetch'
import { store } from '../gift-cards/store'
import { update, updateBalance } from '../gift-cards/update'

// Mock the database
mock.module('@stacksjs/database', () => ({
  db: {
    selectFrom: mock(() => ({
      where: mock(() => ({
        selectAll: mock(() => ({
          executeTakeFirst: mock(() => Promise.resolve({
            id: 1,
            code: 'GIFT123',
            initial_balance: 100,
            current_balance: 75,
            currency: 'USD',
            status: 'ACTIVE',
            is_active: true,
            is_digital: true,
            is_reloadable: false,
            recipient_email: 'recipient@example.com',
            recipient_name: 'Gift Recipient',
            expiry_date: '2025-12-31',
            created_at: new Date(),
            updated_at: new Date(),
          })),
        })),
      })),
    })),
    insertInto: mock(() => ({
      values: mock(() => ({
        executeTakeFirst: mock(() => Promise.resolve({ insertId: 1 })),
      })),
    })),
    updateTable: mock(() => ({
      set: mock(() => ({
        where: mock(() => ({
          execute: mock(() => Promise.resolve()),
        })),
      })),
    })),
    deleteFrom: mock(() => ({
      where: mock(() => ({
        executeTakeFirst: mock(() => Promise.resolve({ numDeletedRows: 1 })),
      })),
    })),
  },
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

  get(key: string) {
    return this.data[key]
  }
}

describe('Gift Card Module', () => {
  beforeEach(() => {
    // Reset mocks before each test
    mock.restore()
  })

  describe('fetchById', () => {
    it('should fetch a gift card by ID', async () => {
      const giftCard = await fetchById(1)

      expect(giftCard).toBeDefined()
      expect(giftCard?.id).toBe(1)
      expect(giftCard?.code).toBe('GIFT123')
      expect(giftCard?.initial_balance).toBe(100)

      // Verify db was called correctly
      expect(db.selectFrom).toHaveBeenCalledWith('gift_cards')
      expect(db.selectFrom('gift_cards').where).toHaveBeenCalledWith('id', '=', 1)
    })
  })

  describe('fetchByCode', () => {
    it('should fetch a gift card by code', async () => {
      const giftCard = await fetchByCode('GIFT123')

      expect(giftCard).toBeDefined()
      expect(giftCard?.code).toBe('GIFT123')

      // Verify db was called correctly
      expect(db.selectFrom).toHaveBeenCalledWith('gift_cards')
      expect(db.selectFrom('gift_cards').where).toHaveBeenCalledWith('code', '=', 'GIFT123')
    })
  })

  describe('store', () => {
    it('should create a new gift card', async () => {
      const requestData = {
        code: 'NEWGIFT456',
        initial_balance: 200,
        currency: 'USD',
        status: 'ACTIVE',
        is_active: true,
        is_digital: true,
        recipient_email: 'new@example.com',
        recipient_name: 'New Recipient',
      }

      const request = new MockRequest(requestData)
      const giftCard = await store(request as any)

      expect(giftCard).toBeDefined()
      expect(giftCard?.id).toBe(1)
      expect(giftCard?.code).toBe('GIFT123') // From the mock response

      // Verify db was called correctly
      expect(db.insertInto).toHaveBeenCalledWith('gift_cards')
      expect(db.insertInto('gift_cards').values).toHaveBeenCalledTimes(1)
    })

    it('should throw an error if code already exists', async () => {
      // Mock the database to throw a duplicate entry error
      mock.module('@stacksjs/database', () => ({
        db: {
          insertInto: mock(() => ({
            values: mock(() => ({
              executeTakeFirst: mock(() => {
                throw new Error('Duplicate entry for key code')
              }),
            })),
          })),
        },
      }))

      const requestData = {
        code: 'DUPLICATE',
        initial_balance: 50,
        currency: 'USD',
      }

      const request = new MockRequest(requestData)

      await expect(store(request as any)).rejects.toThrow('A gift card with this code already exists')
    })
  })

  describe('update', () => {
    it('should update an existing gift card', async () => {
      const requestData = {
        code: 'UPDATED456',
        current_balance: 80,
        status: 'ACTIVE',
      }

      const request = new MockRequest(requestData)
      const giftCard = await update(1, request as any)

      expect(giftCard).toBeDefined()
      expect(giftCard?.id).toBe(1)

      // Verify db was called correctly
      expect(db.updateTable).toHaveBeenCalledWith('gift_cards')
      expect(db.updateTable('gift_cards').set).toHaveBeenCalledTimes(1)
      expect(db.selectFrom).toHaveBeenCalledWith('gift_cards')
    })

    it('should return the gift card without updating if no data provided', async () => {
      const request = new MockRequest({})
      const giftCard = await update(1, request as any)

      expect(giftCard).toBeDefined()
      expect(giftCard?.id).toBe(1)

      // Verify db was not called to update
      expect(db.updateTable).not.toHaveBeenCalled()
    })
  })

  describe('updateBalance', () => {
    it('should update a gift card balance', async () => {
      const giftCard = await updateBalance(1, -25)

      expect(giftCard).toBeDefined()
      expect(giftCard?.id).toBe(1)

      // Verify db was called correctly
      expect(db.updateTable).toHaveBeenCalledWith('gift_cards')
      expect(db.updateTable('gift_cards').set).toHaveBeenCalledTimes(1)
      expect(db.selectFrom).toHaveBeenCalledWith('gift_cards')
    })

    it('should throw an error if balance would go below zero', async () => {
      // Mock the database to return a gift card with low balance
      mock.module('@stacksjs/database', () => ({
        db: {
          selectFrom: mock(() => ({
            where: mock(() => ({
              selectAll: mock(() => ({
                executeTakeFirst: mock(() => Promise.resolve({
                  id: 1,
                  code: 'LOWBALANCE',
                  initial_balance: 100,
                  current_balance: 10,
                  currency: 'USD',
                  status: 'ACTIVE',
                  is_active: true,
                })),
              })),
            })),
          })),
        },
      }))

      await expect(updateBalance(1, -20)).rejects.toThrow('Insufficient gift card balance')
    })
  })

  describe('remove', () => {
    it('should delete a gift card', async () => {
      const result = await remove(1)

      expect(result).toBe(true)

      // Verify db was called correctly
      expect(db.deleteFrom).toHaveBeenCalledWith('gift_cards')
      expect(db.deleteFrom('gift_cards').where).toHaveBeenCalledWith('id', '=', 1)
    })

    it('should throw an error if gift card not found', async () => {
      // Mock the database to return undefined for the gift card
      mock.module('@stacksjs/database', () => ({
        db: {
          selectFrom: mock(() => ({
            where: mock(() => ({
              selectAll: mock(() => ({
                executeTakeFirst: mock(() => Promise.resolve(undefined)),
              })),
            })),
          })),
        },
      }))

      await expect(remove(999)).rejects.toThrow('Gift card with ID 999 not found')
    })
  })

  describe('deactivate', () => {
    it('should deactivate a gift card', async () => {
      const result = await deactivate(1)

      expect(result).toBe(true)

      // Verify db was called correctly
      expect(db.updateTable).toHaveBeenCalledWith('gift_cards')
      expect(db.updateTable('gift_cards').set).toHaveBeenCalledWith({
        is_active: false,
        status: 'DEACTIVATED',
        updated_at: expect.any(Date),
      })
    })
  })

  describe('checkBalance', () => {
    it('should check a valid gift card balance', async () => {
      const result = await checkBalance('GIFT123')

      expect(result.valid).toBe(true)
      expect(result.balance).toBe(75)
      expect(result.currency).toBe('USD')
    })

    it('should return invalid for non-existent gift card', async () => {
      // Mock the database to return undefined for the gift card
      mock.module('@stacksjs/database', () => ({
        db: {
          selectFrom: mock(() => ({
            where: mock(() => ({
              selectAll: mock(() => ({
                executeTakeFirst: mock(() => Promise.resolve(undefined)),
              })),
            })),
          })),
        },
      }))

      const result = await checkBalance('INVALID')

      expect(result.valid).toBe(false)
      expect(result.message).toBe('Gift card not found')
    })

    it('should return invalid for inactive gift card', async () => {
      // Mock the database to return an inactive gift card
      mock.module('@stacksjs/database', () => ({
        db: {
          selectFrom: mock(() => ({
            where: mock(() => ({
              selectAll: mock(() => ({
                executeTakeFirst: mock(() => Promise.resolve({
                  id: 2,
                  code: 'INACTIVE',
                  initial_balance: 100,
                  current_balance: 100,
                  currency: 'USD',
                  status: 'DEACTIVATED',
                  is_active: false,
                })),
              })),
            })),
          })),
        },
      }))

      const result = await checkBalance('INACTIVE')

      expect(result.valid).toBe(false)
      expect(result.message).toBe('Gift card is deactivated')
    })
  })
})
