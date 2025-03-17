import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import { cache } from '@stacksjs/cache'
import { sql } from '@stacksjs/database'
import { ModelNotFoundException } from '@stacksjs/error-handling'
import { BaseOrm, DB, SubqueryBuilder } from '@stacksjs/orm'

export interface ProjectsTable {
  id: Generated<number>
  name: string
  description: string
  url: string
  status: string

  created_at?: Date

  updated_at?: Date

}

export interface ProjectResponse {
  data: ProjectJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface ProjectJsonResponse extends Omit<Selectable<ProjectsTable>, 'password'> {
  [key: string]: any
}

export type NewProject = Insertable<ProjectsTable>
export type ProjectUpdate = Updateable<ProjectsTable>

      type SortDirection = 'asc' | 'desc'
interface SortOptions { column: ProjectJsonResponse, order: SortDirection }
// Define a type for the options parameter
interface QueryOptions {
  sort?: SortOptions
  limit?: number
  offset?: number
  page?: number
}

export class ProjectModel extends BaseOrm<ProjectModel, ProjectsTable, ProjectJsonResponse> {
  private readonly hidden: Array<keyof ProjectJsonResponse> = []
  private readonly fillable: Array<keyof ProjectJsonResponse> = ['name', 'description', 'url', 'status', 'uuid']
  private readonly guarded: Array<keyof ProjectJsonResponse> = []
  protected attributes = {} as ProjectJsonResponse
  protected originalAttributes = {} as ProjectJsonResponse

  protected selectFromQuery: any
  protected updateFromQuery: any
  protected deleteFromQuery: any
  protected hasSelect: boolean
  private hasSaved: boolean
  private customColumns: Record<string, unknown> = {}

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
    this.hasSaved = false
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

  async mapCustomSetters(model: NewProject | ProjectUpdate): Promise<void> {
    const customSetter = {
      default: () => {
      },

    }

    for (const [key, fn] of Object.entries(customSetter)) {
      model[key] = await fn()
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

  get created_at(): Date | undefined {
    return this.attributes.created_at
  }

  get updated_at(): Date | undefined {
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

  set updated_at(value: Date) {
    this.attributes.updated_at = value
  }

  getOriginal(column?: keyof ProjectJsonResponse): Partial<ProjectJsonResponse> {
    if (column) {
      return this.originalAttributes[column]
    }

    return this.originalAttributes
  }

  getChanges(): Partial<ProjectJsonResponse> {
    return this.fillable.reduce<Partial<ProjectJsonResponse>>((changes, key) => {
      const currentValue = this.attributes[key as keyof ProjectsTable]
      const originalValue = this.originalAttributes[key as keyof ProjectsTable]

      if (currentValue !== originalValue) {
        changes[key] = currentValue
      }

      return changes
    }, {})
  }

  isDirty(column?: keyof ProjectJsonResponse): boolean {
    if (column) {
      return this.attributes[column] !== this.originalAttributes[column]
    }

    return Object.entries(this.originalAttributes).some(([key, originalValue]) => {
      const currentValue = (this.attributes as any)[key]

      return currentValue !== originalValue
    })
  }

  isClean(column?: keyof ProjectJsonResponse): boolean {
    return !this.isDirty(column)
  }

  wasChanged(column?: keyof ProjectJsonResponse): boolean {
    return this.hasSaved && this.isDirty(column)
  }

  static select(params: (keyof ProjectJsonResponse)[] | RawBuilder<string> | string): ProjectModel {
    const instance = new ProjectModel(undefined)

    return instance.applySelect(params)
  }

  // Method to find a Project by ID
  static async find(id: number): Promise<ProjectModel | undefined> {
    const instance = new ProjectModel(undefined)

    return await instance.applyFind(id)
  }

  async first(): Promise<ProjectModel | undefined> {
    const model = await this.applyFirst()

    const data = new ProjectModel(model)

    return data
  }

  static async first(): Promise<ProjectModel | undefined> {
    const instance = new ProjectModel(undefined)

    const model = await instance.applyFirst()

    const data = new ProjectModel(model)

    return data
  }

  async applyFirstOrFail(): Promise<ProjectModel | undefined> {
    const model = await this.selectFromQuery.executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, 'No ProjectModel results found for query')

    if (model) {
      this.mapCustomGetters(model)
      await this.loadRelations(model)
    }

    const data = new ProjectModel(model)

    return data
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

  async applyFindOrFail(id: number): Promise<ProjectModel> {
    const model = await DB.instance.selectFrom('projects').where('id', '=', id).selectAll().executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, `No ProjectModel results for ${id}`)

    cache.getOrSet(`project:${id}`, JSON.stringify(model))

    this.mapCustomGetters(model)
    await this.loadRelations(model)

    const data = new ProjectModel(model)

    return data
  }

  async findOrFail(id: number): Promise<ProjectModel> {
    return await this.applyFindOrFail(id)
  }

  static async findOrFail(id: number): Promise<ProjectModel> {
    const instance = new ProjectModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  static async findMany(ids: number[]): Promise<ProjectModel[]> {
    const instance = new ProjectModel(undefined)

    const models = await instance.applyFindMany(ids)

    return models.map((modelItem: UserJsonResponse) => instance.parseResult(new ProjectModel(modelItem)))
  }

  async findMany(ids: number[]): Promise<ProjectModel[]> {
    const models = await this.applyFindMany(ids)

    return models.map((modelItem: UserJsonResponse) => this.parseResult(new ProjectModel(modelItem)))
  }

  static skip(count: number): ProjectModel {
    const instance = new ProjectModel(undefined)

    return instance.applySkip(count)
  }

  async applyChunk(size: number, callback: (models: ProjectModel[]) => Promise<void>): Promise<void> {
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

  async chunk(size: number, callback: (models: ProjectModel[]) => Promise<void>): Promise<void> {
    await this.applyChunk(size, callback)
  }

  static async chunk(size: number, callback: (models: ProjectModel[]) => Promise<void>): Promise<void> {
    const instance = new ProjectModel(undefined)

    await instance.applyChunk(size, callback)
  }

  static take(count: number): ProjectModel {
    const instance = new ProjectModel(undefined)

    return instance.applyTake(count)
  }

  static async pluck<K extends keyof ProjectModel>(field: K): Promise<ProjectModel[K][]> {
    const instance = new ProjectModel(undefined)

    if (instance.hasSelect) {
      const model = await instance.selectFromQuery.execute()
      return model.map((modelItem: ProjectModel) => modelItem[field])
    }

    const model = await instance.selectFromQuery.selectAll().execute()

    return model.map((modelItem: ProjectModel) => modelItem[field])
  }

  async pluck<K extends keyof ProjectModel>(field: K): Promise<ProjectModel[K][]> {
    if (this.hasSelect) {
      const model = await this.selectFromQuery.execute()
      return model.map((modelItem: ProjectModel) => modelItem[field])
    }

    const model = await this.selectFromQuery.selectAll().execute()

    return model.map((modelItem: ProjectModel) => modelItem[field])
  }

  static async count(): Promise<number> {
    const instance = new ProjectModel(undefined)

    return instance.applyCount()
  }

  static async max(field: keyof ProjectModel): Promise<number> {
    const instance = new ProjectModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`MAX(${sql.raw(field as string)}) as max `)
      .executeTakeFirst()

    return result.max
  }

  async max(field: keyof ProjectModel): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`MAX(${sql.raw(field as string)}) as max`)
      .executeTakeFirst()

    return result.max
  }

  static async min(field: keyof ProjectModel): Promise<number> {
    const instance = new ProjectModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`MIN(${sql.raw(field as string)}) as min `)
      .executeTakeFirst()

    return result.min
  }

