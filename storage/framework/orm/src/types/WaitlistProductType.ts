import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'

export interface WaitlistProductsTable {
  id: Generated<number>
  name: string
  email: string
  phone?: string
  quantity: number
  notification_preference: string | string[]
  source: string
  notes?: string
  status: string | string[]
  notified_at?: unix
  purchased_at?: unix
  cancelled_at?: unix
  product_id?: number
  customer_id?: number
  uuid?: string
  created_at?: string
  updated_at?: string
}

export type WaitlistProductRead = WaitlistProductsTable

export type WaitlistProductWrite = Omit<WaitlistProductsTable, 'created_at'> & {
  created_at?: string
}

export interface WaitlistProductResponse {
  data: WaitlistProductJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface WaitlistProductJsonResponse extends Omit<Selectable<WaitlistProductRead>, 'password'> {
  [key: string]: any
}

export type NewWaitlistProduct = Insertable<WaitlistProductWrite>
export type WaitlistProductUpdate = Updateable<WaitlistProductWrite>

export interface WaitlistProductModelType {
  // Properties
  readonly id: number
  get name(): string
  set name(value: string)
  get email(): string
  set email(value: string)
  get phone(): string | undefined
  set phone(value: string)
  get quantity(): number
  set quantity(value: number)
  get notificationPreference(): string | string[]
  set notificationPreference(value: string | string[])
  get source(): string
  set source(value: string)
  get notes(): string | undefined
  set notes(value: string)
  get status(): string | string[]
  set status(value: string | string[])
  get notifiedAt(): unix | undefined
  set notifiedAt(value: unix)
  get purchasedAt(): unix | undefined
  set purchasedAt(value: unix)
  get cancelledAt(): unix | undefined
  set cancelledAt(value: unix)

  productBelong: () => Promise<ProductType>
  customerBelong: () => Promise<CustomerType>
  get uuid(): string | undefined
  set uuid(value: string)

  get created_at(): string | undefined
  get updated_at(): string | undefined
  set updated_at(value: string)

  // Static methods
  with: (relations: string[]) => WaitlistProductModelType
  select: (params: (keyof WaitlistProductJsonResponse)[] | RawBuilder<string> | string) => WaitlistProductModelType
  find: (id: number) => Promise<WaitlistProductModelType | undefined>
  first: () => Promise<WaitlistProductModelType | undefined>
  last: () => Promise<WaitlistProductModelType | undefined>
  firstOrFail: () => Promise<WaitlistProductModelType | undefined>
  all: () => Promise<WaitlistProductModelType[]>
  findOrFail: (id: number) => Promise<WaitlistProductModelType | undefined>
  findMany: (ids: number[]) => Promise<WaitlistProductModelType[]>
  latest: (column?: keyof WaitlistProductsTable) => Promise<WaitlistProductModelType | undefined>
  oldest: (column?: keyof WaitlistProductsTable) => Promise<WaitlistProductModelType | undefined>
  skip: (count: number) => WaitlistProductModelType
  take: (count: number) => WaitlistProductModelType
  where: <V = string>(column: keyof WaitlistProductsTable, ...args: [V] | [Operator, V]) => WaitlistProductModelType
  orWhere: (...conditions: [string, any][]) => WaitlistProductModelType
  whereNotIn: <V = number>(column: keyof WaitlistProductsTable, values: V[]) => WaitlistProductModelType
  whereBetween: <V = number>(column: keyof WaitlistProductsTable, range: [V, V]) => WaitlistProductModelType
  whereRef: (column: keyof WaitlistProductsTable, ...args: string[]) => WaitlistProductModelType
  when: (condition: boolean, callback: (query: WaitlistProductModelType) => WaitlistProductModelType) => WaitlistProductModelType
  whereNull: (column: keyof WaitlistProductsTable) => WaitlistProductModelType
  whereNotNull: (column: keyof WaitlistProductsTable) => WaitlistProductModelType
  whereLike: (column: keyof WaitlistProductsTable, value: string) => WaitlistProductModelType
  orderBy: (column: keyof WaitlistProductsTable, order: 'asc' | 'desc') => WaitlistProductModelType
  orderByAsc: (column: keyof WaitlistProductsTable) => WaitlistProductModelType
  orderByDesc: (column: keyof WaitlistProductsTable) => WaitlistProductModelType
  groupBy: (column: keyof WaitlistProductsTable) => WaitlistProductModelType
  having: <V = string>(column: keyof WaitlistProductsTable, operator: Operator, value: V) => WaitlistProductModelType
  inRandomOrder: () => WaitlistProductModelType
  whereColumn: (first: keyof WaitlistProductsTable, operator: Operator, second: keyof WaitlistProductsTable) => WaitlistProductModelType
  max: (field: keyof WaitlistProductsTable) => Promise<number>
  min: (field: keyof WaitlistProductsTable) => Promise<number>
  avg: (field: keyof WaitlistProductsTable) => Promise<number>
  sum: (field: keyof WaitlistProductsTable) => Promise<number>
  count: () => Promise<number>
  get: () => Promise<WaitlistProductModelType[]>
  pluck: <K extends keyof WaitlistProductModelType>(field: K) => Promise<WaitlistProductModelType[K][]>
  chunk: (size: number, callback: (models: WaitlistProductModelType[]) => Promise<void>) => Promise<void>
  paginate: (options?: { limit?: number, offset?: number, page?: number }) => Promise<{
    data: WaitlistProductModelType[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }>
  create: (newWaitlistProduct: NewWaitlistProduct) => Promise<WaitlistProductModelType>
  firstOrCreate: (search: Partial<WaitlistProductsTable>, values?: NewWaitlistProduct) => Promise<WaitlistProductModelType>
  updateOrCreate: (search: Partial<WaitlistProductsTable>, values?: NewWaitlistProduct) => Promise<WaitlistProductModelType>
  createMany: (newWaitlistProduct: NewWaitlistProduct[]) => Promise<void>
  forceCreate: (newWaitlistProduct: NewWaitlistProduct) => Promise<WaitlistProductModelType>
  remove: (id: number) => Promise<any>
  whereIn: <V = number>(column: keyof WaitlistProductsTable, values: V[]) => WaitlistProductModelType
  distinct: (column: keyof WaitlistProductJsonResponse) => WaitlistProductModelType
  join: (table: string, firstCol: string, secondCol: string) => WaitlistProductModelType

  // Instance methods
  createInstance: (data: WaitlistProductJsonResponse) => WaitlistProductModelType
  update: (newWaitlistProduct: WaitlistProductUpdate) => Promise<WaitlistProductModelType | undefined>
  forceUpdate: (newWaitlistProduct: WaitlistProductUpdate) => Promise<WaitlistProductModelType | undefined>
  save: () => Promise<WaitlistProductModelType>
  delete: () => Promise<number>
  toSearchableObject: () => Partial<WaitlistProductJsonResponse>
  toJSON: () => WaitlistProductJsonResponse
  parseResult: (model: WaitlistProductModelType) => WaitlistProductModelType

  productBelong: () => Promise<ProductType>
  customerBelong: () => Promise<CustomerType>
}
