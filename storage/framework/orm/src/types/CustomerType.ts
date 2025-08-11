import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import type { GiftCardModelType } from './GiftCardType'
import type { LicenseKeyModelType } from './LicenseKeyType'
import type { OrderModelType } from './OrderType'
import type { PaymentModelType } from './PaymentType'
import type { ReviewModelType } from './ReviewType'
import type { UserModelType } from './UserType'
import type { WaitlistProductModelType } from './WaitlistProductType'
import type { WaitlistRestaurantModelType } from './WaitlistRestaurantType'

export interface CustomersTable {
  id: Generated<number>
  name: string
  email: string
  phone: string
  total_spent?: number
  last_order?: string
  status: string | string[]
  avatar: string
  uuid?: string
  created_at?: string
  updated_at?: string
}

export type CustomerRead = CustomersTable

export type CustomerWrite = Omit<CustomersTable, 'created_at'> & {
  created_at?: string
}

export interface CustomerResponse {
  data: CustomerJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface CustomerJsonResponse extends Omit<Selectable<CustomerRead>, 'password'> {
  [key: string]: any
}

export type NewCustomer = Insertable<CustomerWrite>
export type CustomerUpdate = Updateable<CustomerWrite>

export interface CustomerModelType {
  // Properties
  readonly id: number
  get name(): string
  set name(value: string)
  get email(): string
  set email(value: string)
  get phone(): string
  set phone(value: string)
  get totalSpent(): number | undefined
  set totalSpent(value: number)
  get lastOrder(): string | undefined
  set lastOrder(value: string)
  get status(): string | string[]
  set status(value: string | string[])
  get avatar(): string
  set avatar(value: string)
  get order(): OrderModelType[] | []
  get gift_card(): GiftCardModelType[] | []
  get review(): ReviewModelType[] | []
  get payment(): PaymentModelType[] | []
  get license_key(): LicenseKeyModelType[] | []
  get waitlist_product(): WaitlistProductModelType[] | []
  get waitlist_restaurant(): WaitlistRestaurantModelType[] | []
  get user(): UserModelType | undefined

  get uuid(): string | undefined
  set uuid(value: string)

  get created_at(): string | undefined
  get updated_at(): string | undefined
  set updated_at(value: string)

  // Static methods
  with: (relations: string[]) => CustomerModelType
  select: (params: (keyof CustomerJsonResponse)[] | RawBuilder<string> | string) => CustomerModelType
  find: (id: number) => Promise<CustomerModelType | undefined>
  first: () => Promise<CustomerModelType | undefined>
  last: () => Promise<CustomerModelType | undefined>
  firstOrFail: () => Promise<CustomerModelType | undefined>
  all: () => Promise<CustomerModelType[]>
  findOrFail: (id: number) => Promise<CustomerModelType | undefined>
  findMany: (ids: number[]) => Promise<CustomerModelType[]>
  latest: (column?: keyof CustomersTable) => Promise<CustomerModelType | undefined>
  oldest: (column?: keyof CustomersTable) => Promise<CustomerModelType | undefined>
  skip: (count: number) => CustomerModelType
  take: (count: number) => CustomerModelType
  where: <V = string>(column: keyof CustomersTable, ...args: [V] | [Operator, V]) => CustomerModelType
  orWhere: (...conditions: [string, any][]) => CustomerModelType
  whereNotIn: <V = number>(column: keyof CustomersTable, values: V[]) => CustomerModelType
  whereBetween: <V = number>(column: keyof CustomersTable, range: [V, V]) => CustomerModelType
  whereRef: (column: keyof CustomersTable, ...args: string[]) => CustomerModelType
  when: (condition: boolean, callback: (query: CustomerModelType) => CustomerModelType) => CustomerModelType
  whereNull: (column: keyof CustomersTable) => CustomerModelType
  whereNotNull: (column: keyof CustomersTable) => CustomerModelType
  whereLike: (column: keyof CustomersTable, value: string) => CustomerModelType
  orderBy: (column: keyof CustomersTable, order: 'asc' | 'desc') => CustomerModelType
  orderByAsc: (column: keyof CustomersTable) => CustomerModelType
  orderByDesc: (column: keyof CustomersTable) => CustomerModelType
  groupBy: (column: keyof CustomersTable) => CustomerModelType
  having: <V = string>(column: keyof CustomersTable, operator: Operator, value: V) => CustomerModelType
  inRandomOrder: () => CustomerModelType
  whereColumn: (first: keyof CustomersTable, operator: Operator, second: keyof CustomersTable) => CustomerModelType
  max: (field: keyof CustomersTable) => Promise<number>
  min: (field: keyof CustomersTable) => Promise<number>
  avg: (field: keyof CustomersTable) => Promise<number>
  sum: (field: keyof CustomersTable) => Promise<number>
  count: () => Promise<number>
  get: () => Promise<CustomerModelType[]>
  pluck: <K extends keyof CustomerModelType>(field: K) => Promise<CustomerModelType[K][]>
  chunk: (size: number, callback: (models: CustomerModelType[]) => Promise<void>) => Promise<void>
  paginate: (options?: { limit?: number, offset?: number, page?: number }) => Promise<{
    data: CustomerModelType[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }>
  create: (newCustomer: NewCustomer) => Promise<CustomerModelType>
  firstOrCreate: (search: Partial<CustomersTable>, values?: NewCustomer) => Promise<CustomerModelType>
  updateOrCreate: (search: Partial<CustomersTable>, values?: NewCustomer) => Promise<CustomerModelType>
  createMany: (newCustomer: NewCustomer[]) => Promise<void>
  forceCreate: (newCustomer: NewCustomer) => Promise<CustomerModelType>
  remove: (id: number) => Promise<any>
  whereIn: <V = number>(column: keyof CustomersTable, values: V[]) => CustomerModelType
  distinct: (column: keyof CustomerJsonResponse) => CustomerModelType
  join: (table: string, firstCol: string, secondCol: string) => CustomerModelType

  // Instance methods
  createInstance: (data: CustomerJsonResponse) => CustomerModelType
  update: (newCustomer: CustomerUpdate) => Promise<CustomerModelType | undefined>
  forceUpdate: (newCustomer: CustomerUpdate) => Promise<CustomerModelType | undefined>
  save: () => Promise<CustomerModelType>
  delete: () => Promise<number>
  toSearchableObject: () => Partial<CustomerJsonResponse>
  toJSON: () => CustomerJsonResponse
  parseResult: (model: CustomerModelType) => CustomerModelType

  userBelong: () => Promise<UserModelType>
}
