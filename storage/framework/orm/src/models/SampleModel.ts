import type { RawBuilder } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import type { NewSampleModel, SampleModelJsonResponse, SampleModelsTable, SampleModelUpdate } from '../types/SampleModelType'
import { sql } from '@stacksjs/database'
import { HttpError } from '@stacksjs/error-handling'
import { DB } from '@stacksjs/orm'

import { BaseOrm } from '../utils/base'

export class SampleModelModel extends BaseOrm<SampleModelModel, SampleModelsTable, SampleModelJsonResponse> {
  private readonly hidden: Array<keyof SampleModelJsonResponse> = []
  private readonly fillable: Array<keyof SampleModelJsonResponse> = []
  private readonly guarded: Array<keyof SampleModelJsonResponse> = []
  protected attributes = {} as SampleModelJsonResponse
  protected originalAttributes = {} as SampleModelJsonResponse

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

  constructor(sampleModel: SampleModelJsonResponse | undefined) {
    super('sample_models')
    if (sampleModel) {
      this.attributes = { ...sampleModel }
      this.originalAttributes = { ...sampleModel }

      Object.keys(sampleModel).forEach((key) => {
        if (!(key in this)) {
          this.customColumns[key] = (sampleModel as SampleModelJsonResponse)[key]
        }
      })
    }

    this.withRelations = []
    this.selectFromQuery = DB.instance.selectFrom('sample_models')
    this.updateFromQuery = DB.instance.updateTable('sample_models')
    this.deleteFromQuery = DB.instance.deleteFrom('sample_models')
    this.hasSelect = false
  }

  protected async loadRelations(models: SampleModelJsonResponse | SampleModelJsonResponse[]): Promise<void> {
    // Handle both single model and array of models
    const modelArray = Array.isArray(models) ? models : [models]
    if (!modelArray.length)
      return

    const modelIds = modelArray.map(model => model.id)

    for (const relation of this.withRelations) {
      const relatedRecords = await DB.instance
        .selectFrom(relation)
        .where('sampleModel_id', 'in', modelIds)
        .selectAll()
        .execute()

      if (Array.isArray(models)) {
        models.map((model: SampleModelJsonResponse) => {
          const records = relatedRecords.filter((record: { sampleModel_id: number }) => {
            return record.sampleModel_id === model.id
          })

          model[relation] = records.length === 1 ? records[0] : records
          return model
        })
      }
      else {
        const records = relatedRecords.filter((record: { sampleModel_id: number }) => {
          return record.sampleModel_id === models.id
        })

        models[relation] = records.length === 1 ? records[0] : records
      }
    }
  }

  static with(relations: string[]): SampleModelModel {
    const instance = new SampleModelModel(undefined)

    return instance.applyWith(relations)
  }

