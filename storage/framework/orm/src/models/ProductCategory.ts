import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { ProductModel } from './Product'
import { randomUUIDv7 } from 'bun'
import { cache } from '@stacksjs/cache'
import { sql } from '@stacksjs/database'
import { ModelNotFoundException } from '@stacksjs/error-handling'
import { dispatch } from '@stacksjs/events'
import { BaseOrm, DB, SubqueryBuilder } from '@stacksjs/orm'

export interface ProductCategoriesTable {
  id: Generated<number>
  name: string
  description?: string
  image_url?: string
  is_active?: boolean
  parent_category_id?: string
  display_order: number
  uuid?: string

  created_at?: Date

  updated_at?: Date

}

export interface ProductCategoryResponse {
  data: ProductCategoryJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface ProductCategoryJsonResponse extends Omit<Selectable<ProductCategoriesTable>, 'password'> {
  [key: string]: any
}

export type NewProductCategory = Insertable<ProductCategoriesTable>
export type ProductCategoryUpdate = Updateable<ProductCategoriesTable>

      type SortDirection = 'asc' | 'desc'
interface SortOptions { column: ProductCategoryJsonResponse, order: SortDirection }
// Define a type for the options parameter
interface QueryOptions {
  sort?: SortOptions
  limit?: number
  offset?: number
  page?: number
}

export class ProductCategoryModel extends BaseOrm<ProductCategoryModel, ProductCategoriesTable, ProductCategoryJsonResponse> {
  private readonly hidden: Array<keyof ProductCategoryJsonResponse> = []
  private readonly fillable: Array<keyof ProductCategoryJsonResponse> = ['name', 'description', 'image_url', 'is_active', 'parent_category_id', 'display_order', 'uuid']
  private readonly guarded: Array<keyof ProductCategoryJsonResponse> = []
  protected attributes = {} as ProductCategoryJsonResponse
  protected originalAttributes = {} as ProductCategoryJsonResponse

  protected selectFromQuery: any
  protected updateFromQuery: any
  protected deleteFromQuery: any
  protected hasSelect: boolean
  private hasSaved: boolean
  private customColumns: Record<string, unknown> = {}

