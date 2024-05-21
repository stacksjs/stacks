import { db } from '@stacksjs/database'
import type { Result } from '@stacksjs/error-handling'
import { err, handleError, ok } from '@stacksjs/error-handling'
import type { ColumnType, Generated, Insertable, Selectable, Updateable } from 'kysely'
import AccessToken from './AccessToken'

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

  created_at: ColumnType<Date, string | undefined, never>
  updated_at: ColumnType<Date, string | undefined, never>
  deleted_at: ColumnType<Date, string | undefined, never>
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
  private team: Partial<TeamType>
  private results: Partial<TeamType>[]
  private hidden = ['password'] // TODO: this hidden functionality needs to be implemented still

  constructor(team: Partial<TeamType>) {
    this.team = team
  }

  // Method to find a team by ID
  static async find(id: number, fields?: (keyof TeamType)[]) {
    let query = db.selectFrom('teams').where('id', '=', id)

    if (fields) query = query.select(fields)
    else query = query.selectAll()

    const model = await query.executeTakeFirst()

    if (!model) return null

    return new TeamModel(model)
  }

  static async findMany(ids: number[], fields?: (keyof TeamType)[]) {
    let query = db.selectFrom('teams').where('id', 'in', ids)

    if (fields) query = query.select(fields)
    else query = query.selectAll()

    const model = await query.execute()

    return model.map((modelItem) => new TeamModel(modelItem))
  }

  // Method to get a team by criteria
  static async get(criteria: Partial<TeamType>, options: QueryOptions = {}): Promise<TeamModel[]> {
    let query = db.selectFrom('teams')

    // Apply sorting from options
    if (options.sort) query = query.orderBy(options.sort.column, options.sort.order)

    // Apply limit and offset from options
    if (options.limit !== undefined) query = query.limit(options.limit)

    if (options.offset !== undefined) query = query.offset(options.offset)

    const model = await query.selectAll().execute()
    return model.map((modelItem) => new TeamModel(modelItem))
  }

  // Method to get all teams
  static async all(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<TeamResponse> {
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
      .offset((options.page! - 1) * (options.limit ?? 10))
      .execute()

    let nextCursor = null
    if (teamsWithExtra.length > (options.limit ?? 10)) nextCursor = teamsWithExtra.pop()?.id // Use the ID of the extra record as the next cursor

    return {
      data: teamsWithExtra,
      paging: {
        total_records: totalRecords,
        page: options.page!,
        total_pages: totalPages,
      },
      next_cursor: nextCursor,
    }
  }

  // Method to create a new team
  static async create(newTeam: NewTeam): Promise<TeamModel> {
    const model = await db.insertInto('teams').values(newTeam).returningAll().executeTakeFirstOrThrow()

    return new TeamModel(model)
  }

  // Method to update a team
  static async update(id: number, teamUpdate: TeamUpdate): Promise<TeamModel> {
    const model = await db
      .updateTable('teams')
      .set(teamUpdate)
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirstOrThrow()

    return new TeamModel(model)
  }

  // Method to remove a team
  static async remove(id: number): Promise<TeamModel> {
    const model = await db.deleteFrom('teams').where('id', '=', id).returningAll().executeTakeFirstOrThrow()

    return new TeamModel(model)
  }

  async where(column: string, operator, value: any) {
    let query = db.selectFrom('teams')

    query = query.where(column, operator, value)

    return await query.selectAll().execute()
  }

  async whereIs(criteria: Partial<TeamType>, options: QueryOptions = {}) {
    let query = db.selectFrom('teams')

    // Existing criteria checks
    if (criteria.id) query = query.where('id', '=', criteria.id) // Kysely is immutable, we must re-assign

    if (criteria.email) query = query.where('email', '=', criteria.email)

    if (criteria.name !== undefined) {
      query = query.where('name', criteria.name === null ? 'is' : '=', criteria.name)
    }

    if (criteria.password) query = query.where('password', '=', criteria.password)

    if (criteria.created_at) query = query.where('created_at', '=', criteria.created_at)

    if (criteria.updated_at) query = query.where('updated_at', '=', criteria.updated_at)

    if (criteria.deleted_at) query = query.where('deleted_at', '=', criteria.deleted_at)

    // Apply sorting from options
    if (options.sort) query = query.orderBy(options.sort.column, options.sort.order)

    // Apply pagination from options
    if (options.limit !== undefined) query = query.limit(options.limit)

    if (options.offset !== undefined) query = query.offset(options.offset)

    return await query.selectAll().execute()
  }

  async whereIn(column: keyof TeamType, values: any[], options: QueryOptions = {}) {
    let query = db.selectFrom('teams')

    query = query.where(column, 'in', values)

    // Apply sorting from options
    if (options.sort) query = query.orderBy(options.sort.column, options.sort.order)

    // Apply pagination from options
    if (options.limit !== undefined) query = query.limit(options.limit)

    if (options.offset !== undefined) query = query.offset(options.offset)

    return await query.selectAll().execute()
  }

  async first() {
    return await db.selectFrom('teams').selectAll().executeTakeFirst()
  }

  async last() {
    return await db.selectFrom('teams').selectAll().orderBy('id', 'desc').executeTakeFirst()
  }

  async orderBy(column: keyof TeamType, order: 'asc' | 'desc') {
    return await db.selectFrom('teams').selectAll().orderBy(column, order).execute()
  }

  async orderByDesc(column: keyof TeamType) {
    return await db.selectFrom('teams').selectAll().orderBy(column, 'desc').execute()
  }

  async orderByAsc(column: keyof TeamType) {
    return await db.selectFrom('teams').selectAll().orderBy(column, 'asc').execute()
  }

  // Method to get the team instance itself
  self() {
    return this
  }

  // Method to get the team instance data
  get() {
    return this.team
  }

  // Method to update the team instance
  async update(team: TeamUpdate): Promise<Result<TeamType, Error>> {
    if (this.team.id === undefined) return err(handleError('Team ID is undefined'))

    const updatedModel = await db
      .updateTable('teams')
      .set(team)
      .where('id', '=', this.team.id)
      .returningAll()
      .executeTakeFirst()

    if (!updatedModel) return err(handleError('Team not found'))

    this.team = updatedModel

    return ok(updatedModel)
  }

  // Method to save (insert or update) the team instance
  async save(): Promise<void> {
    if (!this.team) throw new Error('Team data is undefined')

    if (this.team.id === undefined) {
      // Insert new team
      const newModel = await db
        .insertInto('teams')
        .values(this.team as NewTeam)
        .returningAll()
        .executeTakeFirstOrThrow()
      this.team = newModel
    } else {
      // Update existing team
      await this.update(this.team)
    }
  }

  // Method to delete the team instance
  async delete(): Promise<void> {
    if (this.team.id === undefined) throw new Error('Team ID is undefined')

    await db.deleteFrom('teams').where('id', '=', this.team.id).execute()

    this.team = {}
  }

  // Method to refresh the team instance data from the database
  async refresh(): Promise<void> {
    if (this.team.id === undefined) throw new Error('Team ID is undefined')

    const refreshedModel = await db.selectFrom('teams').where('id', '=', this.team.id).selectAll().executeTakeFirst()

    if (!refreshedModel) throw new Error('Team not found')

    this.team = refreshedModel
  }

  async teamAccess_tokens() {
    if (this.team.id === undefined) throw new Error('Relation Error!')

    const results = await db.selectFrom('team_access_tokens').where('team_id', '=', this.team.id).selectAll().execute()

    return results
  }

  toJSON() {
    const output: Partial<TeamType> = { ...this.team }

    this.hidden.forEach((attr) => {
      if (attr in output) delete output[attr as keyof Partial<TeamType>]
    })

    type Team = Omit<TeamType, 'password'>

    return output as Team
  }
}

