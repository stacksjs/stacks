import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'

export interface CartItemsTable {
  id: Generated<number>
  quantity: number
  unit_price: number
  total_price: number
  tax_rate?: number
  tax_amount?: number
  discount_percentage?: number
  discount_amount?: number
  product_name: string
  product_sku?: string
  product_image?: string
  notes?: string
  cart_id?: number
  uuid?: string
  created_at?: string
  updated_at?: string
}

export type CartItemRead = CartItemsTable

export type CartItemWrite = Omit<CartItemsTable, 'created_at'> & {
  created_at?: string
}

export interface CartItemResponse {
  data: CartItemJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface CartItemJsonResponse extends Omit<Selectable<CartItemRead>, 'password'> {
  [key: string]: any
}

export type NewCartItem = Insertable<CartItemWrite>
export type CartItemUpdate = Updateable<CartItemWrite>

export interface CartItemModelType {
  // Properties
  readonly id: number
  get quantity(): number
  set quantity(value: number)
  get unitPrice(): number
  set unitPrice(value: number)
  get totalPrice(): number
  set totalPrice(value: number)
  get taxRate(): number | undefined
  set taxRate(value: number)
  get taxAmount(): number | undefined
  set taxAmount(value: number)
  get discountPercentage(): number | undefined
  set discountPercentage(value: number)
  get discountAmount(): number | undefined
  set discountAmount(value: number)
  get productName(): string
  set productName(value: string)
  get productSku(): string | undefined
  set productSku(value: string)
  get productImage(): string | undefined
  set productImage(value: string)
  get notes(): string | undefined
  set notes(value: string)

  cartBelong: () => Promise<CartType>
  get uuid(): string | undefined
  set uuid(value: string)

  get created_at(): string | undefined
  get updated_at(): string | undefined
  set updated_at(value: string)

  // Static methods
  with: (relations: string[]) => CartItemModelType
  select: (params: (keyof CartItemJsonResponse)[] | RawBuilder<string> | string) => CartItemModelType
  find: (id: number) => Promise<CartItemModelType | undefined>
  first: () => Promise<CartItemModelType | undefined>
  last: () => Promise<CartItemModelType | undefined>
  firstOrFail: () => Promise<CartItemModelType | undefined>
  all: () => Promise<CartItemModelType[]>
  findOrFail: (id: number) => Promise<CartItemModelType | undefined>
  findMany: (ids: number[]) => Promise<CartItemModelType[]>
  latest: (column?: keyof CartItemsTable) => Promise<CartItemModelType | undefined>
  oldest: (column?: keyof CartItemsTable) => Promise<CartItemModelType | undefined>
  skip: (count: number) => CartItemModelType
  take: (count: number) => CartItemModelType
  where: <V = string>(column: keyof CartItemsTable, ...args: [V] | [Operator, V]) => CartItemModelType
  orWhere: (...conditions: [string, any][]) => CartItemModelType
  whereNotIn: <V = number>(column: keyof CartItemsTable, values: V[]) => CartItemModelType
  whereBetween: <V = number>(column: keyof CartItemsTable, range: [V, V]) => CartItemModelType
  whereRef: (column: keyof CartItemsTable, ...args: string[]) => CartItemModelType
  when: (condition: boolean, callback: (query: CartItemModelType) => CartItemModelType) => CartItemModelType
  whereNull: (column: keyof CartItemsTable) => CartItemModelType
  whereNotNull: (column: keyof CartItemsTable) => CartItemModelType
  whereLike: (column: keyof CartItemsTable, value: string) => CartItemModelType
  orderBy: (column: keyof CartItemsTable, order: 'asc' | 'desc') => CartItemModelType
  orderByAsc: (column: keyof CartItemsTable) => CartItemModelType
  orderByDesc: (column: keyof CartItemsTable) => CartItemModelType
  groupBy: (column: keyof CartItemsTable) => CartItemModelType
  having: <V = string>(column: keyof CartItemsTable, operator: Operator, value: V) => CartItemModelType
  inRandomOrder: () => CartItemModelType
  whereColumn: (first: keyof CartItemsTable, operator: Operator, second: keyof CartItemsTable) => CartItemModelType
  max: (field: keyof CartItemsTable) => Promise<number>
  min: (field: keyof CartItemsTable) => Promise<number>
  avg: (field: keyof CartItemsTable) => Promise<number>
  sum: (field: keyof CartItemsTable) => Promise<number>
  count: () => Promise<number>
  get: () => Promise<CartItemModelType[]>
  pluck: <K extends keyof CartItemModelType>(field: K) => Promise<CartItemModelType[K][]>
  chunk: (size: number, callback: (models: CartItemModelType[]) => Promise<void>) => Promise<void>
  paginate: (options?: { limit?: number, offset?: number, page?: number }) => Promise<{
    data: CartItemModelType[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }>
  create: (newCartItem: NewCartItem) => Promise<CartItemModelType>
  firstOrCreate: (search: Partial<CartItemsTable>, values?: NewCartItem) => Promise<CartItemModelType>
  updateOrCreate: (search: Partial<CartItemsTable>, values?: NewCartItem) => Promise<CartItemModelType>
  createMany: (newCartItem: NewCartItem[]) => Promise<void>
  forceCreate: (newCartItem: NewCartItem) => Promise<CartItemModelType>
  remove: (id: number) => Promise<any>
  whereIn: <V = number>(column: keyof CartItemsTable, values: V[]) => CartItemModelType
  distinct: (column: keyof CartItemJsonResponse) => CartItemModelType
  join: (table: string, firstCol: string, secondCol: string) => CartItemModelType

  // Instance methods
  createInstance: (data: CartItemJsonResponse) => CartItemModelType
  update: (newCartItem: CartItemUpdate) => Promise<CartItemModelType | undefined>
  forceUpdate: (newCartItem: CartItemUpdate) => Promise<CartItemModelType | undefined>
  save: () => Promise<CartItemModelType>
  delete: () => Promise<number>
  toSearchableObject: () => Partial<CartItemJsonResponse>
  toJSON: () => CartItemJsonResponse
  parseResult: (model: CartItemModelType) => CartItemModelType

  cartBelong: () => Promise<CartType>
}
