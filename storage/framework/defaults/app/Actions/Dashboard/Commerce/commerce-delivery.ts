export interface DeliveryOverviewStat {
  label: string
  value: string
  detail: string
}

export interface DeliveryOverviewRoute {
  id: number
  courier: string
  vehicle: string
  stops: number
  duration: string
  distance: string
  lastActive: number
}

export interface DeliveryOverviewMethod {
  id: number
  name: string
  status: string
  baseRate: string
  freeShipping: string
}

export interface DeliveryOverviewZone {
  id: number
  name: string
  status: string
  countries: number
  regions: number
}

export interface DeliveryOverviewResult {
  stats: DeliveryOverviewStat[]
  routes: DeliveryOverviewRoute[]
  methods: DeliveryOverviewMethod[]
  zones: DeliveryOverviewZone[]
  couriers: {
    total: number
    active: number
    onDelivery: number
    onBreak: number
  }
}

const DAY_MS = 24 * 60 * 60 * 1000

function formatMoney(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(cents / 100)
  }
  catch {
    return `${currency} ${(cents / 100).toFixed(2)}`
  }
}

export function deliveryTimestamp(input: unknown, source = 'DeliveryRoute', field = 'last_active'): number {
  const raw = typeof input === 'number' ? String(input) : commerceRequiredString(input, source, field)
  if (/^\d{10,13}$/.test(raw)) {
    const timestamp = raw.length === 10 ? Number(raw) * 1000 : Number(raw)
    if (Number.isSafeInteger(timestamp))
      return timestamp
  }

  const normalized = /^\d{4}-\d{2}-\d{2} \d/.test(raw)
    ? `${raw.replace(' ', 'T')}Z`
    : raw
  const timestamp = new Date(normalized).getTime()
  if (!Number.isFinite(timestamp))
    throw new TypeError(`${source}.${field} must be a valid Unix or ISO timestamp.`)
  return timestamp
}

