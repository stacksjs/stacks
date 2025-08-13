import type { RawBuilder } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import type { AuthorJsonResponse, AuthorsTable, AuthorUpdate, NewAuthor } from '../types/AuthorType'
import type { PostModel } from './Post'
import type { UserModel } from './User'
import { randomUUIDv7 } from 'bun'
import { sql } from '@stacksjs/database'
import { HttpError } from '@stacksjs/error-handling'
import { dispatch } from '@stacksjs/events'
import { DB } from '@stacksjs/orm'

import { BaseOrm } from '../utils/base'

export class AuthorModel extends BaseOrm<AuthorModel, AuthorsTable, AuthorJsonResponse> {
  private readonly hidden: Array<keyof AuthorJsonResponse> = []
  private readonly fillable: Array<keyof AuthorJsonResponse> = ['name', 'email', 'uuid', 'two_factor_secret', 'public_key', 'user_id']
  private readonly guarded: Array<keyof AuthorJsonResponse> = []
  protected attributes = {} as AuthorJsonResponse
  protected originalAttributes = {} as AuthorJsonResponse

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

  constructor(author: AuthorJsonResponse | undefined) {
    super('authors')
    if (author) {
      this.attributes = { ...author }
      this.originalAttributes = { ...author }

      Object.keys(author).forEach((key) => {
        if (!(key in this)) {
          this.customColumns[key] = (author as AuthorJsonResponse)[key]
        }
      })
    }

    this.withRelations = []
    this.selectFromQuery = DB.instance.selectFrom('authors')
    this.updateFromQuery = DB.instance.updateTable('authors')
    this.deleteFromQuery = DB.instance.deleteFrom('authors')
    this.hasSelect = false
  }

  protected async loadRelations(models: AuthorJsonResponse | AuthorJsonResponse[]): Promise<void> {
    // Handle both single model and array of models
    const modelArray = Array.isArray(models) ? models : [models]
    if (!modelArray.length)
      return

    const modelIds = modelArray.map(model => model.id)

    for (const relation of this.withRelations) {
      const relatedRecords = await DB.instance
        .selectFrom(relation)
        .where('author_id', 'in', modelIds)
        .selectAll()
        .execute()

      if (Array.isArray(models)) {
        models.map((model: AuthorJsonResponse) => {
          const records = relatedRecords.filter((record: { author_id: number }) => {
            return record.author_id === model.id
          })

          model[relation] = records.length === 1 ? records[0] : records
          return model
        })
      }
      else {
        const records = relatedRecords.filter((record: { author_id: number }) => {
          return record.author_id === models.id
        })

        models[relation] = records.length === 1 ? records[0] : records
      }
    }
  }

  static with(relations: string[]): AuthorModel {
    const instance = new AuthorModel(undefined)

    return instance.applyWith(relations)
  }

