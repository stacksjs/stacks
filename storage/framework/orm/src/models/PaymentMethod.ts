import type { RawBuilder } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import type { NewPaymentMethod, PaymentMethodJsonResponse, PaymentMethodsTable, PaymentMethodUpdate } from '../types/PaymentMethodType'
import type { PaymentTransactionModel } from './PaymentTransaction'
import type { UserModel } from './User'
import { randomUUIDv7 } from 'bun'
import { sql } from '@stacksjs/database'
import { HttpError } from '@stacksjs/error-handling'

import { DB } from '@stacksjs/orm'

import { BaseOrm } from '../utils/base'

export class PaymentMethodModel extends BaseOrm<PaymentMethodModel, PaymentMethodsTable, PaymentMethodJsonResponse> {
  private readonly hidden: Array<keyof PaymentMethodJsonResponse> = []
  private readonly fillable: Array<keyof PaymentMethodJsonResponse> = ['type', 'last_four', 'brand', 'exp_month', 'exp_year', 'is_default', 'provider_id', 'uuid']
  private readonly guarded: Array<keyof PaymentMethodJsonResponse> = []
  protected attributes = {} as PaymentMethodJsonResponse
  protected originalAttributes = {} as PaymentMethodJsonResponse

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

  constructor(paymentMethod: PaymentMethodJsonResponse | undefined) {
    super('payment_methods')
    if (paymentMethod) {
      this.attributes = { ...paymentMethod }
      this.originalAttributes = { ...paymentMethod }

      Object.keys(paymentMethod).forEach((key) => {
        if (!(key in this)) {
          this.customColumns[key] = (paymentMethod as PaymentMethodJsonResponse)[key]
        }
      })
    }

    this.withRelations = []
    this.selectFromQuery = DB.instance.selectFrom('payment_methods')
    this.updateFromQuery = DB.instance.updateTable('payment_methods')
    this.deleteFromQuery = DB.instance.deleteFrom('payment_methods')
    this.hasSelect = false
  }

  protected async loadRelations(models: PaymentMethodJsonResponse | PaymentMethodJsonResponse[]): Promise<void> {
    // Handle both single model and array of models
    const modelArray = Array.isArray(models) ? models : [models]
    if (!modelArray.length)
      return

    const modelIds = modelArray.map(model => model.id)

    for (const relation of this.withRelations) {
      const relatedRecords = await DB.instance
        .selectFrom(relation)
        .where('paymentMethod_id', 'in', modelIds)
        .selectAll()
        .execute()

      if (Array.isArray(models)) {
        models.map((model: PaymentMethodJsonResponse) => {
          const records = relatedRecords.filter((record: { paymentMethod_id: number }) => {
            return record.paymentMethod_id === model.id
          })

          model[relation] = records.length === 1 ? records[0] : records
          return model
        })
      }
      else {
        const records = relatedRecords.filter((record: { paymentMethod_id: number }) => {
          return record.paymentMethod_id === models.id
        })

        models[relation] = records.length === 1 ? records[0] : records
      }
    }
  }

  static with(relations: string[]): PaymentMethodModel {
    const instance = new PaymentMethodModel(undefined)

    return instance.applyWith(relations)
  }

