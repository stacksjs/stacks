import { generateTwoFactorSecret } from '@stacksjs/auth'
import { verifyTwoFactorCode } from '@stacksjs/auth'
import { db } from '@stacksjs/database'
import { sql } from '@stacksjs/database'
import { dispatch } from '@stacksjs/events'
import type { ColumnType, Generated, Insertable, Selectable, Updateable } from 'kysely'
import AccessToken from './AccessToken'

import User from './User'

// import { Kysely, MysqlDialect, PostgresDialect } from 'kysely'
// import { Pool } from 'pg'

// TODO: we need an action that auto-generates these table interfaces
export interface TeamsTable {
  id: Generated<number>
  name: string
  companyName: string
  email: string
  billingEmail: string
  status: string
  description: string
  path: string
  isPersonal: boolean
  accesstoken_id: number
  user_id: number

  created_at: ColumnType<Date, string | undefined, never>

  updated_at: ColumnType<Date, string | undefined, never>
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
interface SortOptions {
  column: TeamType
  order: SortDirection
}
// Define a type for the options parameter
interface QueryOptions {
  sort?: SortOptions
  limit?: number
  offset?: number
  page?: number
}

export class TeamModel {
  private hidden = []
  private fillable = []
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

    this.created_at = user?.created_at

    this.updated_at = user?.updated_at

    this.accesstoken_id = team?.accesstoken_id
    this.user_id = team?.user_id

    this.query = db.selectFrom('teams')
    this.hasSelect = false
  }

  // Method to find a Team by ID
  async find(id: number, fields?: (keyof TeamType)[]): Promise<TeamModel | undefined> {
    let query = db.selectFrom('teams').where('id', '=', id)

    if (fields) query = query.select(fields)
    else query = query.selectAll()

    const model = await query.executeTakeFirst()

    if (!model) return undefined

    return this.parseResult(new TeamModel(model))
  }

  // Method to find a Team by ID
  static async find(id: number, fields?: (keyof TeamType)[]): Promise<TeamModel | undefined> {
    let query = db.selectFrom('teams').where('id', '=', id)

    const instance = new this(null)

    if (fields) query = query.select(fields)
    else query = query.selectAll()

    const model = await query.executeTakeFirst()

    if (!model) return undefined

    return instance.parseResult(new this(model))
  }

  static async all(): Promise<TeamModel[]> {
    const query = db.selectFrom('teams').selectAll()

    const instance = new this(null)

    const results = await query.execute()

    return results.map((modelItem) => instance.parseResult(new TeamModel(modelItem)))
  }

  static async findOrFail(id: number, fields?: (keyof TeamType)[]): Promise<TeamModel> {
    let query = db.selectFrom('teams').where('id', '=', id)

    const instance = new this(null)

    if (fields) query = query.select(fields)
    else query = query.selectAll()

    const model = await query.executeTakeFirst()

    if (!model) throw `No model results found for ${id} `

    return instance.parseResult(new this(model))
  }

  static async findMany(ids: number[], fields?: (keyof TeamType)[]): Promise<TeamModel[]> {
    let query = db.selectFrom('teams').where('id', 'in', ids)

    const instance = new this(null)

    if (fields) query = query.select(fields)
    else query = query.selectAll()

    const model = await query.execute()

    return model.map((modelItem) => instance.parseResult(new TeamModel(modelItem)))
  }

  // Method to get a Team by criteria
  static async fetch(criteria: Partial<TeamType>, options: QueryOptions = {}): Promise<TeamModel[]> {
    let query = db.selectFrom('teams')

    // Apply sorting from options
    if (options.sort) query = query.orderBy(options.sort.column, options.sort.order)

    // Apply limit and offset from options
    if (options.limit !== undefined) query = query.limit(options.limit)

    if (options.offset !== undefined) query = query.offset(options.offset)

    const model = await query.selectAll().execute()
    return model.map((modelItem) => new TeamModel(modelItem))
  }

  // Method to get a Team by criteria
  static async get(): Promise<TeamModel[]> {
    const query = db.selectFrom('teams')

    const model = await query.selectAll().execute()

    return model.map((modelItem) => new TeamModel(modelItem))
  }

