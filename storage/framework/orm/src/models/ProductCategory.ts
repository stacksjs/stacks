import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import type { ProductModel } from './Product'
import { randomUUIDv7 } from 'bun'
import { sql } from '@stacksjs/database'
import { HttpError } from '@stacksjs/error-handling'
import { dispatch } from '@stacksjs/events'
import { BaseOrm, DB } from '@stacksjs/orm'

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

  /**
   * This model inherits many query methods from BaseOrm:
   * - pluck, chunk, whereExists, has, doesntHave, whereHas, whereDoesntHave
   * - inRandomOrder, max, min, avg, paginate, get, and more
   *
   * See BaseOrm class for the full list of inherited methods.
   */

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

  static select(params: (keyof ProductCategoryJsonResponse)[] | RawBuilder<string> | string): ProductCategoryModel {
    const instance = new ProductCategoryModel(undefined)

    return instance.applySelect(params)
  }

  // Method to find a ProductCategory by ID
  static async find(id: number): Promise<ProductCategoryModel | undefined> {
    const query = DB.instance.selectFrom('product_categories').where('id', '=', id).selectAll()

    const model = await query.executeTakeFirst()

    if (!model)
      return undefined

    const instance = new ProductCategoryModel(undefined)
    return instance.createInstance(model)
  }

  static async first(): Promise<ProductCategoryModel | undefined> {
    const instance = new ProductCategoryModel(undefined)

    const model = await instance.applyFirst()

    const data = new ProductCategoryModel(model)

    return data
  }

  static async last(): Promise<ProductCategoryModel | undefined> {
    const instance = new ProductCategoryModel(undefined)

    const model = await instance.applyLast()

    if (!model)
      return undefined

    return new ProductCategoryModel(model)
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

  static async findOrFail(id: number): Promise<ProductCategoryModel | undefined> {
    const instance = new ProductCategoryModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  static async findMany(ids: number[]): Promise<ProductCategoryModel[]> {
    const instance = new ProductCategoryModel(undefined)

    const models = await instance.applyFindMany(ids)

    return models.map((modelItem: ProductCategoryJsonResponse) => instance.parseResult(new ProductCategoryModel(modelItem)))
  }

  static async latest(column: keyof ProductCategoriesTable = 'created_at'): Promise<ProductCategoryModel | undefined> {
    const instance = new ProductCategoryModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'desc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new ProductCategoryModel(model)
  }

  static async oldest(column: keyof ProductCategoriesTable = 'created_at'): Promise<ProductCategoryModel | undefined> {
    const instance = new ProductCategoryModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'asc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new ProductCategoryModel(model)
  }

  static skip(count: number): ProductCategoryModel {
    const instance = new ProductCategoryModel(undefined)

    return instance.applySkip(count)
  }

  static take(count: number): ProductCategoryModel {
    const instance = new ProductCategoryModel(undefined)

    return instance.applyTake(count)
  }

  static where<V = string>(column: keyof ProductCategoriesTable, ...args: [V] | [Operator, V]): ProductCategoryModel {
    const instance = new ProductCategoryModel(undefined)

    return instance.applyWhere<V>(column, ...args)
  }

  static orWhere(...conditions: [string, any][]): ProductCategoryModel {
    const instance = new ProductCategoryModel(undefined)

    return instance.applyOrWhere(...conditions)
  }

  static whereNotIn<V = number>(column: keyof ProductCategoriesTable, values: V[]): ProductCategoryModel {
    const instance = new ProductCategoryModel(undefined)

    return instance.applyWhereNotIn<V>(column, values)
  }

  static whereBetween<V = number>(column: keyof ProductCategoriesTable, range: [V, V]): ProductCategoryModel {
    const instance = new ProductCategoryModel(undefined)

    return instance.applyWhereBetween<V>(column, range)
  }

  static whereRef(column: keyof ProductCategoriesTable, ...args: string[]): ProductCategoryModel {
    const instance = new ProductCategoryModel(undefined)

    return instance.applyWhereRef(column, ...args)
  }

  static when(condition: boolean, callback: (query: ProductCategoryModel) => ProductCategoryModel): ProductCategoryModel {
    const instance = new ProductCategoryModel(undefined)

    return instance.applyWhen(condition, callback as any)
  }

  static whereNull(column: keyof ProductCategoriesTable): ProductCategoryModel {
    const instance = new ProductCategoryModel(undefined)

    return instance.applyWhereNull(column)
  }

  static whereNotNull(column: keyof ProductCategoriesTable): ProductCategoryModel {
    const instance = new ProductCategoryModel(undefined)

    return instance.applyWhereNotNull(column)
  }

  static whereLike(column: keyof ProductCategoriesTable, value: string): ProductCategoryModel {
    const instance = new ProductCategoryModel(undefined)

    return instance.applyWhereLike(column, value)
  }

  static orderBy(column: keyof ProductCategoriesTable, order: 'asc' | 'desc'): ProductCategoryModel {
    const instance = new ProductCategoryModel(undefined)

    return instance.applyOrderBy(column, order)
  }

  static orderByAsc(column: keyof ProductCategoriesTable): ProductCategoryModel {
    const instance = new ProductCategoryModel(undefined)

    return instance.applyOrderByAsc(column)
  }

  static orderByDesc(column: keyof ProductCategoriesTable): ProductCategoryModel {
    const instance = new ProductCategoryModel(undefined)

    return instance.applyOrderByDesc(column)
  }

  static groupBy(column: keyof ProductCategoriesTable): ProductCategoryModel {
    const instance = new ProductCategoryModel(undefined)

    return instance.applyGroupBy(column)
  }

  static having<V = string>(column: keyof ProductCategoriesTable, operator: Operator, value: V): ProductCategoryModel {
    const instance = new ProductCategoryModel(undefined)

    return instance.applyHaving<V>(column, operator, value)
  }

  static inRandomOrder(): ProductCategoryModel {
    const instance = new ProductCategoryModel(undefined)

    return instance.applyInRandomOrder()
  }

  static whereColumn(first: keyof ProductCategoriesTable, operator: Operator, second: keyof ProductCategoriesTable): ProductCategoryModel {
    const instance = new ProductCategoryModel(undefined)

    return instance.applyWhereColumn(first, operator, second)
  }

  static async max(field: keyof ProductCategoriesTable): Promise<number> {
    const instance = new ProductCategoryModel(undefined)

    return await instance.applyMax(field)
  }

  static async min(field: keyof ProductCategoriesTable): Promise<number> {
    const instance = new ProductCategoryModel(undefined)

    return await instance.applyMin(field)
  }

  static async avg(field: keyof ProductCategoriesTable): Promise<number> {
    const instance = new ProductCategoryModel(undefined)

    return await instance.applyAvg(field)
  }

  static async sum(field: keyof ProductCategoriesTable): Promise<number> {
    const instance = new ProductCategoryModel(undefined)

    return await instance.applySum(field)
  }

  static async count(): Promise<number> {
    const instance = new ProductCategoryModel(undefined)

    return instance.applyCount()
  }

  static async get(): Promise<ProductCategoryModel[]> {
    const instance = new ProductCategoryModel(undefined)

    const results = await instance.applyGet()

    return results.map((item: ProductCategoryJsonResponse) => instance.createInstance(item))
  }

  static async pluck<K extends keyof ProductCategoryModel>(field: K): Promise<ProductCategoryModel[K][]> {
    const instance = new ProductCategoryModel(undefined)

    return await instance.applyPluck(field)
  }

  static async chunk(size: number, callback: (models: ProductCategoryModel[]) => Promise<void>): Promise<void> {
    const instance = new ProductCategoryModel(undefined)

    await instance.applyChunk(size, async (models) => {
      const modelInstances = models.map((item: ProductCategoryJsonResponse) => instance.createInstance(item))
      await callback(modelInstances)
    })
  }

  static async paginate(options: { limit?: number, offset?: number, page?: number } = { limit: 10, offset: 0, page: 1 }): Promise<{
    data: ProductCategoryModel[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }> {
    const instance = new ProductCategoryModel(undefined)

    const result = await instance.applyPaginate(options)

    return {
      data: result.data.map((item: ProductCategoryJsonResponse) => instance.createInstance(item)),
      paging: result.paging,
      next_cursor: result.next_cursor,
    }
  }

  // Instance method for creating model instances
  createInstance(data: ProductCategoryJsonResponse): ProductCategoryModel {
    return new ProductCategoryModel(data)
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

    const model = await DB.instance.selectFrom('product_categories')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created ProductCategory')
    }

    if (model)
      dispatch('productCategory:created', model)
    return this.createInstance(model)
  }

  async create(newProductCategory: NewProductCategory): Promise<ProductCategoryModel> {
    return await this.applyCreate(newProductCategory)
  }

  static async create(newProductCategory: NewProductCategory): Promise<ProductCategoryModel> {
    const instance = new ProductCategoryModel(undefined)
    return await instance.applyCreate(newProductCategory)
  }

  static async firstOrCreate(search: Partial<ProductCategoriesTable>, values: NewProductCategory = {} as NewProductCategory): Promise<ProductCategoryModel> {
    // First try to find a record matching the search criteria
    const instance = new ProductCategoryModel(undefined)

    // Apply all search conditions
    for (const [key, value] of Object.entries(search)) {
      instance.selectFromQuery = instance.selectFromQuery.where(key, '=', value)
    }

    // Try to find the record
    const existingRecord = await instance.applyFirst()

    if (existingRecord) {
      return instance.createInstance(existingRecord)
    }

    // If no record exists, create a new one with combined search criteria and values
    const createData = { ...search, ...values } as NewProductCategory
    return await ProductCategoryModel.create(createData)
  }

  static async updateOrCreate(search: Partial<ProductCategoriesTable>, values: NewProductCategory = {} as NewProductCategory): Promise<ProductCategoryModel> {
    // First try to find a record matching the search criteria
    const instance = new ProductCategoryModel(undefined)

    // Apply all search conditions
    for (const [key, value] of Object.entries(search)) {
      instance.selectFromQuery = instance.selectFromQuery.where(key, '=', value)
    }

    // Try to find the record
    const existingRecord = await instance.applyFirst()

    if (existingRecord) {
      // If record exists, update it with the new values
      const model = instance.createInstance(existingRecord)
      const updatedModel = await model.update(values as ProductCategoryUpdate)

      // Return the updated model instance
      if (updatedModel) {
        return updatedModel
      }

      // If update didn't return a model, fetch it again to ensure we have latest data
      const refreshedModel = await instance.applyFirst()
      return instance.createInstance(refreshedModel!)
    }

    // If no record exists, create a new one with combined search criteria and values
    const createData = { ...search, ...values } as NewProductCategory
    return await ProductCategoryModel.create(createData)
  }

  async update(newProductCategory: ProductCategoryUpdate): Promise<ProductCategoryModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newProductCategory).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as ProductCategoryUpdate

    await this.mapCustomSetters(filteredValues)

    filteredValues.updated_at = new Date().toISOString()

    await DB.instance.updateTable('product_categories')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('product_categories')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated ProductCategory')
      }

      if (model)
        dispatch('productCategory:updated', model)
      return this.createInstance(model)
    }

    this.hasSaved = true

    return undefined
  }

  async forceUpdate(newProductCategory: ProductCategoryUpdate): Promise<ProductCategoryModel | undefined> {
    await DB.instance.updateTable('product_categories')
      .set(newProductCategory)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('product_categories')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated ProductCategory')
      }

      if (this)
        dispatch('productCategory:updated', model)
      return this.createInstance(model)
    }

    return undefined
  }

  async save(): Promise<ProductCategoryModel> {
    // If the model has an ID, update it; otherwise, create a new record
    if (this.id) {
      // Update existing record
      await DB.instance.updateTable('product_categories')
        .set(this.attributes as ProductCategoryUpdate)
        .where('id', '=', this.id)
        .executeTakeFirst()

      // Get the updated data
      const model = await DB.instance.selectFrom('product_categories')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated ProductCategory')
      }

      if (this)
        dispatch('productCategory:updated', model)
      return this.createInstance(model)
    }
    else {
      // Create new record
      const result = await DB.instance.insertInto('product_categories')
        .values(this.attributes as NewProductCategory)
        .executeTakeFirst()

      // Get the created data
      const model = await DB.instance.selectFrom('product_categories')
        .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve created ProductCategory')
      }

      if (this)
        dispatch('productCategory:created', model)
      return this.createInstance(model)
    }
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

    const instance = new ProductCategoryModel(undefined)
    const model = await DB.instance.selectFrom('product_categories')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created ProductCategory')
    }

    if (model)
      dispatch('productCategory:created', model)

    return instance.createInstance(model)
  }

  // Method to remove a ProductCategory
  async delete(): Promise<number> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()
    const model = await this.find(Number(this.id))

    if (model)
      dispatch('productCategory:deleted', model)

    const deleted = await DB.instance.deleteFrom('product_categories')
      .where('id', '=', this.id)
      .execute()

    return deleted.numDeletedRows
  }

  static async remove(id: number): Promise<any> {
    const instance = new ProductCategoryModel(undefined)

    const model = await instance.find(Number(id))

    if (model)
      dispatch('productCategory:deleted', model)

    return await DB.instance.deleteFrom('product_categories')
      .where('id', '=', id)
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

  // Add a protected applyFind implementation
  protected async applyFind(id: number): Promise<ProductCategoryModel | undefined> {
    const model = await DB.instance.selectFrom(this.tableName)
      .where('id', '=', id)
      .selectAll()
      .executeTakeFirst()

    if (!model)
      return undefined

    this.mapCustomGetters(model)

    await this.loadRelations(model)

    // Return a proper instance using the factory method
    return this.createInstance(model)
  }
}

export async function find(id: number): Promise<ProductCategoryModel | undefined> {
  const query = DB.instance.selectFrom('product_categories').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  const instance = new ProductCategoryModel(undefined)
  return instance.createInstance(model)
}

export async function count(): Promise<number> {
  const results = await ProductCategoryModel.count()

  return results
}

export async function create(newProductCategory: NewProductCategory): Promise<ProductCategoryModel> {
  const instance = new ProductCategoryModel(undefined)
  return await instance.applyCreate(newProductCategory)
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
