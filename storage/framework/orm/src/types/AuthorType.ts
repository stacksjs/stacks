import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import type { PostModelType } from './PostType'
import type { UserModelType } from './UserType'

export interface AuthorsTable {
  id: Generated<number>
  name: string
  email: string
  uuid?: string
  created_at?: string
  updated_at?: string
}

export type AuthorRead = AuthorsTable

export type AuthorWrite = Omit<AuthorsTable, 'created_at'> & {
  created_at?: string
}

export interface AuthorResponse {
  data: AuthorJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface AuthorJsonResponse extends Omit<Selectable<AuthorRead>, 'password'> {
  [key: string]: any
}

export type NewAuthor = Insertable<AuthorWrite>
export type AuthorUpdate = Updateable<AuthorWrite>

export interface AuthorModelType {
  // Properties
  readonly id: number
  get name(): string
  set name(value: string)
  get email(): string
  set email(value: string)
  get post(): PostModelType[] | []
  get user(): UserModelType | undefined

  get uuid(): string | undefined
  set uuid(value: string)

  get created_at(): string | undefined
  get updated_at(): string | undefined
  set updated_at(value: string)

  // Static methods
  with: (relations: string[]) => AuthorModelType
  select: (params: (keyof AuthorJsonResponse)[] | RawBuilder<string> | string) => AuthorModelType
  find: (id: number) => Promise<AuthorModelType | undefined>
  first: () => Promise<AuthorModelType | undefined>
  last: () => Promise<AuthorModelType | undefined>
  firstOrFail: () => Promise<AuthorModelType | undefined>
  all: () => Promise<AuthorModelType[]>
  findOrFail: (id: number) => Promise<AuthorModelType | undefined>
  findMany: (ids: number[]) => Promise<AuthorModelType[]>
  latest: (column?: keyof AuthorsTable) => Promise<AuthorModelType | undefined>
  oldest: (column?: keyof AuthorsTable) => Promise<AuthorModelType | undefined>
  skip: (count: number) => AuthorModelType
  take: (count: number) => AuthorModelType
  where: <V = string>(column: keyof AuthorsTable, ...args: [V] | [Operator, V]) => AuthorModelType
  orWhere: (...conditions: [string, any][]) => AuthorModelType
  whereNotIn: <V = number>(column: keyof AuthorsTable, values: V[]) => AuthorModelType
  whereBetween: <V = number>(column: keyof AuthorsTable, range: [V, V]) => AuthorModelType
  whereRef: (column: keyof AuthorsTable, ...args: string[]) => AuthorModelType
  when: (condition: boolean, callback: (query: AuthorModelType) => AuthorModelType) => AuthorModelType
  whereNull: (column: keyof AuthorsTable) => AuthorModelType
  whereNotNull: (column: keyof AuthorsTable) => AuthorModelType
  whereLike: (column: keyof AuthorsTable, value: string) => AuthorModelType
  orderBy: (column: keyof AuthorsTable, order: 'asc' | 'desc') => AuthorModelType
  orderByAsc: (column: keyof AuthorsTable) => AuthorModelType
  orderByDesc: (column: keyof AuthorsTable) => AuthorModelType
  groupBy: (column: keyof AuthorsTable) => AuthorModelType
  having: <V = string>(column: keyof AuthorsTable, operator: Operator, value: V) => AuthorModelType
  inRandomOrder: () => AuthorModelType
  whereColumn: (first: keyof AuthorsTable, operator: Operator, second: keyof AuthorsTable) => AuthorModelType
  max: (field: keyof AuthorsTable) => Promise<number>
  min: (field: keyof AuthorsTable) => Promise<number>
  avg: (field: keyof AuthorsTable) => Promise<number>
  sum: (field: keyof AuthorsTable) => Promise<number>
  count: () => Promise<number>
  get: () => Promise<AuthorModelType[]>
  pluck: <K extends keyof AuthorModelType>(field: K) => Promise<AuthorModelType[K][]>
  chunk: (size: number, callback: (models: AuthorModelType[]) => Promise<void>) => Promise<void>
  paginate: (options?: { limit?: number, offset?: number, page?: number }) => Promise<{
    data: AuthorModelType[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }>
  create: (newAuthor: NewAuthor) => Promise<AuthorModelType>
  firstOrCreate: (search: Partial<AuthorsTable>, values?: NewAuthor) => Promise<AuthorModelType>
  updateOrCreate: (search: Partial<AuthorsTable>, values?: NewAuthor) => Promise<AuthorModelType>
  createMany: (newAuthor: NewAuthor[]) => Promise<void>
  forceCreate: (newAuthor: NewAuthor) => Promise<AuthorModelType>
  remove: (id: number) => Promise<any>
  whereIn: <V = number>(column: keyof AuthorsTable, values: V[]) => AuthorModelType
  distinct: (column: keyof AuthorJsonResponse) => AuthorModelType
  join: (table: string, firstCol: string, secondCol: string) => AuthorModelType

  // Instance methods
  createInstance: (data: AuthorJsonResponse) => AuthorModelType
  update: (newAuthor: AuthorUpdate) => Promise<AuthorModelType | undefined>
  forceUpdate: (newAuthor: AuthorUpdate) => Promise<AuthorModelType | undefined>
  save: () => Promise<AuthorModelType>
  delete: () => Promise<number>
  toSearchableObject: () => Partial<AuthorJsonResponse>
  toJSON: () => AuthorJsonResponse
  parseResult: (model: AuthorModelType) => AuthorModelType

  userBelong: () => Promise<UserModelType>
}