const Model = TeamModel

// starting here, ORM functions
export async function find(id: number, fields?: (keyof TeamType)[]) {
  let query = db.selectFrom('teams').where('id', '=', id)

  if (fields) query = query.select(fields)
  else query = query.selectAll()

  const model = await query.executeTakeFirst()

  if (!model) return null

  this.team = model
  return new TeamModel(model)
}

export async function findMany(ids: number[], fields?: (keyof TeamType)[]) {
  let query = db.selectFrom('teams').where('id', 'in', ids)

  if (fields) query = query.select(fields)
  else query = query.selectAll()

  const model = await query.execute()

  return model.map((modelItem) => new TeamModel(modelItem))
}

export async function count() {
  const results = await db.selectFrom('teams').selectAll().execute()

  return results.length
}

export async function get(
  criteria: Partial<TeamType>,
  sort: { column: keyof TeamType; order: 'asc' | 'desc' } = { column: 'created_at', order: 'desc' },
) {
  let query = db.selectFrom('teams')

  if (criteria.id) query = query.where('id', '=', criteria.id) // Kysely is immutable, we must re-assign

  if (criteria.email) query = query.where('email', '=', criteria.email)

  if (criteria.name !== undefined) {
    query = query.where('name', criteria.name === null ? 'is' : '=', criteria.name)
  }

  if (criteria.password) query = query.where('password', '=', criteria.password)

  if (criteria.created_at) query = query.where('created_at', '=', criteria.created_at)

  if (criteria.updated_at) query = query.where('updated_at', '=', criteria.updated_at)

  if (criteria.deleted_at) query = query.where('deleted_at', '=', criteria.deleted_at)

  // Apply sorting based on the 'sort' parameter
  query = query.orderBy(sort.column, sort.order)

  return await query.selectAll().execute()
}

