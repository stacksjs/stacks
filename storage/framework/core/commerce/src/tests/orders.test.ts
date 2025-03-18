import { beforeEach, describe, expect, it, mock } from 'bun:test'
import { db } from '@stacksjs/database'
import { exportOrders, downloadOrders, storeOrdersExport } from '../orders/export'
import { 
  fetchAll, 
  fetchById, 
  fetchStats, 
  compareOrdersByPeriod, 
  calculateOrderMetrics, 
  fetchDailyOrderTrends 
} from '../orders/fetch'
import { destroy, softDelete, bulkDestroy, bulkSoftDelete } from '../orders/destroy'
import { update, updateStatus, updateDeliveryInfo } from '../orders/update'
import type { OrderWithTotals } from '../types'

// Mock the database
mock.module('@stacksjs/database', () => ({
  db: {
    selectFrom: mock(() => ({
      selectAll: mock(() => ({
        execute: mock(() => Promise.resolve([
          {
            id: 1,
            customer_id: 1,
            status: 'completed',
            total_amount: 100,
            tax_amount: 10,
            discount_amount: 5,
            order_type: 'delivery',
            created_at: new Date('2023-01-01'),
            updated_at: new Date('2023-01-01'),
          },
          {
            id: 2,
            customer_id: 2,
            status: 'pending',
            total_amount: 200,
            tax_amount: 20,
            discount_amount: 0,
            order_type: 'pickup',
            created_at: new Date('2023-01-02'),
            updated_at: new Date('2023-01-02'),
          },
        ])),
        executeTakeFirst: mock(() => Promise.resolve({
          id: 1,
          customer_id: 1,
          status: 'completed',
          total_amount: 100,
          tax_amount: 10,
          discount_amount: 5,
          order_type: 'delivery',
          created_at: new Date('2023-01-01'),
          updated_at: new Date('2023-01-01'),
        })),
      })),
      leftJoin: mock(() => ({
        selectAll: mock(() => ({
          select: mock(() => ({
            execute: mock(() => Promise.resolve([
              {
                id: 1,
                customer_id: 1,
                status: 'completed',
                total_amount: 100,
                customer_name: 'John Doe',
                customer_email: 'john@example.com',
                created_at: new Date('2023-01-01'),
              },
              {
                id: 2,
                customer_id: 2,
                status: 'pending',
                total_amount: 200,
                customer_name: 'Jane Smith',
                customer_email: 'jane@example.com',
                created_at: new Date('2023-01-02'),
              },
            ])),
          })),
        })),
      })),
      where: mock(() => ({
        where: mock(() => ({
          where: mock(() => ({
            execute: mock(() => Promise.resolve([
              { status: 'completed', count: 10 },
              { status: 'pending', count: 5 },
            ])),
            executeTakeFirst: mock(() => Promise.resolve({
              count: 15,
              total: 1500,
            })),
          })),
        })),
        selectAll: mock(() => ({
          executeTakeFirst: mock(() => Promise.resolve({
            id: 1,
            customer_id: 1,
            status: 'completed',
            total_amount: 100,
          })),
        })),
        'in': mock(() => ({
          select: mock(() => ({
            execute: mock(() => Promise.resolve([
              { 
                order_id: 1, 
                quantity: 2, 
                price: 50,
              },
              { 
                order_id: 2, 
                quantity: 1, 
                price: 200,
              },
            ])),
          })),
        })),
        groupBy: mock(() => ({
          execute: mock(() => Promise.resolve([
            { status: 'completed', count: 10 },
            { status: 'pending', count: 5 },
          ])),
        })),
        orderBy: mock(() => ({
          limit: mock(() => ({
            execute: mock(() => Promise.resolve([
              {
                id: 1,
                customer_id: 1,
                status: 'completed',
                total_amount: 100,
              },
              {
                id: 2,
                customer_id: 2,
                status: 'pending',
                total_amount: 200,
              },
            ])),
          })),
        })),
      })),
      select: mock(() => ({
        where: mock(() => ({
          where: mock(() => ({
            executeTakeFirst: mock(() => Promise.resolve({
              count: 15,
              total: 1500,
            })),
            groupBy: mock(() => ({
              execute: mock(() => Promise.resolve([
                { created_at: new Date('2023-01-01'), order_count: 5, revenue: 500 },
                { created_at: new Date('2023-01-02'), order_count: 10, revenue: 1000 },
              ])),
              orderBy: mock(() => ({
                execute: mock(() => Promise.resolve([
                  { created_at: new Date('2023-01-01'), order_count: 5, revenue: 500 },
                  { created_at: new Date('2023-01-02'), order_count: 10, revenue: 1000 },
                ])),
              })),
            })),
          })),
        })),
      })),
    })),
    updateTable: mock(() => ({
      set: mock(() => ({
        where: mock(() => ({
          execute: mock(() => Promise.resolve({ numUpdatedRows: 1 })),
          executeTakeFirst: mock(() => Promise.resolve({ numUpdatedRows: 1 })),
        })),
      })),
    })),
    deleteFrom: mock(() => ({
      where: mock(() => ({
        executeTakeFirst: mock(() => Promise.resolve({ numDeletedRows: 1 })),
        'in': mock(() => ({
          executeTakeFirst: mock(() => Promise.resolve({ numDeletedRows: 3 })),
        })),
      })),
    })),
    fn: {
      count: (column: string) => `COUNT(${column})`,
      sum: (column: string) => `SUM(${column})`,
    },
  },
}))

