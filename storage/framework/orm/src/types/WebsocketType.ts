import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'

export interface WebsocketsTable {
  id: Generated<number>
  type?: string | string[]
  socket?: string
  details?: string
  time?: number
  created_at?: string
  updated_at?: string
}

export type WebsocketRead = WebsocketsTable

export type WebsocketWrite = Omit<WebsocketsTable, 'created_at'> & {
  created_at?: string
}

export interface WebsocketResponse {
  data: WebsocketJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface WebsocketJsonResponse extends Omit<Selectable<WebsocketRead>, 'password'> {
  [key: string]: any
}

export type NewWebsocket = Insertable<WebsocketWrite>
export type WebsocketUpdate = Updateable<WebsocketWrite>

export interface WebsocketModelType {
  // Properties
  readonly id: number
  get type(): string | string[] | undefined
  set type(value: string | string[])
  get socket(): string | undefined
  set socket(value: string)
  get details(): string | undefined
  set details(value: string)
  get time(): number | undefined
  set time(value: number)

  get created_at(): string | undefined
  get updated_at(): string | undefined
  set updated_at(value: string)

  // Static methods
  with: (relations: string[]) => WebsocketModelType
  select: (params: (keyof WebsocketJsonResponse)[] | RawBuilder<string> | string) => WebsocketModelType
  find: (id: number) => Promise<WebsocketModelType | undefined>
  first: () => Promise<WebsocketModelType | undefined>
  last: () => Promise<WebsocketModelType | undefined>
  firstOrFail: () => Promise<WebsocketModelType | undefined>
  all: () => Promise<WebsocketModelType[]>
  findOrFail: (id: number) => Promise<WebsocketModelType | undefined>
  findMany: (ids: number[]) => Promise<WebsocketModelType[]>
  latest: (column?: keyof WebsocketsTable) => Promise<WebsocketModelType | undefined>
  oldest: (column?: keyof WebsocketsTable) => Promise<WebsocketModelType | undefined>
  skip: (count: number) => WebsocketModelType
  take: (count: number) => WebsocketModelType
  where: <V = string>(column: keyof WebsocketsTable, ...args: [V] | [Operator, V]) => WebsocketModelType
  orWhere: (...conditions: [string, any][]) => WebsocketModelType
  whereNotIn: <V = number>(column: keyof WebsocketsTable, values: V[]) => WebsocketModelType
  whereBetween: <V = number>(column: keyof WebsocketsTable, range: [V, V]) => WebsocketModelType
  whereRef: (column: keyof WebsocketsTable, ...args: string[]) => WebsocketModelType
  when: (condition: boolean, callback: (query: WebsocketModelType) => WebsocketModelType) => WebsocketModelType
  whereNull: (column: keyof WebsocketsTable) => WebsocketModelType
  whereNotNull: (column: keyof WebsocketsTable) => WebsocketModelType
  whereLike: (column: keyof WebsocketsTable, value: string) => WebsocketModelType
  orderBy: (column: keyof WebsocketsTable, order: 'asc' | 'desc') => WebsocketModelType
  orderByAsc: (column: keyof WebsocketsTable) => WebsocketModelType
  orderByDesc: (column: keyof WebsocketsTable) => WebsocketModelType
  groupBy: (column: keyof WebsocketsTable) => WebsocketModelType
  having: <V = string>(column: keyof WebsocketsTable, operator: Operator, value: V) => WebsocketModelType
  inRandomOrder: () => WebsocketModelType
  whereColumn: (first: keyof WebsocketsTable, operator: Operator, second: keyof WebsocketsTable) => WebsocketModelType
  max: (field: keyof WebsocketsTable) => Promise<number>
  min: (field: keyof WebsocketsTable) => Promise<number>
  avg: (field: keyof WebsocketsTable) => Promise<number>
  sum: (field: keyof WebsocketsTable) => Promise<number>
  count: () => Promise<number>
  get: () => Promise<WebsocketModelType[]>
  pluck: <K extends keyof WebsocketModelType>(field: K) => Promise<WebsocketModelType[K][]>
  chunk: (size: number, callback: (models: WebsocketModelType[]) => Promise<void>) => Promise<void>
  paginate: (options?: { limit?: number, offset?: number, page?: number }) => Promise<{
    data: WebsocketModelType[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }>
  create: (newWebsocket: NewWebsocket) => Promise<WebsocketModelType>
  firstOrCreate: (search: Partial<WebsocketsTable>, values?: NewWebsocket) => Promise<WebsocketModelType>
  updateOrCreate: (search: Partial<WebsocketsTable>, values?: NewWebsocket) => Promise<WebsocketModelType>
  createMany: (newWebsocket: NewWebsocket[]) => Promise<void>
  forceCreate: (newWebsocket: NewWebsocket) => Promise<WebsocketModelType>
  remove: (id: number) => Promise<any>
  whereIn: <V = number>(column: keyof WebsocketsTable, values: V[]) => WebsocketModelType
  distinct: (column: keyof WebsocketJsonResponse) => WebsocketModelType
  join: (table: string, firstCol: string, secondCol: string) => WebsocketModelType

  // Instance methods
  createInstance: (data: WebsocketJsonResponse) => WebsocketModelType
  update: (newWebsocket: WebsocketUpdate) => Promise<WebsocketModelType | undefined>
  forceUpdate: (newWebsocket: WebsocketUpdate) => Promise<WebsocketModelType | undefined>
  save: () => Promise<WebsocketModelType>
  delete: () => Promise<number>
  toSearchableObject: () => Partial<WebsocketJsonResponse>
  toJSON: () => WebsocketJsonResponse
  parseResult: (model: WebsocketModelType) => WebsocketModelType

}
