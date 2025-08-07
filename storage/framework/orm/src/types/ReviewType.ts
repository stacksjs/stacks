import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'

export interface ReviewsTable {
  id: Generated<number>
  rating: number
  title: string
  content: string
  is_verified_purchase?: boolean
  is_approved?: boolean
  is_featured?: boolean
  helpful_votes?: number
  unhelpful_votes?: number
  purchase_date?: string
  images?: string
  product_id?: number
  customer_id?: number
  uuid?: string
  created_at?: string
  updated_at?: string
}

export type ReviewRead = ReviewsTable

export type ReviewWrite = Omit<ReviewsTable, 'created_at'> & {
  created_at?: string
}

export interface ReviewResponse {
  data: ReviewJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface ReviewJsonResponse extends Omit<Selectable<ReviewRead>, 'password'> {
  [key: string]: any
}

export type NewReview = Insertable<ReviewWrite>
export type ReviewUpdate = Updateable<ReviewWrite>

export interface ReviewModelType {
  // Properties
  readonly id: number
  get rating(): number
  set rating(value: number)
  get title(): string
  set title(value: string)
  get content(): string
  set content(value: string)
  get isVerifiedPurchase(): boolean | undefined
  set isVerifiedPurchase(value: boolean)
  get isApproved(): boolean | undefined
  set isApproved(value: boolean)
  get isFeatured(): boolean | undefined
  set isFeatured(value: boolean)
  get helpfulVotes(): number | undefined
  set helpfulVotes(value: number)
  get unhelpfulVotes(): number | undefined
  set unhelpfulVotes(value: number)
  get purchaseDate(): string | undefined
  set purchaseDate(value: string)
  get images(): string | undefined
  set images(value: string)

  productBelong: () => Promise<ProductType>
  customerBelong: () => Promise<CustomerType>
  get uuid(): string | undefined
  set uuid(value: string)

  get created_at(): string | undefined
  get updated_at(): string | undefined
  set updated_at(value: string)

  // Static methods
  with: (relations: string[]) => ReviewModelType
  select: (params: (keyof ReviewJsonResponse)[] | RawBuilder<string> | string) => ReviewModelType
  find: (id: number) => Promise<ReviewModelType | undefined>
  first: () => Promise<ReviewModelType | undefined>
  last: () => Promise<ReviewModelType | undefined>
  firstOrFail: () => Promise<ReviewModelType | undefined>
  all: () => Promise<ReviewModelType[]>
  findOrFail: (id: number) => Promise<ReviewModelType | undefined>
  findMany: (ids: number[]) => Promise<ReviewModelType[]>
  latest: (column?: keyof ReviewsTable) => Promise<ReviewModelType | undefined>
  oldest: (column?: keyof ReviewsTable) => Promise<ReviewModelType | undefined>
  skip: (count: number) => ReviewModelType
  take: (count: number) => ReviewModelType
  where: <V = string>(column: keyof ReviewsTable, ...args: [V] | [Operator, V]) => ReviewModelType
  orWhere: (...conditions: [string, any][]) => ReviewModelType
  whereNotIn: <V = number>(column: keyof ReviewsTable, values: V[]) => ReviewModelType
  whereBetween: <V = number>(column: keyof ReviewsTable, range: [V, V]) => ReviewModelType
  whereRef: (column: keyof ReviewsTable, ...args: string[]) => ReviewModelType
  when: (condition: boolean, callback: (query: ReviewModelType) => ReviewModelType) => ReviewModelType
  whereNull: (column: keyof ReviewsTable) => ReviewModelType
  whereNotNull: (column: keyof ReviewsTable) => ReviewModelType
  whereLike: (column: keyof ReviewsTable, value: string) => ReviewModelType
  orderBy: (column: keyof ReviewsTable, order: 'asc' | 'desc') => ReviewModelType
  orderByAsc: (column: keyof ReviewsTable) => ReviewModelType
  orderByDesc: (column: keyof ReviewsTable) => ReviewModelType
  groupBy: (column: keyof ReviewsTable) => ReviewModelType
  having: <V = string>(column: keyof ReviewsTable, operator: Operator, value: V) => ReviewModelType
  inRandomOrder: () => ReviewModelType
  whereColumn: (first: keyof ReviewsTable, operator: Operator, second: keyof ReviewsTable) => ReviewModelType
  max: (field: keyof ReviewsTable) => Promise<number>
  min: (field: keyof ReviewsTable) => Promise<number>
  avg: (field: keyof ReviewsTable) => Promise<number>
  sum: (field: keyof ReviewsTable) => Promise<number>
  count: () => Promise<number>
  get: () => Promise<ReviewModelType[]>
  pluck: <K extends keyof ReviewModelType>(field: K) => Promise<ReviewModelType[K][]>
  chunk: (size: number, callback: (models: ReviewModelType[]) => Promise<void>) => Promise<void>
  paginate: (options?: { limit?: number, offset?: number, page?: number }) => Promise<{
    data: ReviewModelType[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }>
  create: (newReview: NewReview) => Promise<ReviewModelType>
  firstOrCreate: (search: Partial<ReviewsTable>, values?: NewReview) => Promise<ReviewModelType>
  updateOrCreate: (search: Partial<ReviewsTable>, values?: NewReview) => Promise<ReviewModelType>
  createMany: (newReview: NewReview[]) => Promise<void>
  forceCreate: (newReview: NewReview) => Promise<ReviewModelType>
  remove: (id: number) => Promise<any>
  whereIn: <V = number>(column: keyof ReviewsTable, values: V[]) => ReviewModelType
  distinct: (column: keyof ReviewJsonResponse) => ReviewModelType
  join: (table: string, firstCol: string, secondCol: string) => ReviewModelType

  // Instance methods
  createInstance: (data: ReviewJsonResponse) => ReviewModelType
  update: (newReview: ReviewUpdate) => Promise<ReviewModelType | undefined>
  forceUpdate: (newReview: ReviewUpdate) => Promise<ReviewModelType | undefined>
  save: () => Promise<ReviewModelType>
  delete: () => Promise<number>
  toSearchableObject: () => Partial<ReviewJsonResponse>
  toJSON: () => ReviewJsonResponse
  parseResult: (model: ReviewModelType) => ReviewModelType

  productBelong: () => Promise<ProductType>
  customerBelong: () => Promise<CustomerType>
}
