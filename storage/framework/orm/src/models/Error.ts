import type { RawBuilder } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import type { ErrorJsonResponse, ErrorsTable, ErrorUpdate, NewError } from '../types/ErrorType'
import { sql } from '@stacksjs/database'
import { HttpError } from '@stacksjs/error-handling'
import { DB } from '@stacksjs/orm'

import { BaseOrm } from '../utils/base'

export class ErrorModel extends BaseOrm<ErrorModel, ErrorsTable, ErrorJsonResponse> {
  private readonly hidden: Array<keyof ErrorJsonResponse> = []
  private readonly fillable: Array<keyof ErrorJsonResponse> = ['type', 'message', 'stack', 'status', 'additional_info']
  private readonly guarded: Array<keyof ErrorJsonResponse> = []
  protected attributes = {} as ErrorJsonResponse
  protected originalAttributes = {} as ErrorJsonResponse

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

  constructor(error: ErrorJsonResponse | undefined) {
    super('errors')
    if (error) {
      this.attributes = { ...error }
      this.originalAttributes = { ...error }

      Object.keys(error).forEach((key) => {
        if (!(key in this)) {
          this.customColumns[key] = (error as ErrorJsonResponse)[key]
        }
      })
    }

    this.withRelations = []
    this.selectFromQuery = DB.instance.selectFrom('errors')
    this.updateFromQuery = DB.instance.updateTable('errors')
    this.deleteFromQuery = DB.instance.deleteFrom('errors')
    this.hasSelect = false
  }

  protected async loadRelations(models: ErrorJsonResponse | ErrorJsonResponse[]): Promise<void> {
    // Handle both single model and array of models
    const modelArray = Array.isArray(models) ? models : [models]
    if (!modelArray.length)
      return

    const modelIds = modelArray.map(model => model.id)

    for (const relation of this.withRelations) {
      const relatedRecords = await DB.instance
        .selectFrom(relation)
        .where('error_id', 'in', modelIds)
        .selectAll()
        .execute()

      if (Array.isArray(models)) {
        models.map((model: ErrorJsonResponse) => {
          const records = relatedRecords.filter((record: { error_id: number }) => {
            return record.error_id === model.id
          })

          model[relation] = records.length === 1 ? records[0] : records
          return model
        })
      }
      else {
        const records = relatedRecords.filter((record: { error_id: number }) => {
          return record.error_id === models.id
        })

        models[relation] = records.length === 1 ? records[0] : records
      }
    }
  }

  static with(relations: string[]): ErrorModel {
    const instance = new ErrorModel(undefined)

    return instance.applyWith(relations)
  }

