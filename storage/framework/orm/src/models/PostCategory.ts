import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import { randomUUIDv7 } from 'bun'
import { sql } from '@stacksjs/database'
import { HttpError } from '@stacksjs/error-handling'
import { DB } from '@stacksjs/orm'

import { BaseOrm } from '../utils/base'

export interface PostCategoriesTable {
  id: Generated<number>
  name: string
  description: string
  slug: string
  uuid?: string

  created_at?: string

  updated_at?: string

}

// Type for reading model data (created_at is required)
export type PostCategoryRead = PostCategoriesTable

// Type for creating/updating model data (created_at is optional)
export type PostCategoryWrite = Omit<PostCategoriesTable, 'created_at'> & {
  created_at?: string
}

export interface PostCategoryResponse {
  data: PostCategoryJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface PostCategoryJsonResponse extends Omit<Selectable<PostCategoryRead>, 'password'> {
  [key: string]: any
}

export type NewPostCategory = Insertable<PostCategoryWrite>
export type PostCategoryUpdate = Updateable<PostCategoryWrite>

export class PostCategoryModel extends BaseOrm<PostCategoryModel, PostCategoriesTable, PostCategoryJsonResponse> {
  private readonly hidden: Array<keyof PostCategoryJsonResponse> = []
  private readonly fillable: Array<keyof PostCategoryJsonResponse> = ['name', 'description', 'slug', 'uuid', 'post_id']
  private readonly guarded: Array<keyof PostCategoryJsonResponse> = []
  protected attributes = {} as PostCategoryJsonResponse
  protected originalAttributes = {} as PostCategoryJsonResponse

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

  constructor(postCategory: PostCategoryJsonResponse | undefined) {
    super('post_categories')
    if (postCategory) {
      this.attributes = { ...postCategory }
      this.originalAttributes = { ...postCategory }

      Object.keys(postCategory).forEach((key) => {
        if (!(key in this)) {
          this.customColumns[key] = (postCategory as PostCategoryJsonResponse)[key]
        }
      })
    }

    this.withRelations = []
    this.selectFromQuery = DB.instance.selectFrom('post_categories')
    this.updateFromQuery = DB.instance.updateTable('post_categories')
    this.deleteFromQuery = DB.instance.deleteFrom('post_categories')
    this.hasSelect = false
  }

  protected async loadRelations(models: PostCategoryJsonResponse | PostCategoryJsonResponse[]): Promise<void> {
    // Handle both single model and array of models
    const modelArray = Array.isArray(models) ? models : [models]
    if (!modelArray.length)
      return

    const modelIds = modelArray.map(model => model.id)

    for (const relation of this.withRelations) {
      const relatedRecords = await DB.instance
        .selectFrom(relation)
        .where('postCategory_id', 'in', modelIds)
        .selectAll()
        .execute()

      if (Array.isArray(models)) {
        models.map((model: PostCategoryJsonResponse) => {
          const records = relatedRecords.filter((record: { postCategory_id: number }) => {
            return record.postCategory_id === model.id
          })

          model[relation] = records.length === 1 ? records[0] : records
          return model
        })
      }
      else {
        const records = relatedRecords.filter((record: { postCategory_id: number }) => {
          return record.postCategory_id === models.id
        })

        models[relation] = records.length === 1 ? records[0] : records
      }
    }
  }

  static with(relations: string[]): PostCategoryModel {
    const instance = new PostCategoryModel(undefined)

    return instance.applyWith(relations)
  }

