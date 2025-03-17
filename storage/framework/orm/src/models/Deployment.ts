import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { UserModel } from './User'
import { randomUUIDv7 } from 'bun'
import { sql } from '@stacksjs/database'
import { HttpError } from '@stacksjs/error-handling'
import { BaseOrm, DB } from '@stacksjs/orm'

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
    this.hasSaved = false
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

  static select(params: (keyof DeploymentJsonResponse)[] | RawBuilder<string> | string): DeploymentModel {
    const instance = new DeploymentModel(undefined)

    return instance.applySelect(params)
  }

  // Method to find a Deployment by ID
  static async find(id: number): Promise<DeploymentModel | undefined> {
    const instance = new DeploymentModel(undefined)

    return await instance.applyFind(id)
  }

  static async first(): Promise<DeploymentModel | undefined> {
    const instance = new DeploymentModel(undefined)

    const model = await instance.applyFirst()

    const data = new DeploymentModel(model)

    return data
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

    return models.map((modelItem: UserJsonResponse) => instance.parseResult(new DeploymentModel(modelItem)))
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
      data: result.data.map((item: DeploymentJsonResponse) => new DeploymentModel(item)),
      paging: result.paging,
      next_cursor: result.next_cursor,
    }
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

  async update(newDeployment: DeploymentUpdate): Promise<DeploymentModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newDeployment).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as DeploymentUpdate

    await this.mapCustomSetters(filteredValues)

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

  async forceUpdate(newDeployment: DeploymentUpdate): Promise<DeploymentModel | undefined> {
    await DB.instance.updateTable('deployments')
      .set(newDeployment)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      const model = await this.find(this.id)

      return model
    }

    return undefined
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

    instance.selectFromQuery = instance.selectFromQuery.where('commitSha', '=', value)

    return instance
  }

  static whereCommitMessage(value: string): DeploymentModel {
    const instance = new DeploymentModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('commitMessage', '=', value)

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

    instance.selectFromQuery = instance.selectFromQuery.where('executionTime', '=', value)

    return instance
  }

  static whereDeployScript(value: string): DeploymentModel {
    const instance = new DeploymentModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('deployScript', '=', value)

    return instance
  }

  static whereTerminalOutput(value: string): DeploymentModel {
    const instance = new DeploymentModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('terminalOutput', '=', value)

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
