import type { RawBuilder } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import type { NewWaitlistRestaurant, WaitlistRestaurantJsonResponse, WaitlistRestaurantsTable, WaitlistRestaurantUpdate } from '../types/WaitlistRestaurantType'
import type { CustomerModel } from './Customer'
import { randomUUIDv7 } from 'bun'
import { sql } from '@stacksjs/database'
import { HttpError } from '@stacksjs/error-handling'
import { dispatch } from '@stacksjs/events'
import { DB } from '@stacksjs/orm'

import { BaseOrm } from '../utils/base'

export class WaitlistRestaurantModel extends BaseOrm<WaitlistRestaurantModel, WaitlistRestaurantsTable, WaitlistRestaurantJsonResponse> {
  private readonly hidden: Array<keyof WaitlistRestaurantJsonResponse> = []
  private readonly fillable: Array<keyof WaitlistRestaurantJsonResponse> = ['name', 'email', 'phone', 'party_size', 'check_in_time', 'table_preference', 'status', 'quoted_wait_time', 'actual_wait_time', 'queue_position', 'seated_at', 'no_show_at', 'cancelled_at', 'uuid', 'customer_id']
  private readonly guarded: Array<keyof WaitlistRestaurantJsonResponse> = []
  protected attributes = {} as WaitlistRestaurantJsonResponse
  protected originalAttributes = {} as WaitlistRestaurantJsonResponse

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

  constructor(waitlistRestaurant: WaitlistRestaurantJsonResponse | undefined) {
    super('waitlist_restaurants')
    if (waitlistRestaurant) {
      this.attributes = { ...waitlistRestaurant }
      this.originalAttributes = { ...waitlistRestaurant }

      Object.keys(waitlistRestaurant).forEach((key) => {
        if (!(key in this)) {
          this.customColumns[key] = (waitlistRestaurant as WaitlistRestaurantJsonResponse)[key]
        }
      })
    }

    this.withRelations = []
    this.selectFromQuery = DB.instance.selectFrom('waitlist_restaurants')
    this.updateFromQuery = DB.instance.updateTable('waitlist_restaurants')
    this.deleteFromQuery = DB.instance.deleteFrom('waitlist_restaurants')
    this.hasSelect = false
  }

  protected async loadRelations(models: WaitlistRestaurantJsonResponse | WaitlistRestaurantJsonResponse[]): Promise<void> {
    // Handle both single model and array of models
    const modelArray = Array.isArray(models) ? models : [models]
    if (!modelArray.length)
      return

    const modelIds = modelArray.map(model => model.id)

    for (const relation of this.withRelations) {
      const relatedRecords = await DB.instance
        .selectFrom(relation)
        .where('waitlistRestaurant_id', 'in', modelIds)
        .selectAll()
        .execute()

      if (Array.isArray(models)) {
        models.map((model: WaitlistRestaurantJsonResponse) => {
          const records = relatedRecords.filter((record: { waitlistRestaurant_id: number }) => {
            return record.waitlistRestaurant_id === model.id
          })

          model[relation] = records.length === 1 ? records[0] : records
          return model
        })
      }
      else {
        const records = relatedRecords.filter((record: { waitlistRestaurant_id: number }) => {
          return record.waitlistRestaurant_id === models.id
        })

        models[relation] = records.length === 1 ? records[0] : records
      }
    }
  }

  static with(relations: string[]): WaitlistRestaurantModel {
    const instance = new WaitlistRestaurantModel(undefined)

    return instance.applyWith(relations)
  }

