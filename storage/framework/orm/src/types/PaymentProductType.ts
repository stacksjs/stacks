import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'

export interface PaymentProductsTable {
  id: Generated<number>
  name: string
  description?: string
  key: string
  unit_price: number
  status?: string
  image?: string
  provider_id?: string
  uuid?: string
}

export type PaymentProductRead = PaymentProductsTable

export type PaymentProductWrite = Omit<PaymentProductsTable, 'created_at'> & {
  created_at?: string
}

export interface PaymentProductResponse {
  data: PaymentProductJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface PaymentProductJsonResponse extends Omit<Selectable<PaymentProductRead>, 'password'> {
  [key: string]: any
}

export type NewPaymentProduct = Insertable<PaymentProductWrite>
export type PaymentProductUpdate = Updateable<PaymentProductWrite>

export interface PaymentProductModelType {
  // Properties
  readonly id: number
  get name(): string
  set name(value: string)
  get description(): string | undefined
  set description(value: string)
  get key(): string
  set key(value: string)
  get unitPrice(): number
  set unitPrice(value: number)
  get status(): string | undefined
  set status(value: string)
  get image(): string | undefined
  set image(value: string)
  get providerId(): string | undefined
  set providerId(value: string)

  get uuid(): string | undefined
  set uuid(value: string)

  // Static methods
  with: (relations: string[]) => PaymentProductModelType
  select: (params: (keyof PaymentProductJsonResponse)[] | RawBuilder<string> | string) => PaymentProductModelType
  find: (id: number) => Promise<PaymentProductModelType | undefined>
  first: () => Promise<PaymentProductModelType | undefined>
  last: () => Promise<PaymentProductModelType | undefined>
  firstOrFail: () => Promise<PaymentProductModelType | undefined>
  all: () => Promise<PaymentProductModelType[]>
  findOrFail: (id: number) => Promise<PaymentProductModelType | undefined>
  findMany: (ids: number[]) => Promise<PaymentProductModelType[]>
  latest: (column?: keyof PaymentProductsTable) => Promise<PaymentProductModelType | undefined>
  oldest: (column?: keyof PaymentProductsTable) => Promise<PaymentProductModelType | undefined>
  skip: (count: number) => PaymentProductModelType
  take: (count: number) => PaymentProductModelType
  where: <V = string>(column: keyof PaymentProductsTable, ...args: [V] | [Operator, V]) => PaymentProductModelType
  orWhere: (...conditions: [string, any][]) => PaymentProductModelType
  whereNotIn: <V = number>(column: keyof PaymentProductsTable, values: V[]) => PaymentProductModelType
  whereBetween: <V = number>(column: keyof PaymentProductsTable, range: [V, V]) => PaymentProductModelType
  whereRef: (column: keyof PaymentProductsTable, ...args: string[]) => PaymentProductModelType
  when: (condition: boolean, callback: (query: PaymentProductModelType) => PaymentProductModelType) => PaymentProductModelType
  whereNull: (column: keyof PaymentProductsTable) => PaymentProductModelType
  whereNotNull: (column: keyof PaymentProductsTable) => PaymentProductModelType
  whereLike: (column: keyof PaymentProductsTable, value: string) => PaymentProductModelType
  orderBy: (column: keyof PaymentProductsTable, order: 'asc' | 'desc') => PaymentProductModelType
  orderByAsc: (column: keyof PaymentProductsTable) => PaymentProductModelType
  orderByDesc: (column: keyof PaymentProductsTable) => PaymentProductModelType
  groupBy: (column: keyof PaymentProductsTable) => PaymentProductModelType
  having: <V = string>(column: keyof PaymentProductsTable, operator: Operator, value: V) => PaymentProductModelType
  inRandomOrder: () => PaymentProductModelType
  whereColumn: (first: keyof PaymentProductsTable, operator: Operator, second: keyof PaymentProductsTable) => PaymentProductModelType
  max: (field: keyof PaymentProductsTable) => Promise<number>
  min: (field: keyof PaymentProductsTable) => Promise<number>
  avg: (field: keyof PaymentProductsTable) => Promise<number>
  sum: (field: keyof PaymentProductsTable) => Promise<number>
  count: () => Promise<number>
  get: () => Promise<PaymentProductModelType[]>
  pluck: <K extends keyof PaymentProductModelType>(field: K) => Promise<PaymentProductModelType[K][]>
  chunk: (size: number, callback: (models: PaymentProductModelType[]) => Promise<void>) => Promise<void>
  paginate: (options?: { limit?: number, offset?: number, page?: number }) => Promise<{
    data: PaymentProductModelType[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }>
  create: (newPaymentProduct: NewPaymentProduct) => Promise<PaymentProductModelType>
  firstOrCreate: (search: Partial<PaymentProductsTable>, values?: NewPaymentProduct) => Promise<PaymentProductModelType>
  updateOrCreate: (search: Partial<PaymentProductsTable>, values?: NewPaymentProduct) => Promise<PaymentProductModelType>
  createMany: (newPaymentProduct: NewPaymentProduct[]) => Promise<void>
  forceCreate: (newPaymentProduct: NewPaymentProduct) => Promise<PaymentProductModelType>
  remove: (id: number) => Promise<any>
  whereIn: <V = number>(column: keyof PaymentProductsTable, values: V[]) => PaymentProductModelType
  distinct: (column: keyof PaymentProductJsonResponse) => PaymentProductModelType
  join: (table: string, firstCol: string, secondCol: string) => PaymentProductModelType

  // Instance methods
  createInstance: (data: PaymentProductJsonResponse) => PaymentProductModelType
  update: (newPaymentProduct: PaymentProductUpdate) => Promise<PaymentProductModelType | undefined>
  forceUpdate: (newPaymentProduct: PaymentProductUpdate) => Promise<PaymentProductModelType | undefined>
  save: () => Promise<PaymentProductModelType>
  delete: () => Promise<number>
  toSearchableObject: () => Partial<PaymentProductJsonResponse>
  toJSON: () => PaymentProductJsonResponse
  parseResult: (model: PaymentProductModelType) => PaymentProductModelType

}