  protected mapCustomGetters(models: ErrorJsonResponse | ErrorJsonResponse[]): void {
    const data = models

    if (Array.isArray(data)) {
      data.map((model: ErrorJsonResponse) => {
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

  async mapCustomSetters(model: NewError | ErrorUpdate): Promise<void> {
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

  get type(): string | undefined {
    return this.attributes.type
  }

  get message(): string | undefined {
    return this.attributes.message
  }

  get stack(): string | undefined {
    return this.attributes.stack
  }

  get status(): number | undefined {
    return this.attributes.status
  }

  get additional_info(): string | undefined {
    return this.attributes.additional_info
  }

  get created_at(): string | undefined {
    return this.attributes.created_at
  }

  get updated_at(): string | undefined {
    return this.attributes.updated_at
  }

  set type(value: string) {
    this.attributes.type = value
  }

  set message(value: string) {
    this.attributes.message = value
  }

  set stack(value: string) {
    this.attributes.stack = value
  }

  set status(value: number) {
    this.attributes.status = value
  }

  set additional_info(value: string) {
    this.attributes.additional_info = value
  }

  set updated_at(value: string) {
    this.attributes.updated_at = value
  }

  static select(params: (keyof ErrorJsonResponse)[] | RawBuilder<string> | string): ErrorModel {
    const instance = new ErrorModel(undefined)

    return instance.applySelect(params)
  }

  // Method to find a Error by ID
  static async find(id: number): Promise<ErrorModel | undefined> {
    const query = DB.instance.selectFrom('errors').where('id', '=', id).selectAll()

    const model = await query.executeTakeFirst()

    if (!model)
      return undefined

    const instance = new ErrorModel(undefined)
    return instance.createInstance(model)
  }

  static async first(): Promise<ErrorModel | undefined> {
    const instance = new ErrorModel(undefined)

    const model = await instance.applyFirst()

    const data = new ErrorModel(model)

    return data
  }

  static async last(): Promise<ErrorModel | undefined> {
    const instance = new ErrorModel(undefined)

    const model = await instance.applyLast()

    if (!model)
      return undefined

    return new ErrorModel(model)
  }

  static async firstOrFail(): Promise<ErrorModel | undefined> {
    const instance = new ErrorModel(undefined)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<ErrorModel[]> {
    const instance = new ErrorModel(undefined)

    const models = await DB.instance.selectFrom('errors').selectAll().execute()

    instance.mapCustomGetters(models)

    const data = await Promise.all(models.map(async (model: ErrorJsonResponse) => {
      return new ErrorModel(model)
    }))

    return data
  }

  static async findOrFail(id: number): Promise<ErrorModel | undefined> {
    const instance = new ErrorModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  static async findMany(ids: number[]): Promise<ErrorModel[]> {
    const instance = new ErrorModel(undefined)

    const models = await instance.applyFindMany(ids)

    return models.map((modelItem: ErrorJsonResponse) => instance.parseResult(new ErrorModel(modelItem)))
  }

  static async latest(column: keyof ErrorsTable = 'created_at'): Promise<ErrorModel | undefined> {
    const instance = new ErrorModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'desc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new ErrorModel(model)
  }

  static async oldest(column: keyof ErrorsTable = 'created_at'): Promise<ErrorModel | undefined> {
    const instance = new ErrorModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'asc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new ErrorModel(model)
  }

  static skip(count: number): ErrorModel {
    const instance = new ErrorModel(undefined)

    return instance.applySkip(count)
  }

  static take(count: number): ErrorModel {
    const instance = new ErrorModel(undefined)

    return instance.applyTake(count)
  }

  static where<V = string>(column: keyof ErrorsTable, ...args: [V] | [Operator, V]): ErrorModel {
    const instance = new ErrorModel(undefined)

    return instance.applyWhere<V>(column, ...args)
  }

  static orWhere(...conditions: [string, any][]): ErrorModel {
    const instance = new ErrorModel(undefined)

    return instance.applyOrWhere(...conditions)
  }

  static whereNotIn<V = number>(column: keyof ErrorsTable, values: V[]): ErrorModel {
    const instance = new ErrorModel(undefined)

    return instance.applyWhereNotIn<V>(column, values)
  }

  static whereBetween<V = number>(column: keyof ErrorsTable, range: [V, V]): ErrorModel {
    const instance = new ErrorModel(undefined)

    return instance.applyWhereBetween<V>(column, range)
  }

  static whereRef(column: keyof ErrorsTable, ...args: string[]): ErrorModel {
    const instance = new ErrorModel(undefined)

    return instance.applyWhereRef(column, ...args)
  }

  static when(condition: boolean, callback: (query: ErrorModel) => ErrorModel): ErrorModel {
    const instance = new ErrorModel(undefined)

    return instance.applyWhen(condition, callback as any)
  }

  static whereNull(column: keyof ErrorsTable): ErrorModel {
    const instance = new ErrorModel(undefined)

    return instance.applyWhereNull(column)
  }

  static whereNotNull(column: keyof ErrorsTable): ErrorModel {
    const instance = new ErrorModel(undefined)

    return instance.applyWhereNotNull(column)
  }

  static whereLike(column: keyof ErrorsTable, value: string): ErrorModel {
    const instance = new ErrorModel(undefined)

    return instance.applyWhereLike(column, value)
  }

  static orderBy(column: keyof ErrorsTable, order: 'asc' | 'desc'): ErrorModel {
    const instance = new ErrorModel(undefined)

    return instance.applyOrderBy(column, order)
  }

  static orderByAsc(column: keyof ErrorsTable): ErrorModel {
    const instance = new ErrorModel(undefined)

    return instance.applyOrderByAsc(column)
  }

  static orderByDesc(column: keyof ErrorsTable): ErrorModel {
    const instance = new ErrorModel(undefined)

    return instance.applyOrderByDesc(column)
  }

  static groupBy(column: keyof ErrorsTable): ErrorModel {
    const instance = new ErrorModel(undefined)

    return instance.applyGroupBy(column)
  }

  static having<V = string>(column: keyof ErrorsTable, operator: Operator, value: V): ErrorModel {
    const instance = new ErrorModel(undefined)

    return instance.applyHaving<V>(column, operator, value)
  }

  static inRandomOrder(): ErrorModel {
    const instance = new ErrorModel(undefined)

    return instance.applyInRandomOrder()
  }

  static whereColumn(first: keyof ErrorsTable, operator: Operator, second: keyof ErrorsTable): ErrorModel {
    const instance = new ErrorModel(undefined)

    return instance.applyWhereColumn(first, operator, second)
  }

  static async max(field: keyof ErrorsTable): Promise<number> {
    const instance = new ErrorModel(undefined)

    return await instance.applyMax(field)
  }

  static async min(field: keyof ErrorsTable): Promise<number> {
    const instance = new ErrorModel(undefined)

    return await instance.applyMin(field)
  }

  static async avg(field: keyof ErrorsTable): Promise<number> {
    const instance = new ErrorModel(undefined)

    return await instance.applyAvg(field)
  }

  static async sum(field: keyof ErrorsTable): Promise<number> {
    const instance = new ErrorModel(undefined)

    return await instance.applySum(field)
  }

  static async count(): Promise<number> {
    const instance = new ErrorModel(undefined)

    return instance.applyCount()
  }

  static async get(): Promise<ErrorModel[]> {
    const instance = new ErrorModel(undefined)

    const results = await instance.applyGet()

    return results.map((item: ErrorJsonResponse) => instance.createInstance(item))
  }

  static async pluck<K extends keyof ErrorModel>(field: K): Promise<ErrorModel[K][]> {
    const instance = new ErrorModel(undefined)

    return await instance.applyPluck(field)
  }

  static async chunk(size: number, callback: (models: ErrorModel[]) => Promise<void>): Promise<void> {
    const instance = new ErrorModel(undefined)

    await instance.applyChunk(size, async (models) => {
      const modelInstances = models.map((item: ErrorJsonResponse) => instance.createInstance(item))
      await callback(modelInstances)
    })
  }

  static async paginate(options: { limit?: number, offset?: number, page?: number } = { limit: 10, offset: 0, page: 1 }): Promise<{
    data: ErrorModel[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }> {
    const instance = new ErrorModel(undefined)

    const result = await instance.applyPaginate(options)

    return {
      data: result.data.map((item: ErrorJsonResponse) => instance.createInstance(item)),
      paging: result.paging,
      next_cursor: result.next_cursor,
    }
  }

  // Instance method for creating model instances
  createInstance(data: ErrorJsonResponse): ErrorModel {
    return new ErrorModel(data)
  }

  async applyCreate(newError: NewError): Promise<ErrorModel> {
    const filteredValues = Object.fromEntries(
      Object.entries(newError).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewError

    await this.mapCustomSetters(filteredValues)

    const result = await DB.instance.insertInto('errors')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await DB.instance.selectFrom('errors')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created Error')
    }

    return this.createInstance(model)
  }

  async create(newError: NewError): Promise<ErrorModel> {
    return await this.applyCreate(newError)
  }

  static async create(newError: NewError): Promise<ErrorModel> {
    const instance = new ErrorModel(undefined)
    return await instance.applyCreate(newError)
  }

  static async firstOrCreate(search: Partial<ErrorsTable>, values: NewError = {} as NewError): Promise<ErrorModel> {
    // First try to find a record matching the search criteria
    const instance = new ErrorModel(undefined)

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
    const createData = { ...search, ...values } as NewError
    return await ErrorModel.create(createData)
  }

  static async updateOrCreate(search: Partial<ErrorsTable>, values: NewError = {} as NewError): Promise<ErrorModel> {
    // First try to find a record matching the search criteria
    const instance = new ErrorModel(undefined)

    // Apply all search conditions
    for (const [key, value] of Object.entries(search)) {
      instance.selectFromQuery = instance.selectFromQuery.where(key, '=', value)
    }

    // Try to find the record
    const existingRecord = await instance.applyFirst()

    if (existingRecord) {
      // If record exists, update it with the new values
      const model = instance.createInstance(existingRecord)
      const updatedModel = await model.update(values as ErrorUpdate)

      // Return the updated model instance
      if (updatedModel) {
        return updatedModel
      }

      // If update didn't return a model, fetch it again to ensure we have latest data
      const refreshedModel = await instance.applyFirst()
      return instance.createInstance(refreshedModel!)
    }

    // If no record exists, create a new one with combined search criteria and values
    const createData = { ...search, ...values } as NewError
    return await ErrorModel.create(createData)
  }

  async update(newError: ErrorUpdate): Promise<ErrorModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newError).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as ErrorUpdate

    await this.mapCustomSetters(filteredValues)

    filteredValues.updated_at = new Date().toISOString()

    await DB.instance.updateTable('errors')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('errors')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated Error')
      }

      return this.createInstance(model)
    }

    return undefined
  }

  async forceUpdate(newError: ErrorUpdate): Promise<ErrorModel | undefined> {
    await DB.instance.updateTable('errors')
      .set(newError)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('errors')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated Error')
      }

      return this.createInstance(model)
    }

    return undefined
  }

  async save(): Promise<ErrorModel> {
    // If the model has an ID, update it; otherwise, create a new record
    if (this.id) {
      // Update existing record
      await DB.instance.updateTable('errors')
        .set(this.attributes as ErrorUpdate)
        .where('id', '=', this.id)
        .executeTakeFirst()

      // Get the updated data
      const model = await DB.instance.selectFrom('errors')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated Error')
      }

      return this.createInstance(model)
    }
    else {
      // Create new record
      const result = await DB.instance.insertInto('errors')
        .values(this.attributes as NewError)
        .executeTakeFirst()

      // Get the created data
      const model = await DB.instance.selectFrom('errors')
        .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve created Error')
      }

      return this.createInstance(model)
    }
  }

