import type { Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { UserModel } from './User'
import { randomUUIDv7 } from 'bun'
import { cache } from '@stacksjs/cache'
import { db, sql } from '@stacksjs/database'
import { HttpError, ModelNotFoundException } from '@stacksjs/error-handling'
import { SubqueryBuilder } from '@stacksjs/orm'

import User from './User'

export interface DeploymentsTable {
  id?: number
  user_id?: number
  user?: UserModel
  commit_sha?: string
  commit_message?: string
  branch?: string
  status?: string
  execution_time?: number
  deploy_script?: string
  terminal_output?: string
  uuid?: string

  created_at?: Date

  updated_at?: Date

}

interface DeploymentResponse {
  data: DeploymentJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface DeploymentJsonResponse extends Omit<DeploymentsTable, 'password'> {
  [key: string]: any
}

export type DeploymentType = Selectable<DeploymentsTable>
export type NewDeployment = Partial<Insertable<DeploymentsTable>>
export type DeploymentUpdate = Updateable<DeploymentsTable>

      type SortDirection = 'asc' | 'desc'
interface SortOptions { column: DeploymentType, order: SortDirection }
// Define a type for the options parameter
interface QueryOptions {
  sort?: SortOptions
  limit?: number
  offset?: number
  page?: number
}

export class DeploymentModel {
  private readonly hidden: Array<keyof DeploymentJsonResponse> = []
  private readonly fillable: Array<keyof DeploymentJsonResponse> = ['commit_sha', 'commit_message', 'branch', 'status', 'execution_time', 'deploy_script', 'terminal_output', 'uuid', 'user_id']

  protected selectFromQuery: any
  protected withRelations: string[]
  protected updateFromQuery: any
  protected deleteFromQuery: any
  protected hasSelect: boolean
  private customColumns: Record<string, unknown> = {}
  public user_id: number | undefined
  public user: UserModel | undefined
  public id: number | undefined
  public uuid: string | undefined
  public commit_sha: string | undefined
  public commit_message: string | undefined
  public branch: string | undefined
  public status: string | undefined
  public execution_time: number | undefined
  public deploy_script: string | undefined
  public terminal_output: string | undefined

  public created_at: Date | undefined
  public updated_at: Date | undefined

  constructor(deployment: Partial<DeploymentType> | null) {
    if (deployment) {
      this.user_id = deployment?.user_id
      this.user = deployment?.user
      this.id = deployment?.id || 1
      this.uuid = deployment?.uuid
      this.commit_sha = deployment?.commit_sha
      this.commit_message = deployment?.commit_message
      this.branch = deployment?.branch
      this.status = deployment?.status
      this.execution_time = deployment?.execution_time
      this.deploy_script = deployment?.deploy_script
      this.terminal_output = deployment?.terminal_output

      this.created_at = deployment?.created_at

      this.updated_at = deployment?.updated_at

      Object.keys(deployment).forEach((key) => {
        if (!(key in this)) {
          this.customColumns[key] = (deployment as DeploymentJsonResponse)[key]
        }
      })
    }

    this.withRelations = []
    this.selectFromQuery = db.selectFrom('deployments')
    this.updateFromQuery = db.updateTable('deployments')
    this.deleteFromQuery = db.deleteFrom('deployments')
    this.hasSelect = false
  }

  select(params: (keyof DeploymentType)[] | RawBuilder<string> | string): DeploymentModel {
    this.selectFromQuery = this.selectFromQuery.select(params)

    this.hasSelect = true

    return this
  }

  static select(params: (keyof DeploymentType)[] | RawBuilder<string> | string): DeploymentModel {
    const instance = new DeploymentModel(null)

    // Initialize a query with the table name and selected fields
    instance.selectFromQuery = instance.selectFromQuery.select(params)

    instance.hasSelect = true

    return instance
  }

  async find(id: number): Promise<DeploymentModel | undefined> {
    return DeploymentModel.find(id)
  }

  async first(): Promise<DeploymentModel | undefined> {
    const model = await this.selectFromQuery.selectAll().executeTakeFirst()

    if (!model)
      return undefined

    const result = await this.mapWith(model)

    const data = new DeploymentModel(result as DeploymentType)

    return data
  }

  static async first(): Promise<DeploymentType | undefined> {
    const model = await db.selectFrom('deployments')
      .selectAll()
      .executeTakeFirst()

    if (!model)
      return undefined

    const instance = new DeploymentModel(null)

    const result = await instance.mapWith(model)

    const data = new DeploymentModel(result as DeploymentType)

    return data
  }

  async firstOrFail(): Promise<DeploymentModel | undefined> {
    return this.firstOrFail()
  }

  static async firstOrFail(): Promise<DeploymentModel | undefined> {
    const instance = new DeploymentModel(null)

    const model = await instance.selectFromQuery.executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, 'No DeploymentModel results found for query')

    const result = await instance.mapWith(model)

    const data = new DeploymentModel(result as DeploymentType)

    return data
  }

  // Method to find a Deployment by ID
  static async find(id: number): Promise<DeploymentModel | undefined> {
    const model = await db.selectFrom('deployments').where('id', '=', id).selectAll().executeTakeFirst()

    if (!model)
      return undefined

    const instance = new DeploymentModel(null)

    const result = await instance.mapWith(model)

    const data = new DeploymentModel(result as DeploymentType)

    cache.getOrSet(`deployment:${id}`, JSON.stringify(model))

    return data
  }

  async mapWith(model: DeploymentType): Promise<DeploymentType> {
    if (this.withRelations.includes('user')) {
      model.user = await this.userBelong()
    }

    return model
  }

  static async all(): Promise<DeploymentModel[]> {
    const models = await db.selectFrom('deployments').selectAll().execute()

    const data = await Promise.all(models.map(async (model: DeploymentType) => {
      const instance = new DeploymentModel(model)

      const results = await instance.mapWith(model)

      return new DeploymentModel(results)
    }))

    return data
  }

  static async findOrFail(id: number): Promise<DeploymentModel> {
    const model = await db.selectFrom('deployments').where('id', '=', id).selectAll().executeTakeFirst()

    const instance = new DeploymentModel(null)

    if (model === undefined)
      throw new ModelNotFoundException(404, `No DeploymentModel results for ${id}`)

    cache.getOrSet(`deployment:${id}`, JSON.stringify(model))

    const result = await instance.mapWith(model)

    const data = new DeploymentModel(result as DeploymentType)

    return data
  }

  async findOrFail(id: number): Promise<DeploymentModel> {
    return DeploymentModel.findOrFail(id)
  }

  static async findMany(ids: number[]): Promise<DeploymentModel[]> {
    let query = db.selectFrom('deployments').where('id', 'in', ids)

    const instance = new DeploymentModel(null)

    query = query.selectAll()

    const model = await query.execute()

    return model.map(modelItem => instance.parseResult(new DeploymentModel(modelItem)))
  }

  skip(count: number): DeploymentModel {
    return DeploymentModel.skip(count)
  }

  static skip(count: number): DeploymentModel {
    const instance = new DeploymentModel(null)

    instance.selectFromQuery = instance.selectFromQuery.offset(count)

    return instance
  }

  take(count: number): DeploymentModel {
    return DeploymentModel.take(count)
  }

  static take(count: number): DeploymentModel {
    const instance = new DeploymentModel(null)

    instance.selectFromQuery = instance.selectFromQuery.limit(count)

    return instance
  }

  static async pluck<K extends keyof DeploymentModel>(field: K): Promise<DeploymentModel[K][]> {
    const instance = new DeploymentModel(null)

    if (instance.hasSelect) {
      const model = await instance.selectFromQuery.execute()
      return model.map((modelItem: DeploymentModel) => modelItem[field])
    }

    const model = await instance.selectFromQuery.selectAll().execute()

    return model.map((modelItem: DeploymentModel) => modelItem[field])
  }

  async pluck<K extends keyof DeploymentModel>(field: K): Promise<DeploymentModel[K][]> {
    return DeploymentModel.pluck(field)
  }

  static async count(): Promise<number> {
    const instance = new DeploymentModel(null)

    return instance.selectFromQuery
      .select(sql`COUNT(*) as count`)
      .executeTakeFirst()
  }

  async count(): Promise<number> {
    return DeploymentModel.count()
  }

  async max(field: keyof DeploymentModel): Promise<number> {
    return await this.selectFromQuery
      .select(sql`MAX(${sql.raw(field as string)}) `)
      .executeTakeFirst()
  }

  async min(field: keyof DeploymentModel): Promise<number> {
    return await this.selectFromQuery
      .select(sql`MIN(${sql.raw(field as string)}) `)
      .executeTakeFirst()
  }

  async avg(field: keyof DeploymentModel): Promise<number> {
    return this.selectFromQuery
      .select(sql`AVG(${sql.raw(field as string)})`)
      .executeTakeFirst()
  }

  async sum(field: keyof DeploymentModel): Promise<number> {
    return this.selectFromQuery
      .select(sql`SUM(${sql.raw(field as string)})`)
      .executeTakeFirst()
  }

  async get(): Promise<DeploymentModel[]> {
    return DeploymentModel.get()
  }

  static async get(): Promise<DeploymentModel[]> {
    const instance = new DeploymentModel(null)

    let models

    if (instance.hasSelect) {
      models = await instance.selectFromQuery.execute()
    }
    else {
      models = await instance.selectFromQuery.selectAll().execute()
    }

    const data = await Promise.all(models.map(async (model: DeploymentModel) => {
      const instance = new DeploymentModel(model)

      const results = await instance.mapWith(model)

      return new DeploymentModel(results)
    }))

    return data
  }

  has(relation: string): DeploymentModel {
    return DeploymentModel.has(relation)
  }

  static has(relation: string): DeploymentModel {
    const instance = new DeploymentModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(
        selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.deployment_id`, '=', 'deployments.id'),
      ),
    )

    return instance
  }

  whereHas(
    relation: string,
    callback: (query: SubqueryBuilder) => void,
  ): DeploymentModel {
    return DeploymentModel.whereHas(relation, callback)
  }

  static whereHas(
    relation: string,
    callback: (query: SubqueryBuilder) => void,
  ): DeploymentModel {
    const instance = new DeploymentModel(null)
    const subqueryBuilder = new SubqueryBuilder()

    callback(subqueryBuilder)
    const conditions = subqueryBuilder.getConditions()

    instance.selectFromQuery = instance.selectFromQuery
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

  static doesntHave(relation: string): DeploymentModel {
    const instance = new DeploymentModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where(({ not, exists, selectFrom }: any) =>
      not(
        exists(
          selectFrom(relation)
            .select('1')
            .whereRef(`${relation}.deployment_id`, '=', 'deployments.id'),
        ),
      ),
    )

    return instance
  }

  async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<DeploymentResponse> {
    const totalRecordsResult = await db.selectFrom('deployments')
      .select(db.fn.count('id').as('total')) // Use 'id' or another actual column name
      .executeTakeFirst()

    const totalRecords = Number(totalRecordsResult?.total) || 0
    const totalPages = Math.ceil(totalRecords / (options.limit ?? 10))

    if (this.hasSelect) {
      const deploymentsWithExtra = await this.selectFromQuery.orderBy('id', 'asc')
        .limit((options.limit ?? 10) + 1)
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

    const deploymentsWithExtra = await this.selectFromQuery.orderBy('id', 'asc')
      .limit((options.limit ?? 10) + 1)
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

  // Method to get all deployments
  static async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<DeploymentResponse> {
    const totalRecordsResult = await db.selectFrom('deployments')
      .select(db.fn.count('id').as('total')) // Use 'id' or another actual column name
      .executeTakeFirst()

    const totalRecords = Number(totalRecordsResult?.total) || 0
    const totalPages = Math.ceil(totalRecords / (options.limit ?? 10))

    const deploymentsWithExtra = await db.selectFrom('deployments')
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

  // Method to create a new deployment
  static async create(newDeployment: NewDeployment): Promise<DeploymentModel> {
    const instance = new DeploymentModel(null)

    const filteredValues = Object.fromEntries(
      Object.entries(newDeployment).filter(([key]) => instance.fillable.includes(key)),
    ) as NewDeployment

    filteredValues.uuid = randomUUIDv7()

    const result = await db.insertInto('deployments')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await find(Number(result.numInsertedOrUpdatedRows)) as DeploymentModel

    return model
  }

  static async createMany(newDeployments: NewDeployment[]): Promise<void> {
    const instance = new DeploymentModel(null)

    const filteredValues = newDeployments.map(newUser =>
      Object.fromEntries(
        Object.entries(newUser).filter(([key]) => instance.fillable.includes(key)),
      ) as NewDeployment,
    )

    filteredValues.forEach((model) => {
      model.uuid = randomUUIDv7()
    })

    await db.insertInto('deployments')
      .values(filteredValues)
      .executeTakeFirst()
  }

  static async forceCreate(newDeployment: NewDeployment): Promise<DeploymentModel> {
    const result = await db.insertInto('deployments')
      .values(newDeployment)
      .executeTakeFirst()

    const model = await find(Number(result.numInsertedOrUpdatedRows)) as DeploymentModel

    return model
  }

  // Method to remove a Deployment
  static async remove(id: number): Promise<any> {
    return await db.deleteFrom('deployments')
      .where('id', '=', id)
      .execute()
  }

  private static applyWhere(instance: DeploymentModel, column: string, operator: string, value: any): DeploymentModel {
    instance.selectFromQuery = instance.selectFromQuery.where(column, operator, value)
    instance.updateFromQuery = instance.updateFromQuery.where(column, operator, value)
    instance.deleteFromQuery = instance.deleteFromQuery.where(column, operator, value)

    return instance
  }

  where(column: string, operator: string, value: any): DeploymentModel {
    return DeploymentModel.applyWhere(this, column, operator, value)
  }

  static where(column: string, operator: string, value: any): DeploymentModel {
    const instance = new DeploymentModel(null)

    return DeploymentModel.applyWhere(instance, column, operator, value)
  }

  whereRef(column: string, operator: string, value: string): DeploymentModel {
    return DeploymentModel.whereRef(column, operator, value)
  }

  static whereRef(column: string, operator: string, value: string): DeploymentModel {
    const instance = new DeploymentModel(null)

    instance.selectFromQuery = instance.selectFromQuery.whereRef(column, operator, value)

    return instance
  }

  orWhere(...args: Array<[string, string, any]>): DeploymentModel {
    return DeploymentModel.orWhere(...args)
  }

  static orWhere(...args: Array<[string, string, any]>): DeploymentModel {
    const instance = new DeploymentModel(null)

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
    callback: (query: DeploymentModel) => DeploymentModel,
  ): DeploymentModel {
    return DeploymentModel.when(condition, callback)
  }

  static when(
    condition: boolean,
    callback: (query: DeploymentModel) => DeploymentModel,
  ): DeploymentModel {
    let instance = new DeploymentModel(null)

    if (condition)
      instance = callback(instance)

    return instance
  }

  whereNull(column: string): DeploymentModel {
    return DeploymentModel.whereNull(column)
  }

  static whereNull(column: string): DeploymentModel {
    const instance = new DeploymentModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    instance.updateFromQuery = instance.updateFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    return instance
  }

  static whereCommitSha(value: string): DeploymentModel {
    const instance = new DeploymentModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('commitSha', '=', value)

    return instance
  }

  static whereCommitMessage(value: string): DeploymentModel {
    const instance = new DeploymentModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('commitMessage', '=', value)

    return instance
  }

  static whereBranch(value: string): DeploymentModel {
    const instance = new DeploymentModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('branch', '=', value)

    return instance
  }

  static whereStatus(value: string): DeploymentModel {
    const instance = new DeploymentModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('status', '=', value)

    return instance
  }

  static whereExecutionTime(value: string): DeploymentModel {
    const instance = new DeploymentModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('executionTime', '=', value)

    return instance
  }

  static whereDeployScript(value: string): DeploymentModel {
    const instance = new DeploymentModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('deployScript', '=', value)

    return instance
  }

  static whereTerminalOutput(value: string): DeploymentModel {
    const instance = new DeploymentModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('terminalOutput', '=', value)

    return instance
  }

  whereIn(column: keyof DeploymentType, values: any[]): DeploymentModel {
    return DeploymentModel.whereIn(column, values)
  }

  static whereIn(column: keyof DeploymentType, values: any[]): DeploymentModel {
    const instance = new DeploymentModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where(column, 'in', values)

    instance.updateFromQuery = instance.updateFromQuery.where(column, 'in', values)

    instance.deleteFromQuery = instance.deleteFromQuery.where(column, 'in', values)

    return instance
  }

  whereBetween(column: keyof DeploymentType, range: [any, any]): DeploymentModel {
    return DeploymentModel.whereBetween(column, range)
  }

  static whereBetween(column: keyof DeploymentType, range: [any, any]): DeploymentModel {
    if (range.length !== 2) {
      throw new HttpError(500, 'Range must have exactly two values: [min, max]')
    }

    const instance = new DeploymentModel(null)

    const query = sql` ${sql.raw(column as string)} between ${range[0]} and ${range[1]} `

    instance.selectFromQuery = instance.selectFromQuery.where(query)
    instance.updateFromQuery = instance.updateFromQuery.where(query)
    instance.deleteFromQuery = instance.deleteFromQuery.where(query)

    return instance
  }

  whereNotIn(column: keyof DeploymentType, values: any[]): DeploymentModel {
    return DeploymentModel.whereNotIn(column, values)
  }

  static whereNotIn(column: keyof DeploymentType, values: any[]): DeploymentModel {
    const instance = new DeploymentModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where(column, 'not in', values)

    instance.updateFromQuery = instance.updateFromQuery.where(column, 'not in', values)

    instance.deleteFromQuery = instance.deleteFromQuery.where(column, 'not in', values)

    return instance
  }

  async exists(): Promise<boolean> {
    const model = await this.selectFromQuery.executeTakeFirst()

    return model !== null || model !== undefined
  }

  static async latest(): Promise<DeploymentType | undefined> {
    const model = await db.selectFrom('deployments')
      .selectAll()
      .orderBy('created_at', 'desc')
      .executeTakeFirst()

    if (!model)
      return undefined

    const instance = new DeploymentModel(null)
    const result = await instance.mapWith(model)
    const data = new DeploymentModel(result as DeploymentType)

    return data
  }

  static async oldest(): Promise<DeploymentType | undefined> {
    const model = await db.selectFrom('deployments')
      .selectAll()
      .orderBy('created_at', 'asc')
      .executeTakeFirst()

    if (!model)
      return undefined

    const instance = new DeploymentModel(null)
    const result = await instance.mapWith(model)
    const data = new DeploymentModel(result as DeploymentType)

    return data
  }

  static async firstOrCreate(
    condition: Partial<DeploymentType>,
    newDeployment: NewDeployment,
  ): Promise<DeploymentModel> {
    // Get the key and value from the condition object
    const key = Object.keys(condition)[0] as keyof DeploymentType

    if (!key) {
      throw new HttpError(500, 'Condition must contain at least one key-value pair')
    }

    const value = condition[key]

    // Attempt to find the first record matching the condition
    const existingDeployment = await db.selectFrom('deployments')
      .selectAll()
      .where(key, '=', value)
      .executeTakeFirst()

    if (existingDeployment) {
      const instance = new DeploymentModel(null)
      const result = await instance.mapWith(existingDeployment)
      return new DeploymentModel(result as DeploymentType)
    }
    else {
      // If not found, create a new user
      return await this.create(newDeployment)
    }
  }

  static async updateOrCreate(
    condition: Partial<DeploymentType>,
    newDeployment: NewDeployment,
  ): Promise<DeploymentModel> {
    const key = Object.keys(condition)[0] as keyof DeploymentType

    if (!key) {
      throw new HttpError(500, 'Condition must contain at least one key-value pair')
    }

    const value = condition[key]

    // Attempt to find the first record matching the condition
    const existingDeployment = await db.selectFrom('deployments')
      .selectAll()
      .where(key, '=', value)
      .executeTakeFirst()

    if (existingDeployment) {
      // If found, update the existing record
      await db.updateTable('deployments')
        .set(newDeployment)
        .where(key, '=', value)
        .executeTakeFirstOrThrow()

      // Fetch and return the updated record
      const updatedDeployment = await db.selectFrom('deployments')
        .selectAll()
        .where(key, '=', value)
        .executeTakeFirst()

      if (!updatedDeployment) {
        throw new HttpError(500, 'Failed to fetch updated record')
      }

      const instance = new DeploymentModel(null)
      const result = await instance.mapWith(updatedDeployment)
      return new DeploymentModel(result as DeploymentType)
    }
    else {
      // If not found, create a new record
      return await this.create(newDeployment)
    }
  }

  with(relations: string[]): DeploymentModel {
    this.withRelations = relations

    return this
  }

  static with(relations: string[]): DeploymentModel {
    const instance = new DeploymentModel(null)

    instance.withRelations = relations

    return instance
  }

  async last(): Promise<DeploymentType | undefined> {
    return await db.selectFrom('deployments')
      .selectAll()
      .orderBy('id', 'desc')
      .executeTakeFirst()
  }

  static async last(): Promise<DeploymentType | undefined> {
    const model = await db.selectFrom('deployments').selectAll().orderBy('id', 'desc').executeTakeFirst()

    if (!model)
      return undefined

    const instance = new DeploymentModel(null)

    const result = await instance.mapWith(model)

    const data = new DeploymentModel(result as DeploymentType)

    return data
  }

  static orderBy(column: keyof DeploymentType, order: 'asc' | 'desc'): DeploymentModel {
    const instance = new DeploymentModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, order)

    return instance
  }

  static groupBy(column: keyof DeploymentType): DeploymentModel {
    const instance = new DeploymentModel(null)

    instance.selectFromQuery = instance.selectFromQuery.groupBy(column)

    return instance
  }

  static having(column: keyof DeploymentType, operator: string, value: any): DeploymentModel {
    const instance = new DeploymentModel(null)

    instance.selectFromQuery = instance.selectFromQuery.having(column, operator, value)

    return instance
  }

  orderBy(column: keyof DeploymentType, order: 'asc' | 'desc'): DeploymentModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, order)

    return this
  }

  static inRandomOrder(): DeploymentModel {
    const instance = new DeploymentModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(sql` ${sql.raw('RANDOM()')} `)

    return instance
  }

  inRandomOrder(): DeploymentModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(sql` ${sql.raw('RANDOM()')} `)

    return this
  }

  having(column: keyof DeploymentType, operator: string, value: any): DeploymentModel {
    this.selectFromQuery = this.selectFromQuery.having(column, operator, value)

    return this
  }

  groupBy(column: keyof DeploymentType): DeploymentModel {
    this.selectFromQuery = this.selectFromQuery.groupBy(column)

    return this
  }

  static orderByDesc(column: keyof DeploymentType): DeploymentModel {
    const instance = new DeploymentModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, 'desc')

    return instance
  }

  orderByDesc(column: keyof DeploymentType): DeploymentModel {
    this.selectFromQuery = this.orderBy(column, 'desc')

    return this
  }

  static orderByAsc(column: keyof DeploymentType): DeploymentModel {
    const instance = new DeploymentModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, 'asc')

    return instance
  }

  orderByAsc(column: keyof DeploymentType): DeploymentModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, 'desc')

    return this
  }

  async update(deployment: DeploymentUpdate): Promise<DeploymentModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(deployment).filter(([key]) => this.fillable.includes(key)),
    ) as NewDeployment

    await db.updateTable('deployments')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      const model = await this.find(this.id)

      return model
    }

    return undefined
  }

  async forceUpdate(deployment: DeploymentUpdate): Promise<DeploymentModel | undefined> {
    if (this.id === undefined) {
      this.updateFromQuery.set(deployment).execute()
    }

    await db.updateTable('deployments')
      .set(deployment)
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
      throw new HttpError(500, 'Deployment data is undefined')

    if (this.id === undefined) {
      await db.insertInto('deployments')
        .values(this as NewDeployment)
        .executeTakeFirstOrThrow()
    }
    else {
      await this.update(this)
    }
  }

  // Method to delete (soft delete) the deployment instance
  async delete(): Promise<any> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()

    return await db.deleteFrom('deployments')
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

  distinct(column: keyof DeploymentType): DeploymentModel {
    this.selectFromQuery = this.selectFromQuery.select(column).distinct()

    this.hasSelect = true

    return this
  }

  static distinct(column: keyof DeploymentType): DeploymentModel {
    const instance = new DeploymentModel(null)

    instance.selectFromQuery = instance.selectFromQuery.select(column).distinct()

    instance.hasSelect = true

    return instance
  }

  join(table: string, firstCol: string, secondCol: string): DeploymentModel {
    this.selectFromQuery = this.selectFromQuery.innerJoin(table, firstCol, secondCol)

    return this
  }

  static join(table: string, firstCol: string, secondCol: string): DeploymentModel {
    const instance = new DeploymentModel(null)

    instance.selectFromQuery = instance.selectFromQuery.innerJoin(table, firstCol, secondCol)

    return instance
  }

  static async rawQuery(rawQuery: string): Promise<any> {
    return await sql`${rawQuery}`.execute(db)
  }

  toJSON(): Partial<DeploymentJsonResponse> {
    const output: Partial<DeploymentJsonResponse> = {

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
  const query = db.selectFrom('deployments').where('id', '=', id).selectAll()

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
  const result = await db.insertInto('deployments')
    .values(newDeployment)
    .executeTakeFirstOrThrow()

  return await find(Number(result.numInsertedOrUpdatedRows)) as DeploymentModel
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(db)
}

export async function remove(id: number): Promise<void> {
  await db.deleteFrom('deployments')
    .where('id', '=', id)
    .execute()
}

export async function whereCommitSha(value: string): Promise<DeploymentModel[]> {
  const query = db.selectFrom('deployments').where('commit_sha', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new DeploymentModel(modelItem))
}

export async function whereCommitMessage(value: string): Promise<DeploymentModel[]> {
  const query = db.selectFrom('deployments').where('commit_message', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new DeploymentModel(modelItem))
}

export async function whereBranch(value: string): Promise<DeploymentModel[]> {
  const query = db.selectFrom('deployments').where('branch', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new DeploymentModel(modelItem))
}

export async function whereStatus(value: string): Promise<DeploymentModel[]> {
  const query = db.selectFrom('deployments').where('status', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new DeploymentModel(modelItem))
}

export async function whereExecutionTime(value: number): Promise<DeploymentModel[]> {
  const query = db.selectFrom('deployments').where('execution_time', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new DeploymentModel(modelItem))
}

export async function whereDeployScript(value: string): Promise<DeploymentModel[]> {
  const query = db.selectFrom('deployments').where('deploy_script', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new DeploymentModel(modelItem))
}

export async function whereTerminalOutput(value: string): Promise<DeploymentModel[]> {
  const query = db.selectFrom('deployments').where('terminal_output', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new DeploymentModel(modelItem))
}

export const Deployment = DeploymentModel

export default Deployment
