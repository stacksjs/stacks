import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'

export interface DeliveryRoutesTable {
  id: Generated<number>
  driver: string
  vehicle: string
  stops: number
  delivery_time: number
  total_distance: number
  last_active: Date | string
  uuid?: string
  created_at?: string
  updated_at?: string
}

export type DeliveryRouteRead = DeliveryRoutesTable

export type DeliveryRouteWrite = Omit<DeliveryRoutesTable, 'created_at'> & {
  created_at?: string
}

export interface DeliveryRouteResponse {
  data: DeliveryRouteJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface DeliveryRouteJsonResponse extends Omit<Selectable<DeliveryRouteRead>, 'password'> {
  [key: string]: any
}

export type NewDeliveryRoute = Insertable<DeliveryRouteWrite>
export type DeliveryRouteUpdate = Updateable<DeliveryRouteWrite>

export interface DeliveryRouteModelType {
  // Properties
  readonly id: number
  get driver(): string
  set driver(value: string)
  get vehicle(): string
  set vehicle(value: string)
  get stops(): number
  set stops(value: number)
  get deliveryTime(): number
  set deliveryTime(value: number)
  get totalDistance(): number
  set totalDistance(value: number)
  get lastActive(): Date | string
  set lastActive(value: Date | string)

  get uuid(): string | undefined
  set uuid(value: string)

  get created_at(): string | undefined
  get updated_at(): string | undefined
  set updated_at(value: string)

  // Static methods
  with: (relations: string[]) => DeliveryRouteModelType
  select: (params: (keyof DeliveryRouteJsonResponse)[] | RawBuilder<string> | string) => DeliveryRouteModelType
  find: (id: number) => Promise<DeliveryRouteModelType | undefined>
  first: () => Promise<DeliveryRouteModelType | undefined>
  last: () => Promise<DeliveryRouteModelType | undefined>
  firstOrFail: () => Promise<DeliveryRouteModelType | undefined>
  all: () => Promise<DeliveryRouteModelType[]>
  findOrFail: (id: number) => Promise<DeliveryRouteModelType | undefined>
  findMany: (ids: number[]) => Promise<DeliveryRouteModelType[]>
  latest: (column?: keyof DeliveryRoutesTable) => Promise<DeliveryRouteModelType | undefined>
  oldest: (column?: keyof DeliveryRoutesTable) => Promise<DeliveryRouteModelType | undefined>
  skip: (count: number) => DeliveryRouteModelType
  take: (count: number) => DeliveryRouteModelType
  where: <V = string>(column: keyof DeliveryRoutesTable, ...args: [V] | [Operator, V]) => DeliveryRouteModelType
  orWhere: (...conditions: [string, any][]) => DeliveryRouteModelType
  whereNotIn: <V = number>(column: keyof DeliveryRoutesTable, values: V[]) => DeliveryRouteModelType
  whereBetween: <V = number>(column: keyof DeliveryRoutesTable, range: [V, V]) => DeliveryRouteModelType
  whereRef: (column: keyof DeliveryRoutesTable, ...args: string[]) => DeliveryRouteModelType
  when: (condition: boolean, callback: (query: DeliveryRouteModelType) => DeliveryRouteModelType) => DeliveryRouteModelType
  whereNull: (column: keyof DeliveryRoutesTable) => DeliveryRouteModelType
  whereNotNull: (column: keyof DeliveryRoutesTable) => DeliveryRouteModelType
  whereLike: (column: keyof DeliveryRoutesTable, value: string) => DeliveryRouteModelType
  orderBy: (column: keyof DeliveryRoutesTable, order: 'asc' | 'desc') => DeliveryRouteModelType
  orderByAsc: (column: keyof DeliveryRoutesTable) => DeliveryRouteModelType
  orderByDesc: (column: keyof DeliveryRoutesTable) => DeliveryRouteModelType
  groupBy: (column: keyof DeliveryRoutesTable) => DeliveryRouteModelType
  having: <V = string>(column: keyof DeliveryRoutesTable, operator: Operator, value: V) => DeliveryRouteModelType
  inRandomOrder: () => DeliveryRouteModelType
  whereColumn: (first: keyof DeliveryRoutesTable, operator: Operator, second: keyof DeliveryRoutesTable) => DeliveryRouteModelType
  max: (field: keyof DeliveryRoutesTable) => Promise<number>
  min: (field: keyof DeliveryRoutesTable) => Promise<number>
  avg: (field: keyof DeliveryRoutesTable) => Promise<number>
  sum: (field: keyof DeliveryRoutesTable) => Promise<number>
  count: () => Promise<number>
  get: () => Promise<DeliveryRouteModelType[]>
  pluck: <K extends keyof DeliveryRouteModelType>(field: K) => Promise<DeliveryRouteModelType[K][]>
  chunk: (size: number, callback: (models: DeliveryRouteModelType[]) => Promise<void>) => Promise<void>
  paginate: (options?: { limit?: number, offset?: number, page?: number }) => Promise<{
    data: DeliveryRouteModelType[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }>
  create: (newDeliveryRoute: NewDeliveryRoute) => Promise<DeliveryRouteModelType>
  firstOrCreate: (search: Partial<DeliveryRoutesTable>, values?: NewDeliveryRoute) => Promise<DeliveryRouteModelType>
  updateOrCreate: (search: Partial<DeliveryRoutesTable>, values?: NewDeliveryRoute) => Promise<DeliveryRouteModelType>
  createMany: (newDeliveryRoute: NewDeliveryRoute[]) => Promise<void>
  forceCreate: (newDeliveryRoute: NewDeliveryRoute) => Promise<DeliveryRouteModelType>
  remove: (id: number) => Promise<any>
  whereIn: <V = number>(column: keyof DeliveryRoutesTable, values: V[]) => DeliveryRouteModelType
  distinct: (column: keyof DeliveryRouteJsonResponse) => DeliveryRouteModelType
  join: (table: string, firstCol: string, secondCol: string) => DeliveryRouteModelType

  // Instance methods
  createInstance: (data: DeliveryRouteJsonResponse) => DeliveryRouteModelType
  update: (newDeliveryRoute: DeliveryRouteUpdate) => Promise<DeliveryRouteModelType | undefined>
  forceUpdate: (newDeliveryRoute: DeliveryRouteUpdate) => Promise<DeliveryRouteModelType | undefined>
  save: () => Promise<DeliveryRouteModelType>
  delete: () => Promise<number>
  toSearchableObject: () => Partial<DeliveryRouteJsonResponse>
  toJSON: () => DeliveryRouteJsonResponse
  parseResult: (model: DeliveryRouteModelType) => DeliveryRouteModelType

}
