import type { Generated, Insertable, Selectable, Updateable } from 'kysely'
import { cache } from '@stacksjs/cache'
import { db, sql } from '@stacksjs/database'
import { HttpError } from '@stacksjs/error-handling'

// import { Kysely, MysqlDialect, PostgresDialect } from 'kysely'
// import { Pool } from 'pg'

// TODO: we need an action that auto-generates these table interfaces
export interface ProjectsTable {
  id: Generated<number>
  name?: string
  description?: string
  url?: string
  status?: string

  created_at?: Date

  updated_at?: Date

  deleted_at?: Date

}

interface ProjectResponse {
  data: Projects
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export type ProjectType = Selectable<ProjectsTable>
export type NewProject = Insertable<ProjectsTable>
export type ProjectUpdate = Updateable<ProjectsTable>
export type Projects = ProjectType[]

export type ProjectColumn = Projects
export type ProjectColumns = Array<keyof Projects>

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
  private hidden = []
  private fillable = []
  private softDeletes = false
  protected query: any
  protected hasSelect: boolean
  public id: number | undefined
  public name: string | undefined
  public description: string | undefined
  public url: string | undefined
  public status: string | undefined

  public created_at: Date | undefined
  public updated_at: Date | undefined

  constructor(project: Partial<ProjectType> | null) {
    this.id = project?.id
    this.name = project?.name
    this.description = project?.description
    this.url = project?.url
    this.status = project?.status

    this.created_at = project?.created_at

    this.updated_at = project?.updated_at

    this.query = db.selectFrom('projects')
    this.hasSelect = false
  }

  // Method to find a Project by ID
  async find(id: number): Promise<ProjectModel | undefined> {
    const query = db.selectFrom('projects').where('id', '=', id).selectAll()

    const model = await query.executeTakeFirst()

    if (!model)
      return undefined

    cache.getOrSet(`project:${id}`, JSON.stringify(model))

    return this.parseResult(new ProjectModel(model))
  }

  // Method to find a Project by ID
  static async find(id: number): Promise<ProjectModel | undefined> {
    const query = db.selectFrom('projects').where('id', '=', id).selectAll()

    const instance = new ProjectModel(null)

    const model = await query.executeTakeFirst()

    if (!model)
      return undefined

    cache.getOrSet(`project:${id}`, JSON.stringify(model))

    return instance.parseResult(new ProjectModel(model))
  }

  static async all(): Promise<ProjectModel[]> {
    let query = db.selectFrom('projects').selectAll()

    const instance = new ProjectModel(null)

    if (instance.softDeletes) {
      query = query.where('deleted_at', 'is', null)
    }

    const results = await query.execute()

    return results.map(modelItem => instance.parseResult(new ProjectModel(modelItem)))
  }

  static async findOrFail(id: number): Promise<ProjectModel> {
    let query = db.selectFrom('projects').where('id', '=', id)

    const instance = new ProjectModel(null)

    if (instance.softDeletes) {
      query = query.where('deleted_at', 'is', null)
    }

    query = query.selectAll()

    const model = await query.executeTakeFirst()

    if (model === undefined)
      throw new HttpError(404, `No ProjectModel results for ${id}`)

    cache.getOrSet(`project:${id}`, JSON.stringify(model))

    return instance.parseResult(new ProjectModel(model))
  }

  static async findMany(ids: number[]): Promise<ProjectModel[]> {
    let query = db.selectFrom('projects').where('id', 'in', ids)

    const instance = new ProjectModel(null)

    if (instance.softDeletes) {
      query = query.where('deleted_at', 'is', null)
    }

    query = query.selectAll()

    const model = await query.execute()

    return model.map(modelItem => instance.parseResult(new ProjectModel(modelItem)))
  }

