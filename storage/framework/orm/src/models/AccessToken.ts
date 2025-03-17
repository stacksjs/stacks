import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { TeamModel } from './Team'
import type { UserModel } from './User'
import { cache } from '@stacksjs/cache'
import { sql } from '@stacksjs/database'
import { HttpError, ModelNotFoundException } from '@stacksjs/error-handling'

import { BaseOrm, DB, SubqueryBuilder } from '@stacksjs/orm'

import Team from './Team'

import User from './User'

export interface PersonalAccessTokensTable {
  id: Generated<number>
  team_id: number
  user_id: number
  name: string
  token: string
  plain_text_token: string
  abilities: string | string[]
  last_used_at?: Date | string
  expires_at?: Date | string
  revoked_at?: Date | string
  ip_address?: string
  device_name?: string
  is_single_use?: boolean

  created_at?: Date

  updated_at?: Date

}

export interface AccessTokenResponse {
  data: AccessTokenJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface AccessTokenJsonResponse extends Omit<Selectable<PersonalAccessTokensTable>, 'password'> {
  [key: string]: any
}

export type NewAccessToken = Insertable<PersonalAccessTokensTable>
export type AccessTokenUpdate = Updateable<PersonalAccessTokensTable>

      type SortDirection = 'asc' | 'desc'
interface SortOptions { column: AccessTokenJsonResponse, order: SortDirection }
// Define a type for the options parameter
interface QueryOptions {
  sort?: SortOptions
  limit?: number
  offset?: number
  page?: number
}

export class AccessTokenModel extends BaseOrm<AccessTokenModel, PersonalAccessTokensTable, AccessTokenJsonResponse> {
  private readonly hidden: Array<keyof AccessTokenJsonResponse> = []
  private readonly fillable: Array<keyof AccessTokenJsonResponse> = ['name', 'token', 'plain_text_token', 'abilities', 'last_used_at', 'expires_at', 'revoked_at', 'ip_address', 'device_name', 'is_single_use', 'uuid', 'team_id']
  private readonly guarded: Array<keyof AccessTokenJsonResponse> = []
  protected attributes = {} as AccessTokenJsonResponse
  protected originalAttributes = {} as AccessTokenJsonResponse

  protected selectFromQuery: any
  protected updateFromQuery: any
  protected deleteFromQuery: any
  protected hasSelect: boolean
  private hasSaved: boolean
  private customColumns: Record<string, unknown> = {}

