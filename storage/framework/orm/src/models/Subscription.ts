import type { RawBuilder } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import type { NewSubscription, SubscriptionJsonResponse, SubscriptionsTable, SubscriptionUpdate } from '../types/SubscriptionType'
import type { UserModel } from './User'
import { randomUUIDv7 } from 'bun'
import { sql } from '@stacksjs/database'
import { HttpError } from '@stacksjs/error-handling'
import { DB } from '@stacksjs/orm'

import { BaseOrm } from '../utils/base'

export class SubscriptionModel extends BaseOrm<SubscriptionModel, SubscriptionsTable, SubscriptionJsonResponse> {
  private readonly hidden: Array<keyof SubscriptionJsonResponse> = []
  private readonly fillable: Array<keyof SubscriptionJsonResponse> = ['type', 'plan', 'provider_id', 'provider_status', 'unit_price', 'provider_type', 'provider_price_id', 'quantity', 'trial_ends_at', 'ends_at', 'last_used_at', 'uuid']
  private readonly guarded: Array<keyof SubscriptionJsonResponse> = []
  protected attributes = {} as SubscriptionJsonResponse
  protected originalAttributes = {} as SubscriptionJsonResponse

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

  constructor(subscription: SubscriptionJsonResponse | undefined) {
    super('subscriptions')
    if (subscription) {
      this.attributes = { ...subscription }
      this.originalAttributes = { ...subscription }

      Object.keys(subscription).forEach((key) => {
        if (!(key in this)) {
          this.customColumns[key] = (subscription as SubscriptionJsonResponse)[key]
        }
      })
    }

    this.withRelations = []
    this.selectFromQuery = DB.instance.selectFrom('subscriptions')
    this.updateFromQuery = DB.instance.updateTable('subscriptions')
    this.deleteFromQuery = DB.instance.deleteFrom('subscriptions')
    this.hasSelect = false
  }

  protected async loadRelations(models: SubscriptionJsonResponse | SubscriptionJsonResponse[]): Promise<void> {
    // Handle both single model and array of models
    const modelArray = Array.isArray(models) ? models : [models]
    if (!modelArray.length)
      return

    const modelIds = modelArray.map(model => model.id)

    for (const relation of this.withRelations) {
      const relatedRecords = await DB.instance
        .selectFrom(relation)
        .where('subscription_id', 'in', modelIds)
        .selectAll()
        .execute()

      if (Array.isArray(models)) {
        models.map((model: SubscriptionJsonResponse) => {
          const records = relatedRecords.filter((record: { subscription_id: number }) => {
            return record.subscription_id === model.id
          })

          model[relation] = records.length === 1 ? records[0] : records
          return model
        })
      }
      else {
        const records = relatedRecords.filter((record: { subscription_id: number }) => {
          return record.subscription_id === models.id
        })

        models[relation] = records.length === 1 ? records[0] : records
      }
    }
  }

  static with(relations: string[]): SubscriptionModel {
    const instance = new SubscriptionModel(undefined)

    return instance.applyWith(relations)
  }

