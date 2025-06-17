import type { RawBuilder } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import type { NewTransaction, TransactionJsonResponse, TransactionsTable, TransactionUpdate } from '../types/TransactionType'
import type { OrderModel } from './Order'
import { randomUUIDv7 } from 'bun'
import { sql } from '@stacksjs/database'
import { HttpError } from '@stacksjs/error-handling'
import { dispatch } from '@stacksjs/events'
import { DB } from '@stacksjs/orm'

import { BaseOrm } from '../utils/base'

export class TransactionModel extends BaseOrm<TransactionModel, TransactionsTable, TransactionJsonResponse> {
  private readonly hidden: Array<keyof TransactionJsonResponse> = ['paymentDetails']
  private readonly fillable: Array<keyof TransactionJsonResponse> = ['amount', 'status', 'payment_method', 'payment_details', 'transaction_reference', 'loyalty_points_earned', 'loyalty_points_redeemed', 'uuid']
  private readonly guarded: Array<keyof TransactionJsonResponse> = []
  protected attributes = {} as TransactionJsonResponse
  protected originalAttributes = {} as TransactionJsonResponse

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

  constructor(transaction: TransactionJsonResponse | undefined) {
    super('transactions')
    if (transaction) {
      this.attributes = { ...transaction }
      this.originalAttributes = { ...transaction }

      Object.keys(transaction).forEach((key) => {
        if (!(key in this)) {
          this.customColumns[key] = (transaction as TransactionJsonResponse)[key]
        }
      })
    }

    this.withRelations = []
    this.selectFromQuery = DB.instance.selectFrom('transactions')
    this.updateFromQuery = DB.instance.updateTable('transactions')
    this.deleteFromQuery = DB.instance.deleteFrom('transactions')
    this.hasSelect = false
  }

  protected async loadRelations(models: TransactionJsonResponse | TransactionJsonResponse[]): Promise<void> {
    // Handle both single model and array of models
    const modelArray = Array.isArray(models) ? models : [models]
    if (!modelArray.length)
      return

    const modelIds = modelArray.map(model => model.id)

    for (const relation of this.withRelations) {
      const relatedRecords = await DB.instance
        .selectFrom(relation)
        .where('transaction_id', 'in', modelIds)
        .selectAll()
        .execute()

      if (Array.isArray(models)) {
        models.map((model: TransactionJsonResponse) => {
          const records = relatedRecords.filter((record: { transaction_id: number }) => {
            return record.transaction_id === model.id
          })

          model[relation] = records.length === 1 ? records[0] : records
          return model
        })
      }
      else {
        const records = relatedRecords.filter((record: { transaction_id: number }) => {
          return record.transaction_id === models.id
        })

        models[relation] = records.length === 1 ? records[0] : records
      }
    }
  }

  static with(relations: string[]): TransactionModel {
    const instance = new TransactionModel(undefined)

    return instance.applyWith(relations)
  }

