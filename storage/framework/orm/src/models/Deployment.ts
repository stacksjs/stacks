import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { UserModel } from './User'
import { randomUUIDv7 } from 'bun'
import { cache } from '@stacksjs/cache'
import { sql } from '@stacksjs/database'
import { HttpError, ModelNotFoundException } from '@stacksjs/error-handling'
import { BaseOrm, DB, SubqueryBuilder } from '@stacksjs/orm'

import User from './User'

export interface DeploymentsTable {
  id: Generated<number>
  user_id: number
  commit_sha: string
  commit_message: string
  branch: string
  status: string
  execution_time: number
  deploy_script: string
  terminal_output: string
  uuid?: string

  created_at?: Date

  updated_at?: Date

}

export interface DeploymentResponse {
  data: DeploymentJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface DeploymentJsonResponse extends Omit<Selectable<DeploymentsTable>, 'password'> {
  [key: string]: any
}

export type NewDeployment = Insertable<DeploymentsTable>
export type DeploymentUpdate = Updateable<DeploymentsTable>

      type SortDirection = 'asc' | 'desc'
interface SortOptions { column: DeploymentJsonResponse, order: SortDirection }
// Define a type for the options parameter
interface QueryOptions {
  sort?: SortOptions
  limit?: number
  offset?: number
  page?: number
}

export class DeploymentModel extends BaseOrm<DeploymentModel, DeploymentsTable, DeploymentJsonResponse> {
  private readonly hidden: Array<keyof DeploymentJsonResponse> = []
  private readonly fillable: Array<keyof DeploymentJsonResponse> = ['commit_sha', 'commit_message', 'branch', 'status', 'execution_time', 'deploy_script', 'terminal_output', 'uuid', 'user_id']
  private readonly guarded: Array<keyof DeploymentJsonResponse> = []
  protected attributes = {} as DeploymentJsonResponse
  protected originalAttributes = {} as DeploymentJsonResponse

  protected selectFromQuery: any
  protected updateFromQuery: any
  protected deleteFromQuery: any
  protected hasSelect: boolean
  private hasSaved: boolean
  private customColumns: Record<string, unknown> = {}

  constructor(deployment: DeploymentJsonResponse | undefined) {
    super('deployments')
    if (deployment) {
      this.attributes = { ...deployment }
      this.originalAttributes = { ...deployment }

      Object.keys(deployment).forEach((key) => {
        if (!(key in this)) {
          this.customColumns[key] = (deployment as DeploymentJsonResponse)[key]
        }
      })
    }

    this.withRelations = []
    this.selectFromQuery = DB.instance.selectFrom('deployments')
    this.updateFromQuery = DB.instance.updateTable('deployments')
    this.deleteFromQuery = DB.instance.deleteFrom('deployments')
    this.hasSelect = false
    this.hasSaved = false
  }

