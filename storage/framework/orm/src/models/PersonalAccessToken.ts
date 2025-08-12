import type { RawBuilder } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import type { NewPersonalAccessToken, PersonalAccessTokenJsonResponse, PersonalAccessTokensTable, PersonalAccessTokenUpdate } from '../types/PersonalAccessTokenType'
import type { UserModel } from './User'
import { sql } from '@stacksjs/database'
import { HttpError } from '@stacksjs/error-handling'
import { DB } from '@stacksjs/orm'

import { BaseOrm } from '../utils/base'

export class PersonalAccessTokenModel extends BaseOrm<PersonalAccessTokenModel, PersonalAccessTokensTable, PersonalAccessTokenJsonResponse> {
  private readonly hidden: Array<keyof PersonalAccessTokenJsonResponse> = []
  private readonly fillable: Array<keyof PersonalAccessTokenJsonResponse> = ['name', 'token', 'plain_text_token', 'abilities', 'last_used_at', 'expires_at', 'revoked_at', 'ip_address', 'device_name', 'is_single_use', 'team_id', 'user_id']
  private readonly guarded: Array<keyof PersonalAccessTokenJsonResponse> = []
  protected attributes = {} as PersonalAccessTokenJsonResponse
  protected originalAttributes = {} as PersonalAccessTokenJsonResponse

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

  constructor(personalAccessToken: PersonalAccessTokenJsonResponse | undefined) {
    super('personal_access_tokens')
    if (personalAccessToken) {
      this.attributes = { ...personalAccessToken }
      this.originalAttributes = { ...personalAccessToken }

      Object.keys(personalAccessToken).forEach((key) => {
        if (!(key in this)) {
          this.customColumns[key] = (personalAccessToken as PersonalAccessTokenJsonResponse)[key]
        }
      })
    }

    this.withRelations = []
    this.selectFromQuery = DB.instance.selectFrom('personal_access_tokens')
    this.updateFromQuery = DB.instance.updateTable('personal_access_tokens')
    this.deleteFromQuery = DB.instance.deleteFrom('personal_access_tokens')
    this.hasSelect = false
  }

  protected async loadRelations(models: PersonalAccessTokenJsonResponse | PersonalAccessTokenJsonResponse[]): Promise<void> {
    // Handle both single model and array of models
    const modelArray = Array.isArray(models) ? models : [models]
    if (!modelArray.length)
      return

    const modelIds = modelArray.map(model => model.id)

    for (const relation of this.withRelations) {
      const relatedRecords = await DB.instance
        .selectFrom(relation)
        .where('personalAccessToken_id', 'in', modelIds)
        .selectAll()
        .execute()

      if (Array.isArray(models)) {
        models.map((model: PersonalAccessTokenJsonResponse) => {
          const records = relatedRecords.filter((record: { personalAccessToken_id: number }) => {
            return record.personalAccessToken_id === model.id
          })

          model[relation] = records.length === 1 ? records[0] : records
          return model
        })
      }
      else {
        const records = relatedRecords.filter((record: { personalAccessToken_id: number }) => {
          return record.personalAccessToken_id === models.id
        })

        models[relation] = records.length === 1 ? records[0] : records
      }
    }
  }

  static with(relations: string[]): PersonalAccessTokenModel {
    const instance = new PersonalAccessTokenModel(undefined)

    return instance.applyWith(relations)
  }

