import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'

export interface LicenseKeysTable {
  id: Generated<number>
  key: string
  template: string | string[]
  expiry_date: Date | string
  status?: string | string[]
  customer_id?: number
  product_id?: number
  order_id?: number
  uuid?: string
  created_at?: string
  updated_at?: string
}

export type LicenseKeyRead = LicenseKeysTable

export type LicenseKeyWrite = Omit<LicenseKeysTable, 'created_at'> & {
  created_at?: string
}

export interface LicenseKeyResponse {
  data: LicenseKeyJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface LicenseKeyJsonResponse extends Omit<Selectable<LicenseKeyRead>, 'password'> {
  [key: string]: any
}

export type NewLicenseKey = Insertable<LicenseKeyWrite>
export type LicenseKeyUpdate = Updateable<LicenseKeyWrite>

export interface LicenseKeyModelType {
  // Properties
  readonly id: number
  get key(): string
  set key(value: string)
  get template(): string | string[]
  set template(value: string | string[])
  get expiryDate(): Date | string
  set expiryDate(value: Date | string)
  get status(): string | string[] | undefined
  set status(value: string | string[])

  customerBelong: () => Promise<CustomerType>
  productBelong: () => Promise<ProductType>
  orderBelong: () => Promise<OrderType>
  get uuid(): string | undefined
  set uuid(value: string)

  get created_at(): string | undefined
  get updated_at(): string | undefined
  set updated_at(value: string)

  // Static methods
  with: (relations: string[]) => LicenseKeyModelType
  select: (params: (keyof LicenseKeyJsonResponse)[] | RawBuilder<string> | string) => LicenseKeyModelType
  find: (id: number) => Promise<LicenseKeyModelType | undefined>
  first: () => Promise<LicenseKeyModelType | undefined>
  last: () => Promise<LicenseKeyModelType | undefined>
  firstOrFail: () => Promise<LicenseKeyModelType | undefined>
  all: () => Promise<LicenseKeyModelType[]>
  findOrFail: (id: number) => Promise<LicenseKeyModelType | undefined>
  findMany: (ids: number[]) => Promise<LicenseKeyModelType[]>
  latest: (column?: keyof LicenseKeysTable) => Promise<LicenseKeyModelType | undefined>
  oldest: (column?: keyof LicenseKeysTable) => Promise<LicenseKeyModelType | undefined>
  skip: (count: number) => LicenseKeyModelType
  take: (count: number) => LicenseKeyModelType
  where: <V = string>(column: keyof LicenseKeysTable, ...args: [V] | [Operator, V]) => LicenseKeyModelType
  orWhere: (...conditions: [string, any][]) => LicenseKeyModelType
  whereNotIn: <V = number>(column: keyof LicenseKeysTable, values: V[]) => LicenseKeyModelType
  whereBetween: <V = number>(column: keyof LicenseKeysTable, range: [V, V]) => LicenseKeyModelType
  whereRef: (column: keyof LicenseKeysTable, ...args: string[]) => LicenseKeyModelType
  when: (condition: boolean, callback: (query: LicenseKeyModelType) => LicenseKeyModelType) => LicenseKeyModelType
  whereNull: (column: keyof LicenseKeysTable) => LicenseKeyModelType
  whereNotNull: (column: keyof LicenseKeysTable) => LicenseKeyModelType
  whereLike: (column: keyof LicenseKeysTable, value: string) => LicenseKeyModelType
  orderBy: (column: keyof LicenseKeysTable, order: 'asc' | 'desc') => LicenseKeyModelType
  orderByAsc: (column: keyof LicenseKeysTable) => LicenseKeyModelType
  orderByDesc: (column: keyof LicenseKeysTable) => LicenseKeyModelType
  groupBy: (column: keyof LicenseKeysTable) => LicenseKeyModelType
  having: <V = string>(column: keyof LicenseKeysTable, operator: Operator, value: V) => LicenseKeyModelType
  inRandomOrder: () => LicenseKeyModelType
  whereColumn: (first: keyof LicenseKeysTable, operator: Operator, second: keyof LicenseKeysTable) => LicenseKeyModelType
  max: (field: keyof LicenseKeysTable) => Promise<number>
  min: (field: keyof LicenseKeysTable) => Promise<number>
  avg: (field: keyof LicenseKeysTable) => Promise<number>
  sum: (field: keyof LicenseKeysTable) => Promise<number>
  count: () => Promise<number>
  get: () => Promise<LicenseKeyModelType[]>
  pluck: <K extends keyof LicenseKeyModelType>(field: K) => Promise<LicenseKeyModelType[K][]>
  chunk: (size: number, callback: (models: LicenseKeyModelType[]) => Promise<void>) => Promise<void>
  paginate: (options?: { limit?: number, offset?: number, page?: number }) => Promise<{
    data: LicenseKeyModelType[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }>
  create: (newLicenseKey: NewLicenseKey) => Promise<LicenseKeyModelType>
  firstOrCreate: (search: Partial<LicenseKeysTable>, values?: NewLicenseKey) => Promise<LicenseKeyModelType>
  updateOrCreate: (search: Partial<LicenseKeysTable>, values?: NewLicenseKey) => Promise<LicenseKeyModelType>
  createMany: (newLicenseKey: NewLicenseKey[]) => Promise<void>
  forceCreate: (newLicenseKey: NewLicenseKey) => Promise<LicenseKeyModelType>
  remove: (id: number) => Promise<any>
  whereIn: <V = number>(column: keyof LicenseKeysTable, values: V[]) => LicenseKeyModelType
  distinct: (column: keyof LicenseKeyJsonResponse) => LicenseKeyModelType
  join: (table: string, firstCol: string, secondCol: string) => LicenseKeyModelType

  // Instance methods
  createInstance: (data: LicenseKeyJsonResponse) => LicenseKeyModelType
  update: (newLicenseKey: LicenseKeyUpdate) => Promise<LicenseKeyModelType | undefined>
  forceUpdate: (newLicenseKey: LicenseKeyUpdate) => Promise<LicenseKeyModelType | undefined>
  save: () => Promise<LicenseKeyModelType>
  delete: () => Promise<number>
  toSearchableObject: () => Partial<LicenseKeyJsonResponse>
  toJSON: () => LicenseKeyJsonResponse
  parseResult: (model: LicenseKeyModelType) => LicenseKeyModelType

  customerBelong: () => Promise<CustomerType>
  productBelong: () => Promise<ProductType>
  orderBelong: () => Promise<OrderType>
}
