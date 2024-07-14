import { generateTwoFactorSecret } from '@stacksjs/auth'
import { verifyTwoFactorCode } from '@stacksjs/auth'
import { db } from '@stacksjs/database'
import { sql } from '@stacksjs/database'
import type { ColumnType, Generated, Insertable, Selectable, Updateable } from 'kysely'
import User from './User'

// import { Kysely, MysqlDialect, PostgresDialect } from 'kysely'
// import { Pool } from 'pg'

// TODO: we need an action that auto-generates these table interfaces
export interface DeploymentsTable {
  id: Generated<number>
  commitSha: string
  commitMessage: string
  branch: string
  status: string
  executionTime: number
  deployScript: string
  terminalOutput: string
  user_id: number

  created_at: ColumnType<Date, string | undefined, never>
  updated_at: ColumnType<Date, string | undefined, never>
  deleted_at: ColumnType<Date, string | undefined, never>
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
interface SortOptions {
  column: DeploymentType
  order: SortDirection
}
// Define a type for the options parameter
interface QueryOptions {
  sort?: SortOptions
  limit?: number
  offset?: number
  page?: number
}

export class DeploymentModel {
  private deployment: Partial<DeploymentType> | null
  private hidden = []
  private fillable = []
  protected query: any
  protected hasSelect: boolean
  public id: number | undefined
  public commitSha: string | undefined
  public commitMessage: string | undefined
  public branch: string | undefined
  public status: string | undefined
  public executionTime: number | undefined
  public deployScript: string | undefined
  public terminalOutput: string | undefined
  public user_id: number | undefined

  constructor(deployment: Partial<DeploymentType> | null) {
    this.deployment = deployment
    this.id = deployment?.id
    this.commitSha = deployment?.commitSha
    this.commitMessage = deployment?.commitMessage
    this.branch = deployment?.branch
    this.status = deployment?.status
    this.executionTime = deployment?.executionTime
    this.deployScript = deployment?.deployScript
    this.terminalOutput = deployment?.terminalOutput
    this.user_id = deployment?.user_id

    this.query = db.selectFrom('deployments')
    this.hasSelect = false
  }

  // Method to find a Deployment by ID
  async find(id: number, fields?: (keyof DeploymentType)[]): Promise<DeploymentModel | undefined> {
    let query = db.selectFrom('deployments').where('id', '=', id)

    if (fields) query = query.select(fields)
    else query = query.selectAll()

    const model = await query.executeTakeFirst()

    if (!model) return undefined

    return this.parseResult(this)
  }

  // Method to find a Deployment by ID
  static async find(id: number, fields?: (keyof DeploymentType)[]): Promise<DeploymentModel | undefined> {
    let query = db.selectFrom('deployments').where('id', '=', id)

    const instance = new this(null)

    if (fields) query = query.select(fields)
    else query = query.selectAll()

    const model = await query.executeTakeFirst()

    if (!model) return undefined

    return instance.parseResult(new this(model))
  }

  static async findOrFail(id: number, fields?: (keyof DeploymentType)[]): Promise<DeploymentModel> {
    let query = db.selectFrom('deployments').where('id', '=', id)

    const instance = new this(null)

    if (fields) query = query.select(fields)
    else query = query.selectAll()

    const model = await query.executeTakeFirst()

    if (!model) throw `No model results found for ${id} `

    return instance.parseResult(new this(model))
  }

  static async findMany(ids: number[], fields?: (keyof DeploymentType)[]): Promise<DeploymentModel[]> {
    let query = db.selectFrom('deployments').where('id', 'in', ids)

    const instance = new this(null)

    if (fields) query = query.select(fields)
    else query = query.selectAll()

    const model = await query.execute()

    instance.parseResult(new DeploymentModel(modelItem))

    return model.map((modelItem) => instance.parseResult(new DeploymentModel(modelItem)))
  }

  // Method to get a Deployment by criteria
  static async fetch(criteria: Partial<DeploymentType>, options: QueryOptions = {}): Promise<DeploymentModel[]> {
    let query = db.selectFrom('deployments')

    // Apply sorting from options
    if (options.sort) query = query.orderBy(options.sort.column, options.sort.order)

    // Apply limit and offset from options
    if (options.limit !== undefined) query = query.limit(options.limit)

    if (options.offset !== undefined) query = query.offset(options.offset)

    const model = await query.selectAll().execute()
    return model.map((modelItem) => new DeploymentModel(modelItem))
  }

