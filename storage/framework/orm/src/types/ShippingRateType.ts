import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import type { ShippingMethodModelType } from './ShippingMethodType'
import type { ShippingZoneModelType } from './ShippingZoneType'

export interface ShippingRatesTable {
  id: Generated<number>
  weight_from: number
  weight_to: number
  rate: number
  uuid?: string
  created_at?: string
  updated_at?: string
}

export type ShippingRateRead = ShippingRatesTable

export type ShippingRateWrite = Omit<ShippingRatesTable, 'created_at'> & {
  created_at?: string
}

export interface ShippingRateResponse {
  data: ShippingRateJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface ShippingRateJsonResponse extends Omit<Selectable<ShippingRateRead>, 'password'> {
  [key: string]: any
}

export type NewShippingRate = Insertable<ShippingRateWrite>
export type ShippingRateUpdate = Updateable<ShippingRateWrite>

export interface ShippingRateModelType {
  // Properties
  readonly id: number
  get weightFrom(): number
  set weightFrom(value: number)
  get weightTo(): number
  set weightTo(value: number)
  get rate(): number
  set rate(value: number)
  get shipping_method(): ShippingMethodModelType | undefined
  get shipping_zone(): ShippingZoneModelType | undefined

  get uuid(): string | undefined
  set uuid(value: string)

  get created_at(): string | undefined
  get updated_at(): string | undefined
  set updated_at(value: string)

  // Static methods
  with: (relations: string[]) => ShippingRateModelType
  select: (params: (keyof ShippingRateJsonResponse)[] | RawBuilder<string> | string) => ShippingRateModelType
  find: (id: number) => Promise<ShippingRateModelType | undefined>
  first: () => Promise<ShippingRateModelType | undefined>
  last: () => Promise<ShippingRateModelType | undefined>
  firstOrFail: () => Promise<ShippingRateModelType | undefined>
  all: () => Promise<ShippingRateModelType[]>
  findOrFail: (id: number) => Promise<ShippingRateModelType | undefined>
  findMany: (ids: number[]) => Promise<ShippingRateModelType[]>
  latest: (column?: keyof ShippingRatesTable) => Promise<ShippingRateModelType | undefined>
  oldest: (column?: keyof ShippingRatesTable) => Promise<ShippingRateModelType | undefined>
  skip: (count: number) => ShippingRateModelType
  take: (count: number) => ShippingRateModelType
  where: <V = string>(column: keyof ShippingRatesTable, ...args: [V] | [Operator, V]) => ShippingRateModelType
  orWhere: (...conditions: [string, any][]) => ShippingRateModelType
  whereNotIn: <V = number>(column: keyof ShippingRatesTable, values: V[]) => ShippingRateModelType
  whereBetween: <V = number>(column: keyof ShippingRatesTable, range: [V, V]) => ShippingRateModelType
  whereRef: (column: keyof ShippingRatesTable, ...args: string[]) => ShippingRateModelType
  when: (condition: boolean, callback: (query: ShippingRateModelType) => ShippingRateModelType) => ShippingRateModelType
  whereNull: (column: keyof ShippingRatesTable) => ShippingRateModelType
  whereNotNull: (column: keyof ShippingRatesTable) => ShippingRateModelType
  whereLike: (column: keyof ShippingRatesTable, value: string) => ShippingRateModelType
  orderBy: (column: keyof ShippingRatesTable, order: 'asc' | 'desc') => ShippingRateModelType
  orderByAsc: (column: keyof ShippingRatesTable) => ShippingRateModelType
  orderByDesc: (column: keyof ShippingRatesTable) => ShippingRateModelType
  groupBy: (column: keyof ShippingRatesTable) => ShippingRateModelType
  having: <V = string>(column: keyof ShippingRatesTable, operator: Operator, value: V) => ShippingRateModelType
  inRandomOrder: () => ShippingRateModelType
  whereColumn: (first: keyof ShippingRatesTable, operator: Operator, second: keyof ShippingRatesTable) => ShippingRateModelType
  max: (field: keyof ShippingRatesTable) => Promise<number>
  min: (field: keyof ShippingRatesTable) => Promise<number>
  avg: (field: keyof ShippingRatesTable) => Promise<number>
  sum: (field: keyof ShippingRatesTable) => Promise<number>
  count: () => Promise<number>
  get: () => Promise<ShippingRateModelType[]>
  pluck: <K extends keyof ShippingRateModelType>(field: K) => Promise<ShippingRateModelType[K][]>
  chunk: (size: number, callback: (models: ShippingRateModelType[]) => Promise<void>) => Promise<void>
  paginate: (options?: { limit?: number, offset?: number, page?: number }) => Promise<{
    data: ShippingRateModelType[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }>
  create: (newShippingRate: NewShippingRate) => Promise<ShippingRateModelType>
  firstOrCreate: (search: Partial<ShippingRatesTable>, values?: NewShippingRate) => Promise<ShippingRateModelType>
  updateOrCreate: (search: Partial<ShippingRatesTable>, values?: NewShippingRate) => Promise<ShippingRateModelType>
  createMany: (newShippingRate: NewShippingRate[]) => Promise<void>
  forceCreate: (newShippingRate: NewShippingRate) => Promise<ShippingRateModelType>
  remove: (id: number) => Promise<any>
  whereIn: <V = number>(column: keyof ShippingRatesTable, values: V[]) => ShippingRateModelType
  distinct: (column: keyof ShippingRateJsonResponse) => ShippingRateModelType
  join: (table: string, firstCol: string, secondCol: string) => ShippingRateModelType

  // Instance methods
  createInstance: (data: ShippingRateJsonResponse) => ShippingRateModelType
  update: (newShippingRate: ShippingRateUpdate) => Promise<ShippingRateModelType | undefined>
  forceUpdate: (newShippingRate: ShippingRateUpdate) => Promise<ShippingRateModelType | undefined>
  save: () => Promise<ShippingRateModelType>
  delete: () => Promise<number>
  toSearchableObject: () => Partial<ShippingRateJsonResponse>
  toJSON: () => ShippingRateJsonResponse
  parseResult: (model: ShippingRateModelType) => ShippingRateModelType

  shippingMethodBelong: () => Promise<ShippingMethodModelType>
  shippingZoneBelong: () => Promise<ShippingZoneModelType>
}
