import type { Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import { cache } from '@stacksjs/cache'
import { db, sql } from '@stacksjs/database'
import { HttpError, ModelNotFoundException } from '@stacksjs/error-handling'
import { SubqueryBuilder } from '@stacksjs/orm'

export interface ProjectsTable {
  id?: number
  name?: string
  description?: string
  url?: string
  status?: string

  created_at?: Date

  updated_at?: Date

}

interface ProjectResponse {
  data: ProjectJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface ProjectJsonResponse extends Omit<ProjectsTable, 'password'> {
  [key: string]: any
}

export type ProjectType = Selectable<ProjectsTable>
export type NewProject = Partial<Insertable<ProjectsTable>>
export type ProjectUpdate = Updateable<ProjectsTable>

      type SortDirection = 'asc' | 'desc'
interface SortOptions { column: ProjectType, order: SortDirection }
// Define a type for the options parameter
interface QueryOptions {
  sort?: SortOptions
  limit?: number
  offset?: number
  page?: number
}

export class ProjectModel {
  private readonly hidden: Array<keyof ProjectJsonResponse> = []
  private readonly fillable: Array<keyof ProjectJsonResponse> = ['name', 'description', 'url', 'status', 'uuid']

  protected selectFromQuery: any
  protected withRelations: string[]
  protected updateFromQuery: any
  protected deleteFromQuery: any
  protected hasSelect: boolean
  private customColumns: Record<string, unknown> = {}
  public id: number | undefined
  public name: string | undefined
  public description: string | undefined
  public url: string | undefined
  public status: string | undefined

  public created_at: Date | undefined
  public updated_at: Date | undefined

  constructor(project: Partial<ProjectType> | null) {
    if (project) {
      this.id = project?.id || 1
      this.name = project?.name
      this.description = project?.description
      this.url = project?.url
      this.status = project?.status

      this.created_at = project?.created_at

      this.updated_at = project?.updated_at

      Object.keys(project).forEach((key) => {
        if (!(key in this)) {
          this.customColumns[key] = (project as ProjectJsonResponse)[key]
        }
      })
    }

    this.withRelations = []
    this.selectFromQuery = db.selectFrom('projects')
    this.updateFromQuery = db.updateTable('projects')
    this.deleteFromQuery = db.deleteFrom('projects')
    this.hasSelect = false
  }

  select(params: (keyof ProjectType)[] | RawBuilder<string> | string): ProjectModel {
    this.selectFromQuery = this.selectFromQuery.select(params)

    this.hasSelect = true

    return this
  }

  static select(params: (keyof ProjectType)[] | RawBuilder<string> | string): ProjectModel {
    const instance = new ProjectModel(null)

    // Initialize a query with the table name and selected fields
    instance.selectFromQuery = instance.selectFromQuery.select(params)

    instance.hasSelect = true

    return instance
  }

  async find(id: number): Promise<ProjectModel | undefined> {
    return ProjectModel.find(id)
  }

  // Method to find a Project by ID
  static async find(id: number): Promise<ProjectModel | undefined> {
    const model = await db.selectFrom('projects').where('id', '=', id).selectAll().executeTakeFirst()

    if (!model)
      return undefined

    const instance = new ProjectModel(null)

    const result = await instance.mapWith(model)

    const data = new ProjectModel(result as ProjectType)

    cache.getOrSet(`project:${id}`, JSON.stringify(model))

    return data
  }

  async first(): Promise<ProjectModel | undefined> {
    return ProjectModel.first()
  }

  static async first(): Promise<ProjectType | undefined> {
    const model = await db.selectFrom('projects')
      .selectAll()
      .executeTakeFirst()

    if (!model)
      return undefined

    const instance = new ProjectModel(null)

    const result = await instance.mapWith(model)

    const data = new ProjectModel(result as ProjectType)

    return data
  }

  async firstOrFail(): Promise<ProjectModel | undefined> {
    return this.firstOrFail()
  }

  static async firstOrFail(): Promise<ProjectModel | undefined> {
    const instance = new ProjectModel(null)

    const model = await instance.selectFromQuery.executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, 'No ProjectModel results found for query')

    const result = await instance.mapWith(model)

    const data = new ProjectModel(result as ProjectType)

    return data
  }

  async mapWith(model: ProjectType): Promise<ProjectType> {
    return model
  }

  static async all(): Promise<ProjectModel[]> {
    const models = await db.selectFrom('projects').selectAll().execute()

    const data = await Promise.all(models.map(async (model: ProjectType) => {
      const instance = new ProjectModel(model)

      const results = await instance.mapWith(model)

      return new ProjectModel(results)
    }))

    return data
  }

  async findOrFail(id: number): Promise<ProjectModel> {
    return ProjectModel.findOrFail(id)
  }

  static async findOrFail(id: number): Promise<ProjectModel> {
    const model = await db.selectFrom('projects').where('id', '=', id).selectAll().executeTakeFirst()

    const instance = new ProjectModel(null)

    if (model === undefined)
      throw new ModelNotFoundException(404, `No ProjectModel results for ${id}`)

    cache.getOrSet(`project:${id}`, JSON.stringify(model))

    const result = await instance.mapWith(model)

    const data = new ProjectModel(result as ProjectType)

    return data
  }

  static async findMany(ids: number[]): Promise<ProjectModel[]> {
    let query = db.selectFrom('projects').where('id', 'in', ids)

    const instance = new ProjectModel(null)

    query = query.selectAll()

    const model = await query.execute()

    return model.map(modelItem => instance.parseResult(new ProjectModel(modelItem)))
  }

  skip(count: number): ProjectModel {
    return ProjectModel.skip(count)
  }

  static skip(count: number): ProjectModel {
    const instance = new ProjectModel(null)

    instance.selectFromQuery = instance.selectFromQuery.offset(count)

    return instance
  }

  take(count: number): ProjectModel {
    return ProjectModel.take(count)
  }

  static take(count: number): ProjectModel {
    const instance = new ProjectModel(null)

    instance.selectFromQuery = instance.selectFromQuery.limit(count)

    return instance
  }

  static async pluck<K extends keyof ProjectModel>(field: K): Promise<ProjectModel[K][]> {
    const instance = new ProjectModel(null)

    if (instance.hasSelect) {
      const model = await instance.selectFromQuery.execute()
      return model.map((modelItem: ProjectModel) => modelItem[field])
    }

    const model = await instance.selectFromQuery.selectAll().execute()

    return model.map((modelItem: ProjectModel) => modelItem[field])
  }

  async pluck<K extends keyof ProjectModel>(field: K): Promise<ProjectModel[K][]> {
    return ProjectModel.pluck(field)
  }

  static async count(): Promise<number> {
    const instance = new ProjectModel(null)

    return instance.selectFromQuery
      .select(sql`COUNT(*) as count`)
      .executeTakeFirst()
  }

  async count(): Promise<number> {
    return ProjectModel.count()
  }

  async max(field: keyof ProjectModel): Promise<number> {
    return await this.selectFromQuery
      .select(sql`MAX(${sql.raw(field as string)}) `)
      .executeTakeFirst()
  }

  async min(field: keyof ProjectModel): Promise<number> {
    return await this.selectFromQuery
      .select(sql`MIN(${sql.raw(field as string)}) `)
      .executeTakeFirst()
  }

  async avg(field: keyof ProjectModel): Promise<number> {
    return this.selectFromQuery
      .select(sql`AVG(${sql.raw(field as string)})`)
      .executeTakeFirst()
  }

  async sum(field: keyof ProjectModel): Promise<number> {
    return this.selectFromQuery
      .select(sql`SUM(${sql.raw(field as string)})`)
      .executeTakeFirst()
  }

  async get(): Promise<ProjectModel[]> {
    return ProjectModel.get()
  }

  static async get(): Promise<ProjectModel[]> {
    const instance = new ProjectModel(null)

    let models

    if (instance.hasSelect) {
      models = await instance.selectFromQuery.execute()
    }
    else {
      models = await instance.selectFromQuery.selectAll().execute()
    }

    const data = await Promise.all(models.map(async (model: ProjectModel) => {
      const instance = new ProjectModel(model)

      const results = await instance.mapWith(model)

      return new ProjectModel(results)
    }))

    return data
  }

  has(relation: string): ProjectModel {
    return ProjectModel.has(relation)
  }

  static has(relation: string): ProjectModel {
    const instance = new ProjectModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(
        selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.project_id`, '=', 'projects.id'),
      ),
    )

    return instance
  }

  whereHas(
    relation: string,
    callback: (query: SubqueryBuilder) => void,
  ): ProjectModel {
    return ProjectModel.whereHas(relation, callback)
  }

  static whereHas(
    relation: string,
    callback: (query: SubqueryBuilder) => void,
  ): ProjectModel {
    const instance = new ProjectModel(null)
    const subqueryBuilder = new SubqueryBuilder()

    callback(subqueryBuilder)
    const conditions = subqueryBuilder.getConditions()

    instance.selectFromQuery = instance.selectFromQuery
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

  static doesntHave(relation: string): ProjectModel {
    const instance = new ProjectModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where(({ not, exists, selectFrom }: any) =>
      not(
        exists(
          selectFrom(relation)
            .select('1')
            .whereRef(`${relation}.project_id`, '=', 'projects.id'),
        ),
      ),
    )

    return instance
  }

  async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<ProjectResponse> {
    return ProjectModel.paginate(options)
  }

  // Method to get all projects
  static async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<ProjectResponse> {
    const totalRecordsResult = await db.selectFrom('projects')
      .select(db.fn.count('id').as('total')) // Use 'id' or another actual column name
      .executeTakeFirst()

    const totalRecords = Number(totalRecordsResult?.total) || 0
    const totalPages = Math.ceil(totalRecords / (options.limit ?? 10))

    const projectsWithExtra = await db.selectFrom('projects')
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

  // Method to create a new project
  static async create(newProject: NewProject): Promise<ProjectModel> {
    const instance = new ProjectModel(null)

    const filteredValues = Object.fromEntries(
      Object.entries(newProject).filter(([key]) => instance.fillable.includes(key)),
    ) as NewProject

    const result = await db.insertInto('projects')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await find(Number(result.numInsertedOrUpdatedRows)) as ProjectModel

    return model
  }

  static async createMany(newProjects: NewProject[]): Promise<void> {
    const instance = new ProjectModel(null)

    const filteredValues = newProjects.map(newUser =>
      Object.fromEntries(
        Object.entries(newUser).filter(([key]) => instance.fillable.includes(key)),
      ) as NewProject,
    )

    await db.insertInto('projects')
      .values(filteredValues)
      .executeTakeFirst()
  }

  static async forceCreate(newProject: NewProject): Promise<ProjectModel> {
    const result = await db.insertInto('projects')
      .values(newProject)
      .executeTakeFirst()

    const model = await find(Number(result.numInsertedOrUpdatedRows)) as ProjectModel

    return model
  }

  // Method to remove a Project
  static async remove(id: number): Promise<any> {
    return await db.deleteFrom('projects')
      .where('id', '=', id)
      .execute()
  }

  private static applyWhere(instance: ProjectModel, column: string, operator: string, value: any): ProjectModel {
    instance.selectFromQuery = instance.selectFromQuery.where(column, operator, value)
    instance.updateFromQuery = instance.updateFromQuery.where(column, operator, value)
    instance.deleteFromQuery = instance.deleteFromQuery.where(column, operator, value)

    return instance
  }

  where(column: string, operator: string, value: any): ProjectModel {
    return ProjectModel.applyWhere(this, column, operator, value)
  }

  static where(column: string, operator: string, value: any): ProjectModel {
    const instance = new ProjectModel(null)

    return ProjectModel.applyWhere(instance, column, operator, value)
  }

  whereRef(column: string, operator: string, value: string): ProjectModel {
    return ProjectModel.whereRef(column, operator, value)
  }

  static whereRef(column: string, operator: string, value: string): ProjectModel {
    const instance = new ProjectModel(null)

    instance.selectFromQuery = instance.selectFromQuery.whereRef(column, operator, value)

    return instance
  }

  orWhere(...args: Array<[string, string, any]>): ProjectModel {
    return ProjectModel.orWhere(...args)
  }

  static orWhere(...args: Array<[string, string, any]>): ProjectModel {
    const instance = new ProjectModel(null)

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
    callback: (query: ProjectModel) => ProjectModel,
  ): ProjectModel {
    return ProjectModel.when(condition, callback)
  }

  static when(
    condition: boolean,
    callback: (query: ProjectModel) => ProjectModel,
  ): ProjectModel {
    let instance = new ProjectModel(null)

    if (condition)
      instance = callback(instance)

    return instance
  }

  whereNull(column: string): ProjectModel {
    return ProjectModel.whereNull(column)
  }

  static whereNull(column: string): ProjectModel {
    const instance = new ProjectModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    instance.updateFromQuery = instance.updateFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    return instance
  }

  static whereName(value: string): ProjectModel {
    const instance = new ProjectModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('name', '=', value)

    return instance
  }

  static whereDescription(value: string): ProjectModel {
    const instance = new ProjectModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('description', '=', value)

    return instance
  }

  static whereUrl(value: string): ProjectModel {
    const instance = new ProjectModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('url', '=', value)

    return instance
  }

  static whereStatus(value: string): ProjectModel {
    const instance = new ProjectModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('status', '=', value)

    return instance
  }

  whereIn(column: keyof ProjectType, values: any[]): ProjectModel {
    return ProjectModel.whereIn(column, values)
  }

  static whereIn(column: keyof ProjectType, values: any[]): ProjectModel {
    const instance = new ProjectModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where(column, 'in', values)

    instance.updateFromQuery = instance.updateFromQuery.where(column, 'in', values)

    instance.deleteFromQuery = instance.deleteFromQuery.where(column, 'in', values)

    return instance
  }

  whereBetween(column: keyof ProjectType, range: [any, any]): ProjectModel {
    return ProjectModel.whereBetween(column, range)
  }

  static whereBetween(column: keyof ProjectType, range: [any, any]): ProjectModel {
    if (range.length !== 2) {
      throw new HttpError(500, 'Range must have exactly two values: [min, max]')
    }

    const instance = new ProjectModel(null)

    const query = sql` ${sql.raw(column as string)} between ${range[0]} and ${range[1]} `

    instance.selectFromQuery = instance.selectFromQuery.where(query)
    instance.updateFromQuery = instance.updateFromQuery.where(query)
    instance.deleteFromQuery = instance.deleteFromQuery.where(query)

    return instance
  }

  whereNotIn(column: keyof ProjectType, values: any[]): ProjectModel {
    return ProjectModel.whereNotIn(column, values)
  }

  static whereNotIn(column: keyof ProjectType, values: any[]): ProjectModel {
    const instance = new ProjectModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where(column, 'not in', values)

    instance.updateFromQuery = instance.updateFromQuery.where(column, 'not in', values)

    instance.deleteFromQuery = instance.deleteFromQuery.where(column, 'not in', values)

    return instance
  }

  async exists(): Promise<boolean> {
    const model = await this.selectFromQuery.executeTakeFirst()

    return model !== null || model !== undefined
  }

  static async latest(): Promise<ProjectType | undefined> {
    const model = await db.selectFrom('projects')
      .selectAll()
      .orderBy('created_at', 'desc')
      .executeTakeFirst()

    if (!model)
      return undefined

    const instance = new ProjectModel(null)
    const result = await instance.mapWith(model)
    const data = new ProjectModel(result as ProjectType)

    return data
  }

  static async oldest(): Promise<ProjectType | undefined> {
    const model = await db.selectFrom('projects')
      .selectAll()
      .orderBy('created_at', 'asc')
      .executeTakeFirst()

    if (!model)
      return undefined

    const instance = new ProjectModel(null)
    const result = await instance.mapWith(model)
    const data = new ProjectModel(result as ProjectType)

    return data
  }

  static async firstOrCreate(
    condition: Partial<ProjectType>,
    newProject: NewProject,
  ): Promise<ProjectModel> {
    // Get the key and value from the condition object
    const key = Object.keys(condition)[0] as keyof ProjectType

    if (!key) {
      throw new HttpError(500, 'Condition must contain at least one key-value pair')
    }

    const value = condition[key]

    // Attempt to find the first record matching the condition
    const existingProject = await db.selectFrom('projects')
      .selectAll()
      .where(key, '=', value)
      .executeTakeFirst()

    if (existingProject) {
      const instance = new ProjectModel(null)
      const result = await instance.mapWith(existingProject)
      return new ProjectModel(result as ProjectType)
    }
    else {
      // If not found, create a new user
      return await this.create(newProject)
    }
  }

  static async updateOrCreate(
    condition: Partial<ProjectType>,
    newProject: NewProject,
  ): Promise<ProjectModel> {
    const key = Object.keys(condition)[0] as keyof ProjectType

    if (!key) {
      throw new HttpError(500, 'Condition must contain at least one key-value pair')
    }

    const value = condition[key]

    // Attempt to find the first record matching the condition
    const existingProject = await db.selectFrom('projects')
      .selectAll()
      .where(key, '=', value)
      .executeTakeFirst()

    if (existingProject) {
      // If found, update the existing record
      await db.updateTable('projects')
        .set(newProject)
        .where(key, '=', value)
        .executeTakeFirstOrThrow()

      // Fetch and return the updated record
      const updatedProject = await db.selectFrom('projects')
        .selectAll()
        .where(key, '=', value)
        .executeTakeFirst()

      if (!updatedProject) {
        throw new HttpError(500, 'Failed to fetch updated record')
      }

      const instance = new ProjectModel(null)
      const result = await instance.mapWith(updatedProject)
      return new ProjectModel(result as ProjectType)
    }
    else {
      // If not found, create a new record
      return await this.create(newProject)
    }
  }

  with(relations: string[]): ProjectModel {
    return ProjectModel.with(relations)
  }

  static with(relations: string[]): ProjectModel {
    const instance = new ProjectModel(null)

    instance.withRelations = relations

    return instance
  }

  async last(): Promise<ProjectType | undefined> {
    return await db.selectFrom('projects')
      .selectAll()
      .orderBy('id', 'desc')
      .executeTakeFirst()
  }

  static async last(): Promise<ProjectType | undefined> {
    const model = await db.selectFrom('projects').selectAll().orderBy('id', 'desc').executeTakeFirst()

    if (!model)
      return undefined

    const instance = new ProjectModel(null)

    const result = await instance.mapWith(model)

    const data = new ProjectModel(result as ProjectType)

    return data
  }

  orderBy(column: keyof ProjectType, order: 'asc' | 'desc'): ProjectModel {
    return ProjectModel.orderBy(column, order)
  }

  static orderBy(column: keyof ProjectType, order: 'asc' | 'desc'): ProjectModel {
    const instance = new ProjectModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, order)

    return instance
  }

  groupBy(column: keyof ProjectType): ProjectModel {
    return ProjectModel.groupBy(column)
  }

  static groupBy(column: keyof ProjectType): ProjectModel {
    const instance = new ProjectModel(null)

    instance.selectFromQuery = instance.selectFromQuery.groupBy(column)

    return instance
  }

  having(column: keyof ProjectType, operator: string, value: any): ProjectModel {
    return ProjectModel.having(column, operator)
  }

  static having(column: keyof ProjectType, operator: string, value: any): ProjectModel {
    const instance = new ProjectModel(null)

    instance.selectFromQuery = instance.selectFromQuery.having(column, operator, value)

    return instance
  }

  inRandomOrder(): ProjectModel {
    return ProjectModel.inRandomOrder()
  }

  static inRandomOrder(): ProjectModel {
    const instance = new ProjectModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(sql` ${sql.raw('RANDOM()')} `)

    return instance
  }

  orderByDesc(column: keyof ProjectType): ProjectModel {
    return ProjectModel.orderByDesc(column)
  }

  static orderByDesc(column: keyof ProjectType): ProjectModel {
    const instance = new ProjectModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, 'desc')

    return instance
  }

  orderByAsc(column: keyof ProjectType): ProjectModel {
    return ProjectModel.orderByAsc(column)
  }

  static orderByAsc(column: keyof ProjectType): ProjectModel {
    const instance = new ProjectModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, 'asc')

    return instance
  }

  async update(project: ProjectUpdate): Promise<ProjectModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(project).filter(([key]) => this.fillable.includes(key)),
    ) as NewProject

    await db.updateTable('projects')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      const model = await this.find(this.id)

      return model
    }

    return undefined
  }

  async forceUpdate(project: ProjectUpdate): Promise<ProjectModel | undefined> {
    if (this.id === undefined) {
      this.updateFromQuery.set(project).execute()
    }

    await db.updateTable('projects')
      .set(project)
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
      throw new HttpError(500, 'Project data is undefined')

    if (this.id === undefined) {
      await db.insertInto('projects')
        .values(this as NewProject)
        .executeTakeFirstOrThrow()
    }
    else {
      await this.update(this)
    }
  }

  // Method to delete (soft delete) the project instance
  async delete(): Promise<any> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()

    return await db.deleteFrom('projects')
      .where('id', '=', this.id)
      .execute()
  }

  distinct(column: keyof ProjectType): ProjectModel {
    return ProjectModel.distinct(column)
  }

  static distinct(column: keyof ProjectType): ProjectModel {
    const instance = new ProjectModel(null)

    instance.selectFromQuery = instance.selectFromQuery.select(column).distinct()

    instance.hasSelect = true

    return instance
  }

  join(table: string, firstCol: string, secondCol: string): ProjectModel {
    return ProjectModel.join(table, firstCol, secondCol)
  }

  static join(table: string, firstCol: string, secondCol: string): ProjectModel {
    const instance = new ProjectModel(null)

    instance.selectFromQuery = instance.selectFromQuery.innerJoin(table, firstCol, secondCol)

    return instance
  }

  static async rawQuery(rawQuery: string): Promise<any> {
    return await sql`${rawQuery}`.execute(db)
  }

  toJSON(): Partial<ProjectJsonResponse> {
    const output: Partial<ProjectJsonResponse> = {

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
  const query = db.selectFrom('projects').where('id', '=', id).selectAll()

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
  const result = await db.insertInto('projects')
    .values(newProject)
    .executeTakeFirstOrThrow()

  return await find(Number(result.numInsertedOrUpdatedRows)) as ProjectModel
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(db)
}

export async function remove(id: number): Promise<void> {
  await db.deleteFrom('projects')
    .where('id', '=', id)
    .execute()
}

export async function whereName(value: string): Promise<ProjectModel[]> {
  const query = db.selectFrom('projects').where('name', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new ProjectModel(modelItem))
}

export async function whereDescription(value: string): Promise<ProjectModel[]> {
  const query = db.selectFrom('projects').where('description', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new ProjectModel(modelItem))
}

export async function whereUrl(value: string): Promise<ProjectModel[]> {
  const query = db.selectFrom('projects').where('url', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new ProjectModel(modelItem))
}

export async function whereStatus(value: string): Promise<ProjectModel[]> {
  const query = db.selectFrom('projects').where('status', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new ProjectModel(modelItem))
}

export const Project = ProjectModel

export default Project
