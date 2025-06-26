import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import type { ProductModelType } from './ProductType'

export interface CategoriesTable {
  id: Generated<number>
  name: string
  description?: string
  slug: string
  image_url?: string
  is_active?: boolean
  parent_category_id?: string
  display_order: number
  uuid?: string
  created_at?: string
  updated_at?: string
}

export type CategoryRead = CategoriesTable

export type CategoryWrite = Omit<CategoriesTable, 'created_at'> & {
  created_at?: string
}

export interface CategoryResponse {
  data: CategoryJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface CategoryJsonResponse extends Omit<Selectable<CategoryRead>, 'password'> {
  [key: string]: any
}

export type NewCategory = Insertable<CategoryWrite>
export type CategoryUpdate = Updateable<CategoryWrite>

export interface CategoryModelType {
  // Properties
  readonly id: number
  get name(): string
  set name(value: string)
  get description(): string | undefined
  set description(value: string)
  get slug(): string
  set slug(value: string)
  get imageUrl(): string | undefined
  set imageUrl(value: string)
  get isActive(): boolean | undefined
  set isActive(value: boolean)
  get parentCategoryId(): string | undefined
  set parentCategoryId(value: string)
  get displayOrder(): number
  set displayOrder(value: number)
  get product(): ProductModelType[] | []

  get uuid(): string | undefined
  set uuid(value: string)

  get created_at(): string | undefined
  get updated_at(): string | undefined
  set updated_at(value: string)

  // Static methods
  with: (relations: string[]) => CategoryModelType
  select: (params: (keyof CategoryJsonResponse)[] | RawBuilder<string> | string) => CategoryModelType
  find: (id: number) => Promise<CategoryModelType | undefined>
  first: () => Promise<CategoryModelType | undefined>
  last: () => Promise<CategoryModelType | undefined>
  firstOrFail: () => Promise<CategoryModelType | undefined>
  all: () => Promise<CategoryModelType[]>
  findOrFail: (id: number) => Promise<CategoryModelType | undefined>
  findMany: (ids: number[]) => Promise<CategoryModelType[]>
  latest: (column?: keyof CategoriesTable) => Promise<CategoryModelType | undefined>
  oldest: (column?: keyof CategoriesTable) => Promise<CategoryModelType | undefined>
  skip: (count: number) => CategoryModelType
  take: (count: number) => CategoryModelType
  where: <V = string>(column: keyof CategoriesTable, ...args: [V] | [Operator, V]) => CategoryModelType
  orWhere: (...conditions: [string, any][]) => CategoryModelType
  whereNotIn: <V = number>(column: keyof CategoriesTable, values: V[]) => CategoryModelType
  whereBetween: <V = number>(column: keyof CategoriesTable, range: [V, V]) => CategoryModelType
  whereRef: (column: keyof CategoriesTable, ...args: string[]) => CategoryModelType
  when: (condition: boolean, callback: (query: CategoryModelType) => CategoryModelType) => CategoryModelType
  whereNull: (column: keyof CategoriesTable) => CategoryModelType
  whereNotNull: (column: keyof CategoriesTable) => CategoryModelType
  whereLike: (column: keyof CategoriesTable, value: string) => CategoryModelType
  orderBy: (column: keyof CategoriesTable, order: 'asc' | 'desc') => CategoryModelType
  orderByAsc: (column: keyof CategoriesTable) => CategoryModelType
  orderByDesc: (column: keyof CategoriesTable) => CategoryModelType
  groupBy: (column: keyof CategoriesTable) => CategoryModelType
  having: <V = string>(column: keyof CategoriesTable, operator: Operator, value: V) => CategoryModelType
  inRandomOrder: () => CategoryModelType
  whereColumn: (first: keyof CategoriesTable, operator: Operator, second: keyof CategoriesTable) => CategoryModelType
  max: (field: keyof CategoriesTable) => Promise<number>
  min: (field: keyof CategoriesTable) => Promise<number>
  avg: (field: keyof CategoriesTable) => Promise<number>
  sum: (field: keyof CategoriesTable) => Promise<number>
  count: () => Promise<number>
  get: () => Promise<CategoryModelType[]>
  pluck: <K extends keyof CategoryModelType>(field: K) => Promise<CategoryModelType[K][]>
  chunk: (size: number, callback: (models: CategoryModelType[]) => Promise<void>) => Promise<void>
  paginate: (options?: { limit?: number, offset?: number, page?: number }) => Promise<{
    data: CategoryModelType[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }>
  create: (newCategory: NewCategory) => Promise<CategoryModelType>
  firstOrCreate: (search: Partial<CategoriesTable>, values?: NewCategory) => Promise<CategoryModelType>
  updateOrCreate: (search: Partial<CategoriesTable>, values?: NewCategory) => Promise<CategoryModelType>
  createMany: (newCategory: NewCategory[]) => Promise<void>
  forceCreate: (newCategory: NewCategory) => Promise<CategoryModelType>
  remove: (id: number) => Promise<any>
  whereIn: <V = number>(column: keyof CategoriesTable, values: V[]) => CategoryModelType
  distinct: (column: keyof CategoryJsonResponse) => CategoryModelType
  join: (table: string, firstCol: string, secondCol: string) => CategoryModelType

  // Instance methods
  createInstance: (data: CategoryJsonResponse) => CategoryModelType
  update: (newCategory: CategoryUpdate) => Promise<CategoryModelType | undefined>
  forceUpdate: (newCategory: CategoryUpdate) => Promise<CategoryModelType | undefined>
  save: () => Promise<CategoryModelType>
  delete: () => Promise<number>
  toSearchableObject: () => Partial<CategoryJsonResponse>
  toJSON: () => CategoryJsonResponse
  parseResult: (model: CategoryModelType) => CategoryModelType

}
