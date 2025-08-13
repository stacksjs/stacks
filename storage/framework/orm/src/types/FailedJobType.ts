import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'

export interface FailedJobsTable {
  id: Generated<number>
  connection: string
  queue: string
  payload: string
  exception: string
  failed_at?: Date | string
  created_at?: string
  updated_at?: string
}

export type FailedJobRead = FailedJobsTable

export type FailedJobWrite = Omit<FailedJobsTable, 'created_at'> & {
  created_at?: string
}

export interface FailedJobResponse {
  data: FailedJobJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface FailedJobJsonResponse extends Omit<Selectable<FailedJobRead>, 'password'> {
  [key: string]: any
}

export type NewFailedJob = Insertable<FailedJobWrite>
export type FailedJobUpdate = Updateable<FailedJobWrite>

export interface FailedJobModelType {
  // Properties
  readonly id: number
  get connection(): string
  set connection(value: string)
  get queue(): string
  set queue(value: string)
  get payload(): string
  set payload(value: string)
  get exception(): string
  set exception(value: string)
  get failedAt(): Date | string | undefined
  set failedAt(value: Date | string)

  get created_at(): string | undefined
  get updated_at(): string | undefined
  set updated_at(value: string)

  // Static methods
  with: (relations: string[]) => FailedJobModelType
  select: (params: (keyof FailedJobJsonResponse)[] | RawBuilder<string> | string) => FailedJobModelType
  find: (id: number) => Promise<FailedJobModelType | undefined>
  first: () => Promise<FailedJobModelType | undefined>
  last: () => Promise<FailedJobModelType | undefined>
  firstOrFail: () => Promise<FailedJobModelType | undefined>
  all: () => Promise<FailedJobModelType[]>
  findOrFail: (id: number) => Promise<FailedJobModelType | undefined>
  findMany: (ids: number[]) => Promise<FailedJobModelType[]>
  latest: (column?: keyof FailedJobsTable) => Promise<FailedJobModelType | undefined>
  oldest: (column?: keyof FailedJobsTable) => Promise<FailedJobModelType | undefined>
  skip: (count: number) => FailedJobModelType
  take: (count: number) => FailedJobModelType
  where: <V = string>(column: keyof FailedJobsTable, ...args: [V] | [Operator, V]) => FailedJobModelType
  orWhere: (...conditions: [string, any][]) => FailedJobModelType
  whereNotIn: <V = number>(column: keyof FailedJobsTable, values: V[]) => FailedJobModelType
  whereBetween: <V = number>(column: keyof FailedJobsTable, range: [V, V]) => FailedJobModelType
  whereRef: (column: keyof FailedJobsTable, ...args: string[]) => FailedJobModelType
  when: (condition: boolean, callback: (query: FailedJobModelType) => FailedJobModelType) => FailedJobModelType
  whereNull: (column: keyof FailedJobsTable) => FailedJobModelType
  whereNotNull: (column: keyof FailedJobsTable) => FailedJobModelType
  whereLike: (column: keyof FailedJobsTable, value: string) => FailedJobModelType
  orderBy: (column: keyof FailedJobsTable, order: 'asc' | 'desc') => FailedJobModelType
  orderByAsc: (column: keyof FailedJobsTable) => FailedJobModelType
  orderByDesc: (column: keyof FailedJobsTable) => FailedJobModelType
  groupBy: (column: keyof FailedJobsTable) => FailedJobModelType
  having: <V = string>(column: keyof FailedJobsTable, operator: Operator, value: V) => FailedJobModelType
  inRandomOrder: () => FailedJobModelType
  whereColumn: (first: keyof FailedJobsTable, operator: Operator, second: keyof FailedJobsTable) => FailedJobModelType
  max: (field: keyof FailedJobsTable) => Promise<number>
  min: (field: keyof FailedJobsTable) => Promise<number>
  avg: (field: keyof FailedJobsTable) => Promise<number>
  sum: (field: keyof FailedJobsTable) => Promise<number>
  count: () => Promise<number>
  get: () => Promise<FailedJobModelType[]>
  pluck: <K extends keyof FailedJobModelType>(field: K) => Promise<FailedJobModelType[K][]>
  chunk: (size: number, callback: (models: FailedJobModelType[]) => Promise<void>) => Promise<void>
  paginate: (options?: { limit?: number, offset?: number, page?: number }) => Promise<{
    data: FailedJobModelType[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }>
  create: (newFailedJob: NewFailedJob) => Promise<FailedJobModelType>
  firstOrCreate: (search: Partial<FailedJobsTable>, values?: NewFailedJob) => Promise<FailedJobModelType>
  updateOrCreate: (search: Partial<FailedJobsTable>, values?: NewFailedJob) => Promise<FailedJobModelType>
  createMany: (newFailedJob: NewFailedJob[]) => Promise<void>
  forceCreate: (newFailedJob: NewFailedJob) => Promise<FailedJobModelType>
  remove: (id: number) => Promise<any>
  whereIn: <V = number>(column: keyof FailedJobsTable, values: V[]) => FailedJobModelType
  distinct: (column: keyof FailedJobJsonResponse) => FailedJobModelType
  join: (table: string, firstCol: string, secondCol: string) => FailedJobModelType

  // Instance methods
  createInstance: (data: FailedJobJsonResponse) => FailedJobModelType
  update: (newFailedJob: FailedJobUpdate) => Promise<FailedJobModelType | undefined>
  forceUpdate: (newFailedJob: FailedJobUpdate) => Promise<FailedJobModelType | undefined>
  save: () => Promise<FailedJobModelType>
  delete: () => Promise<number>
  toSearchableObject: () => Partial<FailedJobJsonResponse>
  toJSON: () => FailedJobJsonResponse
  parseResult: (model: FailedJobModelType) => FailedJobModelType

}
