import { Action } from '@stacksjs/actions'
import { Customer, LicenseKey, Order, Product } from '@stacksjs/orm'

interface RelatedSummary {
  id: number
  label: string
  detail?: string
}

function numericId(value: unknown): number | null {
  const id = Number(value)
  return Number.isFinite(id) && id > 0 ? id : null
}

export default new Action({
  name: 'Dashboard License Keys',
  description: 'Returns license keys with lightweight customer, product, and order summaries.',
  method: 'GET',
  apiResponse: true,
  async handle() {
    const [keys, customers, products, orders] = await Promise.all([
      LicenseKey.all(),
      Customer.all(),
      Product.all(),
      Order.all(),
    ])

    const customerMap = new Map<number, RelatedSummary>(customers.map(customer => [
      Number(customer.get('id')),
      {
        id: Number(customer.get('id')),
        label: String(customer.get('name') || 'Unnamed customer'),
        detail: String(customer.get('email') || ''),
      },
    ]))
    const productMap = new Map<number, RelatedSummary>(products.map(product => [
      Number(product.get('id')),
      {
        id: Number(product.get('id')),
        label: String(product.get('name') || 'Unnamed product'),
      },
    ]))
    const orderMap = new Map<number, RelatedSummary>(orders.map(order => [
      Number(order.get('id')),
      {
        id: Number(order.get('id')),
        label: `Order #${Number(order.get('id'))}`,
        detail: String(order.get('status') || ''),
      },
    ]))

    return keys.map((licenseKey) => {
      const customerId = numericId(licenseKey.get('customer_id'))
      const productId = numericId(licenseKey.get('product_id'))
      const orderId = numericId(licenseKey.get('order_id'))

      return {
        id: Number(licenseKey.get('id')),
        key: String(licenseKey.get('key') || ''),
        template: String(licenseKey.get('template') || ''),
        expiry_date: String(licenseKey.get('expiry_date') || ''),
        status: String(licenseKey.get('status') || 'unassigned'),
        customer_id: customerId,
        product_id: productId,
        order_id: orderId,
        created_at: String(licenseKey.get('created_at') || ''),
        updated_at: licenseKey.get('updated_at'),
        uuid: licenseKey.get('uuid'),
        customer: customerId ? customerMap.get(customerId) || null : null,
        product: productId ? productMap.get(productId) || null : null,
        order: orderId ? orderMap.get(orderId) || null : null,
      }
    })
  },
})
