import type { RawBuilder } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import type { NewOauthClient, OauthClientJsonResponse, OauthClientsTable, OauthClientUpdate } from '../types/OauthClientType'
import type { OauthAccessTokenModel } from './OauthAccessToken'
import type { UserModel } from './User'
import { sql } from '@stacksjs/database'
import { HttpError } from '@stacksjs/error-handling'
import { DB } from '@stacksjs/orm'

import { BaseOrm } from '../utils/base'

export class OauthClientModel extends BaseOrm<OauthClientModel, OauthClientsTable, OauthClientJsonResponse> {
  private readonly hidden: Array<keyof OauthClientJsonResponse> = []
  private readonly fillable: Array<keyof OauthClientJsonResponse> = ['name', 'secret', 'provider', 'redirect', 'personal_access_client', 'password_client', 'revoked']
  private readonly guarded: Array<keyof OauthClientJsonResponse> = []
  protected attributes = {} as OauthClientJsonResponse
  protected originalAttributes = {} as OauthClientJsonResponse

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

  constructor(oauthClient: OauthClientJsonResponse | undefined) {
    super('oauth_clients')
    if (oauthClient) {
      this.attributes = { ...oauthClient }
      this.originalAttributes = { ...oauthClient }

      Object.keys(oauthClient).forEach((key) => {
        if (!(key in this)) {
          this.customColumns[key] = (oauthClient as OauthClientJsonResponse)[key]
        }
      })
    }

    this.withRelations = []
    this.selectFromQuery = DB.instance.selectFrom('oauth_clients')
    this.updateFromQuery = DB.instance.updateTable('oauth_clients')
    this.deleteFromQuery = DB.instance.deleteFrom('oauth_clients')
    this.hasSelect = false
  }

  protected async loadRelations(models: OauthClientJsonResponse | OauthClientJsonResponse[]): Promise<void> {
    // Handle both single model and array of models
    const modelArray = Array.isArray(models) ? models : [models]
    if (!modelArray.length)
      return

    const modelIds = modelArray.map(model => model.id)

    for (const relation of this.withRelations) {
      const relatedRecords = await DB.instance
        .selectFrom(relation)
        .where('oauthClient_id', 'in', modelIds)
        .selectAll()
        .execute()

      if (Array.isArray(models)) {
        models.map((model: OauthClientJsonResponse) => {
          const records = relatedRecords.filter((record: { oauthClient_id: number }) => {
            return record.oauthClient_id === model.id
          })

          model[relation] = records.length === 1 ? records[0] : records
          return model
        })
      }
      else {
        const records = relatedRecords.filter((record: { oauthClient_id: number }) => {
          return record.oauthClient_id === models.id
        })

        models[relation] = records.length === 1 ? records[0] : records
      }
    }
  }

  static with(relations: string[]): OauthClientModel {
    const instance = new OauthClientModel(undefined)

    return instance.applyWith(relations)
  }

