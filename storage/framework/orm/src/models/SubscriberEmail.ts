import type { RawBuilder } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
// soon, these will be auto-imported
import type { NewSubscriberEmail, SubscriberEmailJsonResponse, SubscriberEmailsTable, SubscriberEmailUpdate } from '../types/SubscriberEmailType'
import { sql } from '@stacksjs/database'
import { HttpError } from '@stacksjs/error-handling'
import { DB } from '@stacksjs/orm'

import { BaseOrm } from '../utils/base'

export class SubscriberEmailModel extends BaseOrm<SubscriberEmailModel, SubscriberEmailsTable, SubscriberEmailJsonResponse> {
  private readonly hidden: Array<keyof SubscriberEmailJsonResponse> = []
  private readonly fillable: Array<keyof SubscriberEmailJsonResponse> = ['email']
  private readonly guarded: Array<keyof SubscriberEmailJsonResponse> = []
  protected attributes = {} as SubscriberEmailJsonResponse
  protected originalAttributes = {} as SubscriberEmailJsonResponse
  private softDeletes = false
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

  constructor(subscriberEmail: SubscriberEmailJsonResponse | undefined) {
    super('subscriber_emails')
    if (subscriberEmail) {
      this.attributes = { ...subscriberEmail }
      this.originalAttributes = { ...subscriberEmail }

      Object.keys(subscriberEmail).forEach((key) => {
        if (!(key in this)) {
          this.customColumns[key] = (subscriberEmail as SubscriberEmailJsonResponse)[key]
        }
      })
    }

    this.withRelations = []
    this.selectFromQuery = DB.instance.selectFrom('subscriber_emails')
    this.updateFromQuery = DB.instance.updateTable('subscriber_emails')
    this.deleteFromQuery = DB.instance.deleteFrom('subscriber_emails')
    this.hasSelect = false
  }

  protected async loadRelations(models: SubscriberEmailJsonResponse | SubscriberEmailJsonResponse[]): Promise<void> {
    // Handle both single model and array of models
    const modelArray = Array.isArray(models) ? models : [models]
    if (!modelArray.length)
      return

    const modelIds = modelArray.map(model => model.id)

    for (const relation of this.withRelations) {
      const relatedRecords = await DB.instance
        .selectFrom(relation)
        .where('subscriberEmail_id', 'in', modelIds)
        .selectAll()
        .execute()

      if (Array.isArray(models)) {
        models.map((model: SubscriberEmailJsonResponse) => {
          const records = relatedRecords.filter((record: { subscriberEmail_id: number }) => {
            return record.subscriberEmail_id === model.id
          })

          model[relation] = records.length === 1 ? records[0] : records
          return model
        })
      }
      else {
        const records = relatedRecords.filter((record: { subscriberEmail_id: number }) => {
          return record.subscriberEmail_id === models.id
        })

        models[relation] = records.length === 1 ? records[0] : records
      }
    }
  }

  static with(relations: string[]): SubscriberEmailModel {
    const instance = new SubscriberEmailModel(undefined)

    return instance.applyWith(relations)
  }