  async min(field: keyof ProjectModel): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`MIN(${sql.raw(field as string)}) as min `)
      .executeTakeFirst()

    return result.min
  }

  static async avg(field: keyof ProjectModel): Promise<number> {
    const instance = new ProjectModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`AVG(${sql.raw(field as string)}) as avg `)
      .executeTakeFirst()

    return result.avg
  }

  async avg(field: keyof ProjectModel): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`AVG(${sql.raw(field as string)}) as avg `)
      .executeTakeFirst()

    return result.avg
  }

  static async sum(field: keyof ProjectModel): Promise<number> {
    const instance = new ProjectModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`SUM(${sql.raw(field as string)}) as sum `)
      .executeTakeFirst()

    return result.sum
  }

  async sum(field: keyof ProjectModel): Promise<number> {
    const result = this.selectFromQuery
      .select(sql`SUM(${sql.raw(field as string)}) as sum `)
      .executeTakeFirst()

    return result.sum
  }

  async applyGet(): Promise<ProjectModel[]> {
    let models

    if (this.hasSelect) {
      models = await this.selectFromQuery.execute()
    }
    else {
      models = await this.selectFromQuery.selectAll().execute()
    }

    this.mapCustomGetters(models)
    await this.loadRelations(models)

    const data = await Promise.all(models.map(async (model: ProjectJsonResponse) => {
      return new ProjectModel(model)
    }))

    return data
  }

  async get(): Promise<ProjectModel[]> {
    return await this.applyGet()
  }

  static async get(): Promise<ProjectModel[]> {
    const instance = new ProjectModel(undefined)

    return await instance.applyGet()
  }

  has(relation: string): ProjectModel {
    this.selectFromQuery = this.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(
        selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.project_id`, '=', 'projects.id'),
      ),
    )

    return this
  }

  static has(relation: string): ProjectModel {
    const instance = new ProjectModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(
        selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.project_id`, '=', 'projects.id'),
      ),
    )

    return instance
  }

  static whereExists(callback: (qb: any) => any): ProjectModel {
    const instance = new ProjectModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(callback({ exists, selectFrom })),
    )

    return instance
  }

  applyWhereHas(
    relation: string,
    callback: (query: SubqueryBuilder<keyof ProjectModel>) => void,
  ): ProjectModel {
    const subqueryBuilder = new SubqueryBuilder()

    callback(subqueryBuilder)
    const conditions = subqueryBuilder.getConditions()

    this.selectFromQuery = this.selectFromQuery
      .where(({ exists, selectFrom }: any) => {
        let subquery = selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.project_id`, '=', 'projects.id')

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
    callback: (query: SubqueryBuilder<keyof ProjectModel>) => void,
  ): ProjectModel {
    return this.applyWhereHas(relation, callback)
  }

  static whereHas(
    relation: string,
    callback: (query: SubqueryBuilder<keyof ProjectModel>) => void,
  ): ProjectModel {
    const instance = new ProjectModel(undefined)

    return instance.applyWhereHas(relation, callback)
  }

  applyDoesntHave(relation: string): ProjectModel {
    this.selectFromQuery = this.selectFromQuery.where(({ not, exists, selectFrom }: any) =>
      not(
        exists(
          selectFrom(relation)
            .select('1')
            .whereRef(`${relation}.project_id`, '=', 'projects.id'),
        ),
      ),
    )

    return this
  }

  doesntHave(relation: string): ProjectModel {
    return this.applyDoesntHave(relation)
  }

  static doesntHave(relation: string): ProjectModel {
    const instance = new ProjectModel(undefined)

    return instance.applyDoesntHave(relation)
  }

  applyWhereDoesntHave(relation: string, callback: (query: SubqueryBuilder<ProjectsTable>) => void): ProjectModel {
    const subqueryBuilder = new SubqueryBuilder()

    callback(subqueryBuilder)
    const conditions = subqueryBuilder.getConditions()

    this.selectFromQuery = this.selectFromQuery
      .where(({ exists, selectFrom, not }: any) => {
        const subquery = selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.project_id`, '=', 'projects.id')

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

  whereDoesntHave(relation: string, callback: (query: SubqueryBuilder<ProjectsTable>) => void): ProjectModel {
    return this.applyWhereDoesntHave(relation, callback)
  }

  static whereDoesntHave(
    relation: string,
    callback: (query: SubqueryBuilder<ProjectsTable>) => void,
  ): ProjectModel {
    const instance = new ProjectModel(undefined)

    return instance.applyWhereDoesntHave(relation, callback)
  }

  async applyPaginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<ProjectResponse> {
    const totalRecordsResult = await DB.instance.selectFrom('projects')
      .select(DB.instance.fn.count('id').as('total')) // Use 'id' or another actual column name
      .executeTakeFirst()

    const totalRecords = Number(totalRecordsResult?.total) || 0
    const totalPages = Math.ceil(totalRecords / (options.limit ?? 10))

    const projectsWithExtra = await DB.instance.selectFrom('projects')
      .selectAll()
      .orderBy('id', 'asc') // Assuming 'id' is used for cursor-based pagination
      .limit((options.limit ?? 10) + 1) // Fetch one extra record
      .offset(((options.page ?? 1) - 1) * (options.limit ?? 10)) // Ensure options.page is not undefined
      .execute()

    let nextCursor = null
    if (projectsWithExtra.length > (options.limit ?? 10))
      nextCursor = projectsWithExtra.pop()?.id ?? null

    return {
      data: projectsWithExtra,
      paging: {
        total_records: totalRecords,
        page: options.page || 1,
        total_pages: totalPages,
      },
      next_cursor: nextCursor,
    }
  }

  async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<ProjectResponse> {
    return await this.applyPaginate(options)
  }

  // Method to get all projects
  static async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<ProjectResponse> {
    const instance = new ProjectModel(undefined)

    return await instance.applyPaginate(options)
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

    const model = await this.find(Number(result.numInsertedOrUpdatedRows)) as ProjectModel

    return model
  }

  async create(newProject: NewProject): Promise<ProjectModel> {
    return await this.applyCreate(newProject)
  }

  static async create(newProject: NewProject): Promise<ProjectModel> {
    const instance = new ProjectModel(undefined)

    return await instance.applyCreate(newProject)
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

    const model = await find(Number(result.numInsertedOrUpdatedRows)) as ProjectModel

    return model
  }

  // Method to remove a Project
  async delete(): Promise<ProjectsTable> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()

    return await DB.instance.deleteFrom('projects')
      .where('id', '=', this.id)
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

  distinct(column: keyof ProjectJsonResponse): ProjectModel {
    return this.applyDistinct(column)
  }

  static distinct(column: keyof ProjectJsonResponse): ProjectModel {
    const instance = new ProjectModel(undefined)

    return instance.applyDistinct(column)
  }

  join(table: string, firstCol: string, secondCol: string): ProjectModel {
    return this.applyJoin(table, firstCol, secondCol)
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
}

async function find(id: number): Promise<ProjectModel | undefined> {
  const query = DB.instance.selectFrom('projects').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  return new ProjectModel(model)
}

export async function count(): Promise<number> {
  const results = await ProjectModel.count()

  return results
}

export async function create(newProject: NewProject): Promise<ProjectModel> {
  const result = await DB.instance.insertInto('projects')
    .values(newProject)
    .executeTakeFirstOrThrow()

  return await find(Number(result.numInsertedOrUpdatedRows)) as ProjectModel
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
