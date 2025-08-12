import type { RawBuilder } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import type { CategoriesTable, CategoryJsonResponse, CategoryUpdate, NewCategory } from '../types/CategoryType'
import type { ProductModel } from './Product'
import { randomUUIDv7 } from 'bun'
import { sql } from '@stacksjs/database'
import { HttpError } from '@stacksjs/error-handling'
import { dispatch } from '@stacksjs/events'
import { DB } from '@stacksjs/orm'

import { BaseOrm } from '../utils/base'

export class CategoryModel extends BaseOrm<CategoryModel, CategoriesTable, CategoryJsonResponse> {
  private readonly hidden: Array<keyof CategoryJsonResponse> = []
  private readonly fillable: Array<keyof CategoryJsonResponse> = ['name', 'description', 'slug', 'image_url', 'is_active', 'parent_category_id', 'display_order', 'uuid']
  private readonly guarded: Array<keyof CategoryJsonResponse> = []
  protected attributes = {} as CategoryJsonResponse
  protected originalAttributes = {} as CategoryJsonResponse

  protected selectFromQuery: any
  protected updateFromQuery: any
  protected deleteFromQuery: any
  protected hasSelect: boolean
  private customColumns: Record<string, unknown> = {}

  /**
   * This model inherits many query methods from BaseOrm:
   * - pluck, chunk, whereExists, has, doesntHave, whereHas, whereDoesntHave
   * - inRandomOrder, max, min, avg, paginate, get, and more
   *
   * See BaseOrm class for the full list of inherited methods.
   */

  constructor(category: CategoryJsonResponse | undefined) {
    super('categories')
    if (category) {
      this.attributes = { ...category }
      this.originalAttributes = { ...category }

      Object.keys(category).forEach((key) => {
        if (!(key in this)) {
          this.customColumns[key] = (category as CategoryJsonResponse)[key]
        }
      })
    }

    this.withRelations = []
    this.selectFromQuery = DB.instance.selectFrom('categories')
    this.updateFromQuery = DB.instance.updateTable('categories')
    this.deleteFromQuery = DB.instance.deleteFrom('categories')
    this.hasSelect = false
  }

  protected async loadRelations(models: CategoryJsonResponse | CategoryJsonResponse[]): Promise<void> {
    // Handle both single model and array of models
    const modelArray = Array.isArray(models) ? models : [models]
    if (!modelArray.length)
      return

    const modelIds = modelArray.map(model => model.id)

    for (const relation of this.withRelations) {
      const relatedRecords = await DB.instance
        .selectFrom(relation)
        .where('category_id', 'in', modelIds)
        .selectAll()
        .execute()

      if (Array.isArray(models)) {
        models.map((model: CategoryJsonResponse) => {
          const records = relatedRecords.filter((record: { category_id: number }) => {
            return record.category_id === model.id
          })

          model[relation] = records.length === 1 ? records[0] : records
          return model
        })
      }
      else {
        const records = relatedRecords.filter((record: { category_id: number }) => {
          return record.category_id === models.id
        })

        models[relation] = records.length === 1 ? records[0] : records
      }
    }
  }

  static with(relations: string[]): CategoryModel {
    const instance = new CategoryModel(undefined)

    return instance.applyWith(relations)
  }

