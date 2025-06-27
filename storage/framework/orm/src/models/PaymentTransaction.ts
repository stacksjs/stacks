import type { RawBuilder } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import type { NewPaymentTransaction, PaymentTransactionJsonResponse, PaymentTransactionsTable, PaymentTransactionUpdate } from '../types/PaymentTransactionType'
import type { PaymentMethodModel } from './PaymentMethod'
import type { UserModel } from './User'
import { randomUUIDv7 } from 'bun'
import { sql } from '@stacksjs/database'
import { HttpError } from '@stacksjs/error-handling'

import { DB } from '@stacksjs/orm'

import { BaseOrm } from '../utils/base'

export class PaymentTransactionModel extends BaseOrm<PaymentTransactionModel, PaymentTransactionsTable, PaymentTransactionJsonResponse> {
  private readonly hidden: Array<keyof PaymentTransactionJsonResponse> = []
  private readonly fillable: Array<keyof PaymentTransactionJsonResponse> = ['name', 'description', 'amount', 'type', 'provider_id', 'uuid', 'payment_method_id']
  private readonly guarded: Array<keyof PaymentTransactionJsonResponse> = []
  protected attributes = {} as PaymentTransactionJsonResponse
  protected originalAttributes = {} as PaymentTransactionJsonResponse

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

  constructor(paymentTransaction: PaymentTransactionJsonResponse | undefined) {
    super('payment_transactions')
    if (paymentTransaction) {
      this.attributes = { ...paymentTransaction }
      this.originalAttributes = { ...paymentTransaction }

      Object.keys(paymentTransaction).forEach((key) => {
        if (!(key in this)) {
          this.customColumns[key] = (paymentTransaction as PaymentTransactionJsonResponse)[key]
        }
      })
    }

    this.withRelations = []
    this.selectFromQuery = DB.instance.selectFrom('payment_transactions')
    this.updateFromQuery = DB.instance.updateTable('payment_transactions')
    this.deleteFromQuery = DB.instance.deleteFrom('payment_transactions')
    this.hasSelect = false
  }

  protected async loadRelations(models: PaymentTransactionJsonResponse | PaymentTransactionJsonResponse[]): Promise<void> {
    // Handle both single model and array of models
    const modelArray = Array.isArray(models) ? models : [models]
    if (!modelArray.length)
      return

    const modelIds = modelArray.map(model => model.id)

    for (const relation of this.withRelations) {
      const relatedRecords = await DB.instance
        .selectFrom(relation)
        .where('paymentTransaction_id', 'in', modelIds)
        .selectAll()
        .execute()

      if (Array.isArray(models)) {
        models.map((model: PaymentTransactionJsonResponse) => {
          const records = relatedRecords.filter((record: { paymentTransaction_id: number }) => {
            return record.paymentTransaction_id === model.id
          })

          model[relation] = records.length === 1 ? records[0] : records
          return model
        })
      }
      else {
        const records = relatedRecords.filter((record: { paymentTransaction_id: number }) => {
          return record.paymentTransaction_id === models.id
        })

        models[relation] = records.length === 1 ? records[0] : records
      }
    }
  }

  static with(relations: string[]): PaymentTransactionModel {
    const instance = new PaymentTransactionModel(undefined)

    return instance.applyWith(relations)
  }

