import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'

export interface LoyaltyPointsTable {
  id: Generated<number>
  wallet_id: string
  points: number
  source?: string
  source_reference_id?: string
  description?: string
  expiry_date?: Date | string
  is_used?: boolean
  uuid?: string
  created_at?: string
  updated_at?: string
}

export type LoyaltyPointRead = LoyaltyPointsTable

export type LoyaltyPointWrite = Omit<LoyaltyPointsTable, 'created_at'> & {
  created_at?: string
}

export interface LoyaltyPointResponse {
  data: LoyaltyPointJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface LoyaltyPointJsonResponse extends Omit<Selectable<LoyaltyPointRead>, 'password'> {
  [key: string]: any
}

export type NewLoyaltyPoint = Insertable<LoyaltyPointWrite>
export type LoyaltyPointUpdate = Updateable<LoyaltyPointWrite>

export interface LoyaltyPointModelType {
  // Properties
  readonly id: number
  get walletId(): string
  set walletId(value: string)
  get points(): number
  set points(value: number)
  get source(): string | undefined
  set source(value: string)
  get sourceReferenceId(): string | undefined
  set sourceReferenceId(value: string)
  get description(): string | undefined
  set description(value: string)
  get expiryDate(): Date | string | undefined
  set expiryDate(value: Date | string)
  get isUsed(): boolean | undefined
  set isUsed(value: boolean)

  get uuid(): string | undefined
  set uuid(value: string)

  get created_at(): string | undefined
  get updated_at(): string | undefined
  set updated_at(value: string)

  // Static methods
  with: (relations: string[]) => LoyaltyPointModelType
  select: (params: (keyof LoyaltyPointJsonResponse)[] | RawBuilder<string> | string) => LoyaltyPointModelType
  find: (id: number) => Promise<LoyaltyPointModelType | undefined>
  first: () => Promise<LoyaltyPointModelType | undefined>
  last: () => Promise<LoyaltyPointModelType | undefined>
  firstOrFail: () => Promise<LoyaltyPointModelType | undefined>
  all: () => Promise<LoyaltyPointModelType[]>
  findOrFail: (id: number) => Promise<LoyaltyPointModelType | undefined>
  findMany: (ids: number[]) => Promise<LoyaltyPointModelType[]>
  latest: (column?: keyof LoyaltyPointsTable) => Promise<LoyaltyPointModelType | undefined>
  oldest: (column?: keyof LoyaltyPointsTable) => Promise<LoyaltyPointModelType | undefined>
  skip: (count: number) => LoyaltyPointModelType
  take: (count: number) => LoyaltyPointModelType
  where: <V = string>(column: keyof LoyaltyPointsTable, ...args: [V] | [Operator, V]) => LoyaltyPointModelType
  orWhere: (...conditions: [string, any][]) => LoyaltyPointModelType
  whereNotIn: <V = number>(column: keyof LoyaltyPointsTable, values: V[]) => LoyaltyPointModelType
  whereBetween: <V = number>(column: keyof LoyaltyPointsTable, range: [V, V]) => LoyaltyPointModelType
  whereRef: (column: keyof LoyaltyPointsTable, ...args: string[]) => LoyaltyPointModelType
  when: (condition: boolean, callback: (query: LoyaltyPointModelType) => LoyaltyPointModelType) => LoyaltyPointModelType
  whereNull: (column: keyof LoyaltyPointsTable) => LoyaltyPointModelType
  whereNotNull: (column: keyof LoyaltyPointsTable) => LoyaltyPointModelType
  whereLike: (column: keyof LoyaltyPointsTable, value: string) => LoyaltyPointModelType
  orderBy: (column: keyof LoyaltyPointsTable, order: 'asc' | 'desc') => LoyaltyPointModelType
  orderByAsc: (column: keyof LoyaltyPointsTable) => LoyaltyPointModelType
  orderByDesc: (column: keyof LoyaltyPointsTable) => LoyaltyPointModelType
  groupBy: (column: keyof LoyaltyPointsTable) => LoyaltyPointModelType
  having: <V = string>(column: keyof LoyaltyPointsTable, operator: Operator, value: V) => LoyaltyPointModelType
  inRandomOrder: () => LoyaltyPointModelType
  whereColumn: (first: keyof LoyaltyPointsTable, operator: Operator, second: keyof LoyaltyPointsTable) => LoyaltyPointModelType
  max: (field: keyof LoyaltyPointsTable) => Promise<number>
  min: (field: keyof LoyaltyPointsTable) => Promise<number>
  avg: (field: keyof LoyaltyPointsTable) => Promise<number>
  sum: (field: keyof LoyaltyPointsTable) => Promise<number>
  count: () => Promise<number>
  get: () => Promise<LoyaltyPointModelType[]>
  pluck: <K extends keyof LoyaltyPointModelType>(field: K) => Promise<LoyaltyPointModelType[K][]>
  chunk: (size: number, callback: (models: LoyaltyPointModelType[]) => Promise<void>) => Promise<void>
  paginate: (options?: { limit?: number, offset?: number, page?: number }) => Promise<{
    data: LoyaltyPointModelType[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }>
  create: (newLoyaltyPoint: NewLoyaltyPoint) => Promise<LoyaltyPointModelType>
  firstOrCreate: (search: Partial<LoyaltyPointsTable>, values?: NewLoyaltyPoint) => Promise<LoyaltyPointModelType>
  updateOrCreate: (search: Partial<LoyaltyPointsTable>, values?: NewLoyaltyPoint) => Promise<LoyaltyPointModelType>
  createMany: (newLoyaltyPoint: NewLoyaltyPoint[]) => Promise<void>
  forceCreate: (newLoyaltyPoint: NewLoyaltyPoint) => Promise<LoyaltyPointModelType>
  remove: (id: number) => Promise<any>
  whereIn: <V = number>(column: keyof LoyaltyPointsTable, values: V[]) => LoyaltyPointModelType
  distinct: (column: keyof LoyaltyPointJsonResponse) => LoyaltyPointModelType
  join: (table: string, firstCol: string, secondCol: string) => LoyaltyPointModelType

  // Instance methods
  createInstance: (data: LoyaltyPointJsonResponse) => LoyaltyPointModelType
  update: (newLoyaltyPoint: LoyaltyPointUpdate) => Promise<LoyaltyPointModelType | undefined>
  forceUpdate: (newLoyaltyPoint: LoyaltyPointUpdate) => Promise<LoyaltyPointModelType | undefined>
  save: () => Promise<LoyaltyPointModelType>
  delete: () => Promise<number>
  toSearchableObject: () => Partial<LoyaltyPointJsonResponse>
  toJSON: () => LoyaltyPointJsonResponse
  parseResult: (model: LoyaltyPointModelType) => LoyaltyPointModelType

}
