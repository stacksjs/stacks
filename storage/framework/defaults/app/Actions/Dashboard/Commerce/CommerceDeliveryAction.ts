import { Action } from '@stacksjs/actions'
import { DeliveryRoute, Driver, ShippingMethod, ShippingZone } from '@stacksjs/orm'

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100)
}

function formatDuration(minutes: number): string {
  if (minutes < 60)
    return `${minutes} min`

  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60

  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`
}

function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value))
    return value.map(item => String(item))

  if (typeof value !== 'string' || value.trim() === '')
    return []

  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.map(item => String(item)) : []
  }
  catch {
    return []
  }
}

export default new Action({
  name: 'CommerceDelivery',
  description: 'Returns the dashboard delivery overview from routes, drivers, shipping methods, and zones.',
  method: 'GET',
  async handle() {
    const [allMethods, allRoutes, allZones, allDrivers] = await Promise.all([
      ShippingMethod.all(),
      DeliveryRoute.all(),
      ShippingZone.all(),
      Driver.all(),
    ])

    const routes = allRoutes.map(route => ({
      id: Number(route.get('id') || 0),
      driver: String(route.get('driver') || 'Unassigned'),
      vehicle: String(route.get('vehicle') || 'Not assigned'),
      stops: Number(route.get('stops') || 0),
      duration: formatDuration(Number(route.get('delivery_time') || 0)),
      distance: `${Number(route.get('total_distance') || 0).toLocaleString('en-US')} mi`,
      lastActive: String(route.get('last_active') || ''),
    }))

    const methods = allMethods.map(method => {
      const freeShipping = method.get('free_shipping')

      return {
        id: Number(method.get('id') || 0),
        name: String(method.get('name') || 'Unnamed method'),
        status: String(method.get('status') || 'draft'),
        baseRate: formatCurrency(Number(method.get('base_rate') || 0)),
        freeShipping: freeShipping === null || freeShipping === undefined
          ? 'No minimum'
          : formatCurrency(Number(freeShipping)),
      }
    })

    const zones = allZones.map(zone => ({
      id: Number(zone.get('id') || 0),
      name: String(zone.get('name') || 'Unnamed zone'),
      status: String(zone.get('status') || 'draft'),
      countries: parseStringArray(zone.get('countries')).length,
      regions: parseStringArray(zone.get('regions')).length,
    }))

    const driverStatusCounts = allDrivers.reduce<Record<string, number>>((counts, driver) => {
      const status = String(driver.get('status') || 'active')
      counts[status] = (counts[status] || 0) + 1
      return counts
    }, {})

    const averageRouteMinutes = routes.length > 0
      ? Math.round(allRoutes.reduce((total, route) => total + Number(route.get('delivery_time') || 0), 0) / routes.length)
      : 0

    const coveredCountries = allZones.reduce((total, zone) => {
      return total + parseStringArray(zone.get('countries')).length
    }, 0)

    const stats = [
      {
        label: 'Active Routes',
        value: String(routes.length),
        detail: `${routes.reduce((total, route) => total + route.stops, 0)} planned stops`,
      },
      {
        label: 'Drivers on Delivery',
        value: String(driverStatusCounts.on_delivery || 0),
        detail: `${allDrivers.length} drivers total`,
      },
      {
        label: 'Average Route',
        value: formatDuration(averageRouteMinutes),
        detail: 'Based on planned duration',
      },
      {
        label: 'Active Zones',
        value: String(zones.filter(zone => zone.status === 'active').length),
        detail: `${coveredCountries} country assignments`,
      },
    ]

    return {
      stats,
      routes,
      methods,
      zones,
      drivers: {
        total: allDrivers.length,
        active: driverStatusCounts.active || 0,
        onDelivery: driverStatusCounts.on_delivery || 0,
        onBreak: driverStatusCounts.on_break || 0,
      },
    }
  },
})
