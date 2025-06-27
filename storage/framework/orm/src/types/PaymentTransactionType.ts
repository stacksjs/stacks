import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'

export interface PaymentTransactionsTable {
  id: Generated<number>
  name?: string
  description?: string
  amount?: number
  type?: string
  provider_id?: string
  user_id?: number
  payment_method_id?: number
  uuid?: string
}

export type PaymentTransactionRead = PaymentTransactionsTable

export type PaymentTransactionWrite = Omit<PaymentTransactionsTable, 'created_at'> & {
  created_at?: string
}

export interface PaymentTransactionResponse {
  data: PaymentTransactionJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface PaymentTransactionJsonResponse extends Omit<Selectable<PaymentTransactionRead>, 'password'> {
  [key: string]: any
}

export type NewPaymentTransaction = Insertable<PaymentTransactionWrite>
export type PaymentTransactionUpdate = Updateable<PaymentTransactionWrite>

export interface PaymentTransactionModelType {
  // Properties
  readonly id: number
  get name(): string | undefined
  set name(value: string)
  get description(): string | undefined
  set description(value: string)
  get amount(): number | undefined
  set amount(value: number)
  get type(): string | undefined
  set type(value: string)
  get providerId(): string | undefined
  set providerId(value: string)

  userBelong: () => Promise<UserType>
  paymentMethodBelong: () => Promise<PaymentMethodType>
  get uuid(): string | undefined
  set uuid(value: string)

  // Static methods
  with: (relations: string[]) => PaymentTransactionModelType
  select: (params: (keyof PaymentTransactionJsonResponse)[] | RawBuilder<string> | string) => PaymentTransactionModelType
  find: (id: number) => Promise<PaymentTransactionModelType | undefined>
  first: () => Promise<PaymentTransactionModelType | undefined>
  last: () => Promise<PaymentTransactionModelType | undefined>
  firstOrFail: () => Promise<PaymentTransactionModelType | undefined>
  all: () => Promise<PaymentTransactionModelType[]>
  findOrFail: (id: number) => Promise<PaymentTransactionModelType | undefined>
  findMany: (ids: number[]) => Promise<PaymentTransactionModelType[]>
  latest: (column?: keyof PaymentTransactionsTable) => Promise<PaymentTransactionModelType | undefined>
  oldest: (column?: keyof PaymentTransactionsTable) => Promise<PaymentTransactionModelType | undefined>
  skip: (count: number) => PaymentTransactionModelType
  take: (count: number) => PaymentTransactionModelType
  where: <V = string>(column: keyof PaymentTransactionsTable, ...args: [V] | [Operator, V]) => PaymentTransactionModelType
  orWhere: (...conditions: [string, any][]) => PaymentTransactionModelType
  whereNotIn: <V = number>(column: keyof PaymentTransactionsTable, values: V[]) => PaymentTransactionModelType
  whereBetween: <V = number>(column: keyof PaymentTransactionsTable, range: [V, V]) => PaymentTransactionModelType
  whereRef: (column: keyof PaymentTransactionsTable, ...args: string[]) => PaymentTransactionModelType
  when: (condition: boolean, callback: (query: PaymentTransactionModelType) => PaymentTransactionModelType) => PaymentTransactionModelType
  whereNull: (column: keyof PaymentTransactionsTable) => PaymentTransactionModelType
  whereNotNull: (column: keyof PaymentTransactionsTable) => PaymentTransactionModelType
  whereLike: (column: keyof PaymentTransactionsTable, value: string) => PaymentTransactionModelType
  orderBy: (column: keyof PaymentTransactionsTable, order: 'asc' | 'desc') => PaymentTransactionModelType
  orderByAsc: (column: keyof PaymentTransactionsTable) => PaymentTransactionModelType
  orderByDesc: (column: keyof PaymentTransactionsTable) => PaymentTransactionModelType
  groupBy: (column: keyof PaymentTransactionsTable) => PaymentTransactionModelType
  having: <V = string>(column: keyof PaymentTransactionsTable, operator: Operator, value: V) => PaymentTransactionModelType
  inRandomOrder: () => PaymentTransactionModelType
  whereColumn: (first: keyof PaymentTransactionsTable, operator: Operator, second: keyof PaymentTransactionsTable) => PaymentTransactionModelType
  max: (field: keyof PaymentTransactionsTable) => Promise<number>
  min: (field: keyof PaymentTransactionsTable) => Promise<number>
  avg: (field: keyof PaymentTransactionsTable) => Promise<number>
  sum: (field: keyof PaymentTransactionsTable) => Promise<number>
  count: () => Promise<number>
  get: () => Promise<PaymentTransactionModelType[]>
  pluck: <K extends keyof PaymentTransactionModelType>(field: K) => Promise<PaymentTransactionModelType[K][]>
  chunk: (size: number, callback: (models: PaymentTransactionModelType[]) => Promise<void>) => Promise<void>
  paginate: (options?: { limit?: number, offset?: number, page?: number }) => Promise<{
    data: PaymentTransactionModelType[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }>
  create: (newPaymentTransaction: NewPaymentTransaction) => Promise<PaymentTransactionModelType>
  firstOrCreate: (search: Partial<PaymentTransactionsTable>, values?: NewPaymentTransaction) => Promise<PaymentTransactionModelType>
  updateOrCreate: (search: Partial<PaymentTransactionsTable>, values?: NewPaymentTransaction) => Promise<PaymentTransactionModelType>
  createMany: (newPaymentTransaction: NewPaymentTransaction[]) => Promise<void>
  forceCreate: (newPaymentTransaction: NewPaymentTransaction) => Promise<PaymentTransactionModelType>
  remove: (id: number) => Promise<any>
  whereIn: <V = number>(column: keyof PaymentTransactionsTable, values: V[]) => PaymentTransactionModelType
  distinct: (column: keyof PaymentTransactionJsonResponse) => PaymentTransactionModelType
  join: (table: string, firstCol: string, secondCol: string) => PaymentTransactionModelType

  // Instance methods
  createInstance: (data: PaymentTransactionJsonResponse) => PaymentTransactionModelType
  update: (newPaymentTransaction: PaymentTransactionUpdate) => Promise<PaymentTransactionModelType | undefined>
  forceUpdate: (newPaymentTransaction: PaymentTransactionUpdate) => Promise<PaymentTransactionModelType | undefined>
  save: () => Promise<PaymentTransactionModelType>
  delete: () => Promise<number>
  toSearchableObject: () => Partial<PaymentTransactionJsonResponse>
  toJSON: () => PaymentTransactionJsonResponse
  parseResult: (model: PaymentTransactionModelType) => PaymentTransactionModelType

  userBelong: () => Promise<UserType>
  paymentMethodBelong: () => Promise<PaymentMethodType>
}
