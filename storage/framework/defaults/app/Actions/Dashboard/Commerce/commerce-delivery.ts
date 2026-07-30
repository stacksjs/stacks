export interface DeliveryOverviewStat {
  label: string
  value: string
  detail: string
}

export interface DeliveryOverviewRoute {
  id: number
  driver: string
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
  drivers: {
    total: number
    active: number
    onDelivery: number
    onBreak: number
  }
}

const DAY_MS = 24 * 60 * 60 * 1000

function value(record: any, ...keys: string[]): unknown {
  for (const key of keys) {
    const result = typeof record?.get === 'function' ? record.get(key) : record?.[key]
    if (result !== null && result !== undefined)
      return result
  }
  return undefined
}

function text(input: unknown): string {
  return input === null || input === undefined ? '' : String(input)
}

function number(input: unknown): number {
  const result = Number(input)
  return Number.isFinite(result) && result >= 0 ? result : 0
}

function list(input: unknown): string[] {
  if (Array.isArray(input))
    return input.map(item => text(item).trim()).filter(Boolean)

  const raw = text(input).trim()
  if (!raw)
    return []

  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed))
      return parsed.map(item => text(item).trim()).filter(Boolean)
  }
  catch {
    return raw.split(/[\n,|;]+/).map(item => item.trim()).filter(Boolean)
  }

  return []
}

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

export function deliveryTimestamp(input: unknown): number {
  const raw = text(input).trim()
  if (!raw)
    return 0
  if (/^\d{10,13}$/.test(raw))
    return raw.length === 10 ? Number(raw) * 1000 : Number(raw)

  const normalized = /^\d{4}-\d{2}-\d{2} \d/.test(raw)
    ? `${raw.replace(' ', 'T')}Z`
    : raw
  const timestamp = new Date(normalized).getTime()
  return Number.isFinite(timestamp) ? timestamp : 0
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
  driverRows: any[],
  currency = 'USD',
  now = new Date(),
): DeliveryOverviewResult {
  const driversById = new Map(driverRows.map(driver => [
    text(value(driver, 'id')),
    {
      name: text(value(driver, 'name')),
      vehicle: text(value(driver, 'vehicle_number', 'vehicleNumber')),
    },
  ]))

  const allRoutes = routeRows.map((route): DeliveryOverviewRoute => {
    const linkedDriver = driversById.get(text(value(route, 'driver_id', 'driverId')))
    return {
      id: number(value(route, 'id')),
      driver: linkedDriver?.name || text(value(route, 'driver')) || 'Unassigned',
      vehicle: linkedDriver?.vehicle || text(value(route, 'vehicle')) || 'Not assigned',
      stops: number(value(route, 'stops')),
      duration: formatDeliveryDuration(number(value(route, 'delivery_time', 'deliveryTime'))),
      distance: `${number(value(route, 'total_distance', 'totalDistance')).toLocaleString('en-US')} mi`,
      lastActive: deliveryTimestamp(value(route, 'last_active', 'lastActive')),
    }
  })

  const activeCutoff = now.getTime() - DAY_MS
  const activeRoutes = allRoutes
    .filter(route => route.lastActive >= activeCutoff && route.lastActive <= now.getTime())
    .sort((left, right) => right.lastActive - left.lastActive)
  const routeMinutesById = new Map(routeRows.map(route => [
    number(value(route, 'id')),
    number(value(route, 'delivery_time', 'deliveryTime')),
  ]))

  const methods = methodRows
    .map((method): DeliveryOverviewMethod => {
      const threshold = value(method, 'free_shipping', 'freeShipping')
      return {
        id: number(value(method, 'id')),
        name: text(value(method, 'name')) || 'Unnamed method',
        status: text(value(method, 'status')) || 'draft',
        baseRate: formatMoney(number(value(method, 'base_rate', 'baseRate')), currency),
        freeShipping: threshold === null || threshold === undefined || threshold === ''
          ? 'Not enabled'
          : formatMoney(number(threshold), currency),
      }
    })
    .sort((left, right) => {
      const statusOrder = Number(right.status === 'active') - Number(left.status === 'active')
      return statusOrder || left.name.localeCompare(right.name)
    })

  const zones = zoneRows
    .map((zone): DeliveryOverviewZone => ({
      id: number(value(zone, 'id')),
      name: text(value(zone, 'name')) || 'Unnamed zone',
      status: text(value(zone, 'status')) || 'draft',
      countries: list(value(zone, 'countries')).length,
      regions: list(value(zone, 'regions')).length,
    }))
    .sort((left, right) => {
      const statusOrder = Number(right.status === 'active') - Number(left.status === 'active')
      return statusOrder || left.name.localeCompare(right.name)
    })

  const driverStatusCounts = driverRows.reduce<Record<string, number>>((counts, driver) => {
    const status = text(value(driver, 'status')).toLowerCase() || 'active'
    counts[status] = (counts[status] || 0) + 1
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
        label: 'Drivers on Delivery',
        value: (driverStatusCounts.on_delivery || 0).toLocaleString('en-US'),
        detail: `${driverRows.length.toLocaleString('en-US')} drivers total`,
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
    drivers: {
      total: driverRows.length,
      active: driverStatusCounts.active || 0,
      onDelivery: driverStatusCounts.on_delivery || 0,
      onBreak: driverStatusCounts.on_break || 0,
    },
  }
}
