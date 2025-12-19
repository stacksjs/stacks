import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'


export interface OauthClientsTable {
  id: Generated<number>
  name: string
  secret?: string
  provider?: string
  redirect: string
  personal_access_client: boolean
  password_client: boolean
  revoked: boolean
  created_at?: string
  updated_at?: string
}

export type OAuthClientRead = OauthClientsTable

export type OAuthClientWrite = Omit<OauthClientsTable, 'created_at'> & {
  created_at?: string
}

export interface OAuthClientResponse {
  data: OAuthClientJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface OAuthClientJsonResponse extends Omit<Selectable<OAuthClientRead>, 'password'> {
  [key: string]: any
}

export type NewOAuthClient = Insertable<OAuthClientWrite>
export type OAuthClientUpdate = Updateable<OAuthClientWrite>

export interface OAuthClientModelType {
  // Properties
  readonly id: number
  get name(): string
  set name(value: string)
  get secret(): string | undefined
  set secret(value: string)
  get provider(): string | undefined
  set provider(value: string)
  get redirect(): string
  set redirect(value: string)
  get personalAccessClient(): boolean
  set personalAccessClient(value: boolean)
  get passwordClient(): boolean
  set passwordClient(value: boolean)
  get revoked(): boolean
  set revoked(value: boolean)

  get created_at(): string | undefined
  get updated_at(): string | undefined
  set updated_at(value: string)

  // Static methods
  with: (relations: string[]) => OAuthClientModelType
  select: (params: (keyof OAuthClientJsonResponse)[] | RawBuilder<string> | string) => OAuthClientModelType
  find: (id: number) => Promise<OAuthClientModelType | undefined>
  first: () => Promise<OAuthClientModelType | undefined>
  last: () => Promise<OAuthClientModelType | undefined>
  firstOrFail: () => Promise<OAuthClientModelType | undefined>
  all: () => Promise<OAuthClientModelType[]>
  findOrFail: (id: number) => Promise<OAuthClientModelType | undefined>
  findMany: (ids: number[]) => Promise<OAuthClientModelType[]>
  latest: (column?: keyof OauthClientsTable) => Promise<OAuthClientModelType | undefined>
  oldest: (column?: keyof OauthClientsTable) => Promise<OAuthClientModelType | undefined>
  skip: (count: number) => OAuthClientModelType
  take: (count: number) => OAuthClientModelType
  where: <V = string>(column: keyof OauthClientsTable, ...args: [V] | [Operator, V]) => OAuthClientModelType
  orWhere: (...conditions: [string, any][]) => OAuthClientModelType
  whereNotIn: <V = number>(column: keyof OauthClientsTable, values: V[]) => OAuthClientModelType
  whereBetween: <V = number>(column: keyof OauthClientsTable, range: [V, V]) => OAuthClientModelType
  whereRef: (column: keyof OauthClientsTable, ...args: string[]) => OAuthClientModelType
  when: (condition: boolean, callback: (query: OAuthClientModelType) => OAuthClientModelType) => OAuthClientModelType
  whereNull: (column: keyof OauthClientsTable) => OAuthClientModelType
  whereNotNull: (column: keyof OauthClientsTable) => OAuthClientModelType
  whereLike: (column: keyof OauthClientsTable, value: string) => OAuthClientModelType
  orderBy: (column: keyof OauthClientsTable, order: 'asc' | 'desc') => OAuthClientModelType
  orderByAsc: (column: keyof OauthClientsTable) => OAuthClientModelType
  orderByDesc: (column: keyof OauthClientsTable) => OAuthClientModelType
  groupBy: (column: keyof OauthClientsTable) => OAuthClientModelType
  having: <V = string>(column: keyof OauthClientsTable, operator: Operator, value: V) => OAuthClientModelType
  inRandomOrder: () => OAuthClientModelType
  whereColumn: (first: keyof OauthClientsTable, operator: Operator, second: keyof OauthClientsTable) => OAuthClientModelType
  max: (field: keyof OauthClientsTable) => Promise<number>
  min: (field: keyof OauthClientsTable) => Promise<number>
  avg: (field: keyof OauthClientsTable) => Promise<number>
  sum: (field: keyof OauthClientsTable) => Promise<number>
  count: () => Promise<number>
  get: () => Promise<OAuthClientModelType[]>
  pluck: <K extends keyof OAuthClientModelType>(field: K) => Promise<OAuthClientModelType[K][]>
  chunk: (size: number, callback: (models: OAuthClientModelType[]) => Promise<void>) => Promise<void>
  paginate: (options?: { limit?: number, offset?: number, page?: number }) => Promise<{
    data: OAuthClientModelType[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }>
  create: (newOAuthClient: NewOAuthClient) => Promise<OAuthClientModelType>
  firstOrCreate: (search: Partial<OauthClientsTable>, values?: NewOAuthClient) => Promise<OAuthClientModelType>
  updateOrCreate: (search: Partial<OauthClientsTable>, values?: NewOAuthClient) => Promise<OAuthClientModelType>
  createMany: (newOAuthClient: NewOAuthClient[]) => Promise<void>
  forceCreate: (newOAuthClient: NewOAuthClient) => Promise<OAuthClientModelType>
  remove: (id: number) => Promise<any>
  whereIn: <V = number>(column: keyof OauthClientsTable, values: V[]) => OAuthClientModelType
  distinct: (column: keyof OAuthClientJsonResponse) => OAuthClientModelType
  join: (table: string, firstCol: string, secondCol: string) => OAuthClientModelType

  // Instance methods
  createInstance: (data: OAuthClientJsonResponse) => OAuthClientModelType
  update: (newOAuthClient: OAuthClientUpdate) => Promise<OAuthClientModelType | undefined>
  forceUpdate: (newOAuthClient: OAuthClientUpdate) => Promise<OAuthClientModelType | undefined>
  save: () => Promise<OAuthClientModelType>
  delete: () => Promise<number>
  toSearchableObject: () => Partial<OAuthClientJsonResponse>
  toJSON: () => OAuthClientJsonResponse
  parseResult: (model: OAuthClientModelType) => OAuthClientModelType

}