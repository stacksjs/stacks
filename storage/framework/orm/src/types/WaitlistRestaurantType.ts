import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import type { CustomerModelType } from './CustomerType'

export interface WaitlistRestaurantsTable {
  id: Generated<number>
  name: string
  email: string
  phone?: string
  party_size: number
  check_in_time: Date | string
  table_preference: string | string[]
  status: string | string[]
  quoted_wait_time: number
  actual_wait_time?: number
  queue_position?: number
  seated_at?: Date | string
  no_show_at?: Date | string
  cancelled_at?: Date | string
  uuid?: string
  created_at?: string
  updated_at?: string
}

export type WaitlistRestaurantRead = WaitlistRestaurantsTable

export type WaitlistRestaurantWrite = Omit<WaitlistRestaurantsTable, 'created_at'> & {
  created_at?: string
}

export interface WaitlistRestaurantResponse {
  data: WaitlistRestaurantJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface WaitlistRestaurantJsonResponse extends Omit<Selectable<WaitlistRestaurantRead>, 'password'> {
  [key: string]: any
}

export type NewWaitlistRestaurant = Insertable<WaitlistRestaurantWrite>
export type WaitlistRestaurantUpdate = Updateable<WaitlistRestaurantWrite>

export interface WaitlistRestaurantModelType {
  // Properties
  readonly id: number
  get name(): string
  set name(value: string)
  get email(): string
  set email(value: string)
  get phone(): string | undefined
  set phone(value: string)
  get partySize(): number
  set partySize(value: number)
  get checkInTime(): Date | string
  set checkInTime(value: Date | string)
  get tablePreference(): string | string[]
  set tablePreference(value: string | string[])
  get status(): string | string[]
  set status(value: string | string[])
  get quotedWaitTime(): number
  set quotedWaitTime(value: number)
  get actualWaitTime(): number | undefined
  set actualWaitTime(value: number)
  get queuePosition(): number | undefined
  set queuePosition(value: number)
  get seatedAt(): Date | string | undefined
  set seatedAt(value: Date | string)
  get noShowAt(): Date | string | undefined
  set noShowAt(value: Date | string)
  get cancelledAt(): Date | string | undefined
  set cancelledAt(value: Date | string)
  get customer(): CustomerModelType | undefined

  get uuid(): string | undefined
  set uuid(value: string)

  get created_at(): string | undefined
  get updated_at(): string | undefined
  set updated_at(value: string)

