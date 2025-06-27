import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'

export interface LogsTable {
  id: Generated<number>
  timestamp?: number
  type?: string | string[]
  source?: string | string[]
  message?: string
  project?: string
  stacktrace?: string
  file?: string
  created_at?: string
  updated_at?: string
}

export type LogRead = LogsTable

export type LogWrite = Omit<LogsTable, 'created_at'> & {
  created_at?: string
}

export interface LogResponse {
  data: LogJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface LogJsonResponse extends Omit<Selectable<LogRead>, 'password'> {
  [key: string]: any
}

export type NewLog = Insertable<LogWrite>
export type LogUpdate = Updateable<LogWrite>

export interface LogModelType {
  // Properties
  readonly id: number
  get timestamp(): number | undefined
  set timestamp(value: number)
  get type(): string | string[] | undefined
  set type(value: string | string[])
  get source(): string | string[] | undefined
  set source(value: string | string[])
  get message(): string | undefined
  set message(value: string)
  get project(): string | undefined
  set project(value: string)
  get stacktrace(): string | undefined
  set stacktrace(value: string)
  get file(): string | undefined
  set file(value: string)

  get created_at(): string | undefined
  get updated_at(): string | undefined
  set updated_at(value: string)

  // Static methods
  with: (relations: string[]) => LogModelType
  select: (params: (keyof LogJsonResponse)[] | RawBuilder<string> | string) => LogModelType
  find: (id: number) => Promise<LogModelType | undefined>
  first: () => Promise<LogModelType | undefined>
  last: () => Promise<LogModelType | undefined>
  firstOrFail: () => Promise<LogModelType | undefined>
  all: () => Promise<LogModelType[]>
  findOrFail: (id: number) => Promise<LogModelType | undefined>
  findMany: (ids: number[]) => Promise<LogModelType[]>
  latest: (column?: keyof LogsTable) => Promise<LogModelType | undefined>
  oldest: (column?: keyof LogsTable) => Promise<LogModelType | undefined>
  skip: (count: number) => LogModelType
  take: (count: number) => LogModelType
  where: <V = string>(column: keyof LogsTable, ...args: [V] | [Operator, V]) => LogModelType
  orWhere: (...conditions: [string, any][]) => LogModelType
  whereNotIn: <V = number>(column: keyof LogsTable, values: V[]) => LogModelType
  whereBetween: <V = number>(column: keyof LogsTable, range: [V, V]) => LogModelType
  whereRef: (column: keyof LogsTable, ...args: string[]) => LogModelType
  when: (condition: boolean, callback: (query: LogModelType) => LogModelType) => LogModelType
  whereNull: (column: keyof LogsTable) => LogModelType
  whereNotNull: (column: keyof LogsTable) => LogModelType
  whereLike: (column: keyof LogsTable, value: string) => LogModelType
  orderBy: (column: keyof LogsTable, order: 'asc' | 'desc') => LogModelType
  orderByAsc: (column: keyof LogsTable) => LogModelType
  orderByDesc: (column: keyof LogsTable) => LogModelType
  groupBy: (column: keyof LogsTable) => LogModelType
  having: <V = string>(column: keyof LogsTable, operator: Operator, value: V) => LogModelType
  inRandomOrder: () => LogModelType
  whereColumn: (first: keyof LogsTable, operator: Operator, second: keyof LogsTable) => LogModelType
  max: (field: keyof LogsTable) => Promise<number>
  min: (field: keyof LogsTable) => Promise<number>
  avg: (field: keyof LogsTable) => Promise<number>
  sum: (field: keyof LogsTable) => Promise<number>
  count: () => Promise<number>
  get: () => Promise<LogModelType[]>
  pluck: <K extends keyof LogModelType>(field: K) => Promise<LogModelType[K][]>
  chunk: (size: number, callback: (models: LogModelType[]) => Promise<void>) => Promise<void>
  paginate: (options?: { limit?: number, offset?: number, page?: number }) => Promise<{
    data: LogModelType[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }>
  create: (newLog: NewLog) => Promise<LogModelType>
  firstOrCreate: (search: Partial<LogsTable>, values?: NewLog) => Promise<LogModelType>
  updateOrCreate: (search: Partial<LogsTable>, values?: NewLog) => Promise<LogModelType>
  createMany: (newLog: NewLog[]) => Promise<void>
  forceCreate: (newLog: NewLog) => Promise<LogModelType>
  remove: (id: number) => Promise<any>
  whereIn: <V = number>(column: keyof LogsTable, values: V[]) => LogModelType
  distinct: (column: keyof LogJsonResponse) => LogModelType
  join: (table: string, firstCol: string, secondCol: string) => LogModelType

  // Instance methods
  createInstance: (data: LogJsonResponse) => LogModelType
  update: (newLog: LogUpdate) => Promise<LogModelType | undefined>
  forceUpdate: (newLog: LogUpdate) => Promise<LogModelType | undefined>
  save: () => Promise<LogModelType>
  delete: () => Promise<number>
  toSearchableObject: () => Partial<LogJsonResponse>
  toJSON: () => LogJsonResponse
  parseResult: (model: LogModelType) => LogModelType

}
