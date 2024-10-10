import type { Generated, Insertable, Selectable, Updateable } from 'kysely'
import { cache } from '@stacksjs/cache'
import { db, sql } from '@stacksjs/database'
import User from './User'

// import { Kysely, MysqlDialect, PostgresDialect } from 'kysely'
// import { Pool } from 'pg'

// TODO: we need an action that auto-generates these table interfaces
export interface DeploymentsTable {
  id: Generated<number>
  commit_sha?: string
  commit_message?: string
  branch?: string
  status?: string
  execution_time?: number
  deploy_script?: string
  terminal_output?: string
  user_id?: number

  created_at?: Date

  updated_at?: Date

  deleted_at?: Date

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
export type NewDeployment = Insertable<DeploymentsTable>
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
  private fillable = []
  private softDeletes = false
  protected query: any
  protected hasSelect: boolean
  public id: number | undefined
  public commit_sha: string | undefined
  public commit_message: string | undefined
  public branch: string | undefined
  public status: string | undefined
  public execution_time: number | undefined
  public deploy_script: string | undefined
  public terminal_output: string | undefined

  public created_at: Date | undefined
  public updated_at: Date | undefined
  public user_id: number | undefined

  constructor(deployment: Partial<DeploymentType> | null) {
    this.id = deployment?.id
    this.commit_sha = deployment?.commit_sha
    this.commit_message = deployment?.commit_message
    this.branch = deployment?.branch
    this.status = deployment?.status
    this.execution_time = deployment?.execution_time
    this.deploy_script = deployment?.deploy_script
    this.terminal_output = deployment?.terminal_output

    this.created_at = deployment?.created_at

    this.updated_at = deployment?.updated_at

    this.user_id = deployment?.user_id

    this.query = db.selectFrom('deployments')
    this.hasSelect = false
  }

  // Method to find a Deployment by ID
  async find(id: number): Promise<DeploymentModel | undefined> {
    const query = db.selectFrom('deployments').where('id', '=', id).selectAll()

    const model = await query.executeTakeFirst()

    if (!model)
      return undefined

    cache.getOrSet(`deployment:${id}`, JSON.stringify(model))

    return this.parseResult(new DeploymentModel(model))
  }

  // Method to find a Deployment by ID
  static async find(id: number): Promise<DeploymentModel | undefined> {
    const query = db.selectFrom('deployments').where('id', '=', id).selectAll()

    const instance = new DeploymentModel(null)

    const model = await query.executeTakeFirst()

    if (!model)
      return undefined

    cache.getOrSet(`deployment:${id}`, JSON.stringify(model))

    return instance.parseResult(new DeploymentModel(model))
  }

  static async all(): Promise<DeploymentModel[]> {
    let query = db.selectFrom('deployments').selectAll()

    const instance = new DeploymentModel(null)

    if (instance.softDeletes) {
      query = query.where('deleted_at', 'is', null)
    }

    const results = await query.execute()

    return results.map(modelItem => instance.parseResult(new DeploymentModel(modelItem)))
  }

  static async findOrFail(id: number): Promise<DeploymentModel> {
    let query = db.selectFrom('deployments').where('id', '=', id)

    const instance = new DeploymentModel(null)

    if (instance.softDeletes) {
      query = query.where('deleted_at', 'is', null)
    }

    query = query.selectAll()

    const model = await query.executeTakeFirst()

    if (!model)
      throw (`No model results found for ${id} `)

    cache.getOrSet(`deployment:${id}`, JSON.stringify(model))

    return instance.parseResult(new DeploymentModel(model))
  }

  static async findMany(ids: number[]): Promise<DeploymentModel[]> {
    let query = db.selectFrom('deployments').where('id', 'in', ids)

    const instance = new DeploymentModel(null)

    if (instance.softDeletes) {
      query = query.where('deleted_at', 'is', null)
    }

    query = query.selectAll()

    const model = await query.execute()

    return model.map(modelItem => instance.parseResult(new DeploymentModel(modelItem)))
  }

  // Method to get a User by criteria
  static async get(): Promise<UserModel[]> {
    const instance = new DeploymentModel(null)

    if (instance.hasSelect) {
      if (instance.softDeletes) {
        instance.query = instance.query.where('deleted_at', 'is', null)
      }

      const model = await instance.query.execute()

      return model.map((modelItem: DeploymentModel) => new DeploymentModel(modelItem))
    }

    if (instance.softDeletes) {
      instance.query = instance.query.where('deleted_at', 'is', null)
    }

    const model = await instance.query.selectAll().execute()

    return model.map((modelItem: DeploymentModel) => new DeploymentModel(modelItem))
  }

