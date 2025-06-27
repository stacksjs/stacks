import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'

export interface TaxRatesTable {
  id: Generated<number>
  name: string
  rate: number
  type: string
  country: string
  region?: string | string[]
  status?: string | string[]
  is_default?: boolean
  uuid?: string
  created_at?: string
  updated_at?: string
}

export type TaxRateRead = TaxRatesTable

export type TaxRateWrite = Omit<TaxRatesTable, 'created_at'> & {
  created_at?: string
}

export interface TaxRateResponse {
  data: TaxRateJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface TaxRateJsonResponse extends Omit<Selectable<TaxRateRead>, 'password'> {
  [key: string]: any
}

export type NewTaxRate = Insertable<TaxRateWrite>
export type TaxRateUpdate = Updateable<TaxRateWrite>

export interface TaxRateModelType {
  // Properties
  readonly id: number
  get name(): string
  set name(value: string)
  get rate(): number
  set rate(value: number)
  get type(): string
  set type(value: string)
  get country(): string
  set country(value: string)
  get region(): string | string[] | undefined
  set region(value: string | string[])
  get status(): string | string[] | undefined
  set status(value: string | string[])
  get isDefault(): boolean | undefined
  set isDefault(value: boolean)

  get uuid(): string | undefined
  set uuid(value: string)

  get created_at(): string | undefined
  get updated_at(): string | undefined
  set updated_at(value: string)

  // Static methods
  with: (relations: string[]) => TaxRateModelType
  select: (params: (keyof TaxRateJsonResponse)[] | RawBuilder<string> | string) => TaxRateModelType
  find: (id: number) => Promise<TaxRateModelType | undefined>
  first: () => Promise<TaxRateModelType | undefined>
  last: () => Promise<TaxRateModelType | undefined>
  firstOrFail: () => Promise<TaxRateModelType | undefined>
  all: () => Promise<TaxRateModelType[]>
  findOrFail: (id: number) => Promise<TaxRateModelType | undefined>
  findMany: (ids: number[]) => Promise<TaxRateModelType[]>
  latest: (column?: keyof TaxRatesTable) => Promise<TaxRateModelType | undefined>
  oldest: (column?: keyof TaxRatesTable) => Promise<TaxRateModelType | undefined>
  skip: (count: number) => TaxRateModelType
  take: (count: number) => TaxRateModelType
  where: <V = string>(column: keyof TaxRatesTable, ...args: [V] | [Operator, V]) => TaxRateModelType
  orWhere: (...conditions: [string, any][]) => TaxRateModelType
  whereNotIn: <V = number>(column: keyof TaxRatesTable, values: V[]) => TaxRateModelType
  whereBetween: <V = number>(column: keyof TaxRatesTable, range: [V, V]) => TaxRateModelType
  whereRef: (column: keyof TaxRatesTable, ...args: string[]) => TaxRateModelType
  when: (condition: boolean, callback: (query: TaxRateModelType) => TaxRateModelType) => TaxRateModelType
  whereNull: (column: keyof TaxRatesTable) => TaxRateModelType
  whereNotNull: (column: keyof TaxRatesTable) => TaxRateModelType
  whereLike: (column: keyof TaxRatesTable, value: string) => TaxRateModelType
  orderBy: (column: keyof TaxRatesTable, order: 'asc' | 'desc') => TaxRateModelType
  orderByAsc: (column: keyof TaxRatesTable) => TaxRateModelType
  orderByDesc: (column: keyof TaxRatesTable) => TaxRateModelType
  groupBy: (column: keyof TaxRatesTable) => TaxRateModelType
  having: <V = string>(column: keyof TaxRatesTable, operator: Operator, value: V) => TaxRateModelType
  inRandomOrder: () => TaxRateModelType
  whereColumn: (first: keyof TaxRatesTable, operator: Operator, second: keyof TaxRatesTable) => TaxRateModelType
  max: (field: keyof TaxRatesTable) => Promise<number>
  min: (field: keyof TaxRatesTable) => Promise<number>
  avg: (field: keyof TaxRatesTable) => Promise<number>
  sum: (field: keyof TaxRatesTable) => Promise<number>
  count: () => Promise<number>
  get: () => Promise<TaxRateModelType[]>
  pluck: <K extends keyof TaxRateModelType>(field: K) => Promise<TaxRateModelType[K][]>
  chunk: (size: number, callback: (models: TaxRateModelType[]) => Promise<void>) => Promise<void>
  paginate: (options?: { limit?: number, offset?: number, page?: number }) => Promise<{
    data: TaxRateModelType[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }>
  create: (newTaxRate: NewTaxRate) => Promise<TaxRateModelType>
  firstOrCreate: (search: Partial<TaxRatesTable>, values?: NewTaxRate) => Promise<TaxRateModelType>
  updateOrCreate: (search: Partial<TaxRatesTable>, values?: NewTaxRate) => Promise<TaxRateModelType>
  createMany: (newTaxRate: NewTaxRate[]) => Promise<void>
  forceCreate: (newTaxRate: NewTaxRate) => Promise<TaxRateModelType>
  remove: (id: number) => Promise<any>
  whereIn: <V = number>(column: keyof TaxRatesTable, values: V[]) => TaxRateModelType
  distinct: (column: keyof TaxRateJsonResponse) => TaxRateModelType
  join: (table: string, firstCol: string, secondCol: string) => TaxRateModelType

  // Instance methods
  createInstance: (data: TaxRateJsonResponse) => TaxRateModelType
  update: (newTaxRate: TaxRateUpdate) => Promise<TaxRateModelType | undefined>
  forceUpdate: (newTaxRate: TaxRateUpdate) => Promise<TaxRateModelType | undefined>
  save: () => Promise<TaxRateModelType>
  delete: () => Promise<number>
  toSearchableObject: () => Partial<TaxRateJsonResponse>
  toJSON: () => TaxRateJsonResponse
  parseResult: (model: TaxRateModelType) => TaxRateModelType

}
