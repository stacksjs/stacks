import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import type { ProductModelType } from './ProductType'

export interface ManufacturersTable {
  id: Generated<number>
  manufacturer: string
  description?: string
  country: string
  featured?: boolean
  uuid?: string
  created_at?: string
  updated_at?: string
}

export type ManufacturerRead = ManufacturersTable

export type ManufacturerWrite = Omit<ManufacturersTable, 'created_at'> & {
  created_at?: string
}

export interface ManufacturerResponse {
  data: ManufacturerJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface ManufacturerJsonResponse extends Omit<Selectable<ManufacturerRead>, 'password'> {
  [key: string]: any
}

export type NewManufacturer = Insertable<ManufacturerWrite>
export type ManufacturerUpdate = Updateable<ManufacturerWrite>

export interface ManufacturerModelType {
  // Properties
  readonly id: number
  get manufacturer(): string
  set manufacturer(value: string)
  get description(): string | undefined
  set description(value: string)
  get country(): string
  set country(value: string)
  get featured(): boolean | undefined
  set featured(value: boolean)
  get product(): ProductModelType[] | []

  get uuid(): string | undefined
  set uuid(value: string)

  get created_at(): string | undefined
  get updated_at(): string | undefined
  set updated_at(value: string)

  // Static methods
  with: (relations: string[]) => ManufacturerModelType
  select: (params: (keyof ManufacturerJsonResponse)[] | RawBuilder<string> | string) => ManufacturerModelType
  find: (id: number) => Promise<ManufacturerModelType | undefined>
  first: () => Promise<ManufacturerModelType | undefined>
  last: () => Promise<ManufacturerModelType | undefined>
  firstOrFail: () => Promise<ManufacturerModelType | undefined>
  all: () => Promise<ManufacturerModelType[]>
  findOrFail: (id: number) => Promise<ManufacturerModelType | undefined>
  findMany: (ids: number[]) => Promise<ManufacturerModelType[]>
  latest: (column?: keyof ManufacturersTable) => Promise<ManufacturerModelType | undefined>
  oldest: (column?: keyof ManufacturersTable) => Promise<ManufacturerModelType | undefined>
  skip: (count: number) => ManufacturerModelType
  take: (count: number) => ManufacturerModelType
  where: <V = string>(column: keyof ManufacturersTable, ...args: [V] | [Operator, V]) => ManufacturerModelType
  orWhere: (...conditions: [string, any][]) => ManufacturerModelType
  whereNotIn: <V = number>(column: keyof ManufacturersTable, values: V[]) => ManufacturerModelType
  whereBetween: <V = number>(column: keyof ManufacturersTable, range: [V, V]) => ManufacturerModelType
  whereRef: (column: keyof ManufacturersTable, ...args: string[]) => ManufacturerModelType
  when: (condition: boolean, callback: (query: ManufacturerModelType) => ManufacturerModelType) => ManufacturerModelType
  whereNull: (column: keyof ManufacturersTable) => ManufacturerModelType
  whereNotNull: (column: keyof ManufacturersTable) => ManufacturerModelType
  whereLike: (column: keyof ManufacturersTable, value: string) => ManufacturerModelType
  orderBy: (column: keyof ManufacturersTable, order: 'asc' | 'desc') => ManufacturerModelType
  orderByAsc: (column: keyof ManufacturersTable) => ManufacturerModelType
  orderByDesc: (column: keyof ManufacturersTable) => ManufacturerModelType
  groupBy: (column: keyof ManufacturersTable) => ManufacturerModelType
  having: <V = string>(column: keyof ManufacturersTable, operator: Operator, value: V) => ManufacturerModelType
  inRandomOrder: () => ManufacturerModelType
  whereColumn: (first: keyof ManufacturersTable, operator: Operator, second: keyof ManufacturersTable) => ManufacturerModelType
  max: (field: keyof ManufacturersTable) => Promise<number>
  min: (field: keyof ManufacturersTable) => Promise<number>
  avg: (field: keyof ManufacturersTable) => Promise<number>
  sum: (field: keyof ManufacturersTable) => Promise<number>
  count: () => Promise<number>
  get: () => Promise<ManufacturerModelType[]>
  pluck: <K extends keyof ManufacturerModelType>(field: K) => Promise<ManufacturerModelType[K][]>
  chunk: (size: number, callback: (models: ManufacturerModelType[]) => Promise<void>) => Promise<void>
  paginate: (options?: { limit?: number, offset?: number, page?: number }) => Promise<{
    data: ManufacturerModelType[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }>
  create: (newManufacturer: NewManufacturer) => Promise<ManufacturerModelType>
  firstOrCreate: (search: Partial<ManufacturersTable>, values?: NewManufacturer) => Promise<ManufacturerModelType>
  updateOrCreate: (search: Partial<ManufacturersTable>, values?: NewManufacturer) => Promise<ManufacturerModelType>
  createMany: (newManufacturer: NewManufacturer[]) => Promise<void>
  forceCreate: (newManufacturer: NewManufacturer) => Promise<ManufacturerModelType>
  remove: (id: number) => Promise<any>
  whereIn: <V = number>(column: keyof ManufacturersTable, values: V[]) => ManufacturerModelType
  distinct: (column: keyof ManufacturerJsonResponse) => ManufacturerModelType
  join: (table: string, firstCol: string, secondCol: string) => ManufacturerModelType

  // Instance methods
  createInstance: (data: ManufacturerJsonResponse) => ManufacturerModelType
  update: (newManufacturer: ManufacturerUpdate) => Promise<ManufacturerModelType | undefined>
  forceUpdate: (newManufacturer: ManufacturerUpdate) => Promise<ManufacturerModelType | undefined>
  save: () => Promise<ManufacturerModelType>
  delete: () => Promise<number>
  toSearchableObject: () => Partial<ManufacturerJsonResponse>
  toJSON: () => ManufacturerJsonResponse
  parseResult: (model: ManufacturerModelType) => ManufacturerModelType

}
