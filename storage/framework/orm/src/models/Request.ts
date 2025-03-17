import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import { cache } from '@stacksjs/cache'
import { sql } from '@stacksjs/database'
import { ModelNotFoundException } from '@stacksjs/error-handling'
import { BaseOrm, DB } from '@stacksjs/orm'

export interface RequestsTable {
  id: Generated<number>
  method?: string | string[]
  path?: string
  status_code?: number
  duration_ms?: number
  ip_address?: string
  memory_usage?: number
  user_agent?: string
  error_message?: string

  created_at?: Date

  updated_at?: Date

  deleted_at?: Date

}

export interface RequestResponse {
  data: RequestJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface RequestJsonResponse extends Omit<Selectable<RequestsTable>, 'password'> {
  [key: string]: any
}

export type NewRequest = Insertable<RequestsTable>
export type RequestUpdate = Updateable<RequestsTable>

export class RequestModel extends BaseOrm<RequestModel, RequestsTable, RequestJsonResponse> {
  private readonly hidden: Array<keyof RequestJsonResponse> = []
  private readonly fillable: Array<keyof RequestJsonResponse> = ['method', 'path', 'status_code', 'duration_ms', 'ip_address', 'memory_usage', 'user_agent', 'error_message', 'uuid']
  private readonly guarded: Array<keyof RequestJsonResponse> = []
  protected attributes = {} as RequestJsonResponse
  protected originalAttributes = {} as RequestJsonResponse
  private softDeletes = false
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

  constructor(request: RequestJsonResponse | undefined) {
    super('requests')
    if (request) {
      this.attributes = { ...request }
      this.originalAttributes = { ...request }

      Object.keys(request).forEach((key) => {
        if (!(key in this)) {
          this.customColumns[key] = (request as RequestJsonResponse)[key]
        }
      })
    }

    this.withRelations = []
    this.selectFromQuery = DB.instance.selectFrom('requests')
    this.updateFromQuery = DB.instance.updateTable('requests')
    this.deleteFromQuery = DB.instance.deleteFrom('requests')
    this.hasSelect = false
    this.hasSaved = false
  }

  protected async loadRelations(models: RequestJsonResponse | RequestJsonResponse[]): Promise<void> {
    // Handle both single model and array of models
    const modelArray = Array.isArray(models) ? models : [models]
    if (!modelArray.length)
      return

    const modelIds = modelArray.map(model => model.id)

    for (const relation of this.withRelations) {
      const relatedRecords = await DB.instance
        .selectFrom(relation)
        .where('request_id', 'in', modelIds)
        .selectAll()
        .execute()

      if (Array.isArray(models)) {
        models.map((model: RequestJsonResponse) => {
          const records = relatedRecords.filter((record: { request_id: number }) => {
            return record.request_id === model.id
          })

          model[relation] = records.length === 1 ? records[0] : records
          return model
        })
      }
      else {
        const records = relatedRecords.filter((record: { request_id: number }) => {
          return record.request_id === models.id
        })

        models[relation] = records.length === 1 ? records[0] : records
      }
    }
  }

  static with(relations: string[]): RequestModel {
    const instance = new RequestModel(undefined)

    return instance.applyWith(relations)
  }