  protected mapCustomGetters(models: AuthorJsonResponse | AuthorJsonResponse[]): void {
    const data = models

    if (Array.isArray(data)) {
      data.map((model: AuthorJsonResponse) => {
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

  async mapCustomSetters(model: NewAuthor): Promise<void> {
    const customSetter = {
      default: () => {
      },

    }

    for (const [key, fn] of Object.entries(customSetter)) {
      (model as any)[key] = await fn()
    }
  }

  get posts(): PostModel[] | [] {
    return this.attributes.posts
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

  get public_passkey(): string | undefined {
    return this.attributes.public_passkey
  }

  get name(): string {
    return this.attributes.name
  }

  get email(): string {
    return this.attributes.email
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

  set public_passkey(value: string) {
    this.attributes.public_passkey = value
  }

  set name(value: string) {
    this.attributes.name = value
  }

  set email(value: string) {
    this.attributes.email = value
  }

  set updated_at(value: string) {
    this.attributes.updated_at = value
  }

  static select(params: (keyof AuthorJsonResponse)[] | RawBuilder<string> | string): AuthorModel {
    const instance = new AuthorModel(undefined)

    return instance.applySelect(params)
  }

  // Method to find a Author by ID
  static async find(id: number): Promise<AuthorModel | undefined> {
    const query = DB.instance.selectFrom('authors').where('id', '=', id).selectAll()

    const model = await query.executeTakeFirst()

    if (!model)
      return undefined

    const instance = new AuthorModel(undefined)
    return instance.createInstance(model)
  }

  static async first(): Promise<AuthorModel | undefined> {
    const instance = new AuthorModel(undefined)

    const model = await instance.applyFirst()

    const data = new AuthorModel(model)

    return data
  }

  static async last(): Promise<AuthorModel | undefined> {
    const instance = new AuthorModel(undefined)

    const model = await instance.applyLast()

    if (!model)
      return undefined

    return new AuthorModel(model)
  }

  static async firstOrFail(): Promise<AuthorModel | undefined> {
    const instance = new AuthorModel(undefined)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<AuthorModel[]> {
    const instance = new AuthorModel(undefined)

    const models = await DB.instance.selectFrom('authors').selectAll().execute()

    instance.mapCustomGetters(models)

    const data = await Promise.all(models.map(async (model: AuthorJsonResponse) => {
      return new AuthorModel(model)
    }))

    return data
  }

  static async findOrFail(id: number): Promise<AuthorModel | undefined> {
    const instance = new AuthorModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  static async findMany(ids: number[]): Promise<AuthorModel[]> {
    const instance = new AuthorModel(undefined)

    const models = await instance.applyFindMany(ids)

    return models.map((modelItem: AuthorJsonResponse) => instance.parseResult(new AuthorModel(modelItem)))
  }

  static async latest(column: keyof AuthorsTable = 'created_at'): Promise<AuthorModel | undefined> {
    const instance = new AuthorModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'desc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new AuthorModel(model)
  }

  static async oldest(column: keyof AuthorsTable = 'created_at'): Promise<AuthorModel | undefined> {
    const instance = new AuthorModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'asc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new AuthorModel(model)
  }

  static skip(count: number): AuthorModel {
    const instance = new AuthorModel(undefined)

    return instance.applySkip(count)
  }

  static take(count: number): AuthorModel {
    const instance = new AuthorModel(undefined)

    return instance.applyTake(count)
  }

  static where<V = string>(column: keyof AuthorsTable, ...args: [V] | [Operator, V]): AuthorModel {
    const instance = new AuthorModel(undefined)

    return instance.applyWhere<V>(column, ...args)
  }

  static orWhere(...conditions: [string, any][]): AuthorModel {
    const instance = new AuthorModel(undefined)

    return instance.applyOrWhere(...conditions)
  }

  static whereNotIn<V = number>(column: keyof AuthorsTable, values: V[]): AuthorModel {
    const instance = new AuthorModel(undefined)

    return instance.applyWhereNotIn<V>(column, values)
  }

  static whereBetween<V = number>(column: keyof AuthorsTable, range: [V, V]): AuthorModel {
    const instance = new AuthorModel(undefined)

    return instance.applyWhereBetween<V>(column, range)
  }

  static whereRef(column: keyof AuthorsTable, ...args: string[]): AuthorModel {
    const instance = new AuthorModel(undefined)

    return instance.applyWhereRef(column, ...args)
  }

  static when(condition: boolean, callback: (query: AuthorModel) => AuthorModel): AuthorModel {
    const instance = new AuthorModel(undefined)

    return instance.applyWhen(condition, callback as any)
  }

  static whereNull(column: keyof AuthorsTable): AuthorModel {
    const instance = new AuthorModel(undefined)

    return instance.applyWhereNull(column)
  }

  static whereNotNull(column: keyof AuthorsTable): AuthorModel {
    const instance = new AuthorModel(undefined)

    return instance.applyWhereNotNull(column)
  }

  static whereLike(column: keyof AuthorsTable, value: string): AuthorModel {
    const instance = new AuthorModel(undefined)

    return instance.applyWhereLike(column, value)
  }

  static orderBy(column: keyof AuthorsTable, order: 'asc' | 'desc'): AuthorModel {
    const instance = new AuthorModel(undefined)

    return instance.applyOrderBy(column, order)
  }

  static orderByAsc(column: keyof AuthorsTable): AuthorModel {
    const instance = new AuthorModel(undefined)

    return instance.applyOrderByAsc(column)
  }

  static orderByDesc(column: keyof AuthorsTable): AuthorModel {
    const instance = new AuthorModel(undefined)

    return instance.applyOrderByDesc(column)
  }

  static groupBy(column: keyof AuthorsTable): AuthorModel {
    const instance = new AuthorModel(undefined)

    return instance.applyGroupBy(column)
  }

  static having<V = string>(column: keyof AuthorsTable, operator: Operator, value: V): AuthorModel {
    const instance = new AuthorModel(undefined)

    return instance.applyHaving<V>(column, operator, value)
  }

  static inRandomOrder(): AuthorModel {
    const instance = new AuthorModel(undefined)

    return instance.applyInRandomOrder()
  }

  static whereColumn(first: keyof AuthorsTable, operator: Operator, second: keyof AuthorsTable): AuthorModel {
    const instance = new AuthorModel(undefined)

    return instance.applyWhereColumn(first, operator, second)
  }

  static async max(field: keyof AuthorsTable): Promise<number> {
    const instance = new AuthorModel(undefined)

    return await instance.applyMax(field)
  }

  static async min(field: keyof AuthorsTable): Promise<number> {
    const instance = new AuthorModel(undefined)

    return await instance.applyMin(field)
  }

  static async avg(field: keyof AuthorsTable): Promise<number> {
    const instance = new AuthorModel(undefined)

    return await instance.applyAvg(field)
  }

  static async sum(field: keyof AuthorsTable): Promise<number> {
    const instance = new AuthorModel(undefined)

    return await instance.applySum(field)
  }

  static async count(): Promise<number> {
    const instance = new AuthorModel(undefined)

    return instance.applyCount()
  }

  static async get(): Promise<AuthorModel[]> {
    const instance = new AuthorModel(undefined)

    const results = await instance.applyGet()

    return results.map((item: AuthorJsonResponse) => instance.createInstance(item))
  }

  static async pluck<K extends keyof AuthorModel>(field: K): Promise<AuthorModel[K][]> {
    const instance = new AuthorModel(undefined)

    return await instance.applyPluck(field)
  }

  static async chunk(size: number, callback: (models: AuthorModel[]) => Promise<void>): Promise<void> {
    const instance = new AuthorModel(undefined)

    await instance.applyChunk(size, async (models) => {
      const modelInstances = models.map((item: AuthorJsonResponse) => instance.createInstance(item))
      await callback(modelInstances)
    })
  }

  static async paginate(options: { limit?: number, offset?: number, page?: number } = { limit: 10, offset: 0, page: 1 }): Promise<{
    data: AuthorModel[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }> {
    const instance = new AuthorModel(undefined)

    const result = await instance.applyPaginate(options)

    return {
      data: result.data.map((item: AuthorJsonResponse) => instance.createInstance(item)),
      paging: result.paging,
      next_cursor: result.next_cursor,
    }
  }

  // Instance method for creating model instances
  createInstance(data: AuthorJsonResponse): AuthorModel {
    return new AuthorModel(data)
  }

  async applyCreate(newAuthor: NewAuthor): Promise<AuthorModel> {
    const filteredValues = Object.fromEntries(
      Object.entries(newAuthor).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewAuthor

    await this.mapCustomSetters(filteredValues)

    filteredValues.uuid = randomUUIDv7()

    const result = await DB.instance.insertInto('authors')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await DB.instance.selectFrom('authors')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created Author')
    }

    if (model)
      dispatch('author:created', model)
    return this.createInstance(model)
  }

  async create(newAuthor: NewAuthor): Promise<AuthorModel> {
    return await this.applyCreate(newAuthor)
  }

  static async create(newAuthor: NewAuthor): Promise<AuthorModel> {
    const instance = new AuthorModel(undefined)
    return await instance.applyCreate(newAuthor)
  }

  static async firstOrCreate(search: Partial<AuthorsTable>, values: NewAuthor = {} as NewAuthor): Promise<AuthorModel> {
    // First try to find a record matching the search criteria
    const instance = new AuthorModel(undefined)

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
    const createData = { ...search, ...values } as NewAuthor
    return await AuthorModel.create(createData)
  }

  static async updateOrCreate(search: Partial<AuthorsTable>, values: NewAuthor = {} as NewAuthor): Promise<AuthorModel> {
    // First try to find a record matching the search criteria
    const instance = new AuthorModel(undefined)

    // Apply all search conditions
    for (const [key, value] of Object.entries(search)) {
      instance.selectFromQuery = instance.selectFromQuery.where(key, '=', value)
    }

    // Try to find the record
    const existingRecord = await instance.applyFirst()

    if (existingRecord) {
      // If record exists, update it with the new values
      const model = instance.createInstance(existingRecord)
      const updatedModel = await model.update(values as AuthorUpdate)

      // Return the updated model instance
      if (updatedModel) {
        return updatedModel
      }

      // If update didn't return a model, fetch it again to ensure we have latest data
      const refreshedModel = await instance.applyFirst()
      return instance.createInstance(refreshedModel!)
    }

    // If no record exists, create a new one with combined search criteria and values
    const createData = { ...search, ...values } as NewAuthor
    return await AuthorModel.create(createData)
  }

  async update(newAuthor: AuthorUpdate): Promise<AuthorModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newAuthor).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as AuthorUpdate

    await this.mapCustomSetters(filteredValues)

    filteredValues.updated_at = new Date().toISOString()

    await DB.instance.updateTable('authors')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('authors')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated Author')
      }

      if (model)
        dispatch('author:updated', model)
      return this.createInstance(model)
    }

    return undefined
  }

  async forceUpdate(newAuthor: AuthorUpdate): Promise<AuthorModel | undefined> {
    await DB.instance.updateTable('authors')
      .set(newAuthor)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('authors')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated Author')
      }

      if (this)
        dispatch('author:updated', model)
      return this.createInstance(model)
    }

    return undefined
  }

  async save(): Promise<AuthorModel> {
    // If the model has an ID, update it; otherwise, create a new record
    if (this.id) {
      // Update existing record
      await DB.instance.updateTable('authors')
        .set(this.attributes as AuthorUpdate)
        .where('id', '=', this.id)
        .executeTakeFirst()

      // Get the updated data
      const model = await DB.instance.selectFrom('authors')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated Author')
      }

      if (this)
        dispatch('author:updated', model)
      return this.createInstance(model)
    }
    else {
      // Create new record
      const result = await DB.instance.insertInto('authors')
        .values(this.attributes as NewAuthor)
        .executeTakeFirst()

      // Get the created data
      const model = await DB.instance.selectFrom('authors')
        .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve created Author')
      }

      if (this)
        dispatch('author:created', model)
      return this.createInstance(model)
    }
  }

  static async createMany(newAuthor: NewAuthor[]): Promise<void> {
    const instance = new AuthorModel(undefined)

    const valuesFiltered = newAuthor.map((newAuthor: NewAuthor) => {
      const filteredValues = Object.fromEntries(
        Object.entries(newAuthor).filter(([key]) =>
          !instance.guarded.includes(key) && instance.fillable.includes(key),
        ),
      ) as NewAuthor

      filteredValues.uuid = randomUUIDv7()

      return filteredValues
    })

    await DB.instance.insertInto('authors')
      .values(valuesFiltered)
      .executeTakeFirst()
  }

  static async forceCreate(newAuthor: NewAuthor): Promise<AuthorModel> {
    const result = await DB.instance.insertInto('authors')
      .values(newAuthor)
      .executeTakeFirst()

    const instance = new AuthorModel(undefined)
    const model = await DB.instance.selectFrom('authors')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created Author')
    }

    if (model)
      dispatch('author:created', model)

    return instance.createInstance(model)
  }

