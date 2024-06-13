import { db } from '@stacksjs/database'
import type { Result } from '@stacksjs/error-handling'
import { err, handleError, ok } from '@stacksjs/error-handling'
import type { ColumnType, Generated, Insertable, Selectable, Updateable } from 'kysely'
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
interface SortOptions {
  column: UserType
  order: SortDirection
}
// Define a type for the options parameter
interface QueryOptions {
  sort?: SortOptions
  limit?: number
  offset?: number
  page?: number
}

export class UserModel {
  private user: Partial<UserType> | null
  private results: Partial<UserType>[]
  private hidden = ['password'] // TODO: this hidden functionality needs to be implemented still
  protected query: any
  public id: number | undefined
  public name: string | undefined
  public email: string | undefined
  public jobTitle: string | undefined
  public password: string | undefined
  public deployment_id: number | undefined
  public post_id: number | undefined

  constructor(user: Partial<UserType> | null) {
    this.user = user
    this.id = user?.id
    this.name = user?.name
    this.email = user?.email
    this.jobTitle = user?.jobTitle
    this.password = user?.password
    this.deployment_id = user?.deployment_id
    this.post_id = user?.post_id

    this.query = db.selectFrom('users')
  }

  // Method to find a User by ID
  async find(id: number, fields?: (keyof UserType)[]): Promise<UserModel | null> {
    let query = db.selectFrom('users').where('id', '=', id)

    if (fields) query = query.select(fields)
    else query = query.selectAll()

    const model = await query.executeTakeFirst()

    if (!model) return null

    return this
  }

  // Method to find a User by ID
  static async find(id: number, fields?: (keyof UserType)[]): Promise<UserModel | null> {
    let query = db.selectFrom('users').where('id', '=', id)

    if (fields) query = query.select(fields)
    else query = query.selectAll()

    const model = await query.executeTakeFirst()

    if (!model) return null

    return new this(model)
  }

  static async findOrFail(id: number, fields?: (keyof UserType)[]): Promise<UserModel> {
    let query = db.selectFrom('users').where('id', '=', id)

    if (fields) query = query.select(fields)
    else query = query.selectAll()

    const model = await query.executeTakeFirst()

    if (!model) throw `No model results found for ${id} `

    return new this(model)
  }

  static async findMany(ids: number[], fields?: (keyof UserType)[]): Promise<UserModel[]> {
    let query = db.selectFrom('users').where('id', 'in', ids)

    if (fields) query = query.select(fields)
    else query = query.selectAll()

    const model = await query.execute()

    return model.map((modelItem) => new UserModel(modelItem))
  }

  // Method to get a User by criteria
  static async fetch(criteria: Partial<AccessTokenType>, options: QueryOptions = {}): Promise<UserModel[]> {
    let query = db.selectFrom('users')

    // Apply sorting from options
    if (options.sort) query = query.orderBy(options.sort.column, options.sort.order)

    // Apply limit and offset from options
    if (options.limit !== undefined) query = query.limit(options.limit)

    if (options.offset !== undefined) query = query.offset(options.offset)

    const model = await query.selectAll().execute()
    return model.map((modelItem) => new UserModel(modelItem))
  }

  // Method to get a User by criteria
  static async get(): Promise<UserModel[]> {
    const query = db.selectFrom('users')

    const model = await query.selectAll().execute()

    return model.map((modelItem) => new UserModel(modelItem))
  }

  // Method to get a User by criteria
  async get(): Promise<UserModel[]> {
    return await this.query.selectAll().execute()
  }