  protected mapCustomGetters(models: SubscriptionJsonResponse | SubscriptionJsonResponse[]): void {
    const data = models

    if (Array.isArray(data)) {
      data.map((model: SubscriptionJsonResponse) => {
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

  async mapCustomSetters(model: NewSubscription | SubscriptionUpdate): Promise<void> {
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

  get type(): string | undefined {
    return this.attributes.type
  }

  get plan(): string | undefined {
    return this.attributes.plan
  }

  get provider_id(): string | undefined {
    return this.attributes.provider_id
  }

  get provider_status(): string | undefined {
    return this.attributes.provider_status
  }

  get unit_price(): number | undefined {
    return this.attributes.unit_price
  }

  get provider_type(): string | undefined {
    return this.attributes.provider_type
  }

  get provider_price_id(): string | undefined {
    return this.attributes.provider_price_id
  }

  get quantity(): number | undefined {
    return this.attributes.quantity
  }

  get trial_ends_at(): Date | string | undefined {
    return this.attributes.trial_ends_at
  }

  get ends_at(): Date | string | undefined {
    return this.attributes.ends_at
  }

  get last_used_at(): Date | string | undefined {
    return this.attributes.last_used_at
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

  set type(value: string) {
    this.attributes.type = value
  }

  set plan(value: string) {
    this.attributes.plan = value
  }

  set provider_id(value: string) {
    this.attributes.provider_id = value
  }

  set provider_status(value: string) {
    this.attributes.provider_status = value
  }

  set unit_price(value: number) {
    this.attributes.unit_price = value
  }

  set provider_type(value: string) {
    this.attributes.provider_type = value
  }

  set provider_price_id(value: string) {
    this.attributes.provider_price_id = value
  }

  set quantity(value: number) {
    this.attributes.quantity = value
  }

  set trial_ends_at(value: Date | string) {
    this.attributes.trial_ends_at = value
  }

  set ends_at(value: Date | string) {
    this.attributes.ends_at = value
  }

  set last_used_at(value: Date | string) {
    this.attributes.last_used_at = value
  }

  set updated_at(value: string) {
    this.attributes.updated_at = value
  }

  static select(params: (keyof SubscriptionJsonResponse)[] | RawBuilder<string> | string): SubscriptionModel {
    const instance = new SubscriptionModel(undefined)

    return instance.applySelect(params)
  }

  // Method to find a Subscription by ID
  static async find(id: number): Promise<SubscriptionModel | undefined> {
    const query = DB.instance.selectFrom('subscriptions').where('id', '=', id).selectAll()

    const model = await query.executeTakeFirst()

    if (!model)
      return undefined

    const instance = new SubscriptionModel(undefined)
    return instance.createInstance(model)
  }

  static async first(): Promise<SubscriptionModel | undefined> {
    const instance = new SubscriptionModel(undefined)

    const model = await instance.applyFirst()

    const data = new SubscriptionModel(model)

    return data
  }

  static async last(): Promise<SubscriptionModel | undefined> {
    const instance = new SubscriptionModel(undefined)

    const model = await instance.applyLast()

    if (!model)
      return undefined

    return new SubscriptionModel(model)
  }

  static async firstOrFail(): Promise<SubscriptionModel | undefined> {
    const instance = new SubscriptionModel(undefined)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<SubscriptionModel[]> {
    const instance = new SubscriptionModel(undefined)

    const models = await DB.instance.selectFrom('subscriptions').selectAll().execute()

    instance.mapCustomGetters(models)

    const data = await Promise.all(models.map(async (model: SubscriptionJsonResponse) => {
      return new SubscriptionModel(model)
    }))

    return data
  }

  static async findOrFail(id: number): Promise<SubscriptionModel | undefined> {
    const instance = new SubscriptionModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  static async findMany(ids: number[]): Promise<SubscriptionModel[]> {
    const instance = new SubscriptionModel(undefined)

    const models = await instance.applyFindMany(ids)

    return models.map((modelItem: SubscriptionJsonResponse) => instance.parseResult(new SubscriptionModel(modelItem)))
  }

  static async latest(column: keyof SubscriptionsTable = 'created_at'): Promise<SubscriptionModel | undefined> {
    const instance = new SubscriptionModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'desc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new SubscriptionModel(model)
  }

  static async oldest(column: keyof SubscriptionsTable = 'created_at'): Promise<SubscriptionModel | undefined> {
    const instance = new SubscriptionModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'asc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new SubscriptionModel(model)
  }

  static skip(count: number): SubscriptionModel {
    const instance = new SubscriptionModel(undefined)

    return instance.applySkip(count)
  }

  static take(count: number): SubscriptionModel {
    const instance = new SubscriptionModel(undefined)

    return instance.applyTake(count)
  }

  static where<V = string>(column: keyof SubscriptionsTable, ...args: [V] | [Operator, V]): SubscriptionModel {
    const instance = new SubscriptionModel(undefined)

    return instance.applyWhere<V>(column, ...args)
  }

  static orWhere(...conditions: [string, any][]): SubscriptionModel {
    const instance = new SubscriptionModel(undefined)

    return instance.applyOrWhere(...conditions)
  }

  static whereNotIn<V = number>(column: keyof SubscriptionsTable, values: V[]): SubscriptionModel {
    const instance = new SubscriptionModel(undefined)

    return instance.applyWhereNotIn<V>(column, values)
  }

  static whereBetween<V = number>(column: keyof SubscriptionsTable, range: [V, V]): SubscriptionModel {
    const instance = new SubscriptionModel(undefined)

    return instance.applyWhereBetween<V>(column, range)
  }

  static whereRef(column: keyof SubscriptionsTable, ...args: string[]): SubscriptionModel {
    const instance = new SubscriptionModel(undefined)

    return instance.applyWhereRef(column, ...args)
  }

  static when(condition: boolean, callback: (query: SubscriptionModel) => SubscriptionModel): SubscriptionModel {
    const instance = new SubscriptionModel(undefined)

    return instance.applyWhen(condition, callback as any)
  }

  static whereNull(column: keyof SubscriptionsTable): SubscriptionModel {
    const instance = new SubscriptionModel(undefined)

    return instance.applyWhereNull(column)
  }

  static whereNotNull(column: keyof SubscriptionsTable): SubscriptionModel {
    const instance = new SubscriptionModel(undefined)

    return instance.applyWhereNotNull(column)
  }

  static whereLike(column: keyof SubscriptionsTable, value: string): SubscriptionModel {
    const instance = new SubscriptionModel(undefined)

    return instance.applyWhereLike(column, value)
  }

  static orderBy(column: keyof SubscriptionsTable, order: 'asc' | 'desc'): SubscriptionModel {
    const instance = new SubscriptionModel(undefined)

    return instance.applyOrderBy(column, order)
  }

  static orderByAsc(column: keyof SubscriptionsTable): SubscriptionModel {
    const instance = new SubscriptionModel(undefined)

    return instance.applyOrderByAsc(column)
  }

  static orderByDesc(column: keyof SubscriptionsTable): SubscriptionModel {
    const instance = new SubscriptionModel(undefined)

    return instance.applyOrderByDesc(column)
  }

  static groupBy(column: keyof SubscriptionsTable): SubscriptionModel {
    const instance = new SubscriptionModel(undefined)

    return instance.applyGroupBy(column)
  }

  static having<V = string>(column: keyof SubscriptionsTable, operator: Operator, value: V): SubscriptionModel {
    const instance = new SubscriptionModel(undefined)

    return instance.applyHaving<V>(column, operator, value)
  }

  static inRandomOrder(): SubscriptionModel {
    const instance = new SubscriptionModel(undefined)

    return instance.applyInRandomOrder()
  }

  static whereColumn(first: keyof SubscriptionsTable, operator: Operator, second: keyof SubscriptionsTable): SubscriptionModel {
    const instance = new SubscriptionModel(undefined)

    return instance.applyWhereColumn(first, operator, second)
  }

  static async max(field: keyof SubscriptionsTable): Promise<number> {
    const instance = new SubscriptionModel(undefined)

    return await instance.applyMax(field)
  }

  static async min(field: keyof SubscriptionsTable): Promise<number> {
    const instance = new SubscriptionModel(undefined)

    return await instance.applyMin(field)
  }

  static async avg(field: keyof SubscriptionsTable): Promise<number> {
    const instance = new SubscriptionModel(undefined)

    return await instance.applyAvg(field)
  }

  static async sum(field: keyof SubscriptionsTable): Promise<number> {
    const instance = new SubscriptionModel(undefined)

    return await instance.applySum(field)
  }

  static async count(): Promise<number> {
    const instance = new SubscriptionModel(undefined)

    return instance.applyCount()
  }

  static async get(): Promise<SubscriptionModel[]> {
    const instance = new SubscriptionModel(undefined)

    const results = await instance.applyGet()

    return results.map((item: SubscriptionJsonResponse) => instance.createInstance(item))
  }

  static async pluck<K extends keyof SubscriptionModel>(field: K): Promise<SubscriptionModel[K][]> {
    const instance = new SubscriptionModel(undefined)

    return await instance.applyPluck(field)
  }

  static async chunk(size: number, callback: (models: SubscriptionModel[]) => Promise<void>): Promise<void> {
    const instance = new SubscriptionModel(undefined)

    await instance.applyChunk(size, async (models) => {
      const modelInstances = models.map((item: SubscriptionJsonResponse) => instance.createInstance(item))
      await callback(modelInstances)
    })
  }

  static async paginate(options: { limit?: number, offset?: number, page?: number } = { limit: 10, offset: 0, page: 1 }): Promise<{
    data: SubscriptionModel[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }> {
    const instance = new SubscriptionModel(undefined)

    const result = await instance.applyPaginate(options)

    return {
      data: result.data.map((item: SubscriptionJsonResponse) => instance.createInstance(item)),
      paging: result.paging,
      next_cursor: result.next_cursor,
    }
  }

  // Instance method for creating model instances
  createInstance(data: SubscriptionJsonResponse): SubscriptionModel {
    return new SubscriptionModel(data)
  }

  async applyCreate(newSubscription: NewSubscription): Promise<SubscriptionModel> {
    const filteredValues = Object.fromEntries(
      Object.entries(newSubscription).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewSubscription

    await this.mapCustomSetters(filteredValues)

    filteredValues.uuid = randomUUIDv7()

    const result = await DB.instance.insertInto('subscriptions')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await DB.instance.selectFrom('subscriptions')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created Subscription')
    }

    return this.createInstance(model)
  }

  async create(newSubscription: NewSubscription): Promise<SubscriptionModel> {
    return await this.applyCreate(newSubscription)
  }

  static async create(newSubscription: NewSubscription): Promise<SubscriptionModel> {
    const instance = new SubscriptionModel(undefined)
    return await instance.applyCreate(newSubscription)
  }

  static async firstOrCreate(search: Partial<SubscriptionsTable>, values: NewSubscription = {} as NewSubscription): Promise<SubscriptionModel> {
    // First try to find a record matching the search criteria
    const instance = new SubscriptionModel(undefined)

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
    const createData = { ...search, ...values } as NewSubscription
    return await SubscriptionModel.create(createData)
  }

  static async updateOrCreate(search: Partial<SubscriptionsTable>, values: NewSubscription = {} as NewSubscription): Promise<SubscriptionModel> {
    // First try to find a record matching the search criteria
    const instance = new SubscriptionModel(undefined)

    // Apply all search conditions
    for (const [key, value] of Object.entries(search)) {
      instance.selectFromQuery = instance.selectFromQuery.where(key, '=', value)
    }

    // Try to find the record
    const existingRecord = await instance.applyFirst()

    if (existingRecord) {
      // If record exists, update it with the new values
      const model = instance.createInstance(existingRecord)
      const updatedModel = await model.update(values as SubscriptionUpdate)

      // Return the updated model instance
      if (updatedModel) {
        return updatedModel
      }

      // If update didn't return a model, fetch it again to ensure we have latest data
      const refreshedModel = await instance.applyFirst()
      return instance.createInstance(refreshedModel!)
    }

    // If no record exists, create a new one with combined search criteria and values
    const createData = { ...search, ...values } as NewSubscription
    return await SubscriptionModel.create(createData)
  }

  async update(newSubscription: SubscriptionUpdate): Promise<SubscriptionModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newSubscription).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as SubscriptionUpdate

    await this.mapCustomSetters(filteredValues)

    filteredValues.updated_at = new Date().toISOString()

    await DB.instance.updateTable('subscriptions')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('subscriptions')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated Subscription')
      }

      return this.createInstance(model)
    }

    return undefined
  }

  async forceUpdate(newSubscription: SubscriptionUpdate): Promise<SubscriptionModel | undefined> {
    await DB.instance.updateTable('subscriptions')
      .set(newSubscription)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('subscriptions')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated Subscription')
      }

      return this.createInstance(model)
    }

    return undefined
  }

  async save(): Promise<SubscriptionModel> {
    // If the model has an ID, update it; otherwise, create a new record
    if (this.id) {
      // Update existing record
      await DB.instance.updateTable('subscriptions')
        .set(this.attributes as SubscriptionUpdate)
        .where('id', '=', this.id)
        .executeTakeFirst()

      // Get the updated data
      const model = await DB.instance.selectFrom('subscriptions')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated Subscription')
      }

      return this.createInstance(model)
    }
    else {
      // Create new record
      const result = await DB.instance.insertInto('subscriptions')
        .values(this.attributes as NewSubscription)
        .executeTakeFirst()

      // Get the created data
      const model = await DB.instance.selectFrom('subscriptions')
        .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve created Subscription')
      }

      return this.createInstance(model)
    }
  }

  static async createMany(newSubscription: NewSubscription[]): Promise<void> {
    const instance = new SubscriptionModel(undefined)

    const valuesFiltered = newSubscription.map((newSubscription: NewSubscription) => {
      const filteredValues = Object.fromEntries(
        Object.entries(newSubscription).filter(([key]) =>
          !instance.guarded.includes(key) && instance.fillable.includes(key),
        ),
      ) as NewSubscription

      filteredValues.uuid = randomUUIDv7()

      return filteredValues
    })

    await DB.instance.insertInto('subscriptions')
      .values(valuesFiltered)
      .executeTakeFirst()
  }

  static async forceCreate(newSubscription: NewSubscription): Promise<SubscriptionModel> {
    const result = await DB.instance.insertInto('subscriptions')
      .values(newSubscription)
      .executeTakeFirst()

    const instance = new SubscriptionModel(undefined)
    const model = await DB.instance.selectFrom('subscriptions')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created Subscription')
    }

    return instance.createInstance(model)
  }