  protected mapCustomGetters(models: PersonalAccessTokenJsonResponse | PersonalAccessTokenJsonResponse[]): void {
    const data = models

    if (Array.isArray(data)) {
      data.map((model: PersonalAccessTokenJsonResponse) => {
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

  async mapCustomSetters(model: NewPersonalAccessToken): Promise<void> {
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

  get id(): number {
    return this.attributes.id
  }

  get name(): string {
    return this.attributes.name
  }

  get token(): string | undefined {
    return this.attributes.token
  }

  get plain_text_token(): string {
    return this.attributes.plain_text_token
  }

  get abilities(): string {
    return this.attributes.abilities
  }

  get last_used_at(): Date | string | undefined {
    return this.attributes.last_used_at
  }

  get expires_at(): Date | string | undefined {
    return this.attributes.expires_at
  }

  get revoked_at(): Date | string | undefined {
    return this.attributes.revoked_at
  }

  get ip_address(): string | undefined {
    return this.attributes.ip_address
  }

  get device_name(): string | undefined {
    return this.attributes.device_name
  }

  get is_single_use(): boolean {
    return this.attributes.is_single_use
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

  set token(value: string) {
    this.attributes.token = value
  }

  set plain_text_token(value: string) {
    this.attributes.plain_text_token = value
  }

  set abilities(value: string) {
    this.attributes.abilities = value
  }

  set last_used_at(value: Date | string) {
    this.attributes.last_used_at = value
  }

  set expires_at(value: Date | string) {
    this.attributes.expires_at = value
  }

  set revoked_at(value: Date | string) {
    this.attributes.revoked_at = value
  }

  set ip_address(value: string) {
    this.attributes.ip_address = value
  }

  set device_name(value: string) {
    this.attributes.device_name = value
  }

  set is_single_use(value: boolean) {
    this.attributes.is_single_use = value
  }

  set updated_at(value: string) {
    this.attributes.updated_at = value
  }

  static select(params: (keyof PersonalAccessTokenJsonResponse)[] | RawBuilder<string> | string): PersonalAccessTokenModel {
    const instance = new PersonalAccessTokenModel(undefined)

    return instance.applySelect(params)
  }

  // Method to find a PersonalAccessToken by ID
  static async find(id: number): Promise<PersonalAccessTokenModel | undefined> {
    const query = DB.instance.selectFrom('personal_access_tokens').where('id', '=', id).selectAll()

    const model = await query.executeTakeFirst()

    if (!model)
      return undefined

    const instance = new PersonalAccessTokenModel(undefined)
    return instance.createInstance(model)
  }

  static async first(): Promise<PersonalAccessTokenModel | undefined> {
    const instance = new PersonalAccessTokenModel(undefined)

    const model = await instance.applyFirst()

    const data = new PersonalAccessTokenModel(model)

    return data
  }

  static async last(): Promise<PersonalAccessTokenModel | undefined> {
    const instance = new PersonalAccessTokenModel(undefined)

    const model = await instance.applyLast()

    if (!model)
      return undefined

    return new PersonalAccessTokenModel(model)
  }

  static async firstOrFail(): Promise<PersonalAccessTokenModel | undefined> {
    const instance = new PersonalAccessTokenModel(undefined)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<PersonalAccessTokenModel[]> {
    const instance = new PersonalAccessTokenModel(undefined)

    const models = await DB.instance.selectFrom('personal_access_tokens').selectAll().execute()

    instance.mapCustomGetters(models)

    const data = await Promise.all(models.map(async (model: PersonalAccessTokenJsonResponse) => {
      return new PersonalAccessTokenModel(model)
    }))

    return data
  }

  static async findOrFail(id: number): Promise<PersonalAccessTokenModel | undefined> {
    const instance = new PersonalAccessTokenModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  static async findMany(ids: number[]): Promise<PersonalAccessTokenModel[]> {
    const instance = new PersonalAccessTokenModel(undefined)

    const models = await instance.applyFindMany(ids)

    return models.map((modelItem: PersonalAccessTokenJsonResponse) => instance.parseResult(new PersonalAccessTokenModel(modelItem)))
  }

  static async latest(column: keyof PersonalAccessTokensTable = 'created_at'): Promise<PersonalAccessTokenModel | undefined> {
    const instance = new PersonalAccessTokenModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'desc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new PersonalAccessTokenModel(model)
  }

  static async oldest(column: keyof PersonalAccessTokensTable = 'created_at'): Promise<PersonalAccessTokenModel | undefined> {
    const instance = new PersonalAccessTokenModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'asc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new PersonalAccessTokenModel(model)
  }

  static skip(count: number): PersonalAccessTokenModel {
    const instance = new PersonalAccessTokenModel(undefined)

    return instance.applySkip(count)
  }

  static take(count: number): PersonalAccessTokenModel {
    const instance = new PersonalAccessTokenModel(undefined)

    return instance.applyTake(count)
  }

  static where<V = string>(column: keyof PersonalAccessTokensTable, ...args: [V] | [Operator, V]): PersonalAccessTokenModel {
    const instance = new PersonalAccessTokenModel(undefined)

    return instance.applyWhere<V>(column, ...args)
  }

  static orWhere(...conditions: [string, any][]): PersonalAccessTokenModel {
    const instance = new PersonalAccessTokenModel(undefined)

    return instance.applyOrWhere(...conditions)
  }

  static whereNotIn<V = number>(column: keyof PersonalAccessTokensTable, values: V[]): PersonalAccessTokenModel {
    const instance = new PersonalAccessTokenModel(undefined)

    return instance.applyWhereNotIn<V>(column, values)
  }

  static whereBetween<V = number>(column: keyof PersonalAccessTokensTable, range: [V, V]): PersonalAccessTokenModel {
    const instance = new PersonalAccessTokenModel(undefined)

    return instance.applyWhereBetween<V>(column, range)
  }

  static whereRef(column: keyof PersonalAccessTokensTable, ...args: string[]): PersonalAccessTokenModel {
    const instance = new PersonalAccessTokenModel(undefined)

    return instance.applyWhereRef(column, ...args)
  }

  static when(condition: boolean, callback: (query: PersonalAccessTokenModel) => PersonalAccessTokenModel): PersonalAccessTokenModel {
    const instance = new PersonalAccessTokenModel(undefined)

    return instance.applyWhen(condition, callback as any)
  }

  static whereNull(column: keyof PersonalAccessTokensTable): PersonalAccessTokenModel {
    const instance = new PersonalAccessTokenModel(undefined)

    return instance.applyWhereNull(column)
  }

  static whereNotNull(column: keyof PersonalAccessTokensTable): PersonalAccessTokenModel {
    const instance = new PersonalAccessTokenModel(undefined)

    return instance.applyWhereNotNull(column)
  }

  static whereLike(column: keyof PersonalAccessTokensTable, value: string): PersonalAccessTokenModel {
    const instance = new PersonalAccessTokenModel(undefined)

    return instance.applyWhereLike(column, value)
  }

  static orderBy(column: keyof PersonalAccessTokensTable, order: 'asc' | 'desc'): PersonalAccessTokenModel {
    const instance = new PersonalAccessTokenModel(undefined)

    return instance.applyOrderBy(column, order)
  }

  static orderByAsc(column: keyof PersonalAccessTokensTable): PersonalAccessTokenModel {
    const instance = new PersonalAccessTokenModel(undefined)

    return instance.applyOrderByAsc(column)
  }

  static orderByDesc(column: keyof PersonalAccessTokensTable): PersonalAccessTokenModel {
    const instance = new PersonalAccessTokenModel(undefined)

    return instance.applyOrderByDesc(column)
  }

  static groupBy(column: keyof PersonalAccessTokensTable): PersonalAccessTokenModel {
    const instance = new PersonalAccessTokenModel(undefined)

    return instance.applyGroupBy(column)
  }

  static having<V = string>(column: keyof PersonalAccessTokensTable, operator: Operator, value: V): PersonalAccessTokenModel {
    const instance = new PersonalAccessTokenModel(undefined)

    return instance.applyHaving<V>(column, operator, value)
  }

  static inRandomOrder(): PersonalAccessTokenModel {
    const instance = new PersonalAccessTokenModel(undefined)

    return instance.applyInRandomOrder()
  }

  static whereColumn(first: keyof PersonalAccessTokensTable, operator: Operator, second: keyof PersonalAccessTokensTable): PersonalAccessTokenModel {
    const instance = new PersonalAccessTokenModel(undefined)

    return instance.applyWhereColumn(first, operator, second)
  }

  static async max(field: keyof PersonalAccessTokensTable): Promise<number> {
    const instance = new PersonalAccessTokenModel(undefined)

    return await instance.applyMax(field)
  }

  static async min(field: keyof PersonalAccessTokensTable): Promise<number> {
    const instance = new PersonalAccessTokenModel(undefined)

    return await instance.applyMin(field)
  }

  static async avg(field: keyof PersonalAccessTokensTable): Promise<number> {
    const instance = new PersonalAccessTokenModel(undefined)

    return await instance.applyAvg(field)
  }

  static async sum(field: keyof PersonalAccessTokensTable): Promise<number> {
    const instance = new PersonalAccessTokenModel(undefined)

    return await instance.applySum(field)
  }

  static async count(): Promise<number> {
    const instance = new PersonalAccessTokenModel(undefined)

    return instance.applyCount()
  }

  static async get(): Promise<PersonalAccessTokenModel[]> {
    const instance = new PersonalAccessTokenModel(undefined)

    const results = await instance.applyGet()

    return results.map((item: PersonalAccessTokenJsonResponse) => instance.createInstance(item))
  }

  static async pluck<K extends keyof PersonalAccessTokenModel>(field: K): Promise<PersonalAccessTokenModel[K][]> {
    const instance = new PersonalAccessTokenModel(undefined)

    return await instance.applyPluck(field)
  }

  static async chunk(size: number, callback: (models: PersonalAccessTokenModel[]) => Promise<void>): Promise<void> {
    const instance = new PersonalAccessTokenModel(undefined)

    await instance.applyChunk(size, async (models) => {
      const modelInstances = models.map((item: PersonalAccessTokenJsonResponse) => instance.createInstance(item))
      await callback(modelInstances)
    })
  }

  static async paginate(options: { limit?: number, offset?: number, page?: number } = { limit: 10, offset: 0, page: 1 }): Promise<{
    data: PersonalAccessTokenModel[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }> {
    const instance = new PersonalAccessTokenModel(undefined)

    const result = await instance.applyPaginate(options)

    return {
      data: result.data.map((item: PersonalAccessTokenJsonResponse) => instance.createInstance(item)),
      paging: result.paging,
      next_cursor: result.next_cursor,
    }
  }

  // Instance method for creating model instances
  createInstance(data: PersonalAccessTokenJsonResponse): PersonalAccessTokenModel {
    return new PersonalAccessTokenModel(data)
  }

  async applyCreate(newPersonalAccessToken: NewPersonalAccessToken): Promise<PersonalAccessTokenModel> {
    const filteredValues = Object.fromEntries(
      Object.entries(newPersonalAccessToken).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewPersonalAccessToken

    await this.mapCustomSetters(filteredValues)

    const result = await DB.instance.insertInto('personal_access_tokens')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await DB.instance.selectFrom('personal_access_tokens')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created PersonalAccessToken')
    }

    return this.createInstance(model)
  }

  async create(newPersonalAccessToken: NewPersonalAccessToken): Promise<PersonalAccessTokenModel> {
    return await this.applyCreate(newPersonalAccessToken)
  }

  static async create(newPersonalAccessToken: NewPersonalAccessToken): Promise<PersonalAccessTokenModel> {
    const instance = new PersonalAccessTokenModel(undefined)
    return await instance.applyCreate(newPersonalAccessToken)
  }

  static async firstOrCreate(search: Partial<PersonalAccessTokensTable>, values: NewPersonalAccessToken = {} as NewPersonalAccessToken): Promise<PersonalAccessTokenModel> {
    // First try to find a record matching the search criteria
    const instance = new PersonalAccessTokenModel(undefined)

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
    const createData = { ...search, ...values } as NewPersonalAccessToken
    return await PersonalAccessTokenModel.create(createData)
  }

  static async updateOrCreate(search: Partial<PersonalAccessTokensTable>, values: NewPersonalAccessToken = {} as NewPersonalAccessToken): Promise<PersonalAccessTokenModel> {
    // First try to find a record matching the search criteria
    const instance = new PersonalAccessTokenModel(undefined)

    // Apply all search conditions
    for (const [key, value] of Object.entries(search)) {
      instance.selectFromQuery = instance.selectFromQuery.where(key, '=', value)
    }

    // Try to find the record
    const existingRecord = await instance.applyFirst()

    if (existingRecord) {
      // If record exists, update it with the new values
      const model = instance.createInstance(existingRecord)
      const updatedModel = await model.update(values as PersonalAccessTokenUpdate)

      // Return the updated model instance
      if (updatedModel) {
        return updatedModel
      }

      // If update didn't return a model, fetch it again to ensure we have latest data
      const refreshedModel = await instance.applyFirst()
      return instance.createInstance(refreshedModel!)
    }

    // If no record exists, create a new one with combined search criteria and values
    const createData = { ...search, ...values } as NewPersonalAccessToken
    return await PersonalAccessTokenModel.create(createData)
  }

  async update(newPersonalAccessToken: PersonalAccessTokenUpdate): Promise<PersonalAccessTokenModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newPersonalAccessToken).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as PersonalAccessTokenUpdate

    await this.mapCustomSetters(filteredValues)

    filteredValues.updated_at = new Date().toISOString()

    await DB.instance.updateTable('personal_access_tokens')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('personal_access_tokens')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated PersonalAccessToken')
      }

      return this.createInstance(model)
    }

    return undefined
  }

  async forceUpdate(newPersonalAccessToken: PersonalAccessTokenUpdate): Promise<PersonalAccessTokenModel | undefined> {
    await DB.instance.updateTable('personal_access_tokens')
      .set(newPersonalAccessToken)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('personal_access_tokens')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated PersonalAccessToken')
      }

      return this.createInstance(model)
    }

    return undefined
  }

  async save(): Promise<PersonalAccessTokenModel> {
    // If the model has an ID, update it; otherwise, create a new record
    if (this.id) {
      // Update existing record
      await DB.instance.updateTable('personal_access_tokens')
        .set(this.attributes as PersonalAccessTokenUpdate)
        .where('id', '=', this.id)
        .executeTakeFirst()

      // Get the updated data
      const model = await DB.instance.selectFrom('personal_access_tokens')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated PersonalAccessToken')
      }

      return this.createInstance(model)
    }
    else {
      // Create new record
      const result = await DB.instance.insertInto('personal_access_tokens')
        .values(this.attributes as NewPersonalAccessToken)
        .executeTakeFirst()

      // Get the created data
      const model = await DB.instance.selectFrom('personal_access_tokens')
        .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve created PersonalAccessToken')
      }

      return this.createInstance(model)
    }
  }

  static async createMany(newPersonalAccessToken: NewPersonalAccessToken[]): Promise<void> {
    const instance = new PersonalAccessTokenModel(undefined)

    const valuesFiltered = newPersonalAccessToken.map((newPersonalAccessToken: NewPersonalAccessToken) => {
      const filteredValues = Object.fromEntries(
        Object.entries(newPersonalAccessToken).filter(([key]) =>
          !instance.guarded.includes(key) && instance.fillable.includes(key),
        ),
      ) as NewPersonalAccessToken

      return filteredValues
    })

    await DB.instance.insertInto('personal_access_tokens')
      .values(valuesFiltered)
      .executeTakeFirst()
  }

  static async forceCreate(newPersonalAccessToken: NewPersonalAccessToken): Promise<PersonalAccessTokenModel> {
    const result = await DB.instance.insertInto('personal_access_tokens')
      .values(newPersonalAccessToken)
      .executeTakeFirst()

    const instance = new PersonalAccessTokenModel(undefined)
    const model = await DB.instance.selectFrom('personal_access_tokens')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created PersonalAccessToken')
    }

    return instance.createInstance(model)
  }

