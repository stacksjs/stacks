import type { Insertable, Selectable, Updateable } from 'kysely'
import type { UserModel } from './User'
import { randomUUIDv7 } from 'bun'
import { cache } from '@stacksjs/cache'
import { db, sql } from '@stacksjs/database'
import { HttpError } from '@stacksjs/error-handling'

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
  data: Deployments
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export type DeploymentType = Selectable<DeploymentsTable>
export type NewDeployment = Partial<Insertable<DeploymentsTable>>
export type DeploymentUpdate = Updateable<DeploymentsTable>
export type Deployments = DeploymentType[]

export type DeploymentColumn = Deployments
export type DeploymentColumns = Array<keyof Deployments>

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
  private hidden = []
  private fillable = ['commit_sha', 'commit_message', 'branch', 'status', 'execution_time', 'deploy_script', 'terminal_output', 'uuid', 'user_id']
  private softDeletes = false
  protected selectFromQuery: any
  protected withRelations: string[]
  protected updateFromQuery: any
  protected deleteFromQuery: any
  protected hasSelect: boolean
  public user_id: number | undefined
  public user: UserModel | undefined
  public id: number
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

    this.withRelations = []
    this.selectFromQuery = db.selectFrom('deployments')
    this.updateFromQuery = db.updateTable('deployments')
    this.deleteFromQuery = db.deleteFrom('deployments')
    this.hasSelect = false
  }

  // Method to find a Deployment by ID
  async find(id: number): Promise<DeploymentModel | undefined> {
    const query = db.selectFrom('deployments').where('id', '=', id).selectAll()

    const model = await query.executeTakeFirst()

    if (!model)
      return undefined

    const result = await this.mapWith(model)

    const data = new DeploymentModel(result as DeploymentType)

    cache.getOrSet(`deployment:${id}`, JSON.stringify(model))

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
      throw new HttpError(404, `No DeploymentModel results for ${id}`)

    cache.getOrSet(`deployment:${id}`, JSON.stringify(model))

    const result = await instance.mapWith(model)

    const data = new DeploymentModel(result as DeploymentType)

    return data
  }

  async findOrFail(id: number): Promise<DeploymentModel> {
    const model = await db.selectFrom('deployments').where('id', '=', id).selectAll().executeTakeFirst()

    if (model === undefined)
      throw new HttpError(404, `No DeploymentModel results for ${id}`)

    cache.getOrSet(`deployment:${id}`, JSON.stringify(model))

    const result = await this.mapWith(model)

    const data = new DeploymentModel(result as DeploymentType)

    return data
  }

  static async findMany(ids: number[]): Promise<DeploymentModel[]> {
    let query = db.selectFrom('deployments').where('id', 'in', ids)

    const instance = new DeploymentModel(null)

    query = query.selectAll()

    const model = await query.execute()

    return model.map(modelItem => instance.parseResult(new DeploymentModel(modelItem)))
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

  // Method to get a Deployment by criteria
  async get(): Promise<DeploymentModel[]> {
    if (this.hasSelect) {
      const model = await this.selectFromQuery.execute()

      return model.map((modelItem: DeploymentModel) => new DeploymentModel(modelItem))
    }

    const model = await this.selectFromQuery.selectAll().execute()

    return model.map((modelItem: DeploymentModel) => new DeploymentModel(modelItem))
  }

  static async count(): Promise<number> {
    const instance = new DeploymentModel(null)

    const results = await instance.selectFromQuery.selectAll().execute()

    return results.length
  }

  async count(): Promise<number> {
    if (this.hasSelect) {
      const results = await this.selectFromQuery.execute()

      return results.length
    }

    const results = await this.selectFromQuery.execute()

    return results.length
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

  where(...args: (string | number | boolean | undefined | null)[]): DeploymentModel {
    let column: any
    let operator: any
    let value: any

    if (args.length === 2) {
      [column, value] = args
      operator = '='
    }
    else if (args.length === 3) {
      [column, operator, value] = args
    }
    else {
      throw new HttpError(500, 'Invalid number of arguments')
    }

    this.selectFromQuery = this.selectFromQuery.where(column, operator, value)

    this.updateFromQuery = this.updateFromQuery.where(column, operator, value)
    this.deleteFromQuery = this.deleteFromQuery.where(column, operator, value)

    return this
  }

  orWhere(...args: Array<[string, string, any]>): DeploymentModel {
    if (args.length === 0) {
      throw new HttpError(500, 'At least one condition must be provided')
    }

    // Use the expression builder to append the OR conditions
    this.selectFromQuery = this.selectFromQuery.where((eb: any) =>
      eb.or(
        args.map(([column, operator, value]) => eb(column, operator, value)),
      ),
    )

    this.updateFromQuery = this.updateFromQuery.where((eb: any) =>
      eb.or(
        args.map(([column, operator, value]) => eb(column, operator, value)),
      ),
    )

    this.deleteFromQuery = this.deleteFromQuery.where((eb: any) =>
      eb.or(
        args.map(([column, operator, value]) => eb(column, operator, value)),
      ),
    )

    return this
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

  static where(...args: (string | number | boolean | undefined | null)[]): DeploymentModel {
    let column: any
    let operator: any
    let value: any

    const instance = new DeploymentModel(null)

    if (args.length === 2) {
      [column, value] = args
      operator = '='
    }
    else if (args.length === 3) {
      [column, operator, value] = args
    }
    else {
      throw new HttpError(500, 'Invalid number of arguments')
    }

    instance.selectFromQuery = instance.selectFromQuery.where(column, operator, value)

    instance.updateFromQuery = instance.updateFromQuery.where(column, operator, value)

    instance.deleteFromQuery = instance.deleteFromQuery.where(column, operator, value)

    return instance
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

  whereNull(column: string): DeploymentModel {
    this.selectFromQuery = this.selectFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    this.updateFromQuery = this.updateFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    return this
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

  static whereIn(column: keyof DeploymentType, values: any[]): DeploymentModel {
    const instance = new DeploymentModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where(column, 'in', values)

    instance.updateFromQuery = instance.updateFromQuery.where(column, 'in', values)

    instance.deleteFromQuery = instance.deleteFromQuery.where(column, 'in', values)

    return instance
  }

  async first(): Promise<DeploymentModel | undefined> {
    const model = await this.selectFromQuery.selectAll().executeTakeFirst()

    if (!model)
      return undefined

    const result = await this.mapWith(model)

    const data = new DeploymentModel(result as DeploymentType)

    return data
  }

  async firstOrFail(): Promise<DeploymentModel | undefined> {
    const model = await this.selectFromQuery.executeTakeFirst()

    if (model === undefined)
      throw new HttpError(404, 'No DeploymentModel results found for query')

    const instance = new DeploymentModel(null)

    const result = await instance.mapWith(model)

    const data = new DeploymentModel(result as DeploymentType)

    return data
  }

  async exists(): Promise<boolean> {
    const model = await this.selectFromQuery.executeTakeFirst()

    return model !== null || model !== undefined
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

  orderBy(column: keyof DeploymentType, order: 'asc' | 'desc'): DeploymentModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, order)

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

    if (this.id === undefined) {
      this.updateFromQuery.set(filteredValues).execute()
    }

    await db.updateTable('deployments')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    const model = await this.find(this.id)

    return model
  }

  async forceUpdate(deployment: DeploymentUpdate): Promise<DeploymentModel | undefined> {
    if (this.id === undefined) {
      this.updateFromQuery.set(deployment).execute()
    }

    await db.updateTable('deployments')
      .set(deployment)
      .where('id', '=', this.id)
      .executeTakeFirst()

    const model = await this.find(this.id)

    return model
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
    this.selectFromQuery = this.selectFromQuery(table, firstCol, secondCol)

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

  toJSON() {
    const output: Partial<DeploymentType> = {
      user_id: this.user_id,
      user: this.user,

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

    }

        type Deployment = Omit<DeploymentType, 'password'>

        return output as Deployment
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
