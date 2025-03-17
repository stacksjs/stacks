import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { AccessTokenModel } from './AccessToken'
import { cache } from '@stacksjs/cache'
import { sql } from '@stacksjs/database'
import { HttpError, ModelNotFoundException } from '@stacksjs/error-handling'
import { BaseOrm, DB, SubqueryBuilder } from '@stacksjs/orm'

import User from './User'

export interface TeamsTable {
  id: Generated<number>
  name: string
  company_name: string
  email: string
  billing_email: string
  status: string
  description: string
  path: string
  is_personal: boolean

  created_at?: Date

  updated_at?: Date

}

export interface TeamResponse {
  data: TeamJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface TeamJsonResponse extends Omit<Selectable<TeamsTable>, 'password'> {
  [key: string]: any
}

export type NewTeam = Insertable<TeamsTable>
export type TeamUpdate = Updateable<TeamsTable>

      type SortDirection = 'asc' | 'desc'
interface SortOptions { column: TeamJsonResponse, order: SortDirection }
// Define a type for the options parameter
interface QueryOptions {
  sort?: SortOptions
  limit?: number
  offset?: number
  page?: number
}

export class TeamModel extends BaseOrm<TeamModel, TeamsTable, TeamJsonResponse> {
  private readonly hidden: Array<keyof TeamJsonResponse> = []
  private readonly fillable: Array<keyof TeamJsonResponse> = ['name', 'company_name', 'email', 'billing_email', 'status', 'description', 'path', 'is_personal', 'uuid']
  private readonly guarded: Array<keyof TeamJsonResponse> = []
  protected attributes = {} as TeamJsonResponse
  protected originalAttributes = {} as TeamJsonResponse

  protected selectFromQuery: any
  protected updateFromQuery: any
  protected deleteFromQuery: any
  protected hasSelect: boolean
  private hasSaved: boolean
  private customColumns: Record<string, unknown> = {}

  constructor(team: TeamJsonResponse | undefined) {
    super('teams')
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

  protected async loadRelations(models: TeamJsonResponse | TeamJsonResponse[]): Promise<void> {
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
        models.map((model: TeamJsonResponse) => {
          const records = relatedRecords.filter((record: { team_id: number }) => {
            return record.team_id === model.id
          })

          model[relation] = records.length === 1 ? records[0] : records
          return model
        })
      }
      else {
        const records = relatedRecords.filter((record: { team_id: number }) => {
          return record.team_id === models.id
        })

        models[relation] = records.length === 1 ? records[0] : records
      }
    }
  }

  static with(relations: string[]): TeamModel {
    const instance = new TeamModel(undefined)

    return instance.applyWith(relations)
  }

