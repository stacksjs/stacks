import type { ColumnType, Generated, Insertable, Selectable, Updateable } from 'kysely'
    import type { Result } from '@stacksjs/error-handling'
    import { err, handleError, ok } from '@stacksjs/error-handling'
    import { db } from '@stacksjs/database'
    import Team from './Team'


    // import { Kysely, MysqlDialect, PostgresDialect } from 'kysely'
    // import { Pool } from 'pg'

    // TODO: we need an action that auto-generates these table interfaces
    export interface AccessTokensTable {
      id: Generated<number>
      name: string
      token: string
      plainTextToken: string
      abilities: enum
      team_id: number 

      created_at: ColumnType<Date, string | undefined, never>
      updated_at: ColumnType<Date, string | undefined, never>
      deleted_at: ColumnType<Date, string | undefined, never>
    }

    interface AccessTokenResponse {
      data: AccessTokens
      paging: {
        total_records: number
        page: number
        total_pages: number
      }
      next_cursor: number | null
    }

    export type AccessTokenType = Selectable<AccessTokensTable>
    export type NewAccessToken = Insertable<AccessTokensTable>
    export type AccessTokenUpdate = Updateable<AccessTokensTable>
    export type AccessTokens = AccessTokenType[]

    export type AccessTokenColumn = AccessTokens
    export type AccessTokenColumns = Array<keyof AccessTokens>

    type SortDirection = 'asc' | 'desc'
    interface SortOptions { column: AccessTokenType, order: SortDirection }
    // Define a type for the options parameter
    interface QueryOptions {
      sort?: SortOptions
      limit?: number
      offset?: number
      page?: number
    }

    export class AccessTokenModel {
      private accesstoken: Partial<AccessTokenType>
      private results: Partial<AccessTokenType>[]
      private hidden = ['password'] // TODO: this hidden functionality needs to be implemented still

      constructor(accesstoken: Partial<AccessTokenType>) {
        this.accesstoken = accesstoken
      }

      // Method to find a accesstoken by ID
      static async find(id: number, fields?: (keyof AccessTokenType)[]) {
        let query = db.selectFrom('access_tokens').where('id', '=', id)

        if (fields)
          query = query.select(fields)
        else
          query = query.selectAll()

        const model = await query.executeTakeFirst()

        if (!model)
          return null

        return new AccessTokenModel(model)
      }

      static async findMany(ids: number[], fields?: (keyof AccessTokenType)[]) {
        let query = db.selectFrom('access_tokens').where('id', 'in', ids)

        if (fields)
          query = query.select(fields)
        else
          query = query.selectAll()

        const model = await query.execute()

        return model.map(modelItem => new AccessTokenModel(modelItem))
      }

      // Method to get a accesstoken by criteria
      static async get(criteria: Partial<AccessTokenType>, options: QueryOptions = {}): Promise<AccessTokenModel[]> {
        let query = db.selectFrom('access_tokens')

        // Apply sorting from options
        if (options.sort)
          query = query.orderBy(options.sort.column, options.sort.order)

        // Apply limit and offset from options
        if (options.limit !== undefined)
          query = query.limit(options.limit)

        if (options.offset !== undefined)
          query = query.offset(options.offset)

        const model = await query.selectAll().execute()
        return model.map(modelItem => new AccessTokenModel(modelItem))
      }

      // Method to get all access_tokens
      static async all(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<AccessTokenResponse> {
        const totalRecordsResult = await db.selectFrom('access_tokens')
          .select(db.fn.count('id').as('total')) // Use 'id' or another actual column name
          .executeTakeFirst()

        const totalRecords = Number(totalRecordsResult?.total) || 0
        const totalPages = Math.ceil(totalRecords / (options.limit ?? 10))

        const access_tokensWithExtra = await db.selectFrom('access_tokens')
          .selectAll()
          .orderBy('id', 'asc') // Assuming 'id' is used for cursor-based pagination
          .limit((options.limit ?? 10) + 1) // Fetch one extra record
          .offset((options.page - 1) * (options.limit ?? 10))
          .execute()

        let nextCursor = null
        if (access_tokensWithExtra.length > (options.limit ?? 10))
          nextCursor = access_tokensWithExtra.pop()!.id // Use the ID of the extra record as the next cursor

        return {
          data: access_tokensWithExtra,
          paging: {
            total_records: totalRecords,
            page: options.page,
            total_pages: totalPages,
          },
          next_cursor: nextCursor,
        }
      }

      // Method to create a new accesstoken
      static async create(newAccessToken: NewAccessToken): Promise<AccessTokenModel> {
        const model = await db.insertInto('access_tokens')
          .values(newAccessToken)
          .returningAll()
          .executeTakeFirstOrThrow()

        return new AccessTokenModel(model)
      }

      // Method to update a accesstoken
      static async update(id: number, accesstokenUpdate: AccessTokenUpdate): Promise<AccessTokenModel> {
        const model = await db.updateTable('access_tokens')
          .set(accesstokenUpdate)
          .where('id', '=', id)
          .returningAll()
          .executeTakeFirstOrThrow()

        return new AccessTokenModel(model)
      }

      // Method to remove a accesstoken
      static async remove(id: number): Promise<AccessTokenModel> {
        const model = await db.deleteFrom('access_tokens')
          .where('id', '=', id)
          .returningAll()
          .executeTakeFirstOrThrow()

        return new AccessTokenModel(model)
      }

      async where(column: string, operator = '=', value: any) {
        let query = db.selectFrom('access_tokens')

        query = query.where(column, operator, value)

        return await query.selectAll().execute()
      }

      async whereIs(criteria: Partial<AccessTokenType>, options: QueryOptions = {}) {
        let query = db.selectFrom('access_tokens')

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

      async whereIn(column: keyof AccessTokenType, values: any[], options: QueryOptions = {}) {
        let query = db.selectFrom('access_tokens')

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
        return await db.selectFrom('access_tokens')
          .selectAll()
          .executeTakeFirst()
      }

      async last() {
        return await db.selectFrom('access_tokens')
          .selectAll()
          .orderBy('id', 'desc')
          .executeTakeFirst()
      }

      async orderBy(column: keyof AccessTokenType, order: 'asc' | 'desc') {
        return await db.selectFrom('access_tokens')
          .selectAll()
          .orderBy(column, order)
          .execute()
      }

      async orderByDesc(column: keyof AccessTokenType) {
        return await db.selectFrom('access_tokens')
          .selectAll()
          .orderBy(column, 'desc')
          .execute()
      }

      async orderByAsc(column: keyof AccessTokenType) {
        return await db.selectFrom('access_tokens')
          .selectAll()
          .orderBy(column, 'asc')
          .execute()
      }

      // Method to get the accesstoken instance itself
      self() {
        return this
      }

      // Method to get the accesstoken instance data
      get() {
        return this.accesstoken
      }

      // Method to update the accesstoken instance
      async update(accesstoken: AccessTokenUpdate): Promise<Result<AccessTokenType, Error>> {
        if (this.accesstoken.id === undefined)
          return err(handleError('AccessToken ID is undefined'))

        const updatedModel = await db.updateTable('access_tokens')
          .set(accesstoken)
          .where('id', '=', this.accesstoken.id)
          .returningAll()
          .executeTakeFirst()

        if (!updatedModel)
          return err(handleError('AccessToken not found'))

        this.accesstoken = updatedModel

        return ok(updatedModel)
      }

      // Method to save (insert or update) the accesstoken instance
      async save(): Promise<void> {
        if (!this.accesstoken)
          throw new Error('AccessToken data is undefined')

        if (this.accesstoken.id === undefined) {
          // Insert new accesstoken
          const newModel = await db.insertInto('access_tokens')
            .values(this.accesstoken as NewAccessToken)
            .returningAll()
            .executeTakeFirstOrThrow()
          this.accesstoken = newModel
        }
        else {
          // Update existing accesstoken
          await this.update(this.accesstoken)
        }
      }

      // Method to delete the accesstoken instance
      async delete(): Promise<void> {
        if (this.accesstoken.id === undefined)
          throw new Error('AccessToken ID is undefined')

        await db.deleteFrom('access_tokens')
          .where('id', '=', this.accesstoken.id)
          .execute()

        this.accesstoken = {}
      }

      // Method to refresh the accesstoken instance data from the database
      async refresh(): Promise<void> {
        if (this.accesstoken.id === undefined)
          throw new Error('AccessToken ID is undefined')

        const refreshedModel = await db.selectFrom('access_tokens')
          .where('id', '=', this.accesstoken.id)
          .selectAll()
          .executeTakeFirst()

        if (!refreshedModel)
          throw new Error('AccessToken not found')

        this.accesstoken = refreshedModel
      }

      
      async team() {
        if (this.accesstoken.id === undefined)
          throw new Error('Relation Error!')

        const model = await db.selectFrom('teams')
        .where('accesstoken_id', '=', this.accesstoken.id)
        .selectAll()
        .executeTakeFirst()

        if (! model)
          throw new Error('Model Relation Not Found!')

        return new Team.modelInstance(model)
      }



      toJSON() {
        const output: Partial<AccessTokenType> = { ...this.accesstoken }

        this.hidden.forEach((attr) => {
          if (attr in output)
            delete output[attr as keyof Partial<AccessTokenType>]
        })

        type AccessToken = Omit<AccessTokenType, 'password'>

        return output as AccessToken
      }
    }

    const Model = AccessTokenModel

    // starting here, ORM functions
    export async function find(id: number, fields?: (keyof AccessTokenType)[]) {
      let query = db.selectFrom('access_tokens').where('id', '=', id)

      if (fields)
        query = query.select(fields)
      else
        query = query.selectAll()

      const model = await query.executeTakeFirst()

      if (!model)
        return null

      return new AccessTokenModel(model)
    }

    export async function findMany(ids: number[], fields?: (keyof AccessTokenType)[]) {
      let query = db.selectFrom('access_tokens').where('id', 'in', ids)

      if (fields)
        query = query.select(fields)
      else
        query = query.selectAll()

      const model = await query.execute()

      return model.map(modelItem => new AccessTokenModel(modelItem))
    }

    export async function count() {
      const results = await db.selectFrom('access_tokens')
        .selectAll()
        .execute()

      return results.length
    }

    export async function get(criteria: Partial<AccessTokenType>, sort: { column: keyof AccessTokenType, order: 'asc' | 'desc' } = { column: 'created_at', order: 'desc' }) {
      let query = db.selectFrom('access_tokens')

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

    export async function all(limit: number = 10, offset: number = 0) {
      return await db.selectFrom('access_tokens')
        .selectAll()
        .orderBy('created_at', 'desc')
        .limit(limit)
        .offset(offset)
        .execute()
    }

    export async function create(newAccessToken: NewAccessToken) {
      return await db.insertInto('access_tokens')
        .values(newAccessToken)
        .returningAll()
        .executeTakeFirstOrThrow()
    }

    export async function first() {
     return await db.selectFrom('access_tokens')
        .selectAll()
        .executeTakeFirst()
    }

    export async function recent(limit: number) {
      return await db.selectFrom('access_tokens')
         .selectAll()
         .limit(limit)
         .execute()
     }

     export async function last(limit: number) {
      return await db.selectFrom('access_tokens')
         .selectAll()
         .orderBy('id', 'desc')
         .limit(limit)
         .execute()
     }

    export async function update(id: number, accesstokenUpdate: AccessTokenUpdate) {
      return await db.updateTable('access_tokens')
        .set(accesstokenUpdate)
        .where('id', '=', id)
        .execute()
    }

    export async function remove(id: number) {
      return await db.deleteFrom('access_tokens')
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirst()
    }

    export async function where(column: string, operator = '=', value: any) {
      let query = db.selectFrom('access_tokens')

      query = query.where(column, operator, value)

      return await query.selectAll().execute()
    }

    export async function whereIs(
      criteria: Partial<AccessTokenType>,
      options: QueryOptions = {},
    ) {
      let query = db.selectFrom('access_tokens')

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
      column: keyof AccessTokenType,
      values: any[],
      options: QueryOptions = {},
    ) {
      let query = db.selectFrom('access_tokens')

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

    export const AccessToken = {
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
      model: AccessTokenModel
    }

    export default AccessToken
    