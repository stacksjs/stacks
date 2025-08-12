import type { RawBuilder } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import type { NewSubscriber, SubscriberJsonResponse, SubscribersTable, SubscriberUpdate } from '../types/SubscriberType'
import { sql } from '@stacksjs/database'
import { HttpError } from '@stacksjs/error-handling'
import { DB } from '@stacksjs/orm'

import { BaseOrm } from '../utils/base'

export class SubscriberModel extends BaseOrm<SubscriberModel, SubscribersTable, SubscriberJsonResponse> {
  private readonly hidden: Array<keyof SubscriberJsonResponse> = []
  private readonly fillable: Array<keyof SubscriberJsonResponse> = ['subscribed', 'user_id']
  private readonly guarded: Array<keyof SubscriberJsonResponse> = []
  protected attributes = {} as SubscriberJsonResponse
  protected originalAttributes = {} as SubscriberJsonResponse

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

  constructor(subscriber: SubscriberJsonResponse | undefined) {
    super('subscribers')
    if (subscriber) {
      this.attributes = { ...subscriber }
      this.originalAttributes = { ...subscriber }

      Object.keys(subscriber).forEach((key) => {
        if (!(key in this)) {
          this.customColumns[key] = (subscriber as SubscriberJsonResponse)[key]
        }
      })
    }

    this.withRelations = []
    this.selectFromQuery = DB.instance.selectFrom('subscribers')
    this.updateFromQuery = DB.instance.updateTable('subscribers')
    this.deleteFromQuery = DB.instance.deleteFrom('subscribers')
    this.hasSelect = false
  }

  protected async loadRelations(models: SubscriberJsonResponse | SubscriberJsonResponse[]): Promise<void> {
    // Handle both single model and array of models
    const modelArray = Array.isArray(models) ? models : [models]
    if (!modelArray.length)
      return

    const modelIds = modelArray.map(model => model.id)

    for (const relation of this.withRelations) {
      const relatedRecords = await DB.instance
        .selectFrom(relation)
        .where('subscriber_id', 'in', modelIds)
        .selectAll()
        .execute()

      if (Array.isArray(models)) {
        models.map((model: SubscriberJsonResponse) => {
          const records = relatedRecords.filter((record: { subscriber_id: number }) => {
            return record.subscriber_id === model.id
          })

          model[relation] = records.length === 1 ? records[0] : records
          return model
        })
      }
      else {
        const records = relatedRecords.filter((record: { subscriber_id: number }) => {
          return record.subscriber_id === models.id
        })

        models[relation] = records.length === 1 ? records[0] : records
      }
    }
  }

  static with(relations: string[]): SubscriberModel {
    const instance = new SubscriberModel(undefined)

    return instance.applyWith(relations)
  }

