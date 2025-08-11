import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import type { ShippingMethodModelType } from './ShippingMethodType'
import type { ShippingRateModelType } from './ShippingRateType'

export interface ShippingZonesTable {
  id: Generated<number>
  name: string
  countries?: string
  regions?: string
  postal_codes?: string
  status: string | string[]
  uuid?: string
  created_at?: string
  updated_at?: string
}

export type ShippingZoneRead = ShippingZonesTable

export type ShippingZoneWrite = Omit<ShippingZonesTable, 'created_at'> & {
  created_at?: string
}

export interface ShippingZoneResponse {
  data: ShippingZoneJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface ShippingZoneJsonResponse extends Omit<Selectable<ShippingZoneRead>, 'password'> {
  [key: string]: any
}

export type NewShippingZone = Insertable<ShippingZoneWrite>
export type ShippingZoneUpdate = Updateable<ShippingZoneWrite>

export interface ShippingZoneModelType {
  // Properties
  readonly id: number
  get name(): string
  set name(value: string)
  get countries(): string | undefined
  set countries(value: string)
  get regions(): string | undefined
  set regions(value: string)
  get postalCodes(): string | undefined
  set postalCodes(value: string)
  get status(): string | string[]
  set status(value: string | string[])
  get shipping_rate(): ShippingRateModelType[] | []
  get shipping_method(): ShippingMethodModelType | undefined

  get uuid(): string | undefined
  set uuid(value: string)

  get created_at(): string | undefined
  get updated_at(): string | undefined
  set updated_at(value: string)

  // Static methods
  with: (relations: string[]) => ShippingZoneModelType
  select: (params: (keyof ShippingZoneJsonResponse)[] | RawBuilder<string> | string) => ShippingZoneModelType
  find: (id: number) => Promise<ShippingZoneModelType | undefined>
  first: () => Promise<ShippingZoneModelType | undefined>
  last: () => Promise<ShippingZoneModelType | undefined>
  firstOrFail: () => Promise<ShippingZoneModelType | undefined>
  all: () => Promise<ShippingZoneModelType[]>
  findOrFail: (id: number) => Promise<ShippingZoneModelType | undefined>
  findMany: (ids: number[]) => Promise<ShippingZoneModelType[]>
  latest: (column?: keyof ShippingZonesTable) => Promise<ShippingZoneModelType | undefined>
  oldest: (column?: keyof ShippingZonesTable) => Promise<ShippingZoneModelType | undefined>
  skip: (count: number) => ShippingZoneModelType
  take: (count: number) => ShippingZoneModelType
  where: <V = string>(column: keyof ShippingZonesTable, ...args: [V] | [Operator, V]) => ShippingZoneModelType
  orWhere: (...conditions: [string, any][]) => ShippingZoneModelType
  whereNotIn: <V = number>(column: keyof ShippingZonesTable, values: V[]) => ShippingZoneModelType
  whereBetween: <V = number>(column: keyof ShippingZonesTable, range: [V, V]) => ShippingZoneModelType
  whereRef: (column: keyof ShippingZonesTable, ...args: string[]) => ShippingZoneModelType
  when: (condition: boolean, callback: (query: ShippingZoneModelType) => ShippingZoneModelType) => ShippingZoneModelType
  whereNull: (column: keyof ShippingZonesTable) => ShippingZoneModelType
  whereNotNull: (column: keyof ShippingZonesTable) => ShippingZoneModelType
  whereLike: (column: keyof ShippingZonesTable, value: string) => ShippingZoneModelType
  orderBy: (column: keyof ShippingZonesTable, order: 'asc' | 'desc') => ShippingZoneModelType
  orderByAsc: (column: keyof ShippingZonesTable) => ShippingZoneModelType
  orderByDesc: (column: keyof ShippingZonesTable) => ShippingZoneModelType
  groupBy: (column: keyof ShippingZonesTable) => ShippingZoneModelType
  having: <V = string>(column: keyof ShippingZonesTable, operator: Operator, value: V) => ShippingZoneModelType
  inRandomOrder: () => ShippingZoneModelType
  whereColumn: (first: keyof ShippingZonesTable, operator: Operator, second: keyof ShippingZonesTable) => ShippingZoneModelType
  max: (field: keyof ShippingZonesTable) => Promise<number>
  min: (field: keyof ShippingZonesTable) => Promise<number>
  avg: (field: keyof ShippingZonesTable) => Promise<number>
  sum: (field: keyof ShippingZonesTable) => Promise<number>
  count: () => Promise<number>
  get: () => Promise<ShippingZoneModelType[]>
  pluck: <K extends keyof ShippingZoneModelType>(field: K) => Promise<ShippingZoneModelType[K][]>
  chunk: (size: number, callback: (models: ShippingZoneModelType[]) => Promise<void>) => Promise<void>
  paginate: (options?: { limit?: number, offset?: number, page?: number }) => Promise<{
    data: ShippingZoneModelType[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }>
  create: (newShippingZone: NewShippingZone) => Promise<ShippingZoneModelType>
  firstOrCreate: (search: Partial<ShippingZonesTable>, values?: NewShippingZone) => Promise<ShippingZoneModelType>
  updateOrCreate: (search: Partial<ShippingZonesTable>, values?: NewShippingZone) => Promise<ShippingZoneModelType>
  createMany: (newShippingZone: NewShippingZone[]) => Promise<void>
  forceCreate: (newShippingZone: NewShippingZone) => Promise<ShippingZoneModelType>
  remove: (id: number) => Promise<any>
  whereIn: <V = number>(column: keyof ShippingZonesTable, values: V[]) => ShippingZoneModelType
  distinct: (column: keyof ShippingZoneJsonResponse) => ShippingZoneModelType
  join: (table: string, firstCol: string, secondCol: string) => ShippingZoneModelType

  // Instance methods
  createInstance: (data: ShippingZoneJsonResponse) => ShippingZoneModelType
  update: (newShippingZone: ShippingZoneUpdate) => Promise<ShippingZoneModelType | undefined>
  forceUpdate: (newShippingZone: ShippingZoneUpdate) => Promise<ShippingZoneModelType | undefined>
  save: () => Promise<ShippingZoneModelType>
  delete: () => Promise<number>
  toSearchableObject: () => Partial<ShippingZoneJsonResponse>
  toJSON: () => ShippingZoneJsonResponse
  parseResult: (model: ShippingZoneModelType) => ShippingZoneModelType

  shippingMethodBelong: () => Promise<ShippingMethodModelType>
}
