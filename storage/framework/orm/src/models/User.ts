import type { RawBuilder } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import type { NewUser, UserJsonResponse, UsersTable, UserUpdate } from '../types/UserType'
import type { AuthorModel } from './Author'
import type { CustomerModel } from './Customer'
import type { DriverModel } from './Driver'
import type { OauthAccessTokenModel } from './OauthAccessToken'
import type { PersonalAccessTokenModel } from './PersonalAccessToken'
import type { SubscriberModel } from './Subscriber'
import { randomUUIDv7 } from 'bun'

import { sql } from '@stacksjs/database'

import { HttpError } from '@stacksjs/error-handling'

import { DB } from '@stacksjs/orm'

import { makeHash } from '@stacksjs/security'

// soon, these will be auto-imported
// soon, these will be auto-imported
import { BaseOrm } from '../utils/base'

export class UserModel extends BaseOrm<UserModel, UsersTable, UserJsonResponse> {
  private readonly hidden: Array<keyof UserJsonResponse> = ['password']
  private readonly fillable: Array<keyof UserJsonResponse> = ['name', 'email', 'password', 'uuid', 'two_factor_secret', 'public_key', 'team_id']
  private readonly guarded: Array<keyof UserJsonResponse> = []
  protected attributes = {} as UserJsonResponse
  protected originalAttributes = {} as UserJsonResponse

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

  constructor(user: UserJsonResponse | undefined) {
    super('users')
    if (user) {
      this.attributes = { ...user }
      this.originalAttributes = { ...user }

      Object.keys(user).forEach((key) => {
        if (!(key in this)) {
          this.customColumns[key] = (user as UserJsonResponse)[key]
        }
      })
    }

    this.withRelations = []
    this.selectFromQuery = DB.instance.selectFrom('users')
    this.updateFromQuery = DB.instance.updateTable('users')
    this.deleteFromQuery = DB.instance.deleteFrom('users')
    this.hasSelect = false
  }

  protected async loadRelations(models: UserJsonResponse | UserJsonResponse[]): Promise<void> {
    // Handle both single model and array of models
    const modelArray = Array.isArray(models) ? models : [models]
    if (!modelArray.length)
      return

    const modelIds = modelArray.map(model => model.id)

    for (const relation of this.withRelations) {
      const relatedRecords = await DB.instance
        .selectFrom(relation)
        .where('user_id', 'in', modelIds)
        .selectAll()
        .execute()

      if (Array.isArray(models)) {
        models.map((model: UserJsonResponse) => {
          const records = relatedRecords.filter((record: { user_id: number }) => {
            return record.user_id === model.id
          })

          model[relation] = records.length === 1 ? records[0] : records
          return model
        })
      }
      else {
        const records = relatedRecords.filter((record: { user_id: number }) => {
          return record.user_id === models.id
        })

        models[relation] = records.length === 1 ? records[0] : records
      }
    }
  }

  static with(relations: string[]): UserModel {
    const instance = new UserModel(undefined)

    return instance.applyWith(relations)
  }

