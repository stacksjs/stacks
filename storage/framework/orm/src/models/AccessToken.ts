import type { Insertable, Selectable, Updateable } from 'kysely'
import type { TeamModel } from './Team'
import { cache } from '@stacksjs/cache'
import { db, sql } from '@stacksjs/database'
import { HttpError } from '@stacksjs/error-handling'

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
  data: PersonalAccessTokens
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export type AccessTokenType = Selectable<PersonalAccessTokensTable>
export type NewAccessToken = Partial<Insertable<PersonalAccessTokensTable>>
export type AccessTokenUpdate = Updateable<PersonalAccessTokensTable>
export type PersonalAccessTokens = AccessTokenType[]

export type AccessTokenColumn = PersonalAccessTokens
export type AccessTokenColumns = Array<keyof PersonalAccessTokens>

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
  private hidden = []
  private fillable = ['name', 'token', 'plain_text_token', 'abilities', 'uuid', 'team_id']
  private softDeletes = false
  protected selectFromQuery: any
  protected withRelations: string[]
  protected updateFromQuery: any
  protected deleteFromQuery: any
  protected hasSelect: boolean
  public team_id: number | undefined
  public team: TeamModel | undefined
  public id: number
  public name: string | undefined
  public token: string | undefined
  public plain_text_token: string | undefined
  public abilities: string[] | undefined

  public created_at: Date | undefined
  public updated_at: Date | undefined

  constructor(accesstoken: Partial<AccessTokenType> | null) {
    this.team_id = accesstoken?.team_id
    this.team = accesstoken?.team
    this.id = accesstoken?.id || 1
    this.name = accesstoken?.name
    this.token = accesstoken?.token
    this.plain_text_token = accesstoken?.plain_text_token
    this.abilities = accesstoken?.abilities

    this.created_at = accesstoken?.created_at

    this.updated_at = accesstoken?.updated_at

    this.withRelations = []
    this.selectFromQuery = db.selectFrom('personal_access_tokens')
    this.updateFromQuery = db.updateTable('personal_access_tokens')
    this.deleteFromQuery = db.deleteFrom('personal_access_tokens')
    this.hasSelect = false
  }

  // Method to find a AccessToken by ID
  async find(id: number): Promise<AccessTokenModel | undefined> {
    const query = db.selectFrom('personal_access_tokens').where('id', '=', id).selectAll()

    const model = await query.executeTakeFirst()

    if (!model)
      return undefined

    const result = await this.mapWith(model)

    const data = new AccessTokenModel(result as AccessTokenType)

    cache.getOrSet(`accesstoken:${id}`, JSON.stringify(model))

    return data
  }

  // Method to find a AccessToken by ID
  static async find(id: number): Promise<AccessTokenModel | undefined> {
    const model = await db.selectFrom('personal_access_tokens').where('id', '=', id).selectAll().executeTakeFirst()

    if (!model)
      return undefined

    const instance = new AccessTokenModel(null)

    const result = await instance.mapWith(model)

    const data = new AccessTokenModel(result as AccessTokenType)

    cache.getOrSet(`accesstoken:${id}`, JSON.stringify(model))

    return data
  }

  async mapWith(model: AccessTokenType): Promise<AccessTokenType> {
    if (this.withRelations.includes('team')) {
      model.team = await this.teamBelong()
    }

    return model
  }

  static async all(): Promise<AccessTokenModel[]> {
    const models = await db.selectFrom('personal_access_tokens').selectAll().execute()

    const data = await Promise.all(models.map(async (model: AccessTokenType) => {
      const instance = new AccessTokenModel(model)

      const results = await instance.mapWith(model)

      return new AccessTokenModel(results)
    }))

    return data
  }

  static async findOrFail(id: number): Promise<AccessTokenModel> {
    const model = await db.selectFrom('personal_access_tokens').where('id', '=', id).selectAll().executeTakeFirst()

    const instance = new AccessTokenModel(null)

    if (model === undefined)
      throw new HttpError(404, `No AccessTokenModel results for ${id}`)

    cache.getOrSet(`accesstoken:${id}`, JSON.stringify(model))

    const result = await instance.mapWith(model)

    const data = new AccessTokenModel(result as AccessTokenType)

    return data
  }

  async findOrFail(id: number): Promise<AccessTokenModel> {
    const model = await db.selectFrom('personal_access_tokens').where('id', '=', id).selectAll().executeTakeFirst()

    if (model === undefined)
      throw new HttpError(404, `No AccessTokenModel results for ${id}`)

    cache.getOrSet(`accesstoken:${id}`, JSON.stringify(model))

    const result = await this.mapWith(model)

    const data = new AccessTokenModel(result as AccessTokenType)

    return data
  }

  static async findMany(ids: number[]): Promise<AccessTokenModel[]> {
    let query = db.selectFrom('personal_access_tokens').where('id', 'in', ids)

    const instance = new AccessTokenModel(null)

    query = query.selectAll()

    const model = await query.execute()

    return model.map(modelItem => instance.parseResult(new AccessTokenModel(modelItem)))
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

  // Method to get a AccessToken by criteria
  async get(): Promise<AccessTokenModel[]> {
    if (this.hasSelect) {
      const model = await this.selectFromQuery.execute()

      return model.map((modelItem: AccessTokenModel) => new AccessTokenModel(modelItem))
    }

    const model = await this.selectFromQuery.selectAll().execute()

    return model.map((modelItem: AccessTokenModel) => new AccessTokenModel(modelItem))
  }

  static async count(): Promise<number> {
    const instance = new AccessTokenModel(null)

    const results = await instance.selectFromQuery.selectAll().execute()

    return results.length
  }

  async count(): Promise<number> {
    if (this.hasSelect) {
      const results = await this.selectFromQuery.execute()

      return results.length
    }

    const results = await this.selectFromQuery.execute()

    return results.length
  }

  // Method to get all personal_access_tokens
  static async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<AccessTokenResponse> {
    const totalRecordsResult = await db.selectFrom('personal_access_tokens')
      .select(db.fn.count('id').as('total')) // Use 'id' or another actual column name
      .executeTakeFirst()

    const totalRecords = Number(totalRecordsResult?.total) || 0
    const totalPages = Math.ceil(totalRecords / (options.limit ?? 10))

    const personal_access_tokensWithExtra = await db.selectFrom('personal_access_tokens')
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

  // Method to create a new accesstoken
  static async create(newAccessToken: NewAccessToken): Promise<AccessTokenModel> {
    const instance = new AccessTokenModel(null)

    const filteredValues = Object.fromEntries(
      Object.entries(newAccessToken).filter(([key]) => instance.fillable.includes(key)),
    ) as NewAccessToken

    const result = await db.insertInto('personal_access_tokens')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await find(Number(result.numInsertedOrUpdatedRows)) as AccessTokenModel

    return model
  }

  static async createMany(newPersonalAccessTokens: NewAccessToken[]): Promise<void> {
    const instance = new AccessTokenModel(null)

    const filteredValues = newPersonalAccessTokens.map(newUser =>
      Object.fromEntries(
        Object.entries(newUser).filter(([key]) => instance.fillable.includes(key)),
      ) as NewAccessToken,
    )

    await db.insertInto('personal_access_tokens')
      .values(filteredValues)
      .executeTakeFirst()
  }

  static async forceCreate(newAccessToken: NewAccessToken): Promise<AccessTokenModel> {
    const result = await db.insertInto('personal_access_tokens')
      .values(newAccessToken)
      .executeTakeFirst()

    const model = await find(Number(result.numInsertedOrUpdatedRows)) as AccessTokenModel

    return model
  }

  // Method to remove a AccessToken
  static async remove(id: number): Promise<any> {
    return await db.deleteFrom('personal_access_tokens')
      .where('id', '=', id)
      .execute()
  }

  where(...args: (string | number | boolean | undefined | null)[]): AccessTokenModel {
    let column: any
    let operator: any
    let value: any

    if (args.length === 2) {
      [column, value] = args
      operator = '='
    }
    else if (args.length === 3) {
      [column, operator, value] = args
    }
    else {
      throw new HttpError(500, 'Invalid number of arguments')
    }

    this.selectFromQuery = this.selectFromQuery.where(column, operator, value)

    this.updateFromQuery = this.updateFromQuery.where(column, operator, value)
    this.deleteFromQuery = this.deleteFromQuery.where(column, operator, value)

    return this
  }

  orWhere(...args: Array<[string, string, any]>): AccessTokenModel {
    if (args.length === 0) {
      throw new HttpError(500, 'At least one condition must be provided')
    }

    // Use the expression builder to append the OR conditions
    this.selectFromQuery = this.selectFromQuery.where((eb: any) =>
      eb.or(
        args.map(([column, operator, value]) => eb(column, operator, value)),
      ),
    )

    this.updateFromQuery = this.updateFromQuery.where((eb: any) =>
      eb.or(
        args.map(([column, operator, value]) => eb(column, operator, value)),
      ),
    )

    this.deleteFromQuery = this.deleteFromQuery.where((eb: any) =>
      eb.or(
        args.map(([column, operator, value]) => eb(column, operator, value)),
      ),
    )

    return this
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

  static where(...args: (string | number | boolean | undefined | null)[]): AccessTokenModel {
    let column: any
    let operator: any
    let value: any

    const instance = new AccessTokenModel(null)

    if (args.length === 2) {
      [column, value] = args
      operator = '='
    }
    else if (args.length === 3) {
      [column, operator, value] = args
    }
    else {
      throw new HttpError(500, 'Invalid number of arguments')
    }

    instance.selectFromQuery = instance.selectFromQuery.where(column, operator, value)

    instance.updateFromQuery = instance.updateFromQuery.where(column, operator, value)

    instance.deleteFromQuery = instance.deleteFromQuery.where(column, operator, value)

    return instance
  }

  static when(
    condition: boolean,
    callback: (query: any) => AccessTokenModel,
  ): AccessTokenModel {
    let instance = new AccessTokenModel(null)

    if (condition)
      instance = callback(instance)

    return instance
  }

  when(
    condition: boolean,
    callback: (query: any) => AccessTokenModel,
  ): AccessTokenModel {
    if (condition)
      callback(this.selectFromQuery)

    return this
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

  whereNull(column: string): AccessTokenModel {
    this.selectFromQuery = this.selectFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    this.updateFromQuery = this.updateFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    return this
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

  static whereIn(column: keyof AccessTokenType, values: any[]): AccessTokenModel {
    const instance = new AccessTokenModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where(column, 'in', values)

    instance.updateFromQuery = instance.updateFromQuery.where(column, 'in', values)

    instance.deleteFromQuery = instance.deleteFromQuery.where(column, 'in', values)

    return instance
  }

  async first(): Promise<AccessTokenModel | undefined> {
    const model = await this.selectFromQuery.selectAll().executeTakeFirst()

    if (!model)
      return undefined

    const result = await this.mapWith(model)

    const data = new AccessTokenModel(result as AccessTokenType)

    return data
  }

  async firstOrFail(): Promise<AccessTokenModel | undefined> {
    const model = await this.selectFromQuery.executeTakeFirst()

    if (model === undefined)
      throw new HttpError(404, 'No AccessTokenModel results found for query')

    const instance = new AccessTokenModel(null)

    const result = await instance.mapWith(model)

    const data = new AccessTokenModel(result as AccessTokenType)

    return data
  }

  async exists(): Promise<boolean> {
    const model = await this.selectFromQuery.executeTakeFirst()

    return model !== null || model !== undefined
  }

  static async first(): Promise<AccessTokenType | undefined> {
    const model = await db.selectFrom('personal_access_tokens')
      .selectAll()
      .executeTakeFirst()

    if (!model)
      return undefined

    const instance = new AccessTokenModel(null)

    const result = await instance.mapWith(model)

    const data = new AccessTokenModel(result as AccessTokenType)

    return data
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
    return await db.selectFrom('personal_access_tokens')
      .selectAll()
      .orderBy('id', 'desc')
      .executeTakeFirst()
  }

  static async last(): Promise<AccessTokenType | undefined> {
    const model = await db.selectFrom('personal_access_tokens').selectAll().orderBy('id', 'desc').executeTakeFirst()

    if (!model)
      return undefined

    const instance = new AccessTokenModel(null)

    const result = await instance.mapWith(model)

    const data = new AccessTokenModel(result as AccessTokenType)

    return data
  }

  static orderBy(column: keyof AccessTokenType, order: 'asc' | 'desc'): AccessTokenModel {
    const instance = new AccessTokenModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, order)

    return instance
  }

  orderBy(column: keyof AccessTokenType, order: 'asc' | 'desc'): AccessTokenModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, order)

    return this
  }

  static orderByDesc(column: keyof AccessTokenType): AccessTokenModel {
    const instance = new AccessTokenModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, 'desc')

    return instance
  }

  orderByDesc(column: keyof AccessTokenType): AccessTokenModel {
    this.selectFromQuery = this.orderBy(column, 'desc')

    return this
  }

  static orderByAsc(column: keyof AccessTokenType): AccessTokenModel {
    const instance = new AccessTokenModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, 'asc')

    return instance
  }

  orderByAsc(column: keyof AccessTokenType): AccessTokenModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, 'desc')

    return this
  }

  async update(accesstoken: AccessTokenUpdate): Promise<AccessTokenModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(accesstoken).filter(([key]) => this.fillable.includes(key)),
    ) as NewAccessToken

    if (this.id === undefined) {
      this.updateFromQuery.set(filteredValues).execute()
    }

    await db.updateTable('personal_access_tokens')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    const model = await this.find(this.id)

    return model
  }

  async forceUpdate(accesstoken: AccessTokenUpdate): Promise<AccessTokenModel | undefined> {
    if (this.id === undefined) {
      this.updateFromQuery.set(accesstoken).execute()
    }

    await db.updateTable('personal_access_tokens')
      .set(accesstoken)
      .where('id', '=', this.id)
      .executeTakeFirst()

    const model = await this.find(this.id)

    return model
  }

  async save(): Promise<void> {
    if (!this)
      throw new HttpError(500, 'AccessToken data is undefined')

    if (this.id === undefined) {
      await db.insertInto('personal_access_tokens')
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

    return await db.deleteFrom('personal_access_tokens')
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
    this.selectFromQuery = this.selectFromQuery(table, firstCol, secondCol)

    return this
  }

  static join(table: string, firstCol: string, secondCol: string): AccessTokenModel {
    const instance = new AccessTokenModel(null)

    instance.selectFromQuery = instance.selectFromQuery.innerJoin(table, firstCol, secondCol)

    return instance
  }

  static async rawQuery(rawQuery: string): Promise<any> {
    return await sql`${rawQuery}`.execute(db)
  }

  toJSON() {
    const output: Partial<AccessTokenType> = {
      team_id: this.team_id,
      team: this.team,

      id: this.id,
      name: this.name,
      token: this.token,
      plain_text_token: this.plain_text_token,
      abilities: this.abilities,

      created_at: this.created_at,

      updated_at: this.updated_at,

    }

        type AccessToken = Omit<AccessTokenType, 'password'>

        return output as AccessToken
  }

  parseResult(model: AccessTokenModel): AccessTokenModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof AccessTokenModel]
    }

    return model
  }
}

