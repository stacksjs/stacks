import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'

export interface TransactionsTable {
  id: Generated<number>
  amount: number
  status: string
  payment_method: string
  payment_details?: string
  transaction_reference?: string
  loyalty_points_earned?: number
  loyalty_points_redeemed?: number
  order_id?: number
  uuid?: string
  created_at?: string
  updated_at?: string
}

export type TransactionRead = TransactionsTable

export type TransactionWrite = Omit<TransactionsTable, 'created_at'> & {
  created_at?: string
}

export interface TransactionResponse {
  data: TransactionJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface TransactionJsonResponse extends Omit<Selectable<TransactionRead>, 'password'> {
  [key: string]: any
}

export type NewTransaction = Insertable<TransactionWrite>
export type TransactionUpdate = Updateable<TransactionWrite>

export interface TransactionModelType {
  // Properties
  readonly id: number
  get amount(): number
  set amount(value: number)
  get status(): string
  set status(value: string)
  get paymentMethod(): string
  set paymentMethod(value: string)
  get paymentDetails(): string | undefined
  set paymentDetails(value: string)
  get transactionReference(): string | undefined
  set transactionReference(value: string)
  get loyaltyPointsEarned(): number | undefined
  set loyaltyPointsEarned(value: number)
  get loyaltyPointsRedeemed(): number | undefined
  set loyaltyPointsRedeemed(value: number)

  orderBelong: () => Promise<OrderType>
  get uuid(): string | undefined
  set uuid(value: string)

  get created_at(): string | undefined
  get updated_at(): string | undefined
  set updated_at(value: string)

  // Static methods
  with: (relations: string[]) => TransactionModelType
  select: (params: (keyof TransactionJsonResponse)[] | RawBuilder<string> | string) => TransactionModelType
  find: (id: number) => Promise<TransactionModelType | undefined>
  first: () => Promise<TransactionModelType | undefined>
  last: () => Promise<TransactionModelType | undefined>
  firstOrFail: () => Promise<TransactionModelType | undefined>
  all: () => Promise<TransactionModelType[]>
  findOrFail: (id: number) => Promise<TransactionModelType | undefined>
  findMany: (ids: number[]) => Promise<TransactionModelType[]>
  latest: (column?: keyof TransactionsTable) => Promise<TransactionModelType | undefined>
  oldest: (column?: keyof TransactionsTable) => Promise<TransactionModelType | undefined>
  skip: (count: number) => TransactionModelType
  take: (count: number) => TransactionModelType
  where: <V = string>(column: keyof TransactionsTable, ...args: [V] | [Operator, V]) => TransactionModelType
  orWhere: (...conditions: [string, any][]) => TransactionModelType
  whereNotIn: <V = number>(column: keyof TransactionsTable, values: V[]) => TransactionModelType
  whereBetween: <V = number>(column: keyof TransactionsTable, range: [V, V]) => TransactionModelType
  whereRef: (column: keyof TransactionsTable, ...args: string[]) => TransactionModelType
  when: (condition: boolean, callback: (query: TransactionModelType) => TransactionModelType) => TransactionModelType
  whereNull: (column: keyof TransactionsTable) => TransactionModelType
  whereNotNull: (column: keyof TransactionsTable) => TransactionModelType
  whereLike: (column: keyof TransactionsTable, value: string) => TransactionModelType
  orderBy: (column: keyof TransactionsTable, order: 'asc' | 'desc') => TransactionModelType
  orderByAsc: (column: keyof TransactionsTable) => TransactionModelType
  orderByDesc: (column: keyof TransactionsTable) => TransactionModelType
  groupBy: (column: keyof TransactionsTable) => TransactionModelType
  having: <V = string>(column: keyof TransactionsTable, operator: Operator, value: V) => TransactionModelType
  inRandomOrder: () => TransactionModelType
  whereColumn: (first: keyof TransactionsTable, operator: Operator, second: keyof TransactionsTable) => TransactionModelType
  max: (field: keyof TransactionsTable) => Promise<number>
  min: (field: keyof TransactionsTable) => Promise<number>
  avg: (field: keyof TransactionsTable) => Promise<number>
  sum: (field: keyof TransactionsTable) => Promise<number>
  count: () => Promise<number>
  get: () => Promise<TransactionModelType[]>
  pluck: <K extends keyof TransactionModelType>(field: K) => Promise<TransactionModelType[K][]>
  chunk: (size: number, callback: (models: TransactionModelType[]) => Promise<void>) => Promise<void>
  paginate: (options?: { limit?: number, offset?: number, page?: number }) => Promise<{
    data: TransactionModelType[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }>
  create: (newTransaction: NewTransaction) => Promise<TransactionModelType>
  firstOrCreate: (search: Partial<TransactionsTable>, values?: NewTransaction) => Promise<TransactionModelType>
  updateOrCreate: (search: Partial<TransactionsTable>, values?: NewTransaction) => Promise<TransactionModelType>
  createMany: (newTransaction: NewTransaction[]) => Promise<void>
  forceCreate: (newTransaction: NewTransaction) => Promise<TransactionModelType>
  remove: (id: number) => Promise<any>
  whereIn: <V = number>(column: keyof TransactionsTable, values: V[]) => TransactionModelType
  distinct: (column: keyof TransactionJsonResponse) => TransactionModelType
  join: (table: string, firstCol: string, secondCol: string) => TransactionModelType

  // Instance methods
  createInstance: (data: TransactionJsonResponse) => TransactionModelType
  update: (newTransaction: TransactionUpdate) => Promise<TransactionModelType | undefined>
  forceUpdate: (newTransaction: TransactionUpdate) => Promise<TransactionModelType | undefined>
  save: () => Promise<TransactionModelType>
  delete: () => Promise<number>
  toSearchableObject: () => Partial<TransactionJsonResponse>
  toJSON: () => TransactionJsonResponse
  parseResult: (model: TransactionModelType) => TransactionModelType

  orderBelong: () => Promise<OrderType>
}
