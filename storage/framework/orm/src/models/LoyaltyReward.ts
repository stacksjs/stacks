import type { RawBuilder } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import type { LoyaltyRewardJsonResponse, LoyaltyRewardsTable, LoyaltyRewardUpdate, NewLoyaltyReward } from '../types/LoyaltyRewardType'
import type { ProductModel } from './Product'
import { randomUUIDv7 } from 'bun'
import { sql } from '@stacksjs/database'
import { HttpError } from '@stacksjs/error-handling'
import { dispatch } from '@stacksjs/events'
import { DB } from '@stacksjs/orm'

import { BaseOrm } from '../utils/base'

export class LoyaltyRewardModel extends BaseOrm<LoyaltyRewardModel, LoyaltyRewardsTable, LoyaltyRewardJsonResponse> {
  private readonly hidden: Array<keyof LoyaltyRewardJsonResponse> = []
  private readonly fillable: Array<keyof LoyaltyRewardJsonResponse> = ['name', 'description', 'points_required', 'reward_type', 'discount_percentage', 'free_product_id', 'is_active', 'expiry_days', 'image_url', 'uuid']
  private readonly guarded: Array<keyof LoyaltyRewardJsonResponse> = []
  protected attributes = {} as LoyaltyRewardJsonResponse
  protected originalAttributes = {} as LoyaltyRewardJsonResponse

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

  constructor(loyaltyReward: LoyaltyRewardJsonResponse | undefined) {
    super('loyalty_rewards')
    if (loyaltyReward) {
      this.attributes = { ...loyaltyReward }
      this.originalAttributes = { ...loyaltyReward }

      Object.keys(loyaltyReward).forEach((key) => {
        if (!(key in this)) {
          this.customColumns[key] = (loyaltyReward as LoyaltyRewardJsonResponse)[key]
        }
      })
    }

    this.withRelations = []
    this.selectFromQuery = DB.instance.selectFrom('loyalty_rewards')
    this.updateFromQuery = DB.instance.updateTable('loyalty_rewards')
    this.deleteFromQuery = DB.instance.deleteFrom('loyalty_rewards')
    this.hasSelect = false
  }

  protected async loadRelations(models: LoyaltyRewardJsonResponse | LoyaltyRewardJsonResponse[]): Promise<void> {
    // Handle both single model and array of models
    const modelArray = Array.isArray(models) ? models : [models]
    if (!modelArray.length)
      return

    const modelIds = modelArray.map(model => model.id)

    for (const relation of this.withRelations) {
      const relatedRecords = await DB.instance
        .selectFrom(relation)
        .where('loyaltyReward_id', 'in', modelIds)
        .selectAll()
        .execute()

      if (Array.isArray(models)) {
        models.map((model: LoyaltyRewardJsonResponse) => {
          const records = relatedRecords.filter((record: { loyaltyReward_id: number }) => {
            return record.loyaltyReward_id === model.id
          })

          model[relation] = records.length === 1 ? records[0] : records
          return model
        })
      }
      else {
        const records = relatedRecords.filter((record: { loyaltyReward_id: number }) => {
          return record.loyaltyReward_id === models.id
        })

        models[relation] = records.length === 1 ? records[0] : records
      }
    }
  }

  static with(relations: string[]): LoyaltyRewardModel {
    const instance = new LoyaltyRewardModel(undefined)

    return instance.applyWith(relations)
  }

