import type { RawBuilder } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import type { NewTaxRate, TaxRateJsonResponse, TaxRatesTable, TaxRateUpdate } from '../types/TaxRateType'
import { randomUUIDv7 } from 'bun'
import { sql } from '@stacksjs/database'
import { HttpError } from '@stacksjs/error-handling'
import { dispatch } from '@stacksjs/events'
import { DB } from '@stacksjs/orm'

import { BaseOrm } from '../utils/base'

export class TaxRateModel extends BaseOrm<TaxRateModel, TaxRatesTable, TaxRateJsonResponse> {
  private readonly hidden: Array<keyof TaxRateJsonResponse> = []
  private readonly fillable: Array<keyof TaxRateJsonResponse> = ['name', 'rate', 'type', 'country', 'region', 'status', 'is_default', 'uuid']
  private readonly guarded: Array<keyof TaxRateJsonResponse> = []
  protected attributes = {} as TaxRateJsonResponse
  protected originalAttributes = {} as TaxRateJsonResponse

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

  constructor(taxRate: TaxRateJsonResponse | undefined) {
    super('tax_rates')
    if (taxRate) {
      this.attributes = { ...taxRate }
      this.originalAttributes = { ...taxRate }

      Object.keys(taxRate).forEach((key) => {
        if (!(key in this)) {
          this.customColumns[key] = (taxRate as TaxRateJsonResponse)[key]
        }
      })
    }

    this.withRelations = []
    this.selectFromQuery = DB.instance.selectFrom('tax_rates')
    this.updateFromQuery = DB.instance.updateTable('tax_rates')
    this.deleteFromQuery = DB.instance.deleteFrom('tax_rates')
    this.hasSelect = false
  }

  protected async loadRelations(models: TaxRateJsonResponse | TaxRateJsonResponse[]): Promise<void> {
    // Handle both single model and array of models
    const modelArray = Array.isArray(models) ? models : [models]
    if (!modelArray.length)
      return

    const modelIds = modelArray.map(model => model.id)

    for (const relation of this.withRelations) {
      const relatedRecords = await DB.instance
        .selectFrom(relation)
        .where('taxRate_id', 'in', modelIds)
        .selectAll()
        .execute()

      if (Array.isArray(models)) {
        models.map((model: TaxRateJsonResponse) => {
          const records = relatedRecords.filter((record: { taxRate_id: number }) => {
            return record.taxRate_id === model.id
          })

          model[relation] = records.length === 1 ? records[0] : records
          return model
        })
      }
      else {
        const records = relatedRecords.filter((record: { taxRate_id: number }) => {
          return record.taxRate_id === models.id
        })

        models[relation] = records.length === 1 ? records[0] : records
      }
    }
  }

  static with(relations: string[]): TaxRateModel {
    const instance = new TaxRateModel(undefined)

    return instance.applyWith(relations)
  }