  // Method to remove a Author
  async delete(): Promise<number> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()
    const model = await this.find(Number(this.id))

    if (model)
      dispatch('author:deleted', model)

    const deleted = await DB.instance.deleteFrom('authors')
      .where('id', '=', this.id)
      .execute()

    return deleted.numDeletedRows
  }

  static async remove(id: number): Promise<any> {
    const instance = new AuthorModel(undefined)

    const model = await instance.find(Number(id))

    if (model)
      dispatch('author:deleted', model)

    return await DB.instance.deleteFrom('authors')
      .where('id', '=', id)
      .execute()
  }

  static whereName(value: string): AuthorModel {
    const instance = new AuthorModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('name', '=', value)

    return instance
  }

  static whereEmail(value: string): AuthorModel {
    const instance = new AuthorModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('email', '=', value)

    return instance
  }

  static whereIn<V = number>(column: keyof AuthorsTable, values: V[]): AuthorModel {
    const instance = new AuthorModel(undefined)

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

  toSearchableObject(): Partial<AuthorJsonResponse> {
    return {
      id: this.id,
      name: this.name,
      email: this.email,
    }
  }

  static distinct(column: keyof AuthorJsonResponse): AuthorModel {
    const instance = new AuthorModel(undefined)

    return instance.applyDistinct(column)
  }

  static join(table: string, firstCol: string, secondCol: string): AuthorModel {
    const instance = new AuthorModel(undefined)

    return instance.applyJoin(table, firstCol, secondCol)
  }

  toJSON(): AuthorJsonResponse {
    const output = {

      uuid: this.uuid,

      id: this.id,
      name: this.name,
      email: this.email,

      created_at: this.created_at,

      updated_at: this.updated_at,

      posts: this.posts,
      user_id: this.user_id,
      user: this.user,
      ...this.customColumns,
    }

    return output
  }

  parseResult(model: AuthorModel): AuthorModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof AuthorModel]
    }

    return model
  }

  // Add a protected applyFind implementation
  protected async applyFind(id: number): Promise<AuthorModel | undefined> {
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

export async function find(id: number): Promise<AuthorModel | undefined> {
  const query = DB.instance.selectFrom('authors').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  const instance = new AuthorModel(undefined)
  return instance.createInstance(model)
}

export async function count(): Promise<number> {
  const results = await AuthorModel.count()

  return results
}

export async function create(newAuthor: NewAuthor): Promise<AuthorModel> {
  const instance = new AuthorModel(undefined)
  return await instance.applyCreate(newAuthor)
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(DB.instance)
}

export async function remove(id: number): Promise<void> {
  await DB.instance.deleteFrom('authors')
    .where('id', '=', id)
    .execute()
}

export async function whereName(value: string): Promise<AuthorModel[]> {
  const query = DB.instance.selectFrom('authors').where('name', '=', value)
  const results: AuthorJsonResponse = await query.execute()

  return results.map((modelItem: AuthorJsonResponse) => new AuthorModel(modelItem))
}

export async function whereEmail(value: string): Promise<AuthorModel[]> {
  const query = DB.instance.selectFrom('authors').where('email', '=', value)
  const results: AuthorJsonResponse = await query.execute()

  return results.map((modelItem: AuthorJsonResponse) => new AuthorModel(modelItem))
}

export const Author = AuthorModel

export default Author
