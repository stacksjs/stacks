import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'

export interface ProductItemsTable {
  id: Generated<number>
  name: string
  size?: string
  color?: string
  price: number
  image_url?: string
  is_available?: boolean
  inventory_count?: number
  sku: string
  custom_options?: string
  uuid: string
  created_at?: string
  updated_at?: string


export type ProductItemRead = ProductItemsTable

export type ProductItemWrite = Omit<ProductItemsTable, 'created_at'> & {
  created_at?: string
}

export interface ProductItemResponse {
  data: ProductItemJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface ProductItemJsonResponse extends Omit<Selectable<ProductItemRead>, 'password'> {
  [key: string]: any
}

export type NewProductItem = Insertable<ProductItemWrite>
export type ProductItemUpdate = Updateable<ProductItemWrite>

export interface ProductItemModelType {
  // Properties
  readonly id: number
  get name(): string
  set name(value: string)
  get size(): string | undefined
  set size(value: string)
  get color(): string | undefined
  set color(value: string)
  get price(): number
  set price(value: number)
  get imageUrl(): string | undefined
  set imageUrl(value: string)
  get isAvailable(): boolean | undefined
  set isAvailable(value: boolean)
  get inventoryCount(): number | undefined
  set inventoryCount(value: number)
  get sku(): string
  set sku(value: string)
  get customOptions(): string | undefined
  set customOptions(value: string)
  get uuid(): string | undefined
      set uuid(value: string)
    
    get created_at(): string | undefined
    get updated_at(): string | undefined
    set updated_at(value: string)
  // Static methods
  with: (relations: string[]) => ProductItemModelType
  select: (params: (keyof ProductItemJsonResponse)[] | RawBuilder<string> | string) => ProductItemModelType
  find: (id: number) => Promise<ProductItemModelType | undefined>
  first: () => Promise<ProductItemModelType | undefined>
  last: () => Promise<ProductItemModelType | undefined>
  firstOrFail: () => Promise<ProductItemModelType | undefined>
  all: () => Promise<ProductItemModelType[]>
  findOrFail: (id: number) => Promise<ProductItemModelType | undefined>
  findMany: (ids: number[]) => Promise<ProductItemModelType[]>
  latest: (column?: keyof ProductItemsTable) => Promise<ProductItemModelType | undefined>
  oldest: (column?: keyof ProductItemsTable) => Promise<ProductItemModelType | undefined>
  skip: (count: number) => ProductItemModelType
  take: (count: number) => ProductItemModelType
  where: <V = string>(column: keyof ProductItemsTable, ...args: [V] | [Operator, V]) => ProductItemModelType
  orWhere: (...conditions: [string, any][]) => ProductItemModelType
  whereNotIn: <V = number>(column: keyof ProductItemsTable, values: V[]) => ProductItemModelType
  whereBetween: <V = number>(column: keyof ProductItemsTable, range: [V, V]) => ProductItemModelType
  whereRef: (column: keyof ProductItemsTable, ...args: string[]) => ProductItemModelType
  when: (condition: boolean, callback: (query: ProductItemModelType) => ProductItemModelType) => ProductItemModelType
  whereNull: (column: keyof ProductItemsTable) => ProductItemModelType
  whereNotNull: (column: keyof ProductItemsTable) => ProductItemModelType
  whereLike: (column: keyof ProductItemsTable, value: string) => ProductItemModelType
  orderBy: (column: keyof ProductItemsTable, order: 'asc' | 'desc') => ProductItemModelType
  orderByAsc: (column: keyof ProductItemsTable) => ProductItemModelType
  orderByDesc: (column: keyof ProductItemsTable) => ProductItemModelType
  groupBy: (column: keyof ProductItemsTable) => ProductItemModelType
  having: <V = string>(column: keyof ProductItemsTable, operator: Operator, value: V) => ProductItemModelType
  inRandomOrder: () => ProductItemModelType
  whereColumn: (first: keyof ProductItemsTable, operator: Operator, second: keyof ProductItemsTable) => ProductItemModelType
  max: (field: keyof ProductItemsTable) => Promise<number>
  min: (field: keyof ProductItemsTable) => Promise<number>
  avg: (field: keyof ProductItemsTable) => Promise<number>
  sum: (field: keyof ProductItemsTable) => Promise<number>
  count: () => Promise<number>
  get: () => Promise<ProductItemModelType[]>
  pluck: <K extends keyof ProductItemModelType>(field: K) => Promise<ProductItemModelType[K][]>
  chunk: (size: number, callback: (models: ProductItemModelType[]) => Promise<void>) => Promise<void>
  paginate: (options?: { limit?: number, offset?: number, page?: number }) => Promise<{
    data: ProductItemModelType[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }>
  create: (newProductItem: NewProductItem) => Promise<ProductItemModelType>
  firstOrCreate: (search: Partial<ProductItemsTable>, values?: NewProductItem) => Promise<ProductItemModelType>
  updateOrCreate: (search: Partial<ProductItemsTable>, values?: NewProductItem) => Promise<ProductItemModelType>
  createMany: (newProductItem: NewProductItem[]) => Promise<void>
  forceCreate: (newProductItem: NewProductItem) => Promise<ProductItemModelType>
  remove: (id: number) => Promise<any>
  whereIn: <V = number>(column: keyof ProductItemsTable, values: V[]) => ProductItemModelType
  distinct: (column: keyof ProductItemJsonResponse) => ProductItemModelType
  join: (table: string, firstCol: string, secondCol: string) => ProductItemModelType

  // Instance methods
  createInstance: (data: ProductItemJsonResponse) => ProductItemModelType
  update: (newProductItem: ProductItemUpdate) => Promise<ProductItemModelType | undefined>
  forceUpdate: (newProductItem: ProductItemUpdate) => Promise<ProductItemModelType | undefined>
  save: () => Promise<ProductItemModelType>
  delete: () => Promise<number>
  toSearchableObject: () => Partial<ProductItemJsonResponse>
  toJSON: () => ProductItemJsonResponse
  parseResult: (model: ProductItemModelType) => ProductItemModelType
}