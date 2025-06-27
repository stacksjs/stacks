import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'

export interface ReceiptsTable {
  id: Generated<number>
  printer?: string
  document: string
  timestamp: Date | string
  status: string | string[]
  size?: number
  pages?: number
  duration?: number
  metadata?: string
  print_device_id?: number
  uuid?: string
  created_at?: string
  updated_at?: string
}

export type ReceiptRead = ReceiptsTable

export type ReceiptWrite = Omit<ReceiptsTable, 'created_at'> & {
  created_at?: string
}

export interface ReceiptResponse {
  data: ReceiptJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface ReceiptJsonResponse extends Omit<Selectable<ReceiptRead>, 'password'> {
  [key: string]: any
}

export type NewReceipt = Insertable<ReceiptWrite>
export type ReceiptUpdate = Updateable<ReceiptWrite>

export interface ReceiptModelType {
  // Properties
  readonly id: number
  get printer(): string | undefined
  set printer(value: string)
  get document(): string
  set document(value: string)
  get timestamp(): Date | string
  set timestamp(value: Date | string)
  get status(): string | string[]
  set status(value: string | string[])
  get size(): number | undefined
  set size(value: number)
  get pages(): number | undefined
  set pages(value: number)
  get duration(): number | undefined
  set duration(value: number)
  get metadata(): string | undefined
  set metadata(value: string)

  printDeviceBelong: () => Promise<PrintDeviceType>
  get uuid(): string | undefined
  set uuid(value: string)

  get created_at(): string | undefined
  get updated_at(): string | undefined
  set updated_at(value: string)

  // Static methods
  with: (relations: string[]) => ReceiptModelType
  select: (params: (keyof ReceiptJsonResponse)[] | RawBuilder<string> | string) => ReceiptModelType
  find: (id: number) => Promise<ReceiptModelType | undefined>
  first: () => Promise<ReceiptModelType | undefined>
  last: () => Promise<ReceiptModelType | undefined>
  firstOrFail: () => Promise<ReceiptModelType | undefined>
  all: () => Promise<ReceiptModelType[]>
  findOrFail: (id: number) => Promise<ReceiptModelType | undefined>
  findMany: (ids: number[]) => Promise<ReceiptModelType[]>
  latest: (column?: keyof ReceiptsTable) => Promise<ReceiptModelType | undefined>
  oldest: (column?: keyof ReceiptsTable) => Promise<ReceiptModelType | undefined>
  skip: (count: number) => ReceiptModelType
  take: (count: number) => ReceiptModelType
  where: <V = string>(column: keyof ReceiptsTable, ...args: [V] | [Operator, V]) => ReceiptModelType
  orWhere: (...conditions: [string, any][]) => ReceiptModelType
  whereNotIn: <V = number>(column: keyof ReceiptsTable, values: V[]) => ReceiptModelType
  whereBetween: <V = number>(column: keyof ReceiptsTable, range: [V, V]) => ReceiptModelType
  whereRef: (column: keyof ReceiptsTable, ...args: string[]) => ReceiptModelType
  when: (condition: boolean, callback: (query: ReceiptModelType) => ReceiptModelType) => ReceiptModelType
  whereNull: (column: keyof ReceiptsTable) => ReceiptModelType
  whereNotNull: (column: keyof ReceiptsTable) => ReceiptModelType
  whereLike: (column: keyof ReceiptsTable, value: string) => ReceiptModelType
  orderBy: (column: keyof ReceiptsTable, order: 'asc' | 'desc') => ReceiptModelType
  orderByAsc: (column: keyof ReceiptsTable) => ReceiptModelType
  orderByDesc: (column: keyof ReceiptsTable) => ReceiptModelType
  groupBy: (column: keyof ReceiptsTable) => ReceiptModelType
  having: <V = string>(column: keyof ReceiptsTable, operator: Operator, value: V) => ReceiptModelType
  inRandomOrder: () => ReceiptModelType
  whereColumn: (first: keyof ReceiptsTable, operator: Operator, second: keyof ReceiptsTable) => ReceiptModelType
  max: (field: keyof ReceiptsTable) => Promise<number>
  min: (field: keyof ReceiptsTable) => Promise<number>
  avg: (field: keyof ReceiptsTable) => Promise<number>
  sum: (field: keyof ReceiptsTable) => Promise<number>
  count: () => Promise<number>
  get: () => Promise<ReceiptModelType[]>
  pluck: <K extends keyof ReceiptModelType>(field: K) => Promise<ReceiptModelType[K][]>
  chunk: (size: number, callback: (models: ReceiptModelType[]) => Promise<void>) => Promise<void>
  paginate: (options?: { limit?: number, offset?: number, page?: number }) => Promise<{
    data: ReceiptModelType[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }>
  create: (newReceipt: NewReceipt) => Promise<ReceiptModelType>
  firstOrCreate: (search: Partial<ReceiptsTable>, values?: NewReceipt) => Promise<ReceiptModelType>
  updateOrCreate: (search: Partial<ReceiptsTable>, values?: NewReceipt) => Promise<ReceiptModelType>
  createMany: (newReceipt: NewReceipt[]) => Promise<void>
  forceCreate: (newReceipt: NewReceipt) => Promise<ReceiptModelType>
  remove: (id: number) => Promise<any>
  whereIn: <V = number>(column: keyof ReceiptsTable, values: V[]) => ReceiptModelType
  distinct: (column: keyof ReceiptJsonResponse) => ReceiptModelType
  join: (table: string, firstCol: string, secondCol: string) => ReceiptModelType

  // Instance methods
  createInstance: (data: ReceiptJsonResponse) => ReceiptModelType
  update: (newReceipt: ReceiptUpdate) => Promise<ReceiptModelType | undefined>
  forceUpdate: (newReceipt: ReceiptUpdate) => Promise<ReceiptModelType | undefined>
  save: () => Promise<ReceiptModelType>
  delete: () => Promise<number>
  toSearchableObject: () => Partial<ReceiptJsonResponse>
  toJSON: () => ReceiptJsonResponse
  parseResult: (model: ReceiptModelType) => ReceiptModelType

  printDeviceBelong: () => Promise<PrintDeviceType>
}
