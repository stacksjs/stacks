import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import type { Stripe } from '@stacksjs/payments'
import type { CheckoutLineItem, CheckoutOptions, StripeCustomerOptions } from '@stacksjs/types'
import type { DeploymentModel } from './Deployment'
import type { PaymentMethodModel, PaymentMethodsTable } from './PaymentMethod'
import type { PaymentTransactionModel, PaymentTransactionsTable } from './PaymentTransaction'
import type { PostModel } from './Post'
import type { SubscriberModel } from './Subscriber'
import type { SubscriptionModel } from './Subscription'
import { randomUUIDv7 } from 'bun'

import { cache } from '@stacksjs/cache'

import { sql } from '@stacksjs/database'

import { HttpError, ModelNotFoundException } from '@stacksjs/error-handling'

import { dispatch } from '@stacksjs/events'

import { DB, SubqueryBuilder } from '@stacksjs/orm'
import { manageCharge, manageCheckout, manageCustomer, manageInvoice, managePaymentMethod, manageSetupIntent, manageSubscription, manageTransaction } from '@stacksjs/payments'

import Team from './Team'

export interface UsersTable {
  id: Generated<number>
  name: string
  email: string
  job_title: string
  password: string
  public_passkey?: string
  stripe_id?: string
  uuid?: string

  created_at?: Date

  updated_at?: Date

}

export interface UserResponse {
  data: UserJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface UserJsonResponse extends Omit<Selectable<UsersTable>, 'password'> {
  [key: string]: any
}

export type NewUser = Insertable<UsersTable>
export type UserUpdate = Updateable<UsersTable>

      type SortDirection = 'asc' | 'desc'
interface SortOptions { column: UserJsonResponse, order: SortDirection }
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
  protected attributes = {} as UserJsonResponse
  protected originalAttributes = {} as UserJsonResponse

  protected selectFromQuery: any
  protected withRelations: string[]
  protected updateFromQuery: any
  protected deleteFromQuery: any
  protected hasSelect: boolean
  private hasSaved: boolean
  private customColumns: Record<string, unknown> = {}