  protected mapCustomGetters(models: WaitlistRestaurantJsonResponse | WaitlistRestaurantJsonResponse[]): void {
    const data = models

    if (Array.isArray(data)) {
      data.map((model: WaitlistRestaurantJsonResponse) => {
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

  async mapCustomSetters(model: NewWaitlistRestaurant | WaitlistRestaurantUpdate): Promise<void> {
    const customSetter = {
      default: () => {
      },

    }

    for (const [key, fn] of Object.entries(customSetter)) {
      (model as any)[key] = await fn()
    }
  }

  get customer_id(): number {
    return this.attributes.customer_id
  }

  get customer(): CustomerModel | undefined {
    return this.attributes.customer
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

  get email(): string {
    return this.attributes.email
  }

  get phone(): string | undefined {
    return this.attributes.phone
  }

  get party_size(): number {
    return this.attributes.party_size
  }

  get check_in_time(): Date | string {
    return this.attributes.check_in_time
  }

  get table_preference(): string | string[] {
    return this.attributes.table_preference
  }

  get status(): string | string[] {
    return this.attributes.status
  }

  get quoted_wait_time(): number {
    return this.attributes.quoted_wait_time
  }

  get actual_wait_time(): number | undefined {
    return this.attributes.actual_wait_time
  }

  get queue_position(): number | undefined {
    return this.attributes.queue_position
  }

  get seated_at(): Date | string | undefined {
    return this.attributes.seated_at
  }

  get no_show_at(): Date | string | undefined {
    return this.attributes.no_show_at
  }

  get cancelled_at(): Date | string | undefined {
    return this.attributes.cancelled_at
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

  set email(value: string) {
    this.attributes.email = value
  }

  set phone(value: string) {
    this.attributes.phone = value
  }

  set party_size(value: number) {
    this.attributes.party_size = value
  }

  set check_in_time(value: Date | string) {
    this.attributes.check_in_time = value
  }

  set table_preference(value: string | string[]) {
    this.attributes.table_preference = value
  }

  set status(value: string | string[]) {
    this.attributes.status = value
  }

  set quoted_wait_time(value: number) {
    this.attributes.quoted_wait_time = value
  }

  set actual_wait_time(value: number) {
    this.attributes.actual_wait_time = value
  }

  set queue_position(value: number) {
    this.attributes.queue_position = value
  }

  set seated_at(value: Date | string) {
    this.attributes.seated_at = value
  }

  set no_show_at(value: Date | string) {
    this.attributes.no_show_at = value
  }

  set cancelled_at(value: Date | string) {
    this.attributes.cancelled_at = value
  }

  set updated_at(value: string) {
    this.attributes.updated_at = value
  }

  static select(params: (keyof WaitlistRestaurantJsonResponse)[] | RawBuilder<string> | string): WaitlistRestaurantModel {
    const instance = new WaitlistRestaurantModel(undefined)

    return instance.applySelect(params)
  }

  // Method to find a WaitlistRestaurant by ID
  static async find(id: number): Promise<WaitlistRestaurantModel | undefined> {
    const query = DB.instance.selectFrom('waitlist_restaurants').where('id', '=', id).selectAll()

    const model = await query.executeTakeFirst()

    if (!model)
      return undefined

    const instance = new WaitlistRestaurantModel(undefined)
    return instance.createInstance(model)
  }

  static async first(): Promise<WaitlistRestaurantModel | undefined> {
    const instance = new WaitlistRestaurantModel(undefined)

    const model = await instance.applyFirst()

    const data = new WaitlistRestaurantModel(model)

    return data
  }

  static async last(): Promise<WaitlistRestaurantModel | undefined> {
    const instance = new WaitlistRestaurantModel(undefined)

    const model = await instance.applyLast()

    if (!model)
      return undefined

    return new WaitlistRestaurantModel(model)
  }

  static async firstOrFail(): Promise<WaitlistRestaurantModel | undefined> {
    const instance = new WaitlistRestaurantModel(undefined)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<WaitlistRestaurantModel[]> {
    const instance = new WaitlistRestaurantModel(undefined)

    const models = await DB.instance.selectFrom('waitlist_restaurants').selectAll().execute()

    instance.mapCustomGetters(models)

    const data = await Promise.all(models.map(async (model: WaitlistRestaurantJsonResponse) => {
      return new WaitlistRestaurantModel(model)
    }))

    return data
  }

  static async findOrFail(id: number): Promise<WaitlistRestaurantModel | undefined> {
    const instance = new WaitlistRestaurantModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  static async findMany(ids: number[]): Promise<WaitlistRestaurantModel[]> {
    const instance = new WaitlistRestaurantModel(undefined)

    const models = await instance.applyFindMany(ids)

    return models.map((modelItem: WaitlistRestaurantJsonResponse) => instance.parseResult(new WaitlistRestaurantModel(modelItem)))
  }

  static async latest(column: keyof WaitlistRestaurantsTable = 'created_at'): Promise<WaitlistRestaurantModel | undefined> {
    const instance = new WaitlistRestaurantModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'desc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new WaitlistRestaurantModel(model)
  }

  static async oldest(column: keyof WaitlistRestaurantsTable = 'created_at'): Promise<WaitlistRestaurantModel | undefined> {
    const instance = new WaitlistRestaurantModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'asc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new WaitlistRestaurantModel(model)
  }

  static skip(count: number): WaitlistRestaurantModel {
    const instance = new WaitlistRestaurantModel(undefined)

    return instance.applySkip(count)
  }

  static take(count: number): WaitlistRestaurantModel {
    const instance = new WaitlistRestaurantModel(undefined)

    return instance.applyTake(count)
  }

  static where<V = string>(column: keyof WaitlistRestaurantsTable, ...args: [V] | [Operator, V]): WaitlistRestaurantModel {
    const instance = new WaitlistRestaurantModel(undefined)

    return instance.applyWhere<V>(column, ...args)
  }

  static orWhere(...conditions: [string, any][]): WaitlistRestaurantModel {
    const instance = new WaitlistRestaurantModel(undefined)

    return instance.applyOrWhere(...conditions)
  }

  static whereNotIn<V = number>(column: keyof WaitlistRestaurantsTable, values: V[]): WaitlistRestaurantModel {
    const instance = new WaitlistRestaurantModel(undefined)

    return instance.applyWhereNotIn<V>(column, values)
  }

  static whereBetween<V = number>(column: keyof WaitlistRestaurantsTable, range: [V, V]): WaitlistRestaurantModel {
    const instance = new WaitlistRestaurantModel(undefined)

    return instance.applyWhereBetween<V>(column, range)
  }

  static whereRef(column: keyof WaitlistRestaurantsTable, ...args: string[]): WaitlistRestaurantModel {
    const instance = new WaitlistRestaurantModel(undefined)

    return instance.applyWhereRef(column, ...args)
  }

  static when(condition: boolean, callback: (query: WaitlistRestaurantModel) => WaitlistRestaurantModel): WaitlistRestaurantModel {
    const instance = new WaitlistRestaurantModel(undefined)

    return instance.applyWhen(condition, callback as any)
  }

  static whereNull(column: keyof WaitlistRestaurantsTable): WaitlistRestaurantModel {
    const instance = new WaitlistRestaurantModel(undefined)

    return instance.applyWhereNull(column)
  }

  static whereNotNull(column: keyof WaitlistRestaurantsTable): WaitlistRestaurantModel {
    const instance = new WaitlistRestaurantModel(undefined)

    return instance.applyWhereNotNull(column)
  }

  static whereLike(column: keyof WaitlistRestaurantsTable, value: string): WaitlistRestaurantModel {
    const instance = new WaitlistRestaurantModel(undefined)

    return instance.applyWhereLike(column, value)
  }

  static orderBy(column: keyof WaitlistRestaurantsTable, order: 'asc' | 'desc'): WaitlistRestaurantModel {
    const instance = new WaitlistRestaurantModel(undefined)

    return instance.applyOrderBy(column, order)
  }

  static orderByAsc(column: keyof WaitlistRestaurantsTable): WaitlistRestaurantModel {
    const instance = new WaitlistRestaurantModel(undefined)

    return instance.applyOrderByAsc(column)
  }

  static orderByDesc(column: keyof WaitlistRestaurantsTable): WaitlistRestaurantModel {
    const instance = new WaitlistRestaurantModel(undefined)

    return instance.applyOrderByDesc(column)
  }

  static groupBy(column: keyof WaitlistRestaurantsTable): WaitlistRestaurantModel {
    const instance = new WaitlistRestaurantModel(undefined)

    return instance.applyGroupBy(column)
  }

  static having<V = string>(column: keyof WaitlistRestaurantsTable, operator: Operator, value: V): WaitlistRestaurantModel {
    const instance = new WaitlistRestaurantModel(undefined)

    return instance.applyHaving<V>(column, operator, value)
  }

  static inRandomOrder(): WaitlistRestaurantModel {
    const instance = new WaitlistRestaurantModel(undefined)

    return instance.applyInRandomOrder()
  }

  static whereColumn(first: keyof WaitlistRestaurantsTable, operator: Operator, second: keyof WaitlistRestaurantsTable): WaitlistRestaurantModel {
    const instance = new WaitlistRestaurantModel(undefined)

    return instance.applyWhereColumn(first, operator, second)
  }

  static async max(field: keyof WaitlistRestaurantsTable): Promise<number> {
    const instance = new WaitlistRestaurantModel(undefined)

    return await instance.applyMax(field)
  }

  static async min(field: keyof WaitlistRestaurantsTable): Promise<number> {
    const instance = new WaitlistRestaurantModel(undefined)

    return await instance.applyMin(field)
  }

  static async avg(field: keyof WaitlistRestaurantsTable): Promise<number> {
    const instance = new WaitlistRestaurantModel(undefined)

    return await instance.applyAvg(field)
  }

  static async sum(field: keyof WaitlistRestaurantsTable): Promise<number> {
    const instance = new WaitlistRestaurantModel(undefined)

    return await instance.applySum(field)
  }

  static async count(): Promise<number> {
    const instance = new WaitlistRestaurantModel(undefined)

    return instance.applyCount()
  }

  static async get(): Promise<WaitlistRestaurantModel[]> {
    const instance = new WaitlistRestaurantModel(undefined)

    const results = await instance.applyGet()

    return results.map((item: WaitlistRestaurantJsonResponse) => instance.createInstance(item))
  }

  static async pluck<K extends keyof WaitlistRestaurantModel>(field: K): Promise<WaitlistRestaurantModel[K][]> {
    const instance = new WaitlistRestaurantModel(undefined)

    return await instance.applyPluck(field)
  }

  static async chunk(size: number, callback: (models: WaitlistRestaurantModel[]) => Promise<void>): Promise<void> {
    const instance = new WaitlistRestaurantModel(undefined)

    await instance.applyChunk(size, async (models) => {
      const modelInstances = models.map((item: WaitlistRestaurantJsonResponse) => instance.createInstance(item))
      await callback(modelInstances)
    })
  }

  static async paginate(options: { limit?: number, offset?: number, page?: number } = { limit: 10, offset: 0, page: 1 }): Promise<{
    data: WaitlistRestaurantModel[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }> {
    const instance = new WaitlistRestaurantModel(undefined)

    const result = await instance.applyPaginate(options)

    return {
      data: result.data.map((item: WaitlistRestaurantJsonResponse) => instance.createInstance(item)),
      paging: result.paging,
      next_cursor: result.next_cursor,
    }
  }

  // Instance method for creating model instances
  createInstance(data: WaitlistRestaurantJsonResponse): WaitlistRestaurantModel {
    return new WaitlistRestaurantModel(data)
  }

  async applyCreate(newWaitlistRestaurant: NewWaitlistRestaurant): Promise<WaitlistRestaurantModel> {
    const filteredValues = Object.fromEntries(
      Object.entries(newWaitlistRestaurant).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewWaitlistRestaurant

    await this.mapCustomSetters(filteredValues)

    filteredValues.uuid = randomUUIDv7()

    const result = await DB.instance.insertInto('waitlist_restaurants')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await DB.instance.selectFrom('waitlist_restaurants')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created WaitlistRestaurant')
    }

    if (model)
      dispatch('waitlistRestaurant:created', model)
    return this.createInstance(model)
  }

  async create(newWaitlistRestaurant: NewWaitlistRestaurant): Promise<WaitlistRestaurantModel> {
    return await this.applyCreate(newWaitlistRestaurant)
  }

  static async create(newWaitlistRestaurant: NewWaitlistRestaurant): Promise<WaitlistRestaurantModel> {
    const instance = new WaitlistRestaurantModel(undefined)
    return await instance.applyCreate(newWaitlistRestaurant)
  }

  static async firstOrCreate(search: Partial<WaitlistRestaurantsTable>, values: NewWaitlistRestaurant = {} as NewWaitlistRestaurant): Promise<WaitlistRestaurantModel> {
    // First try to find a record matching the search criteria
    const instance = new WaitlistRestaurantModel(undefined)

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
    const createData = { ...search, ...values } as NewWaitlistRestaurant
    return await WaitlistRestaurantModel.create(createData)
  }

  static async updateOrCreate(search: Partial<WaitlistRestaurantsTable>, values: NewWaitlistRestaurant = {} as NewWaitlistRestaurant): Promise<WaitlistRestaurantModel> {
    // First try to find a record matching the search criteria
    const instance = new WaitlistRestaurantModel(undefined)

    // Apply all search conditions
    for (const [key, value] of Object.entries(search)) {
      instance.selectFromQuery = instance.selectFromQuery.where(key, '=', value)
    }

    // Try to find the record
    const existingRecord = await instance.applyFirst()

    if (existingRecord) {
      // If record exists, update it with the new values
      const model = instance.createInstance(existingRecord)
      const updatedModel = await model.update(values as WaitlistRestaurantUpdate)

      // Return the updated model instance
      if (updatedModel) {
        return updatedModel
      }

      // If update didn't return a model, fetch it again to ensure we have latest data
      const refreshedModel = await instance.applyFirst()
      return instance.createInstance(refreshedModel!)
    }

    // If no record exists, create a new one with combined search criteria and values
    const createData = { ...search, ...values } as NewWaitlistRestaurant
    return await WaitlistRestaurantModel.create(createData)
  }

  async update(newWaitlistRestaurant: WaitlistRestaurantUpdate): Promise<WaitlistRestaurantModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newWaitlistRestaurant).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as WaitlistRestaurantUpdate

    await this.mapCustomSetters(filteredValues)

    filteredValues.updated_at = new Date().toISOString()

    await DB.instance.updateTable('waitlist_restaurants')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('waitlist_restaurants')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated WaitlistRestaurant')
      }

      if (model)
        dispatch('waitlistRestaurant:updated', model)
      return this.createInstance(model)
    }

    return undefined
  }

  async forceUpdate(newWaitlistRestaurant: WaitlistRestaurantUpdate): Promise<WaitlistRestaurantModel | undefined> {
    await DB.instance.updateTable('waitlist_restaurants')
      .set(newWaitlistRestaurant)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('waitlist_restaurants')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated WaitlistRestaurant')
      }

      if (this)
        dispatch('waitlistRestaurant:updated', model)
      return this.createInstance(model)
    }

    return undefined
  }

  async save(): Promise<WaitlistRestaurantModel> {
    // If the model has an ID, update it; otherwise, create a new record
    if (this.id) {
      // Update existing record
      await DB.instance.updateTable('waitlist_restaurants')
        .set(this.attributes as WaitlistRestaurantUpdate)
        .where('id', '=', this.id)
        .executeTakeFirst()

      // Get the updated data
      const model = await DB.instance.selectFrom('waitlist_restaurants')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated WaitlistRestaurant')
      }

      if (this)
        dispatch('waitlistRestaurant:updated', model)
      return this.createInstance(model)
    }
    else {
      // Create new record
      const result = await DB.instance.insertInto('waitlist_restaurants')
        .values(this.attributes as NewWaitlistRestaurant)
        .executeTakeFirst()

      // Get the created data
      const model = await DB.instance.selectFrom('waitlist_restaurants')
        .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve created WaitlistRestaurant')
      }

      if (this)
        dispatch('waitlistRestaurant:created', model)
      return this.createInstance(model)
    }
  }

  static async createMany(newWaitlistRestaurant: NewWaitlistRestaurant[]): Promise<void> {
    const instance = new WaitlistRestaurantModel(undefined)

    const valuesFiltered = newWaitlistRestaurant.map((newWaitlistRestaurant: NewWaitlistRestaurant) => {
      const filteredValues = Object.fromEntries(
        Object.entries(newWaitlistRestaurant).filter(([key]) =>
          !instance.guarded.includes(key) && instance.fillable.includes(key),
        ),
      ) as NewWaitlistRestaurant

      filteredValues.uuid = randomUUIDv7()

      return filteredValues
    })

    await DB.instance.insertInto('waitlist_restaurants')
      .values(valuesFiltered)
      .executeTakeFirst()
  }

  static async forceCreate(newWaitlistRestaurant: NewWaitlistRestaurant): Promise<WaitlistRestaurantModel> {
    const result = await DB.instance.insertInto('waitlist_restaurants')
      .values(newWaitlistRestaurant)
      .executeTakeFirst()

    const instance = new WaitlistRestaurantModel(undefined)
    const model = await DB.instance.selectFrom('waitlist_restaurants')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created WaitlistRestaurant')
    }

    if (model)
      dispatch('waitlistRestaurant:created', model)

    return instance.createInstance(model)
  }