  // Method to get a Team by criteria
  async get(): Promise<TeamModel[]> {
    if (this.hasSelect) {
      const model = await this.query.execute()

      return model.map((modelItem: TeamModel) => new TeamModel(modelItem))
    }

    const model = await this.query.selectAll().execute()

    return model.map((modelItem: TeamModel) => new TeamModel(modelItem))
  }

  static async count(): Promise<number> {
    const instance = new this(null)

    const results = await instance.query.selectAll().execute()

    return results.length
  }

  async count(): Promise<number> {
    if (this.hasSelect) {
      const results = await this.query.execute()

      return results.length
    }

    const results = await this.query.selectAll().execute()

    return results.length
  }

  // Method to get all teams
  static async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<TeamResponse> {
    const totalRecordsResult = await db
      .selectFrom('teams')
      .select(db.fn.count('id').as('total')) // Use 'id' or another actual column name
      .executeTakeFirst()

    const totalRecords = Number(totalRecordsResult?.total) || 0
    const totalPages = Math.ceil(totalRecords / (options.limit ?? 10))

    const teamsWithExtra = await db
      .selectFrom('teams')
      .selectAll()
      .orderBy('id', 'asc') // Assuming 'id' is used for cursor-based pagination
      .limit((options.limit ?? 10) + 1) // Fetch one extra record
      .offset(((options.page ?? 1) - 1) * (options.limit ?? 10)) // Ensure options.page is not undefined
      .execute()

    let nextCursor = null
    if (teamsWithExtra.length > (options.limit ?? 10)) nextCursor = teamsWithExtra.pop()!.id // Use the ID of the extra record as the next cursor

    return {
      data: teamsWithExtra,
      paging: {
        total_records: totalRecords,
        page: options.page,
        total_pages: totalPages,
      },
      next_cursor: nextCursor,
    }
  }

  // Method to create a new team
  static async create(newTeam: NewTeam): Promise<TeamModel | undefined> {
    const instance = new this(null)
    const filteredValues = Object.keys(newTeam)
      .filter((key) => instance.fillable.includes(key))
      .reduce((obj: any, key) => {
        obj[key] = newTeam[key]
        return obj
      }, {})

    if (Object.keys(filteredValues).length === 0) {
      return undefined
    }

    const result = await db.insertInto('teams').values(filteredValues).executeTakeFirstOrThrow()

    const model = (await find(Number(result.insertId))) as TeamModel

    return model
  }

  // Method to remove a Team
  static async remove(id: number): Promise<void> {
    const instance = new this(null)

    const model = await instance.find(id)

    await db.deleteFrom('teams').where('id', '=', id).execute()
  }

  where(...args: (string | number | boolean | undefined | null)[]): TeamModel {
    let column: any
    let operator: any
    let value: any

    if (args.length === 2) {
      ;[column, value] = args
      operator = '='
    } else if (args.length === 3) {
      ;[column, operator, value] = args
    } else {
      throw new Error('Invalid number of arguments')
    }

    this.query = this.query.where(column, operator, value)

    return this
  }

  static where(...args: (string | number | boolean | undefined | null)[]): TeamModel {
    let column: any
    let operator: any
    let value: any

    const instance = new this(null)

    if (args.length === 2) {
      ;[column, value] = args
      operator = '='
    } else if (args.length === 3) {
      ;[column, operator, value] = args
    } else {
      throw new Error('Invalid number of arguments')
    }

    instance.query = instance.query.where(column, operator, value)

    return instance
  }

  static whereName(value: string | number | boolean | undefined | null): TeamModel {
    const instance = new this(null)

    instance.query = instance.query.where('name', '=', value)

    return instance
  }

  static whereCompanyName(value: string | number | boolean | undefined | null): TeamModel {
    const instance = new this(null)

    instance.query = instance.query.where('companyName', '=', value)

    return instance
  }

  static whereEmail(value: string | number | boolean | undefined | null): TeamModel {
    const instance = new this(null)

    instance.query = instance.query.where('email', '=', value)

    return instance
  }

