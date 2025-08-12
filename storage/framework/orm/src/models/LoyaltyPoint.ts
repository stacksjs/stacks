import type { RawBuilder } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import type { LoyaltyPointJsonResponse, LoyaltyPointsTable, LoyaltyPointUpdate, NewLoyaltyPoint } from '../types/LoyaltyPointType'
import { randomUUIDv7 } from 'bun'
import { sql } from '@stacksjs/database'
import { HttpError } from '@stacksjs/error-handling'
import { dispatch } from '@stacksjs/events'
import { DB } from '@stacksjs/orm'

import { BaseOrm } from '../utils/base'

export class LoyaltyPointModel extends BaseOrm<LoyaltyPointModel, LoyaltyPointsTable, LoyaltyPointJsonResponse> {
  private readonly hidden: Array<keyof LoyaltyPointJsonResponse> = []
  private readonly fillable: Array<keyof LoyaltyPointJsonResponse> = ['wallet_id', 'points', 'source', 'source_reference_id', 'description', 'expiry_date', 'is_used', 'uuid']
  private readonly guarded: Array<keyof LoyaltyPointJsonResponse> = []
  protected attributes = {} as LoyaltyPointJsonResponse
  protected originalAttributes = {} as LoyaltyPointJsonResponse

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

  constructor(loyaltyPoint: LoyaltyPointJsonResponse | undefined) {
    super('loyalty_points')
    if (loyaltyPoint) {
      this.attributes = { ...loyaltyPoint }
      this.originalAttributes = { ...loyaltyPoint }

      Object.keys(loyaltyPoint).forEach((key) => {
        if (!(key in this)) {
          this.customColumns[key] = (loyaltyPoint as LoyaltyPointJsonResponse)[key]
        }
      })
    }

    this.withRelations = []
    this.selectFromQuery = DB.instance.selectFrom('loyalty_points')
    this.updateFromQuery = DB.instance.updateTable('loyalty_points')
    this.deleteFromQuery = DB.instance.deleteFrom('loyalty_points')
    this.hasSelect = false
  }

  protected async loadRelations(models: LoyaltyPointJsonResponse | LoyaltyPointJsonResponse[]): Promise<void> {
    // Handle both single model and array of models
    const modelArray = Array.isArray(models) ? models : [models]
    if (!modelArray.length)
      return

    const modelIds = modelArray.map(model => model.id)

    for (const relation of this.withRelations) {
      const relatedRecords = await DB.instance
        .selectFrom(relation)
        .where('loyaltyPoint_id', 'in', modelIds)
        .selectAll()
        .execute()

      if (Array.isArray(models)) {
        models.map((model: LoyaltyPointJsonResponse) => {
          const records = relatedRecords.filter((record: { loyaltyPoint_id: number }) => {
            return record.loyaltyPoint_id === model.id
          })

          model[relation] = records.length === 1 ? records[0] : records
          return model
        })
      }
      else {
        const records = relatedRecords.filter((record: { loyaltyPoint_id: number }) => {
          return record.loyaltyPoint_id === models.id
        })

        models[relation] = records.length === 1 ? records[0] : records
      }
    }
  }

  static with(relations: string[]): LoyaltyPointModel {
    const instance = new LoyaltyPointModel(undefined)

    return instance.applyWith(relations)
  }

