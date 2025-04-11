import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import type { UserModel } from './User'
import { randomUUIDv7 } from 'bun'
import { sql } from '@stacksjs/database'
import { HttpError } from '@stacksjs/error-handling'
import { DB } from '@stacksjs/orm'

import { BaseOrm } from '../utils/base'

export interface CommentsTable {
  id: Generated<number>
  user_id: number
  title: string
  body: string
  status: string | string[]
  approved_at?: number
  rejected_at?: number
  uuid?: string

  created_at?: string

  updated_at?: string

}

// Type for reading model data (created_at is required)
export type CommentRead = CommentsTable

// Type for creating/updating model data (created_at is optional)
export type CommentWrite = Omit<CommentsTable, 'created_at'> & {
  created_at?: string
}

export interface CommentResponse {
  data: CommentJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface CommentJsonResponse extends Omit<Selectable<CommentRead>, 'password'> {
  [key: string]: any
}

export type NewComment = Insertable<CommentWrite>
export type CommentUpdate = Updateable<CommentWrite>

export class CommentModel extends BaseOrm<CommentModel, CommentsTable, CommentJsonResponse> {
  private readonly hidden: Array<keyof CommentJsonResponse> = []
  private readonly fillable: Array<keyof CommentJsonResponse> = ['title', 'body', 'status', 'approved_at', 'rejected_at', 'uuid', 'user_id']
  private readonly guarded: Array<keyof CommentJsonResponse> = []
  protected attributes = {} as CommentJsonResponse
  protected originalAttributes = {} as CommentJsonResponse

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

  constructor(comment: CommentJsonResponse | undefined) {
    super('comments')
    if (comment) {
      this.attributes = { ...comment }
      this.originalAttributes = { ...comment }

      Object.keys(comment).forEach((key) => {
        if (!(key in this)) {
          this.customColumns[key] = (comment as CommentJsonResponse)[key]
        }
      })
    }

    this.withRelations = []
    this.selectFromQuery = DB.instance.selectFrom('comments')
    this.updateFromQuery = DB.instance.updateTable('comments')
    this.deleteFromQuery = DB.instance.deleteFrom('comments')
    this.hasSelect = false
  }

  protected async loadRelations(models: CommentJsonResponse | CommentJsonResponse[]): Promise<void> {
    // Handle both single model and array of models
    const modelArray = Array.isArray(models) ? models : [models]
    if (!modelArray.length)
      return

    const modelIds = modelArray.map(model => model.id)

    for (const relation of this.withRelations) {
      const relatedRecords = await DB.instance
        .selectFrom(relation)
        .where('comment_id', 'in', modelIds)
        .selectAll()
        .execute()

      if (Array.isArray(models)) {
        models.map((model: CommentJsonResponse) => {
          const records = relatedRecords.filter((record: { comment_id: number }) => {
            return record.comment_id === model.id
          })

          model[relation] = records.length === 1 ? records[0] : records
          return model
        })
      }
      else {
        const records = relatedRecords.filter((record: { comment_id: number }) => {
          return record.comment_id === models.id
        })

        models[relation] = records.length === 1 ? records[0] : records
      }
    }
  }

  static with(relations: string[]): CommentModel {
    const instance = new CommentModel(undefined)

    return instance.applyWith(relations)
  }

