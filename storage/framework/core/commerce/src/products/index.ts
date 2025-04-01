import * as categories from './categories'
import * as items from './items'
import * as manufacturer from './manufacturer'
import * as reviews from './reviews'
import * as unit from './unit'
import * as variants from './variants'

export {
  categories,
  items,
  manufacturer,
  reviews,
  unit,
  variants,
}

interface ProductsNamespace {
  categories: typeof categories
  items: typeof items
  manufacturer: typeof manufacturer
  reviews: typeof reviews
  unit: typeof unit
  variants: typeof variants
}

const products: ProductsNamespace = {
  categories,
  items,
  manufacturer,
  reviews,
  unit,
  variants,
}

export default products