  protected mapCustomGetters(models: DeploymentJsonResponse | DeploymentJsonResponse[]): void {
    const data = models

    if (Array.isArray(data)) {
      data.map((model: DeploymentJsonResponse) => {
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

  async mapCustomSetters(model: NewDeployment | DeploymentUpdate): Promise<void> {
    const customSetter = {
      default: () => {
      },

    }

    for (const [key, fn] of Object.entries(customSetter)) {
      model[key] = await fn()
    }
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

  get uuid(): string | undefined {
    return this.attributes.uuid
  }

  get commit_sha(): string {
    return this.attributes.commit_sha
  }

  get commit_message(): string {
    return this.attributes.commit_message
  }

  get branch(): string {
    return this.attributes.branch
  }

  get status(): string {
    return this.attributes.status
  }

  get execution_time(): number {
    return this.attributes.execution_time
  }

  get deploy_script(): string {
    return this.attributes.deploy_script
  }

  get terminal_output(): string {
    return this.attributes.terminal_output
  }

  get created_at(): Date | undefined {
    return this.attributes.created_at
  }

  get updated_at(): Date | undefined {
    return this.attributes.updated_at
  }

  set uuid(value: string) {
    this.attributes.uuid = value
  }

  set commit_sha(value: string) {
    this.attributes.commit_sha = value
  }

  set commit_message(value: string) {
    this.attributes.commit_message = value
  }

  set branch(value: string) {
    this.attributes.branch = value
  }

  set status(value: string) {
    this.attributes.status = value
  }

  set execution_time(value: number) {
    this.attributes.execution_time = value
  }

  set deploy_script(value: string) {
    this.attributes.deploy_script = value
  }

  set terminal_output(value: string) {
    this.attributes.terminal_output = value
  }

  set updated_at(value: Date) {
    this.attributes.updated_at = value
  }

  getOriginal(column?: keyof DeploymentJsonResponse): Partial<DeploymentJsonResponse> {
    if (column) {
      return this.originalAttributes[column]
    }

    return this.originalAttributes
  }

  getChanges(): Partial<DeploymentJsonResponse> {
    return this.fillable.reduce<Partial<DeploymentJsonResponse>>((changes, key) => {
      const currentValue = this.attributes[key as keyof DeploymentsTable]
      const originalValue = this.originalAttributes[key as keyof DeploymentsTable]

      if (currentValue !== originalValue) {
        changes[key] = currentValue
      }

      return changes
    }, {})
  }

  isDirty(column?: keyof DeploymentJsonResponse): boolean {
    if (column) {
      return this.attributes[column] !== this.originalAttributes[column]
    }

    return Object.entries(this.originalAttributes).some(([key, originalValue]) => {
      const currentValue = (this.attributes as any)[key]

      return currentValue !== originalValue
    })
  }

  isClean(column?: keyof DeploymentJsonResponse): boolean {
    return !this.isDirty(column)
  }

  wasChanged(column?: keyof DeploymentJsonResponse): boolean {
    return this.hasSaved && this.isDirty(column)
  }

  static select(params: (keyof DeploymentJsonResponse)[] | RawBuilder<string> | string): DeploymentModel {
    const instance = new DeploymentModel(undefined)

    return instance.applySelect(params)
  }

  // Method to find a Deployment by ID
  static async find(id: number): Promise<DeploymentModel | undefined> {
    const instance = new DeploymentModel(undefined)

    return await instance.applyFind(id)
  }

  async first(): Promise<DeploymentModel | undefined> {
    const model = await this.applyFirst()

    const data = new DeploymentModel(model)

    return data
  }

  static async first(): Promise<DeploymentModel | undefined> {
    const instance = new DeploymentModel(undefined)

    const model = await instance.applyFirst()

    const data = new DeploymentModel(model)

    return data
  }

  async applyFirstOrFail(): Promise<DeploymentModel | undefined> {
    const model = await this.selectFromQuery.executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, 'No DeploymentModel results found for query')

    if (model) {
      this.mapCustomGetters(model)
      await this.loadRelations(model)
    }

    const data = new DeploymentModel(model)

    return data
  }

  async firstOrFail(): Promise<DeploymentModel | undefined> {
    return await this.applyFirstOrFail()
  }

  static async firstOrFail(): Promise<DeploymentModel | undefined> {
    const instance = new DeploymentModel(undefined)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<DeploymentModel[]> {
    const instance = new DeploymentModel(undefined)

    const models = await DB.instance.selectFrom('deployments').selectAll().execute()

    instance.mapCustomGetters(models)

    const data = await Promise.all(models.map(async (model: DeploymentJsonResponse) => {
      return new DeploymentModel(model)
    }))

    return data
  }

  async applyFindOrFail(id: number): Promise<DeploymentModel> {
    const model = await DB.instance.selectFrom('deployments').where('id', '=', id).selectAll().executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, `No DeploymentModel results for ${id}`)

    cache.getOrSet(`deployment:${id}`, JSON.stringify(model))

    this.mapCustomGetters(model)
    await this.loadRelations(model)

    const data = new DeploymentModel(model)

    return data
  }

  async findOrFail(id: number): Promise<DeploymentModel> {
    return await this.applyFindOrFail(id)
  }

  static async findOrFail(id: number): Promise<DeploymentModel> {
    const instance = new DeploymentModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  static async findMany(ids: number[]): Promise<DeploymentModel[]> {
    const instance = new DeploymentModel(undefined)

    const models = await instance.applyFindMany(ids)

    return models.map((modelItem: UserJsonResponse) => instance.parseResult(new DeploymentModel(modelItem)))
  }

  async findMany(ids: number[]): Promise<DeploymentModel[]> {
    const models = await this.applyFindMany(ids)

    return models.map((modelItem: UserJsonResponse) => this.parseResult(new DeploymentModel(modelItem)))
  }

  skip(count: number): DeploymentModel {
    this.selectFromQuery = this.selectFromQuery.offset(count)

    return this
  }

  static skip(count: number): DeploymentModel {
    const instance = new DeploymentModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.offset(count)

    return instance
  }

  async applyChunk(size: number, callback: (models: DeploymentModel[]) => Promise<void>): Promise<void> {
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

  async chunk(size: number, callback: (models: DeploymentModel[]) => Promise<void>): Promise<void> {
    await this.applyChunk(size, callback)
  }

  static async chunk(size: number, callback: (models: DeploymentModel[]) => Promise<void>): Promise<void> {
    const instance = new DeploymentModel(undefined)

    await instance.applyChunk(size, callback)
  }

  static take(count: number): DeploymentModel {
    const instance = new DeploymentModel(undefined)

    return instance.applyTake(count)
  }

  static async pluck<K extends keyof DeploymentModel>(field: K): Promise<DeploymentModel[K][]> {
    const instance = new DeploymentModel(undefined)

    if (instance.hasSelect) {
      const model = await instance.selectFromQuery.execute()
      return model.map((modelItem: DeploymentModel) => modelItem[field])
    }

    const model = await instance.selectFromQuery.selectAll().execute()

    return model.map((modelItem: DeploymentModel) => modelItem[field])
  }

  async pluck<K extends keyof DeploymentModel>(field: K): Promise<DeploymentModel[K][]> {
    if (this.hasSelect) {
      const model = await this.selectFromQuery.execute()
      return model.map((modelItem: DeploymentModel) => modelItem[field])
    }

    const model = await this.selectFromQuery.selectAll().execute()

    return model.map((modelItem: DeploymentModel) => modelItem[field])
  }

  static async count(): Promise<number> {
    const instance = new DeploymentModel(undefined)

    return instance.applyCount()
  }

  static async max(field: keyof DeploymentModel): Promise<number> {
    const instance = new DeploymentModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`MAX(${sql.raw(field as string)}) as max `)
      .executeTakeFirst()

    return result.max
  }

  async max(field: keyof DeploymentModel): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`MAX(${sql.raw(field as string)}) as max`)
      .executeTakeFirst()

    return result.max
  }

  static async min(field: keyof DeploymentModel): Promise<number> {
    const instance = new DeploymentModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`MIN(${sql.raw(field as string)}) as min `)
      .executeTakeFirst()

    return result.min
  }

  async min(field: keyof DeploymentModel): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`MIN(${sql.raw(field as string)}) as min `)
      .executeTakeFirst()

    return result.min
  }

