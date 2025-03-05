import type { Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import type { TeamModel } from './Team'
import type { UserModel } from './User'
import { cache } from '@stacksjs/cache'
import { sql } from '@stacksjs/database'
import { HttpError, ModelNotFoundException } from '@stacksjs/error-handling'

import { DB, SubqueryBuilder } from '@stacksjs/orm'

import Team from './Team'

import User from './User'

export interface PersonalAccessTokensTable {
  id?: number
  team_id?: number
  team?: TeamModel
  user_id?: number
  user?: UserModel
  name?: string
  token?: string
  plain_text_token?: string
  abilities?: string[]
  last_used_at?: Date | string
  expires_at?: Date | string
  revoked_at?: Date | string
  ip_address?: string
  device_name?: string
  is_single_use?: boolean

  created_at?: Date

  updated_at?: Date

}

interface AccessTokenResponse {
  data: AccessTokenJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface AccessTokenJsonResponse extends Omit<PersonalAccessTokensTable, 'password'> {
  [key: string]: any
}

export type AccessTokenType = Selectable<PersonalAccessTokensTable>
export type NewAccessToken = Partial<Insertable<PersonalAccessTokensTable>>
export type AccessTokenUpdate = Updateable<PersonalAccessTokensTable>

      type SortDirection = 'asc' | 'desc'
interface SortOptions { column: AccessTokenType, order: SortDirection }
// Define a type for the options parameter
interface QueryOptions {
  sort?: SortOptions
  limit?: number
  offset?: number
  page?: number
}

export class AccessTokenModel {
  private readonly hidden: Array<keyof AccessTokenJsonResponse> = []
  private readonly fillable: Array<keyof AccessTokenJsonResponse> = ['name', 'token', 'plain_text_token', 'abilities', 'last_used_at', 'expires_at', 'revoked_at', 'ip_address', 'device_name', 'is_single_use', 'uuid', 'team_id']
  private readonly guarded: Array<keyof AccessTokenJsonResponse> = []
  protected attributes: Partial<AccessTokenJsonResponse> = {}
  protected originalAttributes: Partial<AccessTokenJsonResponse> = {}

  protected selectFromQuery: any
  protected withRelations: string[]
  protected updateFromQuery: any
  protected deleteFromQuery: any
  protected hasSelect: boolean
  private hasSaved: boolean
  private customColumns: Record<string, unknown> = {}

  constructor(accesstoken: Partial<AccessTokenType> | null) {
    if (accesstoken) {
      this.attributes = { ...accesstoken }
      this.originalAttributes = { ...accesstoken }

      Object.keys(accesstoken).forEach((key) => {
        if (!(key in this)) {
          this.customColumns[key] = (accesstoken as AccessTokenJsonResponse)[key]
        }
      })
    }

    this.withRelations = []
    this.selectFromQuery = DB.instance.selectFrom('personal_access_tokens')
    this.updateFromQuery = DB.instance.updateTable('personal_access_tokens')
    this.deleteFromQuery = DB.instance.deleteFrom('personal_access_tokens')
    this.hasSelect = false
    this.hasSaved = false
  }

  mapCustomGetters(models: AccessTokenJsonResponse | AccessTokenJsonResponse[]): void {
    const data = models

    if (Array.isArray(data)) {
      data.map((model: AccessTokenJsonResponse) => {
        const customGetter = {
          default: () => {
          },

        }

        for (const [key, fn] of Object.entries(customGetter)) {
          model[key] = fn()
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
        model[key] = fn()
      }
    }
  }

  async mapCustomSetters(model: AccessTokenJsonResponse): Promise<void> {
    const customSetter = {
      default: () => {
      },

    }

    for (const [key, fn] of Object.entries(customSetter)) {
      model[key] = await fn()
    }
  }

  get team_id(): number | undefined {
    return this.attributes.team_id
  }

  get team(): TeamModel | undefined {
    return this.attributes.team
  }

  get user_id(): number | undefined {
    return this.attributes.user_id
  }

  get user(): UserModel | undefined {
    return this.attributes.user
  }

  get id(): number | undefined {
    return this.attributes.id
  }

  get name(): string | undefined {
    return this.attributes.name
  }

  get token(): string | undefined {
    return this.attributes.token
  }

  get plain_text_token(): string | undefined {
    return this.attributes.plain_text_token
  }

  get abilities(): string[] | undefined {
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

  get is_single_use(): boolean | undefined {
    return this.attributes.is_single_use
  }

  get created_at(): Date | undefined {
    return this.attributes.created_at
  }

  get updated_at(): Date | undefined {
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

  set abilities(value: string[]) {
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

  set updated_at(value: Date) {
    this.attributes.updated_at = value
  }

  getOriginal(column?: keyof AccessTokenJsonResponse): Partial<AccessTokenJsonResponse> {
    if (column) {
      return this.originalAttributes[column]
    }

    return this.originalAttributes
  }

  getChanges(): Partial<AccessTokenJsonResponse> {
    return this.fillable.reduce<Partial<AccessTokenJsonResponse>>((changes, key) => {
      const currentValue = this.attributes[key as keyof PersonalAccessTokensTable]
      const originalValue = this.originalAttributes[key as keyof PersonalAccessTokensTable]

      if (currentValue !== originalValue) {
        changes[key] = currentValue
      }

      return changes
    }, {})
  }

  isDirty(column?: keyof AccessTokenType): boolean {
    if (column) {
      return this.attributes[column] !== this.originalAttributes[column]
    }

    return Object.entries(this.originalAttributes).some(([key, originalValue]) => {
      const currentValue = (this.attributes as any)[key]

      return currentValue !== originalValue
    })
  }

  isClean(column?: keyof AccessTokenType): boolean {
    return !this.isDirty(column)
  }

  wasChanged(column?: keyof AccessTokenType): boolean {
    return this.hasSaved && this.isDirty(column)
  }

  select(params: (keyof AccessTokenType)[] | RawBuilder<string> | string): AccessTokenModel {
    this.selectFromQuery = this.selectFromQuery.select(params)

    this.hasSelect = true

    return this
  }

  static select(params: (keyof AccessTokenType)[] | RawBuilder<string> | string): AccessTokenModel {
    const instance = new AccessTokenModel(null)

    // Initialize a query with the table name and selected fields
    instance.selectFromQuery = instance.selectFromQuery.select(params)

    instance.hasSelect = true

    return instance
  }

  async applyFind(id: number): Promise<AccessTokenModel | undefined> {
    const model = await DB.instance.selectFrom('personal_access_tokens').where('id', '=', id).selectAll().executeTakeFirst()

    if (!model)
      return undefined

    this.mapCustomGetters(model)
    await this.loadRelations(model)

    const data = new AccessTokenModel(model as AccessTokenType)

    cache.getOrSet(`accesstoken:${id}`, JSON.stringify(model))

    return data
  }

  async find(id: number): Promise<AccessTokenModel | undefined> {
    return await this.applyFind(id)
  }

  // Method to find a AccessToken by ID
  static async find(id: number): Promise<AccessTokenModel | undefined> {
    const instance = new AccessTokenModel(null)

    return await instance.applyFind(id)
  }

  async first(): Promise<AccessTokenModel | undefined> {
    let model: AccessTokenModel | undefined

    if (this.hasSelect) {
      model = await this.selectFromQuery.executeTakeFirst()
    }
    else {
      model = await this.selectFromQuery.selectAll().executeTakeFirst()
    }

    if (model) {
      this.mapCustomGetters(model)
      await this.loadRelations(model)
    }

    const data = new AccessTokenModel(model as AccessTokenType)

    return data
  }

  static async first(): Promise<AccessTokenModel | undefined> {
    const instance = new AccessTokenModel(null)

    const model = await DB.instance.selectFrom('personal_access_tokens')
      .selectAll()
      .executeTakeFirst()

    instance.mapCustomGetters(model)

    const data = new AccessTokenModel(model as AccessTokenType)

    return data
  }

  async applyFirstOrFail(): Promise<AccessTokenModel | undefined> {
    const model = await this.selectFromQuery.executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, 'No AccessTokenModel results found for query')

    if (model) {
      this.mapCustomGetters(model)
      await this.loadRelations(model)
    }

    const data = new AccessTokenModel(model as AccessTokenType)

    return data
  }

  async firstOrFail(): Promise<AccessTokenModel | undefined> {
    return await this.applyFirstOrFail()
  }

  static async firstOrFail(): Promise<AccessTokenModel | undefined> {
    const instance = new AccessTokenModel(null)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<AccessTokenModel[]> {
    const instance = new AccessTokenModel(null)

    const models = await DB.instance.selectFrom('personal_access_tokens').selectAll().execute()

    instance.mapCustomGetters(models)

    const data = await Promise.all(models.map(async (model: AccessTokenType) => {
      return new AccessTokenModel(model)
    }))

    return data
  }

  async applyFindOrFail(id: number): Promise<AccessTokenModel> {
    const model = await DB.instance.selectFrom('personal_access_tokens').where('id', '=', id).selectAll().executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, `No AccessTokenModel results for ${id}`)

    cache.getOrSet(`accesstoken:${id}`, JSON.stringify(model))

    this.mapCustomGetters(model)
    await this.loadRelations(model)

    const data = new AccessTokenModel(model as AccessTokenType)

    return data
  }

  async findOrFail(id: number): Promise<AccessTokenModel> {
    return await this.applyFindOrFail(id)
  }

  static async findOrFail(id: number): Promise<AccessTokenModel> {
    const instance = new AccessTokenModel(null)

    return await instance.applyFindOrFail(id)
  }

  async applyFindMany(ids: number[]): Promise<AccessTokenModel[]> {
    let query = DB.instance.selectFrom('personal_access_tokens').where('id', 'in', ids)

    const instance = new AccessTokenModel(null)

    query = query.selectAll()

    const models = await query.execute()

    instance.mapCustomGetters(models)
    await instance.loadRelations(models)

    return models.map((modelItem: AccessTokenModel) => instance.parseResult(new AccessTokenModel(modelItem)))
  }

  static async findMany(ids: number[]): Promise<AccessTokenModel[]> {
    const instance = new AccessTokenModel(null)

    return await instance.applyFindMany(ids)
  }

  async findMany(ids: number[]): Promise<AccessTokenModel[]> {
    return await this.applyFindMany(ids)
  }

  skip(count: number): AccessTokenModel {
    this.selectFromQuery = this.selectFromQuery.offset(count)

    return this
  }

  static skip(count: number): AccessTokenModel {
    const instance = new AccessTokenModel(null)

    instance.selectFromQuery = instance.selectFromQuery.offset(count)

    return instance
  }

  async applyChunk(size: number, callback: (models: AccessTokenModel[]) => Promise<void>): Promise<void> {
    let page = 1
    let hasMore = true

    while (hasMore) {
      // Get one batch
      const models = await this.selectFromQuery
        .selectAll()
        .limit(size)
        .offset((page - 1) * size)
        .execute()

      // If we got fewer results than chunk size, this is the last batch
      if (models.length < size) {
        hasMore = false
      }

      // Process this batch
      if (models.length > 0) {
        await callback(models)
      }

      page++
    }
  }

  async chunk(size: number, callback: (models: AccessTokenModel[]) => Promise<void>): Promise<void> {
    await this.applyChunk(size, callback)
  }

  static async chunk(size: number, callback: (models: AccessTokenModel[]) => Promise<void>): Promise<void> {
    const instance = new AccessTokenModel(null)

    await instance.applyChunk(size, callback)
  }

  take(count: number): AccessTokenModel {
    this.selectFromQuery = this.selectFromQuery.limit(count)

    return this
  }

  static take(count: number): AccessTokenModel {
    const instance = new AccessTokenModel(null)

    instance.selectFromQuery = instance.selectFromQuery.limit(count)

    return instance
  }

  static async pluck<K extends keyof AccessTokenModel>(field: K): Promise<AccessTokenModel[K][]> {
    const instance = new AccessTokenModel(null)

    if (instance.hasSelect) {
      const model = await instance.selectFromQuery.execute()
      return model.map((modelItem: AccessTokenModel) => modelItem[field])
    }

    const model = await instance.selectFromQuery.selectAll().execute()

    return model.map((modelItem: AccessTokenModel) => modelItem[field])
  }

  async pluck<K extends keyof AccessTokenModel>(field: K): Promise<AccessTokenModel[K][]> {
    if (this.hasSelect) {
      const model = await this.selectFromQuery.execute()
      return model.map((modelItem: AccessTokenModel) => modelItem[field])
    }

    const model = await this.selectFromQuery.selectAll().execute()

    return model.map((modelItem: AccessTokenModel) => modelItem[field])
  }

  static async count(): Promise<number> {
    const instance = new AccessTokenModel(null)

    const result = await instance.selectFromQuery
      .select(sql`COUNT(*) as count`)
      .executeTakeFirst()

    return result.count || 0
  }

  async count(): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`COUNT(*) as count`)
      .executeTakeFirst()

    return result.count || 0
  }

  static async max(field: keyof AccessTokenModel): Promise<number> {
    const instance = new AccessTokenModel(null)

    const result = await instance.selectFromQuery
      .select(sql`MAX(${sql.raw(field as string)}) as max `)
      .executeTakeFirst()

    return result.max
  }

  async max(field: keyof AccessTokenModel): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`MAX(${sql.raw(field as string)}) as max`)
      .executeTakeFirst()

    return result.max
  }

  static async min(field: keyof AccessTokenModel): Promise<number> {
    const instance = new AccessTokenModel(null)

    const result = await instance.selectFromQuery
      .select(sql`MIN(${sql.raw(field as string)}) as min `)
      .executeTakeFirst()

    return result.min
  }

  async min(field: keyof AccessTokenModel): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`MIN(${sql.raw(field as string)}) as min `)
      .executeTakeFirst()

    return result.min
  }

  static async avg(field: keyof AccessTokenModel): Promise<number> {
    const instance = new AccessTokenModel(null)

    const result = await instance.selectFromQuery
      .select(sql`AVG(${sql.raw(field as string)}) as avg `)
      .executeTakeFirst()

    return result.avg
  }

  async avg(field: keyof AccessTokenModel): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`AVG(${sql.raw(field as string)}) as avg `)
      .executeTakeFirst()

    return result.avg
  }

  static async sum(field: keyof AccessTokenModel): Promise<number> {
    const instance = new AccessTokenModel(null)

    const result = await instance.selectFromQuery
      .select(sql`SUM(${sql.raw(field as string)}) as sum `)
      .executeTakeFirst()

    return result.sum
  }

  async sum(field: keyof AccessTokenModel): Promise<number> {
    const result = this.selectFromQuery
      .select(sql`SUM(${sql.raw(field as string)}) as sum `)
      .executeTakeFirst()

    return result.sum
  }

  async applyGet(): Promise<AccessTokenModel[]> {
    let models

    if (this.hasSelect) {
      models = await this.selectFromQuery.execute()
    }
    else {
      models = await this.selectFromQuery.selectAll().execute()
    }

    this.mapCustomGetters(models)
    await this.loadRelations(models)

    const data = await Promise.all(models.map(async (model: AccessTokenModel) => {
      return new AccessTokenModel(model)
    }))

    return data
  }

  async get(): Promise<AccessTokenModel[]> {
    return await this.applyGet()
  }

  static async get(): Promise<AccessTokenModel[]> {
    const instance = new AccessTokenModel(null)

    return await instance.applyGet()
  }

  has(relation: string): AccessTokenModel {
    this.selectFromQuery = this.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(
        selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.accesstoken_id`, '=', 'personal_access_tokens.id'),
      ),
    )

    return this
  }

  static has(relation: string): AccessTokenModel {
    const instance = new AccessTokenModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(
        selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.accesstoken_id`, '=', 'personal_access_tokens.id'),
      ),
    )

    return instance
  }

  static whereExists(callback: (qb: any) => any): AccessTokenModel {
    const instance = new AccessTokenModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(callback({ exists, selectFrom })),
    )

    return instance
  }

  applyWhereHas(
    relation: string,
    callback: (query: SubqueryBuilder<keyof AccessTokenModel>) => void,
  ): AccessTokenModel {
    const subqueryBuilder = new SubqueryBuilder()

    callback(subqueryBuilder)
    const conditions = subqueryBuilder.getConditions()

    this.selectFromQuery = this.selectFromQuery
      .where(({ exists, selectFrom }: any) => {
        let subquery = selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.accesstoken_id`, '=', 'personal_access_tokens.id')

        conditions.forEach((condition) => {
          switch (condition.method) {
            case 'where':
              if (condition.type === 'and') {
                subquery = subquery.where(condition.column, condition.operator!, condition.value)
              }
              else {
                subquery = subquery.orWhere(condition.column, condition.operator!, condition.value)
              }
              break

            case 'whereIn':
              if (condition.operator === 'is not') {
                subquery = subquery.whereNotIn(condition.column, condition.values)
              }
              else {
                subquery = subquery.whereIn(condition.column, condition.values)
              }

              break

            case 'whereNull':
              subquery = subquery.whereNull(condition.column)
              break

            case 'whereNotNull':
              subquery = subquery.whereNotNull(condition.column)
              break

            case 'whereBetween':
              subquery = subquery.whereBetween(condition.column, condition.values)
              break

            case 'whereExists': {
              const nestedBuilder = new SubqueryBuilder()
              condition.callback!(nestedBuilder)
              break
            }
          }
        })

        return exists(subquery)
      })

    return this
  }

  whereHas(
    relation: string,
    callback: (query: SubqueryBuilder<keyof AccessTokenModel>) => void,
  ): AccessTokenModel {
    return this.applyWhereHas(relation, callback)
  }

  static whereHas(
    relation: string,
    callback: (query: SubqueryBuilder<keyof AccessTokenModel>) => void,
  ): AccessTokenModel {
    const instance = new AccessTokenModel(null)

    return instance.applyWhereHas(relation, callback)
  }

  applyDoesntHave(relation: string): AccessTokenModel {
    this.selectFromQuery = this.selectFromQuery.where(({ not, exists, selectFrom }: any) =>
      not(
        exists(
          selectFrom(relation)
            .select('1')
            .whereRef(`${relation}.accesstoken_id`, '=', 'personal_access_tokens.id'),
        ),
      ),
    )

    return this
  }

  doesntHave(relation: string): AccessTokenModel {
    return this.applyDoesntHave(relation)
  }

  static doesntHave(relation: string): AccessTokenModel {
    const instance = new AccessTokenModel(null)

    return instance.applyDoesntHave(relation)
  }

  applyWhereDoesntHave(relation: string, callback: (query: SubqueryBuilder<PersonalAccessTokensTable>) => void): AccessTokenModel {
    const subqueryBuilder = new SubqueryBuilder()

    callback(subqueryBuilder)
    const conditions = subqueryBuilder.getConditions()

    this.selectFromQuery = this.selectFromQuery
      .where(({ exists, selectFrom, not }: any) => {
        const subquery = selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.accesstoken_id`, '=', 'personal_access_tokens.id')

        return not(exists(subquery))
      })

    conditions.forEach((condition) => {
      switch (condition.method) {
        case 'where':
          if (condition.type === 'and') {
            this.where(condition.column, condition.operator!, condition.value || [])
          }
          break

        case 'whereIn':
          if (condition.operator === 'is not') {
            this.whereNotIn(condition.column, condition.values || [])
          }
          else {
            this.whereIn(condition.column, condition.values || [])
          }

          break

        case 'whereNull':
          this.whereNull(condition.column)
          break

        case 'whereNotNull':
          this.whereNotNull(condition.column)
          break

        case 'whereBetween':
          this.whereBetween(condition.column, condition.range || [0, 0])
          break

        case 'whereExists': {
          const nestedBuilder = new SubqueryBuilder()
          condition.callback!(nestedBuilder)
          break
        }
      }
    })

    return this
  }

  whereDoesntHave(relation: string, callback: (query: SubqueryBuilder<PersonalAccessTokensTable>) => void): AccessTokenModel {
    return this.applyWhereDoesntHave(relation, callback)
  }

  static whereDoesntHave(
    relation: string,
    callback: (query: SubqueryBuilder<PersonalAccessTokensTable>) => void,
  ): AccessTokenModel {
    const instance = new AccessTokenModel(null)

    return instance.applyWhereDoesntHave(relation, callback)
  }

  async applyPaginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<AccessTokenResponse> {
    const totalRecordsResult = await DB.instance.selectFrom('personal_access_tokens')
      .select(DB.instance.fn.count('id').as('total')) // Use 'id' or another actual column name
      .executeTakeFirst()

    const totalRecords = Number(totalRecordsResult?.total) || 0
    const totalPages = Math.ceil(totalRecords / (options.limit ?? 10))

    const personal_access_tokensWithExtra = await DB.instance.selectFrom('personal_access_tokens')
      .selectAll()
      .orderBy('id', 'asc') // Assuming 'id' is used for cursor-based pagination
      .limit((options.limit ?? 10) + 1) // Fetch one extra record
      .offset(((options.page ?? 1) - 1) * (options.limit ?? 10)) // Ensure options.page is not undefined
      .execute()

    let nextCursor = null
    if (personal_access_tokensWithExtra.length > (options.limit ?? 10))
      nextCursor = personal_access_tokensWithExtra.pop()?.id ?? null

    return {
      data: personal_access_tokensWithExtra,
      paging: {
        total_records: totalRecords,
        page: options.page || 1,
        total_pages: totalPages,
      },
      next_cursor: nextCursor,
    }
  }

  async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<AccessTokenResponse> {
    return await this.applyPaginate(options)
  }

  // Method to get all personal_access_tokens
  static async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<AccessTokenResponse> {
    const instance = new AccessTokenModel(null)

    return await instance.applyPaginate(options)
  }

  async applyCreate(newAccessToken: NewAccessToken): Promise<AccessTokenModel> {
    const filteredValues = Object.fromEntries(
      Object.entries(newAccessToken).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewAccessToken

    await this.mapCustomSetters(filteredValues)

    const result = await DB.instance.insertInto('personal_access_tokens')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await this.find(Number(result.numInsertedOrUpdatedRows)) as AccessTokenModel

    return model
  }

  async create(newAccessToken: NewAccessToken): Promise<AccessTokenModel> {
    return await this.applyCreate(newAccessToken)
  }

  static async create(newAccessToken: NewAccessToken): Promise<AccessTokenModel> {
    const instance = new AccessTokenModel(null)

    return await instance.applyCreate(newAccessToken)
  }

  static async createMany(newAccessToken: NewAccessToken[]): Promise<void> {
    const instance = new AccessTokenModel(null)

    const valuesFiltered = newAccessToken.map((newAccessToken: NewAccessToken) => {
      const filteredValues = Object.fromEntries(
        Object.entries(newAccessToken).filter(([key]) =>
          !instance.guarded.includes(key) && instance.fillable.includes(key),
        ),
      ) as NewAccessToken

      return filteredValues
    })

    await DB.instance.insertInto('personal_access_tokens')
      .values(valuesFiltered)
      .executeTakeFirst()
  }

  static async forceCreate(newAccessToken: NewAccessToken): Promise<AccessTokenModel> {
    const result = await DB.instance.insertInto('personal_access_tokens')
      .values(newAccessToken)
      .executeTakeFirst()

    const model = await find(Number(result.numInsertedOrUpdatedRows)) as AccessTokenModel

    return model
  }

  // Method to remove a AccessToken
  static async remove(id: number): Promise<any> {
    return await DB.instance.deleteFrom('personal_access_tokens')
      .where('id', '=', id)
      .execute()
  }

  applyWhere<V>(column: keyof PersonalAccessTokensTable, ...args: [V] | [Operator, V]): AccessTokenModel {
    if (args.length === 1) {
      const [value] = args
      this.selectFromQuery = this.selectFromQuery.where(column, '=', value)
      this.updateFromQuery = this.updateFromQuery.where(column, '=', value)
      this.deleteFromQuery = this.deleteFromQuery.where(column, '=', value)
    }
    else {
      const [operator, value] = args as [Operator, V]
      this.selectFromQuery = this.selectFromQuery.where(column, operator, value)
      this.updateFromQuery = this.updateFromQuery.where(column, operator, value)
      this.deleteFromQuery = this.deleteFromQuery.where(column, operator, value)
    }

    return this
  }

  where<V = string>(column: keyof PersonalAccessTokensTable, ...args: [V] | [Operator, V]): AccessTokenModel {
    return this.applyWhere<V>(column, ...args)
  }

  static where<V = string>(column: keyof PersonalAccessTokensTable, ...args: [V] | [Operator, V]): AccessTokenModel {
    const instance = new AccessTokenModel(null)

    return instance.applyWhere<V>(column, ...args)
  }

  whereColumn(first: keyof PersonalAccessTokensTable, operator: Operator, second: keyof PersonalAccessTokensTable): AccessTokenModel {
    this.selectFromQuery = this.selectFromQuery.whereRef(first, operator, second)

    return this
  }

  static whereColumn(first: keyof PersonalAccessTokensTable, operator: Operator, second: keyof PersonalAccessTokensTable): AccessTokenModel {
    const instance = new AccessTokenModel(null)

    instance.selectFromQuery = instance.selectFromQuery.whereRef(first, operator, second)

    return instance
  }

  applyWhereRef(column: keyof PersonalAccessTokensTable, ...args: string[]): AccessTokenModel {
    const [operatorOrValue, value] = args
    const operator = value === undefined ? '=' : operatorOrValue
    const actualValue = value === undefined ? operatorOrValue : value

    const instance = new AccessTokenModel(null)
    instance.selectFromQuery = instance.selectFromQuery.whereRef(column, operator, actualValue)

    return instance
  }

  whereRef(column: keyof PersonalAccessTokensTable, ...args: string[]): AccessTokenModel {
    return this.applyWhereRef(column, ...args)
  }

  static whereRef(column: keyof PersonalAccessTokensTable, ...args: string[]): AccessTokenModel {
    const instance = new AccessTokenModel(null)

    return instance.applyWhereRef(column, ...args)
  }

  whereRaw(sqlStatement: string): AccessTokenModel {
    this.selectFromQuery = this.selectFromQuery.where(sql`${sqlStatement}`)

    return this
  }

  static whereRaw(sqlStatement: string): AccessTokenModel {
    const instance = new AccessTokenModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where(sql`${sqlStatement}`)

    return instance
  }

  applyOrWhere(...conditions: [string, any][]): AccessTokenModel {
    this.selectFromQuery = this.selectFromQuery.where((eb: any) => {
      return eb.or(
        conditions.map(([column, value]) => eb(column, '=', value)),
      )
    })

    this.updateFromQuery = this.updateFromQuery.where((eb: any) => {
      return eb.or(
        conditions.map(([column, value]) => eb(column, '=', value)),
      )
    })

    this.deleteFromQuery = this.deleteFromQuery.where((eb: any) => {
      return eb.or(
        conditions.map(([column, value]) => eb(column, '=', value)),
      )
    })

    return this
  }

  orWhere(...conditions: [string, any][]): AccessTokenModel {
    return this.applyOrWhere(...conditions)
  }

  static orWhere(...conditions: [string, any][]): AccessTokenModel {
    const instance = new AccessTokenModel(null)

    return instance.applyOrWhere(...conditions)
  }

  when(
    condition: boolean,
    callback: (query: AccessTokenModel) => AccessTokenModel,
  ): AccessTokenModel {
    return AccessTokenModel.when(condition, callback)
  }

  static when(
    condition: boolean,
    callback: (query: AccessTokenModel) => AccessTokenModel,
  ): AccessTokenModel {
    let instance = new AccessTokenModel(null)

    if (condition)
      instance = callback(instance)

    return instance
  }

  whereNotNull(column: keyof PersonalAccessTokensTable): AccessTokenModel {
    this.selectFromQuery = this.selectFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is not', null),
    )

    this.updateFromQuery = this.updateFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is not', null),
    )

    this.deleteFromQuery = this.deleteFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is not', null),
    )

    return this
  }

  static whereNotNull(column: keyof PersonalAccessTokensTable): AccessTokenModel {
    const instance = new AccessTokenModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is not', null),
    )

    instance.updateFromQuery = instance.updateFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is not', null),
    )

    instance.deleteFromQuery = instance.deleteFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is not', null),
    )

    return instance
  }

  whereNull(column: keyof PersonalAccessTokensTable): AccessTokenModel {
    this.selectFromQuery = this.selectFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    this.updateFromQuery = this.updateFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    this.deleteFromQuery = this.deleteFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    return this
  }

  static whereNull(column: keyof PersonalAccessTokensTable): AccessTokenModel {
    const instance = new AccessTokenModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    instance.updateFromQuery = instance.updateFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    instance.deleteFromQuery = instance.deleteFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    return instance
  }

  static whereName(value: string): AccessTokenModel {
    const instance = new AccessTokenModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('name', '=', value)

    return instance
  }

  static whereToken(value: string): AccessTokenModel {
    const instance = new AccessTokenModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('token', '=', value)

    return instance
  }

  static wherePlainTextToken(value: string): AccessTokenModel {
    const instance = new AccessTokenModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('plainTextToken', '=', value)

    return instance
  }

  static whereAbilities(value: string): AccessTokenModel {
    const instance = new AccessTokenModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('abilities', '=', value)

    return instance
  }

  static whereLastUsedAt(value: string): AccessTokenModel {
    const instance = new AccessTokenModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('lastUsedAt', '=', value)

    return instance
  }

  static whereExpiresAt(value: string): AccessTokenModel {
    const instance = new AccessTokenModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('expiresAt', '=', value)

    return instance
  }

  static whereRevokedAt(value: string): AccessTokenModel {
    const instance = new AccessTokenModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('revokedAt', '=', value)

    return instance
  }

  static whereIpAddress(value: string): AccessTokenModel {
    const instance = new AccessTokenModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('ipAddress', '=', value)

    return instance
  }

  static whereDeviceName(value: string): AccessTokenModel {
    const instance = new AccessTokenModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('deviceName', '=', value)

    return instance
  }

  static whereIsSingleUse(value: string): AccessTokenModel {
    const instance = new AccessTokenModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('isSingleUse', '=', value)

    return instance
  }

  applyWhereIn<V>(column: keyof PersonalAccessTokensTable, values: V[]) {
    this.selectFromQuery = this.selectFromQuery.where(column, 'in', values)

    this.updateFromQuery = this.updateFromQuery.where(column, 'in', values)

    this.deleteFromQuery = this.deleteFromQuery.where(column, 'in', values)

    return this
  }

  whereIn<V = number>(column: keyof PersonalAccessTokensTable, values: V[]): AccessTokenModel {
    return this.applyWhereIn<V>(column, values)
  }

  static whereIn<V = number>(column: keyof PersonalAccessTokensTable, values: V[]): AccessTokenModel {
    const instance = new AccessTokenModel(null)

    return instance.applyWhereIn<V>(column, values)
  }

  applyWhereBetween<V>(column: keyof PersonalAccessTokensTable, range: [V, V]): AccessTokenModel {
    if (range.length !== 2) {
      throw new HttpError(500, 'Range must have exactly two values: [min, max]')
    }

    const query = sql` ${sql.raw(column as string)} between ${range[0]} and ${range[1]} `

    this.selectFromQuery = this.selectFromQuery.where(query)
    this.updateFromQuery = this.updateFromQuery.where(query)
    this.deleteFromQuery = this.deleteFromQuery.where(query)

    return this
  }

  whereBetween<V = number>(column: keyof PersonalAccessTokensTable, range: [V, V]): AccessTokenModel {
    return this.applyWhereBetween<V>(column, range)
  }

  static whereBetween<V = number>(column: keyof PersonalAccessTokensTable, range: [V, V]): AccessTokenModel {
    const instance = new AccessTokenModel(null)

    return instance.applyWhereBetween<V>(column, range)
  }

  applyWhereLike(column: keyof PersonalAccessTokensTable, value: string): AccessTokenModel {
    this.selectFromQuery = this.selectFromQuery.where(sql` ${sql.raw(column as string)} LIKE ${value}`)

    this.updateFromQuery = this.updateFromQuery.where(sql` ${sql.raw(column as string)} LIKE ${value}`)

    this.deleteFromQuery = this.deleteFromQuery.where(sql` ${sql.raw(column as string)} LIKE ${value}`)

    return this
  }

  whereLike(column: keyof PersonalAccessTokensTable, value: string): AccessTokenModel {
    return this.applyWhereLike(column, value)
  }

  static whereLike(column: keyof PersonalAccessTokensTable, value: string): AccessTokenModel {
    const instance = new AccessTokenModel(null)

    return instance.applyWhereLike(column, value)
  }

  applyWhereNotIn<V>(column: keyof PersonalAccessTokensTable, values: V[]): AccessTokenModel {
    this.selectFromQuery = this.selectFromQuery.where(column, 'not in', values)

    this.updateFromQuery = this.updateFromQuery.where(column, 'not in', values)

    this.deleteFromQuery = this.deleteFromQuery.where(column, 'not in', values)

    return this
  }

  whereNotIn<V>(column: keyof PersonalAccessTokensTable, values: V[]): AccessTokenModel {
    return this.applyWhereNotIn<V>(column, values)
  }

  static whereNotIn<V = number>(column: keyof PersonalAccessTokensTable, values: V[]): AccessTokenModel {
    const instance = new AccessTokenModel(null)

    return instance.applyWhereNotIn<V>(column, values)
  }

  async exists(): Promise<boolean> {
    let model

    if (this.hasSelect) {
      model = await this.selectFromQuery.executeTakeFirst()
    }
    else {
      model = await this.selectFromQuery.selectAll().executeTakeFirst()
    }

    return model !== null && model !== undefined
  }

  static async latest(): Promise<AccessTokenType | undefined> {
    const instance = new AccessTokenModel(null)

    const model = await DB.instance.selectFrom('personal_access_tokens')
      .selectAll()
      .orderBy('id', 'desc')
      .executeTakeFirst()

    if (!model)
      return undefined

    instance.mapCustomGetters(model)

    const data = new AccessTokenModel(model as AccessTokenType)

    return data
  }

  static async oldest(): Promise<AccessTokenType | undefined> {
    const instance = new AccessTokenModel(null)

    const model = await DB.instance.selectFrom('personal_access_tokens')
      .selectAll()
      .orderBy('id', 'asc')
      .executeTakeFirst()

    if (!model)
      return undefined

    instance.mapCustomGetters(model)

    const data = new AccessTokenModel(model as AccessTokenType)

    return data
  }

  static async firstOrCreate(
    condition: Partial<AccessTokenType>,
    newAccessToken: NewAccessToken,
  ): Promise<AccessTokenModel> {
    const instance = new AccessTokenModel(null)

    const key = Object.keys(condition)[0] as keyof AccessTokenType

    if (!key) {
      throw new HttpError(500, 'Condition must contain at least one key-value pair')
    }

    const value = condition[key]

    // Attempt to find the first record matching the condition
    const existingAccessToken = await DB.instance.selectFrom('personal_access_tokens')
      .selectAll()
      .where(key, '=', value)
      .executeTakeFirst()

    if (existingAccessToken) {
      instance.mapCustomGetters(existingAccessToken)
      await instance.loadRelations(existingAccessToken)

      return new AccessTokenModel(existingAccessToken as AccessTokenType)
    }
    else {
      return await instance.create(newAccessToken)
    }
  }

  static async updateOrCreate(
    condition: Partial<AccessTokenType>,
    newAccessToken: NewAccessToken,
  ): Promise<AccessTokenModel> {
    const instance = new AccessTokenModel(null)

    const key = Object.keys(condition)[0] as keyof AccessTokenType

    if (!key) {
      throw new HttpError(500, 'Condition must contain at least one key-value pair')
    }

    const value = condition[key]

    // Attempt to find the first record matching the condition
    const existingAccessToken = await DB.instance.selectFrom('personal_access_tokens')
      .selectAll()
      .where(key, '=', value)
      .executeTakeFirst()

    if (existingAccessToken) {
      // If found, update the existing record
      await DB.instance.updateTable('personal_access_tokens')
        .set(newAccessToken)
        .where(key, '=', value)
        .executeTakeFirstOrThrow()

      // Fetch and return the updated record
      const updatedAccessToken = await DB.instance.selectFrom('personal_access_tokens')
        .selectAll()
        .where(key, '=', value)
        .executeTakeFirst()

      if (!updatedAccessToken) {
        throw new HttpError(500, 'Failed to fetch updated record')
      }

      instance.hasSaved = true

      return new AccessTokenModel(updatedAccessToken as AccessTokenType)
    }
    else {
      // If not found, create a new record
      return await instance.create(newAccessToken)
    }
  }

  async loadRelations(models: AccessTokenJsonResponse | AccessTokenJsonResponse[]): Promise<void> {
    // Handle both single model and array of models
    const modelArray = Array.isArray(models) ? models : [models]
    if (!modelArray.length)
      return

    const modelIds = modelArray.map(model => model.id)

    for (const relation of this.withRelations) {
      const relatedRecords = await DB.instance
        .selectFrom(relation)
        .where('accesstoken_id', 'in', modelIds)
        .selectAll()
        .execute()

      if (Array.isArray(models)) {
        models.map((model: AccessTokenJsonResponse) => {
          const records = relatedRecords.filter((record: { accesstoken_id: number }) => {
            return record.accesstoken_id === model.id
          })

          model[relation] = records.length === 1 ? records[0] : records
          return model
        })
      }
      else {
        const records = relatedRecords.filter((record: { accesstoken_id: number }) => {
          return record.accesstoken_id === models.id
        })

        models[relation] = records.length === 1 ? records[0] : records
      }
    }
  }

  with(relations: string[]): AccessTokenModel {
    this.withRelations = relations

    return this
  }

  static with(relations: string[]): AccessTokenModel {
    const instance = new AccessTokenModel(null)

    instance.withRelations = relations

    return instance
  }

  async last(): Promise<AccessTokenType | undefined> {
    let model: AccessTokenModel | undefined

    if (this.hasSelect) {
      model = await this.selectFromQuery.executeTakeFirst()
    }
    else {
      model = await this.selectFromQuery.selectAll().orderBy('id', 'desc').executeTakeFirst()
    }

    if (model) {
      this.mapCustomGetters(model)
      await this.loadRelations(model)
    }

    const data = new AccessTokenModel(model as AccessTokenType)

    return data
  }

  static async last(): Promise<AccessTokenType | undefined> {
    const model = await DB.instance.selectFrom('personal_access_tokens').selectAll().orderBy('id', 'desc').executeTakeFirst()

    if (!model)
      return undefined

    const data = new AccessTokenModel(model as AccessTokenType)

    return data
  }

  orderBy(column: keyof PersonalAccessTokensTable, order: 'asc' | 'desc'): AccessTokenModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, order)

    return this
  }

  static orderBy(column: keyof PersonalAccessTokensTable, order: 'asc' | 'desc'): AccessTokenModel {
    const instance = new AccessTokenModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, order)

    return instance
  }

  groupBy(column: keyof PersonalAccessTokensTable): AccessTokenModel {
    this.selectFromQuery = this.selectFromQuery.groupBy(column)

    return this
  }

  static groupBy(column: keyof PersonalAccessTokensTable): AccessTokenModel {
    const instance = new AccessTokenModel(null)

    instance.selectFromQuery = instance.selectFromQuery.groupBy(column)

    return instance
  }

  having<V = string>(column: keyof PersonalAccessTokensTable, operator: Operator, value: V): AccessTokenModel {
    this.selectFromQuery = this.selectFromQuery.having(column, operator, value)

    return this
  }

  static having<V = string>(column: keyof PersonalAccessTokensTable, operator: Operator, value: V): AccessTokenModel {
    const instance = new AccessTokenModel(null)

    instance.selectFromQuery = instance.selectFromQuery.having(column, operator, value)

    return instance
  }

  inRandomOrder(): AccessTokenModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(sql` ${sql.raw('RANDOM()')} `)

    return this
  }

  static inRandomOrder(): AccessTokenModel {
    const instance = new AccessTokenModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(sql` ${sql.raw('RANDOM()')} `)

    return instance
  }

  orderByDesc(column: keyof PersonalAccessTokensTable): AccessTokenModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, 'desc')

    return this
  }

  static orderByDesc(column: keyof PersonalAccessTokensTable): AccessTokenModel {
    const instance = new AccessTokenModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, 'desc')

    return instance
  }

  orderByAsc(column: keyof PersonalAccessTokensTable): AccessTokenModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, 'asc')

    return this
  }

  static orderByAsc(column: keyof PersonalAccessTokensTable): AccessTokenModel {
    const instance = new AccessTokenModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, 'asc')

    return instance
  }

  async update(newAccessToken: AccessTokenUpdate): Promise<AccessTokenModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newAccessToken).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewAccessToken

    await this.mapCustomSetters(filteredValues)

    await DB.instance.updateTable('personal_access_tokens')
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

  async forceUpdate(accesstoken: AccessTokenUpdate): Promise<AccessTokenModel | undefined> {
    if (this.id === undefined) {
      this.updateFromQuery.set(accesstoken).execute()
    }

    await this.mapCustomSetters(accesstoken)

    await DB.instance.updateTable('personal_access_tokens')
      .set(accesstoken)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      const model = await this.find(this.id)

      this.hasSaved = true

      return model
    }

    return undefined
  }

  async save(): Promise<void> {
    if (!this)
      throw new HttpError(500, 'AccessToken data is undefined')

    await this.mapCustomSetters(this.attributes)

    if (this.id === undefined) {
      await this.create(this.attributes)
    }
    else {
      await this.update(this.attributes)
    }

    this.hasSaved = true
  }

  fill(data: Partial<AccessTokenType>): AccessTokenModel {
    const filteredValues = Object.fromEntries(
      Object.entries(data).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewAccessToken

    this.attributes = {
      ...this.attributes,
      ...filteredValues,
    }

    return this
  }

  forceFill(data: Partial<AccessTokenType>): AccessTokenModel {
    this.attributes = {
      ...this.attributes,
      ...data,
    }

    return this
  }

  // Method to delete (soft delete) the accesstoken instance
  async delete(): Promise<PersonalAccessTokensTable> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()

    return await DB.instance.deleteFrom('personal_access_tokens')
      .where('id', '=', this.id)
      .execute()
  }

  async teamBelong(): Promise<TeamModel> {
    if (this.team_id === undefined)
      throw new HttpError(500, 'Relation Error!')

    const model = await Team
      .where('id', '=', this.team_id)
      .first()

    if (!model)
      throw new HttpError(500, 'Model Relation Not Found!')

    return model
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

  distinct(column: keyof AccessTokenType): AccessTokenModel {
    this.selectFromQuery = this.selectFromQuery.select(column).distinct()

    this.hasSelect = true

    return this
  }

  static distinct(column: keyof AccessTokenType): AccessTokenModel {
    const instance = new AccessTokenModel(null)

    instance.selectFromQuery = instance.selectFromQuery.select(column).distinct()

    instance.hasSelect = true

    return instance
  }

  join(table: string, firstCol: string, secondCol: string): AccessTokenModel {
    this.selectFromQuery = this.selectFromQuery.innerJoin(table, firstCol, secondCol)

    return this
  }

  static join(table: string, firstCol: string, secondCol: string): AccessTokenModel {
    const instance = new AccessTokenModel(null)

    instance.selectFromQuery = instance.selectFromQuery.innerJoin(table, firstCol, secondCol)

    return instance
  }

  toJSON(): Partial<AccessTokenJsonResponse> {
    const output: Partial<AccessTokenJsonResponse> = {

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

      team_id: this.team_id,
      team: this.team,
      user_id: this.user_id,
      user: this.user,
      ...this.customColumns,
    }

    return output
  }

  parseResult(model: AccessTokenModel): AccessTokenModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof AccessTokenModel]
    }

    return model
  }
}