  protected mapCustomGetters(models: TransactionJsonResponse | TransactionJsonResponse[]): void {
    const data = models

    if (Array.isArray(data)) {
      data.map((model: TransactionJsonResponse) => {
        const customGetter = {
          default: () => {
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

      }

      for (const [key, fn] of Object.entries(customGetter)) {
        (model as any)[key] = fn()
      }
    }
  }

  async mapCustomSetters(model: NewTransaction | TransactionUpdate): Promise<void> {
    const customSetter = {
      default: () => {
      },

    }

    for (const [key, fn] of Object.entries(customSetter)) {
      (model as any)[key] = await fn()
    }
  }

  get order_id(): number {
    return this.attributes.order_id
  }

  get order(): OrderModel | undefined {
    return this.attributes.order
  }

  get id(): number {
    return this.attributes.id
  }

  get uuid(): string | undefined {
    return this.attributes.uuid
  }

  get amount(): number {
    return this.attributes.amount
  }

  get status(): string {
    return this.attributes.status
  }

  get payment_method(): string {
    return this.attributes.payment_method
  }

  get payment_details(): string | undefined {
    return this.attributes.payment_details
  }

  get transaction_reference(): string | undefined {
    return this.attributes.transaction_reference
  }

  get loyalty_points_earned(): number | undefined {
    return this.attributes.loyalty_points_earned
  }

  get loyalty_points_redeemed(): number | undefined {
    return this.attributes.loyalty_points_redeemed
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

  set amount(value: number) {
    this.attributes.amount = value
  }

  set status(value: string) {
    this.attributes.status = value
  }

  set payment_method(value: string) {
    this.attributes.payment_method = value
  }

  set payment_details(value: string) {
    this.attributes.payment_details = value
  }

  set transaction_reference(value: string) {
    this.attributes.transaction_reference = value
  }

  set loyalty_points_earned(value: number) {
    this.attributes.loyalty_points_earned = value
  }

  set loyalty_points_redeemed(value: number) {
    this.attributes.loyalty_points_redeemed = value
  }

  set updated_at(value: string) {
    this.attributes.updated_at = value
  }

  static select(params: (keyof TransactionJsonResponse)[] | RawBuilder<string> | string): TransactionModel {
    const instance = new TransactionModel(undefined)

    return instance.applySelect(params)
  }

  // Method to find a Transaction by ID
  static async find(id: number): Promise<TransactionModel | undefined> {
    const query = DB.instance.selectFrom('transactions').where('id', '=', id).selectAll()

    const model = await query.executeTakeFirst()

    if (!model)
      return undefined

    const instance = new TransactionModel(undefined)
    return instance.createInstance(model)
  }

  static async first(): Promise<TransactionModel | undefined> {
    const instance = new TransactionModel(undefined)

    const model = await instance.applyFirst()

    const data = new TransactionModel(model)

    return data
  }

  static async last(): Promise<TransactionModel | undefined> {
    const instance = new TransactionModel(undefined)

    const model = await instance.applyLast()

    if (!model)
      return undefined

    return new TransactionModel(model)
  }

  static async firstOrFail(): Promise<TransactionModel | undefined> {
    const instance = new TransactionModel(undefined)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<TransactionModel[]> {
    const instance = new TransactionModel(undefined)

    const models = await DB.instance.selectFrom('transactions').selectAll().execute()

    instance.mapCustomGetters(models)

    const data = await Promise.all(models.map(async (model: TransactionJsonResponse) => {
      return new TransactionModel(model)
    }))

    return data
  }

  static async findOrFail(id: number): Promise<TransactionModel | undefined> {
    const instance = new TransactionModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  static async findMany(ids: number[]): Promise<TransactionModel[]> {
    const instance = new TransactionModel(undefined)

    const models = await instance.applyFindMany(ids)

    return models.map((modelItem: TransactionJsonResponse) => instance.parseResult(new TransactionModel(modelItem)))
  }

  static async latest(column: keyof TransactionsTable = 'created_at'): Promise<TransactionModel | undefined> {
    const instance = new TransactionModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'desc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new TransactionModel(model)
  }

  static async oldest(column: keyof TransactionsTable = 'created_at'): Promise<TransactionModel | undefined> {
    const instance = new TransactionModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'asc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new TransactionModel(model)
  }

  static skip(count: number): TransactionModel {
    const instance = new TransactionModel(undefined)

    return instance.applySkip(count)
  }

  static take(count: number): TransactionModel {
    const instance = new TransactionModel(undefined)

    return instance.applyTake(count)
  }

  static where<V = string>(column: keyof TransactionsTable, ...args: [V] | [Operator, V]): TransactionModel {
    const instance = new TransactionModel(undefined)

    return instance.applyWhere<V>(column, ...args)
  }

  static orWhere(...conditions: [string, any][]): TransactionModel {
    const instance = new TransactionModel(undefined)

    return instance.applyOrWhere(...conditions)
  }

  static whereNotIn<V = number>(column: keyof TransactionsTable, values: V[]): TransactionModel {
    const instance = new TransactionModel(undefined)

    return instance.applyWhereNotIn<V>(column, values)
  }

  static whereBetween<V = number>(column: keyof TransactionsTable, range: [V, V]): TransactionModel {
    const instance = new TransactionModel(undefined)

    return instance.applyWhereBetween<V>(column, range)
  }

  static whereRef(column: keyof TransactionsTable, ...args: string[]): TransactionModel {
    const instance = new TransactionModel(undefined)

    return instance.applyWhereRef(column, ...args)
  }

  static when(condition: boolean, callback: (query: TransactionModel) => TransactionModel): TransactionModel {
    const instance = new TransactionModel(undefined)

    return instance.applyWhen(condition, callback as any)
  }

  static whereNull(column: keyof TransactionsTable): TransactionModel {
    const instance = new TransactionModel(undefined)

    return instance.applyWhereNull(column)
  }

  static whereNotNull(column: keyof TransactionsTable): TransactionModel {
    const instance = new TransactionModel(undefined)

    return instance.applyWhereNotNull(column)
  }

  static whereLike(column: keyof TransactionsTable, value: string): TransactionModel {
    const instance = new TransactionModel(undefined)

    return instance.applyWhereLike(column, value)
  }

  static orderBy(column: keyof TransactionsTable, order: 'asc' | 'desc'): TransactionModel {
    const instance = new TransactionModel(undefined)

    return instance.applyOrderBy(column, order)
  }

  static orderByAsc(column: keyof TransactionsTable): TransactionModel {
    const instance = new TransactionModel(undefined)

    return instance.applyOrderByAsc(column)
  }

  static orderByDesc(column: keyof TransactionsTable): TransactionModel {
    const instance = new TransactionModel(undefined)

    return instance.applyOrderByDesc(column)
  }

  static groupBy(column: keyof TransactionsTable): TransactionModel {
    const instance = new TransactionModel(undefined)

    return instance.applyGroupBy(column)
  }

  static having<V = string>(column: keyof TransactionsTable, operator: Operator, value: V): TransactionModel {
    const instance = new TransactionModel(undefined)

    return instance.applyHaving<V>(column, operator, value)
  }

  static inRandomOrder(): TransactionModel {
    const instance = new TransactionModel(undefined)

    return instance.applyInRandomOrder()
  }

  static whereColumn(first: keyof TransactionsTable, operator: Operator, second: keyof TransactionsTable): TransactionModel {
    const instance = new TransactionModel(undefined)

    return instance.applyWhereColumn(first, operator, second)
  }

  static async max(field: keyof TransactionsTable): Promise<number> {
    const instance = new TransactionModel(undefined)

    return await instance.applyMax(field)
  }

  static async min(field: keyof TransactionsTable): Promise<number> {
    const instance = new TransactionModel(undefined)

    return await instance.applyMin(field)
  }

  static async avg(field: keyof TransactionsTable): Promise<number> {
    const instance = new TransactionModel(undefined)

    return await instance.applyAvg(field)
  }

  static async sum(field: keyof TransactionsTable): Promise<number> {
    const instance = new TransactionModel(undefined)

    return await instance.applySum(field)
  }

  static async count(): Promise<number> {
    const instance = new TransactionModel(undefined)

    return instance.applyCount()
  }

  static async get(): Promise<TransactionModel[]> {
    const instance = new TransactionModel(undefined)

    const results = await instance.applyGet()

    return results.map((item: TransactionJsonResponse) => instance.createInstance(item))
  }

  static async pluck<K extends keyof TransactionModel>(field: K): Promise<TransactionModel[K][]> {
    const instance = new TransactionModel(undefined)

    return await instance.applyPluck(field)
  }

  static async chunk(size: number, callback: (models: TransactionModel[]) => Promise<void>): Promise<void> {
    const instance = new TransactionModel(undefined)

    await instance.applyChunk(size, async (models) => {
      const modelInstances = models.map((item: TransactionJsonResponse) => instance.createInstance(item))
      await callback(modelInstances)
    })
  }

  static async paginate(options: { limit?: number, offset?: number, page?: number } = { limit: 10, offset: 0, page: 1 }): Promise<{
    data: TransactionModel[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }> {
    const instance = new TransactionModel(undefined)

    const result = await instance.applyPaginate(options)

    return {
      data: result.data.map((item: TransactionJsonResponse) => instance.createInstance(item)),
      paging: result.paging,
      next_cursor: result.next_cursor,
    }
  }

  // Instance method for creating model instances
  createInstance(data: TransactionJsonResponse): TransactionModel {
    return new TransactionModel(data)
  }

  async applyCreate(newTransaction: NewTransaction): Promise<TransactionModel> {
    const filteredValues = Object.fromEntries(
      Object.entries(newTransaction).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewTransaction

    await this.mapCustomSetters(filteredValues)

    filteredValues.uuid = randomUUIDv7()

    const result = await DB.instance.insertInto('transactions')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await DB.instance.selectFrom('transactions')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created Transaction')
    }

    if (model)
      dispatch('transaction:created', model)
    return this.createInstance(model)
  }

  async create(newTransaction: NewTransaction): Promise<TransactionModel> {
    return await this.applyCreate(newTransaction)
  }

  static async create(newTransaction: NewTransaction): Promise<TransactionModel> {
    const instance = new TransactionModel(undefined)
    return await instance.applyCreate(newTransaction)
  }

  static async firstOrCreate(search: Partial<TransactionsTable>, values: NewTransaction = {} as NewTransaction): Promise<TransactionModel> {
    // First try to find a record matching the search criteria
    const instance = new TransactionModel(undefined)

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
    const createData = { ...search, ...values } as NewTransaction
    return await TransactionModel.create(createData)
  }

  static async updateOrCreate(search: Partial<TransactionsTable>, values: NewTransaction = {} as NewTransaction): Promise<TransactionModel> {
    // First try to find a record matching the search criteria
    const instance = new TransactionModel(undefined)

    // Apply all search conditions
    for (const [key, value] of Object.entries(search)) {
      instance.selectFromQuery = instance.selectFromQuery.where(key, '=', value)
    }

    // Try to find the record
    const existingRecord = await instance.applyFirst()

    if (existingRecord) {
      // If record exists, update it with the new values
      const model = instance.createInstance(existingRecord)
      const updatedModel = await model.update(values as TransactionUpdate)

      // Return the updated model instance
      if (updatedModel) {
        return updatedModel
      }

      // If update didn't return a model, fetch it again to ensure we have latest data
      const refreshedModel = await instance.applyFirst()
      return instance.createInstance(refreshedModel!)
    }

    // If no record exists, create a new one with combined search criteria and values
    const createData = { ...search, ...values } as NewTransaction
    return await TransactionModel.create(createData)
  }

  async update(newTransaction: TransactionUpdate): Promise<TransactionModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newTransaction).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as TransactionUpdate

    await this.mapCustomSetters(filteredValues)

    filteredValues.updated_at = new Date().toISOString()

    await DB.instance.updateTable('transactions')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('transactions')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated Transaction')
      }

      if (model)
        dispatch('transaction:updated', model)
      return this.createInstance(model)
    }

    return undefined
  }

  async forceUpdate(newTransaction: TransactionUpdate): Promise<TransactionModel | undefined> {
    await DB.instance.updateTable('transactions')
      .set(newTransaction)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('transactions')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated Transaction')
      }

      if (this)
        dispatch('transaction:updated', model)
      return this.createInstance(model)
    }

    return undefined
  }

  async save(): Promise<TransactionModel> {
    // If the model has an ID, update it; otherwise, create a new record
    if (this.id) {
      // Update existing record
      await DB.instance.updateTable('transactions')
        .set(this.attributes as TransactionUpdate)
        .where('id', '=', this.id)
        .executeTakeFirst()

      // Get the updated data
      const model = await DB.instance.selectFrom('transactions')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated Transaction')
      }

      if (this)
        dispatch('transaction:updated', model)
      return this.createInstance(model)
    }
    else {
      // Create new record
      const result = await DB.instance.insertInto('transactions')
        .values(this.attributes as NewTransaction)
        .executeTakeFirst()

      // Get the created data
      const model = await DB.instance.selectFrom('transactions')
        .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve created Transaction')
      }

      if (this)
        dispatch('transaction:created', model)
      return this.createInstance(model)
    }
  }

  static async createMany(newTransaction: NewTransaction[]): Promise<void> {
    const instance = new TransactionModel(undefined)

    const valuesFiltered = newTransaction.map((newTransaction: NewTransaction) => {
      const filteredValues = Object.fromEntries(
        Object.entries(newTransaction).filter(([key]) =>
          !instance.guarded.includes(key) && instance.fillable.includes(key),
        ),
      ) as NewTransaction

      filteredValues.uuid = randomUUIDv7()

      return filteredValues
    })

    await DB.instance.insertInto('transactions')
      .values(valuesFiltered)
      .executeTakeFirst()
  }

  static async forceCreate(newTransaction: NewTransaction): Promise<TransactionModel> {
    const result = await DB.instance.insertInto('transactions')
      .values(newTransaction)
      .executeTakeFirst()

    const instance = new TransactionModel(undefined)
    const model = await DB.instance.selectFrom('transactions')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created Transaction')
    }

    if (model)
      dispatch('transaction:created', model)

    return instance.createInstance(model)
  }

  // Method to remove a Transaction
  async delete(): Promise<number> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()
    const model = await this.find(Number(this.id))

    if (model)
      dispatch('transaction:deleted', model)

    const deleted = await DB.instance.deleteFrom('transactions')
      .where('id', '=', this.id)
      .execute()

    return deleted.numDeletedRows
  }

  static async remove(id: number): Promise<any> {
    const instance = new TransactionModel(undefined)

    const model = await instance.find(Number(id))

    if (model)
      dispatch('transaction:deleted', model)

    return await DB.instance.deleteFrom('transactions')
      .where('id', '=', id)
      .execute()
  }

  static whereAmount(value: string): TransactionModel {
    const instance = new TransactionModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('amount', '=', value)

    return instance
  }

  static whereStatus(value: string): TransactionModel {
    const instance = new TransactionModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('status', '=', value)

    return instance
  }

  static wherePaymentMethod(value: string): TransactionModel {
    const instance = new TransactionModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('payment_method', '=', value)

    return instance
  }

  static wherePaymentDetails(value: string): TransactionModel {
    const instance = new TransactionModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('payment_details', '=', value)

    return instance
  }

  static whereTransactionReference(value: string): TransactionModel {
    const instance = new TransactionModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('transaction_reference', '=', value)

    return instance
  }

  static whereLoyaltyPointsEarned(value: string): TransactionModel {
    const instance = new TransactionModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('loyalty_points_earned', '=', value)

    return instance
  }

  static whereLoyaltyPointsRedeemed(value: string): TransactionModel {
    const instance = new TransactionModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('loyalty_points_redeemed', '=', value)

    return instance
  }

  static whereIn<V = number>(column: keyof TransactionsTable, values: V[]): TransactionModel {
    const instance = new TransactionModel(undefined)

    return instance.applyWhereIn<V>(column, values)
  }

  async orderBelong(): Promise<OrderModel> {
    if (this.order_id === undefined)
      throw new HttpError(500, 'Relation Error!')

    const model = await Order
      .where('id', '=', this.order_id)
      .first()

    if (!model)
      throw new HttpError(500, 'Model Relation Not Found!')

    return model
  }

  toSearchableObject(): Partial<TransactionJsonResponse> {
    return {
      id: this.id,
      order_id: this.order_id,
      amount: this.amount,
      status: this.status,
      payment_method: this.payment_method,
      created_at: this.created_at,
    }
  }

  static distinct(column: keyof TransactionJsonResponse): TransactionModel {
    const instance = new TransactionModel(undefined)

    return instance.applyDistinct(column)
  }

  static join(table: string, firstCol: string, secondCol: string): TransactionModel {
    const instance = new TransactionModel(undefined)

    return instance.applyJoin(table, firstCol, secondCol)
  }

  toJSON(): TransactionJsonResponse {
    const output = {

      uuid: this.uuid,

      id: this.id,
      amount: this.amount,
      status: this.status,
      payment_method: this.payment_method,
      transaction_reference: this.transaction_reference,
      loyalty_points_earned: this.loyalty_points_earned,
      loyalty_points_redeemed: this.loyalty_points_redeemed,

      created_at: this.created_at,

      updated_at: this.updated_at,

      order_id: this.order_id,
      order: this.order,
      ...this.customColumns,
    }

    return output
  }

  parseResult(model: TransactionModel): TransactionModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof TransactionModel]
    }

    return model
  }

  // Add a protected applyFind implementation
  protected async applyFind(id: number): Promise<TransactionModel | undefined> {
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

export async function find(id: number): Promise<TransactionModel | undefined> {
  const query = DB.instance.selectFrom('transactions').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  const instance = new TransactionModel(undefined)
  return instance.createInstance(model)
}

export async function count(): Promise<number> {
  const results = await TransactionModel.count()

  return results
}

export async function create(newTransaction: NewTransaction): Promise<TransactionModel> {
  const instance = new TransactionModel(undefined)
  return await instance.applyCreate(newTransaction)
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(DB.instance)
}

export async function remove(id: number): Promise<void> {
  await DB.instance.deleteFrom('transactions')
    .where('id', '=', id)
    .execute()
}

export async function whereAmount(value: number): Promise<TransactionModel[]> {
  const query = DB.instance.selectFrom('transactions').where('amount', '=', value)
  const results: TransactionJsonResponse = await query.execute()

  return results.map((modelItem: TransactionJsonResponse) => new TransactionModel(modelItem))
}

export async function whereStatus(value: string): Promise<TransactionModel[]> {
  const query = DB.instance.selectFrom('transactions').where('status', '=', value)
  const results: TransactionJsonResponse = await query.execute()

  return results.map((modelItem: TransactionJsonResponse) => new TransactionModel(modelItem))
}

export async function wherePaymentMethod(value: string): Promise<TransactionModel[]> {
  const query = DB.instance.selectFrom('transactions').where('payment_method', '=', value)
  const results: TransactionJsonResponse = await query.execute()

  return results.map((modelItem: TransactionJsonResponse) => new TransactionModel(modelItem))
}

export async function wherePaymentDetails(value: string): Promise<TransactionModel[]> {
  const query = DB.instance.selectFrom('transactions').where('payment_details', '=', value)
  const results: TransactionJsonResponse = await query.execute()

  return results.map((modelItem: TransactionJsonResponse) => new TransactionModel(modelItem))
}

export async function whereTransactionReference(value: string): Promise<TransactionModel[]> {
  const query = DB.instance.selectFrom('transactions').where('transaction_reference', '=', value)
  const results: TransactionJsonResponse = await query.execute()

  return results.map((modelItem: TransactionJsonResponse) => new TransactionModel(modelItem))
}

export async function whereLoyaltyPointsEarned(value: number): Promise<TransactionModel[]> {
  const query = DB.instance.selectFrom('transactions').where('loyalty_points_earned', '=', value)
  const results: TransactionJsonResponse = await query.execute()

  return results.map((modelItem: TransactionJsonResponse) => new TransactionModel(modelItem))
}

export async function whereLoyaltyPointsRedeemed(value: number): Promise<TransactionModel[]> {
  const query = DB.instance.selectFrom('transactions').where('loyalty_points_redeemed', '=', value)
  const results: TransactionJsonResponse = await query.execute()

  return results.map((modelItem: TransactionJsonResponse) => new TransactionModel(modelItem))
}

export const Transaction = TransactionModel

export default Transaction
