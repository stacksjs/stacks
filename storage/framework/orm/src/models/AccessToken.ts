import type { Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { TeamModel } from './Team'
import { cache } from '@stacksjs/cache'
import { sql } from '@stacksjs/database'
import { HttpError, ModelNotFoundException } from '@stacksjs/error-handling'
import { dispatch } from '@stacksjs/events'
import { DB, SubqueryBuilder } from '@stacksjs/orm'

import Team from './Team'

export interface PersonalAccessTokensTable {
  id?: number
  team_id?: number
  team?: TeamModel
  name?: string
  token?: string
  plain_text_token?: string
  abilities?: string[]

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
  private readonly fillable: Array<keyof AccessTokenJsonResponse> = ['name', 'token', 'plain_text_token', 'abilities', 'uuid', 'team_id']
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

  get team_id(): number | undefined {
    return this.attributes.team_id
  }

  get team(): TeamModel | undefined {
    return this.attributes.team
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

  set updated_at(value: Date) {
    this.attributes.updated_at = value
  }

  getOriginal(column?: keyof AccessTokenType): Partial<AccessTokenType> {
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

    await this.loadRelations(model)

    const data = new AccessTokenModel(model as AccessTokenType)

    return data
  }

  static async first(): Promise<AccessTokenModel | undefined> {
    const model = await DB.instance.selectFrom('personal_access_tokens')
      .selectAll()
      .executeTakeFirst()

    const data = new AccessTokenModel(model as AccessTokenType)

    return data
  }

  async applyFirstOrFail(): Promise<AccessTokenModel | undefined> {
    const model = await this.selectFromQuery.executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, 'No AccessTokenModel results found for query')

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
    const models = await DB.instance.selectFrom('personal_access_tokens').selectAll().execute()

    const data = await Promise.all(models.map(async (model: AccessTokenType) => {
      return new AccessTokenModel(model)
    }))

    return data
  }

  async findOrFail(id: number): Promise<AccessTokenModel> {
    return await AccessTokenModel.findOrFail(id)
  }

  static async findOrFail(id: number): Promise<AccessTokenModel> {
    const instance = new AccessTokenModel(null)
    const model = await DB.instance.selectFrom('personal_access_tokens').where('id', '=', id).selectAll().executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, `No AccessTokenModel results for ${id}`)

    cache.getOrSet(`accesstoken:${id}`, JSON.stringify(model))

    await instance.loadRelations(model)

    const data = new AccessTokenModel(model as AccessTokenType)

    return data
  }

  static async findMany(ids: number[]): Promise<AccessTokenModel[]> {
    let query = DB.instance.selectFrom('personal_access_tokens').where('id', 'in', ids)

    const instance = new AccessTokenModel(null)

    query = query.selectAll()

    const models = await query.execute()

    await instance.loadRelations(models)

    return models.map((modelItem: AccessTokenModel) => instance.parseResult(new AccessTokenModel(modelItem)))
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
    return AccessTokenModel.pluck(field)
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
    return AccessTokenModel.has(relation)
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

  whereHas(
    relation: string,
    callback: (query: SubqueryBuilder) => void,
  ): AccessTokenModel {
    return AccessTokenModel.whereHas(relation, callback)
  }

  static whereHas(
    relation: string,
    callback: (query: SubqueryBuilder) => void,
  ): AccessTokenModel {
    const instance = new AccessTokenModel(null)
    const subqueryBuilder = new SubqueryBuilder()

    callback(subqueryBuilder)
    const conditions = subqueryBuilder.getConditions()

    instance.selectFromQuery = instance.selectFromQuery
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
              if (condition.operator === 'not') {
                subquery = subquery.whereNotIn(condition.column, condition.values!)
              }
              else {
                subquery = subquery.whereIn(condition.column, condition.values!)
              }

              break

            case 'whereNull':
              subquery = subquery.whereNull(condition.column)
              break

            case 'whereNotNull':
              subquery = subquery.whereNotNull(condition.column)
              break

            case 'whereBetween':
              subquery = subquery.whereBetween(condition.column, condition.values!)
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

    return instance
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

    return instance.doesntHave(relation)
  }

  applyWhereDoesntHave(relation: string, callback: (query: SubqueryBuilder) => void): AccessTokenModel {
    const subqueryBuilder = new SubqueryBuilder()

    callback(subqueryBuilder)
    const conditions = subqueryBuilder.getConditions()

    this.selectFromQuery = this.selectFromQuery
      .where(({ exists, selectFrom, not }: any) => {
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
              if (condition.operator === 'not') {
                subquery = subquery.whereNotIn(condition.column, condition.values!)
              }
              else {
                subquery = subquery.whereIn(condition.column, condition.values!)
              }

              break

            case 'whereNull':
              subquery = subquery.whereNull(condition.column)
              break

            case 'whereNotNull':
              subquery = subquery.whereNotNull(condition.column)
              break

            case 'whereBetween':
              subquery = subquery.whereBetween(condition.column, condition.values!)
              break

            case 'whereExists': {
              const nestedBuilder = new SubqueryBuilder()
              condition.callback!(nestedBuilder)
              break
            }
          }
        })

        return not(exists(subquery))
      })

    return this
  }

  whereDoesntHave(relation: string, callback: (query: SubqueryBuilder) => void): AccessTokenModel {
    return this.applyWhereDoesntHave(relation, callback)
  }

  static whereDoesntHave(
    relation: string,
    callback: (query: SubqueryBuilder) => void,
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

  static async create(newAccessToken: NewAccessToken): Promise<AccessTokenModel> {
    const instance = new AccessTokenModel(null)

    const filteredValues = Object.fromEntries(
      Object.entries(newAccessToken).filter(([key]) =>
        !instance.guarded.includes(key) && instance.fillable.includes(key),
      ),
    ) as NewAccessToken

    const result = await DB.instance.insertInto('personal_access_tokens')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await instance.find(Number(result.numInsertedOrUpdatedRows)) as AccessTokenModel

    if (model)
      dispatch('accesstoken:created', model)

    return model
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

  applyWhere(instance: AccessTokenModel, column: string, ...args: any[]): AccessTokenModel {
    const [operatorOrValue, value] = args
    const operator = value === undefined ? '=' : operatorOrValue
    const actualValue = value === undefined ? operatorOrValue : value

    instance.selectFromQuery = instance.selectFromQuery.where(column, operator, actualValue)
    instance.updateFromQuery = instance.updateFromQuery.where(column, operator, actualValue)
    instance.deleteFromQuery = instance.deleteFromQuery.where(column, operator, actualValue)

    return instance
  }

  where(column: string, ...args: any[]): AccessTokenModel {
    return this.applyWhere(this, column, ...args)
  }

  static where(column: string, ...args: any[]): AccessTokenModel {
    const instance = new AccessTokenModel(null)

    return instance.applyWhere(instance, column, ...args)
  }

  whereColumn(first: string, operator: string, second: string): AccessTokenModel {
    this.selectFromQuery = this.selectFromQuery.whereRef(first, operator, second)

    return this
  }

  static whereColumn(first: string, operator: string, second: string): AccessTokenModel {
    const instance = new AccessTokenModel(null)

    instance.selectFromQuery = instance.selectFromQuery.whereRef(first, operator, second)

    return instance
  }

  applyWhereRef(column: string, ...args: string[]): AccessTokenModel {
    const [operatorOrValue, value] = args
    const operator = value === undefined ? '=' : operatorOrValue
    const actualValue = value === undefined ? operatorOrValue : value

    const instance = new AccessTokenModel(null)
    instance.selectFromQuery = instance.selectFromQuery.whereRef(column, operator, actualValue)

    return instance
  }

  whereRef(column: string, ...args: string[]): AccessTokenModel {
    return this.applyWhereRef(column, ...args)
  }

  static whereRef(column: string, ...args: string[]): AccessTokenModel {
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

  whereNull(column: string): AccessTokenModel {
    return AccessTokenModel.whereNull(column)
  }

  static whereNull(column: string): AccessTokenModel {
    const instance = new AccessTokenModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    instance.updateFromQuery = instance.updateFromQuery.where((eb: any) =>
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

  whereIn(column: keyof AccessTokenType, values: any[]): AccessTokenModel {
    return AccessTokenModel.whereIn(column, values)
  }

  static whereIn(column: keyof AccessTokenType, values: any[]): AccessTokenModel {
    const instance = new AccessTokenModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where(column, 'in', values)

    instance.updateFromQuery = instance.updateFromQuery.where(column, 'in', values)

    instance.deleteFromQuery = instance.deleteFromQuery.where(column, 'in', values)

    return instance
  }

  applyWhereBetween(column: keyof AccessTokenType, range: [any, any]): AccessTokenModel {
    if (range.length !== 2) {
      throw new HttpError(500, 'Range must have exactly two values: [min, max]')
    }

    const query = sql` ${sql.raw(column as string)} between ${range[0]} and ${range[1]} `

    this.selectFromQuery = this.selectFromQuery.where(query)
    this.updateFromQuery = this.updateFromQuery.where(query)
    this.deleteFromQuery = this.deleteFromQuery.where(query)

    return this
  }

  whereBetween(column: keyof AccessTokenType, range: [any, any]): AccessTokenModel {
    return this.applyWhereBetween(column, range)
  }

  static whereBetween(column: keyof AccessTokenType, range: [any, any]): AccessTokenModel {
    const instance = new AccessTokenModel(null)

    return instance.applyWhereBetween(column, range)
  }

  applyWhereLike(column: keyof AccessTokenType, value: string): AccessTokenModel {
    this.selectFromQuery = this.selectFromQuery.where(sql` ${sql.raw(column as string)} LIKE ${value}`)

    this.updateFromQuery = this.updateFromQuery.where(sql` ${sql.raw(column as string)} LIKE ${value}`)

    this.deleteFromQuery = this.deleteFromQuery.where(sql` ${sql.raw(column as string)} LIKE ${value}`)

    return this
  }

  whereLike(column: keyof AccessTokenType, value: string): AccessTokenModel {
    return this.applyWhereLike(column, value)
  }

  static whereLike(column: keyof AccessTokenType, value: string): AccessTokenModel {
    const instance = new AccessTokenModel(null)

    return instance.applyWhereLike(column, value)
  }

  applyWhereNotIn(column: keyof AccessTokenType, values: any[]): AccessTokenModel {
    this.selectFromQuery = this.selectFromQuery.where(column, 'not in', values)

    this.updateFromQuery = this.updateFromQuery.where(column, 'not in', values)

    this.deleteFromQuery = this.deleteFromQuery.where(column, 'not in', values)

    return this
  }

  whereNotIn(column: keyof AccessTokenType, values: any[]): AccessTokenModel {
    return this.applyWhereNotIn(column, values)
  }

  static whereNotIn(column: keyof AccessTokenType, values: any[]): AccessTokenModel {
    const instance = new AccessTokenModel(null)

    return instance.applyWhereNotIn(column, values)
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
    const model = await DB.instance.selectFrom('personal_access_tokens')
      .selectAll()
      .orderBy('id', 'desc')
      .executeTakeFirst()

    if (!model)
      return undefined

    const data = new AccessTokenModel(model as AccessTokenType)

    return data
  }

  static async oldest(): Promise<AccessTokenType | undefined> {
    const model = await DB.instance.selectFrom('personal_access_tokens')
      .selectAll()
      .orderBy('id', 'asc')
      .executeTakeFirst()

    if (!model)
      return undefined

    const data = new AccessTokenModel(model as AccessTokenType)

    return data
  }

  static async firstOrCreate(
    condition: Partial<AccessTokenType>,
    newAccessToken: NewAccessToken,
  ): Promise<AccessTokenModel> {
    // Get the key and value from the condition object
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
      return new AccessTokenModel(existingAccessToken as AccessTokenType)
    }
    else {
      return await this.create(newAccessToken)
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
      return await this.create(newAccessToken)
    }
  }

  async loadRelations(models: AccessTokenModel | AccessTokenModel[]): Promise<void> {
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
        // If array, map through all models
        models.map((model: AccessTokenModel) => {
          const records = relatedRecords.filter((record: any) => {
            return record.accesstoken__id === model.id
          })

          model[relation] = records.length === 1 ? records[0] : records
          return model
        })
      }
      else {
        // If single model, just filter once
        const records = relatedRecords.filter((record: any) => {
          return record.accesstoken__id === models.id
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
    return await DB.instance.selectFrom('personal_access_tokens')
      .selectAll()
      .orderBy('id', 'desc')
      .executeTakeFirst()
  }

  static async last(): Promise<AccessTokenType | undefined> {
    const model = await DB.instance.selectFrom('personal_access_tokens').selectAll().orderBy('id', 'desc').executeTakeFirst()

    if (!model)
      return undefined

    const data = new AccessTokenModel(model as AccessTokenType)

    return data
  }

  orderBy(column: keyof AccessTokenType, order: 'asc' | 'desc'): AccessTokenModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, order)

    return this
  }

  static orderBy(column: keyof AccessTokenType, order: 'asc' | 'desc'): AccessTokenModel {
    const instance = new AccessTokenModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, order)

    return instance
  }

  groupBy(column: keyof AccessTokenType): AccessTokenModel {
    this.selectFromQuery = this.selectFromQuery.groupBy(column)

    return this
  }

  static groupBy(column: keyof AccessTokenType): AccessTokenModel {
    const instance = new AccessTokenModel(null)

    instance.selectFromQuery = instance.selectFromQuery.groupBy(column)

    return instance
  }

  having(column: keyof AccessTokenType, operator: string, value: any): AccessTokenModel {
    this.selectFromQuery = this.selectFromQuery.having(column, operator, value)

    return this
  }

  static having(column: keyof AccessTokenType, operator: string, value: any): AccessTokenModel {
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

  orderByDesc(column: keyof AccessTokenType): AccessTokenModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, 'desc')

    return this
  }

  static orderByDesc(column: keyof AccessTokenType): AccessTokenModel {
    const instance = new AccessTokenModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, 'desc')

    return instance
  }

  orderByAsc(column: keyof AccessTokenType): AccessTokenModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, 'asc')

    return this
  }

  static orderByAsc(column: keyof AccessTokenType): AccessTokenModel {
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

    const filteredValues = Object.fromEntries(
      Object.entries(this.attributes).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewAccessToken

    if (this.id === undefined) {
      await DB.instance.insertInto('personal_access_tokens')
        .values(filteredValues)
        .executeTakeFirstOrThrow()
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
  async delete(): Promise<any> {
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

      created_at: this.created_at,

      updated_at: this.updated_at,

      team_id: this.team_id,
      team: this.team,
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

export const AccessToken = AccessTokenModel

export default AccessToken
