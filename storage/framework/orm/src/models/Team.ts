import type { Generated, Insertable, Selectable, Updateable } from 'kysely'
import { cache } from '@stacksjs/cache'
import { db, sql } from '@stacksjs/database'
import { HttpError } from '@stacksjs/error-handling'
import AccessToken from './AccessToken'

import User from './User'

// import { Kysely, MysqlDialect, PostgresDialect } from 'kysely'
// import { Pool } from 'pg'

export interface TeamsTable {
  id: Generated<number>
  name?: string
  company_name?: string
  email?: string
  billing_email?: string
  status?: string
  description?: string
  path?: string
  is_personal?: boolean
  accesstoken_id?: number
  user_id?: number

  created_at?: Date

  updated_at?: Date

  deleted_at?: Date

}

interface TeamResponse {
  data: Teams
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export type TeamType = Selectable<TeamsTable>
export type NewTeam = Insertable<TeamsTable>
export type TeamUpdate = Updateable<TeamsTable>
export type Teams = TeamType[]

export type TeamColumn = Teams
export type TeamColumns = Array<keyof Teams>

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
  private hidden = []
  private fillable = ['stripe_id', 'public_key', 'two_factor_secret']
  private softDeletes = false
  protected query: any
  protected hasSelect: boolean
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
  public accesstoken_id: number | undefined
  public user_id: number | undefined

  constructor(team: Partial<TeamType> | null) {
    this.id = team?.id
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

    this.accesstoken_id = team?.accesstoken_id
    this.user_id = team?.user_id

    this.query = db.selectFrom('teams')
    this.hasSelect = false
  }

  // Method to find a Team by ID
  async find(id: number): Promise<TeamModel | undefined> {
    const query = db.selectFrom('teams').where('id', '=', id).selectAll()

    const model = await query.executeTakeFirst()

    if (!model)
      return undefined

    cache.getOrSet(`team:${id}`, JSON.stringify(model))

    return this.parseResult(new TeamModel(model))
  }

  // Method to find a Team by ID
  static async find(id: number): Promise<TeamModel | undefined> {
    const query = db.selectFrom('teams').where('id', '=', id).selectAll()

    const instance = new TeamModel(null)

    const model = await query.executeTakeFirst()

    if (!model)
      return undefined

    cache.getOrSet(`team:${id}`, JSON.stringify(model))

    return instance.parseResult(new TeamModel(model))
  }

  static async all(): Promise<TeamModel[]> {
    let query = db.selectFrom('teams').selectAll()

    const instance = new TeamModel(null)

    if (instance.softDeletes) {
      query = query.where('deleted_at', 'is', null)
    }

    const results = await query.execute()

    return results.map(modelItem => instance.parseResult(new TeamModel(modelItem)))
  }

  static async findOrFail(id: number): Promise<TeamModel> {
    let query = db.selectFrom('teams').where('id', '=', id)

    const instance = new TeamModel(null)

    if (instance.softDeletes) {
      query = query.where('deleted_at', 'is', null)
    }

    query = query.selectAll()

    const model = await query.executeTakeFirst()

    if (model === undefined)
      throw new HttpError(404, `No TeamModel results for ${id}`)

    cache.getOrSet(`team:${id}`, JSON.stringify(model))

    return instance.parseResult(new TeamModel(model))
  }

  static async findMany(ids: number[]): Promise<TeamModel[]> {
    let query = db.selectFrom('teams').where('id', 'in', ids)

    const instance = new TeamModel(null)

    if (instance.softDeletes) {
      query = query.where('deleted_at', 'is', null)
    }

    query = query.selectAll()

    const model = await query.execute()

    return model.map(modelItem => instance.parseResult(new TeamModel(modelItem)))
  }

  // Method to get a User by criteria
  static async get(): Promise<TeamModel[]> {
    const instance = new TeamModel(null)

    if (instance.hasSelect) {
      if (instance.softDeletes) {
        instance.query = instance.query.where('deleted_at', 'is', null)
      }

      const model = await instance.query.execute()

      return model.map((modelItem: TeamModel) => new TeamModel(modelItem))
    }

    if (instance.softDeletes) {
      instance.query = instance.query.where('deleted_at', 'is', null)
    }

    const model = await instance.query.selectAll().execute()

    return model.map((modelItem: TeamModel) => new TeamModel(modelItem))
  }

