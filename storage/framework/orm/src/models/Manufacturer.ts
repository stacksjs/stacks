import type { RawBuilder } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import type { ManufacturerJsonResponse, ManufacturersTable, ManufacturerUpdate, NewManufacturer } from '../types/ManufacturerType'
import type { ProductModel } from './Product'
import { randomUUIDv7 } from 'bun'
import { sql } from '@stacksjs/database'
import { HttpError } from '@stacksjs/error-handling'
import { dispatch } from '@stacksjs/events'
import { DB } from '@stacksjs/orm'

import { BaseOrm } from '../utils/base'

export class ManufacturerModel extends BaseOrm<ManufacturerModel, ManufacturersTable, ManufacturerJsonResponse> {
  private readonly hidden: Array<keyof ManufacturerJsonResponse> = []
  private readonly fillable: Array<keyof ManufacturerJsonResponse> = ['manufacturer', 'description', 'country', 'featured', 'uuid']
  private readonly guarded: Array<keyof ManufacturerJsonResponse> = []
  protected attributes = {} as ManufacturerJsonResponse
  protected originalAttributes = {} as ManufacturerJsonResponse

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

  constructor(manufacturer: ManufacturerJsonResponse | undefined) {
    super('manufacturers')
    if (manufacturer) {
      this.attributes = { ...manufacturer }
      this.originalAttributes = { ...manufacturer }

      Object.keys(manufacturer).forEach((key) => {
        if (!(key in this)) {
          this.customColumns[key] = (manufacturer as ManufacturerJsonResponse)[key]
        }
      })
    }

    this.withRelations = []
    this.selectFromQuery = DB.instance.selectFrom('manufacturers')
    this.updateFromQuery = DB.instance.updateTable('manufacturers')
    this.deleteFromQuery = DB.instance.deleteFrom('manufacturers')
    this.hasSelect = false
  }

  protected async loadRelations(models: ManufacturerJsonResponse | ManufacturerJsonResponse[]): Promise<void> {
    // Handle both single model and array of models
    const modelArray = Array.isArray(models) ? models : [models]
    if (!modelArray.length)
      return

    const modelIds = modelArray.map(model => model.id)

    for (const relation of this.withRelations) {
      const relatedRecords = await DB.instance
        .selectFrom(relation)
        .where('manufacturer_id', 'in', modelIds)
        .selectAll()
        .execute()

      if (Array.isArray(models)) {
        models.map((model: ManufacturerJsonResponse) => {
          const records = relatedRecords.filter((record: { manufacturer_id: number }) => {
            return record.manufacturer_id === model.id
          })

          model[relation] = records.length === 1 ? records[0] : records
          return model
        })
      }
      else {
        const records = relatedRecords.filter((record: { manufacturer_id: number }) => {
          return record.manufacturer_id === models.id
        })

        models[relation] = records.length === 1 ? records[0] : records
      }
    }
  }

  static with(relations: string[]): ManufacturerModel {
    const instance = new ManufacturerModel(undefined)

    return instance.applyWith(relations)
  }

