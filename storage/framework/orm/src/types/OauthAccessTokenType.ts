import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'

export interface OauthAccessTokensTable {
  id: Generated<number>
  token: string
  name?: string
  scopes?: string
  revoked: boolean
  expires_at?: Date | string
  user_id?: number
  oauth_client_id?: number
  created_at?: string
  updated_at?: string
}

export type OauthAccessTokenRead = OauthAccessTokensTable

export type OauthAccessTokenWrite = Omit<OauthAccessTokensTable, 'created_at'> & {
  created_at?: string
}

export interface OauthAccessTokenResponse {
  data: OauthAccessTokenJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface OauthAccessTokenJsonResponse extends Omit<Selectable<OauthAccessTokenRead>, 'password'> {
  [key: string]: any
}

export type NewOauthAccessToken = Insertable<OauthAccessTokenWrite>
export type OauthAccessTokenUpdate = Updateable<OauthAccessTokenWrite>

export interface OauthAccessTokenModelType {
  // Properties
  readonly id: number
  get token(): string
  set token(value: string)
  get name(): string | undefined
  set name(value: string)
  get scopes(): string | undefined
  set scopes(value: string)
  get revoked(): boolean
  set revoked(value: boolean)
  get expiresAt(): Date | string | undefined
  set expiresAt(value: Date | string)

  userBelong: () => Promise<UserType>
  oauthClientBelong: () => Promise<OauthClientType>
  get created_at(): string | undefined
  get updated_at(): string | undefined
  set updated_at(value: string)

  // Static methods
  with: (relations: string[]) => OauthAccessTokenModelType
  select: (params: (keyof OauthAccessTokenJsonResponse)[] | RawBuilder<string> | string) => OauthAccessTokenModelType
  find: (id: number) => Promise<OauthAccessTokenModelType | undefined>
  first: () => Promise<OauthAccessTokenModelType | undefined>
  last: () => Promise<OauthAccessTokenModelType | undefined>
  firstOrFail: () => Promise<OauthAccessTokenModelType | undefined>
  all: () => Promise<OauthAccessTokenModelType[]>
  findOrFail: (id: number) => Promise<OauthAccessTokenModelType | undefined>
  findMany: (ids: number[]) => Promise<OauthAccessTokenModelType[]>
  latest: (column?: keyof OauthAccessTokensTable) => Promise<OauthAccessTokenModelType | undefined>
  oldest: (column?: keyof OauthAccessTokensTable) => Promise<OauthAccessTokenModelType | undefined>
  skip: (count: number) => OauthAccessTokenModelType
  take: (count: number) => OauthAccessTokenModelType
  where: <V = string>(column: keyof OauthAccessTokensTable, ...args: [V] | [Operator, V]) => OauthAccessTokenModelType
  orWhere: (...conditions: [string, any][]) => OauthAccessTokenModelType
  whereNotIn: <V = number>(column: keyof OauthAccessTokensTable, values: V[]) => OauthAccessTokenModelType
  whereBetween: <V = number>(column: keyof OauthAccessTokensTable, range: [V, V]) => OauthAccessTokenModelType
  whereRef: (column: keyof OauthAccessTokensTable, ...args: string[]) => OauthAccessTokenModelType
  when: (condition: boolean, callback: (query: OauthAccessTokenModelType) => OauthAccessTokenModelType) => OauthAccessTokenModelType
  whereNull: (column: keyof OauthAccessTokensTable) => OauthAccessTokenModelType
  whereNotNull: (column: keyof OauthAccessTokensTable) => OauthAccessTokenModelType
  whereLike: (column: keyof OauthAccessTokensTable, value: string) => OauthAccessTokenModelType
  orderBy: (column: keyof OauthAccessTokensTable, order: 'asc' | 'desc') => OauthAccessTokenModelType
  orderByAsc: (column: keyof OauthAccessTokensTable) => OauthAccessTokenModelType
  orderByDesc: (column: keyof OauthAccessTokensTable) => OauthAccessTokenModelType
  groupBy: (column: keyof OauthAccessTokensTable) => OauthAccessTokenModelType
  having: <V = string>(column: keyof OauthAccessTokensTable, operator: Operator, value: V) => OauthAccessTokenModelType
  inRandomOrder: () => OauthAccessTokenModelType
  whereColumn: (first: keyof OauthAccessTokensTable, operator: Operator, second: keyof OauthAccessTokensTable) => OauthAccessTokenModelType
  max: (field: keyof OauthAccessTokensTable) => Promise<number>
  min: (field: keyof OauthAccessTokensTable) => Promise<number>
  avg: (field: keyof OauthAccessTokensTable) => Promise<number>
  sum: (field: keyof OauthAccessTokensTable) => Promise<number>
  count: () => Promise<number>
  get: () => Promise<OauthAccessTokenModelType[]>
  pluck: <K extends keyof OauthAccessTokenModelType>(field: K) => Promise<OauthAccessTokenModelType[K][]>
  chunk: (size: number, callback: (models: OauthAccessTokenModelType[]) => Promise<void>) => Promise<void>
  paginate: (options?: { limit?: number, offset?: number, page?: number }) => Promise<{
    data: OauthAccessTokenModelType[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }>
  create: (newOauthAccessToken: NewOauthAccessToken) => Promise<OauthAccessTokenModelType>
  firstOrCreate: (search: Partial<OauthAccessTokensTable>, values?: NewOauthAccessToken) => Promise<OauthAccessTokenModelType>
  updateOrCreate: (search: Partial<OauthAccessTokensTable>, values?: NewOauthAccessToken) => Promise<OauthAccessTokenModelType>
  createMany: (newOauthAccessToken: NewOauthAccessToken[]) => Promise<void>
  forceCreate: (newOauthAccessToken: NewOauthAccessToken) => Promise<OauthAccessTokenModelType>
  remove: (id: number) => Promise<any>
  whereIn: <V = number>(column: keyof OauthAccessTokensTable, values: V[]) => OauthAccessTokenModelType
  distinct: (column: keyof OauthAccessTokenJsonResponse) => OauthAccessTokenModelType
  join: (table: string, firstCol: string, secondCol: string) => OauthAccessTokenModelType

  // Instance methods
  createInstance: (data: OauthAccessTokenJsonResponse) => OauthAccessTokenModelType
  update: (newOauthAccessToken: OauthAccessTokenUpdate) => Promise<OauthAccessTokenModelType | undefined>
  forceUpdate: (newOauthAccessToken: OauthAccessTokenUpdate) => Promise<OauthAccessTokenModelType | undefined>
  save: () => Promise<OauthAccessTokenModelType>
  delete: () => Promise<number>
  toSearchableObject: () => Partial<OauthAccessTokenJsonResponse>
  toJSON: () => OauthAccessTokenJsonResponse
  parseResult: (model: OauthAccessTokenModelType) => OauthAccessTokenModelType

  userBelong: () => Promise<UserType>
  oauthClientBelong: () => Promise<OauthClientType>
}
