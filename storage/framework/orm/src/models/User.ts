import type { ColumnType, Generated, Insertable, Selectable, Updateable } from 'kysely'
    import type { Result } from '@stacksjs/error-handling'
    import { err, handleError, ok } from '@stacksjs/error-handling'
    import { db } from '@stacksjs/database'
    import Post from './Post'

import Subscriber from './Subscriber'

import Deployment from './Deployment'


    // import { Kysely, MysqlDialect, PostgresDialect } from 'kysely'
    // import { Pool } from 'pg'

    // TODO: we need an action that auto-generates these table interfaces
    export interface UsersTable {
      id: Generated<number>
      name: string
      email: string
      jobTitle: string
      password: string
      deployment_id: number 
 post_id: number 

      created_at: ColumnType<Date, string | undefined, never>
      updated_at: ColumnType<Date, string | undefined, never>
      deleted_at: ColumnType<Date, string | undefined, never>
    }

    interface UserResponse {
      data: Users
      paging: {
        total_records: number
        page: number
        total_pages: number
      }
      next_cursor: number | null
    }

    export type UserType = Selectable<UsersTable>
    export type NewUser = Insertable<UsersTable>
    export type UserUpdate = Updateable<UsersTable>
    export type Users = UserType[]

    export type UserColumn = Users
    export type UserColumns = Array<keyof Users>

    type SortDirection = 'asc' | 'desc'
    interface SortOptions { column: UserType, order: SortDirection }
    // Define a type for the options parameter
    interface QueryOptions {
      sort?: SortOptions
      limit?: number
      offset?: number
      page?: number
    }

    export class UserModel {
      private user: Partial<UserType>
      private results: Partial<UserType>[]
      private hidden = ['password'] // TODO: this hidden functionality needs to be implemented still

      constructor(user: Partial<UserType>) {
        this.user = user
      }

      // Method to find a user by ID
      static async find(id: number, fields?: (keyof UserType)[]) {
        let query = db.selectFrom('users').where('id', '=', id)

        if (fields)
          query = query.select(fields)
        else
          query = query.selectAll()

        const model = await query.executeTakeFirst()

        if (!model)
          return null

        return new UserModel(model)
      }

      static async findMany(ids: number[], fields?: (keyof UserType)[]) {
        let query = db.selectFrom('users').where('id', 'in', ids)

        if (fields)
          query = query.select(fields)
        else
          query = query.selectAll()

        const model = await query.execute()

        return model.map(modelItem => new UserModel(modelItem))
      }

      // Method to get a user by criteria
      static async get(criteria: Partial<UserType>, options: QueryOptions = {}): Promise<UserModel[]> {
        let query = db.selectFrom('users')

        // Apply sorting from options
        if (options.sort)
          query = query.orderBy(options.sort.column, options.sort.order)

        // Apply limit and offset from options
        if (options.limit !== undefined)
          query = query.limit(options.limit)

        if (options.offset !== undefined)
          query = query.offset(options.offset)

        const model = await query.selectAll().execute()
        return model.map(modelItem => new UserModel(modelItem))
      }

      // Method to get all users
      static async all(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<UserResponse> {
        const totalRecordsResult = await db.selectFrom('users')
          .select(db.fn.count('id').as('total')) // Use 'id' or another actual column name
          .executeTakeFirst()

        const totalRecords = Number(totalRecordsResult?.total) || 0
        const totalPages = Math.ceil(totalRecords / (options.limit ?? 10))

        const usersWithExtra = await db.selectFrom('users')
          .selectAll()
          .orderBy('id', 'asc') // Assuming 'id' is used for cursor-based pagination
          .limit((options.limit ?? 10) + 1) // Fetch one extra record
          .offset((options.page - 1) * (options.limit ?? 10))
          .execute()

        let nextCursor = null
        if (usersWithExtra.length > (options.limit ?? 10))
          nextCursor = usersWithExtra.pop()!.id // Use the ID of the extra record as the next cursor

        return {
          data: usersWithExtra,
          paging: {
            total_records: totalRecords,
            page: options.page,
            total_pages: totalPages,
          },
          next_cursor: nextCursor,
        }
      }

      // Method to create a new user
      static async create(newUser: NewUser): Promise<UserModel> {
        const model = await db.insertInto('users')
          .values(newUser)
          .executeTakeFirstOrThrow()

          const result = await db.insertInto('users')
          .values(newUser)
          .executeTakeFirstOrThrow()
  
        return await find(Number(result.insertId))
      }

      // Method to update a user
      static async update(id: number, userUpdate: UserUpdate): Promise<UserModel> {
        const model = await db.updateTable('users')
          .set(userUpdate)
          .where('id', '=', id)
          .executeTakeFirstOrThrow()

        return new UserModel(model)
      }

      // Method to remove a user
      static async remove(id: number): Promise<UserModel> {
        const model = await db.deleteFrom('users')
          .where('id', '=', id)
          .executeTakeFirstOrThrow()

        return new UserModel(model)
      }

      async where(column: string, operator = '=', value: any) {
        let query = db.selectFrom('users')

        query = query.where(column, operator, value)

        return await query.selectAll().execute()
      }

      async whereIs(criteria: Partial<UserType>, options: QueryOptions = {}) {
        let query = db.selectFrom('users')

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

      async whereIn(column: keyof UserType, values: any[], options: QueryOptions = {}) {
        let query = db.selectFrom('users')

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
        return await db.selectFrom('users')
          .selectAll()
          .executeTakeFirst()
      }

      async last() {
        return await db.selectFrom('users')
          .selectAll()
          .orderBy('id', 'desc')
          .executeTakeFirst()
      }

      async orderBy(column: keyof UserType, order: 'asc' | 'desc') {
        return await db.selectFrom('users')
          .selectAll()
          .orderBy(column, order)
          .execute()
      }

      async orderByDesc(column: keyof UserType) {
        return await db.selectFrom('users')
          .selectAll()
          .orderBy(column, 'desc')
          .execute()
      }

      async orderByAsc(column: keyof UserType) {
        return await db.selectFrom('users')
          .selectAll()
          .orderBy(column, 'asc')
          .execute()
      }

      // Method to get the user instance itself
      self() {
        return this
      }

      // Method to get the user instance data
      get() {
        return this.user
      }

      // Method to update the user instance
      async update(user: UserUpdate): Promise<Result<UserType, Error>> {
        if (this.user.id === undefined)
          return err(handleError('User ID is undefined'))

        const updatedModel = await db.updateTable('users')
          .set(user)
          .where('id', '=', this.user.id)
          .executeTakeFirst()

        if (!updatedModel)
          return err(handleError('User not found'))

        this.user = updatedModel

        return ok(updatedModel)
      }

      // Method to save (insert or update) the user instance
      async save(): Promise<void> {
        if (!this.user)
          throw new Error('User data is undefined')

        if (this.user.id === undefined) {
          // Insert new user
          const newModel = await db.insertInto('users')
            .values(this.user as NewUser)
            .executeTakeFirstOrThrow()
          this.user = newModel
        }
        else {
          // Update existing user
          await this.update(this.user)
        }
      }

      // Method to delete the user instance
      async delete(): Promise<void> {
        if (this.user.id === undefined)
          throw new Error('User ID is undefined')

        await db.deleteFrom('users')
          .where('id', '=', this.user.id)
          .execute()

        this.user = {}
      }

      // Method to refresh the user instance data from the database
      async refresh(): Promise<void> {
        if (this.user.id === undefined)
          throw new Error('User ID is undefined')

        const refreshedModel = await db.selectFrom('users')
          .where('id', '=', this.user.id)
          .selectAll()
          .executeTakeFirst()

        if (!refreshedModel)
          throw new Error('User not found')

        this.user = refreshedModel
      }

      
      async post() {
        if (this.user.id === undefined)
          throw new Error('Relation Error!')

        const model = await db.selectFrom('posts')
        .where('user_id', '=', this.user.id)
        .selectAll()
        .executeTakeFirst()

        if (! model)
          throw new Error('Model Relation Not Found!')

        return new Post.modelInstance(model)
      }


      async subscriber() {
        if (this.user.id === undefined)
          throw new Error('Relation Error!')

        const model = await db.selectFrom('subscribers')
        .where('user_id', '=', this.user.id)
        .selectAll()
        .executeTakeFirst()

        if (! model)
          throw new Error('Model Relation Not Found!')

        return new Subscriber.modelInstance(model)
      }


      async deployments() {
        if (this.user.id === undefined)
          throw new Error('Relation Error!')

        const results = await db.selectFrom('deployments')
          .where('user_id', '=', this.user.id)
          .selectAll()
          .execute()

          return results
      }



      toJSON() {
        const output: Partial<UserType> = { ...this.user }

        this.hidden.forEach((attr) => {
          if (attr in output)
            delete output[attr as keyof Partial<UserType>]
        })

        type User = Omit<UserType, 'password'>

        return output as User
      }
    }

    const Model = UserModel

    // starting here, ORM functions
    export async function find(id: number, fields?: (keyof UserType)[]) {
      let query = db.selectFrom('users').where('id', '=', id)

      if (fields)
        query = query.select(fields)
      else
        query = query.selectAll()

      const model = await query.executeTakeFirst()

      if (!model)
        return null

      return new UserModel(model)
    }

    export async function findMany(ids: number[], fields?: (keyof UserType)[]) {
      let query = db.selectFrom('users').where('id', 'in', ids)

      if (fields)
        query = query.select(fields)
      else
        query = query.selectAll()

      const model = await query.execute()

      return model.map(modelItem => new UserModel(modelItem))
    }

    export async function count() {
      const results = await db.selectFrom('users')
        .selectAll()
        .execute()

      return results.length
    }

    export async function get(criteria: Partial<UserType>, sort: { column: keyof UserType, order: 'asc' | 'desc' } = { column: 'created_at', order: 'desc' }) {
      let query = db.selectFrom('users')

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
      return await db.selectFrom('users')
        .selectAll()
        .orderBy('created_at', 'desc')
        .limit(limit)
        .offset(offset)
        .execute()
    }

    export async function create(newUser: NewUser) {
      const result = await db.insertInto('users')
      .values(newUser)
      .executeTakeFirstOrThrow()

      return await find(Number(result.insertId))
    }

    export async function first() {
     return await db.selectFrom('users')
        .selectAll()
        .executeTakeFirst()
    }

    export async function recent(limit: number) {
      return await db.selectFrom('users')
         .selectAll()
         .limit(limit)
         .execute()
     }

     export async function last(limit: number) {
      return await db.selectFrom('users')
         .selectAll()
         .orderBy('id', 'desc')
         .limit(limit)
         .execute()
     }

    export async function update(id: number, userUpdate: UserUpdate) {
      return await db.updateTable('users')
        .set(userUpdate)
        .where('id', '=', id)
        .execute()
    }

    export async function remove(id: number) {
      return await db.deleteFrom('users')
        .where('id', '=', id)
        .executeTakeFirst()
    }

    export async function where(column: string, operator = '=', value: any) {
      let query = db.selectFrom('users')

      query = query.where(column, operator, value)

      return await query.selectAll().execute()
    }

    export async function whereIs(
      criteria: Partial<UserType>,
      options: QueryOptions = {},
    ) {
      let query = db.selectFrom('users')

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
      column: keyof UserType,
      values: any[],
      options: QueryOptions = {},
    ) {
      let query = db.selectFrom('users')

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

    export const User = {
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
      model: UserModel
    }

    export default User
    