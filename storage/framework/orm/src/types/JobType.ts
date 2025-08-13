import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'

export interface JobsTable {
  id: Generated<number>
  queue: string
  payload: string
  attempts?: number
  available_at?: number
  reserved_at?: Date | string
  created_at?: string
  updated_at?: string
}

export type JobRead = JobsTable

export type JobWrite = Omit<JobsTable, 'created_at'> & {
  created_at?: string
}

export interface JobResponse {
  data: JobJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface JobJsonResponse extends Omit<Selectable<JobRead>, 'password'> {
  [key: string]: any
}

export type NewJob = Insertable<JobWrite>
export type JobUpdate = Updateable<JobWrite>

export interface JobModelType {
  // Properties
  readonly id: number
  get queue(): string
  set queue(value: string)
  get payload(): string
  set payload(value: string)
  get attempts(): number | undefined
  set attempts(value: number)
  get availableAt(): number | undefined
  set availableAt(value: number)
  get reservedAt(): Date | string | undefined
  set reservedAt(value: Date | string)

  get created_at(): string | undefined
  get updated_at(): string | undefined
  set updated_at(value: string)

  // Static methods
  with: (relations: string[]) => JobModelType
  select: (params: (keyof JobJsonResponse)[] | RawBuilder<string> | string) => JobModelType
  find: (id: number) => Promise<JobModelType | undefined>
  first: () => Promise<JobModelType | undefined>
  last: () => Promise<JobModelType | undefined>
  firstOrFail: () => Promise<JobModelType | undefined>
  all: () => Promise<JobModelType[]>
  findOrFail: (id: number) => Promise<JobModelType | undefined>
  findMany: (ids: number[]) => Promise<JobModelType[]>
  latest: (column?: keyof JobsTable) => Promise<JobModelType | undefined>
  oldest: (column?: keyof JobsTable) => Promise<JobModelType | undefined>
  skip: (count: number) => JobModelType
  take: (count: number) => JobModelType
  where: <V = string>(column: keyof JobsTable, ...args: [V] | [Operator, V]) => JobModelType
  orWhere: (...conditions: [string, any][]) => JobModelType
  whereNotIn: <V = number>(column: keyof JobsTable, values: V[]) => JobModelType
  whereBetween: <V = number>(column: keyof JobsTable, range: [V, V]) => JobModelType
  whereRef: (column: keyof JobsTable, ...args: string[]) => JobModelType
  when: (condition: boolean, callback: (query: JobModelType) => JobModelType) => JobModelType
  whereNull: (column: keyof JobsTable) => JobModelType
  whereNotNull: (column: keyof JobsTable) => JobModelType
  whereLike: (column: keyof JobsTable, value: string) => JobModelType
  orderBy: (column: keyof JobsTable, order: 'asc' | 'desc') => JobModelType
  orderByAsc: (column: keyof JobsTable) => JobModelType
  orderByDesc: (column: keyof JobsTable) => JobModelType
  groupBy: (column: keyof JobsTable) => JobModelType
  having: <V = string>(column: keyof JobsTable, operator: Operator, value: V) => JobModelType
  inRandomOrder: () => JobModelType
  whereColumn: (first: keyof JobsTable, operator: Operator, second: keyof JobsTable) => JobModelType
  max: (field: keyof JobsTable) => Promise<number>
  min: (field: keyof JobsTable) => Promise<number>
  avg: (field: keyof JobsTable) => Promise<number>
  sum: (field: keyof JobsTable) => Promise<number>
  count: () => Promise<number>
  get: () => Promise<JobModelType[]>
  pluck: <K extends keyof JobModelType>(field: K) => Promise<JobModelType[K][]>
  chunk: (size: number, callback: (models: JobModelType[]) => Promise<void>) => Promise<void>
  paginate: (options?: { limit?: number, offset?: number, page?: number }) => Promise<{
    data: JobModelType[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }>
  create: (newJob: NewJob) => Promise<JobModelType>
  firstOrCreate: (search: Partial<JobsTable>, values?: NewJob) => Promise<JobModelType>
  updateOrCreate: (search: Partial<JobsTable>, values?: NewJob) => Promise<JobModelType>
  createMany: (newJob: NewJob[]) => Promise<void>
  forceCreate: (newJob: NewJob) => Promise<JobModelType>
  remove: (id: number) => Promise<any>
  whereIn: <V = number>(column: keyof JobsTable, values: V[]) => JobModelType
  distinct: (column: keyof JobJsonResponse) => JobModelType
  join: (table: string, firstCol: string, secondCol: string) => JobModelType

  // Instance methods
  createInstance: (data: JobJsonResponse) => JobModelType
  update: (newJob: JobUpdate) => Promise<JobModelType | undefined>
  forceUpdate: (newJob: JobUpdate) => Promise<JobModelType | undefined>
  save: () => Promise<JobModelType>
  delete: () => Promise<number>
  toSearchableObject: () => Partial<JobJsonResponse>
  toJSON: () => JobJsonResponse
  parseResult: (model: JobModelType) => JobModelType

}
