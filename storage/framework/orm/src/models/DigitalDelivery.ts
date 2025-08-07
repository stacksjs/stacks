import type { RawBuilder } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import type { DigitalDeliveriesTable, DigitalDeliveryJsonResponse, DigitalDeliveryUpdate, NewDigitalDelivery } from '../types/DigitalDeliveryType'
import { randomUUIDv7 } from 'bun'
import { sql } from '@stacksjs/database'
import { HttpError } from '@stacksjs/error-handling'
import { dispatch } from '@stacksjs/events'
import { DB } from '@stacksjs/orm'

import { BaseOrm } from '../utils/base'

export class DigitalDeliveryModel extends BaseOrm<DigitalDeliveryModel, DigitalDeliveriesTable, DigitalDeliveryJsonResponse> {
  private readonly hidden: Array<keyof DigitalDeliveryJsonResponse> = []
  private readonly fillable: Array<keyof DigitalDeliveryJsonResponse> = ['name', 'description', 'download_limit', 'expiry_days', 'requires_login', 'automatic_delivery', 'status', 'uuid']
  private readonly guarded: Array<keyof DigitalDeliveryJsonResponse> = []
  protected attributes = {} as DigitalDeliveryJsonResponse
  protected originalAttributes = {} as DigitalDeliveryJsonResponse

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

  constructor(digitalDelivery: DigitalDeliveryJsonResponse | undefined) {
    super('digital_deliveries')
    if (digitalDelivery) {
      this.attributes = { ...digitalDelivery }
      this.originalAttributes = { ...digitalDelivery }

      Object.keys(digitalDelivery).forEach((key) => {
        if (!(key in this)) {
          this.customColumns[key] = (digitalDelivery as DigitalDeliveryJsonResponse)[key]
        }
      })
    }

    this.withRelations = []
    this.selectFromQuery = DB.instance.selectFrom('digital_deliveries')
    this.updateFromQuery = DB.instance.updateTable('digital_deliveries')
    this.deleteFromQuery = DB.instance.deleteFrom('digital_deliveries')
    this.hasSelect = false
  }

  protected async loadRelations(models: DigitalDeliveryJsonResponse | DigitalDeliveryJsonResponse[]): Promise<void> {
    // Handle both single model and array of models
    const modelArray = Array.isArray(models) ? models : [models]
    if (!modelArray.length)
      return

    const modelIds = modelArray.map(model => model.id)

    for (const relation of this.withRelations) {
      const relatedRecords = await DB.instance
        .selectFrom(relation)
        .where('digitalDelivery_id', 'in', modelIds)
        .selectAll()
        .execute()

      if (Array.isArray(models)) {
        models.map((model: DigitalDeliveryJsonResponse) => {
          const records = relatedRecords.filter((record: { digitalDelivery_id: number }) => {
            return record.digitalDelivery_id === model.id
          })

          model[relation] = records.length === 1 ? records[0] : records
          return model
        })
      }
      else {
        const records = relatedRecords.filter((record: { digitalDelivery_id: number }) => {
          return record.digitalDelivery_id === models.id
        })

        models[relation] = records.length === 1 ? records[0] : records
      }
    }
  }

  static with(relations: string[]): DigitalDeliveryModel {
    const instance = new DigitalDeliveryModel(undefined)

    return instance.applyWith(relations)
  }