  static async avg(field: keyof DeploymentModel): Promise<number> {
    const instance = new DeploymentModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`AVG(${sql.raw(field as string)}) as avg `)
      .executeTakeFirst()

    return result.avg
  }

  async avg(field: keyof DeploymentModel): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`AVG(${sql.raw(field as string)}) as avg `)
      .executeTakeFirst()

    return result.avg
  }

  static async sum(field: keyof DeploymentModel): Promise<number> {
    const instance = new DeploymentModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`SUM(${sql.raw(field as string)}) as sum `)
      .executeTakeFirst()

    return result.sum
  }

  async sum(field: keyof DeploymentModel): Promise<number> {
    const result = this.selectFromQuery
      .select(sql`SUM(${sql.raw(field as string)}) as sum `)
      .executeTakeFirst()

    return result.sum
  }

  async applyGet(): Promise<DeploymentModel[]> {
    let models

    if (this.hasSelect) {
      models = await this.selectFromQuery.execute()
    }
    else {
      models = await this.selectFromQuery.selectAll().execute()
    }

    this.mapCustomGetters(models)
    await this.loadRelations(models)

    const data = await Promise.all(models.map(async (model: DeploymentJsonResponse) => {
      return new DeploymentModel(model)
    }))

    return data
  }

  async get(): Promise<DeploymentModel[]> {
    return await this.applyGet()
  }

  static async get(): Promise<DeploymentModel[]> {
    const instance = new DeploymentModel(undefined)

    return await instance.applyGet()
  }

  has(relation: string): DeploymentModel {
    this.selectFromQuery = this.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(
        selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.deployment_id`, '=', 'deployments.id'),
      ),
    )

    return this
  }

  static has(relation: string): DeploymentModel {
    const instance = new DeploymentModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(
        selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.deployment_id`, '=', 'deployments.id'),
      ),
    )

    return instance
  }

  static whereExists(callback: (qb: any) => any): DeploymentModel {
    const instance = new DeploymentModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(callback({ exists, selectFrom })),
    )

    return instance
  }

  applyWhereHas(
    relation: string,
    callback: (query: SubqueryBuilder<keyof DeploymentModel>) => void,
  ): DeploymentModel {
    const subqueryBuilder = new SubqueryBuilder()

    callback(subqueryBuilder)
    const conditions = subqueryBuilder.getConditions()

    this.selectFromQuery = this.selectFromQuery
      .where(({ exists, selectFrom }: any) => {
        let subquery = selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.deployment_id`, '=', 'deployments.id')

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
    callback: (query: SubqueryBuilder<keyof DeploymentModel>) => void,
  ): DeploymentModel {
    return this.applyWhereHas(relation, callback)
  }

  static whereHas(
    relation: string,
    callback: (query: SubqueryBuilder<keyof DeploymentModel>) => void,
  ): DeploymentModel {
    const instance = new DeploymentModel(undefined)

    return instance.applyWhereHas(relation, callback)
  }

  applyDoesntHave(relation: string): DeploymentModel {
    this.selectFromQuery = this.selectFromQuery.where(({ not, exists, selectFrom }: any) =>
      not(
        exists(
          selectFrom(relation)
            .select('1')
            .whereRef(`${relation}.deployment_id`, '=', 'deployments.id'),
        ),
      ),
    )

    return this
  }

  doesntHave(relation: string): DeploymentModel {
    return this.applyDoesntHave(relation)
  }

  static doesntHave(relation: string): DeploymentModel {
    const instance = new DeploymentModel(undefined)

    return instance.applyDoesntHave(relation)
  }

  applyWhereDoesntHave(relation: string, callback: (query: SubqueryBuilder<DeploymentsTable>) => void): DeploymentModel {
    const subqueryBuilder = new SubqueryBuilder()

    callback(subqueryBuilder)
    const conditions = subqueryBuilder.getConditions()

    this.selectFromQuery = this.selectFromQuery
      .where(({ exists, selectFrom, not }: any) => {
        const subquery = selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.deployment_id`, '=', 'deployments.id')

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

  whereDoesntHave(relation: string, callback: (query: SubqueryBuilder<DeploymentsTable>) => void): DeploymentModel {
    return this.applyWhereDoesntHave(relation, callback)
  }

  static whereDoesntHave(
    relation: string,
    callback: (query: SubqueryBuilder<DeploymentsTable>) => void,
  ): DeploymentModel {
    const instance = new DeploymentModel(undefined)

    return instance.applyWhereDoesntHave(relation, callback)
  }

  async applyPaginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<DeploymentResponse> {
    const totalRecordsResult = await DB.instance.selectFrom('deployments')
      .select(DB.instance.fn.count('id').as('total')) // Use 'id' or another actual column name
      .executeTakeFirst()

    const totalRecords = Number(totalRecordsResult?.total) || 0
    const totalPages = Math.ceil(totalRecords / (options.limit ?? 10))

    const deploymentsWithExtra = await DB.instance.selectFrom('deployments')
      .selectAll()
      .orderBy('id', 'asc') // Assuming 'id' is used for cursor-based pagination
      .limit((options.limit ?? 10) + 1) // Fetch one extra record
      .offset(((options.page ?? 1) - 1) * (options.limit ?? 10)) // Ensure options.page is not undefined
      .execute()

    let nextCursor = null
    if (deploymentsWithExtra.length > (options.limit ?? 10))
      nextCursor = deploymentsWithExtra.pop()?.id ?? null

    return {
      data: deploymentsWithExtra,
      paging: {
        total_records: totalRecords,
        page: options.page || 1,
        total_pages: totalPages,
      },
      next_cursor: nextCursor,
    }
  }

  async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<DeploymentResponse> {
    return await this.applyPaginate(options)
  }

  // Method to get all deployments
  static async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<DeploymentResponse> {
    const instance = new DeploymentModel(undefined)

    return await instance.applyPaginate(options)
  }

  async applyCreate(newDeployment: NewDeployment): Promise<DeploymentModel> {
    const filteredValues = Object.fromEntries(
      Object.entries(newDeployment).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewDeployment

    await this.mapCustomSetters(filteredValues)

    filteredValues.uuid = randomUUIDv7()

    const result = await DB.instance.insertInto('deployments')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await this.find(Number(result.numInsertedOrUpdatedRows)) as DeploymentModel

    return model
  }

  async create(newDeployment: NewDeployment): Promise<DeploymentModel> {
    return await this.applyCreate(newDeployment)
  }

  static async create(newDeployment: NewDeployment): Promise<DeploymentModel> {
    const instance = new DeploymentModel(undefined)

    return await instance.applyCreate(newDeployment)
  }

  static async createMany(newDeployment: NewDeployment[]): Promise<void> {
    const instance = new DeploymentModel(undefined)

    const valuesFiltered = newDeployment.map((newDeployment: NewDeployment) => {
      const filteredValues = Object.fromEntries(
        Object.entries(newDeployment).filter(([key]) =>
          !instance.guarded.includes(key) && instance.fillable.includes(key),
        ),
      ) as NewDeployment

      filteredValues.uuid = randomUUIDv7()

      return filteredValues
    })

    await DB.instance.insertInto('deployments')
      .values(valuesFiltered)
      .executeTakeFirst()
  }

  static async forceCreate(newDeployment: NewDeployment): Promise<DeploymentModel> {
    const result = await DB.instance.insertInto('deployments')
      .values(newDeployment)
      .executeTakeFirst()

    const model = await find(Number(result.numInsertedOrUpdatedRows)) as DeploymentModel

    return model
  }

  // Method to remove a Deployment
  async delete(): Promise<DeploymentsTable> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()

    return await DB.instance.deleteFrom('deployments')
      .where('id', '=', this.id)
      .execute()
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

  distinct(column: keyof DeploymentJsonResponse): DeploymentModel {
    return this.applyDistinct(column)
  }

  static distinct(column: keyof DeploymentJsonResponse): DeploymentModel {
    const instance = new DeploymentModel(undefined)

    return instance.applyDistinct(column)
  }

  join(table: string, firstCol: string, secondCol: string): DeploymentModel {
    return this.applyJoin(table, firstCol, secondCol)
  }

  static join(table: string, firstCol: string, secondCol: string): DeploymentModel {
    const instance = new DeploymentModel(undefined)

    return instance.applyJoin(table, firstCol, secondCol)
  }

  toJSON(): DeploymentJsonResponse {
    const output = {

      uuid: this.uuid,

      id: this.id,
      commit_sha: this.commit_sha,
      commit_message: this.commit_message,
      branch: this.branch,
      status: this.status,
      execution_time: this.execution_time,
      deploy_script: this.deploy_script,
      terminal_output: this.terminal_output,

      created_at: this.created_at,

      updated_at: this.updated_at,

      user_id: this.user_id,
      user: this.user,
      ...this.customColumns,
    }

    return output
  }

  parseResult(model: DeploymentModel): DeploymentModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof DeploymentModel]
    }

    return model
  }
}