  constructor(accessToken: AccessTokenJsonResponse | undefined) {
    super('personal_access_tokens')
    if (accessToken) {
      this.attributes = { ...accessToken }
      this.originalAttributes = { ...accessToken }

      Object.keys(accessToken).forEach((key) => {
        if (!(key in this)) {
          this.customColumns[key] = (accessToken as AccessTokenJsonResponse)[key]
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

  protected async loadRelations(models: AccessTokenJsonResponse | AccessTokenJsonResponse[]): Promise<void> {
    // Handle both single model and array of models
    const modelArray = Array.isArray(models) ? models : [models]
    if (!modelArray.length)
      return

    const modelIds = modelArray.map(model => model.id)

    for (const relation of this.withRelations) {
      const relatedRecords = await DB.instance
        .selectFrom(relation)
        .where('accessToken_id', 'in', modelIds)
        .selectAll()
        .execute()

      if (Array.isArray(models)) {
        models.map((model: AccessTokenJsonResponse) => {
          const records = relatedRecords.filter((record: { accessToken_id: number }) => {
            return record.accessToken_id === model.id
          })

          model[relation] = records.length === 1 ? records[0] : records
          return model
        })
      }
      else {
        const records = relatedRecords.filter((record: { accessToken_id: number }) => {
          return record.accessToken_id === models.id
        })

        models[relation] = records.length === 1 ? records[0] : records
      }
    }
  }

  static with(relations: string[]): AccessTokenModel {
    const instance = new AccessTokenModel(undefined)

    return instance.applyWith(relations)
  }

  protected mapCustomGetters(models: AccessTokenJsonResponse | AccessTokenJsonResponse[]): void {
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

  async mapCustomSetters(model: NewAccessToken | AccessTokenUpdate): Promise<void> {
    const customSetter = {
      default: () => {
      },

    }

    for (const [key, fn] of Object.entries(customSetter)) {
      model[key] = await fn()
    }
  }

  get team_id(): number {
    return this.attributes.team_id
  }

  get team(): TeamModel | undefined {
    return this.attributes.team
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

  get token(): string {
    return this.attributes.token
  }

  get plain_text_token(): string {
    return this.attributes.plain_text_token
  }

  get abilities(): string | string[] {
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

  set abilities(value: string | string[]) {
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

  isDirty(column?: keyof AccessTokenJsonResponse): boolean {
    if (column) {
      return this.attributes[column] !== this.originalAttributes[column]
    }

    return Object.entries(this.originalAttributes).some(([key, originalValue]) => {
      const currentValue = (this.attributes as any)[key]

      return currentValue !== originalValue
    })
  }

  isClean(column?: keyof AccessTokenJsonResponse): boolean {
    return !this.isDirty(column)
  }

  wasChanged(column?: keyof AccessTokenJsonResponse): boolean {
    return this.hasSaved && this.isDirty(column)
  }

  static select(params: (keyof AccessTokenJsonResponse)[] | RawBuilder<string> | string): AccessTokenModel {
    const instance = new AccessTokenModel(undefined)

    return instance.applySelect(params)
  }

  // Method to find a AccessToken by ID
  static async find(id: number): Promise<AccessTokenModel | undefined> {
    const instance = new AccessTokenModel(undefined)

    return await instance.applyFind(id)
  }

  async first(): Promise<AccessTokenModel | undefined> {
    const model = await this.applyFirst()

    const data = new AccessTokenModel(model)

    return data
  }

  static async first(): Promise<AccessTokenModel | undefined> {
    const instance = new AccessTokenModel(undefined)

    const model = await instance.applyFirst()

    const data = new AccessTokenModel(model)

    return data
  }

  async applyFirstOrFail(): Promise<AccessTokenModel | undefined> {
    const model = await this.selectFromQuery.executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, `No AccessTokenModel results found for query`)

    if (model) {
      this.mapCustomGetters(model)
      await this.loadRelations(model)
    }

    const data = new AccessTokenModel(model)

    return data
  }

  static async firstOrFail(): Promise<AccessTokenModel | undefined> {
    const instance = new AccessTokenModel(undefined)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<AccessTokenModel[]> {
    const instance = new AccessTokenModel(undefined)

    const models = await DB.instance.selectFrom('personal_access_tokens').selectAll().execute()

    instance.mapCustomGetters(models)

    const data = await Promise.all(models.map(async (model: AccessTokenJsonResponse) => {
      return new AccessTokenModel(model)
    }))

    return data
  }

  async applyFindOrFail(id: number): Promise<AccessTokenModel> {
    const model = await DB.instance.selectFrom('personal_access_tokens').where('id', '=', id).selectAll().executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, `No AccessTokenModel results for ${id}`)

    cache.getOrSet(`accessToken:${id}`, JSON.stringify(model))

    this.mapCustomGetters(model)
    await this.loadRelations(model)

    const data = new AccessTokenModel(model)

    return data
  }

  async findOrFail(id: number): Promise<AccessTokenModel> {
    return await this.applyFindOrFail(id)
  }

  static async findOrFail(id: number): Promise<AccessTokenModel> {
    const instance = new AccessTokenModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  static async findMany(ids: number[]): Promise<AccessTokenModel[]> {
    const instance = new AccessTokenModel(undefined)

    const models = await instance.applyFindMany(ids)

    return models.map((modelItem: UserJsonResponse) => instance.parseResult(new AccessTokenModel(modelItem)))
  }

  async findMany(ids: number[]): Promise<AccessTokenModel[]> {
    const models = await this.applyFindMany(ids)

    return models.map((modelItem: UserJsonResponse) => this.parseResult(new AccessTokenModel(modelItem)))
  }

  static skip(count: number): AccessTokenModel {
    const instance = new AccessTokenModel(undefined)

    return instance.applySkip(count)
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
    const instance = new AccessTokenModel(undefined)

    await instance.applyChunk(size, callback)
  }

  static take(count: number): AccessTokenModel {
    const instance = new AccessTokenModel(undefined)

    return instance.applyTake(count)
  }

  static async pluck<K extends keyof AccessTokenModel>(field: K): Promise<AccessTokenModel[K][]> {
    const instance = new AccessTokenModel(undefined)

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
    const instance = new AccessTokenModel(undefined)

    return instance.applyCount()
  }

  static async max(field: keyof AccessTokenModel): Promise<number> {
    const instance = new AccessTokenModel(undefined)

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
    const instance = new AccessTokenModel(undefined)

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
    const instance = new AccessTokenModel(undefined)

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
    const instance = new AccessTokenModel(undefined)

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

    const data = await Promise.all(models.map(async (model: AccessTokenJsonResponse) => {
      return new AccessTokenModel(model)
    }))

    return data
  }

  async get(): Promise<AccessTokenModel[]> {
    return await this.applyGet()
  }

  static async get(): Promise<AccessTokenModel[]> {
    const instance = new AccessTokenModel(undefined)

    return await instance.applyGet()
  }

  has(relation: string): AccessTokenModel {
    this.selectFromQuery = this.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(
        selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.accessToken_id`, '=', 'personal_access_tokens.id'),
      ),
    )

    return this
  }

  static has(relation: string): AccessTokenModel {
    const instance = new AccessTokenModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(
        selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.accessToken_id`, '=', 'personal_access_tokens.id'),
      ),
    )

    return instance
  }

  static whereExists(callback: (qb: any) => any): AccessTokenModel {
    const instance = new AccessTokenModel(undefined)

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
          .whereRef(`${relation}.accessToken_id`, '=', 'personal_access_tokens.id')

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
    const instance = new AccessTokenModel(undefined)

    return instance.applyWhereHas(relation, callback)
  }

  applyDoesntHave(relation: string): AccessTokenModel {
    this.selectFromQuery = this.selectFromQuery.where(({ not, exists, selectFrom }: any) =>
      not(
        exists(
          selectFrom(relation)
            .select('1')
            .whereRef(`${relation}.accessToken_id`, '=', 'personal_access_tokens.id'),
        ),
      ),
    )

    return this
  }

  doesntHave(relation: string): AccessTokenModel {
    return this.applyDoesntHave(relation)
  }

  static doesntHave(relation: string): AccessTokenModel {
    const instance = new AccessTokenModel(undefined)

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
          .whereRef(`${relation}.accessToken_id`, '=', 'personal_access_tokens.id')

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
    const instance = new AccessTokenModel(undefined)

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
    const instance = new AccessTokenModel(undefined)

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
    const instance = new AccessTokenModel(undefined)

    return await instance.applyCreate(newAccessToken)
  }

  static async createMany(newAccessToken: NewAccessToken[]): Promise<void> {
    const instance = new AccessTokenModel(undefined)

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
  async delete(): Promise<PersonalAccessTokensTable> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()

    return await DB.instance.deleteFrom('personal_access_tokens')
      .where('id', '=', this.id)
      .execute()
  }

  static whereName(value: string): AccessTokenModel {
    const instance = new AccessTokenModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('name', '=', value)

    return instance
  }

  static whereToken(value: string): AccessTokenModel {
    const instance = new AccessTokenModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('token', '=', value)

    return instance
  }

  static wherePlainTextToken(value: string): AccessTokenModel {
    const instance = new AccessTokenModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('plainTextToken', '=', value)

    return instance
  }

  static whereAbilities(value: string): AccessTokenModel {
    const instance = new AccessTokenModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('abilities', '=', value)

    return instance
  }

  static whereLastUsedAt(value: string): AccessTokenModel {
    const instance = new AccessTokenModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('lastUsedAt', '=', value)

    return instance
  }

  static whereExpiresAt(value: string): AccessTokenModel {
    const instance = new AccessTokenModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('expiresAt', '=', value)

    return instance
  }

  static whereRevokedAt(value: string): AccessTokenModel {
    const instance = new AccessTokenModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('revokedAt', '=', value)

    return instance
  }

  static whereIpAddress(value: string): AccessTokenModel {
    const instance = new AccessTokenModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('ipAddress', '=', value)

    return instance
  }

  static whereDeviceName(value: string): AccessTokenModel {
    const instance = new AccessTokenModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('deviceName', '=', value)

    return instance
  }

  static whereIsSingleUse(value: string): AccessTokenModel {
    const instance = new AccessTokenModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('isSingleUse', '=', value)

    return instance
  }

  static whereIn<V = number>(column: keyof PersonalAccessTokensTable, values: V[]): AccessTokenModel {
    const instance = new AccessTokenModel(undefined)

    return instance.applyWhereIn<V>(column, values)
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

  static distinct(column: keyof AccessTokenJsonResponse): AccessTokenModel {
    const instance = new AccessTokenModel(undefined)

    return instance.applyDistinct(column)
  }

  static join(table: string, firstCol: string, secondCol: string): AccessTokenModel {
    const instance = new AccessTokenModel(undefined)

    return instance.applyJoin(table, firstCol, secondCol)
  }

  toJSON(): AccessTokenJsonResponse {
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
  const results: AccessTokenJsonResponse = await query.execute()

  return results.map((modelItem: AccessTokenJsonResponse) => new AccessTokenModel(modelItem))
}

export async function whereToken(value: string): Promise<AccessTokenModel[]> {
  const query = DB.instance.selectFrom('personal_access_tokens').where('token', '=', value)
  const results: AccessTokenJsonResponse = await query.execute()

  return results.map((modelItem: AccessTokenJsonResponse) => new AccessTokenModel(modelItem))
}

export async function wherePlainTextToken(value: string): Promise<AccessTokenModel[]> {
  const query = DB.instance.selectFrom('personal_access_tokens').where('plain_text_token', '=', value)
  const results: AccessTokenJsonResponse = await query.execute()

  return results.map((modelItem: AccessTokenJsonResponse) => new AccessTokenModel(modelItem))
}

export async function whereAbilities(value: string | string[]): Promise<AccessTokenModel[]> {
  const query = DB.instance.selectFrom('personal_access_tokens').where('abilities', '=', value)
  const results: AccessTokenJsonResponse = await query.execute()

  return results.map((modelItem: AccessTokenJsonResponse) => new AccessTokenModel(modelItem))
}

export async function whereLastUsedAt(value: Date | string): Promise<AccessTokenModel[]> {
  const query = DB.instance.selectFrom('personal_access_tokens').where('last_used_at', '=', value)
  const results: AccessTokenJsonResponse = await query.execute()

  return results.map((modelItem: AccessTokenJsonResponse) => new AccessTokenModel(modelItem))
}

export async function whereExpiresAt(value: Date | string): Promise<AccessTokenModel[]> {
  const query = DB.instance.selectFrom('personal_access_tokens').where('expires_at', '=', value)
  const results: AccessTokenJsonResponse = await query.execute()

  return results.map((modelItem: AccessTokenJsonResponse) => new AccessTokenModel(modelItem))
}

export async function whereRevokedAt(value: Date | string): Promise<AccessTokenModel[]> {
  const query = DB.instance.selectFrom('personal_access_tokens').where('revoked_at', '=', value)
  const results: AccessTokenJsonResponse = await query.execute()

  return results.map((modelItem: AccessTokenJsonResponse) => new AccessTokenModel(modelItem))
}

export async function whereIpAddress(value: string): Promise<AccessTokenModel[]> {
  const query = DB.instance.selectFrom('personal_access_tokens').where('ip_address', '=', value)
  const results: AccessTokenJsonResponse = await query.execute()

  return results.map((modelItem: AccessTokenJsonResponse) => new AccessTokenModel(modelItem))
}

export async function whereDeviceName(value: string): Promise<AccessTokenModel[]> {
  const query = DB.instance.selectFrom('personal_access_tokens').where('device_name', '=', value)
  const results: AccessTokenJsonResponse = await query.execute()

  return results.map((modelItem: AccessTokenJsonResponse) => new AccessTokenModel(modelItem))
}

export async function whereIsSingleUse(value: boolean): Promise<AccessTokenModel[]> {
  const query = DB.instance.selectFrom('personal_access_tokens').where('is_single_use', '=', value)
  const results: AccessTokenJsonResponse = await query.execute()

  return results.map((modelItem: AccessTokenJsonResponse) => new AccessTokenModel(modelItem))
}

export const AccessToken = AccessTokenModel

export default AccessToken