  protected mapCustomGetters(models: OauthClientJsonResponse | OauthClientJsonResponse[]): void {
    const data = models

    if (Array.isArray(data)) {
      data.map((model: OauthClientJsonResponse) => {
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

  async mapCustomSetters(model: NewOauthClient | OauthClientUpdate): Promise<void> {
    const customSetter = {
      default: () => {
      },

    }

    for (const [key, fn] of Object.entries(customSetter)) {
      (model as any)[key] = await fn()
    }
  }

  get oauth_access_tokens(): OauthAccessTokenModel[] | [] {
    return this.attributes.oauth_access_tokens
  }

  get user_id(): number {
    return this.attributes.user_id
  }

  get user(): UserModel | undefined {
    return this.attributes.user
  }

  get id(): number {
    return this.attributes.id
  }

  get name(): string {
    return this.attributes.name
  }

  get secret(): string {
    return this.attributes.secret
  }

  get provider(): string {
    return this.attributes.provider
  }

  get redirect(): string {
    return this.attributes.redirect
  }

  get personal_access_client(): boolean {
    return this.attributes.personal_access_client
  }

  get password_client(): boolean {
    return this.attributes.password_client
  }

  get revoked(): boolean {
    return this.attributes.revoked
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

  set secret(value: string) {
    this.attributes.secret = value
  }

  set provider(value: string) {
    this.attributes.provider = value
  }

  set redirect(value: string) {
    this.attributes.redirect = value
  }

  set personal_access_client(value: boolean) {
    this.attributes.personal_access_client = value
  }

  set password_client(value: boolean) {
    this.attributes.password_client = value
  }

  set revoked(value: boolean) {
    this.attributes.revoked = value
  }

  set updated_at(value: string) {
    this.attributes.updated_at = value
  }

  static select(params: (keyof OauthClientJsonResponse)[] | RawBuilder<string> | string): OauthClientModel {
    const instance = new OauthClientModel(undefined)

    return instance.applySelect(params)
  }

  // Method to find a OauthClient by ID
  static async find(id: number): Promise<OauthClientModel | undefined> {
    const query = DB.instance.selectFrom('oauth_clients').where('id', '=', id).selectAll()

    const model = await query.executeTakeFirst()

    if (!model)
      return undefined

    const instance = new OauthClientModel(undefined)
    return instance.createInstance(model)
  }

  static async first(): Promise<OauthClientModel | undefined> {
    const instance = new OauthClientModel(undefined)

    const model = await instance.applyFirst()

    const data = new OauthClientModel(model)

    return data
  }

  static async last(): Promise<OauthClientModel | undefined> {
    const instance = new OauthClientModel(undefined)

    const model = await instance.applyLast()

    if (!model)
      return undefined

    return new OauthClientModel(model)
  }

  static async firstOrFail(): Promise<OauthClientModel | undefined> {
    const instance = new OauthClientModel(undefined)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<OauthClientModel[]> {
    const instance = new OauthClientModel(undefined)

    const models = await DB.instance.selectFrom('oauth_clients').selectAll().execute()

    instance.mapCustomGetters(models)

    const data = await Promise.all(models.map(async (model: OauthClientJsonResponse) => {
      return new OauthClientModel(model)
    }))

    return data
  }

  static async findOrFail(id: number): Promise<OauthClientModel | undefined> {
    const instance = new OauthClientModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  static async findMany(ids: number[]): Promise<OauthClientModel[]> {
    const instance = new OauthClientModel(undefined)

    const models = await instance.applyFindMany(ids)

    return models.map((modelItem: OauthClientJsonResponse) => instance.parseResult(new OauthClientModel(modelItem)))
  }

  static async latest(column: keyof OauthClientsTable = 'created_at'): Promise<OauthClientModel | undefined> {
    const instance = new OauthClientModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'desc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new OauthClientModel(model)
  }

  static async oldest(column: keyof OauthClientsTable = 'created_at'): Promise<OauthClientModel | undefined> {
    const instance = new OauthClientModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'asc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new OauthClientModel(model)
  }

  static skip(count: number): OauthClientModel {
    const instance = new OauthClientModel(undefined)

    return instance.applySkip(count)
  }

  static take(count: number): OauthClientModel {
    const instance = new OauthClientModel(undefined)

    return instance.applyTake(count)
  }

  static where<V = string>(column: keyof OauthClientsTable, ...args: [V] | [Operator, V]): OauthClientModel {
    const instance = new OauthClientModel(undefined)

    return instance.applyWhere<V>(column, ...args)
  }

  static orWhere(...conditions: [string, any][]): OauthClientModel {
    const instance = new OauthClientModel(undefined)

    return instance.applyOrWhere(...conditions)
  }

  static whereNotIn<V = number>(column: keyof OauthClientsTable, values: V[]): OauthClientModel {
    const instance = new OauthClientModel(undefined)

    return instance.applyWhereNotIn<V>(column, values)
  }

  static whereBetween<V = number>(column: keyof OauthClientsTable, range: [V, V]): OauthClientModel {
    const instance = new OauthClientModel(undefined)

    return instance.applyWhereBetween<V>(column, range)
  }

  static whereRef(column: keyof OauthClientsTable, ...args: string[]): OauthClientModel {
    const instance = new OauthClientModel(undefined)

    return instance.applyWhereRef(column, ...args)
  }

  static when(condition: boolean, callback: (query: OauthClientModel) => OauthClientModel): OauthClientModel {
    const instance = new OauthClientModel(undefined)

    return instance.applyWhen(condition, callback as any)
  }

  static whereNull(column: keyof OauthClientsTable): OauthClientModel {
    const instance = new OauthClientModel(undefined)

    return instance.applyWhereNull(column)
  }

  static whereNotNull(column: keyof OauthClientsTable): OauthClientModel {
    const instance = new OauthClientModel(undefined)

    return instance.applyWhereNotNull(column)
  }

  static whereLike(column: keyof OauthClientsTable, value: string): OauthClientModel {
    const instance = new OauthClientModel(undefined)

    return instance.applyWhereLike(column, value)
  }

  static orderBy(column: keyof OauthClientsTable, order: 'asc' | 'desc'): OauthClientModel {
    const instance = new OauthClientModel(undefined)

    return instance.applyOrderBy(column, order)
  }

  static orderByAsc(column: keyof OauthClientsTable): OauthClientModel {
    const instance = new OauthClientModel(undefined)

    return instance.applyOrderByAsc(column)
  }

  static orderByDesc(column: keyof OauthClientsTable): OauthClientModel {
    const instance = new OauthClientModel(undefined)

    return instance.applyOrderByDesc(column)
  }

  static groupBy(column: keyof OauthClientsTable): OauthClientModel {
    const instance = new OauthClientModel(undefined)

    return instance.applyGroupBy(column)
  }

  static having<V = string>(column: keyof OauthClientsTable, operator: Operator, value: V): OauthClientModel {
    const instance = new OauthClientModel(undefined)

    return instance.applyHaving<V>(column, operator, value)
  }

  static inRandomOrder(): OauthClientModel {
    const instance = new OauthClientModel(undefined)

    return instance.applyInRandomOrder()
  }

  static whereColumn(first: keyof OauthClientsTable, operator: Operator, second: keyof OauthClientsTable): OauthClientModel {
    const instance = new OauthClientModel(undefined)

    return instance.applyWhereColumn(first, operator, second)
  }

  static async max(field: keyof OauthClientsTable): Promise<number> {
    const instance = new OauthClientModel(undefined)

    return await instance.applyMax(field)
  }

  static async min(field: keyof OauthClientsTable): Promise<number> {
    const instance = new OauthClientModel(undefined)

    return await instance.applyMin(field)
  }

  static async avg(field: keyof OauthClientsTable): Promise<number> {
    const instance = new OauthClientModel(undefined)

    return await instance.applyAvg(field)
  }

  static async sum(field: keyof OauthClientsTable): Promise<number> {
    const instance = new OauthClientModel(undefined)

    return await instance.applySum(field)
  }

  static async count(): Promise<number> {
    const instance = new OauthClientModel(undefined)

    return instance.applyCount()
  }

  static async get(): Promise<OauthClientModel[]> {
    const instance = new OauthClientModel(undefined)

    const results = await instance.applyGet()

    return results.map((item: OauthClientJsonResponse) => instance.createInstance(item))
  }

  static async pluck<K extends keyof OauthClientModel>(field: K): Promise<OauthClientModel[K][]> {
    const instance = new OauthClientModel(undefined)

    return await instance.applyPluck(field)
  }

  static async chunk(size: number, callback: (models: OauthClientModel[]) => Promise<void>): Promise<void> {
    const instance = new OauthClientModel(undefined)

    await instance.applyChunk(size, async (models) => {
      const modelInstances = models.map((item: OauthClientJsonResponse) => instance.createInstance(item))
      await callback(modelInstances)
    })
  }

  static async paginate(options: { limit?: number, offset?: number, page?: number } = { limit: 10, offset: 0, page: 1 }): Promise<{
    data: OauthClientModel[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }> {
    const instance = new OauthClientModel(undefined)

    const result = await instance.applyPaginate(options)

    return {
      data: result.data.map((item: OauthClientJsonResponse) => instance.createInstance(item)),
      paging: result.paging,
      next_cursor: result.next_cursor,
    }
  }

  // Instance method for creating model instances
  createInstance(data: OauthClientJsonResponse): OauthClientModel {
    return new OauthClientModel(data)
  }

  async applyCreate(newOauthClient: NewOauthClient): Promise<OauthClientModel> {
    const filteredValues = Object.fromEntries(
      Object.entries(newOauthClient).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewOauthClient

    await this.mapCustomSetters(filteredValues)

    const result = await DB.instance.insertInto('oauth_clients')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await DB.instance.selectFrom('oauth_clients')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created OauthClient')
    }

    return this.createInstance(model)
  }

  async create(newOauthClient: NewOauthClient): Promise<OauthClientModel> {
    return await this.applyCreate(newOauthClient)
  }

  static async create(newOauthClient: NewOauthClient): Promise<OauthClientModel> {
    const instance = new OauthClientModel(undefined)
    return await instance.applyCreate(newOauthClient)
  }

  static async firstOrCreate(search: Partial<OauthClientsTable>, values: NewOauthClient = {} as NewOauthClient): Promise<OauthClientModel> {
    // First try to find a record matching the search criteria
    const instance = new OauthClientModel(undefined)

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
    const createData = { ...search, ...values } as NewOauthClient
    return await OauthClientModel.create(createData)
  }

  static async updateOrCreate(search: Partial<OauthClientsTable>, values: NewOauthClient = {} as NewOauthClient): Promise<OauthClientModel> {
    // First try to find a record matching the search criteria
    const instance = new OauthClientModel(undefined)

    // Apply all search conditions
    for (const [key, value] of Object.entries(search)) {
      instance.selectFromQuery = instance.selectFromQuery.where(key, '=', value)
    }

    // Try to find the record
    const existingRecord = await instance.applyFirst()

    if (existingRecord) {
      // If record exists, update it with the new values
      const model = instance.createInstance(existingRecord)
      const updatedModel = await model.update(values as OauthClientUpdate)

      // Return the updated model instance
      if (updatedModel) {
        return updatedModel
      }

      // If update didn't return a model, fetch it again to ensure we have latest data
      const refreshedModel = await instance.applyFirst()
      return instance.createInstance(refreshedModel!)
    }

    // If no record exists, create a new one with combined search criteria and values
    const createData = { ...search, ...values } as NewOauthClient
    return await OauthClientModel.create(createData)
  }

  async update(newOauthClient: OauthClientUpdate): Promise<OauthClientModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newOauthClient).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as OauthClientUpdate

    await this.mapCustomSetters(filteredValues)

    filteredValues.updated_at = new Date().toISOString()

    await DB.instance.updateTable('oauth_clients')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('oauth_clients')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated OauthClient')
      }

      return this.createInstance(model)
    }

    return undefined
  }

  async forceUpdate(newOauthClient: OauthClientUpdate): Promise<OauthClientModel | undefined> {
    await DB.instance.updateTable('oauth_clients')
      .set(newOauthClient)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('oauth_clients')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated OauthClient')
      }

      return this.createInstance(model)
    }

    return undefined
  }

  async save(): Promise<OauthClientModel> {
    // If the model has an ID, update it; otherwise, create a new record
    if (this.id) {
      // Update existing record
      await DB.instance.updateTable('oauth_clients')
        .set(this.attributes as OauthClientUpdate)
        .where('id', '=', this.id)
        .executeTakeFirst()

      // Get the updated data
      const model = await DB.instance.selectFrom('oauth_clients')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated OauthClient')
      }

      return this.createInstance(model)
    }
    else {
      // Create new record
      const result = await DB.instance.insertInto('oauth_clients')
        .values(this.attributes as NewOauthClient)
        .executeTakeFirst()

      // Get the created data
      const model = await DB.instance.selectFrom('oauth_clients')
        .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve created OauthClient')
      }

      return this.createInstance(model)
    }
  }