async function find(id: number): Promise<AccessTokenModel | undefined> {
  const query = db.selectFrom('personal_access_tokens').where('id', '=', id).selectAll()

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
  const result = await db.insertInto('personal_access_tokens')
    .values(newAccessToken)
    .executeTakeFirstOrThrow()

  return await find(Number(result.numInsertedOrUpdatedRows)) as AccessTokenModel
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(db)
}

export async function remove(id: number): Promise<void> {
  await db.deleteFrom('personal_access_tokens')
    .where('id', '=', id)
    .execute()
}

export async function whereName(value: string): Promise<AccessTokenModel[]> {
  const query = db.selectFrom('personal_access_tokens').where('name', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new AccessTokenModel(modelItem))
}

export async function whereToken(value: string): Promise<AccessTokenModel[]> {
  const query = db.selectFrom('personal_access_tokens').where('token', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new AccessTokenModel(modelItem))
}

export async function wherePlainTextToken(value: string): Promise<AccessTokenModel[]> {
  const query = db.selectFrom('personal_access_tokens').where('plain_text_token', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new AccessTokenModel(modelItem))
}

export async function whereAbilities(value: string[]): Promise<AccessTokenModel[]> {
  const query = db.selectFrom('personal_access_tokens').where('abilities', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new AccessTokenModel(modelItem))
}

export const AccessToken = AccessTokenModel

export default AccessToken
