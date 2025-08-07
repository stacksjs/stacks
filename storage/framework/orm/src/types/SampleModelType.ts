import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'

export interface SampleModelsTable {
  id: Generated<number>
  created_at?: string
  updated_at?: string
}

export type SampleModelRead = SampleModelsTable

export type SampleModelWrite = Omit<SampleModelsTable, 'created_at'> & {
  created_at?: string
}

export interface SampleModelResponse {
  data: SampleModelJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface SampleModelJsonResponse extends Omit<Selectable<SampleModelRead>, 'password'> {
  [key: string]: any
}

export type NewSampleModel = Insertable<SampleModelWrite>
export type SampleModelUpdate = Updateable<SampleModelWrite>

export interface SampleModelModelType {
  // Properties
  readonly id: number

  get created_at(): string | undefined
  get updated_at(): string | undefined
  set updated_at(value: string)

  // Static methods
  with: (relations: string[]) => SampleModelModelType
  select: (params: (keyof SampleModelJsonResponse)[] | RawBuilder<string> | string) => SampleModelModelType
  find: (id: number) => Promise<SampleModelModelType | undefined>
  first: () => Promise<SampleModelModelType | undefined>
  last: () => Promise<SampleModelModelType | undefined>
  firstOrFail: () => Promise<SampleModelModelType | undefined>
  all: () => Promise<SampleModelModelType[]>
  findOrFail: (id: number) => Promise<SampleModelModelType | undefined>
  findMany: (ids: number[]) => Promise<SampleModelModelType[]>
  latest: (column?: keyof SampleModelsTable) => Promise<SampleModelModelType | undefined>
  oldest: (column?: keyof SampleModelsTable) => Promise<SampleModelModelType | undefined>
  skip: (count: number) => SampleModelModelType
  take: (count: number) => SampleModelModelType
  where: <V = string>(column: keyof SampleModelsTable, ...args: [V] | [Operator, V]) => SampleModelModelType
  orWhere: (...conditions: [string, any][]) => SampleModelModelType
  whereNotIn: <V = number>(column: keyof SampleModelsTable, values: V[]) => SampleModelModelType
  whereBetween: <V = number>(column: keyof SampleModelsTable, range: [V, V]) => SampleModelModelType
  whereRef: (column: keyof SampleModelsTable, ...args: string[]) => SampleModelModelType
  when: (condition: boolean, callback: (query: SampleModelModelType) => SampleModelModelType) => SampleModelModelType
  whereNull: (column: keyof SampleModelsTable) => SampleModelModelType
  whereNotNull: (column: keyof SampleModelsTable) => SampleModelModelType
  whereLike: (column: keyof SampleModelsTable, value: string) => SampleModelModelType
  orderBy: (column: keyof SampleModelsTable, order: 'asc' | 'desc') => SampleModelModelType
  orderByAsc: (column: keyof SampleModelsTable) => SampleModelModelType
  orderByDesc: (column: keyof SampleModelsTable) => SampleModelModelType
  groupBy: (column: keyof SampleModelsTable) => SampleModelModelType
  having: <V = string>(column: keyof SampleModelsTable, operator: Operator, value: V) => SampleModelModelType
  inRandomOrder: () => SampleModelModelType
  whereColumn: (first: keyof SampleModelsTable, operator: Operator, second: keyof SampleModelsTable) => SampleModelModelType
  max: (field: keyof SampleModelsTable) => Promise<number>
  min: (field: keyof SampleModelsTable) => Promise<number>
  avg: (field: keyof SampleModelsTable) => Promise<number>
  sum: (field: keyof SampleModelsTable) => Promise<number>
  count: () => Promise<number>
  get: () => Promise<SampleModelModelType[]>
  pluck: <K extends keyof SampleModelModelType>(field: K) => Promise<SampleModelModelType[K][]>
  chunk: (size: number, callback: (models: SampleModelModelType[]) => Promise<void>) => Promise<void>
  paginate: (options?: { limit?: number, offset?: number, page?: number }) => Promise<{
    data: SampleModelModelType[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }>
  create: (newSampleModel: NewSampleModel) => Promise<SampleModelModelType>
  firstOrCreate: (search: Partial<SampleModelsTable>, values?: NewSampleModel) => Promise<SampleModelModelType>
  updateOrCreate: (search: Partial<SampleModelsTable>, values?: NewSampleModel) => Promise<SampleModelModelType>
  createMany: (newSampleModel: NewSampleModel[]) => Promise<void>
  forceCreate: (newSampleModel: NewSampleModel) => Promise<SampleModelModelType>
  remove: (id: number) => Promise<any>
  whereIn: <V = number>(column: keyof SampleModelsTable, values: V[]) => SampleModelModelType
  distinct: (column: keyof SampleModelJsonResponse) => SampleModelModelType
  join: (table: string, firstCol: string, secondCol: string) => SampleModelModelType

  // Instance methods
  createInstance: (data: SampleModelJsonResponse) => SampleModelModelType
  update: (newSampleModel: SampleModelUpdate) => Promise<SampleModelModelType | undefined>
  forceUpdate: (newSampleModel: SampleModelUpdate) => Promise<SampleModelModelType | undefined>
  save: () => Promise<SampleModelModelType>
  delete: () => Promise<number>
  toSearchableObject: () => Partial<SampleModelJsonResponse>
  toJSON: () => SampleModelJsonResponse
  parseResult: (model: SampleModelModelType) => SampleModelModelType

}
