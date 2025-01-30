import type { Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { AccessTokenModel } from './AccessToken'
import { randomUUIDv7 } from 'bun'
import { cache } from '@stacksjs/cache'
import { sql } from '@stacksjs/database'
import { HttpError, ModelNotFoundException } from '@stacksjs/error-handling'
import { dispatch } from '@stacksjs/events'
import { DB, SubqueryBuilder } from '@stacksjs/orm'

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
  private readonly guarded: Array<keyof TeamJsonResponse> = []

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
    this.selectFromQuery = DB.instance.selectFrom('teams')
    this.updateFromQuery = DB.instance.updateTable('teams')
    this.deleteFromQuery = DB.instance.deleteFrom('teams')
    this.hasSelect = false
  }

  select(params: (keyof TeamType)[] | RawBuilder<string> | string): TeamModel {
    return TeamModel.select(params)
  }

  static select(params: (keyof TeamType)[] | RawBuilder<string> | string): TeamModel {
    const instance = new TeamModel(null)

    // Initialize a query with the table name and selected fields
    instance.selectFromQuery = instance.selectFromQuery.select(params)

    instance.hasSelect = true

    return instance
  }

  async find(id: number): Promise<TeamModel | undefined> {
    return await TeamModel.find(id)
  }

  // Method to find a Team by ID
  static async find(id: number): Promise<TeamModel | undefined> {
    const model = await DB.instance.selectFrom('teams').where('id', '=', id).selectAll().executeTakeFirst()

    if (!model)
      return undefined

    const instance = new TeamModel(null)

    const result = await instance.mapWith(model)

    const data = new TeamModel(result as TeamType)

    cache.getOrSet(`team:${id}`, JSON.stringify(model))

    return data
  }

  async first(): Promise<TeamModel | undefined> {
    return await TeamModel.first()
  }

  static async first(): Promise<TeamModel | undefined> {
    const model = await DB.instance.selectFrom('teams')
      .selectAll()
      .executeTakeFirst()

    if (!model)
      return undefined

    const instance = new TeamModel(null)

    const result = await instance.mapWith(model)

    const data = new TeamModel(result as TeamType)

    return data
  }

  async firstOrFail(): Promise<TeamModel | undefined> {
    return await TeamModel.firstOrFail()
  }

  static async firstOrFail(): Promise<TeamModel | undefined> {
    const instance = new TeamModel(null)

    const model = await instance.selectFromQuery.executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, 'No TeamModel results found for query')

    const result = await instance.mapWith(model)

    const data = new TeamModel(result as TeamType)

    return data
  }

  async mapWith(model: TeamType): Promise<TeamType> {
    if (this.withRelations.includes('personal_access_tokens')) {
      model.personal_access_tokens = await this.personalAccessTokensHasMany()
    }

    return model
  }

  static async all(): Promise<TeamModel[]> {
    const models = await DB.instance.selectFrom('teams').selectAll().execute()

    const data = await Promise.all(models.map(async (model: TeamType) => {
      const instance = new TeamModel(model)

      const results = await instance.mapWith(model)

      return new TeamModel(results)
    }))

    return data
  }

  async findOrFail(id: number): Promise<TeamModel> {
    return await TeamModel.findOrFail(id)
  }

  static async findOrFail(id: number): Promise<TeamModel> {
    const model = await DB.instance.selectFrom('teams').where('id', '=', id).selectAll().executeTakeFirst()

    const instance = new TeamModel(null)

    if (model === undefined)
      throw new ModelNotFoundException(404, `No TeamModel results for ${id}`)

    cache.getOrSet(`team:${id}`, JSON.stringify(model))

    const result = await instance.mapWith(model)

    const data = new TeamModel(result as TeamType)

    return data
  }

  static async findMany(ids: number[]): Promise<TeamModel[]> {
    let query = DB.instance.selectFrom('teams').where('id', 'in', ids)

    const instance = new TeamModel(null)

    query = query.selectAll()

    const model = await query.execute()

    return model.map(modelItem => instance.parseResult(new TeamModel(modelItem)))
  }

  skip(count: number): TeamModel {
    return TeamModel.skip(count)
  }

  static skip(count: number): TeamModel {
    const instance = new TeamModel(null)

    instance.selectFromQuery = instance.selectFromQuery.offset(count)

    return instance
  }

  take(count: number): TeamModel {
    return TeamModel.take(count)
  }

  static take(count: number): TeamModel {
    const instance = new TeamModel(null)

    instance.selectFromQuery = instance.selectFromQuery.limit(count)

    return instance
  }

  static async pluck<K extends keyof TeamModel>(field: K): Promise<TeamModel[K][]> {
    const instance = new TeamModel(null)

    if (instance.hasSelect) {
      const model = await instance.selectFromQuery.execute()
      return model.map((modelItem: TeamModel) => modelItem[field])
    }

    const model = await instance.selectFromQuery.selectAll().execute()

    return model.map((modelItem: TeamModel) => modelItem[field])
  }

  async pluck<K extends keyof TeamModel>(field: K): Promise<TeamModel[K][]> {
    return TeamModel.pluck(field)
  }

  static async count(): Promise<number> {
    const instance = new TeamModel(null)

    return instance.selectFromQuery
      .select(sql`COUNT(*) as count`)
      .executeTakeFirst()
  }

  async count(): Promise<number> {
    return TeamModel.count()
  }

  async max(field: keyof TeamModel): Promise<number> {
    return await this.selectFromQuery
      .select(sql`MAX(${sql.raw(field as string)}) `)
      .executeTakeFirst()
  }

  async min(field: keyof TeamModel): Promise<number> {
    return await this.selectFromQuery
      .select(sql`MIN(${sql.raw(field as string)}) `)
      .executeTakeFirst()
  }

  async avg(field: keyof TeamModel): Promise<number> {
    return this.selectFromQuery
      .select(sql`AVG(${sql.raw(field as string)})`)
      .executeTakeFirst()
  }

  async sum(field: keyof TeamModel): Promise<number> {
    return this.selectFromQuery
      .select(sql`SUM(${sql.raw(field as string)})`)
      .executeTakeFirst()
  }

  async get(): Promise<TeamModel[]> {
    return TeamModel.get()
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

  has(relation: string): TeamModel {
    return TeamModel.has(relation)
  }

  static has(relation: string): TeamModel {
    const instance = new TeamModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(
        selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.team_id`, '=', 'teams.id'),
      ),
    )

    return instance
  }

  whereHas(
    relation: string,
    callback: (query: SubqueryBuilder) => void,
  ): TeamModel {
    return TeamModel.whereHas(relation, callback)
  }

  static whereHas(
    relation: string,
    callback: (query: SubqueryBuilder) => void,
  ): TeamModel {
    const instance = new TeamModel(null)
    const subqueryBuilder = new SubqueryBuilder()

    callback(subqueryBuilder)
    const conditions = subqueryBuilder.getConditions()

    instance.selectFromQuery = instance.selectFromQuery
      .where(({ exists, selectFrom }: any) => {
        let subquery = selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.team_id`, '=', 'teams.id')

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

  doesntHave(relation: string): TeamModel {
    return TeamModel.doesntHave(relation)
  }

  static doesntHave(relation: string): TeamModel {
    const instance = new TeamModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where(({ not, exists, selectFrom }: any) =>
      not(
        exists(
          selectFrom(relation)
            .select('1')
            .whereRef(`${relation}.team_id`, '=', 'teams.id'),
        ),
      ),
    )

    return instance
  }

  whereDoesntHave(relation: string, callback: (query: SubqueryBuilder) => void): TeamModel {
    return TeamModel.whereDoesntHave(relation, callback)
  }

  static whereDoesntHave(
    relation: string,
    callback: (query: SubqueryBuilder) => void,
  ): TeamModel {
    const instance = new TeamModel(null)
    const subqueryBuilder = new SubqueryBuilder()

    callback(subqueryBuilder)
    const conditions = subqueryBuilder.getConditions()

    instance.selectFromQuery = instance.selectFromQuery
      .where(({ exists, selectFrom, not }: any) => {
        let subquery = selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.team_id`, '=', 'teams.id')

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

  async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<TeamResponse> {
    return TeamModel.paginate(options)
  }

  // Method to get all teams
  static async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<TeamResponse> {
    const totalRecordsResult = await DB.instance.selectFrom('teams')
      .select(DB.instance.fn.count('id').as('total')) // Use 'id' or another actual column name
      .executeTakeFirst()

    const totalRecords = Number(totalRecordsResult?.total) || 0
    const totalPages = Math.ceil(totalRecords / (options.limit ?? 10))

    const teamsWithExtra = await DB.instance.selectFrom('teams')
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

  static async create(newTeam: NewTeam): Promise<TeamModel> {
    const instance = new TeamModel(null)

    const filteredValues = Object.fromEntries(
      Object.entries(newTeam).filter(([key]) =>
        !instance.guarded.includes(key) && instance.fillable.includes(key),
      ),
    ) as NewTeam

    const result = await DB.instance.insertInto('teams')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await instance.find(Number(result.numInsertedOrUpdatedRows)) as TeamModel

    if (model)
      dispatch('Teams:created', model)

    return model
  }

  static async createMany(newTeam: NewTeam[]): Promise<void> {
    const instance = new TeamModel(null)

    const filteredValues = newTeam.map((newTeam: NewTeam) => {
      const filtered = Object.fromEntries(
        Object.entries(newTeam).filter(([key]) =>
          !instance.guarded.includes(key) && instance.fillable.includes(key),
        ),
      ) as NewTeam

      filtered.uuid = randomUUIDv7()
      return filtered
    })

    await DB.instance.insertInto('teams')
      .values(filteredValues)
      .executeTakeFirst()
  }

  static async forceCreate(newTeam: NewTeam): Promise<TeamModel> {
    const result = await DB.instance.insertInto('teams')
      .values(newTeam)
      .executeTakeFirst()

    const model = await find(Number(result.numInsertedOrUpdatedRows)) as TeamModel

    return model
  }

  // Method to remove a Team
  static async remove(id: number): Promise<any> {
    return await DB.instance.deleteFrom('teams')
      .where('id', '=', id)
      .execute()
  }

  private static applyWhere(instance: TeamModel, column: string, operator: string, value: any): TeamModel {
    instance.selectFromQuery = instance.selectFromQuery.where(column, operator, value)
    instance.updateFromQuery = instance.updateFromQuery.where(column, operator, value)
    instance.deleteFromQuery = instance.deleteFromQuery.where(column, operator, value)

    return instance
  }

  where(column: string, operator: string, value: any): TeamModel {
    return TeamModel.applyWhere(this, column, operator, value)
  }

  static where(column: string, operator: string, value: any): TeamModel {
    const instance = new TeamModel(null)

    return TeamModel.applyWhere(instance, column, operator, value)
  }

  whereRef(column: string, operator: string, value: string): TeamModel {
    return TeamModel.whereRef(column, operator, value)
  }

  static whereRef(column: string, operator: string, value: string): TeamModel {
    const instance = new TeamModel(null)

    instance.selectFromQuery = instance.selectFromQuery.whereRef(column, operator, value)

    return instance
  }

  orWhere(...args: Array<[string, string, any]>): TeamModel {
    return TeamModel.orWhere(...args)
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

  when(
    condition: boolean,
    callback: (query: TeamModel) => TeamModel,
  ): TeamModel {
    return TeamModel.when(condition, callback)
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

  whereNull(column: string): TeamModel {
    return TeamModel.whereNull(column)
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
    return TeamModel.whereIn(column, values)
  }

  static whereIn(column: keyof TeamType, values: any[]): TeamModel {
    const instance = new TeamModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where(column, 'in', values)

    instance.updateFromQuery = instance.updateFromQuery.where(column, 'in', values)

    instance.deleteFromQuery = instance.deleteFromQuery.where(column, 'in', values)

    return instance
  }

  whereBetween(column: keyof TeamType, range: [any, any]): TeamModel {
    return TeamModel.whereBetween(column, range)
  }

  static whereBetween(column: keyof TeamType, range: [any, any]): TeamModel {
    if (range.length !== 2) {
      throw new HttpError(500, 'Range must have exactly two values: [min, max]')
    }

    const instance = new TeamModel(null)

    const query = sql` ${sql.raw(column as string)} between ${range[0]} and ${range[1]} `

    instance.selectFromQuery = instance.selectFromQuery.where(query)
    instance.updateFromQuery = instance.updateFromQuery.where(query)
    instance.deleteFromQuery = instance.deleteFromQuery.where(query)

    return instance
  }

  whereNotIn(column: keyof TeamType, values: any[]): TeamModel {
    return TeamModel.whereNotIn(column, values)
  }

  static whereNotIn(column: keyof TeamType, values: any[]): TeamModel {
    const instance = new TeamModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where(column, 'not in', values)

    instance.updateFromQuery = instance.updateFromQuery.where(column, 'not in', values)

    instance.deleteFromQuery = instance.deleteFromQuery.where(column, 'not in', values)

    return instance
  }

  async exists(): Promise<boolean> {
    const model = await this.selectFromQuery.executeTakeFirst()

    return model !== null || model !== undefined
  }

  static async latest(): Promise<TeamType | undefined> {
    const model = await DB.instance.selectFrom('teams')
      .selectAll()
      .orderBy('created_at', 'desc')
      .executeTakeFirst()

    if (!model)
      return undefined

    const instance = new TeamModel(null)
    const result = await instance.mapWith(model)
    const data = new TeamModel(result as TeamType)

    return data
  }

  static async oldest(): Promise<TeamType | undefined> {
    const model = await DB.instance.selectFrom('teams')
      .selectAll()
      .orderBy('created_at', 'asc')
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
      throw new HttpError(500, 'Condition must contain at least one key-value pair')
    }

    const value = condition[key]

    // Attempt to find the first record matching the condition
    const existingTeam = await DB.instance.selectFrom('teams')
      .selectAll()
      .where(key, '=', value)
      .executeTakeFirst()

    if (existingTeam) {
      const instance = new TeamModel(null)
      const result = await instance.mapWith(existingTeam)
      return new TeamModel(result as TeamType)
    }
    else {
      return await this.create(newTeam)
    }
  }

  static async updateOrCreate(
    condition: Partial<TeamType>,
    newTeam: NewTeam,
  ): Promise<TeamModel> {
    const key = Object.keys(condition)[0] as keyof TeamType

    if (!key) {
      throw new HttpError(500, 'Condition must contain at least one key-value pair')
    }

    const value = condition[key]

    // Attempt to find the first record matching the condition
    const existingTeam = await DB.instance.selectFrom('teams')
      .selectAll()
      .where(key, '=', value)
      .executeTakeFirst()

    if (existingTeam) {
      // If found, update the existing record
      await DB.instance.updateTable('teams')
        .set(newTeam)
        .where(key, '=', value)
        .executeTakeFirstOrThrow()

      // Fetch and return the updated record
      const updatedTeam = await DB.instance.selectFrom('teams')
        .selectAll()
        .where(key, '=', value)
        .executeTakeFirst()

      if (!updatedTeam) {
        throw new HttpError(500, 'Failed to fetch updated record')
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
    return TeamModel.with(relations)
  }

  static with(relations: string[]): TeamModel {
    const instance = new TeamModel(null)

    instance.withRelations = relations

    return instance
  }

  async last(): Promise<TeamType | undefined> {
    return await DB.instance.selectFrom('teams')
      .selectAll()
      .orderBy('id', 'desc')
      .executeTakeFirst()
  }

  static async last(): Promise<TeamType | undefined> {
    const model = await DB.instance.selectFrom('teams').selectAll().orderBy('id', 'desc').executeTakeFirst()

    if (!model)
      return undefined

    const instance = new TeamModel(null)

    const result = await instance.mapWith(model)

    const data = new TeamModel(result as TeamType)

    return data
  }

  orderBy(column: keyof TeamType, order: 'asc' | 'desc'): TeamModel {
    return TeamModel.orderBy(column, order)
  }

  static orderBy(column: keyof TeamType, order: 'asc' | 'desc'): TeamModel {
    const instance = new TeamModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, order)

    return instance
  }

  groupBy(column: keyof TeamType): TeamModel {
    return TeamModel.groupBy(column)
  }

  static groupBy(column: keyof TeamType): TeamModel {
    const instance = new TeamModel(null)

    instance.selectFromQuery = instance.selectFromQuery.groupBy(column)

    return instance
  }

  having(column: keyof TeamType, operator: string, value: any): TeamModel {
    return TeamModel.having(column, operator, value)
  }

  static having(column: keyof TeamType, operator: string, value: any): TeamModel {
    const instance = new TeamModel(null)

    instance.selectFromQuery = instance.selectFromQuery.having(column, operator, value)

    return instance
  }

  inRandomOrder(): TeamModel {
    return TeamModel.inRandomOrder()
  }

  static inRandomOrder(): TeamModel {
    const instance = new TeamModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(sql` ${sql.raw('RANDOM()')} `)

    return instance
  }

  orderByDesc(column: keyof TeamType): TeamModel {
    return TeamModel.orderByDesc(column)
  }

  static orderByDesc(column: keyof TeamType): TeamModel {
    const instance = new TeamModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, 'desc')

    return instance
  }

  orderByAsc(column: keyof TeamType): TeamModel {
    return TeamModel.orderByAsc(column)
  }

  static orderByAsc(column: keyof TeamType): TeamModel {
    const instance = new TeamModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, 'asc')

    return instance
  }

  async update(newTeam: TeamUpdate): Promise<TeamModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newTeam).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewTeam

    await DB.instance.updateTable('teams')
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

    await DB.instance.updateTable('teams')
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
      await DB.instance.insertInto('teams')
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

    return await DB.instance.deleteFrom('teams')
      .where('id', '=', this.id)
      .execute()
  }

  async personalAccessTokensHasMany(): Promise<AccessTokenModel[]> {
    if (this.id === undefined)
      throw new HttpError(500, 'Relation Error!')

    const results = await DB.instance.selectFrom('personal_access_tokens')
      .where('team_id', '=', this.id)
      .limit(5)
      .selectAll()
      .execute()

    return results.map(modelItem => new AccessToken(modelItem))
  }

  async teamUsers() {
    if (this.id === undefined)
      throw new HttpError(500, 'Relation Error!')

    const results = await DB.instance.selectFrom('team_users')
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
    return TeamModel.distinct(column)
  }

  static distinct(column: keyof TeamType): TeamModel {
    const instance = new TeamModel(null)

    instance.selectFromQuery = instance.selectFromQuery.select(column).distinct()

    instance.hasSelect = true

    return instance
  }

  join(table: string, firstCol: string, secondCol: string): TeamModel {
    return TeamModel.join(table, firstCol, secondCol)
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
  const query = DB.instance.selectFrom('teams').where('id', '=', id).selectAll()

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
  const result = await DB.instance.insertInto('teams')
    .values(newTeam)
    .executeTakeFirstOrThrow()

  return await find(Number(result.numInsertedOrUpdatedRows)) as TeamModel
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(db)
}

export async function remove(id: number): Promise<void> {
  await DB.instance.deleteFrom('teams')
    .where('id', '=', id)
    .execute()
}

export async function whereName(value: string): Promise<TeamModel[]> {
  const query = DB.instance.selectFrom('teams').where('name', '=', value)
  const results = await query.execute()

  return results.map((modelItem: TeamModel) => new TeamModel(modelItem))
}

export async function whereCompanyName(value: string): Promise<TeamModel[]> {
  const query = DB.instance.selectFrom('teams').where('company_name', '=', value)
  const results = await query.execute()

  return results.map((modelItem: TeamModel) => new TeamModel(modelItem))
}

export async function whereEmail(value: string): Promise<TeamModel[]> {
  const query = DB.instance.selectFrom('teams').where('email', '=', value)
  const results = await query.execute()

  return results.map((modelItem: TeamModel) => new TeamModel(modelItem))
}

export async function whereBillingEmail(value: string): Promise<TeamModel[]> {
  const query = DB.instance.selectFrom('teams').where('billing_email', '=', value)
  const results = await query.execute()

  return results.map((modelItem: TeamModel) => new TeamModel(modelItem))
}

export async function whereStatus(value: string): Promise<TeamModel[]> {
  const query = DB.instance.selectFrom('teams').where('status', '=', value)
  const results = await query.execute()

  return results.map((modelItem: TeamModel) => new TeamModel(modelItem))
}

export async function whereDescription(value: string): Promise<TeamModel[]> {
  const query = DB.instance.selectFrom('teams').where('description', '=', value)
  const results = await query.execute()

  return results.map((modelItem: TeamModel) => new TeamModel(modelItem))
}

export async function wherePath(value: string): Promise<TeamModel[]> {
  const query = DB.instance.selectFrom('teams').where('path', '=', value)
  const results = await query.execute()

  return results.map((modelItem: TeamModel) => new TeamModel(modelItem))
}

export async function whereIsPersonal(value: boolean): Promise<TeamModel[]> {
  const query = DB.instance.selectFrom('teams').where('is_personal', '=', value)
  const results = await query.execute()

  return results.map((modelItem: TeamModel) => new TeamModel(modelItem))
}

export const Team = TeamModel

export default Team
