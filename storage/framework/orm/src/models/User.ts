import type { Generated, Insertable, Selectable, Updateable } from 'kysely'
import { generateTwoFactorSecret, verifyTwoFactorCode } from '@stacksjs/auth'
import { cache } from '@stacksjs/cache'
import { db, sql } from '@stacksjs/database'
import { dispatch } from '@stacksjs/events'

import Post from './Post'

import Subscriber from './Subscriber'

import Team from './Team'

// import { Kysely, MysqlDialect, PostgresDialect } from 'kysely'
// import { Pool } from 'pg'

// TODO: we need an action that auto-generates these table interfaces
export interface UsersTable {
  id: Generated<number>
  name?: string
  email?: string
  job_title?: string
  password?: string
  team_id?: number
  deployment_id?: number
  post_id?: number
  public_passkey?: string

  created_at?: Date

  updated_at?: Date

  deleted_at?: Date

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
  private hidden = ['password']
  private fillable = ['name', 'email', 'job_title', 'password']
  private softDeletes = false
  protected query: any
  protected hasSelect: boolean
  public id: number | undefined
  public public_passkey: string | undefined
  public name: string | undefined
  public email: string | undefined
  public job_title: string | undefined
  public password: string | undefined

  public created_at: Date | undefined
  public updated_at: Date | undefined
  public team_id: number | undefined
  public deployment_id: number | undefined
  public post_id: number | undefined

  constructor(user: Partial<UserType> | null) {
    this.id = user?.id
    this.public_passkey = user?.public_passkey
    this.name = user?.name
    this.email = user?.email
    this.job_title = user?.job_title
    this.password = user?.password

    this.created_at = user?.created_at

    this.updated_at = user?.updated_at

    this.team_id = user?.team_id
    this.deployment_id = user?.deployment_id
    this.post_id = user?.post_id

    this.query = db.selectFrom('users')
    this.hasSelect = false
  }

  // Method to find a User by ID
  async find(id: number): Promise<UserModel | undefined> {
    const query = db.selectFrom('users').where('id', '=', id).selectAll()

    const model = await query.executeTakeFirst()

    if (!model)
      return undefined

    cache.getOrSet(`user:${id}`, JSON.stringify(model))

    return this.parseResult(new UserModel(model))
  }

  // Method to find a User by ID
  static async find(id: number): Promise<UserModel | undefined> {
    const query = db.selectFrom('users').where('id', '=', id).selectAll()

    const instance = new UserModel(null)

    const model = await query.executeTakeFirst()

    if (!model)
      return undefined

    cache.getOrSet(`user:${id}`, JSON.stringify(model))

    return instance.parseResult(new UserModel(model))
  }

  static async all(): Promise<UserModel[]> {
    let query = db.selectFrom('users').selectAll()

    const instance = new UserModel(null)

    if (instance.softDeletes) {
      query = query.where('deleted_at', 'is', null)
    }

    const results = await query.execute()

    return results.map(modelItem => instance.parseResult(new UserModel(modelItem)))
  }

  static async findOrFail(id: number): Promise<UserModel> {
    let query = db.selectFrom('users').where('id', '=', id)

    const instance = new UserModel(null)

    if (instance.softDeletes) {
      query = query.where('deleted_at', 'is', null)
    }

    query = query.selectAll()

    const model = await query.executeTakeFirst()

    if (model === undefined)
      throw new Error(JSON.stringify({ status: 404, message: 'No model results found for query' }))

    cache.getOrSet(`user:${id}`, JSON.stringify(model))

    return instance.parseResult(new UserModel(model))
  }

  static async findMany(ids: number[]): Promise<UserModel[]> {
    let query = db.selectFrom('users').where('id', 'in', ids)

    const instance = new UserModel(null)

    if (instance.softDeletes) {
      query = query.where('deleted_at', 'is', null)
    }

    query = query.selectAll()

    const model = await query.execute()

    return model.map(modelItem => instance.parseResult(new UserModel(modelItem)))
  }

