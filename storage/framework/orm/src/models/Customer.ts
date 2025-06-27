import type { RawBuilder } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import type { CustomerJsonResponse, CustomersTable, CustomerUpdate, NewCustomer } from '../types/CustomerType'
import type { GiftCardModel } from './GiftCard'
import type { LicenseKeyModel } from './LicenseKey'
import type { OrderModel } from './Order'
import type { PaymentModel } from './Payment'
import type { ReviewModel } from './Review'
import type { UserModel } from './User'
import type { WaitlistProductModel } from './WaitlistProduct'
import type { WaitlistRestaurantModel } from './WaitlistRestaurant'
import { randomUUIDv7 } from 'bun'

import { sql } from '@stacksjs/database'

import { HttpError } from '@stacksjs/error-handling'

import { dispatch } from '@stacksjs/events'

import { DB } from '@stacksjs/orm'

import { BaseOrm } from '../utils/base'

export class CustomerModel extends BaseOrm<CustomerModel, CustomersTable, CustomerJsonResponse> {
  private readonly hidden: Array<keyof CustomerJsonResponse> = []
  private readonly fillable: Array<keyof CustomerJsonResponse> = ['name', 'email', 'phone', 'total_spent', 'last_order', 'status', 'avatar', 'uuid', 'user_id']
  private readonly guarded: Array<keyof CustomerJsonResponse> = []
  protected attributes = {} as CustomerJsonResponse
  protected originalAttributes = {} as CustomerJsonResponse

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

  constructor(customer: CustomerJsonResponse | undefined) {
    super('customers')
    if (customer) {
      this.attributes = { ...customer }
      this.originalAttributes = { ...customer }

      Object.keys(customer).forEach((key) => {
        if (!(key in this)) {
          this.customColumns[key] = (customer as CustomerJsonResponse)[key]
        }
      })
    }

    this.withRelations = []
    this.selectFromQuery = DB.instance.selectFrom('customers')
    this.updateFromQuery = DB.instance.updateTable('customers')
    this.deleteFromQuery = DB.instance.deleteFrom('customers')
    this.hasSelect = false
  }

  protected async loadRelations(models: CustomerJsonResponse | CustomerJsonResponse[]): Promise<void> {
    // Handle both single model and array of models
    const modelArray = Array.isArray(models) ? models : [models]
    if (!modelArray.length)
      return

    const modelIds = modelArray.map(model => model.id)

    for (const relation of this.withRelations) {
      const relatedRecords = await DB.instance
        .selectFrom(relation)
        .where('customer_id', 'in', modelIds)
        .selectAll()
        .execute()

      if (Array.isArray(models)) {
        models.map((model: CustomerJsonResponse) => {
          const records = relatedRecords.filter((record: { customer_id: number }) => {
            return record.customer_id === model.id
          })

          model[relation] = records.length === 1 ? records[0] : records
          return model
        })
      }
      else {
        const records = relatedRecords.filter((record: { customer_id: number }) => {
          return record.customer_id === models.id
        })

        models[relation] = records.length === 1 ? records[0] : records
      }
    }
  }

  static with(relations: string[]): CustomerModel {
    const instance = new CustomerModel(undefined)

    return instance.applyWith(relations)
  }