  constructor(user: UserJsonResponse | undefined) {
    if (user) {
      this.attributes = { ...user }
      this.originalAttributes = { ...user }

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
    this.hasSaved = false
  }

  mapCustomGetters(models: UserJsonResponse | UserJsonResponse[]): void {
    const data = models

    if (Array.isArray(data)) {
      data.map((model: UserJsonResponse) => {
        const customGetter = {
          default: () => {
          },

          salutationName: () => {
            return `Mr. ${model.name}`
          },

        }

        for (const [key, fn] of Object.entries(customGetter)) {
          model[key] = fn()
        }

        return model
      })
    }
    else {
      const model = data

      const customGetter = {
        default: () => {
        },

        salutationName: () => {
          return `Mr. ${model.name}`
        },

      }

      for (const [key, fn] of Object.entries(customGetter)) {
        model[key] = fn()
      }
    }
  }

  async mapCustomSetters(model: NewUser | UserUpdate): Promise<void> {
    const customSetter = {
      default: () => {
      },

      password: () => Bun.password.hash(model.password),

    }

    for (const [key, fn] of Object.entries(customSetter)) {
      model[key] = await fn()
    }
  }

  get subscriber(): SubscriberModel | undefined {
    return this.attributes.subscriber
  }

  get deployments(): DeploymentModel[] | [] {
    return this.attributes.deployments
  }

  get subscriptions(): SubscriptionModel[] | [] {
    return this.attributes.subscriptions
  }

  get payment_methods(): PaymentMethodModel[] | [] {
    return this.attributes.payment_methods
  }

  get posts(): PostModel[] | [] {
    return this.attributes.posts
  }

  get payment_transactions(): PaymentTransactionModel[] | [] {
    return this.attributes.payment_transactions
  }

  get id(): number {
    return this.attributes.id
  }

  get stripe_id(): string | undefined {
    return this.attributes.stripe_id
  }

  get uuid(): string | undefined {
    return this.attributes.uuid
  }

  get public_passkey(): string | undefined {
    return this.attributes.public_passkey
  }

  get name(): string {
    return this.attributes.name
  }

  get email(): string {
    return this.attributes.email
  }

  get job_title(): string {
    return this.attributes.job_title
  }

  get password(): string {
    return this.attributes.password
  }

  get created_at(): Date | undefined {
    return this.attributes.created_at
  }

  get updated_at(): Date | undefined {
    return this.attributes.updated_at
  }

  set stripe_id(value: string) {
    this.attributes.stripe_id = value
  }

  set uuid(value: string) {
    this.attributes.uuid = value
  }

  set public_passkey(value: string) {
    this.attributes.public_passkey = value
  }

  set name(value: string) {
    this.attributes.name = value
  }

  set email(value: string) {
    this.attributes.email = value
  }

  set job_title(value: string) {
    this.attributes.job_title = value
  }

  set password(value: string) {
    this.attributes.password = value
  }

  set updated_at(value: Date) {
    this.attributes.updated_at = value
  }

  getOriginal(column?: keyof UserJsonResponse): Partial<UserJsonResponse> {
    if (column) {
      return this.originalAttributes[column]
    }

    return this.originalAttributes
  }

  getChanges(): Partial<UserJsonResponse> {
    return this.fillable.reduce<Partial<UserJsonResponse>>((changes, key) => {
      const currentValue = this.attributes[key as keyof UsersTable]
      const originalValue = this.originalAttributes[key as keyof UsersTable]

      if (currentValue !== originalValue) {
        changes[key] = currentValue
      }

      return changes
    }, {})
  }

  isDirty(column?: keyof UserJsonResponse): boolean {
    if (column) {
      return this.attributes[column] !== this.originalAttributes[column]
    }

    return Object.entries(this.originalAttributes).some(([key, originalValue]) => {
      const currentValue = (this.attributes as any)[key]

      return currentValue !== originalValue
    })
  }

  isClean(column?: keyof UserJsonResponse): boolean {
    return !this.isDirty(column)
  }

  wasChanged(column?: keyof UserJsonResponse): boolean {
    return this.hasSaved && this.isDirty(column)
  }

  select(params: (keyof UserJsonResponse)[] | RawBuilder<string> | string): UserModel {
    this.selectFromQuery = this.selectFromQuery.select(params)

    this.hasSelect = true

    return this
  }

  static select(params: (keyof UserJsonResponse)[] | RawBuilder<string> | string): UserModel {
    const instance = new UserModel(undefined)

    // Initialize a query with the table name and selected fields
    instance.selectFromQuery = instance.selectFromQuery.select(params)

    instance.hasSelect = true

    return instance
  }

  async applyFind(id: number): Promise<UserModel | undefined> {
    const model = await DB.instance.selectFrom('users').where('id', '=', id).selectAll().executeTakeFirst()

    if (!model)
      return undefined

    this.mapCustomGetters(model)
    await this.loadRelations(model)

    const data = new UserModel(model)

    cache.getOrSet(`user:${id}`, JSON.stringify(model))

    return data
  }

  async find(id: number): Promise<UserModel | undefined> {
    return await this.applyFind(id)
  }

  // Method to find a User by ID
  static async find(id: number): Promise<UserModel | undefined> {
    const instance = new UserModel(undefined)

    return await instance.applyFind(id)
  }

  async first(): Promise<UserModel | undefined> {
    let model: UserJsonResponse | undefined

    if (this.hasSelect) {
      model = await this.selectFromQuery.executeTakeFirst()
    }
    else {
      model = await this.selectFromQuery.selectAll().executeTakeFirst()
    }

    if (model) {
      this.mapCustomGetters(model)
      await this.loadRelations(model)
    }

    const data = new UserModel(model)

    return data
  }

  static async first(): Promise<UserModel | undefined> {
    const instance = new UserJsonResponse(null)

    const model = await DB.instance.selectFrom('users')
      .selectAll()
      .executeTakeFirst()

    instance.mapCustomGetters(model)

    const data = new UserModel(model)

    return data
  }

  async applyFirstOrFail(): Promise<UserModel | undefined> {
    const model = await this.selectFromQuery.executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, 'No UserModel results found for query')

    if (model) {
      this.mapCustomGetters(model)
      await this.loadRelations(model)
    }

    const data = new UserModel(model)

    return data
  }

  async firstOrFail(): Promise<UserModel | undefined> {
    return await this.applyFirstOrFail()
  }

  static async firstOrFail(): Promise<UserModel | undefined> {
    const instance = new UserModel(undefined)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<UserModel[]> {
    const instance = new UserModel(undefined)

    const models = await DB.instance.selectFrom('users').selectAll().execute()

    instance.mapCustomGetters(models)

    const data = await Promise.all(models.map(async (model: UserJsonResponse) => {
      return new UserModel(model)
    }))

    return data
  }

  async applyFindOrFail(id: number): Promise<UserModel> {
    const model = await DB.instance.selectFrom('users').where('id', '=', id).selectAll().executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, `No UserModel results for ${id}`)

    cache.getOrSet(`user:${id}`, JSON.stringify(model))

    this.mapCustomGetters(model)
    await this.loadRelations(model)

    const data = new UserModel(model)

    return data
  }

  async findOrFail(id: number): Promise<UserModel> {
    return await this.applyFindOrFail(id)
  }

