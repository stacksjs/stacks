import type { Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { UserModel } from './User'
import { randomUUIDv7 } from 'bun'
import { cache } from '@stacksjs/cache'
import { sql } from '@stacksjs/database'
import { HttpError, ModelNotFoundException } from '@stacksjs/error-handling'
import { dispatch } from '@stacksjs/events'
import { DB, SubqueryBuilder } from '@stacksjs/orm'

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
  private readonly guarded: Array<keyof DeploymentJsonResponse> = []
  protected attributes: Partial<DeploymentJsonResponse> = {}
  protected originalAttributes: Partial<DeploymentJsonResponse> = {}

  protected selectFromQuery: any
  protected withRelations: string[]
  protected updateFromQuery: any
  protected deleteFromQuery: any
  protected hasSelect: boolean
  private hasSaved: boolean
  private customColumns: Record<string, unknown> = {}

  constructor(deployment: Partial<DeploymentType> | null) {
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

  mapCustomGetters(model: DeploymentJsonResponse): void {
    const customGetter = {

    }
  }

  get user_id(): number | undefined {
    return this.attributes.user_id
  }

  get user(): UserModel | undefined {
    return this.attributes.user
  }

  get id(): number | undefined {
    return this.attributes.id
  }

  get uuid(): string | undefined {
    return this.attributes.uuid
  }

  get commit_sha(): string | undefined {
    return this.attributes.commit_sha
  }

  get commit_message(): string | undefined {
    return this.attributes.commit_message
  }

  get branch(): string | undefined {
    return this.attributes.branch
  }

  get status(): string | undefined {
    return this.attributes.status
  }

  get execution_time(): number | undefined {
    return this.attributes.execution_time
  }

  get deploy_script(): string | undefined {
    return this.attributes.deploy_script
  }

  get terminal_output(): string | undefined {
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

  getOriginal(column?: keyof DeploymentType): Partial<DeploymentType> {
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

  isDirty(column?: keyof DeploymentType): boolean {
    if (column) {
      return this.attributes[column] !== this.originalAttributes[column]
    }

    return Object.entries(this.originalAttributes).some(([key, originalValue]) => {
      const currentValue = (this.attributes as any)[key]

      return currentValue !== originalValue
    })
  }

  isClean(column?: keyof DeploymentType): boolean {
    return !this.isDirty(column)
  }

  wasChanged(column?: keyof DeploymentType): boolean {
    return this.hasSaved && this.isDirty(column)
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

  async applyFind(id: number): Promise<DeploymentModel | undefined> {
    const model = await DB.instance.selectFrom('deployments').where('id', '=', id).selectAll().executeTakeFirst()

    if (!model)
      return undefined

    await this.loadRelations(model)

    const data = new DeploymentModel(model as DeploymentType)

    cache.getOrSet(`deployment:${id}`, JSON.stringify(model))

    return data
  }

  async find(id: number): Promise<DeploymentModel | undefined> {
    return await this.applyFind(id)
  }

  // Method to find a Deployment by ID
  static async find(id: number): Promise<DeploymentModel | undefined> {
    const instance = new DeploymentModel(null)

    return await instance.applyFind(id)
  }

  async first(): Promise<DeploymentModel | undefined> {
    let model: DeploymentModel | undefined

    if (this.hasSelect) {
      model = await this.selectFromQuery.executeTakeFirst()
    }
    else {
      model = await this.selectFromQuery.selectAll().executeTakeFirst()
    }

    if (model)
      await this.loadRelations(model)

    const data = new DeploymentModel(model as DeploymentType)

    return data
  }

  static async first(): Promise<DeploymentModel | undefined> {
    const model = await DB.instance.selectFrom('deployments')
      .selectAll()
      .executeTakeFirst()

    const data = new DeploymentModel(model as DeploymentType)

    return data
  }

  async applyFirstOrFail(): Promise<DeploymentModel | undefined> {
    const model = await this.selectFromQuery.executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, 'No DeploymentModel results found for query')

    if (model)
      await this.loadRelations(model)

    const data = new DeploymentModel(model as DeploymentType)

    return data
  }

  async firstOrFail(): Promise<DeploymentModel | undefined> {
    return await this.applyFirstOrFail()
  }

  static async firstOrFail(): Promise<DeploymentModel | undefined> {
    const instance = new DeploymentModel(null)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<DeploymentModel[]> {
    const models = await DB.instance.selectFrom('deployments').selectAll().execute()

    const data = await Promise.all(models.map(async (model: DeploymentType) => {
      return new DeploymentModel(model)
    }))

    return data
  }

  async applyFindOrFail(id: number): Promise<DeploymentModel> {
    const model = await DB.instance.selectFrom('deployments').where('id', '=', id).selectAll().executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, `No DeploymentModel results for ${id}`)

    cache.getOrSet(`deployment:${id}`, JSON.stringify(model))

    await this.loadRelations(model)

    const data = new DeploymentModel(model as DeploymentType)

    return data
  }

  async findOrFail(id: number): Promise<DeploymentModel> {
    return await this.applyFindOrFail(id)
  }

  static async findOrFail(id: number): Promise<DeploymentModel> {
    const instance = new DeploymentModel(null)

    return await instance.applyFindOrFail(id)
  }

  static async findMany(ids: number[]): Promise<DeploymentModel[]> {
    let query = DB.instance.selectFrom('deployments').where('id', 'in', ids)

    const instance = new DeploymentModel(null)

    query = query.selectAll()

    const models = await query.execute()

    await instance.loadRelations(models)

    return models.map((modelItem: DeploymentModel) => instance.parseResult(new DeploymentModel(modelItem)))
  }

  skip(count: number): DeploymentModel {
    this.selectFromQuery = this.selectFromQuery.offset(count)

    return this
  }

  static skip(count: number): DeploymentModel {
    const instance = new DeploymentModel(null)

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
    const instance = new DeploymentModel(null)

    await instance.applyChunk(size, callback)
  }

  take(count: number): DeploymentModel {
    this.selectFromQuery = this.selectFromQuery.limit(count)

    return this
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

  static async max(field: keyof DeploymentModel): Promise<number> {
    const instance = new DeploymentModel(null)

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
    const instance = new DeploymentModel(null)

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
    const instance = new DeploymentModel(null)

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
    const instance = new DeploymentModel(null)

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

    await this.loadRelations(models)

    const data = await Promise.all(models.map(async (model: DeploymentModel) => {
      return new DeploymentModel(model)
    }))

    return data
  }

  async get(): Promise<DeploymentModel[]> {
    return await this.applyGet()
  }

  static async get(): Promise<DeploymentModel[]> {
    const instance = new DeploymentModel(null)

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

  static whereExists(callback: (qb: any) => any): DeploymentModel {
    const instance = new DeploymentModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(callback({ exists, selectFrom })),
    )

    return instance
  }

  applyWhereHas(
    relation: string,
    callback: (query: SubqueryBuilder) => void,
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

    return this
  }

  whereHas(
    relation: string,
    callback: (query: SubqueryBuilder) => void,
  ): DeploymentModel {
    return this.applyWhereHas(relation, callback)
  }

  static whereHas(
    relation: string,
    callback: (query: SubqueryBuilder) => void,
  ): DeploymentModel {
    const instance = new DeploymentModel(null)

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
    const instance = new DeploymentModel(null)

    return instance.doesntHave(relation)
  }

  applyWhereDoesntHave(relation: string, callback: (query: SubqueryBuilder) => void): DeploymentModel {
    const subqueryBuilder = new SubqueryBuilder()

    callback(subqueryBuilder)
    const conditions = subqueryBuilder.getConditions()

    this.selectFromQuery = this.selectFromQuery
      .where(({ exists, selectFrom, not }: any) => {
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

        return not(exists(subquery))
      })

    return this
  }

  whereDoesntHave(relation: string, callback: (query: SubqueryBuilder) => void): DeploymentModel {
    return this.applyWhereDoesntHave(relation, callback)
  }

  static whereDoesntHave(
    relation: string,
    callback: (query: SubqueryBuilder) => void,
  ): DeploymentModel {
    const instance = new DeploymentModel(null)

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
    const instance = new DeploymentModel(null)

    return await instance.applyPaginate(options)
  }

  static async create(newDeployment: NewDeployment): Promise<DeploymentModel> {
    const instance = new DeploymentModel(null)

    const filteredValues = Object.fromEntries(
      Object.entries(newDeployment).filter(([key]) =>
        !instance.guarded.includes(key) && instance.fillable.includes(key),
      ),
    ) as NewDeployment

    filteredValues.uuid = randomUUIDv7()

    const result = await DB.instance.insertInto('deployments')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await instance.find(Number(result.numInsertedOrUpdatedRows)) as DeploymentModel

    if (model)
      dispatch('deployment:created', model)

    return model
  }

  static async createMany(newDeployment: NewDeployment[]): Promise<void> {
    const instance = new DeploymentModel(null)

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
  static async remove(id: number): Promise<any> {
    return await DB.instance.deleteFrom('deployments')
      .where('id', '=', id)
      .execute()
  }

  applyWhere(instance: DeploymentModel, column: string, ...args: any[]): DeploymentModel {
    const [operatorOrValue, value] = args
    const operator = value === undefined ? '=' : operatorOrValue
    const actualValue = value === undefined ? operatorOrValue : value

    instance.selectFromQuery = instance.selectFromQuery.where(column, operator, actualValue)
    instance.updateFromQuery = instance.updateFromQuery.where(column, operator, actualValue)
    instance.deleteFromQuery = instance.deleteFromQuery.where(column, operator, actualValue)

    return instance
  }

  where(column: string, ...args: any[]): DeploymentModel {
    return this.applyWhere(this, column, ...args)
  }

  static where(column: string, ...args: any[]): DeploymentModel {
    const instance = new DeploymentModel(null)

    return instance.applyWhere(instance, column, ...args)
  }

  whereColumn(first: string, operator: string, second: string): DeploymentModel {
    this.selectFromQuery = this.selectFromQuery.whereRef(first, operator, second)

    return this
  }

  static whereColumn(first: string, operator: string, second: string): DeploymentModel {
    const instance = new DeploymentModel(null)

    instance.selectFromQuery = instance.selectFromQuery.whereRef(first, operator, second)

    return instance
  }

  applyWhereRef(column: string, ...args: string[]): DeploymentModel {
    const [operatorOrValue, value] = args
    const operator = value === undefined ? '=' : operatorOrValue
    const actualValue = value === undefined ? operatorOrValue : value

    const instance = new DeploymentModel(null)
    instance.selectFromQuery = instance.selectFromQuery.whereRef(column, operator, actualValue)

    return instance
  }

  whereRef(column: string, ...args: string[]): DeploymentModel {
    return this.applyWhereRef(column, ...args)
  }

  static whereRef(column: string, ...args: string[]): DeploymentModel {
    const instance = new DeploymentModel(null)

    return instance.applyWhereRef(column, ...args)
  }

  whereRaw(sqlStatement: string): DeploymentModel {
    this.selectFromQuery = this.selectFromQuery.where(sql`${sqlStatement}`)

    return this
  }

  static whereRaw(sqlStatement: string): DeploymentModel {
    const instance = new DeploymentModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where(sql`${sqlStatement}`)

    return instance
  }

  applyOrWhere(...conditions: [string, any][]): DeploymentModel {
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

  orWhere(...conditions: [string, any][]): DeploymentModel {
    return this.applyOrWhere(...conditions)
  }

  static orWhere(...conditions: [string, any][]): DeploymentModel {
    const instance = new DeploymentModel(null)

    return instance.applyOrWhere(...conditions)
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

  applyWhereBetween(column: keyof DeploymentType, range: [any, any]): DeploymentModel {
    if (range.length !== 2) {
      throw new HttpError(500, 'Range must have exactly two values: [min, max]')
    }

    const query = sql` ${sql.raw(column as string)} between ${range[0]} and ${range[1]} `

    this.selectFromQuery = this.selectFromQuery.where(query)
    this.updateFromQuery = this.updateFromQuery.where(query)
    this.deleteFromQuery = this.deleteFromQuery.where(query)

    return this
  }

  whereBetween(column: keyof DeploymentType, range: [any, any]): DeploymentModel {
    return this.applyWhereBetween(column, range)
  }

  static whereBetween(column: keyof DeploymentType, range: [any, any]): DeploymentModel {
    const instance = new DeploymentModel(null)

    return instance.applyWhereBetween(column, range)
  }

  applyWhereLike(column: keyof DeploymentType, value: string): DeploymentModel {
    this.selectFromQuery = this.selectFromQuery.where(sql` ${sql.raw(column as string)} LIKE ${value}`)

    this.updateFromQuery = this.updateFromQuery.where(sql` ${sql.raw(column as string)} LIKE ${value}`)

    this.deleteFromQuery = this.deleteFromQuery.where(sql` ${sql.raw(column as string)} LIKE ${value}`)

    return this
  }

  whereLike(column: keyof DeploymentType, value: string): DeploymentModel {
    return this.applyWhereLike(column, value)
  }

  static whereLike(column: keyof DeploymentType, value: string): DeploymentModel {
    const instance = new DeploymentModel(null)

    return instance.applyWhereLike(column, value)
  }

  applyWhereNotIn(column: keyof DeploymentType, values: any[]): DeploymentModel {
    this.selectFromQuery = this.selectFromQuery.where(column, 'not in', values)

    this.updateFromQuery = this.updateFromQuery.where(column, 'not in', values)

    this.deleteFromQuery = this.deleteFromQuery.where(column, 'not in', values)

    return this
  }

  whereNotIn(column: keyof DeploymentType, values: any[]): DeploymentModel {
    return this.applyWhereNotIn(column, values)
  }

  static whereNotIn(column: keyof DeploymentType, values: any[]): DeploymentModel {
    const instance = new DeploymentModel(null)

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

  static async latest(): Promise<DeploymentType | undefined> {
    const model = await DB.instance.selectFrom('deployments')
      .selectAll()
      .orderBy('id', 'desc')
      .executeTakeFirst()

    if (!model)
      return undefined

    const data = new DeploymentModel(model as DeploymentType)

    return data
  }

  static async oldest(): Promise<DeploymentType | undefined> {
    const model = await DB.instance.selectFrom('deployments')
      .selectAll()
      .orderBy('id', 'asc')
      .executeTakeFirst()

    if (!model)
      return undefined

    const data = new DeploymentModel(model as DeploymentType)

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
    const existingDeployment = await DB.instance.selectFrom('deployments')
      .selectAll()
      .where(key, '=', value)
      .executeTakeFirst()

    if (existingDeployment) {
      return new DeploymentModel(existingDeployment as DeploymentType)
    }
    else {
      return await this.create(newDeployment)
    }
  }

  static async updateOrCreate(
    condition: Partial<DeploymentType>,
    newDeployment: NewDeployment,
  ): Promise<DeploymentModel> {
    const instance = new DeploymentModel(null)

    const key = Object.keys(condition)[0] as keyof DeploymentType

    if (!key) {
      throw new HttpError(500, 'Condition must contain at least one key-value pair')
    }

    const value = condition[key]

    // Attempt to find the first record matching the condition
    const existingDeployment = await DB.instance.selectFrom('deployments')
      .selectAll()
      .where(key, '=', value)
      .executeTakeFirst()

    if (existingDeployment) {
      // If found, update the existing record
      await DB.instance.updateTable('deployments')
        .set(newDeployment)
        .where(key, '=', value)
        .executeTakeFirstOrThrow()

      // Fetch and return the updated record
      const updatedDeployment = await DB.instance.selectFrom('deployments')
        .selectAll()
        .where(key, '=', value)
        .executeTakeFirst()

      if (!updatedDeployment) {
        throw new HttpError(500, 'Failed to fetch updated record')
      }

      instance.hasSaved = true

      return new DeploymentModel(updatedDeployment as DeploymentType)
    }
    else {
      // If not found, create a new record
      return await this.create(newDeployment)
    }
  }

  async loadRelations(models: DeploymentJsonResponse | DeploymentJsonResponse[]): Promise<void> {
    // Handle both single model and array of models
    const modelArray = Array.isArray(models) ? models : [models]
    if (!modelArray.length)
      return

    const modelIds = modelArray.map(model => model.id)

    for (const relation of this.withRelations) {
      const relatedRecords = await DB.instance
        .selectFrom(relation)
        .where('deployment_id', 'in', modelIds)
        .selectAll()
        .execute()

      if (Array.isArray(models)) {
        models.map((model: DeploymentJsonResponse) => {
          const records = relatedRecords.filter((record: { deployment_id: number }) => {
            return record.deployment_id === model.id
          })

          model[relation] = records.length === 1 ? records[0] : records
          return model
        })
      }
      else {
        const records = relatedRecords.filter((record: { deployment_id: number }) => {
          return record.deployment_id === models.id
        })

        models[relation] = records.length === 1 ? records[0] : records
      }
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
    let model: DeploymentModel | undefined

    if (this.hasSelect) {
      model = await this.selectFromQuery.executeTakeFirst()
    }
    else {
      model = await this.selectFromQuery.selectAll().orderBy('id', 'desc').executeTakeFirst()
    }

    if (model)
      await this.loadRelations(model)

    const data = new DeploymentModel(model as DeploymentType)

    return data
  }

  static async last(): Promise<DeploymentType | undefined> {
    const model = await DB.instance.selectFrom('deployments').selectAll().orderBy('id', 'desc').executeTakeFirst()

    if (!model)
      return undefined

    const data = new DeploymentModel(model as DeploymentType)

    return data
  }

  orderBy(column: keyof DeploymentType, order: 'asc' | 'desc'): DeploymentModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, order)

    return this
  }

  static orderBy(column: keyof DeploymentType, order: 'asc' | 'desc'): DeploymentModel {
    const instance = new DeploymentModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, order)

    return instance
  }

  groupBy(column: keyof DeploymentType): DeploymentModel {
    this.selectFromQuery = this.selectFromQuery.groupBy(column)

    return this
  }

  static groupBy(column: keyof DeploymentType): DeploymentModel {
    const instance = new DeploymentModel(null)

    instance.selectFromQuery = instance.selectFromQuery.groupBy(column)

    return instance
  }

  having(column: keyof DeploymentType, operator: string, value: any): DeploymentModel {
    this.selectFromQuery = this.selectFromQuery.having(column, operator, value)

    return this
  }

  static having(column: keyof DeploymentType, operator: string, value: any): DeploymentModel {
    const instance = new DeploymentModel(null)

    instance.selectFromQuery = instance.selectFromQuery.having(column, operator, value)

    return instance
  }

  inRandomOrder(): DeploymentModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(sql` ${sql.raw('RANDOM()')} `)

    return this
  }

  static inRandomOrder(): DeploymentModel {
    const instance = new DeploymentModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(sql` ${sql.raw('RANDOM()')} `)

    return instance
  }

  orderByDesc(column: keyof DeploymentType): DeploymentModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, 'desc')

    return this
  }

  static orderByDesc(column: keyof DeploymentType): DeploymentModel {
    const instance = new DeploymentModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, 'desc')

    return instance
  }

  orderByAsc(column: keyof DeploymentType): DeploymentModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, 'asc')

    return this
  }

  static orderByAsc(column: keyof DeploymentType): DeploymentModel {
    const instance = new DeploymentModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, 'asc')

    return instance
  }

  async update(newDeployment: DeploymentUpdate): Promise<DeploymentModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newDeployment).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewDeployment

    await DB.instance.updateTable('deployments')
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

  async forceUpdate(deployment: DeploymentUpdate): Promise<DeploymentModel | undefined> {
    if (this.id === undefined) {
      this.updateFromQuery.set(deployment).execute()
    }

    await DB.instance.updateTable('deployments')
      .set(deployment)
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
      throw new HttpError(500, 'Deployment data is undefined')

    const filteredValues = Object.fromEntries(
      Object.entries(this.attributes).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewDeployment

    if (this.id === undefined) {
      await DB.instance.insertInto('deployments')
        .values(filteredValues)
        .executeTakeFirstOrThrow()
    }
    else {
      await this.update(this.attributes)
    }

    this.hasSaved = true
  }

  fill(data: Partial<DeploymentType>): DeploymentModel {
    const filteredValues = Object.fromEntries(
      Object.entries(data).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewDeployment

    this.attributes = {
      ...this.attributes,
      ...filteredValues,
    }

    return this
  }

  forceFill(data: Partial<DeploymentType>): DeploymentModel {
    this.attributes = {
      ...this.attributes,
      ...data,
    }

    return this
  }

  // Method to delete (soft delete) the deployment instance
  async delete(): Promise<any> {
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
  const results = await query.execute()

  return results.map((modelItem: DeploymentModel) => new DeploymentModel(modelItem))
}

export async function whereCommitMessage(value: string): Promise<DeploymentModel[]> {
  const query = DB.instance.selectFrom('deployments').where('commit_message', '=', value)
  const results = await query.execute()

  return results.map((modelItem: DeploymentModel) => new DeploymentModel(modelItem))
}

export async function whereBranch(value: string): Promise<DeploymentModel[]> {
  const query = DB.instance.selectFrom('deployments').where('branch', '=', value)
  const results = await query.execute()

  return results.map((modelItem: DeploymentModel) => new DeploymentModel(modelItem))
}

export async function whereStatus(value: string): Promise<DeploymentModel[]> {
  const query = DB.instance.selectFrom('deployments').where('status', '=', value)
  const results = await query.execute()

  return results.map((modelItem: DeploymentModel) => new DeploymentModel(modelItem))
}

export async function whereExecutionTime(value: number): Promise<DeploymentModel[]> {
  const query = DB.instance.selectFrom('deployments').where('execution_time', '=', value)
  const results = await query.execute()

  return results.map((modelItem: DeploymentModel) => new DeploymentModel(modelItem))
}

export async function whereDeployScript(value: string): Promise<DeploymentModel[]> {
  const query = DB.instance.selectFrom('deployments').where('deploy_script', '=', value)
  const results = await query.execute()

  return results.map((modelItem: DeploymentModel) => new DeploymentModel(modelItem))
}

export async function whereTerminalOutput(value: string): Promise<DeploymentModel[]> {
  const query = DB.instance.selectFrom('deployments').where('terminal_output', '=', value)
  const results = await query.execute()

  return results.map((modelItem: DeploymentModel) => new DeploymentModel(modelItem))
}

export const Deployment = DeploymentModel

export default Deployment
