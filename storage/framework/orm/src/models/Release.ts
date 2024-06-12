import type { ColumnType, Generated, Insertable, Selectable, Updateable } from 'kysely'
    import type { Result } from '@stacksjs/error-handling'
    import { err, handleError, ok } from '@stacksjs/error-handling'
    import { db } from '@stacksjs/database'
    
    // import { Kysely, MysqlDialect, PostgresDialect } from 'kysely'
    // import { Pool } from 'pg'

    // TODO: we need an action that auto-generates these table interfaces
    export interface ReleasesTable {
      id: Generated<number>
      version: string
     
      created_at: ColumnType<Date, string | undefined, never>
      updated_at: ColumnType<Date, string | undefined, never>
      deleted_at: ColumnType<Date, string | undefined, never>
    }

    interface ReleaseResponse {
      data: Releases
      paging: {
        total_records: number
        page: number
        total_pages: number
      }
      next_cursor: number | null
    }

    export type ReleaseType = Selectable<ReleasesTable>
    export type NewRelease = Insertable<ReleasesTable>
    export type ReleaseUpdate = Updateable<ReleasesTable>
    export type Releases = ReleaseType[]

    export type ReleaseColumn = Releases
    export type ReleaseColumns = Array<keyof Releases>

    type SortDirection = 'asc' | 'desc'
    interface SortOptions { column: ReleaseType, order: SortDirection }
    // Define a type for the options parameter
    interface QueryOptions {
      sort?: SortOptions
      limit?: number
      offset?: number
      page?: number
    }

    export class ReleaseModel {
      private release: Partial<ReleaseType>
      private results: Partial<ReleaseType>[]
      private hidden = ['password'] // TODO: this hidden functionality needs to be implemented still

      constructor(release: Partial<ReleaseType>) {
        this.release = release
      }

      // Method to find a release by ID
      static async find(id: number, fields?: (keyof ReleaseType)[]): Promise<ReleaseModel> {
        let query = db.selectFrom('releases').where('id', '=', id)

        if (fields)
          query = query.select(fields)
        else
          query = query.selectAll()

        const model = await query.executeTakeFirst()

        if (!model)
          return null

        return new ReleaseModel(model)
      }

      static async findOrFail(id: number, fields?: (keyof ReleaseType)[]): Promise<ReleaseModel> {
        let query = db.selectFrom('releases').where('id', '=', id)

        if (fields)
          query = query.select(fields)
        else
          query = query.selectAll()

        const model = await query.executeTakeFirst()

        if (!model)
          throw(`No model results found for ${id} `)

        return new ReleaseModel(model)
      }

      static async findMany(ids: number[], fields?: (keyof ReleaseType)[]): Promise<ReleaseModel[]> {
        let query = db.selectFrom('releases').where('id', 'in', ids)

        if (fields)
          query = query.select(fields)
        else
          query = query.selectAll()

        const model = await query.execute()

        return model.map(modelItem => new ReleaseModel(modelItem))
      }

      // Method to get a release by criteria
      static async get(criteria: Partial<ReleaseType>, options: QueryOptions = {}): Promise<ReleaseModel[]> {
        let query = db.selectFrom('releases')

        // Apply sorting from options
        if (options.sort)
          query = query.orderBy(options.sort.column, options.sort.order)

        // Apply limit and offset from options
        if (options.limit !== undefined)
          query = query.limit(options.limit)

        if (options.offset !== undefined)
          query = query.offset(options.offset)

        const model = await query.selectAll().execute()
        return model.map(modelItem => new ReleaseModel(modelItem))
      }

      // Method to get all releases
      static async all(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<ReleaseResponse> {
        const totalRecordsResult = await db.selectFrom('releases')
          .select(db.fn.count('id').as('total')) // Use 'id' or another actual column name
          .executeTakeFirst()

        const totalRecords = Number(totalRecordsResult?.total) || 0
        const totalPages = Math.ceil(totalRecords / (options.limit ?? 10))

        const releasesWithExtra = await db.selectFrom('releases')
          .selectAll()
          .orderBy('id', 'asc') // Assuming 'id' is used for cursor-based pagination
          .limit((options.limit ?? 10) + 1) // Fetch one extra record
          .offset((options.page - 1) * (options.limit ?? 10))
          .execute()

        let nextCursor = null
        if (releasesWithExtra.length > (options.limit ?? 10))
          nextCursor = releasesWithExtra.pop()!.id // Use the ID of the extra record as the next cursor

        return {
          data: releasesWithExtra,
          paging: {
            total_records: totalRecords,
            page: options.page,
            total_pages: totalPages,
          },
          next_cursor: nextCursor,
        }
      }

      // Method to create a new release
      static async create(newRelease: NewRelease): Promise<ReleaseModel> {
        const result = await db.insertInto('releases')
          .values(newRelease)
          .executeTakeFirstOrThrow()

        return await find(Number(result.insertId)) as ReleaseModel
      }

      // Method to remove a release
      static async remove(id: number): Promise<ReleaseModel> {
        const model = await db.deleteFrom('releases')
          .where('id', '=', id)
          .executeTakeFirstOrThrow()

        return new ReleaseModel(model)
      }

      async where(...args: (string | number)[]): Promise<ReleaseType[]> {
        let column: any
        let operator: any
        let value: any

        if (args.length === 2) {
          [column, value] = args
          operator = '='
        } else if (args.length === 3) {
            [column, operator, value] = args
        } else {
            throw new Error("Invalid number of arguments")
        }

        let query = db.selectFrom('releases')

        query = query.where(column, operator, value)

        return await query.selectAll()
      }

      async whereIs(criteria: Partial<ReleaseType>, options: QueryOptions = {}) {
        let query = db.selectFrom('releases')

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

      async whereIn(column: keyof ReleaseType, values: any[], options: QueryOptions = {}): Promise<ReleaseType[]> {

        let query = db.selectFrom('releases')

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

      async first(): Promise<ReleaseType> {
        return await db.selectFrom('releases')
          .selectAll()
          .executeTakeFirst()
      }

      async last(): Promise<ReleaseType> {
        return await db.selectFrom('releases')
          .selectAll()
          .orderBy('id', 'desc')
          .executeTakeFirst()
      }

      async orderBy(column: keyof ReleaseType, order: 'asc' | 'desc'): Promise<ReleaseType[]> {
        return await db.selectFrom('releases')
          .selectAll()
          .orderBy(column, order)
          .execute()
      }

      async orderByDesc(column: keyof ReleaseType): Promise<ReleaseType[]> {
        return await db.selectFrom('releases')
          .selectAll()
          .orderBy(column, 'desc')
          .execute()
      }

      async orderByAsc(column: keyof ReleaseType): Promise<ReleaseType[]> {
        return await db.selectFrom('releases')
          .selectAll()
          .orderBy(column, 'asc')
          .execute()
      }

      // Method to get the release instance itself
      self(): ReleaseModel {
        return this
      }

      // Method to get the release instance data
      get() {
        return this.release
      }

      // Method to update the release instance
      async update(release: ReleaseUpdate): Promise<Result<ReleaseType, Error>> {
        if (this.release.id === undefined)
          return err(handleError('Release ID is undefined'))

        const updatedModel = await db.updateTable('releases')
          .set(release)
          .where('id', '=', this.release.id)
          .executeTakeFirst()

        if (!updatedModel)
          return err(handleError('Release not found'))

        return ok(updatedModel)
      }

      // Method to save (insert or update) the release instance
      async save(): Promise<void> {
        if (!this.release)
          throw new Error('Release data is undefined')

        if (this.release.id === undefined) {
          // Insert new release
          const newModel = await db.insertInto('releases')
            .values(this.release as NewRelease)
            .executeTakeFirstOrThrow()
        }
        else {
          // Update existing release
          await this.update(this.release)
        }
      }

      // Method to delete the release instance
      async delete(): Promise<void> {
        if (this.release.id === undefined)
          throw new Error('Release ID is undefined')

        await db.deleteFrom('releases')
          .where('id', '=', this.release.id)
          .execute()

        this.release = {}
      }

      // Method to refresh the release instance data from the database
      async refresh(): Promise<void> {
        if (this.release.id === undefined)
          throw new Error('Release ID is undefined')

        const refreshedModel = await db.selectFrom('releases')
          .where('id', '=', this.release.id)
          .selectAll()
          .executeTakeFirst()

        if (!refreshedModel)
          throw new Error('Release not found')

        this.release = refreshedModel
      }

      

      toJSON() {
        const output: Partial<ReleaseType> = { ...this.release }

        this.hidden.forEach((attr) => {
          if (attr in output)
            delete output[attr as keyof Partial<ReleaseType>]
        })

        type Release = Omit<ReleaseType, 'password'>

        return output as Release
      }
    }

    const Model = ReleaseModel

    // starting here, ORM functions
    export async function find(id: number, fields?: (keyof ReleaseType)[]) {
      let query = db.selectFrom('releases').where('id', '=', id)

      if (fields)
        query = query.select(fields)
      else
        query = query.selectAll()

      const model = await query.executeTakeFirst()

      if (!model)
        return null

      return new ReleaseModel(model)
    }

    export async function findOrFail(id: number, fields?: (keyof ReleaseType)[]) {
      let query = db.selectFrom('releases').where('id', '=', id)

      if (fields)
        query = query.select(fields)
      else
        query = query.selectAll()

      const model = await query.executeTakeFirst()

      if (!model)
        throw(`No model results found for ${id} `)

      return new ReleaseModel(model)
    }

    export async function findMany(ids: number[], fields?: (keyof ReleaseType)[]) {
      let query = db.selectFrom('releases').where('id', 'in', ids)

      if (fields)
        query = query.select(fields)
      else
        query = query.selectAll()

      const model = await query.execute()

      return model.map(modelItem => new ReleaseModel(modelItem))
    }

    export async function count(): Number {
      const results = await db.selectFrom('releases')
        .selectAll()
        .execute()

      return results.length
    }

    export async function get(criteria: Partial<ReleaseType>, sort: { column: keyof ReleaseType, order: 'asc' | 'desc' } = { column: 'created_at', order: 'desc' }) {
      let query = db.selectFrom('releases')

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

    export async function all(limit: number = 10, offset: number = 0): Promise<ReleaseType[]> {
      return await db.selectFrom('releases')
        .selectAll()
        .orderBy('created_at', 'desc')
        .limit(limit)
        .offset(offset)
        .execute()
    }

    export async function create(newRelease: NewRelease): Promise<ReleaseModel> {
      const result = await db.insertInto('releases')
      .values(newRelease)
      .executeTakeFirstOrThrow()

      return await find(Number(result.insertId))
    }

    export async function first(): Promise<ReleaseModel> {
     return await db.selectFrom('releases')
        .selectAll()
        .executeTakeFirst()
    }

    export async function recent(limit: number): Promise<ReleaseModel[]> {
      return await db.selectFrom('releases')
         .selectAll()
         .limit(limit)
         .execute()
     }

     export async function last(limit: number): Promise<ReleaseType> {
      return await db.selectFrom('releases')
         .selectAll()
         .orderBy('id', 'desc')
         .limit(limit)
         .execute()
     }

    export async function update(id: number, releaseUpdate: ReleaseUpdate) {
      return await db.updateTable('releases')
        .set(releaseUpdate)
        .where('id', '=', id)
        .execute()
    }

    export async function remove(id: number) {
      return await db.deleteFrom('releases')
        .where('id', '=', id)
        .executeTakeFirst()
    }

    export async function where(...args: (string | number)[]) {
      let column: any
      let operator: any
      let value: any

      if (args.length === 2) {
        [column, value] = args
        operator = '='
      } else if (args.length === 3) {
          [column, operator, value] = args
      } else {
          throw new Error("Invalid number of arguments")
      }

      let query = db.selectFrom('releases')

      query = query.where(column, operator, value)

      return await query.selectAll()
    }

    export async function whereIs(
      criteria: Partial<ReleaseType>,
      options: QueryOptions = {},
    ) {
      let query = db.selectFrom('releases')

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
      column: keyof ReleaseType,
      values: any[],
      options: QueryOptions = {},
    ) {
      let query = db.selectFrom('releases')

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

    export const Release = {
      find,
      findOrFail,
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
      model: ReleaseModel
    }

    export default Release
    