  // Method to get all users
  static async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<UserResponse> {
    const totalRecordsResult = await db
      .selectFrom('users')
      .select(db.fn.count('id').as('total')) // Use 'id' or another actual column name
      .executeTakeFirst()

    const totalRecords = Number(totalRecordsResult?.total) || 0
    const totalPages = Math.ceil(totalRecords / (options.limit ?? 10))

    const usersWithExtra = await db
      .selectFrom('users')
      .selectAll()
      .orderBy('id', 'asc') // Assuming 'id' is used for cursor-based pagination
      .limit((options.limit ?? 10) + 1) // Fetch one extra record
      .offset((options.page - 1) * (options.limit ?? 10))
      .execute()

    let nextCursor = null
    if (usersWithExtra.length > (options.limit ?? 10)) nextCursor = usersWithExtra.pop()!.id // Use the ID of the extra record as the next cursor

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
  static async create(newAccessToken: NewAccessToken): Promise<UserModel> {
    const result = await db.insertInto('users').values(newUser).executeTakeFirstOrThrow()

    return (await find(Number(result.insertId))) as UserModel
  }

  // Method to remove a User
  static async remove(id: number): Promise<void> {
    await db.deleteFrom('users').where('id', '=', id).execute()
  }

  where(...args: (string | number)[]): UserModel {
    let column: any
    let operator: any
    let value: any

    if (args.length === 2) {
      ;[column, value] = args
      operator = '='
    } else if (args.length === 3) {
      ;[column, operator, value] = args
    } else {
      throw new Error('Invalid number of arguments')
    }

    this.query = this.query.where(column, operator, value)

    return this
  }

  static where(...args: (string | number)[]): UserModel {
    let column: any
    let operator: any
    let value: any

    const instance = new this(null)

    if (args.length === 2) {
      ;[column, value] = args
      operator = '='
    } else if (args.length === 3) {
      ;[column, operator, value] = args
    } else {
      throw new Error('Invalid number of arguments')
    }

    instance.query = instance.query.where(column, operator, value)

    return instance
  }

  static whereIn(column: keyof UserType, values: any[]): UserModel {
    const instance = new this(null)

    instance.query = instance.query.where(column, 'in', values)

    return instance
  }

  async first(): Promise<UserModel | undefined> {
    const model = await this.query.selectAll().executeTakeFirst()

    return new UserModel(model)
  }

  static async first(): Promise<AccessTokenType | undefined> {
    return await db.selectFrom('users').selectAll().executeTakeFirst()
  }

  async last(): Promise<UserType> {
    return await db.selectFrom('users').selectAll().orderBy('id', 'desc').executeTakeFirst()
  }

  static orderBy(column: keyof UserType, order: 'asc' | 'desc'): UserModel {
    const instance = new this(null)

    instance.query.orderBy(column, order)

    return instance
  }

  orderBy(column: keyof UserType, order: 'asc' | 'desc'): UserModel {
    this.query.orderBy(column, order)

    return this
  }

  static orderByDesc(column: keyof UserType): UserModel {
    const instance = new this(null)

    instance.query.orderBy(column, 'desc')

    return instance
  }

  orderByDesc(column: keyof UserType): UserModel {
    this.query.orderBy(column, 'desc')

    return this
  }

  static orderByAsc(column: keyof UserType): UserModel {
    const instance = new this(null)

    instance.query.orderBy(column, 'desc')

    return instance
  }

  orderByAsc(column: keyof UserType): UserModel {
    this.query.orderBy(column, 'desc')

    return this
  }

  // Method to update the accesstoken instance
  async update(user: UserUpdate): Promise<UserModel | null> {
    if (this.id === undefined) throw new Error('AccessToken ID is undefined')

    const updatedModel = await db.updateTable('users').set(user).where('id', '=', this.id).executeTakeFirst()

    return await this.find(Number(this.id))
  }

  // Method to save (insert or update) the user instance
  async save(): Promise<void> {
    if (!this.user) throw new Error('User data is undefined')

    if (this.user.id === undefined) {
      // Insert new user
      const newModel = await db
        .insertInto('users')
        .values(this.user as NewUser)
        .executeTakeFirstOrThrow()
    } else {
      // Update existing user
      await this.update(this.user)
    }
  }

  // Method to delete the user instance
  async delete(): Promise<void> {
    if (this.id === undefined) throw new Error('User ID is undefined')

    await db.deleteFrom('users').where('id', '=', this.id).execute()
  }

  async post() {
    if (this.id === undefined) throw new Error('Relation Error!')

    const model = Post.where('user_id', '=', this.id).first()

    if (!model) throw new Error('Model Relation Not Found!')

    return model
  }

  async subscriber() {
    if (this.id === undefined) throw new Error('Relation Error!')

    const model = Subscriber.where('user_id', '=', this.id).first()

    if (!model) throw new Error('Model Relation Not Found!')

    return model
  }

  async deployments() {
    if (this.id === undefined) throw new Error('Relation Error!')

    const results = await db.selectFrom('deployments').where('user_id', '=', this.id).selectAll().execute()

    return results
  }

  toJSON() {
    const output: Partial<UserType> = { ...this.user }

    this.hidden.forEach((attr) => {
      if (attr in output) delete output[attr as keyof Partial<UserType>]
    })

    type User = Omit<UserType, 'password'>

    return output as User
  }
}

const User = UserModel

export default User