// Mock the ts-spreadsheets module
mock.module('ts-spreadsheets', () => ({
  createSpreadsheet: mock(() => ({
    download: mock((filename: string) => Promise.resolve(new Response())),
    store: mock((path: string) => Promise.resolve()),
  })),
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

  get<T = any>(key: string, defaultValue?: T): T {
    return this.data[key] !== undefined ? this.data[key] as T : (defaultValue as T)
  }
}

// Mock SpreadsheetWrapper type
interface MockSpreadsheetWrapper {
  download: (filename: string) => Promise<Response>
  store: (path: string) => Promise<void>
}

describe('Orders Module', () => {
  beforeEach(() => {
    // Reset mocks before each test
    mock.restore()
  })

  describe('fetch functions', () => {
    describe('fetchAll', () => {
      it('should fetch all orders with their items', async () => {
        const orders = await fetchAll()
  
        expect(orders).toBeDefined()
        expect(orders.length).toBe(2)
        expect(orders[0].id).toBe(1)
        expect(orders[1].id).toBe(2)
  
        // Verify db was called correctly
        expect(db.selectFrom).toHaveBeenCalledWith('orders')
      })
    })
  
    describe('fetchById', () => {
      it('should fetch an order by ID', async () => {
        const order = await fetchById(1)
  
        expect(order).toBeDefined()
        expect(order?.id).toBe(1)
        expect(order?.status).toBe('completed')
  
        // Verify db was called correctly
        expect(db.selectFrom).toHaveBeenCalledWith('orders')
        expect(db.selectFrom('orders').where).toHaveBeenCalledWith('id', '=', 1)
      })
  
      it('should return undefined if order not found', async () => {
        // Override mock for this test to return null
        mock.module('@stacksjs/database', () => ({
          db: {
            selectFrom: mock(() => ({
              where: mock(() => ({
                selectAll: mock(() => ({
                  executeTakeFirst: mock(() => Promise.resolve(null)),
                })),
              })),
            })),
          },
        }))
  
        const order = await fetchById(999)
        expect(order).toBeUndefined()
      })
    })
  
    describe('fetchStats', () => {
      it('should fetch order statistics', async () => {
        const stats = await fetchStats()
  
        expect(stats).toBeDefined()
        expect(stats.total).toBe(15)
        expect(stats.by_status).toHaveLength(2)
        expect(stats.by_status[0].status).toBe('completed')
        expect(stats.by_status[0].count).toBe(10)
        expect(stats.recent).toHaveLength(2)
        expect(stats.revenue).toBe(1500)
  
        // Verify db was called correctly
        expect(db.selectFrom).toHaveBeenCalledWith('orders')
      })
    })
  
    describe('compareOrdersByPeriod', () => {
      it('should compare orders between different time periods', async () => {
        const comparison = await compareOrdersByPeriod(30)
  
        expect(comparison).toBeDefined()
        expect(comparison.current_period).toBe(15)
        expect(comparison.previous_period).toBe(15)
        expect(comparison.difference).toBe(0)
        expect(comparison.percentage_change).toBe(0)
        expect(comparison.days_range).toBe(30)
  
        // Verify db was called correctly
        expect(db.selectFrom).toHaveBeenCalledWith('orders')
      })
  
      it('should handle case when previous period has zero orders', async () => {
        // Override mock for this test
        mock.module('@stacksjs/database', () => ({
          db: {
            selectFrom: mock(() => ({
              select: mock(() => ({
                where: mock(() => ({
                  where: mock(() => ({
                    executeTakeFirst: mock((path: string) => {
                      // Return 0 for previous period
                      if (path.includes('previous')) return Promise.resolve({ count: 0 })
                      return Promise.resolve({ count: 15 })
                    }),
                  })),
                })),
              })),
            })),
            fn: {
              count: (column: string) => `COUNT(${column})`,
            },
          },
        }))
  
        const comparison = await compareOrdersByPeriod(30)
        expect(comparison.previous_period).toBe(0)
        expect(comparison.percentage_change).toBe(100)
      })
    })
  
    describe('calculateOrderMetrics', () => {
      it('should calculate order metrics for different time periods', async () => {
        const metrics = await calculateOrderMetrics(30)
  
        expect(metrics).toBeDefined()
        expect(metrics.current_period).toBeDefined()
        expect(metrics.current_period.total_orders).toBe(15)
        expect(metrics.current_period.total_revenue).toBe(1500)
        expect(metrics.current_period.orders_by_status).toHaveLength(2)
        expect(metrics.previous_period).toBeDefined()
        expect(metrics.comparison).toBeDefined()
        expect(metrics.days_range).toBe(30)
  
        // Verify db was called correctly
        expect(db.selectFrom).toHaveBeenCalledWith('orders')
      })
    })
  
    describe('fetchDailyOrderTrends', () => {
      it('should fetch daily order trends', async () => {
        const trends = await fetchDailyOrderTrends(30)
  
        expect(trends).toBeDefined()
        expect(trends.length).toBe(2)
        expect(trends[0].date).toBeInstanceOf(Date)
        expect(trends[0].order_count).toBe(5)
        expect(trends[0].revenue).toBe(500)
  
        // Verify db was called correctly
        expect(db.selectFrom).toHaveBeenCalledWith('orders')
      })
    })
  })
  
  describe('update functions', () => {
    describe('update', () => {
      it('should update an order with provided data', async () => {
        const requestData = {
          customer_id: 2,
          status: 'SHIPPED',
          total_amount: 150,
          tax_amount: 15,
          discount_amount: 10,
          order_type: 'pickup',
        }
        
        const request = new MockRequest(requestData)
        const updatedOrder = await update(1, request as any)
        
        expect(updatedOrder).toBeDefined()
        expect(updatedOrder?.id).toBe(1)
        
        // Verify db was called correctly
        expect(db.updateTable).toHaveBeenCalledWith('orders')
        expect(db.updateTable('orders').set).toHaveBeenCalledTimes(1)
        expect(db.selectFrom).toHaveBeenCalledWith('orders')
      })
      
      it('should not update if no fields provided', async () => {
        const request = new MockRequest({})
        const order = await update(1, request as any)
        
        expect(order).toBeDefined()
        expect(order?.id).toBe(1)
        
        // Verify update was not called
        expect(db.updateTable).not.toHaveBeenCalled()
        expect(db.selectFrom).toHaveBeenCalledWith('orders')
      })
      
      it('should throw an error if order not found', async () => {
        // Override mock for this test to return null on fetch
        mock.module('@stacksjs/database', () => ({
          db: {
            selectFrom: mock(() => ({
              where: mock(() => ({
                selectAll: mock(() => ({
                  executeTakeFirst: mock(() => Promise.resolve(null)),
                })),
              })),
            })),
          },
        }))
        
        const requestData = { status: 'SHIPPED' }
        const request = new MockRequest(requestData)
        
        await expect(update(999, request as any)).rejects.toThrow('Order with ID 999 not found')
      })
    })
    
    describe('updateStatus', () => {
      it('should update order status', async () => {
        const updatedOrder = await updateStatus(1, 'SHIPPED')
        
        expect(updatedOrder).toBeDefined()
        expect(updatedOrder?.id).toBe(1)
        
        // Verify db was called correctly
        expect(db.updateTable).toHaveBeenCalledWith('orders')
        expect(db.updateTable('orders').set).toHaveBeenCalledTimes(1)
        expect(db.selectFrom).toHaveBeenCalledWith('orders')
      })
      
      it('should throw an error if order not found', async () => {
        // Override mock for this test to return null
        mock.module('@stacksjs/database', () => ({
          db: {
            selectFrom: mock(() => ({
              where: mock(() => ({
                selectAll: mock(() => ({
                  executeTakeFirst: mock(() => Promise.resolve(null)),
                })),
              })),
            })),
          },
        }))
        
        await expect(updateStatus(999, 'SHIPPED')).rejects.toThrow('Order with ID 999 not found')
      })
    })
    
    describe('updateDeliveryInfo', () => {
      it('should update delivery information', async () => {
        const updatedOrder = await updateDeliveryInfo(1, '123 Main St', '2023-12-31 15:00')
        
        expect(updatedOrder).toBeDefined()
        expect(updatedOrder?.id).toBe(1)
        
        // Verify db was called correctly
        expect(db.updateTable).toHaveBeenCalledWith('orders')
        expect(db.updateTable('orders').set).toHaveBeenCalledTimes(1)
        expect(db.selectFrom).toHaveBeenCalledWith('orders')
      })
      
      it('should not update if no delivery fields provided', async () => {
        const order = await updateDeliveryInfo(1)
        
        expect(order).toBeDefined()
        expect(order?.id).toBe(1)
        
        // Verify update was not called
        expect(db.updateTable).not.toHaveBeenCalled()
        expect(db.selectFrom).toHaveBeenCalledWith('orders')
      })
      
      it('should throw an error if order not found', async () => {
        // Override mock for this test to return null
        mock.module('@stacksjs/database', () => ({
          db: {
            selectFrom: mock(() => ({
              where: mock(() => ({
                selectAll: mock(() => ({
                  executeTakeFirst: mock(() => Promise.resolve(null)),
                })),
              })),
            })),
          },
        }))
        
        await expect(updateDeliveryInfo(999, '123 Main St')).rejects.toThrow('Order with ID 999 not found')
      })
    })
  })
  
  describe('destroy functions', () => {
    describe('destroy', () => {
      it('should delete an order by ID', async () => {
        const result = await destroy(1)
        
        expect(result).toBe(true)
        
        // Verify db was called correctly
        expect(db.deleteFrom).toHaveBeenCalledWith('orders')
        expect(db.deleteFrom('orders').where).toHaveBeenCalledWith('id', '=', 1)
      })
      
      it('should return false if no order was deleted', async () => {
        // Override mock for this test to return 0 deleted rows
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
      })
      
      it('should throw a TypeError if the database operation fails', async () => {
        // Override mock for this test to throw an error
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
    
    describe('softDelete', () => {
      it('should soft delete an order by ID', async () => {
        const result = await softDelete(1)
        
        expect(result).toBe(true)
        
        // Verify db was called correctly
        expect(db.updateTable).toHaveBeenCalledWith('orders')
        expect(db.updateTable('orders').set).toHaveBeenCalledWith({ status: 'CANCELED' })
      })
      
      it('should return false if no order was soft deleted', async () => {
        // Override mock for this test to return 0 updated rows
        mock.module('@stacksjs/database', () => ({
          db: {
            updateTable: mock(() => ({
              set: mock(() => ({
                where: mock(() => ({
                  executeTakeFirst: mock(() => Promise.resolve({ numUpdatedRows: 0 })),
                })),
              })),
            })),
          },
        }))
        
        const result = await softDelete(999)
        expect(result).toBe(false)
      })
    })
    
    describe('bulkDestroy', () => {
      it('should delete multiple orders by ID', async () => {
        const result = await bulkDestroy([1, 2, 3])
        
        expect(result).toBe(3)
        
        // Verify db was called correctly
        expect(db.deleteFrom).toHaveBeenCalledWith('orders')
        expect(db.deleteFrom('orders').where).toHaveBeenCalledWith('id', 'in', [1, 2, 3])
      })
      
      it('should return 0 if no IDs were provided', async () => {
        const result = await bulkDestroy([])
        expect(result).toBe(0)
        
        // Verify db was not called
        expect(db.deleteFrom).not.toHaveBeenCalled()
      })
    })
    
    describe('bulkSoftDelete', () => {
      it('should soft delete multiple orders by ID', async () => {
        const result = await bulkSoftDelete([1, 2, 3])
        
        expect(result).toBe(3)
        
        // Verify db was called correctly
        expect(db.updateTable).toHaveBeenCalledWith('orders')
        expect(db.updateTable('orders').set).toHaveBeenCalledWith({ status: 'CANCELED' })
      })
      
      it('should return 0 if no IDs were provided', async () => {
        const result = await bulkSoftDelete([])
        expect(result).toBe(0)
        
        // Verify db was not called
        expect(db.updateTable).not.toHaveBeenCalled()
      })
    })
  })

  describe('export functions', () => {
    describe('exportOrders', () => {
      it('should export orders to CSV by default', async () => {
        const { createSpreadsheet } = await import('ts-spreadsheets')
  
        const spreadsheet = await exportOrders()
  
        expect(spreadsheet).toBeDefined()
        expect(createSpreadsheet).toHaveBeenCalled()
  
        const mockFn = createSpreadsheet as unknown as { mock: { calls: any[][] } }
        const args = mockFn.mock.calls[0]
        expect(args[1]).toEqual({ type: 'csv' })
      })
  
      it('should export orders to Excel when specified', async () => {
        const { createSpreadsheet } = await import('ts-spreadsheets')
  
        const spreadsheet = await exportOrders('excel')
  
        expect(spreadsheet).toBeDefined()
        expect(createSpreadsheet).toHaveBeenCalled()
  
        const mockFn = createSpreadsheet as unknown as { mock: { calls: any[][] } }
        const args = mockFn.mock.calls[0]
        expect(args[1]).toEqual({ type: 'excel' })
      })
  
      it('should fetch and prepare order data correctly', async () => {
        // Mock the internal functions to verify they're called correctly
        const mockFetchAllWithDetails = mock(() => Promise.resolve([
          {
            id: 1,
            customer_id: 1,
            coupon_id: 0,
            status: 'completed',
            total_amount: 100,
            tax_amount: 10,
            order_type: 'delivery',
            created_at: '2023-01-01',
            totalItems: 2,
            totalPrice: 100,
            order_items: [
              { product: { name: 'Product 1' }, quantity: 2, price: 50 },
            ],
            customer: { name: 'John Doe' },
          } as unknown as OrderWithTotals,
        ]))
  
        // Replace the actual function with our mock for this test
        const originalExport = await import('../orders/export')
        const originalFetchAllWithDetails = (originalExport as any).fetchAllWithDetails
        ;(originalExport as any).fetchAllWithDetails = mockFetchAllWithDetails
  
        await exportOrders()
  
        expect(mockFetchAllWithDetails).toHaveBeenCalled()
  
        // Restore the original function
        ;(originalExport as any).fetchAllWithDetails = originalFetchAllWithDetails
      })
    })
  
    describe('downloadOrders', () => {
      it('should download orders with default filename', async () => {
        const response = await downloadOrders()
  
        expect(response).toBeDefined()
        expect(response).toBeInstanceOf(Response)
  
        // Verify the spreadsheet download was called
        const { createSpreadsheet } = await import('ts-spreadsheets')
        expect(createSpreadsheet).toHaveBeenCalled()
        
        const mockFn = createSpreadsheet as unknown as { mock: { results: { value: any }[] } }
        const spreadsheet = mockFn.mock.results[0].value
        expect(spreadsheet.download).toHaveBeenCalled()
        
        // Check that the filename contains the current date
        const mockDownload = spreadsheet.download as unknown as { mock: { calls: string[][] } }
        const downloadCall = mockDownload.mock.calls[0][0]
        expect(downloadCall).toContain('orders_export_')
        expect(downloadCall).toContain('.csv')
      })
  
      it('should download orders with custom filename and format', async () => {
        const response = await downloadOrders('excel', 'custom_export.xlsx')
  
        expect(response).toBeDefined()
        expect(response).toBeInstanceOf(Response)
  
        // Verify the spreadsheet download was called
        const { createSpreadsheet } = await import('ts-spreadsheets')
        expect(createSpreadsheet).toHaveBeenCalled()
        
        const mockFn = createSpreadsheet as unknown as { mock: { results: { value: any }[] } }
        const spreadsheet = mockFn.mock.results[0].value
        expect(spreadsheet.download).toHaveBeenCalled()
        
        // Check that the custom filename was used
        const mockDownload = spreadsheet.download as unknown as { mock: { calls: string[][] } }
        const downloadCall = mockDownload.mock.calls[0][0]
        expect(downloadCall).toBe('custom_export.xlsx')
      })
    })
  
    describe('storeOrdersExport', () => {
      it('should store orders export with default path', async () => {
        await storeOrdersExport()
  
        // Verify the spreadsheet store was called
        const { createSpreadsheet } = await import('ts-spreadsheets')
        expect(createSpreadsheet).toHaveBeenCalled()
        
        const mockFn = createSpreadsheet as unknown as { mock: { results: { value: any }[] } }
        const spreadsheet = mockFn.mock.results[0].value
        expect(spreadsheet.store).toHaveBeenCalled()
        
        // Check that the path contains the current date
        const mockStore = spreadsheet.store as unknown as { mock: { calls: string[][] } }
        const storeCall = mockStore.mock.calls[0][0]
        expect(storeCall).toContain('orders_export_')
        expect(storeCall).toContain('.csv')
      })
  
      it('should store orders export with custom path and format', async () => {
        await storeOrdersExport('excel', '/custom/path/export.xlsx')
  
        // Verify the spreadsheet store was called
        const { createSpreadsheet } = await import('ts-spreadsheets')
        expect(createSpreadsheet).toHaveBeenCalled()
        
        const mockFn = createSpreadsheet as unknown as { mock: { results: { value: any }[] } }
        const spreadsheet = mockFn.mock.results[0].value
        expect(spreadsheet.store).toHaveBeenCalled()
        
        // Check that the custom path was used
        const mockStore = spreadsheet.store as unknown as { mock: { calls: string[][] } }
        const storeCall = mockStore.mock.calls[0][0]
        expect(storeCall).toBe('/custom/path/export.xlsx')
      })
    })
  })
})
