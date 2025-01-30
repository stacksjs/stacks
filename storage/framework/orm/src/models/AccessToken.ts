import type { Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { TeamModel } from './Team'
import { randomUUIDv7 } from 'bun'
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

  protected selectFromQuery: any
  protected withRelations: string[]
  protected updateFromQuery: any
  protected deleteFromQuery: any
  protected hasSelect: boolean
  private customColumns: Record<string, unknown> = {}
  public team_id: number | undefined
  public team: TeamModel | undefined
  public id: number | undefined
  public name: string | undefined
  public token: string | undefined
  public plain_text_token: string | undefined
  public abilities: string[] | undefined

  public created_at: Date | undefined
  public updated_at: Date | undefined

  constructor(accesstoken: Partial<AccessTokenType> | null) {
    if (accesstoken) {
      this.team_id = accesstoken?.team_id
      this.team = accesstoken?.team
      this.id = accesstoken?.id || 1
      this.name = accesstoken?.name
      this.token = accesstoken?.token
      this.plain_text_token = accesstoken?.plain_text_token
      this.abilities = accesstoken?.abilities

      this.created_at = accesstoken?.created_at

      this.updated_at = accesstoken?.updated_at

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
  }

  select(params: (keyof AccessTokenType)[] | RawBuilder<string> | string): AccessTokenModel {
    return AccessTokenModel.select(params)
  }

  static select(params: (keyof AccessTokenType)[] | RawBuilder<string> | string): AccessTokenModel {
    const instance = new AccessTokenModel(null)

    // Initialize a query with the table name and selected fields
    instance.selectFromQuery = instance.selectFromQuery.select(params)

    instance.hasSelect = true

    return instance
  }

  async find(id: number): Promise<AccessTokenModel | undefined> {
    return await AccessTokenModel.find(id)
  }

  // Method to find a AccessToken by ID
  static async find(id: number): Promise<AccessTokenModel | undefined> {
    const model = await DB.instance.selectFrom('personal_access_tokens').where('id', '=', id).selectAll().executeTakeFirst()

    if (!model)
      return undefined

    const instance = new AccessTokenModel(null)

    const result = await instance.mapWith(model)

    const data = new AccessTokenModel(result as AccessTokenType)

    cache.getOrSet(`accesstoken:${id}`, JSON.stringify(model))

    return data
  }

  async first(): Promise<AccessTokenModel | undefined> {
    return await AccessTokenModel.first()
  }

  static async first(): Promise<AccessTokenModel | undefined> {
    const model = await DB.instance.selectFrom('personal_access_tokens')
      .selectAll()
      .executeTakeFirst()

    if (!model)
      return undefined

    const instance = new AccessTokenModel(null)

    const result = await instance.mapWith(model)

    const data = new AccessTokenModel(result as AccessTokenType)

    return data
  }

  async firstOrFail(): Promise<AccessTokenModel | undefined> {
    return await AccessTokenModel.firstOrFail()
  }

  static async firstOrFail(): Promise<AccessTokenModel | undefined> {
    const instance = new AccessTokenModel(null)

    const model = await instance.selectFromQuery.executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, 'No AccessTokenModel results found for query')

    const result = await instance.mapWith(model)

    const data = new AccessTokenModel(result as AccessTokenType)

    return data
  }

  async mapWith(model: AccessTokenType): Promise<AccessTokenType> {
    if (this.withRelations.includes('team')) {
      model.team = await this.teamBelong()
    }

    return model
  }

  static async all(): Promise<AccessTokenModel[]> {
    const models = await DB.instance.selectFrom('personal_access_tokens').selectAll().execute()

    const data = await Promise.all(models.map(async (model: AccessTokenType) => {
      const instance = new AccessTokenModel(model)

      const results = await instance.mapWith(model)

      return new AccessTokenModel(results)
    }))

    return data
  }

  async findOrFail(id: number): Promise<AccessTokenModel> {
    return await AccessTokenModel.findOrFail(id)
  }

  static async findOrFail(id: number): Promise<AccessTokenModel> {
    const model = await DB.instance.selectFrom('personal_access_tokens').where('id', '=', id).selectAll().executeTakeFirst()

    const instance = new AccessTokenModel(null)

    if (model === undefined)
      throw new ModelNotFoundException(404, `No AccessTokenModel results for ${id}`)

    cache.getOrSet(`accesstoken:${id}`, JSON.stringify(model))

    const result = await instance.mapWith(model)

    const data = new AccessTokenModel(result as AccessTokenType)

    return data
  }

  static async findMany(ids: number[]): Promise<AccessTokenModel[]> {
    let query = DB.instance.selectFrom('personal_access_tokens').where('id', 'in', ids)

    const instance = new AccessTokenModel(null)

    query = query.selectAll()

    const model = await query.execute()

    return model.map(modelItem => instance.parseResult(new AccessTokenModel(modelItem)))
  }

  skip(count: number): AccessTokenModel {
    return AccessTokenModel.skip(count)
  }

  static skip(count: number): AccessTokenModel {
    const instance = new AccessTokenModel(null)

    instance.selectFromQuery = instance.selectFromQuery.offset(count)

    return instance
  }

  take(count: number): AccessTokenModel {
    return AccessTokenModel.take(count)
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

    return instance.selectFromQuery
      .select(sql`COUNT(*) as count`)
      .executeTakeFirst()
  }

  async count(): Promise<number> {
    return AccessTokenModel.count()
  }

  async max(field: keyof AccessTokenModel): Promise<number> {
    return await this.selectFromQuery
      .select(sql`MAX(${sql.raw(field as string)}) `)
      .executeTakeFirst()
  }

  async min(field: keyof AccessTokenModel): Promise<number> {
    return await this.selectFromQuery
      .select(sql`MIN(${sql.raw(field as string)}) `)
      .executeTakeFirst()
  }

  async avg(field: keyof AccessTokenModel): Promise<number> {
    return this.selectFromQuery
      .select(sql`AVG(${sql.raw(field as string)})`)
      .executeTakeFirst()
  }

  async sum(field: keyof AccessTokenModel): Promise<number> {
    return this.selectFromQuery
      .select(sql`SUM(${sql.raw(field as string)})`)
      .executeTakeFirst()
  }

  async get(): Promise<AccessTokenModel[]> {
    return AccessTokenModel.get()
  }

  static async get(): Promise<AccessTokenModel[]> {
    const instance = new AccessTokenModel(null)

    let models

    if (instance.hasSelect) {
      models = await instance.selectFromQuery.execute()
    }
    else {
      models = await instance.selectFromQuery.selectAll().execute()
    }

    const data = await Promise.all(models.map(async (model: AccessTokenModel) => {
      const instance = new AccessTokenModel(model)

      const results = await instance.mapWith(model)

      return new AccessTokenModel(results)
    }))

    return data
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

  doesntHave(relation: string): AccessTokenModel {
    return AccessTokenModel.doesntHave(relation)
  }

  static doesntHave(relation: string): AccessTokenModel {
    const instance = new AccessTokenModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where(({ not, exists, selectFrom }: any) =>
      not(
        exists(
          selectFrom(relation)
            .select('1')
            .whereRef(`${relation}.accesstoken_id`, '=', 'personal_access_tokens.id'),
        ),
      ),
    )

    return instance
  }

  whereDoesntHave(relation: string, callback: (query: SubqueryBuilder) => void): AccessTokenModel {
    return AccessTokenModel.whereDoesntHave(relation, callback)
  }

  static whereDoesntHave(
    relation: string,
    callback: (query: SubqueryBuilder) => void,
  ): AccessTokenModel {
    const instance = new AccessTokenModel(null)
    const subqueryBuilder = new SubqueryBuilder()

    callback(subqueryBuilder)
    const conditions = subqueryBuilder.getConditions()

    instance.selectFromQuery = instance.selectFromQuery
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

    return instance
  }

  async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<AccessTokenResponse> {
    return AccessTokenModel.paginate(options)
  }

  // Method to get all personal_access_tokens
  static async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<AccessTokenResponse> {
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
      dispatch('PersonalAccessTokens:created', model)

    return model
  }

  static async createMany(newAccessToken: NewAccessToken[]): Promise<void> {
    const instance = new AccessTokenModel(null)

    const filteredValues = newAccessToken.map((newAccessToken: NewAccessToken) => {
      const filtered = Object.fromEntries(
        Object.entries(newAccessToken).filter(([key]) =>
          !instance.guarded.includes(key) && instance.fillable.includes(key),
        ),
      ) as NewAccessToken

      filtered.uuid = randomUUIDv7()
      return filtered
    })

    await DB.instance.insertInto('personal_access_tokens')
      .values(filteredValues)
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

  private static applyWhere(instance: AccessTokenModel, column: string, operator: string, value: any): AccessTokenModel {
    instance.selectFromQuery = instance.selectFromQuery.where(column, operator, value)
    instance.updateFromQuery = instance.updateFromQuery.where(column, operator, value)
    instance.deleteFromQuery = instance.deleteFromQuery.where(column, operator, value)

    return instance
  }

  where(column: string, operator: string, value: any): AccessTokenModel {
    return AccessTokenModel.applyWhere(this, column, operator, value)
  }

  static where(column: string, operator: string, value: any): AccessTokenModel {
    const instance = new AccessTokenModel(null)

    return AccessTokenModel.applyWhere(instance, column, operator, value)
  }

  whereRef(column: string, operator: string, value: string): AccessTokenModel {
    return AccessTokenModel.whereRef(column, operator, value)
  }

  static whereRef(column: string, operator: string, value: string): AccessTokenModel {
    const instance = new AccessTokenModel(null)

    instance.selectFromQuery = instance.selectFromQuery.whereRef(column, operator, value)

    return instance
  }

  orWhere(...args: Array<[string, string, any]>): AccessTokenModel {
    return AccessTokenModel.orWhere(...args)
  }

  static orWhere(...args: Array<[string, string, any]>): AccessTokenModel {
    const instance = new AccessTokenModel(null)

    if (args.length === 0) {
      throw new HttpError(500, 'At least one condition must be provided')
    }

    // Use the expression builder to append the OR conditions
    instance.selectFromQuery = instance.selectFromQuery.where((eb: any) =>
      eb.or(
        args.map(([column, operator, value]) => eb(column, operator, value)),
      ),
    )

    instance.updateFromQuery = instance.updateFromQuery.where((eb: any) =>
      eb.or(
        args.map(([column, operator, value]) => eb(column, operator, value)),
      ),
    )

    instance.deleteFromQuery = instance.deleteFromQuery.where((eb: any) =>
      eb.or(
        args.map(([column, operator, value]) => eb(column, operator, value)),
      ),
    )

    return instance
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

  whereBetween(column: keyof AccessTokenType, range: [any, any]): AccessTokenModel {
    return AccessTokenModel.whereBetween(column, range)
  }

  static whereBetween(column: keyof AccessTokenType, range: [any, any]): AccessTokenModel {
    if (range.length !== 2) {
      throw new HttpError(500, 'Range must have exactly two values: [min, max]')
    }

    const instance = new AccessTokenModel(null)

    const query = sql` ${sql.raw(column as string)} between ${range[0]} and ${range[1]} `

    instance.selectFromQuery = instance.selectFromQuery.where(query)
    instance.updateFromQuery = instance.updateFromQuery.where(query)
    instance.deleteFromQuery = instance.deleteFromQuery.where(query)

    return instance
  }

  whereNotIn(column: keyof AccessTokenType, values: any[]): AccessTokenModel {
    return AccessTokenModel.whereNotIn(column, values)
  }

  static whereNotIn(column: keyof AccessTokenType, values: any[]): AccessTokenModel {
    const instance = new AccessTokenModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where(column, 'not in', values)

    instance.updateFromQuery = instance.updateFromQuery.where(column, 'not in', values)

    instance.deleteFromQuery = instance.deleteFromQuery.where(column, 'not in', values)

    return instance
  }

  async exists(): Promise<boolean> {
    const model = await this.selectFromQuery.executeTakeFirst()

    return model !== null || model !== undefined
  }

  static async latest(): Promise<AccessTokenType | undefined> {
    const model = await DB.instance.selectFrom('personal_access_tokens')
      .selectAll()
      .orderBy('created_at', 'desc')
      .executeTakeFirst()

    if (!model)
      return undefined

    const instance = new AccessTokenModel(null)
    const result = await instance.mapWith(model)
    const data = new AccessTokenModel(result as AccessTokenType)

    return data
  }

  static async oldest(): Promise<AccessTokenType | undefined> {
    const model = await DB.instance.selectFrom('personal_access_tokens')
      .selectAll()
      .orderBy('created_at', 'asc')
      .executeTakeFirst()

    if (!model)
      return undefined

    const instance = new AccessTokenModel(null)
    const result = await instance.mapWith(model)
    const data = new AccessTokenModel(result as AccessTokenType)

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
      const instance = new AccessTokenModel(null)
      const result = await instance.mapWith(existingAccessToken)
      return new AccessTokenModel(result as AccessTokenType)
    }
    else {
      return await this.create(newAccessToken)
    }
  }

  static async updateOrCreate(
    condition: Partial<AccessTokenType>,
    newAccessToken: NewAccessToken,
  ): Promise<AccessTokenModel> {
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

      const instance = new AccessTokenModel(null)
      const result = await instance.mapWith(updatedAccessToken)
      return new AccessTokenModel(result as AccessTokenType)
    }
    else {
      // If not found, create a new record
      return await this.create(newAccessToken)
    }
  }

  with(relations: string[]): AccessTokenModel {
    return AccessTokenModel.with(relations)
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

    const instance = new AccessTokenModel(null)

    const result = await instance.mapWith(model)

    const data = new AccessTokenModel(result as AccessTokenType)

    return data
  }

  orderBy(column: keyof AccessTokenType, order: 'asc' | 'desc'): AccessTokenModel {
    return AccessTokenModel.orderBy(column, order)
  }

  static orderBy(column: keyof AccessTokenType, order: 'asc' | 'desc'): AccessTokenModel {
    const instance = new AccessTokenModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, order)

    return instance
  }

  groupBy(column: keyof AccessTokenType): AccessTokenModel {
    return AccessTokenModel.groupBy(column)
  }

  static groupBy(column: keyof AccessTokenType): AccessTokenModel {
    const instance = new AccessTokenModel(null)

    instance.selectFromQuery = instance.selectFromQuery.groupBy(column)

    return instance
  }

  having(column: keyof AccessTokenType, operator: string, value: any): AccessTokenModel {
    return AccessTokenModel.having(column, operator, value)
  }

  static having(column: keyof AccessTokenType, operator: string, value: any): AccessTokenModel {
    const instance = new AccessTokenModel(null)

    instance.selectFromQuery = instance.selectFromQuery.having(column, operator, value)

    return instance
  }

  inRandomOrder(): AccessTokenModel {
    return AccessTokenModel.inRandomOrder()
  }

  static inRandomOrder(): AccessTokenModel {
    const instance = new AccessTokenModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(sql` ${sql.raw('RANDOM()')} `)

    return instance
  }

  orderByDesc(column: keyof AccessTokenType): AccessTokenModel {
    return AccessTokenModel.orderByDesc(column)
  }

  static orderByDesc(column: keyof AccessTokenType): AccessTokenModel {
    const instance = new AccessTokenModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, 'desc')

    return instance
  }

  orderByAsc(column: keyof AccessTokenType): AccessTokenModel {
    return AccessTokenModel.orderByAsc(column)
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

      return model
    }

    return undefined
  }

  async save(): Promise<void> {
    if (!this)
      throw new HttpError(500, 'AccessToken data is undefined')

    if (this.id === undefined) {
      await DB.instance.insertInto('personal_access_tokens')
        .values(this as NewAccessToken)
        .executeTakeFirstOrThrow()
    }
    else {
      await this.update(this)
    }
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
    return AccessTokenModel.distinct(column)
  }

  static distinct(column: keyof AccessTokenType): AccessTokenModel {
    const instance = new AccessTokenModel(null)

    instance.selectFromQuery = instance.selectFromQuery.select(column).distinct()

    instance.hasSelect = true

    return instance
  }

  join(table: string, firstCol: string, secondCol: string): AccessTokenModel {
    return AccessTokenModel.join(table, firstCol, secondCol)
  }

  static join(table: string, firstCol: string, secondCol: string): AccessTokenModel {
    const instance = new AccessTokenModel(null)

    instance.selectFromQuery = instance.selectFromQuery.innerJoin(table, firstCol, secondCol)

    return instance
  }

  static async rawQuery(rawQuery: string): Promise<any> {
    return await sql`${rawQuery}`.execute(db)
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
  return await sql`${rawQuery}`.execute(db)
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