  protected mapCustomGetters(models: CategoryJsonResponse | CategoryJsonResponse[]): void {
    const data = models

    if (Array.isArray(data)) {
      data.map((model: CategoryJsonResponse) => {
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

  async mapCustomSetters(model: NewCategory): Promise<void> {
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

  get slug(): string {
    return this.attributes.slug
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

  get created_at(): string | undefined {
    return this.attributes.created_at
  }

  get updated_at(): string | undefined {
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

  set slug(value: string) {
    this.attributes.slug = value
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

  set updated_at(value: string) {
    this.attributes.updated_at = value
  }

  static select(params: (keyof CategoryJsonResponse)[] | RawBuilder<string> | string): CategoryModel {
    const instance = new CategoryModel(undefined)

    return instance.applySelect(params)
  }

  // Method to find a Category by ID
  static async find(id: number): Promise<CategoryModel | undefined> {
    const query = DB.instance.selectFrom('categories').where('id', '=', id).selectAll()

    const model = await query.executeTakeFirst()

    if (!model)
      return undefined

    const instance = new CategoryModel(undefined)
    return instance.createInstance(model)
  }

  static async first(): Promise<CategoryModel | undefined> {
    const instance = new CategoryModel(undefined)

    const model = await instance.applyFirst()

    const data = new CategoryModel(model)

    return data
  }

  static async last(): Promise<CategoryModel | undefined> {
    const instance = new CategoryModel(undefined)

    const model = await instance.applyLast()

    if (!model)
      return undefined

    return new CategoryModel(model)
  }

  static async firstOrFail(): Promise<CategoryModel | undefined> {
    const instance = new CategoryModel(undefined)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<CategoryModel[]> {
    const instance = new CategoryModel(undefined)

    const models = await DB.instance.selectFrom('categories').selectAll().execute()

    instance.mapCustomGetters(models)

    const data = await Promise.all(models.map(async (model: CategoryJsonResponse) => {
      return new CategoryModel(model)
    }))

    return data
  }

  static async findOrFail(id: number): Promise<CategoryModel | undefined> {
    const instance = new CategoryModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  static async findMany(ids: number[]): Promise<CategoryModel[]> {
    const instance = new CategoryModel(undefined)

    const models = await instance.applyFindMany(ids)

    return models.map((modelItem: CategoryJsonResponse) => instance.parseResult(new CategoryModel(modelItem)))
  }

  static async latest(column: keyof CategoriesTable = 'created_at'): Promise<CategoryModel | undefined> {
    const instance = new CategoryModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'desc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new CategoryModel(model)
  }

  static async oldest(column: keyof CategoriesTable = 'created_at'): Promise<CategoryModel | undefined> {
    const instance = new CategoryModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'asc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new CategoryModel(model)
  }

  static skip(count: number): CategoryModel {
    const instance = new CategoryModel(undefined)

    return instance.applySkip(count)
  }

  static take(count: number): CategoryModel {
    const instance = new CategoryModel(undefined)

    return instance.applyTake(count)
  }

  static where<V = string>(column: keyof CategoriesTable, ...args: [V] | [Operator, V]): CategoryModel {
    const instance = new CategoryModel(undefined)

    return instance.applyWhere<V>(column, ...args)
  }

  static orWhere(...conditions: [string, any][]): CategoryModel {
    const instance = new CategoryModel(undefined)

    return instance.applyOrWhere(...conditions)
  }

  static whereNotIn<V = number>(column: keyof CategoriesTable, values: V[]): CategoryModel {
    const instance = new CategoryModel(undefined)

    return instance.applyWhereNotIn<V>(column, values)
  }

  static whereBetween<V = number>(column: keyof CategoriesTable, range: [V, V]): CategoryModel {
    const instance = new CategoryModel(undefined)

    return instance.applyWhereBetween<V>(column, range)
  }

  static whereRef(column: keyof CategoriesTable, ...args: string[]): CategoryModel {
    const instance = new CategoryModel(undefined)

    return instance.applyWhereRef(column, ...args)
  }

  static when(condition: boolean, callback: (query: CategoryModel) => CategoryModel): CategoryModel {
    const instance = new CategoryModel(undefined)

    return instance.applyWhen(condition, callback as any)
  }

  static whereNull(column: keyof CategoriesTable): CategoryModel {
    const instance = new CategoryModel(undefined)

    return instance.applyWhereNull(column)
  }

  static whereNotNull(column: keyof CategoriesTable): CategoryModel {
    const instance = new CategoryModel(undefined)

    return instance.applyWhereNotNull(column)
  }

  static whereLike(column: keyof CategoriesTable, value: string): CategoryModel {
    const instance = new CategoryModel(undefined)

    return instance.applyWhereLike(column, value)
  }

  static orderBy(column: keyof CategoriesTable, order: 'asc' | 'desc'): CategoryModel {
    const instance = new CategoryModel(undefined)

    return instance.applyOrderBy(column, order)
  }

  static orderByAsc(column: keyof CategoriesTable): CategoryModel {
    const instance = new CategoryModel(undefined)

    return instance.applyOrderByAsc(column)
  }

  static orderByDesc(column: keyof CategoriesTable): CategoryModel {
    const instance = new CategoryModel(undefined)

    return instance.applyOrderByDesc(column)
  }

  static groupBy(column: keyof CategoriesTable): CategoryModel {
    const instance = new CategoryModel(undefined)

    return instance.applyGroupBy(column)
  }

  static having<V = string>(column: keyof CategoriesTable, operator: Operator, value: V): CategoryModel {
    const instance = new CategoryModel(undefined)

    return instance.applyHaving<V>(column, operator, value)
  }

  static inRandomOrder(): CategoryModel {
    const instance = new CategoryModel(undefined)

    return instance.applyInRandomOrder()
  }

  static whereColumn(first: keyof CategoriesTable, operator: Operator, second: keyof CategoriesTable): CategoryModel {
    const instance = new CategoryModel(undefined)

    return instance.applyWhereColumn(first, operator, second)
  }

  static async max(field: keyof CategoriesTable): Promise<number> {
    const instance = new CategoryModel(undefined)

    return await instance.applyMax(field)
  }

  static async min(field: keyof CategoriesTable): Promise<number> {
    const instance = new CategoryModel(undefined)

    return await instance.applyMin(field)
  }

  static async avg(field: keyof CategoriesTable): Promise<number> {
    const instance = new CategoryModel(undefined)

    return await instance.applyAvg(field)
  }

  static async sum(field: keyof CategoriesTable): Promise<number> {
    const instance = new CategoryModel(undefined)

    return await instance.applySum(field)
  }

  static async count(): Promise<number> {
    const instance = new CategoryModel(undefined)

    return instance.applyCount()
  }

  static async get(): Promise<CategoryModel[]> {
    const instance = new CategoryModel(undefined)

    const results = await instance.applyGet()

    return results.map((item: CategoryJsonResponse) => instance.createInstance(item))
  }

  static async pluck<K extends keyof CategoryModel>(field: K): Promise<CategoryModel[K][]> {
    const instance = new CategoryModel(undefined)

    return await instance.applyPluck(field)
  }

  static async chunk(size: number, callback: (models: CategoryModel[]) => Promise<void>): Promise<void> {
    const instance = new CategoryModel(undefined)

    await instance.applyChunk(size, async (models) => {
      const modelInstances = models.map((item: CategoryJsonResponse) => instance.createInstance(item))
      await callback(modelInstances)
    })
  }

  static async paginate(options: { limit?: number, offset?: number, page?: number } = { limit: 10, offset: 0, page: 1 }): Promise<{
    data: CategoryModel[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }> {
    const instance = new CategoryModel(undefined)

    const result = await instance.applyPaginate(options)

    return {
      data: result.data.map((item: CategoryJsonResponse) => instance.createInstance(item)),
      paging: result.paging,
      next_cursor: result.next_cursor,
    }
  }

  // Instance method for creating model instances
  createInstance(data: CategoryJsonResponse): CategoryModel {
    return new CategoryModel(data)
  }

  async applyCreate(newCategory: NewCategory): Promise<CategoryModel> {
    const filteredValues = Object.fromEntries(
      Object.entries(newCategory).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewCategory

    await this.mapCustomSetters(filteredValues)

    filteredValues.uuid = randomUUIDv7()

    const result = await DB.instance.insertInto('categories')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await DB.instance.selectFrom('categories')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created Category')
    }

    if (model)
      dispatch('category:created', model)
    return this.createInstance(model)
  }

  async create(newCategory: NewCategory): Promise<CategoryModel> {
    return await this.applyCreate(newCategory)
  }

  static async create(newCategory: NewCategory): Promise<CategoryModel> {
    const instance = new CategoryModel(undefined)
    return await instance.applyCreate(newCategory)
  }

  static async firstOrCreate(search: Partial<CategoriesTable>, values: NewCategory = {} as NewCategory): Promise<CategoryModel> {
    // First try to find a record matching the search criteria
    const instance = new CategoryModel(undefined)

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
    const createData = { ...search, ...values } as NewCategory
    return await CategoryModel.create(createData)
  }

  static async updateOrCreate(search: Partial<CategoriesTable>, values: NewCategory = {} as NewCategory): Promise<CategoryModel> {
    // First try to find a record matching the search criteria
    const instance = new CategoryModel(undefined)

    // Apply all search conditions
    for (const [key, value] of Object.entries(search)) {
      instance.selectFromQuery = instance.selectFromQuery.where(key, '=', value)
    }

    // Try to find the record
    const existingRecord = await instance.applyFirst()

    if (existingRecord) {
      // If record exists, update it with the new values
      const model = instance.createInstance(existingRecord)
      const updatedModel = await model.update(values as CategoryUpdate)

      // Return the updated model instance
      if (updatedModel) {
        return updatedModel
      }

      // If update didn't return a model, fetch it again to ensure we have latest data
      const refreshedModel = await instance.applyFirst()
      return instance.createInstance(refreshedModel!)
    }

    // If no record exists, create a new one with combined search criteria and values
    const createData = { ...search, ...values } as NewCategory
    return await CategoryModel.create(createData)
  }

  async update(newCategory: CategoryUpdate): Promise<CategoryModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newCategory).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as CategoryUpdate

    await this.mapCustomSetters(filteredValues)

    filteredValues.updated_at = new Date().toISOString()

    await DB.instance.updateTable('categories')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('categories')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated Category')
      }

      if (model)
        dispatch('category:updated', model)
      return this.createInstance(model)
    }

    return undefined
  }

  async forceUpdate(newCategory: CategoryUpdate): Promise<CategoryModel | undefined> {
    await DB.instance.updateTable('categories')
      .set(newCategory)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('categories')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated Category')
      }

      if (this)
        dispatch('category:updated', model)
      return this.createInstance(model)
    }

    return undefined
  }

  async save(): Promise<CategoryModel> {
    // If the model has an ID, update it; otherwise, create a new record
    if (this.id) {
      // Update existing record
      await DB.instance.updateTable('categories')
        .set(this.attributes as CategoryUpdate)
        .where('id', '=', this.id)
        .executeTakeFirst()

      // Get the updated data
      const model = await DB.instance.selectFrom('categories')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated Category')
      }

      if (this)
        dispatch('category:updated', model)
      return this.createInstance(model)
    }
    else {
      // Create new record
      const result = await DB.instance.insertInto('categories')
        .values(this.attributes as NewCategory)
        .executeTakeFirst()

      // Get the created data
      const model = await DB.instance.selectFrom('categories')
        .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve created Category')
      }

      if (this)
        dispatch('category:created', model)
      return this.createInstance(model)
    }
  }

  static async createMany(newCategory: NewCategory[]): Promise<void> {
    const instance = new CategoryModel(undefined)

    const valuesFiltered = newCategory.map((newCategory: NewCategory) => {
      const filteredValues = Object.fromEntries(
        Object.entries(newCategory).filter(([key]) =>
          !instance.guarded.includes(key) && instance.fillable.includes(key),
        ),
      ) as NewCategory

      filteredValues.uuid = randomUUIDv7()

      return filteredValues
    })

    await DB.instance.insertInto('categories')
      .values(valuesFiltered)
      .executeTakeFirst()
  }

  static async forceCreate(newCategory: NewCategory): Promise<CategoryModel> {
    const result = await DB.instance.insertInto('categories')
      .values(newCategory)
      .executeTakeFirst()

    const instance = new CategoryModel(undefined)
    const model = await DB.instance.selectFrom('categories')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created Category')
    }

    if (model)
      dispatch('category:created', model)

    return instance.createInstance(model)
  }

  // Method to remove a Category
  async delete(): Promise<number> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()
    const model = await this.find(Number(this.id))

    if (model)
      dispatch('category:deleted', model)

    const deleted = await DB.instance.deleteFrom('categories')
      .where('id', '=', this.id)
      .execute()

    return deleted.numDeletedRows
  }

  static async remove(id: number): Promise<any> {
    const instance = new CategoryModel(undefined)

    const model = await instance.find(Number(id))

    if (model)
      dispatch('category:deleted', model)

    return await DB.instance.deleteFrom('categories')
      .where('id', '=', id)
      .execute()
  }

  static whereName(value: string): CategoryModel {
    const instance = new CategoryModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('name', '=', value)

    return instance
  }

  static whereDescription(value: string): CategoryModel {
    const instance = new CategoryModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('description', '=', value)

    return instance
  }

  static whereSlug(value: string): CategoryModel {
    const instance = new CategoryModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('slug', '=', value)

    return instance
  }

  static whereImageUrl(value: string): CategoryModel {
    const instance = new CategoryModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('image_url', '=', value)

    return instance
  }

  static whereIsActive(value: string): CategoryModel {
    const instance = new CategoryModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('is_active', '=', value)

    return instance
  }

  static whereParentCategoryId(value: string): CategoryModel {
    const instance = new CategoryModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('parent_category_id', '=', value)

    return instance
  }

  static whereDisplayOrder(value: string): CategoryModel {
    const instance = new CategoryModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('display_order', '=', value)

    return instance
  }

  static whereIn<V = number>(column: keyof CategoriesTable, values: V[]): CategoryModel {
    const instance = new CategoryModel(undefined)

    return instance.applyWhereIn<V>(column, values)
  }

  toSearchableObject(): Partial<CategoryJsonResponse> {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      is_active: this.is_active,
      parent_category_id: this.parent_category_id,
      display_order: this.display_order,
    }
  }

