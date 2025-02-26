import type { Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import type { ProductModel } from './Product'
import { randomUUIDv7 } from 'bun'
import { cache } from '@stacksjs/cache'
import { sql } from '@stacksjs/database'
import { HttpError, ModelNotFoundException } from '@stacksjs/error-handling'
import { dispatch } from '@stacksjs/events'
import { DB, SubqueryBuilder } from '@stacksjs/orm'

export interface ProductCategoriesTable {
  id?: number
  products?: ProductModel[] | undefined
  name?: string
  description?: string
  image_url?: string
  is_active?: boolean
  parent_category_id?: string
  display_order?: number
  uuid?: string

  created_at?: Date

  updated_at?: Date

}

interface ProductCategoryResponse {
  data: ProductCategoryJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface ProductCategoryJsonResponse extends Omit<ProductCategoriesTable, 'password'> {
  [key: string]: any
}

export type ProductCategoryType = Selectable<ProductCategoriesTable>
export type NewProductCategory = Partial<Insertable<ProductCategoriesTable>>
export type ProductCategoryUpdate = Updateable<ProductCategoriesTable>

      type SortDirection = 'asc' | 'desc'
interface SortOptions { column: ProductCategoryType, order: SortDirection }
// Define a type for the options parameter
interface QueryOptions {
  sort?: SortOptions
  limit?: number
  offset?: number
  page?: number
}

export class ProductCategoryModel {
  private readonly hidden: Array<keyof ProductCategoryJsonResponse> = []
  private readonly fillable: Array<keyof ProductCategoryJsonResponse> = ['name', 'description', 'image_url', 'is_active', 'parent_category_id', 'display_order', 'uuid']
  private readonly guarded: Array<keyof ProductCategoryJsonResponse> = []
  protected attributes: Partial<ProductCategoryJsonResponse> = {}
  protected originalAttributes: Partial<ProductCategoryJsonResponse> = {}

  protected selectFromQuery: any
  protected withRelations: string[]
  protected updateFromQuery: any
  protected deleteFromQuery: any
  protected hasSelect: boolean
  private hasSaved: boolean
  private customColumns: Record<string, unknown> = {}

  constructor(productcategory: Partial<ProductCategoryType> | null) {
    if (productcategory) {
      this.attributes = { ...productcategory }
      this.originalAttributes = { ...productcategory }

      Object.keys(productcategory).forEach((key) => {
        if (!(key in this)) {
          this.customColumns[key] = (productcategory as ProductCategoryJsonResponse)[key]
        }
      })
    }

    this.withRelations = []
    this.selectFromQuery = DB.instance.selectFrom('product_categories')
    this.updateFromQuery = DB.instance.updateTable('product_categories')
    this.deleteFromQuery = DB.instance.deleteFrom('product_categories')
    this.hasSelect = false
    this.hasSaved = false
  }

  mapCustomGetters(models: ProductCategoryJsonResponse | ProductCategoryJsonResponse[]): void {
    const data = models

    if (Array.isArray(data)) {
      data.map((model: ProductCategoryJsonResponse) => {
        const customGetter = {
          default: () => {
          },

        }

        for (const [key, fn] of Object.entries(customGetter)) {
          model[key] = fn()
        }

        return model
      })
    }
    else {
      const model = data

      const customGetter = {
        default: () => {
        },

      }

      for (const [key, fn] of Object.entries(customGetter)) {
        model[key] = fn()
      }
    }
  }

  async mapCustomSetters(model: ProductCategoryJsonResponse): Promise<void> {
    const customSetter = {
      default: () => {
      },

    }

    for (const [key, fn] of Object.entries(customSetter)) {
      model[key] = await fn()
    }
  }

  get products(): ProductModel[] | undefined {
    return this.attributes.products
  }

  get id(): number | undefined {
    return this.attributes.id
  }

  get uuid(): string | undefined {
    return this.attributes.uuid
  }

  get name(): string | undefined {
    return this.attributes.name
  }

  get description(): string | undefined {
    return this.attributes.description
  }

  get image_url(): string | undefined {
    return this.attributes.image_url
  }

  get is_active(): boolean | undefined {
    return this.attributes.is_active
  }

  get parent_category_id(): string | undefined {
    return this.attributes.parent_category_id
  }

  get display_order(): number | undefined {
    return this.attributes.display_order
  }

  get created_at(): Date | undefined {
    return this.attributes.created_at
  }

  get updated_at(): Date | undefined {
    return this.attributes.updated_at
  }

  set uuid(value: string) {
    this.attributes.uuid = value
  }

  set name(value: string) {
    this.attributes.name = value
  }

  set description(value: string) {
    this.attributes.description = value
  }

  set image_url(value: string) {
    this.attributes.image_url = value
  }

  set is_active(value: boolean) {
    this.attributes.is_active = value
  }

  set parent_category_id(value: string) {
    this.attributes.parent_category_id = value
  }

  set display_order(value: number) {
    this.attributes.display_order = value
  }

  set updated_at(value: Date) {
    this.attributes.updated_at = value
  }

  getOriginal(column?: keyof ProductCategoryJsonResponse): Partial<ProductCategoryJsonResponse> {
    if (column) {
      return this.originalAttributes[column]
    }

    return this.originalAttributes
  }

  getChanges(): Partial<ProductCategoryJsonResponse> {
    return this.fillable.reduce<Partial<ProductCategoryJsonResponse>>((changes, key) => {
      const currentValue = this.attributes[key as keyof ProductCategoriesTable]
      const originalValue = this.originalAttributes[key as keyof ProductCategoriesTable]

      if (currentValue !== originalValue) {
        changes[key] = currentValue
      }

      return changes
    }, {})
  }

  isDirty(column?: keyof ProductCategoryType): boolean {
    if (column) {
      return this.attributes[column] !== this.originalAttributes[column]
    }

    return Object.entries(this.originalAttributes).some(([key, originalValue]) => {
      const currentValue = (this.attributes as any)[key]

      return currentValue !== originalValue
    })
  }

  isClean(column?: keyof ProductCategoryType): boolean {
    return !this.isDirty(column)
  }

  wasChanged(column?: keyof ProductCategoryType): boolean {
    return this.hasSaved && this.isDirty(column)
  }

  select(params: (keyof ProductCategoryType)[] | RawBuilder<string> | string): ProductCategoryModel {
    this.selectFromQuery = this.selectFromQuery.select(params)

    this.hasSelect = true

    return this
  }

  static select(params: (keyof ProductCategoryType)[] | RawBuilder<string> | string): ProductCategoryModel {
    const instance = new ProductCategoryModel(null)

    // Initialize a query with the table name and selected fields
    instance.selectFromQuery = instance.selectFromQuery.select(params)

    instance.hasSelect = true

    return instance
  }

  async applyFind(id: number): Promise<ProductCategoryModel | undefined> {
    const model = await DB.instance.selectFrom('product_categories').where('id', '=', id).selectAll().executeTakeFirst()

    if (!model)
      return undefined

    this.mapCustomGetters(model)
    await this.loadRelations(model)

    const data = new ProductCategoryModel(model as ProductCategoryType)

    cache.getOrSet(`productcategory:${id}`, JSON.stringify(model))

    return data
  }

  async find(id: number): Promise<ProductCategoryModel | undefined> {
    return await this.applyFind(id)
  }

  // Method to find a ProductCategory by ID
  static async find(id: number): Promise<ProductCategoryModel | undefined> {
    const instance = new ProductCategoryModel(null)

    return await instance.applyFind(id)
  }

  async first(): Promise<ProductCategoryModel | undefined> {
    let model: ProductCategoryModel | undefined

    if (this.hasSelect) {
      model = await this.selectFromQuery.executeTakeFirst()
    }
    else {
      model = await this.selectFromQuery.selectAll().executeTakeFirst()
    }

    if (model) {
      this.mapCustomGetters(model)
      await this.loadRelations(model)
    }

    const data = new ProductCategoryModel(model as ProductCategoryType)

    return data
  }

  static async first(): Promise<ProductCategoryModel | undefined> {
    const instance = new ProductCategoryModel(null)

    const model = await DB.instance.selectFrom('product_categories')
      .selectAll()
      .executeTakeFirst()

    instance.mapCustomGetters(model)

    const data = new ProductCategoryModel(model as ProductCategoryType)

    return data
  }

  async applyFirstOrFail(): Promise<ProductCategoryModel | undefined> {
    const model = await this.selectFromQuery.executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, 'No ProductCategoryModel results found for query')

    if (model) {
      this.mapCustomGetters(model)
      await this.loadRelations(model)
    }

    const data = new ProductCategoryModel(model as ProductCategoryType)

    return data
  }

  async firstOrFail(): Promise<ProductCategoryModel | undefined> {
    return await this.applyFirstOrFail()
  }

  static async firstOrFail(): Promise<ProductCategoryModel | undefined> {
    const instance = new ProductCategoryModel(null)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<ProductCategoryModel[]> {
    const instance = new ProductCategoryModel(null)

    const models = await DB.instance.selectFrom('product_categories').selectAll().execute()

    instance.mapCustomGetters(models)

    const data = await Promise.all(models.map(async (model: ProductCategoryType) => {
      return new ProductCategoryModel(model)
    }))

    return data
  }

  async applyFindOrFail(id: number): Promise<ProductCategoryModel> {
    const model = await DB.instance.selectFrom('product_categories').where('id', '=', id).selectAll().executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, `No ProductCategoryModel results for ${id}`)

    cache.getOrSet(`productcategory:${id}`, JSON.stringify(model))

    this.mapCustomGetters(model)
    await this.loadRelations(model)

    const data = new ProductCategoryModel(model as ProductCategoryType)

    return data
  }

  async findOrFail(id: number): Promise<ProductCategoryModel> {
    return await this.applyFindOrFail(id)
  }

  static async findOrFail(id: number): Promise<ProductCategoryModel> {
    const instance = new ProductCategoryModel(null)

    return await instance.applyFindOrFail(id)
  }

  async applyFindMany(ids: number[]): Promise<ProductCategoryModel[]> {
    let query = DB.instance.selectFrom('product_categories').where('id', 'in', ids)

    const instance = new ProductCategoryModel(null)

    query = query.selectAll()

    const models = await query.execute()

    instance.mapCustomGetters(models)
    await instance.loadRelations(models)

    return models.map((modelItem: ProductCategoryModel) => instance.parseResult(new ProductCategoryModel(modelItem)))
  }

  static async findMany(ids: number[]): Promise<ProductCategoryModel[]> {
    const instance = new ProductCategoryModel(null)

    return await instance.applyFindMany(ids)
  }

  async findMany(ids: number[]): Promise<ProductCategoryModel[]> {
    return await this.applyFindMany(ids)
  }

  skip(count: number): ProductCategoryModel {
    this.selectFromQuery = this.selectFromQuery.offset(count)

    return this
  }

  static skip(count: number): ProductCategoryModel {
    const instance = new ProductCategoryModel(null)

    instance.selectFromQuery = instance.selectFromQuery.offset(count)

    return instance
  }

  async applyChunk(size: number, callback: (models: ProductCategoryModel[]) => Promise<void>): Promise<void> {
    let page = 1
    let hasMore = true

    while (hasMore) {
      // Get one batch
      const models = await this.selectFromQuery
        .selectAll()
        .limit(size)
        .offset((page - 1) * size)
        .execute()

      // If we got fewer results than chunk size, this is the last batch
      if (models.length < size) {
        hasMore = false
      }

      // Process this batch
      if (models.length > 0) {
        await callback(models)
      }

      page++
    }
  }

  async chunk(size: number, callback: (models: ProductCategoryModel[]) => Promise<void>): Promise<void> {
    await this.applyChunk(size, callback)
  }

  static async chunk(size: number, callback: (models: ProductCategoryModel[]) => Promise<void>): Promise<void> {
    const instance = new ProductCategoryModel(null)

    await instance.applyChunk(size, callback)
  }

  take(count: number): ProductCategoryModel {
    this.selectFromQuery = this.selectFromQuery.limit(count)

    return this
  }

  static take(count: number): ProductCategoryModel {
    const instance = new ProductCategoryModel(null)

    instance.selectFromQuery = instance.selectFromQuery.limit(count)

    return instance
  }

  static async pluck<K extends keyof ProductCategoryModel>(field: K): Promise<ProductCategoryModel[K][]> {
    const instance = new ProductCategoryModel(null)

    if (instance.hasSelect) {
      const model = await instance.selectFromQuery.execute()
      return model.map((modelItem: ProductCategoryModel) => modelItem[field])
    }

    const model = await instance.selectFromQuery.selectAll().execute()

    return model.map((modelItem: ProductCategoryModel) => modelItem[field])
  }

  async pluck<K extends keyof ProductCategoryModel>(field: K): Promise<ProductCategoryModel[K][]> {
    return ProductCategoryModel.pluck(field)
  }

  static async count(): Promise<number> {
    const instance = new ProductCategoryModel(null)

    const result = await instance.selectFromQuery
      .select(sql`COUNT(*) as count`)
      .executeTakeFirst()

    return result.count || 0
  }

  async count(): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`COUNT(*) as count`)
      .executeTakeFirst()

    return result.count || 0
  }

  static async max(field: keyof ProductCategoryModel): Promise<number> {
    const instance = new ProductCategoryModel(null)

    const result = await instance.selectFromQuery
      .select(sql`MAX(${sql.raw(field as string)}) as max `)
      .executeTakeFirst()

    return result.max
  }

  async max(field: keyof ProductCategoryModel): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`MAX(${sql.raw(field as string)}) as max`)
      .executeTakeFirst()

    return result.max
  }

  static async min(field: keyof ProductCategoryModel): Promise<number> {
    const instance = new ProductCategoryModel(null)

    const result = await instance.selectFromQuery
      .select(sql`MIN(${sql.raw(field as string)}) as min `)
      .executeTakeFirst()

    return result.min
  }

  async min(field: keyof ProductCategoryModel): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`MIN(${sql.raw(field as string)}) as min `)
      .executeTakeFirst()

    return result.min
  }

  static async avg(field: keyof ProductCategoryModel): Promise<number> {
    const instance = new ProductCategoryModel(null)

    const result = await instance.selectFromQuery
      .select(sql`AVG(${sql.raw(field as string)}) as avg `)
      .executeTakeFirst()

    return result.avg
  }

  async avg(field: keyof ProductCategoryModel): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`AVG(${sql.raw(field as string)}) as avg `)
      .executeTakeFirst()

    return result.avg
  }

  static async sum(field: keyof ProductCategoryModel): Promise<number> {
    const instance = new ProductCategoryModel(null)

    const result = await instance.selectFromQuery
      .select(sql`SUM(${sql.raw(field as string)}) as sum `)
      .executeTakeFirst()

    return result.sum
  }

  async sum(field: keyof ProductCategoryModel): Promise<number> {
    const result = this.selectFromQuery
      .select(sql`SUM(${sql.raw(field as string)}) as sum `)
      .executeTakeFirst()

    return result.sum
  }

  async applyGet(): Promise<ProductCategoryModel[]> {
    let models

    if (this.hasSelect) {
      models = await this.selectFromQuery.execute()
    }
    else {
      models = await this.selectFromQuery.selectAll().execute()
    }

    this.mapCustomGetters(models)
    await this.loadRelations(models)

    const data = await Promise.all(models.map(async (model: ProductCategoryModel) => {
      return new ProductCategoryModel(model)
    }))

    return data
  }

  async get(): Promise<ProductCategoryModel[]> {
    return await this.applyGet()
  }

  static async get(): Promise<ProductCategoryModel[]> {
    const instance = new ProductCategoryModel(null)

    return await instance.applyGet()
  }

  has(relation: string): ProductCategoryModel {
    this.selectFromQuery = this.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(
        selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.productcategory_id`, '=', 'product_categories.id'),
      ),
    )

    return this
  }

  static has(relation: string): ProductCategoryModel {
    const instance = new ProductCategoryModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(
        selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.productcategory_id`, '=', 'product_categories.id'),
      ),
    )

    return instance
  }

  static whereExists(callback: (qb: any) => any): ProductCategoryModel {
    const instance = new ProductCategoryModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(callback({ exists, selectFrom })),
    )

    return instance
  }

  applyWhereHas(
    relation: string,
    callback: (query: SubqueryBuilder<keyof ProductCategoryModel>) => void,
  ): ProductCategoryModel {
    const subqueryBuilder = new SubqueryBuilder()

    callback(subqueryBuilder)
    const conditions = subqueryBuilder.getConditions()

    this.selectFromQuery = this.selectFromQuery
      .where(({ exists, selectFrom }: any) => {
        let subquery = selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.productcategory_id`, '=', 'product_categories.id')

        conditions.forEach((condition) => {
          switch (condition.method) {
            case 'where':
              if (condition.type === 'and') {
                subquery = subquery.where(condition.column, condition.operator!, condition.value)
              }
              else {
                subquery = subquery.orWhere(condition.column, condition.operator!, condition.value)
              }
              break

            case 'whereIn':
              if (condition.operator === 'is not') {
                subquery = subquery.whereNotIn(condition.column, condition.values)
              }
              else {
                subquery = subquery.whereIn(condition.column, condition.values)
              }

              break

            case 'whereNull':
              subquery = subquery.whereNull(condition.column)
              break

            case 'whereNotNull':
              subquery = subquery.whereNotNull(condition.column)
              break

            case 'whereBetween':
              subquery = subquery.whereBetween(condition.column, condition.values)
              break

            case 'whereExists': {
              const nestedBuilder = new SubqueryBuilder()
              condition.callback!(nestedBuilder)
              break
            }
          }
        })

        return exists(subquery)
      })

    return this
  }

  whereHas(
    relation: string,
    callback: (query: SubqueryBuilder<keyof ProductCategoryModel>) => void,
  ): ProductCategoryModel {
    return this.applyWhereHas(relation, callback)
  }

  static whereHas(
    relation: string,
    callback: (query: SubqueryBuilder<keyof ProductCategoryModel>) => void,
  ): ProductCategoryModel {
    const instance = new ProductCategoryModel(null)

    return instance.applyWhereHas(relation, callback)
  }

  applyDoesntHave(relation: string): ProductCategoryModel {
    this.selectFromQuery = this.selectFromQuery.where(({ not, exists, selectFrom }: any) =>
      not(
        exists(
          selectFrom(relation)
            .select('1')
            .whereRef(`${relation}.productcategory_id`, '=', 'product_categories.id'),
        ),
      ),
    )

    return this
  }

  doesntHave(relation: string): ProductCategoryModel {
    return this.applyDoesntHave(relation)
  }

  static doesntHave(relation: string): ProductCategoryModel {
    const instance = new ProductCategoryModel(null)

    return instance.applyDoesntHave(relation)
  }

  applyWhereDoesntHave(relation: string, callback: (query: SubqueryBuilder<ProductCategoriesTable>) => void): ProductCategoryModel {
    const subqueryBuilder = new SubqueryBuilder()

    callback(subqueryBuilder)
    const conditions = subqueryBuilder.getConditions()

    this.selectFromQuery = this.selectFromQuery
      .where(({ exists, selectFrom, not }: any) => {
        const subquery = selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.productcategory_id`, '=', 'product_categories.id')

        return not(exists(subquery))
      })

    conditions.forEach((condition) => {
      switch (condition.method) {
        case 'where':
          if (condition.type === 'and') {
            this.where(condition.column, condition.operator!, condition.value)
          }
          break

        case 'whereIn':
          if (condition.operator === 'is not') {
            this.whereNotIn(condition.column, condition.values)
          }
          else {
            this.whereIn(condition.column, condition.values)
          }

          break

        case 'whereNull':
          this.whereNull(condition.column)
          break

        case 'whereNotNull':
          this.whereNotNull(condition.column)
          break

        case 'whereBetween':
          this.whereBetween(condition.column, condition.values)
          break

        case 'whereExists': {
          const nestedBuilder = new SubqueryBuilder()
          condition.callback!(nestedBuilder)
          break
        }
      }
    })

    return this
  }

  whereDoesntHave(relation: string, callback: (query: SubqueryBuilder<ProductCategoriesTable>) => void): ProductCategoryModel {
    return this.applyWhereDoesntHave(relation, callback)
  }

  static whereDoesntHave(
    relation: string,
    callback: (query: SubqueryBuilder<ProductCategoriesTable>) => void,
  ): ProductCategoryModel {
    const instance = new ProductCategoryModel(null)

    return instance.applyWhereDoesntHave(relation, callback)
  }

  async applyPaginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<ProductCategoryResponse> {
    const totalRecordsResult = await DB.instance.selectFrom('product_categories')
      .select(DB.instance.fn.count('id').as('total')) // Use 'id' or another actual column name
      .executeTakeFirst()

    const totalRecords = Number(totalRecordsResult?.total) || 0
    const totalPages = Math.ceil(totalRecords / (options.limit ?? 10))

    const product_categoriesWithExtra = await DB.instance.selectFrom('product_categories')
      .selectAll()
      .orderBy('id', 'asc') // Assuming 'id' is used for cursor-based pagination
      .limit((options.limit ?? 10) + 1) // Fetch one extra record
      .offset(((options.page ?? 1) - 1) * (options.limit ?? 10)) // Ensure options.page is not undefined
      .execute()

    let nextCursor = null
    if (product_categoriesWithExtra.length > (options.limit ?? 10))
      nextCursor = product_categoriesWithExtra.pop()?.id ?? null

    return {
      data: product_categoriesWithExtra,
      paging: {
        total_records: totalRecords,
        page: options.page || 1,
        total_pages: totalPages,
      },
      next_cursor: nextCursor,
    }
  }

  async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<ProductCategoryResponse> {
    return await this.applyPaginate(options)
  }

  // Method to get all product_categories
  static async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<ProductCategoryResponse> {
    const instance = new ProductCategoryModel(null)

    return await instance.applyPaginate(options)
  }

  async applyCreate(newProductCategory: NewProductCategory): Promise<ProductCategoryModel> {
    const filteredValues = Object.fromEntries(
      Object.entries(newProductCategory).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewProductCategory

    await this.mapCustomSetters(filteredValues)

    filteredValues.uuid = randomUUIDv7()

    const result = await DB.instance.insertInto('product_categories')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await this.find(Number(result.numInsertedOrUpdatedRows)) as ProductCategoryModel

    if (model)
      dispatch('productcategory:created', model)

    return model
  }

  async create(newProductCategory: NewProductCategory): Promise<ProductCategoryModel> {
    return await this.applyCreate(newProductCategory)
  }

  static async create(newProductCategory: NewProductCategory): Promise<ProductCategoryModel> {
    const instance = new ProductCategoryModel(null)

    return await instance.applyCreate(newProductCategory)
  }

  static async createMany(newProductCategory: NewProductCategory[]): Promise<void> {
    const instance = new ProductCategoryModel(null)

    const valuesFiltered = newProductCategory.map((newProductCategory: NewProductCategory) => {
      const filteredValues = Object.fromEntries(
        Object.entries(newProductCategory).filter(([key]) =>
          !instance.guarded.includes(key) && instance.fillable.includes(key),
        ),
      ) as NewProductCategory

      filteredValues.uuid = randomUUIDv7()

      return filteredValues
    })

    await DB.instance.insertInto('product_categories')
      .values(valuesFiltered)
      .executeTakeFirst()
  }

  static async forceCreate(newProductCategory: NewProductCategory): Promise<ProductCategoryModel> {
    const result = await DB.instance.insertInto('product_categories')
      .values(newProductCategory)
      .executeTakeFirst()

    const model = await find(Number(result.numInsertedOrUpdatedRows)) as ProductCategoryModel

    if (model)
      dispatch('productcategory:created', model)

    return model
  }

  // Method to remove a ProductCategory
  static async remove(id: number): Promise<any> {
    const instance = new ProductCategoryModel(null)

    const model = await instance.find(Number(id))

    if (model)
      dispatch('productcategory:deleted', model)

    return await DB.instance.deleteFrom('product_categories')
      .where('id', '=', id)
      .execute()
  }

  applyWhere<V>(column: keyof UsersTable, ...args: [V] | [Operator, V]): UserModel {
    if (args.length === 1) {
      const [value] = args
      this.selectFromQuery = this.selectFromQuery.where(column, '=', value)
      this.updateFromQuery = this.updateFromQuery.where(column, '=', value)
      this.deleteFromQuery = this.deleteFromQuery.where(column, '=', value)
    }
    else {
      const [operator, value] = args as [Operator, V]
      this.selectFromQuery = this.selectFromQuery.where(column, operator, value)
      this.updateFromQuery = this.updateFromQuery.where(column, operator, value)
      this.deleteFromQuery = this.deleteFromQuery.where(column, operator, value)
    }

    return this
  }

  where<V = string>(column: keyof ProductCategoriesTable, ...args: [V] | [Operator, V]): ProductCategoryModel {
    return this.applyWhere<V>(column, ...args)
  }

  static where<V = string>(column: keyof ProductCategoriesTable, ...args: [V] | [Operator, V]): ProductCategoryModel {
    const instance = new ProductCategoryModel(null)

    return instance.applyWhere<V>(column, ...args)
  }

  whereColumn(first: keyof ProductCategoriesTable, operator: Operator, second: keyof ProductCategoriesTable): ProductCategoryModel {
    this.selectFromQuery = this.selectFromQuery.whereRef(first, operator, second)

    return this
  }

  static whereColumn(first: keyof ProductCategoriesTable, operator: Operator, second: keyof ProductCategoriesTable): ProductCategoryModel {
    const instance = new ProductCategoryModel(null)

    instance.selectFromQuery = instance.selectFromQuery.whereRef(first, operator, second)

    return instance
  }

  applyWhereRef(column: keyof ProductCategoriesTable, ...args: string[]): ProductCategoryModel {
    const [operatorOrValue, value] = args
    const operator = value === undefined ? '=' : operatorOrValue
    const actualValue = value === undefined ? operatorOrValue : value

    const instance = new ProductCategoryModel(null)
    instance.selectFromQuery = instance.selectFromQuery.whereRef(column, operator, actualValue)

    return instance
  }

  whereRef(column: keyof ProductCategoriesTable, ...args: string[]): ProductCategoryModel {
    return this.applyWhereRef(column, ...args)
  }

  static whereRef(column: keyof ProductCategoriesTable, ...args: string[]): ProductCategoryModel {
    const instance = new ProductCategoryModel(null)

    return instance.applyWhereRef(column, ...args)
  }

  whereRaw(sqlStatement: string): ProductCategoryModel {
    this.selectFromQuery = this.selectFromQuery.where(sql`${sqlStatement}`)

    return this
  }

  static whereRaw(sqlStatement: string): ProductCategoryModel {
    const instance = new ProductCategoryModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where(sql`${sqlStatement}`)

    return instance
  }

  applyOrWhere(...conditions: [string, any][]): ProductCategoryModel {
    this.selectFromQuery = this.selectFromQuery.where((eb: any) => {
      return eb.or(
        conditions.map(([column, value]) => eb(column, '=', value)),
      )
    })

    this.updateFromQuery = this.updateFromQuery.where((eb: any) => {
      return eb.or(
        conditions.map(([column, value]) => eb(column, '=', value)),
      )
    })

    this.deleteFromQuery = this.deleteFromQuery.where((eb: any) => {
      return eb.or(
        conditions.map(([column, value]) => eb(column, '=', value)),
      )
    })

    return this
  }

  orWhere(...conditions: [string, any][]): ProductCategoryModel {
    return this.applyOrWhere(...conditions)
  }

  static orWhere(...conditions: [string, any][]): ProductCategoryModel {
    const instance = new ProductCategoryModel(null)

    return instance.applyOrWhere(...conditions)
  }

  when(
    condition: boolean,
    callback: (query: ProductCategoryModel) => ProductCategoryModel,
  ): ProductCategoryModel {
    return ProductCategoryModel.when(condition, callback)
  }

  static when(
    condition: boolean,
    callback: (query: ProductCategoryModel) => ProductCategoryModel,
  ): ProductCategoryModel {
    let instance = new ProductCategoryModel(null)

    if (condition)
      instance = callback(instance)

    return instance
  }

  whereNotNull(column: keyof ProductCategoriesTable): ProductCategoryModel {
    this.selectFromQuery = this.selectFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is not', null),
    )

    this.updateFromQuery = this.updateFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is not', null),
    )

    this.deleteFromQuery = this.deleteFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is not', null),
    )

    return this
  }

  static whereNotNull(column: keyof ProductCategoriesTable): ProductCategoryModel {
    const instance = new ProductCategoryModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is not', null),
    )

    instance.updateFromQuery = instance.updateFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is not', null),
    )

    instance.deleteFromQuery = instance.deleteFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is not', null),
    )

    return instance
  }

  whereNull(column: keyof ProductCategoriesTable): ProductCategoryModel {
    this.selectFromQuery = this.selectFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    this.updateFromQuery = this.updateFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    this.deleteFromQuery = this.deleteFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    return this
  }

  static whereNull(column: keyof ProductCategoriesTable): ProductCategoryModel {
    const instance = new ProductCategoryModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    instance.updateFromQuery = instance.updateFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    instance.deleteFromQuery = instance.deleteFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    return instance
  }

  static whereName(value: string): ProductCategoryModel {
    const instance = new ProductCategoryModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('name', '=', value)

    return instance
  }

  static whereDescription(value: string): ProductCategoryModel {
    const instance = new ProductCategoryModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('description', '=', value)

    return instance
  }

  static whereImageUrl(value: string): ProductCategoryModel {
    const instance = new ProductCategoryModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('image_url', '=', value)

    return instance
  }

  static whereIsActive(value: string): ProductCategoryModel {
    const instance = new ProductCategoryModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('is_active', '=', value)

    return instance
  }

  static whereParentCategoryId(value: string): ProductCategoryModel {
    const instance = new ProductCategoryModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('parent_category_id', '=', value)

    return instance
  }

  static whereDisplayOrder(value: string): ProductCategoryModel {
    const instance = new ProductCategoryModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('display_order', '=', value)

    return instance
  }

  applyWhereIn<V>(column: keyof ProductCategoriesTable, values: V[]) {
    this.selectFromQuery = this.selectFromQuery.where(column, 'in', values)

    this.updateFromQuery = this.updateFromQuery.where(column, 'in', values)

    this.deleteFromQuery = this.deleteFromQuery.where(column, 'in', values)

    return this
  }

  whereIn<V = number>(column: keyof ProductCategoriesTable, values: V[]): ProductCategoryModel {
    return this.applyWhereIn<V>(column, values)
  }

  static whereIn<V = number>(column: keyof ProductCategoriesTable, values: V[]): ProductCategoryModel {
    const instance = new ProductCategoryModel(null)

    return instance.applyWhereIn<V>(column, values)
  }

  applyWhereBetween<V>(column: keyof ProductCategoriesTable, range: [V, V]): ProductCategoryModel {
    if (range.length !== 2) {
      throw new HttpError(500, 'Range must have exactly two values: [min, max]')
    }

    const query = sql` ${sql.raw(column as string)} between ${range[0]} and ${range[1]} `

    this.selectFromQuery = this.selectFromQuery.where(query)
    this.updateFromQuery = this.updateFromQuery.where(query)
    this.deleteFromQuery = this.deleteFromQuery.where(query)

    return this
  }

  whereBetween<V = number>(column: keyof ProductCategoriesTable, range: [V, V]): ProductCategoryModel {
    return this.applyWhereBetween<V>(column, range)
  }

  static whereBetween<V = number>(column: keyof ProductCategoriesTable, range: [V, V]): ProductCategoryModel {
    const instance = new ProductCategoryModel(null)

    return instance.applyWhereBetween<V>(column, range)
  }

  applyWhereLike(column: keyof ProductCategoriesTable, value: string): ProductCategoryModel {
    this.selectFromQuery = this.selectFromQuery.where(sql` ${sql.raw(column as string)} LIKE ${value}`)

    this.updateFromQuery = this.updateFromQuery.where(sql` ${sql.raw(column as string)} LIKE ${value}`)

    this.deleteFromQuery = this.deleteFromQuery.where(sql` ${sql.raw(column as string)} LIKE ${value}`)

    return this
  }

  whereLike(column: keyof ProductCategoriesTable, value: string): ProductCategoryModel {
    return this.applyWhereLike(column, value)
  }

  static whereLike(column: keyof ProductCategoriesTable, value: string): ProductCategoryModel {
    const instance = new ProductCategoryModel(null)

    return instance.applyWhereLike(column, value)
  }

  applyWhereNotIn<V>(column: keyof ProductCategoriesTable, values: V[]): ProductCategoryModel {
    this.selectFromQuery = this.selectFromQuery.where(column, 'not in', values)

    this.updateFromQuery = this.updateFromQuery.where(column, 'not in', values)

    this.deleteFromQuery = this.deleteFromQuery.where(column, 'not in', values)

    return this
  }

  whereNotIn<V>(column: keyof ProductCategoriesTable, values: V[]): ProductCategoryModel {
    return this.applyWhereNotIn<V>(column, values)
  }

  static whereNotIn<V = number>(column: keyof ProductCategoriesTable, values: V[]): ProductCategoryModel {
    const instance = new ProductCategoryModel(null)

    return instance.applyWhereNotIn<V>(column, values)
  }

  async exists(): Promise<boolean> {
    let model

    if (this.hasSelect) {
      model = await this.selectFromQuery.executeTakeFirst()
    }
    else {
      model = await this.selectFromQuery.selectAll().executeTakeFirst()
    }

    return model !== null && model !== undefined
  }

  static async latest(): Promise<ProductCategoryType | undefined> {
    const instance = new ProductCategoryModel(null)

    const model = await DB.instance.selectFrom('product_categories')
      .selectAll()
      .orderBy('id', 'desc')
      .executeTakeFirst()

    if (!model)
      return undefined

    instance.mapCustomGetters(model)

    const data = new ProductCategoryModel(model as ProductCategoryType)

    return data
  }

  static async oldest(): Promise<ProductCategoryType | undefined> {
    const instance = new ProductCategoryModel(null)

    const model = await DB.instance.selectFrom('product_categories')
      .selectAll()
      .orderBy('id', 'asc')
      .executeTakeFirst()

    if (!model)
      return undefined

    instance.mapCustomGetters(model)

    const data = new ProductCategoryModel(model as ProductCategoryType)

    return data
  }

  static async firstOrCreate(
    condition: Partial<ProductCategoryType>,
    newProductCategory: NewProductCategory,
  ): Promise<ProductCategoryModel> {
    const instance = new ProductCategoryModel(null)

    const key = Object.keys(condition)[0] as keyof ProductCategoryType

    if (!key) {
      throw new HttpError(500, 'Condition must contain at least one key-value pair')
    }

    const value = condition[key]

    // Attempt to find the first record matching the condition
    const existingProductCategory = await DB.instance.selectFrom('product_categories')
      .selectAll()
      .where(key, '=', value)
      .executeTakeFirst()

    if (existingProductCategory) {
      instance.mapCustomGetters(existingProductCategory)
      await instance.loadRelations(existingProductCategory)

      return new ProductCategoryModel(existingProductCategory as ProductCategoryType)
    }
    else {
      return await instance.create(newProductCategory)
    }
  }

  static async updateOrCreate(
    condition: Partial<ProductCategoryType>,
    newProductCategory: NewProductCategory,
  ): Promise<ProductCategoryModel> {
    const instance = new ProductCategoryModel(null)

    const key = Object.keys(condition)[0] as keyof ProductCategoryType

    if (!key) {
      throw new HttpError(500, 'Condition must contain at least one key-value pair')
    }

    const value = condition[key]

    // Attempt to find the first record matching the condition
    const existingProductCategory = await DB.instance.selectFrom('product_categories')
      .selectAll()
      .where(key, '=', value)
      .executeTakeFirst()

    if (existingProductCategory) {
      // If found, update the existing record
      await DB.instance.updateTable('product_categories')
        .set(newProductCategory)
        .where(key, '=', value)
        .executeTakeFirstOrThrow()

      // Fetch and return the updated record
      const updatedProductCategory = await DB.instance.selectFrom('product_categories')
        .selectAll()
        .where(key, '=', value)
        .executeTakeFirst()

      if (!updatedProductCategory) {
        throw new HttpError(500, 'Failed to fetch updated record')
      }

      instance.hasSaved = true

      return new ProductCategoryModel(updatedProductCategory as ProductCategoryType)
    }
    else {
      // If not found, create a new record
      return await instance.create(newProductCategory)
    }
  }

  async loadRelations(models: ProductCategoryJsonResponse | ProductCategoryJsonResponse[]): Promise<void> {
    // Handle both single model and array of models
    const modelArray = Array.isArray(models) ? models : [models]
    if (!modelArray.length)
      return

    const modelIds = modelArray.map(model => model.id)

    for (const relation of this.withRelations) {
      const relatedRecords = await DB.instance
        .selectFrom(relation)
        .where('productcategory_id', 'in', modelIds)
        .selectAll()
        .execute()

      if (Array.isArray(models)) {
        models.map((model: ProductCategoryJsonResponse) => {
          const records = relatedRecords.filter((record: { productcategory_id: number }) => {
            return record.productcategory_id === model.id
          })

          model[relation] = records.length === 1 ? records[0] : records
          return model
        })
      }
      else {
        const records = relatedRecords.filter((record: { productcategory_id: number }) => {
          return record.productcategory_id === models.id
        })

        models[relation] = records.length === 1 ? records[0] : records
      }
    }
  }

  with(relations: string[]): ProductCategoryModel {
    this.withRelations = relations

    return this
  }

  static with(relations: string[]): ProductCategoryModel {
    const instance = new ProductCategoryModel(null)

    instance.withRelations = relations

    return instance
  }

  async last(): Promise<ProductCategoryType | undefined> {
    let model: ProductCategoryModel | undefined

    if (this.hasSelect) {
      model = await this.selectFromQuery.executeTakeFirst()
    }
    else {
      model = await this.selectFromQuery.selectAll().orderBy('id', 'desc').executeTakeFirst()
    }

    if (model) {
      this.mapCustomGetters(model)
      await this.loadRelations(model)
    }

    const data = new ProductCategoryModel(model as ProductCategoryType)

    return data
  }

  static async last(): Promise<ProductCategoryType | undefined> {
    const model = await DB.instance.selectFrom('product_categories').selectAll().orderBy('id', 'desc').executeTakeFirst()

    if (!model)
      return undefined

    const data = new ProductCategoryModel(model as ProductCategoryType)

    return data
  }

  orderBy(column: keyof ProductCategoriesTable, order: 'asc' | 'desc'): ProductCategoryModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, order)

    return this
  }

  static orderBy(column: keyof ProductCategoriesTable, order: 'asc' | 'desc'): ProductCategoryModel {
    const instance = new ProductCategoryModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, order)

    return instance
  }

  groupBy(column: keyof ProductCategoriesTable): ProductCategoryModel {
    this.selectFromQuery = this.selectFromQuery.groupBy(column)

    return this
  }

  static groupBy(column: keyof ProductCategoriesTable): ProductCategoryModel {
    const instance = new ProductCategoryModel(null)

    instance.selectFromQuery = instance.selectFromQuery.groupBy(column)

    return instance
  }

  having<V = string>(column: keyof ProductCategoriesTable, operator: Operator, value: V): ProductCategoryModel {
    this.selectFromQuery = this.selectFromQuery.having(column, operator, value)

    return this
  }

  static having<V = string>(column: keyof ProductCategoriesTable, operator: Operator, value: V): ProductCategoryModel {
    const instance = new ProductCategoryModel(null)

    instance.selectFromQuery = instance.selectFromQuery.having(column, operator, value)

    return instance
  }

  inRandomOrder(): ProductCategoryModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(sql` ${sql.raw('RANDOM()')} `)

    return this
  }

  static inRandomOrder(): ProductCategoryModel {
    const instance = new ProductCategoryModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(sql` ${sql.raw('RANDOM()')} `)

    return instance
  }

  orderByDesc(column: keyof ProductCategoriesTable): ProductCategoryModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, 'desc')

    return this
  }

  static orderByDesc(column: keyof ProductCategoriesTable): ProductCategoryModel {
    const instance = new ProductCategoryModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, 'desc')

    return instance
  }

  orderByAsc(column: keyof ProductCategoriesTable): ProductCategoryModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, 'asc')

    return this
  }

  static orderByAsc(column: keyof ProductCategoriesTable): ProductCategoryModel {
    const instance = new ProductCategoryModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, 'asc')

    return instance
  }

  async update(newProductCategory: ProductCategoryUpdate): Promise<ProductCategoryModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newProductCategory).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewProductCategory

    await this.mapCustomSetters(filteredValues)

    await DB.instance.updateTable('product_categories')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      const model = await this.find(this.id)

      if (model)
        dispatch('productcategory:updated', model)

      return model
    }

    this.hasSaved = true

    return undefined
  }

  async forceUpdate(productcategory: ProductCategoryUpdate): Promise<ProductCategoryModel | undefined> {
    if (this.id === undefined) {
      this.updateFromQuery.set(productcategory).execute()
    }

    await this.mapCustomSetters(productcategory)

    await DB.instance.updateTable('product_categories')
      .set(productcategory)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      const model = await this.find(this.id)

      if (model)
        dispatch('productcategory:updated', model)

      this.hasSaved = true

      return model
    }

    return undefined
  }

  async save(): Promise<void> {
    if (!this)
      throw new HttpError(500, 'ProductCategory data is undefined')

    await this.mapCustomSetters(this.attributes)

    if (this.id === undefined) {
      await this.create(this.attributes)
    }
    else {
      await this.update(this.attributes)
    }

    this.hasSaved = true
  }

  fill(data: Partial<ProductCategoryType>): ProductCategoryModel {
    const filteredValues = Object.fromEntries(
      Object.entries(data).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewProductCategory

    this.attributes = {
      ...this.attributes,
      ...filteredValues,
    }

    return this
  }

  forceFill(data: Partial<ProductCategoryType>): ProductCategoryModel {
    this.attributes = {
      ...this.attributes,
      ...data,
    }

    return this
  }

  // Method to delete (soft delete) the productcategory instance
  async delete(): Promise<ProductCategoriesTable> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()
    const model = await this.find(Number(this.id))
    if (model)
      dispatch('productcategory:deleted', model)

    return await DB.instance.deleteFrom('product_categories')
      .where('id', '=', this.id)
      .execute()
  }

  toSearchableObject(): Partial<ProductCategoriesTable> {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      is_active: this.is_active,
      parent_category_id: this.parent_category_id,
      display_order: this.display_order,
    }
  }

  distinct(column: keyof ProductCategoryType): ProductCategoryModel {
    this.selectFromQuery = this.selectFromQuery.select(column).distinct()

    this.hasSelect = true

    return this
  }

  static distinct(column: keyof ProductCategoryType): ProductCategoryModel {
    const instance = new ProductCategoryModel(null)

    instance.selectFromQuery = instance.selectFromQuery.select(column).distinct()

    instance.hasSelect = true

    return instance
  }

  join(table: string, firstCol: string, secondCol: string): ProductCategoryModel {
    this.selectFromQuery = this.selectFromQuery.innerJoin(table, firstCol, secondCol)

    return this
  }

  static join(table: string, firstCol: string, secondCol: string): ProductCategoryModel {
    const instance = new ProductCategoryModel(null)

    instance.selectFromQuery = instance.selectFromQuery.innerJoin(table, firstCol, secondCol)

    return instance
  }

  toJSON(): Partial<ProductCategoryJsonResponse> {
    const output: Partial<ProductCategoryJsonResponse> = {

      id: this.id,
      name: this.name,
      description: this.description,
      image_url: this.image_url,
      is_active: this.is_active,
      parent_category_id: this.parent_category_id,
      display_order: this.display_order,

      created_at: this.created_at,

      updated_at: this.updated_at,

      products: this.products,
      ...this.customColumns,
    }

    return output
  }

  parseResult(model: ProductCategoryModel): ProductCategoryModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof ProductCategoryModel]
    }

    return model
  }
}

