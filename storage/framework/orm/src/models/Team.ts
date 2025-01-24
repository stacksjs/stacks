import type { Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { AccessTokenModel } from './AccessToken'
import { cache } from '@stacksjs/cache'
import { db, sql } from '@stacksjs/database'
import { HttpError } from '@stacksjs/error-handling'

import AccessToken from './AccessToken'

import User from './User'

export interface TeamsTable {
  id?: number
  personal_access_tokens?: AccessTokenModel[] | undefined
  name?: string
  company_name?: string
  email?: string
  billing_email?: string
  status?: string
  description?: string
  path?: string
  is_personal?: boolean

  created_at?: Date

  updated_at?: Date

}

interface TeamResponse {
  data: TeamJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface TeamJsonResponse extends Omit<TeamsTable, 'password'> {
  [key: string]: any
}

export type TeamType = Selectable<TeamsTable>
export type NewTeam = Partial<Insertable<TeamsTable>>
export type TeamUpdate = Updateable<TeamsTable>

      type SortDirection = 'asc' | 'desc'
interface SortOptions { column: TeamType, order: SortDirection }
// Define a type for the options parameter
interface QueryOptions {
  sort?: SortOptions
  limit?: number
  offset?: number
  page?: number
}

export class TeamModel {
  private readonly hidden: Array<keyof TeamJsonResponse> = []
  private readonly fillable: Array<keyof TeamJsonResponse> = ['name', 'company_name', 'email', 'billing_email', 'status', 'description', 'path', 'is_personal', 'uuid']

  protected selectFromQuery: any
  protected withRelations: string[]
  protected updateFromQuery: any
  protected deleteFromQuery: any
  protected hasSelect: boolean
  private customColumns: Record<string, unknown> = {}
  public personal_access_tokens: AccessTokenModel[] | undefined
  public id: number | undefined
  public name: string | undefined
  public company_name: string | undefined
  public email: string | undefined
  public billing_email: string | undefined
  public status: string | undefined
  public description: string | undefined
  public path: string | undefined
  public is_personal: boolean | undefined

  public created_at: Date | undefined
  public updated_at: Date | undefined

  constructor(team: Partial<TeamType> | null) {
    if (team) {
      this.personal_access_tokens = team?.personal_access_tokens
      this.id = team?.id || 1
      this.name = team?.name
      this.company_name = team?.company_name
      this.email = team?.email
      this.billing_email = team?.billing_email
      this.status = team?.status
      this.description = team?.description
      this.path = team?.path
      this.is_personal = team?.is_personal

      this.created_at = team?.created_at

      this.updated_at = team?.updated_at

      Object.keys(team).forEach((key) => {
        if (!(key in this)) {
          this.customColumns[key] = (team as TeamJsonResponse)[key]
        }
      })
    }

    this.withRelations = []
    this.selectFromQuery = db.selectFrom('teams')
    this.updateFromQuery = db.updateTable('teams')
    this.deleteFromQuery = db.deleteFrom('teams')
    this.hasSelect = false
  }

  static select(params: (keyof TeamType)[] | RawBuilder<string>): TeamModel {
    const instance = new TeamModel(null)

    // Initialize a query with the table name and selected fields
    instance.selectFromQuery = instance.selectFromQuery.select(params)

    instance.hasSelect = true

    return instance
  }

  // Method to find a Team by ID
  async find(id: number): Promise<TeamModel | undefined> {
    const query = db.selectFrom('teams').where('id', '=', id).selectAll()

    const model = await query.executeTakeFirst()

    if (!model)
      return undefined

    const result = await this.mapWith(model)

    const data = new TeamModel(result as TeamType)

    cache.getOrSet(`team:${id}`, JSON.stringify(model))

    return data
  }

  // Method to find a Team by ID
  static async find(id: number): Promise<TeamModel | undefined> {
    const model = await db.selectFrom('teams').where('id', '=', id).selectAll().executeTakeFirst()

    if (!model)
      return undefined

    const instance = new TeamModel(null)

    const result = await instance.mapWith(model)

    const data = new TeamModel(result as TeamType)

    cache.getOrSet(`team:${id}`, JSON.stringify(model))

    return data
  }

  async mapWith(model: TeamType): Promise<TeamType> {
    if (this.withRelations.includes('personal_access_tokens')) {
      model.personal_access_tokens = await this.personalAccessTokensHasMany()
    }

    return model
  }

  static async all(): Promise<TeamModel[]> {
    const models = await db.selectFrom('teams').selectAll().execute()

    const data = await Promise.all(models.map(async (model: TeamType) => {
      const instance = new TeamModel(model)

      const results = await instance.mapWith(model)

      return new TeamModel(results)
    }))

    return data
  }

  static async findOrFail(id: number): Promise<TeamModel> {
    const model = await db.selectFrom('teams').where('id', '=', id).selectAll().executeTakeFirst()

    const instance = new TeamModel(null)

    if (model === undefined)
      throw new HttpError(404, `No TeamModel results for ${id}`)

    cache.getOrSet(`team:${id}`, JSON.stringify(model))

    const result = await instance.mapWith(model)

    const data = new TeamModel(result as TeamType)

    return data
  }

  async findOrFail(id: number): Promise<TeamModel> {
    const model = await db.selectFrom('teams').where('id', '=', id).selectAll().executeTakeFirst()

    if (model === undefined)
      throw new HttpError(404, `No TeamModel results for ${id}`)

    cache.getOrSet(`team:${id}`, JSON.stringify(model))

    const result = await this.mapWith(model)

    const data = new TeamModel(result as TeamType)

    return data
  }

  static async findMany(ids: number[]): Promise<TeamModel[]> {
    let query = db.selectFrom('teams').where('id', 'in', ids)

    const instance = new TeamModel(null)

    query = query.selectAll()

    const model = await query.execute()

    return model.map(modelItem => instance.parseResult(new TeamModel(modelItem)))
  }

  static async get(): Promise<TeamModel[]> {
    const instance = new TeamModel(null)

    let models

    if (instance.hasSelect) {
      models = await instance.selectFromQuery.execute()
    }
    else {
      models = await instance.selectFromQuery.selectAll().execute()
    }

    const data = await Promise.all(models.map(async (model: TeamModel) => {
      const instance = new TeamModel(model)

      const results = await instance.mapWith(model)

      return new TeamModel(results)
    }))

    return data
  }

  // Method to get a Team by criteria
  async get(): Promise<TeamModel[]> {
    if (this.hasSelect) {
      const model = await this.selectFromQuery.execute()

      return model.map((modelItem: TeamModel) => new TeamModel(modelItem))
    }

    const model = await this.selectFromQuery.selectAll().execute()

    return model.map((modelItem: TeamModel) => new TeamModel(modelItem))
  }

  static async count(): Promise<number> {
    const instance = new TeamModel(null)

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

  async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<TeamResponse> {
    const totalRecordsResult = await db.selectFrom('teams')
      .select(db.fn.count('id').as('total')) // Use 'id' or another actual column name
      .executeTakeFirst()

    const totalRecords = Number(totalRecordsResult?.total) || 0
    const totalPages = Math.ceil(totalRecords / (options.limit ?? 10))

    if (this.hasSelect) {
      const teamsWithExtra = await this.selectFromQuery.orderBy('id', 'asc')
        .limit((options.limit ?? 10) + 1)
        .offset(((options.page ?? 1) - 1) * (options.limit ?? 10)) // Ensure options.page is not undefined
        .execute()

      let nextCursor = null
      if (teamsWithExtra.length > (options.limit ?? 10))
        nextCursor = teamsWithExtra.pop()?.id ?? null

      return {
        data: teamsWithExtra,
        paging: {
          total_records: totalRecords,
          page: options.page || 1,
          total_pages: totalPages,
        },
        next_cursor: nextCursor,
      }
    }

    const teamsWithExtra = await this.selectFromQuery.orderBy('id', 'asc')
      .limit((options.limit ?? 10) + 1)
      .offset(((options.page ?? 1) - 1) * (options.limit ?? 10)) // Ensure options.page is not undefined
      .execute()

    let nextCursor = null
    if (teamsWithExtra.length > (options.limit ?? 10))
      nextCursor = teamsWithExtra.pop()?.id ?? null

    return {
      data: teamsWithExtra,
      paging: {
        total_records: totalRecords,
        page: options.page || 1,
        total_pages: totalPages,
      },
      next_cursor: nextCursor,
    }
  }

  // Method to get all teams
  static async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<TeamResponse> {
    const totalRecordsResult = await db.selectFrom('teams')
      .select(db.fn.count('id').as('total')) // Use 'id' or another actual column name
      .executeTakeFirst()

    const totalRecords = Number(totalRecordsResult?.total) || 0
    const totalPages = Math.ceil(totalRecords / (options.limit ?? 10))

    const teamsWithExtra = await db.selectFrom('teams')
      .selectAll()
      .orderBy('id', 'asc') // Assuming 'id' is used for cursor-based pagination
      .limit((options.limit ?? 10) + 1) // Fetch one extra record
      .offset(((options.page ?? 1) - 1) * (options.limit ?? 10)) // Ensure options.page is not undefined
      .execute()

    let nextCursor = null
    if (teamsWithExtra.length > (options.limit ?? 10))
      nextCursor = teamsWithExtra.pop()?.id ?? null

    return {
      data: teamsWithExtra,
      paging: {
        total_records: totalRecords,
        page: options.page || 1,
        total_pages: totalPages,
      },
      next_cursor: nextCursor,
    }
  }

  // Method to create a new team
  static async create(newTeam: NewTeam): Promise<TeamModel> {
    const instance = new TeamModel(null)

    const filteredValues = Object.fromEntries(
      Object.entries(newTeam).filter(([key]) => instance.fillable.includes(key)),
    ) as NewTeam

    const result = await db.insertInto('teams')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await find(Number(result.numInsertedOrUpdatedRows)) as TeamModel

    return model
  }

  static async createMany(newTeams: NewTeam[]): Promise<void> {
    const instance = new TeamModel(null)

    const filteredValues = newTeams.map(newUser =>
      Object.fromEntries(
        Object.entries(newUser).filter(([key]) => instance.fillable.includes(key)),
      ) as NewTeam,
    )

    await db.insertInto('teams')
      .values(filteredValues)
      .executeTakeFirst()
  }

  static async forceCreate(newTeam: NewTeam): Promise<TeamModel> {
    const result = await db.insertInto('teams')
      .values(newTeam)
      .executeTakeFirst()

    const model = await find(Number(result.numInsertedOrUpdatedRows)) as TeamModel

    return model
  }

  // Method to remove a Team
  static async remove(id: number): Promise<any> {
    return await db.deleteFrom('teams')
      .where('id', '=', id)
      .execute()
  }

  where(...args: (string | number | boolean | undefined | null)[]): TeamModel {
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

  orWhere(...args: Array<[string, string, any]>): TeamModel {
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

  static orWhere(...args: Array<[string, string, any]>): TeamModel {
    const instance = new TeamModel(null)

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

  static where(...args: (string | number | boolean | undefined | null)[]): TeamModel {
    let column: any
    let operator: any
    let value: any

    const instance = new TeamModel(null)

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
    callback: (query: TeamModel) => TeamModel,
  ): TeamModel {
    let instance = new TeamModel(null)

    if (condition)
      instance = callback(instance)

    return instance
  }

  when(
    condition: boolean,
    callback: (query: TeamModel) => TeamModel,
  ): TeamModel {
    if (condition)
      callback(this.selectFromQuery)

    return this
  }

  static whereNull(column: string): TeamModel {
    const instance = new TeamModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    instance.updateFromQuery = instance.updateFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    return instance
  }

  whereNull(column: string): TeamModel {
    this.selectFromQuery = this.selectFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    this.updateFromQuery = this.updateFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    return this
  }

  static whereName(value: string): TeamModel {
    const instance = new TeamModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('name', '=', value)

    return instance
  }

  static whereCompanyName(value: string): TeamModel {
    const instance = new TeamModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('companyName', '=', value)

    return instance
  }

  static whereEmail(value: string): TeamModel {
    const instance = new TeamModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('email', '=', value)

    return instance
  }

  static whereBillingEmail(value: string): TeamModel {
    const instance = new TeamModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('billingEmail', '=', value)

    return instance
  }

  static whereStatus(value: string): TeamModel {
    const instance = new TeamModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('status', '=', value)

    return instance
  }

  static whereDescription(value: string): TeamModel {
    const instance = new TeamModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('description', '=', value)

    return instance
  }

  static wherePath(value: string): TeamModel {
    const instance = new TeamModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('path', '=', value)

    return instance
  }

  static whereIsPersonal(value: string): TeamModel {
    const instance = new TeamModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('isPersonal', '=', value)

    return instance
  }

  whereIn(column: keyof TeamType, values: any[]): TeamModel {
    this.selectFromQuery = this.selectFromQuery.where(column, 'in', values)

    this.updateFromQuery = this.updateFromQuery.where(column, 'in', values)

    this.deleteFromQuery = this.deleteFromQuery.where(column, 'in', values)

    return this
  }

  static whereIn(column: keyof TeamType, values: any[]): TeamModel {
    const instance = new TeamModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where(column, 'in', values)

    instance.updateFromQuery = instance.updateFromQuery.where(column, 'in', values)

    instance.deleteFromQuery = instance.deleteFromQuery.where(column, 'in', values)

    return instance
  }

  static whereBetween(column: keyof TeamType, range: [any, any]): TeamModel {
    if (range.length !== 2) {
      throw new Error('Range must have exactly two values: [min, max]')
    }

    const instance = new TeamModel(null)

    const query = sql` ${sql.raw(column as string)} between ${range[0]} and ${range[1]} `

    instance.selectFromQuery = instance.selectFromQuery.where(query)
    instance.updateFromQuery = instance.updateFromQuery.where(query)
    instance.deleteFromQuery = instance.deleteFromQuery.where(query)

    return instance
  }

  static whereNotIn(column: keyof TeamType, values: any[]): TeamModel {
    const instance = new TeamModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where(column, 'not in', values)

    instance.updateFromQuery = instance.updateFromQuery.where(column, 'not in', values)

    instance.deleteFromQuery = instance.deleteFromQuery.where(column, 'not in', values)

    return instance
  }

  whereNotIn(column: keyof TeamType, values: any[]): TeamModel {
    this.selectFromQuery = this.selectFromQuery.where(column, 'not in', values)

    this.updateFromQuery = this.updateFromQuery.where(column, 'not in', values)

    this.deleteFromQuery = this.deleteFromQuery.where(column, 'not in', values)

    return this
  }

  async first(): Promise<TeamModel | undefined> {
    const model = await this.selectFromQuery.selectAll().executeTakeFirst()

    if (!model)
      return undefined

    const result = await this.mapWith(model)

    const data = new TeamModel(result as TeamType)

    return data
  }

  async firstOrFail(): Promise<TeamModel | undefined> {
    const model = await this.selectFromQuery.executeTakeFirst()

    if (model === undefined)
      throw new HttpError(404, 'No TeamModel results found for query')

    const instance = new TeamModel(null)

    const result = await instance.mapWith(model)

    const data = new TeamModel(result as TeamType)

    return data
  }

  async exists(): Promise<boolean> {
    const model = await this.selectFromQuery.executeTakeFirst()

    return model !== null || model !== undefined
  }

  static async first(): Promise<TeamType | undefined> {
    const model = await db.selectFrom('teams')
      .selectAll()
      .executeTakeFirst()

    if (!model)
      return undefined

    const instance = new TeamModel(null)

    const result = await instance.mapWith(model)

    const data = new TeamModel(result as TeamType)

    return data
  }

  static async firstOrCreate(
    condition: Partial<TeamType>,
    newTeam: NewTeam,
  ): Promise<TeamModel> {
    // Get the key and value from the condition object
    const key = Object.keys(condition)[0] as keyof TeamType

    if (!key) {
      throw new Error('Condition must contain at least one key-value pair')
    }

    const value = condition[key]

    // Attempt to find the first record matching the condition
    const existingTeam = await db.selectFrom('teams')
      .selectAll()
      .where(key, '=', value)
      .executeTakeFirst()

    if (existingTeam) {
      const instance = new TeamModel(null)
      const result = await instance.mapWith(existingTeam)
      return new TeamModel(result as TeamType)
    }
    else {
      // If not found, create a new user
      return await this.create(newTeam)
    }
  }

  static async updateOrCreate(
    condition: Partial<TeamType>,
    newTeam: NewTeam,
  ): Promise<TeamModel> {
    const key = Object.keys(condition)[0] as keyof TeamType

    if (!key) {
      throw new Error('Condition must contain at least one key-value pair')
    }

    const value = condition[key]

    // Attempt to find the first record matching the condition
    const existingTeam = await db.selectFrom('teams')
      .selectAll()
      .where(key, '=', value)
      .executeTakeFirst()

    if (existingTeam) {
      // If found, update the existing record
      await db.updateTable('teams')
        .set(newTeam)
        .where(key, '=', value)
        .executeTakeFirstOrThrow()

      // Fetch and return the updated record
      const updatedTeam = await db.selectFrom('teams')
        .selectAll()
        .where(key, '=', value)
        .executeTakeFirst()

      if (!updatedTeam) {
        throw new Error('Failed to fetch updated record')
      }

      const instance = new TeamModel(null)
      const result = await instance.mapWith(updatedTeam)
      return new TeamModel(result as TeamType)
    }
    else {
      // If not found, create a new record
      return await this.create(newTeam)
    }
  }

  with(relations: string[]): TeamModel {
    this.withRelations = relations

    return this
  }

  static with(relations: string[]): TeamModel {
    const instance = new TeamModel(null)

    instance.withRelations = relations

    return instance
  }

  async last(): Promise<TeamType | undefined> {
    return await db.selectFrom('teams')
      .selectAll()
      .orderBy('id', 'desc')
      .executeTakeFirst()
  }

  static async last(): Promise<TeamType | undefined> {
    const model = await db.selectFrom('teams').selectAll().orderBy('id', 'desc').executeTakeFirst()

    if (!model)
      return undefined

    const instance = new TeamModel(null)

    const result = await instance.mapWith(model)

    const data = new TeamModel(result as TeamType)

    return data
  }

  static orderBy(column: keyof TeamType, order: 'asc' | 'desc'): TeamModel {
    const instance = new TeamModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, order)

    return instance
  }

  static groupBy(column: keyof TeamType): TeamModel {
    const instance = new TeamModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column)

    return instance
  }

  orderBy(column: keyof TeamType, order: 'asc' | 'desc'): TeamModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, order)

    return this
  }

  groupBy(column: keyof TeamType): TeamModel {
    this.selectFromQuery = this.selectFromQuery.groupBy(column)

    return this
  }

  static orderByDesc(column: keyof TeamType): TeamModel {
    const instance = new TeamModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, 'desc')

    return instance
  }

  orderByDesc(column: keyof TeamType): TeamModel {
    this.selectFromQuery = this.orderBy(column, 'desc')

    return this
  }

  static orderByAsc(column: keyof TeamType): TeamModel {
    const instance = new TeamModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, 'asc')

    return instance
  }

  orderByAsc(column: keyof TeamType): TeamModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, 'desc')

    return this
  }

  async update(team: TeamUpdate): Promise<TeamModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(team).filter(([key]) => this.fillable.includes(key)),
    ) as NewTeam

    await db.updateTable('teams')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      const model = await this.find(this.id)

      return model
    }

    return undefined
  }

  async forceUpdate(team: TeamUpdate): Promise<TeamModel | undefined> {
    if (this.id === undefined) {
      this.updateFromQuery.set(team).execute()
    }

    await db.updateTable('teams')
      .set(team)
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
      throw new HttpError(500, 'Team data is undefined')

    if (this.id === undefined) {
      await db.insertInto('teams')
        .values(this as NewTeam)
        .executeTakeFirstOrThrow()
    }
    else {
      await this.update(this)
    }
  }

  // Method to delete (soft delete) the team instance
  async delete(): Promise<any> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()

    return await db.deleteFrom('teams')
      .where('id', '=', this.id)
      .execute()
  }

  async personalAccessTokensHasMany(): Promise<AccessTokenModel[]> {
    if (this.id === undefined)
      throw new HttpError(500, 'Relation Error!')

    const results = await db.selectFrom('personal_access_tokens')
      .where('team_id', '=', this.id)
      .limit(5)
      .selectAll()
      .execute()

    return results.map(modelItem => new AccessToken(modelItem))
  }

  async teamUsers() {
    if (this.id === undefined)
      throw new HttpError(500, 'Relation Error!')

    const results = await db.selectFrom('team_users')
      .where('user_id', '=', this.id)
      .selectAll()
      .execute()

    const tableRelationIds = results.map(result => result.user_id)

    if (!tableRelationIds.length)
      throw new HttpError(500, 'Relation Error!')

    const relationResults = await User.whereIn('id', tableRelationIds).get()

    return relationResults
  }

  distinct(column: keyof TeamType): TeamModel {
    this.selectFromQuery = this.selectFromQuery.select(column).distinct()

    this.hasSelect = true

    return this
  }

  static distinct(column: keyof TeamType): TeamModel {
    const instance = new TeamModel(null)

    instance.selectFromQuery = instance.selectFromQuery.select(column).distinct()

    instance.hasSelect = true

    return instance
  }

  join(table: string, firstCol: string, secondCol: string): TeamModel {
    this.selectFromQuery = this.selectFromQuery.innerJoin(table, firstCol, secondCol)

    return this
  }

  static join(table: string, firstCol: string, secondCol: string): TeamModel {
    const instance = new TeamModel(null)

    instance.selectFromQuery = instance.selectFromQuery.innerJoin(table, firstCol, secondCol)

    return instance
  }

  static async rawQuery(rawQuery: string): Promise<any> {
    return await sql`${rawQuery}`.execute(db)
  }

  toJSON(): Partial<TeamJsonResponse> {
    const output: Partial<TeamJsonResponse> = {

      id: this.id,
      name: this.name,
      company_name: this.company_name,
      email: this.email,
      billing_email: this.billing_email,
      status: this.status,
      description: this.description,
      path: this.path,
      is_personal: this.is_personal,

      created_at: this.created_at,

      updated_at: this.updated_at,

      personal_access_tokens: this.personal_access_tokens,
      ...this.customColumns,
    }

    return output
  }

  parseResult(model: TeamModel): TeamModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof TeamModel]
    }

    return model
  }
}