  protected mapCustomGetters(models: PaymentMethodJsonResponse | PaymentMethodJsonResponse[]): void {
    const data = models

    if (Array.isArray(data)) {
      data.map((model: PaymentMethodJsonResponse) => {
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

  async mapCustomSetters(model: NewPaymentMethod): Promise<void> {
    const customSetter = {
      default: () => {
      },

    }

    for (const [key, fn] of Object.entries(customSetter)) {
      (model as any)[key] = await fn()
    }
  }

  get payment_transactions(): PaymentTransactionModel[] | [] {
    return this.attributes.payment_transactions
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

  get type(): string {
    return this.attributes.type
  }

  get last_four(): number {
    return this.attributes.last_four
  }

  get brand(): string {
    return this.attributes.brand
  }

  get exp_month(): number {
    return this.attributes.exp_month
  }

  get exp_year(): number {
    return this.attributes.exp_year
  }

  get is_default(): boolean | undefined {
    return this.attributes.is_default
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

  set type(value: string) {
    this.attributes.type = value
  }

  set last_four(value: number) {
    this.attributes.last_four = value
  }

  set brand(value: string) {
    this.attributes.brand = value
  }

  set exp_month(value: number) {
    this.attributes.exp_month = value
  }

  set exp_year(value: number) {
    this.attributes.exp_year = value
  }

  set is_default(value: boolean) {
    this.attributes.is_default = value
  }

  set provider_id(value: string) {
    this.attributes.provider_id = value
  }

  set updated_at(value: string) {
    this.attributes.updated_at = value
  }

  static select(params: (keyof PaymentMethodJsonResponse)[] | RawBuilder<string> | string): PaymentMethodModel {
    const instance = new PaymentMethodModel(undefined)

    return instance.applySelect(params)
  }

  // Method to find a PaymentMethod by ID
  static async find(id: number): Promise<PaymentMethodModel | undefined> {
    const query = DB.instance.selectFrom('payment_methods').where('id', '=', id).selectAll()

    const model = await query.executeTakeFirst()

    if (!model)
      return undefined

    const instance = new PaymentMethodModel(undefined)
    return instance.createInstance(model)
  }

  static async first(): Promise<PaymentMethodModel | undefined> {
    const instance = new PaymentMethodModel(undefined)

    const model = await instance.applyFirst()

    const data = new PaymentMethodModel(model)

    return data
  }

  static async last(): Promise<PaymentMethodModel | undefined> {
    const instance = new PaymentMethodModel(undefined)

    const model = await instance.applyLast()

    if (!model)
      return undefined

    return new PaymentMethodModel(model)
  }

  static async firstOrFail(): Promise<PaymentMethodModel | undefined> {
    const instance = new PaymentMethodModel(undefined)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<PaymentMethodModel[]> {
    const instance = new PaymentMethodModel(undefined)

    const models = await DB.instance.selectFrom('payment_methods').selectAll().execute()

    instance.mapCustomGetters(models)

    const data = await Promise.all(models.map(async (model: PaymentMethodJsonResponse) => {
      return new PaymentMethodModel(model)
    }))

    return data
  }

  static async findOrFail(id: number): Promise<PaymentMethodModel | undefined> {
    const instance = new PaymentMethodModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  static async findMany(ids: number[]): Promise<PaymentMethodModel[]> {
    const instance = new PaymentMethodModel(undefined)

    const models = await instance.applyFindMany(ids)

    return models.map((modelItem: PaymentMethodJsonResponse) => instance.parseResult(new PaymentMethodModel(modelItem)))
  }

  static async latest(column: keyof PaymentMethodsTable = 'created_at'): Promise<PaymentMethodModel | undefined> {
    const instance = new PaymentMethodModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'desc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new PaymentMethodModel(model)
  }

  static async oldest(column: keyof PaymentMethodsTable = 'created_at'): Promise<PaymentMethodModel | undefined> {
    const instance = new PaymentMethodModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'asc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new PaymentMethodModel(model)
  }

  static skip(count: number): PaymentMethodModel {
    const instance = new PaymentMethodModel(undefined)

    return instance.applySkip(count)
  }

  static take(count: number): PaymentMethodModel {
    const instance = new PaymentMethodModel(undefined)

    return instance.applyTake(count)
  }

  static where<V = string>(column: keyof PaymentMethodsTable, ...args: [V] | [Operator, V]): PaymentMethodModel {
    const instance = new PaymentMethodModel(undefined)

    return instance.applyWhere<V>(column, ...args)
  }

  static orWhere(...conditions: [string, any][]): PaymentMethodModel {
    const instance = new PaymentMethodModel(undefined)

    return instance.applyOrWhere(...conditions)
  }

  static whereNotIn<V = number>(column: keyof PaymentMethodsTable, values: V[]): PaymentMethodModel {
    const instance = new PaymentMethodModel(undefined)

    return instance.applyWhereNotIn<V>(column, values)
  }

  static whereBetween<V = number>(column: keyof PaymentMethodsTable, range: [V, V]): PaymentMethodModel {
    const instance = new PaymentMethodModel(undefined)

    return instance.applyWhereBetween<V>(column, range)
  }

  static whereRef(column: keyof PaymentMethodsTable, ...args: string[]): PaymentMethodModel {
    const instance = new PaymentMethodModel(undefined)

    return instance.applyWhereRef(column, ...args)
  }

  static when(condition: boolean, callback: (query: PaymentMethodModel) => PaymentMethodModel): PaymentMethodModel {
    const instance = new PaymentMethodModel(undefined)

    return instance.applyWhen(condition, callback as any)
  }

  static whereNull(column: keyof PaymentMethodsTable): PaymentMethodModel {
    const instance = new PaymentMethodModel(undefined)

    return instance.applyWhereNull(column)
  }

  static whereNotNull(column: keyof PaymentMethodsTable): PaymentMethodModel {
    const instance = new PaymentMethodModel(undefined)

    return instance.applyWhereNotNull(column)
  }

  static whereLike(column: keyof PaymentMethodsTable, value: string): PaymentMethodModel {
    const instance = new PaymentMethodModel(undefined)

    return instance.applyWhereLike(column, value)
  }

  static orderBy(column: keyof PaymentMethodsTable, order: 'asc' | 'desc'): PaymentMethodModel {
    const instance = new PaymentMethodModel(undefined)

    return instance.applyOrderBy(column, order)
  }

  static orderByAsc(column: keyof PaymentMethodsTable): PaymentMethodModel {
    const instance = new PaymentMethodModel(undefined)

    return instance.applyOrderByAsc(column)
  }

  static orderByDesc(column: keyof PaymentMethodsTable): PaymentMethodModel {
    const instance = new PaymentMethodModel(undefined)

    return instance.applyOrderByDesc(column)
  }

  static groupBy(column: keyof PaymentMethodsTable): PaymentMethodModel {
    const instance = new PaymentMethodModel(undefined)

    return instance.applyGroupBy(column)
  }

  static having<V = string>(column: keyof PaymentMethodsTable, operator: Operator, value: V): PaymentMethodModel {
    const instance = new PaymentMethodModel(undefined)

    return instance.applyHaving<V>(column, operator, value)
  }

  static inRandomOrder(): PaymentMethodModel {
    const instance = new PaymentMethodModel(undefined)

    return instance.applyInRandomOrder()
  }

  static whereColumn(first: keyof PaymentMethodsTable, operator: Operator, second: keyof PaymentMethodsTable): PaymentMethodModel {
    const instance = new PaymentMethodModel(undefined)

    return instance.applyWhereColumn(first, operator, second)
  }

  static async max(field: keyof PaymentMethodsTable): Promise<number> {
    const instance = new PaymentMethodModel(undefined)

    return await instance.applyMax(field)
  }

  static async min(field: keyof PaymentMethodsTable): Promise<number> {
    const instance = new PaymentMethodModel(undefined)

    return await instance.applyMin(field)
  }

  static async avg(field: keyof PaymentMethodsTable): Promise<number> {
    const instance = new PaymentMethodModel(undefined)

    return await instance.applyAvg(field)
  }

  static async sum(field: keyof PaymentMethodsTable): Promise<number> {
    const instance = new PaymentMethodModel(undefined)

    return await instance.applySum(field)
  }

  static async count(): Promise<number> {
    const instance = new PaymentMethodModel(undefined)

    return instance.applyCount()
  }

  static async get(): Promise<PaymentMethodModel[]> {
    const instance = new PaymentMethodModel(undefined)

    const results = await instance.applyGet()

    return results.map((item: PaymentMethodJsonResponse) => instance.createInstance(item))
  }

  static async pluck<K extends keyof PaymentMethodModel>(field: K): Promise<PaymentMethodModel[K][]> {
    const instance = new PaymentMethodModel(undefined)

    return await instance.applyPluck(field)
  }

  static async chunk(size: number, callback: (models: PaymentMethodModel[]) => Promise<void>): Promise<void> {
    const instance = new PaymentMethodModel(undefined)

    await instance.applyChunk(size, async (models) => {
      const modelInstances = models.map((item: PaymentMethodJsonResponse) => instance.createInstance(item))
      await callback(modelInstances)
    })
  }

  static async paginate(options: { limit?: number, offset?: number, page?: number } = { limit: 10, offset: 0, page: 1 }): Promise<{
    data: PaymentMethodModel[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }> {
    const instance = new PaymentMethodModel(undefined)

    const result = await instance.applyPaginate(options)

    return {
      data: result.data.map((item: PaymentMethodJsonResponse) => instance.createInstance(item)),
      paging: result.paging,
      next_cursor: result.next_cursor,
    }
  }

  // Instance method for creating model instances
  createInstance(data: PaymentMethodJsonResponse): PaymentMethodModel {
    return new PaymentMethodModel(data)
  }

  async applyCreate(newPaymentMethod: NewPaymentMethod): Promise<PaymentMethodModel> {
    const filteredValues = Object.fromEntries(
      Object.entries(newPaymentMethod).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewPaymentMethod

    await this.mapCustomSetters(filteredValues)

    filteredValues.uuid = randomUUIDv7()

    const result = await DB.instance.insertInto('payment_methods')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await DB.instance.selectFrom('payment_methods')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created PaymentMethod')
    }

    return this.createInstance(model)
  }

  async create(newPaymentMethod: NewPaymentMethod): Promise<PaymentMethodModel> {
    return await this.applyCreate(newPaymentMethod)
  }

  static async create(newPaymentMethod: NewPaymentMethod): Promise<PaymentMethodModel> {
    const instance = new PaymentMethodModel(undefined)
    return await instance.applyCreate(newPaymentMethod)
  }

  static async firstOrCreate(search: Partial<PaymentMethodsTable>, values: NewPaymentMethod = {} as NewPaymentMethod): Promise<PaymentMethodModel> {
    // First try to find a record matching the search criteria
    const instance = new PaymentMethodModel(undefined)

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
    const createData = { ...search, ...values } as NewPaymentMethod
    return await PaymentMethodModel.create(createData)
  }

  static async updateOrCreate(search: Partial<PaymentMethodsTable>, values: NewPaymentMethod = {} as NewPaymentMethod): Promise<PaymentMethodModel> {
    // First try to find a record matching the search criteria
    const instance = new PaymentMethodModel(undefined)

    // Apply all search conditions
    for (const [key, value] of Object.entries(search)) {
      instance.selectFromQuery = instance.selectFromQuery.where(key, '=', value)
    }

    // Try to find the record
    const existingRecord = await instance.applyFirst()

    if (existingRecord) {
      // If record exists, update it with the new values
      const model = instance.createInstance(existingRecord)
      const updatedModel = await model.update(values as PaymentMethodUpdate)

      // Return the updated model instance
      if (updatedModel) {
        return updatedModel
      }

      // If update didn't return a model, fetch it again to ensure we have latest data
      const refreshedModel = await instance.applyFirst()
      return instance.createInstance(refreshedModel!)
    }

    // If no record exists, create a new one with combined search criteria and values
    const createData = { ...search, ...values } as NewPaymentMethod
    return await PaymentMethodModel.create(createData)
  }

  async update(newPaymentMethod: PaymentMethodUpdate): Promise<PaymentMethodModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newPaymentMethod).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as PaymentMethodUpdate

    await this.mapCustomSetters(filteredValues)

    filteredValues.updated_at = new Date().toISOString()

    await DB.instance.updateTable('payment_methods')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('payment_methods')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated PaymentMethod')
      }

      return this.createInstance(model)
    }

    return undefined
  }

  async forceUpdate(newPaymentMethod: PaymentMethodUpdate): Promise<PaymentMethodModel | undefined> {
    await DB.instance.updateTable('payment_methods')
      .set(newPaymentMethod)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('payment_methods')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated PaymentMethod')
      }

      return this.createInstance(model)
    }

    return undefined
  }

  async save(): Promise<PaymentMethodModel> {
    // If the model has an ID, update it; otherwise, create a new record
    if (this.id) {
      // Update existing record
      await DB.instance.updateTable('payment_methods')
        .set(this.attributes as PaymentMethodUpdate)
        .where('id', '=', this.id)
        .executeTakeFirst()

      // Get the updated data
      const model = await DB.instance.selectFrom('payment_methods')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated PaymentMethod')
      }

      return this.createInstance(model)
    }
    else {
      // Create new record
      const result = await DB.instance.insertInto('payment_methods')
        .values(this.attributes as NewPaymentMethod)
        .executeTakeFirst()

      // Get the created data
      const model = await DB.instance.selectFrom('payment_methods')
        .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve created PaymentMethod')
      }

      return this.createInstance(model)
    }
  }

  static async createMany(newPaymentMethod: NewPaymentMethod[]): Promise<void> {
    const instance = new PaymentMethodModel(undefined)

    const valuesFiltered = newPaymentMethod.map((newPaymentMethod: NewPaymentMethod) => {
      const filteredValues = Object.fromEntries(
        Object.entries(newPaymentMethod).filter(([key]) =>
          !instance.guarded.includes(key) && instance.fillable.includes(key),
        ),
      ) as NewPaymentMethod

      filteredValues.uuid = randomUUIDv7()

      return filteredValues
    })

    await DB.instance.insertInto('payment_methods')
      .values(valuesFiltered)
      .executeTakeFirst()
  }

  static async forceCreate(newPaymentMethod: NewPaymentMethod): Promise<PaymentMethodModel> {
    const result = await DB.instance.insertInto('payment_methods')
      .values(newPaymentMethod)
      .executeTakeFirst()

    const instance = new PaymentMethodModel(undefined)
    const model = await DB.instance.selectFrom('payment_methods')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created PaymentMethod')
    }

    return instance.createInstance(model)
  }

