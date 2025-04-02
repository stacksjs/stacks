import * as categories from './categories'
import * as items from './items'
import * as manufacturers from './manufacturers'
import * as reviews from './reviews'
import * as units from './units'
import * as variants from './variants'

export {
  categories,
  items,
  manufacturers,
  reviews,
  units,
  variants,
}

interface ProductsNamespace {
  categories: typeof categories
  items: typeof items
  manufacturers: typeof manufacturers
  reviews: typeof reviews
  units: typeof units
  variants: typeof variants
}

const products: ProductsNamespace = {
  categories,
  items,
  manufacturers,
  reviews,
  units,
  variants,
}

export default products
