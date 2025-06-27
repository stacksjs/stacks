import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import type { PersonalAccessTokenModelType } from './PersonalAccessTokenType'

export interface TeamsTable {
  id: Generated<number>
  name: string
  company_name: string
  email: string
  billing_email: string
  status: string
  description: string
  path: string
  is_personal: boolean
  created_at?: string
  updated_at?: string
}

export type TeamRead = TeamsTable

export type TeamWrite = Omit<TeamsTable, 'created_at'> & {
  created_at?: string
}

export interface TeamResponse {
  data: TeamJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface TeamJsonResponse extends Omit<Selectable<TeamRead>, 'password'> {
  [key: string]: any
}

export type NewTeam = Insertable<TeamWrite>
export type TeamUpdate = Updateable<TeamWrite>

export interface TeamModelType {
  // Properties
  readonly id: number
  get name(): string
  set name(value: string)
  get companyName(): string
  set companyName(value: string)
  get email(): string
  set email(value: string)
  get billingEmail(): string
  set billingEmail(value: string)
  get status(): string
  set status(value: string)
  get description(): string
  set description(value: string)
  get path(): string
  set path(value: string)
  get isPersonal(): boolean
  set isPersonal(value: boolean)
  get personal_access_token(): PersonalAccessTokenModelType[] | []

  teamUsers: () => Promise<UserType[]>
  get created_at(): string | undefined
  get updated_at(): string | undefined
  set updated_at(value: string)

  // Static methods
  with: (relations: string[]) => TeamModelType
  select: (params: (keyof TeamJsonResponse)[] | RawBuilder<string> | string) => TeamModelType
  find: (id: number) => Promise<TeamModelType | undefined>
  first: () => Promise<TeamModelType | undefined>
  last: () => Promise<TeamModelType | undefined>
  firstOrFail: () => Promise<TeamModelType | undefined>
  all: () => Promise<TeamModelType[]>
  findOrFail: (id: number) => Promise<TeamModelType | undefined>
  findMany: (ids: number[]) => Promise<TeamModelType[]>
  latest: (column?: keyof TeamsTable) => Promise<TeamModelType | undefined>
  oldest: (column?: keyof TeamsTable) => Promise<TeamModelType | undefined>
  skip: (count: number) => TeamModelType
  take: (count: number) => TeamModelType
  where: <V = string>(column: keyof TeamsTable, ...args: [V] | [Operator, V]) => TeamModelType
  orWhere: (...conditions: [string, any][]) => TeamModelType
  whereNotIn: <V = number>(column: keyof TeamsTable, values: V[]) => TeamModelType
  whereBetween: <V = number>(column: keyof TeamsTable, range: [V, V]) => TeamModelType
  whereRef: (column: keyof TeamsTable, ...args: string[]) => TeamModelType
  when: (condition: boolean, callback: (query: TeamModelType) => TeamModelType) => TeamModelType
  whereNull: (column: keyof TeamsTable) => TeamModelType
  whereNotNull: (column: keyof TeamsTable) => TeamModelType
  whereLike: (column: keyof TeamsTable, value: string) => TeamModelType
  orderBy: (column: keyof TeamsTable, order: 'asc' | 'desc') => TeamModelType
  orderByAsc: (column: keyof TeamsTable) => TeamModelType
  orderByDesc: (column: keyof TeamsTable) => TeamModelType
  groupBy: (column: keyof TeamsTable) => TeamModelType
  having: <V = string>(column: keyof TeamsTable, operator: Operator, value: V) => TeamModelType
  inRandomOrder: () => TeamModelType
  whereColumn: (first: keyof TeamsTable, operator: Operator, second: keyof TeamsTable) => TeamModelType
  max: (field: keyof TeamsTable) => Promise<number>
  min: (field: keyof TeamsTable) => Promise<number>
  avg: (field: keyof TeamsTable) => Promise<number>
  sum: (field: keyof TeamsTable) => Promise<number>
  count: () => Promise<number>
  get: () => Promise<TeamModelType[]>
  pluck: <K extends keyof TeamModelType>(field: K) => Promise<TeamModelType[K][]>
  chunk: (size: number, callback: (models: TeamModelType[]) => Promise<void>) => Promise<void>
  paginate: (options?: { limit?: number, offset?: number, page?: number }) => Promise<{
    data: TeamModelType[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }>
  create: (newTeam: NewTeam) => Promise<TeamModelType>
  firstOrCreate: (search: Partial<TeamsTable>, values?: NewTeam) => Promise<TeamModelType>
  updateOrCreate: (search: Partial<TeamsTable>, values?: NewTeam) => Promise<TeamModelType>
  createMany: (newTeam: NewTeam[]) => Promise<void>
  forceCreate: (newTeam: NewTeam) => Promise<TeamModelType>
  remove: (id: number) => Promise<any>
  whereIn: <V = number>(column: keyof TeamsTable, values: V[]) => TeamModelType
  distinct: (column: keyof TeamJsonResponse) => TeamModelType
  join: (table: string, firstCol: string, secondCol: string) => TeamModelType

  // Instance methods
  createInstance: (data: TeamJsonResponse) => TeamModelType
  update: (newTeam: TeamUpdate) => Promise<TeamModelType | undefined>
  forceUpdate: (newTeam: TeamUpdate) => Promise<TeamModelType | undefined>
  save: () => Promise<TeamModelType>
  delete: () => Promise<number>
  toSearchableObject: () => Partial<TeamJsonResponse>
  toJSON: () => TeamJsonResponse
  parseResult: (model: TeamModelType) => TeamModelType

  teamUsers: () => Promise<UserType[]>
}