  protected mapCustomGetters(models: LoyaltyRewardJsonResponse | LoyaltyRewardJsonResponse[]): void {
    const data = models

    if (Array.isArray(data)) {
      data.map((model: LoyaltyRewardJsonResponse) => {
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

  async mapCustomSetters(model: NewLoyaltyReward | LoyaltyRewardUpdate): Promise<void> {
    const customSetter = {
      default: () => {
      },

    }

    for (const [key, fn] of Object.entries(customSetter)) {
      (model as any)[key] = await fn()
    }
  }

  get product_id(): number {
    return this.attributes.product_id
  }

  get product(): ProductModel | undefined {
    return this.attributes.product
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

  get points_required(): number {
    return this.attributes.points_required
  }

  get reward_type(): string {
    return this.attributes.reward_type
  }

  get discount_percentage(): number | undefined {
    return this.attributes.discount_percentage
  }

  get free_product_id(): string | undefined {
    return this.attributes.free_product_id
  }

  get is_active(): boolean | undefined {
    return this.attributes.is_active
  }

  get expiry_days(): number | undefined {
    return this.attributes.expiry_days
  }

  get image_url(): string | undefined {
    return this.attributes.image_url
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

  set points_required(value: number) {
    this.attributes.points_required = value
  }

  set reward_type(value: string) {
    this.attributes.reward_type = value
  }

  set discount_percentage(value: number) {
    this.attributes.discount_percentage = value
  }

  set free_product_id(value: string) {
    this.attributes.free_product_id = value
  }

  set is_active(value: boolean) {
    this.attributes.is_active = value
  }

  set expiry_days(value: number) {
    this.attributes.expiry_days = value
  }

  set image_url(value: string) {
    this.attributes.image_url = value
  }

  set updated_at(value: string) {
    this.attributes.updated_at = value
  }

  static select(params: (keyof LoyaltyRewardJsonResponse)[] | RawBuilder<string> | string): LoyaltyRewardModel {
    const instance = new LoyaltyRewardModel(undefined)

    return instance.applySelect(params)
  }

  // Method to find a LoyaltyReward by ID
  static async find(id: number): Promise<LoyaltyRewardModel | undefined> {
    const query = DB.instance.selectFrom('loyalty_rewards').where('id', '=', id).selectAll()

    const model = await query.executeTakeFirst()

    if (!model)
      return undefined

    const instance = new LoyaltyRewardModel(undefined)
    return instance.createInstance(model)
  }

  static async first(): Promise<LoyaltyRewardModel | undefined> {
    const instance = new LoyaltyRewardModel(undefined)

    const model = await instance.applyFirst()

    const data = new LoyaltyRewardModel(model)

    return data
  }

  static async last(): Promise<LoyaltyRewardModel | undefined> {
    const instance = new LoyaltyRewardModel(undefined)

    const model = await instance.applyLast()

    if (!model)
      return undefined

    return new LoyaltyRewardModel(model)
  }

  static async firstOrFail(): Promise<LoyaltyRewardModel | undefined> {
    const instance = new LoyaltyRewardModel(undefined)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<LoyaltyRewardModel[]> {
    const instance = new LoyaltyRewardModel(undefined)

    const models = await DB.instance.selectFrom('loyalty_rewards').selectAll().execute()

    instance.mapCustomGetters(models)

    const data = await Promise.all(models.map(async (model: LoyaltyRewardJsonResponse) => {
      return new LoyaltyRewardModel(model)
    }))

    return data
  }

  static async findOrFail(id: number): Promise<LoyaltyRewardModel | undefined> {
    const instance = new LoyaltyRewardModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  static async findMany(ids: number[]): Promise<LoyaltyRewardModel[]> {
    const instance = new LoyaltyRewardModel(undefined)

    const models = await instance.applyFindMany(ids)

    return models.map((modelItem: LoyaltyRewardJsonResponse) => instance.parseResult(new LoyaltyRewardModel(modelItem)))
  }

  static async latest(column: keyof LoyaltyRewardsTable = 'created_at'): Promise<LoyaltyRewardModel | undefined> {
    const instance = new LoyaltyRewardModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'desc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new LoyaltyRewardModel(model)
  }

  static async oldest(column: keyof LoyaltyRewardsTable = 'created_at'): Promise<LoyaltyRewardModel | undefined> {
    const instance = new LoyaltyRewardModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'asc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new LoyaltyRewardModel(model)
  }

  static skip(count: number): LoyaltyRewardModel {
    const instance = new LoyaltyRewardModel(undefined)

    return instance.applySkip(count)
  }

  static take(count: number): LoyaltyRewardModel {
    const instance = new LoyaltyRewardModel(undefined)

    return instance.applyTake(count)
  }

  static where<V = string>(column: keyof LoyaltyRewardsTable, ...args: [V] | [Operator, V]): LoyaltyRewardModel {
    const instance = new LoyaltyRewardModel(undefined)

    return instance.applyWhere<V>(column, ...args)
  }

  static orWhere(...conditions: [string, any][]): LoyaltyRewardModel {
    const instance = new LoyaltyRewardModel(undefined)

    return instance.applyOrWhere(...conditions)
  }

  static whereNotIn<V = number>(column: keyof LoyaltyRewardsTable, values: V[]): LoyaltyRewardModel {
    const instance = new LoyaltyRewardModel(undefined)

    return instance.applyWhereNotIn<V>(column, values)
  }

  static whereBetween<V = number>(column: keyof LoyaltyRewardsTable, range: [V, V]): LoyaltyRewardModel {
    const instance = new LoyaltyRewardModel(undefined)

    return instance.applyWhereBetween<V>(column, range)
  }

  static whereRef(column: keyof LoyaltyRewardsTable, ...args: string[]): LoyaltyRewardModel {
    const instance = new LoyaltyRewardModel(undefined)

    return instance.applyWhereRef(column, ...args)
  }

  static when(condition: boolean, callback: (query: LoyaltyRewardModel) => LoyaltyRewardModel): LoyaltyRewardModel {
    const instance = new LoyaltyRewardModel(undefined)

    return instance.applyWhen(condition, callback as any)
  }

  static whereNull(column: keyof LoyaltyRewardsTable): LoyaltyRewardModel {
    const instance = new LoyaltyRewardModel(undefined)

    return instance.applyWhereNull(column)
  }

  static whereNotNull(column: keyof LoyaltyRewardsTable): LoyaltyRewardModel {
    const instance = new LoyaltyRewardModel(undefined)

    return instance.applyWhereNotNull(column)
  }

  static whereLike(column: keyof LoyaltyRewardsTable, value: string): LoyaltyRewardModel {
    const instance = new LoyaltyRewardModel(undefined)

    return instance.applyWhereLike(column, value)
  }

  static orderBy(column: keyof LoyaltyRewardsTable, order: 'asc' | 'desc'): LoyaltyRewardModel {
    const instance = new LoyaltyRewardModel(undefined)

    return instance.applyOrderBy(column, order)
  }

  static orderByAsc(column: keyof LoyaltyRewardsTable): LoyaltyRewardModel {
    const instance = new LoyaltyRewardModel(undefined)

    return instance.applyOrderByAsc(column)
  }

  static orderByDesc(column: keyof LoyaltyRewardsTable): LoyaltyRewardModel {
    const instance = new LoyaltyRewardModel(undefined)

    return instance.applyOrderByDesc(column)
  }

  static groupBy(column: keyof LoyaltyRewardsTable): LoyaltyRewardModel {
    const instance = new LoyaltyRewardModel(undefined)

    return instance.applyGroupBy(column)
  }

  static having<V = string>(column: keyof LoyaltyRewardsTable, operator: Operator, value: V): LoyaltyRewardModel {
    const instance = new LoyaltyRewardModel(undefined)

    return instance.applyHaving<V>(column, operator, value)
  }

  static inRandomOrder(): LoyaltyRewardModel {
    const instance = new LoyaltyRewardModel(undefined)

    return instance.applyInRandomOrder()
  }

  static whereColumn(first: keyof LoyaltyRewardsTable, operator: Operator, second: keyof LoyaltyRewardsTable): LoyaltyRewardModel {
    const instance = new LoyaltyRewardModel(undefined)

    return instance.applyWhereColumn(first, operator, second)
  }

  static async max(field: keyof LoyaltyRewardsTable): Promise<number> {
    const instance = new LoyaltyRewardModel(undefined)

    return await instance.applyMax(field)
  }

  static async min(field: keyof LoyaltyRewardsTable): Promise<number> {
    const instance = new LoyaltyRewardModel(undefined)

    return await instance.applyMin(field)
  }

  static async avg(field: keyof LoyaltyRewardsTable): Promise<number> {
    const instance = new LoyaltyRewardModel(undefined)

    return await instance.applyAvg(field)
  }

  static async sum(field: keyof LoyaltyRewardsTable): Promise<number> {
    const instance = new LoyaltyRewardModel(undefined)

    return await instance.applySum(field)
  }

  static async count(): Promise<number> {
    const instance = new LoyaltyRewardModel(undefined)

    return instance.applyCount()
  }

  static async get(): Promise<LoyaltyRewardModel[]> {
    const instance = new LoyaltyRewardModel(undefined)

    const results = await instance.applyGet()

    return results.map((item: LoyaltyRewardJsonResponse) => instance.createInstance(item))
  }

  static async pluck<K extends keyof LoyaltyRewardModel>(field: K): Promise<LoyaltyRewardModel[K][]> {
    const instance = new LoyaltyRewardModel(undefined)

    return await instance.applyPluck(field)
  }

  static async chunk(size: number, callback: (models: LoyaltyRewardModel[]) => Promise<void>): Promise<void> {
    const instance = new LoyaltyRewardModel(undefined)

    await instance.applyChunk(size, async (models) => {
      const modelInstances = models.map((item: LoyaltyRewardJsonResponse) => instance.createInstance(item))
      await callback(modelInstances)
    })
  }

  static async paginate(options: { limit?: number, offset?: number, page?: number } = { limit: 10, offset: 0, page: 1 }): Promise<{
    data: LoyaltyRewardModel[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }> {
    const instance = new LoyaltyRewardModel(undefined)

    const result = await instance.applyPaginate(options)

    return {
      data: result.data.map((item: LoyaltyRewardJsonResponse) => instance.createInstance(item)),
      paging: result.paging,
      next_cursor: result.next_cursor,
    }
  }

  // Instance method for creating model instances
  createInstance(data: LoyaltyRewardJsonResponse): LoyaltyRewardModel {
    return new LoyaltyRewardModel(data)
  }

  async applyCreate(newLoyaltyReward: NewLoyaltyReward): Promise<LoyaltyRewardModel> {
    const filteredValues = Object.fromEntries(
      Object.entries(newLoyaltyReward).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewLoyaltyReward

    await this.mapCustomSetters(filteredValues)

    filteredValues.uuid = randomUUIDv7()

    const result = await DB.instance.insertInto('loyalty_rewards')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await DB.instance.selectFrom('loyalty_rewards')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created LoyaltyReward')
    }

    if (model)
      dispatch('loyaltyReward:created', model)
    return this.createInstance(model)
  }

  async create(newLoyaltyReward: NewLoyaltyReward): Promise<LoyaltyRewardModel> {
    return await this.applyCreate(newLoyaltyReward)
  }

  static async create(newLoyaltyReward: NewLoyaltyReward): Promise<LoyaltyRewardModel> {
    const instance = new LoyaltyRewardModel(undefined)
    return await instance.applyCreate(newLoyaltyReward)
  }

  static async firstOrCreate(search: Partial<LoyaltyRewardsTable>, values: NewLoyaltyReward = {} as NewLoyaltyReward): Promise<LoyaltyRewardModel> {
    // First try to find a record matching the search criteria
    const instance = new LoyaltyRewardModel(undefined)

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
    const createData = { ...search, ...values } as NewLoyaltyReward
    return await LoyaltyRewardModel.create(createData)
  }

  static async updateOrCreate(search: Partial<LoyaltyRewardsTable>, values: NewLoyaltyReward = {} as NewLoyaltyReward): Promise<LoyaltyRewardModel> {
    // First try to find a record matching the search criteria
    const instance = new LoyaltyRewardModel(undefined)

    // Apply all search conditions
    for (const [key, value] of Object.entries(search)) {
      instance.selectFromQuery = instance.selectFromQuery.where(key, '=', value)
    }

    // Try to find the record
    const existingRecord = await instance.applyFirst()

    if (existingRecord) {
      // If record exists, update it with the new values
      const model = instance.createInstance(existingRecord)
      const updatedModel = await model.update(values as LoyaltyRewardUpdate)

      // Return the updated model instance
      if (updatedModel) {
        return updatedModel
      }

      // If update didn't return a model, fetch it again to ensure we have latest data
      const refreshedModel = await instance.applyFirst()
      return instance.createInstance(refreshedModel!)
    }

    // If no record exists, create a new one with combined search criteria and values
    const createData = { ...search, ...values } as NewLoyaltyReward
    return await LoyaltyRewardModel.create(createData)
  }

  async update(newLoyaltyReward: LoyaltyRewardUpdate): Promise<LoyaltyRewardModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newLoyaltyReward).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as LoyaltyRewardUpdate

    await this.mapCustomSetters(filteredValues)

    filteredValues.updated_at = new Date().toISOString()

    await DB.instance.updateTable('loyalty_rewards')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('loyalty_rewards')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated LoyaltyReward')
      }

      if (model)
        dispatch('loyaltyReward:updated', model)
      return this.createInstance(model)
    }

    return undefined
  }

  async forceUpdate(newLoyaltyReward: LoyaltyRewardUpdate): Promise<LoyaltyRewardModel | undefined> {
    await DB.instance.updateTable('loyalty_rewards')
      .set(newLoyaltyReward)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('loyalty_rewards')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated LoyaltyReward')
      }

      if (this)
        dispatch('loyaltyReward:updated', model)
      return this.createInstance(model)
    }

    return undefined
  }

  async save(): Promise<LoyaltyRewardModel> {
    // If the model has an ID, update it; otherwise, create a new record
    if (this.id) {
      // Update existing record
      await DB.instance.updateTable('loyalty_rewards')
        .set(this.attributes as LoyaltyRewardUpdate)
        .where('id', '=', this.id)
        .executeTakeFirst()

      // Get the updated data
      const model = await DB.instance.selectFrom('loyalty_rewards')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated LoyaltyReward')
      }

      if (this)
        dispatch('loyaltyReward:updated', model)
      return this.createInstance(model)
    }
    else {
      // Create new record
      const result = await DB.instance.insertInto('loyalty_rewards')
        .values(this.attributes as NewLoyaltyReward)
        .executeTakeFirst()

      // Get the created data
      const model = await DB.instance.selectFrom('loyalty_rewards')
        .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve created LoyaltyReward')
      }

      if (this)
        dispatch('loyaltyReward:created', model)
      return this.createInstance(model)
    }
  }

  static async createMany(newLoyaltyReward: NewLoyaltyReward[]): Promise<void> {
    const instance = new LoyaltyRewardModel(undefined)

    const valuesFiltered = newLoyaltyReward.map((newLoyaltyReward: NewLoyaltyReward) => {
      const filteredValues = Object.fromEntries(
        Object.entries(newLoyaltyReward).filter(([key]) =>
          !instance.guarded.includes(key) && instance.fillable.includes(key),
        ),
      ) as NewLoyaltyReward

      filteredValues.uuid = randomUUIDv7()

      return filteredValues
    })

    await DB.instance.insertInto('loyalty_rewards')
      .values(valuesFiltered)
      .executeTakeFirst()
  }

  static async forceCreate(newLoyaltyReward: NewLoyaltyReward): Promise<LoyaltyRewardModel> {
    const result = await DB.instance.insertInto('loyalty_rewards')
      .values(newLoyaltyReward)
      .executeTakeFirst()

    const instance = new LoyaltyRewardModel(undefined)
    const model = await DB.instance.selectFrom('loyalty_rewards')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created LoyaltyReward')
    }

    if (model)
      dispatch('loyaltyReward:created', model)

    return instance.createInstance(model)
  }