async function find(id: number): Promise<DeploymentModel | undefined> {
  const query = DB.instance.selectFrom('deployments').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  return new DeploymentModel(model)
}

export async function count(): Promise<number> {
  const results = await DeploymentModel.count()

  return results
}

export async function create(newDeployment: NewDeployment): Promise<DeploymentModel> {
  const result = await DB.instance.insertInto('deployments')
    .values(newDeployment)
    .executeTakeFirstOrThrow()

  return await find(Number(result.numInsertedOrUpdatedRows)) as DeploymentModel
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(DB.instance)
}

export async function remove(id: number): Promise<void> {
  await DB.instance.deleteFrom('deployments')
    .where('id', '=', id)
    .execute()
}

export async function whereCommitSha(value: string): Promise<DeploymentModel[]> {
  const query = DB.instance.selectFrom('deployments').where('commit_sha', '=', value)
  const results: DeploymentJsonResponse = await query.execute()

  return results.map((modelItem: DeploymentJsonResponse) => new DeploymentModel(modelItem))
}

export async function whereCommitMessage(value: string): Promise<DeploymentModel[]> {
  const query = DB.instance.selectFrom('deployments').where('commit_message', '=', value)
  const results: DeploymentJsonResponse = await query.execute()

  return results.map((modelItem: DeploymentJsonResponse) => new DeploymentModel(modelItem))
}