  protected mapCustomGetters(models: CustomerJsonResponse | CustomerJsonResponse[]): void {
    const data = models

    if (Array.isArray(data)) {
      data.map((model: CustomerJsonResponse) => {
        const customGetter = {
          default: () => {
          },

          fullContactInfo: () => {
            return `${model.name} (${model.email}, ${model.phone})`
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

        fullContactInfo: () => {
          return `${model.name} (${model.email}, ${model.phone})`
        },

      }

      for (const [key, fn] of Object.entries(customGetter)) {
        (model as any)[key] = fn()
      }
    }
  }

  async mapCustomSetters(model: NewCustomer | CustomerUpdate): Promise<void> {
    const customSetter = {
      default: () => {
      },

    }

    for (const [key, fn] of Object.entries(customSetter)) {
      (model as any)[key] = await fn()
    }
  }

  get orders(): OrderModel[] | [] {
    return this.attributes.orders
  }

  get gift_cards(): GiftCardModel[] | [] {
    return this.attributes.gift_cards
  }

  get reviews(): ReviewModel[] | [] {
    return this.attributes.reviews
  }

  get payments(): PaymentModel[] | [] {
    return this.attributes.payments
  }

  get license_keys(): LicenseKeyModel[] | [] {
    return this.attributes.license_keys
  }

  get waitlist_products(): WaitlistProductModel[] | [] {
    return this.attributes.waitlist_products
  }

  get waitlist_restaurants(): WaitlistRestaurantModel[] | [] {
    return this.attributes.waitlist_restaurants
  }

  get user_id(): number {
    return this.attributes.user_id
  }

  get user(): UserModel | undefined {
    return this.attributes.user
  }

  get id(): number {
    return this.attributes.id
  }

  get uuid(): string | undefined {
    return this.attributes.uuid
  }

  get name(): string {
    return this.attributes.name
  }

  get email(): string {
    return this.attributes.email
  }

  get phone(): string {
    return this.attributes.phone
  }

  get total_spent(): number | undefined {
    return this.attributes.total_spent
  }

  get last_order(): string | undefined {
    return this.attributes.last_order
  }

  get status(): string | string[] {
    return this.attributes.status
  }

  get avatar(): string {
    return this.attributes.avatar
  }

  get created_at(): string | undefined {
    return this.attributes.created_at
  }

  get updated_at(): string | undefined {
    return this.attributes.updated_at
  }

  set uuid(value: string) {
    this.attributes.uuid = value
  }

  set name(value: string) {
    this.attributes.name = value
  }

  set email(value: string) {
    this.attributes.email = value
  }

  set phone(value: string) {
    this.attributes.phone = value
  }

  set total_spent(value: number) {
    this.attributes.total_spent = value
  }

  set last_order(value: string) {
    this.attributes.last_order = value
  }

  set status(value: string | string[]) {
    this.attributes.status = value
  }

  set avatar(value: string) {
    this.attributes.avatar = value
  }

  set updated_at(value: string) {
    this.attributes.updated_at = value
  }

  static select(params: (keyof CustomerJsonResponse)[] | RawBuilder<string> | string): CustomerModel {
    const instance = new CustomerModel(undefined)

    return instance.applySelect(params)
  }

  // Method to find a Customer by ID
  static async find(id: number): Promise<CustomerModel | undefined> {
    const query = DB.instance.selectFrom('customers').where('id', '=', id).selectAll()

    const model = await query.executeTakeFirst()

    if (!model)
      return undefined

    const instance = new CustomerModel(undefined)
    return instance.createInstance(model)
  }

  static async first(): Promise<CustomerModel | undefined> {
    const instance = new CustomerModel(undefined)

    const model = await instance.applyFirst()

    const data = new CustomerModel(model)

    return data
  }

  static async last(): Promise<CustomerModel | undefined> {
    const instance = new CustomerModel(undefined)

    const model = await instance.applyLast()

    if (!model)
      return undefined

    return new CustomerModel(model)
  }

  static async firstOrFail(): Promise<CustomerModel | undefined> {
    const instance = new CustomerModel(undefined)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<CustomerModel[]> {
    const instance = new CustomerModel(undefined)

    const models = await DB.instance.selectFrom('customers').selectAll().execute()

    instance.mapCustomGetters(models)

    const data = await Promise.all(models.map(async (model: CustomerJsonResponse) => {
      return new CustomerModel(model)
    }))

    return data
  }

  static async findOrFail(id: number): Promise<CustomerModel | undefined> {
    const instance = new CustomerModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  static async findMany(ids: number[]): Promise<CustomerModel[]> {
    const instance = new CustomerModel(undefined)

    const models = await instance.applyFindMany(ids)

    return models.map((modelItem: CustomerJsonResponse) => instance.parseResult(new CustomerModel(modelItem)))
  }

  static async latest(column: keyof CustomersTable = 'created_at'): Promise<CustomerModel | undefined> {
    const instance = new CustomerModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'desc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new CustomerModel(model)
  }

  static async oldest(column: keyof CustomersTable = 'created_at'): Promise<CustomerModel | undefined> {
    const instance = new CustomerModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'asc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new CustomerModel(model)
  }

  static skip(count: number): CustomerModel {
    const instance = new CustomerModel(undefined)

    return instance.applySkip(count)
  }

  static take(count: number): CustomerModel {
    const instance = new CustomerModel(undefined)

    return instance.applyTake(count)
  }

  static where<V = string>(column: keyof CustomersTable, ...args: [V] | [Operator, V]): CustomerModel {
    const instance = new CustomerModel(undefined)

    return instance.applyWhere<V>(column, ...args)
  }

  static orWhere(...conditions: [string, any][]): CustomerModel {
    const instance = new CustomerModel(undefined)

    return instance.applyOrWhere(...conditions)
  }

  static whereNotIn<V = number>(column: keyof CustomersTable, values: V[]): CustomerModel {
    const instance = new CustomerModel(undefined)

    return instance.applyWhereNotIn<V>(column, values)
  }

  static whereBetween<V = number>(column: keyof CustomersTable, range: [V, V]): CustomerModel {
    const instance = new CustomerModel(undefined)

    return instance.applyWhereBetween<V>(column, range)
  }

  static whereRef(column: keyof CustomersTable, ...args: string[]): CustomerModel {
    const instance = new CustomerModel(undefined)

    return instance.applyWhereRef(column, ...args)
  }

  static when(condition: boolean, callback: (query: CustomerModel) => CustomerModel): CustomerModel {
    const instance = new CustomerModel(undefined)

    return instance.applyWhen(condition, callback as any)
  }

  static whereNull(column: keyof CustomersTable): CustomerModel {
    const instance = new CustomerModel(undefined)

    return instance.applyWhereNull(column)
  }

  static whereNotNull(column: keyof CustomersTable): CustomerModel {
    const instance = new CustomerModel(undefined)

    return instance.applyWhereNotNull(column)
  }

  static whereLike(column: keyof CustomersTable, value: string): CustomerModel {
    const instance = new CustomerModel(undefined)

    return instance.applyWhereLike(column, value)
  }

  static orderBy(column: keyof CustomersTable, order: 'asc' | 'desc'): CustomerModel {
    const instance = new CustomerModel(undefined)

    return instance.applyOrderBy(column, order)
  }

  static orderByAsc(column: keyof CustomersTable): CustomerModel {
    const instance = new CustomerModel(undefined)

    return instance.applyOrderByAsc(column)
  }

  static orderByDesc(column: keyof CustomersTable): CustomerModel {
    const instance = new CustomerModel(undefined)

    return instance.applyOrderByDesc(column)
  }

  static groupBy(column: keyof CustomersTable): CustomerModel {
    const instance = new CustomerModel(undefined)

    return instance.applyGroupBy(column)
  }

  static having<V = string>(column: keyof CustomersTable, operator: Operator, value: V): CustomerModel {
    const instance = new CustomerModel(undefined)

    return instance.applyHaving<V>(column, operator, value)
  }

  static inRandomOrder(): CustomerModel {
    const instance = new CustomerModel(undefined)

    return instance.applyInRandomOrder()
  }

  static whereColumn(first: keyof CustomersTable, operator: Operator, second: keyof CustomersTable): CustomerModel {
    const instance = new CustomerModel(undefined)

    return instance.applyWhereColumn(first, operator, second)
  }

  static async max(field: keyof CustomersTable): Promise<number> {
    const instance = new CustomerModel(undefined)

    return await instance.applyMax(field)
  }

  static async min(field: keyof CustomersTable): Promise<number> {
    const instance = new CustomerModel(undefined)

    return await instance.applyMin(field)
  }

  static async avg(field: keyof CustomersTable): Promise<number> {
    const instance = new CustomerModel(undefined)

    return await instance.applyAvg(field)
  }

  static async sum(field: keyof CustomersTable): Promise<number> {
    const instance = new CustomerModel(undefined)

    return await instance.applySum(field)
  }

  static async count(): Promise<number> {
    const instance = new CustomerModel(undefined)

    return instance.applyCount()
  }

  static async get(): Promise<CustomerModel[]> {
    const instance = new CustomerModel(undefined)

    const results = await instance.applyGet()

    return results.map((item: CustomerJsonResponse) => instance.createInstance(item))
  }

  static async pluck<K extends keyof CustomerModel>(field: K): Promise<CustomerModel[K][]> {
    const instance = new CustomerModel(undefined)

    return await instance.applyPluck(field)
  }

  static async chunk(size: number, callback: (models: CustomerModel[]) => Promise<void>): Promise<void> {
    const instance = new CustomerModel(undefined)

    await instance.applyChunk(size, async (models) => {
      const modelInstances = models.map((item: CustomerJsonResponse) => instance.createInstance(item))
      await callback(modelInstances)
    })
  }

  static async paginate(options: { limit?: number, offset?: number, page?: number } = { limit: 10, offset: 0, page: 1 }): Promise<{
    data: CustomerModel[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }> {
    const instance = new CustomerModel(undefined)

    const result = await instance.applyPaginate(options)

    return {
      data: result.data.map((item: CustomerJsonResponse) => instance.createInstance(item)),
      paging: result.paging,
      next_cursor: result.next_cursor,
    }
  }

  // Instance method for creating model instances
  createInstance(data: CustomerJsonResponse): CustomerModel {
    return new CustomerModel(data)
  }

  async applyCreate(newCustomer: NewCustomer): Promise<CustomerModel> {
    const filteredValues = Object.fromEntries(
      Object.entries(newCustomer).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewCustomer

    await this.mapCustomSetters(filteredValues)

    filteredValues.uuid = randomUUIDv7()

    const result = await DB.instance.insertInto('customers')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await DB.instance.selectFrom('customers')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created Customer')
    }

    if (model)
      dispatch('customer:created', model)
    return this.createInstance(model)
  }

  async create(newCustomer: NewCustomer): Promise<CustomerModel> {
    return await this.applyCreate(newCustomer)
  }

  static async create(newCustomer: NewCustomer): Promise<CustomerModel> {
    const instance = new CustomerModel(undefined)
    return await instance.applyCreate(newCustomer)
  }

  static async firstOrCreate(search: Partial<CustomersTable>, values: NewCustomer = {} as NewCustomer): Promise<CustomerModel> {
    // First try to find a record matching the search criteria
    const instance = new CustomerModel(undefined)

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
    const createData = { ...search, ...values } as NewCustomer
    return await CustomerModel.create(createData)
  }

  static async updateOrCreate(search: Partial<CustomersTable>, values: NewCustomer = {} as NewCustomer): Promise<CustomerModel> {
    // First try to find a record matching the search criteria
    const instance = new CustomerModel(undefined)

    // Apply all search conditions
    for (const [key, value] of Object.entries(search)) {
      instance.selectFromQuery = instance.selectFromQuery.where(key, '=', value)
    }

    // Try to find the record
    const existingRecord = await instance.applyFirst()

    if (existingRecord) {
      // If record exists, update it with the new values
      const model = instance.createInstance(existingRecord)
      const updatedModel = await model.update(values as CustomerUpdate)

      // Return the updated model instance
      if (updatedModel) {
        return updatedModel
      }

      // If update didn't return a model, fetch it again to ensure we have latest data
      const refreshedModel = await instance.applyFirst()
      return instance.createInstance(refreshedModel!)
    }

    // If no record exists, create a new one with combined search criteria and values
    const createData = { ...search, ...values } as NewCustomer
    return await CustomerModel.create(createData)
  }

  async update(newCustomer: CustomerUpdate): Promise<CustomerModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newCustomer).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as CustomerUpdate

    await this.mapCustomSetters(filteredValues)

    filteredValues.updated_at = new Date().toISOString()

    await DB.instance.updateTable('customers')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('customers')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated Customer')
      }

      if (model)
        dispatch('customer:updated', model)
      return this.createInstance(model)
    }

    return undefined
  }

  async forceUpdate(newCustomer: CustomerUpdate): Promise<CustomerModel | undefined> {
    await DB.instance.updateTable('customers')
      .set(newCustomer)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('customers')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated Customer')
      }

      if (this)
        dispatch('customer:updated', model)
      return this.createInstance(model)
    }

    return undefined
  }

