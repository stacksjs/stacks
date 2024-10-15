import type { Generated, Insertable, Selectable, Updateable } from 'kysely'
import { cache } from '@stacksjs/cache'
import { db, sql } from '@stacksjs/database'
import { HttpError } from '@stacksjs/error-handling'
import Team from './Team'

// import { Kysely, MysqlDialect, PostgresDialect } from 'kysely'
// import { Pool } from 'pg'

export interface PersonalAccessTokensTable {
  id: Generated<number>
  name?: string
  token?: string
  plain_text_token?: string
  abilities?: string[]
  team_id?: number

  created_at?: Date

  updated_at?: Date

  deleted_at?: Date

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
export type NewAccessToken = Insertable<PersonalAccessTokensTable>
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
  private fillable = []
  private softDeletes = false
  protected query: any
  protected hasSelect: boolean
  public id: number | undefined
  public name: string | undefined
  public token: string | undefined
  public plain_text_token: string | undefined
  public abilities: string[] | undefined

  public created_at: Date | undefined
  public updated_at: Date | undefined
  public team_id: number | undefined

  constructor(accesstoken: Partial<AccessTokenType> | null) {
    this.id = accesstoken?.id
    this.name = accesstoken?.name
    this.token = accesstoken?.token
    this.plain_text_token = accesstoken?.plain_text_token
    this.abilities = accesstoken?.abilities

    this.created_at = accesstoken?.created_at

    this.updated_at = accesstoken?.updated_at

    this.team_id = accesstoken?.team_id

    this.query = db.selectFrom('personal_access_tokens')
    this.hasSelect = false
  }

  // Method to find a AccessToken by ID
  async find(id: number): Promise<AccessTokenModel | undefined> {
    const query = db.selectFrom('personal_access_tokens').where('id', '=', id).selectAll()

    const model = await query.executeTakeFirst()

    if (!model)
      return undefined

    cache.getOrSet(`accesstoken:${id}`, JSON.stringify(model))

    return this.parseResult(new AccessTokenModel(model))
  }

  // Method to find a AccessToken by ID
  static async find(id: number): Promise<AccessTokenModel | undefined> {
    const query = db.selectFrom('personal_access_tokens').where('id', '=', id).selectAll()

    const instance = new AccessTokenModel(null)

    const model = await query.executeTakeFirst()

    if (!model)
      return undefined

    cache.getOrSet(`accesstoken:${id}`, JSON.stringify(model))

    return instance.parseResult(new AccessTokenModel(model))
  }

  static async all(): Promise<AccessTokenModel[]> {
    let query = db.selectFrom('personal_access_tokens').selectAll()

    const instance = new AccessTokenModel(null)

    if (instance.softDeletes) {
      query = query.where('deleted_at', 'is', null)
    }

    const results = await query.execute()

    return results.map(modelItem => instance.parseResult(new AccessTokenModel(modelItem)))
  }

  static async findOrFail(id: number): Promise<AccessTokenModel> {
    let query = db.selectFrom('personal_access_tokens').where('id', '=', id)

    const instance = new AccessTokenModel(null)

    if (instance.softDeletes) {
      query = query.where('deleted_at', 'is', null)
    }

    query = query.selectAll()

    const model = await query.executeTakeFirst()

    if (model === undefined)
      throw new HttpError(404, `No AccessTokenModel results for ${id}`)

    cache.getOrSet(`accesstoken:${id}`, JSON.stringify(model))

    return instance.parseResult(new AccessTokenModel(model))
  }

  static async findMany(ids: number[]): Promise<AccessTokenModel[]> {
    let query = db.selectFrom('personal_access_tokens').where('id', 'in', ids)

    const instance = new AccessTokenModel(null)

    if (instance.softDeletes) {
      query = query.where('deleted_at', 'is', null)
    }

    query = query.selectAll()

    const model = await query.execute()

    return model.map(modelItem => instance.parseResult(new AccessTokenModel(modelItem)))
  }

