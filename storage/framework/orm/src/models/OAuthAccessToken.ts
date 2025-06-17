import type { RawBuilder } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import type { NewOauthAccessToken, OauthAccessTokenJsonResponse, OauthAccessTokensTable, OauthAccessTokenUpdate } from '../types/OauthAccessTokenType'
import type { OauthClientModel } from './OauthClient'
import type { UserModel } from './User'
import { sql } from '@stacksjs/database'
import { HttpError } from '@stacksjs/error-handling'
import { DB } from '@stacksjs/orm'

import { BaseOrm } from '../utils/base'

export class OauthAccessTokenModel extends BaseOrm<OauthAccessTokenModel, OauthAccessTokensTable, OauthAccessTokenJsonResponse> {
  private readonly hidden: Array<keyof OauthAccessTokenJsonResponse> = []
  private readonly fillable: Array<keyof OauthAccessTokenJsonResponse> = ['token', 'name', 'scopes', 'revoked', 'expires_at', 'oauth_client_id', 'user_id']
  private readonly guarded: Array<keyof OauthAccessTokenJsonResponse> = []
  protected attributes = {} as OauthAccessTokenJsonResponse
  protected originalAttributes = {} as OauthAccessTokenJsonResponse

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

  constructor(oauthAccessToken: OauthAccessTokenJsonResponse | undefined) {
    super('oauth_access_tokens')
    if (oauthAccessToken) {
      this.attributes = { ...oauthAccessToken }
      this.originalAttributes = { ...oauthAccessToken }

      Object.keys(oauthAccessToken).forEach((key) => {
        if (!(key in this)) {
          this.customColumns[key] = (oauthAccessToken as OauthAccessTokenJsonResponse)[key]
        }
      })
    }

    this.withRelations = []
    this.selectFromQuery = DB.instance.selectFrom('oauth_access_tokens')
    this.updateFromQuery = DB.instance.updateTable('oauth_access_tokens')
    this.deleteFromQuery = DB.instance.deleteFrom('oauth_access_tokens')
    this.hasSelect = false
  }

  protected async loadRelations(models: OauthAccessTokenJsonResponse | OauthAccessTokenJsonResponse[]): Promise<void> {
    // Handle both single model and array of models
    const modelArray = Array.isArray(models) ? models : [models]
    if (!modelArray.length)
      return

    const modelIds = modelArray.map(model => model.id)

    for (const relation of this.withRelations) {
      const relatedRecords = await DB.instance
        .selectFrom(relation)
        .where('oauthAccessToken_id', 'in', modelIds)
        .selectAll()
        .execute()

      if (Array.isArray(models)) {
        models.map((model: OauthAccessTokenJsonResponse) => {
          const records = relatedRecords.filter((record: { oauthAccessToken_id: number }) => {
            return record.oauthAccessToken_id === model.id
          })

          model[relation] = records.length === 1 ? records[0] : records
          return model
        })
      }
      else {
        const records = relatedRecords.filter((record: { oauthAccessToken_id: number }) => {
          return record.oauthAccessToken_id === models.id
        })

        models[relation] = records.length === 1 ? records[0] : records
      }
    }
  }

  static with(relations: string[]): OauthAccessTokenModel {
    const instance = new OauthAccessTokenModel(undefined)

    return instance.applyWith(relations)
  }

