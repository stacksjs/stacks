import { Action } from '@stacksjs/actions'
import { DeliveryRoute, ShippingMethod } from '@stacksjs/orm'

export default new Action({
  name: 'CommerceDelivery',
  description: 'Returns shipping/delivery data including shipments, carriers, and zones.',
  method: 'GET',
  async handle() {
    const routes = await DeliveryRoute.orderBy('created_at', 'desc').limit(50).get()
    const routeCount = await DeliveryRoute.count()
    const methods = await ShippingMethod.orderBy('created_at', 'desc').limit(50).get()
    const methodCount = await ShippingMethod.count()

    const stats = [
      { label: 'Delivery Routes', value: String(routeCount) },
      { label: 'Shipping Methods', value: String(methodCount) },
      { label: 'Exceptions', value: '-' },
      { label: 'Avg Delivery Time', value: '-' },
    ]

    return {
      shipments: routes.map(i => i.toJSON()),
      carriers: methods.map(i => i.toJSON()),
      stats,
    }
  },
})
