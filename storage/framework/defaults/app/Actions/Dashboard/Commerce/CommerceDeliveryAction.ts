import { Action } from '@stacksjs/actions'
import { ShippingMethod, DeliveryRoute, ShippingZone } from '@stacksjs/orm'

export default new Action({
  name: 'CommerceDelivery',
  description: 'Returns shipping/delivery data including shipments, carriers, and zones.',
  method: 'GET',
  async handle() {
    try {
      const [allMethods, allRoutes, allZones] = await Promise.all([
        ShippingMethod.all(),
        DeliveryRoute.all(),
        ShippingZone.all(),
      ])

      const carriers = allMethods.map(m => ({
        name: String(m.get('name') || ''),
        shipments: Number(m.get('shipment_count') || 0),
        onTime: '-',
        status: String(m.get('status') || 'active'),
      }))

      const shipments = allRoutes.map(r => ({
        id: `SHP-${String(r.get('id')).padStart(4, '0')}`,
        order: String(r.get('order_id') ? `ORD-${r.get('order_id')}` : '-'),
        carrier: String(r.get('carrier') || r.get('name') || ''),
        tracking: String(r.get('tracking_number') || '-'),
        status: String(r.get('status') || 'processing'),
        eta: String(r.get('estimated_delivery') || '-'),
      }))

      const zones = allZones.map(z => ({
        name: String(z.get('name') || ''),
        rate: String(z.get('rate') || '-'),
        delivery: String(z.get('delivery_time') || '-'),
      }))

      const inTransit = shipments.filter(s => s.status === 'in_transit').length
      const delivered = shipments.filter(s => s.status === 'delivered').length
      const exceptions = shipments.filter(s => s.status === 'exception').length

      const stats = [
        { label: 'In Transit', value: String(inTransit) },
        { label: 'Delivered Today', value: String(delivered) },
        { label: 'Exceptions', value: String(exceptions) },
        { label: 'Avg Delivery Time', value: '-' },
      ]

      return { shipments, stats, carriers, zones }
    }
    catch {
      return {
        shipments: [],
        stats: [
          { label: 'In Transit', value: '0' },
          { label: 'Delivered Today', value: '0' },
          { label: 'Exceptions', value: '0' },
          { label: 'Avg Delivery Time', value: '-' },
        ],
        carriers: [],
        zones: [],
      }
    }
  },
})
