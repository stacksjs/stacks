import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import type { CustomerModelType } from './CustomerType'
import type { OrderModelType } from './OrderType'

export interface GiftCardsTable {
  id: Generated<number>
  code: string
  initial_balance: number
  current_balance: number
  currency?: string
  status: string
  purchaser_id?: string
  recipient_email?: string
  recipient_name?: string
  personal_message?: string
  is_digital?: boolean
  is_reloadable?: boolean
  is_active?: boolean
  expiry_date?: Date | string
  last_used_date?: Date | string
  template_id?: string
  uuid?: string
  created_at?: string
  updated_at?: string
}

export type GiftCardRead = GiftCardsTable

export type GiftCardWrite = Omit<GiftCardsTable, 'created_at'> & {
  created_at?: string
}

export interface GiftCardResponse {
  data: GiftCardJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface GiftCardJsonResponse extends Omit<Selectable<GiftCardRead>, 'password'> {
  [key: string]: any
}

export type NewGiftCard = Insertable<GiftCardWrite>
export type GiftCardUpdate = Updateable<GiftCardWrite>

export interface GiftCardModelType {
  // Properties
  readonly id: number
  get code(): string
  set code(value: string)
  get initialBalance(): number
  set initialBalance(value: number)
  get currentBalance(): number
  set currentBalance(value: number)
  get currency(): string | undefined
  set currency(value: string)
  get status(): string
  set status(value: string)
  get purchaserId(): string | undefined
  set purchaserId(value: string)
  get recipientEmail(): string | undefined
  set recipientEmail(value: string)
  get recipientName(): string | undefined
  set recipientName(value: string)
  get personalMessage(): string | undefined
  set personalMessage(value: string)
  get isDigital(): boolean | undefined
  set isDigital(value: boolean)
  get isReloadable(): boolean | undefined
  set isReloadable(value: boolean)
  get isActive(): boolean | undefined
  set isActive(value: boolean)
  get expiryDate(): Date | string | undefined
  set expiryDate(value: Date | string)
  get lastUsedDate(): Date | string | undefined
  set lastUsedDate(value: Date | string)
  get templateId(): string | undefined
  set templateId(value: string)
  get order(): OrderModelType[] | []
  get customer(): CustomerModelType | undefined

  get uuid(): string | undefined
  set uuid(value: string)

  get created_at(): string | undefined
  get updated_at(): string | undefined
  set updated_at(value: string)

  // Static methods
  with: (relations: string[]) => GiftCardModelType
  select: (params: (keyof GiftCardJsonResponse)[] | RawBuilder<string> | string) => GiftCardModelType
  find: (id: number) => Promise<GiftCardModelType | undefined>
  first: () => Promise<GiftCardModelType | undefined>
  last: () => Promise<GiftCardModelType | undefined>
  firstOrFail: () => Promise<GiftCardModelType | undefined>
  all: () => Promise<GiftCardModelType[]>
  findOrFail: (id: number) => Promise<GiftCardModelType | undefined>
  findMany: (ids: number[]) => Promise<GiftCardModelType[]>
  latest: (column?: keyof GiftCardsTable) => Promise<GiftCardModelType | undefined>
  oldest: (column?: keyof GiftCardsTable) => Promise<GiftCardModelType | undefined>
  skip: (count: number) => GiftCardModelType
  take: (count: number) => GiftCardModelType
  where: <V = string>(column: keyof GiftCardsTable, ...args: [V] | [Operator, V]) => GiftCardModelType
  orWhere: (...conditions: [string, any][]) => GiftCardModelType
  whereNotIn: <V = number>(column: keyof GiftCardsTable, values: V[]) => GiftCardModelType
  whereBetween: <V = number>(column: keyof GiftCardsTable, range: [V, V]) => GiftCardModelType
  whereRef: (column: keyof GiftCardsTable, ...args: string[]) => GiftCardModelType
  when: (condition: boolean, callback: (query: GiftCardModelType) => GiftCardModelType) => GiftCardModelType
  whereNull: (column: keyof GiftCardsTable) => GiftCardModelType
  whereNotNull: (column: keyof GiftCardsTable) => GiftCardModelType
  whereLike: (column: keyof GiftCardsTable, value: string) => GiftCardModelType
  orderBy: (column: keyof GiftCardsTable, order: 'asc' | 'desc') => GiftCardModelType
  orderByAsc: (column: keyof GiftCardsTable) => GiftCardModelType
  orderByDesc: (column: keyof GiftCardsTable) => GiftCardModelType
  groupBy: (column: keyof GiftCardsTable) => GiftCardModelType
  having: <V = string>(column: keyof GiftCardsTable, operator: Operator, value: V) => GiftCardModelType
  inRandomOrder: () => GiftCardModelType
  whereColumn: (first: keyof GiftCardsTable, operator: Operator, second: keyof GiftCardsTable) => GiftCardModelType
  max: (field: keyof GiftCardsTable) => Promise<number>
  min: (field: keyof GiftCardsTable) => Promise<number>
  avg: (field: keyof GiftCardsTable) => Promise<number>
  sum: (field: keyof GiftCardsTable) => Promise<number>
  count: () => Promise<number>
  get: () => Promise<GiftCardModelType[]>
  pluck: <K extends keyof GiftCardModelType>(field: K) => Promise<GiftCardModelType[K][]>
  chunk: (size: number, callback: (models: GiftCardModelType[]) => Promise<void>) => Promise<void>
  paginate: (options?: { limit?: number, offset?: number, page?: number }) => Promise<{
    data: GiftCardModelType[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }>
  create: (newGiftCard: NewGiftCard) => Promise<GiftCardModelType>
  firstOrCreate: (search: Partial<GiftCardsTable>, values?: NewGiftCard) => Promise<GiftCardModelType>
  updateOrCreate: (search: Partial<GiftCardsTable>, values?: NewGiftCard) => Promise<GiftCardModelType>
  createMany: (newGiftCard: NewGiftCard[]) => Promise<void>
  forceCreate: (newGiftCard: NewGiftCard) => Promise<GiftCardModelType>
  remove: (id: number) => Promise<any>
  whereIn: <V = number>(column: keyof GiftCardsTable, values: V[]) => GiftCardModelType
  distinct: (column: keyof GiftCardJsonResponse) => GiftCardModelType
  join: (table: string, firstCol: string, secondCol: string) => GiftCardModelType

  // Instance methods
  createInstance: (data: GiftCardJsonResponse) => GiftCardModelType
  update: (newGiftCard: GiftCardUpdate) => Promise<GiftCardModelType | undefined>
  forceUpdate: (newGiftCard: GiftCardUpdate) => Promise<GiftCardModelType | undefined>
  save: () => Promise<GiftCardModelType>
  delete: () => Promise<number>
  toSearchableObject: () => Partial<GiftCardJsonResponse>
  toJSON: () => GiftCardJsonResponse
  parseResult: (model: GiftCardModelType) => GiftCardModelType

  customerBelong: () => Promise<CustomerModelType>
}
