import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { AccessTokenModel } from './AccessToken'
import { sql } from '@stacksjs/database'
import { HttpError } from '@stacksjs/error-handling'
import { BaseOrm, DB } from '@stacksjs/orm'

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

  /**
   * This model inherits many query methods from BaseOrm:
   * - pluck, chunk, whereExists, has, doesntHave, whereHas, whereDoesntHave
   * - inRandomOrder, max, min, avg, paginate, get, and more
   *
   * See BaseOrm class for the full list of inherited methods.
   */

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

  async mapCustomSetters(model: NewTeam | TeamUpdate): Promise<void> {
    const customSetter = {
      default: () => {
      },

    }

    for (const [key, fn] of Object.entries(customSetter)) {
      (model as any)[key] = await fn()
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

  static select(params: (keyof TeamJsonResponse)[] | RawBuilder<string> | string): TeamModel {
    const instance = new TeamModel(undefined)

    return instance.applySelect(params)
  }

  // Method to find a Team by ID
  static async find(id: number): Promise<TeamModel | undefined> {
    const instance = new TeamModel(undefined)

    return await instance.applyFind(id)
  }

  static async first(): Promise<TeamModel | undefined> {
    const instance = new TeamModel(undefined)

    const model = await instance.applyFirst()

    const data = new TeamModel(model)

    return data
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

  static async findOrFail(id: number): Promise<TeamModel | undefined> {
    const instance = new TeamModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  static async findMany(ids: number[]): Promise<TeamModel[]> {
    const instance = new TeamModel(undefined)

    const models = await instance.applyFindMany(ids)

    return models.map((modelItem: UserJsonResponse) => instance.parseResult(new TeamModel(modelItem)))
  }

  static skip(count: number): TeamModel {
    const instance = new TeamModel(undefined)

    return instance.applySkip(count)
  }

  static take(count: number): TeamModel {
    const instance = new TeamModel(undefined)

    return instance.applyTake(count)
  }

  static where<V = string>(column: keyof TeamsTable, ...args: [V] | [Operator, V]): TeamModel {
    const instance = new TeamModel(undefined)

    return instance.applyWhere<V>(column, ...args)
  }

  static orWhere(...conditions: [string, any][]): TeamModel {
    const instance = new TeamModel(undefined)

    return instance.applyOrWhere(...conditions)
  }

  static whereNotIn<V = number>(column: keyof TeamsTable, values: V[]): TeamModel {
    const instance = new TeamModel(undefined)

    return instance.applyWhereNotIn<V>(column, values)
  }

  static whereLike(column: keyof TeamsTable, value: string): TeamModel {
    const instance = new TeamModel(undefined)

    return instance.applyWhereLike(column, value)
  }

  static orderBy(column: keyof TeamsTable, order: 'asc' | 'desc'): TeamModel {
    const instance = new TeamModel(undefined)

    return instance.applyOrderBy(column, order)
  }

  static orderByAsc(column: keyof TeamsTable): TeamModel {
    const instance = new TeamModel(undefined)

    return instance.applyOrderByAsc(column)
  }

  static orderByDesc(column: keyof TeamsTable): TeamModel {
    const instance = new TeamModel(undefined)

    return instance.applyOrderByDesc(column)
  }

  static async max(field: keyof TeamsTable): Promise<number> {
    const instance = new TeamModel(undefined)

    return await instance.applyMax(field)
  }

  static async min(field: keyof TeamsTable): Promise<number> {
    const instance = new TeamModel(undefined)

    return await instance.applyMin(field)
  }

  static async avg(field: keyof TeamsTable): Promise<number> {
    const instance = new TeamModel(undefined)

    return await instance.applyAvg(field)
  }

  static async sum(field: keyof TeamsTable): Promise<number> {
    const instance = new TeamModel(undefined)

    return await instance.applySum(field)
  }

  static async count(): Promise<number> {
    const instance = new TeamModel(undefined)

    return instance.applyCount()
  }

  static async paginate(options: { limit?: number, offset?: number, page?: number } = { limit: 10, offset: 0, page: 1 }): Promise<{
    data: TeamModel[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }> {
    const instance = new TeamModel(undefined)

    const result = await instance.applyPaginate(options)

    return {
      data: result.data.map((item: TeamJsonResponse) => new TeamModel(item)),
      paging: result.paging,
      next_cursor: result.next_cursor,
    }
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

  async update(newTeam: TeamUpdate): Promise<TeamModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newTeam).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as TeamUpdate

    await this.mapCustomSetters(filteredValues)

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

  async forceUpdate(newTeam: TeamUpdate): Promise<TeamModel | undefined> {
    await DB.instance.updateTable('teams')
      .set(newTeam)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      const model = await this.find(this.id)

      return model
    }

    return undefined
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
  async delete(): Promise<number> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()

    const deleted = await DB.instance.deleteFrom('teams')
      .where('id', '=', this.id)
      .execute()

    return deleted.numDeletedRows
  }

  static async remove(id: number): Promise<any> {
    return await DB.instance.deleteFrom('teams')
      .where('id', '=', id)
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

  static whereIn<V = number>(column: keyof TeamsTable, values: V[]): TeamModel {
    const instance = new TeamModel(undefined)

    return instance.applyWhereIn<V>(column, values)
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

  static distinct(column: keyof TeamJsonResponse): TeamModel {
    const instance = new TeamModel(undefined)

    return instance.applyDistinct(column)
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
