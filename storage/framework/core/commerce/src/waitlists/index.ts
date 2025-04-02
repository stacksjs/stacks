import * as products from './products'
import * as restaurant from './restaurant'

export {
  products,
  restaurant,
}

interface WaitlistsNamespace {
  products: typeof products
  restaurant: typeof restaurant
}

const waitlists: WaitlistsNamespace = {
  products,
  restaurant,
}

export default waitlists