  protected mapCustomGetters(models: LoyaltyPointJsonResponse | LoyaltyPointJsonResponse[]): void {
    const data = models

    if (Array.isArray(data)) {
      data.map((model: LoyaltyPointJsonResponse) => {
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

  async mapCustomSetters(model: NewLoyaltyPoint): Promise<void> {
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

  get wallet_id(): string {
    return this.attributes.wallet_id
  }

  get points(): number {
    return this.attributes.points
  }

  get source(): string | undefined {
    return this.attributes.source
  }

  get source_reference_id(): string | undefined {
    return this.attributes.source_reference_id
  }

  get description(): string | undefined {
    return this.attributes.description
  }

  get expiry_date(): Date | string | undefined {
    return this.attributes.expiry_date
  }

  get is_used(): boolean | undefined {
    return this.attributes.is_used
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

  set wallet_id(value: string) {
    this.attributes.wallet_id = value
  }

  set points(value: number) {
    this.attributes.points = value
  }

  set source(value: string) {
    this.attributes.source = value
  }

  set source_reference_id(value: string) {
    this.attributes.source_reference_id = value
  }

  set description(value: string) {
    this.attributes.description = value
  }

  set expiry_date(value: Date | string) {
    this.attributes.expiry_date = value
  }

  set is_used(value: boolean) {
    this.attributes.is_used = value
  }

  set updated_at(value: string) {
    this.attributes.updated_at = value
  }

  static select(params: (keyof LoyaltyPointJsonResponse)[] | RawBuilder<string> | string): LoyaltyPointModel {
    const instance = new LoyaltyPointModel(undefined)

    return instance.applySelect(params)
  }

  // Method to find a LoyaltyPoint by ID
  static async find(id: number): Promise<LoyaltyPointModel | undefined> {
    const query = DB.instance.selectFrom('loyalty_points').where('id', '=', id).selectAll()

    const model = await query.executeTakeFirst()

    if (!model)
      return undefined

    const instance = new LoyaltyPointModel(undefined)
    return instance.createInstance(model)
  }

  static async first(): Promise<LoyaltyPointModel | undefined> {
    const instance = new LoyaltyPointModel(undefined)

    const model = await instance.applyFirst()

    const data = new LoyaltyPointModel(model)

    return data
  }

  static async last(): Promise<LoyaltyPointModel | undefined> {
    const instance = new LoyaltyPointModel(undefined)

    const model = await instance.applyLast()

    if (!model)
      return undefined

    return new LoyaltyPointModel(model)
  }

  static async firstOrFail(): Promise<LoyaltyPointModel | undefined> {
    const instance = new LoyaltyPointModel(undefined)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<LoyaltyPointModel[]> {
    const instance = new LoyaltyPointModel(undefined)

    const models = await DB.instance.selectFrom('loyalty_points').selectAll().execute()

    instance.mapCustomGetters(models)

    const data = await Promise.all(models.map(async (model: LoyaltyPointJsonResponse) => {
      return new LoyaltyPointModel(model)
    }))

    return data
  }

  static async findOrFail(id: number): Promise<LoyaltyPointModel | undefined> {
    const instance = new LoyaltyPointModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  static async findMany(ids: number[]): Promise<LoyaltyPointModel[]> {
    const instance = new LoyaltyPointModel(undefined)

    const models = await instance.applyFindMany(ids)

    return models.map((modelItem: LoyaltyPointJsonResponse) => instance.parseResult(new LoyaltyPointModel(modelItem)))
  }

  static async latest(column: keyof LoyaltyPointsTable = 'created_at'): Promise<LoyaltyPointModel | undefined> {
    const instance = new LoyaltyPointModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'desc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new LoyaltyPointModel(model)
  }

  static async oldest(column: keyof LoyaltyPointsTable = 'created_at'): Promise<LoyaltyPointModel | undefined> {
    const instance = new LoyaltyPointModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'asc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new LoyaltyPointModel(model)
  }

  static skip(count: number): LoyaltyPointModel {
    const instance = new LoyaltyPointModel(undefined)

    return instance.applySkip(count)
  }

  static take(count: number): LoyaltyPointModel {
    const instance = new LoyaltyPointModel(undefined)

    return instance.applyTake(count)
  }

  static where<V = string>(column: keyof LoyaltyPointsTable, ...args: [V] | [Operator, V]): LoyaltyPointModel {
    const instance = new LoyaltyPointModel(undefined)

    return instance.applyWhere<V>(column, ...args)
  }

  static orWhere(...conditions: [string, any][]): LoyaltyPointModel {
    const instance = new LoyaltyPointModel(undefined)

    return instance.applyOrWhere(...conditions)
  }

  static whereNotIn<V = number>(column: keyof LoyaltyPointsTable, values: V[]): LoyaltyPointModel {
    const instance = new LoyaltyPointModel(undefined)

    return instance.applyWhereNotIn<V>(column, values)
  }

  static whereBetween<V = number>(column: keyof LoyaltyPointsTable, range: [V, V]): LoyaltyPointModel {
    const instance = new LoyaltyPointModel(undefined)

    return instance.applyWhereBetween<V>(column, range)
  }

  static whereRef(column: keyof LoyaltyPointsTable, ...args: string[]): LoyaltyPointModel {
    const instance = new LoyaltyPointModel(undefined)

    return instance.applyWhereRef(column, ...args)
  }

  static when(condition: boolean, callback: (query: LoyaltyPointModel) => LoyaltyPointModel): LoyaltyPointModel {
    const instance = new LoyaltyPointModel(undefined)

    return instance.applyWhen(condition, callback as any)
  }

  static whereNull(column: keyof LoyaltyPointsTable): LoyaltyPointModel {
    const instance = new LoyaltyPointModel(undefined)

    return instance.applyWhereNull(column)
  }

  static whereNotNull(column: keyof LoyaltyPointsTable): LoyaltyPointModel {
    const instance = new LoyaltyPointModel(undefined)

    return instance.applyWhereNotNull(column)
  }

  static whereLike(column: keyof LoyaltyPointsTable, value: string): LoyaltyPointModel {
    const instance = new LoyaltyPointModel(undefined)

    return instance.applyWhereLike(column, value)
  }

  static orderBy(column: keyof LoyaltyPointsTable, order: 'asc' | 'desc'): LoyaltyPointModel {
    const instance = new LoyaltyPointModel(undefined)

    return instance.applyOrderBy(column, order)
  }

  static orderByAsc(column: keyof LoyaltyPointsTable): LoyaltyPointModel {
    const instance = new LoyaltyPointModel(undefined)

    return instance.applyOrderByAsc(column)
  }

  static orderByDesc(column: keyof LoyaltyPointsTable): LoyaltyPointModel {
    const instance = new LoyaltyPointModel(undefined)

    return instance.applyOrderByDesc(column)
  }

  static groupBy(column: keyof LoyaltyPointsTable): LoyaltyPointModel {
    const instance = new LoyaltyPointModel(undefined)

    return instance.applyGroupBy(column)
  }

  static having<V = string>(column: keyof LoyaltyPointsTable, operator: Operator, value: V): LoyaltyPointModel {
    const instance = new LoyaltyPointModel(undefined)

    return instance.applyHaving<V>(column, operator, value)
  }

  static inRandomOrder(): LoyaltyPointModel {
    const instance = new LoyaltyPointModel(undefined)

    return instance.applyInRandomOrder()
  }

  static whereColumn(first: keyof LoyaltyPointsTable, operator: Operator, second: keyof LoyaltyPointsTable): LoyaltyPointModel {
    const instance = new LoyaltyPointModel(undefined)

    return instance.applyWhereColumn(first, operator, second)
  }

  static async max(field: keyof LoyaltyPointsTable): Promise<number> {
    const instance = new LoyaltyPointModel(undefined)

    return await instance.applyMax(field)
  }

  static async min(field: keyof LoyaltyPointsTable): Promise<number> {
    const instance = new LoyaltyPointModel(undefined)

    return await instance.applyMin(field)
  }

  static async avg(field: keyof LoyaltyPointsTable): Promise<number> {
    const instance = new LoyaltyPointModel(undefined)

    return await instance.applyAvg(field)
  }

  static async sum(field: keyof LoyaltyPointsTable): Promise<number> {
    const instance = new LoyaltyPointModel(undefined)

    return await instance.applySum(field)
  }

  static async count(): Promise<number> {
    const instance = new LoyaltyPointModel(undefined)

    return instance.applyCount()
  }

  static async get(): Promise<LoyaltyPointModel[]> {
    const instance = new LoyaltyPointModel(undefined)

    const results = await instance.applyGet()

    return results.map((item: LoyaltyPointJsonResponse) => instance.createInstance(item))
  }

  static async pluck<K extends keyof LoyaltyPointModel>(field: K): Promise<LoyaltyPointModel[K][]> {
    const instance = new LoyaltyPointModel(undefined)

    return await instance.applyPluck(field)
  }

  static async chunk(size: number, callback: (models: LoyaltyPointModel[]) => Promise<void>): Promise<void> {
    const instance = new LoyaltyPointModel(undefined)

    await instance.applyChunk(size, async (models) => {
      const modelInstances = models.map((item: LoyaltyPointJsonResponse) => instance.createInstance(item))
      await callback(modelInstances)
    })
  }

  static async paginate(options: { limit?: number, offset?: number, page?: number } = { limit: 10, offset: 0, page: 1 }): Promise<{
    data: LoyaltyPointModel[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }> {
    const instance = new LoyaltyPointModel(undefined)

    const result = await instance.applyPaginate(options)

    return {
      data: result.data.map((item: LoyaltyPointJsonResponse) => instance.createInstance(item)),
      paging: result.paging,
      next_cursor: result.next_cursor,
    }
  }

  // Instance method for creating model instances
  createInstance(data: LoyaltyPointJsonResponse): LoyaltyPointModel {
    return new LoyaltyPointModel(data)
  }

  async applyCreate(newLoyaltyPoint: NewLoyaltyPoint): Promise<LoyaltyPointModel> {
    const filteredValues = Object.fromEntries(
      Object.entries(newLoyaltyPoint).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewLoyaltyPoint

    await this.mapCustomSetters(filteredValues)

    filteredValues.uuid = randomUUIDv7()

    const result = await DB.instance.insertInto('loyalty_points')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await DB.instance.selectFrom('loyalty_points')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created LoyaltyPoint')
    }

    if (model)
      dispatch('loyaltyPoint:created', model)
    return this.createInstance(model)
  }

  async create(newLoyaltyPoint: NewLoyaltyPoint): Promise<LoyaltyPointModel> {
    return await this.applyCreate(newLoyaltyPoint)
  }

  static async create(newLoyaltyPoint: NewLoyaltyPoint): Promise<LoyaltyPointModel> {
    const instance = new LoyaltyPointModel(undefined)
    return await instance.applyCreate(newLoyaltyPoint)
  }

  static async firstOrCreate(search: Partial<LoyaltyPointsTable>, values: NewLoyaltyPoint = {} as NewLoyaltyPoint): Promise<LoyaltyPointModel> {
    // First try to find a record matching the search criteria
    const instance = new LoyaltyPointModel(undefined)

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
    const createData = { ...search, ...values } as NewLoyaltyPoint
    return await LoyaltyPointModel.create(createData)
  }

  static async updateOrCreate(search: Partial<LoyaltyPointsTable>, values: NewLoyaltyPoint = {} as NewLoyaltyPoint): Promise<LoyaltyPointModel> {
    // First try to find a record matching the search criteria
    const instance = new LoyaltyPointModel(undefined)

    // Apply all search conditions
    for (const [key, value] of Object.entries(search)) {
      instance.selectFromQuery = instance.selectFromQuery.where(key, '=', value)
    }

    // Try to find the record
    const existingRecord = await instance.applyFirst()

    if (existingRecord) {
      // If record exists, update it with the new values
      const model = instance.createInstance(existingRecord)
      const updatedModel = await model.update(values as LoyaltyPointUpdate)

      // Return the updated model instance
      if (updatedModel) {
        return updatedModel
      }

      // If update didn't return a model, fetch it again to ensure we have latest data
      const refreshedModel = await instance.applyFirst()
      return instance.createInstance(refreshedModel!)
    }

    // If no record exists, create a new one with combined search criteria and values
    const createData = { ...search, ...values } as NewLoyaltyPoint
    return await LoyaltyPointModel.create(createData)
  }

  async update(newLoyaltyPoint: LoyaltyPointUpdate): Promise<LoyaltyPointModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newLoyaltyPoint).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as LoyaltyPointUpdate

    await this.mapCustomSetters(filteredValues)

    filteredValues.updated_at = new Date().toISOString()

    await DB.instance.updateTable('loyalty_points')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('loyalty_points')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated LoyaltyPoint')
      }

      if (model)
        dispatch('loyaltyPoint:updated', model)
      return this.createInstance(model)
    }

    return undefined
  }

  async forceUpdate(newLoyaltyPoint: LoyaltyPointUpdate): Promise<LoyaltyPointModel | undefined> {
    await DB.instance.updateTable('loyalty_points')
      .set(newLoyaltyPoint)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('loyalty_points')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated LoyaltyPoint')
      }

      if (this)
        dispatch('loyaltyPoint:updated', model)
      return this.createInstance(model)
    }

    return undefined
  }

  async save(): Promise<LoyaltyPointModel> {
    // If the model has an ID, update it; otherwise, create a new record
    if (this.id) {
      // Update existing record
      await DB.instance.updateTable('loyalty_points')
        .set(this.attributes as LoyaltyPointUpdate)
        .where('id', '=', this.id)
        .executeTakeFirst()

      // Get the updated data
      const model = await DB.instance.selectFrom('loyalty_points')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated LoyaltyPoint')
      }

      if (this)
        dispatch('loyaltyPoint:updated', model)
      return this.createInstance(model)
    }
    else {
      // Create new record
      const result = await DB.instance.insertInto('loyalty_points')
        .values(this.attributes as NewLoyaltyPoint)
        .executeTakeFirst()

      // Get the created data
      const model = await DB.instance.selectFrom('loyalty_points')
        .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve created LoyaltyPoint')
      }

      if (this)
        dispatch('loyaltyPoint:created', model)
      return this.createInstance(model)
    }
  }

  static async createMany(newLoyaltyPoint: NewLoyaltyPoint[]): Promise<void> {
    const instance = new LoyaltyPointModel(undefined)

    const valuesFiltered = newLoyaltyPoint.map((newLoyaltyPoint: NewLoyaltyPoint) => {
      const filteredValues = Object.fromEntries(
        Object.entries(newLoyaltyPoint).filter(([key]) =>
          !instance.guarded.includes(key) && instance.fillable.includes(key),
        ),
      ) as NewLoyaltyPoint

      filteredValues.uuid = randomUUIDv7()

      return filteredValues
    })

    await DB.instance.insertInto('loyalty_points')
      .values(valuesFiltered)
      .executeTakeFirst()
  }

  static async forceCreate(newLoyaltyPoint: NewLoyaltyPoint): Promise<LoyaltyPointModel> {
    const result = await DB.instance.insertInto('loyalty_points')
      .values(newLoyaltyPoint)
      .executeTakeFirst()

    const instance = new LoyaltyPointModel(undefined)
    const model = await DB.instance.selectFrom('loyalty_points')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created LoyaltyPoint')
    }

    if (model)
      dispatch('loyaltyPoint:created', model)

    return instance.createInstance(model)
  }

