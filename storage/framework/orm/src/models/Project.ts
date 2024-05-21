import { db } from '@stacksjs/database'
    import type { Result } from '@stacksjs/error-handling'
    import { err, handleError, ok } from '@stacksjs/error-handling'
    import type { ColumnType, Generated, Insertable, Selectable, Updateable } from 'kysely'
    
    // import { Kysely, MysqlDialect, PostgresDialect } from 'kysely'
    // import { Pool } from 'pg'

    // TODO: we need an action that auto-generates these table interfaces
    export interface ProjectsTable {
      id: Generated<number>
      name: string
      description: string
      url: string
      status: string
     
      created_at: ColumnType<Date, string | undefined, never>
      updated_at: ColumnType<Date, string | undefined, never>
      deleted_at: ColumnType<Date, string | undefined, never>
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
      private project: Partial<ProjectType>
      private results: Partial<ProjectType>[]
      private hidden = ['password'] // TODO: this hidden functionality needs to be implemented still

      constructor(project: Partial<ProjectType>) {
        this.project = project
      }

      // Method to find a project by ID
      static async find(id: number, fields?: (keyof ProjectType)[]) {
        let query = db.selectFrom('projects').where('id', '=', id)

        if (fields)
          query = query.select(fields)
        else
          query = query.selectAll()

        const model = await query.executeTakeFirst()

        if (!model)
          return null

        return new ProjectModel(model)
      }

      static async findMany(ids: number[], fields?: (keyof ProjectType)[]) {
        let query = db.selectFrom('projects').where('id', 'in', ids)

        if (fields)
          query = query.select(fields)
        else
          query = query.selectAll()

        const model = await query.execute()

        return model.map(modelItem => new ProjectModel(modelItem))
      }

      // Method to get a project by criteria
      static async get(criteria: Partial<ProjectType>, options: QueryOptions = {}): Promise<ProjectModel[]> {
        let query = db.selectFrom('projects')

        // Apply sorting from options
        if (options.sort)
          query = query.orderBy(options.sort.column, options.sort.order)

        // Apply limit and offset from options
        if (options.limit !== undefined)
          query = query.limit(options.limit)

        if (options.offset !== undefined)
          query = query.offset(options.offset)

        const model = await query.selectAll().execute()
        return model.map(modelItem => new ProjectModel(modelItem))
      }

      // Method to get all projects
      static async all(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<ProjectResponse> {
        const totalRecordsResult = await db.selectFrom('projects')
          .select(db.fn.count('id').as('total')) // Use 'id' or another actual column name
          .executeTakeFirst()

        const totalRecords = Number(totalRecordsResult?.total) || 0
        const totalPages = Math.ceil(totalRecords / (options.limit ?? 10))

        const projectsWithExtra = await db.selectFrom('projects')
          .selectAll()
          .orderBy('id', 'asc') // Assuming 'id' is used for cursor-based pagination
          .limit((options.limit ?? 10) + 1) // Fetch one extra record
          .offset((options.page! - 1) * (options.limit ?? 10))
          .execute()

        let nextCursor = null
        if (projectsWithExtra.length > (options.limit ?? 10))
          nextCursor = projectsWithExtra.pop()?.id // Use the ID of the extra record as the next cursor

        return {
          data: projectsWithExtra,
          paging: {
            total_records: totalRecords,
            page: options.page!,
            total_pages: totalPages,
          },
          next_cursor: nextCursor,
        }
      }

      // Method to create a new project
      static async create(newProject: NewProject): Promise<ProjectModel> {
        const model = await db.insertInto('projects')
          .values(newProject)
          .returningAll()
          .executeTakeFirstOrThrow()

        return new ProjectModel(model)
      }

      // Method to update a project
      static async update(id: number, projectUpdate: ProjectUpdate): Promise<ProjectModel> {
        const model = await db.updateTable('projects')
          .set(projectUpdate)
          .where('id', '=', id)
          .returningAll()
          .executeTakeFirstOrThrow()

        return new ProjectModel(model)
      }

      // Method to remove a project
      static async remove(id: number): Promise<ProjectModel> {
        const model = await db.deleteFrom('projects')
          .where('id', '=', id)
          .returningAll()
          .executeTakeFirstOrThrow()

        return new ProjectModel(model)
      }

      async where(column: string, operator, value: any) {
        let query = db.selectFrom('projects')

        query = query.where(column, operator, value)

        return await query.selectAll().execute()
      }

      async whereIs(criteria: Partial<ProjectType>, options: QueryOptions = {}) {
        let query = db.selectFrom('projects')

        // Existing criteria checks
        if (criteria.id)
          query = query.where('id', '=', criteria.id) // Kysely is immutable, we must re-assign

        if (criteria.email)
          query = query.where('email', '=', criteria.email)

        if (criteria.name !== undefined) {
          query = query.where(
            'name',
            criteria.name === null ? 'is' : '=',
            criteria.name,
          )
        }

        if (criteria.password)
          query = query.where('password', '=', criteria.password)

        if (criteria.created_at)
          query = query.where('created_at', '=', criteria.created_at)

        if (criteria.updated_at)
          query = query.where('updated_at', '=', criteria.updated_at)

        if (criteria.deleted_at)
          query = query.where('deleted_at', '=', criteria.deleted_at)

        // Apply sorting from options
        if (options.sort)
          query = query.orderBy(options.sort.column, options.sort.order)

        // Apply pagination from options
        if (options.limit !== undefined)
          query = query.limit(options.limit)

        if (options.offset !== undefined)
          query = query.offset(options.offset)

        return await query.selectAll().execute()
      }

      async whereIn(column: keyof ProjectType, values: any[], options: QueryOptions = {}) {
        let query = db.selectFrom('projects')

        query = query.where(column, 'in', values)

        // Apply sorting from options
        if (options.sort)
          query = query.orderBy(options.sort.column, options.sort.order)

        // Apply pagination from options
        if (options.limit !== undefined)
          query = query.limit(options.limit)

        if (options.offset !== undefined)
          query = query.offset(options.offset)

        return await query.selectAll().execute()
      }

      async first() {
        return await db.selectFrom('projects')
          .selectAll()
          .executeTakeFirst()
      }

      async last() {
        return await db.selectFrom('projects')
          .selectAll()
          .orderBy('id', 'desc')
          .executeTakeFirst()
      }

      async orderBy(column: keyof ProjectType, order: 'asc' | 'desc') {
        return await db.selectFrom('projects')
          .selectAll()
          .orderBy(column, order)
          .execute()
      }

      async orderByDesc(column: keyof ProjectType) {
        return await db.selectFrom('projects')
          .selectAll()
          .orderBy(column, 'desc')
          .execute()
      }

      async orderByAsc(column: keyof ProjectType) {
        return await db.selectFrom('projects')
          .selectAll()
          .orderBy(column, 'asc')
          .execute()
      }

      // Method to get the project instance itself
      self() {
        return this
      }

      // Method to get the project instance data
      get() {
        return this.project
      }

      // Method to update the project instance
      async update(project: ProjectUpdate): Promise<Result<ProjectType, Error>> {
        if (this.project.id === undefined)
          return err(handleError('Project ID is undefined'))

        const updatedModel = await db.updateTable('projects')
          .set(project)
          .where('id', '=', this.project.id)
          .returningAll()
          .executeTakeFirst()

        if (!updatedModel)
          return err(handleError('Project not found'))

        this.project = updatedModel

        return ok(updatedModel)
      }

      // Method to save (insert or update) the project instance
      async save(): Promise<void> {
        if (!this.project)
          throw new Error('Project data is undefined')

        if (this.project.id === undefined) {
          // Insert new project
          const newModel = await db.insertInto('projects')
            .values(this.project as NewProject)
            .returningAll()
            .executeTakeFirstOrThrow()
          this.project = newModel
        }
        else {
          // Update existing project
          await this.update(this.project)
        }
      }

      // Method to delete the project instance
      async delete(): Promise<void> {
        if (this.project.id === undefined)
          throw new Error('Project ID is undefined')

        await db.deleteFrom('projects')
          .where('id', '=', this.project.id)
          .execute()

        this.project = {}
      }

      // Method to refresh the project instance data from the database
      async refresh(): Promise<void> {
        if (this.project.id === undefined)
          throw new Error('Project ID is undefined')

        const refreshedModel = await db.selectFrom('projects')
          .where('id', '=', this.project.id)
          .selectAll()
          .executeTakeFirst()

        if (!refreshedModel)
          throw new Error('Project not found')

        this.project = refreshedModel
      }

      

      toJSON() {
        const output: Partial<ProjectType> = { ...this.project }

        this.hidden.forEach((attr) => {
          if (attr in output)
            delete output[attr as keyof Partial<ProjectType>]
        })

        type Project = Omit<ProjectType, 'password'>

        return output as Project
      }
    }

    const Model = ProjectModel

    // starting here, ORM functions
    export async function find(id: number, fields?: (keyof ProjectType)[]) {
      let query = db.selectFrom('projects').where('id', '=', id)

      if (fields)
        query = query.select(fields)
      else
        query = query.selectAll()

      const model = await query.executeTakeFirst()

      if (!model)
        return null

      return new ProjectModel(model)
    }

    export async function findMany(ids: number[], fields?: (keyof ProjectType)[]) {
      let query = db.selectFrom('projects').where('id', 'in', ids)

      if (fields)
        query = query.select(fields)
      else
        query = query.selectAll()

      const model = await query.execute()

      return model.map(modelItem => new ProjectModel(modelItem))
    }

    export async function count() {
      const results = await db.selectFrom('projects')
        .selectAll()
        .execute()

      return results.length
    }

    export async function get(criteria: Partial<ProjectType>, sort: { column: keyof ProjectType, order: 'asc' | 'desc' } = { column: 'created_at', order: 'desc' }) {
      let query = db.selectFrom('projects')

      if (criteria.id)
        query = query.where('id', '=', criteria.id) // Kysely is immutable, we must re-assign

      if (criteria.email)
        query = query.where('email', '=', criteria.email)

      if (criteria.name !== undefined) {
        query = query.where(
          'name',
          criteria.name === null ? 'is' : '=',
          criteria.name,
        )
      }

      if (criteria.password)
        query = query.where('password', '=', criteria.password)

      if (criteria.created_at)
        query = query.where('created_at', '=', criteria.created_at)

      if (criteria.updated_at)
        query = query.where('updated_at', '=', criteria.updated_at)

      if (criteria.deleted_at)
        query = query.where('deleted_at', '=', criteria.deleted_at)

      // Apply sorting based on the 'sort' parameter
      query = query.orderBy(sort.column, sort.order)

      return await query.selectAll().execute()
    }

    export async function all(limit = 10, offset = 0) {
      return await db.selectFrom('projects')
        .selectAll()
        .orderBy('created_at', 'desc')
        .limit(limit)
        .offset(offset)
        .execute()
    }

    export async function create(newProject: NewProject) {
      return await db.insertInto('projects')
        .values(newProject)
        .returningAll()
        .executeTakeFirstOrThrow()
    }

    export async function first() {
     return await db.selectFrom('projects')
        .selectAll()
        .executeTakeFirst()
    }

    export async function recent(limit: number) {
      return await db.selectFrom('projects')
         .selectAll()
         .limit(limit)
         .execute()
     }

     export async function last(limit: number) {
      return await db.selectFrom('projects')
         .selectAll()
         .orderBy('id', 'desc')
         .limit(limit)
         .execute()
     }

    export async function update(id: number, projectUpdate: ProjectUpdate) {
      return await db.updateTable('projects')
        .set(projectUpdate)
        .where('id', '=', id)
        .execute()
    }

    export async function remove(id: number) {
      return await db.deleteFrom('projects')
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirst()
    }

    export async function where(column: string, operator, value: any) {
      let query = db.selectFrom('projects')

      query = query.where(column, operator, value)

      return await query.selectAll().execute()
    }

    export async function whereIs(
      criteria: Partial<ProjectType>,
      options: QueryOptions = {},
    ) {
      let query = db.selectFrom('projects')

      // Apply criteria
      if (criteria.id)
        query = query.where('id', '=', criteria.id)

      if (criteria.email)
        query = query.where('email', '=', criteria.email)

      if (criteria.name !== undefined) {
        query = query.where(
          'name',
          criteria.name === null ? 'is' : '=',
          criteria.name,
        )
      }

      if (criteria.password)
        query = query.where('password', '=', criteria.password)

      if (criteria.created_at)
        query = query.where('created_at', '=', criteria.created_at)

      if (criteria.updated_at)
        query = query.where('updated_at', '=', criteria.updated_at)

      if (criteria.deleted_at)
        query = query.where('deleted_at', '=', criteria.deleted_at)

      // Apply sorting from options
      if (options.sort)
        query = query.orderBy(options.sort.column, options.sort.order)

      // Apply pagination from options
      if (options.limit !== undefined)
        query = query.limit(options.limit)

      if (options.offset !== undefined)
        query = query.offset(options.offset)

      return await query.selectAll().execute()
    }

    export async function whereIn(
      column: keyof ProjectType,
      values: any[],
      options: QueryOptions = {},
    ) {
      let query = db.selectFrom('projects')

      query = query.where(column, 'in', values)

      // Apply sorting from options
      if (options.sort)
        query = query.orderBy(options.sort.column, options.sort.order)

      // Apply pagination from options
      if (options.limit !== undefined)
        query = query.limit(options.limit)

      if (options.offset !== undefined)
        query = query.offset(options.offset)

      return await query.selectAll().execute()
    }

    export const Project = {
      find,
      findMany,
      get,
      count,
      all,
      create,
      update,
      remove,
      Model,
      first,
      last,
      recent,
      where,
      whereIn,
      model: ProjectModel
    }

    export default Project
    export default Project
    