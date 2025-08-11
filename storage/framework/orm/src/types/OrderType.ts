import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import type { CouponModelType } from './CouponType'
import type { CustomerModelType } from './CustomerType'
import type { LicenseKeyModelType } from './LicenseKeyType'
import type { OrderItemModelType } from './OrderItemType'
import type { PaymentModelType } from './PaymentType'

export interface OrdersTable {
  id: Generated<number>
  status: string
  total_amount: number
  tax_amount?: number
  discount_amount?: number
  delivery_fee?: number
  tip_amount?: number
  order_type: string
  delivery_address?: string
  special_instructions?: string
  estimated_delivery_time?: string
  applied_coupon_id?: string
  uuid?: string
  created_at?: string
  updated_at?: string
}

export type OrderRead = OrdersTable

export type OrderWrite = Omit<OrdersTable, 'created_at'> & {
  created_at?: string
}

export interface OrderResponse {
  data: OrderJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface OrderJsonResponse extends Omit<Selectable<OrderRead>, 'password'> {
  [key: string]: any
}

export type NewOrder = Insertable<OrderWrite>
export type OrderUpdate = Updateable<OrderWrite>

export interface OrderModelType {
  // Properties
  readonly id: number
  get status(): string
  set status(value: string)
  get totalAmount(): number
  set totalAmount(value: number)
  get taxAmount(): number | undefined
  set taxAmount(value: number)
  get discountAmount(): number | undefined
  set discountAmount(value: number)
  get deliveryFee(): number | undefined
  set deliveryFee(value: number)
  get tipAmount(): number | undefined
  set tipAmount(value: number)
  get orderType(): string
  set orderType(value: string)
  get deliveryAddress(): string | undefined
  set deliveryAddress(value: string)
  get specialInstructions(): string | undefined
  set specialInstructions(value: string)
  get estimatedDeliveryTime(): string | undefined
  set estimatedDeliveryTime(value: string)
  get appliedCouponId(): string | undefined
  set appliedCouponId(value: string)
  get order_item(): OrderItemModelType[] | []
  get payment(): PaymentModelType[] | []
  get license_key(): LicenseKeyModelType[] | []
  get customer(): CustomerModelType | undefined
  get coupon(): CouponModelType | undefined

  get uuid(): string | undefined
  set uuid(value: string)

  get created_at(): string | undefined
  get updated_at(): string | undefined
  set updated_at(value: string)

  // Static methods
  with: (relations: string[]) => OrderModelType
  select: (params: (keyof OrderJsonResponse)[] | RawBuilder<string> | string) => OrderModelType
  find: (id: number) => Promise<OrderModelType | undefined>
  first: () => Promise<OrderModelType | undefined>
  last: () => Promise<OrderModelType | undefined>
  firstOrFail: () => Promise<OrderModelType | undefined>
  all: () => Promise<OrderModelType[]>
  findOrFail: (id: number) => Promise<OrderModelType | undefined>
  findMany: (ids: number[]) => Promise<OrderModelType[]>
  latest: (column?: keyof OrdersTable) => Promise<OrderModelType | undefined>
  oldest: (column?: keyof OrdersTable) => Promise<OrderModelType | undefined>
  skip: (count: number) => OrderModelType
  take: (count: number) => OrderModelType
  where: <V = string>(column: keyof OrdersTable, ...args: [V] | [Operator, V]) => OrderModelType
  orWhere: (...conditions: [string, any][]) => OrderModelType
  whereNotIn: <V = number>(column: keyof OrdersTable, values: V[]) => OrderModelType
  whereBetween: <V = number>(column: keyof OrdersTable, range: [V, V]) => OrderModelType
  whereRef: (column: keyof OrdersTable, ...args: string[]) => OrderModelType
  when: (condition: boolean, callback: (query: OrderModelType) => OrderModelType) => OrderModelType
  whereNull: (column: keyof OrdersTable) => OrderModelType
  whereNotNull: (column: keyof OrdersTable) => OrderModelType
  whereLike: (column: keyof OrdersTable, value: string) => OrderModelType
  orderBy: (column: keyof OrdersTable, order: 'asc' | 'desc') => OrderModelType
  orderByAsc: (column: keyof OrdersTable) => OrderModelType
  orderByDesc: (column: keyof OrdersTable) => OrderModelType
  groupBy: (column: keyof OrdersTable) => OrderModelType
  having: <V = string>(column: keyof OrdersTable, operator: Operator, value: V) => OrderModelType
  inRandomOrder: () => OrderModelType
  whereColumn: (first: keyof OrdersTable, operator: Operator, second: keyof OrdersTable) => OrderModelType
  max: (field: keyof OrdersTable) => Promise<number>
  min: (field: keyof OrdersTable) => Promise<number>
  avg: (field: keyof OrdersTable) => Promise<number>
  sum: (field: keyof OrdersTable) => Promise<number>
  count: () => Promise<number>
  get: () => Promise<OrderModelType[]>
  pluck: <K extends keyof OrderModelType>(field: K) => Promise<OrderModelType[K][]>
  chunk: (size: number, callback: (models: OrderModelType[]) => Promise<void>) => Promise<void>
  paginate: (options?: { limit?: number, offset?: number, page?: number }) => Promise<{
    data: OrderModelType[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }>
  create: (newOrder: NewOrder) => Promise<OrderModelType>
  firstOrCreate: (search: Partial<OrdersTable>, values?: NewOrder) => Promise<OrderModelType>
  updateOrCreate: (search: Partial<OrdersTable>, values?: NewOrder) => Promise<OrderModelType>
  createMany: (newOrder: NewOrder[]) => Promise<void>
  forceCreate: (newOrder: NewOrder) => Promise<OrderModelType>
  remove: (id: number) => Promise<any>
  whereIn: <V = number>(column: keyof OrdersTable, values: V[]) => OrderModelType
  distinct: (column: keyof OrderJsonResponse) => OrderModelType
  join: (table: string, firstCol: string, secondCol: string) => OrderModelType

  // Instance methods
  createInstance: (data: OrderJsonResponse) => OrderModelType
  update: (newOrder: OrderUpdate) => Promise<OrderModelType | undefined>
  forceUpdate: (newOrder: OrderUpdate) => Promise<OrderModelType | undefined>
  save: () => Promise<OrderModelType>
  delete: () => Promise<number>
  toSearchableObject: () => Partial<OrderJsonResponse>
  toJSON: () => OrderJsonResponse
  parseResult: (model: OrderModelType) => OrderModelType

  customerBelong: () => Promise<CustomerModelType>
  couponBelong: () => Promise<CouponModelType>
}
