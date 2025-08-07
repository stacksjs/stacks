import type { RawBuilder } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
// soon, these will be auto-imported
import type { NewRelease, ReleaseJsonResponse, ReleasesTable, ReleaseUpdate } from '../types/ReleaseType'
import { sql } from '@stacksjs/database'
import { HttpError } from '@stacksjs/error-handling'
import { DB } from '@stacksjs/orm'

import { BaseOrm } from '../utils/base'

export class ReleaseModel extends BaseOrm<ReleaseModel, ReleasesTable, ReleaseJsonResponse> {
  private readonly hidden: Array<keyof ReleaseJsonResponse> = []
  private readonly fillable: Array<keyof ReleaseJsonResponse> = ['version']
  private readonly guarded: Array<keyof ReleaseJsonResponse> = []
  protected attributes = {} as ReleaseJsonResponse
  protected originalAttributes = {} as ReleaseJsonResponse

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

  constructor(release: ReleaseJsonResponse | undefined) {
    super('releases')
    if (release) {
      this.attributes = { ...release }
      this.originalAttributes = { ...release }

      Object.keys(release).forEach((key) => {
        if (!(key in this)) {
          this.customColumns[key] = (release as ReleaseJsonResponse)[key]
        }
      })
    }

    this.withRelations = []
    this.selectFromQuery = DB.instance.selectFrom('releases')
    this.updateFromQuery = DB.instance.updateTable('releases')
    this.deleteFromQuery = DB.instance.deleteFrom('releases')
    this.hasSelect = false
  }

  protected async loadRelations(models: ReleaseJsonResponse | ReleaseJsonResponse[]): Promise<void> {
    // Handle both single model and array of models
    const modelArray = Array.isArray(models) ? models : [models]
    if (!modelArray.length)
      return

    const modelIds = modelArray.map(model => model.id)

    for (const relation of this.withRelations) {
      const relatedRecords = await DB.instance
        .selectFrom(relation)
        .where('release_id', 'in', modelIds)
        .selectAll()
        .execute()

      if (Array.isArray(models)) {
        models.map((model: ReleaseJsonResponse) => {
          const records = relatedRecords.filter((record: { release_id: number }) => {
            return record.release_id === model.id
          })

          model[relation] = records.length === 1 ? records[0] : records
          return model
        })
      }
      else {
        const records = relatedRecords.filter((record: { release_id: number }) => {
          return record.release_id === models.id
        })

        models[relation] = records.length === 1 ? records[0] : records
      }
    }
  }

  static with(relations: string[]): ReleaseModel {
    const instance = new ReleaseModel(undefined)

    return instance.applyWith(relations)
  }