export async function all(limit = 10, offset = 0) {
  return await db.selectFrom('teams').selectAll().orderBy('created_at', 'desc').limit(limit).offset(offset).execute()
}

export async function create(newTeam: NewTeam) {
  return await db.insertInto('teams').values(newTeam).returningAll().executeTakeFirstOrThrow()
}

export async function first() {
  return await db.selectFrom('teams').selectAll().executeTakeFirst()
}

export async function last() {
  return await db.selectFrom('teams').selectAll().orderBy('id', 'desc').executeTakeFirst()
}

export async function update(id: number, teamUpdate: TeamUpdate) {
  return await db.updateTable('teams').set(teamUpdate).where('id', '=', id).execute()
}

export async function remove(id: number) {
  return await db.deleteFrom('teams').where('id', '=', id).returningAll().executeTakeFirst()
}

export async function where(column: string, operator, value: any) {
  let query = db.selectFrom('teams')

  query = query.where(column, operator, value)

  return await query.selectAll().execute()
}

export async function whereIs(criteria: Partial<TeamType>, options: QueryOptions = {}) {
  let query = db.selectFrom('teams')

  // Apply criteria
  if (criteria.id) query = query.where('id', '=', criteria.id)

  if (criteria.email) query = query.where('email', '=', criteria.email)

  if (criteria.name !== undefined) {
    query = query.where('name', criteria.name === null ? 'is' : '=', criteria.name)
  }

  if (criteria.password) query = query.where('password', '=', criteria.password)

  if (criteria.created_at) query = query.where('created_at', '=', criteria.created_at)

  if (criteria.updated_at) query = query.where('updated_at', '=', criteria.updated_at)

  if (criteria.deleted_at) query = query.where('deleted_at', '=', criteria.deleted_at)

  // Apply sorting from options
  if (options.sort) query = query.orderBy(options.sort.column, options.sort.order)

  // Apply pagination from options
  if (options.limit !== undefined) query = query.limit(options.limit)

  if (options.offset !== undefined) query = query.offset(options.offset)

  return await query.selectAll().execute()
}

export async function whereIn(column: keyof TeamType, values: any[], options: QueryOptions = {}) {
  let query = db.selectFrom('teams')

  query = query.where(column, 'in', values)

  // Apply sorting from options
  if (options.sort) query = query.orderBy(options.sort.column, options.sort.order)

  // Apply pagination from options
  if (options.limit !== undefined) query = query.limit(options.limit)

  if (options.offset !== undefined) query = query.offset(options.offset)

  return await query.selectAll().execute()
}

export const Team = {
  find,
  findMany,
  get,
  count,
  all,
  create,
  update,
  remove,
  Model,
  first,
  last,
  where,
  whereIn,
  model: TeamModel,
}

export default Team