  // Method to get a User by criteria
  static async get(): Promise<UserModel[]> {
    const instance = new UserModel(null)

    if (instance.hasSelect) {
      if (instance.softDeletes) {
        instance.query = instance.query.where('deleted_at', 'is', null)
      }

      const model = await instance.query.execute()

      return model.map((modelItem: UserModel) => new UserModel(modelItem))
    }

    if (instance.softDeletes) {
      instance.query = instance.query.where('deleted_at', 'is', null)
    }

    const model = await instance.query.selectAll().execute()

    return model.map((modelItem: UserModel) => new UserModel(modelItem))
  }

  // Method to get a User by criteria
  async get(): Promise<UserModel[]> {
    if (this.hasSelect) {
      if (this.softDeletes) {
        this.query = this.query.where('deleted_at', 'is', null)
      }

      const model = await this.query.execute()

      return model.map((modelItem: UserModel) => new UserModel(modelItem))
    }

    if (this.softDeletes) {
      this.query = this.query.where('deleted_at', 'is', null)
    }

    const model = await this.query.selectAll().execute()

    return model.map((modelItem: UserModel) => new UserModel(modelItem))
  }

  static async count(): Promise<number> {
    const instance = new UserModel(null)

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

  // Method to get all users
  static async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<UserResponse> {
    const totalRecordsResult = await db.selectFrom('users')
      .select(db.fn.count('id').as('total')) // Use 'id' or another actual column name
      .executeTakeFirst()

    const totalRecords = Number(totalRecordsResult?.total) || 0
    const totalPages = Math.ceil(totalRecords / (options.limit ?? 10))

    const usersWithExtra = await db.selectFrom('users')
      .selectAll()
      .orderBy('id', 'asc') // Assuming 'id' is used for cursor-based pagination
      .limit((options.limit ?? 10) + 1) // Fetch one extra record
      .offset(((options.page ?? 1) - 1) * (options.limit ?? 10)) // Ensure options.page is not undefined
      .execute()

    let nextCursor = null
    if (usersWithExtra.length > (options.limit ?? 10))
      nextCursor = usersWithExtra.pop()?.id ?? null

    return {
      data: usersWithExtra,
      paging: {
        total_records: totalRecords,
        page: options.page || 1,
        total_pages: totalPages,
      },
      next_cursor: nextCursor,
    }
  }

  // Method to create a new user
  static async create(newUser: NewUser): Promise<UserModel> {
    const instance = new UserModel(null)

    const filteredValues = Object.fromEntries(
      Object.entries(newUser).filter(([key]) => instance.fillable.includes(key)),
    ) as NewUser

    const result = await db.insertInto('users')
      .values(filteredValues)
      .executeTakeFirstOrThrow()

    const model = await find(Number(result.insertId)) as UserModel

    if (model)
      dispatch('user:created', model)

    return model
  }

  static async forceCreate(newUser: NewUser): Promise<UserModel> {
    const result = await db.insertInto('users')
      .values(newUser)
      .executeTakeFirstOrThrow()

    const model = await find(Number(result.insertId)) as UserModel

    if (model)
      dispatch('user:created', model)

    return model
  }

  // Method to remove a User
  static async remove(id: number): Promise<void> {
    const instance = new UserModel(null)
    const model = await instance.find(id)

    if (instance.softDeletes) {
      await db.updateTable('users')
        .set({
          deleted_at: sql.raw('CURRENT_TIMESTAMP'),
        })
        .where('id', '=', id)
        .execute()
    }
    else {
      await db.deleteFrom('users')
        .where('id', '=', id)
        .execute()
    }

    if (model)
      dispatch('user:deleted', model)
  }

  where(...args: (string | number | boolean | undefined | null)[]): UserModel {
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
      throw new Error('Invalid number of arguments')
    }

    this.query = this.query.where(column, operator, value)

    return this
  }

  static where(...args: (string | number | boolean | undefined | null)[]): UserModel {
    let column: any
    let operator: any
    let value: any

    const instance = new UserModel(null)

    if (args.length === 2) {
      [column, value] = args
      operator = '='
    }
    else if (args.length === 3) {
      [column, operator, value] = args
    }
    else {
      throw new Error('Invalid number of arguments')
    }

    instance.query = instance.query.where(column, operator, value)

    return instance
  }

  static whereName(value: string): UserModel {
    const instance = new UserModel(null)

    instance.query = instance.query.where('name', '=', value)

    return instance
  }

