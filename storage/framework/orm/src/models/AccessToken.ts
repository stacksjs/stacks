import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { Operator } from '@stacksjs/types'
import type { TeamModel } from './Team'
import type { UserModel } from './User'
import { sql } from '@stacksjs/database'
import { HttpError } from '@stacksjs/error-handling'

import { BaseOrm, DB } from '@stacksjs/orm'

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

  /**
   * This model inherits many query methods from BaseOrm:
   * - pluck, chunk, whereExists, has, doesntHave, whereHas, whereDoesntHave
   * - inRandomOrder, max, min, avg, paginate, get, and more
   *
   * See BaseOrm class for the full list of inherited methods.
   */

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

  async mapCustomSetters(model: NewAccessToken | AccessTokenUpdate): Promise<void> {
    const customSetter = {
      default: () => {
      },

    }

    for (const [key, fn] of Object.entries(customSetter)) {
      (model as any)[key] = await fn()
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

  static select(params: (keyof AccessTokenJsonResponse)[] | RawBuilder<string> | string): AccessTokenModel {
    const instance = new AccessTokenModel(undefined)

    return instance.applySelect(params)
  }

  // Method to find a AccessToken by ID
  static async find(id: number): Promise<AccessTokenModel | undefined> {
    const instance = new AccessTokenModel(undefined)

    return await instance.applyFind(id)
  }

  static async first(): Promise<AccessTokenModel | undefined> {
    const instance = new AccessTokenModel(undefined)

    const model = await instance.applyFirst()

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

  static async findOrFail(id: number): Promise<AccessTokenModel | undefined> {
    const instance = new AccessTokenModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  static async findMany(ids: number[]): Promise<AccessTokenModel[]> {
    const instance = new AccessTokenModel(undefined)

    const models = await instance.applyFindMany(ids)

    return models.map((modelItem: UserJsonResponse) => instance.parseResult(new AccessTokenModel(modelItem)))
  }

  static skip(count: number): AccessTokenModel {
    const instance = new AccessTokenModel(undefined)

    return instance.applySkip(count)
  }

  static take(count: number): AccessTokenModel {
    const instance = new AccessTokenModel(undefined)

    return instance.applyTake(count)
  }

  static where<V = string>(column: keyof PersonalAccessTokensTable, ...args: [V] | [Operator, V]): AccessTokenModel {
    const instance = new AccessTokenModel(undefined)

    return instance.applyWhere<V>(column, ...args)
  }

  static orWhere(...conditions: [string, any][]): AccessTokenModel {
    const instance = new AccessTokenModel(undefined)

    return instance.applyOrWhere(...conditions)
  }

  static whereNotIn<V = number>(column: keyof PersonalAccessTokensTable, values: V[]): AccessTokenModel {
    const instance = new AccessTokenModel(undefined)

    return instance.applyWhereNotIn<V>(column, values)
  }

  static whereBetween<V = number>(column: keyof PersonalAccessTokensTable, range: [V, V]): AccessTokenModel {
    const instance = new AccessTokenModel(undefined)

    return instance.applyWhereBetween<V>(column, range)
  }

  static whereRef(column: keyof PersonalAccessTokensTable, ...args: string[]): AccessTokenModel {
    const instance = new AccessTokenModel(undefined)

    return instance.applyWhereRef(column, ...args)
  }

  static when(condition: boolean, callback: (query: AccessTokenModel) => AccessTokenModel): AccessTokenModel {
    const instance = new AccessTokenModel(undefined)

    return instance.applyWhen(condition, callback as any)
  }

  static whereLike(column: keyof PersonalAccessTokensTable, value: string): AccessTokenModel {
    const instance = new AccessTokenModel(undefined)

    return instance.applyWhereLike(column, value)
  }

  static orderBy(column: keyof PersonalAccessTokensTable, order: 'asc' | 'desc'): AccessTokenModel {
    const instance = new AccessTokenModel(undefined)

    return instance.applyOrderBy(column, order)
  }

  static orderByAsc(column: keyof PersonalAccessTokensTable): AccessTokenModel {
    const instance = new AccessTokenModel(undefined)

    return instance.applyOrderByAsc(column)
  }

  static orderByDesc(column: keyof PersonalAccessTokensTable): AccessTokenModel {
    const instance = new AccessTokenModel(undefined)

    return instance.applyOrderByDesc(column)
  }

  static inRandomOrder(): AccessTokenModel {
    const instance = new AccessTokenModel(undefined)

    return instance.applyInRandomOrder()
  }

  static whereColumn(first: keyof PersonalAccessTokensTable, operator: Operator, second: keyof PersonalAccessTokensTable): AccessTokenModel {
    const instance = new AccessTokenModel(undefined)

    return instance.applyWhereColumn(first, operator, second)
  }

  static async max(field: keyof PersonalAccessTokensTable): Promise<number> {
    const instance = new AccessTokenModel(undefined)

    return await instance.applyMax(field)
  }

  static async min(field: keyof PersonalAccessTokensTable): Promise<number> {
    const instance = new AccessTokenModel(undefined)

    return await instance.applyMin(field)
  }

  static async avg(field: keyof PersonalAccessTokensTable): Promise<number> {
    const instance = new AccessTokenModel(undefined)

    return await instance.applyAvg(field)
  }

  static async sum(field: keyof PersonalAccessTokensTable): Promise<number> {
    const instance = new AccessTokenModel(undefined)

    return await instance.applySum(field)
  }

  static async count(): Promise<number> {
    const instance = new AccessTokenModel(undefined)

    return instance.applyCount()
  }

  static async get(): Promise<AccessTokenModel[]> {
    const instance = new AccessTokenModel(undefined)

    const results = await instance.applyGet()

    return results.map((item: AccessTokenJsonResponse) => new AccessTokenModel(item))
  }

  static async pluck<K extends keyof AccessTokenModel>(field: K): Promise<AccessTokenModel[K][]> {
    const instance = new AccessTokenModel(undefined)

    return await instance.applyPluck(field)
  }

  static async chunk(size: number, callback: (models: AccessTokenModel[]) => Promise<void>): Promise<void> {
    const instance = new AccessTokenModel(undefined)

    await instance.applyChunk(size, async (models) => {
      const modelInstances = models.map((item: AccessTokenJsonResponse) => new AccessTokenModel(item))
      await callback(modelInstances)
    })
  }

  static async paginate(options: { limit?: number, offset?: number, page?: number } = { limit: 10, offset: 0, page: 1 }): Promise<{
    data: AccessTokenModel[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }> {
    const instance = new AccessTokenModel(undefined)

    const result = await instance.applyPaginate(options)

    return {
      data: result.data.map((item: AccessTokenJsonResponse) => new AccessTokenModel(item)),
      paging: result.paging,
      next_cursor: result.next_cursor,
    }
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

  static async firstOrCreate(search: Partial<PersonalAccessTokensTable>, values: NewAccessToken = {} as NewAccessToken): Promise<AccessTokenModel> {
    // First try to find a record matching the search criteria
    const instance = new AccessTokenModel(undefined)

    // Apply all search conditions
    for (const [key, value] of Object.entries(search)) {
      instance.selectFromQuery = instance.selectFromQuery.where(key, '=', value)
    }

    // Try to find the record
    const existingRecord = await instance.applyFirst()

    if (existingRecord) {
      return new AccessTokenModel(existingRecord)
    }

    // If no record exists, create a new one with combined search criteria and values
    const createData = { ...search, ...values } as NewAccessToken
    return await AccessTokenModel.create(createData)
  }

  async update(newAccessToken: AccessTokenUpdate): Promise<AccessTokenModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newAccessToken).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as AccessTokenUpdate

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

  async forceUpdate(newAccessToken: AccessTokenUpdate): Promise<AccessTokenModel | undefined> {
    await DB.instance.updateTable('personal_access_tokens')
      .set(newAccessToken)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      const model = await this.find(this.id)

      return model
    }

    return undefined
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
