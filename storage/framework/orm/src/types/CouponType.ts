import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import type { OrderModelType } from './OrderType'
import type { ProductModelType } from './ProductType'

export interface CouponsTable {
  id: Generated<number>
  code: string
  description?: string
  status?: string | string[]
  is_active: boolean
  discount_type: string | string[]
  discount_value: number
  min_order_amount?: number
  max_discount_amount?: number
  free_product_id?: string
  usage_limit?: number
  usage_count?: number
  start_date?: Date | string
  end_date?: Date | string
  uuid?: string
  created_at?: string
  updated_at?: string
}

export type CouponRead = CouponsTable

export type CouponWrite = Omit<CouponsTable, 'created_at'> & {
  created_at?: string
}

export interface CouponResponse {
  data: CouponJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface CouponJsonResponse extends Omit<Selectable<CouponRead>, 'password'> {
  [key: string]: any
}

export type NewCoupon = Insertable<CouponWrite>
export type CouponUpdate = Updateable<CouponWrite>

export interface CouponModelType {
  // Properties
  readonly id: number
  get code(): string
  set code(value: string)
  get description(): string | undefined
  set description(value: string)
  get status(): string | string[] | undefined
  set status(value: string | string[])
  get isActive(): boolean
  set isActive(value: boolean)
  get discountType(): string | string[]
  set discountType(value: string | string[])
  get discountValue(): number
  set discountValue(value: number)
  get minOrderAmount(): number | undefined
  set minOrderAmount(value: number)
  get maxDiscountAmount(): number | undefined
  set maxDiscountAmount(value: number)
  get freeProductId(): string | undefined
  set freeProductId(value: string)
  get usageLimit(): number | undefined
  set usageLimit(value: number)
  get usageCount(): number | undefined
  set usageCount(value: number)
  get startDate(): Date | string | undefined
  set startDate(value: Date | string)
  get endDate(): Date | string | undefined
  set endDate(value: Date | string)
  get order(): OrderModelType[] | []
  get product(): ProductModelType | undefined

  get uuid(): string | undefined
  set uuid(value: string)

  get created_at(): string | undefined
  get updated_at(): string | undefined
  set updated_at(value: string)

  // Static methods
  with: (relations: string[]) => CouponModelType
  select: (params: (keyof CouponJsonResponse)[] | RawBuilder<string> | string) => CouponModelType
  find: (id: number) => Promise<CouponModelType | undefined>
  first: () => Promise<CouponModelType | undefined>
  last: () => Promise<CouponModelType | undefined>
  firstOrFail: () => Promise<CouponModelType | undefined>
  all: () => Promise<CouponModelType[]>
  findOrFail: (id: number) => Promise<CouponModelType | undefined>
  findMany: (ids: number[]) => Promise<CouponModelType[]>
  latest: (column?: keyof CouponsTable) => Promise<CouponModelType | undefined>
  oldest: (column?: keyof CouponsTable) => Promise<CouponModelType | undefined>
  skip: (count: number) => CouponModelType
  take: (count: number) => CouponModelType
  where: <V = string>(column: keyof CouponsTable, ...args: [V] | [Operator, V]) => CouponModelType
  orWhere: (...conditions: [string, any][]) => CouponModelType
  whereNotIn: <V = number>(column: keyof CouponsTable, values: V[]) => CouponModelType
  whereBetween: <V = number>(column: keyof CouponsTable, range: [V, V]) => CouponModelType
  whereRef: (column: keyof CouponsTable, ...args: string[]) => CouponModelType
  when: (condition: boolean, callback: (query: CouponModelType) => CouponModelType) => CouponModelType
  whereNull: (column: keyof CouponsTable) => CouponModelType
  whereNotNull: (column: keyof CouponsTable) => CouponModelType
  whereLike: (column: keyof CouponsTable, value: string) => CouponModelType
  orderBy: (column: keyof CouponsTable, order: 'asc' | 'desc') => CouponModelType
  orderByAsc: (column: keyof CouponsTable) => CouponModelType
  orderByDesc: (column: keyof CouponsTable) => CouponModelType
  groupBy: (column: keyof CouponsTable) => CouponModelType
  having: <V = string>(column: keyof CouponsTable, operator: Operator, value: V) => CouponModelType
  inRandomOrder: () => CouponModelType
  whereColumn: (first: keyof CouponsTable, operator: Operator, second: keyof CouponsTable) => CouponModelType
  max: (field: keyof CouponsTable) => Promise<number>
  min: (field: keyof CouponsTable) => Promise<number>
  avg: (field: keyof CouponsTable) => Promise<number>
  sum: (field: keyof CouponsTable) => Promise<number>
  count: () => Promise<number>
  get: () => Promise<CouponModelType[]>
  pluck: <K extends keyof CouponModelType>(field: K) => Promise<CouponModelType[K][]>
  chunk: (size: number, callback: (models: CouponModelType[]) => Promise<void>) => Promise<void>
  paginate: (options?: { limit?: number, offset?: number, page?: number }) => Promise<{
    data: CouponModelType[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }>
  create: (newCoupon: NewCoupon) => Promise<CouponModelType>
  firstOrCreate: (search: Partial<CouponsTable>, values?: NewCoupon) => Promise<CouponModelType>
  updateOrCreate: (search: Partial<CouponsTable>, values?: NewCoupon) => Promise<CouponModelType>
  createMany: (newCoupon: NewCoupon[]) => Promise<void>
  forceCreate: (newCoupon: NewCoupon) => Promise<CouponModelType>
  remove: (id: number) => Promise<any>
  whereIn: <V = number>(column: keyof CouponsTable, values: V[]) => CouponModelType
  distinct: (column: keyof CouponJsonResponse) => CouponModelType
  join: (table: string, firstCol: string, secondCol: string) => CouponModelType

  // Instance methods
  createInstance: (data: CouponJsonResponse) => CouponModelType
  update: (newCoupon: CouponUpdate) => Promise<CouponModelType | undefined>
  forceUpdate: (newCoupon: CouponUpdate) => Promise<CouponModelType | undefined>
  save: () => Promise<CouponModelType>
  delete: () => Promise<number>
  toSearchableObject: () => Partial<CouponJsonResponse>
  toJSON: () => CouponJsonResponse
  parseResult: (model: CouponModelType) => CouponModelType

  productBelong: () => Promise<ProductModelType>
}
