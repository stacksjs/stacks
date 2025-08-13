import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import type { UserModelType } from './UserType'

export interface SubscriptionsTable {
  id: Generated<number>
  type: string
  plan?: string
  provider_id: string
  provider_status: string
  unit_price: number
  provider_type: string
  provider_price_id?: string
  quantity?: number
  trial_ends_at?: Date | string
  ends_at?: Date | string
  last_used_at?: Date | string
  uuid?: string
}

export type SubscriptionRead = SubscriptionsTable

export type SubscriptionWrite = Omit<SubscriptionsTable, 'created_at'> & {
  created_at?: string
}

export interface SubscriptionResponse {
  data: SubscriptionJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface SubscriptionJsonResponse extends Omit<Selectable<SubscriptionRead>, 'password'> {
  [key: string]: any
}

export type NewSubscription = Insertable<SubscriptionWrite>
export type SubscriptionUpdate = Updateable<SubscriptionWrite>

export interface SubscriptionModelType {
  // Properties
  readonly id: number
  get type(): string
  set type(value: string)
  get plan(): string | undefined
  set plan(value: string)
  get providerId(): string
  set providerId(value: string)
  get providerStatus(): string
  set providerStatus(value: string)
  get unitPrice(): number
  set unitPrice(value: number)
  get providerType(): string
  set providerType(value: string)
  get providerPriceId(): string | undefined
  set providerPriceId(value: string)
  get quantity(): number | undefined
  set quantity(value: number)
  get trialEndsAt(): Date | string | undefined
  set trialEndsAt(value: Date | string)
  get endsAt(): Date | string | undefined
  set endsAt(value: Date | string)
  get lastUsedAt(): Date | string | undefined
  set lastUsedAt(value: Date | string)
  get user(): UserModelType | undefined

  get uuid(): string | undefined
  set uuid(value: string)

  // Static methods
  with: (relations: string[]) => SubscriptionModelType
  select: (params: (keyof SubscriptionJsonResponse)[] | RawBuilder<string> | string) => SubscriptionModelType
  find: (id: number) => Promise<SubscriptionModelType | undefined>
  first: () => Promise<SubscriptionModelType | undefined>
  last: () => Promise<SubscriptionModelType | undefined>
  firstOrFail: () => Promise<SubscriptionModelType | undefined>
  all: () => Promise<SubscriptionModelType[]>
  findOrFail: (id: number) => Promise<SubscriptionModelType | undefined>
  findMany: (ids: number[]) => Promise<SubscriptionModelType[]>
  latest: (column?: keyof SubscriptionsTable) => Promise<SubscriptionModelType | undefined>
  oldest: (column?: keyof SubscriptionsTable) => Promise<SubscriptionModelType | undefined>
  skip: (count: number) => SubscriptionModelType
  take: (count: number) => SubscriptionModelType
  where: <V = string>(column: keyof SubscriptionsTable, ...args: [V] | [Operator, V]) => SubscriptionModelType
  orWhere: (...conditions: [string, any][]) => SubscriptionModelType
  whereNotIn: <V = number>(column: keyof SubscriptionsTable, values: V[]) => SubscriptionModelType
  whereBetween: <V = number>(column: keyof SubscriptionsTable, range: [V, V]) => SubscriptionModelType
  whereRef: (column: keyof SubscriptionsTable, ...args: string[]) => SubscriptionModelType
  when: (condition: boolean, callback: (query: SubscriptionModelType) => SubscriptionModelType) => SubscriptionModelType
  whereNull: (column: keyof SubscriptionsTable) => SubscriptionModelType
  whereNotNull: (column: keyof SubscriptionsTable) => SubscriptionModelType
  whereLike: (column: keyof SubscriptionsTable, value: string) => SubscriptionModelType
  orderBy: (column: keyof SubscriptionsTable, order: 'asc' | 'desc') => SubscriptionModelType
  orderByAsc: (column: keyof SubscriptionsTable) => SubscriptionModelType
  orderByDesc: (column: keyof SubscriptionsTable) => SubscriptionModelType
  groupBy: (column: keyof SubscriptionsTable) => SubscriptionModelType
  having: <V = string>(column: keyof SubscriptionsTable, operator: Operator, value: V) => SubscriptionModelType
  inRandomOrder: () => SubscriptionModelType
  whereColumn: (first: keyof SubscriptionsTable, operator: Operator, second: keyof SubscriptionsTable) => SubscriptionModelType
  max: (field: keyof SubscriptionsTable) => Promise<number>
  min: (field: keyof SubscriptionsTable) => Promise<number>
  avg: (field: keyof SubscriptionsTable) => Promise<number>
  sum: (field: keyof SubscriptionsTable) => Promise<number>
  count: () => Promise<number>
  get: () => Promise<SubscriptionModelType[]>
  pluck: <K extends keyof SubscriptionModelType>(field: K) => Promise<SubscriptionModelType[K][]>
  chunk: (size: number, callback: (models: SubscriptionModelType[]) => Promise<void>) => Promise<void>
  paginate: (options?: { limit?: number, offset?: number, page?: number }) => Promise<{
    data: SubscriptionModelType[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }>
  create: (newSubscription: NewSubscription) => Promise<SubscriptionModelType>
  firstOrCreate: (search: Partial<SubscriptionsTable>, values?: NewSubscription) => Promise<SubscriptionModelType>
  updateOrCreate: (search: Partial<SubscriptionsTable>, values?: NewSubscription) => Promise<SubscriptionModelType>
  createMany: (newSubscription: NewSubscription[]) => Promise<void>
  forceCreate: (newSubscription: NewSubscription) => Promise<SubscriptionModelType>
  remove: (id: number) => Promise<any>
  whereIn: <V = number>(column: keyof SubscriptionsTable, values: V[]) => SubscriptionModelType
  distinct: (column: keyof SubscriptionJsonResponse) => SubscriptionModelType
  join: (table: string, firstCol: string, secondCol: string) => SubscriptionModelType

  // Instance methods
  createInstance: (data: SubscriptionJsonResponse) => SubscriptionModelType
  update: (newSubscription: SubscriptionUpdate) => Promise<SubscriptionModelType | undefined>
  forceUpdate: (newSubscription: SubscriptionUpdate) => Promise<SubscriptionModelType | undefined>
  save: () => Promise<SubscriptionModelType>
  delete: () => Promise<number>
  toSearchableObject: () => Partial<SubscriptionJsonResponse>
  toJSON: () => SubscriptionJsonResponse
  parseResult: (model: SubscriptionModelType) => SubscriptionModelType

  userBelong: () => Promise<UserModelType>
}
