import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import type { PaymentTransactionModelType } from './PaymentTransactionType'

export interface PaymentMethodsTable {
  id: Generated<number>
  type?: string
  last_four?: number
  brand?: string
  exp_month?: number
  exp_year?: number
  is_default?: boolean
  provider_id?: string
  user_id?: number
  uuid?: string
}

export type PaymentMethodRead = PaymentMethodsTable

export type PaymentMethodWrite = Omit<PaymentMethodsTable, 'created_at'> & {
  created_at?: string
}

export interface PaymentMethodResponse {
  data: PaymentMethodJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface PaymentMethodJsonResponse extends Omit<Selectable<PaymentMethodRead>, 'password'> {
  [key: string]: any
}

export type NewPaymentMethod = Insertable<PaymentMethodWrite>
export type PaymentMethodUpdate = Updateable<PaymentMethodWrite>

export interface PaymentMethodModelType {
  // Properties
  readonly id: number
  get type(): string | undefined
  set type(value: string)
  get lastFour(): number | undefined
  set lastFour(value: number)
  get brand(): string | undefined
  set brand(value: string)
  get expMonth(): number | undefined
  set expMonth(value: number)
  get expYear(): number | undefined
  set expYear(value: number)
  get isDefault(): boolean | undefined
  set isDefault(value: boolean)
  get providerId(): string | undefined
  set providerId(value: string)
  get payment_transaction(): PaymentTransactionModelType[] | []

  userBelong: () => Promise<UserType>
  get uuid(): string | undefined
  set uuid(value: string)

  // Static methods
  with: (relations: string[]) => PaymentMethodModelType
  select: (params: (keyof PaymentMethodJsonResponse)[] | RawBuilder<string> | string) => PaymentMethodModelType
  find: (id: number) => Promise<PaymentMethodModelType | undefined>
  first: () => Promise<PaymentMethodModelType | undefined>
  last: () => Promise<PaymentMethodModelType | undefined>
  firstOrFail: () => Promise<PaymentMethodModelType | undefined>
  all: () => Promise<PaymentMethodModelType[]>
  findOrFail: (id: number) => Promise<PaymentMethodModelType | undefined>
  findMany: (ids: number[]) => Promise<PaymentMethodModelType[]>
  latest: (column?: keyof PaymentMethodsTable) => Promise<PaymentMethodModelType | undefined>
  oldest: (column?: keyof PaymentMethodsTable) => Promise<PaymentMethodModelType | undefined>
  skip: (count: number) => PaymentMethodModelType
  take: (count: number) => PaymentMethodModelType
  where: <V = string>(column: keyof PaymentMethodsTable, ...args: [V] | [Operator, V]) => PaymentMethodModelType
  orWhere: (...conditions: [string, any][]) => PaymentMethodModelType
  whereNotIn: <V = number>(column: keyof PaymentMethodsTable, values: V[]) => PaymentMethodModelType
  whereBetween: <V = number>(column: keyof PaymentMethodsTable, range: [V, V]) => PaymentMethodModelType
  whereRef: (column: keyof PaymentMethodsTable, ...args: string[]) => PaymentMethodModelType
  when: (condition: boolean, callback: (query: PaymentMethodModelType) => PaymentMethodModelType) => PaymentMethodModelType
  whereNull: (column: keyof PaymentMethodsTable) => PaymentMethodModelType
  whereNotNull: (column: keyof PaymentMethodsTable) => PaymentMethodModelType
  whereLike: (column: keyof PaymentMethodsTable, value: string) => PaymentMethodModelType
  orderBy: (column: keyof PaymentMethodsTable, order: 'asc' | 'desc') => PaymentMethodModelType
  orderByAsc: (column: keyof PaymentMethodsTable) => PaymentMethodModelType
  orderByDesc: (column: keyof PaymentMethodsTable) => PaymentMethodModelType
  groupBy: (column: keyof PaymentMethodsTable) => PaymentMethodModelType
  having: <V = string>(column: keyof PaymentMethodsTable, operator: Operator, value: V) => PaymentMethodModelType
  inRandomOrder: () => PaymentMethodModelType
  whereColumn: (first: keyof PaymentMethodsTable, operator: Operator, second: keyof PaymentMethodsTable) => PaymentMethodModelType
  max: (field: keyof PaymentMethodsTable) => Promise<number>
  min: (field: keyof PaymentMethodsTable) => Promise<number>
  avg: (field: keyof PaymentMethodsTable) => Promise<number>
  sum: (field: keyof PaymentMethodsTable) => Promise<number>
  count: () => Promise<number>
  get: () => Promise<PaymentMethodModelType[]>
  pluck: <K extends keyof PaymentMethodModelType>(field: K) => Promise<PaymentMethodModelType[K][]>
  chunk: (size: number, callback: (models: PaymentMethodModelType[]) => Promise<void>) => Promise<void>
  paginate: (options?: { limit?: number, offset?: number, page?: number }) => Promise<{
    data: PaymentMethodModelType[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }>
  create: (newPaymentMethod: NewPaymentMethod) => Promise<PaymentMethodModelType>
  firstOrCreate: (search: Partial<PaymentMethodsTable>, values?: NewPaymentMethod) => Promise<PaymentMethodModelType>
  updateOrCreate: (search: Partial<PaymentMethodsTable>, values?: NewPaymentMethod) => Promise<PaymentMethodModelType>
  createMany: (newPaymentMethod: NewPaymentMethod[]) => Promise<void>
  forceCreate: (newPaymentMethod: NewPaymentMethod) => Promise<PaymentMethodModelType>
  remove: (id: number) => Promise<any>
  whereIn: <V = number>(column: keyof PaymentMethodsTable, values: V[]) => PaymentMethodModelType
  distinct: (column: keyof PaymentMethodJsonResponse) => PaymentMethodModelType
  join: (table: string, firstCol: string, secondCol: string) => PaymentMethodModelType

  // Instance methods
  createInstance: (data: PaymentMethodJsonResponse) => PaymentMethodModelType
  update: (newPaymentMethod: PaymentMethodUpdate) => Promise<PaymentMethodModelType | undefined>
  forceUpdate: (newPaymentMethod: PaymentMethodUpdate) => Promise<PaymentMethodModelType | undefined>
  save: () => Promise<PaymentMethodModelType>
  delete: () => Promise<number>
  toSearchableObject: () => Partial<PaymentMethodJsonResponse>
  toJSON: () => PaymentMethodJsonResponse
  parseResult: (model: PaymentMethodModelType) => PaymentMethodModelType

  userBelong: () => Promise<UserType>
}