  // Method to remove a Subscription
  async delete(): Promise<number> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()

    const deleted = await DB.instance.deleteFrom('subscriptions')
      .where('id', '=', this.id)
      .execute()

    return deleted.numDeletedRows
  }

  static async remove(id: number): Promise<any> {
    return await DB.instance.deleteFrom('subscriptions')
      .where('id', '=', id)
      .execute()
  }

  static whereType(value: string): SubscriptionModel {
    const instance = new SubscriptionModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('type', '=', value)

    return instance
  }

  static wherePlan(value: string): SubscriptionModel {
    const instance = new SubscriptionModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('plan', '=', value)

    return instance
  }

  static whereProviderId(value: string): SubscriptionModel {
    const instance = new SubscriptionModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('provider_id', '=', value)

    return instance
  }

  static whereProviderStatus(value: string): SubscriptionModel {
    const instance = new SubscriptionModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('provider_status', '=', value)

    return instance
  }

  static whereUnitPrice(value: string): SubscriptionModel {
    const instance = new SubscriptionModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('unit_price', '=', value)

    return instance
  }

  static whereProviderType(value: string): SubscriptionModel {
    const instance = new SubscriptionModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('provider_type', '=', value)

    return instance
  }

  static whereProviderPriceId(value: string): SubscriptionModel {
    const instance = new SubscriptionModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('provider_price_id', '=', value)

    return instance
  }

  static whereQuantity(value: string): SubscriptionModel {
    const instance = new SubscriptionModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('quantity', '=', value)

    return instance
  }

  static whereTrialEndsAt(value: string): SubscriptionModel {
    const instance = new SubscriptionModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('trial_ends_at', '=', value)

    return instance
  }

  static whereEndsAt(value: string): SubscriptionModel {
    const instance = new SubscriptionModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('ends_at', '=', value)

    return instance
  }

  static whereLastUsedAt(value: string): SubscriptionModel {
    const instance = new SubscriptionModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('last_used_at', '=', value)

    return instance
  }

  static whereIn<V = number>(column: keyof SubscriptionsTable, values: V[]): SubscriptionModel {
    const instance = new SubscriptionModel(undefined)

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

  static distinct(column: keyof SubscriptionJsonResponse): SubscriptionModel {
    const instance = new SubscriptionModel(undefined)

    return instance.applyDistinct(column)
  }

  static join(table: string, firstCol: string, secondCol: string): SubscriptionModel {
    const instance = new SubscriptionModel(undefined)

    return instance.applyJoin(table, firstCol, secondCol)
  }

  toJSON(): SubscriptionJsonResponse {
    const output = {

      uuid: this.uuid,

      id: this.id,
      type: this.type,
      plan: this.plan,
      provider_id: this.provider_id,
      provider_status: this.provider_status,
      unit_price: this.unit_price,
      provider_type: this.provider_type,
      provider_price_id: this.provider_price_id,
      quantity: this.quantity,
      trial_ends_at: this.trial_ends_at,
      ends_at: this.ends_at,
      last_used_at: this.last_used_at,

      created_at: this.created_at,

      updated_at: this.updated_at,

      user_id: this.user_id,
      user: this.user,
      ...this.customColumns,
    }

    return output
  }

  parseResult(model: SubscriptionModel): SubscriptionModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof SubscriptionModel]
    }

    return model
  }

  // Add a protected applyFind implementation
  protected async applyFind(id: number): Promise<SubscriptionModel | undefined> {
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

export async function find(id: number): Promise<SubscriptionModel | undefined> {
  const query = DB.instance.selectFrom('subscriptions').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  const instance = new SubscriptionModel(undefined)
  return instance.createInstance(model)
}

export async function count(): Promise<number> {
  const results = await SubscriptionModel.count()

  return results
}

export async function create(newSubscription: NewSubscription): Promise<SubscriptionModel> {
  const instance = new SubscriptionModel(undefined)
  return await instance.applyCreate(newSubscription)
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(DB.instance)
}

export async function remove(id: number): Promise<void> {
  await DB.instance.deleteFrom('subscriptions')
    .where('id', '=', id)
    .execute()
}

export async function whereType(value: string): Promise<SubscriptionModel[]> {
  const query = DB.instance.selectFrom('subscriptions').where('type', '=', value)
  const results: SubscriptionJsonResponse = await query.execute()

  return results.map((modelItem: SubscriptionJsonResponse) => new SubscriptionModel(modelItem))
}

export async function wherePlan(value: string): Promise<SubscriptionModel[]> {
  const query = DB.instance.selectFrom('subscriptions').where('plan', '=', value)
  const results: SubscriptionJsonResponse = await query.execute()

  return results.map((modelItem: SubscriptionJsonResponse) => new SubscriptionModel(modelItem))
}

export async function whereProviderId(value: string): Promise<SubscriptionModel[]> {
  const query = DB.instance.selectFrom('subscriptions').where('provider_id', '=', value)
  const results: SubscriptionJsonResponse = await query.execute()

  return results.map((modelItem: SubscriptionJsonResponse) => new SubscriptionModel(modelItem))
}

export async function whereProviderStatus(value: string): Promise<SubscriptionModel[]> {
  const query = DB.instance.selectFrom('subscriptions').where('provider_status', '=', value)
  const results: SubscriptionJsonResponse = await query.execute()

  return results.map((modelItem: SubscriptionJsonResponse) => new SubscriptionModel(modelItem))
}

export async function whereUnitPrice(value: number): Promise<SubscriptionModel[]> {
  const query = DB.instance.selectFrom('subscriptions').where('unit_price', '=', value)
  const results: SubscriptionJsonResponse = await query.execute()

  return results.map((modelItem: SubscriptionJsonResponse) => new SubscriptionModel(modelItem))
}

export async function whereProviderType(value: string): Promise<SubscriptionModel[]> {
  const query = DB.instance.selectFrom('subscriptions').where('provider_type', '=', value)
  const results: SubscriptionJsonResponse = await query.execute()

  return results.map((modelItem: SubscriptionJsonResponse) => new SubscriptionModel(modelItem))
}

export async function whereProviderPriceId(value: string): Promise<SubscriptionModel[]> {
  const query = DB.instance.selectFrom('subscriptions').where('provider_price_id', '=', value)
  const results: SubscriptionJsonResponse = await query.execute()

  return results.map((modelItem: SubscriptionJsonResponse) => new SubscriptionModel(modelItem))
}

export async function whereQuantity(value: number): Promise<SubscriptionModel[]> {
  const query = DB.instance.selectFrom('subscriptions').where('quantity', '=', value)
  const results: SubscriptionJsonResponse = await query.execute()

  return results.map((modelItem: SubscriptionJsonResponse) => new SubscriptionModel(modelItem))
}

export async function whereTrialEndsAt(value: Date | string): Promise<SubscriptionModel[]> {
  const query = DB.instance.selectFrom('subscriptions').where('trial_ends_at', '=', value)
  const results: SubscriptionJsonResponse = await query.execute()

  return results.map((modelItem: SubscriptionJsonResponse) => new SubscriptionModel(modelItem))
}

export async function whereEndsAt(value: Date | string): Promise<SubscriptionModel[]> {
  const query = DB.instance.selectFrom('subscriptions').where('ends_at', '=', value)
  const results: SubscriptionJsonResponse = await query.execute()

  return results.map((modelItem: SubscriptionJsonResponse) => new SubscriptionModel(modelItem))
}

export async function whereLastUsedAt(value: Date | string): Promise<SubscriptionModel[]> {
  const query = DB.instance.selectFrom('subscriptions').where('last_used_at', '=', value)
  const results: SubscriptionJsonResponse = await query.execute()

  return results.map((modelItem: SubscriptionJsonResponse) => new SubscriptionModel(modelItem))
}

export const Subscription = SubscriptionModel

export default Subscription
