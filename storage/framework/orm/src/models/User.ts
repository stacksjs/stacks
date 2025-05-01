import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import type { Stripe } from '@stacksjs/payments'
import type { CheckoutLineItem, CheckoutOptions, StripeCustomerOptions } from '@stacksjs/types'
import type { AuthorModel } from './Author'
import type { CustomerModel } from './Customer'
import type { DeploymentModel } from './Deployment'
import type { DriverModel } from './Driver'
import type { PaymentMethodModel, PaymentMethodsTable } from './PaymentMethod'
import type { PaymentTransactionModel, PaymentTransactionsTable } from './PaymentTransaction'
import type { SubscriberModel } from './Subscriber'
import type { SubscriptionModel } from './Subscription'

import { randomUUIDv7 } from 'bun'

import { sql } from '@stacksjs/database'

import { HttpError } from '@stacksjs/error-handling'

import { dispatch } from '@stacksjs/events'

import { DB } from '@stacksjs/orm'
import { manageCharge, manageCheckout, manageCustomer, manageInvoice, managePaymentMethod, manageSetupIntent, manageSubscription, manageTransaction } from '@stacksjs/payments'

import { BaseOrm } from '../utils/base'

export interface UsersTable {
  id: Generated<number>
  name: string
  email: string
  job_title: string
  password: string
  public_passkey?: string
  stripe_id?: string
  uuid?: string

  created_at?: string

  updated_at?: string

}

// Type for reading model data (created_at is required)
export type UserRead = UsersTable

