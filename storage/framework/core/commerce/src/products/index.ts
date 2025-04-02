import * as categories from './categories'
import * as items from './items'
import * as manufacturers from './manufacturers'
import * as reviews from './reviews'
import * as unit from './unit'
import * as variants from './variants'

export {
  categories,
  items,
  manufacturers,
  reviews,
  unit,
  variants,
}

interface ProductsNamespace {
  categories: typeof categories
  items: typeof items
  manufacturers: typeof manufacturers
  reviews: typeof reviews
  unit: typeof unit
  variants: typeof variants
}

const products: ProductsNamespace = {
  categories,
  items,
  manufacturers,
  reviews,
  unit,
  variants,
}

export default products
