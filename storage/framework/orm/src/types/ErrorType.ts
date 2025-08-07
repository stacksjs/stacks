import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'

export interface ErrorsTable {
  id: Generated<number>
  type?: string
  message?: string
  stack?: string
  status?: number
  additional_info?: string
  created_at?: string
  updated_at?: string
}

export type ErrorRead = ErrorsTable

export type ErrorWrite = Omit<ErrorsTable, 'created_at'> & {
  created_at?: string
}

export interface ErrorResponse {
  data: ErrorJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface ErrorJsonResponse extends Omit<Selectable<ErrorRead>, 'password'> {
  [key: string]: any
}

export type NewError = Insertable<ErrorWrite>
export type ErrorUpdate = Updateable<ErrorWrite>

export interface ErrorModelType {
  // Properties
  readonly id: number
  get type(): string | undefined
  set type(value: string)
  get message(): string | undefined
  set message(value: string)
  get stack(): string | undefined
  set stack(value: string)
  get status(): number | undefined
  set status(value: number)
  get additionalInfo(): string | undefined
  set additionalInfo(value: string)

  get created_at(): string | undefined
  get updated_at(): string | undefined
  set updated_at(value: string)

  // Static methods
  with: (relations: string[]) => ErrorModelType
  select: (params: (keyof ErrorJsonResponse)[] | RawBuilder<string> | string) => ErrorModelType
  find: (id: number) => Promise<ErrorModelType | undefined>
  first: () => Promise<ErrorModelType | undefined>
  last: () => Promise<ErrorModelType | undefined>
  firstOrFail: () => Promise<ErrorModelType | undefined>
  all: () => Promise<ErrorModelType[]>
  findOrFail: (id: number) => Promise<ErrorModelType | undefined>
  findMany: (ids: number[]) => Promise<ErrorModelType[]>
  latest: (column?: keyof ErrorsTable) => Promise<ErrorModelType | undefined>
  oldest: (column?: keyof ErrorsTable) => Promise<ErrorModelType | undefined>
  skip: (count: number) => ErrorModelType
  take: (count: number) => ErrorModelType
  where: <V = string>(column: keyof ErrorsTable, ...args: [V] | [Operator, V]) => ErrorModelType
  orWhere: (...conditions: [string, any][]) => ErrorModelType
  whereNotIn: <V = number>(column: keyof ErrorsTable, values: V[]) => ErrorModelType
  whereBetween: <V = number>(column: keyof ErrorsTable, range: [V, V]) => ErrorModelType
  whereRef: (column: keyof ErrorsTable, ...args: string[]) => ErrorModelType
  when: (condition: boolean, callback: (query: ErrorModelType) => ErrorModelType) => ErrorModelType
  whereNull: (column: keyof ErrorsTable) => ErrorModelType
  whereNotNull: (column: keyof ErrorsTable) => ErrorModelType
  whereLike: (column: keyof ErrorsTable, value: string) => ErrorModelType
  orderBy: (column: keyof ErrorsTable, order: 'asc' | 'desc') => ErrorModelType
  orderByAsc: (column: keyof ErrorsTable) => ErrorModelType
  orderByDesc: (column: keyof ErrorsTable) => ErrorModelType
  groupBy: (column: keyof ErrorsTable) => ErrorModelType
  having: <V = string>(column: keyof ErrorsTable, operator: Operator, value: V) => ErrorModelType
  inRandomOrder: () => ErrorModelType
  whereColumn: (first: keyof ErrorsTable, operator: Operator, second: keyof ErrorsTable) => ErrorModelType
  max: (field: keyof ErrorsTable) => Promise<number>
  min: (field: keyof ErrorsTable) => Promise<number>
  avg: (field: keyof ErrorsTable) => Promise<number>
  sum: (field: keyof ErrorsTable) => Promise<number>
  count: () => Promise<number>
  get: () => Promise<ErrorModelType[]>
  pluck: <K extends keyof ErrorModelType>(field: K) => Promise<ErrorModelType[K][]>
  chunk: (size: number, callback: (models: ErrorModelType[]) => Promise<void>) => Promise<void>
  paginate: (options?: { limit?: number, offset?: number, page?: number }) => Promise<{
    data: ErrorModelType[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }>
  create: (newError: NewError) => Promise<ErrorModelType>
  firstOrCreate: (search: Partial<ErrorsTable>, values?: NewError) => Promise<ErrorModelType>
  updateOrCreate: (search: Partial<ErrorsTable>, values?: NewError) => Promise<ErrorModelType>
  createMany: (newError: NewError[]) => Promise<void>
  forceCreate: (newError: NewError) => Promise<ErrorModelType>
  remove: (id: number) => Promise<any>
  whereIn: <V = number>(column: keyof ErrorsTable, values: V[]) => ErrorModelType
  distinct: (column: keyof ErrorJsonResponse) => ErrorModelType
  join: (table: string, firstCol: string, secondCol: string) => ErrorModelType

  // Instance methods
  createInstance: (data: ErrorJsonResponse) => ErrorModelType
  update: (newError: ErrorUpdate) => Promise<ErrorModelType | undefined>
  forceUpdate: (newError: ErrorUpdate) => Promise<ErrorModelType | undefined>
  save: () => Promise<ErrorModelType>
  delete: () => Promise<number>
  toSearchableObject: () => Partial<ErrorJsonResponse>
  toJSON: () => ErrorJsonResponse
  parseResult: (model: ErrorModelType) => ErrorModelType

}
