import * as routes from './delivery-routes'
import * as digital from './digital-deliveries'
import * as drivers from './drivers'
import * as geocoding from './geocoding'
import * as licenses from './license-keys'
import * as methods from './shipping-methods'
import * as rates from './shipping-rates'
import * as tracking from './tracking'
import * as zones from './shipping-zones'

export {
  digital,
  drivers,
  geocoding,
  licenses,
  methods,
  rates,
  routes,
  tracking,
  zones,
}

interface ShippingsNamespace {
  digital: typeof digital
  drivers: typeof drivers
  geocoding: typeof geocoding
  licenses: typeof licenses
  methods: typeof methods
  rates: typeof rates
  routes: typeof routes
  tracking: typeof tracking
  zones: typeof zones
}

const shippings: ShippingsNamespace = {
  digital,
  drivers,
  geocoding,
  licenses,
  methods,
  rates,
  routes,
  tracking,
  zones,
}

export default shippings
