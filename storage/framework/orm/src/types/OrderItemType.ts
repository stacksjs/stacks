import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import type { OrderModelType } from './OrderType'
import type { ProductModelType } from './ProductType'

export interface OrderItemsTable {
  id: Generated<number>
  quantity: number
  price: number
  special_instructions?: string
  created_at?: string
  updated_at?: string
}

export type OrderItemRead = OrderItemsTable

export type OrderItemWrite = Omit<OrderItemsTable, 'created_at'> & {
  created_at?: string
}

export interface OrderItemResponse {
  data: OrderItemJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface OrderItemJsonResponse extends Omit<Selectable<OrderItemRead>, 'password'> {
  [key: string]: any
}

export type NewOrderItem = Insertable<OrderItemWrite>
export type OrderItemUpdate = Updateable<OrderItemWrite>

export interface OrderItemModelType {
  // Properties
  readonly id: number
  get quantity(): number
  set quantity(value: number)
  get price(): number
  set price(value: number)
  get specialInstructions(): string | undefined
  set specialInstructions(value: string)
  get order(): OrderModelType | undefined
  get product(): ProductModelType | undefined

  get created_at(): string | undefined
  get updated_at(): string | undefined
  set updated_at(value: string)

  // Static methods
  with: (relations: string[]) => OrderItemModelType
  select: (params: (keyof OrderItemJsonResponse)[] | RawBuilder<string> | string) => OrderItemModelType
  find: (id: number) => Promise<OrderItemModelType | undefined>
  first: () => Promise<OrderItemModelType | undefined>
  last: () => Promise<OrderItemModelType | undefined>
  firstOrFail: () => Promise<OrderItemModelType | undefined>
  all: () => Promise<OrderItemModelType[]>
  findOrFail: (id: number) => Promise<OrderItemModelType | undefined>
  findMany: (ids: number[]) => Promise<OrderItemModelType[]>
  latest: (column?: keyof OrderItemsTable) => Promise<OrderItemModelType | undefined>
  oldest: (column?: keyof OrderItemsTable) => Promise<OrderItemModelType | undefined>
  skip: (count: number) => OrderItemModelType
  take: (count: number) => OrderItemModelType
  where: <V = string>(column: keyof OrderItemsTable, ...args: [V] | [Operator, V]) => OrderItemModelType
  orWhere: (...conditions: [string, any][]) => OrderItemModelType
  whereNotIn: <V = number>(column: keyof OrderItemsTable, values: V[]) => OrderItemModelType
  whereBetween: <V = number>(column: keyof OrderItemsTable, range: [V, V]) => OrderItemModelType
  whereRef: (column: keyof OrderItemsTable, ...args: string[]) => OrderItemModelType
  when: (condition: boolean, callback: (query: OrderItemModelType) => OrderItemModelType) => OrderItemModelType
  whereNull: (column: keyof OrderItemsTable) => OrderItemModelType
  whereNotNull: (column: keyof OrderItemsTable) => OrderItemModelType
  whereLike: (column: keyof OrderItemsTable, value: string) => OrderItemModelType
  orderBy: (column: keyof OrderItemsTable, order: 'asc' | 'desc') => OrderItemModelType
  orderByAsc: (column: keyof OrderItemsTable) => OrderItemModelType
  orderByDesc: (column: keyof OrderItemsTable) => OrderItemModelType
  groupBy: (column: keyof OrderItemsTable) => OrderItemModelType
  having: <V = string>(column: keyof OrderItemsTable, operator: Operator, value: V) => OrderItemModelType
  inRandomOrder: () => OrderItemModelType
  whereColumn: (first: keyof OrderItemsTable, operator: Operator, second: keyof OrderItemsTable) => OrderItemModelType
  max: (field: keyof OrderItemsTable) => Promise<number>
  min: (field: keyof OrderItemsTable) => Promise<number>
  avg: (field: keyof OrderItemsTable) => Promise<number>
  sum: (field: keyof OrderItemsTable) => Promise<number>
  count: () => Promise<number>
  get: () => Promise<OrderItemModelType[]>
  pluck: <K extends keyof OrderItemModelType>(field: K) => Promise<OrderItemModelType[K][]>
  chunk: (size: number, callback: (models: OrderItemModelType[]) => Promise<void>) => Promise<void>
  paginate: (options?: { limit?: number, offset?: number, page?: number }) => Promise<{
    data: OrderItemModelType[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }>
  create: (newOrderItem: NewOrderItem) => Promise<OrderItemModelType>
  firstOrCreate: (search: Partial<OrderItemsTable>, values?: NewOrderItem) => Promise<OrderItemModelType>
  updateOrCreate: (search: Partial<OrderItemsTable>, values?: NewOrderItem) => Promise<OrderItemModelType>
  createMany: (newOrderItem: NewOrderItem[]) => Promise<void>
  forceCreate: (newOrderItem: NewOrderItem) => Promise<OrderItemModelType>
  remove: (id: number) => Promise<any>
  whereIn: <V = number>(column: keyof OrderItemsTable, values: V[]) => OrderItemModelType
  distinct: (column: keyof OrderItemJsonResponse) => OrderItemModelType
  join: (table: string, firstCol: string, secondCol: string) => OrderItemModelType

  // Instance methods
  createInstance: (data: OrderItemJsonResponse) => OrderItemModelType
  update: (newOrderItem: OrderItemUpdate) => Promise<OrderItemModelType | undefined>
  forceUpdate: (newOrderItem: OrderItemUpdate) => Promise<OrderItemModelType | undefined>
  save: () => Promise<OrderItemModelType>
  delete: () => Promise<number>
  toSearchableObject: () => Partial<OrderItemJsonResponse>
  toJSON: () => OrderItemJsonResponse
  parseResult: (model: OrderItemModelType) => OrderItemModelType

  orderBelong: () => Promise<OrderModelType>
  productBelong: () => Promise<ProductModelType>
}