  protected mapCustomGetters(models: ManufacturerJsonResponse | ManufacturerJsonResponse[]): void {
    const data = models

    if (Array.isArray(data)) {
      data.map((model: ManufacturerJsonResponse) => {
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

  async mapCustomSetters(model: NewManufacturer): Promise<void> {
    const customSetter = {
      default: () => {
      },

    }

    for (const [key, fn] of Object.entries(customSetter)) {
      (model as any)[key] = await fn()
    }
  }

  get products(): ProductModel[] | [] {
    return this.attributes.products
  }

  get id(): number {
    return this.attributes.id
  }

  get uuid(): string | undefined {
    return this.attributes.uuid
  }

  get manufacturer(): string {
    return this.attributes.manufacturer
  }

  get description(): string | undefined {
    return this.attributes.description
  }

  get country(): string {
    return this.attributes.country
  }

  get featured(): boolean | undefined {
    return this.attributes.featured
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

  set manufacturer(value: string) {
    this.attributes.manufacturer = value
  }

  set description(value: string) {
    this.attributes.description = value
  }

  set country(value: string) {
    this.attributes.country = value
  }

  set featured(value: boolean) {
    this.attributes.featured = value
  }

  set updated_at(value: string) {
    this.attributes.updated_at = value
  }

  static select(params: (keyof ManufacturerJsonResponse)[] | RawBuilder<string> | string): ManufacturerModel {
    const instance = new ManufacturerModel(undefined)

    return instance.applySelect(params)
  }

  // Method to find a Manufacturer by ID
  static async find(id: number): Promise<ManufacturerModel | undefined> {
    const query = DB.instance.selectFrom('manufacturers').where('id', '=', id).selectAll()

    const model = await query.executeTakeFirst()

    if (!model)
      return undefined

    const instance = new ManufacturerModel(undefined)
    return instance.createInstance(model)
  }

  static async first(): Promise<ManufacturerModel | undefined> {
    const instance = new ManufacturerModel(undefined)

    const model = await instance.applyFirst()

    const data = new ManufacturerModel(model)

    return data
  }

  static async last(): Promise<ManufacturerModel | undefined> {
    const instance = new ManufacturerModel(undefined)

    const model = await instance.applyLast()

    if (!model)
      return undefined

    return new ManufacturerModel(model)
  }

  static async firstOrFail(): Promise<ManufacturerModel | undefined> {
    const instance = new ManufacturerModel(undefined)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<ManufacturerModel[]> {
    const instance = new ManufacturerModel(undefined)

    const models = await DB.instance.selectFrom('manufacturers').selectAll().execute()

    instance.mapCustomGetters(models)

    const data = await Promise.all(models.map(async (model: ManufacturerJsonResponse) => {
      return new ManufacturerModel(model)
    }))

    return data
  }

  static async findOrFail(id: number): Promise<ManufacturerModel | undefined> {
    const instance = new ManufacturerModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  static async findMany(ids: number[]): Promise<ManufacturerModel[]> {
    const instance = new ManufacturerModel(undefined)

    const models = await instance.applyFindMany(ids)

    return models.map((modelItem: ManufacturerJsonResponse) => instance.parseResult(new ManufacturerModel(modelItem)))
  }

  static async latest(column: keyof ManufacturersTable = 'created_at'): Promise<ManufacturerModel | undefined> {
    const instance = new ManufacturerModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'desc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new ManufacturerModel(model)
  }

  static async oldest(column: keyof ManufacturersTable = 'created_at'): Promise<ManufacturerModel | undefined> {
    const instance = new ManufacturerModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'asc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new ManufacturerModel(model)
  }

  static skip(count: number): ManufacturerModel {
    const instance = new ManufacturerModel(undefined)

    return instance.applySkip(count)
  }

  static take(count: number): ManufacturerModel {
    const instance = new ManufacturerModel(undefined)

    return instance.applyTake(count)
  }

  static where<V = string>(column: keyof ManufacturersTable, ...args: [V] | [Operator, V]): ManufacturerModel {
    const instance = new ManufacturerModel(undefined)

    return instance.applyWhere<V>(column, ...args)
  }

  static orWhere(...conditions: [string, any][]): ManufacturerModel {
    const instance = new ManufacturerModel(undefined)

    return instance.applyOrWhere(...conditions)
  }

  static whereNotIn<V = number>(column: keyof ManufacturersTable, values: V[]): ManufacturerModel {
    const instance = new ManufacturerModel(undefined)

    return instance.applyWhereNotIn<V>(column, values)
  }

  static whereBetween<V = number>(column: keyof ManufacturersTable, range: [V, V]): ManufacturerModel {
    const instance = new ManufacturerModel(undefined)

    return instance.applyWhereBetween<V>(column, range)
  }

  static whereRef(column: keyof ManufacturersTable, ...args: string[]): ManufacturerModel {
    const instance = new ManufacturerModel(undefined)

    return instance.applyWhereRef(column, ...args)
  }

  static when(condition: boolean, callback: (query: ManufacturerModel) => ManufacturerModel): ManufacturerModel {
    const instance = new ManufacturerModel(undefined)

    return instance.applyWhen(condition, callback as any)
  }

  static whereNull(column: keyof ManufacturersTable): ManufacturerModel {
    const instance = new ManufacturerModel(undefined)

    return instance.applyWhereNull(column)
  }

  static whereNotNull(column: keyof ManufacturersTable): ManufacturerModel {
    const instance = new ManufacturerModel(undefined)

    return instance.applyWhereNotNull(column)
  }

  static whereLike(column: keyof ManufacturersTable, value: string): ManufacturerModel {
    const instance = new ManufacturerModel(undefined)

    return instance.applyWhereLike(column, value)
  }

  static orderBy(column: keyof ManufacturersTable, order: 'asc' | 'desc'): ManufacturerModel {
    const instance = new ManufacturerModel(undefined)

    return instance.applyOrderBy(column, order)
  }

  static orderByAsc(column: keyof ManufacturersTable): ManufacturerModel {
    const instance = new ManufacturerModel(undefined)

    return instance.applyOrderByAsc(column)
  }

  static orderByDesc(column: keyof ManufacturersTable): ManufacturerModel {
    const instance = new ManufacturerModel(undefined)

    return instance.applyOrderByDesc(column)
  }

  static groupBy(column: keyof ManufacturersTable): ManufacturerModel {
    const instance = new ManufacturerModel(undefined)

    return instance.applyGroupBy(column)
  }

  static having<V = string>(column: keyof ManufacturersTable, operator: Operator, value: V): ManufacturerModel {
    const instance = new ManufacturerModel(undefined)

    return instance.applyHaving<V>(column, operator, value)
  }

  static inRandomOrder(): ManufacturerModel {
    const instance = new ManufacturerModel(undefined)

    return instance.applyInRandomOrder()
  }

  static whereColumn(first: keyof ManufacturersTable, operator: Operator, second: keyof ManufacturersTable): ManufacturerModel {
    const instance = new ManufacturerModel(undefined)

    return instance.applyWhereColumn(first, operator, second)
  }

  static async max(field: keyof ManufacturersTable): Promise<number> {
    const instance = new ManufacturerModel(undefined)

    return await instance.applyMax(field)
  }

  static async min(field: keyof ManufacturersTable): Promise<number> {
    const instance = new ManufacturerModel(undefined)

    return await instance.applyMin(field)
  }

  static async avg(field: keyof ManufacturersTable): Promise<number> {
    const instance = new ManufacturerModel(undefined)

    return await instance.applyAvg(field)
  }

  static async sum(field: keyof ManufacturersTable): Promise<number> {
    const instance = new ManufacturerModel(undefined)

    return await instance.applySum(field)
  }

  static async count(): Promise<number> {
    const instance = new ManufacturerModel(undefined)

    return instance.applyCount()
  }

  static async get(): Promise<ManufacturerModel[]> {
    const instance = new ManufacturerModel(undefined)

    const results = await instance.applyGet()

    return results.map((item: ManufacturerJsonResponse) => instance.createInstance(item))
  }

  static async pluck<K extends keyof ManufacturerModel>(field: K): Promise<ManufacturerModel[K][]> {
    const instance = new ManufacturerModel(undefined)

    return await instance.applyPluck(field)
  }

  static async chunk(size: number, callback: (models: ManufacturerModel[]) => Promise<void>): Promise<void> {
    const instance = new ManufacturerModel(undefined)

    await instance.applyChunk(size, async (models) => {
      const modelInstances = models.map((item: ManufacturerJsonResponse) => instance.createInstance(item))
      await callback(modelInstances)
    })
  }

  static async paginate(options: { limit?: number, offset?: number, page?: number } = { limit: 10, offset: 0, page: 1 }): Promise<{
    data: ManufacturerModel[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }> {
    const instance = new ManufacturerModel(undefined)

    const result = await instance.applyPaginate(options)

    return {
      data: result.data.map((item: ManufacturerJsonResponse) => instance.createInstance(item)),
      paging: result.paging,
      next_cursor: result.next_cursor,
    }
  }

  // Instance method for creating model instances
  createInstance(data: ManufacturerJsonResponse): ManufacturerModel {
    return new ManufacturerModel(data)
  }

  async applyCreate(newManufacturer: NewManufacturer): Promise<ManufacturerModel> {
    const filteredValues = Object.fromEntries(
      Object.entries(newManufacturer).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewManufacturer

    await this.mapCustomSetters(filteredValues)

    filteredValues.uuid = randomUUIDv7()

    const result = await DB.instance.insertInto('manufacturers')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await DB.instance.selectFrom('manufacturers')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created Manufacturer')
    }

    if (model)
      dispatch('manufacturer:created', model)
    return this.createInstance(model)
  }

  async create(newManufacturer: NewManufacturer): Promise<ManufacturerModel> {
    return await this.applyCreate(newManufacturer)
  }

  static async create(newManufacturer: NewManufacturer): Promise<ManufacturerModel> {
    const instance = new ManufacturerModel(undefined)
    return await instance.applyCreate(newManufacturer)
  }

  static async firstOrCreate(search: Partial<ManufacturersTable>, values: NewManufacturer = {} as NewManufacturer): Promise<ManufacturerModel> {
    // First try to find a record matching the search criteria
    const instance = new ManufacturerModel(undefined)

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
    const createData = { ...search, ...values } as NewManufacturer
    return await ManufacturerModel.create(createData)
  }

  static async updateOrCreate(search: Partial<ManufacturersTable>, values: NewManufacturer = {} as NewManufacturer): Promise<ManufacturerModel> {
    // First try to find a record matching the search criteria
    const instance = new ManufacturerModel(undefined)

    // Apply all search conditions
    for (const [key, value] of Object.entries(search)) {
      instance.selectFromQuery = instance.selectFromQuery.where(key, '=', value)
    }

    // Try to find the record
    const existingRecord = await instance.applyFirst()

    if (existingRecord) {
      // If record exists, update it with the new values
      const model = instance.createInstance(existingRecord)
      const updatedModel = await model.update(values as ManufacturerUpdate)

      // Return the updated model instance
      if (updatedModel) {
        return updatedModel
      }

      // If update didn't return a model, fetch it again to ensure we have latest data
      const refreshedModel = await instance.applyFirst()
      return instance.createInstance(refreshedModel!)
    }

    // If no record exists, create a new one with combined search criteria and values
    const createData = { ...search, ...values } as NewManufacturer
    return await ManufacturerModel.create(createData)
  }

  async update(newManufacturer: ManufacturerUpdate): Promise<ManufacturerModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newManufacturer).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as ManufacturerUpdate

    await this.mapCustomSetters(filteredValues)

    filteredValues.updated_at = new Date().toISOString()

    await DB.instance.updateTable('manufacturers')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('manufacturers')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated Manufacturer')
      }

      if (model)
        dispatch('manufacturer:updated', model)
      return this.createInstance(model)
    }

    return undefined
  }

  async forceUpdate(newManufacturer: ManufacturerUpdate): Promise<ManufacturerModel | undefined> {
    await DB.instance.updateTable('manufacturers')
      .set(newManufacturer)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('manufacturers')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated Manufacturer')
      }

      if (this)
        dispatch('manufacturer:updated', model)
      return this.createInstance(model)
    }

    return undefined
  }

  async save(): Promise<ManufacturerModel> {
    // If the model has an ID, update it; otherwise, create a new record
    if (this.id) {
      // Update existing record
      await DB.instance.updateTable('manufacturers')
        .set(this.attributes as ManufacturerUpdate)
        .where('id', '=', this.id)
        .executeTakeFirst()

      // Get the updated data
      const model = await DB.instance.selectFrom('manufacturers')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated Manufacturer')
      }

      if (this)
        dispatch('manufacturer:updated', model)
      return this.createInstance(model)
    }
    else {
      // Create new record
      const result = await DB.instance.insertInto('manufacturers')
        .values(this.attributes as NewManufacturer)
        .executeTakeFirst()

      // Get the created data
      const model = await DB.instance.selectFrom('manufacturers')
        .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve created Manufacturer')
      }

      if (this)
        dispatch('manufacturer:created', model)
      return this.createInstance(model)
    }
  }