  protected mapCustomGetters(models: RequestJsonResponse | RequestJsonResponse[]): void {
    const data = models

    if (Array.isArray(data)) {
      data.map((model: RequestJsonResponse) => {
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

  async mapCustomSetters(model: NewRequest | RequestUpdate): Promise<void> {
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

  get method(): string | string[] | undefined {
    return this.attributes.method
  }

  get path(): string | undefined {
    return this.attributes.path
  }

  get status_code(): number | undefined {
    return this.attributes.status_code
  }

  get duration_ms(): number | undefined {
    return this.attributes.duration_ms
  }

  get ip_address(): string | undefined {
    return this.attributes.ip_address
  }

  get memory_usage(): number | undefined {
    return this.attributes.memory_usage
  }

  get user_agent(): string | undefined {
    return this.attributes.user_agent
  }

  get error_message(): string | undefined {
    return this.attributes.error_message
  }

  get created_at(): Date | undefined {
    return this.attributes.created_at
  }

  get updated_at(): Date | undefined {
    return this.attributes.updated_at
  }

  get deleted_at(): Date | undefined {
    return this.attributes.deleted_at
  }

  set method(value: string | string[]) {
    this.attributes.method = value
  }

  set path(value: string) {
    this.attributes.path = value
  }

  set status_code(value: number) {
    this.attributes.status_code = value
  }

  set duration_ms(value: number) {
    this.attributes.duration_ms = value
  }

  set ip_address(value: string) {
    this.attributes.ip_address = value
  }

  set memory_usage(value: number) {
    this.attributes.memory_usage = value
  }

  set user_agent(value: string) {
    this.attributes.user_agent = value
  }

  set error_message(value: string) {
    this.attributes.error_message = value
  }

  set updated_at(value: Date) {
    this.attributes.updated_at = value
  }

  set deleted_at(value: Date) {
    this.attributes.deleted_at = value
  }

  getOriginal(column?: keyof RequestJsonResponse): Partial<RequestJsonResponse> {
    if (column) {
      return this.originalAttributes[column]
    }

    return this.originalAttributes
  }

  getChanges(): Partial<RequestJsonResponse> {
    return this.fillable.reduce<Partial<RequestJsonResponse>>((changes, key) => {
      const currentValue = this.attributes[key as keyof RequestsTable]
      const originalValue = this.originalAttributes[key as keyof RequestsTable]

      if (currentValue !== originalValue) {
        changes[key] = currentValue
      }

      return changes
    }, {})
  }

  static select(params: (keyof RequestJsonResponse)[] | RawBuilder<string> | string): RequestModel {
    const instance = new RequestModel(undefined)

    return instance.applySelect(params)
  }

  // Method to find a Request by ID
  static async find(id: number): Promise<RequestModel | undefined> {
    const instance = new RequestModel(undefined)

    return await instance.applyFind(id)
  }

  async first(): Promise<RequestModel | undefined> {
    const model = await this.applyFirst()

    const data = new RequestModel(model)

    return data
  }

  static async first(): Promise<RequestModel | undefined> {
    const instance = new RequestModel(undefined)

    const model = await instance.applyFirst()

    const data = new RequestModel(model)

    return data
  }

  async applyFirstOrFail(): Promise<RequestModel | undefined> {
    const model = await this.selectFromQuery.executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, `No RequestModel results found for query`)

    if (model) {
      this.mapCustomGetters(model)
      await this.loadRelations(model)
    }

    const data = new RequestModel(model)

    return data
  }

  static async firstOrFail(): Promise<RequestModel | undefined> {
    const instance = new RequestModel(undefined)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<RequestModel[]> {
    const instance = new RequestModel(undefined)

    const models = await DB.instance.selectFrom('requests').selectAll().execute()

    instance.mapCustomGetters(models)

    const data = await Promise.all(models.map(async (model: RequestJsonResponse) => {
      return new RequestModel(model)
    }))

    return data
  }

  async applyFindOrFail(id: number): Promise<RequestModel> {
    const model = await DB.instance.selectFrom('requests').where('id', '=', id).selectAll().executeTakeFirst()

    if (instance.softDeletes) {
      instance.selectFromQuery = instance.selectFromQuery.where('deleted_at', 'is', null)
    }

    if (model === undefined)
      throw new ModelNotFoundException(404, `No RequestModel results for ${id}`)

    cache.getOrSet(`request:${id}`, JSON.stringify(model))

    this.mapCustomGetters(model)
    await this.loadRelations(model)

    const data = new RequestModel(model)

    return data
  }

  async findOrFail(id: number): Promise<RequestModel> {
    return await this.applyFindOrFail(id)
  }

  static async findOrFail(id: number): Promise<RequestModel> {
    const instance = new RequestModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  static async findMany(ids: number[]): Promise<RequestModel[]> {
    const instance = new RequestModel(undefined)
    if (instance.softDeletes) {
      query = query.where('deleted_at', 'is', null)
    }
    const models = await instance.applyFindMany(ids)

    return models.map((modelItem: UserJsonResponse) => instance.parseResult(new RequestModel(modelItem)))
  }

  async findMany(ids: number[]): Promise<RequestModel[]> {
    const models = await this.applyFindMany(ids)

    return models.map((modelItem: UserJsonResponse) => this.parseResult(new RequestModel(modelItem)))
  }

  static skip(count: number): RequestModel {
    const instance = new RequestModel(undefined)

    return instance.applySkip(count)
  }

  static take(count: number): RequestModel {
    const instance = new RequestModel(undefined)

    return instance.applyTake(count)
  }

  static async count(): Promise<number> {
    const instance = new RequestModel(undefined)

    return instance.applyCount()
  }

  async applyCreate(newRequest: NewRequest): Promise<RequestModel> {
    const filteredValues = Object.fromEntries(
      Object.entries(newRequest).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewRequest

    await this.mapCustomSetters(filteredValues)

    const result = await DB.instance.insertInto('requests')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await this.find(Number(result.numInsertedOrUpdatedRows)) as RequestModel

    return model
  }

  async create(newRequest: NewRequest): Promise<RequestModel> {
    return await this.applyCreate(newRequest)
  }

  static async create(newRequest: NewRequest): Promise<RequestModel> {
    const instance = new RequestModel(undefined)

    return await instance.applyCreate(newRequest)
  }

  async update(newRequest: RequestUpdate): Promise<RequestModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newRequest).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as RequestUpdate

    await this.mapCustomSetters(filteredValues)

    await DB.instance.updateTable('requests')
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

  async forceUpdate(newRequest: RequestUpdate): Promise<RequestModel | undefined> {
    await DB.instance.updateTable('requests')
      .set(newRequest)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      const model = await this.find(this.id)

      return model
    }

    return undefined
  }

  static async createMany(newRequest: NewRequest[]): Promise<void> {
    const instance = new RequestModel(undefined)

    const valuesFiltered = newRequest.map((newRequest: NewRequest) => {
      const filteredValues = Object.fromEntries(
        Object.entries(newRequest).filter(([key]) =>
          !instance.guarded.includes(key) && instance.fillable.includes(key),
        ),
      ) as NewRequest

      return filteredValues
    })

    await DB.instance.insertInto('requests')
      .values(valuesFiltered)
      .executeTakeFirst()
  }

  static async forceCreate(newRequest: NewRequest): Promise<RequestModel> {
    const result = await DB.instance.insertInto('requests')
      .values(newRequest)
      .executeTakeFirst()

    const model = await find(Number(result.numInsertedOrUpdatedRows)) as RequestModel

    return model
  }

  // Method to remove a Request
  async delete(): Promise<number> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()

    if (instance.softDeletes) {
      query = query.where('deleted_at', 'is', null)
    }

    const deleted = await DB.instance.deleteFrom('requests')
      .where('id', '=', this.id)
      .execute()

    return deleted.numDeletedRows
  }

  static async remove(id: number): Promise<any> {
    const instance = new RequestModel(undefined)

    if (instance.softDeletes) {
      return await DB.instance.updateTable('requests')
        .set({
          deleted_at: sql.raw('CURRENT_TIMESTAMP'),
        })
        .where('id', '=', id)
        .execute()
    }

    return await DB.instance.deleteFrom('requests')
      .where('id', '=', id)
      .execute()
  }

  static whereMethod(value: string): RequestModel {
    const instance = new RequestModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('method', '=', value)

    return instance
  }

  static wherePath(value: string): RequestModel {
    const instance = new RequestModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('path', '=', value)

    return instance
  }

  static whereStatusCode(value: string): RequestModel {
    const instance = new RequestModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('status_code', '=', value)

    return instance
  }

  static whereDurationMs(value: string): RequestModel {
    const instance = new RequestModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('duration_ms', '=', value)

    return instance
  }

  static whereIpAddress(value: string): RequestModel {
    const instance = new RequestModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('ip_address', '=', value)

    return instance
  }

  static whereMemoryUsage(value: string): RequestModel {
    const instance = new RequestModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('memory_usage', '=', value)

    return instance
  }

  static whereUserAgent(value: string): RequestModel {
    const instance = new RequestModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('user_agent', '=', value)

    return instance
  }

  static whereErrorMessage(value: string): RequestModel {
    const instance = new RequestModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('error_message', '=', value)

    return instance
  }

  static whereIn<V = number>(column: keyof RequestsTable, values: V[]): RequestModel {
    const instance = new RequestModel(undefined)

    return instance.applyWhereIn<V>(column, values)
  }

  static distinct(column: keyof RequestJsonResponse): RequestModel {
    const instance = new RequestModel(undefined)

    return instance.applyDistinct(column)
  }

  static join(table: string, firstCol: string, secondCol: string): RequestModel {
    const instance = new RequestModel(undefined)

    return instance.applyJoin(table, firstCol, secondCol)
  }

  toJSON(): RequestJsonResponse {
    const output = {

      id: this.id,
      method: this.method,
      path: this.path,
      status_code: this.status_code,
      duration_ms: this.duration_ms,
      ip_address: this.ip_address,
      memory_usage: this.memory_usage,
      user_agent: this.user_agent,
      error_message: this.error_message,

      created_at: this.created_at,

      updated_at: this.updated_at,

      deleted_at: this.deleted_at,

      ...this.customColumns,
    }

    return output
  }

  parseResult(model: RequestModel): RequestModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof RequestModel]
    }

    return model
  }
}

async function find(id: number): Promise<RequestModel | undefined> {
  const query = DB.instance.selectFrom('requests').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  return new RequestModel(model)
}

export async function count(): Promise<number> {
  const results = await RequestModel.count()

  return results
}

export async function create(newRequest: NewRequest): Promise<RequestModel> {
  const result = await DB.instance.insertInto('requests')
    .values(newRequest)
    .executeTakeFirstOrThrow()

  return await find(Number(result.numInsertedOrUpdatedRows)) as RequestModel
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(DB.instance)
}

export async function remove(id: number): Promise<void> {
  await DB.instance.deleteFrom('requests')
    .where('id', '=', id)
    .execute()
}

export async function whereMethod(value: string | string[]): Promise<RequestModel[]> {
  const query = DB.instance.selectFrom('requests').where('method', '=', value)
  const results: RequestJsonResponse = await query.execute()

  return results.map((modelItem: RequestJsonResponse) => new RequestModel(modelItem))
}

export async function wherePath(value: string): Promise<RequestModel[]> {
  const query = DB.instance.selectFrom('requests').where('path', '=', value)
  const results: RequestJsonResponse = await query.execute()

  return results.map((modelItem: RequestJsonResponse) => new RequestModel(modelItem))
}

export async function whereStatusCode(value: number): Promise<RequestModel[]> {
  const query = DB.instance.selectFrom('requests').where('status_code', '=', value)
  const results: RequestJsonResponse = await query.execute()

  return results.map((modelItem: RequestJsonResponse) => new RequestModel(modelItem))
}

export async function whereDurationMs(value: number): Promise<RequestModel[]> {
  const query = DB.instance.selectFrom('requests').where('duration_ms', '=', value)
  const results: RequestJsonResponse = await query.execute()

  return results.map((modelItem: RequestJsonResponse) => new RequestModel(modelItem))
}

export async function whereIpAddress(value: string): Promise<RequestModel[]> {
  const query = DB.instance.selectFrom('requests').where('ip_address', '=', value)
  const results: RequestJsonResponse = await query.execute()

  return results.map((modelItem: RequestJsonResponse) => new RequestModel(modelItem))
}

export async function whereMemoryUsage(value: number): Promise<RequestModel[]> {
  const query = DB.instance.selectFrom('requests').where('memory_usage', '=', value)
  const results: RequestJsonResponse = await query.execute()

  return results.map((modelItem: RequestJsonResponse) => new RequestModel(modelItem))
}

export async function whereUserAgent(value: string): Promise<RequestModel[]> {
  const query = DB.instance.selectFrom('requests').where('user_agent', '=', value)
  const results: RequestJsonResponse = await query.execute()

  return results.map((modelItem: RequestJsonResponse) => new RequestModel(modelItem))
}

export async function whereErrorMessage(value: string): Promise<RequestModel[]> {
  const query = DB.instance.selectFrom('requests').where('error_message', '=', value)
  const results: RequestJsonResponse = await query.execute()

  return results.map((modelItem: RequestJsonResponse) => new RequestModel(modelItem))
}

export const Request = RequestModel

export default Request