  protected mapCustomGetters(models: PostCategoryJsonResponse | PostCategoryJsonResponse[]): void {
    const data = models

    if (Array.isArray(data)) {
      data.map((model: PostCategoryJsonResponse) => {
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

  async mapCustomSetters(model: NewPostCategory | PostCategoryUpdate): Promise<void> {
    const customSetter = {
      default: () => {
      },

    }

    for (const [key, fn] of Object.entries(customSetter)) {
      (model as any)[key] = await fn()
    }
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

  get description(): string {
    return this.attributes.description
  }

  get slug(): string {
    return this.attributes.slug
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

  set updated_at(value: string) {
    this.attributes.updated_at = value
  }

  static select(params: (keyof PostCategoryJsonResponse)[] | RawBuilder<string> | string): PostCategoryModel {
    const instance = new PostCategoryModel(undefined)

    return instance.applySelect(params)
  }

  // Method to find a PostCategory by ID
  static async find(id: number): Promise<PostCategoryModel | undefined> {
    const query = DB.instance.selectFrom('post_categories').where('id', '=', id).selectAll()

    const model = await query.executeTakeFirst()

    if (!model)
      return undefined

    const instance = new PostCategoryModel(undefined)
    return instance.createInstance(model)
  }

  static async first(): Promise<PostCategoryModel | undefined> {
    const instance = new PostCategoryModel(undefined)

    const model = await instance.applyFirst()

    const data = new PostCategoryModel(model)

    return data
  }

  static async last(): Promise<PostCategoryModel | undefined> {
    const instance = new PostCategoryModel(undefined)

    const model = await instance.applyLast()

    if (!model)
      return undefined

    return new PostCategoryModel(model)
  }

  static async firstOrFail(): Promise<PostCategoryModel | undefined> {
    const instance = new PostCategoryModel(undefined)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<PostCategoryModel[]> {
    const instance = new PostCategoryModel(undefined)

    const models = await DB.instance.selectFrom('post_categories').selectAll().execute()

    instance.mapCustomGetters(models)

    const data = await Promise.all(models.map(async (model: PostCategoryJsonResponse) => {
      return new PostCategoryModel(model)
    }))

    return data
  }

  static async findOrFail(id: number): Promise<PostCategoryModel | undefined> {
    const instance = new PostCategoryModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  static async findMany(ids: number[]): Promise<PostCategoryModel[]> {
    const instance = new PostCategoryModel(undefined)

    const models = await instance.applyFindMany(ids)

    return models.map((modelItem: PostCategoryJsonResponse) => instance.parseResult(new PostCategoryModel(modelItem)))
  }

  static async latest(column: keyof PostCategoriesTable = 'created_at'): Promise<PostCategoryModel | undefined> {
    const instance = new PostCategoryModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'desc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new PostCategoryModel(model)
  }

  static async oldest(column: keyof PostCategoriesTable = 'created_at'): Promise<PostCategoryModel | undefined> {
    const instance = new PostCategoryModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'asc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new PostCategoryModel(model)
  }

  static skip(count: number): PostCategoryModel {
    const instance = new PostCategoryModel(undefined)

    return instance.applySkip(count)
  }

  static take(count: number): PostCategoryModel {
    const instance = new PostCategoryModel(undefined)

    return instance.applyTake(count)
  }

  static where<V = string>(column: keyof PostCategoriesTable, ...args: [V] | [Operator, V]): PostCategoryModel {
    const instance = new PostCategoryModel(undefined)

    return instance.applyWhere<V>(column, ...args)
  }

  static orWhere(...conditions: [string, any][]): PostCategoryModel {
    const instance = new PostCategoryModel(undefined)

    return instance.applyOrWhere(...conditions)
  }

  static whereNotIn<V = number>(column: keyof PostCategoriesTable, values: V[]): PostCategoryModel {
    const instance = new PostCategoryModel(undefined)

    return instance.applyWhereNotIn<V>(column, values)
  }

  static whereBetween<V = number>(column: keyof PostCategoriesTable, range: [V, V]): PostCategoryModel {
    const instance = new PostCategoryModel(undefined)

    return instance.applyWhereBetween<V>(column, range)
  }

  static whereRef(column: keyof PostCategoriesTable, ...args: string[]): PostCategoryModel {
    const instance = new PostCategoryModel(undefined)

    return instance.applyWhereRef(column, ...args)
  }

  static when(condition: boolean, callback: (query: PostCategoryModel) => PostCategoryModel): PostCategoryModel {
    const instance = new PostCategoryModel(undefined)

    return instance.applyWhen(condition, callback as any)
  }

  static whereNull(column: keyof PostCategoriesTable): PostCategoryModel {
    const instance = new PostCategoryModel(undefined)

    return instance.applyWhereNull(column)
  }

  static whereNotNull(column: keyof PostCategoriesTable): PostCategoryModel {
    const instance = new PostCategoryModel(undefined)

    return instance.applyWhereNotNull(column)
  }

  static whereLike(column: keyof PostCategoriesTable, value: string): PostCategoryModel {
    const instance = new PostCategoryModel(undefined)

    return instance.applyWhereLike(column, value)
  }

  static orderBy(column: keyof PostCategoriesTable, order: 'asc' | 'desc'): PostCategoryModel {
    const instance = new PostCategoryModel(undefined)

    return instance.applyOrderBy(column, order)
  }

  static orderByAsc(column: keyof PostCategoriesTable): PostCategoryModel {
    const instance = new PostCategoryModel(undefined)

    return instance.applyOrderByAsc(column)
  }

  static orderByDesc(column: keyof PostCategoriesTable): PostCategoryModel {
    const instance = new PostCategoryModel(undefined)

    return instance.applyOrderByDesc(column)
  }

  static groupBy(column: keyof PostCategoriesTable): PostCategoryModel {
    const instance = new PostCategoryModel(undefined)

    return instance.applyGroupBy(column)
  }

  static having<V = string>(column: keyof PostCategoriesTable, operator: Operator, value: V): PostCategoryModel {
    const instance = new PostCategoryModel(undefined)

    return instance.applyHaving<V>(column, operator, value)
  }

  static inRandomOrder(): PostCategoryModel {
    const instance = new PostCategoryModel(undefined)

    return instance.applyInRandomOrder()
  }

  static whereColumn(first: keyof PostCategoriesTable, operator: Operator, second: keyof PostCategoriesTable): PostCategoryModel {
    const instance = new PostCategoryModel(undefined)

    return instance.applyWhereColumn(first, operator, second)
  }

  static async max(field: keyof PostCategoriesTable): Promise<number> {
    const instance = new PostCategoryModel(undefined)

    return await instance.applyMax(field)
  }

  static async min(field: keyof PostCategoriesTable): Promise<number> {
    const instance = new PostCategoryModel(undefined)

    return await instance.applyMin(field)
  }

  static async avg(field: keyof PostCategoriesTable): Promise<number> {
    const instance = new PostCategoryModel(undefined)

    return await instance.applyAvg(field)
  }

  static async sum(field: keyof PostCategoriesTable): Promise<number> {
    const instance = new PostCategoryModel(undefined)

    return await instance.applySum(field)
  }

  static async count(): Promise<number> {
    const instance = new PostCategoryModel(undefined)

    return instance.applyCount()
  }

  static async get(): Promise<PostCategoryModel[]> {
    const instance = new PostCategoryModel(undefined)

    const results = await instance.applyGet()

    return results.map((item: PostCategoryJsonResponse) => instance.createInstance(item))
  }

  static async pluck<K extends keyof PostCategoryModel>(field: K): Promise<PostCategoryModel[K][]> {
    const instance = new PostCategoryModel(undefined)

    return await instance.applyPluck(field)
  }

  static async chunk(size: number, callback: (models: PostCategoryModel[]) => Promise<void>): Promise<void> {
    const instance = new PostCategoryModel(undefined)

    await instance.applyChunk(size, async (models) => {
      const modelInstances = models.map((item: PostCategoryJsonResponse) => instance.createInstance(item))
      await callback(modelInstances)
    })
  }

  static async paginate(options: { limit?: number, offset?: number, page?: number } = { limit: 10, offset: 0, page: 1 }): Promise<{
    data: PostCategoryModel[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }> {
    const instance = new PostCategoryModel(undefined)

    const result = await instance.applyPaginate(options)

    return {
      data: result.data.map((item: PostCategoryJsonResponse) => instance.createInstance(item)),
      paging: result.paging,
      next_cursor: result.next_cursor,
    }
  }

  // Instance method for creating model instances
  createInstance(data: PostCategoryJsonResponse): PostCategoryModel {
    return new PostCategoryModel(data)
  }

  async applyCreate(newPostCategory: NewPostCategory): Promise<PostCategoryModel> {
    const filteredValues = Object.fromEntries(
      Object.entries(newPostCategory).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewPostCategory

    await this.mapCustomSetters(filteredValues)

    filteredValues.uuid = randomUUIDv7()

    const result = await DB.instance.insertInto('post_categories')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await DB.instance.selectFrom('post_categories')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created PostCategory')
    }

    return this.createInstance(model)
  }

  async create(newPostCategory: NewPostCategory): Promise<PostCategoryModel> {
    return await this.applyCreate(newPostCategory)
  }

  static async create(newPostCategory: NewPostCategory): Promise<PostCategoryModel> {
    const instance = new PostCategoryModel(undefined)
    return await instance.applyCreate(newPostCategory)
  }

  static async firstOrCreate(search: Partial<PostCategoriesTable>, values: NewPostCategory = {} as NewPostCategory): Promise<PostCategoryModel> {
    // First try to find a record matching the search criteria
    const instance = new PostCategoryModel(undefined)

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
    const createData = { ...search, ...values } as NewPostCategory
    return await PostCategoryModel.create(createData)
  }

  static async updateOrCreate(search: Partial<PostCategoriesTable>, values: NewPostCategory = {} as NewPostCategory): Promise<PostCategoryModel> {
    // First try to find a record matching the search criteria
    const instance = new PostCategoryModel(undefined)

    // Apply all search conditions
    for (const [key, value] of Object.entries(search)) {
      instance.selectFromQuery = instance.selectFromQuery.where(key, '=', value)
    }

    // Try to find the record
    const existingRecord = await instance.applyFirst()

    if (existingRecord) {
      // If record exists, update it with the new values
      const model = instance.createInstance(existingRecord)
      const updatedModel = await model.update(values as PostCategoryUpdate)

      // Return the updated model instance
      if (updatedModel) {
        return updatedModel
      }

      // If update didn't return a model, fetch it again to ensure we have latest data
      const refreshedModel = await instance.applyFirst()
      return instance.createInstance(refreshedModel!)
    }

    // If no record exists, create a new one with combined search criteria and values
    const createData = { ...search, ...values } as NewPostCategory
    return await PostCategoryModel.create(createData)
  }

  async update(newPostCategory: PostCategoryUpdate): Promise<PostCategoryModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newPostCategory).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as PostCategoryUpdate

    await this.mapCustomSetters(filteredValues)

    filteredValues.updated_at = new Date().toISOString()

    await DB.instance.updateTable('post_categories')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('post_categories')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated PostCategory')
      }

      return this.createInstance(model)
    }

    return undefined
  }

  async forceUpdate(newPostCategory: PostCategoryUpdate): Promise<PostCategoryModel | undefined> {
    await DB.instance.updateTable('post_categories')
      .set(newPostCategory)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('post_categories')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated PostCategory')
      }

      return this.createInstance(model)
    }

    return undefined
  }

  async save(): Promise<PostCategoryModel> {
    // If the model has an ID, update it; otherwise, create a new record
    if (this.id) {
      // Update existing record
      await DB.instance.updateTable('post_categories')
        .set(this.attributes as PostCategoryUpdate)
        .where('id', '=', this.id)
        .executeTakeFirst()

      // Get the updated data
      const model = await DB.instance.selectFrom('post_categories')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated PostCategory')
      }

      return this.createInstance(model)
    }
    else {
      // Create new record
      const result = await DB.instance.insertInto('post_categories')
        .values(this.attributes as NewPostCategory)
        .executeTakeFirst()

      // Get the created data
      const model = await DB.instance.selectFrom('post_categories')
        .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve created PostCategory')
      }

      return this.createInstance(model)
    }
  }

  static async createMany(newPostCategory: NewPostCategory[]): Promise<void> {
    const instance = new PostCategoryModel(undefined)

    const valuesFiltered = newPostCategory.map((newPostCategory: NewPostCategory) => {
      const filteredValues = Object.fromEntries(
        Object.entries(newPostCategory).filter(([key]) =>
          !instance.guarded.includes(key) && instance.fillable.includes(key),
        ),
      ) as NewPostCategory

      filteredValues.uuid = randomUUIDv7()

      return filteredValues
    })

    await DB.instance.insertInto('post_categories')
      .values(valuesFiltered)
      .executeTakeFirst()
  }

  static async forceCreate(newPostCategory: NewPostCategory): Promise<PostCategoryModel> {
    const result = await DB.instance.insertInto('post_categories')
      .values(newPostCategory)
      .executeTakeFirst()

    const instance = new PostCategoryModel(undefined)
    const model = await DB.instance.selectFrom('post_categories')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created PostCategory')
    }

    return instance.createInstance(model)
  }

