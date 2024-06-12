import type { ColumnType, Generated, Insertable, Selectable, Updateable } from 'kysely'
    import type { Result } from '@stacksjs/error-handling'
    import { err, handleError, ok } from '@stacksjs/error-handling'
    import { db } from '@stacksjs/database'
    
    // import { Kysely, MysqlDialect, PostgresDialect } from 'kysely'
    // import { Pool } from 'pg'

    // TODO: we need an action that auto-generates these table interfaces
    export interface SubscriberEmailsTable {
      id: Generated<number>
      email: string
     
      created_at: ColumnType<Date, string | undefined, never>
      updated_at: ColumnType<Date, string | undefined, never>
      deleted_at: ColumnType<Date, string | undefined, never>
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
      private subscriberemail: Partial<SubscriberEmailType>
      private results: Partial<SubscriberEmailType>[]
      private hidden = ['password'] // TODO: this hidden functionality needs to be implemented still

      constructor(subscriberemail: Partial<SubscriberEmailType>) {
        this.subscriberemail = subscriberemail
      }

      // Method to find a subscriberemail by ID
      static async find(id: number, fields?: (keyof SubscriberEmailType)[]): Promise<SubscriberEmailModel> {
        let query = db.selectFrom('subscriber_emails').where('id', '=', id)

        if (fields)
          query = query.select(fields)
        else
          query = query.selectAll()

        const model = await query.executeTakeFirst()

        if (!model)
          return null

        return new SubscriberEmailModel(model)
      }

      static async findOrFail(id: number, fields?: (keyof SubscriberEmailType)[]): Promise<SubscriberEmailModel> {
        let query = db.selectFrom('subscriber_emails').where('id', '=', id)

        if (fields)
          query = query.select(fields)
        else
          query = query.selectAll()

        const model = await query.executeTakeFirst()

        if (!model)
          throw(`No model results found for ${id} `)

        return new SubscriberEmailModel(model)
      }

      static async findMany(ids: number[], fields?: (keyof SubscriberEmailType)[]): Promise<SubscriberEmailModel[]> {
        let query = db.selectFrom('subscriber_emails').where('id', 'in', ids)

        if (fields)
          query = query.select(fields)
        else
          query = query.selectAll()

        const model = await query.execute()

        return model.map(modelItem => new SubscriberEmailModel(modelItem))
      }

      // Method to get a subscriberemail by criteria
      static async get(criteria: Partial<SubscriberEmailType>, options: QueryOptions = {}): Promise<SubscriberEmailModel[]> {
        let query = db.selectFrom('subscriber_emails')

        // Apply sorting from options
        if (options.sort)
          query = query.orderBy(options.sort.column, options.sort.order)

        // Apply limit and offset from options
        if (options.limit !== undefined)
          query = query.limit(options.limit)

        if (options.offset !== undefined)
          query = query.offset(options.offset)

        const model = await query.selectAll().execute()
        return model.map(modelItem => new SubscriberEmailModel(modelItem))
      }

      // Method to get all subscriber_emails
      static async all(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<SubscriberEmailResponse> {
        const totalRecordsResult = await db.selectFrom('subscriber_emails')
          .select(db.fn.count('id').as('total')) // Use 'id' or another actual column name
          .executeTakeFirst()

        const totalRecords = Number(totalRecordsResult?.total) || 0
        const totalPages = Math.ceil(totalRecords / (options.limit ?? 10))

        const subscriber_emailsWithExtra = await db.selectFrom('subscriber_emails')
          .selectAll()
          .orderBy('id', 'asc') // Assuming 'id' is used for cursor-based pagination
          .limit((options.limit ?? 10) + 1) // Fetch one extra record
          .offset((options.page - 1) * (options.limit ?? 10))
          .execute()

        let nextCursor = null
        if (subscriber_emailsWithExtra.length > (options.limit ?? 10))
          nextCursor = subscriber_emailsWithExtra.pop()!.id // Use the ID of the extra record as the next cursor

        return {
          data: subscriber_emailsWithExtra,
          paging: {
            total_records: totalRecords,
            page: options.page,
            total_pages: totalPages,
          },
          next_cursor: nextCursor,
        }
      }

      // Method to create a new subscriberemail
      static async create(newSubscriberEmail: NewSubscriberEmail): Promise<SubscriberEmailModel> {
        const result = await db.insertInto('subscriber_emails')
          .values(newSubscriberEmail)
          .executeTakeFirstOrThrow()

        return await find(Number(result.insertId)) as SubscriberEmailModel
      }

      // Method to remove a subscriberemail
      static async remove(id: number): Promise<SubscriberEmailModel> {
        const model = await db.deleteFrom('subscriber_emails')
          .where('id', '=', id)
          .executeTakeFirstOrThrow()

        return new SubscriberEmailModel(model)
      }

      async where(...args: (string | number)[]): Promise<SubscriberEmailType[]> {
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

        let query = db.selectFrom('subscriber_emails')

        query = query.where(column, operator, value)

        return await query.selectAll()
      }

      async whereIs(criteria: Partial<SubscriberEmailType>, options: QueryOptions = {}) {
        let query = db.selectFrom('subscriber_emails')

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

      async whereIn(column: keyof SubscriberEmailType, values: any[], options: QueryOptions = {}): Promise<SubscriberEmailType[]> {

        let query = db.selectFrom('subscriber_emails')

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

      async first(): Promise<SubscriberEmailType> {
        return await db.selectFrom('subscriber_emails')
          .selectAll()
          .executeTakeFirst()
      }

      async last(): Promise<SubscriberEmailType> {
        return await db.selectFrom('subscriber_emails')
          .selectAll()
          .orderBy('id', 'desc')
          .executeTakeFirst()
      }

      async orderBy(column: keyof SubscriberEmailType, order: 'asc' | 'desc'): Promise<SubscriberEmailType[]> {
        return await db.selectFrom('subscriber_emails')
          .selectAll()
          .orderBy(column, order)
          .execute()
      }

      async orderByDesc(column: keyof SubscriberEmailType): Promise<SubscriberEmailType[]> {
        return await db.selectFrom('subscriber_emails')
          .selectAll()
          .orderBy(column, 'desc')
          .execute()
      }

      async orderByAsc(column: keyof SubscriberEmailType): Promise<SubscriberEmailType[]> {
        return await db.selectFrom('subscriber_emails')
          .selectAll()
          .orderBy(column, 'asc')
          .execute()
      }

      // Method to get the subscriberemail instance itself
      self(): SubscriberEmailModel {
        return this
      }

      // Method to get the subscriberemail instance data
      get() {
        return this.subscriberemail
      }

      // Method to update the subscriberemail instance
      async update(subscriberemail: SubscriberEmailUpdate): Promise<Result<SubscriberEmailType, Error>> {
        if (this.subscriberemail.id === undefined)
          return err(handleError('SubscriberEmail ID is undefined'))

        const updatedModel = await db.updateTable('subscriber_emails')
          .set(subscriberemail)
          .where('id', '=', this.subscriberemail.id)
          .executeTakeFirst()

        if (!updatedModel)
          return err(handleError('SubscriberEmail not found'))

        return ok(updatedModel)
      }

      // Method to save (insert or update) the subscriberemail instance
      async save(): Promise<void> {
        if (!this.subscriberemail)
          throw new Error('SubscriberEmail data is undefined')

        if (this.subscriberemail.id === undefined) {
          // Insert new subscriberemail
          const newModel = await db.insertInto('subscriber_emails')
            .values(this.subscriberemail as NewSubscriberEmail)
            .executeTakeFirstOrThrow()
        }
        else {
          // Update existing subscriberemail
          await this.update(this.subscriberemail)
        }
      }

      // Method to delete the subscriberemail instance
      async delete(): Promise<void> {
        if (this.subscriberemail.id === undefined)
          throw new Error('SubscriberEmail ID is undefined')

        await db.deleteFrom('subscriber_emails')
          .where('id', '=', this.subscriberemail.id)
          .execute()

        this.subscriberemail = {}
      }

      // Method to refresh the subscriberemail instance data from the database
      async refresh(): Promise<void> {
        if (this.subscriberemail.id === undefined)
          throw new Error('SubscriberEmail ID is undefined')

        const refreshedModel = await db.selectFrom('subscriber_emails')
          .where('id', '=', this.subscriberemail.id)
          .selectAll()
          .executeTakeFirst()

        if (!refreshedModel)
          throw new Error('SubscriberEmail not found')

        this.subscriberemail = refreshedModel
      }

      

      toJSON() {
        const output: Partial<SubscriberEmailType> = { ...this.subscriberemail }

        this.hidden.forEach((attr) => {
          if (attr in output)
            delete output[attr as keyof Partial<SubscriberEmailType>]
        })

        type SubscriberEmail = Omit<SubscriberEmailType, 'password'>

        return output as SubscriberEmail
      }
    }

    const Model = SubscriberEmailModel

    // starting here, ORM functions
    export async function find(id: number, fields?: (keyof SubscriberEmailType)[]) {
      let query = db.selectFrom('subscriber_emails').where('id', '=', id)

      if (fields)
        query = query.select(fields)
      else
        query = query.selectAll()

      const model = await query.executeTakeFirst()

      if (!model)
        return null

      return new SubscriberEmailModel(model)
    }

    export async function findOrFail(id: number, fields?: (keyof SubscriberEmailType)[]) {
      let query = db.selectFrom('subscriber_emails').where('id', '=', id)

      if (fields)
        query = query.select(fields)
      else
        query = query.selectAll()

      const model = await query.executeTakeFirst()

      if (!model)
        throw(`No model results found for ${id} `)

      return new SubscriberEmailModel(model)
    }

    export async function findMany(ids: number[], fields?: (keyof SubscriberEmailType)[]) {
      let query = db.selectFrom('subscriber_emails').where('id', 'in', ids)

      if (fields)
        query = query.select(fields)
      else
        query = query.selectAll()

      const model = await query.execute()

      return model.map(modelItem => new SubscriberEmailModel(modelItem))
    }

    export async function count(): Number {
      const results = await db.selectFrom('subscriber_emails')
        .selectAll()
        .execute()

      return results.length
    }

    export async function get(criteria: Partial<SubscriberEmailType>, sort: { column: keyof SubscriberEmailType, order: 'asc' | 'desc' } = { column: 'created_at', order: 'desc' }) {
      let query = db.selectFrom('subscriber_emails')

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

    export async function all(limit: number = 10, offset: number = 0): Promise<SubscriberEmailType[]> {
      return await db.selectFrom('subscriber_emails')
        .selectAll()
        .orderBy('created_at', 'desc')
        .limit(limit)
        .offset(offset)
        .execute()
    }

    export async function create(newSubscriberEmail: NewSubscriberEmail): Promise<SubscriberEmailModel> {
      const result = await db.insertInto('subscriber_emails')
      .values(newSubscriberEmail)
      .executeTakeFirstOrThrow()

      return await find(Number(result.insertId))
    }

    export async function first(): Promise<SubscriberEmailModel> {
     return await db.selectFrom('subscriber_emails')
        .selectAll()
        .executeTakeFirst()
    }

    export async function recent(limit: number): Promise<SubscriberEmailModel[]> {
      return await db.selectFrom('subscriber_emails')
         .selectAll()
         .limit(limit)
         .execute()
     }

     export async function last(limit: number): Promise<SubscriberEmailType> {
      return await db.selectFrom('subscriber_emails')
         .selectAll()
         .orderBy('id', 'desc')
         .limit(limit)
         .execute()
     }

    export async function update(id: number, subscriberemailUpdate: SubscriberEmailUpdate) {
      return await db.updateTable('subscriber_emails')
        .set(subscriberemailUpdate)
        .where('id', '=', id)
        .execute()
    }

    export async function remove(id: number) {
      return await db.deleteFrom('subscriber_emails')
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

      let query = db.selectFrom('subscriber_emails')

      query = query.where(column, operator, value)

      return await query.selectAll()
    }

    export async function whereIs(
      criteria: Partial<SubscriberEmailType>,
      options: QueryOptions = {},
    ) {
      let query = db.selectFrom('subscriber_emails')

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
      column: keyof SubscriberEmailType,
      values: any[],
      options: QueryOptions = {},
    ) {
      let query = db.selectFrom('subscriber_emails')

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

    export const SubscriberEmail = {
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
      model: SubscriberEmailModel
    }

    export default SubscriberEmail
    