  // Method to get a Deployment by criteria
  static async get(): Promise<DeploymentModel[]> {
    const query = db.selectFrom('deployments')

    const model = await query.selectAll().execute()

    return model.map((modelItem) => new DeploymentModel(modelItem))
  }

  // Method to get a Deployment by criteria
  async get(): Promise<DeploymentModel[]> {
    if (this.hasSelect) {
      const model = await this.query.execute()

      return model.map((modelItem: DeploymentModel) => new DeploymentModel(modelItem))
    }

    const model = await this.query.selectAll().execute()

    return model.map((modelItem: DeploymentModel) => new DeploymentModel(modelItem))
  }

  static async count(): Promise<number> {
    const instance = new this(null)

    const results = await instance.query.selectAll().execute()

    return results.length
  }

  async count(): Promise<number> {
    if (this.hasSelect) {
      const results = await this.query.execute()

      return results.length
    }

    const results = await this.query.selectAll().execute()

    return results.length
  }

  // Method to get all deployments
  static async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<DeploymentResponse> {
    const totalRecordsResult = await db
      .selectFrom('deployments')
      .select(db.fn.count('id').as('total')) // Use 'id' or another actual column name
      .executeTakeFirst()

    const totalRecords = Number(totalRecordsResult?.total) || 0
    const totalPages = Math.ceil(totalRecords / (options.limit ?? 10))

    const deploymentsWithExtra = await db
      .selectFrom('deployments')
      .selectAll()
      .orderBy('id', 'asc') // Assuming 'id' is used for cursor-based pagination
      .limit((options.limit ?? 10) + 1) // Fetch one extra record
      .offset(((options.page ?? 1) - 1) * (options.limit ?? 10)) // Ensure options.page is not undefined
      .execute()

    let nextCursor = null
    if (deploymentsWithExtra.length > (options.limit ?? 10)) nextCursor = deploymentsWithExtra.pop()?.id // Use the ID of the extra record as the next cursor

    return {
      data: deploymentsWithExtra,
      paging: {
        total_records: totalRecords,
        page: options.page ?? 0,
        total_pages: totalPages,
      },
      next_cursor: nextCursor ?? null,
    }
  }

  // Method to create a new deployment
  static async create(newDeployment: NewDeployment): Promise<DeploymentModel | undefined> {
    const instance = new this(null)
    const filteredValues = Object.keys(newDeployment)
      .filter((key) => instance.fillable.includes(key))
      .reduce((obj: any, key) => {
        obj[key] = newDeployment[key]
        return obj
      }, {})

    if (Object.keys(filteredValues).length === 0) {
      return undefined
    }

    const result = await db.insertInto('deployments').values(filteredValues).executeTakeFirstOrThrow()

    return (await find(Number(result.insertId))) as DeploymentModel
  }

  // Method to remove a Deployment
  static async remove(id: number): Promise<void> {
    await db.deleteFrom('deployments').where('id', '=', id).execute()
  }

  where(...args: (string | number | boolean | undefined | null)[]): DeploymentModel {
    let column: any
    let operator: any
    let value: any

    if (args.length === 2) {
      ;[column, value] = args
      operator = '='
    } else if (args.length === 3) {
      ;[column, operator, value] = args
    } else {
      throw new Error('Invalid number of arguments')
    }

    this.query = this.query.where(column, operator, value)

    return this
  }

  static where(...args: (string | number | boolean | undefined | null)[]): DeploymentModel {
    let column: any
    let operator: any
    let value: any

    const instance = new this(null)

    if (args.length === 2) {
      ;[column, value] = args
      operator = '='
    } else if (args.length === 3) {
      ;[column, operator, value] = args
    } else {
      throw new Error('Invalid number of arguments')
    }

    instance.query = instance.query.where(column, operator, value)

    return instance
  }

  static whereCommitSha(value: string | number | boolean | undefined | null): DeploymentModel {
    const instance = new this(null)

    instance.query = instance.query.where('commitSha', '=', value)

    return instance
  }

