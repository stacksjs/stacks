import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'

export interface RequestsTable {
  id: Generated<number>
  method?: string | string[]
  path?: string
  status_code?: number
  duration_ms?: number
  ip_address?: string
  memory_usage?: number
  user_agent?: string
  error_message?: string
  created_at?: string
  updated_at?: string
}

export type RequestRead = RequestsTable

export type RequestWrite = Omit<RequestsTable, 'created_at'> & {
  created_at?: string
}

export interface RequestResponse {
  data: RequestJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface RequestJsonResponse extends Omit<Selectable<RequestRead>, 'password'> {
  [key: string]: any
}

export type NewRequest = Insertable<RequestWrite>
export type RequestUpdate = Updateable<RequestWrite>

export interface RequestModelType {
  // Properties
  readonly id: number
  get method(): string | string[] | undefined
  set method(value: string | string[])
  get path(): string | undefined
  set path(value: string)
  get statusCode(): number | undefined
  set statusCode(value: number)
  get durationMs(): number | undefined
  set durationMs(value: number)
  get ipAddress(): string | undefined
  set ipAddress(value: string)
  get memoryUsage(): number | undefined
  set memoryUsage(value: number)
  get userAgent(): string | undefined
  set userAgent(value: string)
  get errorMessage(): string | undefined
  set errorMessage(value: string)

  get created_at(): string | undefined
  get updated_at(): string | undefined
  set updated_at(value: string)

  // Static methods
  with: (relations: string[]) => RequestModelType
  select: (params: (keyof RequestJsonResponse)[] | RawBuilder<string> | string) => RequestModelType
  find: (id: number) => Promise<RequestModelType | undefined>
  first: () => Promise<RequestModelType | undefined>
  last: () => Promise<RequestModelType | undefined>
  firstOrFail: () => Promise<RequestModelType | undefined>
  all: () => Promise<RequestModelType[]>
  findOrFail: (id: number) => Promise<RequestModelType | undefined>
  findMany: (ids: number[]) => Promise<RequestModelType[]>
  latest: (column?: keyof RequestsTable) => Promise<RequestModelType | undefined>
  oldest: (column?: keyof RequestsTable) => Promise<RequestModelType | undefined>
  skip: (count: number) => RequestModelType
  take: (count: number) => RequestModelType
  where: <V = string>(column: keyof RequestsTable, ...args: [V] | [Operator, V]) => RequestModelType
  orWhere: (...conditions: [string, any][]) => RequestModelType
  whereNotIn: <V = number>(column: keyof RequestsTable, values: V[]) => RequestModelType
  whereBetween: <V = number>(column: keyof RequestsTable, range: [V, V]) => RequestModelType
  whereRef: (column: keyof RequestsTable, ...args: string[]) => RequestModelType
  when: (condition: boolean, callback: (query: RequestModelType) => RequestModelType) => RequestModelType
  whereNull: (column: keyof RequestsTable) => RequestModelType
  whereNotNull: (column: keyof RequestsTable) => RequestModelType
  whereLike: (column: keyof RequestsTable, value: string) => RequestModelType
  orderBy: (column: keyof RequestsTable, order: 'asc' | 'desc') => RequestModelType
  orderByAsc: (column: keyof RequestsTable) => RequestModelType
  orderByDesc: (column: keyof RequestsTable) => RequestModelType
  groupBy: (column: keyof RequestsTable) => RequestModelType
  having: <V = string>(column: keyof RequestsTable, operator: Operator, value: V) => RequestModelType
  inRandomOrder: () => RequestModelType
  whereColumn: (first: keyof RequestsTable, operator: Operator, second: keyof RequestsTable) => RequestModelType
  max: (field: keyof RequestsTable) => Promise<number>
  min: (field: keyof RequestsTable) => Promise<number>
  avg: (field: keyof RequestsTable) => Promise<number>
  sum: (field: keyof RequestsTable) => Promise<number>
  count: () => Promise<number>
  get: () => Promise<RequestModelType[]>
  pluck: <K extends keyof RequestModelType>(field: K) => Promise<RequestModelType[K][]>
  chunk: (size: number, callback: (models: RequestModelType[]) => Promise<void>) => Promise<void>
  paginate: (options?: { limit?: number, offset?: number, page?: number }) => Promise<{
    data: RequestModelType[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }>
  create: (newRequest: NewRequest) => Promise<RequestModelType>
  firstOrCreate: (search: Partial<RequestsTable>, values?: NewRequest) => Promise<RequestModelType>
  updateOrCreate: (search: Partial<RequestsTable>, values?: NewRequest) => Promise<RequestModelType>
  createMany: (newRequest: NewRequest[]) => Promise<void>
  forceCreate: (newRequest: NewRequest) => Promise<RequestModelType>
  remove: (id: number) => Promise<any>
  whereIn: <V = number>(column: keyof RequestsTable, values: V[]) => RequestModelType
  distinct: (column: keyof RequestJsonResponse) => RequestModelType
  join: (table: string, firstCol: string, secondCol: string) => RequestModelType

  // Instance methods
  createInstance: (data: RequestJsonResponse) => RequestModelType
  update: (newRequest: RequestUpdate) => Promise<RequestModelType | undefined>
  forceUpdate: (newRequest: RequestUpdate) => Promise<RequestModelType | undefined>
  save: () => Promise<RequestModelType>
  delete: () => Promise<number>
  toSearchableObject: () => Partial<RequestJsonResponse>
  toJSON: () => RequestJsonResponse
  parseResult: (model: RequestModelType) => RequestModelType

}