  protected mapCustomGetters(models: DigitalDeliveryJsonResponse | DigitalDeliveryJsonResponse[]): void {
    const data = models

    if (Array.isArray(data)) {
      data.map((model: DigitalDeliveryJsonResponse) => {
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

  async mapCustomSetters(model: NewDigitalDelivery | DigitalDeliveryUpdate): Promise<void> {
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

  get download_limit(): number | undefined {
    return this.attributes.download_limit
  }

  get expiry_days(): number {
    return this.attributes.expiry_days
  }

  get requires_login(): boolean | undefined {
    return this.attributes.requires_login
  }

  get automatic_delivery(): boolean | undefined {
    return this.attributes.automatic_delivery
  }

  get status(): string | string[] | undefined {
    return this.attributes.status
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

  set download_limit(value: number) {
    this.attributes.download_limit = value
  }

  set expiry_days(value: number) {
    this.attributes.expiry_days = value
  }

  set requires_login(value: boolean) {
    this.attributes.requires_login = value
  }

  set automatic_delivery(value: boolean) {
    this.attributes.automatic_delivery = value
  }

  set status(value: string | string[]) {
    this.attributes.status = value
  }

  set updated_at(value: string) {
    this.attributes.updated_at = value
  }

  static select(params: (keyof DigitalDeliveryJsonResponse)[] | RawBuilder<string> | string): DigitalDeliveryModel {
    const instance = new DigitalDeliveryModel(undefined)

    return instance.applySelect(params)
  }

  // Method to find a DigitalDelivery by ID
  static async find(id: number): Promise<DigitalDeliveryModel | undefined> {
    const query = DB.instance.selectFrom('digital_deliveries').where('id', '=', id).selectAll()

    const model = await query.executeTakeFirst()

    if (!model)
      return undefined

    const instance = new DigitalDeliveryModel(undefined)
    return instance.createInstance(model)
  }

  static async first(): Promise<DigitalDeliveryModel | undefined> {
    const instance = new DigitalDeliveryModel(undefined)

    const model = await instance.applyFirst()

    const data = new DigitalDeliveryModel(model)

    return data
  }

  static async last(): Promise<DigitalDeliveryModel | undefined> {
    const instance = new DigitalDeliveryModel(undefined)

    const model = await instance.applyLast()

    if (!model)
      return undefined

    return new DigitalDeliveryModel(model)
  }

  static async firstOrFail(): Promise<DigitalDeliveryModel | undefined> {
    const instance = new DigitalDeliveryModel(undefined)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<DigitalDeliveryModel[]> {
    const instance = new DigitalDeliveryModel(undefined)

    const models = await DB.instance.selectFrom('digital_deliveries').selectAll().execute()

    instance.mapCustomGetters(models)

    const data = await Promise.all(models.map(async (model: DigitalDeliveryJsonResponse) => {
      return new DigitalDeliveryModel(model)
    }))

    return data
  }

  static async findOrFail(id: number): Promise<DigitalDeliveryModel | undefined> {
    const instance = new DigitalDeliveryModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  static async findMany(ids: number[]): Promise<DigitalDeliveryModel[]> {
    const instance = new DigitalDeliveryModel(undefined)

    const models = await instance.applyFindMany(ids)

    return models.map((modelItem: DigitalDeliveryJsonResponse) => instance.parseResult(new DigitalDeliveryModel(modelItem)))
  }

  static async latest(column: keyof DigitalDeliveriesTable = 'created_at'): Promise<DigitalDeliveryModel | undefined> {
    const instance = new DigitalDeliveryModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'desc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new DigitalDeliveryModel(model)
  }

  static async oldest(column: keyof DigitalDeliveriesTable = 'created_at'): Promise<DigitalDeliveryModel | undefined> {
    const instance = new DigitalDeliveryModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'asc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new DigitalDeliveryModel(model)
  }

  static skip(count: number): DigitalDeliveryModel {
    const instance = new DigitalDeliveryModel(undefined)

    return instance.applySkip(count)
  }

  static take(count: number): DigitalDeliveryModel {
    const instance = new DigitalDeliveryModel(undefined)

    return instance.applyTake(count)
  }

  static where<V = string>(column: keyof DigitalDeliveriesTable, ...args: [V] | [Operator, V]): DigitalDeliveryModel {
    const instance = new DigitalDeliveryModel(undefined)

    return instance.applyWhere<V>(column, ...args)
  }

  static orWhere(...conditions: [string, any][]): DigitalDeliveryModel {
    const instance = new DigitalDeliveryModel(undefined)

    return instance.applyOrWhere(...conditions)
  }

  static whereNotIn<V = number>(column: keyof DigitalDeliveriesTable, values: V[]): DigitalDeliveryModel {
    const instance = new DigitalDeliveryModel(undefined)

    return instance.applyWhereNotIn<V>(column, values)
  }

  static whereBetween<V = number>(column: keyof DigitalDeliveriesTable, range: [V, V]): DigitalDeliveryModel {
    const instance = new DigitalDeliveryModel(undefined)

    return instance.applyWhereBetween<V>(column, range)
  }

  static whereRef(column: keyof DigitalDeliveriesTable, ...args: string[]): DigitalDeliveryModel {
    const instance = new DigitalDeliveryModel(undefined)

    return instance.applyWhereRef(column, ...args)
  }

  static when(condition: boolean, callback: (query: DigitalDeliveryModel) => DigitalDeliveryModel): DigitalDeliveryModel {
    const instance = new DigitalDeliveryModel(undefined)

    return instance.applyWhen(condition, callback as any)
  }

  static whereNull(column: keyof DigitalDeliveriesTable): DigitalDeliveryModel {
    const instance = new DigitalDeliveryModel(undefined)

    return instance.applyWhereNull(column)
  }

  static whereNotNull(column: keyof DigitalDeliveriesTable): DigitalDeliveryModel {
    const instance = new DigitalDeliveryModel(undefined)

    return instance.applyWhereNotNull(column)
  }

  static whereLike(column: keyof DigitalDeliveriesTable, value: string): DigitalDeliveryModel {
    const instance = new DigitalDeliveryModel(undefined)

    return instance.applyWhereLike(column, value)
  }

  static orderBy(column: keyof DigitalDeliveriesTable, order: 'asc' | 'desc'): DigitalDeliveryModel {
    const instance = new DigitalDeliveryModel(undefined)

    return instance.applyOrderBy(column, order)
  }

  static orderByAsc(column: keyof DigitalDeliveriesTable): DigitalDeliveryModel {
    const instance = new DigitalDeliveryModel(undefined)

    return instance.applyOrderByAsc(column)
  }

  static orderByDesc(column: keyof DigitalDeliveriesTable): DigitalDeliveryModel {
    const instance = new DigitalDeliveryModel(undefined)

    return instance.applyOrderByDesc(column)
  }

  static groupBy(column: keyof DigitalDeliveriesTable): DigitalDeliveryModel {
    const instance = new DigitalDeliveryModel(undefined)

    return instance.applyGroupBy(column)
  }

  static having<V = string>(column: keyof DigitalDeliveriesTable, operator: Operator, value: V): DigitalDeliveryModel {
    const instance = new DigitalDeliveryModel(undefined)

    return instance.applyHaving<V>(column, operator, value)
  }

  static inRandomOrder(): DigitalDeliveryModel {
    const instance = new DigitalDeliveryModel(undefined)

    return instance.applyInRandomOrder()
  }

  static whereColumn(first: keyof DigitalDeliveriesTable, operator: Operator, second: keyof DigitalDeliveriesTable): DigitalDeliveryModel {
    const instance = new DigitalDeliveryModel(undefined)

    return instance.applyWhereColumn(first, operator, second)
  }

  static async max(field: keyof DigitalDeliveriesTable): Promise<number> {
    const instance = new DigitalDeliveryModel(undefined)

    return await instance.applyMax(field)
  }

  static async min(field: keyof DigitalDeliveriesTable): Promise<number> {
    const instance = new DigitalDeliveryModel(undefined)

    return await instance.applyMin(field)
  }

  static async avg(field: keyof DigitalDeliveriesTable): Promise<number> {
    const instance = new DigitalDeliveryModel(undefined)

    return await instance.applyAvg(field)
  }

  static async sum(field: keyof DigitalDeliveriesTable): Promise<number> {
    const instance = new DigitalDeliveryModel(undefined)

    return await instance.applySum(field)
  }

  static async count(): Promise<number> {
    const instance = new DigitalDeliveryModel(undefined)

    return instance.applyCount()
  }

  static async get(): Promise<DigitalDeliveryModel[]> {
    const instance = new DigitalDeliveryModel(undefined)

    const results = await instance.applyGet()

    return results.map((item: DigitalDeliveryJsonResponse) => instance.createInstance(item))
  }

  static async pluck<K extends keyof DigitalDeliveryModel>(field: K): Promise<DigitalDeliveryModel[K][]> {
    const instance = new DigitalDeliveryModel(undefined)

    return await instance.applyPluck(field)
  }

  static async chunk(size: number, callback: (models: DigitalDeliveryModel[]) => Promise<void>): Promise<void> {
    const instance = new DigitalDeliveryModel(undefined)

    await instance.applyChunk(size, async (models) => {
      const modelInstances = models.map((item: DigitalDeliveryJsonResponse) => instance.createInstance(item))
      await callback(modelInstances)
    })
  }

  static async paginate(options: { limit?: number, offset?: number, page?: number } = { limit: 10, offset: 0, page: 1 }): Promise<{
    data: DigitalDeliveryModel[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }> {
    const instance = new DigitalDeliveryModel(undefined)

    const result = await instance.applyPaginate(options)

    return {
      data: result.data.map((item: DigitalDeliveryJsonResponse) => instance.createInstance(item)),
      paging: result.paging,
      next_cursor: result.next_cursor,
    }
  }

  // Instance method for creating model instances
  createInstance(data: DigitalDeliveryJsonResponse): DigitalDeliveryModel {
    return new DigitalDeliveryModel(data)
  }

  async applyCreate(newDigitalDelivery: NewDigitalDelivery): Promise<DigitalDeliveryModel> {
    const filteredValues = Object.fromEntries(
      Object.entries(newDigitalDelivery).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewDigitalDelivery

    await this.mapCustomSetters(filteredValues)

    filteredValues.uuid = randomUUIDv7()

    const result = await DB.instance.insertInto('digital_deliveries')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await DB.instance.selectFrom('digital_deliveries')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created DigitalDelivery')
    }

    if (model)
      dispatch('digitalDelivery:created', model)
    return this.createInstance(model)
  }

  async create(newDigitalDelivery: NewDigitalDelivery): Promise<DigitalDeliveryModel> {
    return await this.applyCreate(newDigitalDelivery)
  }

  static async create(newDigitalDelivery: NewDigitalDelivery): Promise<DigitalDeliveryModel> {
    const instance = new DigitalDeliveryModel(undefined)
    return await instance.applyCreate(newDigitalDelivery)
  }

  static async firstOrCreate(search: Partial<DigitalDeliveriesTable>, values: NewDigitalDelivery = {} as NewDigitalDelivery): Promise<DigitalDeliveryModel> {
    // First try to find a record matching the search criteria
    const instance = new DigitalDeliveryModel(undefined)

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
    const createData = { ...search, ...values } as NewDigitalDelivery
    return await DigitalDeliveryModel.create(createData)
  }

  static async updateOrCreate(search: Partial<DigitalDeliveriesTable>, values: NewDigitalDelivery = {} as NewDigitalDelivery): Promise<DigitalDeliveryModel> {
    // First try to find a record matching the search criteria
    const instance = new DigitalDeliveryModel(undefined)

    // Apply all search conditions
    for (const [key, value] of Object.entries(search)) {
      instance.selectFromQuery = instance.selectFromQuery.where(key, '=', value)
    }

    // Try to find the record
    const existingRecord = await instance.applyFirst()

    if (existingRecord) {
      // If record exists, update it with the new values
      const model = instance.createInstance(existingRecord)
      const updatedModel = await model.update(values as DigitalDeliveryUpdate)

      // Return the updated model instance
      if (updatedModel) {
        return updatedModel
      }

      // If update didn't return a model, fetch it again to ensure we have latest data
      const refreshedModel = await instance.applyFirst()
      return instance.createInstance(refreshedModel!)
    }

    // If no record exists, create a new one with combined search criteria and values
    const createData = { ...search, ...values } as NewDigitalDelivery
    return await DigitalDeliveryModel.create(createData)
  }

  async update(newDigitalDelivery: DigitalDeliveryUpdate): Promise<DigitalDeliveryModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newDigitalDelivery).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as DigitalDeliveryUpdate

    await this.mapCustomSetters(filteredValues)

    filteredValues.updated_at = new Date().toISOString()

    await DB.instance.updateTable('digital_deliveries')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('digital_deliveries')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated DigitalDelivery')
      }

      if (model)
        dispatch('digitalDelivery:updated', model)
      return this.createInstance(model)
    }

    return undefined
  }

  async forceUpdate(newDigitalDelivery: DigitalDeliveryUpdate): Promise<DigitalDeliveryModel | undefined> {
    await DB.instance.updateTable('digital_deliveries')
      .set(newDigitalDelivery)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('digital_deliveries')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated DigitalDelivery')
      }

      if (this)
        dispatch('digitalDelivery:updated', model)
      return this.createInstance(model)
    }

    return undefined
  }

  async save(): Promise<DigitalDeliveryModel> {
    // If the model has an ID, update it; otherwise, create a new record
    if (this.id) {
      // Update existing record
      await DB.instance.updateTable('digital_deliveries')
        .set(this.attributes as DigitalDeliveryUpdate)
        .where('id', '=', this.id)
        .executeTakeFirst()

      // Get the updated data
      const model = await DB.instance.selectFrom('digital_deliveries')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated DigitalDelivery')
      }

      if (this)
        dispatch('digitalDelivery:updated', model)
      return this.createInstance(model)
    }
    else {
      // Create new record
      const result = await DB.instance.insertInto('digital_deliveries')
        .values(this.attributes as NewDigitalDelivery)
        .executeTakeFirst()

      // Get the created data
      const model = await DB.instance.selectFrom('digital_deliveries')
        .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve created DigitalDelivery')
      }

      if (this)
        dispatch('digitalDelivery:created', model)
      return this.createInstance(model)
    }
  }

  static async createMany(newDigitalDelivery: NewDigitalDelivery[]): Promise<void> {
    const instance = new DigitalDeliveryModel(undefined)

    const valuesFiltered = newDigitalDelivery.map((newDigitalDelivery: NewDigitalDelivery) => {
      const filteredValues = Object.fromEntries(
        Object.entries(newDigitalDelivery).filter(([key]) =>
          !instance.guarded.includes(key) && instance.fillable.includes(key),
        ),
      ) as NewDigitalDelivery

      filteredValues.uuid = randomUUIDv7()

      return filteredValues
    })

    await DB.instance.insertInto('digital_deliveries')
      .values(valuesFiltered)
      .executeTakeFirst()
  }

  static async forceCreate(newDigitalDelivery: NewDigitalDelivery): Promise<DigitalDeliveryModel> {
    const result = await DB.instance.insertInto('digital_deliveries')
      .values(newDigitalDelivery)
      .executeTakeFirst()

    const instance = new DigitalDeliveryModel(undefined)
    const model = await DB.instance.selectFrom('digital_deliveries')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created DigitalDelivery')
    }

    if (model)
      dispatch('digitalDelivery:created', model)

    return instance.createInstance(model)
  }

