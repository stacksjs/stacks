import type { CheckoutLineItem, CheckoutOptions, StripeCustomerOptions } from '@stacksjs/types'
import type { Generated, Insertable, Selectable, Updateable } from 'kysely'
import { cache } from '@stacksjs/cache'
import { db, sql } from '@stacksjs/database'
import { HttpError } from '@stacksjs/error-handling'
import { dispatch } from '@stacksjs/events'
import { manageCharge, manageCheckout, manageCustomer, managePaymentMethod, manageSetupIntent, manageSubscription, type Stripe } from '@stacksjs/payments'

import Post from './Post'

import Subscriber from './Subscriber'

import Team from './Team'

// import { Kysely, MysqlDialect, PostgresDialect } from 'kysely'
// import { Pool } from 'pg'

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
  stripe_id?: string

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
  private fillable = ['name', 'email', 'job_title', 'password', 'stripe_id', 'public_key', 'two_factor_secret', 'team_id', 'deployment_id', 'post_id']
  private softDeletes = false
  protected query: any
  protected hasSelect: boolean
  public id: number | undefined
  public stripe_id: string | undefined
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
    this.stripe_id = user?.stripe_id
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
      throw new HttpError(404, `No UserModel results for ${id}`)

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
      .executeTakeFirst()

    const model = await find(Number(result.insertId)) as UserModel

    if (model)
      dispatch('user:created', model)

    return model
  }

  static async forceCreate(newUser: NewUser): Promise<UserModel> {
    const result = await db.insertInto('users')
      .values(newUser)
      .executeTakeFirst()

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
      throw new HttpError(500, 'Invalid number of arguments')
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
      throw new HttpError(500, 'Invalid number of arguments')
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
      throw new HttpError(404, 'No UserModel results found for query')

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
      throw new HttpError(500, 'User ID is undefined')

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
      throw new HttpError(500, 'User ID is undefined')

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
      throw new HttpError(500, 'User data is undefined')

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
      throw new HttpError(500, 'User ID is undefined')

    const model = await this.find(this.id)

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

  async deployments() {
    if (this.id === undefined)
      throw new HttpError(500, 'Relation Error!')

    const results = await db.selectFrom('deployments')
      .where('user_id', '=', this.id)
      .selectAll()
      .execute()

    return results
  }

  async subscriptions() {
    if (this.id === undefined)
      throw new HttpError(500, 'Relation Error!')

    const results = await db.selectFrom('subscriptions')
      .where('user_id', '=', this.id)
      .selectAll()
      .execute()

    return results
  }

  async userTeams() {
    if (this.id === undefined)
      throw new HttpError(500, 'Relation Error!')

    const results = await db.selectFrom('team_users')
      .where('user_id', '=', this.id)
      .selectAll()
      .execute()

    const tableRelationIds = results.map(result => result.team_id)

    if (!tableRelationIds.length)
      throw new HttpError(500, 'Relation Error!')

    const relationResults = await Team.whereIn('id', tableRelationIds).get()

    return relationResults
  }

  async createStripeUser(options: Stripe.CustomerCreateParams): Promise<Stripe.Response<Stripe.Customer>> {
    const customer = await manageCustomer.createStripeCustomer(this, options)

    return customer
  }

  async updateStripeUser(options: Stripe.CustomerCreateParams): Promise<Stripe.Response<Stripe.Customer>> {
    const customer = await manageCustomer.updateStripeCustomer(this, options)

    return customer
  }

  async deleteStripeUser(): Promise<Stripe.Response<Stripe.DeletedCustomer>> {
    const deletedCustomer = await manageCustomer.deleteStripeUser(this)
    return deletedCustomer
  }

  async createOrGetStripeUser(options: Stripe.CustomerCreateParams): Promise<Stripe.Response<Stripe.Customer>> {
    const customer = await manageCustomer.createOrGetStripeUser(this, options)
    return customer
  }

  async retrieveStripeUser(): Promise<Stripe.Response<Stripe.Customer>> {
    const customer = await manageCustomer.retrieveStripeUser(this)
    return customer
  }

  async defaultPaymentMethod(): Promise<Stripe.PaymentMethod | null> {
    const customer = await this.retrieveStripeUser()
    const defaultPaymentMethodId = customer.invoice_settings?.default_payment_method as string

    if (!defaultPaymentMethodId) {
      return null
    }

    const defaultPaymentMethod = await managePaymentMethod.retrievePaymentMethod(this, defaultPaymentMethodId)

    return defaultPaymentMethod
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

  async updatePaymentMethod(paymentMethodId: string, params: Stripe.PaymentMethodUpdateParams): Promise<Stripe.Response<Stripe.PaymentMethod>> {
    const updatedPaymentMethod = await managePaymentMethod.updatePaymentMethod(this, paymentMethodId, params)

    return updatedPaymentMethod
  }

  async deletePaymentMethod(paymentMethodId: string): Promise<Stripe.Response<Stripe.PaymentMethod>> {
    const deletedPaymentMethod = await managePaymentMethod.deletePaymentMethod(this, paymentMethodId)
    return deletedPaymentMethod
  }

  async retrievePaymentMethod(paymentMethod: string): Promise<Stripe.Response<Stripe.PaymentMethod> | null> {
    const defaultPaymentMethod = await managePaymentMethod.retrievePaymentMethod(this, paymentMethod)

    return defaultPaymentMethod
  }

  async paymentIntent(options: Stripe.PaymentIntentCreateParams): Promise<Stripe.Response<Stripe.PaymentIntent>> {
    if (!this.hasStripeId()) {
      throw new Error('Customer does not exist in Stripe')
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

  async isSubscribed(type: string): Promise<boolean> {
    return await manageSubscription.isValid(this, type)
  }

  async isIncomplete(type: string): Promise<boolean> {
    return await manageSubscription.isIncomplete(this, type)
  }

  async paymentMethods(cardType?: string): Promise<Stripe.Response<Stripe.ApiList<Stripe.PaymentMethod>>> {
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