  static async createMany(newOauthClient: NewOauthClient[]): Promise<void> {
    const instance = new OauthClientModel(undefined)

    const valuesFiltered = newOauthClient.map((newOauthClient: NewOauthClient) => {
      const filteredValues = Object.fromEntries(
        Object.entries(newOauthClient).filter(([key]) =>
          !instance.guarded.includes(key) && instance.fillable.includes(key),
        ),
      ) as NewOauthClient

      return filteredValues
    })

    await DB.instance.insertInto('oauth_clients')
      .values(valuesFiltered)
      .executeTakeFirst()
  }

  static async forceCreate(newOauthClient: NewOauthClient): Promise<OauthClientModel> {
    const result = await DB.instance.insertInto('oauth_clients')
      .values(newOauthClient)
      .executeTakeFirst()

    const instance = new OauthClientModel(undefined)
    const model = await DB.instance.selectFrom('oauth_clients')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created OauthClient')
    }

    return instance.createInstance(model)
  }

  // Method to remove a OauthClient
  async delete(): Promise<number> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()

    const deleted = await DB.instance.deleteFrom('oauth_clients')
      .where('id', '=', this.id)
      .execute()

    return deleted.numDeletedRows
  }

  static async remove(id: number): Promise<any> {
    return await DB.instance.deleteFrom('oauth_clients')
      .where('id', '=', id)
      .execute()
  }

  static whereName(value: string): OauthClientModel {
    const instance = new OauthClientModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('name', '=', value)

    return instance
  }

  static whereSecret(value: string): OauthClientModel {
    const instance = new OauthClientModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('secret', '=', value)

    return instance
  }

  static whereProvider(value: string): OauthClientModel {
    const instance = new OauthClientModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('provider', '=', value)

    return instance
  }

  static whereRedirect(value: string): OauthClientModel {
    const instance = new OauthClientModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('redirect', '=', value)

    return instance
  }

  static wherePersonalAccessClient(value: string): OauthClientModel {
    const instance = new OauthClientModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('personal_access_client', '=', value)

    return instance
  }

  static wherePasswordClient(value: string): OauthClientModel {
    const instance = new OauthClientModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('password_client', '=', value)

    return instance
  }

  static whereRevoked(value: string): OauthClientModel {
    const instance = new OauthClientModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('revoked', '=', value)

    return instance
  }

  static whereIn<V = number>(column: keyof OauthClientsTable, values: V[]): OauthClientModel {
    const instance = new OauthClientModel(undefined)

    return instance.applyWhereIn<V>(column, values)
  }

  async userBelong(): Promise<UserModel> {
    if (this.user_id === undefined)
      throw new HttpError(500, 'Relation Error!')

    const model = await User
      .where('id', '=', this.user_id)
      .first()

    if (!model)
      throw new HttpError(500, 'Model Relation Not Found!')

    return model
  }

  static distinct(column: keyof OauthClientJsonResponse): OauthClientModel {
    const instance = new OauthClientModel(undefined)

    return instance.applyDistinct(column)
  }

  static join(table: string, firstCol: string, secondCol: string): OauthClientModel {
    const instance = new OauthClientModel(undefined)

    return instance.applyJoin(table, firstCol, secondCol)
  }

  toJSON(): OauthClientJsonResponse {
    const output = {

      id: this.id,
      name: this.name,
      secret: this.secret,
      provider: this.provider,
      redirect: this.redirect,
      personal_access_client: this.personal_access_client,
      password_client: this.password_client,
      revoked: this.revoked,

      created_at: this.created_at,

      updated_at: this.updated_at,

      oauth_access_tokens: this.oauth_access_tokens,
      user_id: this.user_id,
      user: this.user,
      ...this.customColumns,
    }

    return output
  }

  parseResult(model: OauthClientModel): OauthClientModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof OauthClientModel]
    }

    return model
  }

  // Add a protected applyFind implementation
  protected async applyFind(id: number): Promise<OauthClientModel | undefined> {
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

export async function find(id: number): Promise<OauthClientModel | undefined> {
  const query = DB.instance.selectFrom('oauth_clients').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  const instance = new OauthClientModel(undefined)
  return instance.createInstance(model)
}

export async function count(): Promise<number> {
  const results = await OauthClientModel.count()

  return results
}

export async function create(newOauthClient: NewOauthClient): Promise<OauthClientModel> {
  const instance = new OauthClientModel(undefined)
  return await instance.applyCreate(newOauthClient)
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(DB.instance)
}

export async function remove(id: number): Promise<void> {
  await DB.instance.deleteFrom('oauth_clients')
    .where('id', '=', id)
    .execute()
}

export async function whereName(value: string): Promise<OauthClientModel[]> {
  const query = DB.instance.selectFrom('oauth_clients').where('name', '=', value)
  const results: OauthClientJsonResponse = await query.execute()

  return results.map((modelItem: OauthClientJsonResponse) => new OauthClientModel(modelItem))
}

export async function whereSecret(value: string): Promise<OauthClientModel[]> {
  const query = DB.instance.selectFrom('oauth_clients').where('secret', '=', value)
  const results: OauthClientJsonResponse = await query.execute()

  return results.map((modelItem: OauthClientJsonResponse) => new OauthClientModel(modelItem))
}

export async function whereProvider(value: string): Promise<OauthClientModel[]> {
  const query = DB.instance.selectFrom('oauth_clients').where('provider', '=', value)
  const results: OauthClientJsonResponse = await query.execute()

  return results.map((modelItem: OauthClientJsonResponse) => new OauthClientModel(modelItem))
}

export async function whereRedirect(value: string): Promise<OauthClientModel[]> {
  const query = DB.instance.selectFrom('oauth_clients').where('redirect', '=', value)
  const results: OauthClientJsonResponse = await query.execute()

  return results.map((modelItem: OauthClientJsonResponse) => new OauthClientModel(modelItem))
}

export async function wherePersonalAccessClient(value: boolean): Promise<OauthClientModel[]> {
  const query = DB.instance.selectFrom('oauth_clients').where('personal_access_client', '=', value)
  const results: OauthClientJsonResponse = await query.execute()

  return results.map((modelItem: OauthClientJsonResponse) => new OauthClientModel(modelItem))
}

export async function wherePasswordClient(value: boolean): Promise<OauthClientModel[]> {
  const query = DB.instance.selectFrom('oauth_clients').where('password_client', '=', value)
  const results: OauthClientJsonResponse = await query.execute()

  return results.map((modelItem: OauthClientJsonResponse) => new OauthClientModel(modelItem))
}

export async function whereRevoked(value: boolean): Promise<OauthClientModel[]> {
  const query = DB.instance.selectFrom('oauth_clients').where('revoked', '=', value)
  const results: OauthClientJsonResponse = await query.execute()

  return results.map((modelItem: OauthClientJsonResponse) => new OauthClientModel(modelItem))
}

export const OauthClient = OauthClientModel

export default OauthClient