  // Method to get a Team by criteria
  async get(): Promise<TeamModel[]> {
    if (this.hasSelect) {
      if (this.softDeletes) {
        this.query = this.query.where('deleted_at', 'is', null)
      }

      const model = await this.query.execute()

      return model.map((modelItem: TeamModel) => new TeamModel(modelItem))
    }

    if (this.softDeletes) {
      this.query = this.query.where('deleted_at', 'is', null)
    }

    const model = await this.query.selectAll().execute()

    return model.map((modelItem: TeamModel) => new TeamModel(modelItem))
  }

  static async count(): Promise<number> {
    const instance = new TeamModel(null)

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

    const model = await find(Number(result.insertId)) as TeamModel

    return model
  }

  static async forceCreate(newTeam: NewTeam): Promise<TeamModel> {
    const result = await db.insertInto('teams')
      .values(newTeam)
      .executeTakeFirst()

    const model = await find(Number(result.insertId)) as TeamModel

    return model
  }

  // Method to remove a Team
  static async remove(id: number): Promise<void> {
    const instance = new TeamModel(null)

    if (instance.softDeletes) {
      await db.updateTable('teams')
        .set({
          deleted_at: sql.raw('CURRENT_TIMESTAMP'),
        })
        .where('id', '=', id)
        .execute()
    }
    else {
      await db.deleteFrom('teams')
        .where('id', '=', id)
        .execute()
    }
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

    this.query = this.query.where(column, operator, value)

    return this
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

    instance.query = instance.query.where(column, operator, value)

    return instance
  }

  static whereName(value: string): TeamModel {
    const instance = new TeamModel(null)

    instance.query = instance.query.where('name', '=', value)

    return instance
  }

  static whereCompanyName(value: string): TeamModel {
    const instance = new TeamModel(null)

    instance.query = instance.query.where('companyName', '=', value)

    return instance
  }

  static whereEmail(value: string): TeamModel {
    const instance = new TeamModel(null)

    instance.query = instance.query.where('email', '=', value)

    return instance
  }

  static whereBillingEmail(value: string): TeamModel {
    const instance = new TeamModel(null)

    instance.query = instance.query.where('billingEmail', '=', value)

    return instance
  }

  static whereStatus(value: string): TeamModel {
    const instance = new TeamModel(null)

    instance.query = instance.query.where('status', '=', value)

    return instance
  }

  static whereDescription(value: string): TeamModel {
    const instance = new TeamModel(null)

    instance.query = instance.query.where('description', '=', value)

    return instance
  }

  static wherePath(value: string): TeamModel {
    const instance = new TeamModel(null)

    instance.query = instance.query.where('path', '=', value)

    return instance
  }

  static whereIsPersonal(value: string): TeamModel {
    const instance = new TeamModel(null)

    instance.query = instance.query.where('isPersonal', '=', value)

    return instance
  }

  static whereIn(column: keyof TeamType, values: any[]): TeamModel {
    const instance = new TeamModel(null)

    instance.query = instance.query.where(column, 'in', values)

    return instance
  }

  async first(): Promise<TeamModel | undefined> {
    const model = await this.query.selectAll().executeTakeFirst()

    if (!model) {
      return undefined
    }

    return this.parseResult(new TeamModel(model))
  }

  async firstOrFail(): Promise<TeamModel | undefined> {
    const model = await this.query.selectAll().executeTakeFirst()

    if (model === undefined)
      throw new HttpError(404, 'No TeamModel results found for query')

    return this.parseResult(new TeamModel(model))
  }

  async exists(): Promise<boolean> {
    const model = await this.query.selectAll().executeTakeFirst()

    return model !== null || model !== undefined
  }

  static async first(): Promise<TeamType | undefined> {
    return await db.selectFrom('teams')
      .selectAll()
      .executeTakeFirst()
  }

  async last(): Promise<TeamType | undefined> {
    return await db.selectFrom('teams')
      .selectAll()
      .orderBy('id', 'desc')
      .executeTakeFirst()
  }

  static async last(): Promise<TeamType | undefined> {
    return await db.selectFrom('teams').selectAll().orderBy('id', 'desc').executeTakeFirst()
  }