async function find(id: number): Promise<AccessTokenModel | undefined> {
  const query = DB.instance.selectFrom('personal_access_tokens').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  return new AccessTokenModel(model)
}

export async function count(): Promise<number> {
  const results = await AccessTokenModel.count()

  return results
}

export async function create(newAccessToken: NewAccessToken): Promise<AccessTokenModel> {
  const result = await DB.instance.insertInto('personal_access_tokens')
    .values(newAccessToken)
    .executeTakeFirstOrThrow()

  return await find(Number(result.numInsertedOrUpdatedRows)) as AccessTokenModel
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(DB.instance)
}

export async function remove(id: number): Promise<void> {
  await DB.instance.deleteFrom('personal_access_tokens')
    .where('id', '=', id)
    .execute()
}

export async function whereName(value: string): Promise<AccessTokenModel[]> {
  const query = DB.instance.selectFrom('personal_access_tokens').where('name', '=', value)
  const results = await query.execute()

  return results.map((modelItem: AccessTokenModel) => new AccessTokenModel(modelItem))
}

export async function whereToken(value: string): Promise<AccessTokenModel[]> {
  const query = DB.instance.selectFrom('personal_access_tokens').where('token', '=', value)
  const results = await query.execute()

  return results.map((modelItem: AccessTokenModel) => new AccessTokenModel(modelItem))
}