  // Method to remove a WaitlistRestaurant
  async delete(): Promise<number> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()
    const model = await this.find(Number(this.id))

    if (model)
      dispatch('waitlistRestaurant:deleted', model)

    const deleted = await DB.instance.deleteFrom('waitlist_restaurants')
      .where('id', '=', this.id)
      .execute()

    return deleted.numDeletedRows
  }

  static async remove(id: number): Promise<any> {
    const instance = new WaitlistRestaurantModel(undefined)

    const model = await instance.find(Number(id))

    if (model)
      dispatch('waitlistRestaurant:deleted', model)

    return await DB.instance.deleteFrom('waitlist_restaurants')
      .where('id', '=', id)
      .execute()
  }

  static whereName(value: string): WaitlistRestaurantModel {
    const instance = new WaitlistRestaurantModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('name', '=', value)

    return instance
  }

  static whereEmail(value: string): WaitlistRestaurantModel {
    const instance = new WaitlistRestaurantModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('email', '=', value)

    return instance
  }

  static wherePhone(value: string): WaitlistRestaurantModel {
    const instance = new WaitlistRestaurantModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('phone', '=', value)

    return instance
  }

  static wherePartySize(value: string): WaitlistRestaurantModel {
    const instance = new WaitlistRestaurantModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('party_size', '=', value)

    return instance
  }

  static whereCheckInTime(value: string): WaitlistRestaurantModel {
    const instance = new WaitlistRestaurantModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('check_in_time', '=', value)

    return instance
  }

  static whereTablePreference(value: string): WaitlistRestaurantModel {
    const instance = new WaitlistRestaurantModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('table_preference', '=', value)

    return instance
  }

  static whereStatus(value: string): WaitlistRestaurantModel {
    const instance = new WaitlistRestaurantModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('status', '=', value)

    return instance
  }

  static whereQuotedWaitTime(value: string): WaitlistRestaurantModel {
    const instance = new WaitlistRestaurantModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('quoted_wait_time', '=', value)

    return instance
  }

  static whereActualWaitTime(value: string): WaitlistRestaurantModel {
    const instance = new WaitlistRestaurantModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('actual_wait_time', '=', value)

    return instance
  }

  static whereQueuePosition(value: string): WaitlistRestaurantModel {
    const instance = new WaitlistRestaurantModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('queue_position', '=', value)

    return instance
  }

  static whereSeatedAt(value: string): WaitlistRestaurantModel {
    const instance = new WaitlistRestaurantModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('seated_at', '=', value)

    return instance
  }

  static whereNoShowAt(value: string): WaitlistRestaurantModel {
    const instance = new WaitlistRestaurantModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('no_show_at', '=', value)

    return instance
  }

  static whereCancelledAt(value: string): WaitlistRestaurantModel {
    const instance = new WaitlistRestaurantModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('cancelled_at', '=', value)

    return instance
  }

  static whereIn<V = number>(column: keyof WaitlistRestaurantsTable, values: V[]): WaitlistRestaurantModel {
    const instance = new WaitlistRestaurantModel(undefined)

    return instance.applyWhereIn<V>(column, values)
  }

  async customerBelong(): Promise<CustomerModel> {
    if (this.customer_id === undefined)
      throw new HttpError(500, 'Relation Error!')

    const model = await Customer
      .where('id', '=', this.customer_id)
      .first()

    if (!model)
      throw new HttpError(500, 'Model Relation Not Found!')

    return model
  }

  toSearchableObject(): Partial<WaitlistRestaurantJsonResponse> {
    return {
      id: this.id,
      name: this.name,
      email: this.email,
      phone: this.phone,
      party_size: this.party_size,
      check_in_time: this.check_in_time,
      table_preference: this.table_preference,
      status: this.status,
      quoted_wait_time: this.quoted_wait_time,
      actual_wait_time: this.actual_wait_time,
      queue_position: this.queue_position,
    }
  }

  static distinct(column: keyof WaitlistRestaurantJsonResponse): WaitlistRestaurantModel {
    const instance = new WaitlistRestaurantModel(undefined)

    return instance.applyDistinct(column)
  }

  static join(table: string, firstCol: string, secondCol: string): WaitlistRestaurantModel {
    const instance = new WaitlistRestaurantModel(undefined)

    return instance.applyJoin(table, firstCol, secondCol)
  }

  toJSON(): WaitlistRestaurantJsonResponse {
    const output = {

      uuid: this.uuid,

      id: this.id,
      name: this.name,
      email: this.email,
      phone: this.phone,
      party_size: this.party_size,
      check_in_time: this.check_in_time,
      table_preference: this.table_preference,
      status: this.status,
      quoted_wait_time: this.quoted_wait_time,
      actual_wait_time: this.actual_wait_time,
      queue_position: this.queue_position,
      seated_at: this.seated_at,
      no_show_at: this.no_show_at,
      cancelled_at: this.cancelled_at,

      created_at: this.created_at,

      updated_at: this.updated_at,

      customer_id: this.customer_id,
      customer: this.customer,
      ...this.customColumns,
    }

    return output
  }

  parseResult(model: WaitlistRestaurantModel): WaitlistRestaurantModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof WaitlistRestaurantModel]
    }

    return model
  }

  // Add a protected applyFind implementation
  protected async applyFind(id: number): Promise<WaitlistRestaurantModel | undefined> {
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

export async function find(id: number): Promise<WaitlistRestaurantModel | undefined> {
  const query = DB.instance.selectFrom('waitlist_restaurants').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  const instance = new WaitlistRestaurantModel(undefined)
  return instance.createInstance(model)
}

export async function count(): Promise<number> {
  const results = await WaitlistRestaurantModel.count()

  return results
}

export async function create(newWaitlistRestaurant: NewWaitlistRestaurant): Promise<WaitlistRestaurantModel> {
  const instance = new WaitlistRestaurantModel(undefined)
  return await instance.applyCreate(newWaitlistRestaurant)
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(DB.instance)
}

export async function remove(id: number): Promise<void> {
  await DB.instance.deleteFrom('waitlist_restaurants')
    .where('id', '=', id)
    .execute()
}

export async function whereName(value: string): Promise<WaitlistRestaurantModel[]> {
  const query = DB.instance.selectFrom('waitlist_restaurants').where('name', '=', value)
  const results: WaitlistRestaurantJsonResponse = await query.execute()

  return results.map((modelItem: WaitlistRestaurantJsonResponse) => new WaitlistRestaurantModel(modelItem))
}

export async function whereEmail(value: string): Promise<WaitlistRestaurantModel[]> {
  const query = DB.instance.selectFrom('waitlist_restaurants').where('email', '=', value)
  const results: WaitlistRestaurantJsonResponse = await query.execute()

  return results.map((modelItem: WaitlistRestaurantJsonResponse) => new WaitlistRestaurantModel(modelItem))
}

export async function wherePhone(value: string): Promise<WaitlistRestaurantModel[]> {
  const query = DB.instance.selectFrom('waitlist_restaurants').where('phone', '=', value)
  const results: WaitlistRestaurantJsonResponse = await query.execute()

  return results.map((modelItem: WaitlistRestaurantJsonResponse) => new WaitlistRestaurantModel(modelItem))
}

export async function wherePartySize(value: number): Promise<WaitlistRestaurantModel[]> {
  const query = DB.instance.selectFrom('waitlist_restaurants').where('party_size', '=', value)
  const results: WaitlistRestaurantJsonResponse = await query.execute()

  return results.map((modelItem: WaitlistRestaurantJsonResponse) => new WaitlistRestaurantModel(modelItem))
}

export async function whereCheckInTime(value: Date | string): Promise<WaitlistRestaurantModel[]> {
  const query = DB.instance.selectFrom('waitlist_restaurants').where('check_in_time', '=', value)
  const results: WaitlistRestaurantJsonResponse = await query.execute()

  return results.map((modelItem: WaitlistRestaurantJsonResponse) => new WaitlistRestaurantModel(modelItem))
}

export async function whereTablePreference(value: string | string[]): Promise<WaitlistRestaurantModel[]> {
  const query = DB.instance.selectFrom('waitlist_restaurants').where('table_preference', '=', value)
  const results: WaitlistRestaurantJsonResponse = await query.execute()

  return results.map((modelItem: WaitlistRestaurantJsonResponse) => new WaitlistRestaurantModel(modelItem))
}

export async function whereStatus(value: string | string[]): Promise<WaitlistRestaurantModel[]> {
  const query = DB.instance.selectFrom('waitlist_restaurants').where('status', '=', value)
  const results: WaitlistRestaurantJsonResponse = await query.execute()

  return results.map((modelItem: WaitlistRestaurantJsonResponse) => new WaitlistRestaurantModel(modelItem))
}

export async function whereQuotedWaitTime(value: number): Promise<WaitlistRestaurantModel[]> {
  const query = DB.instance.selectFrom('waitlist_restaurants').where('quoted_wait_time', '=', value)
  const results: WaitlistRestaurantJsonResponse = await query.execute()

  return results.map((modelItem: WaitlistRestaurantJsonResponse) => new WaitlistRestaurantModel(modelItem))
}

export async function whereActualWaitTime(value: number): Promise<WaitlistRestaurantModel[]> {
  const query = DB.instance.selectFrom('waitlist_restaurants').where('actual_wait_time', '=', value)
  const results: WaitlistRestaurantJsonResponse = await query.execute()

  return results.map((modelItem: WaitlistRestaurantJsonResponse) => new WaitlistRestaurantModel(modelItem))
}

export async function whereQueuePosition(value: number): Promise<WaitlistRestaurantModel[]> {
  const query = DB.instance.selectFrom('waitlist_restaurants').where('queue_position', '=', value)
  const results: WaitlistRestaurantJsonResponse = await query.execute()

  return results.map((modelItem: WaitlistRestaurantJsonResponse) => new WaitlistRestaurantModel(modelItem))
}

export async function whereSeatedAt(value: Date | string): Promise<WaitlistRestaurantModel[]> {
  const query = DB.instance.selectFrom('waitlist_restaurants').where('seated_at', '=', value)
  const results: WaitlistRestaurantJsonResponse = await query.execute()

  return results.map((modelItem: WaitlistRestaurantJsonResponse) => new WaitlistRestaurantModel(modelItem))
}

export async function whereNoShowAt(value: Date | string): Promise<WaitlistRestaurantModel[]> {
  const query = DB.instance.selectFrom('waitlist_restaurants').where('no_show_at', '=', value)
  const results: WaitlistRestaurantJsonResponse = await query.execute()

  return results.map((modelItem: WaitlistRestaurantJsonResponse) => new WaitlistRestaurantModel(modelItem))
}

export async function whereCancelledAt(value: Date | string): Promise<WaitlistRestaurantModel[]> {
  const query = DB.instance.selectFrom('waitlist_restaurants').where('cancelled_at', '=', value)
  const results: WaitlistRestaurantJsonResponse = await query.execute()

  return results.map((modelItem: WaitlistRestaurantJsonResponse) => new WaitlistRestaurantModel(modelItem))
}

export const WaitlistRestaurant = WaitlistRestaurantModel

export default WaitlistRestaurant
