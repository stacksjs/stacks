import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import type { OauthAccessTokenModelType } from './OauthAccessTokenType'

export interface OauthClientsTable {
  id: Generated<number>
  name: string
  secret: string
  provider: string
  redirect: string
  personal_access_client: boolean
  password_client: boolean
  revoked: boolean
  user_id?: number
  created_at?: string
  updated_at?: string
}

export type OauthClientRead = OauthClientsTable

export type OauthClientWrite = Omit<OauthClientsTable, 'created_at'> & {
  created_at?: string
}

export interface OauthClientResponse {
  data: OauthClientJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface OauthClientJsonResponse extends Omit<Selectable<OauthClientRead>, 'password'> {
  [key: string]: any
}

export type NewOauthClient = Insertable<OauthClientWrite>
export type OauthClientUpdate = Updateable<OauthClientWrite>

export interface OauthClientModelType {
  // Properties
  readonly id: number
  get name(): string
  set name(value: string)
  get secret(): string
  set secret(value: string)
  get provider(): string
  set provider(value: string)
  get redirect(): string
  set redirect(value: string)
  get personalAccessClient(): boolean
  set personalAccessClient(value: boolean)
  get passwordClient(): boolean
  set passwordClient(value: boolean)
  get revoked(): boolean
  set revoked(value: boolean)
  get oauth_access_token(): OauthAccessTokenModelType[] | []

  userBelong: () => Promise<UserType>
  get created_at(): string | undefined
  get updated_at(): string | undefined
  set updated_at(value: string)

  // Static methods
  with: (relations: string[]) => OauthClientModelType
  select: (params: (keyof OauthClientJsonResponse)[] | RawBuilder<string> | string) => OauthClientModelType
  find: (id: number) => Promise<OauthClientModelType | undefined>
  first: () => Promise<OauthClientModelType | undefined>
  last: () => Promise<OauthClientModelType | undefined>
  firstOrFail: () => Promise<OauthClientModelType | undefined>
  all: () => Promise<OauthClientModelType[]>
  findOrFail: (id: number) => Promise<OauthClientModelType | undefined>
  findMany: (ids: number[]) => Promise<OauthClientModelType[]>
  latest: (column?: keyof OauthClientsTable) => Promise<OauthClientModelType | undefined>
  oldest: (column?: keyof OauthClientsTable) => Promise<OauthClientModelType | undefined>
  skip: (count: number) => OauthClientModelType
  take: (count: number) => OauthClientModelType
  where: <V = string>(column: keyof OauthClientsTable, ...args: [V] | [Operator, V]) => OauthClientModelType
  orWhere: (...conditions: [string, any][]) => OauthClientModelType
  whereNotIn: <V = number>(column: keyof OauthClientsTable, values: V[]) => OauthClientModelType
  whereBetween: <V = number>(column: keyof OauthClientsTable, range: [V, V]) => OauthClientModelType
  whereRef: (column: keyof OauthClientsTable, ...args: string[]) => OauthClientModelType
  when: (condition: boolean, callback: (query: OauthClientModelType) => OauthClientModelType) => OauthClientModelType
  whereNull: (column: keyof OauthClientsTable) => OauthClientModelType
  whereNotNull: (column: keyof OauthClientsTable) => OauthClientModelType
  whereLike: (column: keyof OauthClientsTable, value: string) => OauthClientModelType
  orderBy: (column: keyof OauthClientsTable, order: 'asc' | 'desc') => OauthClientModelType
  orderByAsc: (column: keyof OauthClientsTable) => OauthClientModelType
  orderByDesc: (column: keyof OauthClientsTable) => OauthClientModelType
  groupBy: (column: keyof OauthClientsTable) => OauthClientModelType
  having: <V = string>(column: keyof OauthClientsTable, operator: Operator, value: V) => OauthClientModelType
  inRandomOrder: () => OauthClientModelType
  whereColumn: (first: keyof OauthClientsTable, operator: Operator, second: keyof OauthClientsTable) => OauthClientModelType
  max: (field: keyof OauthClientsTable) => Promise<number>
  min: (field: keyof OauthClientsTable) => Promise<number>
  avg: (field: keyof OauthClientsTable) => Promise<number>
  sum: (field: keyof OauthClientsTable) => Promise<number>
  count: () => Promise<number>
  get: () => Promise<OauthClientModelType[]>
  pluck: <K extends keyof OauthClientModelType>(field: K) => Promise<OauthClientModelType[K][]>
  chunk: (size: number, callback: (models: OauthClientModelType[]) => Promise<void>) => Promise<void>
  paginate: (options?: { limit?: number, offset?: number, page?: number }) => Promise<{
    data: OauthClientModelType[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }>
  create: (newOauthClient: NewOauthClient) => Promise<OauthClientModelType>
  firstOrCreate: (search: Partial<OauthClientsTable>, values?: NewOauthClient) => Promise<OauthClientModelType>
  updateOrCreate: (search: Partial<OauthClientsTable>, values?: NewOauthClient) => Promise<OauthClientModelType>
  createMany: (newOauthClient: NewOauthClient[]) => Promise<void>
  forceCreate: (newOauthClient: NewOauthClient) => Promise<OauthClientModelType>
  remove: (id: number) => Promise<any>
  whereIn: <V = number>(column: keyof OauthClientsTable, values: V[]) => OauthClientModelType
  distinct: (column: keyof OauthClientJsonResponse) => OauthClientModelType
  join: (table: string, firstCol: string, secondCol: string) => OauthClientModelType

  // Instance methods
  createInstance: (data: OauthClientJsonResponse) => OauthClientModelType
  update: (newOauthClient: OauthClientUpdate) => Promise<OauthClientModelType | undefined>
  forceUpdate: (newOauthClient: OauthClientUpdate) => Promise<OauthClientModelType | undefined>
  save: () => Promise<OauthClientModelType>
  delete: () => Promise<number>
  toSearchableObject: () => Partial<OauthClientJsonResponse>
  toJSON: () => OauthClientJsonResponse
  parseResult: (model: OauthClientModelType) => OauthClientModelType

  userBelong: () => Promise<UserType>
}