  protected mapCustomGetters(models: UserJsonResponse | UserJsonResponse[]): void {
    const data = models

    if (Array.isArray(data)) {
      data.map((model: UserJsonResponse) => {
        const customGetter = {
          default: () => {
          },

          salutationName: () => {
            return `Mr. ${model.name}`
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

        salutationName: () => {
          return `Mr. ${model.name}`
        },

      }

      for (const [key, fn] of Object.entries(customGetter)) {
        (model as any)[key] = fn()
      }
    }
  }

  async mapCustomSetters(model: NewUser | UserUpdate): Promise<void> {
    const customSetter = {
      default: () => {
      },

      password: async () => {
        return await makeHash(model.password, { algorithm: 'bcrypt' })
      },

    }

    for (const [key, fn] of Object.entries(customSetter)) {
      (model as any)[key] = await fn()
    }
  }

  get subscriber(): SubscriberModel | undefined {
    return this.attributes.subscriber
  }

  get driver(): DriverModel | undefined {
    return this.attributes.driver
  }

  get author(): AuthorModel | undefined {
    return this.attributes.author
  }

  get personal_access_tokens(): PersonalAccessTokenModel[] | [] {
    return this.attributes.personal_access_tokens
  }

  get oauth_access_tokens(): OauthAccessTokenModel[] | [] {
    return this.attributes.oauth_access_tokens
  }

  get customers(): CustomerModel[] | [] {
    return this.attributes.customers
  }

  get id(): number {
    return this.attributes.id
  }

  get uuid(): string | undefined {
    return this.attributes.uuid
  }

  get public_passkey(): string | undefined {
    return this.attributes.public_passkey
  }

  get name(): string {
    return this.attributes.name
  }

  get email(): string {
    return this.attributes.email
  }

  get password(): string {
    return this.attributes.password
  }

  get github_id(): string | undefined {
    return this.attributes.github_id
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

  set public_passkey(value: string) {
    this.attributes.public_passkey = value
  }

  set name(value: string) {
    this.attributes.name = value
  }

  set email(value: string) {
    this.attributes.email = value
  }

  set password(value: string) {
    this.attributes.password = value
  }

  set github_id(value: string) {
    this.attributes.github_id = value
  }

  set updated_at(value: string) {
    this.attributes.updated_at = value
  }

  static select(params: (keyof UserJsonResponse)[] | RawBuilder<string> | string): UserModel {
    const instance = new UserModel(undefined)

    return instance.applySelect(params)
  }

  // Method to find a User by ID
  static async find(id: number): Promise<UserModel | undefined> {
    const query = DB.instance.selectFrom('users').where('id', '=', id).selectAll()

    const model = await query.executeTakeFirst()

    if (!model)
      return undefined

    const instance = new UserModel(undefined)
    return instance.createInstance(model)
  }

  static async first(): Promise<UserModel | undefined> {
    const instance = new UserModel(undefined)

    const model = await instance.applyFirst()

    const data = new UserModel(model)

    return data
  }

  static async last(): Promise<UserModel | undefined> {
    const instance = new UserModel(undefined)

    const model = await instance.applyLast()

    if (!model)
      return undefined

    return new UserModel(model)
  }

  static async firstOrFail(): Promise<UserModel | undefined> {
    const instance = new UserModel(undefined)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<UserModel[]> {
    const instance = new UserModel(undefined)

    const models = await DB.instance.selectFrom('users').selectAll().execute()

    instance.mapCustomGetters(models)

    const data = await Promise.all(models.map(async (model: UserJsonResponse) => {
      return new UserModel(model)
    }))

    return data
  }

  static async findOrFail(id: number): Promise<UserModel | undefined> {
    const instance = new UserModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  static async findMany(ids: number[]): Promise<UserModel[]> {
    const instance = new UserModel(undefined)

    const models = await instance.applyFindMany(ids)

    return models.map((modelItem: UserJsonResponse) => instance.parseResult(new UserModel(modelItem)))
  }

  static async latest(column: keyof UsersTable = 'created_at'): Promise<UserModel | undefined> {
    const instance = new UserModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'desc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new UserModel(model)
  }

  static async oldest(column: keyof UsersTable = 'created_at'): Promise<UserModel | undefined> {
    const instance = new UserModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'asc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new UserModel(model)
  }

  static skip(count: number): UserModel {
    const instance = new UserModel(undefined)

    return instance.applySkip(count)
  }

  static take(count: number): UserModel {
    const instance = new UserModel(undefined)

    return instance.applyTake(count)
  }

  static where<V = string>(column: keyof UsersTable, ...args: [V] | [Operator, V]): UserModel {
    const instance = new UserModel(undefined)

    return instance.applyWhere<V>(column, ...args)
  }

  static orWhere(...conditions: [string, any][]): UserModel {
    const instance = new UserModel(undefined)

    return instance.applyOrWhere(...conditions)
  }

  static whereNotIn<V = number>(column: keyof UsersTable, values: V[]): UserModel {
    const instance = new UserModel(undefined)

    return instance.applyWhereNotIn<V>(column, values)
  }

  static whereBetween<V = number>(column: keyof UsersTable, range: [V, V]): UserModel {
    const instance = new UserModel(undefined)

    return instance.applyWhereBetween<V>(column, range)
  }

  static whereRef(column: keyof UsersTable, ...args: string[]): UserModel {
    const instance = new UserModel(undefined)

    return instance.applyWhereRef(column, ...args)
  }

  static when(condition: boolean, callback: (query: UserModel) => UserModel): UserModel {
    const instance = new UserModel(undefined)

    return instance.applyWhen(condition, callback as any)
  }

  static whereNull(column: keyof UsersTable): UserModel {
    const instance = new UserModel(undefined)

    return instance.applyWhereNull(column)
  }

  static whereNotNull(column: keyof UsersTable): UserModel {
    const instance = new UserModel(undefined)

    return instance.applyWhereNotNull(column)
  }

  static whereLike(column: keyof UsersTable, value: string): UserModel {
    const instance = new UserModel(undefined)

    return instance.applyWhereLike(column, value)
  }

  static orderBy(column: keyof UsersTable, order: 'asc' | 'desc'): UserModel {
    const instance = new UserModel(undefined)

    return instance.applyOrderBy(column, order)
  }

  static orderByAsc(column: keyof UsersTable): UserModel {
    const instance = new UserModel(undefined)

    return instance.applyOrderByAsc(column)
  }

  static orderByDesc(column: keyof UsersTable): UserModel {
    const instance = new UserModel(undefined)

    return instance.applyOrderByDesc(column)
  }

  static groupBy(column: keyof UsersTable): UserModel {
    const instance = new UserModel(undefined)

    return instance.applyGroupBy(column)
  }

  static having<V = string>(column: keyof UsersTable, operator: Operator, value: V): UserModel {
    const instance = new UserModel(undefined)

    return instance.applyHaving<V>(column, operator, value)
  }

  static inRandomOrder(): UserModel {
    const instance = new UserModel(undefined)

    return instance.applyInRandomOrder()
  }

  static whereColumn(first: keyof UsersTable, operator: Operator, second: keyof UsersTable): UserModel {
    const instance = new UserModel(undefined)

    return instance.applyWhereColumn(first, operator, second)
  }

  static async max(field: keyof UsersTable): Promise<number> {
    const instance = new UserModel(undefined)

    return await instance.applyMax(field)
  }

  static async min(field: keyof UsersTable): Promise<number> {
    const instance = new UserModel(undefined)

    return await instance.applyMin(field)
  }

  static async avg(field: keyof UsersTable): Promise<number> {
    const instance = new UserModel(undefined)

    return await instance.applyAvg(field)
  }

  static async sum(field: keyof UsersTable): Promise<number> {
    const instance = new UserModel(undefined)

    return await instance.applySum(field)
  }

  static async count(): Promise<number> {
    const instance = new UserModel(undefined)

    return instance.applyCount()
  }

  static async get(): Promise<UserModel[]> {
    const instance = new UserModel(undefined)

    const results = await instance.applyGet()

    return results.map((item: UserJsonResponse) => instance.createInstance(item))
  }

  static async pluck<K extends keyof UserModel>(field: K): Promise<UserModel[K][]> {
    const instance = new UserModel(undefined)

    return await instance.applyPluck(field)
  }

  static async chunk(size: number, callback: (models: UserModel[]) => Promise<void>): Promise<void> {
    const instance = new UserModel(undefined)

    await instance.applyChunk(size, async (models) => {
      const modelInstances = models.map((item: UserJsonResponse) => instance.createInstance(item))
      await callback(modelInstances)
    })
  }

  static async paginate(options: { limit?: number, offset?: number, page?: number } = { limit: 10, offset: 0, page: 1 }): Promise<{
    data: UserModel[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }> {
    const instance = new UserModel(undefined)

    const result = await instance.applyPaginate(options)

    return {
      data: result.data.map((item: UserJsonResponse) => instance.createInstance(item)),
      paging: result.paging,
      next_cursor: result.next_cursor,
    }
  }

  // Instance method for creating model instances
  createInstance(data: UserJsonResponse): UserModel {
    return new UserModel(data)
  }

  async applyCreate(newUser: NewUser): Promise<UserModel> {
    const filteredValues = Object.fromEntries(
      Object.entries(newUser).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewUser

    await this.mapCustomSetters(filteredValues)

    filteredValues.uuid = randomUUIDv7()

    const result = await DB.instance.insertInto('users')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await DB.instance.selectFrom('users')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created User')
    }

    return this.createInstance(model)
  }

  async create(newUser: NewUser): Promise<UserModel> {
    return await this.applyCreate(newUser)
  }

  static async create(newUser: NewUser): Promise<UserModel> {
    const instance = new UserModel(undefined)
    return await instance.applyCreate(newUser)
  }

  static async firstOrCreate(search: Partial<UsersTable>, values: NewUser = {} as NewUser): Promise<UserModel> {
    // First try to find a record matching the search criteria
    const instance = new UserModel(undefined)

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
    const createData = { ...search, ...values } as NewUser
    return await UserModel.create(createData)
  }

  static async updateOrCreate(search: Partial<UsersTable>, values: NewUser = {} as NewUser): Promise<UserModel> {
    // First try to find a record matching the search criteria
    const instance = new UserModel(undefined)

    // Apply all search conditions
    for (const [key, value] of Object.entries(search)) {
      instance.selectFromQuery = instance.selectFromQuery.where(key, '=', value)
    }

    // Try to find the record
    const existingRecord = await instance.applyFirst()

    if (existingRecord) {
      // If record exists, update it with the new values
      const model = instance.createInstance(existingRecord)
      const updatedModel = await model.update(values as UserUpdate)

      // Return the updated model instance
      if (updatedModel) {
        return updatedModel
      }

      // If update didn't return a model, fetch it again to ensure we have latest data
      const refreshedModel = await instance.applyFirst()
      return instance.createInstance(refreshedModel!)
    }

    // If no record exists, create a new one with combined search criteria and values
    const createData = { ...search, ...values } as NewUser
    return await UserModel.create(createData)
  }

  async update(newUser: UserUpdate): Promise<UserModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newUser).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as UserUpdate

    await this.mapCustomSetters(filteredValues)

    filteredValues.updated_at = new Date().toISOString()

    await DB.instance.updateTable('users')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('users')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated User')
      }

      return this.createInstance(model)
    }

    return undefined
  }

  async forceUpdate(newUser: UserUpdate): Promise<UserModel | undefined> {
    await DB.instance.updateTable('users')
      .set(newUser)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('users')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated User')
      }

      return this.createInstance(model)
    }

    return undefined
  }

  async save(): Promise<UserModel> {
    // If the model has an ID, update it; otherwise, create a new record
    if (this.id) {
      // Update existing record
      await DB.instance.updateTable('users')
        .set(this.attributes as UserUpdate)
        .where('id', '=', this.id)
        .executeTakeFirst()

      // Get the updated data
      const model = await DB.instance.selectFrom('users')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated User')
      }

      return this.createInstance(model)
    }
    else {
      // Create new record
      const result = await DB.instance.insertInto('users')
        .values(this.attributes as NewUser)
        .executeTakeFirst()

      // Get the created data
      const model = await DB.instance.selectFrom('users')
        .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve created User')
      }

      return this.createInstance(model)
    }
  }

  static async createMany(newUser: NewUser[]): Promise<void> {
    const instance = new UserModel(undefined)

    const valuesFiltered = newUser.map((newUser: NewUser) => {
      const filteredValues = Object.fromEntries(
        Object.entries(newUser).filter(([key]) =>
          !instance.guarded.includes(key) && instance.fillable.includes(key),
        ),
      ) as NewUser

      filteredValues.uuid = randomUUIDv7()

      return filteredValues
    })

    await DB.instance.insertInto('users')
      .values(valuesFiltered)
      .executeTakeFirst()
  }

  static async forceCreate(newUser: NewUser): Promise<UserModel> {
    const result = await DB.instance.insertInto('users')
      .values(newUser)
      .executeTakeFirst()

    const instance = new UserModel(undefined)
    const model = await DB.instance.selectFrom('users')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created User')
    }

    return instance.createInstance(model)
  }

  // Method to remove a User
  async delete(): Promise<number> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()

    const deleted = await DB.instance.deleteFrom('users')
      .where('id', '=', this.id)
      .execute()

    return deleted.numDeletedRows
  }

  static async remove(id: number): Promise<any> {
    return await DB.instance.deleteFrom('users')
      .where('id', '=', id)
      .execute()
  }

  static whereName(value: string): UserModel {
    const instance = new UserModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('name', '=', value)

    return instance
  }

  static whereEmail(value: string): UserModel {
    const instance = new UserModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('email', '=', value)

    return instance
  }

  static wherePassword(value: string): UserModel {
    const instance = new UserModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('password', '=', value)

    return instance
  }

  static whereIn<V = number>(column: keyof UsersTable, values: V[]): UserModel {
    const instance = new UserModel(undefined)

    return instance.applyWhereIn<V>(column, values)
  }

  async userTeams() {
    if (this.id === undefined)
      throw new HttpError(500, 'Relation Error!')

    const results = await DB.instance.selectFrom('teams')
      .where('team_id', '=', this.id)
      .selectAll()
      .execute()

    const tableRelationIds = results.map((result: { team_id: number }) => result.team_id)

    if (!tableRelationIds.length)
      throw new HttpError(500, 'Relation Error!')

    const relationResults = await Team.whereIn('id', tableRelationIds).get()

    return relationResults
  }

  toSearchableObject(): Partial<UserJsonResponse> {
    return {
      id: this.id,
      name: this.name,
      email: this.email,
    }
  }

  static distinct(column: keyof UserJsonResponse): UserModel {
    const instance = new UserModel(undefined)

    return instance.applyDistinct(column)
  }

  static join(table: string, firstCol: string, secondCol: string): UserModel {
    const instance = new UserModel(undefined)

    return instance.applyJoin(table, firstCol, secondCol)
  }

  toJSON(): UserJsonResponse {
    const output = {

      uuid: this.uuid,

      id: this.id,
      name: this.name,
      email: this.email,

      created_at: this.created_at,

      updated_at: this.updated_at,

      personal_access_tokens: this.personal_access_tokens,
      oauth_access_tokens: this.oauth_access_tokens,
      customers: this.customers,
      ...this.customColumns,
      github_id: this.github_id,
      public_passkey: this.public_passkey,
    }

    return output
  }

  parseResult(model: UserModel): UserModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof UserModel]
    }

    return model
  }

  // Add a protected applyFind implementation
  protected async applyFind(id: number): Promise<UserModel | undefined> {
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

export async function find(id: number): Promise<UserModel | undefined> {
  const query = DB.instance.selectFrom('users').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  const instance = new UserModel(undefined)
  return instance.createInstance(model)
}

export async function count(): Promise<number> {
  const results = await UserModel.count()

  return results
}

export async function create(newUser: NewUser): Promise<UserModel> {
  const instance = new UserModel(undefined)
  return await instance.applyCreate(newUser)
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(DB.instance)
}

export async function remove(id: number): Promise<void> {
  await DB.instance.deleteFrom('users')
    .where('id', '=', id)
    .execute()
}

export async function whereName(value: string): Promise<UserModel[]> {
  const query = DB.instance.selectFrom('users').where('name', '=', value)
  const results: UserJsonResponse = await query.execute()

  return results.map((modelItem: UserJsonResponse) => new UserModel(modelItem))
}

export async function whereEmail(value: string): Promise<UserModel[]> {
  const query = DB.instance.selectFrom('users').where('email', '=', value)
  const results: UserJsonResponse = await query.execute()

  return results.map((modelItem: UserJsonResponse) => new UserModel(modelItem))
}

export async function wherePassword(value: string): Promise<UserModel[]> {
  const query = DB.instance.selectFrom('users').where('password', '=', value)
  const results: UserJsonResponse = await query.execute()

  return results.map((modelItem: UserJsonResponse) => new UserModel(modelItem))
}

export const User = UserModel

export default User
