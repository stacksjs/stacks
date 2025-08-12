import type { RawBuilder } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import type { NewProject, ProjectJsonResponse, ProjectsTable, ProjectUpdate } from '../types/ProjectType'
import { sql } from '@stacksjs/database'
import { HttpError } from '@stacksjs/error-handling'
import { DB } from '@stacksjs/orm'

import { BaseOrm } from '../utils/base'

export class ProjectModel extends BaseOrm<ProjectModel, ProjectsTable, ProjectJsonResponse> {
  private readonly hidden: Array<keyof ProjectJsonResponse> = []
  private readonly fillable: Array<keyof ProjectJsonResponse> = ['name', 'description', 'url', 'status']
  private readonly guarded: Array<keyof ProjectJsonResponse> = []
  protected attributes = {} as ProjectJsonResponse
  protected originalAttributes = {} as ProjectJsonResponse

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

  constructor(project: ProjectJsonResponse | undefined) {
    super('projects')
    if (project) {
      this.attributes = { ...project }
      this.originalAttributes = { ...project }

      Object.keys(project).forEach((key) => {
        if (!(key in this)) {
          this.customColumns[key] = (project as ProjectJsonResponse)[key]
        }
      })
    }

    this.withRelations = []
    this.selectFromQuery = DB.instance.selectFrom('projects')
    this.updateFromQuery = DB.instance.updateTable('projects')
    this.deleteFromQuery = DB.instance.deleteFrom('projects')
    this.hasSelect = false
  }

  protected async loadRelations(models: ProjectJsonResponse | ProjectJsonResponse[]): Promise<void> {
    // Handle both single model and array of models
    const modelArray = Array.isArray(models) ? models : [models]
    if (!modelArray.length)
      return

    const modelIds = modelArray.map(model => model.id)

    for (const relation of this.withRelations) {
      const relatedRecords = await DB.instance
        .selectFrom(relation)
        .where('project_id', 'in', modelIds)
        .selectAll()
        .execute()

      if (Array.isArray(models)) {
        models.map((model: ProjectJsonResponse) => {
          const records = relatedRecords.filter((record: { project_id: number }) => {
            return record.project_id === model.id
          })

          model[relation] = records.length === 1 ? records[0] : records
          return model
        })
      }
      else {
        const records = relatedRecords.filter((record: { project_id: number }) => {
          return record.project_id === models.id
        })

        models[relation] = records.length === 1 ? records[0] : records
      }
    }
  }

  static with(relations: string[]): ProjectModel {
    const instance = new ProjectModel(undefined)

    return instance.applyWith(relations)
  }

