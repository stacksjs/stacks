    import type { ColumnType, Generated, Insertable, Selectable, Updateable } from 'kysely'
    import type { Result } from '@stacksjs/error-handling'
    import { err, handleError, ok } from '@stacksjs/error-handling'
    import { db } from '@stacksjs/database'
    import Team from './Team'


    // import { Kysely, MysqlDialect, PostgresDialect } from 'kysely'
    // import { Pool } from 'pg'

    // TODO: we need an action that auto-generates these table interfaces
    export interface PersonalAccessTokensTable {
      id: Generated<number>
      name: string
      token: string
      plainTextToken: string
      abilities: string[]
      team_id: number 

      created_at: string
      updated_at: string
      deleted_at: string
    }

    interface AccessTokenResponse {
      data: PersonalAccessTokens
      paging: {
        total_records: number
        page: number
        total_pages: number
      }
      next_cursor: number | null
    }

    export type AccessTokenType = Selectable<PersonalAccessTokensTable>
    export type NewAccessToken = Insertable<PersonalAccessTokensTable>
    export type AccessTokenUpdate = Updateable<PersonalAccessTokensTable>
    export type PersonalAccessTokens = AccessTokenType[]

    export type AccessTokenColumn = PersonalAccessTokens
    export type AccessTokenColumns = Array<keyof PersonalAccessTokens>

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
      private results: any
      private hidden = ['password'] // TODO: this hidden functionality needs to be implemented still
      protected query: any

      public id: number | undefined
      public name: string | undefined
      public token: string | undefined
      public plainTextToken: string | undefined
      public abilities: string[] | undefined
      public team_id: number | undefined
      public created_at: string | undefined
      public updated_at: string | undefined

      constructor(accesstoken: Partial<AccessTokenType> | null) {
        this.id = accesstoken?.id
        this.name = accesstoken?.name
        this.token = accesstoken?.name
        this.plainTextToken = accesstoken?.plainTextToken
        this.abilities = accesstoken?.abilities
        this.team_id = accesstoken?.team_id
        this.created_at = accesstoken?.created_at
        this.updated_at = accesstoken?.updated_at
        this.query = null
        this.results = null
      }

      initialize() {

      }

      // Method to find a accesstoken by ID
      static async find(id: number, fields?: (keyof AccessTokenType)[]): Promise<AccessTokenModel | null> {
        let query = db.selectFrom('personal_access_tokens').where('id', '=', id)

        if (fields)
          query = query.select(fields)
        else
          query = query.selectAll()

        const model = await query.executeTakeFirst()

        if (!model)
          return null

        return new this(model)
      }

      static async findOrFail(id: number, fields?: (keyof AccessTokenType)[]): Promise<AccessTokenModel> {
        let query = db.selectFrom('personal_access_tokens').where('id', '=', id)

        if (fields)
          query = query.select(fields)
        else
          query = query.selectAll()

        const model = await query.executeTakeFirst()

        if (!model)
          throw(`No model results found for ${id} `)

        return new this(model)
      }

      static async findMany(ids: number[], fields?: (keyof AccessTokenType)[]): Promise<AccessTokenModel[]> {
        let query = db.selectFrom('personal_access_tokens').where('id', 'in', ids)

        if (fields)
          query = query.select(fields)
        else
          query = query.selectAll()

        const model = await query.execute()

        return model.map(modelItem => new AccessTokenModel(modelItem))
      }

      // Method to get a accesstoken by criteria
      static async fetch(criteria: Partial<AccessTokenType>, options: QueryOptions = {}): Promise<AccessTokenModel[]> {
        let query = db.selectFrom('personal_access_tokens')

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

      // Method to get a accesstoken by criteria
      static async get(): Promise<AccessTokenModel[]> {
        let query = db.selectFrom('personal_access_tokens')

        const model = await query.selectAll().execute()

        return model.map(modelItem => new AccessTokenModel(modelItem))
      }

        // Method to get a accesstoken by criteria
    async get(): Promise<AccessTokenModel[]> {
        const model = await this.query.execute()

        return model.map((modelItem: any) => new AccessTokenModel(modelItem))
    }

      // Method to get all personal_access_tokens
      static async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<AccessTokenResponse> {
        const totalRecordsResult = await db.selectFrom('personal_access_tokens')
          .select(db.fn.count('id').as('total')) // Use 'id' or another actual column name
          .executeTakeFirst()

        const totalRecords = Number(totalRecordsResult?.total) || 0
        const totalPages = Math.ceil(totalRecords / (options.limit ?? 10))

        const personal_access_tokensWithExtra = await db.selectFrom('personal_access_tokens')
          .selectAll()
          .orderBy('id', 'asc') // Assuming 'id' is used for cursor-based pagination
          .limit((options.limit ?? 10) + 1) // Fetch one extra record
          .offset((options.page - 1) * (options.limit ?? 10))
          .execute()

        let nextCursor = null
        if (personal_access_tokensWithExtra.length > (options.limit ?? 10))
          nextCursor = personal_access_tokensWithExtra.pop()!.id // Use the ID of the extra record as the next cursor

        return {
          data: personal_access_tokensWithExtra,
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
        const result = await db.insertInto('personal_access_tokens')
          .values(newAccessToken)
          .executeTakeFirstOrThrow()

        return await find(Number(result.insertId)) as AccessTokenModel
      }

      // Method to remove a accesstoken
      static async remove(id: number): Promise<void> {
        await db.deleteFrom('personal_access_tokens')
          .where('id', '=', id)
          .execute()
      }

    static where(...args: (string | number)[]): any {
        let column: any
        let operator: any
        let value: any

        const instance = new this(null);

        if (args.length === 2) {
          [column, value] = args
          operator = '='
        } else if (args.length === 3) {
            [column, operator, value] = args
        } else {
            throw new Error("Invalid number of arguments")
        }

        let query = db.selectFrom('personal_access_tokens')

        query = query.where(column, operator, value).selectAll()

        instance.query = query

        return instance
      }

    //   async whereIs(criteria: Partial<AccessTokenType>, options: QueryOptions = {}) {
    //     let query = db.selectFrom('personal_access_tokens')

    //     // Existing criteria checks
    //     if (criteria.id)
    //       query = query.where('id', '=', criteria.id) // Kysely is immutable, we must re-assign

    //     if (criteria.email)
    //       query = query.where('email', '=', criteria.email)

    //     if (criteria.name !== undefined) {
    //       query = query.where(
    //         'name',
    //         criteria.name === null ? 'is' : '=',
    //         criteria.name,
    //       )
    //     }

    //     if (criteria.password)
    //       query = query.where('password', '=', criteria.password)

    //     if (criteria.created_at)
    //       query = query.where('created_at', '=', criteria.created_at)

    //     if (criteria.updated_at)
    //       query = query.where('updated_at', '=', criteria.updated_at)

    //     if (criteria.deleted_at)
    //       query = query.where('deleted_at', '=', criteria.deleted_at)

    //     // Apply sorting from options
    //     if (options.sort)
    //       query = query.orderBy(options.sort.column, options.sort.order)

    //     // Apply pagination from options
    //     if (options.limit !== undefined)
    //       query = query.limit(options.limit)

    //     if (options.offset !== undefined)
    //       query = query.offset(options.offset)

    //     return await query.selectAll().execute()
    //   }

    //   async whereIn(column: keyof AccessTokenType, values: any[], options: QueryOptions = {}): Promise<AccessTokenType[]> {

    //     let query = db.selectFrom('personal_access_tokens')

    //     query = query.where(column, 'in', values)

    //     // Apply sorting from options
    //     if (options.sort)
    //       query = query.orderBy(options.sort.column, options.sort.order)

    //     // Apply pagination from options
    //     if (options.limit !== undefined)
    //       query = query.limit(options.limit)

    //     if (options.offset !== undefined)
    //       query = query.offset(options.offset)

    //     return await query.selectAll().execute()
    //   }

      async first(): Promise<AccessTokenType> {
        return this.query.executeTakeFirst()
      }

      static async first(): Promise<AccessTokenType> {
        return await db.selectFrom('personal_access_tokens')
          .selectAll()
          .executeTakeFirst()
      }

    //   async last(): Promise<AccessTokenType> {
    //     return await db.selectFrom('personal_access_tokens')
    //       .selectAll()
    //       .orderBy('id', 'desc')
    //       .executeTakeFirst()
    //   }

    //   async orderBy(column: keyof AccessTokenType, order: 'asc' | 'desc'): Promise<AccessTokenType[]> {
    //     return await db.selectFrom('personal_access_tokens')
    //       .selectAll()
    //       .orderBy(column, order)
    //       .execute()
    //   }

    //   async orderByDesc(column: keyof AccessTokenType): Promise<AccessTokenType[]> {
    //     return await db.selectFrom('personal_access_tokens')
    //       .selectAll()
    //       .orderBy(column, 'desc')
    //       .execute()
    //   }

    //   async orderByAsc(column: keyof AccessTokenType): Promise<AccessTokenType[]> {
    //     return await db.selectFrom('personal_access_tokens')
    //       .selectAll()
    //       .orderBy(column, 'asc')
    //       .execute()
    //   }

    //   // Method to get the accesstoken instance itself
    //   self(): AccessTokenModel {
    //     return this
    //   }

    //   // Method to get the accesstoken instance data
    //   get() {
    //     return this.accesstoken
    //   }

    //   // Method to update the accesstoken instance
    //   async update(accesstoken: AccessTokenUpdate): Promise<Result<AccessTokenType, Error>> {
    //     if (this.accesstoken.id === undefined)
    //       return err(handleError('AccessToken ID is undefined'))

    //     const updatedModel = await db.updateTable('personal_access_tokens')
    //       .set(accesstoken)
    //       .where('id', '=', this.accesstoken.id)
    //       .executeTakeFirst()

    //     if (!updatedModel)
    //       return err(handleError('AccessToken not found'))

    //     return ok(updatedModel)
    //   }

    //   // Method to save (insert or update) the accesstoken instance
    //   async save(): Promise<void> {
    //     if (!this.accesstoken)
    //       throw new Error('AccessToken data is undefined')

    //     if (this.accesstoken.id === undefined) {
    //       // Insert new accesstoken
    //       const newModel = await db.insertInto('personal_access_tokens')
    //         .values(this.accesstoken as NewAccessToken)
    //         .executeTakeFirstOrThrow()
    //     }
    //     else {
    //       // Update existing accesstoken
    //       await this.update(this.accesstoken)
    //     }
    //   }

      // Method to delete the accesstoken instance
      async delete(): Promise<void> {
        if (this.id === undefined)
          throw new Error('AccessToken ID is undefined')
        
        await db.deleteFrom('personal_access_tokens')
          .where('id', '=', this.id)
          .execute()
      }

    //   // Method to refresh the accesstoken instance data from the database
    //   async refresh(): Promise<void> {
    //     if (this.accesstoken.id === undefined)
    //       throw new Error('AccessToken ID is undefined')

    //     const refreshedModel = await db.selectFrom('personal_access_tokens')
    //       .where('id', '=', this.accesstoken.id)
    //       .selectAll()
    //       .executeTakeFirst()

    //     if (!refreshedModel)
    //       throw new Error('AccessToken not found')

    //     this.accesstoken = refreshedModel
    //   }

      
    //   async team() {
    //     if (this.accesstoken.id === undefined)
    //       throw new Error('Relation Error!')

    //     const model = await db.selectFrom('teams')
    //     .where('accesstoken_id', '=', this.accesstoken.id)
    //     .selectAll()
    //     .executeTakeFirst()

    //     if (! model)
    //       throw new Error('Model Relation Not Found!')

    //     return new Team.modelInstance(model)
    //   }



    //   toJSON() {
    //     const output: Partial<AccessTokenType> = { ...this.accesstoken }

    //     this.hidden.forEach((attr) => {
    //       if (attr in output)
    //         delete output[attr as keyof Partial<AccessTokenType>]
    //     })

    //     type AccessToken = Omit<AccessTokenType, 'password'>

    //     return output as AccessToken
    //   }
    }

    const result = await AccessTokenModel.remove(2)

    console.log(result)