  static whereCommitMessage(value: string | number | boolean | undefined | null): DeploymentModel {
    const instance = new this(null)

    instance.query = instance.query.where('commitMessage', '=', value)

    return instance
  }

  static whereBranch(value: string | number | boolean | undefined | null): DeploymentModel {
    const instance = new this(null)

    instance.query = instance.query.where('branch', '=', value)

    return instance
  }

  static whereStatus(value: string | number | boolean | undefined | null): DeploymentModel {
    const instance = new this(null)

    instance.query = instance.query.where('status', '=', value)

    return instance
  }

  static whereExecutionTime(value: string | number | boolean | undefined | null): DeploymentModel {
    const instance = new this(null)

    instance.query = instance.query.where('executionTime', '=', value)

    return instance
  }

  static whereDeployScript(value: string | number | boolean | undefined | null): DeploymentModel {
    const instance = new this(null)

    instance.query = instance.query.where('deployScript', '=', value)

    return instance
  }

  static whereTerminalOutput(value: string | number | boolean | undefined | null): DeploymentModel {
    const instance = new this(null)

    instance.query = instance.query.where('terminalOutput', '=', value)

    return instance
  }

  static whereIn(column: keyof DeploymentType, values: any[]): DeploymentModel {
    const instance = new this(null)

    instance.query = instance.query.where(column, 'in', values)

    return instance
  }

  async first(): Promise<DeploymentModel | undefined> {
    const model = await this.query.selectAll().executeTakeFirst()

    if (!model) {
      return undefined
    }

    return new DeploymentModel(model)
  }

  async exists(): Promise<boolean> {
    const model = await this.query.selectAll().executeTakeFirst()

    return model !== null || model !== undefined
  }

  static async first(): Promise<DeploymentType | undefined> {
    return await db.selectFrom('deployments').selectAll().executeTakeFirst()
  }

  async last(): Promise<DeploymentType | undefined> {
    return await db.selectFrom('deployments').selectAll().orderBy('id', 'desc').executeTakeFirst()
  }

  static orderBy(column: keyof DeploymentType, order: 'asc' | 'desc'): DeploymentModel {
    const instance = new this(null)

    instance.query = instance.orderBy(column, order)

    return instance
  }

  orderBy(column: keyof DeploymentType, order: 'asc' | 'desc'): DeploymentModel {
    this.query = this.query.orderBy(column, order)

    return this
  }

  static orderByDesc(column: keyof DeploymentType): DeploymentModel {
    const instance = new this(null)

    instance.query = instance.query.orderBy(column, 'desc')

    return instance
  }

  orderByDesc(column: keyof DeploymentType): DeploymentModel {
    this.query = this.orderBy(column, 'desc')

    return this
  }

  static orderByAsc(column: keyof DeploymentType): DeploymentModel {
    const instance = new this(null)

    instance.query = instance.query.orderBy(column, 'desc')

    return instance
  }

  orderByAsc(column: keyof DeploymentType): DeploymentModel {
    this.query = this.query.orderBy(column, 'desc')

    return this
  }

  // Method to update the deployments instance
  async update(deployment: DeploymentUpdate): Promise<DeploymentModel | null> {
    if (this.id === undefined) throw new Error('Deployment ID is undefined')

    const filteredValues = Object.keys(newDeployment)
      .filter((key) => this.fillable.includes(key))
      .reduce((obj, key) => {
        obj[key] = newDeployment[key]
        return obj
      }, {})

    await db.updateTable('deployments').set(filteredValues).where('id', '=', this.id).executeTakeFirst()

    return await this.find(Number(this.id))
  }

  // Method to save (insert or update) the deployment instance
  async save(): Promise<void> {
    if (!this.deployment) throw new Error('Deployment data is undefined')

    if (this.deployment.id === undefined) {
      // Insert new deployment
      const newModel = await db
        .insertInto('deployments')
        .values(this.deployment as NewDeployment)
        .executeTakeFirstOrThrow()
    } else {
      // Update existing deployment
      await this.update(this.deployment)
    }
  }

  // Method to delete the deployment instance
  async delete(): Promise<void> {
    if (this.id === undefined) throw new Error('Deployment ID is undefined')

    await db.deleteFrom('deployments').where('id', '=', this.id).execute()
  }