  // Method to remove a DigitalDelivery
  async delete(): Promise<number> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()
    const model = await this.find(Number(this.id))

    if (model)
      dispatch('digitalDelivery:deleted', model)

    const deleted = await DB.instance.deleteFrom('digital_deliveries')
      .where('id', '=', this.id)
      .execute()

    return deleted.numDeletedRows
  }

  static async remove(id: number): Promise<any> {
    const instance = new DigitalDeliveryModel(undefined)

    const model = await instance.find(Number(id))

    if (model)
      dispatch('digitalDelivery:deleted', model)

    return await DB.instance.deleteFrom('digital_deliveries')
      .where('id', '=', id)
      .execute()
  }

  static whereName(value: string): DigitalDeliveryModel {
    const instance = new DigitalDeliveryModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('name', '=', value)

    return instance
  }

  static whereDescription(value: string): DigitalDeliveryModel {
    const instance = new DigitalDeliveryModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('description', '=', value)

    return instance
  }

  static whereDownloadLimit(value: string): DigitalDeliveryModel {
    const instance = new DigitalDeliveryModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('download_limit', '=', value)

    return instance
  }

  static whereExpiryDays(value: string): DigitalDeliveryModel {
    const instance = new DigitalDeliveryModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('expiry_days', '=', value)

    return instance
  }

  static whereRequiresLogin(value: string): DigitalDeliveryModel {
    const instance = new DigitalDeliveryModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('requires_login', '=', value)

    return instance
  }

  static whereAutomaticDelivery(value: string): DigitalDeliveryModel {
    const instance = new DigitalDeliveryModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('automatic_delivery', '=', value)

    return instance
  }

  static whereStatus(value: string): DigitalDeliveryModel {
    const instance = new DigitalDeliveryModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('status', '=', value)

    return instance
  }

  static whereIn<V = number>(column: keyof DigitalDeliveriesTable, values: V[]): DigitalDeliveryModel {
    const instance = new DigitalDeliveryModel(undefined)

    return instance.applyWhereIn<V>(column, values)
  }

  toSearchableObject(): Partial<DigitalDeliveryJsonResponse> {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      download_limit: this.download_limit,
      expiry_days: this.expiry_days,
      status: this.status,
    }
  }

  static distinct(column: keyof DigitalDeliveryJsonResponse): DigitalDeliveryModel {
    const instance = new DigitalDeliveryModel(undefined)

    return instance.applyDistinct(column)
  }

  static join(table: string, firstCol: string, secondCol: string): DigitalDeliveryModel {
    const instance = new DigitalDeliveryModel(undefined)

    return instance.applyJoin(table, firstCol, secondCol)
  }

  toJSON(): DigitalDeliveryJsonResponse {
    const output = {

      uuid: this.uuid,

      id: this.id,
      name: this.name,
      description: this.description,
      download_limit: this.download_limit,
      expiry_days: this.expiry_days,
      requires_login: this.requires_login,
      automatic_delivery: this.automatic_delivery,
      status: this.status,

      created_at: this.created_at,

      updated_at: this.updated_at,

      ...this.customColumns,
    }

    return output
  }

  parseResult(model: DigitalDeliveryModel): DigitalDeliveryModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof DigitalDeliveryModel]
    }

    return model
  }

  // Add a protected applyFind implementation
  protected async applyFind(id: number): Promise<DigitalDeliveryModel | undefined> {
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

export async function find(id: number): Promise<DigitalDeliveryModel | undefined> {
  const query = DB.instance.selectFrom('digital_deliveries').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  const instance = new DigitalDeliveryModel(undefined)
  return instance.createInstance(model)
}

export async function count(): Promise<number> {
  const results = await DigitalDeliveryModel.count()

  return results
}

export async function create(newDigitalDelivery: NewDigitalDelivery): Promise<DigitalDeliveryModel> {
  const instance = new DigitalDeliveryModel(undefined)
  return await instance.applyCreate(newDigitalDelivery)
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(DB.instance)
}

export async function remove(id: number): Promise<void> {
  await DB.instance.deleteFrom('digital_deliveries')
    .where('id', '=', id)
    .execute()
}

export async function whereName(value: string): Promise<DigitalDeliveryModel[]> {
  const query = DB.instance.selectFrom('digital_deliveries').where('name', '=', value)
  const results: DigitalDeliveryJsonResponse = await query.execute()

  return results.map((modelItem: DigitalDeliveryJsonResponse) => new DigitalDeliveryModel(modelItem))
}

export async function whereDescription(value: string): Promise<DigitalDeliveryModel[]> {
  const query = DB.instance.selectFrom('digital_deliveries').where('description', '=', value)
  const results: DigitalDeliveryJsonResponse = await query.execute()

  return results.map((modelItem: DigitalDeliveryJsonResponse) => new DigitalDeliveryModel(modelItem))
}

export async function whereDownloadLimit(value: number): Promise<DigitalDeliveryModel[]> {
  const query = DB.instance.selectFrom('digital_deliveries').where('download_limit', '=', value)
  const results: DigitalDeliveryJsonResponse = await query.execute()

  return results.map((modelItem: DigitalDeliveryJsonResponse) => new DigitalDeliveryModel(modelItem))
}

export async function whereExpiryDays(value: number): Promise<DigitalDeliveryModel[]> {
  const query = DB.instance.selectFrom('digital_deliveries').where('expiry_days', '=', value)
  const results: DigitalDeliveryJsonResponse = await query.execute()

  return results.map((modelItem: DigitalDeliveryJsonResponse) => new DigitalDeliveryModel(modelItem))
}

export async function whereRequiresLogin(value: boolean): Promise<DigitalDeliveryModel[]> {
  const query = DB.instance.selectFrom('digital_deliveries').where('requires_login', '=', value)
  const results: DigitalDeliveryJsonResponse = await query.execute()

  return results.map((modelItem: DigitalDeliveryJsonResponse) => new DigitalDeliveryModel(modelItem))
}

export async function whereAutomaticDelivery(value: boolean): Promise<DigitalDeliveryModel[]> {
  const query = DB.instance.selectFrom('digital_deliveries').where('automatic_delivery', '=', value)
  const results: DigitalDeliveryJsonResponse = await query.execute()

  return results.map((modelItem: DigitalDeliveryJsonResponse) => new DigitalDeliveryModel(modelItem))
}

export async function whereStatus(value: string | string[]): Promise<DigitalDeliveryModel[]> {
  const query = DB.instance.selectFrom('digital_deliveries').where('status', '=', value)
  const results: DigitalDeliveryJsonResponse = await query.execute()

  return results.map((modelItem: DigitalDeliveryJsonResponse) => new DigitalDeliveryModel(modelItem))
}

export const DigitalDelivery = DigitalDeliveryModel

export default DigitalDelivery
