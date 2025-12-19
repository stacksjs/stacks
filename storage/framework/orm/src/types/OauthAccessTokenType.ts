import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import type { UserModelType } from './UserType'
import type { OAuthClientModelType } from './OAuthClientType'


export interface OauthAccessTokensTable {
  id: Generated<number>
  token: string
  name?: string
  scopes?: string
  revoked: boolean
  expires_at?: Date | string
  created_at?: string
  updated_at?: string
}

export type OAuthAccessTokenRead = OauthAccessTokensTable

export type OAuthAccessTokenWrite = Omit<OauthAccessTokensTable, 'created_at'> & {
  created_at?: string
}

export interface OAuthAccessTokenResponse {
  data: OAuthAccessTokenJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface OAuthAccessTokenJsonResponse extends Omit<Selectable<OAuthAccessTokenRead>, 'password'> {
  [key: string]: any
}

export type NewOAuthAccessToken = Insertable<OAuthAccessTokenWrite>
export type OAuthAccessTokenUpdate = Updateable<OAuthAccessTokenWrite>

export interface OAuthAccessTokenModelType {
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
  get user(): UserModelType | undefined
        get o_auth_client(): OAuthClientModelType | undefined
      
  get created_at(): string | undefined
  get updated_at(): string | undefined
  set updated_at(value: string)

  // Static methods
  with: (relations: string[]) => OAuthAccessTokenModelType
  select: (params: (keyof OAuthAccessTokenJsonResponse)[] | RawBuilder<string> | string) => OAuthAccessTokenModelType
  find: (id: number) => Promise<OAuthAccessTokenModelType | undefined>
  first: () => Promise<OAuthAccessTokenModelType | undefined>
  last: () => Promise<OAuthAccessTokenModelType | undefined>
  firstOrFail: () => Promise<OAuthAccessTokenModelType | undefined>
  all: () => Promise<OAuthAccessTokenModelType[]>
  findOrFail: (id: number) => Promise<OAuthAccessTokenModelType | undefined>
  findMany: (ids: number[]) => Promise<OAuthAccessTokenModelType[]>
  latest: (column?: keyof OauthAccessTokensTable) => Promise<OAuthAccessTokenModelType | undefined>
  oldest: (column?: keyof OauthAccessTokensTable) => Promise<OAuthAccessTokenModelType | undefined>
  skip: (count: number) => OAuthAccessTokenModelType
  take: (count: number) => OAuthAccessTokenModelType
  where: <V = string>(column: keyof OauthAccessTokensTable, ...args: [V] | [Operator, V]) => OAuthAccessTokenModelType
  orWhere: (...conditions: [string, any][]) => OAuthAccessTokenModelType
  whereNotIn: <V = number>(column: keyof OauthAccessTokensTable, values: V[]) => OAuthAccessTokenModelType
  whereBetween: <V = number>(column: keyof OauthAccessTokensTable, range: [V, V]) => OAuthAccessTokenModelType
  whereRef: (column: keyof OauthAccessTokensTable, ...args: string[]) => OAuthAccessTokenModelType
  when: (condition: boolean, callback: (query: OAuthAccessTokenModelType) => OAuthAccessTokenModelType) => OAuthAccessTokenModelType
  whereNull: (column: keyof OauthAccessTokensTable) => OAuthAccessTokenModelType
  whereNotNull: (column: keyof OauthAccessTokensTable) => OAuthAccessTokenModelType
  whereLike: (column: keyof OauthAccessTokensTable, value: string) => OAuthAccessTokenModelType
  orderBy: (column: keyof OauthAccessTokensTable, order: 'asc' | 'desc') => OAuthAccessTokenModelType
  orderByAsc: (column: keyof OauthAccessTokensTable) => OAuthAccessTokenModelType
  orderByDesc: (column: keyof OauthAccessTokensTable) => OAuthAccessTokenModelType
  groupBy: (column: keyof OauthAccessTokensTable) => OAuthAccessTokenModelType
  having: <V = string>(column: keyof OauthAccessTokensTable, operator: Operator, value: V) => OAuthAccessTokenModelType
  inRandomOrder: () => OAuthAccessTokenModelType
  whereColumn: (first: keyof OauthAccessTokensTable, operator: Operator, second: keyof OauthAccessTokensTable) => OAuthAccessTokenModelType
  max: (field: keyof OauthAccessTokensTable) => Promise<number>
  min: (field: keyof OauthAccessTokensTable) => Promise<number>
  avg: (field: keyof OauthAccessTokensTable) => Promise<number>
  sum: (field: keyof OauthAccessTokensTable) => Promise<number>
  count: () => Promise<number>
  get: () => Promise<OAuthAccessTokenModelType[]>
  pluck: <K extends keyof OAuthAccessTokenModelType>(field: K) => Promise<OAuthAccessTokenModelType[K][]>
  chunk: (size: number, callback: (models: OAuthAccessTokenModelType[]) => Promise<void>) => Promise<void>
  paginate: (options?: { limit?: number, offset?: number, page?: number }) => Promise<{
    data: OAuthAccessTokenModelType[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }>
  create: (newOAuthAccessToken: NewOAuthAccessToken) => Promise<OAuthAccessTokenModelType>
  firstOrCreate: (search: Partial<OauthAccessTokensTable>, values?: NewOAuthAccessToken) => Promise<OAuthAccessTokenModelType>
  updateOrCreate: (search: Partial<OauthAccessTokensTable>, values?: NewOAuthAccessToken) => Promise<OAuthAccessTokenModelType>
  createMany: (newOAuthAccessToken: NewOAuthAccessToken[]) => Promise<void>
  forceCreate: (newOAuthAccessToken: NewOAuthAccessToken) => Promise<OAuthAccessTokenModelType>
  remove: (id: number) => Promise<any>
  whereIn: <V = number>(column: keyof OauthAccessTokensTable, values: V[]) => OAuthAccessTokenModelType
  distinct: (column: keyof OAuthAccessTokenJsonResponse) => OAuthAccessTokenModelType
  join: (table: string, firstCol: string, secondCol: string) => OAuthAccessTokenModelType

  // Instance methods
  createInstance: (data: OAuthAccessTokenJsonResponse) => OAuthAccessTokenModelType
  update: (newOAuthAccessToken: OAuthAccessTokenUpdate) => Promise<OAuthAccessTokenModelType | undefined>
  forceUpdate: (newOAuthAccessToken: OAuthAccessTokenUpdate) => Promise<OAuthAccessTokenModelType | undefined>
  save: () => Promise<OAuthAccessTokenModelType>
  delete: () => Promise<number>
  toSearchableObject: () => Partial<OAuthAccessTokenJsonResponse>
  toJSON: () => OAuthAccessTokenJsonResponse
  parseResult: (model: OAuthAccessTokenModelType) => OAuthAccessTokenModelType

    userBelong: () => Promise<UserModelType>
    oAuthClientBelong: () => Promise<OAuthClientModelType>
}