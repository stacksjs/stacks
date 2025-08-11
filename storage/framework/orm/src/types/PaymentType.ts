import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import type { CustomerModelType } from './CustomerType'
import type { OrderModelType } from './OrderType'

export interface PaymentsTable {
  id: Generated<number>
  amount: number
  method: string
  status: string
  currency?: string
  reference_number?: string
  card_last_four?: string
  card_brand?: string
  billing_email?: string
  transaction_id?: string
  payment_provider?: string
  refund_amount?: number
  notes?: string
  uuid?: string
  created_at?: string
  updated_at?: string
}

export type PaymentRead = PaymentsTable

export type PaymentWrite = Omit<PaymentsTable, 'created_at'> & {
  created_at?: string
}

export interface PaymentResponse {
  data: PaymentJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface PaymentJsonResponse extends Omit<Selectable<PaymentRead>, 'password'> {
  [key: string]: any
}

export type NewPayment = Insertable<PaymentWrite>
export type PaymentUpdate = Updateable<PaymentWrite>

export interface PaymentModelType {
  // Properties
  readonly id: number
  get amount(): number
  set amount(value: number)
  get method(): string
  set method(value: string)
  get status(): string
  set status(value: string)
  get currency(): string | undefined
  set currency(value: string)
  get referenceNumber(): string | undefined
  set referenceNumber(value: string)
  get cardLastFour(): string | undefined
  set cardLastFour(value: string)
  get cardBrand(): string | undefined
  set cardBrand(value: string)
  get billingEmail(): string | undefined
  set billingEmail(value: string)
  get transactionId(): string | undefined
  set transactionId(value: string)
  get paymentProvider(): string | undefined
  set paymentProvider(value: string)
  get refundAmount(): number | undefined
  set refundAmount(value: number)
  get notes(): string | undefined
  set notes(value: string)
  get order(): OrderModelType | undefined
  get customer(): CustomerModelType | undefined

  get uuid(): string | undefined
  set uuid(value: string)

  get created_at(): string | undefined
  get updated_at(): string | undefined
  set updated_at(value: string)

  // Static methods
  with: (relations: string[]) => PaymentModelType
  select: (params: (keyof PaymentJsonResponse)[] | RawBuilder<string> | string) => PaymentModelType
  find: (id: number) => Promise<PaymentModelType | undefined>
  first: () => Promise<PaymentModelType | undefined>
  last: () => Promise<PaymentModelType | undefined>
  firstOrFail: () => Promise<PaymentModelType | undefined>
  all: () => Promise<PaymentModelType[]>
  findOrFail: (id: number) => Promise<PaymentModelType | undefined>
  findMany: (ids: number[]) => Promise<PaymentModelType[]>
  latest: (column?: keyof PaymentsTable) => Promise<PaymentModelType | undefined>
  oldest: (column?: keyof PaymentsTable) => Promise<PaymentModelType | undefined>
  skip: (count: number) => PaymentModelType
  take: (count: number) => PaymentModelType
  where: <V = string>(column: keyof PaymentsTable, ...args: [V] | [Operator, V]) => PaymentModelType
  orWhere: (...conditions: [string, any][]) => PaymentModelType
  whereNotIn: <V = number>(column: keyof PaymentsTable, values: V[]) => PaymentModelType
  whereBetween: <V = number>(column: keyof PaymentsTable, range: [V, V]) => PaymentModelType
  whereRef: (column: keyof PaymentsTable, ...args: string[]) => PaymentModelType
  when: (condition: boolean, callback: (query: PaymentModelType) => PaymentModelType) => PaymentModelType
  whereNull: (column: keyof PaymentsTable) => PaymentModelType
  whereNotNull: (column: keyof PaymentsTable) => PaymentModelType
  whereLike: (column: keyof PaymentsTable, value: string) => PaymentModelType
  orderBy: (column: keyof PaymentsTable, order: 'asc' | 'desc') => PaymentModelType
  orderByAsc: (column: keyof PaymentsTable) => PaymentModelType
  orderByDesc: (column: keyof PaymentsTable) => PaymentModelType
  groupBy: (column: keyof PaymentsTable) => PaymentModelType
  having: <V = string>(column: keyof PaymentsTable, operator: Operator, value: V) => PaymentModelType
  inRandomOrder: () => PaymentModelType
  whereColumn: (first: keyof PaymentsTable, operator: Operator, second: keyof PaymentsTable) => PaymentModelType
  max: (field: keyof PaymentsTable) => Promise<number>
  min: (field: keyof PaymentsTable) => Promise<number>
  avg: (field: keyof PaymentsTable) => Promise<number>
  sum: (field: keyof PaymentsTable) => Promise<number>
  count: () => Promise<number>
  get: () => Promise<PaymentModelType[]>
  pluck: <K extends keyof PaymentModelType>(field: K) => Promise<PaymentModelType[K][]>
  chunk: (size: number, callback: (models: PaymentModelType[]) => Promise<void>) => Promise<void>
  paginate: (options?: { limit?: number, offset?: number, page?: number }) => Promise<{
    data: PaymentModelType[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }>
  create: (newPayment: NewPayment) => Promise<PaymentModelType>
  firstOrCreate: (search: Partial<PaymentsTable>, values?: NewPayment) => Promise<PaymentModelType>
  updateOrCreate: (search: Partial<PaymentsTable>, values?: NewPayment) => Promise<PaymentModelType>
  createMany: (newPayment: NewPayment[]) => Promise<void>
  forceCreate: (newPayment: NewPayment) => Promise<PaymentModelType>
  remove: (id: number) => Promise<any>
  whereIn: <V = number>(column: keyof PaymentsTable, values: V[]) => PaymentModelType
  distinct: (column: keyof PaymentJsonResponse) => PaymentModelType
  join: (table: string, firstCol: string, secondCol: string) => PaymentModelType

  // Instance methods
  createInstance: (data: PaymentJsonResponse) => PaymentModelType
  update: (newPayment: PaymentUpdate) => Promise<PaymentModelType | undefined>
  forceUpdate: (newPayment: PaymentUpdate) => Promise<PaymentModelType | undefined>
  save: () => Promise<PaymentModelType>
  delete: () => Promise<number>
  toSearchableObject: () => Partial<PaymentJsonResponse>
  toJSON: () => PaymentJsonResponse
  parseResult: (model: PaymentModelType) => PaymentModelType

  orderBelong: () => Promise<OrderModelType>
  customerBelong: () => Promise<CustomerModelType>
}