  protected mapCustomGetters(models: SubscriberJsonResponse | SubscriberJsonResponse[]): void {
    const data = models

    if (Array.isArray(data)) {
      data.map((model: SubscriberJsonResponse) => {
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

  async mapCustomSetters(model: NewSubscriber): Promise<void> {
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

  get subscribed(): boolean {
    return this.attributes.subscribed
  }

  get created_at(): string | undefined {
    return this.attributes.created_at
  }

  get updated_at(): string | undefined {
    return this.attributes.updated_at
  }

  set subscribed(value: boolean) {
    this.attributes.subscribed = value
  }

  set updated_at(value: string) {
    this.attributes.updated_at = value
  }

  static select(params: (keyof SubscriberJsonResponse)[] | RawBuilder<string> | string): SubscriberModel {
    const instance = new SubscriberModel(undefined)

    return instance.applySelect(params)
  }

  // Method to find a Subscriber by ID
  static async find(id: number): Promise<SubscriberModel | undefined> {
    const query = DB.instance.selectFrom('subscribers').where('id', '=', id).selectAll()

    const model = await query.executeTakeFirst()

    if (!model)
      return undefined

    const instance = new SubscriberModel(undefined)
    return instance.createInstance(model)
  }

  static async first(): Promise<SubscriberModel | undefined> {
    const instance = new SubscriberModel(undefined)

    const model = await instance.applyFirst()

    const data = new SubscriberModel(model)

    return data
  }

  static async last(): Promise<SubscriberModel | undefined> {
    const instance = new SubscriberModel(undefined)

    const model = await instance.applyLast()

    if (!model)
      return undefined

    return new SubscriberModel(model)
  }

  static async firstOrFail(): Promise<SubscriberModel | undefined> {
    const instance = new SubscriberModel(undefined)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<SubscriberModel[]> {
    const instance = new SubscriberModel(undefined)

    const models = await DB.instance.selectFrom('subscribers').selectAll().execute()

    instance.mapCustomGetters(models)

    const data = await Promise.all(models.map(async (model: SubscriberJsonResponse) => {
      return new SubscriberModel(model)
    }))

    return data
  }

  static async findOrFail(id: number): Promise<SubscriberModel | undefined> {
    const instance = new SubscriberModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  static async findMany(ids: number[]): Promise<SubscriberModel[]> {
    const instance = new SubscriberModel(undefined)

    const models = await instance.applyFindMany(ids)

    return models.map((modelItem: SubscriberJsonResponse) => instance.parseResult(new SubscriberModel(modelItem)))
  }

  static async latest(column: keyof SubscribersTable = 'created_at'): Promise<SubscriberModel | undefined> {
    const instance = new SubscriberModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'desc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new SubscriberModel(model)
  }

  static async oldest(column: keyof SubscribersTable = 'created_at'): Promise<SubscriberModel | undefined> {
    const instance = new SubscriberModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'asc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new SubscriberModel(model)
  }

  static skip(count: number): SubscriberModel {
    const instance = new SubscriberModel(undefined)

    return instance.applySkip(count)
  }

  static take(count: number): SubscriberModel {
    const instance = new SubscriberModel(undefined)

    return instance.applyTake(count)
  }

  static where<V = string>(column: keyof SubscribersTable, ...args: [V] | [Operator, V]): SubscriberModel {
    const instance = new SubscriberModel(undefined)

    return instance.applyWhere<V>(column, ...args)
  }

  static orWhere(...conditions: [string, any][]): SubscriberModel {
    const instance = new SubscriberModel(undefined)

    return instance.applyOrWhere(...conditions)
  }

  static whereNotIn<V = number>(column: keyof SubscribersTable, values: V[]): SubscriberModel {
    const instance = new SubscriberModel(undefined)

    return instance.applyWhereNotIn<V>(column, values)
  }

  static whereBetween<V = number>(column: keyof SubscribersTable, range: [V, V]): SubscriberModel {
    const instance = new SubscriberModel(undefined)

    return instance.applyWhereBetween<V>(column, range)
  }

  static whereRef(column: keyof SubscribersTable, ...args: string[]): SubscriberModel {
    const instance = new SubscriberModel(undefined)

    return instance.applyWhereRef(column, ...args)
  }

  static when(condition: boolean, callback: (query: SubscriberModel) => SubscriberModel): SubscriberModel {
    const instance = new SubscriberModel(undefined)

    return instance.applyWhen(condition, callback as any)
  }

  static whereNull(column: keyof SubscribersTable): SubscriberModel {
    const instance = new SubscriberModel(undefined)

    return instance.applyWhereNull(column)
  }

  static whereNotNull(column: keyof SubscribersTable): SubscriberModel {
    const instance = new SubscriberModel(undefined)

    return instance.applyWhereNotNull(column)
  }

  static whereLike(column: keyof SubscribersTable, value: string): SubscriberModel {
    const instance = new SubscriberModel(undefined)

    return instance.applyWhereLike(column, value)
  }

  static orderBy(column: keyof SubscribersTable, order: 'asc' | 'desc'): SubscriberModel {
    const instance = new SubscriberModel(undefined)

    return instance.applyOrderBy(column, order)
  }

  static orderByAsc(column: keyof SubscribersTable): SubscriberModel {
    const instance = new SubscriberModel(undefined)

    return instance.applyOrderByAsc(column)
  }

  static orderByDesc(column: keyof SubscribersTable): SubscriberModel {
    const instance = new SubscriberModel(undefined)

    return instance.applyOrderByDesc(column)
  }

  static groupBy(column: keyof SubscribersTable): SubscriberModel {
    const instance = new SubscriberModel(undefined)

    return instance.applyGroupBy(column)
  }

  static having<V = string>(column: keyof SubscribersTable, operator: Operator, value: V): SubscriberModel {
    const instance = new SubscriberModel(undefined)

    return instance.applyHaving<V>(column, operator, value)
  }

  static inRandomOrder(): SubscriberModel {
    const instance = new SubscriberModel(undefined)

    return instance.applyInRandomOrder()
  }

  static whereColumn(first: keyof SubscribersTable, operator: Operator, second: keyof SubscribersTable): SubscriberModel {
    const instance = new SubscriberModel(undefined)

    return instance.applyWhereColumn(first, operator, second)
  }

  static async max(field: keyof SubscribersTable): Promise<number> {
    const instance = new SubscriberModel(undefined)

    return await instance.applyMax(field)
  }

  static async min(field: keyof SubscribersTable): Promise<number> {
    const instance = new SubscriberModel(undefined)

    return await instance.applyMin(field)
  }

  static async avg(field: keyof SubscribersTable): Promise<number> {
    const instance = new SubscriberModel(undefined)

    return await instance.applyAvg(field)
  }

  static async sum(field: keyof SubscribersTable): Promise<number> {
    const instance = new SubscriberModel(undefined)

    return await instance.applySum(field)
  }

  static async count(): Promise<number> {
    const instance = new SubscriberModel(undefined)

    return instance.applyCount()
  }

  static async get(): Promise<SubscriberModel[]> {
    const instance = new SubscriberModel(undefined)

    const results = await instance.applyGet()

    return results.map((item: SubscriberJsonResponse) => instance.createInstance(item))
  }

  static async pluck<K extends keyof SubscriberModel>(field: K): Promise<SubscriberModel[K][]> {
    const instance = new SubscriberModel(undefined)

    return await instance.applyPluck(field)
  }

  static async chunk(size: number, callback: (models: SubscriberModel[]) => Promise<void>): Promise<void> {
    const instance = new SubscriberModel(undefined)

    await instance.applyChunk(size, async (models) => {
      const modelInstances = models.map((item: SubscriberJsonResponse) => instance.createInstance(item))
      await callback(modelInstances)
    })
  }

  static async paginate(options: { limit?: number, offset?: number, page?: number } = { limit: 10, offset: 0, page: 1 }): Promise<{
    data: SubscriberModel[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }> {
    const instance = new SubscriberModel(undefined)

    const result = await instance.applyPaginate(options)

    return {
      data: result.data.map((item: SubscriberJsonResponse) => instance.createInstance(item)),
      paging: result.paging,
      next_cursor: result.next_cursor,
    }
  }

  // Instance method for creating model instances
  createInstance(data: SubscriberJsonResponse): SubscriberModel {
    return new SubscriberModel(data)
  }

  async applyCreate(newSubscriber: NewSubscriber): Promise<SubscriberModel> {
    const filteredValues = Object.fromEntries(
      Object.entries(newSubscriber).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewSubscriber

    await this.mapCustomSetters(filteredValues)

    const result = await DB.instance.insertInto('subscribers')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await DB.instance.selectFrom('subscribers')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created Subscriber')
    }

    return this.createInstance(model)
  }

  async create(newSubscriber: NewSubscriber): Promise<SubscriberModel> {
    return await this.applyCreate(newSubscriber)
  }

  static async create(newSubscriber: NewSubscriber): Promise<SubscriberModel> {
    const instance = new SubscriberModel(undefined)
    return await instance.applyCreate(newSubscriber)
  }

  static async firstOrCreate(search: Partial<SubscribersTable>, values: NewSubscriber = {} as NewSubscriber): Promise<SubscriberModel> {
    // First try to find a record matching the search criteria
    const instance = new SubscriberModel(undefined)

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
    const createData = { ...search, ...values } as NewSubscriber
    return await SubscriberModel.create(createData)
  }

  static async updateOrCreate(search: Partial<SubscribersTable>, values: NewSubscriber = {} as NewSubscriber): Promise<SubscriberModel> {
    // First try to find a record matching the search criteria
    const instance = new SubscriberModel(undefined)

    // Apply all search conditions
    for (const [key, value] of Object.entries(search)) {
      instance.selectFromQuery = instance.selectFromQuery.where(key, '=', value)
    }

    // Try to find the record
    const existingRecord = await instance.applyFirst()

    if (existingRecord) {
      // If record exists, update it with the new values
      const model = instance.createInstance(existingRecord)
      const updatedModel = await model.update(values as SubscriberUpdate)

      // Return the updated model instance
      if (updatedModel) {
        return updatedModel
      }

      // If update didn't return a model, fetch it again to ensure we have latest data
      const refreshedModel = await instance.applyFirst()
      return instance.createInstance(refreshedModel!)
    }

    // If no record exists, create a new one with combined search criteria and values
    const createData = { ...search, ...values } as NewSubscriber
    return await SubscriberModel.create(createData)
  }

  async update(newSubscriber: SubscriberUpdate): Promise<SubscriberModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newSubscriber).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as SubscriberUpdate

    await this.mapCustomSetters(filteredValues)

    filteredValues.updated_at = new Date().toISOString()

    await DB.instance.updateTable('subscribers')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('subscribers')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated Subscriber')
      }

      return this.createInstance(model)
    }

    return undefined
  }

  async forceUpdate(newSubscriber: SubscriberUpdate): Promise<SubscriberModel | undefined> {
    await DB.instance.updateTable('subscribers')
      .set(newSubscriber)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('subscribers')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated Subscriber')
      }

      return this.createInstance(model)
    }

    return undefined
  }

  async save(): Promise<SubscriberModel> {
    // If the model has an ID, update it; otherwise, create a new record
    if (this.id) {
      // Update existing record
      await DB.instance.updateTable('subscribers')
        .set(this.attributes as SubscriberUpdate)
        .where('id', '=', this.id)
        .executeTakeFirst()

      // Get the updated data
      const model = await DB.instance.selectFrom('subscribers')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated Subscriber')
      }

      return this.createInstance(model)
    }
    else {
      // Create new record
      const result = await DB.instance.insertInto('subscribers')
        .values(this.attributes as NewSubscriber)
        .executeTakeFirst()

      // Get the created data
      const model = await DB.instance.selectFrom('subscribers')
        .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve created Subscriber')
      }

      return this.createInstance(model)
    }
  }