  protected mapCustomGetters(models: PaymentTransactionJsonResponse | PaymentTransactionJsonResponse[]): void {
    const data = models

    if (Array.isArray(data)) {
      data.map((model: PaymentTransactionJsonResponse) => {
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

  async mapCustomSetters(model: NewPaymentTransaction | PaymentTransactionUpdate): Promise<void> {
    const customSetter = {
      default: () => {
      },

    }

    for (const [key, fn] of Object.entries(customSetter)) {
      (model as any)[key] = await fn()
    }
  }

  get user_id(): number {
    return this.attributes.user_id
  }

  get user(): UserModel | undefined {
    return this.attributes.user
  }

  get payment_method_id(): number {
    return this.attributes.payment_method_id
  }

  get payment_method(): PaymentMethodModel | undefined {
    return this.attributes.payment_method
  }

  get id(): number {
    return this.attributes.id
  }

  get uuid(): string | undefined {
    return this.attributes.uuid
  }

  get name(): string | undefined {
    return this.attributes.name
  }

  get description(): string | undefined {
    return this.attributes.description
  }

  get amount(): number | undefined {
    return this.attributes.amount
  }

  get type(): string | undefined {
    return this.attributes.type
  }

  get provider_id(): string | undefined {
    return this.attributes.provider_id
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

  set description(value: string) {
    this.attributes.description = value
  }

  set amount(value: number) {
    this.attributes.amount = value
  }

  set type(value: string) {
    this.attributes.type = value
  }

  set provider_id(value: string) {
    this.attributes.provider_id = value
  }

  set updated_at(value: string) {
    this.attributes.updated_at = value
  }

  static select(params: (keyof PaymentTransactionJsonResponse)[] | RawBuilder<string> | string): PaymentTransactionModel {
    const instance = new PaymentTransactionModel(undefined)

    return instance.applySelect(params)
  }

  // Method to find a PaymentTransaction by ID
  static async find(id: number): Promise<PaymentTransactionModel | undefined> {
    const query = DB.instance.selectFrom('payment_transactions').where('id', '=', id).selectAll()

    const model = await query.executeTakeFirst()

    if (!model)
      return undefined

    const instance = new PaymentTransactionModel(undefined)
    return instance.createInstance(model)
  }

  static async first(): Promise<PaymentTransactionModel | undefined> {
    const instance = new PaymentTransactionModel(undefined)

    const model = await instance.applyFirst()

    const data = new PaymentTransactionModel(model)

    return data
  }

  static async last(): Promise<PaymentTransactionModel | undefined> {
    const instance = new PaymentTransactionModel(undefined)

    const model = await instance.applyLast()

    if (!model)
      return undefined

    return new PaymentTransactionModel(model)
  }

  static async firstOrFail(): Promise<PaymentTransactionModel | undefined> {
    const instance = new PaymentTransactionModel(undefined)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<PaymentTransactionModel[]> {
    const instance = new PaymentTransactionModel(undefined)

    const models = await DB.instance.selectFrom('payment_transactions').selectAll().execute()

    instance.mapCustomGetters(models)

    const data = await Promise.all(models.map(async (model: PaymentTransactionJsonResponse) => {
      return new PaymentTransactionModel(model)
    }))

    return data
  }

  static async findOrFail(id: number): Promise<PaymentTransactionModel | undefined> {
    const instance = new PaymentTransactionModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  static async findMany(ids: number[]): Promise<PaymentTransactionModel[]> {
    const instance = new PaymentTransactionModel(undefined)

    const models = await instance.applyFindMany(ids)

    return models.map((modelItem: PaymentTransactionJsonResponse) => instance.parseResult(new PaymentTransactionModel(modelItem)))
  }

  static async latest(column: keyof PaymentTransactionsTable = 'created_at'): Promise<PaymentTransactionModel | undefined> {
    const instance = new PaymentTransactionModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'desc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new PaymentTransactionModel(model)
  }

  static async oldest(column: keyof PaymentTransactionsTable = 'created_at'): Promise<PaymentTransactionModel | undefined> {
    const instance = new PaymentTransactionModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'asc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new PaymentTransactionModel(model)
  }

  static skip(count: number): PaymentTransactionModel {
    const instance = new PaymentTransactionModel(undefined)

    return instance.applySkip(count)
  }

  static take(count: number): PaymentTransactionModel {
    const instance = new PaymentTransactionModel(undefined)

    return instance.applyTake(count)
  }

  static where<V = string>(column: keyof PaymentTransactionsTable, ...args: [V] | [Operator, V]): PaymentTransactionModel {
    const instance = new PaymentTransactionModel(undefined)

    return instance.applyWhere<V>(column, ...args)
  }

  static orWhere(...conditions: [string, any][]): PaymentTransactionModel {
    const instance = new PaymentTransactionModel(undefined)

    return instance.applyOrWhere(...conditions)
  }

  static whereNotIn<V = number>(column: keyof PaymentTransactionsTable, values: V[]): PaymentTransactionModel {
    const instance = new PaymentTransactionModel(undefined)

    return instance.applyWhereNotIn<V>(column, values)
  }

  static whereBetween<V = number>(column: keyof PaymentTransactionsTable, range: [V, V]): PaymentTransactionModel {
    const instance = new PaymentTransactionModel(undefined)

    return instance.applyWhereBetween<V>(column, range)
  }

  static whereRef(column: keyof PaymentTransactionsTable, ...args: string[]): PaymentTransactionModel {
    const instance = new PaymentTransactionModel(undefined)

    return instance.applyWhereRef(column, ...args)
  }

  static when(condition: boolean, callback: (query: PaymentTransactionModel) => PaymentTransactionModel): PaymentTransactionModel {
    const instance = new PaymentTransactionModel(undefined)

    return instance.applyWhen(condition, callback as any)
  }

  static whereNull(column: keyof PaymentTransactionsTable): PaymentTransactionModel {
    const instance = new PaymentTransactionModel(undefined)

    return instance.applyWhereNull(column)
  }

  static whereNotNull(column: keyof PaymentTransactionsTable): PaymentTransactionModel {
    const instance = new PaymentTransactionModel(undefined)

    return instance.applyWhereNotNull(column)
  }

  static whereLike(column: keyof PaymentTransactionsTable, value: string): PaymentTransactionModel {
    const instance = new PaymentTransactionModel(undefined)

    return instance.applyWhereLike(column, value)
  }

  static orderBy(column: keyof PaymentTransactionsTable, order: 'asc' | 'desc'): PaymentTransactionModel {
    const instance = new PaymentTransactionModel(undefined)

    return instance.applyOrderBy(column, order)
  }

  static orderByAsc(column: keyof PaymentTransactionsTable): PaymentTransactionModel {
    const instance = new PaymentTransactionModel(undefined)

    return instance.applyOrderByAsc(column)
  }

  static orderByDesc(column: keyof PaymentTransactionsTable): PaymentTransactionModel {
    const instance = new PaymentTransactionModel(undefined)

    return instance.applyOrderByDesc(column)
  }

  static groupBy(column: keyof PaymentTransactionsTable): PaymentTransactionModel {
    const instance = new PaymentTransactionModel(undefined)

    return instance.applyGroupBy(column)
  }

  static having<V = string>(column: keyof PaymentTransactionsTable, operator: Operator, value: V): PaymentTransactionModel {
    const instance = new PaymentTransactionModel(undefined)

    return instance.applyHaving<V>(column, operator, value)
  }

  static inRandomOrder(): PaymentTransactionModel {
    const instance = new PaymentTransactionModel(undefined)

    return instance.applyInRandomOrder()
  }

  static whereColumn(first: keyof PaymentTransactionsTable, operator: Operator, second: keyof PaymentTransactionsTable): PaymentTransactionModel {
    const instance = new PaymentTransactionModel(undefined)

    return instance.applyWhereColumn(first, operator, second)
  }

  static async max(field: keyof PaymentTransactionsTable): Promise<number> {
    const instance = new PaymentTransactionModel(undefined)

    return await instance.applyMax(field)
  }

  static async min(field: keyof PaymentTransactionsTable): Promise<number> {
    const instance = new PaymentTransactionModel(undefined)

    return await instance.applyMin(field)
  }

  static async avg(field: keyof PaymentTransactionsTable): Promise<number> {
    const instance = new PaymentTransactionModel(undefined)

    return await instance.applyAvg(field)
  }

  static async sum(field: keyof PaymentTransactionsTable): Promise<number> {
    const instance = new PaymentTransactionModel(undefined)

    return await instance.applySum(field)
  }

  static async count(): Promise<number> {
    const instance = new PaymentTransactionModel(undefined)

    return instance.applyCount()
  }

  static async get(): Promise<PaymentTransactionModel[]> {
    const instance = new PaymentTransactionModel(undefined)

    const results = await instance.applyGet()

    return results.map((item: PaymentTransactionJsonResponse) => instance.createInstance(item))
  }

  static async pluck<K extends keyof PaymentTransactionModel>(field: K): Promise<PaymentTransactionModel[K][]> {
    const instance = new PaymentTransactionModel(undefined)

    return await instance.applyPluck(field)
  }

  static async chunk(size: number, callback: (models: PaymentTransactionModel[]) => Promise<void>): Promise<void> {
    const instance = new PaymentTransactionModel(undefined)

    await instance.applyChunk(size, async (models) => {
      const modelInstances = models.map((item: PaymentTransactionJsonResponse) => instance.createInstance(item))
      await callback(modelInstances)
    })
  }

  static async paginate(options: { limit?: number, offset?: number, page?: number } = { limit: 10, offset: 0, page: 1 }): Promise<{
    data: PaymentTransactionModel[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }> {
    const instance = new PaymentTransactionModel(undefined)

    const result = await instance.applyPaginate(options)

    return {
      data: result.data.map((item: PaymentTransactionJsonResponse) => instance.createInstance(item)),
      paging: result.paging,
      next_cursor: result.next_cursor,
    }
  }

  // Instance method for creating model instances
  createInstance(data: PaymentTransactionJsonResponse): PaymentTransactionModel {
    return new PaymentTransactionModel(data)
  }

  async applyCreate(newPaymentTransaction: NewPaymentTransaction): Promise<PaymentTransactionModel> {
    const filteredValues = Object.fromEntries(
      Object.entries(newPaymentTransaction).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewPaymentTransaction

    await this.mapCustomSetters(filteredValues)

    filteredValues.uuid = randomUUIDv7()

    const result = await DB.instance.insertInto('payment_transactions')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await DB.instance.selectFrom('payment_transactions')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created PaymentTransaction')
    }

    return this.createInstance(model)
  }

  async create(newPaymentTransaction: NewPaymentTransaction): Promise<PaymentTransactionModel> {
    return await this.applyCreate(newPaymentTransaction)
  }

  static async create(newPaymentTransaction: NewPaymentTransaction): Promise<PaymentTransactionModel> {
    const instance = new PaymentTransactionModel(undefined)
    return await instance.applyCreate(newPaymentTransaction)
  }

  static async firstOrCreate(search: Partial<PaymentTransactionsTable>, values: NewPaymentTransaction = {} as NewPaymentTransaction): Promise<PaymentTransactionModel> {
    // First try to find a record matching the search criteria
    const instance = new PaymentTransactionModel(undefined)

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
    const createData = { ...search, ...values } as NewPaymentTransaction
    return await PaymentTransactionModel.create(createData)
  }

  static async updateOrCreate(search: Partial<PaymentTransactionsTable>, values: NewPaymentTransaction = {} as NewPaymentTransaction): Promise<PaymentTransactionModel> {
    // First try to find a record matching the search criteria
    const instance = new PaymentTransactionModel(undefined)

    // Apply all search conditions
    for (const [key, value] of Object.entries(search)) {
      instance.selectFromQuery = instance.selectFromQuery.where(key, '=', value)
    }

    // Try to find the record
    const existingRecord = await instance.applyFirst()

    if (existingRecord) {
      // If record exists, update it with the new values
      const model = instance.createInstance(existingRecord)
      const updatedModel = await model.update(values as PaymentTransactionUpdate)

      // Return the updated model instance
      if (updatedModel) {
        return updatedModel
      }

      // If update didn't return a model, fetch it again to ensure we have latest data
      const refreshedModel = await instance.applyFirst()
      return instance.createInstance(refreshedModel!)
    }

    // If no record exists, create a new one with combined search criteria and values
    const createData = { ...search, ...values } as NewPaymentTransaction
    return await PaymentTransactionModel.create(createData)
  }

  async update(newPaymentTransaction: PaymentTransactionUpdate): Promise<PaymentTransactionModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newPaymentTransaction).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as PaymentTransactionUpdate

    await this.mapCustomSetters(filteredValues)

    filteredValues.updated_at = new Date().toISOString()

    await DB.instance.updateTable('payment_transactions')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('payment_transactions')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated PaymentTransaction')
      }

      return this.createInstance(model)
    }

    return undefined
  }

  async forceUpdate(newPaymentTransaction: PaymentTransactionUpdate): Promise<PaymentTransactionModel | undefined> {
    await DB.instance.updateTable('payment_transactions')
      .set(newPaymentTransaction)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('payment_transactions')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated PaymentTransaction')
      }

      return this.createInstance(model)
    }

    return undefined
  }

  async save(): Promise<PaymentTransactionModel> {
    // If the model has an ID, update it; otherwise, create a new record
    if (this.id) {
      // Update existing record
      await DB.instance.updateTable('payment_transactions')
        .set(this.attributes as PaymentTransactionUpdate)
        .where('id', '=', this.id)
        .executeTakeFirst()

      // Get the updated data
      const model = await DB.instance.selectFrom('payment_transactions')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated PaymentTransaction')
      }

      return this.createInstance(model)
    }
    else {
      // Create new record
      const result = await DB.instance.insertInto('payment_transactions')
        .values(this.attributes as NewPaymentTransaction)
        .executeTakeFirst()

      // Get the created data
      const model = await DB.instance.selectFrom('payment_transactions')
        .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve created PaymentTransaction')
      }

      return this.createInstance(model)
    }
  }