  static async findOrFail(id: number): Promise<UserModel> {
    const instance = new UserModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  async applyFindMany(ids: number[]): Promise<UserModel[]> {
    let query = DB.instance.selectFrom('users').where('id', 'in', ids)

    const instance = new UserModel(undefined)

    query = query.selectAll()

    const models = await query.execute()

    instance.mapCustomGetters(models)
    await instance.loadRelations(models)

    return models.map((modelItem: UserJsonResponse) => instance.parseResult(new UserModel(modelItem)))
  }

  static async findMany(ids: number[]): Promise<UserModel[]> {
    const instance = new UserModel(undefined)

    return await instance.applyFindMany(ids)
  }

  async findMany(ids: number[]): Promise<UserModel[]> {
    return await this.applyFindMany(ids)
  }

  skip(count: number): UserModel {
    this.selectFromQuery = this.selectFromQuery.offset(count)

    return this
  }

  static skip(count: number): UserModel {
    const instance = new UserModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.offset(count)

    return instance
  }

  async applyChunk(size: number, callback: (models: UserModel[]) => Promise<void>): Promise<void> {
    let page = 1
    let hasMore = true

    while (hasMore) {
      // Get one batch
      const models = await this.selectFromQuery
        .selectAll()
        .limit(size)
        .offset((page - 1) * size)
        .execute()

      // If we got fewer results than chunk size, this is the last batch
      if (models.length < size) {
        hasMore = false
      }

      // Process this batch
      if (models.length > 0) {
        await callback(models)
      }

      page++
    }
  }

  async chunk(size: number, callback: (models: UserModel[]) => Promise<void>): Promise<void> {
    await this.applyChunk(size, callback)
  }

  static async chunk(size: number, callback: (models: UserModel[]) => Promise<void>): Promise<void> {
    const instance = new UserModel(undefined)

    await instance.applyChunk(size, callback)
  }

  take(count: number): UserModel {
    this.selectFromQuery = this.selectFromQuery.limit(count)

    return this
  }

  static take(count: number): UserModel {
    const instance = new UserModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.limit(count)

    return instance
  }

  static async pluck<K extends keyof UserModel>(field: K): Promise<UserModel[K][]> {
    const instance = new UserModel(undefined)

    if (instance.hasSelect) {
      const model = await instance.selectFromQuery.execute()
      return model.map((modelItem: UserModel) => modelItem[field])
    }

    const model = await instance.selectFromQuery.selectAll().execute()

    return model.map((modelItem: UserModel) => modelItem[field])
  }

  async pluck<K extends keyof UserModel>(field: K): Promise<UserModel[K][]> {
    if (this.hasSelect) {
      const model = await this.selectFromQuery.execute()
      return model.map((modelItem: UserModel) => modelItem[field])
    }

    const model = await this.selectFromQuery.selectAll().execute()

    return model.map((modelItem: UserModel) => modelItem[field])
  }

  static async count(): Promise<number> {
    const instance = new UserModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`COUNT(*) as count`)
      .executeTakeFirst()

    return result.count || 0
  }

