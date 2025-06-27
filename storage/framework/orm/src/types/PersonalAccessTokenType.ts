import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'

export interface PersonalAccessTokensTable {
  id: Generated<number>
  name: string
  token?: string
  plain_text_token: string
  abilities: string
  last_used_at?: Date | string
  expires_at?: Date | string
  revoked_at?: Date | string
  ip_address?: string
  device_name?: string
  is_single_use: boolean
  user_id?: number
  created_at?: string
  updated_at?: string
}

export type PersonalAccessTokenRead = PersonalAccessTokensTable

export type PersonalAccessTokenWrite = Omit<PersonalAccessTokensTable, 'created_at'> & {
  created_at?: string
}

export interface PersonalAccessTokenResponse {
  data: PersonalAccessTokenJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface PersonalAccessTokenJsonResponse extends Omit<Selectable<PersonalAccessTokenRead>, 'password'> {
  [key: string]: any
}

export type NewPersonalAccessToken = Insertable<PersonalAccessTokenWrite>
export type PersonalAccessTokenUpdate = Updateable<PersonalAccessTokenWrite>

export interface PersonalAccessTokenModelType {
  // Properties
  readonly id: number
  get name(): string
  set name(value: string)
  get token(): string | undefined
  set token(value: string)
  get plainTextToken(): string
  set plainTextToken(value: string)
  get abilities(): string
  set abilities(value: string)
  get lastUsedAt(): Date | string | undefined
  set lastUsedAt(value: Date | string)
  get expiresAt(): Date | string | undefined
  set expiresAt(value: Date | string)
  get revokedAt(): Date | string | undefined
  set revokedAt(value: Date | string)
  get ipAddress(): string | undefined
  set ipAddress(value: string)
  get deviceName(): string | undefined
  set deviceName(value: string)
  get isSingleUse(): boolean
  set isSingleUse(value: boolean)

  userBelong: () => Promise<UserType>
  get created_at(): string | undefined
  get updated_at(): string | undefined
  set updated_at(value: string)

  // Static methods
  with: (relations: string[]) => PersonalAccessTokenModelType
  select: (params: (keyof PersonalAccessTokenJsonResponse)[] | RawBuilder<string> | string) => PersonalAccessTokenModelType
  find: (id: number) => Promise<PersonalAccessTokenModelType | undefined>
  first: () => Promise<PersonalAccessTokenModelType | undefined>
  last: () => Promise<PersonalAccessTokenModelType | undefined>
  firstOrFail: () => Promise<PersonalAccessTokenModelType | undefined>
  all: () => Promise<PersonalAccessTokenModelType[]>
  findOrFail: (id: number) => Promise<PersonalAccessTokenModelType | undefined>
  findMany: (ids: number[]) => Promise<PersonalAccessTokenModelType[]>
  latest: (column?: keyof PersonalAccessTokensTable) => Promise<PersonalAccessTokenModelType | undefined>
  oldest: (column?: keyof PersonalAccessTokensTable) => Promise<PersonalAccessTokenModelType | undefined>
  skip: (count: number) => PersonalAccessTokenModelType
  take: (count: number) => PersonalAccessTokenModelType
  where: <V = string>(column: keyof PersonalAccessTokensTable, ...args: [V] | [Operator, V]) => PersonalAccessTokenModelType
  orWhere: (...conditions: [string, any][]) => PersonalAccessTokenModelType
  whereNotIn: <V = number>(column: keyof PersonalAccessTokensTable, values: V[]) => PersonalAccessTokenModelType
  whereBetween: <V = number>(column: keyof PersonalAccessTokensTable, range: [V, V]) => PersonalAccessTokenModelType
  whereRef: (column: keyof PersonalAccessTokensTable, ...args: string[]) => PersonalAccessTokenModelType
  when: (condition: boolean, callback: (query: PersonalAccessTokenModelType) => PersonalAccessTokenModelType) => PersonalAccessTokenModelType
  whereNull: (column: keyof PersonalAccessTokensTable) => PersonalAccessTokenModelType
  whereNotNull: (column: keyof PersonalAccessTokensTable) => PersonalAccessTokenModelType
  whereLike: (column: keyof PersonalAccessTokensTable, value: string) => PersonalAccessTokenModelType
  orderBy: (column: keyof PersonalAccessTokensTable, order: 'asc' | 'desc') => PersonalAccessTokenModelType
  orderByAsc: (column: keyof PersonalAccessTokensTable) => PersonalAccessTokenModelType
  orderByDesc: (column: keyof PersonalAccessTokensTable) => PersonalAccessTokenModelType
  groupBy: (column: keyof PersonalAccessTokensTable) => PersonalAccessTokenModelType
  having: <V = string>(column: keyof PersonalAccessTokensTable, operator: Operator, value: V) => PersonalAccessTokenModelType
  inRandomOrder: () => PersonalAccessTokenModelType
  whereColumn: (first: keyof PersonalAccessTokensTable, operator: Operator, second: keyof PersonalAccessTokensTable) => PersonalAccessTokenModelType
  max: (field: keyof PersonalAccessTokensTable) => Promise<number>
  min: (field: keyof PersonalAccessTokensTable) => Promise<number>
  avg: (field: keyof PersonalAccessTokensTable) => Promise<number>
  sum: (field: keyof PersonalAccessTokensTable) => Promise<number>
  count: () => Promise<number>
  get: () => Promise<PersonalAccessTokenModelType[]>
  pluck: <K extends keyof PersonalAccessTokenModelType>(field: K) => Promise<PersonalAccessTokenModelType[K][]>
  chunk: (size: number, callback: (models: PersonalAccessTokenModelType[]) => Promise<void>) => Promise<void>
  paginate: (options?: { limit?: number, offset?: number, page?: number }) => Promise<{
    data: PersonalAccessTokenModelType[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }>
  create: (newPersonalAccessToken: NewPersonalAccessToken) => Promise<PersonalAccessTokenModelType>
  firstOrCreate: (search: Partial<PersonalAccessTokensTable>, values?: NewPersonalAccessToken) => Promise<PersonalAccessTokenModelType>
  updateOrCreate: (search: Partial<PersonalAccessTokensTable>, values?: NewPersonalAccessToken) => Promise<PersonalAccessTokenModelType>
  createMany: (newPersonalAccessToken: NewPersonalAccessToken[]) => Promise<void>
  forceCreate: (newPersonalAccessToken: NewPersonalAccessToken) => Promise<PersonalAccessTokenModelType>
  remove: (id: number) => Promise<any>
  whereIn: <V = number>(column: keyof PersonalAccessTokensTable, values: V[]) => PersonalAccessTokenModelType
  distinct: (column: keyof PersonalAccessTokenJsonResponse) => PersonalAccessTokenModelType
  join: (table: string, firstCol: string, secondCol: string) => PersonalAccessTokenModelType

  // Instance methods
  createInstance: (data: PersonalAccessTokenJsonResponse) => PersonalAccessTokenModelType
  update: (newPersonalAccessToken: PersonalAccessTokenUpdate) => Promise<PersonalAccessTokenModelType | undefined>
  forceUpdate: (newPersonalAccessToken: PersonalAccessTokenUpdate) => Promise<PersonalAccessTokenModelType | undefined>
  save: () => Promise<PersonalAccessTokenModelType>
  delete: () => Promise<number>
  toSearchableObject: () => Partial<PersonalAccessTokenJsonResponse>
  toJSON: () => PersonalAccessTokenJsonResponse
  parseResult: (model: PersonalAccessTokenModelType) => PersonalAccessTokenModelType

  userBelong: () => Promise<UserType>
}