  static whereBillingEmail(value: string | number | boolean | undefined | null): TeamModel {
    const instance = new this(null)

    instance.query = instance.query.where('billingEmail', '=', value)

    return instance
  }

  static whereStatus(value: string | number | boolean | undefined | null): TeamModel {
    const instance = new this(null)

    instance.query = instance.query.where('status', '=', value)

    return instance
  }

  static whereDescription(value: string | number | boolean | undefined | null): TeamModel {
    const instance = new this(null)

    instance.query = instance.query.where('description', '=', value)

    return instance
  }

  static wherePath(value: string | number | boolean | undefined | null): TeamModel {
    const instance = new this(null)

    instance.query = instance.query.where('path', '=', value)

    return instance
  }

  static whereIsPersonal(value: string | number | boolean | undefined | null): TeamModel {
    const instance = new this(null)

    instance.query = instance.query.where('isPersonal', '=', value)

    return instance
  }

  static whereIn(column: keyof TeamType, values: any[]): TeamModel {
    const instance = new this(null)

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

  async exists(): Promise<boolean> {
    const model = await this.query.selectAll().executeTakeFirst()

    return model !== null || model !== undefined
  }

  static async first(): Promise<TeamType | undefined> {
    return await db.selectFrom('teams').selectAll().executeTakeFirst()
  }

  async last(): Promise<TeamType | undefined> {
    return await db.selectFrom('teams').selectAll().orderBy('id', 'desc').executeTakeFirst()
  }

  static orderBy(column: keyof TeamType, order: 'asc' | 'desc'): TeamModel {
    const instance = new this(null)

    instance.query = instance.orderBy(column, order)

    return instance
  }

  orderBy(column: keyof TeamType, order: 'asc' | 'desc'): TeamModel {
    this.query = this.query.orderBy(column, order)

    return this
  }

  static orderByDesc(column: keyof TeamType): TeamModel {
    const instance = new this(null)

    instance.query = instance.query.orderBy(column, 'desc')

    return instance
  }

  orderByDesc(column: keyof TeamType): TeamModel {
    this.query = this.orderBy(column, 'desc')

    return this
  }

  static orderByAsc(column: keyof TeamType): TeamModel {
    const instance = new this(null)

    instance.query = instance.query.orderBy(column, 'desc')

    return instance
  }

  orderByAsc(column: keyof TeamType): TeamModel {
    this.query = this.query.orderBy(column, 'desc')

    return this
  }

  // Method to update the teams instance
  async update(team: TeamUpdate): Promise<TeamModel | null> {
    if (this.id === undefined) throw new Error('Team ID is undefined')

    const filteredValues = Object.keys(newTeam)
      .filter((key) => this.fillable.includes(key))
      .reduce((obj, key) => {
        obj[key] = newTeam[key]
        return obj
      }, {})

    await db.updateTable('teams').set(filteredValues).where('id', '=', this.id).executeTakeFirst()

    const model = this.find(Number(this.id))

    return model
  }

  // Method to save (insert or update) the team instance
  async save(): Promise<void> {
    if (!this.team) throw new Error('Team data is undefined')

    if (this.team.id === undefined) {
      // Insert new team
      const newModel = await db
        .insertInto('teams')
        .values(this.team as NewTeam)
        .executeTakeFirstOrThrow()
    } else {
      // Update existing team
      await this.update(this.team)
    }
  }

  // Method to delete the team instance
  async delete(): Promise<void> {
    if (this.id === undefined) throw new Error('Team ID is undefined')

    await db.deleteFrom('teams').where('id', '=', this.id).execute()
  }

  async teamAccessTokens() {
    if (this.id === undefined) throw new Error('Relation Error!')

    const results = await db
      .selectFrom('personal_access_token_teams')
      .where('team_id', '=', this.id)
      .selectAll()
      .execute()

    const tableRelationIds = results.map((result) => result.personal_access_token_id)

    if (!tableRelationIds.length) throw new Error('Relation Error!')

    const relationResults = await AccessToken.whereIn('id', tableRelationIds).get()

    return relationResults
  }

  async teamUsers() {
    if (this.id === undefined) throw new Error('Relation Error!')

    const results = await db.selectFrom('team_users').where('team_id', '=', this.id).selectAll().execute()

    const tableRelationIds = results.map((result) => result.user_id)

    if (!tableRelationIds.length) throw new Error('Relation Error!')

    const relationResults = await User.whereIn('id', tableRelationIds).get()

    return relationResults
  }

  distinct(column: keyof TeamType): TeamModel {
    this.query = this.query.distinctOn(column)

    return this
  }

  static distinct(column: keyof TeamType): TeamModel {
    const instance = new this(null)

    instance.query = instance.query.distinctOn(column)

    return instance
  }

  join(table: string, firstCol: string, secondCol: string): TeamModel {
    this.query = this.query.innerJoin(table, firstCol, secondCol)

    return this
  }

  static join(table: string, firstCol: string, secondCol: string): TeamModel {
    const instance = new this(null)

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

    this.hidden.forEach((attr) => {
      if (attr in output) delete output[attr as keyof Partial<TeamType>]
    })

    type Team = Omit<TeamType, 'password'>

    return output as Team
  }

  parseResult(model: TeamModel): TeamModel {
    delete model['query']
    delete model['fillable']
    delete model['two_factor_secret']
    delete model['hasSelect']

    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute]
    }