  // Method to remove a LoyaltyPoint
  async delete(): Promise<number> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()
    const model = await this.find(Number(this.id))

    if (model)
      dispatch('loyaltyPoint:deleted', model)

    const deleted = await DB.instance.deleteFrom('loyalty_points')
      .where('id', '=', this.id)
      .execute()

    return deleted.numDeletedRows
  }

  static async remove(id: number): Promise<any> {
    const instance = new LoyaltyPointModel(undefined)

    const model = await instance.find(Number(id))

    if (model)
      dispatch('loyaltyPoint:deleted', model)

    return await DB.instance.deleteFrom('loyalty_points')
      .where('id', '=', id)
      .execute()
  }

  static whereWalletId(value: string): LoyaltyPointModel {
    const instance = new LoyaltyPointModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('wallet_id', '=', value)

    return instance
  }

  static wherePoints(value: string): LoyaltyPointModel {
    const instance = new LoyaltyPointModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('points', '=', value)

    return instance
  }

  static whereSource(value: string): LoyaltyPointModel {
    const instance = new LoyaltyPointModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('source', '=', value)

    return instance
  }

  static whereSourceReferenceId(value: string): LoyaltyPointModel {
    const instance = new LoyaltyPointModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('source_reference_id', '=', value)

    return instance
  }

  static whereDescription(value: string): LoyaltyPointModel {
    const instance = new LoyaltyPointModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('description', '=', value)

    return instance
  }

  static whereExpiryDate(value: string): LoyaltyPointModel {
    const instance = new LoyaltyPointModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('expiry_date', '=', value)

    return instance
  }

  static whereIsUsed(value: string): LoyaltyPointModel {
    const instance = new LoyaltyPointModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('is_used', '=', value)

    return instance
  }

  static whereIn<V = number>(column: keyof LoyaltyPointsTable, values: V[]): LoyaltyPointModel {
    const instance = new LoyaltyPointModel(undefined)

    return instance.applyWhereIn<V>(column, values)
  }

  toSearchableObject(): Partial<LoyaltyPointJsonResponse> {
    return {
      id: this.id,
      wallet_id: this.wallet_id,
      points: this.points,
      source: this.source,
      description: this.description,
      expiry_date: this.expiry_date,
      is_used: this.is_used,
    }
  }

  static distinct(column: keyof LoyaltyPointJsonResponse): LoyaltyPointModel {
    const instance = new LoyaltyPointModel(undefined)

    return instance.applyDistinct(column)
  }

  static join(table: string, firstCol: string, secondCol: string): LoyaltyPointModel {
    const instance = new LoyaltyPointModel(undefined)

    return instance.applyJoin(table, firstCol, secondCol)
  }

  toJSON(): LoyaltyPointJsonResponse {
    const output = {

      uuid: this.uuid,

      id: this.id,
      wallet_id: this.wallet_id,
      points: this.points,
      source: this.source,
      source_reference_id: this.source_reference_id,
      description: this.description,
      expiry_date: this.expiry_date,
      is_used: this.is_used,

      created_at: this.created_at,

      updated_at: this.updated_at,

      ...this.customColumns,
    }

    return output
  }

  parseResult(model: LoyaltyPointModel): LoyaltyPointModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof LoyaltyPointModel]
    }

    return model
  }

  // Add a protected applyFind implementation
  protected async applyFind(id: number): Promise<LoyaltyPointModel | undefined> {
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

export async function find(id: number): Promise<LoyaltyPointModel | undefined> {
  const query = DB.instance.selectFrom('loyalty_points').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  const instance = new LoyaltyPointModel(undefined)
  return instance.createInstance(model)
}

export async function count(): Promise<number> {
  const results = await LoyaltyPointModel.count()

  return results
}

export async function create(newLoyaltyPoint: NewLoyaltyPoint): Promise<LoyaltyPointModel> {
  const instance = new LoyaltyPointModel(undefined)
  return await instance.applyCreate(newLoyaltyPoint)
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(DB.instance)
}

export async function remove(id: number): Promise<void> {
  await DB.instance.deleteFrom('loyalty_points')
    .where('id', '=', id)
    .execute()
}

export async function whereWalletId(value: string): Promise<LoyaltyPointModel[]> {
  const query = DB.instance.selectFrom('loyalty_points').where('wallet_id', '=', value)
  const results: LoyaltyPointJsonResponse = await query.execute()

  return results.map((modelItem: LoyaltyPointJsonResponse) => new LoyaltyPointModel(modelItem))
}

export async function wherePoints(value: number): Promise<LoyaltyPointModel[]> {
  const query = DB.instance.selectFrom('loyalty_points').where('points', '=', value)
  const results: LoyaltyPointJsonResponse = await query.execute()

  return results.map((modelItem: LoyaltyPointJsonResponse) => new LoyaltyPointModel(modelItem))
}

export async function whereSource(value: string): Promise<LoyaltyPointModel[]> {
  const query = DB.instance.selectFrom('loyalty_points').where('source', '=', value)
  const results: LoyaltyPointJsonResponse = await query.execute()

  return results.map((modelItem: LoyaltyPointJsonResponse) => new LoyaltyPointModel(modelItem))
}

export async function whereSourceReferenceId(value: string): Promise<LoyaltyPointModel[]> {
  const query = DB.instance.selectFrom('loyalty_points').where('source_reference_id', '=', value)
  const results: LoyaltyPointJsonResponse = await query.execute()

  return results.map((modelItem: LoyaltyPointJsonResponse) => new LoyaltyPointModel(modelItem))
}

export async function whereDescription(value: string): Promise<LoyaltyPointModel[]> {
  const query = DB.instance.selectFrom('loyalty_points').where('description', '=', value)
  const results: LoyaltyPointJsonResponse = await query.execute()

  return results.map((modelItem: LoyaltyPointJsonResponse) => new LoyaltyPointModel(modelItem))
}

export async function whereExpiryDate(value: Date | string): Promise<LoyaltyPointModel[]> {
  const query = DB.instance.selectFrom('loyalty_points').where('expiry_date', '=', value)
  const results: LoyaltyPointJsonResponse = await query.execute()

  return results.map((modelItem: LoyaltyPointJsonResponse) => new LoyaltyPointModel(modelItem))
}

export async function whereIsUsed(value: boolean): Promise<LoyaltyPointModel[]> {
  const query = DB.instance.selectFrom('loyalty_points').where('is_used', '=', value)
  const results: LoyaltyPointJsonResponse = await query.execute()

  return results.map((modelItem: LoyaltyPointJsonResponse) => new LoyaltyPointModel(modelItem))
}

export const LoyaltyPoint = LoyaltyPointModel

export default LoyaltyPoint