  protected mapCustomGetters(models: ReleaseJsonResponse | ReleaseJsonResponse[]): void {
    const data = models

    if (Array.isArray(data)) {
      data.map((model: ReleaseJsonResponse) => {
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

  async mapCustomSetters(model: NewRelease | ReleaseUpdate): Promise<void> {
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

  get name(): string {
    return this.attributes.name
  }

  get version(): string | undefined {
    return this.attributes.version
  }

  get created_at(): string | undefined {
    return this.attributes.created_at
  }

  get updated_at(): string | undefined {
    return this.attributes.updated_at
  }

  set name(value: string) {
    this.attributes.name = value
  }

  set version(value: string) {
    this.attributes.version = value
  }

  set updated_at(value: string) {
    this.attributes.updated_at = value
  }

  static select(params: (keyof ReleaseJsonResponse)[] | RawBuilder<string> | string): ReleaseModel {
    const instance = new ReleaseModel(undefined)

    return instance.applySelect(params)
  }

  // Method to find a Release by ID
  static async find(id: number): Promise<ReleaseModel | undefined> {
    const query = DB.instance.selectFrom('releases').where('id', '=', id).selectAll()

    const model = await query.executeTakeFirst()

    if (!model)
      return undefined

    const instance = new ReleaseModel(undefined)
    return instance.createInstance(model)
  }

  static async first(): Promise<ReleaseModel | undefined> {
    const instance = new ReleaseModel(undefined)

    const model = await instance.applyFirst()

    const data = new ReleaseModel(model)

    return data
  }

  static async last(): Promise<ReleaseModel | undefined> {
    const instance = new ReleaseModel(undefined)

    const model = await instance.applyLast()

    if (!model)
      return undefined

    return new ReleaseModel(model)
  }

  static async firstOrFail(): Promise<ReleaseModel | undefined> {
    const instance = new ReleaseModel(undefined)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<ReleaseModel[]> {
    const instance = new ReleaseModel(undefined)

    const models = await DB.instance.selectFrom('releases').selectAll().execute()

    instance.mapCustomGetters(models)

    const data = await Promise.all(models.map(async (model: ReleaseJsonResponse) => {
      return new ReleaseModel(model)
    }))

    return data
  }

  static async findOrFail(id: number): Promise<ReleaseModel | undefined> {
    const instance = new ReleaseModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  static async findMany(ids: number[]): Promise<ReleaseModel[]> {
    const instance = new ReleaseModel(undefined)

    const models = await instance.applyFindMany(ids)

    return models.map((modelItem: ReleaseJsonResponse) => instance.parseResult(new ReleaseModel(modelItem)))
  }

  static async latest(column: keyof ReleasesTable = 'created_at'): Promise<ReleaseModel | undefined> {
    const instance = new ReleaseModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'desc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new ReleaseModel(model)
  }

  static async oldest(column: keyof ReleasesTable = 'created_at'): Promise<ReleaseModel | undefined> {
    const instance = new ReleaseModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'asc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new ReleaseModel(model)
  }

  static skip(count: number): ReleaseModel {
    const instance = new ReleaseModel(undefined)

    return instance.applySkip(count)
  }

  static take(count: number): ReleaseModel {
    const instance = new ReleaseModel(undefined)

    return instance.applyTake(count)
  }

  static where<V = string>(column: keyof ReleasesTable, ...args: [V] | [Operator, V]): ReleaseModel {
    const instance = new ReleaseModel(undefined)

    return instance.applyWhere<V>(column, ...args)
  }

  static orWhere(...conditions: [string, any][]): ReleaseModel {
    const instance = new ReleaseModel(undefined)

    return instance.applyOrWhere(...conditions)
  }

  static whereNotIn<V = number>(column: keyof ReleasesTable, values: V[]): ReleaseModel {
    const instance = new ReleaseModel(undefined)

    return instance.applyWhereNotIn<V>(column, values)
  }

  static whereBetween<V = number>(column: keyof ReleasesTable, range: [V, V]): ReleaseModel {
    const instance = new ReleaseModel(undefined)

    return instance.applyWhereBetween<V>(column, range)
  }

  static whereRef(column: keyof ReleasesTable, ...args: string[]): ReleaseModel {
    const instance = new ReleaseModel(undefined)

    return instance.applyWhereRef(column, ...args)
  }

  static when(condition: boolean, callback: (query: ReleaseModel) => ReleaseModel): ReleaseModel {
    const instance = new ReleaseModel(undefined)

    return instance.applyWhen(condition, callback as any)
  }

  static whereNull(column: keyof ReleasesTable): ReleaseModel {
    const instance = new ReleaseModel(undefined)

    return instance.applyWhereNull(column)
  }

  static whereNotNull(column: keyof ReleasesTable): ReleaseModel {
    const instance = new ReleaseModel(undefined)

    return instance.applyWhereNotNull(column)
  }

  static whereLike(column: keyof ReleasesTable, value: string): ReleaseModel {
    const instance = new ReleaseModel(undefined)

    return instance.applyWhereLike(column, value)
  }

  static orderBy(column: keyof ReleasesTable, order: 'asc' | 'desc'): ReleaseModel {
    const instance = new ReleaseModel(undefined)

    return instance.applyOrderBy(column, order)
  }

  static orderByAsc(column: keyof ReleasesTable): ReleaseModel {
    const instance = new ReleaseModel(undefined)

    return instance.applyOrderByAsc(column)
  }

  static orderByDesc(column: keyof ReleasesTable): ReleaseModel {
    const instance = new ReleaseModel(undefined)

    return instance.applyOrderByDesc(column)
  }

  static groupBy(column: keyof ReleasesTable): ReleaseModel {
    const instance = new ReleaseModel(undefined)

    return instance.applyGroupBy(column)
  }

  static having<V = string>(column: keyof ReleasesTable, operator: Operator, value: V): ReleaseModel {
    const instance = new ReleaseModel(undefined)

    return instance.applyHaving<V>(column, operator, value)
  }

  static inRandomOrder(): ReleaseModel {
    const instance = new ReleaseModel(undefined)

    return instance.applyInRandomOrder()
  }

  static whereColumn(first: keyof ReleasesTable, operator: Operator, second: keyof ReleasesTable): ReleaseModel {
    const instance = new ReleaseModel(undefined)

    return instance.applyWhereColumn(first, operator, second)
  }

  static async max(field: keyof ReleasesTable): Promise<number> {
    const instance = new ReleaseModel(undefined)

    return await instance.applyMax(field)
  }

  static async min(field: keyof ReleasesTable): Promise<number> {
    const instance = new ReleaseModel(undefined)

    return await instance.applyMin(field)
  }

  static async avg(field: keyof ReleasesTable): Promise<number> {
    const instance = new ReleaseModel(undefined)

    return await instance.applyAvg(field)
  }

  static async sum(field: keyof ReleasesTable): Promise<number> {
    const instance = new ReleaseModel(undefined)

    return await instance.applySum(field)
  }

  static async count(): Promise<number> {
    const instance = new ReleaseModel(undefined)

    return instance.applyCount()
  }

  static async get(): Promise<ReleaseModel[]> {
    const instance = new ReleaseModel(undefined)

    const results = await instance.applyGet()

    return results.map((item: ReleaseJsonResponse) => instance.createInstance(item))
  }

  static async pluck<K extends keyof ReleaseModel>(field: K): Promise<ReleaseModel[K][]> {
    const instance = new ReleaseModel(undefined)

    return await instance.applyPluck(field)
  }

  static async chunk(size: number, callback: (models: ReleaseModel[]) => Promise<void>): Promise<void> {
    const instance = new ReleaseModel(undefined)

    await instance.applyChunk(size, async (models) => {
      const modelInstances = models.map((item: ReleaseJsonResponse) => instance.createInstance(item))
      await callback(modelInstances)
    })
  }

  static async paginate(options: { limit?: number, offset?: number, page?: number } = { limit: 10, offset: 0, page: 1 }): Promise<{
    data: ReleaseModel[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }> {
    const instance = new ReleaseModel(undefined)

    const result = await instance.applyPaginate(options)

    return {
      data: result.data.map((item: ReleaseJsonResponse) => instance.createInstance(item)),
      paging: result.paging,
      next_cursor: result.next_cursor,
    }
  }

  // Instance method for creating model instances
  createInstance(data: ReleaseJsonResponse): ReleaseModel {
    return new ReleaseModel(data)
  }

  async applyCreate(newRelease: NewRelease): Promise<ReleaseModel> {
    const filteredValues = Object.fromEntries(
      Object.entries(newRelease).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewRelease

    await this.mapCustomSetters(filteredValues)

    const result = await DB.instance.insertInto('releases')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await DB.instance.selectFrom('releases')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created Release')
    }

    return this.createInstance(model)
  }

  async create(newRelease: NewRelease): Promise<ReleaseModel> {
    return await this.applyCreate(newRelease)
  }

  static async create(newRelease: NewRelease): Promise<ReleaseModel> {
    const instance = new ReleaseModel(undefined)
    return await instance.applyCreate(newRelease)
  }

  static async firstOrCreate(search: Partial<ReleasesTable>, values: NewRelease = {} as NewRelease): Promise<ReleaseModel> {
    // First try to find a record matching the search criteria
    const instance = new ReleaseModel(undefined)

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
    const createData = { ...search, ...values } as NewRelease
    return await ReleaseModel.create(createData)
  }

  static async updateOrCreate(search: Partial<ReleasesTable>, values: NewRelease = {} as NewRelease): Promise<ReleaseModel> {
    // First try to find a record matching the search criteria
    const instance = new ReleaseModel(undefined)

    // Apply all search conditions
    for (const [key, value] of Object.entries(search)) {
      instance.selectFromQuery = instance.selectFromQuery.where(key, '=', value)
    }

    // Try to find the record
    const existingRecord = await instance.applyFirst()

    if (existingRecord) {
      // If record exists, update it with the new values
      const model = instance.createInstance(existingRecord)
      const updatedModel = await model.update(values as ReleaseUpdate)

      // Return the updated model instance
      if (updatedModel) {
        return updatedModel
      }

      // If update didn't return a model, fetch it again to ensure we have latest data
      const refreshedModel = await instance.applyFirst()
      return instance.createInstance(refreshedModel!)
    }

    // If no record exists, create a new one with combined search criteria and values
    const createData = { ...search, ...values } as NewRelease
    return await ReleaseModel.create(createData)
  }

  async update(newRelease: ReleaseUpdate): Promise<ReleaseModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newRelease).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as ReleaseUpdate

    await this.mapCustomSetters(filteredValues)

    filteredValues.updated_at = new Date().toISOString()

    await DB.instance.updateTable('releases')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('releases')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated Release')
      }

      return this.createInstance(model)
    }

    return undefined
  }

  async forceUpdate(newRelease: ReleaseUpdate): Promise<ReleaseModel | undefined> {
    await DB.instance.updateTable('releases')
      .set(newRelease)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('releases')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated Release')
      }

      return this.createInstance(model)
    }

    return undefined
  }

  async save(): Promise<ReleaseModel> {
    // If the model has an ID, update it; otherwise, create a new record
    if (this.id) {
      // Update existing record
      await DB.instance.updateTable('releases')
        .set(this.attributes as ReleaseUpdate)
        .where('id', '=', this.id)
        .executeTakeFirst()

      // Get the updated data
      const model = await DB.instance.selectFrom('releases')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated Release')
      }

      return this.createInstance(model)
    }
    else {
      // Create new record
      const result = await DB.instance.insertInto('releases')
        .values(this.attributes as NewRelease)
        .executeTakeFirst()

      // Get the created data
      const model = await DB.instance.selectFrom('releases')
        .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve created Release')
      }

      return this.createInstance(model)
    }
  }