    return model
  }
}

async function find(id: number, fields?: (keyof TeamType)[]): Promise<TeamModel | null> {
  let query = db.selectFrom('teams').where('id', '=', id)

  if (fields) query = query.select(fields)
  else query = query.selectAll()

  const model = await query.executeTakeFirst()

  if (!model) return null

  return new TeamModel(model)
}

export async function count(): Promise<number> {
  const results = await TeamModel.count()

  return results
}

export async function create(newTeam: NewTeam): Promise<TeamModel> {
  const result = await db.insertInto('teams').values(newTeam).executeTakeFirstOrThrow()

  return (await find(Number(result.insertId))) as TeamModel
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(db)
}

export async function remove(id: number): Promise<void> {
  await db.deleteFrom('teams').where('id', '=', id).execute()
}

export async function whereName(value: string | number | boolean | undefined | null): Promise<TeamModel[]> {
  const query = db.selectFrom('teams').where('name', '=', value)

  const results = await query.execute()

  return results.map((modelItem) => new TeamModel(modelItem))
}

export async function whereCompanyName(value: string | number | boolean | undefined | null): Promise<TeamModel[]> {
  const query = db.selectFrom('teams').where('companyName', '=', value)

  const results = await query.execute()

  return results.map((modelItem) => new TeamModel(modelItem))
}

export async function whereEmail(value: string | number | boolean | undefined | null): Promise<TeamModel[]> {
  const query = db.selectFrom('teams').where('email', '=', value)

  const results = await query.execute()

  return results.map((modelItem) => new TeamModel(modelItem))
}

export async function whereBillingEmail(value: string | number | boolean | undefined | null): Promise<TeamModel[]> {
  const query = db.selectFrom('teams').where('billingEmail', '=', value)

  const results = await query.execute()

  return results.map((modelItem) => new TeamModel(modelItem))
}

export async function whereStatus(value: string | number | boolean | undefined | null): Promise<TeamModel[]> {
  const query = db.selectFrom('teams').where('status', '=', value)

  const results = await query.execute()

  return results.map((modelItem) => new TeamModel(modelItem))
}

export async function whereDescription(value: string | number | boolean | undefined | null): Promise<TeamModel[]> {
  const query = db.selectFrom('teams').where('description', '=', value)

  const results = await query.execute()

  return results.map((modelItem) => new TeamModel(modelItem))
}

export async function wherePath(value: string | number | boolean | undefined | null): Promise<TeamModel[]> {
  const query = db.selectFrom('teams').where('path', '=', value)

  const results = await query.execute()

  return results.map((modelItem) => new TeamModel(modelItem))
}

export async function whereIsPersonal(value: string | number | boolean | undefined | null): Promise<TeamModel[]> {
  const query = db.selectFrom('teams').where('isPersonal', '=', value)

  const results = await query.execute()

  return results.map((modelItem) => new TeamModel(modelItem))
}

const Team = TeamModel

export default Team
