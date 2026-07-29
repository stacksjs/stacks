import { Action } from '@stacksjs/actions'
import { config } from '@stacksjs/config'
import { Category, Customer, Product, TaxRate } from '@stacksjs/orm'
import {
  normalizeCommercePosCustomer,
  normalizeCommercePosProduct,
  selectCommercePosTaxRate,
} from './commerce-pos'
import {
  normalizeCommerceProductRecord,
  normalizeProductOption,
} from './commerce-product-records'

export default new Action({
  name: 'CommercePosAction',
  description: 'Returns persisted products, customers, and tax configuration for the native point of sale.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    const [products, categories, customers, taxRates] = await Promise.all([
      Product.orderBy('name', 'asc').limit(500).get(),
      Category.orderBy('name', 'asc').limit(500).get(),
      Customer.orderBy('name', 'asc').limit(500).get(),
      TaxRate.orderBy('id', 'asc').limit(500).get(),
    ])
    const categoryMap = new Map(categories.map(category => [
      String(category.get('id') || ''),
      String(category.get('name') || ''),
    ]))
    const emptyCounts = new Map<string, number>()
    const records = products.map(product => normalizeCommercePosProduct(normalizeCommerceProductRecord(
      product,
      categoryMap,
      new Map(),
      emptyCounts,
      emptyCounts,
      emptyCounts,
    )))
    const sellable = records.filter(record => record.isAvailable && record.inventoryCount > 0)
    const usedCategoryIds = new Set(records.map(record => record.categoryId).filter(Boolean))

    return {
      products: records,
      categories: categories
        .filter(category => usedCategoryIds.has(String(category.get('id') || '')))
        .map(normalizeProductOption),
      customers: customers
        .filter(customer => String(customer.get('status') || '').toLowerCase() === 'active')
        .map(normalizeCommercePosCustomer),
      taxRate: selectCommercePosTaxRate(taxRates),
      defaultCurrency: String((config as any).commerce?.currency || 'USD').toUpperCase(),
      paymentMethods: [{ id: 'cash', label: 'Cash' }],
      summary: {
        products: records.length,
        sellable: sellable.length,
        inventory: records.reduce((sum, record) => sum + record.inventoryCount, 0),
      },
    }
  },
})