  protected mapCustomGetters(models: SubscriberEmailJsonResponse | SubscriberEmailJsonResponse[]): void {
    const data = models

    if (Array.isArray(data)) {
      data.map((model: SubscriberEmailJsonResponse) => {
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

  async mapCustomSetters(model: NewSubscriberEmail): Promise<void> {
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

  get email(): string {
    return this.attributes.email
  }

  get created_at(): string | undefined {
    return this.attributes.created_at
  }

  get updated_at(): string | undefined {
    return this.attributes.updated_at
  }

  get deleted_at(): string | undefined {
    return this.attributes.deleted_at
  }

  set email(value: string) {
    this.attributes.email = value
  }

  set updated_at(value: string) {
    this.attributes.updated_at = value
  }

  set deleted_at(value: string) {
    this.attributes.deleted_at = value
  }

  static select(params: (keyof SubscriberEmailJsonResponse)[] | RawBuilder<string> | string): SubscriberEmailModel {
    const instance = new SubscriberEmailModel(undefined)

    return instance.applySelect(params)
  }

  // Method to find a SubscriberEmail by ID
  static async find(id: number): Promise<SubscriberEmailModel | undefined> {
    const query = DB.instance.selectFrom('subscriber_emails').where('id', '=', id).selectAll()

    const model = await query.executeTakeFirst()

    if (!model)
      return undefined

    const instance = new SubscriberEmailModel(undefined)
    return instance.createInstance(model)
  }

  static async first(): Promise<SubscriberEmailModel | undefined> {
    const instance = new SubscriberEmailModel(undefined)

    const model = await instance.applyFirst()

    const data = new SubscriberEmailModel(model)

    return data
  }

  static async last(): Promise<SubscriberEmailModel | undefined> {
    const instance = new SubscriberEmailModel(undefined)

    const model = await instance.applyLast()

    if (!model)
      return undefined

    return new SubscriberEmailModel(model)
  }

  static async firstOrFail(): Promise<SubscriberEmailModel | undefined> {
    const instance = new SubscriberEmailModel(undefined)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<SubscriberEmailModel[]> {
    const instance = new SubscriberEmailModel(undefined)

    const models = await DB.instance.selectFrom('subscriber_emails').selectAll().execute()

    instance.mapCustomGetters(models)

    const data = await Promise.all(models.map(async (model: SubscriberEmailJsonResponse) => {
      return new SubscriberEmailModel(model)
    }))

    return data
  }

  static async findOrFail(id: number): Promise<SubscriberEmailModel | undefined> {
    const instance = new SubscriberEmailModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  static async findMany(ids: number[]): Promise<SubscriberEmailModel[]> {
    const instance = new SubscriberEmailModel(undefined)
    if (instance.softDeletes) {
      query = query.where('deleted_at', 'is', null)
    }
    const models = await instance.applyFindMany(ids)

    return models.map((modelItem: SubscriberEmailJsonResponse) => instance.parseResult(new SubscriberEmailModel(modelItem)))
  }

  static async latest(column: keyof SubscriberEmailsTable = 'created_at'): Promise<SubscriberEmailModel | undefined> {
    const instance = new SubscriberEmailModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'desc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new SubscriberEmailModel(model)
  }

  static async oldest(column: keyof SubscriberEmailsTable = 'created_at'): Promise<SubscriberEmailModel | undefined> {
    const instance = new SubscriberEmailModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'asc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new SubscriberEmailModel(model)
  }

  static skip(count: number): SubscriberEmailModel {
    const instance = new SubscriberEmailModel(undefined)

    return instance.applySkip(count)
  }

  static take(count: number): SubscriberEmailModel {
    const instance = new SubscriberEmailModel(undefined)

    return instance.applyTake(count)
  }

  static where<V = string>(column: keyof SubscriberEmailsTable, ...args: [V] | [Operator, V]): SubscriberEmailModel {
    const instance = new SubscriberEmailModel(undefined)

    return instance.applyWhere<V>(column, ...args)
  }

  static orWhere(...conditions: [string, any][]): SubscriberEmailModel {
    const instance = new SubscriberEmailModel(undefined)

    return instance.applyOrWhere(...conditions)
  }

  static whereNotIn<V = number>(column: keyof SubscriberEmailsTable, values: V[]): SubscriberEmailModel {
    const instance = new SubscriberEmailModel(undefined)

    return instance.applyWhereNotIn<V>(column, values)
  }

  static whereBetween<V = number>(column: keyof SubscriberEmailsTable, range: [V, V]): SubscriberEmailModel {
    const instance = new SubscriberEmailModel(undefined)

    return instance.applyWhereBetween<V>(column, range)
  }

  static whereRef(column: keyof SubscriberEmailsTable, ...args: string[]): SubscriberEmailModel {
    const instance = new SubscriberEmailModel(undefined)

    return instance.applyWhereRef(column, ...args)
  }

  static when(condition: boolean, callback: (query: SubscriberEmailModel) => SubscriberEmailModel): SubscriberEmailModel {
    const instance = new SubscriberEmailModel(undefined)

    return instance.applyWhen(condition, callback as any)
  }

  static whereNull(column: keyof SubscriberEmailsTable): SubscriberEmailModel {
    const instance = new SubscriberEmailModel(undefined)

    return instance.applyWhereNull(column)
  }

  static whereNotNull(column: keyof SubscriberEmailsTable): SubscriberEmailModel {
    const instance = new SubscriberEmailModel(undefined)

    return instance.applyWhereNotNull(column)
  }

  static whereLike(column: keyof SubscriberEmailsTable, value: string): SubscriberEmailModel {
    const instance = new SubscriberEmailModel(undefined)

    return instance.applyWhereLike(column, value)
  }

  static orderBy(column: keyof SubscriberEmailsTable, order: 'asc' | 'desc'): SubscriberEmailModel {
    const instance = new SubscriberEmailModel(undefined)

    return instance.applyOrderBy(column, order)
  }

  static orderByAsc(column: keyof SubscriberEmailsTable): SubscriberEmailModel {
    const instance = new SubscriberEmailModel(undefined)

    return instance.applyOrderByAsc(column)
  }

  static orderByDesc(column: keyof SubscriberEmailsTable): SubscriberEmailModel {
    const instance = new SubscriberEmailModel(undefined)

    return instance.applyOrderByDesc(column)
  }

  static groupBy(column: keyof SubscriberEmailsTable): SubscriberEmailModel {
    const instance = new SubscriberEmailModel(undefined)

    return instance.applyGroupBy(column)
  }

  static having<V = string>(column: keyof SubscriberEmailsTable, operator: Operator, value: V): SubscriberEmailModel {
    const instance = new SubscriberEmailModel(undefined)

    return instance.applyHaving<V>(column, operator, value)
  }

  static inRandomOrder(): SubscriberEmailModel {
    const instance = new SubscriberEmailModel(undefined)

    return instance.applyInRandomOrder()
  }

  static whereColumn(first: keyof SubscriberEmailsTable, operator: Operator, second: keyof SubscriberEmailsTable): SubscriberEmailModel {
    const instance = new SubscriberEmailModel(undefined)

    return instance.applyWhereColumn(first, operator, second)
  }

  static async max(field: keyof SubscriberEmailsTable): Promise<number> {
    const instance = new SubscriberEmailModel(undefined)

    return await instance.applyMax(field)
  }

  static async min(field: keyof SubscriberEmailsTable): Promise<number> {
    const instance = new SubscriberEmailModel(undefined)

    return await instance.applyMin(field)
  }

  static async avg(field: keyof SubscriberEmailsTable): Promise<number> {
    const instance = new SubscriberEmailModel(undefined)

    return await instance.applyAvg(field)
  }

  static async sum(field: keyof SubscriberEmailsTable): Promise<number> {
    const instance = new SubscriberEmailModel(undefined)

    return await instance.applySum(field)
  }

  static async count(): Promise<number> {
    const instance = new SubscriberEmailModel(undefined)

    return instance.applyCount()
  }

  static async get(): Promise<SubscriberEmailModel[]> {
    const instance = new SubscriberEmailModel(undefined)

    const results = await instance.applyGet()

    return results.map((item: SubscriberEmailJsonResponse) => instance.createInstance(item))
  }

  static async pluck<K extends keyof SubscriberEmailModel>(field: K): Promise<SubscriberEmailModel[K][]> {
    const instance = new SubscriberEmailModel(undefined)

    return await instance.applyPluck(field)
  }

  static async chunk(size: number, callback: (models: SubscriberEmailModel[]) => Promise<void>): Promise<void> {
    const instance = new SubscriberEmailModel(undefined)

    await instance.applyChunk(size, async (models) => {
      const modelInstances = models.map((item: SubscriberEmailJsonResponse) => instance.createInstance(item))
      await callback(modelInstances)
    })
  }

  static async paginate(options: { limit?: number, offset?: number, page?: number } = { limit: 10, offset: 0, page: 1 }): Promise<{
    data: SubscriberEmailModel[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }> {
    const instance = new SubscriberEmailModel(undefined)

    const result = await instance.applyPaginate(options)

    return {
      data: result.data.map((item: SubscriberEmailJsonResponse) => instance.createInstance(item)),
      paging: result.paging,
      next_cursor: result.next_cursor,
    }
  }

  // Instance method for creating model instances
  createInstance(data: SubscriberEmailJsonResponse): SubscriberEmailModel {
    return new SubscriberEmailModel(data)
  }

  async applyCreate(newSubscriberEmail: NewSubscriberEmail): Promise<SubscriberEmailModel> {
    const filteredValues = Object.fromEntries(
      Object.entries(newSubscriberEmail).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewSubscriberEmail

    await this.mapCustomSetters(filteredValues)

    const result = await DB.instance.insertInto('subscriber_emails')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await DB.instance.selectFrom('subscriber_emails')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created SubscriberEmail')
    }

    return this.createInstance(model)
  }

  async create(newSubscriberEmail: NewSubscriberEmail): Promise<SubscriberEmailModel> {
    return await this.applyCreate(newSubscriberEmail)
  }

  static async create(newSubscriberEmail: NewSubscriberEmail): Promise<SubscriberEmailModel> {
    const instance = new SubscriberEmailModel(undefined)
    return await instance.applyCreate(newSubscriberEmail)
  }

  static async firstOrCreate(search: Partial<SubscriberEmailsTable>, values: NewSubscriberEmail = {} as NewSubscriberEmail): Promise<SubscriberEmailModel> {
    // First try to find a record matching the search criteria
    const instance = new SubscriberEmailModel(undefined)

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
    const createData = { ...search, ...values } as NewSubscriberEmail
    return await SubscriberEmailModel.create(createData)
  }

  static async updateOrCreate(search: Partial<SubscriberEmailsTable>, values: NewSubscriberEmail = {} as NewSubscriberEmail): Promise<SubscriberEmailModel> {
    // First try to find a record matching the search criteria
    const instance = new SubscriberEmailModel(undefined)

    // Apply all search conditions
    for (const [key, value] of Object.entries(search)) {
      instance.selectFromQuery = instance.selectFromQuery.where(key, '=', value)
    }

    // Try to find the record
    const existingRecord = await instance.applyFirst()

    if (existingRecord) {
      // If record exists, update it with the new values
      const model = instance.createInstance(existingRecord)
      const updatedModel = await model.update(values as SubscriberEmailUpdate)

      // Return the updated model instance
      if (updatedModel) {
        return updatedModel
      }

      // If update didn't return a model, fetch it again to ensure we have latest data
      const refreshedModel = await instance.applyFirst()
      return instance.createInstance(refreshedModel!)
    }

    // If no record exists, create a new one with combined search criteria and values
    const createData = { ...search, ...values } as NewSubscriberEmail
    return await SubscriberEmailModel.create(createData)
  }

  async update(newSubscriberEmail: SubscriberEmailUpdate): Promise<SubscriberEmailModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newSubscriberEmail).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as SubscriberEmailUpdate

    await this.mapCustomSetters(filteredValues)

    filteredValues.updated_at = new Date().toISOString()

    await DB.instance.updateTable('subscriber_emails')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('subscriber_emails')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated SubscriberEmail')
      }

      return this.createInstance(model)
    }

    return undefined
  }

  async forceUpdate(newSubscriberEmail: SubscriberEmailUpdate): Promise<SubscriberEmailModel | undefined> {
    await DB.instance.updateTable('subscriber_emails')
      .set(newSubscriberEmail)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('subscriber_emails')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated SubscriberEmail')
      }

      return this.createInstance(model)
    }

    return undefined
  }

  async save(): Promise<SubscriberEmailModel> {
    // If the model has an ID, update it; otherwise, create a new record
    if (this.id) {
      // Update existing record
      await DB.instance.updateTable('subscriber_emails')
        .set(this.attributes as SubscriberEmailUpdate)
        .where('id', '=', this.id)
        .executeTakeFirst()

      // Get the updated data
      const model = await DB.instance.selectFrom('subscriber_emails')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated SubscriberEmail')
      }

      return this.createInstance(model)
    }
    else {
      // Create new record
      const result = await DB.instance.insertInto('subscriber_emails')
        .values(this.attributes as NewSubscriberEmail)
        .executeTakeFirst()

      // Get the created data
      const model = await DB.instance.selectFrom('subscriber_emails')
        .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve created SubscriberEmail')
      }

      return this.createInstance(model)
    }
  }

