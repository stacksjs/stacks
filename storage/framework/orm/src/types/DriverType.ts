import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import type { DeliveryRouteModelType } from './DeliveryRouteType'
import type { UserModelType } from './UserType'

export interface DriversTable {
  id: Generated<number>
  name: string
  phone: string
  vehicle_number: string
  license: string
  status?: string | string[]
  uuid?: string
  created_at?: string
  updated_at?: string
}

export type DriverRead = DriversTable

export type DriverWrite = Omit<DriversTable, 'created_at'> & {
  created_at?: string
}

export interface DriverResponse {
  data: DriverJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface DriverJsonResponse extends Omit<Selectable<DriverRead>, 'password'> {
  [key: string]: any
}

export type NewDriver = Insertable<DriverWrite>
export type DriverUpdate = Updateable<DriverWrite>

export interface DriverModelType {
  // Properties
  readonly id: number
  get name(): string
  set name(value: string)
  get phone(): string
  set phone(value: string)
  get vehicleNumber(): string
  set vehicleNumber(value: string)
  get license(): string
  set license(value: string)
  get status(): string | string[] | undefined
  set status(value: string | string[])
  get delivery_route(): DeliveryRouteModelType[] | []
  get user(): UserModelType | undefined

  get uuid(): string | undefined
  set uuid(value: string)

  get created_at(): string | undefined
  get updated_at(): string | undefined
  set updated_at(value: string)

  // Static methods
  with: (relations: string[]) => DriverModelType
  select: (params: (keyof DriverJsonResponse)[] | RawBuilder<string> | string) => DriverModelType
  find: (id: number) => Promise<DriverModelType | undefined>
  first: () => Promise<DriverModelType | undefined>
  last: () => Promise<DriverModelType | undefined>
  firstOrFail: () => Promise<DriverModelType | undefined>
  all: () => Promise<DriverModelType[]>
  findOrFail: (id: number) => Promise<DriverModelType | undefined>
  findMany: (ids: number[]) => Promise<DriverModelType[]>
  latest: (column?: keyof DriversTable) => Promise<DriverModelType | undefined>
  oldest: (column?: keyof DriversTable) => Promise<DriverModelType | undefined>
  skip: (count: number) => DriverModelType
  take: (count: number) => DriverModelType
  where: <V = string>(column: keyof DriversTable, ...args: [V] | [Operator, V]) => DriverModelType
  orWhere: (...conditions: [string, any][]) => DriverModelType
  whereNotIn: <V = number>(column: keyof DriversTable, values: V[]) => DriverModelType
  whereBetween: <V = number>(column: keyof DriversTable, range: [V, V]) => DriverModelType
  whereRef: (column: keyof DriversTable, ...args: string[]) => DriverModelType
  when: (condition: boolean, callback: (query: DriverModelType) => DriverModelType) => DriverModelType
  whereNull: (column: keyof DriversTable) => DriverModelType
  whereNotNull: (column: keyof DriversTable) => DriverModelType
  whereLike: (column: keyof DriversTable, value: string) => DriverModelType
  orderBy: (column: keyof DriversTable, order: 'asc' | 'desc') => DriverModelType
  orderByAsc: (column: keyof DriversTable) => DriverModelType
  orderByDesc: (column: keyof DriversTable) => DriverModelType
  groupBy: (column: keyof DriversTable) => DriverModelType
  having: <V = string>(column: keyof DriversTable, operator: Operator, value: V) => DriverModelType
  inRandomOrder: () => DriverModelType
  whereColumn: (first: keyof DriversTable, operator: Operator, second: keyof DriversTable) => DriverModelType
  max: (field: keyof DriversTable) => Promise<number>
  min: (field: keyof DriversTable) => Promise<number>
  avg: (field: keyof DriversTable) => Promise<number>
  sum: (field: keyof DriversTable) => Promise<number>
  count: () => Promise<number>
  get: () => Promise<DriverModelType[]>
  pluck: <K extends keyof DriverModelType>(field: K) => Promise<DriverModelType[K][]>
  chunk: (size: number, callback: (models: DriverModelType[]) => Promise<void>) => Promise<void>
  paginate: (options?: { limit?: number, offset?: number, page?: number }) => Promise<{
    data: DriverModelType[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }>
  create: (newDriver: NewDriver) => Promise<DriverModelType>
  firstOrCreate: (search: Partial<DriversTable>, values?: NewDriver) => Promise<DriverModelType>
  updateOrCreate: (search: Partial<DriversTable>, values?: NewDriver) => Promise<DriverModelType>
  createMany: (newDriver: NewDriver[]) => Promise<void>
  forceCreate: (newDriver: NewDriver) => Promise<DriverModelType>
  remove: (id: number) => Promise<any>
  whereIn: <V = number>(column: keyof DriversTable, values: V[]) => DriverModelType
  distinct: (column: keyof DriverJsonResponse) => DriverModelType
  join: (table: string, firstCol: string, secondCol: string) => DriverModelType

  // Instance methods
  createInstance: (data: DriverJsonResponse) => DriverModelType
  update: (newDriver: DriverUpdate) => Promise<DriverModelType | undefined>
  forceUpdate: (newDriver: DriverUpdate) => Promise<DriverModelType | undefined>
  save: () => Promise<DriverModelType>
  delete: () => Promise<number>
  toSearchableObject: () => Partial<DriverJsonResponse>
  toJSON: () => DriverJsonResponse
  parseResult: (model: DriverModelType) => DriverModelType

  userBelong: () => Promise<UserModelType>
}
