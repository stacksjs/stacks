import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'

export interface SubscriberEmailsTable {
  id: Generated<number>
  email: string
  created_at?: string
  updated_at?: string
}

export type SubscriberEmailRead = SubscriberEmailsTable

export type SubscriberEmailWrite = Omit<SubscriberEmailsTable, 'created_at'> & {
  created_at?: string
}

export interface SubscriberEmailResponse {
  data: SubscriberEmailJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface SubscriberEmailJsonResponse extends Omit<Selectable<SubscriberEmailRead>, 'password'> {
  [key: string]: any
}

export type NewSubscriberEmail = Insertable<SubscriberEmailWrite>
export type SubscriberEmailUpdate = Updateable<SubscriberEmailWrite>

export interface SubscriberEmailModelType {
  // Properties
  readonly id: number
  get email(): string
  set email(value: string)

  get created_at(): string | undefined
  get updated_at(): string | undefined
  set updated_at(value: string)

  // Static methods
  with: (relations: string[]) => SubscriberEmailModelType
  select: (params: (keyof SubscriberEmailJsonResponse)[] | RawBuilder<string> | string) => SubscriberEmailModelType
  find: (id: number) => Promise<SubscriberEmailModelType | undefined>
  first: () => Promise<SubscriberEmailModelType | undefined>
  last: () => Promise<SubscriberEmailModelType | undefined>
  firstOrFail: () => Promise<SubscriberEmailModelType | undefined>
  all: () => Promise<SubscriberEmailModelType[]>
  findOrFail: (id: number) => Promise<SubscriberEmailModelType | undefined>
  findMany: (ids: number[]) => Promise<SubscriberEmailModelType[]>
  latest: (column?: keyof SubscriberEmailsTable) => Promise<SubscriberEmailModelType | undefined>
  oldest: (column?: keyof SubscriberEmailsTable) => Promise<SubscriberEmailModelType | undefined>
  skip: (count: number) => SubscriberEmailModelType
  take: (count: number) => SubscriberEmailModelType
  where: <V = string>(column: keyof SubscriberEmailsTable, ...args: [V] | [Operator, V]) => SubscriberEmailModelType
  orWhere: (...conditions: [string, any][]) => SubscriberEmailModelType
  whereNotIn: <V = number>(column: keyof SubscriberEmailsTable, values: V[]) => SubscriberEmailModelType
  whereBetween: <V = number>(column: keyof SubscriberEmailsTable, range: [V, V]) => SubscriberEmailModelType
  whereRef: (column: keyof SubscriberEmailsTable, ...args: string[]) => SubscriberEmailModelType
  when: (condition: boolean, callback: (query: SubscriberEmailModelType) => SubscriberEmailModelType) => SubscriberEmailModelType
  whereNull: (column: keyof SubscriberEmailsTable) => SubscriberEmailModelType
  whereNotNull: (column: keyof SubscriberEmailsTable) => SubscriberEmailModelType
  whereLike: (column: keyof SubscriberEmailsTable, value: string) => SubscriberEmailModelType
  orderBy: (column: keyof SubscriberEmailsTable, order: 'asc' | 'desc') => SubscriberEmailModelType
  orderByAsc: (column: keyof SubscriberEmailsTable) => SubscriberEmailModelType
  orderByDesc: (column: keyof SubscriberEmailsTable) => SubscriberEmailModelType
  groupBy: (column: keyof SubscriberEmailsTable) => SubscriberEmailModelType
  having: <V = string>(column: keyof SubscriberEmailsTable, operator: Operator, value: V) => SubscriberEmailModelType
  inRandomOrder: () => SubscriberEmailModelType
  whereColumn: (first: keyof SubscriberEmailsTable, operator: Operator, second: keyof SubscriberEmailsTable) => SubscriberEmailModelType
  max: (field: keyof SubscriberEmailsTable) => Promise<number>
  min: (field: keyof SubscriberEmailsTable) => Promise<number>
  avg: (field: keyof SubscriberEmailsTable) => Promise<number>
  sum: (field: keyof SubscriberEmailsTable) => Promise<number>
  count: () => Promise<number>
  get: () => Promise<SubscriberEmailModelType[]>
  pluck: <K extends keyof SubscriberEmailModelType>(field: K) => Promise<SubscriberEmailModelType[K][]>
  chunk: (size: number, callback: (models: SubscriberEmailModelType[]) => Promise<void>) => Promise<void>
  paginate: (options?: { limit?: number, offset?: number, page?: number }) => Promise<{
    data: SubscriberEmailModelType[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }>
  create: (newSubscriberEmail: NewSubscriberEmail) => Promise<SubscriberEmailModelType>
  firstOrCreate: (search: Partial<SubscriberEmailsTable>, values?: NewSubscriberEmail) => Promise<SubscriberEmailModelType>
  updateOrCreate: (search: Partial<SubscriberEmailsTable>, values?: NewSubscriberEmail) => Promise<SubscriberEmailModelType>
  createMany: (newSubscriberEmail: NewSubscriberEmail[]) => Promise<void>
  forceCreate: (newSubscriberEmail: NewSubscriberEmail) => Promise<SubscriberEmailModelType>
  remove: (id: number) => Promise<any>
  whereIn: <V = number>(column: keyof SubscriberEmailsTable, values: V[]) => SubscriberEmailModelType
  distinct: (column: keyof SubscriberEmailJsonResponse) => SubscriberEmailModelType
  join: (table: string, firstCol: string, secondCol: string) => SubscriberEmailModelType

  // Instance methods
  createInstance: (data: SubscriberEmailJsonResponse) => SubscriberEmailModelType
  update: (newSubscriberEmail: SubscriberEmailUpdate) => Promise<SubscriberEmailModelType | undefined>
  forceUpdate: (newSubscriberEmail: SubscriberEmailUpdate) => Promise<SubscriberEmailModelType | undefined>
  save: () => Promise<SubscriberEmailModelType>
  delete: () => Promise<number>
  toSearchableObject: () => Partial<SubscriberEmailJsonResponse>
  toJSON: () => SubscriberEmailJsonResponse
  parseResult: (model: SubscriberEmailModelType) => SubscriberEmailModelType

}