  // Method to get a User by criteria
  static async get(): Promise<UserModel[]> {
    const instance = new AccessTokenModel(null)

    if (instance.hasSelect) {
      if (instance.softDeletes) {
        instance.query = instance.query.where('deleted_at', 'is', null)
      }

      const model = await instance.query.execute()

      return model.map((modelItem: AccessTokenModel) => new AccessTokenModel(modelItem))
    }

    if (instance.softDeletes) {
      instance.query = instance.query.where('deleted_at', 'is', null)
    }

    const model = await instance.query.selectAll().execute()

    return model.map((modelItem: AccessTokenModel) => new AccessTokenModel(modelItem))
  }

  // Method to get a AccessToken by criteria
  async get(): Promise<AccessTokenModel[]> {
    if (this.hasSelect) {
      if (this.softDeletes) {
        this.query = this.query.where('deleted_at', 'is', null)
      }

      const model = await this.query.execute()

      return model.map((modelItem: AccessTokenModel) => new AccessTokenModel(modelItem))
    }

    if (this.softDeletes) {
      this.query = this.query.where('deleted_at', 'is', null)
    }

    const model = await this.query.selectAll().execute()

    return model.map((modelItem: AccessTokenModel) => new AccessTokenModel(modelItem))
  }

  static async count(): Promise<number> {
    const instance = new AccessTokenModel(null)

    if (instance.softDeletes) {
      instance.query = instance.query.where('deleted_at', 'is', null)
    }

    const results = await instance.query.selectAll().execute()

    return results.length
  }

  async count(): Promise<number> {
    if (this.hasSelect) {
      if (this.softDeletes) {
        this.query = this.query.where('deleted_at', 'is', null)
      }

      const results = await this.query.execute()

      return results.length
    }

    const results = await this.query.selectAll().execute()

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

    const model = await find(Number(result.insertId)) as AccessTokenModel

    return model
  }

  static async forceCreate(newAccessToken: NewAccessToken): Promise<AccessTokenModel> {
    const result = await db.insertInto('personal_access_tokens')
      .values(newAccessToken)
      .executeTakeFirst()

    const model = await find(Number(result.insertId)) as AccessTokenModel

    return model
  }

  // Method to remove a AccessToken
  static async remove(id: number): Promise<void> {
    const instance = new AccessTokenModel(null)

    if (instance.softDeletes) {
      await db.updateTable('personal_access_tokens')
        .set({
          deleted_at: sql.raw('CURRENT_TIMESTAMP'),
        })
        .where('id', '=', id)
        .execute()
    }
    else {
      await db.deleteFrom('personal_access_tokens')
        .where('id', '=', id)
        .execute()
    }
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

    this.query = this.query.where(column, operator, value)

    return this
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

    instance.query = instance.query.where(column, operator, value)

    return instance
  }

  static whereName(value: string): AccessTokenModel {
    const instance = new AccessTokenModel(null)

    instance.query = instance.query.where('name', '=', value)

    return instance
  }

  static whereToken(value: string): AccessTokenModel {
    const instance = new AccessTokenModel(null)

    instance.query = instance.query.where('token', '=', value)

    return instance
  }

  static wherePlainTextToken(value: string): AccessTokenModel {
    const instance = new AccessTokenModel(null)

    instance.query = instance.query.where('plainTextToken', '=', value)

    return instance
  }

  static whereAbilities(value: string): AccessTokenModel {
    const instance = new AccessTokenModel(null)

    instance.query = instance.query.where('abilities', '=', value)

    return instance
  }

  static whereIn(column: keyof AccessTokenType, values: any[]): AccessTokenModel {
    const instance = new AccessTokenModel(null)

    instance.query = instance.query.where(column, 'in', values)

    return instance
  }

  async first(): Promise<AccessTokenModel | undefined> {
    const model = await this.query.selectAll().executeTakeFirst()

    if (!model) {
      return undefined
    }

    return this.parseResult(new AccessTokenModel(model))
  }

  async firstOrFail(): Promise<AccessTokenModel | undefined> {
    const model = await this.query.selectAll().executeTakeFirst()

    if (model === undefined)
      throw new HttpError(404, 'No AccessTokenModel results found for query')

    return this.parseResult(new AccessTokenModel(model))
  }

  async exists(): Promise<boolean> {
    const model = await this.query.selectAll().executeTakeFirst()

    return model !== null || model !== undefined
  }

  static async first(): Promise<AccessTokenType | undefined> {
    return await db.selectFrom('personal_access_tokens')
      .selectAll()
      .executeTakeFirst()
  }

