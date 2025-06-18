import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import type { ReceiptModelType } from './ReceiptType'

export interface PrintDevicesTable {
  id: Generated<number>
  name: string
  mac_address: string
  location: string
  terminal: string
  status: string | string[]
  last_ping: unix
  print_count: number
  uuid?: string
  created_at?: string
  updated_at?: string
}

export type PrintDeviceRead = PrintDevicesTable

export type PrintDeviceWrite = Omit<PrintDevicesTable, 'created_at'> & {
  created_at?: string
}

export interface PrintDeviceResponse {
  data: PrintDeviceJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface PrintDeviceJsonResponse extends Omit<Selectable<PrintDeviceRead>, 'password'> {
  [key: string]: any
}

export type NewPrintDevice = Insertable<PrintDeviceWrite>
export type PrintDeviceUpdate = Updateable<PrintDeviceWrite>

export interface PrintDeviceModelType {
  // Properties
  readonly id: number
  get name(): string
  set name(value: string)
  get macAddress(): string
  set macAddress(value: string)
  get location(): string
  set location(value: string)
  get terminal(): string
  set terminal(value: string)
  get status(): string | string[]
  set status(value: string | string[])
  get lastPing(): unix
  set lastPing(value: unix)
  get printCount(): number
  set printCount(value: number)
  get receipt(): ReceiptModelType[] | []

  get uuid(): string | undefined
  set uuid(value: string)

  get created_at(): string | undefined
  get updated_at(): string | undefined
  set updated_at(value: string)

  // Static methods
  with: (relations: string[]) => PrintDeviceModelType
  select: (params: (keyof PrintDeviceJsonResponse)[] | RawBuilder<string> | string) => PrintDeviceModelType
  find: (id: number) => Promise<PrintDeviceModelType | undefined>
  first: () => Promise<PrintDeviceModelType | undefined>
  last: () => Promise<PrintDeviceModelType | undefined>
  firstOrFail: () => Promise<PrintDeviceModelType | undefined>
  all: () => Promise<PrintDeviceModelType[]>
  findOrFail: (id: number) => Promise<PrintDeviceModelType | undefined>
  findMany: (ids: number[]) => Promise<PrintDeviceModelType[]>
  latest: (column?: keyof PrintDevicesTable) => Promise<PrintDeviceModelType | undefined>
  oldest: (column?: keyof PrintDevicesTable) => Promise<PrintDeviceModelType | undefined>
  skip: (count: number) => PrintDeviceModelType
  take: (count: number) => PrintDeviceModelType
  where: <V = string>(column: keyof PrintDevicesTable, ...args: [V] | [Operator, V]) => PrintDeviceModelType
  orWhere: (...conditions: [string, any][]) => PrintDeviceModelType
  whereNotIn: <V = number>(column: keyof PrintDevicesTable, values: V[]) => PrintDeviceModelType
  whereBetween: <V = number>(column: keyof PrintDevicesTable, range: [V, V]) => PrintDeviceModelType
  whereRef: (column: keyof PrintDevicesTable, ...args: string[]) => PrintDeviceModelType
  when: (condition: boolean, callback: (query: PrintDeviceModelType) => PrintDeviceModelType) => PrintDeviceModelType
  whereNull: (column: keyof PrintDevicesTable) => PrintDeviceModelType
  whereNotNull: (column: keyof PrintDevicesTable) => PrintDeviceModelType
  whereLike: (column: keyof PrintDevicesTable, value: string) => PrintDeviceModelType
  orderBy: (column: keyof PrintDevicesTable, order: 'asc' | 'desc') => PrintDeviceModelType
  orderByAsc: (column: keyof PrintDevicesTable) => PrintDeviceModelType
  orderByDesc: (column: keyof PrintDevicesTable) => PrintDeviceModelType
  groupBy: (column: keyof PrintDevicesTable) => PrintDeviceModelType
  having: <V = string>(column: keyof PrintDevicesTable, operator: Operator, value: V) => PrintDeviceModelType
  inRandomOrder: () => PrintDeviceModelType
  whereColumn: (first: keyof PrintDevicesTable, operator: Operator, second: keyof PrintDevicesTable) => PrintDeviceModelType
  max: (field: keyof PrintDevicesTable) => Promise<number>
  min: (field: keyof PrintDevicesTable) => Promise<number>
  avg: (field: keyof PrintDevicesTable) => Promise<number>
  sum: (field: keyof PrintDevicesTable) => Promise<number>
  count: () => Promise<number>
  get: () => Promise<PrintDeviceModelType[]>
  pluck: <K extends keyof PrintDeviceModelType>(field: K) => Promise<PrintDeviceModelType[K][]>
  chunk: (size: number, callback: (models: PrintDeviceModelType[]) => Promise<void>) => Promise<void>
  paginate: (options?: { limit?: number, offset?: number, page?: number }) => Promise<{
    data: PrintDeviceModelType[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }>
  create: (newPrintDevice: NewPrintDevice) => Promise<PrintDeviceModelType>
  firstOrCreate: (search: Partial<PrintDevicesTable>, values?: NewPrintDevice) => Promise<PrintDeviceModelType>
  updateOrCreate: (search: Partial<PrintDevicesTable>, values?: NewPrintDevice) => Promise<PrintDeviceModelType>
  createMany: (newPrintDevice: NewPrintDevice[]) => Promise<void>
  forceCreate: (newPrintDevice: NewPrintDevice) => Promise<PrintDeviceModelType>
  remove: (id: number) => Promise<any>
  whereIn: <V = number>(column: keyof PrintDevicesTable, values: V[]) => PrintDeviceModelType
  distinct: (column: keyof PrintDeviceJsonResponse) => PrintDeviceModelType
  join: (table: string, firstCol: string, secondCol: string) => PrintDeviceModelType

  // Instance methods
  createInstance: (data: PrintDeviceJsonResponse) => PrintDeviceModelType
  update: (newPrintDevice: PrintDeviceUpdate) => Promise<PrintDeviceModelType | undefined>
  forceUpdate: (newPrintDevice: PrintDeviceUpdate) => Promise<PrintDeviceModelType | undefined>
  save: () => Promise<PrintDeviceModelType>
  delete: () => Promise<number>
  toSearchableObject: () => Partial<PrintDeviceJsonResponse>
  toJSON: () => PrintDeviceJsonResponse
  parseResult: (model: PrintDeviceModelType) => PrintDeviceModelType

}
