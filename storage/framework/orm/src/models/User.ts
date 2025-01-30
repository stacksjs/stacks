import type { Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { CheckoutLineItem, CheckoutOptions, StripeCustomerOptions } from '@stacksjs/types'
import type { DeploymentModel } from './Deployment'
import type { PaymentMethodModel } from './PaymentMethod'
import type { SubscriptionModel } from './Subscription'
import type { TransactionModel } from './Transaction'
import { randomUUIDv7 } from 'bun'
import { cache } from '@stacksjs/cache'
import { db, sql } from '@stacksjs/database'
import { HttpError, ModelNotFoundException } from '@stacksjs/error-handling'

import { dispatch } from '@stacksjs/events'

import { DB, SubqueryBuilder } from '@stacksjs/orm'

import { manageCharge, manageCheckout, manageCustomer, manageInvoice, managePaymentMethod, manageSetupIntent, manageSubscription, manageTransaction, type Stripe } from '@stacksjs/payments'

import Deployment from './Deployment'

import PaymentMethod from './PaymentMethod'

import Post from './Post'

import Subscriber from './Subscriber'

import Subscription from './Subscription'

import Team from './Team'

import Transaction from './Transaction'

export interface UsersTable {
  id?: number
  deployments?: DeploymentModel[] | undefined
  subscriptions?: SubscriptionModel[] | undefined
  payment_methods?: PaymentMethodModel[] | undefined
  transactions?: TransactionModel[] | undefined
  name?: string
  email?: string
  job_title?: string
  password?: string
  public_passkey?: string
  stripe_id?: string
  uuid?: string

  created_at?: Date

  updated_at?: Date

}

interface UserResponse {
  data: UserJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface UserJsonResponse extends Omit<UsersTable, 'password'> {
  [key: string]: any
}

export type UserType = Selectable<UsersTable>
export type NewUser = Partial<Insertable<UsersTable>>
export type UserUpdate = Updateable<UsersTable>

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
  private readonly hidden: Array<keyof UserJsonResponse> = ['password']
  private readonly fillable: Array<keyof UserJsonResponse> = ['name', 'email', 'job_title', 'password', 'stripe_id', 'uuid', 'two_factor_secret', 'public_key']
  private readonly guarded: Array<keyof UserJsonResponse> = []

  protected selectFromQuery: any
  protected withRelations: string[]
  protected updateFromQuery: any
  protected deleteFromQuery: any
  protected hasSelect: boolean
  private customColumns: Record<string, unknown> = {}
  public deployments: DeploymentModel[] | undefined
  public subscriptions: SubscriptionModel[] | undefined
  public payment_methods: PaymentMethodModel[] | undefined
  public transactions: TransactionModel[] | undefined
  public id: number | undefined
  public stripe_id: string | undefined
  public uuid: string | undefined
  public public_passkey: string | undefined
  public name: string | undefined
  public email: string | undefined
  public job_title: string | undefined
  public password: string | undefined

  public created_at: Date | undefined
  public updated_at: Date | undefined

  constructor(user: Partial<UserType> | null) {
    if (user) {
      this.deployments = user?.deployments
      this.subscriptions = user?.subscriptions
      this.payment_methods = user?.payment_methods
      this.transactions = user?.transactions
      this.id = user?.id || 1
      this.stripe_id = user?.stripe_id
      this.uuid = user?.uuid
      this.public_passkey = user?.public_passkey
      this.name = user?.name
      this.email = user?.email
      this.job_title = user?.job_title
      this.password = user?.password

      this.created_at = user?.created_at

      this.updated_at = user?.updated_at

      Object.keys(user).forEach((key) => {
        if (!(key in this)) {
          this.customColumns[key] = (user as UserJsonResponse)[key]
        }
      })
    }

    this.withRelations = []
    this.selectFromQuery = DB.instance.selectFrom('users')
    this.updateFromQuery = DB.instance.updateTable('users')
    this.deleteFromQuery = DB.instance.deleteFrom('users')
    this.hasSelect = false
  }

  select(params: (keyof UserType)[] | RawBuilder<string> | string): UserModel {
    return UserModel.select(params)
  }

  static select(params: (keyof UserType)[] | RawBuilder<string> | string): UserModel {
    const instance = new UserModel(null)

    // Initialize a query with the table name and selected fields
    instance.selectFromQuery = instance.selectFromQuery.select(params)

    instance.hasSelect = true

    return instance
  }

  async find(id: number): Promise<UserModel | undefined> {
    return await UserModel.find(id)
  }

  // Method to find a User by ID
  static async find(id: number): Promise<UserModel | undefined> {
    const model = await db.selectFrom('users').where('id', '=', id).selectAll().executeTakeFirst()

    if (!model)
      return undefined

    const instance = new UserModel(null)

    const result = await instance.mapWith(model)

    const data = new UserModel(result as UserType)

    cache.getOrSet(`user:${id}`, JSON.stringify(model))

    return data
  }

  async first(): Promise<UserModel | undefined> {
    return await UserModel.first()
  }

  static async first(): Promise<UserModel | undefined> {
    const model = await db.selectFrom('users')
      .selectAll()
      .executeTakeFirst()

    if (!model)
      return undefined

    const instance = new UserModel(null)

    const result = await instance.mapWith(model)

    const data = new UserModel(result as UserType)

    return data
  }

  async firstOrFail(): Promise<UserModel | undefined> {
    return await UserModel.firstOrFail()
  }

  static async firstOrFail(): Promise<UserModel | undefined> {
    const instance = new UserModel(null)

    const model = await instance.selectFromQuery.executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, 'No UserModel results found for query')

    const result = await instance.mapWith(model)

    const data = new UserModel(result as UserType)

    return data
  }

  async mapWith(model: UserType): Promise<UserType> {
    if (this.withRelations.includes('deployments')) {
      model.deployments = await this.deploymentsHasMany()
    }

    if (this.withRelations.includes('subscriptions')) {
      model.subscriptions = await this.subscriptionsHasMany()
    }

    if (this.withRelations.includes('payment_methods')) {
      model.payment_methods = await this.paymentMethodsHasMany()
    }

    if (this.withRelations.includes('transactions')) {
      model.transactions = await this.transactionsHasMany()
    }

    return model
  }

  static async all(): Promise<UserModel[]> {
    const models = await db.selectFrom('users').selectAll().execute()

    const data = await Promise.all(models.map(async (model: UserType) => {
      const instance = new UserModel(model)

      const results = await instance.mapWith(model)

      return new UserModel(results)
    }))

    return data
  }

  async findOrFail(id: number): Promise<UserModel> {
    return await UserModel.findOrFail(id)
  }

  static async findOrFail(id: number): Promise<UserModel> {
    const model = await db.selectFrom('users').where('id', '=', id).selectAll().executeTakeFirst()

    const instance = new UserModel(null)

    if (model === undefined)
      throw new ModelNotFoundException(404, `No UserModel results for ${id}`)

    cache.getOrSet(`user:${id}`, JSON.stringify(model))

    const result = await instance.mapWith(model)

    const data = new UserModel(result as UserType)

    return data
  }

  static async findMany(ids: number[]): Promise<UserModel[]> {
    let query = db.selectFrom('users').where('id', 'in', ids)

    const instance = new UserModel(null)

    query = query.selectAll()

    const model = await query.execute()

    return model.map(modelItem => instance.parseResult(new UserModel(modelItem)))
  }

  skip(count: number): UserModel {
    return UserModel.skip(count)
  }

  static skip(count: number): UserModel {
    const instance = new UserModel(null)

    instance.selectFromQuery = instance.selectFromQuery.offset(count)

    return instance
  }

  take(count: number): UserModel {
    return UserModel.take(count)
  }

  static take(count: number): UserModel {
    const instance = new UserModel(null)

    instance.selectFromQuery = instance.selectFromQuery.limit(count)

    return instance
  }

  static async pluck<K extends keyof UserModel>(field: K): Promise<UserModel[K][]> {
    const instance = new UserModel(null)

    if (instance.hasSelect) {
      const model = await instance.selectFromQuery.execute()
      return model.map((modelItem: UserModel) => modelItem[field])
    }

    const model = await instance.selectFromQuery.selectAll().execute()

    return model.map((modelItem: UserModel) => modelItem[field])
  }

  async pluck<K extends keyof UserModel>(field: K): Promise<UserModel[K][]> {
    return UserModel.pluck(field)
  }

  static async count(): Promise<number> {
    const instance = new UserModel(null)

    return instance.selectFromQuery
      .select(sql`COUNT(*) as count`)
      .executeTakeFirst()
  }

  async count(): Promise<number> {
    return UserModel.count()
  }

  async max(field: keyof UserModel): Promise<number> {
    return await this.selectFromQuery
      .select(sql`MAX(${sql.raw(field as string)}) `)
      .executeTakeFirst()
  }

  async min(field: keyof UserModel): Promise<number> {
    return await this.selectFromQuery
      .select(sql`MIN(${sql.raw(field as string)}) `)
      .executeTakeFirst()
  }

  async avg(field: keyof UserModel): Promise<number> {
    return this.selectFromQuery
      .select(sql`AVG(${sql.raw(field as string)})`)
      .executeTakeFirst()
  }

  async sum(field: keyof UserModel): Promise<number> {
    return this.selectFromQuery
      .select(sql`SUM(${sql.raw(field as string)})`)
      .executeTakeFirst()
  }

  async get(): Promise<UserModel[]> {
    return UserModel.get()
  }

  static async get(): Promise<UserModel[]> {
    const instance = new UserModel(null)

    let models

    if (instance.hasSelect) {
      models = await instance.selectFromQuery.execute()
    }
    else {
      models = await instance.selectFromQuery.selectAll().execute()
    }

    const data = await Promise.all(models.map(async (model: UserModel) => {
      const instance = new UserModel(model)

      const results = await instance.mapWith(model)

      return new UserModel(results)
    }))

    return data
  }

  has(relation: string): UserModel {
    return UserModel.has(relation)
  }

  static has(relation: string): UserModel {
    const instance = new UserModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(
        selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.user_id`, '=', 'users.id'),
      ),
    )

    return instance
  }

  whereHas(
    relation: string,
    callback: (query: SubqueryBuilder) => void,
  ): UserModel {
    return UserModel.whereHas(relation, callback)
  }

  static whereHas(
    relation: string,
    callback: (query: SubqueryBuilder) => void,
  ): UserModel {
    const instance = new UserModel(null)
    const subqueryBuilder = new SubqueryBuilder()

    callback(subqueryBuilder)
    const conditions = subqueryBuilder.getConditions()

    instance.selectFromQuery = instance.selectFromQuery
      .where(({ exists, selectFrom }: any) => {
        let subquery = selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.user_id`, '=', 'users.id')

        conditions.forEach((condition) => {
          switch (condition.method) {
            case 'where':
              if (condition.type === 'and') {
                subquery = subquery.where(condition.column, condition.operator!, condition.value)
              }
              else {
                subquery = subquery.orWhere(condition.column, condition.operator!, condition.value)
              }
              break

            case 'whereIn':
              if (condition.operator === 'not') {
                subquery = subquery.whereNotIn(condition.column, condition.values!)
              }
              else {
                subquery = subquery.whereIn(condition.column, condition.values!)
              }

              break

            case 'whereNull':
              subquery = subquery.whereNull(condition.column)
              break

            case 'whereNotNull':
              subquery = subquery.whereNotNull(condition.column)
              break

            case 'whereBetween':
              subquery = subquery.whereBetween(condition.column, condition.values!)
              break

            case 'whereExists': {
              const nestedBuilder = new SubqueryBuilder()
              condition.callback!(nestedBuilder)
              break
            }
          }
        })

        return exists(subquery)
      })

    return instance
  }

  doesntHave(relation: string): UserModel {
    return UserModel.doesntHave(relation)
  }

  static doesntHave(relation: string): UserModel {
    const instance = new UserModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where(({ not, exists, selectFrom }: any) =>
      not(
        exists(
          selectFrom(relation)
            .select('1')
            .whereRef(`${relation}.user_id`, '=', 'users.id'),
        ),
      ),
    )

    return instance
  }

  whereDoesntHave(relation: string, callback: (query: SubqueryBuilder) => void): UserModel {
    return UserModel.whereDoesntHave(relation, callback)
  }

  static whereDoesntHave(
    relation: string,
    callback: (query: SubqueryBuilder) => void,
  ): UserModel {
    const instance = new UserModel(null)
    const subqueryBuilder = new SubqueryBuilder()

    callback(subqueryBuilder)
    const conditions = subqueryBuilder.getConditions()

    instance.selectFromQuery = instance.selectFromQuery
      .where(({ exists, selectFrom, not }: any) => {
        let subquery = selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.user_id`, '=', 'users.id')

        conditions.forEach((condition) => {
          switch (condition.method) {
            case 'where':
              if (condition.type === 'and') {
                subquery = subquery.where(condition.column, condition.operator!, condition.value)
              }
              else {
                subquery = subquery.orWhere(condition.column, condition.operator!, condition.value)
              }
              break

            case 'whereIn':
              if (condition.operator === 'not') {
                subquery = subquery.whereNotIn(condition.column, condition.values!)
              }
              else {
                subquery = subquery.whereIn(condition.column, condition.values!)
              }

              break

            case 'whereNull':
              subquery = subquery.whereNull(condition.column)
              break

            case 'whereNotNull':
              subquery = subquery.whereNotNull(condition.column)
              break

            case 'whereBetween':
              subquery = subquery.whereBetween(condition.column, condition.values!)
              break

            case 'whereExists': {
              const nestedBuilder = new SubqueryBuilder()
              condition.callback!(nestedBuilder)
              break
            }
          }
        })

        return not(exists(subquery))
      })

    return instance
  }

  async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<UserResponse> {
    return UserModel.paginate(options)
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

  static async create(newUser: NewUser): Promise<UserModel> {
    const instance = new UserModel(null)

    const filteredValues = Object.fromEntries(
      Object.entries(newUser).filter(([key]) =>
        !instance.guarded.includes(key) && instance.fillable.includes(key),
      ),
    ) as NewUser

    filteredValues.uuid = randomUUIDv7()

    const result = await DB.instance.insertInto('users')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await instance.find(Number(result.numInsertedOrUpdatedRows)) as UserModel

    if (model)
      dispatch('Users:created', model)

    return model
  }

  static async createMany(newUser: NewUser[]): Promise<void> {
    const instance = new UserModel(null)

    const filteredValues = newUser.map((newUser: NewUser) => {
      const filtered = Object.fromEntries(
        Object.entries(newUser).filter(([key]) =>
          !instance.guarded.includes(key) && instance.fillable.includes(key),
        ),
      ) as NewUser

      filtered.uuid = randomUUIDv7()
      return filtered
    })

    await DB.instance.insertInto('users')
      .values(filteredValues)
      .executeTakeFirst()
  }

  static async forceCreate(newUser: NewUser): Promise<UserModel> {
    const result = await DB.instance.insertInto('users')
      .values(newUser)
      .executeTakeFirst()

    const model = await find(Number(result.numInsertedOrUpdatedRows)) as UserModel

    if (model)
      dispatch('user:created', model)

    return model
  }

  // Method to remove a User
  static async remove(id: number): Promise<any> {
    const instance = new UserModel(null)

    const model = await instance.find(Number(id))

    if (model)
      dispatch('user:deleted', model)

    return await DB.instance.deleteFrom('users')
      .where('id', '=', id)
      .execute()
  }

  private static applyWhere(instance: UserModel, column: string, operator: string, value: any): UserModel {
    instance.selectFromQuery = instance.selectFromQuery.where(column, operator, value)
    instance.updateFromQuery = instance.updateFromQuery.where(column, operator, value)
    instance.deleteFromQuery = instance.deleteFromQuery.where(column, operator, value)

    return instance
  }

  where(column: string, operator: string, value: any): UserModel {
    return UserModel.applyWhere(this, column, operator, value)
  }

  static where(column: string, operator: string, value: any): UserModel {
    const instance = new UserModel(null)

    return UserModel.applyWhere(instance, column, operator, value)
  }

  whereRef(column: string, operator: string, value: string): UserModel {
    return UserModel.whereRef(column, operator, value)
  }

  static whereRef(column: string, operator: string, value: string): UserModel {
    const instance = new UserModel(null)

    instance.selectFromQuery = instance.selectFromQuery.whereRef(column, operator, value)

    return instance
  }

  orWhere(...args: Array<[string, string, any]>): UserModel {
    return UserModel.orWhere(...args)
  }

  static orWhere(...args: Array<[string, string, any]>): UserModel {
    const instance = new UserModel(null)

    if (args.length === 0) {
      throw new HttpError(500, 'At least one condition must be provided')
    }

    // Use the expression builder to append the OR conditions
    instance.selectFromQuery = instance.selectFromQuery.where((eb: any) =>
      eb.or(
        args.map(([column, operator, value]) => eb(column, operator, value)),
      ),
    )

    instance.updateFromQuery = instance.updateFromQuery.where((eb: any) =>
      eb.or(
        args.map(([column, operator, value]) => eb(column, operator, value)),
      ),
    )

    instance.deleteFromQuery = instance.deleteFromQuery.where((eb: any) =>
      eb.or(
        args.map(([column, operator, value]) => eb(column, operator, value)),
      ),
    )

    return instance
  }

  when(
    condition: boolean,
    callback: (query: UserModel) => UserModel,
  ): UserModel {
    return UserModel.when(condition, callback)
  }

  static when(
    condition: boolean,
    callback: (query: UserModel) => UserModel,
  ): UserModel {
    let instance = new UserModel(null)

    if (condition)
      instance = callback(instance)

    return instance
  }

  whereNull(column: string): UserModel {
    return UserModel.whereNull(column)
  }

  static whereNull(column: string): UserModel {
    const instance = new UserModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    instance.updateFromQuery = instance.updateFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    return instance
  }

  static whereName(value: string): UserModel {
    const instance = new UserModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('name', '=', value)

    return instance
  }

  static whereEmail(value: string): UserModel {
    const instance = new UserModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('email', '=', value)

    return instance
  }

  static whereJobTitle(value: string): UserModel {
    const instance = new UserModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('jobTitle', '=', value)

    return instance
  }

  static wherePassword(value: string): UserModel {
    const instance = new UserModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('password', '=', value)

    return instance
  }

  whereIn(column: keyof UserType, values: any[]): UserModel {
    return UserModel.whereIn(column, values)
  }

  static whereIn(column: keyof UserType, values: any[]): UserModel {
    const instance = new UserModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where(column, 'in', values)

    instance.updateFromQuery = instance.updateFromQuery.where(column, 'in', values)

    instance.deleteFromQuery = instance.deleteFromQuery.where(column, 'in', values)

    return instance
  }

  whereBetween(column: keyof UserType, range: [any, any]): UserModel {
    return UserModel.whereBetween(column, range)
  }

  static whereBetween(column: keyof UserType, range: [any, any]): UserModel {
    if (range.length !== 2) {
      throw new HttpError(500, 'Range must have exactly two values: [min, max]')
    }

    const instance = new UserModel(null)

    const query = sql` ${sql.raw(column as string)} between ${range[0]} and ${range[1]} `

    instance.selectFromQuery = instance.selectFromQuery.where(query)
    instance.updateFromQuery = instance.updateFromQuery.where(query)
    instance.deleteFromQuery = instance.deleteFromQuery.where(query)

    return instance
  }

  whereNotIn(column: keyof UserType, values: any[]): UserModel {
    return UserModel.whereNotIn(column, values)
  }

  static whereNotIn(column: keyof UserType, values: any[]): UserModel {
    const instance = new UserModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where(column, 'not in', values)

    instance.updateFromQuery = instance.updateFromQuery.where(column, 'not in', values)

    instance.deleteFromQuery = instance.deleteFromQuery.where(column, 'not in', values)

    return instance
  }

  async exists(): Promise<boolean> {
    const model = await this.selectFromQuery.executeTakeFirst()

    return model !== null || model !== undefined
  }

  static async latest(): Promise<UserType | undefined> {
    const model = await db.selectFrom('users')
      .selectAll()
      .orderBy('created_at', 'desc')
      .executeTakeFirst()

    if (!model)
      return undefined

    const instance = new UserModel(null)
    const result = await instance.mapWith(model)
    const data = new UserModel(result as UserType)

    return data
  }

  static async oldest(): Promise<UserType | undefined> {
    const model = await db.selectFrom('users')
      .selectAll()
      .orderBy('created_at', 'asc')
      .executeTakeFirst()

    if (!model)
      return undefined

    const instance = new UserModel(null)
    const result = await instance.mapWith(model)
    const data = new UserModel(result as UserType)

    return data
  }

  static async firstOrCreate(
    condition: Partial<UserType>,
    newUser: NewUser,
  ): Promise<UserModel> {
    // Get the key and value from the condition object
    const key = Object.keys(condition)[0] as keyof UserType

    if (!key) {
      throw new HttpError(500, 'Condition must contain at least one key-value pair')
    }

    const value = condition[key]

    // Attempt to find the first record matching the condition
    const existingUser = await db.selectFrom('users')
      .selectAll()
      .where(key, '=', value)
      .executeTakeFirst()

    if (existingUser) {
      const instance = new UserModel(null)
      const result = await instance.mapWith(existingUser)
      return new UserModel(result as UserType)
    }
    else {
      return await this.create(newUser)
    }
  }

  static async updateOrCreate(
    condition: Partial<UserType>,
    newUser: NewUser,
  ): Promise<UserModel> {
    const key = Object.keys(condition)[0] as keyof UserType

    if (!key) {
      throw new HttpError(500, 'Condition must contain at least one key-value pair')
    }

    const value = condition[key]

    // Attempt to find the first record matching the condition
    const existingUser = await db.selectFrom('users')
      .selectAll()
      .where(key, '=', value)
      .executeTakeFirst()

    if (existingUser) {
      // If found, update the existing record
      await db.updateTable('users')
        .set(newUser)
        .where(key, '=', value)
        .executeTakeFirstOrThrow()

      // Fetch and return the updated record
      const updatedUser = await db.selectFrom('users')
        .selectAll()
        .where(key, '=', value)
        .executeTakeFirst()

      if (!updatedUser) {
        throw new HttpError(500, 'Failed to fetch updated record')
      }

      const instance = new UserModel(null)
      const result = await instance.mapWith(updatedUser)
      return new UserModel(result as UserType)
    }
    else {
      // If not found, create a new record
      return await this.create(newUser)
    }
  }

  with(relations: string[]): UserModel {
    return UserModel.with(relations)
  }

  static with(relations: string[]): UserModel {
    const instance = new UserModel(null)

    instance.withRelations = relations

    return instance
  }

  async last(): Promise<UserType | undefined> {
    return await db.selectFrom('users')
      .selectAll()
      .orderBy('id', 'desc')
      .executeTakeFirst()
  }

  static async last(): Promise<UserType | undefined> {
    const model = await db.selectFrom('users').selectAll().orderBy('id', 'desc').executeTakeFirst()

    if (!model)
      return undefined

    const instance = new UserModel(null)

    const result = await instance.mapWith(model)

    const data = new UserModel(result as UserType)

    return data
  }

  orderBy(column: keyof UserType, order: 'asc' | 'desc'): UserModel {
    return UserModel.orderBy(column, order)
  }

  static orderBy(column: keyof UserType, order: 'asc' | 'desc'): UserModel {
    const instance = new UserModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, order)

    return instance
  }

  groupBy(column: keyof UserType): UserModel {
    return UserModel.groupBy(column)
  }

  static groupBy(column: keyof UserType): UserModel {
    const instance = new UserModel(null)

    instance.selectFromQuery = instance.selectFromQuery.groupBy(column)

    return instance
  }

  having(column: keyof UserType, operator: string, value: any): UserModel {
    return UserModel.having(column, operator, value)
  }

  static having(column: keyof UserType, operator: string, value: any): UserModel {
    const instance = new UserModel(null)

    instance.selectFromQuery = instance.selectFromQuery.having(column, operator, value)

    return instance
  }

  inRandomOrder(): UserModel {
    return UserModel.inRandomOrder()
  }

  static inRandomOrder(): UserModel {
    const instance = new UserModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(sql` ${sql.raw('RANDOM()')} `)

    return instance
  }

  orderByDesc(column: keyof UserType): UserModel {
    return UserModel.orderByDesc(column)
  }

  static orderByDesc(column: keyof UserType): UserModel {
    const instance = new UserModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, 'desc')

    return instance
  }

  orderByAsc(column: keyof UserType): UserModel {
    return UserModel.orderByAsc(column)
  }

  static orderByAsc(column: keyof UserType): UserModel {
    const instance = new UserModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, 'asc')

    return instance
  }

  async update(newUser: UserUpdate): Promise<UserModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newUser).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewUser

    await db.updateTable('users')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      const model = await this.find(this.id)

      if (model)
        dispatch('user:updated', model)

      return model
    }

    return undefined
  }

  async forceUpdate(user: UserUpdate): Promise<UserModel | undefined> {
    if (this.id === undefined) {
      this.updateFromQuery.set(user).execute()
    }

    await db.updateTable('users')
      .set(user)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      const model = await this.find(this.id)

      if (model)
        dispatch('user:updated', model)

      return model
    }

    return undefined
  }

  async save(): Promise<void> {
    if (!this)
      throw new HttpError(500, 'User data is undefined')

    if (this.id === undefined) {
      await DB.instance.insertInto('users')
        .values(this as NewUser)
        .executeTakeFirstOrThrow()
    }
    else {
      await this.update(this)
    }
  }

  // Method to delete (soft delete) the user instance
  async delete(): Promise<any> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()
    const model = await this.find(Number(this.id))
    if (model)
      dispatch('user:deleted', model)

    return await DB.instance.deleteFrom('users')
      .where('id', '=', this.id)
      .execute()
  }

  async post() {
    if (this.id === undefined)
      throw new HttpError(500, 'Relation Error!')

    const model = Post
      .where('user_id', '=', this.id)
      .first()

    if (!model)
      throw new HttpError(500, 'Model Relation Not Found!')

    return model
  }

  async subscriber() {
    if (this.id === undefined)
      throw new HttpError(500, 'Relation Error!')

    const model = Subscriber
      .where('user_id', '=', this.id)
      .first()

    if (!model)
      throw new HttpError(500, 'Model Relation Not Found!')

    return model
  }

  async deploymentsHasMany(): Promise<DeploymentModel[]> {
    if (this.id === undefined)
      throw new HttpError(500, 'Relation Error!')

    const results = await db.selectFrom('deployments')
      .where('user_id', '=', this.id)
      .limit(5)
      .selectAll()
      .execute()

    return results.map(modelItem => new Deployment(modelItem))
  }

  async subscriptionsHasMany(): Promise<SubscriptionModel[]> {
    if (this.id === undefined)
      throw new HttpError(500, 'Relation Error!')

    const results = await db.selectFrom('subscriptions')
      .where('user_id', '=', this.id)
      .limit(5)
      .selectAll()
      .execute()

    return results.map(modelItem => new Subscription(modelItem))
  }

  async paymentMethodsHasMany(): Promise<PaymentMethodModel[]> {
    if (this.id === undefined)
      throw new HttpError(500, 'Relation Error!')

    const results = await db.selectFrom('payment_methods')
      .where('user_id', '=', this.id)
      .limit(5)
      .selectAll()
      .execute()

    return results.map(modelItem => new PaymentMethod(modelItem))
  }

  async transactionsHasMany(): Promise<TransactionModel[]> {
    if (this.id === undefined)
      throw new HttpError(500, 'Relation Error!')

    const results = await db.selectFrom('transactions')
      .where('user_id', '=', this.id)
      .limit(5)
      .selectAll()
      .execute()

    return results.map(modelItem => new Transaction(modelItem))
  }

  async userTeams() {
    if (this.id === undefined)
      throw new HttpError(500, 'Relation Error!')

    const results = await db.selectFrom('team_users')
      .where('team_id', '=', this.id)
      .selectAll()
      .execute()

    const tableRelationIds = results.map(result => result.team_id)

    if (!tableRelationIds.length)
      throw new HttpError(500, 'Relation Error!')

    const relationResults = await Team.whereIn('id', tableRelationIds).get()

    return relationResults
  }

  toSearchableObject(): Partial<UsersTable> {
    return {
      id: this.id,
      job_title: this.job_title,
      name: this.name,
      email: this.email,
    }
  }

  async createStripeUser(options: Stripe.CustomerCreateParams): Promise<Stripe.Response<Stripe.Customer>> {
    const customer = await manageCustomer.createStripeCustomer(this, options)

    return customer
  }

  async updateStripeUser(options: Stripe.CustomerCreateParams): Promise<Stripe.Response<Stripe.Customer>> {
    const customer = await manageCustomer.updateStripeCustomer(this, options)

    return customer
  }

  async storeTransaction(productId: number): Promise<TransactionModel> {
    const transaction = await manageTransaction.store(this, productId)

    return transaction
  }

  async deleteStripeUser(): Promise<Stripe.Response<Stripe.DeletedCustomer>> {
    const deletedCustomer = await manageCustomer.deleteStripeUser(this)
    return deletedCustomer
  }

  async createOrGetStripeUser(options: Stripe.CustomerCreateParams): Promise<Stripe.Response<Stripe.Customer>> {
    const customer = await manageCustomer.createOrGetStripeUser(this, options)
    return customer
  }

  async retrieveStripeUser(): Promise<Stripe.Response<Stripe.Customer> | undefined> {
    const customer = await manageCustomer.retrieveStripeUser(this)
    return customer
  }

  async defaultPaymentMethod(): Promise<PaymentMethodModel | undefined> {
    const defaultPaymentMethod = await managePaymentMethod.retrieveDefaultPaymentMethod(this)

    return defaultPaymentMethod
  }

  async setDefaultPaymentMethod(pmId: number): Promise<Stripe.Response<Stripe.Customer>> {
    const updatedCustomer = await managePaymentMethod.setDefaultPaymentMethod(this, pmId)

    return updatedCustomer
  }

  async setUserDefaultPaymentMethod(paymentMethodId: string): Promise<Stripe.Response<Stripe.Customer>> {
    const updatedCustomer = await managePaymentMethod.setUserDefaultPayment(this, paymentMethodId)

    return updatedCustomer
  }

  async updateDefaultPaymentMethod(paymentMethodId: number): Promise<Stripe.Response<Stripe.Customer>> {
    const updatedCustomer = this.setDefaultPaymentMethod(paymentMethodId)

    return updatedCustomer
  }

  async asStripeUser(): Promise<Stripe.Response<Stripe.Customer> | undefined> {
    return await this.retrieveStripeUser()
  }

  async createOrUpdateStripeUser(options: Stripe.CustomerCreateParams): Promise<Stripe.Response<Stripe.Customer>> {
    const customer = await manageCustomer.createOrUpdateStripeUser(this, options)
    return customer
  }

  stripeId(): string {
    return manageCustomer.stripeId(this)
  }

  hasStripeId(): boolean {
    return manageCustomer.hasStripeId(this)
  }

  async addPaymentMethod(paymentMethodId: string): Promise<Stripe.Response<Stripe.PaymentMethod>> {
    const paymentMethod = await managePaymentMethod.addPaymentMethod(this, paymentMethodId)

    return paymentMethod
  }

  async updatePaymentMethod(paymentMethodId: string, params?: Stripe.PaymentMethodUpdateParams): Promise<Stripe.Response<Stripe.PaymentMethod>> {
    const updatedPaymentMethod = await managePaymentMethod.updatePaymentMethod(this, paymentMethodId, params)

    return updatedPaymentMethod
  }

  async deletePaymentMethod(paymentMethodId: number): Promise<Stripe.Response<Stripe.PaymentMethod>> {
    const deletedPaymentMethod = await managePaymentMethod.deletePaymentMethod(this, paymentMethodId)
    return deletedPaymentMethod
  }

  async retrievePaymentMethod(paymentMethod: number): Promise<PaymentMethodModel | undefined> {
    const defaultPaymentMethod = await managePaymentMethod.retrievePaymentMethod(this, paymentMethod)

    return defaultPaymentMethod
  }

  async paymentIntent(options: Stripe.PaymentIntentCreateParams): Promise<Stripe.Response<Stripe.PaymentIntent>> {
    if (!this.hasStripeId()) {
      throw new HttpError(404, 'Customer does not exist in Stripe')
    }

    const defaultOptions: Stripe.PaymentIntentCreateParams = {
      customer: this.stripeId(),
      currency: 'usd',
      amount: options.amount,
    }

    const mergedOptions = { ...defaultOptions, ...options }

    return await manageCharge.createPayment(this, mergedOptions.amount, mergedOptions)
  }

  async syncStripeCustomerDetails(options: StripeCustomerOptions): Promise<Stripe.Response<Stripe.Customer>> {
    const customer = await manageCustomer.syncStripeCustomerDetails(this, options)

    return customer
  }

  async subscriptionHistory(): Promise<Stripe.Response<Stripe.ApiList<Stripe.Invoice>>> {
    return manageInvoice.list(this)
  }

  async transactionHistory(): Promise<TransactionModel[]> {
    return manageTransaction.list(this)
  }

  async stripeSubscriptions(): Promise<Stripe.Response<Stripe.ApiList<Stripe.Invoice>>> {
    return manageInvoice.list(this)
  }

  async activeSubscription() {
    const subscription = await db.selectFrom('subscriptions')
      .where('user_id', '=', this.id)
      .where('provider_status', '=', 'active')
      .selectAll()
      .executeTakeFirst()

    if (subscription) {
      const providerSubscription = await manageSubscription.retrieve(this, subscription?.provider_id || '')

      return { subscription, providerSubscription }
    }

    return undefined
  }

  async isIncomplete(type: string): Promise<boolean> {
    return await manageSubscription.isIncomplete(this, type)
  }

  async paymentMethods(cardType?: string): Promise<PaymentMethodModel[]> {
    return await managePaymentMethod.listPaymentMethods(this, cardType)
  }

  async newSubscriptionInvoice(
    type: string,
    lookupKey: string,
        options: Partial<Stripe.SubscriptionCreateParams> = {},
  ): Promise<{ subscription: Stripe.Subscription, paymentIntent?: Stripe.PaymentIntent }> {
    return await this.newSubscription(type, lookupKey, { ...options, days_until_due: 15, collection_method: 'send_invoice' })
  }

  async newSubscription(
    type: string,
    lookupKey: string,
        options: Partial<Stripe.SubscriptionCreateParams> = {},
  ): Promise<{ subscription: Stripe.Subscription, paymentIntent?: Stripe.PaymentIntent }> {
    const subscription = await manageSubscription.create(this, type, lookupKey, options)

    const latestInvoice = subscription.latest_invoice as Stripe.Invoice | null
    const paymentIntent = latestInvoice?.payment_intent as Stripe.PaymentIntent | undefined

    return { subscription, paymentIntent }
  }

  async updateSubscription(
    type: string,
    lookupKey: string,
        options: Partial<Stripe.SubscriptionUpdateParams> = {},
  ): Promise<{ subscription: Stripe.Subscription, paymentIntent?: Stripe.PaymentIntent }> {
    const subscription = await manageSubscription.update(this, type, lookupKey, options)

    const latestInvoice = subscription.latest_invoice as Stripe.Invoice | null
    const paymentIntent = latestInvoice?.payment_intent as Stripe.PaymentIntent | undefined

    return { subscription, paymentIntent }
  }

  async cancelSubscription(
    providerId: string,
        options: Partial<Stripe.SubscriptionCreateParams> = {},
  ): Promise<{ subscription: Stripe.Subscription, paymentIntent?: Stripe.PaymentIntent }> {
    const subscription = await manageSubscription.cancel(providerId, options)

    return { subscription }
  }

  async createSetupIntent(
        options: Stripe.SetupIntentCreateParams = {},
  ): Promise<Stripe.Response<Stripe.SetupIntent>> {
    const defaultOptions: Partial<Stripe.SetupIntentCreateParams> = {
      metadata: options.metadata,
    }

    // Merge any additional provided options
    const mergedOptions = { ...defaultOptions, ...options }

    // Call Stripe to create the SetupIntent
    return await manageSetupIntent.create(this, mergedOptions)
  }

  async checkout(
    priceIds: CheckoutLineItem[],
        options: CheckoutOptions = {},
  ): Promise<Stripe.Response<Stripe.Checkout.Session>> {
    const newOptions: Partial<Stripe.Checkout.SessionCreateParams> = {}

    if (options.enableTax) {
      newOptions.automatic_tax = { enabled: true }
      delete options.enableTax
    }

    if (options.allowPromotions) {
      newOptions.allow_promotion_codes = true
      delete options.allowPromotions
    }

    const defaultOptions: Partial<Stripe.Checkout.SessionCreateParams> = {
      mode: 'payment',
      customer: await this.createOrGetStripeUser({}).then(customer => customer.id),
      line_items: priceIds.map((item: CheckoutLineItem) => ({
        price: item.priceId,
        quantity: item.quantity || 1,
      })),

    }

    const mergedOptions = { ...defaultOptions, ...newOptions, ...options }

    return await manageCheckout.create(this, mergedOptions)
  }

  distinct(column: keyof UserType): UserModel {
    return UserModel.distinct(column)
  }

  static distinct(column: keyof UserType): UserModel {
    const instance = new UserModel(null)

    instance.selectFromQuery = instance.selectFromQuery.select(column).distinct()

    instance.hasSelect = true

    return instance
  }

  join(table: string, firstCol: string, secondCol: string): UserModel {
    return UserModel.join(table, firstCol, secondCol)
  }

  static join(table: string, firstCol: string, secondCol: string): UserModel {
    const instance = new UserModel(null)

    instance.selectFromQuery = instance.selectFromQuery.innerJoin(table, firstCol, secondCol)

    return instance
  }

  static async rawQuery(rawQuery: string): Promise<any> {
    return await sql`${rawQuery}`.execute(db)
  }

  toJSON(): Partial<UserJsonResponse> {
    const output: Partial<UserJsonResponse> = {

      id: this.id,
      name: this.name,
      email: this.email,
      job_title: this.job_title,
      password: this.password,

      created_at: this.created_at,

      updated_at: this.updated_at,

      deployments: this.deployments,
      subscriptions: this.subscriptions,
      payment_methods: this.payment_methods,
      transactions: this.transactions,
      ...this.customColumns,
    }

    return output
  }

  parseResult(model: UserModel): UserModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof UserModel]
    }

    return model
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
  const result = await DB.instance.insertInto('users')
    .values(newUser)
    .executeTakeFirstOrThrow()

  return await find(Number(result.numInsertedOrUpdatedRows)) as UserModel
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(db)
}

export async function remove(id: number): Promise<void> {
  await DB.instance.deleteFrom('users')
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
