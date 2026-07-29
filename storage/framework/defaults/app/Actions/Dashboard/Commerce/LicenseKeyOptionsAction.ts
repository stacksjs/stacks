import { Action } from '@stacksjs/actions'
import { Customer, Order, Product } from '@stacksjs/orm'

export default new Action({
  name: 'License Key Options',
  description: 'Returns lightweight relationship options for license key forms.',
  method: 'GET',
  apiResponse: true,
  async handle() {
    const [customers, products, orders] = await Promise.all([
      Customer.all(),
      Product.all(),
      Order.all(),
    ])

    return {
      customers: customers.map(customer => ({
        id: Number(customer.get('id')),
        label: String(customer.get('name') || 'Unnamed customer'),
        detail: String(customer.get('email') || ''),
      })),
      products: products.map(product => ({
        id: Number(product.get('id')),
        label: String(product.get('name') || 'Unnamed product'),
      })),
      orders: orders.map(order => ({
        id: Number(order.get('id')),
        label: `Order #${Number(order.get('id'))}`,
        detail: String(order.get('status') || ''),
      })),
    }
  },
})
