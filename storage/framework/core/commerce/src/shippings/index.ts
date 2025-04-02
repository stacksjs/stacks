import * as digital from './digital'
import * as drivers from './drivers'
import * as licenses from './licenses'
import * as methods from './methods'
import * as routes from './routes'
import * as zones from './zones'

export {
  digital,
  drivers,
  licenses,
  methods,
  routes,
  zones,
}

interface ShippingsNamespace {
  digital: typeof digital
  drivers: typeof drivers
  licenses: typeof licenses
  methods: typeof methods
  routes: typeof routes
  zones: typeof zones
}

const shippings: ShippingsNamespace = {
  digital,
  drivers,
  licenses,
  methods,
  routes,
  zones,
}

export default shippings
