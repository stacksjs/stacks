/**
 * A point-of-sale register's basket: what is being rung up, held against what
 * is on the shelf, before anything is written. Pure and dependency-free, so
 * the browser bundles it (`@stacksjs/commerce/register`) and a server can
 * check the same rules.
 *
 * A product is anything with an `id`, a `price` in minor units and, when its
 * stock is counted, an `inventory` (null or absent: not counted, never runs
 * out). Field names follow the caller: pass `fields` when a catalog stores
 * them as, say, `price_cents` and `inventory_quantity`.
 *
 * ```ts
 * import { addToBasket, basketTotal } from '@stacksjs/commerce/register'
 *
 * let basket = addToBasket([], gatorade)
 * basket = addToBasket(basket, gatorade)
 * basketTotal(basket, catalog) // 700
 * ```
 */

export interface BasketLine {
  productId: number
  quantity: number
}

export interface RegisterFields {
  id: string
  price: string
  inventory: string
  lowStock: string
  /** A product is taxed unless this field is `false`. */
  taxable: string
}

export const DEFAULT_FIELDS: RegisterFields = { id: 'id', price: 'price', inventory: 'inventory', lowStock: 'low_stock_threshold', taxable: 'taxable' }

/** Field names for a catalog stored with `price_cents` and `inventory_quantity`. */
export const CENTS_FIELDS: RegisterFields = { id: 'id', price: 'price_cents', inventory: 'inventory_quantity', lowStock: 'low_stock_threshold', taxable: 'taxable' }

type Product = Record<string, any>

function idOf(product: Product, fields: RegisterFields): number {
  return Number(product[fields.id])
}

function stockOf(product: Product, fields: RegisterFields): number | null {
  const value = product[fields.inventory]
  return value === null || value === undefined || value === '' ? null : Number(value)
}

/** Combine repeated products into one validated line before checking or writing stock. */
export function normalizeBasket(basket: readonly BasketLine[]): BasketLine[] {
  const quantities = new Map<number, number>()
  for (const { productId, quantity } of basket) {
    if (!Number.isSafeInteger(productId) || productId < 1 || !Number.isSafeInteger(quantity) || quantity < 1)
      throw new Error('Basket products and quantities must be positive safe integers')
    const total = (quantities.get(productId) || 0) + quantity
    if (!Number.isSafeInteger(total)) throw new Error('Basket quantity exceeds the safe integer range')
    quantities.set(productId, total)
  }
  return [...quantities].map(([productId, quantity]) => ({ productId, quantity }))
}

/** Units still on the shelf once the basket is taken off it; null when stock is not counted. */
export function shelfLeft(product: Product, basket: BasketLine[], fields: RegisterFields = DEFAULT_FIELDS): number | null {
  const stock = stockOf(product, fields)
  if (stock === null) return null
  const inBasket = basket.filter(line => line.productId === idOf(product, fields)).reduce((sum, line) => sum + line.quantity, 0)
  return Math.max(0, stock - inBasket)
}

/** Whether one more can be rung up. */
export function canAdd(product: Product, basket: BasketLine[], fields: RegisterFields = DEFAULT_FIELDS): boolean {
  const left = shelfLeft(product, basket, fields)
  return left === null || left > 0
}

/** One more of a product, when there is one to sell; the basket unchanged otherwise. */
export function addToBasket(basket: BasketLine[], product: Product, fields: RegisterFields = DEFAULT_FIELDS): BasketLine[] {
  const normalized = normalizeBasket(basket)
  if (!canAdd(product, normalized, fields)) return basket
  basket = normalized
  const id = idOf(product, fields)
  return basket.some(line => line.productId === id)
    ? basket.map(line => line.productId === id ? { ...line, quantity: line.quantity + 1 } : line)
    : [...basket, { productId: id, quantity: 1 }]
}

/** A line's quantity, held to the stock on hand; zero (or less) takes the line off. */
export function setQuantity(basket: BasketLine[], product: Product, quantity: number, fields: RegisterFields = DEFAULT_FIELDS): BasketLine[] {
  const id = idOf(product, fields)
  const stock = stockOf(product, fields)
  basket = normalizeBasket(basket)
  const wanted = Math.min(Math.max(0, Math.floor(Number(quantity) || 0)), stock === null ? Number.POSITIVE_INFINITY : stock)
  if (wanted === 0) return basket.filter(line => line.productId !== id)
  return basket.some(line => line.productId === id)
    ? basket.map(line => line.productId === id ? { ...line, quantity: wanted } : line)
    : [...basket, { productId: id, quantity: wanted }]
}

/** The basket's lines with their products, leaving out any no longer in the catalog. */
export function basketLines<T extends Product>(basket: BasketLine[], products: T[], fields: RegisterFields = DEFAULT_FIELDS): Array<BasketLine & { product: T }> {
  return normalizeBasket(basket)
    .map(line => ({ ...line, product: products.find(product => idOf(product, fields) === line.productId) }))
    .filter((line): line is BasketLine & { product: T } => !!line.product)
}

/** The basket's total, in minor units. */
export function basketTotal(basket: BasketLine[], products: Product[], fields: RegisterFields = DEFAULT_FIELDS): number {
  return basketLines(basket, products, fields).reduce((sum, line) => sum + Number(line.product[fields.price] || 0) * line.quantity, 0)
}

/**
 * The part of the basket's total that sales tax applies to: every line whose
 * product is not marked `taxable: false` (a food product, an admission).
 * Feed it to `breakdownFor` from `@stacksjs/commerce/sales-tax`.
 */
export function basketTaxable(basket: BasketLine[], products: Product[], fields: RegisterFields = DEFAULT_FIELDS): number {
  return basketLines(basket, products, fields)
    .filter(line => line.product[fields.taxable] !== false)
    .reduce((sum, line) => sum + Number(line.product[fields.price] || 0) * line.quantity, 0)
}

/** How many units are in the basket. */
export function basketCount(basket: BasketLine[]): number {
  return basket.reduce((sum, line) => sum + line.quantity, 0)
}

export interface StockLabel { text: string, tone: 'out' | 'low' | 'ok' }

/**
 * How a product's stock reads on the register: sold out, running low (at or
 * under its own reorder level, `defaultLow` when it has none), or how many
 * are left. Null when stock is not counted.
 */
export function stockLabel(product: Product, basket: BasketLine[] = [], fields: RegisterFields = DEFAULT_FIELDS, defaultLow = 5): StockLabel | null {
  const left = shelfLeft(product, basket, fields)
  if (left === null) return null
  if (left === 0) return { text: 'Sold out', tone: 'out' }
  const threshold = product[fields.lowStock] === null || product[fields.lowStock] === undefined ? defaultLow : Number(product[fields.lowStock])
  return { text: `${left} left`, tone: left <= threshold ? 'low' : 'ok' }
}

/** The distinct values of a grouping (a shelf, a category), in the order the products come. */
export function groupsOf<T>(products: T[], groupOf: (product: T) => string): string[] {
  const seen: string[] = []
  for (const product of products) {
    const name = groupOf(product)
    if (!seen.includes(name)) seen.push(name)
  }
  return seen
}