  static whereEmail(value: string): UserModel {
    const instance = new UserModel(null)

    instance.query = instance.query.where('email', '=', value)

    return instance
  }

  static whereJobTitle(value: string): UserModel {
    const instance = new UserModel(null)

    instance.query = instance.query.where('jobTitle', '=', value)

    return instance
  }

  static wherePassword(value: string): UserModel {
    const instance = new UserModel(null)

    instance.query = instance.query.where('password', '=', value)

    return instance
  }

  static whereIn(column: keyof UserType, values: any[]): UserModel {
    const instance = new UserModel(null)

    instance.query = instance.query.where(column, 'in', values)

    return instance
  }

  async first(): Promise<UserModel | undefined> {
    const model = await this.query.selectAll().executeTakeFirst()

    if (!model) {
      return undefined
    }

    return this.parseResult(new UserModel(model))
  }

  async firstOrFail(): Promise<UserModel | undefined> {
    const model = await this.query.selectAll().executeTakeFirst()

    if (model === undefined)
      throw { status: 404, message: 'No UserModel results found for query' }

    return this.parseResult(new UserModel(model))
  }

  async exists(): Promise<boolean> {
    const model = await this.query.selectAll().executeTakeFirst()

    return model !== null || model !== undefined
  }

  static async first(): Promise<UserType | undefined> {
    return await db.selectFrom('users')
      .selectAll()
      .executeTakeFirst()
  }

  async last(): Promise<UserType | undefined> {
    return await db.selectFrom('users')
      .selectAll()
      .orderBy('id', 'desc')
      .executeTakeFirst()
  }

  static async last(): Promise<UserType | undefined> {
    return await db.selectFrom('users').selectAll().orderBy('id', 'desc').executeTakeFirst()
  }

  static orderBy(column: keyof UserType, order: 'asc' | 'desc'): UserModel {
    const instance = new UserModel(null)

    instance.query = instance.query.orderBy(column, order)

    return instance
  }

  orderBy(column: keyof UserType, order: 'asc' | 'desc'): UserModel {
    this.query = this.query.orderBy(column, order)

    return this
  }

  static orderByDesc(column: keyof UserType): UserModel {
    const instance = new UserModel(null)

    instance.query = instance.query.orderBy(column, 'desc')

    return instance
  }

  orderByDesc(column: keyof UserType): UserModel {
    this.query = this.orderBy(column, 'desc')

    return this
  }

  static orderByAsc(column: keyof UserType): UserModel {
    const instance = new UserModel(null)

    instance.query = instance.query.orderBy(column, 'asc')

    return instance
  }

  orderByAsc(column: keyof UserType): UserModel {
    this.query = this.query.orderBy(column, 'desc')

    return this
  }

  async update(user: UserUpdate): Promise<UserModel | undefined> {
    if (this.id === undefined)
      throw new Error('User ID is undefined')

    const filteredValues = Object.fromEntries(
      Object.entries(user).filter(([key]) => this.fillable.includes(key)),
    ) as NewUser

    await db.updateTable('users')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    const model = await this.find(Number(this.id))

    if (model)
      dispatch('user:updated', model)

    return model
  }

  async forceUpdate(user: UserUpdate): Promise<UserModel | undefined> {
    if (this.id === undefined)
      throw new Error('User ID is undefined')

    await db.updateTable('users')
      .set(user)
      .where('id', '=', this.id)
      .executeTakeFirst()

    const model = await this.find(Number(this.id))

    if (model)
      dispatch('user:updated', model)

    return model
  }

  async save(): Promise<void> {
    if (!this)
      throw new Error('User data is undefined')

    if (this.id === undefined) {
      await db.insertInto('users')
        .values(this as NewUser)
        .executeTakeFirstOrThrow()
    }
    else {
      await this.update(this)
    }
  }

  // Method to delete (soft delete) the user instance
  async delete(): Promise<void> {
    if (this.id === undefined)
      throw new Error('User ID is undefined')

    const model = await instance.find(id)

    // Check if soft deletes are enabled
    if (this.softDeletes) {
      // Update the deleted_at column with the current timestamp
      await db.updateTable('users')
        .set({
          deleted_at: sql.raw('CURRENT_TIMESTAMP'),
        })
        .where('id', '=', this.id)
        .execute()
    }
    else {
      // Perform a hard delete
      await db.deleteFrom('users')
        .where('id', '=', this.id)
        .execute()
    }

    if (model)
      dispatch('user:deleted', model)
  }

