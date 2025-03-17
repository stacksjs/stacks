import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import { cache } from '@stacksjs/cache'
import { sql } from '@stacksjs/database'
import { ModelNotFoundException } from '@stacksjs/error-handling'
import { BaseOrm, DB } from '@stacksjs/orm'

export interface ErrorsTable {
  id: Generated<number>
  type: string
  message: string
  stack?: string
  status: number
  additional_info?: string

  created_at?: Date

  updated_at?: Date

}

export interface ErrorResponse {
  data: ErrorJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface ErrorJsonResponse extends Omit<Selectable<ErrorsTable>, 'password'> {
  [key: string]: any
}

export type NewError = Insertable<ErrorsTable>
export type ErrorUpdate = Updateable<ErrorsTable>

export class ErrorModel extends BaseOrm<ErrorModel, ErrorsTable, ErrorJsonResponse> {
  private readonly hidden: Array<keyof ErrorJsonResponse> = []
  private readonly fillable: Array<keyof ErrorJsonResponse> = ['type', 'message', 'stack', 'status', 'additional_info', 'uuid']
  private readonly guarded: Array<keyof ErrorJsonResponse> = []
  protected attributes = {} as ErrorJsonResponse
  protected originalAttributes = {} as ErrorJsonResponse

  protected selectFromQuery: any
  protected updateFromQuery: any
  protected deleteFromQuery: any
  protected hasSelect: boolean
  private hasSaved: boolean
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
    this.hasSaved = false
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

  get type(): string {
    return this.attributes.type
  }

  get message(): string {
    return this.attributes.message
  }

  get stack(): string | undefined {
    return this.attributes.stack
  }

  get status(): number {
    return this.attributes.status
  }

  get additional_info(): string | undefined {
    return this.attributes.additional_info
  }

  get created_at(): Date | undefined {
    return this.attributes.created_at
  }

  get updated_at(): Date | undefined {
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

  set updated_at(value: Date) {
    this.attributes.updated_at = value
  }

  static select(params: (keyof ErrorJsonResponse)[] | RawBuilder<string> | string): ErrorModel {
    const instance = new ErrorModel(undefined)

    return instance.applySelect(params)
  }

  // Method to find a Error by ID
  static async find(id: number): Promise<ErrorModel | undefined> {
    const instance = new ErrorModel(undefined)

    return await instance.applyFind(id)
  }

  async first(): Promise<ErrorModel | undefined> {
    const model = await this.applyFirst()

    const data = new ErrorModel(model)

    return data
  }

  static async first(): Promise<ErrorModel | undefined> {
    const instance = new ErrorModel(undefined)

    const model = await instance.applyFirst()

    const data = new ErrorModel(model)

    return data
  }

  async applyFirstOrFail(): Promise<ErrorModel | undefined> {
    const model = await this.selectFromQuery.executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, `No ErrorModel results found for query`)

    if (model) {
      this.mapCustomGetters(model)
      await this.loadRelations(model)
    }

    const data = new ErrorModel(model)

    return data
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

  async applyFindOrFail(id: number): Promise<ErrorModel> {
    const model = await DB.instance.selectFrom('errors').where('id', '=', id).selectAll().executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, `No ErrorModel results for ${id}`)

    cache.getOrSet(`error:${id}`, JSON.stringify(model))

    this.mapCustomGetters(model)
    await this.loadRelations(model)

    const data = new ErrorModel(model)

    return data
  }

  async findOrFail(id: number): Promise<ErrorModel> {
    return await this.applyFindOrFail(id)
  }

  static async findOrFail(id: number): Promise<ErrorModel> {
    const instance = new ErrorModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  static async findMany(ids: number[]): Promise<ErrorModel[]> {
    const instance = new ErrorModel(undefined)

    const models = await instance.applyFindMany(ids)

    return models.map((modelItem: UserJsonResponse) => instance.parseResult(new ErrorModel(modelItem)))
  }

  async findMany(ids: number[]): Promise<ErrorModel[]> {
    const models = await this.applyFindMany(ids)

    return models.map((modelItem: UserJsonResponse) => this.parseResult(new ErrorModel(modelItem)))
  }

  static skip(count: number): ErrorModel {
    const instance = new ErrorModel(undefined)

    return instance.applySkip(count)
  }

  static take(count: number): ErrorModel {
    const instance = new ErrorModel(undefined)

    return instance.applyTake(count)
  }

  static async count(): Promise<number> {
    const instance = new ErrorModel(undefined)

    return instance.applyCount()
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

    const model = await this.find(Number(result.numInsertedOrUpdatedRows)) as ErrorModel

    return model
  }

  async create(newError: NewError): Promise<ErrorModel> {
    return await this.applyCreate(newError)
  }

  static async create(newError: NewError): Promise<ErrorModel> {
    const instance = new ErrorModel(undefined)

    return await instance.applyCreate(newError)
  }

  async update(newError: ErrorUpdate): Promise<ErrorModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newError).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as ErrorUpdate

    await this.mapCustomSetters(filteredValues)

    await DB.instance.updateTable('errors')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      const model = await this.find(this.id)

      return model
    }

    this.hasSaved = true

    return undefined
  }

  async forceUpdate(newError: ErrorUpdate): Promise<ErrorModel | undefined> {
    await DB.instance.updateTable('errors')
      .set(newError)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      const model = await this.find(this.id)

      return model
    }

    return undefined
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

    const model = await find(Number(result.numInsertedOrUpdatedRows)) as ErrorModel

    return model
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
}

async function find(id: number): Promise<ErrorModel | undefined> {
  const query = DB.instance.selectFrom('errors').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  return new ErrorModel(model)
}

export async function count(): Promise<number> {
  const results = await ErrorModel.count()

  return results
}

export async function create(newError: NewError): Promise<ErrorModel> {
  const result = await DB.instance.insertInto('errors')
    .values(newError)
    .executeTakeFirstOrThrow()

  return await find(Number(result.numInsertedOrUpdatedRows)) as ErrorModel
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
