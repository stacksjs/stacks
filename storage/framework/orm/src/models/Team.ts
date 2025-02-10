import type { Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { AccessTokenModel } from './AccessToken'
import { cache } from '@stacksjs/cache'
import { sql } from '@stacksjs/database'
import { HttpError, ModelNotFoundException } from '@stacksjs/error-handling'
import { dispatch } from '@stacksjs/events'
import { DB, SubqueryBuilder } from '@stacksjs/orm'

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
  protected attributes: Partial<TeamJsonResponse> = {}
  protected originalAttributes: Partial<TeamJsonResponse> = {}

  protected selectFromQuery: any
  protected withRelations: string[]
  protected updateFromQuery: any
  protected deleteFromQuery: any
  protected hasSelect: boolean
  private hasSaved: boolean
  private customColumns: Record<string, unknown> = {}

  constructor(team: Partial<TeamType> | null) {
    if (team) {
      this.attributes = { ...team }
      this.originalAttributes = { ...team }

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
    this.hasSaved = false
  }

  get personal_access_tokens(): AccessTokenModel[] | undefined {
    return this.attributes.personal_access_tokens
  }

  get id(): number | undefined {
    return this.attributes.id
  }

  get name(): string | undefined {
    return this.attributes.name
  }

  get company_name(): string | undefined {
    return this.attributes.company_name
  }

  get email(): string | undefined {
    return this.attributes.email
  }

  get billing_email(): string | undefined {
    return this.attributes.billing_email
  }

  get status(): string | undefined {
    return this.attributes.status
  }

  get description(): string | undefined {
    return this.attributes.description
  }

  get path(): string | undefined {
    return this.attributes.path
  }

  get is_personal(): boolean | undefined {
    return this.attributes.is_personal
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

  set company_name(value: string) {
    this.attributes.company_name = value
  }

  set email(value: string) {
    this.attributes.email = value
  }

  set billing_email(value: string) {
    this.attributes.billing_email = value
  }

  set status(value: string) {
    this.attributes.status = value
  }

  set description(value: string) {
    this.attributes.description = value
  }

  set path(value: string) {
    this.attributes.path = value
  }

  set is_personal(value: boolean) {
    this.attributes.is_personal = value
  }

  set updated_at(value: Date) {
    this.attributes.updated_at = value
  }

  getOriginal(column?: keyof TeamType): Partial<TeamType> {
    if (column) {
      return this.originalAttributes[column]
    }

    return this.originalAttributes
  }

  getChanges(): Partial<TeamJsonResponse> {
    return this.fillable.reduce<Partial<TeamJsonResponse>>((changes, key) => {
      const currentValue = this.attributes[key as keyof TeamsTable]
      const originalValue = this.originalAttributes[key as keyof TeamsTable]

      if (currentValue !== originalValue) {
        changes[key] = currentValue
      }

      return changes
    }, {})
  }

  isDirty(column?: keyof TeamType): boolean {
    if (column) {
      return this.attributes[column] !== this.originalAttributes[column]
    }

    return Object.entries(this.originalAttributes).some(([key, originalValue]) => {
      const currentValue = (this.attributes as any)[key]

      return currentValue !== originalValue
    })
  }

  isClean(column?: keyof TeamType): boolean {
    return !this.isDirty(column)
  }

  wasChanged(column?: keyof TeamType): boolean {
    return this.hasSaved && this.isDirty(column)
  }

  select(params: (keyof TeamType)[] | RawBuilder<string> | string): TeamModel {
    this.selectFromQuery = this.selectFromQuery.select(params)

    this.hasSelect = true

    return this
  }

  static select(params: (keyof TeamType)[] | RawBuilder<string> | string): TeamModel {
    const instance = new TeamModel(null)

    // Initialize a query with the table name and selected fields
    instance.selectFromQuery = instance.selectFromQuery.select(params)

    instance.hasSelect = true

    return instance
  }

  async applyFind(id: number): Promise<TeamModel | undefined> {
    const model = await DB.instance.selectFrom('teams').where('id', '=', id).selectAll().executeTakeFirst()

    if (!model)
      return undefined

    await this.loadRelations(model)

    const data = new TeamModel(model as TeamType)

    cache.getOrSet(`team:${id}`, JSON.stringify(model))

    return data
  }

  async find(id: number): Promise<TeamModel | undefined> {
    return await this.applyFind(id)
  }

  // Method to find a Team by ID
  static async find(id: number): Promise<TeamModel | undefined> {
    const instance = new TeamModel(null)

    return await instance.applyFind(id)
  }

  async first(): Promise<TeamModel | undefined> {
    let model: TeamModel | undefined

    if (this.hasSelect) {
      model = await this.selectFromQuery.executeTakeFirst()
    }
    else {
      model = await this.selectFromQuery.selectAll().executeTakeFirst()
    }

    if (model)
      await this.loadRelations(model)

    const data = new TeamModel(model as TeamType)

    return data
  }

  static async first(): Promise<TeamModel | undefined> {
    const model = await DB.instance.selectFrom('teams')
      .selectAll()
      .executeTakeFirst()

    const data = new TeamModel(model as TeamType)

    return data
  }

  async applyFirstOrFail(): Promise<TeamModel | undefined> {
    const model = await this.selectFromQuery.executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, 'No TeamModel results found for query')

    if (model)
      await this.loadRelations(model)

    const data = new TeamModel(model as TeamType)

    return data
  }

  async firstOrFail(): Promise<TeamModel | undefined> {
    return await this.applyFirstOrFail()
  }

  static async firstOrFail(): Promise<TeamModel | undefined> {
    const instance = new TeamModel(null)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<TeamModel[]> {
    const models = await DB.instance.selectFrom('teams').selectAll().execute()

    const data = await Promise.all(models.map(async (model: TeamType) => {
      return new TeamModel(model)
    }))

    return data
  }

  async applyFindOrFail(id: number): Promise<TeamModel> {
    const model = await DB.instance.selectFrom('teams').where('id', '=', id).selectAll().executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, `No TeamModel results for ${id}`)

    cache.getOrSet(`team:${id}`, JSON.stringify(model))

    await this.loadRelations(model)

    const data = new TeamModel(model as TeamType)

    return data
  }

  async findOrFail(id: number): Promise<TeamModel> {
    return await this.applyFindOrFail(id)
  }

  static async findOrFail(id: number): Promise<TeamModel> {
    const instance = new TeamModel(null)

    return await instance.applyFindOrFail(id)
  }

  static async findMany(ids: number[]): Promise<TeamModel[]> {
    let query = DB.instance.selectFrom('teams').where('id', 'in', ids)

    const instance = new TeamModel(null)

    query = query.selectAll()

    const models = await query.execute()

    await instance.loadRelations(models)

    return models.map((modelItem: TeamModel) => instance.parseResult(new TeamModel(modelItem)))
  }

  skip(count: number): TeamModel {
    this.selectFromQuery = this.selectFromQuery.offset(count)

    return this
  }

  static skip(count: number): TeamModel {
    const instance = new TeamModel(null)

    instance.selectFromQuery = instance.selectFromQuery.offset(count)

    return instance
  }

  async applyChunk(size: number, callback: (models: TeamModel[]) => Promise<void>): Promise<void> {
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

  async chunk(size: number, callback: (models: TeamModel[]) => Promise<void>): Promise<void> {
    await this.applyChunk(size, callback)
  }

  static async chunk(size: number, callback: (models: TeamModel[]) => Promise<void>): Promise<void> {
    const instance = new TeamModel(null)

    await instance.applyChunk(size, callback)
  }

  take(count: number): TeamModel {
    this.selectFromQuery = this.selectFromQuery.limit(count)

    return this
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

    const result = await instance.selectFromQuery
      .select(sql`COUNT(*) as count`)
      .executeTakeFirst()

    return result.count || 0
  }

  async count(): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`COUNT(*) as count`)
      .executeTakeFirst()

    return result.count || 0
  }

  static async max(field: keyof TeamModel): Promise<number> {
    const instance = new TeamModel(null)

    const result = await instance.selectFromQuery
      .select(sql`MAX(${sql.raw(field as string)}) as max `)
      .executeTakeFirst()

    return result.max
  }

  async max(field: keyof TeamModel): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`MAX(${sql.raw(field as string)}) as max`)
      .executeTakeFirst()

    return result.max
  }

  static async min(field: keyof TeamModel): Promise<number> {
    const instance = new TeamModel(null)

    const result = await instance.selectFromQuery
      .select(sql`MIN(${sql.raw(field as string)}) as min `)
      .executeTakeFirst()

    return result.min
  }

  async min(field: keyof TeamModel): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`MIN(${sql.raw(field as string)}) as min `)
      .executeTakeFirst()

    return result.min
  }

  static async avg(field: keyof TeamModel): Promise<number> {
    const instance = new TeamModel(null)

    const result = await instance.selectFromQuery
      .select(sql`AVG(${sql.raw(field as string)}) as avg `)
      .executeTakeFirst()

    return result.avg
  }

  async avg(field: keyof TeamModel): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`AVG(${sql.raw(field as string)}) as avg `)
      .executeTakeFirst()

    return result.avg
  }

  static async sum(field: keyof TeamModel): Promise<number> {
    const instance = new TeamModel(null)

    const result = await instance.selectFromQuery
      .select(sql`SUM(${sql.raw(field as string)}) as sum `)
      .executeTakeFirst()

    return result.sum
  }

  async sum(field: keyof TeamModel): Promise<number> {
    const result = this.selectFromQuery
      .select(sql`SUM(${sql.raw(field as string)}) as sum `)
      .executeTakeFirst()

    return result.sum
  }

  async applyGet(): Promise<TeamModel[]> {
    let models

    if (this.hasSelect) {
      models = await this.selectFromQuery.execute()
    }
    else {
      models = await this.selectFromQuery.selectAll().execute()
    }

    await this.loadRelations(models)

    const data = await Promise.all(models.map(async (model: TeamModel) => {
      return new TeamModel(model)
    }))

    return data
  }

  async get(): Promise<TeamModel[]> {
    return await this.applyGet()
  }

  static async get(): Promise<TeamModel[]> {
    const instance = new TeamModel(null)

    return await instance.applyGet()
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

  static whereExists(callback: (qb: any) => any): TeamModel {
    const instance = new TeamModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(callback({ exists, selectFrom })),
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

  applyDoesntHave(relation: string): TeamModel {
    this.selectFromQuery = this.selectFromQuery.where(({ not, exists, selectFrom }: any) =>
      not(
        exists(
          selectFrom(relation)
            .select('1')
            .whereRef(`${relation}.team_id`, '=', 'teams.id'),
        ),
      ),
    )

    return this
  }

  doesntHave(relation: string): TeamModel {
    return this.applyDoesntHave(relation)
  }

  static doesntHave(relation: string): TeamModel {
    const instance = new TeamModel(null)

    return instance.doesntHave(relation)
  }

  applyWhereDoesntHave(relation: string, callback: (query: SubqueryBuilder) => void): TeamModel {
    const subqueryBuilder = new SubqueryBuilder()

    callback(subqueryBuilder)
    const conditions = subqueryBuilder.getConditions()

    this.selectFromQuery = this.selectFromQuery
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

    return this
  }

  whereDoesntHave(relation: string, callback: (query: SubqueryBuilder) => void): TeamModel {
    return this.applyWhereDoesntHave(relation, callback)
  }

  static whereDoesntHave(
    relation: string,
    callback: (query: SubqueryBuilder) => void,
  ): TeamModel {
    const instance = new TeamModel(null)

    return instance.applyWhereDoesntHave(relation, callback)
  }

  async applyPaginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<TeamResponse> {
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

  async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<TeamResponse> {
    return await this.applyPaginate(options)
  }

  // Method to get all teams
  static async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<TeamResponse> {
    const instance = new TeamModel(null)

    return await instance.applyPaginate(options)
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
      dispatch('team:created', model)

    return model
  }

  static async createMany(newTeam: NewTeam[]): Promise<void> {
    const instance = new TeamModel(null)

    const valuesFiltered = newTeam.map((newTeam: NewTeam) => {
      const filteredValues = Object.fromEntries(
        Object.entries(newTeam).filter(([key]) =>
          !instance.guarded.includes(key) && instance.fillable.includes(key),
        ),
      ) as NewTeam

      return filteredValues
    })

    await DB.instance.insertInto('teams')
      .values(valuesFiltered)
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

  applyWhere(instance: TeamModel, column: string, ...args: any[]): TeamModel {
    const [operatorOrValue, value] = args
    const operator = value === undefined ? '=' : operatorOrValue
    const actualValue = value === undefined ? operatorOrValue : value

    instance.selectFromQuery = instance.selectFromQuery.where(column, operator, actualValue)
    instance.updateFromQuery = instance.updateFromQuery.where(column, operator, actualValue)
    instance.deleteFromQuery = instance.deleteFromQuery.where(column, operator, actualValue)

    return instance
  }

  where(column: string, ...args: any[]): TeamModel {
    return this.applyWhere(this, column, ...args)
  }

  static where(column: string, ...args: any[]): TeamModel {
    const instance = new TeamModel(null)

    return instance.applyWhere(instance, column, ...args)
  }

  whereColumn(first: string, operator: string, second: string): TeamModel {
    this.selectFromQuery = this.selectFromQuery.whereRef(first, operator, second)

    return this
  }

  static whereColumn(first: string, operator: string, second: string): TeamModel {
    const instance = new TeamModel(null)

    instance.selectFromQuery = instance.selectFromQuery.whereRef(first, operator, second)

    return instance
  }

  applyWhereRef(column: string, ...args: string[]): TeamModel {
    const [operatorOrValue, value] = args
    const operator = value === undefined ? '=' : operatorOrValue
    const actualValue = value === undefined ? operatorOrValue : value

    const instance = new TeamModel(null)
    instance.selectFromQuery = instance.selectFromQuery.whereRef(column, operator, actualValue)

    return instance
  }

  whereRef(column: string, ...args: string[]): TeamModel {
    return this.applyWhereRef(column, ...args)
  }

  static whereRef(column: string, ...args: string[]): TeamModel {
    const instance = new TeamModel(null)

    return instance.applyWhereRef(column, ...args)
  }

  whereRaw(sqlStatement: string): TeamModel {
    this.selectFromQuery = this.selectFromQuery.where(sql`${sqlStatement}`)

    return this
  }

  static whereRaw(sqlStatement: string): TeamModel {
    const instance = new TeamModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where(sql`${sqlStatement}`)

    return instance
  }

  applyOrWhere(...conditions: [string, any][]): TeamModel {
    this.selectFromQuery = this.selectFromQuery.where((eb: any) => {
      return eb.or(
        conditions.map(([column, value]) => eb(column, '=', value)),
      )
    })

    this.updateFromQuery = this.updateFromQuery.where((eb: any) => {
      return eb.or(
        conditions.map(([column, value]) => eb(column, '=', value)),
      )
    })

    this.deleteFromQuery = this.deleteFromQuery.where((eb: any) => {
      return eb.or(
        conditions.map(([column, value]) => eb(column, '=', value)),
      )
    })

    return this
  }

  orWhere(...conditions: [string, any][]): TeamModel {
    return this.applyOrWhere(...conditions)
  }

  static orWhere(...conditions: [string, any][]): TeamModel {
    const instance = new TeamModel(null)

    return instance.applyOrWhere(...conditions)
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

  applyWhereBetween(column: keyof TeamType, range: [any, any]): TeamModel {
    if (range.length !== 2) {
      throw new HttpError(500, 'Range must have exactly two values: [min, max]')
    }

    const query = sql` ${sql.raw(column as string)} between ${range[0]} and ${range[1]} `

    this.selectFromQuery = this.selectFromQuery.where(query)
    this.updateFromQuery = this.updateFromQuery.where(query)
    this.deleteFromQuery = this.deleteFromQuery.where(query)

    return this
  }

  whereBetween(column: keyof TeamType, range: [any, any]): TeamModel {
    return this.applyWhereBetween(column, range)
  }

  static whereBetween(column: keyof TeamType, range: [any, any]): TeamModel {
    const instance = new TeamModel(null)

    return instance.applyWhereBetween(column, range)
  }

  applyWhereLike(column: keyof TeamType, value: string): TeamModel {
    this.selectFromQuery = this.selectFromQuery.where(sql` ${sql.raw(column as string)} LIKE ${value}`)

    this.updateFromQuery = this.updateFromQuery.where(sql` ${sql.raw(column as string)} LIKE ${value}`)

    this.deleteFromQuery = this.deleteFromQuery.where(sql` ${sql.raw(column as string)} LIKE ${value}`)

    return this
  }

  whereLike(column: keyof TeamType, value: string): TeamModel {
    return this.applyWhereLike(column, value)
  }

  static whereLike(column: keyof TeamType, value: string): TeamModel {
    const instance = new TeamModel(null)

    return instance.applyWhereLike(column, value)
  }

  applyWhereNotIn(column: keyof TeamType, values: any[]): TeamModel {
    this.selectFromQuery = this.selectFromQuery.where(column, 'not in', values)

    this.updateFromQuery = this.updateFromQuery.where(column, 'not in', values)

    this.deleteFromQuery = this.deleteFromQuery.where(column, 'not in', values)

    return this
  }

  whereNotIn(column: keyof TeamType, values: any[]): TeamModel {
    return this.applyWhereNotIn(column, values)
  }

  static whereNotIn(column: keyof TeamType, values: any[]): TeamModel {
    const instance = new TeamModel(null)

    return instance.applyWhereNotIn(column, values)
  }

  async exists(): Promise<boolean> {
    let model

    if (this.hasSelect) {
      model = await this.selectFromQuery.executeTakeFirst()
    }
    else {
      model = await this.selectFromQuery.selectAll().executeTakeFirst()
    }

    return model !== null && model !== undefined
  }

  static async latest(): Promise<TeamType | undefined> {
    const model = await DB.instance.selectFrom('teams')
      .selectAll()
      .orderBy('id', 'desc')
      .executeTakeFirst()

    if (!model)
      return undefined

    await this.loadRelations(model)

    const data = new TeamModel(model as TeamType)

    return data
  }

  static async oldest(): Promise<TeamType | undefined> {
    const model = await DB.instance.selectFrom('teams')
      .selectAll()
      .orderBy('id', 'asc')
      .executeTakeFirst()

    if (!model)
      return undefined

    await this.loadRelations(model)

    const data = new TeamModel(model as TeamType)

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
      return new TeamModel(existingTeam as TeamType)
    }
    else {
      return await this.create(newTeam)
    }
  }

  static async updateOrCreate(
    condition: Partial<TeamType>,
    newTeam: NewTeam,
  ): Promise<TeamModel> {
    const instance = new TeamModel(null)

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

      instance.hasSaved = true

      return new TeamModel(updatedTeam as TeamType)
    }
    else {
      // If not found, create a new record
      return await this.create(newTeam)
    }
  }

  async loadRelations(models: TeamModel | TeamModel[]): Promise<void> {
    // Handle both single model and array of models
    const modelArray = Array.isArray(models) ? models : [models]
    if (!modelArray.length)
      return

    const modelIds = modelArray.map(model => model.id)

    for (const relation of this.withRelations) {
      const relatedRecords = await DB.instance
        .selectFrom(relation)
        .where('team_id', 'in', modelIds)
        .selectAll()
        .execute()

      if (Array.isArray(models)) {
        models.map((model: TeamModel) => {
          const records = relatedRecords.filter((record: any) => {
            return record.team_id === model.id
          })

          model[relation] = records.length === 1 ? records[0] : records
          return model
        })
      }
      else {
        const records = relatedRecords.filter((record: any) => {
          return record.team_id === models.id
        })

        models[relation] = records.length === 1 ? records[0] : records
      }
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
    return await DB.instance.selectFrom('teams')
      .selectAll()
      .orderBy('id', 'desc')
      .executeTakeFirst()
  }

  static async last(): Promise<TeamType | undefined> {
    const model = await DB.instance.selectFrom('teams').selectAll().orderBy('id', 'desc').executeTakeFirst()

    if (!model)
      return undefined

    const data = new TeamModel(model as TeamType)

    return data
  }

  orderBy(column: keyof TeamType, order: 'asc' | 'desc'): TeamModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, order)

    return this
  }

  static orderBy(column: keyof TeamType, order: 'asc' | 'desc'): TeamModel {
    const instance = new TeamModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, order)

    return instance
  }

  groupBy(column: keyof TeamType): TeamModel {
    this.selectFromQuery = this.selectFromQuery.groupBy(column)

    return this
  }

  static groupBy(column: keyof TeamType): TeamModel {
    const instance = new TeamModel(null)

    instance.selectFromQuery = instance.selectFromQuery.groupBy(column)

    return instance
  }

  having(column: keyof TeamType, operator: string, value: any): TeamModel {
    this.selectFromQuery = this.selectFromQuery.having(column, operator, value)

    return this
  }

  static having(column: keyof TeamType, operator: string, value: any): TeamModel {
    const instance = new TeamModel(null)

    instance.selectFromQuery = instance.selectFromQuery.having(column, operator, value)

    return instance
  }

  inRandomOrder(): TeamModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(sql` ${sql.raw('RANDOM()')} `)

    return this
  }

  static inRandomOrder(): TeamModel {
    const instance = new TeamModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(sql` ${sql.raw('RANDOM()')} `)

    return instance
  }

  orderByDesc(column: keyof TeamType): TeamModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, 'desc')

    return this
  }

  static orderByDesc(column: keyof TeamType): TeamModel {
    const instance = new TeamModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, 'desc')

    return instance
  }

  orderByAsc(column: keyof TeamType): TeamModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, 'asc')

    return this
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

    this.hasSaved = true

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

      this.hasSaved = true

      return model
    }

    return undefined
  }

  async save(): Promise<void> {
    if (!this)
      throw new HttpError(500, 'Team data is undefined')

    const filteredValues = Object.fromEntries(
      Object.entries(this.attributes).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewTeam

    if (this.id === undefined) {
      await DB.instance.insertInto('teams')
        .values(filteredValues)
        .executeTakeFirstOrThrow()
    }
    else {
      await this.update(this.attributes)
    }

    this.hasSaved = true
  }

  fill(data: Partial<TeamType>): TeamModel {
    const filteredValues = Object.fromEntries(
      Object.entries(data).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewTeam

    this.attributes = {
      ...this.attributes,
      ...filteredValues,
    }

    return this
  }

  forceFill(data: Partial<TeamType>): TeamModel {
    this.attributes = {
      ...this.attributes,
      ...data,
    }

    return this
  }

  // Method to delete (soft delete) the team instance
  async delete(): Promise<any> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()

    return await DB.instance.deleteFrom('teams')
      .where('id', '=', this.id)
      .execute()
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
  return await sql`${rawQuery}`.execute(DB.instance)
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