export function formatDeliveryDuration(minutes: number): string {
  if (minutes < 60)
    return `${minutes} min`

  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`
}

export function buildDeliveryOverview(
  methodRows: any[],
  routeRows: any[],
  zoneRows: any[],
  courierRows: any[],
  currency = 'USD',
  now = new Date(),
): DeliveryOverviewResult {
  const normalizedCurrency = commerceCurrency(currency, 'Commerce configuration')
  const normalizedCouriers = courierRows.map((courier) => {
    const identifier = commerceIdentifier(commerceValue(courier, 'id', 'uuid'), 'Courier')
    const source = `Courier ${identifier}`
    return {
      id: identifier,
      name: commerceRequiredString(commerceValue(courier, 'name'), source, 'name'),
      vehicle: commerceRequiredString(
        commerceValue(courier, 'vehicle_number', 'vehicleNumber'),
        source,
        'vehicle_number',
      ),
      status: commerceEnum(commerceValue(courier, 'status'), source, 'status', [
        'active',
        'on_delivery',
        'on_break',
      ]),
    }
  })
  const couriersById = new Map(normalizedCouriers.map(courier => [courier.id, courier]))

  const routeMinutesById = new Map<number, number>()
  const allRoutes = routeRows.map((route): DeliveryOverviewRoute => {
    const numericId = commerceNumber(commerceValue(route, 'id'), 'DeliveryRoute', 'id', {
      min: 1,
      integer: true,
    })
    const source = `DeliveryRoute ${numericId}`
    const courierId = commerceOptionalIdentifier(
      commerceValue(route, 'courier_id', 'courierId'),
      source,
      'courier_id',
    )
    const linkedCourier = courierId ? couriersById.get(courierId) : undefined
    if (courierId && !linkedCourier)
      throw new TypeError(`${source}.courier_id references missing Courier ${courierId}.`)
    const deliveryTime = commerceNumber(
      commerceValue(route, 'delivery_time', 'deliveryTime'),
      source,
      'delivery_time',
      { min: 0, integer: true },
    )
    routeMinutesById.set(numericId, deliveryTime)
    return {
      id: numericId,
      courier: linkedCourier?.name
        || commerceRequiredString(commerceValue(route, 'courier'), source, 'courier'),
      vehicle: linkedCourier?.vehicle
        || commerceRequiredString(commerceValue(route, 'vehicle'), source, 'vehicle'),
      stops: commerceNumber(commerceValue(route, 'stops'), source, 'stops', {
        min: 0,
        integer: true,
      }),
      duration: formatDeliveryDuration(deliveryTime),
      distance: `${commerceNumber(
        commerceValue(route, 'total_distance', 'totalDistance'),
        source,
        'total_distance',
        { min: 0 },
      ).toLocaleString('en-US')} mi`,
      lastActive: deliveryTimestamp(
        commerceValue(route, 'last_active', 'lastActive'),
        source,
        'last_active',
      ),
    }
  })

  const activeCutoff = now.getTime() - DAY_MS
  const activeRoutes = allRoutes
    .filter(route => route.lastActive >= activeCutoff && route.lastActive <= now.getTime())
    .sort((left, right) => right.lastActive - left.lastActive)
  const methods = methodRows
    .map((method): DeliveryOverviewMethod => {
      const id = commerceNumber(commerceValue(method, 'id'), 'ShippingMethod', 'id', {
        min: 1,
        integer: true,
      })
      const source = `ShippingMethod ${id}`
      const threshold = commerceOptionalNumber(
        commerceValue(method, 'free_shipping', 'freeShipping'),
        source,
        'free_shipping',
        { min: 0 },
      )
      return {
        id,
        name: commerceRequiredString(commerceValue(method, 'name'), source, 'name'),
        status: commerceEnum(commerceValue(method, 'status'), source, 'status', [
          'active',
          'inactive',
          'draft',
        ]),
        baseRate: formatMoney(commerceNumber(
          commerceValue(method, 'base_rate', 'baseRate'),
          source,
          'base_rate',
          { min: 0 },
        ), normalizedCurrency),
        freeShipping: threshold === null
          ? 'Not enabled'
          : formatMoney(threshold, normalizedCurrency),
      }
    })
    .sort((left, right) => {
      const statusOrder = Number(right.status === 'active') - Number(left.status === 'active')
      return statusOrder || left.name.localeCompare(right.name)
    })

  const zones = zoneRows
    .map((zone): DeliveryOverviewZone => {
      const id = commerceNumber(commerceValue(zone, 'id'), 'ShippingZone', 'id', {
        min: 1,
        integer: true,
      })
      const source = `ShippingZone ${id}`
      return {
        id,
        name: commerceRequiredString(commerceValue(zone, 'name'), source, 'name'),
        status: commerceEnum(commerceValue(zone, 'status'), source, 'status', [
          'active',
          'inactive',
          'draft',
        ]),
        countries: commerceStringList(commerceValue(zone, 'countries'), source, 'countries').length,
        regions: commerceStringList(commerceValue(zone, 'regions'), source, 'regions').length,
      }
    })
    .sort((left, right) => {
      const statusOrder = Number(right.status === 'active') - Number(left.status === 'active')
      return statusOrder || left.name.localeCompare(right.name)
    })

  const courierStatusCounts = normalizedCouriers.reduce<Record<string, number>>((counts, courier) => {
    counts[courier.status] = (counts[courier.status] || 0) + 1
    return counts
  }, {})

  const averageRouteMinutes = activeRoutes.length > 0
    ? Math.round(activeRoutes.reduce((total, route) => total + (routeMinutesById.get(route.id) || 0), 0) / activeRoutes.length)
    : 0
  const activeZones = zones.filter(zone => zone.status === 'active')

  return {
    stats: [
      {
        label: 'Active Routes',
        value: activeRoutes.length.toLocaleString('en-US'),
        detail: `${activeRoutes.reduce((total, route) => total + route.stops, 0).toLocaleString('en-US')} stops active in 24h`,
      },
      {
        label: 'Couriers on Delivery',
        value: (courierStatusCounts.on_delivery || 0).toLocaleString('en-US'),
        detail: `${courierRows.length.toLocaleString('en-US')} couriers total`,
      },
      {
        label: 'Average Route',
        value: formatDeliveryDuration(averageRouteMinutes),
        detail: activeRoutes.length > 0 ? 'Active planned duration' : 'No active route duration',
      },
      {
        label: 'Active Zones',
        value: activeZones.length.toLocaleString('en-US'),
        detail: `${activeZones.reduce((total, zone) => total + zone.countries, 0).toLocaleString('en-US')} country assignments`,
      },
    ],
    routes: activeRoutes.slice(0, 5),
    methods: methods.slice(0, 5),
    zones: zones.slice(0, 5),
    couriers: {
      total: normalizedCouriers.length,
      active: courierStatusCounts.active || 0,
      onDelivery: courierStatusCounts.on_delivery || 0,
      onBreak: courierStatusCounts.on_break || 0,
    },
  }
}
import {
  commerceCurrency,
  commerceEnum,
  commerceIdentifier,
  commerceNumber,
  commerceOptionalIdentifier,
  commerceOptionalNumber,
  commerceRequiredString,
  commerceStringList,
  commerceValue,
} from './commerce-record'