  static async createMany(newPaymentTransaction: NewPaymentTransaction[]): Promise<void> {
    const instance = new PaymentTransactionModel(undefined)

    const valuesFiltered = newPaymentTransaction.map((newPaymentTransaction: NewPaymentTransaction) => {
      const filteredValues = Object.fromEntries(
        Object.entries(newPaymentTransaction).filter(([key]) =>
          !instance.guarded.includes(key) && instance.fillable.includes(key),
        ),
      ) as NewPaymentTransaction

      filteredValues.uuid = randomUUIDv7()

      return filteredValues
    })

    await DB.instance.insertInto('payment_transactions')
      .values(valuesFiltered)
      .executeTakeFirst()
  }

  static async forceCreate(newPaymentTransaction: NewPaymentTransaction): Promise<PaymentTransactionModel> {
    const result = await DB.instance.insertInto('payment_transactions')
      .values(newPaymentTransaction)
      .executeTakeFirst()

    const instance = new PaymentTransactionModel(undefined)
    const model = await DB.instance.selectFrom('payment_transactions')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created PaymentTransaction')
    }

    return instance.createInstance(model)
  }

  // Method to remove a PaymentTransaction
  async delete(): Promise<number> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()

    const deleted = await DB.instance.deleteFrom('payment_transactions')
      .where('id', '=', this.id)
      .execute()

    return deleted.numDeletedRows
  }

  static async remove(id: number): Promise<any> {
    return await DB.instance.deleteFrom('payment_transactions')
      .where('id', '=', id)
      .execute()
  }

  static whereName(value: string): PaymentTransactionModel {
    const instance = new PaymentTransactionModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('name', '=', value)

    return instance
  }

  static whereDescription(value: string): PaymentTransactionModel {
    const instance = new PaymentTransactionModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('description', '=', value)

    return instance
  }

  static whereAmount(value: string): PaymentTransactionModel {
    const instance = new PaymentTransactionModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('amount', '=', value)

    return instance
  }

  static whereType(value: string): PaymentTransactionModel {
    const instance = new PaymentTransactionModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('type', '=', value)

    return instance
  }

  static whereProviderId(value: string): PaymentTransactionModel {
    const instance = new PaymentTransactionModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('provider_id', '=', value)

    return instance
  }

  static whereIn<V = number>(column: keyof PaymentTransactionsTable, values: V[]): PaymentTransactionModel {
    const instance = new PaymentTransactionModel(undefined)

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

  async paymentMethodBelong(): Promise<PaymentMethodModel> {
    if (this.payment_method_id === undefined)
      throw new HttpError(500, 'Relation Error!')

    const model = await PaymentMethod
      .where('id', '=', this.payment_method_id)
      .first()

    if (!model)
      throw new HttpError(500, 'Model Relation Not Found!')

    return model
  }

  static distinct(column: keyof PaymentTransactionJsonResponse): PaymentTransactionModel {
    const instance = new PaymentTransactionModel(undefined)

    return instance.applyDistinct(column)
  }

  static join(table: string, firstCol: string, secondCol: string): PaymentTransactionModel {
    const instance = new PaymentTransactionModel(undefined)

    return instance.applyJoin(table, firstCol, secondCol)
  }

  toJSON(): PaymentTransactionJsonResponse {
    const output = {

      uuid: this.uuid,

      id: this.id,
      name: this.name,
      description: this.description,
      amount: this.amount,
      type: this.type,
      provider_id: this.provider_id,

      created_at: this.created_at,

      updated_at: this.updated_at,

      user_id: this.user_id,
      user: this.user,
      payment_method_id: this.payment_method_id,
      payment_method: this.payment_method,
      ...this.customColumns,
    }

    return output
  }

  parseResult(model: PaymentTransactionModel): PaymentTransactionModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof PaymentTransactionModel]
    }

    return model
  }

  // Add a protected applyFind implementation
  protected async applyFind(id: number): Promise<PaymentTransactionModel | undefined> {
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

export async function find(id: number): Promise<PaymentTransactionModel | undefined> {
  const query = DB.instance.selectFrom('payment_transactions').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  const instance = new PaymentTransactionModel(undefined)
  return instance.createInstance(model)
}

export async function count(): Promise<number> {
  const results = await PaymentTransactionModel.count()

  return results
}

export async function create(newPaymentTransaction: NewPaymentTransaction): Promise<PaymentTransactionModel> {
  const instance = new PaymentTransactionModel(undefined)
  return await instance.applyCreate(newPaymentTransaction)
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(DB.instance)
}

export async function remove(id: number): Promise<void> {
  await DB.instance.deleteFrom('payment_transactions')
    .where('id', '=', id)
    .execute()
}

export async function whereName(value: string): Promise<PaymentTransactionModel[]> {
  const query = DB.instance.selectFrom('payment_transactions').where('name', '=', value)
  const results: PaymentTransactionJsonResponse = await query.execute()

  return results.map((modelItem: PaymentTransactionJsonResponse) => new PaymentTransactionModel(modelItem))
}

export async function whereDescription(value: string): Promise<PaymentTransactionModel[]> {
  const query = DB.instance.selectFrom('payment_transactions').where('description', '=', value)
  const results: PaymentTransactionJsonResponse = await query.execute()

  return results.map((modelItem: PaymentTransactionJsonResponse) => new PaymentTransactionModel(modelItem))
}

export async function whereAmount(value: number): Promise<PaymentTransactionModel[]> {
  const query = DB.instance.selectFrom('payment_transactions').where('amount', '=', value)
  const results: PaymentTransactionJsonResponse = await query.execute()

  return results.map((modelItem: PaymentTransactionJsonResponse) => new PaymentTransactionModel(modelItem))
}

export async function whereType(value: string): Promise<PaymentTransactionModel[]> {
  const query = DB.instance.selectFrom('payment_transactions').where('type', '=', value)
  const results: PaymentTransactionJsonResponse = await query.execute()

  return results.map((modelItem: PaymentTransactionJsonResponse) => new PaymentTransactionModel(modelItem))
}

export async function whereProviderId(value: string): Promise<PaymentTransactionModel[]> {
  const query = DB.instance.selectFrom('payment_transactions').where('provider_id', '=', value)
  const results: PaymentTransactionJsonResponse = await query.execute()

  return results.map((modelItem: PaymentTransactionJsonResponse) => new PaymentTransactionModel(modelItem))
}

export const PaymentTransaction = PaymentTransactionModel

export default PaymentTransaction