  // Method to remove a PostCategory
  async delete(): Promise<number> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()

    const deleted = await DB.instance.deleteFrom('post_categories')
      .where('id', '=', this.id)
      .execute()

    return deleted.numDeletedRows
  }

  static async remove(id: number): Promise<any> {
    return await DB.instance.deleteFrom('post_categories')
      .where('id', '=', id)
      .execute()
  }

  static whereName(value: string): PostCategoryModel {
    const instance = new PostCategoryModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('name', '=', value)

    return instance
  }

  static whereDescription(value: string): PostCategoryModel {
    const instance = new PostCategoryModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('description', '=', value)

    return instance
  }

  static whereSlug(value: string): PostCategoryModel {
    const instance = new PostCategoryModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('slug', '=', value)

    return instance
  }

  static whereIn<V = number>(column: keyof PostCategoriesTable, values: V[]): PostCategoryModel {
    const instance = new PostCategoryModel(undefined)

    return instance.applyWhereIn<V>(column, values)
  }

  async postCategoryPosts() {
    if (this.id === undefined)
      throw new HttpError(500, 'Relation Error!')

    const results = await DB.instance.selectFrom('posts')
      .where('post_id', '=', this.id)
      .selectAll()
      .execute()

    const tableRelationIds = results.map((result: { post_id: number }) => result.post_id)

    if (!tableRelationIds.length)
      throw new HttpError(500, 'Relation Error!')

    const relationResults = await Post.whereIn('id', tableRelationIds).get()

    return relationResults
  }

