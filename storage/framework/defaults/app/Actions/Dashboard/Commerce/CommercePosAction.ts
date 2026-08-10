import { Action } from '@stacksjs/actions'
import { config } from '@stacksjs/config'
import { Category, Customer, Manufacturer, Product, TaxRate } from '@stacksjs/orm'
import { dashboardOperationalError } from '../dashboard-response'
import {
  isCommercePosCustomerActive,
  normalizeCommercePosCustomer,
  normalizeCommercePosProduct,
  selectCommercePosTaxRate,
} from './commerce-pos'
import {
  normalizeCommerceProductRecord,
  normalizeCommerceCurrency,
  normalizeManufacturerOption,
  normalizeProductOption,
} from './commerce-product-records'

export default new Action({
  name: 'CommercePosAction',
  description: 'Returns persisted products, customers, and tax configuration for the native point of sale.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    try {
      const [products, categories, manufacturers, customers, taxRates] = await Promise.all([
        Product.orderBy('name', 'asc').limit(500).get(),
        Category.orderBy('name', 'asc').limit(500).get(),
        Manufacturer.orderBy('manufacturer', 'asc').limit(500).get(),
        Customer.orderBy('name', 'asc').limit(500).get(),
        TaxRate.orderBy('id', 'asc').limit(500).get(),
      ])
      const categoryOptions = categories.map(normalizeProductOption)
      const manufacturerOptions = manufacturers.map(normalizeManufacturerOption)
      const categoryMap = new Map(categoryOptions.map(option => [option.id, option.label]))
      const manufacturerMap = new Map(manufacturerOptions.map(option => [option.id, option.label]))
      const emptyCounts = new Map<string, number>()
      const records = products.map(product => normalizeCommercePosProduct(normalizeCommerceProductRecord(
        product,
        categoryMap,
        manufacturerMap,
        emptyCounts,
        emptyCounts,
        emptyCounts,
      )))
      const sellable = records.filter(record => record.isAvailable && record.inventoryCount > 0)
      const usedCategoryIds = new Set(records.map(record => record.categoryId).filter(Boolean))

      return {
        products: records,
        categories: categoryOptions.filter(category => usedCategoryIds.has(category.id)),
        customers: customers
          .filter(isCommercePosCustomerActive)
          .map(normalizeCommercePosCustomer),
        taxRate: selectCommercePosTaxRate(taxRates),
        defaultCurrency: normalizeCommerceCurrency((config as any).commerce?.currency),
        paymentMethods: [{ id: 'cash', label: 'Cash' }],
        summary: {
          products: records.length,
          sellable: sellable.length,
          inventory: records.reduce((sum, record) => sum + record.inventoryCount, 0),
        },
      }
    }
    catch (error) {
      return dashboardOperationalError(error, 'Point of sale records could not be read.', 'CommercePosAction')
    }
  },
})
