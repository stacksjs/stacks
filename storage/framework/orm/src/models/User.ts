import type { CheckoutLineItem, CheckoutOptions, StripeCustomerOptions } from '@stacksjs/types'
import type { Insertable, Selectable, Updateable } from 'kysely'
import type { DeploymentModel } from './Deployment'
import type { PaymentMethodModel } from './PaymentMethod'
import type { SubscriptionModel } from './Subscription'
import type { TransactionModel } from './Transaction'
import { randomUUIDv7 } from 'bun'
import { cache } from '@stacksjs/cache'

import { db, sql } from '@stacksjs/database'

import { HttpError } from '@stacksjs/error-handling'

import { dispatch } from '@stacksjs/events'

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
  team_id?: number
  deployment_id?: number
  post_id?: number
  paymentmethod_id?: number
  transaction_id?: number
  subscription_id?: number
  public_passkey?: string
  stripe_id?: string
  uuid?: string

  created_at?: Date

  updated_at?: Date

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
export type NewUser = Partial<Insertable<UsersTable>>
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
  private fillable = ['name', 'email', 'job_title', 'password', 'stripe_id', 'uuid', 'two_factor_secret', 'public_key', 'team_id', 'deployment_id', 'post_id', 'paymentmethod_id', 'transaction_id', 'subscription_id']
  private softDeletes = false
  protected selectFromQuery: any
  protected updateFromQuery: any
  protected deleteFromQuery: any
  protected hasSelect: boolean
  public deployments: DeploymentModel[] | undefined
  public subscriptions: SubscriptionModel[] | undefined
  public payment_methods: PaymentMethodModel[] | undefined
  public transactions: TransactionModel[] | undefined
  public id: number
  public stripe_id: string | undefined
  public uuid: string | undefined
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
  public paymentmethod_id: number | undefined
  public transaction_id: number | undefined
  public subscription_id: number | undefined

  constructor(user: Partial<UserType> | null) {
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

    this.team_id = user?.team_id
    this.deployment_id = user?.deployment_id
    this.post_id = user?.post_id
    this.paymentmethod_id = user?.paymentmethod_id
    this.transaction_id = user?.transaction_id
    this.subscription_id = user?.subscription_id

    this.selectFromQuery = db.selectFrom('users')
    this.updateFromQuery = db.updateTable('users')
    this.deleteFromQuery = db.deleteFrom('users')
    this.hasSelect = false
  }

  // Method to find a User by ID
  async find(id: number): Promise<UserModel | undefined> {
    const query = db.selectFrom('users').where('id', '=', id).selectAll()

    const model = await query.executeTakeFirst()

    if (!model)
      return undefined

    const data = new UserModel(model as UserType)

    cache.getOrSet(`user:${id}`, JSON.stringify(model))

    return data
  }

  // Method to find a User by ID
  static async find(id: number): Promise<UserModel | undefined> {
    const query = db.selectFrom('users').where('id', '=', id).selectAll()

    const model = await query.executeTakeFirst()

    if (!model)
      return undefined

    const instance = new UserModel(model as UserType)

    model.deployments = await instance.deploymentsHasMany()

    model.subscriptions = await instance.subscriptionsHasMany()

    model.payment_methods = await instance.payment_methodsHasMany()

    model.transactions = await instance.transactionsHasMany()

    const data = new UserModel(model as UserType)

    cache.getOrSet(`user:${id}`, JSON.stringify(model))

    return data
  }

  static async all(): Promise<UserModel[]> {
    const query = db.selectFrom('users').selectAll()

    const instance = new UserModel(null)

    const results = await query.execute()

    return results.map(modelItem => instance.parseResult(new UserModel(modelItem)))
  }

  static async findOrFail(id: number): Promise<UserModel> {
    let query = db.selectFrom('users').where('id', '=', id)

    const instance = new UserModel(null)

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

    query = query.selectAll()

    const model = await query.execute()

    return model.map(modelItem => instance.parseResult(new UserModel(modelItem)))
  }

  // Method to get a User by criteria
  static async get(): Promise<UserModel[]> {
    const instance = new UserModel(null)

    if (instance.hasSelect) {
      const model = await instance.selectFromQuery.execute()

      return model.map((modelItem: UserModel) => new UserModel(modelItem))
    }

    const model = await instance.selectFromQuery.selectAll().execute()

    return model.map((modelItem: UserModel) => new UserModel(modelItem))
  }

  // Method to get a User by criteria
  async get(): Promise<UserModel[]> {
    if (this.hasSelect) {
      const model = await this.selectFromQuery.execute()

      return model.map((modelItem: UserModel) => new UserModel(modelItem))
    }

    const model = await this.selectFromQuery.selectAll().execute()

    return model.map((modelItem: UserModel) => new UserModel(modelItem))
  }

  static async count(): Promise<number> {
    const instance = new UserModel(null)

    const results = await instance.selectFromQuery.selectAll().execute()

    return results.length
  }

  async count(): Promise<number> {
    if (this.hasSelect) {
      const results = await this.selectFromQuery.execute()

      return results.length
    }

    const results = await this.selectFromQuery.execute()

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

    filteredValues.uuid = randomUUIDv7()

    const result = await db.insertInto('users')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await find(Number(result.numInsertedOrUpdatedRows)) as UserModel

    if (model)
      dispatch('user:created', model)

    return model
  }

  static async createMany(newUsers: NewUser[]): Promise<void> {
    const instance = new UserModel(null)

    const filteredValues = newUsers.map(newUser =>
      Object.fromEntries(
        Object.entries(newUser).filter(([key]) => instance.fillable.includes(key)),
      ) as NewUser,
    )

    filteredValues.forEach((model) => {
      model.uuid = randomUUIDv7()
    })

    await db.insertInto('users')
      .values(filteredValues)
      .executeTakeFirst()
  }

  static async forceCreate(newUser: NewUser): Promise<UserModel> {
    const result = await db.insertInto('users')
      .values(newUser)
      .executeTakeFirst()

    const model = await find(Number(result.numInsertedOrUpdatedRows)) as UserModel

    if (model)
      dispatch('user:created', model)

    return model
  }

  // Method to remove a User
  static async remove(id: number): Promise<any> {
    const model = await instance.find(Number(id))

    return await db.deleteFrom('users')
      .where('id', '=', id)
      .execute()

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

    this.selectFromQuery = this.selectFromQuery.where(column, operator, value)

    this.updateFromQuery = this.updateFromQuery.where(column, operator, value)
    this.deleteFromQuery = this.deleteFromQuery.where(column, operator, value)

    return this
  }

  orWhere(...args: Array<[string, string, any]>): UserModel {
    if (args.length === 0) {
      throw new HttpError(500, 'At least one condition must be provided')
    }

    // Use the expression builder to append the OR conditions
    this.selectFromQuery = this.selectFromQuery.where((eb: any) =>
      eb.or(
        args.map(([column, operator, value]) => eb(column, operator, value)),
      ),
    )

    this.updateFromQuery = this.updateFromQuery.where((eb: any) =>
      eb.or(
        args.map(([column, operator, value]) => eb(column, operator, value)),
      ),
    )

    this.deleteFromQuery = this.deleteFromQuery.where((eb: any) =>
      eb.or(
        args.map(([column, operator, value]) => eb(column, operator, value)),
      ),
    )

    return this
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

    instance.selectFromQuery = instance.selectFromQuery.where(column, operator, value)

    instance.updateFromQuery = instance.updateFromQuery.where(column, operator, value)

    instance.deleteFromQuery = instance.deleteFromQuery.where(column, operator, value)

    return instance
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

  whereNull(column: string): UserModel {
    this.selectFromQuery = this.selectFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    this.updateFromQuery = this.updateFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    return this
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

  static whereIn(column: keyof UserType, values: any[]): UserModel {
    const instance = new UserModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where(column, 'in', values)

    instance.updateFromQuery = instance.updateFromQuery.where(column, 'in', values)

    instance.deleteFromQuery = instance.deleteFromQuery.where(column, 'in', values)

    return instance
  }

  async first(): Promise<UserModel | undefined> {
    const model = await this.selectFromQuery.selectAll().executeTakeFirst()

    if (!model)
      return undefined

    const data = new UserModel(model as UserType)

    return data
  }

  async firstOrFail(): Promise<UserModel | undefined> {
    const model = await this.selectFromQuery.executeTakeFirst()

    if (model === undefined)
      throw new HttpError(404, 'No UserModel results found for query')

    return this.parseResult(new UserModel(model))
  }

  async exists(): Promise<boolean> {
    const model = await this.selectFromQuery.executeTakeFirst()

    return model !== null || model !== undefined
  }

  static async first(): Promise<UserType | undefined> {
    const model = await db.selectFrom('users')
      .selectAll()
      .executeTakeFirst()

    if (!model)
      return undefined

    const instance = new UserModel(model as UserType)

    model.deployments = await instance.deploymentsHasMany()

    model.subscriptions = await instance.subscriptionsHasMany()

    model.payment_methods = await instance.payment_methodsHasMany()

    model.transactions = await instance.transactionsHasMany()

    const data = new UserModel(model as UserType)

    return data
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

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, order)

    return instance
  }

  orderBy(column: keyof UserType, order: 'asc' | 'desc'): UserModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, order)

    return this
  }

  static orderByDesc(column: keyof UserType): UserModel {
    const instance = new UserModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, 'desc')

    return instance
  }

  orderByDesc(column: keyof UserType): UserModel {
    this.selectFromQuery = this.orderBy(column, 'desc')

    return this
  }

  static orderByAsc(column: keyof UserType): UserModel {
    const instance = new UserModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, 'asc')

    return instance
  }

  orderByAsc(column: keyof UserType): UserModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, 'desc')

    return this
  }

  async update(user: UserUpdate): Promise<UserModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(user).filter(([key]) => this.fillable.includes(key)),
    ) as NewUser

    if (this.id === undefined) {
      this.updateFromQuery.set(filteredValues).execute()
    }

    await db.updateTable('users')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    const model = await this.find(this.id)

    if (model)
      dispatch('user:updated', model)

    return model
  }

  async forceUpdate(user: UserUpdate): Promise<UserModel | undefined> {
    if (this.id === undefined) {
      this.updateFromQuery.set(user).execute()
    }

    await db.updateTable('users')
      .set(user)
      .where('id', '=', this.id)
      .executeTakeFirst()

    const model = await this.find(this.id)

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
  async delete(): Promise<any> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()
    const model = await this.find(Number(this.id))

    return await db.deleteFrom('users')
      .where('id', '=', this.id)
      .execute()

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

  async deploymentsHasMany(): Promise<DeploymentModel[]> {
    if (this.id === undefined)
      throw new HttpError(500, 'Relation Error!')

    const results = await db.selectFrom('deployments')
      .where('user_id', '=', this.id)
      .selectAll()
      .execute()

    return results.map(modelItem => new Deployment(modelItem))
  }

  async subscriptionsHasMany(): Promise<SubscriptionModel[]> {
    if (this.id === undefined)
      throw new HttpError(500, 'Relation Error!')

    const results = await db.selectFrom('subscriptions')
      .where('user_id', '=', this.id)
      .selectAll()
      .execute()

    return results.map(modelItem => new Subscription(modelItem))
  }

  async payment_methodsHasMany(): Promise<PaymentMethodModel[]> {
    if (this.id === undefined)
      throw new HttpError(500, 'Relation Error!')

    const results = await db.selectFrom('payment_methods')
      .where('user_id', '=', this.id)
      .selectAll()
      .execute()

    return results.map(modelItem => new PaymentMethod(modelItem))
  }

  async transactionsHasMany(): Promise<TransactionModel[]> {
    if (this.id === undefined)
      throw new HttpError(500, 'Relation Error!')

    const results = await db.selectFrom('transactions')
      .where('user_id', '=', this.id)
      .selectAll()
      .execute()

    return results.map(modelItem => new Transaction(modelItem))
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
    this.selectFromQuery = this.selectFromQuery.select(column).distinct()

    this.hasSelect = true

    return this
  }

  static distinct(column: keyof UserType): UserModel {
    const instance = new UserModel(null)

    instance.selectFromQuery = instance.selectFromQuery.select(column).distinct()

    instance.hasSelect = true

    return instance
  }

  join(table: string, firstCol: string, secondCol: string): UserModel {
    this.selectFromQuery = this.selectFromQuery(table, firstCol, secondCol)

    return this
  }

  static join(table: string, firstCol: string, secondCol: string): UserModel {
    const instance = new UserModel(null)

    instance.selectFromQuery = instance.selectFromQuery.innerJoin(table, firstCol, secondCol)

    return instance
  }

  static async rawQuery(rawQuery: string): Promise<any> {
    return await sql`${rawQuery}`.execute(db)
  }

  toJSON() {
    const output: Partial<UserType> = {
      deployments: this.deployments,
      subscriptions: this.subscriptions,
      payment_methods: this.payment_methods,
      transactions: this.transactions,

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

  return await find(Number(result.numInsertedOrUpdatedRows)) as UserModel
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
