import type { RawBuilder } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import type { DeploymentJsonResponse, DeploymentsTable, DeploymentUpdate, NewDeployment } from '../types/DeploymentType'
import type { UserModel } from './User'
import { randomUUIDv7 } from 'bun'
import { sql } from '@stacksjs/database'
import { HttpError } from '@stacksjs/error-handling'
import { DB } from '@stacksjs/orm'

import { BaseOrm } from '../utils/base'

export class DeploymentModel extends BaseOrm<DeploymentModel, DeploymentsTable, DeploymentJsonResponse> {
  private readonly hidden: Array<keyof DeploymentJsonResponse> = []
  private readonly fillable: Array<keyof DeploymentJsonResponse> = ['commit_sha', 'commit_message', 'branch', 'status', 'execution_time', 'deploy_script', 'terminal_output', 'uuid']
  private readonly guarded: Array<keyof DeploymentJsonResponse> = []
  protected attributes = {} as DeploymentJsonResponse
  protected originalAttributes = {} as DeploymentJsonResponse

  protected selectFromQuery: any
  protected updateFromQuery: any
  protected deleteFromQuery: any
  protected hasSelect: boolean
  private customColumns: Record<string, unknown> = {}

  /**
   * This model inherits many query methods from BaseOrm:
   * - pluck, chunk, whereExists, has, doesntHave, whereHas, whereDoesntHave
   * - inRandomOrder, max, min, avg, paginate, get, and more
   *
   * See BaseOrm class for the full list of inherited methods.
   */

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
  }

  protected async loadRelations(models: DeploymentJsonResponse | DeploymentJsonResponse[]): Promise<void> {
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

  static with(relations: string[]): DeploymentModel {
    const instance = new DeploymentModel(undefined)

    return instance.applyWith(relations)
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

  async mapCustomSetters(model: NewDeployment | DeploymentUpdate): Promise<void> {
    const customSetter = {
      default: () => {
      },

    }

    for (const [key, fn] of Object.entries(customSetter)) {
      (model as any)[key] = await fn()
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

  get created_at(): string | undefined {
    return this.attributes.created_at
  }

  get updated_at(): string | undefined {
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

  set updated_at(value: string) {
    this.attributes.updated_at = value
  }

  static select(params: (keyof DeploymentJsonResponse)[] | RawBuilder<string> | string): DeploymentModel {
    const instance = new DeploymentModel(undefined)

    return instance.applySelect(params)
  }

  // Method to find a Deployment by ID
  static async find(id: number): Promise<DeploymentModel | undefined> {
    const query = DB.instance.selectFrom('deployments').where('id', '=', id).selectAll()

    const model = await query.executeTakeFirst()

    if (!model)
      return undefined

    const instance = new DeploymentModel(undefined)
    return instance.createInstance(model)
  }

  static async first(): Promise<DeploymentModel | undefined> {
    const instance = new DeploymentModel(undefined)

    const model = await instance.applyFirst()

    const data = new DeploymentModel(model)

    return data
  }

  static async last(): Promise<DeploymentModel | undefined> {
    const instance = new DeploymentModel(undefined)

    const model = await instance.applyLast()

    if (!model)
      return undefined

    return new DeploymentModel(model)
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

  static async findOrFail(id: number): Promise<DeploymentModel | undefined> {
    const instance = new DeploymentModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  static async findMany(ids: number[]): Promise<DeploymentModel[]> {
    const instance = new DeploymentModel(undefined)

    const models = await instance.applyFindMany(ids)

    return models.map((modelItem: DeploymentJsonResponse) => instance.parseResult(new DeploymentModel(modelItem)))
  }

  static async latest(column: keyof DeploymentsTable = 'created_at'): Promise<DeploymentModel | undefined> {
    const instance = new DeploymentModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'desc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new DeploymentModel(model)
  }

  static async oldest(column: keyof DeploymentsTable = 'created_at'): Promise<DeploymentModel | undefined> {
    const instance = new DeploymentModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'asc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new DeploymentModel(model)
  }

  static skip(count: number): DeploymentModel {
    const instance = new DeploymentModel(undefined)

    return instance.applySkip(count)
  }

  static take(count: number): DeploymentModel {
    const instance = new DeploymentModel(undefined)

    return instance.applyTake(count)
  }

  static where<V = string>(column: keyof DeploymentsTable, ...args: [V] | [Operator, V]): DeploymentModel {
    const instance = new DeploymentModel(undefined)

    return instance.applyWhere<V>(column, ...args)
  }

  static orWhere(...conditions: [string, any][]): DeploymentModel {
    const instance = new DeploymentModel(undefined)

    return instance.applyOrWhere(...conditions)
  }

  static whereNotIn<V = number>(column: keyof DeploymentsTable, values: V[]): DeploymentModel {
    const instance = new DeploymentModel(undefined)

    return instance.applyWhereNotIn<V>(column, values)
  }

  static whereBetween<V = number>(column: keyof DeploymentsTable, range: [V, V]): DeploymentModel {
    const instance = new DeploymentModel(undefined)

    return instance.applyWhereBetween<V>(column, range)
  }

  static whereRef(column: keyof DeploymentsTable, ...args: string[]): DeploymentModel {
    const instance = new DeploymentModel(undefined)

    return instance.applyWhereRef(column, ...args)
  }

  static when(condition: boolean, callback: (query: DeploymentModel) => DeploymentModel): DeploymentModel {
    const instance = new DeploymentModel(undefined)

    return instance.applyWhen(condition, callback as any)
  }

  static whereNull(column: keyof DeploymentsTable): DeploymentModel {
    const instance = new DeploymentModel(undefined)

    return instance.applyWhereNull(column)
  }

  static whereNotNull(column: keyof DeploymentsTable): DeploymentModel {
    const instance = new DeploymentModel(undefined)

    return instance.applyWhereNotNull(column)
  }

  static whereLike(column: keyof DeploymentsTable, value: string): DeploymentModel {
    const instance = new DeploymentModel(undefined)

    return instance.applyWhereLike(column, value)
  }

  static orderBy(column: keyof DeploymentsTable, order: 'asc' | 'desc'): DeploymentModel {
    const instance = new DeploymentModel(undefined)

    return instance.applyOrderBy(column, order)
  }

  static orderByAsc(column: keyof DeploymentsTable): DeploymentModel {
    const instance = new DeploymentModel(undefined)

    return instance.applyOrderByAsc(column)
  }

  static orderByDesc(column: keyof DeploymentsTable): DeploymentModel {
    const instance = new DeploymentModel(undefined)

    return instance.applyOrderByDesc(column)
  }

  static groupBy(column: keyof DeploymentsTable): DeploymentModel {
    const instance = new DeploymentModel(undefined)

    return instance.applyGroupBy(column)
  }

  static having<V = string>(column: keyof DeploymentsTable, operator: Operator, value: V): DeploymentModel {
    const instance = new DeploymentModel(undefined)

    return instance.applyHaving<V>(column, operator, value)
  }

  static inRandomOrder(): DeploymentModel {
    const instance = new DeploymentModel(undefined)

    return instance.applyInRandomOrder()
  }

  static whereColumn(first: keyof DeploymentsTable, operator: Operator, second: keyof DeploymentsTable): DeploymentModel {
    const instance = new DeploymentModel(undefined)

    return instance.applyWhereColumn(first, operator, second)
  }

  static async max(field: keyof DeploymentsTable): Promise<number> {
    const instance = new DeploymentModel(undefined)

    return await instance.applyMax(field)
  }

  static async min(field: keyof DeploymentsTable): Promise<number> {
    const instance = new DeploymentModel(undefined)

    return await instance.applyMin(field)
  }

  static async avg(field: keyof DeploymentsTable): Promise<number> {
    const instance = new DeploymentModel(undefined)

    return await instance.applyAvg(field)
  }

  static async sum(field: keyof DeploymentsTable): Promise<number> {
    const instance = new DeploymentModel(undefined)

    return await instance.applySum(field)
  }

  static async count(): Promise<number> {
    const instance = new DeploymentModel(undefined)

    return instance.applyCount()
  }

  static async get(): Promise<DeploymentModel[]> {
    const instance = new DeploymentModel(undefined)

    const results = await instance.applyGet()

    return results.map((item: DeploymentJsonResponse) => instance.createInstance(item))
  }

  static async pluck<K extends keyof DeploymentModel>(field: K): Promise<DeploymentModel[K][]> {
    const instance = new DeploymentModel(undefined)

    return await instance.applyPluck(field)
  }

  static async chunk(size: number, callback: (models: DeploymentModel[]) => Promise<void>): Promise<void> {
    const instance = new DeploymentModel(undefined)

    await instance.applyChunk(size, async (models) => {
      const modelInstances = models.map((item: DeploymentJsonResponse) => instance.createInstance(item))
      await callback(modelInstances)
    })
  }

  static async paginate(options: { limit?: number, offset?: number, page?: number } = { limit: 10, offset: 0, page: 1 }): Promise<{
    data: DeploymentModel[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }> {
    const instance = new DeploymentModel(undefined)

    const result = await instance.applyPaginate(options)

    return {
      data: result.data.map((item: DeploymentJsonResponse) => instance.createInstance(item)),
      paging: result.paging,
      next_cursor: result.next_cursor,
    }
  }

  // Instance method for creating model instances
  createInstance(data: DeploymentJsonResponse): DeploymentModel {
    return new DeploymentModel(data)
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

    const model = await DB.instance.selectFrom('deployments')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created Deployment')
    }

    return this.createInstance(model)
  }

  async create(newDeployment: NewDeployment): Promise<DeploymentModel> {
    return await this.applyCreate(newDeployment)
  }

  static async create(newDeployment: NewDeployment): Promise<DeploymentModel> {
    const instance = new DeploymentModel(undefined)
    return await instance.applyCreate(newDeployment)
  }

  static async firstOrCreate(search: Partial<DeploymentsTable>, values: NewDeployment = {} as NewDeployment): Promise<DeploymentModel> {
    // First try to find a record matching the search criteria
    const instance = new DeploymentModel(undefined)

    // Apply all search conditions
    for (const [key, value] of Object.entries(search)) {
      instance.selectFromQuery = instance.selectFromQuery.where(key, '=', value)
    }

    // Try to find the record
    const existingRecord = await instance.applyFirst()

    if (existingRecord) {
      return instance.createInstance(existingRecord)
    }

    // If no record exists, create a new one with combined search criteria and values
    const createData = { ...search, ...values } as NewDeployment
    return await DeploymentModel.create(createData)
  }

  static async updateOrCreate(search: Partial<DeploymentsTable>, values: NewDeployment = {} as NewDeployment): Promise<DeploymentModel> {
    // First try to find a record matching the search criteria
    const instance = new DeploymentModel(undefined)

    // Apply all search conditions
    for (const [key, value] of Object.entries(search)) {
      instance.selectFromQuery = instance.selectFromQuery.where(key, '=', value)
    }

    // Try to find the record
    const existingRecord = await instance.applyFirst()

    if (existingRecord) {
      // If record exists, update it with the new values
      const model = instance.createInstance(existingRecord)
      const updatedModel = await model.update(values as DeploymentUpdate)

      // Return the updated model instance
      if (updatedModel) {
        return updatedModel
      }

      // If update didn't return a model, fetch it again to ensure we have latest data
      const refreshedModel = await instance.applyFirst()
      return instance.createInstance(refreshedModel!)
    }

    // If no record exists, create a new one with combined search criteria and values
    const createData = { ...search, ...values } as NewDeployment
    return await DeploymentModel.create(createData)
  }

  async update(newDeployment: DeploymentUpdate): Promise<DeploymentModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newDeployment).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as DeploymentUpdate

    await this.mapCustomSetters(filteredValues)

    filteredValues.updated_at = new Date().toISOString()

    await DB.instance.updateTable('deployments')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('deployments')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated Deployment')
      }

      return this.createInstance(model)
    }

    return undefined
  }

  async forceUpdate(newDeployment: DeploymentUpdate): Promise<DeploymentModel | undefined> {
    await DB.instance.updateTable('deployments')
      .set(newDeployment)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('deployments')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated Deployment')
      }

      return this.createInstance(model)
    }

    return undefined
  }

  async save(): Promise<DeploymentModel> {
    // If the model has an ID, update it; otherwise, create a new record
    if (this.id) {
      // Update existing record
      await DB.instance.updateTable('deployments')
        .set(this.attributes as DeploymentUpdate)
        .where('id', '=', this.id)
        .executeTakeFirst()

      // Get the updated data
      const model = await DB.instance.selectFrom('deployments')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated Deployment')
      }

      return this.createInstance(model)
    }
    else {
      // Create new record
      const result = await DB.instance.insertInto('deployments')
        .values(this.attributes as NewDeployment)
        .executeTakeFirst()

      // Get the created data
      const model = await DB.instance.selectFrom('deployments')
        .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve created Deployment')
      }

      return this.createInstance(model)
    }
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

    const instance = new DeploymentModel(undefined)
    const model = await DB.instance.selectFrom('deployments')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created Deployment')
    }

    return instance.createInstance(model)
  }

  // Method to remove a Deployment
  async delete(): Promise<number> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()

    const deleted = await DB.instance.deleteFrom('deployments')
      .where('id', '=', this.id)
      .execute()

    return deleted.numDeletedRows
  }

  static async remove(id: number): Promise<any> {
    return await DB.instance.deleteFrom('deployments')
      .where('id', '=', id)
      .execute()
  }

  static whereCommitSha(value: string): DeploymentModel {
    const instance = new DeploymentModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('commit_sha', '=', value)

    return instance
  }

  static whereCommitMessage(value: string): DeploymentModel {
    const instance = new DeploymentModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('commit_message', '=', value)

    return instance
  }

  static whereBranch(value: string): DeploymentModel {
    const instance = new DeploymentModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('branch', '=', value)

    return instance
  }

  static whereStatus(value: string): DeploymentModel {
    const instance = new DeploymentModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('status', '=', value)

    return instance
  }

  static whereExecutionTime(value: string): DeploymentModel {
    const instance = new DeploymentModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('execution_time', '=', value)

    return instance
  }

  static whereDeployScript(value: string): DeploymentModel {
    const instance = new DeploymentModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('deploy_script', '=', value)

    return instance
  }

  static whereTerminalOutput(value: string): DeploymentModel {
    const instance = new DeploymentModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('terminal_output', '=', value)

    return instance
  }

  static whereIn<V = number>(column: keyof DeploymentsTable, values: V[]): DeploymentModel {
    const instance = new DeploymentModel(undefined)

    return instance.applyWhereIn<V>(column, values)
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

  static distinct(column: keyof DeploymentJsonResponse): DeploymentModel {
    const instance = new DeploymentModel(undefined)

    return instance.applyDistinct(column)
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

  // Add a protected applyFind implementation
  protected async applyFind(id: number): Promise<DeploymentModel | undefined> {
    const model = await DB.instance.selectFrom(this.tableName)
      .where('id', '=', id)
      .selectAll()
      .executeTakeFirst()

    if (!model)
      return undefined

    this.mapCustomGetters(model)

    await this.loadRelations(model)

    // Return a proper instance using the factory method
    return this.createInstance(model)
  }
}

export async function find(id: number): Promise<DeploymentModel | undefined> {
  const query = DB.instance.selectFrom('deployments').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  const instance = new DeploymentModel(undefined)
  return instance.createInstance(model)
}

export async function count(): Promise<number> {
  const results = await DeploymentModel.count()

  return results
}

export async function create(newDeployment: NewDeployment): Promise<DeploymentModel> {
  const instance = new DeploymentModel(undefined)
  return await instance.applyCreate(newDeployment)
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
