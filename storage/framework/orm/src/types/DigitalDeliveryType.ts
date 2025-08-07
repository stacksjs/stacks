import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'

export interface DigitalDeliveriesTable {
  id: Generated<number>
  name: string
  description: string
  download_limit?: number
  expiry_days: number
  requires_login?: boolean
  automatic_delivery?: boolean
  status?: string | string[]
  uuid?: string
  created_at?: string
  updated_at?: string
}

export type DigitalDeliveryRead = DigitalDeliveriesTable

export type DigitalDeliveryWrite = Omit<DigitalDeliveriesTable, 'created_at'> & {
  created_at?: string
}

export interface DigitalDeliveryResponse {
  data: DigitalDeliveryJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface DigitalDeliveryJsonResponse extends Omit<Selectable<DigitalDeliveryRead>, 'password'> {
  [key: string]: any
}

export type NewDigitalDelivery = Insertable<DigitalDeliveryWrite>
export type DigitalDeliveryUpdate = Updateable<DigitalDeliveryWrite>

export interface DigitalDeliveryModelType {
  // Properties
  readonly id: number
  get name(): string
  set name(value: string)
  get description(): string
  set description(value: string)
  get downloadLimit(): number | undefined
  set downloadLimit(value: number)
  get expiryDays(): number
  set expiryDays(value: number)
  get requiresLogin(): boolean | undefined
  set requiresLogin(value: boolean)
  get automaticDelivery(): boolean | undefined
  set automaticDelivery(value: boolean)
  get status(): string | string[] | undefined
  set status(value: string | string[])

  get uuid(): string | undefined
  set uuid(value: string)

  get created_at(): string | undefined
  get updated_at(): string | undefined
  set updated_at(value: string)

  // Static methods
  with: (relations: string[]) => DigitalDeliveryModelType
  select: (params: (keyof DigitalDeliveryJsonResponse)[] | RawBuilder<string> | string) => DigitalDeliveryModelType
  find: (id: number) => Promise<DigitalDeliveryModelType | undefined>
  first: () => Promise<DigitalDeliveryModelType | undefined>
  last: () => Promise<DigitalDeliveryModelType | undefined>
  firstOrFail: () => Promise<DigitalDeliveryModelType | undefined>
  all: () => Promise<DigitalDeliveryModelType[]>
  findOrFail: (id: number) => Promise<DigitalDeliveryModelType | undefined>
  findMany: (ids: number[]) => Promise<DigitalDeliveryModelType[]>
  latest: (column?: keyof DigitalDeliveriesTable) => Promise<DigitalDeliveryModelType | undefined>
  oldest: (column?: keyof DigitalDeliveriesTable) => Promise<DigitalDeliveryModelType | undefined>
  skip: (count: number) => DigitalDeliveryModelType
  take: (count: number) => DigitalDeliveryModelType
  where: <V = string>(column: keyof DigitalDeliveriesTable, ...args: [V] | [Operator, V]) => DigitalDeliveryModelType
  orWhere: (...conditions: [string, any][]) => DigitalDeliveryModelType
  whereNotIn: <V = number>(column: keyof DigitalDeliveriesTable, values: V[]) => DigitalDeliveryModelType
  whereBetween: <V = number>(column: keyof DigitalDeliveriesTable, range: [V, V]) => DigitalDeliveryModelType
  whereRef: (column: keyof DigitalDeliveriesTable, ...args: string[]) => DigitalDeliveryModelType
  when: (condition: boolean, callback: (query: DigitalDeliveryModelType) => DigitalDeliveryModelType) => DigitalDeliveryModelType
  whereNull: (column: keyof DigitalDeliveriesTable) => DigitalDeliveryModelType
  whereNotNull: (column: keyof DigitalDeliveriesTable) => DigitalDeliveryModelType
  whereLike: (column: keyof DigitalDeliveriesTable, value: string) => DigitalDeliveryModelType
  orderBy: (column: keyof DigitalDeliveriesTable, order: 'asc' | 'desc') => DigitalDeliveryModelType
  orderByAsc: (column: keyof DigitalDeliveriesTable) => DigitalDeliveryModelType
  orderByDesc: (column: keyof DigitalDeliveriesTable) => DigitalDeliveryModelType
  groupBy: (column: keyof DigitalDeliveriesTable) => DigitalDeliveryModelType
  having: <V = string>(column: keyof DigitalDeliveriesTable, operator: Operator, value: V) => DigitalDeliveryModelType
  inRandomOrder: () => DigitalDeliveryModelType
  whereColumn: (first: keyof DigitalDeliveriesTable, operator: Operator, second: keyof DigitalDeliveriesTable) => DigitalDeliveryModelType
  max: (field: keyof DigitalDeliveriesTable) => Promise<number>
  min: (field: keyof DigitalDeliveriesTable) => Promise<number>
  avg: (field: keyof DigitalDeliveriesTable) => Promise<number>
  sum: (field: keyof DigitalDeliveriesTable) => Promise<number>
  count: () => Promise<number>
  get: () => Promise<DigitalDeliveryModelType[]>
  pluck: <K extends keyof DigitalDeliveryModelType>(field: K) => Promise<DigitalDeliveryModelType[K][]>
  chunk: (size: number, callback: (models: DigitalDeliveryModelType[]) => Promise<void>) => Promise<void>
  paginate: (options?: { limit?: number, offset?: number, page?: number }) => Promise<{
    data: DigitalDeliveryModelType[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }>
  create: (newDigitalDelivery: NewDigitalDelivery) => Promise<DigitalDeliveryModelType>
  firstOrCreate: (search: Partial<DigitalDeliveriesTable>, values?: NewDigitalDelivery) => Promise<DigitalDeliveryModelType>
  updateOrCreate: (search: Partial<DigitalDeliveriesTable>, values?: NewDigitalDelivery) => Promise<DigitalDeliveryModelType>
  createMany: (newDigitalDelivery: NewDigitalDelivery[]) => Promise<void>
  forceCreate: (newDigitalDelivery: NewDigitalDelivery) => Promise<DigitalDeliveryModelType>
  remove: (id: number) => Promise<any>
  whereIn: <V = number>(column: keyof DigitalDeliveriesTable, values: V[]) => DigitalDeliveryModelType
  distinct: (column: keyof DigitalDeliveryJsonResponse) => DigitalDeliveryModelType
  join: (table: string, firstCol: string, secondCol: string) => DigitalDeliveryModelType

  // Instance methods
  createInstance: (data: DigitalDeliveryJsonResponse) => DigitalDeliveryModelType
  update: (newDigitalDelivery: DigitalDeliveryUpdate) => Promise<DigitalDeliveryModelType | undefined>
  forceUpdate: (newDigitalDelivery: DigitalDeliveryUpdate) => Promise<DigitalDeliveryModelType | undefined>
  save: () => Promise<DigitalDeliveryModelType>
  delete: () => Promise<number>
  toSearchableObject: () => Partial<DigitalDeliveryJsonResponse>
  toJSON: () => DigitalDeliveryJsonResponse
  parseResult: (model: DigitalDeliveryModelType) => DigitalDeliveryModelType

}
