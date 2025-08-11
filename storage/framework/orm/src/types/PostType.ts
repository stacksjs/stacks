import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import type { AuthorModelType } from './AuthorType'

export interface PostsTable {
  id: Generated<number>
  title?: string
  poster?: string
  content?: string
  excerpt?: string
  views?: number
  published_at?: Date | string
  status?: string | string[]
  is_featured?: number
  uuid?: string
  created_at?: string
  updated_at?: string
}

export type PostRead = PostsTable

export type PostWrite = Omit<PostsTable, 'created_at'> & {
  created_at?: string
}

export interface PostResponse {
  data: PostJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface PostJsonResponse extends Omit<Selectable<PostRead>, 'password'> {
  [key: string]: any
}

export type NewPost = Insertable<PostWrite>
export type PostUpdate = Updateable<PostWrite>

export interface PostModelType {
  // Properties
  readonly id: number
  get title(): string | undefined
  set title(value: string)
  get poster(): string | undefined
  set poster(value: string)
  get content(): string | undefined
  set content(value: string)
  get excerpt(): string | undefined
  set excerpt(value: string)
  get views(): number | undefined
  set views(value: number)
  get publishedAt(): Date | string | undefined
  set publishedAt(value: Date | string)
  get status(): string | string[] | undefined
  set status(value: string | string[])
  get isFeatured(): number | undefined
  set isFeatured(value: number)
  get author(): AuthorModelType | undefined

  get uuid(): string | undefined
  set uuid(value: string)

  get created_at(): string | undefined
  get updated_at(): string | undefined
  set updated_at(value: string)

  // Static methods
  with: (relations: string[]) => PostModelType
  select: (params: (keyof PostJsonResponse)[] | RawBuilder<string> | string) => PostModelType
  find: (id: number) => Promise<PostModelType | undefined>
  first: () => Promise<PostModelType | undefined>
  last: () => Promise<PostModelType | undefined>
  firstOrFail: () => Promise<PostModelType | undefined>
  all: () => Promise<PostModelType[]>
  findOrFail: (id: number) => Promise<PostModelType | undefined>
  findMany: (ids: number[]) => Promise<PostModelType[]>
  latest: (column?: keyof PostsTable) => Promise<PostModelType | undefined>
  oldest: (column?: keyof PostsTable) => Promise<PostModelType | undefined>
  skip: (count: number) => PostModelType
  take: (count: number) => PostModelType
  where: <V = string>(column: keyof PostsTable, ...args: [V] | [Operator, V]) => PostModelType
  orWhere: (...conditions: [string, any][]) => PostModelType
  whereNotIn: <V = number>(column: keyof PostsTable, values: V[]) => PostModelType
  whereBetween: <V = number>(column: keyof PostsTable, range: [V, V]) => PostModelType
  whereRef: (column: keyof PostsTable, ...args: string[]) => PostModelType
  when: (condition: boolean, callback: (query: PostModelType) => PostModelType) => PostModelType
  whereNull: (column: keyof PostsTable) => PostModelType
  whereNotNull: (column: keyof PostsTable) => PostModelType
  whereLike: (column: keyof PostsTable, value: string) => PostModelType
  orderBy: (column: keyof PostsTable, order: 'asc' | 'desc') => PostModelType
  orderByAsc: (column: keyof PostsTable) => PostModelType
  orderByDesc: (column: keyof PostsTable) => PostModelType
  groupBy: (column: keyof PostsTable) => PostModelType
  having: <V = string>(column: keyof PostsTable, operator: Operator, value: V) => PostModelType
  inRandomOrder: () => PostModelType
  whereColumn: (first: keyof PostsTable, operator: Operator, second: keyof PostsTable) => PostModelType
  max: (field: keyof PostsTable) => Promise<number>
  min: (field: keyof PostsTable) => Promise<number>
  avg: (field: keyof PostsTable) => Promise<number>
  sum: (field: keyof PostsTable) => Promise<number>
  count: () => Promise<number>
  get: () => Promise<PostModelType[]>
  pluck: <K extends keyof PostModelType>(field: K) => Promise<PostModelType[K][]>
  chunk: (size: number, callback: (models: PostModelType[]) => Promise<void>) => Promise<void>
  paginate: (options?: { limit?: number, offset?: number, page?: number }) => Promise<{
    data: PostModelType[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }>
  create: (newPost: NewPost) => Promise<PostModelType>
  firstOrCreate: (search: Partial<PostsTable>, values?: NewPost) => Promise<PostModelType>
  updateOrCreate: (search: Partial<PostsTable>, values?: NewPost) => Promise<PostModelType>
  createMany: (newPost: NewPost[]) => Promise<void>
  forceCreate: (newPost: NewPost) => Promise<PostModelType>
  remove: (id: number) => Promise<any>
  whereIn: <V = number>(column: keyof PostsTable, values: V[]) => PostModelType
  distinct: (column: keyof PostJsonResponse) => PostModelType
  join: (table: string, firstCol: string, secondCol: string) => PostModelType

  // Instance methods
  createInstance: (data: PostJsonResponse) => PostModelType
  update: (newPost: PostUpdate) => Promise<PostModelType | undefined>
  forceUpdate: (newPost: PostUpdate) => Promise<PostModelType | undefined>
  save: () => Promise<PostModelType>
  delete: () => Promise<number>
  toSearchableObject: () => Partial<PostJsonResponse>
  toJSON: () => PostJsonResponse
  parseResult: (model: PostModelType) => PostModelType

  authorBelong: () => Promise<AuthorModelType>
}