  protected mapCustomGetters(models: CommentJsonResponse | CommentJsonResponse[]): void {
    const data = models

    if (Array.isArray(data)) {
      data.map((model: CommentJsonResponse) => {
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

  async mapCustomSetters(model: NewComment | CommentUpdate): Promise<void> {
    const customSetter = {
      default: () => {
      },

    }

    for (const [key, fn] of Object.entries(customSetter)) {
      (model as any)[key] = await fn()
    }
  }

  get user_id(): number {
    return this.attributes.user_id
  }

  get user(): UserModel | undefined {
    return this.attributes.user
  }

  get id(): number {
    return this.attributes.id
  }

  get uuid(): string | undefined {
    return this.attributes.uuid
  }

  get title(): string {
    return this.attributes.title
  }

  get body(): string {
    return this.attributes.body
  }

  get status(): string | string[] {
    return this.attributes.status
  }

  get approved_at(): number | undefined {
    return this.attributes.approved_at
  }

  get rejected_at(): number | undefined {
    return this.attributes.rejected_at
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

  set title(value: string) {
    this.attributes.title = value
  }

  set body(value: string) {
    this.attributes.body = value
  }

  set status(value: string | string[]) {
    this.attributes.status = value
  }

  set approved_at(value: number) {
    this.attributes.approved_at = value
  }

  set rejected_at(value: number) {
    this.attributes.rejected_at = value
  }

  set updated_at(value: string) {
    this.attributes.updated_at = value
  }

  static select(params: (keyof CommentJsonResponse)[] | RawBuilder<string> | string): CommentModel {
    const instance = new CommentModel(undefined)

    return instance.applySelect(params)
  }

  // Method to find a Comment by ID
  static async find(id: number): Promise<CommentModel | undefined> {
    const query = DB.instance.selectFrom('comments').where('id', '=', id).selectAll()

    const model = await query.executeTakeFirst()

    if (!model)
      return undefined

    const instance = new CommentModel(undefined)
    return instance.createInstance(model)
  }

  static async first(): Promise<CommentModel | undefined> {
    const instance = new CommentModel(undefined)

    const model = await instance.applyFirst()

    const data = new CommentModel(model)

    return data
  }

  static async last(): Promise<CommentModel | undefined> {
    const instance = new CommentModel(undefined)

    const model = await instance.applyLast()

    if (!model)
      return undefined

    return new CommentModel(model)
  }

  static async firstOrFail(): Promise<CommentModel | undefined> {
    const instance = new CommentModel(undefined)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<CommentModel[]> {
    const instance = new CommentModel(undefined)

    const models = await DB.instance.selectFrom('comments').selectAll().execute()

    instance.mapCustomGetters(models)

    const data = await Promise.all(models.map(async (model: CommentJsonResponse) => {
      return new CommentModel(model)
    }))

    return data
  }

  static async findOrFail(id: number): Promise<CommentModel | undefined> {
    const instance = new CommentModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  static async findMany(ids: number[]): Promise<CommentModel[]> {
    const instance = new CommentModel(undefined)

    const models = await instance.applyFindMany(ids)

    return models.map((modelItem: CommentJsonResponse) => instance.parseResult(new CommentModel(modelItem)))
  }

  static async latest(column: keyof CommentsTable = 'created_at'): Promise<CommentModel | undefined> {
    const instance = new CommentModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'desc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new CommentModel(model)
  }

  static async oldest(column: keyof CommentsTable = 'created_at'): Promise<CommentModel | undefined> {
    const instance = new CommentModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'asc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new CommentModel(model)
  }

  static skip(count: number): CommentModel {
    const instance = new CommentModel(undefined)

    return instance.applySkip(count)
  }

  static take(count: number): CommentModel {
    const instance = new CommentModel(undefined)

    return instance.applyTake(count)
  }

  static where<V = string>(column: keyof CommentsTable, ...args: [V] | [Operator, V]): CommentModel {
    const instance = new CommentModel(undefined)

    return instance.applyWhere<V>(column, ...args)
  }

  static orWhere(...conditions: [string, any][]): CommentModel {
    const instance = new CommentModel(undefined)

    return instance.applyOrWhere(...conditions)
  }

  static whereNotIn<V = number>(column: keyof CommentsTable, values: V[]): CommentModel {
    const instance = new CommentModel(undefined)

    return instance.applyWhereNotIn<V>(column, values)
  }

  static whereBetween<V = number>(column: keyof CommentsTable, range: [V, V]): CommentModel {
    const instance = new CommentModel(undefined)

    return instance.applyWhereBetween<V>(column, range)
  }

  static whereRef(column: keyof CommentsTable, ...args: string[]): CommentModel {
    const instance = new CommentModel(undefined)

    return instance.applyWhereRef(column, ...args)
  }

  static when(condition: boolean, callback: (query: CommentModel) => CommentModel): CommentModel {
    const instance = new CommentModel(undefined)

    return instance.applyWhen(condition, callback as any)
  }

  static whereNull(column: keyof CommentsTable): CommentModel {
    const instance = new CommentModel(undefined)

    return instance.applyWhereNull(column)
  }

  static whereNotNull(column: keyof CommentsTable): CommentModel {
    const instance = new CommentModel(undefined)

    return instance.applyWhereNotNull(column)
  }

  static whereLike(column: keyof CommentsTable, value: string): CommentModel {
    const instance = new CommentModel(undefined)

    return instance.applyWhereLike(column, value)
  }

  static orderBy(column: keyof CommentsTable, order: 'asc' | 'desc'): CommentModel {
    const instance = new CommentModel(undefined)

    return instance.applyOrderBy(column, order)
  }

  static orderByAsc(column: keyof CommentsTable): CommentModel {
    const instance = new CommentModel(undefined)

    return instance.applyOrderByAsc(column)
  }

  static orderByDesc(column: keyof CommentsTable): CommentModel {
    const instance = new CommentModel(undefined)

    return instance.applyOrderByDesc(column)
  }

  static groupBy(column: keyof CommentsTable): CommentModel {
    const instance = new CommentModel(undefined)

    return instance.applyGroupBy(column)
  }

  static having<V = string>(column: keyof CommentsTable, operator: Operator, value: V): CommentModel {
    const instance = new CommentModel(undefined)

    return instance.applyHaving<V>(column, operator, value)
  }

  static inRandomOrder(): CommentModel {
    const instance = new CommentModel(undefined)

    return instance.applyInRandomOrder()
  }

  static whereColumn(first: keyof CommentsTable, operator: Operator, second: keyof CommentsTable): CommentModel {
    const instance = new CommentModel(undefined)

    return instance.applyWhereColumn(first, operator, second)
  }

  static async max(field: keyof CommentsTable): Promise<number> {
    const instance = new CommentModel(undefined)

    return await instance.applyMax(field)
  }

  static async min(field: keyof CommentsTable): Promise<number> {
    const instance = new CommentModel(undefined)

    return await instance.applyMin(field)
  }

  static async avg(field: keyof CommentsTable): Promise<number> {
    const instance = new CommentModel(undefined)

    return await instance.applyAvg(field)
  }

  static async sum(field: keyof CommentsTable): Promise<number> {
    const instance = new CommentModel(undefined)

    return await instance.applySum(field)
  }

  static async count(): Promise<number> {
    const instance = new CommentModel(undefined)

    return instance.applyCount()
  }

  static async get(): Promise<CommentModel[]> {
    const instance = new CommentModel(undefined)

    const results = await instance.applyGet()

    return results.map((item: CommentJsonResponse) => instance.createInstance(item))
  }

  static async pluck<K extends keyof CommentModel>(field: K): Promise<CommentModel[K][]> {
    const instance = new CommentModel(undefined)

    return await instance.applyPluck(field)
  }

  static async chunk(size: number, callback: (models: CommentModel[]) => Promise<void>): Promise<void> {
    const instance = new CommentModel(undefined)

    await instance.applyChunk(size, async (models) => {
      const modelInstances = models.map((item: CommentJsonResponse) => instance.createInstance(item))
      await callback(modelInstances)
    })
  }

  static async paginate(options: { limit?: number, offset?: number, page?: number } = { limit: 10, offset: 0, page: 1 }): Promise<{
    data: CommentModel[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }> {
    const instance = new CommentModel(undefined)

    const result = await instance.applyPaginate(options)

    return {
      data: result.data.map((item: CommentJsonResponse) => instance.createInstance(item)),
      paging: result.paging,
      next_cursor: result.next_cursor,
    }
  }

  // Instance method for creating model instances
  createInstance(data: CommentJsonResponse): CommentModel {
    return new CommentModel(data)
  }

  async applyCreate(newComment: NewComment): Promise<CommentModel> {
    const filteredValues = Object.fromEntries(
      Object.entries(newComment).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewComment

    await this.mapCustomSetters(filteredValues)

    filteredValues.uuid = randomUUIDv7()

    const result = await DB.instance.insertInto('comments')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await DB.instance.selectFrom('comments')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created Comment')
    }

    return this.createInstance(model)
  }

  async create(newComment: NewComment): Promise<CommentModel> {
    return await this.applyCreate(newComment)
  }

  static async create(newComment: NewComment): Promise<CommentModel> {
    const instance = new CommentModel(undefined)
    return await instance.applyCreate(newComment)
  }

  static async firstOrCreate(search: Partial<CommentsTable>, values: NewComment = {} as NewComment): Promise<CommentModel> {
    // First try to find a record matching the search criteria
    const instance = new CommentModel(undefined)

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
    const createData = { ...search, ...values } as NewComment
    return await CommentModel.create(createData)
  }

  static async updateOrCreate(search: Partial<CommentsTable>, values: NewComment = {} as NewComment): Promise<CommentModel> {
    // First try to find a record matching the search criteria
    const instance = new CommentModel(undefined)

    // Apply all search conditions
    for (const [key, value] of Object.entries(search)) {
      instance.selectFromQuery = instance.selectFromQuery.where(key, '=', value)
    }

    // Try to find the record
    const existingRecord = await instance.applyFirst()

    if (existingRecord) {
      // If record exists, update it with the new values
      const model = instance.createInstance(existingRecord)
      const updatedModel = await model.update(values as CommentUpdate)

      // Return the updated model instance
      if (updatedModel) {
        return updatedModel
      }

      // If update didn't return a model, fetch it again to ensure we have latest data
      const refreshedModel = await instance.applyFirst()
      return instance.createInstance(refreshedModel!)
    }

    // If no record exists, create a new one with combined search criteria and values
    const createData = { ...search, ...values } as NewComment
    return await CommentModel.create(createData)
  }

  async update(newComment: CommentUpdate): Promise<CommentModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newComment).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as CommentUpdate

    await this.mapCustomSetters(filteredValues)

    filteredValues.updated_at = new Date().toISOString()

    await DB.instance.updateTable('comments')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('comments')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated Comment')
      }

      return this.createInstance(model)
    }

    return undefined
  }

  async forceUpdate(newComment: CommentUpdate): Promise<CommentModel | undefined> {
    await DB.instance.updateTable('comments')
      .set(newComment)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('comments')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated Comment')
      }

      return this.createInstance(model)
    }

    return undefined
  }

  async save(): Promise<CommentModel> {
    // If the model has an ID, update it; otherwise, create a new record
    if (this.id) {
      // Update existing record
      await DB.instance.updateTable('comments')
        .set(this.attributes as CommentUpdate)
        .where('id', '=', this.id)
        .executeTakeFirst()

      // Get the updated data
      const model = await DB.instance.selectFrom('comments')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated Comment')
      }

      return this.createInstance(model)
    }
    else {
      // Create new record
      const result = await DB.instance.insertInto('comments')
        .values(this.attributes as NewComment)
        .executeTakeFirst()

      // Get the created data
      const model = await DB.instance.selectFrom('comments')
        .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve created Comment')
      }

      return this.createInstance(model)
    }
  }