  async count(): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`COUNT(*) as count`)
      .executeTakeFirst()

    return result.count || 0
  }

  static async max(field: keyof UserModel): Promise<number> {
    const instance = new UserModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`MAX(${sql.raw(field as string)}) as max `)
      .executeTakeFirst()

    return result.max
  }

  async max(field: keyof UserModel): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`MAX(${sql.raw(field as string)}) as max`)
      .executeTakeFirst()

    return result.max
  }

  static async min(field: keyof UserModel): Promise<number> {
    const instance = new UserModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`MIN(${sql.raw(field as string)}) as min `)
      .executeTakeFirst()

    return result.min
  }

  async min(field: keyof UserModel): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`MIN(${sql.raw(field as string)}) as min `)
      .executeTakeFirst()

    return result.min
  }

  static async avg(field: keyof UserModel): Promise<number> {
    const instance = new UserModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`AVG(${sql.raw(field as string)}) as avg `)
      .executeTakeFirst()

    return result.avg
  }

  async avg(field: keyof UserModel): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`AVG(${sql.raw(field as string)}) as avg `)
      .executeTakeFirst()

    return result.avg
  }

  static async sum(field: keyof UserModel): Promise<number> {
    const instance = new UserModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`SUM(${sql.raw(field as string)}) as sum `)
      .executeTakeFirst()

    return result.sum
  }

  async sum(field: keyof UserModel): Promise<number> {
    const result = this.selectFromQuery
      .select(sql`SUM(${sql.raw(field as string)}) as sum `)
      .executeTakeFirst()

    return result.sum
  }

  async applyGet(): Promise<UserModel[]> {
    let models

    if (this.hasSelect) {
      models = await this.selectFromQuery.execute()
    }
    else {
      models = await this.selectFromQuery.selectAll().execute()
    }

    this.mapCustomGetters(models)
    await this.loadRelations(models)

    const data = await Promise.all(models.map(async (model: UserJsonResponse) => {
      return new UserModel(model)
    }))

    return data
  }

  async get(): Promise<UserModel[]> {
    return await this.applyGet()
  }

  static async get(): Promise<UserModel[]> {
    const instance = new UserModel(undefined)

    return await instance.applyGet()
  }

  has(relation: string): UserModel {
    this.selectFromQuery = this.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(
        selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.user_id`, '=', 'users.id'),
      ),
    )

    return this
  }

  static has(relation: string): UserModel {
    const instance = new UserModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(
        selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.user_id`, '=', 'users.id'),
      ),
    )

    return instance
  }

  static whereExists(callback: (qb: any) => any): UserModel {
    const instance = new UserModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(callback({ exists, selectFrom })),
    )

    return instance
  }

  applyWhereHas(
    relation: string,
    callback: (query: SubqueryBuilder<keyof UserModel>) => void,
  ): UserModel {
    const subqueryBuilder = new SubqueryBuilder()

    callback(subqueryBuilder)
    const conditions = subqueryBuilder.getConditions()

    this.selectFromQuery = this.selectFromQuery
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
              if (condition.operator === 'is not') {
                subquery = subquery.whereNotIn(condition.column, condition.values)
              }
              else {
                subquery = subquery.whereIn(condition.column, condition.values)
              }

              break

            case 'whereNull':
              subquery = subquery.whereNull(condition.column)
              break

            case 'whereNotNull':
              subquery = subquery.whereNotNull(condition.column)
              break

            case 'whereBetween':
              subquery = subquery.whereBetween(condition.column, condition.values)
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

    return this
  }

  whereHas(
    relation: string,
    callback: (query: SubqueryBuilder<keyof UserModel>) => void,
  ): UserModel {
    return this.applyWhereHas(relation, callback)
  }

  static whereHas(
    relation: string,
    callback: (query: SubqueryBuilder<keyof UserModel>) => void,
  ): UserModel {
    const instance = new UserModel(undefined)

    return instance.applyWhereHas(relation, callback)
  }

  applyDoesntHave(relation: string): UserModel {
    this.selectFromQuery = this.selectFromQuery.where(({ not, exists, selectFrom }: any) =>
      not(
        exists(
          selectFrom(relation)
            .select('1')
            .whereRef(`${relation}.user_id`, '=', 'users.id'),
        ),
      ),
    )

    return this
  }

  doesntHave(relation: string): UserModel {
    return this.applyDoesntHave(relation)
  }

  static doesntHave(relation: string): UserModel {
    const instance = new UserModel(undefined)

    return instance.applyDoesntHave(relation)
  }

  applyWhereDoesntHave(relation: string, callback: (query: SubqueryBuilder<UsersTable>) => void): UserModel {
    const subqueryBuilder = new SubqueryBuilder()

    callback(subqueryBuilder)
    const conditions = subqueryBuilder.getConditions()

    this.selectFromQuery = this.selectFromQuery
      .where(({ exists, selectFrom, not }: any) => {
        const subquery = selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.user_id`, '=', 'users.id')

        return not(exists(subquery))
      })

    conditions.forEach((condition) => {
      switch (condition.method) {
        case 'where':
          if (condition.type === 'and') {
            this.where(condition.column, condition.operator!, condition.value || [])
          }
          break

        case 'whereIn':
          if (condition.operator === 'is not') {
            this.whereNotIn(condition.column, condition.values || [])
          }
          else {
            this.whereIn(condition.column, condition.values || [])
          }

          break

        case 'whereNull':
          this.whereNull(condition.column)
          break

        case 'whereNotNull':
          this.whereNotNull(condition.column)
          break

        case 'whereBetween':
          this.whereBetween(condition.column, condition.range || [0, 0])
          break

        case 'whereExists': {
          const nestedBuilder = new SubqueryBuilder()
          condition.callback!(nestedBuilder)
          break
        }
      }
    })

    return this
  }

  whereDoesntHave(relation: string, callback: (query: SubqueryBuilder<UsersTable>) => void): UserModel {
    return this.applyWhereDoesntHave(relation, callback)
  }

  static whereDoesntHave(
    relation: string,
    callback: (query: SubqueryBuilder<UsersTable>) => void,
  ): UserModel {
    const instance = new UserModel(undefined)

    return instance.applyWhereDoesntHave(relation, callback)
  }

  async applyPaginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<UserResponse> {
    const totalRecordsResult = await DB.instance.selectFrom('users')
      .select(DB.instance.fn.count('id').as('total')) // Use 'id' or another actual column name
      .executeTakeFirst()

    const totalRecords = Number(totalRecordsResult?.total) || 0
    const totalPages = Math.ceil(totalRecords / (options.limit ?? 10))

    const usersWithExtra = await DB.instance.selectFrom('users')
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

  async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<UserResponse> {
    return await this.applyPaginate(options)
  }

  // Method to get all users
  static async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<UserResponse> {
    const instance = new UserModel(undefined)

    return await instance.applyPaginate(options)
  }

  async applyCreate(newUser: NewUser): Promise<UserModel> {
    const filteredValues = Object.fromEntries(
      Object.entries(newUser).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewUser

    await this.mapCustomSetters(filteredValues)

    filteredValues.uuid = randomUUIDv7()

    const result = await DB.instance.insertInto('users')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await this.find(Number(result.numInsertedOrUpdatedRows)) as UserModel

    if (model)
      dispatch('user:created', model)

    return model
  }

  async create(newUser: NewUser): Promise<UserModel> {
    return await this.applyCreate(newUser)
  }

  static async create(newUser: NewUser): Promise<UserModel> {
    const instance = new UserModel(undefined)

    return await instance.applyCreate(newUser)
  }

  static async createMany(newUser: NewUser[]): Promise<void> {
    const instance = new UserModel(undefined)

    const valuesFiltered = newUser.map((newUser: NewUser) => {
      const filteredValues = Object.fromEntries(
        Object.entries(newUser).filter(([key]) =>
          !instance.guarded.includes(key) && instance.fillable.includes(key),
        ),
      ) as NewUser

      filteredValues.uuid = randomUUIDv7()

      return filteredValues
    })

    await DB.instance.insertInto('users')
      .values(valuesFiltered)
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
    const instance = new UserModel(undefined)

    const model = await instance.find(Number(id))

    if (model)
      dispatch('user:deleted', model)

    return await DB.instance.deleteFrom('users')
      .where('id', '=', id)
      .execute()
  }

  applyWhere<V>(column: keyof UsersTable, ...args: [V] | [Operator, V]): UserModel {
    if (args.length === 1) {
      const [value] = args
      this.selectFromQuery = this.selectFromQuery.where(column, '=', value)
      this.updateFromQuery = this.updateFromQuery.where(column, '=', value)
      this.deleteFromQuery = this.deleteFromQuery.where(column, '=', value)
    }
    else {
      const [operator, value] = args as [Operator, V]
      this.selectFromQuery = this.selectFromQuery.where(column, operator, value)
      this.updateFromQuery = this.updateFromQuery.where(column, operator, value)
      this.deleteFromQuery = this.deleteFromQuery.where(column, operator, value)
    }

    return this
  }

  where<V = string>(column: keyof UsersTable, ...args: [V] | [Operator, V]): UserModel {
    return this.applyWhere<V>(column, ...args)
  }

  static where<V = string>(column: keyof UsersTable, ...args: [V] | [Operator, V]): UserModel {
    const instance = new UserModel(undefined)

    return instance.applyWhere<V>(column, ...args)
  }

  whereColumn(first: keyof UsersTable, operator: Operator, second: keyof UsersTable): UserModel {
    this.selectFromQuery = this.selectFromQuery.whereRef(first, operator, second)

    return this
  }

  static whereColumn(first: keyof UsersTable, operator: Operator, second: keyof UsersTable): UserModel {
    const instance = new UserModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.whereRef(first, operator, second)

    return instance
  }

  applyWhereRef(column: keyof UsersTable, ...args: string[]): UserModel {
    const [operatorOrValue, value] = args
    const operator = value === undefined ? '=' : operatorOrValue
    const actualValue = value === undefined ? operatorOrValue : value

    const instance = new UserModel(undefined)
    instance.selectFromQuery = instance.selectFromQuery.whereRef(column, operator, actualValue)

    return instance
  }

  whereRef(column: keyof UsersTable, ...args: string[]): UserModel {
    return this.applyWhereRef(column, ...args)
  }

  static whereRef(column: keyof UsersTable, ...args: string[]): UserModel {
    const instance = new UserModel(undefined)

    return instance.applyWhereRef(column, ...args)
  }

  whereRaw(sqlStatement: string): UserModel {
    this.selectFromQuery = this.selectFromQuery.where(sql`${sqlStatement}`)

    return this
  }

  static whereRaw(sqlStatement: string): UserModel {
    const instance = new UserModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where(sql`${sqlStatement}`)

    return instance
  }

  applyOrWhere(...conditions: [string, any][]): UserModel {
    this.selectFromQuery = this.selectFromQuery.where((eb: any) => {
      return eb.or(
        conditions.map(([column, value]) => eb(column, '=', value)),
      )
    })

    this.updateFromQuery = this.updateFromQuery.where((eb: any) => {
      return eb.or(
        conditions.map(([column, value]) => eb(column, '=', value)),
      )
    })

    this.deleteFromQuery = this.deleteFromQuery.where((eb: any) => {
      return eb.or(
        conditions.map(([column, value]) => eb(column, '=', value)),
      )
    })

    return this
  }

  orWhere(...conditions: [string, any][]): UserModel {
    return this.applyOrWhere(...conditions)
  }

  static orWhere(...conditions: [string, any][]): UserModel {
    const instance = new UserModel(undefined)

    return instance.applyOrWhere(...conditions)
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
    let instance = new UserModel(undefined)

    if (condition)
      instance = callback(instance)

    return instance
  }

  whereNotNull(column: keyof UsersTable): UserModel {
    this.selectFromQuery = this.selectFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is not', null),
    )

    this.updateFromQuery = this.updateFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is not', null),
    )

    this.deleteFromQuery = this.deleteFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is not', null),
    )

    return this
  }

  static whereNotNull(column: keyof UsersTable): UserModel {
    const instance = new UserModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is not', null),
    )

    instance.updateFromQuery = instance.updateFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is not', null),
    )

    instance.deleteFromQuery = instance.deleteFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is not', null),
    )

    return instance
  }

  whereNull(column: keyof UsersTable): UserModel {
    this.selectFromQuery = this.selectFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    this.updateFromQuery = this.updateFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    this.deleteFromQuery = this.deleteFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    return this
  }

  static whereNull(column: keyof UsersTable): UserModel {
    const instance = new UserModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    instance.updateFromQuery = instance.updateFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    instance.deleteFromQuery = instance.deleteFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    return instance
  }

  static whereName(value: string): UserModel {
    const instance = new UserModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('name', '=', value)

    return instance
  }

  static whereEmail(value: string): UserModel {
    const instance = new UserModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('email', '=', value)

    return instance
  }

  static whereJobTitle(value: string): UserModel {
    const instance = new UserModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('jobTitle', '=', value)

    return instance
  }

  static wherePassword(value: string): UserModel {
    const instance = new UserModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('password', '=', value)

    return instance
  }

  applyWhereIn<V>(column: keyof UsersTable, values: V[]) {
    this.selectFromQuery = this.selectFromQuery.where(column, 'in', values)

    this.updateFromQuery = this.updateFromQuery.where(column, 'in', values)

    this.deleteFromQuery = this.deleteFromQuery.where(column, 'in', values)

    return this
  }

  whereIn<V = number>(column: keyof UsersTable, values: V[]): UserModel {
    return this.applyWhereIn<V>(column, values)
  }

  static whereIn<V = number>(column: keyof UsersTable, values: V[]): UserModel {
    const instance = new UserModel(undefined)

    return instance.applyWhereIn<V>(column, values)
  }

  applyWhereBetween<V>(column: keyof UsersTable, range: [V, V]): UserModel {
    if (range.length !== 2) {
      throw new HttpError(500, 'Range must have exactly two values: [min, max]')
    }

    const query = sql` ${sql.raw(column as string)} between ${range[0]} and ${range[1]} `

    this.selectFromQuery = this.selectFromQuery.where(query)
    this.updateFromQuery = this.updateFromQuery.where(query)
    this.deleteFromQuery = this.deleteFromQuery.where(query)

    return this
  }

  whereBetween<V = number>(column: keyof UsersTable, range: [V, V]): UserModel {
    return this.applyWhereBetween<V>(column, range)
  }

  static whereBetween<V = number>(column: keyof UsersTable, range: [V, V]): UserModel {
    const instance = new UserModel(undefined)

    return instance.applyWhereBetween<V>(column, range)
  }

  applyWhereLike(column: keyof UsersTable, value: string): UserModel {
    this.selectFromQuery = this.selectFromQuery.where(sql` ${sql.raw(column as string)} LIKE ${value}`)

    this.updateFromQuery = this.updateFromQuery.where(sql` ${sql.raw(column as string)} LIKE ${value}`)

    this.deleteFromQuery = this.deleteFromQuery.where(sql` ${sql.raw(column as string)} LIKE ${value}`)

    return this
  }

  whereLike(column: keyof UsersTable, value: string): UserModel {
    return this.applyWhereLike(column, value)
  }

  static whereLike(column: keyof UsersTable, value: string): UserModel {
    const instance = new UserModel(undefined)

    return instance.applyWhereLike(column, value)
  }

  applyWhereNotIn<V>(column: keyof UsersTable, values: V[]): UserModel {
    this.selectFromQuery = this.selectFromQuery.where(column, 'not in', values)

    this.updateFromQuery = this.updateFromQuery.where(column, 'not in', values)

    this.deleteFromQuery = this.deleteFromQuery.where(column, 'not in', values)

    return this
  }

  whereNotIn<V>(column: keyof UsersTable, values: V[]): UserModel {
    return this.applyWhereNotIn<V>(column, values)
  }

  static whereNotIn<V = number>(column: keyof UsersTable, values: V[]): UserModel {
    const instance = new UserModel(undefined)

    return instance.applyWhereNotIn<V>(column, values)
  }

  async exists(): Promise<boolean> {
    let model

    if (this.hasSelect) {
      model = await this.selectFromQuery.executeTakeFirst()
    }
    else {
      model = await this.selectFromQuery.selectAll().executeTakeFirst()
    }

    return model !== null && model !== undefined
  }

  static async latest(): Promise<UserModel | undefined> {
    const instance = new UserModel(undefined)

    const model = await DB.instance.selectFrom('users')
      .selectAll()
      .orderBy('id', 'desc')
      .executeTakeFirst()

    if (!model)
      return undefined

    instance.mapCustomGetters(model)

    const data = new UserModel(model)

    return data
  }

  static async oldest(): Promise<UserModel | undefined> {
    const instance = new UserModel(undefined)

    const model = await DB.instance.selectFrom('users')
      .selectAll()
      .orderBy('id', 'asc')
      .executeTakeFirst()

    if (!model)
      return undefined

    instance.mapCustomGetters(model)

    const data = new UserModel(model)

    return data
  }

  static async firstOrCreate(
    condition: Partial<UserJsonResponse>,
    newUser: NewUser,
  ): Promise<UserModel> {
    const instance = new UserModel(undefined)

    const key = Object.keys(condition)[0] as keyof UserJsonResponse

    if (!key) {
      throw new HttpError(500, 'Condition must contain at least one key-value pair')
    }

    const value = condition[key]

    // Attempt to find the first record matching the condition
    const existingUser = await DB.instance.selectFrom('users')
      .selectAll()
      .where(key, '=', value)
      .executeTakeFirst()

    if (existingUser) {
      instance.mapCustomGetters(existingUser)
      await instance.loadRelations(existingUser)

      return new UserModel(existingUser as UserJsonResponse)
    }
    else {
      return await instance.create(newUser)
    }
  }

  static async updateOrCreate(
    condition: Partial<UserJsonResponse>,
    newUser: NewUser,
  ): Promise<UserModel> {
    const instance = new UserModel(undefined)

    const key = Object.keys(condition)[0] as keyof UserJsonResponse

    if (!key) {
      throw new HttpError(500, 'Condition must contain at least one key-value pair')
    }

    const value = condition[key]

    // Attempt to find the first record matching the condition
    const existingUser = await DB.instance.selectFrom('users')
      .selectAll()
      .where(key, '=', value)
      .executeTakeFirst()

    if (existingUser) {
      // If found, update the existing record
      await DB.instance.updateTable('users')
        .set(newUser)
        .where(key, '=', value)
        .executeTakeFirstOrThrow()

      // Fetch and return the updated record
      const updatedUser = await DB.instance.selectFrom('users')
        .selectAll()
        .where(key, '=', value)
        .executeTakeFirst()

      if (!updatedUser) {
        throw new HttpError(500, 'Failed to fetch updated record')
      }

      instance.hasSaved = true

      return new UserModel(updatedUser as UserJsonResponse)
    }
    else {
      // If not found, create a new record
      return await instance.create(newUser)
    }
  }

  async loadRelations(models: UserJsonResponse | UserJsonResponse[]): Promise<void> {
    // Handle both single model and array of models
    const modelArray = Array.isArray(models) ? models : [models]
    if (!modelArray.length)
      return

    const modelIds = modelArray.map(model => model.id)

    for (const relation of this.withRelations) {
      const relatedRecords = await DB.instance
        .selectFrom(relation)
        .where('user_id', 'in', modelIds)
        .selectAll()
        .execute()

      if (Array.isArray(models)) {
        models.map((model: UserJsonResponse) => {
          const records = relatedRecords.filter((record: { user_id: number }) => {
            return record.user_id === model.id
          })

          model[relation] = records.length === 1 ? records[0] : records
          return model
        })
      }
      else {
        const records = relatedRecords.filter((record: { user_id: number }) => {
          return record.user_id === models.id
        })

        models[relation] = records.length === 1 ? records[0] : records
      }
    }
  }

  with(relations: string[]): UserModel {
    this.withRelations = relations

    return this
  }

  static with(relations: string[]): UserModel {
    const instance = new UserModel(undefined)

    instance.withRelations = relations

    return instance
  }

  async last(): Promise<UserModel | undefined> {
    let model: UserJsonResponse | undefined

    if (this.hasSelect) {
      model = await this.selectFromQuery.executeTakeFirst()
    }
    else {
      model = await this.selectFromQuery.selectAll().orderBy('id', 'desc').executeTakeFirst()
    }

    if (model) {
      this.mapCustomGetters(model)
      await this.loadRelations(model)
    }

    const data = new UserModel(model)

    return data
  }

  static async last(): Promise<UserModel | undefined> {
    const model = await DB.instance.selectFrom('users').selectAll().orderBy('id', 'desc').executeTakeFirst()

    if (!model)
      return undefined

    const data = new UserModel(model)

    return data
  }

  orderBy(column: keyof UsersTable, order: 'asc' | 'desc'): UserModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, order)

    return this
  }

  static orderBy(column: keyof UsersTable, order: 'asc' | 'desc'): UserModel {
    const instance = new UserModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, order)

    return instance
  }

  groupBy(column: keyof UsersTable): UserModel {
    this.selectFromQuery = this.selectFromQuery.groupBy(column)

    return this
  }

  static groupBy(column: keyof UsersTable): UserModel {
    const instance = new UserModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.groupBy(column)

    return instance
  }

  having<V = string>(column: keyof UsersTable, operator: Operator, value: V): UserModel {
    this.selectFromQuery = this.selectFromQuery.having(column, operator, value)

    return this
  }

  static having<V = string>(column: keyof UsersTable, operator: Operator, value: V): UserModel {
    const instance = new UserModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.having(column, operator, value)

    return instance
  }

  inRandomOrder(): UserModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(sql` ${sql.raw('RANDOM()')} `)

    return this
  }

  static inRandomOrder(): UserModel {
    const instance = new UserModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(sql` ${sql.raw('RANDOM()')} `)

    return instance
  }

  orderByDesc(column: keyof UsersTable): UserModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, 'desc')

    return this
  }

  static orderByDesc(column: keyof UsersTable): UserModel {
    const instance = new UserModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, 'desc')

    return instance
  }

  orderByAsc(column: keyof UsersTable): UserModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, 'asc')

    return this
  }

  static orderByAsc(column: keyof UsersTable): UserModel {
    const instance = new UserModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, 'asc')

    return instance
  }

  async update(newUser: UserUpdate): Promise<UserModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newUser).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewUser

    await this.mapCustomSetters(filteredValues)

    await DB.instance.updateTable('users')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      const model = await this.find(this.id)

      if (model)
        dispatch('user:updated', model)

      return model
    }

    this.hasSaved = true

    return undefined
  }

  async forceUpdate(user: UserUpdate): Promise<UserModel | undefined> {
    if (this.id === undefined) {
      this.updateFromQuery.set(user).execute()
    }

    await this.mapCustomSetters(user)

    await DB.instance.updateTable('users')
      .set(user)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      const model = await this.find(this.id)

      if (model)
        dispatch('user:updated', model)

      this.hasSaved = true

      return model
    }

    return undefined
  }

  async save(): Promise<void> {
    if (!this)
      throw new HttpError(500, 'User data is undefined')

    await this.mapCustomSetters(this.attributes)

    if (this.id === undefined) {
      await this.create(this.attributes)
    }
    else {
      await this.update(this.attributes)
    }

    this.hasSaved = true
  }

  fill(data: Partial<UserJsonResponse>): UserModel {
    const filteredValues = Object.fromEntries(
      Object.entries(data).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewUser

    this.attributes = {
      ...this.attributes,
      ...filteredValues,
    }

    return this
  }

  forceFill(data: Partial<UserJsonResponse>): UserModel {
    this.attributes = {
      ...this.attributes,
      ...data,
    }

    return this
  }

  // Method to delete (soft delete) the user instance
  async delete(): Promise<UsersTable> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()
    const model = await this.find(Number(this.id))
    if (model)
      dispatch('user:deleted', model)

    return await DB.instance.deleteFrom('users')
      .where('id', '=', this.id)
      .execute()
  }

  async userTeams() {
    if (this.id === undefined)
      throw new HttpError(500, 'Relation Error!')

    const results = await DB.instance.selectFrom('teams')
      .where('team_id', '=', this.id)
      .selectAll()
      .execute()

    const tableRelationIds = results.map((result: { team_id: number }) => result.team_id)

    if (!tableRelationIds.length)
      throw new HttpError(500, 'Relation Error!')

    const relationResults = await Team.whereIn('id', tableRelationIds).get()

    return relationResults
  }

  toSearchableObject(): Partial<UserJsonResponse> {
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

  async storeTransaction(productId: number): Promise<PaymentTransactionsTable | undefined> {
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

  async retrievePaymentMethod(paymentMethod: number): Promise<PaymentMethodsTable | undefined> {
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

  async transactionHistory(): Promise<PaymentTransactionsTable[]> {
    return manageTransaction.list(this)
  }

  async stripeSubscriptions(): Promise<Stripe.Response<Stripe.ApiList<Stripe.Invoice>>> {
    return manageInvoice.list(this)
  }

  async activeSubscription() {
    const subscription = await DB.instance.selectFrom('subscriptions')
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

  async paymentMethods(cardType?: string): Promise<PaymentMethodsTable[]> {
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

  distinct(column: keyof UserJsonResponse): UserModel {
    this.selectFromQuery = this.selectFromQuery.select(column).distinct()

    this.hasSelect = true

    return this
  }

  static distinct(column: keyof UserJsonResponse): UserModel {
    const instance = new UserModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.select(column).distinct()

    instance.hasSelect = true

    return instance
  }

  join(table: string, firstCol: string, secondCol: string): UserModel {
    this.selectFromQuery = this.selectFromQuery.innerJoin(table, firstCol, secondCol)

    return this
  }

  static join(table: string, firstCol: string, secondCol: string): UserModel {
    const instance = new UserModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.innerJoin(table, firstCol, secondCol)

    return instance
  }

  toJSON(): UserJsonResponse {
    const output = {

      uuid: this.uuid,

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
      posts: this.posts,
      payment_transactions: this.payment_transactions,
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
  const query = DB.instance.selectFrom('users').where('id', '=', id).selectAll()

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
  return await sql`${rawQuery}`.execute(DB.instance)
}

export async function remove(id: number): Promise<void> {
  await DB.instance.deleteFrom('users')
    .where('id', '=', id)
    .execute()
}

export async function whereName(value: string): Promise<UserModel[]> {
  const query = DB.instance.selectFrom('users').where('name', '=', value)
  const results: UserJsonResponse = await query.execute()

  return results.map((modelItem: UserJsonResponse) => new UserModel(modelItem))
}

export async function whereEmail(value: string): Promise<UserModel[]> {
  const query = DB.instance.selectFrom('users').where('email', '=', value)
  const results: UserJsonResponse = await query.execute()

  return results.map((modelItem: UserJsonResponse) => new UserModel(modelItem))
}

export async function whereJobTitle(value: string): Promise<UserModel[]> {
  const query = DB.instance.selectFrom('users').where('job_title', '=', value)
  const results: UserJsonResponse = await query.execute()

  return results.map((modelItem: UserJsonResponse) => new UserModel(modelItem))
}

export async function wherePassword(value: string): Promise<UserModel[]> {
  const query = DB.instance.selectFrom('users').where('password', '=', value)
  const results: UserJsonResponse = await query.execute()

  return results.map((modelItem: UserJsonResponse) => new UserModel(modelItem))
}

export const User = UserModel

export default User