  static async createMany(newManufacturer: NewManufacturer[]): Promise<void> {
    const instance = new ManufacturerModel(undefined)

    const valuesFiltered = newManufacturer.map((newManufacturer: NewManufacturer) => {
      const filteredValues = Object.fromEntries(
        Object.entries(newManufacturer).filter(([key]) =>
          !instance.guarded.includes(key) && instance.fillable.includes(key),
        ),
      ) as NewManufacturer

      filteredValues.uuid = randomUUIDv7()

      return filteredValues
    })

    await DB.instance.insertInto('manufacturers')
      .values(valuesFiltered)
      .executeTakeFirst()
  }

  static async forceCreate(newManufacturer: NewManufacturer): Promise<ManufacturerModel> {
    const result = await DB.instance.insertInto('manufacturers')
      .values(newManufacturer)
      .executeTakeFirst()

    const instance = new ManufacturerModel(undefined)
    const model = await DB.instance.selectFrom('manufacturers')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created Manufacturer')
    }

    if (model)
      dispatch('manufacturer:created', model)

    return instance.createInstance(model)
  }

  // Method to remove a Manufacturer
  async delete(): Promise<number> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()
    const model = await this.find(Number(this.id))

    if (model)
      dispatch('manufacturer:deleted', model)

    const deleted = await DB.instance.deleteFrom('manufacturers')
      .where('id', '=', this.id)
      .execute()

    return deleted.numDeletedRows
  }

  static async remove(id: number): Promise<any> {
    const instance = new ManufacturerModel(undefined)

    const model = await instance.find(Number(id))

    if (model)
      dispatch('manufacturer:deleted', model)

    return await DB.instance.deleteFrom('manufacturers')
      .where('id', '=', id)
      .execute()
  }

  static whereManufacturer(value: string): ManufacturerModel {
    const instance = new ManufacturerModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('manufacturer', '=', value)

    return instance
  }

  static whereDescription(value: string): ManufacturerModel {
    const instance = new ManufacturerModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('description', '=', value)

    return instance
  }

  static whereCountry(value: string): ManufacturerModel {
    const instance = new ManufacturerModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('country', '=', value)

    return instance
  }

  static whereFeatured(value: string): ManufacturerModel {
    const instance = new ManufacturerModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('featured', '=', value)

    return instance
  }

  static whereIn<V = number>(column: keyof ManufacturersTable, values: V[]): ManufacturerModel {
    const instance = new ManufacturerModel(undefined)

    return instance.applyWhereIn<V>(column, values)
  }

  toSearchableObject(): Partial<ManufacturerJsonResponse> {
    return {
      id: this.id,
      manufacturer: this.manufacturer,
      description: this.description,
      country: this.country,
      featured: this.featured,
    }
  }

  static distinct(column: keyof ManufacturerJsonResponse): ManufacturerModel {
    const instance = new ManufacturerModel(undefined)

    return instance.applyDistinct(column)
  }

  static join(table: string, firstCol: string, secondCol: string): ManufacturerModel {
    const instance = new ManufacturerModel(undefined)

    return instance.applyJoin(table, firstCol, secondCol)
  }

  toJSON(): ManufacturerJsonResponse {
    const output = {

      uuid: this.uuid,

      id: this.id,
      manufacturer: this.manufacturer,
      description: this.description,
      country: this.country,
      featured: this.featured,

      created_at: this.created_at,

      updated_at: this.updated_at,

      products: this.products,
      ...this.customColumns,
    }

    return output
  }

  parseResult(model: ManufacturerModel): ManufacturerModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof ManufacturerModel]
    }

    return model
  }

  // Add a protected applyFind implementation
  protected async applyFind(id: number): Promise<ManufacturerModel | undefined> {
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

export async function find(id: number): Promise<ManufacturerModel | undefined> {
  const query = DB.instance.selectFrom('manufacturers').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  const instance = new ManufacturerModel(undefined)
  return instance.createInstance(model)
}

export async function count(): Promise<number> {
  const results = await ManufacturerModel.count()

  return results
}

export async function create(newManufacturer: NewManufacturer): Promise<ManufacturerModel> {
  const instance = new ManufacturerModel(undefined)
  return await instance.applyCreate(newManufacturer)
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(DB.instance)
}

export async function remove(id: number): Promise<void> {
  await DB.instance.deleteFrom('manufacturers')
    .where('id', '=', id)
    .execute()
}

export async function whereManufacturer(value: string): Promise<ManufacturerModel[]> {
  const query = DB.instance.selectFrom('manufacturers').where('manufacturer', '=', value)
  const results: ManufacturerJsonResponse = await query.execute()

  return results.map((modelItem: ManufacturerJsonResponse) => new ManufacturerModel(modelItem))
}

export async function whereDescription(value: string): Promise<ManufacturerModel[]> {
  const query = DB.instance.selectFrom('manufacturers').where('description', '=', value)
  const results: ManufacturerJsonResponse = await query.execute()

  return results.map((modelItem: ManufacturerJsonResponse) => new ManufacturerModel(modelItem))
}

export async function whereCountry(value: string): Promise<ManufacturerModel[]> {
  const query = DB.instance.selectFrom('manufacturers').where('country', '=', value)
  const results: ManufacturerJsonResponse = await query.execute()

  return results.map((modelItem: ManufacturerJsonResponse) => new ManufacturerModel(modelItem))
}

export async function whereFeatured(value: boolean): Promise<ManufacturerModel[]> {
  const query = DB.instance.selectFrom('manufacturers').where('featured', '=', value)
  const results: ManufacturerJsonResponse = await query.execute()

  return results.map((modelItem: ManufacturerJsonResponse) => new ManufacturerModel(modelItem))
}

export const Manufacturer = ManufacturerModel

export default Manufacturer
