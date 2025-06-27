import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'

export interface ProductVariantsTable {
  id: Generated<number>
  variant: string
  type: string
  description?: string
  options?: string
  status: string | string[]
  product_id?: number
  uuid?: string
  created_at?: string
  updated_at?: string
}

export type ProductVariantRead = ProductVariantsTable

export type ProductVariantWrite = Omit<ProductVariantsTable, 'created_at'> & {
  created_at?: string
}

export interface ProductVariantResponse {
  data: ProductVariantJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface ProductVariantJsonResponse extends Omit<Selectable<ProductVariantRead>, 'password'> {
  [key: string]: any
}

export type NewProductVariant = Insertable<ProductVariantWrite>
export type ProductVariantUpdate = Updateable<ProductVariantWrite>

export interface ProductVariantModelType {
  // Properties
  readonly id: number
  get variant(): string
  set variant(value: string)
  get type(): string
  set type(value: string)
  get description(): string | undefined
  set description(value: string)
  get options(): string | undefined
  set options(value: string)
  get status(): string | string[]
  set status(value: string | string[])

  productBelong: () => Promise<ProductType>
  get uuid(): string | undefined
  set uuid(value: string)

  get created_at(): string | undefined
  get updated_at(): string | undefined
  set updated_at(value: string)

  // Static methods
  with: (relations: string[]) => ProductVariantModelType
  select: (params: (keyof ProductVariantJsonResponse)[] | RawBuilder<string> | string) => ProductVariantModelType
  find: (id: number) => Promise<ProductVariantModelType | undefined>
  first: () => Promise<ProductVariantModelType | undefined>
  last: () => Promise<ProductVariantModelType | undefined>
  firstOrFail: () => Promise<ProductVariantModelType | undefined>
  all: () => Promise<ProductVariantModelType[]>
  findOrFail: (id: number) => Promise<ProductVariantModelType | undefined>
  findMany: (ids: number[]) => Promise<ProductVariantModelType[]>
  latest: (column?: keyof ProductVariantsTable) => Promise<ProductVariantModelType | undefined>
  oldest: (column?: keyof ProductVariantsTable) => Promise<ProductVariantModelType | undefined>
  skip: (count: number) => ProductVariantModelType
  take: (count: number) => ProductVariantModelType
  where: <V = string>(column: keyof ProductVariantsTable, ...args: [V] | [Operator, V]) => ProductVariantModelType
  orWhere: (...conditions: [string, any][]) => ProductVariantModelType
  whereNotIn: <V = number>(column: keyof ProductVariantsTable, values: V[]) => ProductVariantModelType
  whereBetween: <V = number>(column: keyof ProductVariantsTable, range: [V, V]) => ProductVariantModelType
  whereRef: (column: keyof ProductVariantsTable, ...args: string[]) => ProductVariantModelType
  when: (condition: boolean, callback: (query: ProductVariantModelType) => ProductVariantModelType) => ProductVariantModelType
  whereNull: (column: keyof ProductVariantsTable) => ProductVariantModelType
  whereNotNull: (column: keyof ProductVariantsTable) => ProductVariantModelType
  whereLike: (column: keyof ProductVariantsTable, value: string) => ProductVariantModelType
  orderBy: (column: keyof ProductVariantsTable, order: 'asc' | 'desc') => ProductVariantModelType
  orderByAsc: (column: keyof ProductVariantsTable) => ProductVariantModelType
  orderByDesc: (column: keyof ProductVariantsTable) => ProductVariantModelType
  groupBy: (column: keyof ProductVariantsTable) => ProductVariantModelType
  having: <V = string>(column: keyof ProductVariantsTable, operator: Operator, value: V) => ProductVariantModelType
  inRandomOrder: () => ProductVariantModelType
  whereColumn: (first: keyof ProductVariantsTable, operator: Operator, second: keyof ProductVariantsTable) => ProductVariantModelType
  max: (field: keyof ProductVariantsTable) => Promise<number>
  min: (field: keyof ProductVariantsTable) => Promise<number>
  avg: (field: keyof ProductVariantsTable) => Promise<number>
  sum: (field: keyof ProductVariantsTable) => Promise<number>
  count: () => Promise<number>
  get: () => Promise<ProductVariantModelType[]>
  pluck: <K extends keyof ProductVariantModelType>(field: K) => Promise<ProductVariantModelType[K][]>
  chunk: (size: number, callback: (models: ProductVariantModelType[]) => Promise<void>) => Promise<void>
  paginate: (options?: { limit?: number, offset?: number, page?: number }) => Promise<{
    data: ProductVariantModelType[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }>
  create: (newProductVariant: NewProductVariant) => Promise<ProductVariantModelType>
  firstOrCreate: (search: Partial<ProductVariantsTable>, values?: NewProductVariant) => Promise<ProductVariantModelType>
  updateOrCreate: (search: Partial<ProductVariantsTable>, values?: NewProductVariant) => Promise<ProductVariantModelType>
  createMany: (newProductVariant: NewProductVariant[]) => Promise<void>
  forceCreate: (newProductVariant: NewProductVariant) => Promise<ProductVariantModelType>
  remove: (id: number) => Promise<any>
  whereIn: <V = number>(column: keyof ProductVariantsTable, values: V[]) => ProductVariantModelType
  distinct: (column: keyof ProductVariantJsonResponse) => ProductVariantModelType
  join: (table: string, firstCol: string, secondCol: string) => ProductVariantModelType

  // Instance methods
  createInstance: (data: ProductVariantJsonResponse) => ProductVariantModelType
  update: (newProductVariant: ProductVariantUpdate) => Promise<ProductVariantModelType | undefined>
  forceUpdate: (newProductVariant: ProductVariantUpdate) => Promise<ProductVariantModelType | undefined>
  save: () => Promise<ProductVariantModelType>
  delete: () => Promise<number>
  toSearchableObject: () => Partial<ProductVariantJsonResponse>
  toJSON: () => ProductVariantJsonResponse
  parseResult: (model: ProductVariantModelType) => ProductVariantModelType

  productBelong: () => Promise<ProductType>
}