  async user() {
    if (this.deployment_id === undefined) throw new Error('Relation Error!')

    const model = await User.where('id', '=', deployment_id).first()

    if (!model) throw new Error('Model Relation Not Found!')

    return model
  }

  distinct(column: keyof DeploymentType): DeploymentModel {
    this.query = this.query.distinctOn(column)

    return this
  }

  static distinct(column: keyof DeploymentType): DeploymentModel {
    const instance = new this(null)

    instance.query = instance.query.distinctOn(column)

    return instance
  }

  join(table: string, firstCol: string, secondCol: string): DeploymentModel {
    this.query = this.query.innerJoin(table, firstCol, secondCol)

    return this
  }

  static join(table: string, firstCol: string, secondCol: string): DeploymentModel {
    const instance = new this(null)

    instance.query = instance.query.innerJoin(table, firstCol, secondCol)

    return instance
  }

  static async rawQuery(rawQuery: string): Promise<any> {
    return await sql`${rawQuery}`.execute(db)
  }

  toJSON() {
    const output: Partial<DeploymentType> = { ...this.deployment }

    this.hidden.forEach((attr) => {
      if (attr in output) delete output[attr as keyof Partial<DeploymentType>]
    })

    type Deployment = Omit<DeploymentType, 'password'>

    return output as Deployment
  }

  parseResult(model: any): DeploymentModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute]
      delete model.deployment[hiddenAttribute]
    }

    return model
  }
}

async function find(id: number, fields?: (keyof DeploymentType)[]): Promise<DeploymentModel | null> {
  let query = db.selectFrom('deployments').where('id', '=', id)

  if (fields) query = query.select(fields)
  else query = query.selectAll()

  const model = await query.executeTakeFirst()

  if (!model) return null

  return new DeploymentModel(model)
}

export async function count(): Promise<number> {
  const results = await DeploymentModel.count()

  return results
}

export async function create(newDeployment: NewDeployment): Promise<DeploymentModel> {
  const result = await db.insertInto('deployments').values(newDeployment).executeTakeFirstOrThrow()

  return (await find(Number(result.insertId))) as DeploymentModel
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(db)
}

export async function remove(id: number): Promise<void> {
  await db.deleteFrom('deployments').where('id', '=', id).execute()
}

export async function whereCommitSha(value: string | number | boolean | undefined | null): Promise<DeploymentModel[]> {
  const query = db.selectFrom('deployments').where('commitSha', '=', value)

  const results = await query.execute()

  return results.map((modelItem) => new DeploymentModel(modelItem))
}

export async function whereCommitMessage(
  value: string | number | boolean | undefined | null,
): Promise<DeploymentModel[]> {
  const query = db.selectFrom('deployments').where('commitMessage', '=', value)

  const results = await query.execute()

  return results.map((modelItem) => new DeploymentModel(modelItem))
}

export async function whereBranch(value: string | number | boolean | undefined | null): Promise<DeploymentModel[]> {
  const query = db.selectFrom('deployments').where('branch', '=', value)

  const results = await query.execute()

  return results.map((modelItem) => new DeploymentModel(modelItem))
}

export async function whereStatus(value: string | number | boolean | undefined | null): Promise<DeploymentModel[]> {
  const query = db.selectFrom('deployments').where('status', '=', value)

  const results = await query.execute()

  return results.map((modelItem) => new DeploymentModel(modelItem))
}

export async function whereExecutionTime(
  value: string | number | boolean | undefined | null,
): Promise<DeploymentModel[]> {
  const query = db.selectFrom('deployments').where('executionTime', '=', value)

  const results = await query.execute()

  return results.map((modelItem) => new DeploymentModel(modelItem))
}

export async function whereDeployScript(
  value: string | number | boolean | undefined | null,
): Promise<DeploymentModel[]> {
  const query = db.selectFrom('deployments').where('deployScript', '=', value)

  const results = await query.execute()

  return results.map((modelItem) => new DeploymentModel(modelItem))
}

export async function whereTerminalOutput(
  value: string | number | boolean | undefined | null,
): Promise<DeploymentModel[]> {
  const query = db.selectFrom('deployments').where('terminalOutput', '=', value)

  const results = await query.execute()

  return results.map((modelItem) => new DeploymentModel(modelItem))
}

const Deployment = DeploymentModel

export default Deployment
