import type { Generated, Insertable, Selectable, Updateable } from 'kysely'
    import { db } from '@stacksjs/database'
    import { sql } from '@stacksjs/database'
    import { dispatch } from '@stacksjs/events'
    import { generateTwoFactorSecret } from '@stacksjs/auth'
    import { verifyTwoFactorCode } from '@stacksjs/auth'
    import { cache } from '@stacksjs/cache'
    
    // import { Kysely, MysqlDialect, PostgresDialect } from 'kysely'
    // import { Pool } from 'pg'

    // TODO: we need an action that auto-generates these table interfaces
    export interface SubscriberEmailsTable {
      id: Generated<number>
      email?: string
     
      created_at?: Date

      updated_at?: Date
    
    deleted_at?: Date
  
    }

    interface SubscriberEmailResponse {
      data: SubscriberEmails
      paging: {
        total_records: number
        page: number
        total_pages: number
      }
      next_cursor: number | null
    }

    export type SubscriberEmailType = Selectable<SubscriberEmailsTable>
    export type NewSubscriberEmail = Insertable<SubscriberEmailsTable>
    export type SubscriberEmailUpdate = Updateable<SubscriberEmailsTable>
    export type SubscriberEmails = SubscriberEmailType[]

    export type SubscriberEmailColumn = SubscriberEmails
    export type SubscriberEmailColumns = Array<keyof SubscriberEmails>

    type SortDirection = 'asc' | 'desc'
    interface SortOptions { column: SubscriberEmailType, order: SortDirection }
    // Define a type for the options parameter
    interface QueryOptions {
      sort?: SortOptions
      limit?: number
      offset?: number
      page?: number
    }

    export class SubscriberEmailModel {
      private hidden = []
      private fillable = ["email"]
      private softDeletes = true
      protected query: any
      protected hasSelect: boolean
      public id: number | undefined 
   public email: string | undefined 
   
      public created_at: Date | undefined
      public updated_at: Date | undefined
    
      public deleted_at: string | undefined
    
      constructor(subscriberemail: Partial<SubscriberEmailType> | null) {
        this.id = subscriberemail?.id
   this.email = subscriberemail?.email
   
      this.created_at = subscriberemail?.created_at

      this.updated_at = subscriberemail?.updated_at

    
      this.deleted_at = subscriberemail?.deleted_at

    

        this.query = db.selectFrom('subscriber_emails')
        this.hasSelect = false
      }

      // Method to find a SubscriberEmail by ID
      async find(id: number): Promise<SubscriberEmailModel | undefined> {
        let query = db.selectFrom('subscriber_emails').where('id', '=', id).selectAll()

        const model = await query.executeTakeFirst()

        if (!model)
          return undefined

        cache.getOrSet(`subscriberemail:${id}`, JSON.stringify(model))

        return this.parseResult(new SubscriberEmailModel(model))
      }

      // Method to find a SubscriberEmail by ID
      static async find(id: number): Promise<SubscriberEmailModel | undefined> {
        let query = db.selectFrom('subscriber_emails').where('id', '=', id).selectAll()

        const instance = new SubscriberEmailModel(null)

        const model = await query.executeTakeFirst()

        if (!model)
          return undefined

        cache.getOrSet(`subscriberemail:${id}`, JSON.stringify(model))

        return instance.parseResult(new SubscriberEmailModel(model))
      }

      static async all(): Promise<SubscriberEmailModel[]> {
        let query = db.selectFrom('subscriber_emails').selectAll()

        const instance = new SubscriberEmailModel(null)

        if (instance.softDeletes) {
          query = query.where('deleted_at', 'is', null)
        }

        const results = await query.execute();

        return results.map(modelItem => instance.parseResult(new SubscriberEmailModel(modelItem)));
      }


      static async findOrFail(id: number): Promise<SubscriberEmailModel> {
        let query = db.selectFrom('subscriber_emails').where('id', '=', id)

        const instance = new SubscriberEmailModel(null)

        if (instance.softDeletes) {
          query = query.where('deleted_at', 'is', null);
        }

        query = query.selectAll()

        const model = await query.executeTakeFirst()

        if (model === undefined)
          throw new Error(JSON.stringify({ status: 404, message: No model results found for query }))

        cache.getOrSet(`subscriberemail:${id}`, JSON.stringify(model))

        return instance.parseResult(new SubscriberEmailModel(model))
      }

      static async findMany(ids: number[]): Promise<SubscriberEmailModel[]> {
        let query = db.selectFrom('subscriber_emails').where('id', 'in', ids)

        const instance = new SubscriberEmailModel(null)

        if (instance.softDeletes) {
          query = query.where('deleted_at', 'is', null);
        }

        query = query.selectAll()

        const model = await query.execute()

        return model.map(modelItem => instance.parseResult(new SubscriberEmailModel(modelItem)))
      }

      // Method to get a User by criteria
      static async get(): Promise<UserModel[]> {
        const instance = new SubscriberEmailModel(null)

        if (instance.hasSelect) {
          if (instance.softDeletes) {
            instance.query = instance.query.where('deleted_at', 'is', null)
          }

          const model = await instance.query.execute()

          return model.map((modelItem: SubscriberEmailModel) => new SubscriberEmailModel(modelItem))
        }

        if (instance.softDeletes) {
          instance.query = instance.query.where('deleted_at', 'is', null)
        }

        const model = await instance.query.selectAll().execute()

       return model.map((modelItem: SubscriberEmailModel) => new SubscriberEmailModel(modelItem))
      }


      // Method to get a SubscriberEmail by criteria
      async get(): Promise<SubscriberEmailModel[]> {
        if (this.hasSelect) {

          if (this.softDeletes) {
            this.query = this.query.where('deleted_at', 'is', null);
          }

          const model = await this.query.execute()

          return model.map((modelItem: SubscriberEmailModel) => new SubscriberEmailModel(modelItem))
        }

        if (this.softDeletes) {
          this.query = this.query.where('deleted_at', 'is', null);
        }

        const model = await this.query.selectAll().execute()

        return model.map((modelItem: SubscriberEmailModel) => new SubscriberEmailModel(modelItem))
      }

      static async count(): Promise<number> {
        const instance = new SubscriberEmailModel(null)

        if (instance.softDeletes) {
          instance.query = instance.query.where('deleted_at', 'is', null);
        }

        const results = await instance.query.selectAll().execute()

        return results.length
      }

      async count(): Promise<number> {
        if (this.hasSelect) {

          if (this.softDeletes) {
            this.query = this.query.where('deleted_at', 'is', null);
          }

          const results = await this.query.execute()

          return results.length
        }

        const results = await this.query.selectAll().execute()

        return results.length
      }

      // Method to get all subscriber_emails
      static async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<SubscriberEmailResponse> {
        const totalRecordsResult = await db.selectFrom('subscriber_emails')
          .select(db.fn.count('id').as('total')) // Use 'id' or another actual column name
          .executeTakeFirst()

        const totalRecords = Number(totalRecordsResult?.total) || 0
        const totalPages = Math.ceil(totalRecords / (options.limit ?? 10))

        const subscriber_emailsWithExtra = await db.selectFrom('subscriber_emails')
          .selectAll()
          .orderBy('id', 'asc') // Assuming 'id' is used for cursor-based pagination
          .limit((options.limit ?? 10) + 1) // Fetch one extra record
          .offset(((options.page ?? 1) - 1) * (options.limit ?? 10)) // Ensure options.page is not undefined
          .execute()


          let nextCursor = null
          if (subscriber_emailsWithExtra.length > (options.limit ?? 10)) nextCursor = subscriber_emailsWithExtra.pop()?.id ?? null

        return {
          data: subscriber_emailsWithExtra,
          paging: {
            total_records: totalRecords,
            page: options.page || 1,
            total_pages: totalPages,
          },
          next_cursor: nextCursor,
        }
      }

      // Method to create a new subscriberemail
      static async create(newSubscriberEmail: NewSubscriberEmail): Promise<SubscriberEmailModel> {
        const instance = new SubscriberEmailModel(null)

         const filteredValues = Object.fromEntries(
          Object.entries(newSubscriberEmail).filter(([key]) => instance.fillable.includes(key)),
        ) as NewSubscriberEmail

        const result = await db.insertInto('subscriber_emails')
          .values(filteredValues)
          .executeTakeFirstOrThrow()

        const model = await find(Number(result.insertId)) as SubscriberEmailModel

        

        return model
      }

      static async forceCreate(newSubscriberEmail: NewSubscriberEmail): Promise<SubscriberEmailModel> {
        const result = await db.insertInto('subscriber_emails')
          .values(newSubscriberEmail)
          .executeTakeFirstOrThrow()

        const model = await find(Number(result.insertId)) as SubscriberEmailModel

        

        return model
      }

      // Method to remove a SubscriberEmail
      static async remove(id: number): Promise<void> {
        const instance = new SubscriberEmailModel(null)
        
        
        if (instance.softDeletes) {
        await db.updateTable('subscriber_emails')
          .set({
            deleted_at: sql.raw('CURRENT_TIMESTAMP')
          })
          .where('id', '=', id)
          .execute();
        } else {
          await db.deleteFrom('subscriber_emails')
            .where('id', '=', id)
            .execute();
        }


        
      }

      where(...args: (string | number | boolean | undefined | null)[]): SubscriberEmailModel {
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

        this.query = this.query.where(column, operator, value)

        return this
      }

      static where(...args: (string | number | boolean | undefined | null)[]): SubscriberEmailModel {
        let column: any
        let operator: any
        let value: any

        const instance = new SubscriberEmailModel(null)

        if (args.length === 2) {
          [column, value] = args
          operator = '='
        } else if (args.length === 3) {
            [column, operator, value] = args
        } else {
            throw new Error("Invalid number of arguments")
        }

        instance.query = instance.query.where(column, operator, value)

        return instance
      }

       static whereEmail(value: string): SubscriberEmailModel {
        const instance = new SubscriberEmailModel(null)

        instance.query = instance.query.where('email', '=', value)

        return instance
      } 



      static whereIn(column: keyof SubscriberEmailType, values: any[]): SubscriberEmailModel {
        const instance = new SubscriberEmailModel(null)

        instance.query = instance.query.where(column, 'in', values)

        return instance
      }

      async first(): Promise<SubscriberEmailModel | undefined> {
        const model = await this.query.selectAll().executeTakeFirst()

        if (! model) {
          return undefined
        }

        return this.parseResult(new SubscriberEmailModel(model))
      }

      async firstOrFail(): Promise<SubscriberEmailModel | undefined> {
        const model = await this.query.selectAll().executeTakeFirst()

        if (model === undefined)
          throw new Error(JSON.stringify({ status: 404, message: No model results found for query }))

        return this.parseResult(new SubscriberEmailModel(model))
      }

      async exists(): Promise<boolean> {
        const model = await this.query.selectAll().executeTakeFirst()

        return model !== null || model !== undefined
      }

      static async first(): Promise<SubscriberEmailType | undefined> {
        return await db.selectFrom('subscriber_emails')
          .selectAll()
          .executeTakeFirst()
      }

      async last(): Promise<SubscriberEmailType | undefined> {
        return await db.selectFrom('subscriber_emails')
          .selectAll()
          .orderBy('id', 'desc')
          .executeTakeFirst()
      }

      static async last(): Promise<SubscriberEmailType | undefined> {
        return await db.selectFrom('subscriber_emails').selectAll().orderBy('id', 'desc').executeTakeFirst()
      }

      static orderBy(column: keyof SubscriberEmailType, order: 'asc' | 'desc'): SubscriberEmailModel {
        const instance = new SubscriberEmailModel(null)

        instance.query = instance.query.orderBy(column, order)

        return instance
      }

      orderBy(column: keyof SubscriberEmailType, order: 'asc' | 'desc'): SubscriberEmailModel {
        this.query = this.query.orderBy(column, order)

        return this
      }

      static orderByDesc(column: keyof SubscriberEmailType): SubscriberEmailModel {
        const instance = new SubscriberEmailModel(null)

        instance.query = instance.query.orderBy(column, 'desc')

        return instance
      }

      orderByDesc(column: keyof SubscriberEmailType): SubscriberEmailModel {
        this.query = this.orderBy(column, 'desc')

        return this
      }

      static orderByAsc(column: keyof SubscriberEmailType): SubscriberEmailModel {
        const instance = new SubscriberEmailModel(null)

        instance.query = instance.query.orderBy(column, 'asc')

        return instance
      }

      orderByAsc(column: keyof SubscriberEmailType): SubscriberEmailModel {
        this.query = this.query.orderBy(column, 'desc')

        return this
      }

      async update(subscriberemail: SubscriberEmailUpdate): Promise<SubscriberEmailModel | undefined> {
        if (this.id === undefined)
          throw new Error('SubscriberEmail ID is undefined')

        const filteredValues = Object.fromEntries(
          Object.entries(subscriberemail).filter(([key]) => this.fillable.includes(key)),
        ) as NewSubscriberEmail

        await db.updateTable('subscriber_emails')
          .set(filteredValues)
          .where('id', '=', this.id)
          .executeTakeFirst()

        const model = await this.find(Number(this.id))


          

        return model
      }

      async forceUpdate(subscriberemail: SubscriberEmailUpdate): Promise<SubscriberEmailModel | undefined> {
        if (this.id === undefined)
          throw new Error('SubscriberEmail ID is undefined')

        await db.updateTable('subscriber_emails')
          .set(subscriberemail)
          .where('id', '=', this.id)
          .executeTakeFirst()

        const model = await this.find(Number(this.id))


          

        return model
      }

      async save(): Promise<void> {
        if (!this)
          throw new Error('SubscriberEmail data is undefined')

        if (this.id === undefined) {
          await db.insertInto('subscriber_emails')
            .values(this as NewSubscriberEmail)
            .executeTakeFirstOrThrow()
        }
        else {
          await this.update(this)
        }
      }

      // Method to delete (soft delete) the subscriberemail instance
      async delete(): Promise<void> {
          if (this.id === undefined)
              throw new Error('SubscriberEmail ID is undefined')

          

          // Check if soft deletes are enabled
          if (this.softDeletes) {
              // Update the deleted_at column with the current timestamp
              await db.updateTable('subscriber_emails')
                  .set({
                      deleted_at: sql.raw('CURRENT_TIMESTAMP')
                  })
                  .where('id', '=', this.id)
                  .execute();
          } else {
              // Perform a hard delete
              await db.deleteFrom('subscriber_emails')
                .where('id', '=', this.id)
                .execute();
          }


          
      }

      

      distinct(column: keyof SubscriberEmailType): SubscriberEmailModel {
        this.query = this.query.select(column).distinct()

        this.hasSelect = true

        return this
      }

      static distinct(column: keyof SubscriberEmailType): SubscriberEmailModel {
        const instance = new SubscriberEmailModel(null)

        instance.query = instance.query.select(column).distinct()

        instance.hasSelect = true

        return instance
      }

      join(table: string, firstCol: string, secondCol: string): SubscriberEmailModel {
        this.query = this.query.innerJoin(table, firstCol, secondCol)

        return this
      }

      static join(table: string, firstCol: string, secondCol: string): SubscriberEmailModel {
        const instance = new SubscriberEmailModel(null)

        instance.query = instance.query.innerJoin(table, firstCol, secondCol)

        return instance
      }

      static async rawQuery(rawQuery: string): Promise<any> {
        return await sql`${rawQuery}`.execute(db)
      }

      toJSON() {
        const output: Partial<SubscriberEmailType> = {

id: this.id,
email: this.email,
   
      created_at: this.created_at,

      updated_at: this.updated_at,

    
      deleted_at: this.deleted_at,

    }


        type SubscriberEmail = Omit<SubscriberEmailType, 'password'>

        return output as SubscriberEmail
      }

        parseResult(model: SubscriberEmailModel): SubscriberEmailModel {
          for (const hiddenAttribute of this.hidden) {
            delete model[hiddenAttribute as keyof SubscriberEmailModel]
          }

          return model
        }

      
    }

    async function find(id: number): Promise<SubscriberEmailModel | undefined> {
      let query = db.selectFrom('subscriber_emails').where('id', '=', id).selectAll()

      const model = await query.executeTakeFirst()

      if (!model) return undefined

      return new SubscriberEmailModel(model)
    }

    export async function count(): Promise<number> {
      const results = await SubscriberEmailModel.count()

      return results
    }

    export async function create(newSubscriberEmail: NewSubscriberEmail): Promise<SubscriberEmailModel> {

      const result = await db.insertInto('subscriber_emails')
        .values(newSubscriberEmail)
        .executeTakeFirstOrThrow()

      return await find(Number(result.insertId)) as SubscriberEmailModel
    }

    export async function rawQuery(rawQuery: string): Promise<any> {
      return await sql`${rawQuery}`.execute(db)
    }

    export async function remove(id: number): Promise<void> {
      await db.deleteFrom('subscriber_emails')
        .where('id', '=', id)
        .execute()
    }

    export async function whereEmail(value: string): Promise<SubscriberEmailModel[]> {
        const query = db.selectFrom('subscriber_emails').where('email', '=', value)
        const results = await query.execute()

        return results.map(modelItem => new SubscriberEmailModel(modelItem))
      } 



    export const SubscriberEmail = SubscriberEmailModel

    export default SubscriberEmail
    