  protected mapCustomGetters(models: TeamJsonResponse | TeamJsonResponse[]): void {
    const data = models

    if (Array.isArray(data)) {
      data.map((model: TeamJsonResponse) => {
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

  async mapCustomSetters(model: NewTeam | TeamUpdate): Promise<void> {
    const customSetter = {
      default: () => {
      },

    }

    for (const [key, fn] of Object.entries(customSetter)) {
      model[key] = await fn()
    }
  }

  get personal_access_tokens(): AccessTokenModel[] | [] {
    return this.attributes.personal_access_tokens
  }

  get id(): number {
    return this.attributes.id
  }

  get name(): string {
    return this.attributes.name
  }

  get company_name(): string {
    return this.attributes.company_name
  }

  get email(): string {
    return this.attributes.email
  }

  get billing_email(): string {
    return this.attributes.billing_email
  }

  get status(): string {
    return this.attributes.status
  }

  get description(): string {
    return this.attributes.description
  }

  get path(): string {
    return this.attributes.path
  }

  get is_personal(): boolean {
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

  getOriginal(column?: keyof TeamJsonResponse): Partial<TeamJsonResponse> {
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

  isDirty(column?: keyof TeamJsonResponse): boolean {
    if (column) {
      return this.attributes[column] !== this.originalAttributes[column]
    }

    return Object.entries(this.originalAttributes).some(([key, originalValue]) => {
      const currentValue = (this.attributes as any)[key]

      return currentValue !== originalValue
    })
  }

  isClean(column?: keyof TeamJsonResponse): boolean {
    return !this.isDirty(column)
  }

  wasChanged(column?: keyof TeamJsonResponse): boolean {
    return this.hasSaved && this.isDirty(column)
  }

  static select(params: (keyof TeamJsonResponse)[] | RawBuilder<string> | string): TeamModel {
    const instance = new TeamModel(undefined)

    return instance.applySelect(params)
  }

  // Method to find a Team by ID
  static async find(id: number): Promise<TeamModel | undefined> {
    const instance = new TeamModel(undefined)

    return await instance.applyFind(id)
  }

  async first(): Promise<TeamModel | undefined> {
    const model = await this.applyFirst()

    const data = new TeamModel(model)

    return data
  }

  static async first(): Promise<TeamModel | undefined> {
    const instance = new TeamModel(undefined)

    const model = await instance.applyFirst()

    const data = new TeamModel(model)

    return data
  }

  async applyFirstOrFail(): Promise<TeamModel | undefined> {
    const model = await this.selectFromQuery.executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, 'No TeamModel results found for query')

    if (model) {
      this.mapCustomGetters(model)
      await this.loadRelations(model)
    }

    const data = new TeamModel(model)

    return data
  }

  async firstOrFail(): Promise<TeamModel | undefined> {
    return await this.applyFirstOrFail()
  }

  static async firstOrFail(): Promise<TeamModel | undefined> {
    const instance = new TeamModel(undefined)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<TeamModel[]> {
    const instance = new TeamModel(undefined)

    const models = await DB.instance.selectFrom('teams').selectAll().execute()

    instance.mapCustomGetters(models)

    const data = await Promise.all(models.map(async (model: TeamJsonResponse) => {
      return new TeamModel(model)
    }))

    return data
  }

  async applyFindOrFail(id: number): Promise<TeamModel> {
    const model = await DB.instance.selectFrom('teams').where('id', '=', id).selectAll().executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, `No TeamModel results for ${id}`)

    cache.getOrSet(`team:${id}`, JSON.stringify(model))

    this.mapCustomGetters(model)
    await this.loadRelations(model)

    const data = new TeamModel(model)

    return data
  }

  async findOrFail(id: number): Promise<TeamModel> {
    return await this.applyFindOrFail(id)
  }

  static async findOrFail(id: number): Promise<TeamModel> {
    const instance = new TeamModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  static async findMany(ids: number[]): Promise<TeamModel[]> {
    const instance = new TeamModel(undefined)

    const models = await instance.applyFindMany(ids)

    return models.map((modelItem: UserJsonResponse) => instance.parseResult(new TeamModel(modelItem)))
  }

  async findMany(ids: number[]): Promise<TeamModel[]> {
    const models = await this.applyFindMany(ids)

    return models.map((modelItem: UserJsonResponse) => this.parseResult(new TeamModel(modelItem)))
  }

  skip(count: number): TeamModel {
    this.selectFromQuery = this.selectFromQuery.offset(count)

    return this
  }

  static skip(count: number): TeamModel {
    const instance = new TeamModel(undefined)

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
    const instance = new TeamModel(undefined)

    await instance.applyChunk(size, callback)
  }

  static take(count: number): TeamModel {
    const instance = new TeamModel(undefined)

    return instance.applyTake(count)
  }

  static async pluck<K extends keyof TeamModel>(field: K): Promise<TeamModel[K][]> {
    const instance = new TeamModel(undefined)

    if (instance.hasSelect) {
      const model = await instance.selectFromQuery.execute()
      return model.map((modelItem: TeamModel) => modelItem[field])
    }

    const model = await instance.selectFromQuery.selectAll().execute()

    return model.map((modelItem: TeamModel) => modelItem[field])
  }

  async pluck<K extends keyof TeamModel>(field: K): Promise<TeamModel[K][]> {
    if (this.hasSelect) {
      const model = await this.selectFromQuery.execute()
      return model.map((modelItem: TeamModel) => modelItem[field])
    }

    const model = await this.selectFromQuery.selectAll().execute()

    return model.map((modelItem: TeamModel) => modelItem[field])
  }

  static async count(): Promise<number> {
    const instance = new TeamModel(undefined)

    return instance.applyCount()
  }

  static async max(field: keyof TeamModel): Promise<number> {
    const instance = new TeamModel(undefined)

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
    const instance = new TeamModel(undefined)

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
    const instance = new TeamModel(undefined)

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
    const instance = new TeamModel(undefined)

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

    this.mapCustomGetters(models)
    await this.loadRelations(models)

    const data = await Promise.all(models.map(async (model: TeamJsonResponse) => {
      return new TeamModel(model)
    }))

    return data
  }

  async get(): Promise<TeamModel[]> {
    return await this.applyGet()
  }

  static async get(): Promise<TeamModel[]> {
    const instance = new TeamModel(undefined)

    return await instance.applyGet()
  }

  has(relation: string): TeamModel {
    this.selectFromQuery = this.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(
        selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.team_id`, '=', 'teams.id'),
      ),
    )

    return this
  }

  static has(relation: string): TeamModel {
    const instance = new TeamModel(undefined)

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
    const instance = new TeamModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(callback({ exists, selectFrom })),
    )

    return instance
  }

  applyWhereHas(
    relation: string,
    callback: (query: SubqueryBuilder<keyof TeamModel>) => void,
  ): TeamModel {
    const subqueryBuilder = new SubqueryBuilder()

    callback(subqueryBuilder)
    const conditions = subqueryBuilder.getConditions()

    this.selectFromQuery = this.selectFromQuery
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
    callback: (query: SubqueryBuilder<keyof TeamModel>) => void,
  ): TeamModel {
    return this.applyWhereHas(relation, callback)
  }

  static whereHas(
    relation: string,
    callback: (query: SubqueryBuilder<keyof TeamModel>) => void,
  ): TeamModel {
    const instance = new TeamModel(undefined)

    return instance.applyWhereHas(relation, callback)
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
    const instance = new TeamModel(undefined)

    return instance.applyDoesntHave(relation)
  }

  applyWhereDoesntHave(relation: string, callback: (query: SubqueryBuilder<TeamsTable>) => void): TeamModel {
    const subqueryBuilder = new SubqueryBuilder()

    callback(subqueryBuilder)
    const conditions = subqueryBuilder.getConditions()

    this.selectFromQuery = this.selectFromQuery
      .where(({ exists, selectFrom, not }: any) => {
        const subquery = selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.team_id`, '=', 'teams.id')

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

  whereDoesntHave(relation: string, callback: (query: SubqueryBuilder<TeamsTable>) => void): TeamModel {
    return this.applyWhereDoesntHave(relation, callback)
  }

  static whereDoesntHave(
    relation: string,
    callback: (query: SubqueryBuilder<TeamsTable>) => void,
  ): TeamModel {
    const instance = new TeamModel(undefined)

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
    const instance = new TeamModel(undefined)

    return await instance.applyPaginate(options)
  }

  async applyCreate(newTeam: NewTeam): Promise<TeamModel> {
    const filteredValues = Object.fromEntries(
      Object.entries(newTeam).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewTeam

    await this.mapCustomSetters(filteredValues)

    const result = await DB.instance.insertInto('teams')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await this.find(Number(result.numInsertedOrUpdatedRows)) as TeamModel

    return model
  }

  async create(newTeam: NewTeam): Promise<TeamModel> {
    return await this.applyCreate(newTeam)
  }

  static async create(newTeam: NewTeam): Promise<TeamModel> {
    const instance = new TeamModel(undefined)

    return await instance.applyCreate(newTeam)
  }

  static async createMany(newTeam: NewTeam[]): Promise<void> {
    const instance = new TeamModel(undefined)

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
  async delete(): Promise<TeamsTable> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()

    return await DB.instance.deleteFrom('teams')
      .where('id', '=', this.id)
      .execute()
  }

  static whereName(value: string): TeamModel {
    const instance = new TeamModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('name', '=', value)

    return instance
  }

  static whereCompanyName(value: string): TeamModel {
    const instance = new TeamModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('companyName', '=', value)

    return instance
  }

  static whereEmail(value: string): TeamModel {
    const instance = new TeamModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('email', '=', value)

    return instance
  }

  static whereBillingEmail(value: string): TeamModel {
    const instance = new TeamModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('billingEmail', '=', value)

    return instance
  }

  static whereStatus(value: string): TeamModel {
    const instance = new TeamModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('status', '=', value)

    return instance
  }

  static whereDescription(value: string): TeamModel {
    const instance = new TeamModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('description', '=', value)

    return instance
  }

  static wherePath(value: string): TeamModel {
    const instance = new TeamModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('path', '=', value)

    return instance
  }

  static whereIsPersonal(value: string): TeamModel {
    const instance = new TeamModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('isPersonal', '=', value)

    return instance
  }

  async teamUsers() {
    if (this.id === undefined)
      throw new HttpError(500, 'Relation Error!')

    const results = await DB.instance.selectFrom('users')
      .where('user_id', '=', this.id)
      .selectAll()
      .execute()

    const tableRelationIds = results.map((result: { user_id: number }) => result.user_id)

    if (!tableRelationIds.length)
      throw new HttpError(500, 'Relation Error!')

    const relationResults = await User.whereIn('id', tableRelationIds).get()

    return relationResults
  }

  distinct(column: keyof TeamJsonResponse): TeamModel {
    return this.applyDistinct(column)
  }

  static distinct(column: keyof TeamJsonResponse): TeamModel {
    const instance = new TeamModel(undefined)

    return instance.applyDistinct(column)
  }

  join(table: string, firstCol: string, secondCol: string): TeamModel {
    return this.applyJoin(table, firstCol, secondCol)
  }

  static join(table: string, firstCol: string, secondCol: string): TeamModel {
    const instance = new TeamModel(undefined)

    return instance.applyJoin(table, firstCol, secondCol)
  }

  toJSON(): TeamJsonResponse {
    const output = {

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
  const results: TeamJsonResponse = await query.execute()

  return results.map((modelItem: TeamJsonResponse) => new TeamModel(modelItem))
}

export async function whereCompanyName(value: string): Promise<TeamModel[]> {
  const query = DB.instance.selectFrom('teams').where('company_name', '=', value)
  const results: TeamJsonResponse = await query.execute()

  return results.map((modelItem: TeamJsonResponse) => new TeamModel(modelItem))
}

export async function whereEmail(value: string): Promise<TeamModel[]> {
  const query = DB.instance.selectFrom('teams').where('email', '=', value)
  const results: TeamJsonResponse = await query.execute()

  return results.map((modelItem: TeamJsonResponse) => new TeamModel(modelItem))
}

export async function whereBillingEmail(value: string): Promise<TeamModel[]> {
  const query = DB.instance.selectFrom('teams').where('billing_email', '=', value)
  const results: TeamJsonResponse = await query.execute()

  return results.map((modelItem: TeamJsonResponse) => new TeamModel(modelItem))
}

export async function whereStatus(value: string): Promise<TeamModel[]> {
  const query = DB.instance.selectFrom('teams').where('status', '=', value)
  const results: TeamJsonResponse = await query.execute()

  return results.map((modelItem: TeamJsonResponse) => new TeamModel(modelItem))
}

export async function whereDescription(value: string): Promise<TeamModel[]> {
  const query = DB.instance.selectFrom('teams').where('description', '=', value)
  const results: TeamJsonResponse = await query.execute()

  return results.map((modelItem: TeamJsonResponse) => new TeamModel(modelItem))
}

export async function wherePath(value: string): Promise<TeamModel[]> {
  const query = DB.instance.selectFrom('teams').where('path', '=', value)
  const results: TeamJsonResponse = await query.execute()

  return results.map((modelItem: TeamJsonResponse) => new TeamModel(modelItem))
}

export async function whereIsPersonal(value: boolean): Promise<TeamModel[]> {
  const query = DB.instance.selectFrom('teams').where('is_personal', '=', value)
  const results: TeamJsonResponse = await query.execute()

  return results.map((modelItem: TeamJsonResponse) => new TeamModel(modelItem))
}

export const Team = TeamModel

export default Team
