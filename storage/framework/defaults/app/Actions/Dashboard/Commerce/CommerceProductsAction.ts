import { Action } from '@stacksjs/actions'
import { Product } from '@stacksjs/orm'

export default new Action({
  name: 'CommerceProducts',
  description: 'Returns products list with stats and categories.',
  method: 'GET',
  async handle() {
    const categories = ['All Categories', 'Electronics', 'Clothing', 'Books', 'General']

    try {
      const allProducts = await Product.orderByDesc('id').get()
      const totalProducts = await Product.count()

      const products = allProducts.map(p => ({
        name: String(p.get('name') || 'Product'),
        sku: `PRD-${String(p.get('id')).padStart(3, '0')}`,
        price: `$${(Number(p.get('price')) || 0).toFixed(2)}`,
        stock: Number(p.get('inventory_count') || 0),
        category: 'General',
        status: !p.get('is_available') ? 'inactive' : (Number(p.get('inventory_count') || 0)) < 10 ? 'low-stock' : 'active',
      }))

      const activeProducts = products.filter(p => p.status === 'active').length
      const lowStockProducts = products.filter(p => p.status === 'low-stock').length
      const outOfStock = products.filter(p => p.stock === 0).length

      const stats = [
        { label: 'Total Products', value: String(totalProducts) },
        { label: 'Active', value: String(activeProducts) },
        { label: 'Low Stock', value: String(lowStockProducts) },
        { label: 'Out of Stock', value: String(outOfStock) },
      ]

      return { products, stats, categories }
    }
    catch {
      return {
        products: [],
        stats: [
          { label: 'Total Products', value: '0' },
          { label: 'Active', value: '0' },
          { label: 'Low Stock', value: '0' },
          { label: 'Out of Stock', value: '0' },
        ],
        categories,
      }
    }
  },
})
