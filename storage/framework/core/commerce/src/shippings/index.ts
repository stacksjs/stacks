import * as routes from './delivery-routes'
import * as digital from './digital-deliveries'
import * as drivers from './drivers'
import * as licenses from './license-keys'
import * as methods from './shipping-methods'
import * as rates from './shipping-rates'
import * as zones from './shipping-zones'

export {
  digital,
  drivers,
  licenses,
  methods,
  rates,
  routes,
  zones,
}

interface ShippingsNamespace {
  digital: typeof digital
  drivers: typeof drivers
  licenses: typeof licenses
  methods: typeof methods
  rates: typeof rates
  routes: typeof routes
  zones: typeof zones
}

const shippings: ShippingsNamespace = {
  digital,
  drivers,
  licenses,
  methods,
  rates,
  routes,
  zones,
}

export default shippings