  // Method to remove a LoyaltyReward
  async delete(): Promise<number> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()
    const model = await this.find(Number(this.id))

    if (model)
      dispatch('loyaltyReward:deleted', model)

    const deleted = await DB.instance.deleteFrom('loyalty_rewards')
      .where('id', '=', this.id)
      .execute()

    return deleted.numDeletedRows
  }

  static async remove(id: number): Promise<any> {
    const instance = new LoyaltyRewardModel(undefined)

    const model = await instance.find(Number(id))

    if (model)
      dispatch('loyaltyReward:deleted', model)

    return await DB.instance.deleteFrom('loyalty_rewards')
      .where('id', '=', id)
      .execute()
  }

  static whereName(value: string): LoyaltyRewardModel {
    const instance = new LoyaltyRewardModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('name', '=', value)

    return instance
  }

  static whereDescription(value: string): LoyaltyRewardModel {
    const instance = new LoyaltyRewardModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('description', '=', value)

    return instance
  }

  static wherePointsRequired(value: string): LoyaltyRewardModel {
    const instance = new LoyaltyRewardModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('points_required', '=', value)

    return instance
  }

  static whereRewardType(value: string): LoyaltyRewardModel {
    const instance = new LoyaltyRewardModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('reward_type', '=', value)

    return instance
  }

  static whereDiscountPercentage(value: string): LoyaltyRewardModel {
    const instance = new LoyaltyRewardModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('discount_percentage', '=', value)

    return instance
  }

  static whereFreeProductId(value: string): LoyaltyRewardModel {
    const instance = new LoyaltyRewardModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('free_product_id', '=', value)

    return instance
  }

  static whereIsActive(value: string): LoyaltyRewardModel {
    const instance = new LoyaltyRewardModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('is_active', '=', value)

    return instance
  }

  static whereExpiryDays(value: string): LoyaltyRewardModel {
    const instance = new LoyaltyRewardModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('expiry_days', '=', value)

    return instance
  }

  static whereImageUrl(value: string): LoyaltyRewardModel {
    const instance = new LoyaltyRewardModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('image_url', '=', value)

    return instance
  }

  static whereIn<V = number>(column: keyof LoyaltyRewardsTable, values: V[]): LoyaltyRewardModel {
    const instance = new LoyaltyRewardModel(undefined)

    return instance.applyWhereIn<V>(column, values)
  }

  async productBelong(): Promise<ProductModel> {
    if (this.product_id === undefined)
      throw new HttpError(500, 'Relation Error!')

    const model = await Product
      .where('id', '=', this.product_id)
      .first()

    if (!model)
      throw new HttpError(500, 'Model Relation Not Found!')

    return model
  }

  toSearchableObject(): Partial<LoyaltyRewardJsonResponse> {
    return {
      id: this.id,
      name: this.name,
      points_required: this.points_required,
      reward_type: this.reward_type,
      is_active: this.is_active,
    }
  }

  static distinct(column: keyof LoyaltyRewardJsonResponse): LoyaltyRewardModel {
    const instance = new LoyaltyRewardModel(undefined)

    return instance.applyDistinct(column)
  }

  static join(table: string, firstCol: string, secondCol: string): LoyaltyRewardModel {
    const instance = new LoyaltyRewardModel(undefined)

    return instance.applyJoin(table, firstCol, secondCol)
  }

  toJSON(): LoyaltyRewardJsonResponse {
    const output = {

      uuid: this.uuid,

      id: this.id,
      name: this.name,
      description: this.description,
      points_required: this.points_required,
      reward_type: this.reward_type,
      discount_percentage: this.discount_percentage,
      free_product_id: this.free_product_id,
      is_active: this.is_active,
      expiry_days: this.expiry_days,
      image_url: this.image_url,

      created_at: this.created_at,

      updated_at: this.updated_at,

      product_id: this.product_id,
      product: this.product,
      ...this.customColumns,
    }

    return output
  }

  parseResult(model: LoyaltyRewardModel): LoyaltyRewardModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof LoyaltyRewardModel]
    }

    return model
  }

  // Add a protected applyFind implementation
  protected async applyFind(id: number): Promise<LoyaltyRewardModel | undefined> {
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

export async function find(id: number): Promise<LoyaltyRewardModel | undefined> {
  const query = DB.instance.selectFrom('loyalty_rewards').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  const instance = new LoyaltyRewardModel(undefined)
  return instance.createInstance(model)
}

export async function count(): Promise<number> {
  const results = await LoyaltyRewardModel.count()

  return results
}

export async function create(newLoyaltyReward: NewLoyaltyReward): Promise<LoyaltyRewardModel> {
  const instance = new LoyaltyRewardModel(undefined)
  return await instance.applyCreate(newLoyaltyReward)
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(DB.instance)
}

export async function remove(id: number): Promise<void> {
  await DB.instance.deleteFrom('loyalty_rewards')
    .where('id', '=', id)
    .execute()
}

export async function whereName(value: string): Promise<LoyaltyRewardModel[]> {
  const query = DB.instance.selectFrom('loyalty_rewards').where('name', '=', value)
  const results: LoyaltyRewardJsonResponse = await query.execute()

  return results.map((modelItem: LoyaltyRewardJsonResponse) => new LoyaltyRewardModel(modelItem))
}

export async function whereDescription(value: string): Promise<LoyaltyRewardModel[]> {
  const query = DB.instance.selectFrom('loyalty_rewards').where('description', '=', value)
  const results: LoyaltyRewardJsonResponse = await query.execute()

  return results.map((modelItem: LoyaltyRewardJsonResponse) => new LoyaltyRewardModel(modelItem))
}

export async function wherePointsRequired(value: number): Promise<LoyaltyRewardModel[]> {
  const query = DB.instance.selectFrom('loyalty_rewards').where('points_required', '=', value)
  const results: LoyaltyRewardJsonResponse = await query.execute()

  return results.map((modelItem: LoyaltyRewardJsonResponse) => new LoyaltyRewardModel(modelItem))
}

export async function whereRewardType(value: string): Promise<LoyaltyRewardModel[]> {
  const query = DB.instance.selectFrom('loyalty_rewards').where('reward_type', '=', value)
  const results: LoyaltyRewardJsonResponse = await query.execute()

  return results.map((modelItem: LoyaltyRewardJsonResponse) => new LoyaltyRewardModel(modelItem))
}

export async function whereDiscountPercentage(value: number): Promise<LoyaltyRewardModel[]> {
  const query = DB.instance.selectFrom('loyalty_rewards').where('discount_percentage', '=', value)
  const results: LoyaltyRewardJsonResponse = await query.execute()

  return results.map((modelItem: LoyaltyRewardJsonResponse) => new LoyaltyRewardModel(modelItem))
}

export async function whereFreeProductId(value: string): Promise<LoyaltyRewardModel[]> {
  const query = DB.instance.selectFrom('loyalty_rewards').where('free_product_id', '=', value)
  const results: LoyaltyRewardJsonResponse = await query.execute()

  return results.map((modelItem: LoyaltyRewardJsonResponse) => new LoyaltyRewardModel(modelItem))
}

export async function whereIsActive(value: boolean): Promise<LoyaltyRewardModel[]> {
  const query = DB.instance.selectFrom('loyalty_rewards').where('is_active', '=', value)
  const results: LoyaltyRewardJsonResponse = await query.execute()

  return results.map((modelItem: LoyaltyRewardJsonResponse) => new LoyaltyRewardModel(modelItem))
}

export async function whereExpiryDays(value: number): Promise<LoyaltyRewardModel[]> {
  const query = DB.instance.selectFrom('loyalty_rewards').where('expiry_days', '=', value)
  const results: LoyaltyRewardJsonResponse = await query.execute()

  return results.map((modelItem: LoyaltyRewardJsonResponse) => new LoyaltyRewardModel(modelItem))
}

export async function whereImageUrl(value: string): Promise<LoyaltyRewardModel[]> {
  const query = DB.instance.selectFrom('loyalty_rewards').where('image_url', '=', value)
  const results: LoyaltyRewardJsonResponse = await query.execute()

  return results.map((modelItem: LoyaltyRewardJsonResponse) => new LoyaltyRewardModel(modelItem))
}

export const LoyaltyReward = LoyaltyRewardModel

export default LoyaltyReward
