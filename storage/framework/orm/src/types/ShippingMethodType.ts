import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import type { ShippingRateModelType } from './ShippingRateType'
import type { ShippingZoneModelType } from './ShippingZoneType'

export interface ShippingMethodsTable {
  id: Generated<number>
  name: string
  description?: string
  base_rate: number
  free_shipping?: number
  status: string | string[]
  uuid?: string
  created_at?: string
  updated_at?: string
}

export type ShippingMethodRead = ShippingMethodsTable

export type ShippingMethodWrite = Omit<ShippingMethodsTable, 'created_at'> & {
  created_at?: string
}

export interface ShippingMethodResponse {
  data: ShippingMethodJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface ShippingMethodJsonResponse extends Omit<Selectable<ShippingMethodRead>, 'password'> {
  [key: string]: any
}

export type NewShippingMethod = Insertable<ShippingMethodWrite>
export type ShippingMethodUpdate = Updateable<ShippingMethodWrite>

export interface ShippingMethodModelType {
  // Properties
  readonly id: number
  get name(): string
  set name(value: string)
  get description(): string | undefined
  set description(value: string)
  get baseRate(): number
  set baseRate(value: number)
  get freeShipping(): number | undefined
  set freeShipping(value: number)
  get status(): string | string[]
  set status(value: string | string[])
  get shipping_zone(): ShippingZoneModelType[] | []
  get shipping_rate(): ShippingRateModelType[] | []

  get uuid(): string | undefined
  set uuid(value: string)

  get created_at(): string | undefined
  get updated_at(): string | undefined
  set updated_at(value: string)

  // Static methods
  with: (relations: string[]) => ShippingMethodModelType
  select: (params: (keyof ShippingMethodJsonResponse)[] | RawBuilder<string> | string) => ShippingMethodModelType
  find: (id: number) => Promise<ShippingMethodModelType | undefined>
  first: () => Promise<ShippingMethodModelType | undefined>
  last: () => Promise<ShippingMethodModelType | undefined>
  firstOrFail: () => Promise<ShippingMethodModelType | undefined>
  all: () => Promise<ShippingMethodModelType[]>
  findOrFail: (id: number) => Promise<ShippingMethodModelType | undefined>
  findMany: (ids: number[]) => Promise<ShippingMethodModelType[]>
  latest: (column?: keyof ShippingMethodsTable) => Promise<ShippingMethodModelType | undefined>
  oldest: (column?: keyof ShippingMethodsTable) => Promise<ShippingMethodModelType | undefined>
  skip: (count: number) => ShippingMethodModelType
  take: (count: number) => ShippingMethodModelType
  where: <V = string>(column: keyof ShippingMethodsTable, ...args: [V] | [Operator, V]) => ShippingMethodModelType
  orWhere: (...conditions: [string, any][]) => ShippingMethodModelType
  whereNotIn: <V = number>(column: keyof ShippingMethodsTable, values: V[]) => ShippingMethodModelType
  whereBetween: <V = number>(column: keyof ShippingMethodsTable, range: [V, V]) => ShippingMethodModelType
  whereRef: (column: keyof ShippingMethodsTable, ...args: string[]) => ShippingMethodModelType
  when: (condition: boolean, callback: (query: ShippingMethodModelType) => ShippingMethodModelType) => ShippingMethodModelType
  whereNull: (column: keyof ShippingMethodsTable) => ShippingMethodModelType
  whereNotNull: (column: keyof ShippingMethodsTable) => ShippingMethodModelType
  whereLike: (column: keyof ShippingMethodsTable, value: string) => ShippingMethodModelType
  orderBy: (column: keyof ShippingMethodsTable, order: 'asc' | 'desc') => ShippingMethodModelType
  orderByAsc: (column: keyof ShippingMethodsTable) => ShippingMethodModelType
  orderByDesc: (column: keyof ShippingMethodsTable) => ShippingMethodModelType
  groupBy: (column: keyof ShippingMethodsTable) => ShippingMethodModelType
  having: <V = string>(column: keyof ShippingMethodsTable, operator: Operator, value: V) => ShippingMethodModelType
  inRandomOrder: () => ShippingMethodModelType
  whereColumn: (first: keyof ShippingMethodsTable, operator: Operator, second: keyof ShippingMethodsTable) => ShippingMethodModelType
  max: (field: keyof ShippingMethodsTable) => Promise<number>
  min: (field: keyof ShippingMethodsTable) => Promise<number>
  avg: (field: keyof ShippingMethodsTable) => Promise<number>
  sum: (field: keyof ShippingMethodsTable) => Promise<number>
  count: () => Promise<number>
  get: () => Promise<ShippingMethodModelType[]>
  pluck: <K extends keyof ShippingMethodModelType>(field: K) => Promise<ShippingMethodModelType[K][]>
  chunk: (size: number, callback: (models: ShippingMethodModelType[]) => Promise<void>) => Promise<void>
  paginate: (options?: { limit?: number, offset?: number, page?: number }) => Promise<{
    data: ShippingMethodModelType[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }>
  create: (newShippingMethod: NewShippingMethod) => Promise<ShippingMethodModelType>
  firstOrCreate: (search: Partial<ShippingMethodsTable>, values?: NewShippingMethod) => Promise<ShippingMethodModelType>
  updateOrCreate: (search: Partial<ShippingMethodsTable>, values?: NewShippingMethod) => Promise<ShippingMethodModelType>
  createMany: (newShippingMethod: NewShippingMethod[]) => Promise<void>
  forceCreate: (newShippingMethod: NewShippingMethod) => Promise<ShippingMethodModelType>
  remove: (id: number) => Promise<any>
  whereIn: <V = number>(column: keyof ShippingMethodsTable, values: V[]) => ShippingMethodModelType
  distinct: (column: keyof ShippingMethodJsonResponse) => ShippingMethodModelType
  join: (table: string, firstCol: string, secondCol: string) => ShippingMethodModelType

  // Instance methods
  createInstance: (data: ShippingMethodJsonResponse) => ShippingMethodModelType
  update: (newShippingMethod: ShippingMethodUpdate) => Promise<ShippingMethodModelType | undefined>
  forceUpdate: (newShippingMethod: ShippingMethodUpdate) => Promise<ShippingMethodModelType | undefined>
  save: () => Promise<ShippingMethodModelType>
  delete: () => Promise<number>
  toSearchableObject: () => Partial<ShippingMethodJsonResponse>
  toJSON: () => ShippingMethodJsonResponse
  parseResult: (model: ShippingMethodModelType) => ShippingMethodModelType

}