  async last(): Promise<AccessTokenType | undefined> {
    return await db.selectFrom('personal_access_tokens')
      .selectAll()
      .orderBy('id', 'desc')
      .executeTakeFirst()
  }

  static async last(): Promise<AccessTokenType | undefined> {
    return await db.selectFrom('personal_access_tokens').selectAll().orderBy('id', 'desc').executeTakeFirst()
  }

  static orderBy(column: keyof AccessTokenType, order: 'asc' | 'desc'): AccessTokenModel {
    const instance = new AccessTokenModel(null)

    instance.query = instance.query.orderBy(column, order)

    return instance
  }

  orderBy(column: keyof AccessTokenType, order: 'asc' | 'desc'): AccessTokenModel {
    this.query = this.query.orderBy(column, order)

    return this
  }

  static orderByDesc(column: keyof AccessTokenType): AccessTokenModel {
    const instance = new AccessTokenModel(null)

    instance.query = instance.query.orderBy(column, 'desc')

    return instance
  }

  orderByDesc(column: keyof AccessTokenType): AccessTokenModel {
    this.query = this.orderBy(column, 'desc')

    return this
  }

  static orderByAsc(column: keyof AccessTokenType): AccessTokenModel {
    const instance = new AccessTokenModel(null)

    instance.query = instance.query.orderBy(column, 'asc')

    return instance
  }

  orderByAsc(column: keyof AccessTokenType): AccessTokenModel {
    this.query = this.query.orderBy(column, 'desc')

    return this
  }

  async update(accesstoken: AccessTokenUpdate): Promise<AccessTokenModel | undefined> {
    if (this.id === undefined)
      throw new HttpError(500, 'AccessToken ID is undefined')

    const filteredValues = Object.fromEntries(
      Object.entries(accesstoken).filter(([key]) => this.fillable.includes(key)),
    ) as NewAccessToken

    await db.updateTable('personal_access_tokens')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    const model = await this.find(Number(this.id))

    return model
  }

  async forceUpdate(accesstoken: AccessTokenUpdate): Promise<AccessTokenModel | undefined> {
    if (this.id === undefined)
      throw new HttpError(500, 'AccessToken ID is undefined')

    await db.updateTable('personal_access_tokens')
      .set(accesstoken)
      .where('id', '=', this.id)
      .executeTakeFirst()

    const model = await this.find(Number(this.id))

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
  async delete(): Promise<void> {
    if (this.id === undefined)
      throw new HttpError(500, 'AccessToken ID is undefined')

    // Check if soft deletes are enabled
    if (this.softDeletes) {
      // Update the deleted_at column with the current timestamp
      await db.updateTable('personal_access_tokens')
        .set({
          deleted_at: sql.raw('CURRENT_TIMESTAMP'),
        })
        .where('id', '=', this.id)
        .execute()
    }
    else {
      // Perform a hard delete
      await db.deleteFrom('personal_access_tokens')
        .where('id', '=', this.id)
        .execute()
    }
  }

  async team() {
    if (this.id === undefined)
      throw new HttpError(500, 'Relation Error!')

    const model = Team
      .where('accesstoken_id', '=', this.id)
      .first()

    if (!model)
      throw new HttpError(500, 'Model Relation Not Found!')

    return model
  }

  distinct(column: keyof AccessTokenType): AccessTokenModel {
    this.query = this.query.select(column).distinct()

    this.hasSelect = true

    return this
  }

  static distinct(column: keyof AccessTokenType): AccessTokenModel {
    const instance = new AccessTokenModel(null)

    instance.query = instance.query.select(column).distinct()

    instance.hasSelect = true

    return instance
  }

  join(table: string, firstCol: string, secondCol: string): AccessTokenModel {
    this.query = this.query.innerJoin(table, firstCol, secondCol)

    return this
  }

  static join(table: string, firstCol: string, secondCol: string): AccessTokenModel {
    const instance = new AccessTokenModel(null)

    instance.query = instance.query.innerJoin(table, firstCol, secondCol)

    return instance
  }

  static async rawQuery(rawQuery: string): Promise<any> {
    return await sql`${rawQuery}`.execute(db)
  }

  toJSON() {
    const output: Partial<AccessTokenType> = {

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

  return await find(Number(result.insertId)) as AccessTokenModel
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