  toSearchableObject(): Partial<PostCategoryJsonResponse> {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      slug: this.slug,
    }
  }

  static distinct(column: keyof PostCategoryJsonResponse): PostCategoryModel {
    const instance = new PostCategoryModel(undefined)

    return instance.applyDistinct(column)
  }

  static join(table: string, firstCol: string, secondCol: string): PostCategoryModel {
    const instance = new PostCategoryModel(undefined)

    return instance.applyJoin(table, firstCol, secondCol)
  }

  toJSON(): PostCategoryJsonResponse {
    const output = {

      uuid: this.uuid,

      id: this.id,
      name: this.name,
      description: this.description,
      slug: this.slug,

      created_at: this.created_at,

      updated_at: this.updated_at,

      ...this.customColumns,
    }

    return output
  }

  parseResult(model: PostCategoryModel): PostCategoryModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof PostCategoryModel]
    }

    return model
  }

  // Add a protected applyFind implementation
  protected async applyFind(id: number): Promise<PostCategoryModel | undefined> {
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

export async function find(id: number): Promise<PostCategoryModel | undefined> {
  const query = DB.instance.selectFrom('post_categories').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  const instance = new PostCategoryModel(undefined)
  return instance.createInstance(model)
}

export async function count(): Promise<number> {
  const results = await PostCategoryModel.count()

  return results
}

export async function create(newPostCategory: NewPostCategory): Promise<PostCategoryModel> {
  const instance = new PostCategoryModel(undefined)
  return await instance.applyCreate(newPostCategory)
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(DB.instance)
}

export async function remove(id: number): Promise<void> {
  await DB.instance.deleteFrom('post_categories')
    .where('id', '=', id)
    .execute()
}

export async function whereName(value: string): Promise<PostCategoryModel[]> {
  const query = DB.instance.selectFrom('post_categories').where('name', '=', value)
  const results: PostCategoryJsonResponse = await query.execute()

  return results.map((modelItem: PostCategoryJsonResponse) => new PostCategoryModel(modelItem))
}

export async function whereDescription(value: string): Promise<PostCategoryModel[]> {
  const query = DB.instance.selectFrom('post_categories').where('description', '=', value)
  const results: PostCategoryJsonResponse = await query.execute()

  return results.map((modelItem: PostCategoryJsonResponse) => new PostCategoryModel(modelItem))
}

export async function whereSlug(value: string): Promise<PostCategoryModel[]> {
  const query = DB.instance.selectFrom('post_categories').where('slug', '=', value)
  const results: PostCategoryJsonResponse = await query.execute()

  return results.map((modelItem: PostCategoryJsonResponse) => new PostCategoryModel(modelItem))
}

export const PostCategory = PostCategoryModel

export default PostCategory