export async function wherePlainTextToken(value: string): Promise<AccessTokenModel[]> {
  const query = DB.instance.selectFrom('personal_access_tokens').where('plain_text_token', '=', value)
  const results = await query.execute()

  return results.map((modelItem: AccessTokenModel) => new AccessTokenModel(modelItem))
}

export async function whereAbilities(value: string[]): Promise<AccessTokenModel[]> {
  const query = DB.instance.selectFrom('personal_access_tokens').where('abilities', '=', value)
  const results = await query.execute()

  return results.map((modelItem: AccessTokenModel) => new AccessTokenModel(modelItem))
}

export async function whereLastUsedAt(value: Date | string): Promise<AccessTokenModel[]> {
  const query = DB.instance.selectFrom('personal_access_tokens').where('last_used_at', '=', value)
  const results = await query.execute()

  return results.map((modelItem: AccessTokenModel) => new AccessTokenModel(modelItem))
}

export async function whereExpiresAt(value: Date | string): Promise<AccessTokenModel[]> {
  const query = DB.instance.selectFrom('personal_access_tokens').where('expires_at', '=', value)
  const results = await query.execute()

  return results.map((modelItem: AccessTokenModel) => new AccessTokenModel(modelItem))
}

export async function whereRevokedAt(value: Date | string): Promise<AccessTokenModel[]> {
  const query = DB.instance.selectFrom('personal_access_tokens').where('revoked_at', '=', value)
  const results = await query.execute()

  return results.map((modelItem: AccessTokenModel) => new AccessTokenModel(modelItem))
}

export async function whereIpAddress(value: string): Promise<AccessTokenModel[]> {
  const query = DB.instance.selectFrom('personal_access_tokens').where('ip_address', '=', value)
  const results = await query.execute()

  return results.map((modelItem: AccessTokenModel) => new AccessTokenModel(modelItem))
}

export async function whereDeviceName(value: string): Promise<AccessTokenModel[]> {
  const query = DB.instance.selectFrom('personal_access_tokens').where('device_name', '=', value)
  const results = await query.execute()

  return results.map((modelItem: AccessTokenModel) => new AccessTokenModel(modelItem))
}

export async function whereIsSingleUse(value: boolean): Promise<AccessTokenModel[]> {
  const query = DB.instance.selectFrom('personal_access_tokens').where('is_single_use', '=', value)
  const results = await query.execute()

  return results.map((modelItem: AccessTokenModel) => new AccessTokenModel(modelItem))
}

export const AccessToken = AccessTokenModel

export default AccessToken
