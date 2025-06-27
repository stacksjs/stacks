import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'

export interface LoyaltyRewardsTable {
  id: Generated<number>
  name: string
  description?: string
  points_required: number
  reward_type: string
  discount_percentage?: number
  free_product_id?: string
  is_active?: boolean
  expiry_days?: number
  image_url?: string
  product_id?: number
  uuid?: string
  created_at?: string
  updated_at?: string
}

export type LoyaltyRewardRead = LoyaltyRewardsTable

export type LoyaltyRewardWrite = Omit<LoyaltyRewardsTable, 'created_at'> & {
  created_at?: string
}

export interface LoyaltyRewardResponse {
  data: LoyaltyRewardJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface LoyaltyRewardJsonResponse extends Omit<Selectable<LoyaltyRewardRead>, 'password'> {
  [key: string]: any
}

export type NewLoyaltyReward = Insertable<LoyaltyRewardWrite>
export type LoyaltyRewardUpdate = Updateable<LoyaltyRewardWrite>

export interface LoyaltyRewardModelType {
  // Properties
  readonly id: number
  get name(): string
  set name(value: string)
  get description(): string | undefined
  set description(value: string)
  get pointsRequired(): number
  set pointsRequired(value: number)
  get rewardType(): string
  set rewardType(value: string)
  get discountPercentage(): number | undefined
  set discountPercentage(value: number)
  get freeProductId(): string | undefined
  set freeProductId(value: string)
  get isActive(): boolean | undefined
  set isActive(value: boolean)
  get expiryDays(): number | undefined
  set expiryDays(value: number)
  get imageUrl(): string | undefined
  set imageUrl(value: string)

  productBelong: () => Promise<ProductType>
  get uuid(): string | undefined
  set uuid(value: string)

  get created_at(): string | undefined
  get updated_at(): string | undefined
  set updated_at(value: string)

  // Static methods
  with: (relations: string[]) => LoyaltyRewardModelType
  select: (params: (keyof LoyaltyRewardJsonResponse)[] | RawBuilder<string> | string) => LoyaltyRewardModelType
  find: (id: number) => Promise<LoyaltyRewardModelType | undefined>
  first: () => Promise<LoyaltyRewardModelType | undefined>
  last: () => Promise<LoyaltyRewardModelType | undefined>
  firstOrFail: () => Promise<LoyaltyRewardModelType | undefined>
  all: () => Promise<LoyaltyRewardModelType[]>
  findOrFail: (id: number) => Promise<LoyaltyRewardModelType | undefined>
  findMany: (ids: number[]) => Promise<LoyaltyRewardModelType[]>
  latest: (column?: keyof LoyaltyRewardsTable) => Promise<LoyaltyRewardModelType | undefined>
  oldest: (column?: keyof LoyaltyRewardsTable) => Promise<LoyaltyRewardModelType | undefined>
  skip: (count: number) => LoyaltyRewardModelType
  take: (count: number) => LoyaltyRewardModelType
  where: <V = string>(column: keyof LoyaltyRewardsTable, ...args: [V] | [Operator, V]) => LoyaltyRewardModelType
  orWhere: (...conditions: [string, any][]) => LoyaltyRewardModelType
  whereNotIn: <V = number>(column: keyof LoyaltyRewardsTable, values: V[]) => LoyaltyRewardModelType
  whereBetween: <V = number>(column: keyof LoyaltyRewardsTable, range: [V, V]) => LoyaltyRewardModelType
  whereRef: (column: keyof LoyaltyRewardsTable, ...args: string[]) => LoyaltyRewardModelType
  when: (condition: boolean, callback: (query: LoyaltyRewardModelType) => LoyaltyRewardModelType) => LoyaltyRewardModelType
  whereNull: (column: keyof LoyaltyRewardsTable) => LoyaltyRewardModelType
  whereNotNull: (column: keyof LoyaltyRewardsTable) => LoyaltyRewardModelType
  whereLike: (column: keyof LoyaltyRewardsTable, value: string) => LoyaltyRewardModelType
  orderBy: (column: keyof LoyaltyRewardsTable, order: 'asc' | 'desc') => LoyaltyRewardModelType
  orderByAsc: (column: keyof LoyaltyRewardsTable) => LoyaltyRewardModelType
  orderByDesc: (column: keyof LoyaltyRewardsTable) => LoyaltyRewardModelType
  groupBy: (column: keyof LoyaltyRewardsTable) => LoyaltyRewardModelType
  having: <V = string>(column: keyof LoyaltyRewardsTable, operator: Operator, value: V) => LoyaltyRewardModelType
  inRandomOrder: () => LoyaltyRewardModelType
  whereColumn: (first: keyof LoyaltyRewardsTable, operator: Operator, second: keyof LoyaltyRewardsTable) => LoyaltyRewardModelType
  max: (field: keyof LoyaltyRewardsTable) => Promise<number>
  min: (field: keyof LoyaltyRewardsTable) => Promise<number>
  avg: (field: keyof LoyaltyRewardsTable) => Promise<number>
  sum: (field: keyof LoyaltyRewardsTable) => Promise<number>
  count: () => Promise<number>
  get: () => Promise<LoyaltyRewardModelType[]>
  pluck: <K extends keyof LoyaltyRewardModelType>(field: K) => Promise<LoyaltyRewardModelType[K][]>
  chunk: (size: number, callback: (models: LoyaltyRewardModelType[]) => Promise<void>) => Promise<void>
  paginate: (options?: { limit?: number, offset?: number, page?: number }) => Promise<{
    data: LoyaltyRewardModelType[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }>
  create: (newLoyaltyReward: NewLoyaltyReward) => Promise<LoyaltyRewardModelType>
  firstOrCreate: (search: Partial<LoyaltyRewardsTable>, values?: NewLoyaltyReward) => Promise<LoyaltyRewardModelType>
  updateOrCreate: (search: Partial<LoyaltyRewardsTable>, values?: NewLoyaltyReward) => Promise<LoyaltyRewardModelType>
  createMany: (newLoyaltyReward: NewLoyaltyReward[]) => Promise<void>
  forceCreate: (newLoyaltyReward: NewLoyaltyReward) => Promise<LoyaltyRewardModelType>
  remove: (id: number) => Promise<any>
  whereIn: <V = number>(column: keyof LoyaltyRewardsTable, values: V[]) => LoyaltyRewardModelType
  distinct: (column: keyof LoyaltyRewardJsonResponse) => LoyaltyRewardModelType
  join: (table: string, firstCol: string, secondCol: string) => LoyaltyRewardModelType

  // Instance methods
  createInstance: (data: LoyaltyRewardJsonResponse) => LoyaltyRewardModelType
  update: (newLoyaltyReward: LoyaltyRewardUpdate) => Promise<LoyaltyRewardModelType | undefined>
  forceUpdate: (newLoyaltyReward: LoyaltyRewardUpdate) => Promise<LoyaltyRewardModelType | undefined>
  save: () => Promise<LoyaltyRewardModelType>
  delete: () => Promise<number>
  toSearchableObject: () => Partial<LoyaltyRewardJsonResponse>
  toJSON: () => LoyaltyRewardJsonResponse
  parseResult: (model: LoyaltyRewardModelType) => LoyaltyRewardModelType

  productBelong: () => Promise<ProductType>
}