export async function whereBranch(value: string): Promise<DeploymentModel[]> {
  const query = DB.instance.selectFrom('deployments').where('branch', '=', value)
  const results: DeploymentJsonResponse = await query.execute()

  return results.map((modelItem: DeploymentJsonResponse) => new DeploymentModel(modelItem))
}

export async function whereStatus(value: string): Promise<DeploymentModel[]> {
  const query = DB.instance.selectFrom('deployments').where('status', '=', value)
  const results: DeploymentJsonResponse = await query.execute()

  return results.map((modelItem: DeploymentJsonResponse) => new DeploymentModel(modelItem))
}

export async function whereExecutionTime(value: number): Promise<DeploymentModel[]> {
  const query = DB.instance.selectFrom('deployments').where('execution_time', '=', value)
  const results: DeploymentJsonResponse = await query.execute()

  return results.map((modelItem: DeploymentJsonResponse) => new DeploymentModel(modelItem))
}

export async function whereDeployScript(value: string): Promise<DeploymentModel[]> {
  const query = DB.instance.selectFrom('deployments').where('deploy_script', '=', value)
  const results: DeploymentJsonResponse = await query.execute()

  return results.map((modelItem: DeploymentJsonResponse) => new DeploymentModel(modelItem))
}

export async function whereTerminalOutput(value: string): Promise<DeploymentModel[]> {
  const query = DB.instance.selectFrom('deployments').where('terminal_output', '=', value)
  const results: DeploymentJsonResponse = await query.execute()

  return results.map((modelItem: DeploymentJsonResponse) => new DeploymentModel(modelItem))
}

export const Deployment = DeploymentModel

export default Deployment