  static distinct(column: keyof CategoryJsonResponse): CategoryModel {
    const instance = new CategoryModel(undefined)

    return instance.applyDistinct(column)
  }

  static join(table: string, firstCol: string, secondCol: string): CategoryModel {
    const instance = new CategoryModel(undefined)

    return instance.applyJoin(table, firstCol, secondCol)
  }

  toJSON(): CategoryJsonResponse {
    const output = {

      uuid: this.uuid,

      id: this.id,
      name: this.name,
      description: this.description,
      slug: this.slug,
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

  parseResult(model: CategoryModel): CategoryModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof CategoryModel]
    }

    return model
  }

  // Add a protected applyFind implementation
  protected async applyFind(id: number): Promise<CategoryModel | undefined> {
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

export async function find(id: number): Promise<CategoryModel | undefined> {
  const query = DB.instance.selectFrom('categories').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  const instance = new CategoryModel(undefined)
  return instance.createInstance(model)
}

export async function count(): Promise<number> {
  const results = await CategoryModel.count()

  return results
}

export async function create(newCategory: NewCategory): Promise<CategoryModel> {
  const instance = new CategoryModel(undefined)
  return await instance.applyCreate(newCategory)
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(DB.instance)
}

export async function remove(id: number): Promise<void> {
  await DB.instance.deleteFrom('categories')
    .where('id', '=', id)
    .execute()
}

export async function whereName(value: string): Promise<CategoryModel[]> {
  const query = DB.instance.selectFrom('categories').where('name', '=', value)
  const results: CategoryJsonResponse = await query.execute()

  return results.map((modelItem: CategoryJsonResponse) => new CategoryModel(modelItem))
}

export async function whereDescription(value: string): Promise<CategoryModel[]> {
  const query = DB.instance.selectFrom('categories').where('description', '=', value)
  const results: CategoryJsonResponse = await query.execute()

  return results.map((modelItem: CategoryJsonResponse) => new CategoryModel(modelItem))
}

export async function whereSlug(value: string): Promise<CategoryModel[]> {
  const query = DB.instance.selectFrom('categories').where('slug', '=', value)
  const results: CategoryJsonResponse = await query.execute()

  return results.map((modelItem: CategoryJsonResponse) => new CategoryModel(modelItem))
}

export async function whereImageUrl(value: string): Promise<CategoryModel[]> {
  const query = DB.instance.selectFrom('categories').where('image_url', '=', value)
  const results: CategoryJsonResponse = await query.execute()

  return results.map((modelItem: CategoryJsonResponse) => new CategoryModel(modelItem))
}

export async function whereIsActive(value: boolean): Promise<CategoryModel[]> {
  const query = DB.instance.selectFrom('categories').where('is_active', '=', value)
  const results: CategoryJsonResponse = await query.execute()

  return results.map((modelItem: CategoryJsonResponse) => new CategoryModel(modelItem))
}

export async function whereParentCategoryId(value: string): Promise<CategoryModel[]> {
  const query = DB.instance.selectFrom('categories').where('parent_category_id', '=', value)
  const results: CategoryJsonResponse = await query.execute()

  return results.map((modelItem: CategoryJsonResponse) => new CategoryModel(modelItem))
}

export async function whereDisplayOrder(value: number): Promise<CategoryModel[]> {
  const query = DB.instance.selectFrom('categories').where('display_order', '=', value)
  const results: CategoryJsonResponse = await query.execute()

  return results.map((modelItem: CategoryJsonResponse) => new CategoryModel(modelItem))
}

export const Category = CategoryModel

export default Category
