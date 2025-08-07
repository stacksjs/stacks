import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'

export interface SubscribersTable {
  id: Generated<number>
  subscribed: boolean
  created_at?: string
  updated_at?: string
}

export type SubscriberRead = SubscribersTable

export type SubscriberWrite = Omit<SubscribersTable, 'created_at'> & {
  created_at?: string
}

export interface SubscriberResponse {
  data: SubscriberJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface SubscriberJsonResponse extends Omit<Selectable<SubscriberRead>, 'password'> {
  [key: string]: any
}

export type NewSubscriber = Insertable<SubscriberWrite>
export type SubscriberUpdate = Updateable<SubscriberWrite>

export interface SubscriberModelType {
  // Properties
  readonly id: number
  get subscribed(): boolean
  set subscribed(value: boolean)

  get created_at(): string | undefined
  get updated_at(): string | undefined
  set updated_at(value: string)

  // Static methods
  with: (relations: string[]) => SubscriberModelType
  select: (params: (keyof SubscriberJsonResponse)[] | RawBuilder<string> | string) => SubscriberModelType
  find: (id: number) => Promise<SubscriberModelType | undefined>
  first: () => Promise<SubscriberModelType | undefined>
  last: () => Promise<SubscriberModelType | undefined>
  firstOrFail: () => Promise<SubscriberModelType | undefined>
  all: () => Promise<SubscriberModelType[]>
  findOrFail: (id: number) => Promise<SubscriberModelType | undefined>
  findMany: (ids: number[]) => Promise<SubscriberModelType[]>
  latest: (column?: keyof SubscribersTable) => Promise<SubscriberModelType | undefined>
  oldest: (column?: keyof SubscribersTable) => Promise<SubscriberModelType | undefined>
  skip: (count: number) => SubscriberModelType
  take: (count: number) => SubscriberModelType
  where: <V = string>(column: keyof SubscribersTable, ...args: [V] | [Operator, V]) => SubscriberModelType
  orWhere: (...conditions: [string, any][]) => SubscriberModelType
  whereNotIn: <V = number>(column: keyof SubscribersTable, values: V[]) => SubscriberModelType
  whereBetween: <V = number>(column: keyof SubscribersTable, range: [V, V]) => SubscriberModelType
  whereRef: (column: keyof SubscribersTable, ...args: string[]) => SubscriberModelType
  when: (condition: boolean, callback: (query: SubscriberModelType) => SubscriberModelType) => SubscriberModelType
  whereNull: (column: keyof SubscribersTable) => SubscriberModelType
  whereNotNull: (column: keyof SubscribersTable) => SubscriberModelType
  whereLike: (column: keyof SubscribersTable, value: string) => SubscriberModelType
  orderBy: (column: keyof SubscribersTable, order: 'asc' | 'desc') => SubscriberModelType
  orderByAsc: (column: keyof SubscribersTable) => SubscriberModelType
  orderByDesc: (column: keyof SubscribersTable) => SubscriberModelType
  groupBy: (column: keyof SubscribersTable) => SubscriberModelType
  having: <V = string>(column: keyof SubscribersTable, operator: Operator, value: V) => SubscriberModelType
  inRandomOrder: () => SubscriberModelType
  whereColumn: (first: keyof SubscribersTable, operator: Operator, second: keyof SubscribersTable) => SubscriberModelType
  max: (field: keyof SubscribersTable) => Promise<number>
  min: (field: keyof SubscribersTable) => Promise<number>
  avg: (field: keyof SubscribersTable) => Promise<number>
  sum: (field: keyof SubscribersTable) => Promise<number>
  count: () => Promise<number>
  get: () => Promise<SubscriberModelType[]>
  pluck: <K extends keyof SubscriberModelType>(field: K) => Promise<SubscriberModelType[K][]>
  chunk: (size: number, callback: (models: SubscriberModelType[]) => Promise<void>) => Promise<void>
  paginate: (options?: { limit?: number, offset?: number, page?: number }) => Promise<{
    data: SubscriberModelType[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }>
  create: (newSubscriber: NewSubscriber) => Promise<SubscriberModelType>
  firstOrCreate: (search: Partial<SubscribersTable>, values?: NewSubscriber) => Promise<SubscriberModelType>
  updateOrCreate: (search: Partial<SubscribersTable>, values?: NewSubscriber) => Promise<SubscriberModelType>
  createMany: (newSubscriber: NewSubscriber[]) => Promise<void>
  forceCreate: (newSubscriber: NewSubscriber) => Promise<SubscriberModelType>
  remove: (id: number) => Promise<any>
  whereIn: <V = number>(column: keyof SubscribersTable, values: V[]) => SubscriberModelType
  distinct: (column: keyof SubscriberJsonResponse) => SubscriberModelType
  join: (table: string, firstCol: string, secondCol: string) => SubscriberModelType

  // Instance methods
  createInstance: (data: SubscriberJsonResponse) => SubscriberModelType
  update: (newSubscriber: SubscriberUpdate) => Promise<SubscriberModelType | undefined>
  forceUpdate: (newSubscriber: SubscriberUpdate) => Promise<SubscriberModelType | undefined>
  save: () => Promise<SubscriberModelType>
  delete: () => Promise<number>
  toSearchableObject: () => Partial<SubscriberJsonResponse>
  toJSON: () => SubscriberJsonResponse
  parseResult: (model: SubscriberModelType) => SubscriberModelType

}