async function find(id: number): Promise<ProductCategoryModel | undefined> {
  const query = DB.instance.selectFrom('product_categories').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  return new ProductCategoryModel(model)
}

export async function count(): Promise<number> {
  const results = await ProductCategoryModel.count()

  return results
}

export async function create(newProductCategory: NewProductCategory): Promise<ProductCategoryModel> {
  const result = await DB.instance.insertInto('product_categories')
    .values(newProductCategory)
    .executeTakeFirstOrThrow()

  return await find(Number(result.numInsertedOrUpdatedRows)) as ProductCategoryModel
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(DB.instance)
}

export async function remove(id: number): Promise<void> {
  await DB.instance.deleteFrom('product_categories')
    .where('id', '=', id)
    .execute()
}

export async function whereName(value: string): Promise<ProductCategoryModel[]> {
  const query = DB.instance.selectFrom('product_categories').where('name', '=', value)
  const results = await query.execute()

  return results.map((modelItem: ProductCategoryModel) => new ProductCategoryModel(modelItem))
}

export async function whereDescription(value: string): Promise<ProductCategoryModel[]> {
  const query = DB.instance.selectFrom('product_categories').where('description', '=', value)
  const results = await query.execute()

  return results.map((modelItem: ProductCategoryModel) => new ProductCategoryModel(modelItem))
}

export async function whereImageUrl(value: string): Promise<ProductCategoryModel[]> {
  const query = DB.instance.selectFrom('product_categories').where('image_url', '=', value)
  const results = await query.execute()

  return results.map((modelItem: ProductCategoryModel) => new ProductCategoryModel(modelItem))
}

export async function whereIsActive(value: boolean): Promise<ProductCategoryModel[]> {
  const query = DB.instance.selectFrom('product_categories').where('is_active', '=', value)
  const results = await query.execute()

  return results.map((modelItem: ProductCategoryModel) => new ProductCategoryModel(modelItem))
}

export async function whereParentCategoryId(value: string): Promise<ProductCategoryModel[]> {
  const query = DB.instance.selectFrom('product_categories').where('parent_category_id', '=', value)
  const results = await query.execute()

  return results.map((modelItem: ProductCategoryModel) => new ProductCategoryModel(modelItem))
}

export async function whereDisplayOrder(value: number): Promise<ProductCategoryModel[]> {
  const query = DB.instance.selectFrom('product_categories').where('display_order', '=', value)
  const results = await query.execute()

  return results.map((modelItem: ProductCategoryModel) => new ProductCategoryModel(modelItem))
}

export const ProductCategory = ProductCategoryModel

export default ProductCategory
