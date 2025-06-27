import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'

export interface PagesTable {
  id: Generated<number>
  title?: string
  template?: string
  views?: number
  published_at?: Date | string
  conversions?: number
  author_id?: number
  uuid?: string
  created_at?: string
  updated_at?: string
}

export type PageRead = PagesTable

export type PageWrite = Omit<PagesTable, 'created_at'> & {
  created_at?: string
}

export interface PageResponse {
  data: PageJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface PageJsonResponse extends Omit<Selectable<PageRead>, 'password'> {
  [key: string]: any
}

export type NewPage = Insertable<PageWrite>
export type PageUpdate = Updateable<PageWrite>

export interface PageModelType {
  // Properties
  readonly id: number
  get title(): string | undefined
  set title(value: string)
  get template(): string | undefined
  set template(value: string)
  get views(): number | undefined
  set views(value: number)
  get publishedAt(): Date | string | undefined
  set publishedAt(value: Date | string)
  get conversions(): number | undefined
  set conversions(value: number)

  authorBelong: () => Promise<AuthorType>
  get uuid(): string | undefined
  set uuid(value: string)

  get created_at(): string | undefined
  get updated_at(): string | undefined
  set updated_at(value: string)

  // Static methods
  with: (relations: string[]) => PageModelType
  select: (params: (keyof PageJsonResponse)[] | RawBuilder<string> | string) => PageModelType
  find: (id: number) => Promise<PageModelType | undefined>
  first: () => Promise<PageModelType | undefined>
  last: () => Promise<PageModelType | undefined>
  firstOrFail: () => Promise<PageModelType | undefined>
  all: () => Promise<PageModelType[]>
  findOrFail: (id: number) => Promise<PageModelType | undefined>
  findMany: (ids: number[]) => Promise<PageModelType[]>
  latest: (column?: keyof PagesTable) => Promise<PageModelType | undefined>
  oldest: (column?: keyof PagesTable) => Promise<PageModelType | undefined>
  skip: (count: number) => PageModelType
  take: (count: number) => PageModelType
  where: <V = string>(column: keyof PagesTable, ...args: [V] | [Operator, V]) => PageModelType
  orWhere: (...conditions: [string, any][]) => PageModelType
  whereNotIn: <V = number>(column: keyof PagesTable, values: V[]) => PageModelType
  whereBetween: <V = number>(column: keyof PagesTable, range: [V, V]) => PageModelType
  whereRef: (column: keyof PagesTable, ...args: string[]) => PageModelType
  when: (condition: boolean, callback: (query: PageModelType) => PageModelType) => PageModelType
  whereNull: (column: keyof PagesTable) => PageModelType
  whereNotNull: (column: keyof PagesTable) => PageModelType
  whereLike: (column: keyof PagesTable, value: string) => PageModelType
  orderBy: (column: keyof PagesTable, order: 'asc' | 'desc') => PageModelType
  orderByAsc: (column: keyof PagesTable) => PageModelType
  orderByDesc: (column: keyof PagesTable) => PageModelType
  groupBy: (column: keyof PagesTable) => PageModelType
  having: <V = string>(column: keyof PagesTable, operator: Operator, value: V) => PageModelType
  inRandomOrder: () => PageModelType
  whereColumn: (first: keyof PagesTable, operator: Operator, second: keyof PagesTable) => PageModelType
  max: (field: keyof PagesTable) => Promise<number>
  min: (field: keyof PagesTable) => Promise<number>
  avg: (field: keyof PagesTable) => Promise<number>
  sum: (field: keyof PagesTable) => Promise<number>
  count: () => Promise<number>
  get: () => Promise<PageModelType[]>
  pluck: <K extends keyof PageModelType>(field: K) => Promise<PageModelType[K][]>
  chunk: (size: number, callback: (models: PageModelType[]) => Promise<void>) => Promise<void>
  paginate: (options?: { limit?: number, offset?: number, page?: number }) => Promise<{
    data: PageModelType[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }>
  create: (newPage: NewPage) => Promise<PageModelType>
  firstOrCreate: (search: Partial<PagesTable>, values?: NewPage) => Promise<PageModelType>
  updateOrCreate: (search: Partial<PagesTable>, values?: NewPage) => Promise<PageModelType>
  createMany: (newPage: NewPage[]) => Promise<void>
  forceCreate: (newPage: NewPage) => Promise<PageModelType>
  remove: (id: number) => Promise<any>
  whereIn: <V = number>(column: keyof PagesTable, values: V[]) => PageModelType
  distinct: (column: keyof PageJsonResponse) => PageModelType
  join: (table: string, firstCol: string, secondCol: string) => PageModelType

  // Instance methods
  createInstance: (data: PageJsonResponse) => PageModelType
  update: (newPage: PageUpdate) => Promise<PageModelType | undefined>
  forceUpdate: (newPage: PageUpdate) => Promise<PageModelType | undefined>
  save: () => Promise<PageModelType>
  delete: () => Promise<number>
  toSearchableObject: () => Partial<PageJsonResponse>
  toJSON: () => PageJsonResponse
  parseResult: (model: PageModelType) => PageModelType

  authorBelong: () => Promise<AuthorType>
}
