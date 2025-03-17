import { beforeEach, describe, expect, it, mock } from 'bun:test'
import { db } from '@stacksjs/database'
import { fetchById } from '../customers/fetch'
import { store } from '../customers/store'
import { update } from '../customers/update'

// Mock the database
mock.module('@stacksjs/database', () => ({
  db: {
    selectFrom: mock(() => ({
      where: mock(() => ({
        selectAll: mock(() => ({
          executeTakeFirst: mock(() => Promise.resolve({
            id: 1,
            name: 'Test Customer',
            email: 'test@example.com',
            phone: '123-456-7890',
            status: 'Active',
            avatar: 'https://example.com/avatar.jpg',
            user_id: 1,
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

describe('Customer Module', () => {
  beforeEach(() => {
    // Reset mocks before each test
    mock.restore()
  })

  describe('fetchById', () => {
    it('should fetch a customer by ID', async () => {
      const customer = await fetchById(1)

      expect(customer).toBeDefined()
      expect(customer?.id).toBe(1)
      expect(customer?.name).toBe('Test Customer')
      expect(customer?.email).toBe('test@example.com')

      // Verify db was called correctly
      expect(db.selectFrom).toHaveBeenCalledWith('customers')
      expect(db.selectFrom('customers').where).toHaveBeenCalledWith('id', '=', 1)
    })
  })

  describe('store', () => {
    it('should create a new customer', async () => {
      const requestData = {
        name: 'New Customer',
        email: 'new@example.com',
        phone: '987-654-3210',
        status: 'Active',
        user_id: 2,
      }

      const request = new MockRequest(requestData)
      const customer = await store(request as any)

      expect(customer).toBeDefined()
      expect(customer?.id).toBe(1)
      expect(customer?.name).toBe('Test Customer')

      // Verify db was called correctly
      expect(db.insertInto).toHaveBeenCalledWith('customers')
      expect(db.insertInto('customers').values).toHaveBeenCalledTimes(1)
    })

    it('should throw an error if email already exists', async () => {
      // Mock the database to throw a duplicate entry error
      mock.module('@stacksjs/database', () => ({
        db: {
          insertInto: mock(() => ({
            values: mock(() => ({
              executeTakeFirst: mock(() => {
                throw new Error('Duplicate entry for key email')
              }),
            })),
          })),
        },
      }))

      const requestData = {
        name: 'Duplicate Customer',
        email: 'duplicate@example.com',
        phone: '555-555-5555',
      }

      const request = new MockRequest(requestData)

      await expect(store(request as any)).rejects.toThrow('A customer with this email already exists')
    })
  })

  describe('update', () => {
    it('should update an existing customer', async () => {
      const requestData = {
        name: 'Updated Customer',
        email: 'updated@example.com',
        phone: '111-222-3333',
      }

      const request = new MockRequest(requestData)
      const customer = await update(1, request as any)

      expect(customer).toBeDefined()
      expect(customer?.id).toBe(1)

      // Verify db was called correctly
      expect(db.updateTable).toHaveBeenCalledWith('customers')
      expect(db.updateTable('customers').set).toHaveBeenCalledTimes(1)
      expect(db.selectFrom).toHaveBeenCalledWith('customers')
    })

    it('should return the customer without updating if no data provided', async () => {
      const request = new MockRequest({})
      const customer = await update(1, request as any)

      expect(customer).toBeDefined()
      expect(customer?.id).toBe(1)

      // Verify db was not called to update
      expect(db.updateTable).not.toHaveBeenCalled()
      expect(db.selectFrom).toHaveBeenCalledWith('customers')
    })
  })
})