  static async createMany(newError: NewError[]): Promise<void> {
    const instance = new ErrorModel(undefined)

    const valuesFiltered = newError.map((newError: NewError) => {
      const filteredValues = Object.fromEntries(
        Object.entries(newError).filter(([key]) =>
          !instance.guarded.includes(key) && instance.fillable.includes(key),
        ),
      ) as NewError

      return filteredValues
    })

    await DB.instance.insertInto('errors')
      .values(valuesFiltered)
      .executeTakeFirst()
  }

  static async forceCreate(newError: NewError): Promise<ErrorModel> {
    const result = await DB.instance.insertInto('errors')
      .values(newError)
      .executeTakeFirst()

    const instance = new ErrorModel(undefined)
    const model = await DB.instance.selectFrom('errors')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created Error')
    }

    return instance.createInstance(model)
  }

  // Method to remove a Error
  async delete(): Promise<number> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()

    const deleted = await DB.instance.deleteFrom('errors')
      .where('id', '=', this.id)
      .execute()

    return deleted.numDeletedRows
  }

  static async remove(id: number): Promise<any> {
    return await DB.instance.deleteFrom('errors')
      .where('id', '=', id)
      .execute()
  }

  static whereType(value: string): ErrorModel {
    const instance = new ErrorModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('type', '=', value)

    return instance
  }

  static whereMessage(value: string): ErrorModel {
    const instance = new ErrorModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('message', '=', value)

    return instance
  }

  static whereStack(value: string): ErrorModel {
    const instance = new ErrorModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('stack', '=', value)

    return instance
  }

  static whereStatus(value: string): ErrorModel {
    const instance = new ErrorModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('status', '=', value)

    return instance
  }

  static whereAdditionalInfo(value: string): ErrorModel {
    const instance = new ErrorModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('additional_info', '=', value)

    return instance
  }

  static whereIn<V = number>(column: keyof ErrorsTable, values: V[]): ErrorModel {
    const instance = new ErrorModel(undefined)

    return instance.applyWhereIn<V>(column, values)
  }

  static distinct(column: keyof ErrorJsonResponse): ErrorModel {
    const instance = new ErrorModel(undefined)

    return instance.applyDistinct(column)
  }

  static join(table: string, firstCol: string, secondCol: string): ErrorModel {
    const instance = new ErrorModel(undefined)

    return instance.applyJoin(table, firstCol, secondCol)
  }

  toJSON(): ErrorJsonResponse {
    const output = {

      id: this.id,
      type: this.type,
      message: this.message,
      stack: this.stack,
      status: this.status,
      additional_info: this.additional_info,

      created_at: this.created_at,

      updated_at: this.updated_at,

      ...this.customColumns,
    }

    return output
  }

  parseResult(model: ErrorModel): ErrorModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof ErrorModel]
    }

    return model
  }

  // Add a protected applyFind implementation
  protected async applyFind(id: number): Promise<ErrorModel | undefined> {
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

export async function find(id: number): Promise<ErrorModel | undefined> {
  const query = DB.instance.selectFrom('errors').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  const instance = new ErrorModel(undefined)
  return instance.createInstance(model)
}

export async function count(): Promise<number> {
  const results = await ErrorModel.count()

  return results
}

export async function create(newError: NewError): Promise<ErrorModel> {
  const instance = new ErrorModel(undefined)
  return await instance.applyCreate(newError)
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(DB.instance)
}

export async function remove(id: number): Promise<void> {
  await DB.instance.deleteFrom('errors')
    .where('id', '=', id)
    .execute()
}

export async function whereType(value: string): Promise<ErrorModel[]> {
  const query = DB.instance.selectFrom('errors').where('type', '=', value)
  const results: ErrorJsonResponse = await query.execute()

  return results.map((modelItem: ErrorJsonResponse) => new ErrorModel(modelItem))
}

export async function whereMessage(value: string): Promise<ErrorModel[]> {
  const query = DB.instance.selectFrom('errors').where('message', '=', value)
  const results: ErrorJsonResponse = await query.execute()

  return results.map((modelItem: ErrorJsonResponse) => new ErrorModel(modelItem))
}

export async function whereStack(value: string): Promise<ErrorModel[]> {
  const query = DB.instance.selectFrom('errors').where('stack', '=', value)
  const results: ErrorJsonResponse = await query.execute()

  return results.map((modelItem: ErrorJsonResponse) => new ErrorModel(modelItem))
}

export async function whereStatus(value: number): Promise<ErrorModel[]> {
  const query = DB.instance.selectFrom('errors').where('status', '=', value)
  const results: ErrorJsonResponse = await query.execute()

  return results.map((modelItem: ErrorJsonResponse) => new ErrorModel(modelItem))
}

export async function whereAdditionalInfo(value: string): Promise<ErrorModel[]> {
  const query = DB.instance.selectFrom('errors').where('additional_info', '=', value)
  const results: ErrorJsonResponse = await query.execute()

  return results.map((modelItem: ErrorJsonResponse) => new ErrorModel(modelItem))
}

export const Error = ErrorModel

export default Error