  // Static methods
  with: (relations: string[]) => WaitlistRestaurantModelType
  select: (params: (keyof WaitlistRestaurantJsonResponse)[] | RawBuilder<string> | string) => WaitlistRestaurantModelType
  find: (id: number) => Promise<WaitlistRestaurantModelType | undefined>
  first: () => Promise<WaitlistRestaurantModelType | undefined>
  last: () => Promise<WaitlistRestaurantModelType | undefined>
  firstOrFail: () => Promise<WaitlistRestaurantModelType | undefined>
  all: () => Promise<WaitlistRestaurantModelType[]>
  findOrFail: (id: number) => Promise<WaitlistRestaurantModelType | undefined>
  findMany: (ids: number[]) => Promise<WaitlistRestaurantModelType[]>
  latest: (column?: keyof WaitlistRestaurantsTable) => Promise<WaitlistRestaurantModelType | undefined>
  oldest: (column?: keyof WaitlistRestaurantsTable) => Promise<WaitlistRestaurantModelType | undefined>
  skip: (count: number) => WaitlistRestaurantModelType
  take: (count: number) => WaitlistRestaurantModelType
  where: <V = string>(column: keyof WaitlistRestaurantsTable, ...args: [V] | [Operator, V]) => WaitlistRestaurantModelType
  orWhere: (...conditions: [string, any][]) => WaitlistRestaurantModelType
  whereNotIn: <V = number>(column: keyof WaitlistRestaurantsTable, values: V[]) => WaitlistRestaurantModelType
  whereBetween: <V = number>(column: keyof WaitlistRestaurantsTable, range: [V, V]) => WaitlistRestaurantModelType
  whereRef: (column: keyof WaitlistRestaurantsTable, ...args: string[]) => WaitlistRestaurantModelType
  when: (condition: boolean, callback: (query: WaitlistRestaurantModelType) => WaitlistRestaurantModelType) => WaitlistRestaurantModelType
  whereNull: (column: keyof WaitlistRestaurantsTable) => WaitlistRestaurantModelType
  whereNotNull: (column: keyof WaitlistRestaurantsTable) => WaitlistRestaurantModelType
  whereLike: (column: keyof WaitlistRestaurantsTable, value: string) => WaitlistRestaurantModelType
  orderBy: (column: keyof WaitlistRestaurantsTable, order: 'asc' | 'desc') => WaitlistRestaurantModelType
  orderByAsc: (column: keyof WaitlistRestaurantsTable) => WaitlistRestaurantModelType
  orderByDesc: (column: keyof WaitlistRestaurantsTable) => WaitlistRestaurantModelType
  groupBy: (column: keyof WaitlistRestaurantsTable) => WaitlistRestaurantModelType
  having: <V = string>(column: keyof WaitlistRestaurantsTable, operator: Operator, value: V) => WaitlistRestaurantModelType
  inRandomOrder: () => WaitlistRestaurantModelType
  whereColumn: (first: keyof WaitlistRestaurantsTable, operator: Operator, second: keyof WaitlistRestaurantsTable) => WaitlistRestaurantModelType
  max: (field: keyof WaitlistRestaurantsTable) => Promise<number>
  min: (field: keyof WaitlistRestaurantsTable) => Promise<number>
  avg: (field: keyof WaitlistRestaurantsTable) => Promise<number>
  sum: (field: keyof WaitlistRestaurantsTable) => Promise<number>
  count: () => Promise<number>
  get: () => Promise<WaitlistRestaurantModelType[]>
  pluck: <K extends keyof WaitlistRestaurantModelType>(field: K) => Promise<WaitlistRestaurantModelType[K][]>
  chunk: (size: number, callback: (models: WaitlistRestaurantModelType[]) => Promise<void>) => Promise<void>
  paginate: (options?: { limit?: number, offset?: number, page?: number }) => Promise<{
    data: WaitlistRestaurantModelType[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }>
  create: (newWaitlistRestaurant: NewWaitlistRestaurant) => Promise<WaitlistRestaurantModelType>
  firstOrCreate: (search: Partial<WaitlistRestaurantsTable>, values?: NewWaitlistRestaurant) => Promise<WaitlistRestaurantModelType>
  updateOrCreate: (search: Partial<WaitlistRestaurantsTable>, values?: NewWaitlistRestaurant) => Promise<WaitlistRestaurantModelType>
  createMany: (newWaitlistRestaurant: NewWaitlistRestaurant[]) => Promise<void>
  forceCreate: (newWaitlistRestaurant: NewWaitlistRestaurant) => Promise<WaitlistRestaurantModelType>
  remove: (id: number) => Promise<any>
  whereIn: <V = number>(column: keyof WaitlistRestaurantsTable, values: V[]) => WaitlistRestaurantModelType
  distinct: (column: keyof WaitlistRestaurantJsonResponse) => WaitlistRestaurantModelType
  join: (table: string, firstCol: string, secondCol: string) => WaitlistRestaurantModelType

  // Instance methods
  createInstance: (data: WaitlistRestaurantJsonResponse) => WaitlistRestaurantModelType
  update: (newWaitlistRestaurant: WaitlistRestaurantUpdate) => Promise<WaitlistRestaurantModelType | undefined>
  forceUpdate: (newWaitlistRestaurant: WaitlistRestaurantUpdate) => Promise<WaitlistRestaurantModelType | undefined>
  save: () => Promise<WaitlistRestaurantModelType>
  delete: () => Promise<number>
  toSearchableObject: () => Partial<WaitlistRestaurantJsonResponse>
  toJSON: () => WaitlistRestaurantJsonResponse
  parseResult: (model: WaitlistRestaurantModelType) => WaitlistRestaurantModelType

  customerBelong: () => Promise<CustomerModelType>
}