async function find(id: number): Promise<TeamModel | undefined> {
  const query = db.selectFrom('teams').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  return new TeamModel(model)
}

export async function count(): Promise<number> {
  const results = await TeamModel.count()

  return results
}

export async function create(newTeam: NewTeam): Promise<TeamModel> {
  const result = await db.insertInto('teams')
    .values(newTeam)
    .executeTakeFirstOrThrow()

  return await find(Number(result.numInsertedOrUpdatedRows)) as TeamModel
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(db)
}

export async function remove(id: number): Promise<void> {
  await db.deleteFrom('teams')
    .where('id', '=', id)
    .execute()
}

export async function whereName(value: string): Promise<TeamModel[]> {
  const query = db.selectFrom('teams').where('name', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new TeamModel(modelItem))
}

export async function whereCompanyName(value: string): Promise<TeamModel[]> {
  const query = db.selectFrom('teams').where('company_name', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new TeamModel(modelItem))
}

export async function whereEmail(value: string): Promise<TeamModel[]> {
  const query = db.selectFrom('teams').where('email', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new TeamModel(modelItem))
}

export async function whereBillingEmail(value: string): Promise<TeamModel[]> {
  const query = db.selectFrom('teams').where('billing_email', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new TeamModel(modelItem))
}

export async function whereStatus(value: string): Promise<TeamModel[]> {
  const query = db.selectFrom('teams').where('status', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new TeamModel(modelItem))
}

export async function whereDescription(value: string): Promise<TeamModel[]> {
  const query = db.selectFrom('teams').where('description', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new TeamModel(modelItem))
}

export async function wherePath(value: string): Promise<TeamModel[]> {
  const query = db.selectFrom('teams').where('path', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new TeamModel(modelItem))
}

export async function whereIsPersonal(value: boolean): Promise<TeamModel[]> {
  const query = db.selectFrom('teams').where('is_personal', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new TeamModel(modelItem))
}

export const Team = TeamModel

export default Team