  protected mapCustomGetters(models: TaxRateJsonResponse | TaxRateJsonResponse[]): void {
    const data = models

    if (Array.isArray(data)) {
      data.map((model: TaxRateJsonResponse) => {
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

  async mapCustomSetters(model: NewTaxRate | TaxRateUpdate): Promise<void> {
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

  get rate(): number {
    return this.attributes.rate
  }

  get type(): string {
    return this.attributes.type
  }

  get country(): string {
    return this.attributes.country
  }

  get region(): string | string[] | undefined {
    return this.attributes.region
  }

  get status(): string | string[] | undefined {
    return this.attributes.status
  }

  get is_default(): boolean | undefined {
    return this.attributes.is_default
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

  set rate(value: number) {
    this.attributes.rate = value
  }

  set type(value: string) {
    this.attributes.type = value
  }

  set country(value: string) {
    this.attributes.country = value
  }

  set region(value: string | string[]) {
    this.attributes.region = value
  }

  set status(value: string | string[]) {
    this.attributes.status = value
  }

  set is_default(value: boolean) {
    this.attributes.is_default = value
  }

  set updated_at(value: string) {
    this.attributes.updated_at = value
  }

  static select(params: (keyof TaxRateJsonResponse)[] | RawBuilder<string> | string): TaxRateModel {
    const instance = new TaxRateModel(undefined)

    return instance.applySelect(params)
  }

  // Method to find a TaxRate by ID
  static async find(id: number): Promise<TaxRateModel | undefined> {
    const query = DB.instance.selectFrom('tax_rates').where('id', '=', id).selectAll()

    const model = await query.executeTakeFirst()

    if (!model)
      return undefined

    const instance = new TaxRateModel(undefined)
    return instance.createInstance(model)
  }

  static async first(): Promise<TaxRateModel | undefined> {
    const instance = new TaxRateModel(undefined)

    const model = await instance.applyFirst()

    const data = new TaxRateModel(model)

    return data
  }

  static async last(): Promise<TaxRateModel | undefined> {
    const instance = new TaxRateModel(undefined)

    const model = await instance.applyLast()

    if (!model)
      return undefined

    return new TaxRateModel(model)
  }

  static async firstOrFail(): Promise<TaxRateModel | undefined> {
    const instance = new TaxRateModel(undefined)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<TaxRateModel[]> {
    const instance = new TaxRateModel(undefined)

    const models = await DB.instance.selectFrom('tax_rates').selectAll().execute()

    instance.mapCustomGetters(models)

    const data = await Promise.all(models.map(async (model: TaxRateJsonResponse) => {
      return new TaxRateModel(model)
    }))

    return data
  }

  static async findOrFail(id: number): Promise<TaxRateModel | undefined> {
    const instance = new TaxRateModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  static async findMany(ids: number[]): Promise<TaxRateModel[]> {
    const instance = new TaxRateModel(undefined)

    const models = await instance.applyFindMany(ids)

    return models.map((modelItem: TaxRateJsonResponse) => instance.parseResult(new TaxRateModel(modelItem)))
  }

  static async latest(column: keyof TaxRatesTable = 'created_at'): Promise<TaxRateModel | undefined> {
    const instance = new TaxRateModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'desc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new TaxRateModel(model)
  }

  static async oldest(column: keyof TaxRatesTable = 'created_at'): Promise<TaxRateModel | undefined> {
    const instance = new TaxRateModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'asc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new TaxRateModel(model)
  }

  static skip(count: number): TaxRateModel {
    const instance = new TaxRateModel(undefined)

    return instance.applySkip(count)
  }

  static take(count: number): TaxRateModel {
    const instance = new TaxRateModel(undefined)

    return instance.applyTake(count)
  }

  static where<V = string>(column: keyof TaxRatesTable, ...args: [V] | [Operator, V]): TaxRateModel {
    const instance = new TaxRateModel(undefined)

    return instance.applyWhere<V>(column, ...args)
  }

  static orWhere(...conditions: [string, any][]): TaxRateModel {
    const instance = new TaxRateModel(undefined)

    return instance.applyOrWhere(...conditions)
  }

  static whereNotIn<V = number>(column: keyof TaxRatesTable, values: V[]): TaxRateModel {
    const instance = new TaxRateModel(undefined)

    return instance.applyWhereNotIn<V>(column, values)
  }

  static whereBetween<V = number>(column: keyof TaxRatesTable, range: [V, V]): TaxRateModel {
    const instance = new TaxRateModel(undefined)

    return instance.applyWhereBetween<V>(column, range)
  }

  static whereRef(column: keyof TaxRatesTable, ...args: string[]): TaxRateModel {
    const instance = new TaxRateModel(undefined)

    return instance.applyWhereRef(column, ...args)
  }

  static when(condition: boolean, callback: (query: TaxRateModel) => TaxRateModel): TaxRateModel {
    const instance = new TaxRateModel(undefined)

    return instance.applyWhen(condition, callback as any)
  }

  static whereNull(column: keyof TaxRatesTable): TaxRateModel {
    const instance = new TaxRateModel(undefined)

    return instance.applyWhereNull(column)
  }

  static whereNotNull(column: keyof TaxRatesTable): TaxRateModel {
    const instance = new TaxRateModel(undefined)

    return instance.applyWhereNotNull(column)
  }

  static whereLike(column: keyof TaxRatesTable, value: string): TaxRateModel {
    const instance = new TaxRateModel(undefined)

    return instance.applyWhereLike(column, value)
  }

  static orderBy(column: keyof TaxRatesTable, order: 'asc' | 'desc'): TaxRateModel {
    const instance = new TaxRateModel(undefined)

    return instance.applyOrderBy(column, order)
  }

  static orderByAsc(column: keyof TaxRatesTable): TaxRateModel {
    const instance = new TaxRateModel(undefined)

    return instance.applyOrderByAsc(column)
  }

  static orderByDesc(column: keyof TaxRatesTable): TaxRateModel {
    const instance = new TaxRateModel(undefined)

    return instance.applyOrderByDesc(column)
  }

  static groupBy(column: keyof TaxRatesTable): TaxRateModel {
    const instance = new TaxRateModel(undefined)

    return instance.applyGroupBy(column)
  }

  static having<V = string>(column: keyof TaxRatesTable, operator: Operator, value: V): TaxRateModel {
    const instance = new TaxRateModel(undefined)

    return instance.applyHaving<V>(column, operator, value)
  }

  static inRandomOrder(): TaxRateModel {
    const instance = new TaxRateModel(undefined)

    return instance.applyInRandomOrder()
  }

  static whereColumn(first: keyof TaxRatesTable, operator: Operator, second: keyof TaxRatesTable): TaxRateModel {
    const instance = new TaxRateModel(undefined)

    return instance.applyWhereColumn(first, operator, second)
  }

  static async max(field: keyof TaxRatesTable): Promise<number> {
    const instance = new TaxRateModel(undefined)

    return await instance.applyMax(field)
  }

  static async min(field: keyof TaxRatesTable): Promise<number> {
    const instance = new TaxRateModel(undefined)

    return await instance.applyMin(field)
  }

  static async avg(field: keyof TaxRatesTable): Promise<number> {
    const instance = new TaxRateModel(undefined)

    return await instance.applyAvg(field)
  }

  static async sum(field: keyof TaxRatesTable): Promise<number> {
    const instance = new TaxRateModel(undefined)

    return await instance.applySum(field)
  }

  static async count(): Promise<number> {
    const instance = new TaxRateModel(undefined)

    return instance.applyCount()
  }

  static async get(): Promise<TaxRateModel[]> {
    const instance = new TaxRateModel(undefined)

    const results = await instance.applyGet()

    return results.map((item: TaxRateJsonResponse) => instance.createInstance(item))
  }

  static async pluck<K extends keyof TaxRateModel>(field: K): Promise<TaxRateModel[K][]> {
    const instance = new TaxRateModel(undefined)

    return await instance.applyPluck(field)
  }

  static async chunk(size: number, callback: (models: TaxRateModel[]) => Promise<void>): Promise<void> {
    const instance = new TaxRateModel(undefined)

    await instance.applyChunk(size, async (models) => {
      const modelInstances = models.map((item: TaxRateJsonResponse) => instance.createInstance(item))
      await callback(modelInstances)
    })
  }

  static async paginate(options: { limit?: number, offset?: number, page?: number } = { limit: 10, offset: 0, page: 1 }): Promise<{
    data: TaxRateModel[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }> {
    const instance = new TaxRateModel(undefined)

    const result = await instance.applyPaginate(options)

    return {
      data: result.data.map((item: TaxRateJsonResponse) => instance.createInstance(item)),
      paging: result.paging,
      next_cursor: result.next_cursor,
    }
  }

  // Instance method for creating model instances
  createInstance(data: TaxRateJsonResponse): TaxRateModel {
    return new TaxRateModel(data)
  }

  async applyCreate(newTaxRate: NewTaxRate): Promise<TaxRateModel> {
    const filteredValues = Object.fromEntries(
      Object.entries(newTaxRate).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewTaxRate

    await this.mapCustomSetters(filteredValues)

    filteredValues.uuid = randomUUIDv7()

    const result = await DB.instance.insertInto('tax_rates')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await DB.instance.selectFrom('tax_rates')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created TaxRate')
    }

    if (model)
      dispatch('taxRate:created', model)
    return this.createInstance(model)
  }

  async create(newTaxRate: NewTaxRate): Promise<TaxRateModel> {
    return await this.applyCreate(newTaxRate)
  }

  static async create(newTaxRate: NewTaxRate): Promise<TaxRateModel> {
    const instance = new TaxRateModel(undefined)
    return await instance.applyCreate(newTaxRate)
  }

  static async firstOrCreate(search: Partial<TaxRatesTable>, values: NewTaxRate = {} as NewTaxRate): Promise<TaxRateModel> {
    // First try to find a record matching the search criteria
    const instance = new TaxRateModel(undefined)

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
    const createData = { ...search, ...values } as NewTaxRate
    return await TaxRateModel.create(createData)
  }

  static async updateOrCreate(search: Partial<TaxRatesTable>, values: NewTaxRate = {} as NewTaxRate): Promise<TaxRateModel> {
    // First try to find a record matching the search criteria
    const instance = new TaxRateModel(undefined)

    // Apply all search conditions
    for (const [key, value] of Object.entries(search)) {
      instance.selectFromQuery = instance.selectFromQuery.where(key, '=', value)
    }

    // Try to find the record
    const existingRecord = await instance.applyFirst()

    if (existingRecord) {
      // If record exists, update it with the new values
      const model = instance.createInstance(existingRecord)
      const updatedModel = await model.update(values as TaxRateUpdate)

      // Return the updated model instance
      if (updatedModel) {
        return updatedModel
      }

      // If update didn't return a model, fetch it again to ensure we have latest data
      const refreshedModel = await instance.applyFirst()
      return instance.createInstance(refreshedModel!)
    }

    // If no record exists, create a new one with combined search criteria and values
    const createData = { ...search, ...values } as NewTaxRate
    return await TaxRateModel.create(createData)
  }

  async update(newTaxRate: TaxRateUpdate): Promise<TaxRateModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newTaxRate).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as TaxRateUpdate

    await this.mapCustomSetters(filteredValues)

    filteredValues.updated_at = new Date().toISOString()

    await DB.instance.updateTable('tax_rates')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('tax_rates')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated TaxRate')
      }

      if (model)
        dispatch('taxRate:updated', model)
      return this.createInstance(model)
    }

    return undefined
  }

  async forceUpdate(newTaxRate: TaxRateUpdate): Promise<TaxRateModel | undefined> {
    await DB.instance.updateTable('tax_rates')
      .set(newTaxRate)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('tax_rates')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated TaxRate')
      }

      if (this)
        dispatch('taxRate:updated', model)
      return this.createInstance(model)
    }

    return undefined
  }

  async save(): Promise<TaxRateModel> {
    // If the model has an ID, update it; otherwise, create a new record
    if (this.id) {
      // Update existing record
      await DB.instance.updateTable('tax_rates')
        .set(this.attributes as TaxRateUpdate)
        .where('id', '=', this.id)
        .executeTakeFirst()

      // Get the updated data
      const model = await DB.instance.selectFrom('tax_rates')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated TaxRate')
      }

      if (this)
        dispatch('taxRate:updated', model)
      return this.createInstance(model)
    }
    else {
      // Create new record
      const result = await DB.instance.insertInto('tax_rates')
        .values(this.attributes as NewTaxRate)
        .executeTakeFirst()

      // Get the created data
      const model = await DB.instance.selectFrom('tax_rates')
        .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve created TaxRate')
      }

      if (this)
        dispatch('taxRate:created', model)
      return this.createInstance(model)
    }
  }

  static async createMany(newTaxRate: NewTaxRate[]): Promise<void> {
    const instance = new TaxRateModel(undefined)

    const valuesFiltered = newTaxRate.map((newTaxRate: NewTaxRate) => {
      const filteredValues = Object.fromEntries(
        Object.entries(newTaxRate).filter(([key]) =>
          !instance.guarded.includes(key) && instance.fillable.includes(key),
        ),
      ) as NewTaxRate

      filteredValues.uuid = randomUUIDv7()

      return filteredValues
    })

    await DB.instance.insertInto('tax_rates')
      .values(valuesFiltered)
      .executeTakeFirst()
  }

  static async forceCreate(newTaxRate: NewTaxRate): Promise<TaxRateModel> {
    const result = await DB.instance.insertInto('tax_rates')
      .values(newTaxRate)
      .executeTakeFirst()

    const instance = new TaxRateModel(undefined)
    const model = await DB.instance.selectFrom('tax_rates')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created TaxRate')
    }

    if (model)
      dispatch('taxRate:created', model)

    return instance.createInstance(model)
  }