  protected mapCustomGetters(models: ProjectJsonResponse | ProjectJsonResponse[]): void {
    const data = models

    if (Array.isArray(data)) {
      data.map((model: ProjectJsonResponse) => {
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

  async mapCustomSetters(model: NewProject): Promise<void> {
    const customSetter = {
      default: () => {
      },

    }

    for (const [key, fn] of Object.entries(customSetter)) {
      (model as any)[key] = await fn()
    }
  }

  get id(): number {
    return this.attributes.id
  }

  get name(): string {
    return this.attributes.name
  }

  get description(): string {
    return this.attributes.description
  }

  get url(): string {
    return this.attributes.url
  }

  get status(): string {
    return this.attributes.status
  }

  get created_at(): string | undefined {
    return this.attributes.created_at
  }

  get updated_at(): string | undefined {
    return this.attributes.updated_at
  }

  set name(value: string) {
    this.attributes.name = value
  }

  set description(value: string) {
    this.attributes.description = value
  }

  set url(value: string) {
    this.attributes.url = value
  }

  set status(value: string) {
    this.attributes.status = value
  }

  set updated_at(value: string) {
    this.attributes.updated_at = value
  }

  static select(params: (keyof ProjectJsonResponse)[] | RawBuilder<string> | string): ProjectModel {
    const instance = new ProjectModel(undefined)

    return instance.applySelect(params)
  }

  // Method to find a Project by ID
  static async find(id: number): Promise<ProjectModel | undefined> {
    const query = DB.instance.selectFrom('projects').where('id', '=', id).selectAll()

    const model = await query.executeTakeFirst()

    if (!model)
      return undefined

    const instance = new ProjectModel(undefined)
    return instance.createInstance(model)
  }

  static async first(): Promise<ProjectModel | undefined> {
    const instance = new ProjectModel(undefined)

    const model = await instance.applyFirst()

    const data = new ProjectModel(model)

    return data
  }

  static async last(): Promise<ProjectModel | undefined> {
    const instance = new ProjectModel(undefined)

    const model = await instance.applyLast()

    if (!model)
      return undefined

    return new ProjectModel(model)
  }

  static async firstOrFail(): Promise<ProjectModel | undefined> {
    const instance = new ProjectModel(undefined)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<ProjectModel[]> {
    const instance = new ProjectModel(undefined)

    const models = await DB.instance.selectFrom('projects').selectAll().execute()

    instance.mapCustomGetters(models)

    const data = await Promise.all(models.map(async (model: ProjectJsonResponse) => {
      return new ProjectModel(model)
    }))

    return data
  }

  static async findOrFail(id: number): Promise<ProjectModel | undefined> {
    const instance = new ProjectModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  static async findMany(ids: number[]): Promise<ProjectModel[]> {
    const instance = new ProjectModel(undefined)

    const models = await instance.applyFindMany(ids)

    return models.map((modelItem: ProjectJsonResponse) => instance.parseResult(new ProjectModel(modelItem)))
  }

  static async latest(column: keyof ProjectsTable = 'created_at'): Promise<ProjectModel | undefined> {
    const instance = new ProjectModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'desc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new ProjectModel(model)
  }

  static async oldest(column: keyof ProjectsTable = 'created_at'): Promise<ProjectModel | undefined> {
    const instance = new ProjectModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'asc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new ProjectModel(model)
  }

  static skip(count: number): ProjectModel {
    const instance = new ProjectModel(undefined)

    return instance.applySkip(count)
  }

  static take(count: number): ProjectModel {
    const instance = new ProjectModel(undefined)

    return instance.applyTake(count)
  }

  static where<V = string>(column: keyof ProjectsTable, ...args: [V] | [Operator, V]): ProjectModel {
    const instance = new ProjectModel(undefined)

    return instance.applyWhere<V>(column, ...args)
  }

  static orWhere(...conditions: [string, any][]): ProjectModel {
    const instance = new ProjectModel(undefined)

    return instance.applyOrWhere(...conditions)
  }

  static whereNotIn<V = number>(column: keyof ProjectsTable, values: V[]): ProjectModel {
    const instance = new ProjectModel(undefined)

    return instance.applyWhereNotIn<V>(column, values)
  }

  static whereBetween<V = number>(column: keyof ProjectsTable, range: [V, V]): ProjectModel {
    const instance = new ProjectModel(undefined)

    return instance.applyWhereBetween<V>(column, range)
  }

  static whereRef(column: keyof ProjectsTable, ...args: string[]): ProjectModel {
    const instance = new ProjectModel(undefined)

    return instance.applyWhereRef(column, ...args)
  }

  static when(condition: boolean, callback: (query: ProjectModel) => ProjectModel): ProjectModel {
    const instance = new ProjectModel(undefined)

    return instance.applyWhen(condition, callback as any)
  }

  static whereNull(column: keyof ProjectsTable): ProjectModel {
    const instance = new ProjectModel(undefined)

    return instance.applyWhereNull(column)
  }

  static whereNotNull(column: keyof ProjectsTable): ProjectModel {
    const instance = new ProjectModel(undefined)

    return instance.applyWhereNotNull(column)
  }

  static whereLike(column: keyof ProjectsTable, value: string): ProjectModel {
    const instance = new ProjectModel(undefined)

    return instance.applyWhereLike(column, value)
  }

  static orderBy(column: keyof ProjectsTable, order: 'asc' | 'desc'): ProjectModel {
    const instance = new ProjectModel(undefined)

    return instance.applyOrderBy(column, order)
  }

  static orderByAsc(column: keyof ProjectsTable): ProjectModel {
    const instance = new ProjectModel(undefined)

    return instance.applyOrderByAsc(column)
  }

  static orderByDesc(column: keyof ProjectsTable): ProjectModel {
    const instance = new ProjectModel(undefined)

    return instance.applyOrderByDesc(column)
  }

  static groupBy(column: keyof ProjectsTable): ProjectModel {
    const instance = new ProjectModel(undefined)

    return instance.applyGroupBy(column)
  }

  static having<V = string>(column: keyof ProjectsTable, operator: Operator, value: V): ProjectModel {
    const instance = new ProjectModel(undefined)

    return instance.applyHaving<V>(column, operator, value)
  }

  static inRandomOrder(): ProjectModel {
    const instance = new ProjectModel(undefined)

    return instance.applyInRandomOrder()
  }

  static whereColumn(first: keyof ProjectsTable, operator: Operator, second: keyof ProjectsTable): ProjectModel {
    const instance = new ProjectModel(undefined)

    return instance.applyWhereColumn(first, operator, second)
  }

  static async max(field: keyof ProjectsTable): Promise<number> {
    const instance = new ProjectModel(undefined)

    return await instance.applyMax(field)
  }

  static async min(field: keyof ProjectsTable): Promise<number> {
    const instance = new ProjectModel(undefined)

    return await instance.applyMin(field)
  }

  static async avg(field: keyof ProjectsTable): Promise<number> {
    const instance = new ProjectModel(undefined)

    return await instance.applyAvg(field)
  }

  static async sum(field: keyof ProjectsTable): Promise<number> {
    const instance = new ProjectModel(undefined)

    return await instance.applySum(field)
  }

  static async count(): Promise<number> {
    const instance = new ProjectModel(undefined)

    return instance.applyCount()
  }

  static async get(): Promise<ProjectModel[]> {
    const instance = new ProjectModel(undefined)

    const results = await instance.applyGet()

    return results.map((item: ProjectJsonResponse) => instance.createInstance(item))
  }

  static async pluck<K extends keyof ProjectModel>(field: K): Promise<ProjectModel[K][]> {
    const instance = new ProjectModel(undefined)

    return await instance.applyPluck(field)
  }

  static async chunk(size: number, callback: (models: ProjectModel[]) => Promise<void>): Promise<void> {
    const instance = new ProjectModel(undefined)

    await instance.applyChunk(size, async (models) => {
      const modelInstances = models.map((item: ProjectJsonResponse) => instance.createInstance(item))
      await callback(modelInstances)
    })
  }

  static async paginate(options: { limit?: number, offset?: number, page?: number } = { limit: 10, offset: 0, page: 1 }): Promise<{
    data: ProjectModel[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }> {
    const instance = new ProjectModel(undefined)

    const result = await instance.applyPaginate(options)

    return {
      data: result.data.map((item: ProjectJsonResponse) => instance.createInstance(item)),
      paging: result.paging,
      next_cursor: result.next_cursor,
    }
  }

  // Instance method for creating model instances
  createInstance(data: ProjectJsonResponse): ProjectModel {
    return new ProjectModel(data)
  }

  async applyCreate(newProject: NewProject): Promise<ProjectModel> {
    const filteredValues = Object.fromEntries(
      Object.entries(newProject).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewProject

    await this.mapCustomSetters(filteredValues)

    const result = await DB.instance.insertInto('projects')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await DB.instance.selectFrom('projects')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created Project')
    }

    return this.createInstance(model)
  }

  async create(newProject: NewProject): Promise<ProjectModel> {
    return await this.applyCreate(newProject)
  }

  static async create(newProject: NewProject): Promise<ProjectModel> {
    const instance = new ProjectModel(undefined)
    return await instance.applyCreate(newProject)
  }

  static async firstOrCreate(search: Partial<ProjectsTable>, values: NewProject = {} as NewProject): Promise<ProjectModel> {
    // First try to find a record matching the search criteria
    const instance = new ProjectModel(undefined)

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
    const createData = { ...search, ...values } as NewProject
    return await ProjectModel.create(createData)
  }

  static async updateOrCreate(search: Partial<ProjectsTable>, values: NewProject = {} as NewProject): Promise<ProjectModel> {
    // First try to find a record matching the search criteria
    const instance = new ProjectModel(undefined)

    // Apply all search conditions
    for (const [key, value] of Object.entries(search)) {
      instance.selectFromQuery = instance.selectFromQuery.where(key, '=', value)
    }

    // Try to find the record
    const existingRecord = await instance.applyFirst()

    if (existingRecord) {
      // If record exists, update it with the new values
      const model = instance.createInstance(existingRecord)
      const updatedModel = await model.update(values as ProjectUpdate)

      // Return the updated model instance
      if (updatedModel) {
        return updatedModel
      }

      // If update didn't return a model, fetch it again to ensure we have latest data
      const refreshedModel = await instance.applyFirst()
      return instance.createInstance(refreshedModel!)
    }

    // If no record exists, create a new one with combined search criteria and values
    const createData = { ...search, ...values } as NewProject
    return await ProjectModel.create(createData)
  }

  async update(newProject: ProjectUpdate): Promise<ProjectModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newProject).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as ProjectUpdate

    await this.mapCustomSetters(filteredValues)

    filteredValues.updated_at = new Date().toISOString()

    await DB.instance.updateTable('projects')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('projects')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated Project')
      }

      return this.createInstance(model)
    }

    return undefined
  }

  async forceUpdate(newProject: ProjectUpdate): Promise<ProjectModel | undefined> {
    await DB.instance.updateTable('projects')
      .set(newProject)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('projects')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated Project')
      }

      return this.createInstance(model)
    }

    return undefined
  }

  async save(): Promise<ProjectModel> {
    // If the model has an ID, update it; otherwise, create a new record
    if (this.id) {
      // Update existing record
      await DB.instance.updateTable('projects')
        .set(this.attributes as ProjectUpdate)
        .where('id', '=', this.id)
        .executeTakeFirst()

      // Get the updated data
      const model = await DB.instance.selectFrom('projects')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated Project')
      }

      return this.createInstance(model)
    }
    else {
      // Create new record
      const result = await DB.instance.insertInto('projects')
        .values(this.attributes as NewProject)
        .executeTakeFirst()

      // Get the created data
      const model = await DB.instance.selectFrom('projects')
        .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve created Project')
      }

      return this.createInstance(model)
    }
  }

  static async createMany(newProject: NewProject[]): Promise<void> {
    const instance = new ProjectModel(undefined)

    const valuesFiltered = newProject.map((newProject: NewProject) => {
      const filteredValues = Object.fromEntries(
        Object.entries(newProject).filter(([key]) =>
          !instance.guarded.includes(key) && instance.fillable.includes(key),
        ),
      ) as NewProject

      return filteredValues
    })

    await DB.instance.insertInto('projects')
      .values(valuesFiltered)
      .executeTakeFirst()
  }

  static async forceCreate(newProject: NewProject): Promise<ProjectModel> {
    const result = await DB.instance.insertInto('projects')
      .values(newProject)
      .executeTakeFirst()

    const instance = new ProjectModel(undefined)
    const model = await DB.instance.selectFrom('projects')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created Project')
    }

    return instance.createInstance(model)
  }

  // Method to remove a Project
  async delete(): Promise<number> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()

    const deleted = await DB.instance.deleteFrom('projects')
      .where('id', '=', this.id)
      .execute()

    return deleted.numDeletedRows
  }

  static async remove(id: number): Promise<any> {
    return await DB.instance.deleteFrom('projects')
      .where('id', '=', id)
      .execute()
  }

  static whereName(value: string): ProjectModel {
    const instance = new ProjectModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('name', '=', value)

    return instance
  }

  static whereDescription(value: string): ProjectModel {
    const instance = new ProjectModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('description', '=', value)

    return instance
  }

  static whereUrl(value: string): ProjectModel {
    const instance = new ProjectModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('url', '=', value)

    return instance
  }

  static whereStatus(value: string): ProjectModel {
    const instance = new ProjectModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('status', '=', value)

    return instance
  }

  static whereIn<V = number>(column: keyof ProjectsTable, values: V[]): ProjectModel {
    const instance = new ProjectModel(undefined)

    return instance.applyWhereIn<V>(column, values)
  }

  static distinct(column: keyof ProjectJsonResponse): ProjectModel {
    const instance = new ProjectModel(undefined)

    return instance.applyDistinct(column)
  }

  static join(table: string, firstCol: string, secondCol: string): ProjectModel {
    const instance = new ProjectModel(undefined)

    return instance.applyJoin(table, firstCol, secondCol)
  }

  toJSON(): ProjectJsonResponse {
    const output = {

      id: this.id,
      name: this.name,
      description: this.description,
      url: this.url,
      status: this.status,

      created_at: this.created_at,

      updated_at: this.updated_at,

      ...this.customColumns,
    }

    return output
  }

  parseResult(model: ProjectModel): ProjectModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof ProjectModel]
    }

    return model
  }

  // Add a protected applyFind implementation
  protected async applyFind(id: number): Promise<ProjectModel | undefined> {
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

export async function find(id: number): Promise<ProjectModel | undefined> {
  const query = DB.instance.selectFrom('projects').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  const instance = new ProjectModel(undefined)
  return instance.createInstance(model)
}

export async function count(): Promise<number> {
  const results = await ProjectModel.count()

  return results
}

export async function create(newProject: NewProject): Promise<ProjectModel> {
  const instance = new ProjectModel(undefined)
  return await instance.applyCreate(newProject)
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(DB.instance)
}

export async function remove(id: number): Promise<void> {
  await DB.instance.deleteFrom('projects')
    .where('id', '=', id)
    .execute()
}

export async function whereName(value: string): Promise<ProjectModel[]> {
  const query = DB.instance.selectFrom('projects').where('name', '=', value)
  const results: ProjectJsonResponse = await query.execute()

  return results.map((modelItem: ProjectJsonResponse) => new ProjectModel(modelItem))
}

export async function whereDescription(value: string): Promise<ProjectModel[]> {
  const query = DB.instance.selectFrom('projects').where('description', '=', value)
  const results: ProjectJsonResponse = await query.execute()

  return results.map((modelItem: ProjectJsonResponse) => new ProjectModel(modelItem))
}

export async function whereUrl(value: string): Promise<ProjectModel[]> {
  const query = DB.instance.selectFrom('projects').where('url', '=', value)
  const results: ProjectJsonResponse = await query.execute()

  return results.map((modelItem: ProjectJsonResponse) => new ProjectModel(modelItem))
}

export async function whereStatus(value: string): Promise<ProjectModel[]> {
  const query = DB.instance.selectFrom('projects').where('status', '=', value)
  const results: ProjectJsonResponse = await query.execute()

  return results.map((modelItem: ProjectJsonResponse) => new ProjectModel(modelItem))
}

export const Project = ProjectModel

export default Project