  // Method to get a User by criteria
  static async get(): Promise<UserModel[]> {
    const instance = new ProjectModel(null)

    if (instance.hasSelect) {
      if (instance.softDeletes) {
        instance.query = instance.query.where('deleted_at', 'is', null)
      }

      const model = await instance.query.execute()

      return model.map((modelItem: ProjectModel) => new ProjectModel(modelItem))
    }

    if (instance.softDeletes) {
      instance.query = instance.query.where('deleted_at', 'is', null)
    }

    const model = await instance.query.selectAll().execute()

    return model.map((modelItem: ProjectModel) => new ProjectModel(modelItem))
  }

  // Method to get a Project by criteria
  async get(): Promise<ProjectModel[]> {
    if (this.hasSelect) {
      if (this.softDeletes) {
        this.query = this.query.where('deleted_at', 'is', null)
      }

      const model = await this.query.execute()

      return model.map((modelItem: ProjectModel) => new ProjectModel(modelItem))
    }

    if (this.softDeletes) {
      this.query = this.query.where('deleted_at', 'is', null)
    }

    const model = await this.query.selectAll().execute()

    return model.map((modelItem: ProjectModel) => new ProjectModel(modelItem))
  }

  static async count(): Promise<number> {
    const instance = new ProjectModel(null)

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

    const model = await find(Number(result.insertId)) as ProjectModel

    return model
  }

  static async forceCreate(newProject: NewProject): Promise<ProjectModel> {
    const result = await db.insertInto('projects')
      .values(newProject)
      .executeTakeFirst()

    const model = await find(Number(result.insertId)) as ProjectModel

    return model
  }

  // Method to remove a Project
  static async remove(id: number): Promise<void> {
    const instance = new ProjectModel(null)

    if (instance.softDeletes) {
      await db.updateTable('projects')
        .set({
          deleted_at: sql.raw('CURRENT_TIMESTAMP'),
        })
        .where('id', '=', id)
        .execute()
    }
    else {
      await db.deleteFrom('projects')
        .where('id', '=', id)
        .execute()
    }
  }

  where(...args: (string | number | boolean | undefined | null)[]): ProjectModel {
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

    this.query = this.query.where(column, operator, value)

    return this
  }

  static where(...args: (string | number | boolean | undefined | null)[]): ProjectModel {
    let column: any
    let operator: any
    let value: any

    const instance = new ProjectModel(null)

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

    instance.query = instance.query.where(column, operator, value)

    return instance
  }

  static whereName(value: string): ProjectModel {
    const instance = new ProjectModel(null)

    instance.query = instance.query.where('name', '=', value)

    return instance
  }

  static whereDescription(value: string): ProjectModel {
    const instance = new ProjectModel(null)

    instance.query = instance.query.where('description', '=', value)

    return instance
  }

  static whereUrl(value: string): ProjectModel {
    const instance = new ProjectModel(null)

    instance.query = instance.query.where('url', '=', value)

    return instance
  }

  static whereStatus(value: string): ProjectModel {
    const instance = new ProjectModel(null)

    instance.query = instance.query.where('status', '=', value)

    return instance
  }

  static whereIn(column: keyof ProjectType, values: any[]): ProjectModel {
    const instance = new ProjectModel(null)

    instance.query = instance.query.where(column, 'in', values)

    return instance
  }

  async first(): Promise<ProjectModel | undefined> {
    const model = await this.query.selectAll().executeTakeFirst()

    if (!model) {
      return undefined
    }

    return this.parseResult(new ProjectModel(model))
  }

  async firstOrFail(): Promise<ProjectModel | undefined> {
    const model = await this.query.selectAll().executeTakeFirst()

    if (model === undefined)
      throw new HttpError(404, 'No ProjectModel results found for query')

    return this.parseResult(new ProjectModel(model))
  }

  async exists(): Promise<boolean> {
    const model = await this.query.selectAll().executeTakeFirst()

    return model !== null || model !== undefined
  }

  static async first(): Promise<ProjectType | undefined> {
    return await db.selectFrom('projects')
      .selectAll()
      .executeTakeFirst()
  }