  // Method to remove a PaymentMethod
  async delete(): Promise<number> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()

    const deleted = await DB.instance.deleteFrom('payment_methods')
      .where('id', '=', this.id)
      .execute()

    return deleted.numDeletedRows
  }

  static async remove(id: number): Promise<any> {
    return await DB.instance.deleteFrom('payment_methods')
      .where('id', '=', id)
      .execute()
  }

  static whereType(value: string): PaymentMethodModel {
    const instance = new PaymentMethodModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('type', '=', value)

    return instance
  }

  static whereLastFour(value: string): PaymentMethodModel {
    const instance = new PaymentMethodModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('last_four', '=', value)

    return instance
  }

  static whereBrand(value: string): PaymentMethodModel {
    const instance = new PaymentMethodModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('brand', '=', value)

    return instance
  }

  static whereExpMonth(value: string): PaymentMethodModel {
    const instance = new PaymentMethodModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('exp_month', '=', value)

    return instance
  }

  static whereExpYear(value: string): PaymentMethodModel {
    const instance = new PaymentMethodModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('exp_year', '=', value)

    return instance
  }

  static whereIsDefault(value: string): PaymentMethodModel {
    const instance = new PaymentMethodModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('is_default', '=', value)

    return instance
  }

  static whereProviderId(value: string): PaymentMethodModel {
    const instance = new PaymentMethodModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('provider_id', '=', value)

    return instance
  }

  static whereIn<V = number>(column: keyof PaymentMethodsTable, values: V[]): PaymentMethodModel {
    const instance = new PaymentMethodModel(undefined)

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

  static distinct(column: keyof PaymentMethodJsonResponse): PaymentMethodModel {
    const instance = new PaymentMethodModel(undefined)

    return instance.applyDistinct(column)
  }

  static join(table: string, firstCol: string, secondCol: string): PaymentMethodModel {
    const instance = new PaymentMethodModel(undefined)

    return instance.applyJoin(table, firstCol, secondCol)
  }

  toJSON(): PaymentMethodJsonResponse {
    const output = {

      uuid: this.uuid,

      id: this.id,
      type: this.type,
      last_four: this.last_four,
      brand: this.brand,
      exp_month: this.exp_month,
      exp_year: this.exp_year,
      is_default: this.is_default,
      provider_id: this.provider_id,

      created_at: this.created_at,

      updated_at: this.updated_at,

      payment_transactions: this.payment_transactions,
      user_id: this.user_id,
      user: this.user,
      ...this.customColumns,
    }

    return output
  }

  parseResult(model: PaymentMethodModel): PaymentMethodModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof PaymentMethodModel]
    }

    return model
  }

  // Add a protected applyFind implementation
  protected async applyFind(id: number): Promise<PaymentMethodModel | undefined> {
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

export async function find(id: number): Promise<PaymentMethodModel | undefined> {
  const query = DB.instance.selectFrom('payment_methods').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  const instance = new PaymentMethodModel(undefined)
  return instance.createInstance(model)
}

export async function count(): Promise<number> {
  const results = await PaymentMethodModel.count()

  return results
}

export async function create(newPaymentMethod: NewPaymentMethod): Promise<PaymentMethodModel> {
  const instance = new PaymentMethodModel(undefined)
  return await instance.applyCreate(newPaymentMethod)
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(DB.instance)
}

export async function remove(id: number): Promise<void> {
  await DB.instance.deleteFrom('payment_methods')
    .where('id', '=', id)
    .execute()
}

export async function whereType(value: string): Promise<PaymentMethodModel[]> {
  const query = DB.instance.selectFrom('payment_methods').where('type', '=', value)
  const results: PaymentMethodJsonResponse = await query.execute()

  return results.map((modelItem: PaymentMethodJsonResponse) => new PaymentMethodModel(modelItem))
}

export async function whereLastFour(value: number): Promise<PaymentMethodModel[]> {
  const query = DB.instance.selectFrom('payment_methods').where('last_four', '=', value)
  const results: PaymentMethodJsonResponse = await query.execute()

  return results.map((modelItem: PaymentMethodJsonResponse) => new PaymentMethodModel(modelItem))
}

export async function whereBrand(value: string): Promise<PaymentMethodModel[]> {
  const query = DB.instance.selectFrom('payment_methods').where('brand', '=', value)
  const results: PaymentMethodJsonResponse = await query.execute()

  return results.map((modelItem: PaymentMethodJsonResponse) => new PaymentMethodModel(modelItem))
}

export async function whereExpMonth(value: number): Promise<PaymentMethodModel[]> {
  const query = DB.instance.selectFrom('payment_methods').where('exp_month', '=', value)
  const results: PaymentMethodJsonResponse = await query.execute()

  return results.map((modelItem: PaymentMethodJsonResponse) => new PaymentMethodModel(modelItem))
}

export async function whereExpYear(value: number): Promise<PaymentMethodModel[]> {
  const query = DB.instance.selectFrom('payment_methods').where('exp_year', '=', value)
  const results: PaymentMethodJsonResponse = await query.execute()

  return results.map((modelItem: PaymentMethodJsonResponse) => new PaymentMethodModel(modelItem))
}

export async function whereIsDefault(value: boolean): Promise<PaymentMethodModel[]> {
  const query = DB.instance.selectFrom('payment_methods').where('is_default', '=', value)
  const results: PaymentMethodJsonResponse = await query.execute()

  return results.map((modelItem: PaymentMethodJsonResponse) => new PaymentMethodModel(modelItem))
}

export async function whereProviderId(value: string): Promise<PaymentMethodModel[]> {
  const query = DB.instance.selectFrom('payment_methods').where('provider_id', '=', value)
  const results: PaymentMethodJsonResponse = await query.execute()

  return results.map((modelItem: PaymentMethodJsonResponse) => new PaymentMethodModel(modelItem))
}

export const PaymentMethod = PaymentMethodModel

export default PaymentMethod
