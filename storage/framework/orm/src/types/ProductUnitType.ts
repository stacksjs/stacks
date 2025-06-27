import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'

export interface ProductUnitsTable {
  id: Generated<number>
  name: string
  abbreviation: string
  type: string
  description?: string
  is_default?: boolean
  product_id?: number
  uuid?: string
  created_at?: string
  updated_at?: string
}

export type ProductUnitRead = ProductUnitsTable

export type ProductUnitWrite = Omit<ProductUnitsTable, 'created_at'> & {
  created_at?: string
}

export interface ProductUnitResponse {
  data: ProductUnitJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface ProductUnitJsonResponse extends Omit<Selectable<ProductUnitRead>, 'password'> {
  [key: string]: any
}

export type NewProductUnit = Insertable<ProductUnitWrite>
export type ProductUnitUpdate = Updateable<ProductUnitWrite>

export interface ProductUnitModelType {
  // Properties
  readonly id: number
  get name(): string
  set name(value: string)
  get abbreviation(): string
  set abbreviation(value: string)
  get type(): string
  set type(value: string)
  get description(): string | undefined
  set description(value: string)
  get isDefault(): boolean | undefined
  set isDefault(value: boolean)

  productBelong: () => Promise<ProductType>
  get uuid(): string | undefined
  set uuid(value: string)

  get created_at(): string | undefined
  get updated_at(): string | undefined
  set updated_at(value: string)

  // Static methods
  with: (relations: string[]) => ProductUnitModelType
  select: (params: (keyof ProductUnitJsonResponse)[] | RawBuilder<string> | string) => ProductUnitModelType
  find: (id: number) => Promise<ProductUnitModelType | undefined>
  first: () => Promise<ProductUnitModelType | undefined>
  last: () => Promise<ProductUnitModelType | undefined>
  firstOrFail: () => Promise<ProductUnitModelType | undefined>
  all: () => Promise<ProductUnitModelType[]>
  findOrFail: (id: number) => Promise<ProductUnitModelType | undefined>
  findMany: (ids: number[]) => Promise<ProductUnitModelType[]>
  latest: (column?: keyof ProductUnitsTable) => Promise<ProductUnitModelType | undefined>
  oldest: (column?: keyof ProductUnitsTable) => Promise<ProductUnitModelType | undefined>
  skip: (count: number) => ProductUnitModelType
  take: (count: number) => ProductUnitModelType
  where: <V = string>(column: keyof ProductUnitsTable, ...args: [V] | [Operator, V]) => ProductUnitModelType
  orWhere: (...conditions: [string, any][]) => ProductUnitModelType
  whereNotIn: <V = number>(column: keyof ProductUnitsTable, values: V[]) => ProductUnitModelType
  whereBetween: <V = number>(column: keyof ProductUnitsTable, range: [V, V]) => ProductUnitModelType
  whereRef: (column: keyof ProductUnitsTable, ...args: string[]) => ProductUnitModelType
  when: (condition: boolean, callback: (query: ProductUnitModelType) => ProductUnitModelType) => ProductUnitModelType
  whereNull: (column: keyof ProductUnitsTable) => ProductUnitModelType
  whereNotNull: (column: keyof ProductUnitsTable) => ProductUnitModelType
  whereLike: (column: keyof ProductUnitsTable, value: string) => ProductUnitModelType
  orderBy: (column: keyof ProductUnitsTable, order: 'asc' | 'desc') => ProductUnitModelType
  orderByAsc: (column: keyof ProductUnitsTable) => ProductUnitModelType
  orderByDesc: (column: keyof ProductUnitsTable) => ProductUnitModelType
  groupBy: (column: keyof ProductUnitsTable) => ProductUnitModelType
  having: <V = string>(column: keyof ProductUnitsTable, operator: Operator, value: V) => ProductUnitModelType
  inRandomOrder: () => ProductUnitModelType
  whereColumn: (first: keyof ProductUnitsTable, operator: Operator, second: keyof ProductUnitsTable) => ProductUnitModelType
  max: (field: keyof ProductUnitsTable) => Promise<number>
  min: (field: keyof ProductUnitsTable) => Promise<number>
  avg: (field: keyof ProductUnitsTable) => Promise<number>
  sum: (field: keyof ProductUnitsTable) => Promise<number>
  count: () => Promise<number>
  get: () => Promise<ProductUnitModelType[]>
  pluck: <K extends keyof ProductUnitModelType>(field: K) => Promise<ProductUnitModelType[K][]>
  chunk: (size: number, callback: (models: ProductUnitModelType[]) => Promise<void>) => Promise<void>
  paginate: (options?: { limit?: number, offset?: number, page?: number }) => Promise<{
    data: ProductUnitModelType[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }>
  create: (newProductUnit: NewProductUnit) => Promise<ProductUnitModelType>
  firstOrCreate: (search: Partial<ProductUnitsTable>, values?: NewProductUnit) => Promise<ProductUnitModelType>
  updateOrCreate: (search: Partial<ProductUnitsTable>, values?: NewProductUnit) => Promise<ProductUnitModelType>
  createMany: (newProductUnit: NewProductUnit[]) => Promise<void>
  forceCreate: (newProductUnit: NewProductUnit) => Promise<ProductUnitModelType>
  remove: (id: number) => Promise<any>
  whereIn: <V = number>(column: keyof ProductUnitsTable, values: V[]) => ProductUnitModelType
  distinct: (column: keyof ProductUnitJsonResponse) => ProductUnitModelType
  join: (table: string, firstCol: string, secondCol: string) => ProductUnitModelType

  // Instance methods
  createInstance: (data: ProductUnitJsonResponse) => ProductUnitModelType
  update: (newProductUnit: ProductUnitUpdate) => Promise<ProductUnitModelType | undefined>
  forceUpdate: (newProductUnit: ProductUnitUpdate) => Promise<ProductUnitModelType | undefined>
  save: () => Promise<ProductUnitModelType>
  delete: () => Promise<number>
  toSearchableObject: () => Partial<ProductUnitJsonResponse>
  toJSON: () => ProductUnitJsonResponse
  parseResult: (model: ProductUnitModelType) => ProductUnitModelType

  productBelong: () => Promise<ProductType>
}