  static orderBy(column: keyof TeamType, order: 'asc' | 'desc'): TeamModel {
    const instance = new TeamModel(null)

    instance.query = instance.query.orderBy(column, order)

    return instance
  }

  orderBy(column: keyof TeamType, order: 'asc' | 'desc'): TeamModel {
    this.query = this.query.orderBy(column, order)

    return this
  }

  static orderByDesc(column: keyof TeamType): TeamModel {
    const instance = new TeamModel(null)

    instance.query = instance.query.orderBy(column, 'desc')

    return instance
  }

  orderByDesc(column: keyof TeamType): TeamModel {
    this.query = this.orderBy(column, 'desc')

    return this
  }

  static orderByAsc(column: keyof TeamType): TeamModel {
    const instance = new TeamModel(null)

    instance.query = instance.query.orderBy(column, 'asc')

    return instance
  }

  orderByAsc(column: keyof TeamType): TeamModel {
    this.query = this.query.orderBy(column, 'desc')

    return this
  }

  async update(team: TeamUpdate): Promise<TeamModel | undefined> {
    if (this.id === undefined)
      throw new HttpError(500, 'Team ID is undefined')

    const filteredValues = Object.fromEntries(
      Object.entries(team).filter(([key]) => this.fillable.includes(key)),
    ) as NewTeam

    await db.updateTable('teams')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    const model = await this.find(Number(this.id))

    return model
  }

  async forceUpdate(team: TeamUpdate): Promise<TeamModel | undefined> {
    if (this.id === undefined)
      throw new HttpError(500, 'Team ID is undefined')

    await db.updateTable('teams')
      .set(team)
      .where('id', '=', this.id)
      .executeTakeFirst()

    const model = await this.find(Number(this.id))

    return model
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
  async delete(): Promise<void> {
    if (this.id === undefined)
      throw new HttpError(500, 'Team ID is undefined')

    // Check if soft deletes are enabled
    if (this.softDeletes) {
      // Update the deleted_at column with the current timestamp
      await db.updateTable('teams')
        .set({
          deleted_at: sql.raw('CURRENT_TIMESTAMP'),
        })
        .where('id', '=', this.id)
        .execute()
    }
    else {
      // Perform a hard delete
      await db.deleteFrom('teams')
        .where('id', '=', this.id)
        .execute()
    }
  }

  async teamAccessTokens() {
    if (this.id === undefined)
      throw new HttpError(500, 'Relation Error!')

    const results = await db.selectFrom('personal_access_token_teams')
      .where('team_id', '=', this.id)
      .selectAll()
      .execute()

    const tableRelationIds = results.map(result => result.personal_access_token_id)

    if (!tableRelationIds.length)
      throw new HttpError(500, 'Relation Error!')

    const relationResults = await AccessToken.whereIn('id', tableRelationIds).get()

    return relationResults
  }

  async teamUsers() {
    if (this.id === undefined)
      throw new HttpError(500, 'Relation Error!')

    const results = await db.selectFrom('team_users')
      .where('team_id', '=', this.id)
      .selectAll()
      .execute()

    const tableRelationIds = results.map(result => result.user_id)

    if (!tableRelationIds.length)
      throw new HttpError(500, 'Relation Error!')

    const relationResults = await User.whereIn('id', tableRelationIds).get()

    return relationResults
  }

  distinct(column: keyof TeamType): TeamModel {
    this.query = this.query.select(column).distinct()

    this.hasSelect = true

    return this
  }

  static distinct(column: keyof TeamType): TeamModel {
    const instance = new TeamModel(null)

    instance.query = instance.query.select(column).distinct()

    instance.hasSelect = true

    return instance
  }

  join(table: string, firstCol: string, secondCol: string): TeamModel {
    this.query = this.query.innerJoin(table, firstCol, secondCol)

    return this
  }

  static join(table: string, firstCol: string, secondCol: string): TeamModel {
    const instance = new TeamModel(null)

    instance.query = instance.query.innerJoin(table, firstCol, secondCol)

    return instance
  }

  static async rawQuery(rawQuery: string): Promise<any> {
    return await sql`${rawQuery}`.execute(db)
  }

  toJSON() {
    const output: Partial<TeamType> = {

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

    }

        type Team = Omit<TeamType, 'password'>

        return output as Team
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

  return await find(Number(result.insertId)) as TeamModel
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