  static async createMany(newRelease: NewRelease[]): Promise<void> {
    const instance = new ReleaseModel(undefined)

    const valuesFiltered = newRelease.map((newRelease: NewRelease) => {
      const filteredValues = Object.fromEntries(
        Object.entries(newRelease).filter(([key]) =>
          !instance.guarded.includes(key) && instance.fillable.includes(key),
        ),
      ) as NewRelease

      return filteredValues
    })

    await DB.instance.insertInto('releases')
      .values(valuesFiltered)
      .executeTakeFirst()
  }

  static async forceCreate(newRelease: NewRelease): Promise<ReleaseModel> {
    const result = await DB.instance.insertInto('releases')
      .values(newRelease)
      .executeTakeFirst()

    const instance = new ReleaseModel(undefined)
    const model = await DB.instance.selectFrom('releases')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created Release')
    }

    return instance.createInstance(model)
  }

  // Method to remove a Release
  async delete(): Promise<number> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()

    const deleted = await DB.instance.deleteFrom('releases')
      .where('id', '=', this.id)
      .execute()

    return deleted.numDeletedRows
  }

  static async remove(id: number): Promise<any> {
    return await DB.instance.deleteFrom('releases')
      .where('id', '=', id)
      .execute()
  }

  static whereName(value: string): ReleaseModel {
    const instance = new ReleaseModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('name', '=', value)

    return instance
  }

  static whereVersion(value: string): ReleaseModel {
    const instance = new ReleaseModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('version', '=', value)

    return instance
  }

  static whereIn<V = number>(column: keyof ReleasesTable, values: V[]): ReleaseModel {
    const instance = new ReleaseModel(undefined)

    return instance.applyWhereIn<V>(column, values)
  }

  static distinct(column: keyof ReleaseJsonResponse): ReleaseModel {
    const instance = new ReleaseModel(undefined)

    return instance.applyDistinct(column)
  }

  static join(table: string, firstCol: string, secondCol: string): ReleaseModel {
    const instance = new ReleaseModel(undefined)

    return instance.applyJoin(table, firstCol, secondCol)
  }

  toJSON(): ReleaseJsonResponse {
    const output = {

      id: this.id,
      name: this.name,
      version: this.version,

      created_at: this.created_at,

      updated_at: this.updated_at,

      ...this.customColumns,
    }

    return output
  }

  parseResult(model: ReleaseModel): ReleaseModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof ReleaseModel]
    }

    return model
  }

  // Add a protected applyFind implementation
  protected async applyFind(id: number): Promise<ReleaseModel | undefined> {
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

export async function find(id: number): Promise<ReleaseModel | undefined> {
  const query = DB.instance.selectFrom('releases').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  const instance = new ReleaseModel(undefined)
  return instance.createInstance(model)
}

export async function count(): Promise<number> {
  const results = await ReleaseModel.count()

  return results
}

export async function create(newRelease: NewRelease): Promise<ReleaseModel> {
  const instance = new ReleaseModel(undefined)
  return await instance.applyCreate(newRelease)
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(DB.instance)
}

export async function remove(id: number): Promise<void> {
  await DB.instance.deleteFrom('releases')
    .where('id', '=', id)
    .execute()
}

export async function whereName(value: string): Promise<ReleaseModel[]> {
  const query = DB.instance.selectFrom('releases').where('name', '=', value)
  const results: ReleaseJsonResponse = await query.execute()

  return results.map((modelItem: ReleaseJsonResponse) => new ReleaseModel(modelItem))
}

export async function whereVersion(value: string): Promise<ReleaseModel[]> {
  const query = DB.instance.selectFrom('releases').where('version', '=', value)
  const results: ReleaseJsonResponse = await query.execute()

  return results.map((modelItem: ReleaseJsonResponse) => new ReleaseModel(modelItem))
}

export const Release = ReleaseModel

export default Release
