import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import type { CartItemModelType } from './CartItemType'
import type { CouponModelType } from './CouponType'
import type { CustomerModelType } from './CustomerType'

export interface CartsTable {
  id: Generated<number>
  status?: string | string[]
  total_items?: number
  subtotal?: number
  tax_amount?: number
  discount_amount?: number
  total?: number
  expires_at: Date | string
  currency?: string
  notes?: string
  applied_coupon_id: string
  uuid?: string
  created_at?: string
  updated_at?: string
}

export type CartRead = CartsTable

export type CartWrite = Omit<CartsTable, 'created_at'> & {
  created_at?: string
}

export interface CartResponse {
  data: CartJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface CartJsonResponse extends Omit<Selectable<CartRead>, 'password'> {
  [key: string]: any
}

export type NewCart = Insertable<CartWrite>
export type CartUpdate = Updateable<CartWrite>

export interface CartModelType {
  // Properties
  readonly id: number
  get status(): string | string[] | undefined
  set status(value: string | string[])
  get totalItems(): number | undefined
  set totalItems(value: number)
  get subtotal(): number | undefined
  set subtotal(value: number)
  get taxAmount(): number | undefined
  set taxAmount(value: number)
  get discountAmount(): number | undefined
  set discountAmount(value: number)
  get total(): number | undefined
  set total(value: number)
  get expiresAt(): Date | string
  set expiresAt(value: Date | string)
  get currency(): string | undefined
  set currency(value: string)
  get notes(): string | undefined
  set notes(value: string)
  get appliedCouponId(): string
  set appliedCouponId(value: string)
  get cart_item(): CartItemModelType[] | []
  get customer(): CustomerModelType | undefined
  get coupon(): CouponModelType | undefined

  get uuid(): string | undefined
  set uuid(value: string)

  get created_at(): string | undefined
  get updated_at(): string | undefined
  set updated_at(value: string)

  // Static methods
  with: (relations: string[]) => CartModelType
  select: (params: (keyof CartJsonResponse)[] | RawBuilder<string> | string) => CartModelType
  find: (id: number) => Promise<CartModelType | undefined>
  first: () => Promise<CartModelType | undefined>
  last: () => Promise<CartModelType | undefined>
  firstOrFail: () => Promise<CartModelType | undefined>
  all: () => Promise<CartModelType[]>
  findOrFail: (id: number) => Promise<CartModelType | undefined>
  findMany: (ids: number[]) => Promise<CartModelType[]>
  latest: (column?: keyof CartsTable) => Promise<CartModelType | undefined>
  oldest: (column?: keyof CartsTable) => Promise<CartModelType | undefined>
  skip: (count: number) => CartModelType
  take: (count: number) => CartModelType
  where: <V = string>(column: keyof CartsTable, ...args: [V] | [Operator, V]) => CartModelType
  orWhere: (...conditions: [string, any][]) => CartModelType
  whereNotIn: <V = number>(column: keyof CartsTable, values: V[]) => CartModelType
  whereBetween: <V = number>(column: keyof CartsTable, range: [V, V]) => CartModelType
  whereRef: (column: keyof CartsTable, ...args: string[]) => CartModelType
  when: (condition: boolean, callback: (query: CartModelType) => CartModelType) => CartModelType
  whereNull: (column: keyof CartsTable) => CartModelType
  whereNotNull: (column: keyof CartsTable) => CartModelType
  whereLike: (column: keyof CartsTable, value: string) => CartModelType
  orderBy: (column: keyof CartsTable, order: 'asc' | 'desc') => CartModelType
  orderByAsc: (column: keyof CartsTable) => CartModelType
  orderByDesc: (column: keyof CartsTable) => CartModelType
  groupBy: (column: keyof CartsTable) => CartModelType
  having: <V = string>(column: keyof CartsTable, operator: Operator, value: V) => CartModelType
  inRandomOrder: () => CartModelType
  whereColumn: (first: keyof CartsTable, operator: Operator, second: keyof CartsTable) => CartModelType
  max: (field: keyof CartsTable) => Promise<number>
  min: (field: keyof CartsTable) => Promise<number>
  avg: (field: keyof CartsTable) => Promise<number>
  sum: (field: keyof CartsTable) => Promise<number>
  count: () => Promise<number>
  get: () => Promise<CartModelType[]>
  pluck: <K extends keyof CartModelType>(field: K) => Promise<CartModelType[K][]>
  chunk: (size: number, callback: (models: CartModelType[]) => Promise<void>) => Promise<void>
  paginate: (options?: { limit?: number, offset?: number, page?: number }) => Promise<{
    data: CartModelType[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }>
  create: (newCart: NewCart) => Promise<CartModelType>
  firstOrCreate: (search: Partial<CartsTable>, values?: NewCart) => Promise<CartModelType>
  updateOrCreate: (search: Partial<CartsTable>, values?: NewCart) => Promise<CartModelType>
  createMany: (newCart: NewCart[]) => Promise<void>
  forceCreate: (newCart: NewCart) => Promise<CartModelType>
  remove: (id: number) => Promise<any>
  whereIn: <V = number>(column: keyof CartsTable, values: V[]) => CartModelType
  distinct: (column: keyof CartJsonResponse) => CartModelType
  join: (table: string, firstCol: string, secondCol: string) => CartModelType

  // Instance methods
  createInstance: (data: CartJsonResponse) => CartModelType
  update: (newCart: CartUpdate) => Promise<CartModelType | undefined>
  forceUpdate: (newCart: CartUpdate) => Promise<CartModelType | undefined>
  save: () => Promise<CartModelType>
  delete: () => Promise<number>
  toSearchableObject: () => Partial<CartJsonResponse>
  toJSON: () => CartJsonResponse
  parseResult: (model: CartModelType) => CartModelType

  customerBelong: () => Promise<CustomerModelType>
  couponBelong: () => Promise<CouponModelType>
}