  static async createMany(newSubscriberEmail: NewSubscriberEmail[]): Promise<void> {
    const instance = new SubscriberEmailModel(undefined)

    const valuesFiltered = newSubscriberEmail.map((newSubscriberEmail: NewSubscriberEmail) => {
      const filteredValues = Object.fromEntries(
        Object.entries(newSubscriberEmail).filter(([key]) =>
          !instance.guarded.includes(key) && instance.fillable.includes(key),
        ),
      ) as NewSubscriberEmail

      return filteredValues
    })

    await DB.instance.insertInto('subscriber_emails')
      .values(valuesFiltered)
      .executeTakeFirst()
  }

  static async forceCreate(newSubscriberEmail: NewSubscriberEmail): Promise<SubscriberEmailModel> {
    const result = await DB.instance.insertInto('subscriber_emails')
      .values(newSubscriberEmail)
      .executeTakeFirst()

    const instance = new SubscriberEmailModel(undefined)
    const model = await DB.instance.selectFrom('subscriber_emails')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created SubscriberEmail')
    }

    return instance.createInstance(model)
  }

  // Method to remove a SubscriberEmail
  async delete(): Promise<number> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()

    if (this.softDeletes) {
      return await DB.instance.updateTable('subscriber_emails')
        .set({
          deleted_at: sql.raw('CURRENT_TIMESTAMP'),
        })
        .where('id', '=', this.id)
        .execute()
    }

    const deleted = await DB.instance.deleteFrom('subscriber_emails')
      .where('id', '=', this.id)
      .execute()

    return deleted.numDeletedRows
  }

  static async remove(id: number): Promise<any> {
    const instance = new SubscriberEmailModel(undefined)

    if (instance.softDeletes) {
      return await DB.instance.updateTable('subscriber_emails')
        .set({
          deleted_at: sql.raw('CURRENT_TIMESTAMP'),
        })
        .where('id', '=', id)
        .execute()
    }

    return await DB.instance.deleteFrom('subscriber_emails')
      .where('id', '=', id)
      .execute()
  }

  static whereEmail(value: string): SubscriberEmailModel {
    const instance = new SubscriberEmailModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('email', '=', value)

    return instance
  }

  static whereIn<V = number>(column: keyof SubscriberEmailsTable, values: V[]): SubscriberEmailModel {
    const instance = new SubscriberEmailModel(undefined)

    return instance.applyWhereIn<V>(column, values)
  }

  static distinct(column: keyof SubscriberEmailJsonResponse): SubscriberEmailModel {
    const instance = new SubscriberEmailModel(undefined)

    return instance.applyDistinct(column)
  }

  static join(table: string, firstCol: string, secondCol: string): SubscriberEmailModel {
    const instance = new SubscriberEmailModel(undefined)

    return instance.applyJoin(table, firstCol, secondCol)
  }

  toJSON(): SubscriberEmailJsonResponse {
    const output = {

      id: this.id,
      email: this.email,

      created_at: this.created_at,

      updated_at: this.updated_at,

      deleted_at: this.deleted_at,

      ...this.customColumns,
    }

    return output
  }

  parseResult(model: SubscriberEmailModel): SubscriberEmailModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof SubscriberEmailModel]
    }

    return model
  }

  // Add a protected applyFind implementation
  protected async applyFind(id: number): Promise<SubscriberEmailModel | undefined> {
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

export async function find(id: number): Promise<SubscriberEmailModel | undefined> {
  const query = DB.instance.selectFrom('subscriber_emails').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  const instance = new SubscriberEmailModel(undefined)
  return instance.createInstance(model)
}

export async function count(): Promise<number> {
  const results = await SubscriberEmailModel.count()

  return results
}

export async function create(newSubscriberEmail: NewSubscriberEmail): Promise<SubscriberEmailModel> {
  const instance = new SubscriberEmailModel(undefined)
  return await instance.applyCreate(newSubscriberEmail)
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(DB.instance)
}

export async function remove(id: number): Promise<void> {
  await DB.instance.deleteFrom('subscriber_emails')
    .where('id', '=', id)
    .execute()
}

export async function whereEmail(value: string): Promise<SubscriberEmailModel[]> {
  const query = DB.instance.selectFrom('subscriber_emails').where('email', '=', value)
  const results: SubscriberEmailJsonResponse = await query.execute()

  return results.map((modelItem: SubscriberEmailJsonResponse) => new SubscriberEmailModel(modelItem))
}

export const SubscriberEmail = SubscriberEmailModel

export default SubscriberEmail