// Type for creating/updating model data (created_at is optional)
export type UserWrite = Omit<UsersTable, 'created_at'> & {
  created_at?: string
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

export interface UserJsonResponse extends Omit<Selectable<UserRead>, 'password'> {
  [key: string]: any
}

export type NewUser = Insertable<UserWrite>
export type UserUpdate = Updateable<UserWrite>

export class UserModel extends BaseOrm<UserModel, UsersTable, UserJsonResponse> {
  private readonly hidden: Array<keyof UserJsonResponse> = ['password']
  private readonly fillable: Array<keyof UserJsonResponse> = ['name', 'email', 'job_title', 'password', 'stripe_id', 'uuid', 'two_factor_secret', 'public_key', 'team_id']
  private readonly guarded: Array<keyof UserJsonResponse> = []
  protected attributes = {} as UserJsonResponse
  protected originalAttributes = {} as UserJsonResponse

  protected selectFromQuery: any
  protected updateFromQuery: any
  protected deleteFromQuery: any
  protected hasSelect: boolean
  private customColumns: Record<string, unknown> = {}

  /**
   * This model inherits many query methods from BaseOrm:
   * - pluck, chunk, whereExists, has, doesntHave, whereHas, whereDoesntHave
   * - inRandomOrder, max, min, avg, paginate, get, and more
   *
   * See BaseOrm class for the full list of inherited methods.
   */

  constructor(user: UserJsonResponse | undefined) {
    super('users')
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
  }

  protected async loadRelations(models: UserJsonResponse | UserJsonResponse[]): Promise<void> {
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

  static with(relations: string[]): UserModel {
    const instance = new UserModel(undefined)

    return instance.applyWith(relations)
  }

  protected mapCustomGetters(models: UserJsonResponse | UserJsonResponse[]): void {
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
          (model as any)[key] = fn()
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
        (model as any)[key] = fn()
      }
    }
  }

  async mapCustomSetters(model: NewUser | UserUpdate): Promise<void> {
    const customSetter = {
      default: () => {
      },

      password: () => Bun.password.hash(String(model.password)),

    }

    for (const [key, fn] of Object.entries(customSetter)) {
      (model as any)[key] = await fn()
    }
  }

  get subscriber(): SubscriberModel | undefined {
    return this.attributes.subscriber
  }

  get driver(): DriverModel | undefined {
    return this.attributes.driver
  }

  get author(): AuthorModel | undefined {
    return this.attributes.author
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

  get payment_transactions(): PaymentTransactionModel[] | [] {
    return this.attributes.payment_transactions
  }

  get customers(): CustomerModel[] | [] {
    return this.attributes.customers
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

  get created_at(): string | undefined {
    return this.attributes.created_at
  }

  get updated_at(): string | undefined {
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

  set updated_at(value: string) {
    this.attributes.updated_at = value
  }

  static select(params: (keyof UserJsonResponse)[] | RawBuilder<string> | string): UserModel {
    const instance = new UserModel(undefined)

    return instance.applySelect(params)
  }

  // Method to find a User by ID
  static async find(id: number): Promise<UserModel | undefined> {
    const query = DB.instance.selectFrom('users').where('id', '=', id).selectAll()

    const model = await query.executeTakeFirst()

    if (!model)
      return undefined

    const instance = new UserModel(undefined)
    return instance.createInstance(model)
  }

  static async first(): Promise<UserModel | undefined> {
    const instance = new UserModel(undefined)

    const model = await instance.applyFirst()

    const data = new UserModel(model)

    return data
  }

  static async last(): Promise<UserModel | undefined> {
    const instance = new UserModel(undefined)

    const model = await instance.applyLast()

    if (!model)
      return undefined

    return new UserModel(model)
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

  static async findOrFail(id: number): Promise<UserModel | undefined> {
    const instance = new UserModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  static async findMany(ids: number[]): Promise<UserModel[]> {
    const instance = new UserModel(undefined)

    const models = await instance.applyFindMany(ids)

    return models.map((modelItem: UserJsonResponse) => instance.parseResult(new UserModel(modelItem)))
  }

  static async latest(column: keyof UsersTable = 'created_at'): Promise<UserModel | undefined> {
    const instance = new UserModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'desc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new UserModel(model)
  }

  static async oldest(column: keyof UsersTable = 'created_at'): Promise<UserModel | undefined> {
    const instance = new UserModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'asc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new UserModel(model)
  }

  static skip(count: number): UserModel {
    const instance = new UserModel(undefined)

    return instance.applySkip(count)
  }

  static take(count: number): UserModel {
    const instance = new UserModel(undefined)

    return instance.applyTake(count)
  }

  static where<V = string>(column: keyof UsersTable, ...args: [V] | [Operator, V]): UserModel {
    const instance = new UserModel(undefined)

    return instance.applyWhere<V>(column, ...args)
  }

  static orWhere(...conditions: [string, any][]): UserModel {
    const instance = new UserModel(undefined)

    return instance.applyOrWhere(...conditions)
  }

  static whereNotIn<V = number>(column: keyof UsersTable, values: V[]): UserModel {
    const instance = new UserModel(undefined)

    return instance.applyWhereNotIn<V>(column, values)
  }

  static whereBetween<V = number>(column: keyof UsersTable, range: [V, V]): UserModel {
    const instance = new UserModel(undefined)

    return instance.applyWhereBetween<V>(column, range)
  }

  static whereRef(column: keyof UsersTable, ...args: string[]): UserModel {
    const instance = new UserModel(undefined)

    return instance.applyWhereRef(column, ...args)
  }

  static when(condition: boolean, callback: (query: UserModel) => UserModel): UserModel {
    const instance = new UserModel(undefined)

    return instance.applyWhen(condition, callback as any)
  }

  static whereNull(column: keyof UsersTable): UserModel {
    const instance = new UserModel(undefined)

    return instance.applyWhereNull(column)
  }

  static whereNotNull(column: keyof UsersTable): UserModel {
    const instance = new UserModel(undefined)

    return instance.applyWhereNotNull(column)
  }

  static whereLike(column: keyof UsersTable, value: string): UserModel {
    const instance = new UserModel(undefined)

    return instance.applyWhereLike(column, value)
  }

  static orderBy(column: keyof UsersTable, order: 'asc' | 'desc'): UserModel {
    const instance = new UserModel(undefined)

    return instance.applyOrderBy(column, order)
  }

  static orderByAsc(column: keyof UsersTable): UserModel {
    const instance = new UserModel(undefined)

    return instance.applyOrderByAsc(column)
  }

  static orderByDesc(column: keyof UsersTable): UserModel {
    const instance = new UserModel(undefined)

    return instance.applyOrderByDesc(column)
  }

  static groupBy(column: keyof UsersTable): UserModel {
    const instance = new UserModel(undefined)

    return instance.applyGroupBy(column)
  }

  static having<V = string>(column: keyof UsersTable, operator: Operator, value: V): UserModel {
    const instance = new UserModel(undefined)

    return instance.applyHaving<V>(column, operator, value)
  }

  static inRandomOrder(): UserModel {
    const instance = new UserModel(undefined)

    return instance.applyInRandomOrder()
  }

  static whereColumn(first: keyof UsersTable, operator: Operator, second: keyof UsersTable): UserModel {
    const instance = new UserModel(undefined)

    return instance.applyWhereColumn(first, operator, second)
  }

  static async max(field: keyof UsersTable): Promise<number> {
    const instance = new UserModel(undefined)

    return await instance.applyMax(field)
  }

  static async min(field: keyof UsersTable): Promise<number> {
    const instance = new UserModel(undefined)

    return await instance.applyMin(field)
  }

  static async avg(field: keyof UsersTable): Promise<number> {
    const instance = new UserModel(undefined)

    return await instance.applyAvg(field)
  }

  static async sum(field: keyof UsersTable): Promise<number> {
    const instance = new UserModel(undefined)

    return await instance.applySum(field)
  }

  static async count(): Promise<number> {
    const instance = new UserModel(undefined)

    return instance.applyCount()
  }

  static async get(): Promise<UserModel[]> {
    const instance = new UserModel(undefined)

    const results = await instance.applyGet()

    return results.map((item: UserJsonResponse) => instance.createInstance(item))
  }

  static async pluck<K extends keyof UserModel>(field: K): Promise<UserModel[K][]> {
    const instance = new UserModel(undefined)

    return await instance.applyPluck(field)
  }

  static async chunk(size: number, callback: (models: UserModel[]) => Promise<void>): Promise<void> {
    const instance = new UserModel(undefined)

    await instance.applyChunk(size, async (models) => {
      const modelInstances = models.map((item: UserJsonResponse) => instance.createInstance(item))
      await callback(modelInstances)
    })
  }

  static async paginate(options: { limit?: number, offset?: number, page?: number } = { limit: 10, offset: 0, page: 1 }): Promise<{
    data: UserModel[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }> {
    const instance = new UserModel(undefined)

    const result = await instance.applyPaginate(options)

    return {
      data: result.data.map((item: UserJsonResponse) => instance.createInstance(item)),
      paging: result.paging,
      next_cursor: result.next_cursor,
    }
  }

  // Instance method for creating model instances
  createInstance(data: UserJsonResponse): UserModel {
    return new UserModel(data)
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

    const model = await DB.instance.selectFrom('users')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created User')
    }

    if (model)
      dispatch('user:created', model)
    return this.createInstance(model)
  }

  async create(newUser: NewUser): Promise<UserModel> {
    return await this.applyCreate(newUser)
  }

  static async create(newUser: NewUser): Promise<UserModel> {
    const instance = new UserModel(undefined)
    return await instance.applyCreate(newUser)
  }

  static async firstOrCreate(search: Partial<UsersTable>, values: NewUser = {} as NewUser): Promise<UserModel> {
    // First try to find a record matching the search criteria
    const instance = new UserModel(undefined)

    // Apply all search conditions
    for (const [key, value] of Object.entries(search)) {
      instance.selectFromQuery = instance.selectFromQuery.where(key, '=', value)
    }

    // Try to find the record
    const existingRecord = await instance.applyFirst()

    if (existingRecord) {
      return instance.createInstance(existingRecord)
    }

    // If no record exists, create a new one with combined search criteria and values
    const createData = { ...search, ...values } as NewUser
    return await UserModel.create(createData)
  }

  static async updateOrCreate(search: Partial<UsersTable>, values: NewUser = {} as NewUser): Promise<UserModel> {
    // First try to find a record matching the search criteria
    const instance = new UserModel(undefined)

    // Apply all search conditions
    for (const [key, value] of Object.entries(search)) {
      instance.selectFromQuery = instance.selectFromQuery.where(key, '=', value)
    }

    // Try to find the record
    const existingRecord = await instance.applyFirst()

    if (existingRecord) {
      // If record exists, update it with the new values
      const model = instance.createInstance(existingRecord)
      const updatedModel = await model.update(values as UserUpdate)

      // Return the updated model instance
      if (updatedModel) {
        return updatedModel
      }

      // If update didn't return a model, fetch it again to ensure we have latest data
      const refreshedModel = await instance.applyFirst()
      return instance.createInstance(refreshedModel!)
    }

    // If no record exists, create a new one with combined search criteria and values
    const createData = { ...search, ...values } as NewUser
    return await UserModel.create(createData)
  }

  async update(newUser: UserUpdate): Promise<UserModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newUser).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as UserUpdate

    await this.mapCustomSetters(filteredValues)

    filteredValues.updated_at = new Date().toISOString()

    await DB.instance.updateTable('users')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('users')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated User')
      }

      if (model)
        dispatch('user:updated', model)
      return this.createInstance(model)
    }

    return undefined
  }

  async forceUpdate(newUser: UserUpdate): Promise<UserModel | undefined> {
    await DB.instance.updateTable('users')
      .set(newUser)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('users')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated User')
      }

      if (this)
        dispatch('user:updated', model)
      return this.createInstance(model)
    }

    return undefined
  }

  async save(): Promise<UserModel> {
    // If the model has an ID, update it; otherwise, create a new record
    if (this.id) {
      // Update existing record
      await DB.instance.updateTable('users')
        .set(this.attributes as UserUpdate)
        .where('id', '=', this.id)
        .executeTakeFirst()

      // Get the updated data
      const model = await DB.instance.selectFrom('users')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated User')
      }

      if (this)
        dispatch('user:updated', model)
      return this.createInstance(model)
    }
    else {
      // Create new record
      const result = await DB.instance.insertInto('users')
        .values(this.attributes as NewUser)
        .executeTakeFirst()

      // Get the created data
      const model = await DB.instance.selectFrom('users')
        .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve created User')
      }

      if (this)
        dispatch('user:created', model)
      return this.createInstance(model)
    }
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

    const instance = new UserModel(undefined)
    const model = await DB.instance.selectFrom('users')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created User')
    }

    if (model)
      dispatch('user:created', model)

    return instance.createInstance(model)
  }

  // Method to remove a User
  async delete(): Promise<number> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()
    const model = await this.find(Number(this.id))

    if (model)
      dispatch('user:deleted', model)

    const deleted = await DB.instance.deleteFrom('users')
      .where('id', '=', this.id)
      .execute()

    return deleted.numDeletedRows
  }

  static async remove(id: number): Promise<any> {
    const instance = new UserModel(undefined)

    const model = await instance.find(Number(id))

    if (model)
      dispatch('user:deleted', model)

    return await DB.instance.deleteFrom('users')
      .where('id', '=', id)
      .execute()
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

    instance.selectFromQuery = instance.selectFromQuery.where('job_title', '=', value)

    return instance
  }

  static wherePassword(value: string): UserModel {
    const instance = new UserModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('password', '=', value)

    return instance
  }

  static whereIn<V = number>(column: keyof UsersTable, values: V[]): UserModel {
    const instance = new UserModel(undefined)

    return instance.applyWhereIn<V>(column, values)
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

  static distinct(column: keyof UserJsonResponse): UserModel {
    const instance = new UserModel(undefined)

    return instance.applyDistinct(column)
  }

  static join(table: string, firstCol: string, secondCol: string): UserModel {
    const instance = new UserModel(undefined)

    return instance.applyJoin(table, firstCol, secondCol)
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
      payment_transactions: this.payment_transactions,
      customers: this.customers,
      ...this.customColumns,
      public_passkey: this.public_passkey,
      stripe_id: this.stripe_id,
    }

    return output
  }

  parseResult(model: UserModel): UserModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof UserModel]
    }

    return model
  }

  // Add a protected applyFind implementation
  protected async applyFind(id: number): Promise<UserModel | undefined> {
    const model = await DB.instance.selectFrom(this.tableName)
      .where('id', '=', id)
      .selectAll()
      .executeTakeFirst()

    if (!model)
      return undefined

    this.mapCustomGetters(model)

    await this.loadRelations(model)

    // Return a proper instance using the factory method
    return this.createInstance(model)
  }
}

export async function find(id: number): Promise<UserModel | undefined> {
  const query = DB.instance.selectFrom('users').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  const instance = new UserModel(undefined)
  return instance.createInstance(model)
}

export async function count(): Promise<number> {
  const results = await UserModel.count()

  return results
}

export async function create(newUser: NewUser): Promise<UserModel> {
  const instance = new UserModel(undefined)
  return await instance.applyCreate(newUser)
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
