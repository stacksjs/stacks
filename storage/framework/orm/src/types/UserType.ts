import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import type { CustomerModelType } from './CustomerType'
import type { PersonalAccessTokenModelType } from './PersonalAccessTokenType'

export interface UsersTable {
  id: Generated<number>
  name: string
  email: string
  password: string
  uuid?: string
  created_at?: string
  updated_at?: string
}

export type UserRead = UsersTable

export type UserWrite = Omit<UsersTable, 'created_at'> & {
  created_at?: string
}

export interface UserResponse {
  data: UserJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface UserJsonResponse extends Omit<Selectable<UserRead>, 'password'> {
  [key: string]: any
}

export type NewUser = Insertable<UserWrite>
export type UserUpdate = Updateable<UserWrite>

export interface UserModelType {
  // Properties
  readonly id: number
  get name(): string
  set name(value: string)
  get email(): string
  set email(value: string)
  get password(): string
  set password(value: string)
  get personal_access_token(): PersonalAccessTokenModelType[] | []
  get customer(): CustomerModelType[] | []

  get uuid(): string | undefined
  set uuid(value: string)

  get created_at(): string | undefined
  get updated_at(): string | undefined
  set updated_at(value: string)

  // Static methods
  with: (relations: string[]) => UserModelType
  select: (params: (keyof UserJsonResponse)[] | RawBuilder<string> | string) => UserModelType
  find: (id: number) => Promise<UserModelType | undefined>
  first: () => Promise<UserModelType | undefined>
  last: () => Promise<UserModelType | undefined>
  firstOrFail: () => Promise<UserModelType | undefined>
  all: () => Promise<UserModelType[]>
  findOrFail: (id: number) => Promise<UserModelType | undefined>
  findMany: (ids: number[]) => Promise<UserModelType[]>
  latest: (column?: keyof UsersTable) => Promise<UserModelType | undefined>
  oldest: (column?: keyof UsersTable) => Promise<UserModelType | undefined>
  skip: (count: number) => UserModelType
  take: (count: number) => UserModelType
  where: <V = string>(column: keyof UsersTable, ...args: [V] | [Operator, V]) => UserModelType
  orWhere: (...conditions: [string, any][]) => UserModelType
  whereNotIn: <V = number>(column: keyof UsersTable, values: V[]) => UserModelType
  whereBetween: <V = number>(column: keyof UsersTable, range: [V, V]) => UserModelType
  whereRef: (column: keyof UsersTable, ...args: string[]) => UserModelType
  when: (condition: boolean, callback: (query: UserModelType) => UserModelType) => UserModelType
  whereNull: (column: keyof UsersTable) => UserModelType
  whereNotNull: (column: keyof UsersTable) => UserModelType
  whereLike: (column: keyof UsersTable, value: string) => UserModelType
  orderBy: (column: keyof UsersTable, order: 'asc' | 'desc') => UserModelType
  orderByAsc: (column: keyof UsersTable) => UserModelType
  orderByDesc: (column: keyof UsersTable) => UserModelType
  groupBy: (column: keyof UsersTable) => UserModelType
  having: <V = string>(column: keyof UsersTable, operator: Operator, value: V) => UserModelType
  inRandomOrder: () => UserModelType
  whereColumn: (first: keyof UsersTable, operator: Operator, second: keyof UsersTable) => UserModelType
  max: (field: keyof UsersTable) => Promise<number>
  min: (field: keyof UsersTable) => Promise<number>
  avg: (field: keyof UsersTable) => Promise<number>
  sum: (field: keyof UsersTable) => Promise<number>
  count: () => Promise<number>
  get: () => Promise<UserModelType[]>
  pluck: <K extends keyof UserModelType>(field: K) => Promise<UserModelType[K][]>
  chunk: (size: number, callback: (models: UserModelType[]) => Promise<void>) => Promise<void>
  paginate: (options?: { limit?: number, offset?: number, page?: number }) => Promise<{
    data: UserModelType[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }>
  create: (newUser: NewUser) => Promise<UserModelType>
  firstOrCreate: (search: Partial<UsersTable>, values?: NewUser) => Promise<UserModelType>
  updateOrCreate: (search: Partial<UsersTable>, values?: NewUser) => Promise<UserModelType>
  createMany: (newUser: NewUser[]) => Promise<void>
  forceCreate: (newUser: NewUser) => Promise<UserModelType>
  remove: (id: number) => Promise<any>
  whereIn: <V = number>(column: keyof UsersTable, values: V[]) => UserModelType
  distinct: (column: keyof UserJsonResponse) => UserModelType
  join: (table: string, firstCol: string, secondCol: string) => UserModelType

  // Instance methods
  createInstance: (data: UserJsonResponse) => UserModelType
  update: (newUser: UserUpdate) => Promise<UserModelType | undefined>
  forceUpdate: (newUser: UserUpdate) => Promise<UserModelType | undefined>
  save: () => Promise<UserModelType>
  delete: () => Promise<number>
  toSearchableObject: () => Partial<UserJsonResponse>
  toJSON: () => UserJsonResponse
  parseResult: (model: UserModelType) => UserModelType

}