  constructor(productCategory: ProductCategoryJsonResponse | undefined) {
    super('product_categories')
    if (productCategory) {
      this.attributes = { ...productCategory }
      this.originalAttributes = { ...productCategory }

      Object.keys(productCategory).forEach((key) => {
        if (!(key in this)) {
          this.customColumns[key] = (productCategory as ProductCategoryJsonResponse)[key]
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

  protected async loadRelations(models: ProductCategoryJsonResponse | ProductCategoryJsonResponse[]): Promise<void> {
    // Handle both single model and array of models
    const modelArray = Array.isArray(models) ? models : [models]
    if (!modelArray.length)
      return

    const modelIds = modelArray.map(model => model.id)

    for (const relation of this.withRelations) {
      const relatedRecords = await DB.instance
        .selectFrom(relation)
        .where('productCategory_id', 'in', modelIds)
        .selectAll()
        .execute()

      if (Array.isArray(models)) {
        models.map((model: ProductCategoryJsonResponse) => {
          const records = relatedRecords.filter((record: { productCategory_id: number }) => {
            return record.productCategory_id === model.id
          })

          model[relation] = records.length === 1 ? records[0] : records
          return model
        })
      }
      else {
        const records = relatedRecords.filter((record: { productCategory_id: number }) => {
          return record.productCategory_id === models.id
        })

        models[relation] = records.length === 1 ? records[0] : records
      }
    }
  }

  static with(relations: string[]): ProductCategoryModel {
    const instance = new ProductCategoryModel(undefined)

    return instance.applyWith(relations)
  }

  protected mapCustomGetters(models: ProductCategoryJsonResponse | ProductCategoryJsonResponse[]): void {
    const data = models

    if (Array.isArray(data)) {
      data.map((model: ProductCategoryJsonResponse) => {
        const customGetter = {
          default: () => {
          },

        }

        for (const [key, fn] of Object.entries(customGetter)) {
          (model as any)[key] = fn()
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
        (model as any)[key] = fn()
      }
    }
  }

  async mapCustomSetters(model: NewProductCategory | ProductCategoryUpdate): Promise<void> {
    const customSetter = {
      default: () => {
      },

    }

    for (const [key, fn] of Object.entries(customSetter)) {
      (model as any)[key] = await fn()
    }
  }

  get products(): ProductModel[] | [] {
    return this.attributes.products
  }

  get id(): number {
    return this.attributes.id
  }

  get uuid(): string | undefined {
    return this.attributes.uuid
  }

  get name(): string {
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

  get display_order(): number {
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

  isDirty(column?: keyof ProductCategoryJsonResponse): boolean {
    if (column) {
      return this.attributes[column] !== this.originalAttributes[column]
    }

    return Object.entries(this.originalAttributes).some(([key, originalValue]) => {
      const currentValue = (this.attributes as any)[key]

      return currentValue !== originalValue
    })
  }

  isClean(column?: keyof ProductCategoryJsonResponse): boolean {
    return !this.isDirty(column)
  }

  wasChanged(column?: keyof ProductCategoryJsonResponse): boolean {
    return this.hasSaved && this.isDirty(column)
  }

  static select(params: (keyof ProductCategoryJsonResponse)[] | RawBuilder<string> | string): ProductCategoryModel {
    const instance = new ProductCategoryModel(undefined)

    return instance.applySelect(params)
  }

  // Method to find a ProductCategory by ID
  static async find(id: number): Promise<ProductCategoryModel | undefined> {
    const instance = new ProductCategoryModel(undefined)

    return await instance.applyFind(id)
  }

  async first(): Promise<ProductCategoryModel | undefined> {
    const model = await this.applyFirst()

    const data = new ProductCategoryModel(model)

    return data
  }

  static async first(): Promise<ProductCategoryModel | undefined> {
    const instance = new ProductCategoryModel(undefined)

    const model = await instance.applyFirst()

    const data = new ProductCategoryModel(model)

    return data
  }

  async applyFirstOrFail(): Promise<ProductCategoryModel | undefined> {
    const model = await this.selectFromQuery.executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, `No ProductCategoryModel results found for query`)

    if (model) {
      this.mapCustomGetters(model)
      await this.loadRelations(model)
    }

    const data = new ProductCategoryModel(model)

    return data
  }

  static async firstOrFail(): Promise<ProductCategoryModel | undefined> {
    const instance = new ProductCategoryModel(undefined)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<ProductCategoryModel[]> {
    const instance = new ProductCategoryModel(undefined)

    const models = await DB.instance.selectFrom('product_categories').selectAll().execute()

    instance.mapCustomGetters(models)

    const data = await Promise.all(models.map(async (model: ProductCategoryJsonResponse) => {
      return new ProductCategoryModel(model)
    }))

    return data
  }

  async applyFindOrFail(id: number): Promise<ProductCategoryModel> {
    const model = await DB.instance.selectFrom('product_categories').where('id', '=', id).selectAll().executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, `No ProductCategoryModel results for ${id}`)

    cache.getOrSet(`productCategory:${id}`, JSON.stringify(model))

    this.mapCustomGetters(model)
    await this.loadRelations(model)

    const data = new ProductCategoryModel(model)

    return data
  }

  async findOrFail(id: number): Promise<ProductCategoryModel> {
    return await this.applyFindOrFail(id)
  }

  static async findOrFail(id: number): Promise<ProductCategoryModel> {
    const instance = new ProductCategoryModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  static async findMany(ids: number[]): Promise<ProductCategoryModel[]> {
    const instance = new ProductCategoryModel(undefined)

    const models = await instance.applyFindMany(ids)

    return models.map((modelItem: UserJsonResponse) => instance.parseResult(new ProductCategoryModel(modelItem)))
  }

  async findMany(ids: number[]): Promise<ProductCategoryModel[]> {
    const models = await this.applyFindMany(ids)

    return models.map((modelItem: UserJsonResponse) => this.parseResult(new ProductCategoryModel(modelItem)))
  }

  static skip(count: number): ProductCategoryModel {
    const instance = new ProductCategoryModel(undefined)

    return instance.applySkip(count)
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
    const instance = new ProductCategoryModel(undefined)

    await instance.applyChunk(size, callback)
  }

  static take(count: number): ProductCategoryModel {
    const instance = new ProductCategoryModel(undefined)

    return instance.applyTake(count)
  }

  static async pluck<K extends keyof ProductCategoryModel>(field: K): Promise<ProductCategoryModel[K][]> {
    const instance = new ProductCategoryModel(undefined)

    if (instance.hasSelect) {
      const model = await instance.selectFromQuery.execute()
      return model.map((modelItem: ProductCategoryModel) => modelItem[field])
    }

    const model = await instance.selectFromQuery.selectAll().execute()

    return model.map((modelItem: ProductCategoryModel) => modelItem[field])
  }

  async pluck<K extends keyof ProductCategoryModel>(field: K): Promise<ProductCategoryModel[K][]> {
    if (this.hasSelect) {
      const model = await this.selectFromQuery.execute()
      return model.map((modelItem: ProductCategoryModel) => modelItem[field])
    }

    const model = await this.selectFromQuery.selectAll().execute()

    return model.map((modelItem: ProductCategoryModel) => modelItem[field])
  }

  static async count(): Promise<number> {
    const instance = new ProductCategoryModel(undefined)

    return instance.applyCount()
  }

  static async max(field: keyof ProductCategoryModel): Promise<number> {
    const instance = new ProductCategoryModel(undefined)

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
    const instance = new ProductCategoryModel(undefined)

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
    const instance = new ProductCategoryModel(undefined)

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
    const instance = new ProductCategoryModel(undefined)

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

    const data = await Promise.all(models.map(async (model: ProductCategoryJsonResponse) => {
      return new ProductCategoryModel(model)
    }))

    return data
  }

  async get(): Promise<ProductCategoryModel[]> {
    return await this.applyGet()
  }

  static async get(): Promise<ProductCategoryModel[]> {
    const instance = new ProductCategoryModel(undefined)

    return await instance.applyGet()
  }

  has(relation: string): ProductCategoryModel {
    this.selectFromQuery = this.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(
        selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.productCategory_id`, '=', 'product_categories.id'),
      ),
    )

    return this
  }

  static has(relation: string): ProductCategoryModel {
    const instance = new ProductCategoryModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(
        selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.productCategory_id`, '=', 'product_categories.id'),
      ),
    )

    return instance
  }

  static whereExists(callback: (qb: any) => any): ProductCategoryModel {
    const instance = new ProductCategoryModel(undefined)

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
          .whereRef(`${relation}.productCategory_id`, '=', 'product_categories.id')

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
    const instance = new ProductCategoryModel(undefined)

    return instance.applyWhereHas(relation, callback)
  }

  applyDoesntHave(relation: string): ProductCategoryModel {
    this.selectFromQuery = this.selectFromQuery.where(({ not, exists, selectFrom }: any) =>
      not(
        exists(
          selectFrom(relation)
            .select('1')
            .whereRef(`${relation}.productCategory_id`, '=', 'product_categories.id'),
        ),
      ),
    )

    return this
  }

  doesntHave(relation: string): ProductCategoryModel {
    return this.applyDoesntHave(relation)
  }

  static doesntHave(relation: string): ProductCategoryModel {
    const instance = new ProductCategoryModel(undefined)

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
          .whereRef(`${relation}.productCategory_id`, '=', 'product_categories.id')

        return not(exists(subquery))
      })

    conditions.forEach((condition) => {
      switch (condition.method) {
        case 'where':
          if (condition.type === 'and') {
            this.where(condition.column, condition.operator!, condition.value || [])
          }
          break

        case 'whereIn':
          if (condition.operator === 'is not') {
            this.whereNotIn(condition.column, condition.values || [])
          }
          else {
            this.whereIn(condition.column, condition.values || [])
          }

          break

        case 'whereNull':
          this.whereNull(condition.column)
          break

        case 'whereNotNull':
          this.whereNotNull(condition.column)
          break

        case 'whereBetween':
          this.whereBetween(condition.column, condition.range || [0, 0])
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
    const instance = new ProductCategoryModel(undefined)

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
    const instance = new ProductCategoryModel(undefined)

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
      dispatch('productCategory:created', model)

    return model
  }

  async create(newProductCategory: NewProductCategory): Promise<ProductCategoryModel> {
    return await this.applyCreate(newProductCategory)
  }

  static async create(newProductCategory: NewProductCategory): Promise<ProductCategoryModel> {
    const instance = new ProductCategoryModel(undefined)

    return await instance.applyCreate(newProductCategory)
  }

  static async createMany(newProductCategory: NewProductCategory[]): Promise<void> {
    const instance = new ProductCategoryModel(undefined)

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
      dispatch('productCategory:created', model)

    return model
  }

  // Method to remove a ProductCategory
  async delete(): Promise<ProductCategoriesTable> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()
    const model = await this.find(Number(this.id))
    if (model)
      dispatch('productCategory:deleted', model)

    return await DB.instance.deleteFrom('product_categories')
      .where('id', '=', this.id)
      .execute()
  }

  static whereName(value: string): ProductCategoryModel {
    const instance = new ProductCategoryModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('name', '=', value)

    return instance
  }

  static whereDescription(value: string): ProductCategoryModel {
    const instance = new ProductCategoryModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('description', '=', value)

    return instance
  }

  static whereImageUrl(value: string): ProductCategoryModel {
    const instance = new ProductCategoryModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('image_url', '=', value)

    return instance
  }

  static whereIsActive(value: string): ProductCategoryModel {
    const instance = new ProductCategoryModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('is_active', '=', value)

    return instance
  }

  static whereParentCategoryId(value: string): ProductCategoryModel {
    const instance = new ProductCategoryModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('parent_category_id', '=', value)

    return instance
  }

  static whereDisplayOrder(value: string): ProductCategoryModel {
    const instance = new ProductCategoryModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('display_order', '=', value)

    return instance
  }

  static whereIn<V = number>(column: keyof ProductCategoriesTable, values: V[]): ProductCategoryModel {
    const instance = new ProductCategoryModel(undefined)

    return instance.applyWhereIn<V>(column, values)
  }

  toSearchableObject(): Partial<ProductCategoryJsonResponse> {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      is_active: this.is_active,
      parent_category_id: this.parent_category_id,
      display_order: this.display_order,
    }
  }

  static distinct(column: keyof ProductCategoryJsonResponse): ProductCategoryModel {
    const instance = new ProductCategoryModel(undefined)

    return instance.applyDistinct(column)
  }

  static join(table: string, firstCol: string, secondCol: string): ProductCategoryModel {
    const instance = new ProductCategoryModel(undefined)

    return instance.applyJoin(table, firstCol, secondCol)
  }

  toJSON(): ProductCategoryJsonResponse {
    const output = {

      uuid: this.uuid,

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
  const results: ProductCategoryJsonResponse = await query.execute()

  return results.map((modelItem: ProductCategoryJsonResponse) => new ProductCategoryModel(modelItem))
}

export async function whereDescription(value: string): Promise<ProductCategoryModel[]> {
  const query = DB.instance.selectFrom('product_categories').where('description', '=', value)
  const results: ProductCategoryJsonResponse = await query.execute()

  return results.map((modelItem: ProductCategoryJsonResponse) => new ProductCategoryModel(modelItem))
}

export async function whereImageUrl(value: string): Promise<ProductCategoryModel[]> {
  const query = DB.instance.selectFrom('product_categories').where('image_url', '=', value)
  const results: ProductCategoryJsonResponse = await query.execute()

  return results.map((modelItem: ProductCategoryJsonResponse) => new ProductCategoryModel(modelItem))
}

export async function whereIsActive(value: boolean): Promise<ProductCategoryModel[]> {
  const query = DB.instance.selectFrom('product_categories').where('is_active', '=', value)
  const results: ProductCategoryJsonResponse = await query.execute()

  return results.map((modelItem: ProductCategoryJsonResponse) => new ProductCategoryModel(modelItem))
}

export async function whereParentCategoryId(value: string): Promise<ProductCategoryModel[]> {
  const query = DB.instance.selectFrom('product_categories').where('parent_category_id', '=', value)
  const results: ProductCategoryJsonResponse = await query.execute()

  return results.map((modelItem: ProductCategoryJsonResponse) => new ProductCategoryModel(modelItem))
}

export async function whereDisplayOrder(value: number): Promise<ProductCategoryModel[]> {
  const query = DB.instance.selectFrom('product_categories').where('display_order', '=', value)
  const results: ProductCategoryJsonResponse = await query.execute()

  return results.map((modelItem: ProductCategoryJsonResponse) => new ProductCategoryModel(modelItem))
}

export const ProductCategory = ProductCategoryModel

export default ProductCategory