  protected mapCustomGetters(models: OauthAccessTokenJsonResponse | OauthAccessTokenJsonResponse[]): void {
    const data = models

    if (Array.isArray(data)) {
      data.map((model: OauthAccessTokenJsonResponse) => {
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

  async mapCustomSetters(model: NewOauthAccessToken | OauthAccessTokenUpdate): Promise<void> {
    const customSetter = {
      default: () => {
      },

    }

    for (const [key, fn] of Object.entries(customSetter)) {
      (model as any)[key] = await fn()
    }
  }

  get user_id(): number {
    return this.attributes.user_id
  }

  get user(): UserModel | undefined {
    return this.attributes.user
  }

  get oauth_client_id(): number {
    return this.attributes.oauth_client_id
  }

  get oauth_client(): OauthClientModel | undefined {
    return this.attributes.oauth_client
  }

  get id(): number {
    return this.attributes.id
  }

  get token(): string {
    return this.attributes.token
  }

  get name(): string | undefined {
    return this.attributes.name
  }

  get scopes(): string | undefined {
    return this.attributes.scopes
  }

  get revoked(): boolean {
    return this.attributes.revoked
  }

  get expires_at(): Date | string | undefined {
    return this.attributes.expires_at
  }

  get created_at(): string | undefined {
    return this.attributes.created_at
  }

  get updated_at(): string | undefined {
    return this.attributes.updated_at
  }

  set token(value: string) {
    this.attributes.token = value
  }

  set name(value: string) {
    this.attributes.name = value
  }

  set scopes(value: string) {
    this.attributes.scopes = value
  }

  set revoked(value: boolean) {
    this.attributes.revoked = value
  }

  set expires_at(value: Date | string) {
    this.attributes.expires_at = value
  }

  set updated_at(value: string) {
    this.attributes.updated_at = value
  }

  static select(params: (keyof OauthAccessTokenJsonResponse)[] | RawBuilder<string> | string): OauthAccessTokenModel {
    const instance = new OauthAccessTokenModel(undefined)

    return instance.applySelect(params)
  }

  // Method to find a OauthAccessToken by ID
  static async find(id: number): Promise<OauthAccessTokenModel | undefined> {
    const query = DB.instance.selectFrom('oauth_access_tokens').where('id', '=', id).selectAll()

    const model = await query.executeTakeFirst()

    if (!model)
      return undefined

    const instance = new OauthAccessTokenModel(undefined)
    return instance.createInstance(model)
  }

  static async first(): Promise<OauthAccessTokenModel | undefined> {
    const instance = new OauthAccessTokenModel(undefined)

    const model = await instance.applyFirst()

    const data = new OauthAccessTokenModel(model)

    return data
  }

  static async last(): Promise<OauthAccessTokenModel | undefined> {
    const instance = new OauthAccessTokenModel(undefined)

    const model = await instance.applyLast()

    if (!model)
      return undefined

    return new OauthAccessTokenModel(model)
  }

  static async firstOrFail(): Promise<OauthAccessTokenModel | undefined> {
    const instance = new OauthAccessTokenModel(undefined)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<OauthAccessTokenModel[]> {
    const instance = new OauthAccessTokenModel(undefined)

    const models = await DB.instance.selectFrom('oauth_access_tokens').selectAll().execute()

    instance.mapCustomGetters(models)

    const data = await Promise.all(models.map(async (model: OauthAccessTokenJsonResponse) => {
      return new OauthAccessTokenModel(model)
    }))

    return data
  }

  static async findOrFail(id: number): Promise<OauthAccessTokenModel | undefined> {
    const instance = new OauthAccessTokenModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  static async findMany(ids: number[]): Promise<OauthAccessTokenModel[]> {
    const instance = new OauthAccessTokenModel(undefined)

    const models = await instance.applyFindMany(ids)

    return models.map((modelItem: OauthAccessTokenJsonResponse) => instance.parseResult(new OauthAccessTokenModel(modelItem)))
  }

  static async latest(column: keyof OauthAccessTokensTable = 'created_at'): Promise<OauthAccessTokenModel | undefined> {
    const instance = new OauthAccessTokenModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'desc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new OauthAccessTokenModel(model)
  }

  static async oldest(column: keyof OauthAccessTokensTable = 'created_at'): Promise<OauthAccessTokenModel | undefined> {
    const instance = new OauthAccessTokenModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'asc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new OauthAccessTokenModel(model)
  }

  static skip(count: number): OauthAccessTokenModel {
    const instance = new OauthAccessTokenModel(undefined)

    return instance.applySkip(count)
  }

  static take(count: number): OauthAccessTokenModel {
    const instance = new OauthAccessTokenModel(undefined)

    return instance.applyTake(count)
  }

  static where<V = string>(column: keyof OauthAccessTokensTable, ...args: [V] | [Operator, V]): OauthAccessTokenModel {
    const instance = new OauthAccessTokenModel(undefined)

    return instance.applyWhere<V>(column, ...args)
  }

  static orWhere(...conditions: [string, any][]): OauthAccessTokenModel {
    const instance = new OauthAccessTokenModel(undefined)

    return instance.applyOrWhere(...conditions)
  }

  static whereNotIn<V = number>(column: keyof OauthAccessTokensTable, values: V[]): OauthAccessTokenModel {
    const instance = new OauthAccessTokenModel(undefined)

    return instance.applyWhereNotIn<V>(column, values)
  }

  static whereBetween<V = number>(column: keyof OauthAccessTokensTable, range: [V, V]): OauthAccessTokenModel {
    const instance = new OauthAccessTokenModel(undefined)

    return instance.applyWhereBetween<V>(column, range)
  }

  static whereRef(column: keyof OauthAccessTokensTable, ...args: string[]): OauthAccessTokenModel {
    const instance = new OauthAccessTokenModel(undefined)

    return instance.applyWhereRef(column, ...args)
  }

  static when(condition: boolean, callback: (query: OauthAccessTokenModel) => OauthAccessTokenModel): OauthAccessTokenModel {
    const instance = new OauthAccessTokenModel(undefined)

    return instance.applyWhen(condition, callback as any)
  }

  static whereNull(column: keyof OauthAccessTokensTable): OauthAccessTokenModel {
    const instance = new OauthAccessTokenModel(undefined)

    return instance.applyWhereNull(column)
  }

  static whereNotNull(column: keyof OauthAccessTokensTable): OauthAccessTokenModel {
    const instance = new OauthAccessTokenModel(undefined)

    return instance.applyWhereNotNull(column)
  }

  static whereLike(column: keyof OauthAccessTokensTable, value: string): OauthAccessTokenModel {
    const instance = new OauthAccessTokenModel(undefined)

    return instance.applyWhereLike(column, value)
  }

  static orderBy(column: keyof OauthAccessTokensTable, order: 'asc' | 'desc'): OauthAccessTokenModel {
    const instance = new OauthAccessTokenModel(undefined)

    return instance.applyOrderBy(column, order)
  }

  static orderByAsc(column: keyof OauthAccessTokensTable): OauthAccessTokenModel {
    const instance = new OauthAccessTokenModel(undefined)

    return instance.applyOrderByAsc(column)
  }

  static orderByDesc(column: keyof OauthAccessTokensTable): OauthAccessTokenModel {
    const instance = new OauthAccessTokenModel(undefined)

    return instance.applyOrderByDesc(column)
  }

  static groupBy(column: keyof OauthAccessTokensTable): OauthAccessTokenModel {
    const instance = new OauthAccessTokenModel(undefined)

    return instance.applyGroupBy(column)
  }

  static having<V = string>(column: keyof OauthAccessTokensTable, operator: Operator, value: V): OauthAccessTokenModel {
    const instance = new OauthAccessTokenModel(undefined)

    return instance.applyHaving<V>(column, operator, value)
  }

  static inRandomOrder(): OauthAccessTokenModel {
    const instance = new OauthAccessTokenModel(undefined)

    return instance.applyInRandomOrder()
  }

  static whereColumn(first: keyof OauthAccessTokensTable, operator: Operator, second: keyof OauthAccessTokensTable): OauthAccessTokenModel {
    const instance = new OauthAccessTokenModel(undefined)

    return instance.applyWhereColumn(first, operator, second)
  }

  static async max(field: keyof OauthAccessTokensTable): Promise<number> {
    const instance = new OauthAccessTokenModel(undefined)

    return await instance.applyMax(field)
  }

  static async min(field: keyof OauthAccessTokensTable): Promise<number> {
    const instance = new OauthAccessTokenModel(undefined)

    return await instance.applyMin(field)
  }

  static async avg(field: keyof OauthAccessTokensTable): Promise<number> {
    const instance = new OauthAccessTokenModel(undefined)

    return await instance.applyAvg(field)
  }

  static async sum(field: keyof OauthAccessTokensTable): Promise<number> {
    const instance = new OauthAccessTokenModel(undefined)

    return await instance.applySum(field)
  }

  static async count(): Promise<number> {
    const instance = new OauthAccessTokenModel(undefined)

    return instance.applyCount()
  }

  static async get(): Promise<OauthAccessTokenModel[]> {
    const instance = new OauthAccessTokenModel(undefined)

    const results = await instance.applyGet()

    return results.map((item: OauthAccessTokenJsonResponse) => instance.createInstance(item))
  }

  static async pluck<K extends keyof OauthAccessTokenModel>(field: K): Promise<OauthAccessTokenModel[K][]> {
    const instance = new OauthAccessTokenModel(undefined)

    return await instance.applyPluck(field)
  }

  static async chunk(size: number, callback: (models: OauthAccessTokenModel[]) => Promise<void>): Promise<void> {
    const instance = new OauthAccessTokenModel(undefined)

    await instance.applyChunk(size, async (models) => {
      const modelInstances = models.map((item: OauthAccessTokenJsonResponse) => instance.createInstance(item))
      await callback(modelInstances)
    })
  }

  static async paginate(options: { limit?: number, offset?: number, page?: number } = { limit: 10, offset: 0, page: 1 }): Promise<{
    data: OauthAccessTokenModel[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }> {
    const instance = new OauthAccessTokenModel(undefined)

    const result = await instance.applyPaginate(options)

    return {
      data: result.data.map((item: OauthAccessTokenJsonResponse) => instance.createInstance(item)),
      paging: result.paging,
      next_cursor: result.next_cursor,
    }
  }

  // Instance method for creating model instances
  createInstance(data: OauthAccessTokenJsonResponse): OauthAccessTokenModel {
    return new OauthAccessTokenModel(data)
  }

  async applyCreate(newOauthAccessToken: NewOauthAccessToken): Promise<OauthAccessTokenModel> {
    const filteredValues = Object.fromEntries(
      Object.entries(newOauthAccessToken).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewOauthAccessToken

    await this.mapCustomSetters(filteredValues)

    const result = await DB.instance.insertInto('oauth_access_tokens')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await DB.instance.selectFrom('oauth_access_tokens')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created OauthAccessToken')
    }

    return this.createInstance(model)
  }

  async create(newOauthAccessToken: NewOauthAccessToken): Promise<OauthAccessTokenModel> {
    return await this.applyCreate(newOauthAccessToken)
  }

  static async create(newOauthAccessToken: NewOauthAccessToken): Promise<OauthAccessTokenModel> {
    const instance = new OauthAccessTokenModel(undefined)
    return await instance.applyCreate(newOauthAccessToken)
  }

  static async firstOrCreate(search: Partial<OauthAccessTokensTable>, values: NewOauthAccessToken = {} as NewOauthAccessToken): Promise<OauthAccessTokenModel> {
    // First try to find a record matching the search criteria
    const instance = new OauthAccessTokenModel(undefined)

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
    const createData = { ...search, ...values } as NewOauthAccessToken
    return await OauthAccessTokenModel.create(createData)
  }

  static async updateOrCreate(search: Partial<OauthAccessTokensTable>, values: NewOauthAccessToken = {} as NewOauthAccessToken): Promise<OauthAccessTokenModel> {
    // First try to find a record matching the search criteria
    const instance = new OauthAccessTokenModel(undefined)

    // Apply all search conditions
    for (const [key, value] of Object.entries(search)) {
      instance.selectFromQuery = instance.selectFromQuery.where(key, '=', value)
    }

    // Try to find the record
    const existingRecord = await instance.applyFirst()

    if (existingRecord) {
      // If record exists, update it with the new values
      const model = instance.createInstance(existingRecord)
      const updatedModel = await model.update(values as OauthAccessTokenUpdate)

      // Return the updated model instance
      if (updatedModel) {
        return updatedModel
      }

      // If update didn't return a model, fetch it again to ensure we have latest data
      const refreshedModel = await instance.applyFirst()
      return instance.createInstance(refreshedModel!)
    }

    // If no record exists, create a new one with combined search criteria and values
    const createData = { ...search, ...values } as NewOauthAccessToken
    return await OauthAccessTokenModel.create(createData)
  }

  async update(newOauthAccessToken: OauthAccessTokenUpdate): Promise<OauthAccessTokenModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newOauthAccessToken).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as OauthAccessTokenUpdate

    await this.mapCustomSetters(filteredValues)

    filteredValues.updated_at = new Date().toISOString()

    await DB.instance.updateTable('oauth_access_tokens')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('oauth_access_tokens')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated OauthAccessToken')
      }

      return this.createInstance(model)
    }

    return undefined
  }

  async forceUpdate(newOauthAccessToken: OauthAccessTokenUpdate): Promise<OauthAccessTokenModel | undefined> {
    await DB.instance.updateTable('oauth_access_tokens')
      .set(newOauthAccessToken)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('oauth_access_tokens')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated OauthAccessToken')
      }

      return this.createInstance(model)
    }

    return undefined
  }

  async save(): Promise<OauthAccessTokenModel> {
    // If the model has an ID, update it; otherwise, create a new record
    if (this.id) {
      // Update existing record
      await DB.instance.updateTable('oauth_access_tokens')
        .set(this.attributes as OauthAccessTokenUpdate)
        .where('id', '=', this.id)
        .executeTakeFirst()

      // Get the updated data
      const model = await DB.instance.selectFrom('oauth_access_tokens')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated OauthAccessToken')
      }

      return this.createInstance(model)
    }
    else {
      // Create new record
      const result = await DB.instance.insertInto('oauth_access_tokens')
        .values(this.attributes as NewOauthAccessToken)
        .executeTakeFirst()

      // Get the created data
      const model = await DB.instance.selectFrom('oauth_access_tokens')
        .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve created OauthAccessToken')
      }

      return this.createInstance(model)
    }
  }

  static async createMany(newOauthAccessToken: NewOauthAccessToken[]): Promise<void> {
    const instance = new OauthAccessTokenModel(undefined)

    const valuesFiltered = newOauthAccessToken.map((newOauthAccessToken: NewOauthAccessToken) => {
      const filteredValues = Object.fromEntries(
        Object.entries(newOauthAccessToken).filter(([key]) =>
          !instance.guarded.includes(key) && instance.fillable.includes(key),
        ),
      ) as NewOauthAccessToken

      return filteredValues
    })

    await DB.instance.insertInto('oauth_access_tokens')
      .values(valuesFiltered)
      .executeTakeFirst()
  }

  static async forceCreate(newOauthAccessToken: NewOauthAccessToken): Promise<OauthAccessTokenModel> {
    const result = await DB.instance.insertInto('oauth_access_tokens')
      .values(newOauthAccessToken)
      .executeTakeFirst()

    const instance = new OauthAccessTokenModel(undefined)
    const model = await DB.instance.selectFrom('oauth_access_tokens')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created OauthAccessToken')
    }

    return instance.createInstance(model)
  }

  // Method to remove a OauthAccessToken
  async delete(): Promise<number> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()

    const deleted = await DB.instance.deleteFrom('oauth_access_tokens')
      .where('id', '=', this.id)
      .execute()

    return deleted.numDeletedRows
  }

  static async remove(id: number): Promise<any> {
    return await DB.instance.deleteFrom('oauth_access_tokens')
      .where('id', '=', id)
      .execute()
  }

  static whereToken(value: string): OauthAccessTokenModel {
    const instance = new OauthAccessTokenModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('token', '=', value)

    return instance
  }

  static whereName(value: string): OauthAccessTokenModel {
    const instance = new OauthAccessTokenModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('name', '=', value)

    return instance
  }

  static whereScopes(value: string): OauthAccessTokenModel {
    const instance = new OauthAccessTokenModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('scopes', '=', value)

    return instance
  }

  static whereRevoked(value: string): OauthAccessTokenModel {
    const instance = new OauthAccessTokenModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('revoked', '=', value)

    return instance
  }

  static whereExpiresAt(value: string): OauthAccessTokenModel {
    const instance = new OauthAccessTokenModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('expires_at', '=', value)

    return instance
  }

  static whereIn<V = number>(column: keyof OauthAccessTokensTable, values: V[]): OauthAccessTokenModel {
    const instance = new OauthAccessTokenModel(undefined)

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

  async oauthClientBelong(): Promise<OauthClientModel> {
    if (this.oauth_client_id === undefined)
      throw new HttpError(500, 'Relation Error!')

    const model = await OauthClient
      .where('id', '=', this.oauth_client_id)
      .first()

    if (!model)
      throw new HttpError(500, 'Model Relation Not Found!')

    return model
  }

  static distinct(column: keyof OauthAccessTokenJsonResponse): OauthAccessTokenModel {
    const instance = new OauthAccessTokenModel(undefined)

    return instance.applyDistinct(column)
  }

  static join(table: string, firstCol: string, secondCol: string): OauthAccessTokenModel {
    const instance = new OauthAccessTokenModel(undefined)

    return instance.applyJoin(table, firstCol, secondCol)
  }

  toJSON(): OauthAccessTokenJsonResponse {
    const output = {

      id: this.id,
      token: this.token,
      name: this.name,
      scopes: this.scopes,
      revoked: this.revoked,
      expires_at: this.expires_at,

      created_at: this.created_at,

      updated_at: this.updated_at,

      user_id: this.user_id,
      user: this.user,
      oauth_client_id: this.oauth_client_id,
      oauth_client: this.oauth_client,
      ...this.customColumns,
    }

    return output
  }

  parseResult(model: OauthAccessTokenModel): OauthAccessTokenModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof OauthAccessTokenModel]
    }

    return model
  }

  // Add a protected applyFind implementation
  protected async applyFind(id: number): Promise<OauthAccessTokenModel | undefined> {
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

export async function find(id: number): Promise<OauthAccessTokenModel | undefined> {
  const query = DB.instance.selectFrom('oauth_access_tokens').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  const instance = new OauthAccessTokenModel(undefined)
  return instance.createInstance(model)
}

export async function count(): Promise<number> {
  const results = await OauthAccessTokenModel.count()

  return results
}

export async function create(newOauthAccessToken: NewOauthAccessToken): Promise<OauthAccessTokenModel> {
  const instance = new OauthAccessTokenModel(undefined)
  return await instance.applyCreate(newOauthAccessToken)
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(DB.instance)
}

export async function remove(id: number): Promise<void> {
  await DB.instance.deleteFrom('oauth_access_tokens')
    .where('id', '=', id)
    .execute()
}

export async function whereToken(value: string): Promise<OauthAccessTokenModel[]> {
  const query = DB.instance.selectFrom('oauth_access_tokens').where('token', '=', value)
  const results: OauthAccessTokenJsonResponse = await query.execute()

  return results.map((modelItem: OauthAccessTokenJsonResponse) => new OauthAccessTokenModel(modelItem))
}

export async function whereName(value: string): Promise<OauthAccessTokenModel[]> {
  const query = DB.instance.selectFrom('oauth_access_tokens').where('name', '=', value)
  const results: OauthAccessTokenJsonResponse = await query.execute()

  return results.map((modelItem: OauthAccessTokenJsonResponse) => new OauthAccessTokenModel(modelItem))
}

export async function whereScopes(value: string): Promise<OauthAccessTokenModel[]> {
  const query = DB.instance.selectFrom('oauth_access_tokens').where('scopes', '=', value)
  const results: OauthAccessTokenJsonResponse = await query.execute()

  return results.map((modelItem: OauthAccessTokenJsonResponse) => new OauthAccessTokenModel(modelItem))
}

export async function whereRevoked(value: boolean): Promise<OauthAccessTokenModel[]> {
  const query = DB.instance.selectFrom('oauth_access_tokens').where('revoked', '=', value)
  const results: OauthAccessTokenJsonResponse = await query.execute()

  return results.map((modelItem: OauthAccessTokenJsonResponse) => new OauthAccessTokenModel(modelItem))
}

export async function whereExpiresAt(value: Date | string): Promise<OauthAccessTokenModel[]> {
  const query = DB.instance.selectFrom('oauth_access_tokens').where('expires_at', '=', value)
  const results: OauthAccessTokenJsonResponse = await query.execute()

  return results.map((modelItem: OauthAccessTokenJsonResponse) => new OauthAccessTokenModel(modelItem))
}

export const OauthAccessToken = OauthAccessTokenModel

export default OauthAccessToken
