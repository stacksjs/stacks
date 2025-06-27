import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import type { CouponModelType } from './CouponType'
import type { LicenseKeyModelType } from './LicenseKeyType'
import type { ProductUnitModelType } from './ProductUnitType'
import type { ProductVariantModelType } from './ProductVariantType'
import type { ReviewModelType } from './ReviewType'
import type { WaitlistProductModelType } from './WaitlistProductType'

export interface ProductsTable {
  id: Generated<number>
  name: string
  description?: string
  price: number
  image_url?: string
  is_available?: boolean
  inventory_count?: number
  preparation_time: number
  allergens?: string
  nutritional_info?: string
  category_id?: number
  manufacturer_id?: number
  uuid?: string
  created_at?: string
  updated_at?: string
}

export type ProductRead = ProductsTable

export type ProductWrite = Omit<ProductsTable, 'created_at'> & {
  created_at?: string
}

export interface ProductResponse {
  data: ProductJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface ProductJsonResponse extends Omit<Selectable<ProductRead>, 'password'> {
  [key: string]: any
}

export type NewProduct = Insertable<ProductWrite>
export type ProductUpdate = Updateable<ProductWrite>

export interface ProductModelType {
  // Properties
  readonly id: number
  get name(): string
  set name(value: string)
  get description(): string | undefined
  set description(value: string)
  get price(): number
  set price(value: number)
  get imageUrl(): string | undefined
  set imageUrl(value: string)
  get isAvailable(): boolean | undefined
  set isAvailable(value: boolean)
  get inventoryCount(): number | undefined
  set inventoryCount(value: number)
  get preparationTime(): number
  set preparationTime(value: number)
  get allergens(): string | undefined
  set allergens(value: string)
  get nutritionalInfo(): string | undefined
  set nutritionalInfo(value: string)
  get review(): ReviewModelType[] | []
  get product_unit(): ProductUnitModelType[] | []
  get product_variant(): ProductVariantModelType[] | []
  get license_key(): LicenseKeyModelType[] | []
  get waitlist_product(): WaitlistProductModelType[] | []
  get coupon(): CouponModelType[] | []

  categoryBelong: () => Promise<CategoryType>
  manufacturerBelong: () => Promise<ManufacturerType>
  get uuid(): string | undefined
  set uuid(value: string)

  get created_at(): string | undefined
  get updated_at(): string | undefined
  set updated_at(value: string)

  // Static methods
  with: (relations: string[]) => ProductModelType
  select: (params: (keyof ProductJsonResponse)[] | RawBuilder<string> | string) => ProductModelType
  find: (id: number) => Promise<ProductModelType | undefined>
  first: () => Promise<ProductModelType | undefined>
  last: () => Promise<ProductModelType | undefined>
  firstOrFail: () => Promise<ProductModelType | undefined>
  all: () => Promise<ProductModelType[]>
  findOrFail: (id: number) => Promise<ProductModelType | undefined>
  findMany: (ids: number[]) => Promise<ProductModelType[]>
  latest: (column?: keyof ProductsTable) => Promise<ProductModelType | undefined>
  oldest: (column?: keyof ProductsTable) => Promise<ProductModelType | undefined>
  skip: (count: number) => ProductModelType
  take: (count: number) => ProductModelType
  where: <V = string>(column: keyof ProductsTable, ...args: [V] | [Operator, V]) => ProductModelType
  orWhere: (...conditions: [string, any][]) => ProductModelType
  whereNotIn: <V = number>(column: keyof ProductsTable, values: V[]) => ProductModelType
  whereBetween: <V = number>(column: keyof ProductsTable, range: [V, V]) => ProductModelType
  whereRef: (column: keyof ProductsTable, ...args: string[]) => ProductModelType
  when: (condition: boolean, callback: (query: ProductModelType) => ProductModelType) => ProductModelType
  whereNull: (column: keyof ProductsTable) => ProductModelType
  whereNotNull: (column: keyof ProductsTable) => ProductModelType
  whereLike: (column: keyof ProductsTable, value: string) => ProductModelType
  orderBy: (column: keyof ProductsTable, order: 'asc' | 'desc') => ProductModelType
  orderByAsc: (column: keyof ProductsTable) => ProductModelType
  orderByDesc: (column: keyof ProductsTable) => ProductModelType
  groupBy: (column: keyof ProductsTable) => ProductModelType
  having: <V = string>(column: keyof ProductsTable, operator: Operator, value: V) => ProductModelType
  inRandomOrder: () => ProductModelType
  whereColumn: (first: keyof ProductsTable, operator: Operator, second: keyof ProductsTable) => ProductModelType
  max: (field: keyof ProductsTable) => Promise<number>
  min: (field: keyof ProductsTable) => Promise<number>
  avg: (field: keyof ProductsTable) => Promise<number>
  sum: (field: keyof ProductsTable) => Promise<number>
  count: () => Promise<number>
  get: () => Promise<ProductModelType[]>
  pluck: <K extends keyof ProductModelType>(field: K) => Promise<ProductModelType[K][]>
  chunk: (size: number, callback: (models: ProductModelType[]) => Promise<void>) => Promise<void>
  paginate: (options?: { limit?: number, offset?: number, page?: number }) => Promise<{
    data: ProductModelType[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }>
  create: (newProduct: NewProduct) => Promise<ProductModelType>
  firstOrCreate: (search: Partial<ProductsTable>, values?: NewProduct) => Promise<ProductModelType>
  updateOrCreate: (search: Partial<ProductsTable>, values?: NewProduct) => Promise<ProductModelType>
  createMany: (newProduct: NewProduct[]) => Promise<void>
  forceCreate: (newProduct: NewProduct) => Promise<ProductModelType>
  remove: (id: number) => Promise<any>
  whereIn: <V = number>(column: keyof ProductsTable, values: V[]) => ProductModelType
  distinct: (column: keyof ProductJsonResponse) => ProductModelType
  join: (table: string, firstCol: string, secondCol: string) => ProductModelType

  // Instance methods
  createInstance: (data: ProductJsonResponse) => ProductModelType
  update: (newProduct: ProductUpdate) => Promise<ProductModelType | undefined>
  forceUpdate: (newProduct: ProductUpdate) => Promise<ProductModelType | undefined>
  save: () => Promise<ProductModelType>
  delete: () => Promise<number>
  toSearchableObject: () => Partial<ProductJsonResponse>
  toJSON: () => ProductJsonResponse
  parseResult: (model: ProductModelType) => ProductModelType

  categoryBelong: () => Promise<CategoryType>
  manufacturerBelong: () => Promise<ManufacturerType>
}