  // Method to remove a PersonalAccessToken
  async delete(): Promise<number> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()

    const deleted = await DB.instance.deleteFrom('personal_access_tokens')
      .where('id', '=', this.id)
      .execute()

    return deleted.numDeletedRows
  }

  static async remove(id: number): Promise<any> {
    return await DB.instance.deleteFrom('personal_access_tokens')
      .where('id', '=', id)
      .execute()
  }

  static whereName(value: string): PersonalAccessTokenModel {
    const instance = new PersonalAccessTokenModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('name', '=', value)

    return instance
  }

  static whereToken(value: string): PersonalAccessTokenModel {
    const instance = new PersonalAccessTokenModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('token', '=', value)

    return instance
  }

  static wherePlainTextToken(value: string): PersonalAccessTokenModel {
    const instance = new PersonalAccessTokenModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('plain_text_token', '=', value)

    return instance
  }

  static whereAbilities(value: string): PersonalAccessTokenModel {
    const instance = new PersonalAccessTokenModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('abilities', '=', value)

    return instance
  }

  static whereLastUsedAt(value: string): PersonalAccessTokenModel {
    const instance = new PersonalAccessTokenModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('last_used_at', '=', value)

    return instance
  }

  static whereExpiresAt(value: string): PersonalAccessTokenModel {
    const instance = new PersonalAccessTokenModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('expires_at', '=', value)

    return instance
  }

  static whereRevokedAt(value: string): PersonalAccessTokenModel {
    const instance = new PersonalAccessTokenModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('revoked_at', '=', value)

    return instance
  }

  static whereIpAddress(value: string): PersonalAccessTokenModel {
    const instance = new PersonalAccessTokenModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('ip_address', '=', value)

    return instance
  }

  static whereDeviceName(value: string): PersonalAccessTokenModel {
    const instance = new PersonalAccessTokenModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('device_name', '=', value)

    return instance
  }

  static whereIsSingleUse(value: string): PersonalAccessTokenModel {
    const instance = new PersonalAccessTokenModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('is_single_use', '=', value)

    return instance
  }

  static whereIn<V = number>(column: keyof PersonalAccessTokensTable, values: V[]): PersonalAccessTokenModel {
    const instance = new PersonalAccessTokenModel(undefined)

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

  static distinct(column: keyof PersonalAccessTokenJsonResponse): PersonalAccessTokenModel {
    const instance = new PersonalAccessTokenModel(undefined)

    return instance.applyDistinct(column)
  }

  static join(table: string, firstCol: string, secondCol: string): PersonalAccessTokenModel {
    const instance = new PersonalAccessTokenModel(undefined)

    return instance.applyJoin(table, firstCol, secondCol)
  }

  toJSON(): PersonalAccessTokenJsonResponse {
    const output = {

      id: this.id,
      name: this.name,
      token: this.token,
      plain_text_token: this.plain_text_token,
      abilities: this.abilities,
      last_used_at: this.last_used_at,
      expires_at: this.expires_at,
      revoked_at: this.revoked_at,
      ip_address: this.ip_address,
      device_name: this.device_name,
      is_single_use: this.is_single_use,

      created_at: this.created_at,

      updated_at: this.updated_at,

      user_id: this.user_id,
      user: this.user,
      ...this.customColumns,
    }

    return output
  }

  parseResult(model: PersonalAccessTokenModel): PersonalAccessTokenModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof PersonalAccessTokenModel]
    }

    return model
  }

  // Add a protected applyFind implementation
  protected async applyFind(id: number): Promise<PersonalAccessTokenModel | undefined> {
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

export async function find(id: number): Promise<PersonalAccessTokenModel | undefined> {
  const query = DB.instance.selectFrom('personal_access_tokens').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  const instance = new PersonalAccessTokenModel(undefined)
  return instance.createInstance(model)
}

export async function count(): Promise<number> {
  const results = await PersonalAccessTokenModel.count()

  return results
}

export async function create(newPersonalAccessToken: NewPersonalAccessToken): Promise<PersonalAccessTokenModel> {
  const instance = new PersonalAccessTokenModel(undefined)
  return await instance.applyCreate(newPersonalAccessToken)
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(DB.instance)
}

export async function remove(id: number): Promise<void> {
  await DB.instance.deleteFrom('personal_access_tokens')
    .where('id', '=', id)
    .execute()
}

export async function whereName(value: string): Promise<PersonalAccessTokenModel[]> {
  const query = DB.instance.selectFrom('personal_access_tokens').where('name', '=', value)
  const results: PersonalAccessTokenJsonResponse = await query.execute()

  return results.map((modelItem: PersonalAccessTokenJsonResponse) => new PersonalAccessTokenModel(modelItem))
}

export async function whereToken(value: string): Promise<PersonalAccessTokenModel[]> {
  const query = DB.instance.selectFrom('personal_access_tokens').where('token', '=', value)
  const results: PersonalAccessTokenJsonResponse = await query.execute()

  return results.map((modelItem: PersonalAccessTokenJsonResponse) => new PersonalAccessTokenModel(modelItem))
}

export async function wherePlainTextToken(value: string): Promise<PersonalAccessTokenModel[]> {
  const query = DB.instance.selectFrom('personal_access_tokens').where('plain_text_token', '=', value)
  const results: PersonalAccessTokenJsonResponse = await query.execute()

  return results.map((modelItem: PersonalAccessTokenJsonResponse) => new PersonalAccessTokenModel(modelItem))
}

export async function whereAbilities(value: string): Promise<PersonalAccessTokenModel[]> {
  const query = DB.instance.selectFrom('personal_access_tokens').where('abilities', '=', value)
  const results: PersonalAccessTokenJsonResponse = await query.execute()

  return results.map((modelItem: PersonalAccessTokenJsonResponse) => new PersonalAccessTokenModel(modelItem))
}

export async function whereLastUsedAt(value: Date | string): Promise<PersonalAccessTokenModel[]> {
  const query = DB.instance.selectFrom('personal_access_tokens').where('last_used_at', '=', value)
  const results: PersonalAccessTokenJsonResponse = await query.execute()

  return results.map((modelItem: PersonalAccessTokenJsonResponse) => new PersonalAccessTokenModel(modelItem))
}

export async function whereExpiresAt(value: Date | string): Promise<PersonalAccessTokenModel[]> {
  const query = DB.instance.selectFrom('personal_access_tokens').where('expires_at', '=', value)
  const results: PersonalAccessTokenJsonResponse = await query.execute()

  return results.map((modelItem: PersonalAccessTokenJsonResponse) => new PersonalAccessTokenModel(modelItem))
}

export async function whereRevokedAt(value: Date | string): Promise<PersonalAccessTokenModel[]> {
  const query = DB.instance.selectFrom('personal_access_tokens').where('revoked_at', '=', value)
  const results: PersonalAccessTokenJsonResponse = await query.execute()

  return results.map((modelItem: PersonalAccessTokenJsonResponse) => new PersonalAccessTokenModel(modelItem))
}

export async function whereIpAddress(value: string): Promise<PersonalAccessTokenModel[]> {
  const query = DB.instance.selectFrom('personal_access_tokens').where('ip_address', '=', value)
  const results: PersonalAccessTokenJsonResponse = await query.execute()

  return results.map((modelItem: PersonalAccessTokenJsonResponse) => new PersonalAccessTokenModel(modelItem))
}

export async function whereDeviceName(value: string): Promise<PersonalAccessTokenModel[]> {
  const query = DB.instance.selectFrom('personal_access_tokens').where('device_name', '=', value)
  const results: PersonalAccessTokenJsonResponse = await query.execute()

  return results.map((modelItem: PersonalAccessTokenJsonResponse) => new PersonalAccessTokenModel(modelItem))
}

export async function whereIsSingleUse(value: boolean): Promise<PersonalAccessTokenModel[]> {
  const query = DB.instance.selectFrom('personal_access_tokens').where('is_single_use', '=', value)
  const results: PersonalAccessTokenJsonResponse = await query.execute()

  return results.map((modelItem: PersonalAccessTokenJsonResponse) => new PersonalAccessTokenModel(modelItem))
}

export const PersonalAccessToken = PersonalAccessTokenModel

export default PersonalAccessToken
