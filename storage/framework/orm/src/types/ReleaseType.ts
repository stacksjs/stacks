import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'

export interface ReleasesTable {
  id: Generated<number>
  name: string
  version?: string
  created_at?: string
  updated_at?: string
}

export type ReleaseRead = ReleasesTable

export type ReleaseWrite = Omit<ReleasesTable, 'created_at'> & {
  created_at?: string
}

export interface ReleaseResponse {
  data: ReleaseJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface ReleaseJsonResponse extends Omit<Selectable<ReleaseRead>, 'password'> {
  [key: string]: any
}

export type NewRelease = Insertable<ReleaseWrite>
export type ReleaseUpdate = Updateable<ReleaseWrite>

export interface ReleaseModelType {
  // Properties
  readonly id: number
  get name(): string
  set name(value: string)
  get version(): string | undefined
  set version(value: string)

  get created_at(): string | undefined
  get updated_at(): string | undefined
  set updated_at(value: string)

  // Static methods
  with: (relations: string[]) => ReleaseModelType
  select: (params: (keyof ReleaseJsonResponse)[] | RawBuilder<string> | string) => ReleaseModelType
  find: (id: number) => Promise<ReleaseModelType | undefined>
  first: () => Promise<ReleaseModelType | undefined>
  last: () => Promise<ReleaseModelType | undefined>
  firstOrFail: () => Promise<ReleaseModelType | undefined>
  all: () => Promise<ReleaseModelType[]>
  findOrFail: (id: number) => Promise<ReleaseModelType | undefined>
  findMany: (ids: number[]) => Promise<ReleaseModelType[]>
  latest: (column?: keyof ReleasesTable) => Promise<ReleaseModelType | undefined>
  oldest: (column?: keyof ReleasesTable) => Promise<ReleaseModelType | undefined>
  skip: (count: number) => ReleaseModelType
  take: (count: number) => ReleaseModelType
  where: <V = string>(column: keyof ReleasesTable, ...args: [V] | [Operator, V]) => ReleaseModelType
  orWhere: (...conditions: [string, any][]) => ReleaseModelType
  whereNotIn: <V = number>(column: keyof ReleasesTable, values: V[]) => ReleaseModelType
  whereBetween: <V = number>(column: keyof ReleasesTable, range: [V, V]) => ReleaseModelType
  whereRef: (column: keyof ReleasesTable, ...args: string[]) => ReleaseModelType
  when: (condition: boolean, callback: (query: ReleaseModelType) => ReleaseModelType) => ReleaseModelType
  whereNull: (column: keyof ReleasesTable) => ReleaseModelType
  whereNotNull: (column: keyof ReleasesTable) => ReleaseModelType
  whereLike: (column: keyof ReleasesTable, value: string) => ReleaseModelType
  orderBy: (column: keyof ReleasesTable, order: 'asc' | 'desc') => ReleaseModelType
  orderByAsc: (column: keyof ReleasesTable) => ReleaseModelType
  orderByDesc: (column: keyof ReleasesTable) => ReleaseModelType
  groupBy: (column: keyof ReleasesTable) => ReleaseModelType
  having: <V = string>(column: keyof ReleasesTable, operator: Operator, value: V) => ReleaseModelType
  inRandomOrder: () => ReleaseModelType
  whereColumn: (first: keyof ReleasesTable, operator: Operator, second: keyof ReleasesTable) => ReleaseModelType
  max: (field: keyof ReleasesTable) => Promise<number>
  min: (field: keyof ReleasesTable) => Promise<number>
  avg: (field: keyof ReleasesTable) => Promise<number>
  sum: (field: keyof ReleasesTable) => Promise<number>
  count: () => Promise<number>
  get: () => Promise<ReleaseModelType[]>
  pluck: <K extends keyof ReleaseModelType>(field: K) => Promise<ReleaseModelType[K][]>
  chunk: (size: number, callback: (models: ReleaseModelType[]) => Promise<void>) => Promise<void>
  paginate: (options?: { limit?: number, offset?: number, page?: number }) => Promise<{
    data: ReleaseModelType[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }>
  create: (newRelease: NewRelease) => Promise<ReleaseModelType>
  firstOrCreate: (search: Partial<ReleasesTable>, values?: NewRelease) => Promise<ReleaseModelType>
  updateOrCreate: (search: Partial<ReleasesTable>, values?: NewRelease) => Promise<ReleaseModelType>
  createMany: (newRelease: NewRelease[]) => Promise<void>
  forceCreate: (newRelease: NewRelease) => Promise<ReleaseModelType>
  remove: (id: number) => Promise<any>
  whereIn: <V = number>(column: keyof ReleasesTable, values: V[]) => ReleaseModelType
  distinct: (column: keyof ReleaseJsonResponse) => ReleaseModelType
  join: (table: string, firstCol: string, secondCol: string) => ReleaseModelType

  // Instance methods
  createInstance: (data: ReleaseJsonResponse) => ReleaseModelType
  update: (newRelease: ReleaseUpdate) => Promise<ReleaseModelType | undefined>
  forceUpdate: (newRelease: ReleaseUpdate) => Promise<ReleaseModelType | undefined>
  save: () => Promise<ReleaseModelType>
  delete: () => Promise<number>
  toSearchableObject: () => Partial<ReleaseJsonResponse>
  toJSON: () => ReleaseJsonResponse
  parseResult: (model: ReleaseModelType) => ReleaseModelType

}