  async save(): Promise<CustomerModel> {
    // If the model has an ID, update it; otherwise, create a new record
    if (this.id) {
      // Update existing record
      await DB.instance.updateTable('customers')
        .set(this.attributes as CustomerUpdate)
        .where('id', '=', this.id)
        .executeTakeFirst()

      // Get the updated data
      const model = await DB.instance.selectFrom('customers')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated Customer')
      }

      if (this)
        dispatch('customer:updated', model)
      return this.createInstance(model)
    }
    else {
      // Create new record
      const result = await DB.instance.insertInto('customers')
        .values(this.attributes as NewCustomer)
        .executeTakeFirst()

      // Get the created data
      const model = await DB.instance.selectFrom('customers')
        .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve created Customer')
      }

      if (this)
        dispatch('customer:created', model)
      return this.createInstance(model)
    }
  }

  static async createMany(newCustomer: NewCustomer[]): Promise<void> {
    const instance = new CustomerModel(undefined)

    const valuesFiltered = newCustomer.map((newCustomer: NewCustomer) => {
      const filteredValues = Object.fromEntries(
        Object.entries(newCustomer).filter(([key]) =>
          !instance.guarded.includes(key) && instance.fillable.includes(key),
        ),
      ) as NewCustomer

      filteredValues.uuid = randomUUIDv7()

      return filteredValues
    })

    await DB.instance.insertInto('customers')
      .values(valuesFiltered)
      .executeTakeFirst()
  }

  static async forceCreate(newCustomer: NewCustomer): Promise<CustomerModel> {
    const result = await DB.instance.insertInto('customers')
      .values(newCustomer)
      .executeTakeFirst()

    const instance = new CustomerModel(undefined)
    const model = await DB.instance.selectFrom('customers')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created Customer')
    }

    if (model)
      dispatch('customer:created', model)

    return instance.createInstance(model)
  }

  // Method to remove a Customer
  async delete(): Promise<number> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()
    const model = await this.find(Number(this.id))

    if (model)
      dispatch('customer:deleted', model)

    const deleted = await DB.instance.deleteFrom('customers')
      .where('id', '=', this.id)
      .execute()

    return deleted.numDeletedRows
  }

  static async remove(id: number): Promise<any> {
    const instance = new CustomerModel(undefined)

    const model = await instance.find(Number(id))

    if (model)
      dispatch('customer:deleted', model)

    return await DB.instance.deleteFrom('customers')
      .where('id', '=', id)
      .execute()
  }

  static whereName(value: string): CustomerModel {
    const instance = new CustomerModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('name', '=', value)

    return instance
  }

  static whereEmail(value: string): CustomerModel {
    const instance = new CustomerModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('email', '=', value)

    return instance
  }

  static wherePhone(value: string): CustomerModel {
    const instance = new CustomerModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('phone', '=', value)

    return instance
  }

  static whereTotalSpent(value: string): CustomerModel {
    const instance = new CustomerModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('total_spent', '=', value)

    return instance
  }

  static whereLastOrder(value: string): CustomerModel {
    const instance = new CustomerModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('last_order', '=', value)

    return instance
  }

  static whereStatus(value: string): CustomerModel {
    const instance = new CustomerModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('status', '=', value)

    return instance
  }

  static whereAvatar(value: string): CustomerModel {
    const instance = new CustomerModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('avatar', '=', value)

    return instance
  }

  static whereIn<V = number>(column: keyof CustomersTable, values: V[]): CustomerModel {
    const instance = new CustomerModel(undefined)

    return instance.applyWhereIn<V>(column, values)
  }

  async userBelong(): Promise<UserModel> {
    if (this.user_id === undefined)
      throw new HttpError(500, 'Relation Error!')

    const model = await User
      .where('id', '=', this.user_id)
      .first()

    if (!model)
      throw new HttpError(500, 'Model Relation Not Found!')

    return model
  }

  toSearchableObject(): Partial<CustomerJsonResponse> {
    return {
      id: this.id,
      name: this.name,
      email: this.email,
      phone: this.phone,
      status: this.status,
    }
  }

  static distinct(column: keyof CustomerJsonResponse): CustomerModel {
    const instance = new CustomerModel(undefined)

    return instance.applyDistinct(column)
  }

  static join(table: string, firstCol: string, secondCol: string): CustomerModel {
    const instance = new CustomerModel(undefined)

    return instance.applyJoin(table, firstCol, secondCol)
  }

  toJSON(): CustomerJsonResponse {
    const output = {

      uuid: this.uuid,

      id: this.id,
      name: this.name,
      email: this.email,
      phone: this.phone,
      total_spent: this.total_spent,
      last_order: this.last_order,
      status: this.status,
      avatar: this.avatar,

      created_at: this.created_at,

      updated_at: this.updated_at,

      orders: this.orders,
      gift_cards: this.gift_cards,
      reviews: this.reviews,
      payments: this.payments,
      license_keys: this.license_keys,
      waitlist_products: this.waitlist_products,
      waitlist_restaurants: this.waitlist_restaurants,
      user_id: this.user_id,
      user: this.user,
      ...this.customColumns,
    }

    return output
  }

  parseResult(model: CustomerModel): CustomerModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof CustomerModel]
    }

    return model
  }

  // Add a protected applyFind implementation
  protected async applyFind(id: number): Promise<CustomerModel | undefined> {
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

export async function find(id: number): Promise<CustomerModel | undefined> {
  const query = DB.instance.selectFrom('customers').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  const instance = new CustomerModel(undefined)
  return instance.createInstance(model)
}

export async function count(): Promise<number> {
  const results = await CustomerModel.count()

  return results
}

export async function create(newCustomer: NewCustomer): Promise<CustomerModel> {
  const instance = new CustomerModel(undefined)
  return await instance.applyCreate(newCustomer)
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(DB.instance)
}

export async function remove(id: number): Promise<void> {
  await DB.instance.deleteFrom('customers')
    .where('id', '=', id)
    .execute()
}

export async function whereName(value: string): Promise<CustomerModel[]> {
  const query = DB.instance.selectFrom('customers').where('name', '=', value)
  const results: CustomerJsonResponse = await query.execute()

  return results.map((modelItem: CustomerJsonResponse) => new CustomerModel(modelItem))
}

export async function whereEmail(value: string): Promise<CustomerModel[]> {
  const query = DB.instance.selectFrom('customers').where('email', '=', value)
  const results: CustomerJsonResponse = await query.execute()

  return results.map((modelItem: CustomerJsonResponse) => new CustomerModel(modelItem))
}

export async function wherePhone(value: string): Promise<CustomerModel[]> {
  const query = DB.instance.selectFrom('customers').where('phone', '=', value)
  const results: CustomerJsonResponse = await query.execute()

  return results.map((modelItem: CustomerJsonResponse) => new CustomerModel(modelItem))
}

export async function whereTotalSpent(value: number): Promise<CustomerModel[]> {
  const query = DB.instance.selectFrom('customers').where('total_spent', '=', value)
  const results: CustomerJsonResponse = await query.execute()

  return results.map((modelItem: CustomerJsonResponse) => new CustomerModel(modelItem))
}

export async function whereLastOrder(value: string): Promise<CustomerModel[]> {
  const query = DB.instance.selectFrom('customers').where('last_order', '=', value)
  const results: CustomerJsonResponse = await query.execute()

  return results.map((modelItem: CustomerJsonResponse) => new CustomerModel(modelItem))
}

export async function whereStatus(value: string | string[]): Promise<CustomerModel[]> {
  const query = DB.instance.selectFrom('customers').where('status', '=', value)
  const results: CustomerJsonResponse = await query.execute()

  return results.map((modelItem: CustomerJsonResponse) => new CustomerModel(modelItem))
}

export async function whereAvatar(value: string): Promise<CustomerModel[]> {
  const query = DB.instance.selectFrom('customers').where('avatar', '=', value)
  const results: CustomerJsonResponse = await query.execute()

  return results.map((modelItem: CustomerJsonResponse) => new CustomerModel(modelItem))
}

export const Customer = CustomerModel

export default Customer