  // Method to remove a TaxRate
  async delete(): Promise<number> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()
    const model = await this.find(Number(this.id))

    if (model)
      dispatch('taxRate:deleted', model)

    const deleted = await DB.instance.deleteFrom('tax_rates')
      .where('id', '=', this.id)
      .execute()

    return deleted.numDeletedRows
  }

  static async remove(id: number): Promise<any> {
    const instance = new TaxRateModel(undefined)

    const model = await instance.find(Number(id))

    if (model)
      dispatch('taxRate:deleted', model)

    return await DB.instance.deleteFrom('tax_rates')
      .where('id', '=', id)
      .execute()
  }

  static whereName(value: string): TaxRateModel {
    const instance = new TaxRateModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('name', '=', value)

    return instance
  }

  static whereRate(value: string): TaxRateModel {
    const instance = new TaxRateModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('rate', '=', value)

    return instance
  }

  static whereType(value: string): TaxRateModel {
    const instance = new TaxRateModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('type', '=', value)

    return instance
  }

  static whereCountry(value: string): TaxRateModel {
    const instance = new TaxRateModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('country', '=', value)

    return instance
  }

  static whereRegion(value: string): TaxRateModel {
    const instance = new TaxRateModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('region', '=', value)

    return instance
  }

  static whereStatus(value: string): TaxRateModel {
    const instance = new TaxRateModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('status', '=', value)

    return instance
  }

  static whereIsDefault(value: string): TaxRateModel {
    const instance = new TaxRateModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('is_default', '=', value)

    return instance
  }

  static whereIn<V = number>(column: keyof TaxRatesTable, values: V[]): TaxRateModel {
    const instance = new TaxRateModel(undefined)

    return instance.applyWhereIn<V>(column, values)
  }

  toSearchableObject(): Partial<TaxRateJsonResponse> {
    return {
      id: this.id,
      name: this.name,
      rate: this.rate,
      type: this.type,
      country: this.country,
      region: this.region,
      status: this.status,
      is_default: this.is_default,
    }
  }

  static distinct(column: keyof TaxRateJsonResponse): TaxRateModel {
    const instance = new TaxRateModel(undefined)

    return instance.applyDistinct(column)
  }

  static join(table: string, firstCol: string, secondCol: string): TaxRateModel {
    const instance = new TaxRateModel(undefined)

    return instance.applyJoin(table, firstCol, secondCol)
  }

  toJSON(): TaxRateJsonResponse {
    const output = {

      uuid: this.uuid,

      id: this.id,
      name: this.name,
      rate: this.rate,
      type: this.type,
      country: this.country,
      region: this.region,
      status: this.status,
      is_default: this.is_default,

      created_at: this.created_at,

      updated_at: this.updated_at,

      ...this.customColumns,
    }

    return output
  }

  parseResult(model: TaxRateModel): TaxRateModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof TaxRateModel]
    }

    return model
  }

  // Add a protected applyFind implementation
  protected async applyFind(id: number): Promise<TaxRateModel | undefined> {
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

export async function find(id: number): Promise<TaxRateModel | undefined> {
  const query = DB.instance.selectFrom('tax_rates').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  const instance = new TaxRateModel(undefined)
  return instance.createInstance(model)
}

export async function count(): Promise<number> {
  const results = await TaxRateModel.count()

  return results
}

export async function create(newTaxRate: NewTaxRate): Promise<TaxRateModel> {
  const instance = new TaxRateModel(undefined)
  return await instance.applyCreate(newTaxRate)
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(DB.instance)
}

export async function remove(id: number): Promise<void> {
  await DB.instance.deleteFrom('tax_rates')
    .where('id', '=', id)
    .execute()
}

export async function whereName(value: string): Promise<TaxRateModel[]> {
  const query = DB.instance.selectFrom('tax_rates').where('name', '=', value)
  const results: TaxRateJsonResponse = await query.execute()

  return results.map((modelItem: TaxRateJsonResponse) => new TaxRateModel(modelItem))
}

export async function whereRate(value: number): Promise<TaxRateModel[]> {
  const query = DB.instance.selectFrom('tax_rates').where('rate', '=', value)
  const results: TaxRateJsonResponse = await query.execute()

  return results.map((modelItem: TaxRateJsonResponse) => new TaxRateModel(modelItem))
}

export async function whereType(value: string): Promise<TaxRateModel[]> {
  const query = DB.instance.selectFrom('tax_rates').where('type', '=', value)
  const results: TaxRateJsonResponse = await query.execute()

  return results.map((modelItem: TaxRateJsonResponse) => new TaxRateModel(modelItem))
}

export async function whereCountry(value: string): Promise<TaxRateModel[]> {
  const query = DB.instance.selectFrom('tax_rates').where('country', '=', value)
  const results: TaxRateJsonResponse = await query.execute()

  return results.map((modelItem: TaxRateJsonResponse) => new TaxRateModel(modelItem))
}

export async function whereRegion(value: string | string[]): Promise<TaxRateModel[]> {
  const query = DB.instance.selectFrom('tax_rates').where('region', '=', value)
  const results: TaxRateJsonResponse = await query.execute()

  return results.map((modelItem: TaxRateJsonResponse) => new TaxRateModel(modelItem))
}

export async function whereStatus(value: string | string[]): Promise<TaxRateModel[]> {
  const query = DB.instance.selectFrom('tax_rates').where('status', '=', value)
  const results: TaxRateJsonResponse = await query.execute()

  return results.map((modelItem: TaxRateJsonResponse) => new TaxRateModel(modelItem))
}

export async function whereIsDefault(value: boolean): Promise<TaxRateModel[]> {
  const query = DB.instance.selectFrom('tax_rates').where('is_default', '=', value)
  const results: TaxRateJsonResponse = await query.execute()

  return results.map((modelItem: TaxRateJsonResponse) => new TaxRateModel(modelItem))
}

export const TaxRate = TaxRateModel

export default TaxRate