  // Method to get a Deployment by criteria
  async get(): Promise<DeploymentModel[]> {
    if (this.hasSelect) {
      if (this.softDeletes) {
        this.query = this.query.where('deleted_at', 'is', null)
      }

      const model = await this.query.execute()

      return model.map((modelItem: DeploymentModel) => new DeploymentModel(modelItem))
    }

    if (this.softDeletes) {
      this.query = this.query.where('deleted_at', 'is', null)
    }

    const model = await this.query.selectAll().execute()

    return model.map((modelItem: DeploymentModel) => new DeploymentModel(modelItem))
  }

  static async count(): Promise<number> {
    const instance = new DeploymentModel(null)

    if (instance.softDeletes) {
      instance.query = instance.query.where('deleted_at', 'is', null)
    }

    const results = await instance.query.selectAll().execute()

    return results.length
  }

  async count(): Promise<number> {
    if (this.hasSelect) {
      if (this.softDeletes) {
        this.query = this.query.where('deleted_at', 'is', null)
      }

      const results = await this.query.execute()

      return results.length
    }

    const results = await this.query.selectAll().execute()

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

    const result = await db.insertInto('deployments')
      .values(filteredValues)
      .executeTakeFirstOrThrow()

    const model = await find(Number(result.insertId)) as DeploymentModel

    return model
  }

  static async forceCreate(newDeployment: NewDeployment): Promise<DeploymentModel> {
    const result = await db.insertInto('deployments')
      .values(newDeployment)
      .executeTakeFirstOrThrow()

    const model = await find(Number(result.insertId)) as DeploymentModel

    return model
  }

  // Method to remove a Deployment
  static async remove(id: number): Promise<void> {
    const instance = new DeploymentModel(null)
    const model = await instance.find(id)

    if (instance.softDeletes) {
      await db.updateTable('deployments')
        .set({
          deleted_at: sql.raw('CURRENT_TIMESTAMP'),
        })
        .where('id', '=', id)
        .execute()
    }
    else {
      await db.deleteFrom('deployments')
        .where('id', '=', id)
        .execute()
    }
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
      throw new Error('Invalid number of arguments')
    }

    this.query = this.query.where(column, operator, value)