  async post() {
    if (this.id === undefined)
      throw new Error('Relation Error!')

    const model = Post
      .where('user_id', '=', this.id)
      .first()

    if (!model)
      throw new Error('Model Relation Not Found!')

    return model
  }

  async subscriber() {
    if (this.id === undefined)
      throw new Error('Relation Error!')

    const model = Subscriber
      .where('user_id', '=', this.id)
      .first()

    if (!model)
      throw new Error('Model Relation Not Found!')

    return model
  }

  async deployments() {
    if (this.id === undefined)
      throw new Error('Relation Error!')

    const results = await db.selectFrom('deployments')
      .where('user_id', '=', this.id)
      .selectAll()
      .execute()

    return results
  }

  async userTeams() {
    if (this.id === undefined)
      throw new Error('Relation Error!')

    const results = await db.selectFrom('team_users')
      .where('user_id', '=', this.id)
      .selectAll()
      .execute()

    const tableRelationIds = results.map(result => result.team_id)

    if (!tableRelationIds.length)
      throw new Error('Relation Error!')

    const relationResults = await Team.whereIn('id', tableRelationIds).get()

    return relationResults
  }

  distinct(column: keyof UserType): UserModel {
    this.query = this.query.select(column).distinct()

    this.hasSelect = true

    return this
  }

  static distinct(column: keyof UserType): UserModel {
    const instance = new UserModel(null)

    instance.query = instance.query.select(column).distinct()

    instance.hasSelect = true

    return instance
  }

  join(table: string, firstCol: string, secondCol: string): UserModel {
    this.query = this.query.innerJoin(table, firstCol, secondCol)

    return this
  }

  static join(table: string, firstCol: string, secondCol: string): UserModel {
    const instance = new UserModel(null)

    instance.query = instance.query.innerJoin(table, firstCol, secondCol)

    return instance
  }

  static async rawQuery(rawQuery: string): Promise<any> {
    return await sql`${rawQuery}`.execute(db)
  }

  toJSON() {
    const output: Partial<UserType> = {

      id: this.id,
      name: this.name,
      email: this.email,
      job_title: this.job_title,
      password: this.password,

      created_at: this.created_at,

      updated_at: this.updated_at,

    }

        type User = Omit<UserType, 'password'>

        return output as User
  }

  parseResult(model: UserModel): UserModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof UserModel]
    }

    return model
  }

  async generateTwoFactorForModel() {
    const secret = generateTwoFactorSecret()

    await this.update({ two_factor_secret: secret })
  }

  verifyTwoFactorCode(code: string): boolean {
    const modelTwoFactorSecret = this.two_factor_secret
    let isValid = false

    if (typeof modelTwoFactorSecret === 'string') {
      isValid = verifyTwoFactorCode(code, modelTwoFactorSecret)
    }

    return isValid
  }
}

async function find(id: number): Promise<UserModel | undefined> {
  const query = db.selectFrom('users').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  return new UserModel(model)
}

export async function count(): Promise<number> {
  const results = await UserModel.count()

  return results
}

export async function create(newUser: NewUser): Promise<UserModel> {
  const result = await db.insertInto('users')
    .values(newUser)
    .executeTakeFirstOrThrow()

  return await find(Number(result.insertId)) as UserModel
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(db)
}

export async function remove(id: number): Promise<void> {
  await db.deleteFrom('users')
    .where('id', '=', id)
    .execute()
}

export async function whereName(value: string): Promise<UserModel[]> {
  const query = db.selectFrom('users').where('name', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new UserModel(modelItem))
}

export async function whereEmail(value: string): Promise<UserModel[]> {
  const query = db.selectFrom('users').where('email', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new UserModel(modelItem))
}

export async function whereJobTitle(value: string): Promise<UserModel[]> {
  const query = db.selectFrom('users').where('job_title', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new UserModel(modelItem))
}

export async function wherePassword(value: string): Promise<UserModel[]> {
  const query = db.selectFrom('users').where('password', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new UserModel(modelItem))
}

export const User = UserModel

export default User