  protected mapCustomGetters(models: SampleModelJsonResponse | SampleModelJsonResponse[]): void {
    const data = models

    if (Array.isArray(data)) {
      data.map((model: SampleModelJsonResponse) => {
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

  async mapCustomSetters(model: NewSampleModel): Promise<void> {
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

  get created_at(): string | undefined {
    return this.attributes.created_at
  }

  get updated_at(): string | undefined {
    return this.attributes.updated_at
  }

  set updated_at(value: string) {
    this.attributes.updated_at = value
  }

  static select(params: (keyof SampleModelJsonResponse)[] | RawBuilder<string> | string): SampleModelModel {
    const instance = new SampleModelModel(undefined)

    return instance.applySelect(params)
  }

  // Method to find a SampleModel by ID
  static async find(id: number): Promise<SampleModelModel | undefined> {
    const query = DB.instance.selectFrom('sample_models').where('id', '=', id).selectAll()

    const model = await query.executeTakeFirst()

    if (!model)
      return undefined

    const instance = new SampleModelModel(undefined)
    return instance.createInstance(model)
  }

  static async first(): Promise<SampleModelModel | undefined> {
    const instance = new SampleModelModel(undefined)

    const model = await instance.applyFirst()

    const data = new SampleModelModel(model)

    return data
  }

  static async last(): Promise<SampleModelModel | undefined> {
    const instance = new SampleModelModel(undefined)

    const model = await instance.applyLast()

    if (!model)
      return undefined

    return new SampleModelModel(model)
  }

  static async firstOrFail(): Promise<SampleModelModel | undefined> {
    const instance = new SampleModelModel(undefined)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<SampleModelModel[]> {
    const instance = new SampleModelModel(undefined)

    const models = await DB.instance.selectFrom('sample_models').selectAll().execute()

    instance.mapCustomGetters(models)

    const data = await Promise.all(models.map(async (model: SampleModelJsonResponse) => {
      return new SampleModelModel(model)
    }))

    return data
  }

  static async findOrFail(id: number): Promise<SampleModelModel | undefined> {
    const instance = new SampleModelModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  static async findMany(ids: number[]): Promise<SampleModelModel[]> {
    const instance = new SampleModelModel(undefined)

    const models = await instance.applyFindMany(ids)

    return models.map((modelItem: SampleModelJsonResponse) => instance.parseResult(new SampleModelModel(modelItem)))
  }

  static async latest(column: keyof SampleModelsTable = 'created_at'): Promise<SampleModelModel | undefined> {
    const instance = new SampleModelModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'desc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new SampleModelModel(model)
  }

  static async oldest(column: keyof SampleModelsTable = 'created_at'): Promise<SampleModelModel | undefined> {
    const instance = new SampleModelModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'asc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new SampleModelModel(model)
  }

  static skip(count: number): SampleModelModel {
    const instance = new SampleModelModel(undefined)

    return instance.applySkip(count)
  }

  static take(count: number): SampleModelModel {
    const instance = new SampleModelModel(undefined)

    return instance.applyTake(count)
  }

  static where<V = string>(column: keyof SampleModelsTable, ...args: [V] | [Operator, V]): SampleModelModel {
    const instance = new SampleModelModel(undefined)

    return instance.applyWhere<V>(column, ...args)
  }

  static orWhere(...conditions: [string, any][]): SampleModelModel {
    const instance = new SampleModelModel(undefined)

    return instance.applyOrWhere(...conditions)
  }

  static whereNotIn<V = number>(column: keyof SampleModelsTable, values: V[]): SampleModelModel {
    const instance = new SampleModelModel(undefined)

    return instance.applyWhereNotIn<V>(column, values)
  }

  static whereBetween<V = number>(column: keyof SampleModelsTable, range: [V, V]): SampleModelModel {
    const instance = new SampleModelModel(undefined)

    return instance.applyWhereBetween<V>(column, range)
  }

  static whereRef(column: keyof SampleModelsTable, ...args: string[]): SampleModelModel {
    const instance = new SampleModelModel(undefined)

    return instance.applyWhereRef(column, ...args)
  }

  static when(condition: boolean, callback: (query: SampleModelModel) => SampleModelModel): SampleModelModel {
    const instance = new SampleModelModel(undefined)

    return instance.applyWhen(condition, callback as any)
  }

  static whereNull(column: keyof SampleModelsTable): SampleModelModel {
    const instance = new SampleModelModel(undefined)

    return instance.applyWhereNull(column)
  }

  static whereNotNull(column: keyof SampleModelsTable): SampleModelModel {
    const instance = new SampleModelModel(undefined)

    return instance.applyWhereNotNull(column)
  }

  static whereLike(column: keyof SampleModelsTable, value: string): SampleModelModel {
    const instance = new SampleModelModel(undefined)

    return instance.applyWhereLike(column, value)
  }

  static orderBy(column: keyof SampleModelsTable, order: 'asc' | 'desc'): SampleModelModel {
    const instance = new SampleModelModel(undefined)

    return instance.applyOrderBy(column, order)
  }

  static orderByAsc(column: keyof SampleModelsTable): SampleModelModel {
    const instance = new SampleModelModel(undefined)

    return instance.applyOrderByAsc(column)
  }

  static orderByDesc(column: keyof SampleModelsTable): SampleModelModel {
    const instance = new SampleModelModel(undefined)

    return instance.applyOrderByDesc(column)
  }

  static groupBy(column: keyof SampleModelsTable): SampleModelModel {
    const instance = new SampleModelModel(undefined)

    return instance.applyGroupBy(column)
  }

  static having<V = string>(column: keyof SampleModelsTable, operator: Operator, value: V): SampleModelModel {
    const instance = new SampleModelModel(undefined)

    return instance.applyHaving<V>(column, operator, value)
  }

  static inRandomOrder(): SampleModelModel {
    const instance = new SampleModelModel(undefined)

    return instance.applyInRandomOrder()
  }

  static whereColumn(first: keyof SampleModelsTable, operator: Operator, second: keyof SampleModelsTable): SampleModelModel {
    const instance = new SampleModelModel(undefined)

    return instance.applyWhereColumn(first, operator, second)
  }

  static async max(field: keyof SampleModelsTable): Promise<number> {
    const instance = new SampleModelModel(undefined)

    return await instance.applyMax(field)
  }

  static async min(field: keyof SampleModelsTable): Promise<number> {
    const instance = new SampleModelModel(undefined)

    return await instance.applyMin(field)
  }

  static async avg(field: keyof SampleModelsTable): Promise<number> {
    const instance = new SampleModelModel(undefined)

    return await instance.applyAvg(field)
  }

  static async sum(field: keyof SampleModelsTable): Promise<number> {
    const instance = new SampleModelModel(undefined)

    return await instance.applySum(field)
  }

  static async count(): Promise<number> {
    const instance = new SampleModelModel(undefined)

    return instance.applyCount()
  }

  static async get(): Promise<SampleModelModel[]> {
    const instance = new SampleModelModel(undefined)

    const results = await instance.applyGet()

    return results.map((item: SampleModelJsonResponse) => instance.createInstance(item))
  }

  static async pluck<K extends keyof SampleModelModel>(field: K): Promise<SampleModelModel[K][]> {
    const instance = new SampleModelModel(undefined)

    return await instance.applyPluck(field)
  }

  static async chunk(size: number, callback: (models: SampleModelModel[]) => Promise<void>): Promise<void> {
    const instance = new SampleModelModel(undefined)

    await instance.applyChunk(size, async (models) => {
      const modelInstances = models.map((item: SampleModelJsonResponse) => instance.createInstance(item))
      await callback(modelInstances)
    })
  }

  static async paginate(options: { limit?: number, offset?: number, page?: number } = { limit: 10, offset: 0, page: 1 }): Promise<{
    data: SampleModelModel[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }> {
    const instance = new SampleModelModel(undefined)

    const result = await instance.applyPaginate(options)

    return {
      data: result.data.map((item: SampleModelJsonResponse) => instance.createInstance(item)),
      paging: result.paging,
      next_cursor: result.next_cursor,
    }
  }

  // Instance method for creating model instances
  createInstance(data: SampleModelJsonResponse): SampleModelModel {
    return new SampleModelModel(data)
  }

  async applyCreate(newSampleModel: NewSampleModel): Promise<SampleModelModel> {
    const filteredValues = Object.fromEntries(
      Object.entries(newSampleModel).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewSampleModel

    await this.mapCustomSetters(filteredValues)

    const result = await DB.instance.insertInto('sample_models')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await DB.instance.selectFrom('sample_models')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created SampleModel')
    }

    return this.createInstance(model)
  }

  async create(newSampleModel: NewSampleModel): Promise<SampleModelModel> {
    return await this.applyCreate(newSampleModel)
  }

  static async create(newSampleModel: NewSampleModel): Promise<SampleModelModel> {
    const instance = new SampleModelModel(undefined)
    return await instance.applyCreate(newSampleModel)
  }

  static async firstOrCreate(search: Partial<SampleModelsTable>, values: NewSampleModel = {} as NewSampleModel): Promise<SampleModelModel> {
    // First try to find a record matching the search criteria
    const instance = new SampleModelModel(undefined)

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
    const createData = { ...search, ...values } as NewSampleModel
    return await SampleModelModel.create(createData)
  }

  static async updateOrCreate(search: Partial<SampleModelsTable>, values: NewSampleModel = {} as NewSampleModel): Promise<SampleModelModel> {
    // First try to find a record matching the search criteria
    const instance = new SampleModelModel(undefined)

    // Apply all search conditions
    for (const [key, value] of Object.entries(search)) {
      instance.selectFromQuery = instance.selectFromQuery.where(key, '=', value)
    }

    // Try to find the record
    const existingRecord = await instance.applyFirst()

    if (existingRecord) {
      // If record exists, update it with the new values
      const model = instance.createInstance(existingRecord)
      const updatedModel = await model.update(values as SampleModelUpdate)

      // Return the updated model instance
      if (updatedModel) {
        return updatedModel
      }

      // If update didn't return a model, fetch it again to ensure we have latest data
      const refreshedModel = await instance.applyFirst()
      return instance.createInstance(refreshedModel!)
    }

    // If no record exists, create a new one with combined search criteria and values
    const createData = { ...search, ...values } as NewSampleModel
    return await SampleModelModel.create(createData)
  }

  async update(newSampleModel: SampleModelUpdate): Promise<SampleModelModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newSampleModel).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as SampleModelUpdate

    await this.mapCustomSetters(filteredValues)

    filteredValues.updated_at = new Date().toISOString()

    await DB.instance.updateTable('sample_models')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('sample_models')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated SampleModel')
      }

      return this.createInstance(model)
    }

    return undefined
  }

  async forceUpdate(newSampleModel: SampleModelUpdate): Promise<SampleModelModel | undefined> {
    await DB.instance.updateTable('sample_models')
      .set(newSampleModel)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('sample_models')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated SampleModel')
      }

      return this.createInstance(model)
    }

    return undefined
  }

  async save(): Promise<SampleModelModel> {
    // If the model has an ID, update it; otherwise, create a new record
    if (this.id) {
      // Update existing record
      await DB.instance.updateTable('sample_models')
        .set(this.attributes as SampleModelUpdate)
        .where('id', '=', this.id)
        .executeTakeFirst()

      // Get the updated data
      const model = await DB.instance.selectFrom('sample_models')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated SampleModel')
      }

      return this.createInstance(model)
    }
    else {
      // Create new record
      const result = await DB.instance.insertInto('sample_models')
        .values(this.attributes as NewSampleModel)
        .executeTakeFirst()

      // Get the created data
      const model = await DB.instance.selectFrom('sample_models')
        .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve created SampleModel')
      }

      return this.createInstance(model)
    }
  }