  async last(): Promise<ProjectType | undefined> {
    return await db.selectFrom('projects')
      .selectAll()
      .orderBy('id', 'desc')
      .executeTakeFirst()
  }

  static async last(): Promise<ProjectType | undefined> {
    return await db.selectFrom('projects').selectAll().orderBy('id', 'desc').executeTakeFirst()
  }

  static orderBy(column: keyof ProjectType, order: 'asc' | 'desc'): ProjectModel {
    const instance = new ProjectModel(null)

    instance.query = instance.query.orderBy(column, order)

    return instance
  }

  orderBy(column: keyof ProjectType, order: 'asc' | 'desc'): ProjectModel {
    this.query = this.query.orderBy(column, order)

    return this
  }

  static orderByDesc(column: keyof ProjectType): ProjectModel {
    const instance = new ProjectModel(null)

    instance.query = instance.query.orderBy(column, 'desc')

    return instance
  }

  orderByDesc(column: keyof ProjectType): ProjectModel {
    this.query = this.orderBy(column, 'desc')

    return this
  }

  static orderByAsc(column: keyof ProjectType): ProjectModel {
    const instance = new ProjectModel(null)

    instance.query = instance.query.orderBy(column, 'asc')

    return instance
  }

  orderByAsc(column: keyof ProjectType): ProjectModel {
    this.query = this.query.orderBy(column, 'desc')

    return this
  }

  async update(project: ProjectUpdate): Promise<ProjectModel | undefined> {
    if (this.id === undefined)
      throw new HttpError(500, 'Project ID is undefined')

    const filteredValues = Object.fromEntries(
      Object.entries(project).filter(([key]) => this.fillable.includes(key)),
    ) as NewProject

    await db.updateTable('projects')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    const model = await this.find(Number(this.id))

    return model
  }

  async forceUpdate(project: ProjectUpdate): Promise<ProjectModel | undefined> {
    if (this.id === undefined)
      throw new HttpError(500, 'Project ID is undefined')

    await db.updateTable('projects')
      .set(project)
      .where('id', '=', this.id)
      .executeTakeFirst()

    const model = await this.find(Number(this.id))

    return model
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
  async delete(): Promise<void> {
    if (this.id === undefined)
      throw new HttpError(500, 'Project ID is undefined')

    // Check if soft deletes are enabled
    if (this.softDeletes) {
      // Update the deleted_at column with the current timestamp
      await db.updateTable('projects')
        .set({
          deleted_at: sql.raw('CURRENT_TIMESTAMP'),
        })
        .where('id', '=', this.id)
        .execute()
    }
    else {
      // Perform a hard delete
      await db.deleteFrom('projects')
        .where('id', '=', this.id)
        .execute()
    }
  }

  distinct(column: keyof ProjectType): ProjectModel {
    this.query = this.query.select(column).distinct()

    this.hasSelect = true

    return this
  }

  static distinct(column: keyof ProjectType): ProjectModel {
    const instance = new ProjectModel(null)

    instance.query = instance.query.select(column).distinct()

    instance.hasSelect = true

    return instance
  }

  join(table: string, firstCol: string, secondCol: string): ProjectModel {
    this.query = this.query.innerJoin(table, firstCol, secondCol)

    return this
  }

  static join(table: string, firstCol: string, secondCol: string): ProjectModel {
    const instance = new ProjectModel(null)

    instance.query = instance.query.innerJoin(table, firstCol, secondCol)

    return instance
  }

  static async rawQuery(rawQuery: string): Promise<any> {
    return await sql`${rawQuery}`.execute(db)
  }

  toJSON() {
    const output: Partial<ProjectType> = {

      id: this.id,
      name: this.name,
      description: this.description,
      url: this.url,
      status: this.status,

      created_at: this.created_at,

      updated_at: this.updated_at,

    }

        type Project = Omit<ProjectType, 'password'>

        return output as Project
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

  return await find(Number(result.insertId)) as ProjectModel
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