    return this
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
      throw new Error('Invalid number of arguments')
    }

    instance.query = instance.query.where(column, operator, value)

    return instance
  }

  static whereCommitSha(value: string): DeploymentModel {
    const instance = new DeploymentModel(null)

    instance.query = instance.query.where('commitSha', '=', value)

    return instance
  }

  static whereCommitMessage(value: string): DeploymentModel {
    const instance = new DeploymentModel(null)

    instance.query = instance.query.where('commitMessage', '=', value)

    return instance
  }

  static whereBranch(value: string): DeploymentModel {
    const instance = new DeploymentModel(null)

    instance.query = instance.query.where('branch', '=', value)

    return instance
  }

  static whereStatus(value: string): DeploymentModel {
    const instance = new DeploymentModel(null)

    instance.query = instance.query.where('status', '=', value)

    return instance
  }

  static whereExecutionTime(value: string): DeploymentModel {
    const instance = new DeploymentModel(null)

    instance.query = instance.query.where('executionTime', '=', value)

    return instance
  }

  static whereDeployScript(value: string): DeploymentModel {
    const instance = new DeploymentModel(null)

    instance.query = instance.query.where('deployScript', '=', value)

    return instance
  }

  static whereTerminalOutput(value: string): DeploymentModel {
    const instance = new DeploymentModel(null)

    instance.query = instance.query.where('terminalOutput', '=', value)

    return instance
  }

  static whereIn(column: keyof DeploymentType, values: any[]): DeploymentModel {
    const instance = new DeploymentModel(null)

    instance.query = instance.query.where(column, 'in', values)

    return instance
  }

  async first(): Promise<DeploymentModel | undefined> {
    const model = await this.query.selectAll().executeTakeFirst()

    if (!model) {
      return undefined
    }

    return this.parseResult(new DeploymentModel(model))
  }

  async firstOrFail(): Promise<DeploymentModel | undefined> {
    const model = await this.query.selectAll().executeTakeFirstOrThrow()

    return this.parseResult(new DeploymentModel(model))
  }

  async exists(): Promise<boolean> {
    const model = await this.query.selectAll().executeTakeFirst()

    return model !== null || model !== undefined
  }

  static async first(): Promise<DeploymentType | undefined> {
    return await db.selectFrom('deployments')
      .selectAll()
      .executeTakeFirst()
  }

  async last(): Promise<DeploymentType | undefined> {
    return await db.selectFrom('deployments')
      .selectAll()
      .orderBy('id', 'desc')
      .executeTakeFirst()
  }

  static async last(): Promise<DeploymentType | undefined> {
    return await db.selectFrom('deployments').selectAll().orderBy('id', 'desc').executeTakeFirst()
  }

  static orderBy(column: keyof DeploymentType, order: 'asc' | 'desc'): DeploymentModel {
    const instance = new DeploymentModel(null)

    instance.query = instance.query.orderBy(column, order)

    return instance
  }

  orderBy(column: keyof DeploymentType, order: 'asc' | 'desc'): DeploymentModel {
    this.query = this.query.orderBy(column, order)

    return this
  }

  static orderByDesc(column: keyof DeploymentType): DeploymentModel {
    const instance = new DeploymentModel(null)

    instance.query = instance.query.orderBy(column, 'desc')

    return instance
  }

  orderByDesc(column: keyof DeploymentType): DeploymentModel {
    this.query = this.orderBy(column, 'desc')

    return this
  }

  static orderByAsc(column: keyof DeploymentType): DeploymentModel {
    const instance = new DeploymentModel(null)

    instance.query = instance.query.orderBy(column, 'asc')

    return instance
  }

  orderByAsc(column: keyof DeploymentType): DeploymentModel {
    this.query = this.query.orderBy(column, 'desc')

    return this
  }

  async update(deployment: DeploymentUpdate): Promise<DeploymentModel | undefined> {
    if (this.id === undefined)
      throw new Error('Deployment ID is undefined')

    const filteredValues = Object.fromEntries(
      Object.entries(deployment).filter(([key]) => this.fillable.includes(key)),
    ) as NewDeployment

    await db.updateTable('deployments')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    const model = await this.find(Number(this.id))

    return model
  }

  async forceUpdate(deployment: DeploymentUpdate): Promise<DeploymentModel | undefined> {
    if (this.id === undefined)
      throw new Error('Deployment ID is undefined')

    await db.updateTable('deployments')
      .set(deployment)
      .where('id', '=', this.id)
      .executeTakeFirst()

    const model = await this.find(Number(this.id))

    return model
  }

  async save(): Promise<void> {
    if (!this)
      throw new Error('Deployment data is undefined')

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
  async delete(): Promise<void> {
    if (this.id === undefined)
      throw new Error('Deployment ID is undefined')

    const model = await this.find(this.id)

    // Check if soft deletes are enabled
    if (this.softDeletes) {
      // Update the deleted_at column with the current timestamp
      await db.updateTable('deployments')
        .set({
          deleted_at: sql.raw('CURRENT_TIMESTAMP'),
        })
        .where('id', '=', this.id)
        .execute()
    }
    else {
      // Perform a hard delete
      await db.deleteFrom('deployments')
        .where('id', '=', this.id)
        .execute()
    }
  }

  async user() {
    if (this.deployment_id === undefined)
      throw new Error('Relation Error!')

    const model = await User
      .where('id', '=', deployment_id)
      .first()

    if (!model)
      throw new Error('Model Relation Not Found!')

    return model
  }

  distinct(column: keyof DeploymentType): DeploymentModel {
    this.query = this.query.select(column).distinct()

    this.hasSelect = true

    return this
  }

  static distinct(column: keyof DeploymentType): DeploymentModel {
    const instance = new DeploymentModel(null)

    instance.query = instance.query.select(column).distinct()

    instance.hasSelect = true

    return instance
  }

  join(table: string, firstCol: string, secondCol: string): DeploymentModel {
    this.query = this.query.innerJoin(table, firstCol, secondCol)

    return this
  }

  static join(table: string, firstCol: string, secondCol: string): DeploymentModel {
    const instance = new DeploymentModel(null)

    instance.query = instance.query.innerJoin(table, firstCol, secondCol)

    return instance
  }

  static async rawQuery(rawQuery: string): Promise<any> {
    return await sql`${rawQuery}`.execute(db)
  }

  toJSON() {
    const output: Partial<DeploymentType> = {

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

  return await find(Number(result.insertId)) as DeploymentModel
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