  static async createMany(newComment: NewComment[]): Promise<void> {
    const instance = new CommentModel(undefined)

    const valuesFiltered = newComment.map((newComment: NewComment) => {
      const filteredValues = Object.fromEntries(
        Object.entries(newComment).filter(([key]) =>
          !instance.guarded.includes(key) && instance.fillable.includes(key),
        ),
      ) as NewComment

      filteredValues.uuid = randomUUIDv7()

      return filteredValues
    })

    await DB.instance.insertInto('comments')
      .values(valuesFiltered)
      .executeTakeFirst()
  }

  static async forceCreate(newComment: NewComment): Promise<CommentModel> {
    const result = await DB.instance.insertInto('comments')
      .values(newComment)
      .executeTakeFirst()

    const instance = new CommentModel(undefined)
    const model = await DB.instance.selectFrom('comments')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created Comment')
    }

    return instance.createInstance(model)
  }

  // Method to remove a Comment
  async delete(): Promise<number> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()

    const deleted = await DB.instance.deleteFrom('comments')
      .where('id', '=', this.id)
      .execute()

    return deleted.numDeletedRows
  }

  static async remove(id: number): Promise<any> {
    return await DB.instance.deleteFrom('comments')
      .where('id', '=', id)
      .execute()
  }

  static whereTitle(value: string): CommentModel {
    const instance = new CommentModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('title', '=', value)

    return instance
  }

  static whereBody(value: string): CommentModel {
    const instance = new CommentModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('body', '=', value)

    return instance
  }

  static whereStatus(value: string): CommentModel {
    const instance = new CommentModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('status', '=', value)

    return instance
  }

  static whereApprovedAt(value: string): CommentModel {
    const instance = new CommentModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('approved_at', '=', value)

    return instance
  }

  static whereRejectedAt(value: string): CommentModel {
    const instance = new CommentModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('rejected_at', '=', value)

    return instance
  }

  static whereIn<V = number>(column: keyof CommentsTable, values: V[]): CommentModel {
    const instance = new CommentModel(undefined)

    return instance.applyWhereIn<V>(column, values)
  }

  async userBelong(): Promise<UserModel> {
    if (this.user_id === undefined)
      throw new HttpError(500, 'Relation Error!')

    const model = await User
      .where('id', '=', this.user_id)
      .first()

    if (!model)
      throw new HttpError(500, 'Model Relation Not Found!')

    return model
  }

  toSearchableObject(): Partial<CommentJsonResponse> {
    return {
      id: this.id,
      title: this.title,
      user_id: this.user_id,
      status: this.status,
      approved_at: this.approved_at,
      rejected_at: this.rejected_at,
    }
  }

  static distinct(column: keyof CommentJsonResponse): CommentModel {
    const instance = new CommentModel(undefined)

    return instance.applyDistinct(column)
  }

  static join(table: string, firstCol: string, secondCol: string): CommentModel {
    const instance = new CommentModel(undefined)

    return instance.applyJoin(table, firstCol, secondCol)
  }

  toJSON(): CommentJsonResponse {
    const output = {

      uuid: this.uuid,

      id: this.id,
      title: this.title,
      body: this.body,
      status: this.status,
      approved_at: this.approved_at,
      rejected_at: this.rejected_at,

      created_at: this.created_at,

      updated_at: this.updated_at,

      user_id: this.user_id,
      user: this.user,
      ...this.customColumns,
    }

    return output
  }

  parseResult(model: CommentModel): CommentModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof CommentModel]
    }

    return model
  }

  // Add a protected applyFind implementation
  protected async applyFind(id: number): Promise<CommentModel | undefined> {
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

export async function find(id: number): Promise<CommentModel | undefined> {
  const query = DB.instance.selectFrom('comments').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  const instance = new CommentModel(undefined)
  return instance.createInstance(model)
}

export async function count(): Promise<number> {
  const results = await CommentModel.count()

  return results
}

export async function create(newComment: NewComment): Promise<CommentModel> {
  const instance = new CommentModel(undefined)
  return await instance.applyCreate(newComment)
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(DB.instance)
}

export async function remove(id: number): Promise<void> {
  await DB.instance.deleteFrom('comments')
    .where('id', '=', id)
    .execute()
}

export async function whereTitle(value: string): Promise<CommentModel[]> {
  const query = DB.instance.selectFrom('comments').where('title', '=', value)
  const results: CommentJsonResponse = await query.execute()

  return results.map((modelItem: CommentJsonResponse) => new CommentModel(modelItem))
}

export async function whereBody(value: string): Promise<CommentModel[]> {
  const query = DB.instance.selectFrom('comments').where('body', '=', value)
  const results: CommentJsonResponse = await query.execute()

  return results.map((modelItem: CommentJsonResponse) => new CommentModel(modelItem))
}

export async function whereStatus(value: string | string[]): Promise<CommentModel[]> {
  const query = DB.instance.selectFrom('comments').where('status', '=', value)
  const results: CommentJsonResponse = await query.execute()

  return results.map((modelItem: CommentJsonResponse) => new CommentModel(modelItem))
}

export async function whereApprovedAt(value: number): Promise<CommentModel[]> {
  const query = DB.instance.selectFrom('comments').where('approved_at', '=', value)
  const results: CommentJsonResponse = await query.execute()

  return results.map((modelItem: CommentJsonResponse) => new CommentModel(modelItem))
}

export async function whereRejectedAt(value: number): Promise<CommentModel[]> {
  const query = DB.instance.selectFrom('comments').where('rejected_at', '=', value)
  const results: CommentJsonResponse = await query.execute()

  return results.map((modelItem: CommentJsonResponse) => new CommentModel(modelItem))
}

export const Comment = CommentModel

export default Comment