  static async createMany(newSubscriber: NewSubscriber[]): Promise<void> {
    const instance = new SubscriberModel(undefined)

    const valuesFiltered = newSubscriber.map((newSubscriber: NewSubscriber) => {
      const filteredValues = Object.fromEntries(
        Object.entries(newSubscriber).filter(([key]) =>
          !instance.guarded.includes(key) && instance.fillable.includes(key),
        ),
      ) as NewSubscriber

      return filteredValues
    })

    await DB.instance.insertInto('subscribers')
      .values(valuesFiltered)
      .executeTakeFirst()
  }

  static async forceCreate(newSubscriber: NewSubscriber): Promise<SubscriberModel> {
    const result = await DB.instance.insertInto('subscribers')
      .values(newSubscriber)
      .executeTakeFirst()

    const instance = new SubscriberModel(undefined)
    const model = await DB.instance.selectFrom('subscribers')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created Subscriber')
    }

    return instance.createInstance(model)
  }

  // Method to remove a Subscriber
  async delete(): Promise<number> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()

    const deleted = await DB.instance.deleteFrom('subscribers')
      .where('id', '=', this.id)
      .execute()

    return deleted.numDeletedRows
  }

  static async remove(id: number): Promise<any> {
    return await DB.instance.deleteFrom('subscribers')
      .where('id', '=', id)
      .execute()
  }

  static whereSubscribed(value: string): SubscriberModel {
    const instance = new SubscriberModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('subscribed', '=', value)

    return instance
  }

  static whereIn<V = number>(column: keyof SubscribersTable, values: V[]): SubscriberModel {
    const instance = new SubscriberModel(undefined)

    return instance.applyWhereIn<V>(column, values)
  }

  static distinct(column: keyof SubscriberJsonResponse): SubscriberModel {
    const instance = new SubscriberModel(undefined)

    return instance.applyDistinct(column)
  }

  static join(table: string, firstCol: string, secondCol: string): SubscriberModel {
    const instance = new SubscriberModel(undefined)

    return instance.applyJoin(table, firstCol, secondCol)
  }

  toJSON(): SubscriberJsonResponse {
    const output = {

      id: this.id,
      subscribed: this.subscribed,

      created_at: this.created_at,

      updated_at: this.updated_at,

      ...this.customColumns,
    }

    return output
  }

  parseResult(model: SubscriberModel): SubscriberModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof SubscriberModel]
    }

    return model
  }

  // Add a protected applyFind implementation
  protected async applyFind(id: number): Promise<SubscriberModel | undefined> {
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

export async function find(id: number): Promise<SubscriberModel | undefined> {
  const query = DB.instance.selectFrom('subscribers').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  const instance = new SubscriberModel(undefined)
  return instance.createInstance(model)
}

export async function count(): Promise<number> {
  const results = await SubscriberModel.count()

  return results
}

export async function create(newSubscriber: NewSubscriber): Promise<SubscriberModel> {
  const instance = new SubscriberModel(undefined)
  return await instance.applyCreate(newSubscriber)
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(DB.instance)
}

export async function remove(id: number): Promise<void> {
  await DB.instance.deleteFrom('subscribers')
    .where('id', '=', id)
    .execute()
}

export async function whereSubscribed(value: boolean): Promise<SubscriberModel[]> {
  const query = DB.instance.selectFrom('subscribers').where('subscribed', '=', value)
  const results: SubscriberJsonResponse = await query.execute()

  return results.map((modelItem: SubscriberJsonResponse) => new SubscriberModel(modelItem))
}

export const Subscriber = SubscriberModel

export default Subscriber