  static async createMany(newSampleModel: NewSampleModel[]): Promise<void> {
    const instance = new SampleModelModel(undefined)

    const valuesFiltered = newSampleModel.map((newSampleModel: NewSampleModel) => {
      const filteredValues = Object.fromEntries(
        Object.entries(newSampleModel).filter(([key]) =>
          !instance.guarded.includes(key) && instance.fillable.includes(key),
        ),
      ) as NewSampleModel

      return filteredValues
    })

    await DB.instance.insertInto('sample_models')
      .values(valuesFiltered)
      .executeTakeFirst()
  }

  static async forceCreate(newSampleModel: NewSampleModel): Promise<SampleModelModel> {
    const result = await DB.instance.insertInto('sample_models')
      .values(newSampleModel)
      .executeTakeFirst()

    const instance = new SampleModelModel(undefined)
    const model = await DB.instance.selectFrom('sample_models')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created SampleModel')
    }

    return instance.createInstance(model)
  }

  // Method to remove a SampleModel
  async delete(): Promise<number> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()

    const deleted = await DB.instance.deleteFrom('sample_models')
      .where('id', '=', this.id)
      .execute()

    return deleted.numDeletedRows
  }

  static async remove(id: number): Promise<any> {
    return await DB.instance.deleteFrom('sample_models')
      .where('id', '=', id)
      .execute()
  }

  static whereIn<V = number>(column: keyof SampleModelsTable, values: V[]): SampleModelModel {
    const instance = new SampleModelModel(undefined)

    return instance.applyWhereIn<V>(column, values)
  }

  static distinct(column: keyof SampleModelJsonResponse): SampleModelModel {
    const instance = new SampleModelModel(undefined)

    return instance.applyDistinct(column)
  }

  static join(table: string, firstCol: string, secondCol: string): SampleModelModel {
    const instance = new SampleModelModel(undefined)

    return instance.applyJoin(table, firstCol, secondCol)
  }

  toJSON(): SampleModelJsonResponse {
    const output = {

      id: this.id,

      created_at: this.created_at,

      updated_at: this.updated_at,

      ...this.customColumns,
    }

    return output
  }

  parseResult(model: SampleModelModel): SampleModelModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof SampleModelModel]
    }

    return model
  }

  // Add a protected applyFind implementation
  protected async applyFind(id: number): Promise<SampleModelModel | undefined> {
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

export async function find(id: number): Promise<SampleModelModel | undefined> {
  const query = DB.instance.selectFrom('sample_models').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  const instance = new SampleModelModel(undefined)
  return instance.createInstance(model)
}

export async function count(): Promise<number> {
  const results = await SampleModelModel.count()

  return results
}

export async function create(newSampleModel: NewSampleModel): Promise<SampleModelModel> {
  const instance = new SampleModelModel(undefined)
  return await instance.applyCreate(newSampleModel)
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(DB.instance)
}

export async function remove(id: number): Promise<void> {
  await DB.instance.deleteFrom('sample_models')
    .where('id', '=', id)
    .execute()
}

export const SampleModel = SampleModelModel

export default SampleModel
