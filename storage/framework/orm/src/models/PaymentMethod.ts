import type { Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { TransactionModel } from './Transaction'
import type { UserModel } from './User'
import { randomUUIDv7 } from 'bun'
import { cache } from '@stacksjs/cache'
import { sql } from '@stacksjs/database'
import { HttpError, ModelNotFoundException } from '@stacksjs/error-handling'
import { dispatch } from '@stacksjs/events'

import { DB, SubqueryBuilder } from '@stacksjs/orm'

import Transaction from './Transaction'

import User from './User'

export interface PaymentMethodsTable {
  id?: number
  user_id?: number
  user?: UserModel
  transactions?: TransactionModel[] | undefined
  type?: string
  last_four?: number
  brand?: string
  exp_month?: number
  exp_year?: number
  is_default?: boolean
  provider_id?: string
  uuid?: string

  created_at?: Date

  updated_at?: Date

}

interface PaymentMethodResponse {
  data: PaymentMethodJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface PaymentMethodJsonResponse extends Omit<PaymentMethodsTable, 'password'> {
  [key: string]: any
}

export type PaymentMethodType = Selectable<PaymentMethodsTable>
export type NewPaymentMethod = Partial<Insertable<PaymentMethodsTable>>
export type PaymentMethodUpdate = Updateable<PaymentMethodsTable>

      type SortDirection = 'asc' | 'desc'
interface SortOptions { column: PaymentMethodType, order: SortDirection }
// Define a type for the options parameter
interface QueryOptions {
  sort?: SortOptions
  limit?: number
  offset?: number
  page?: number
}

export class PaymentMethodModel {
  private readonly hidden: Array<keyof PaymentMethodJsonResponse> = []
  private readonly fillable: Array<keyof PaymentMethodJsonResponse> = ['type', 'last_four', 'brand', 'exp_month', 'exp_year', 'is_default', 'provider_id', 'uuid', 'user_id']
  private readonly guarded: Array<keyof PaymentMethodJsonResponse> = []
  protected attributes: Partial<PaymentMethodType> = {}
  protected originalAttributes: Partial<PaymentMethodType> = {}

  protected selectFromQuery: any
  protected withRelations: string[]
  protected updateFromQuery: any
  protected deleteFromQuery: any
  protected hasSelect: boolean
  private hasSaved: boolean
  private customColumns: Record<string, unknown> = {}

  constructor(paymentmethod: Partial<PaymentMethodType> | null) {
    if (paymentmethod) {
      this.attributes = { ...paymentmethod }
      this.originalAttributes = { ...paymentmethod }

      Object.keys(paymentmethod).forEach((key) => {
        if (!(key in this)) {
          this.customColumns[key] = (paymentmethod as PaymentMethodJsonResponse)[key]
        }
      })
    }

    this.withRelations = []
    this.selectFromQuery = DB.instance.selectFrom('payment_methods')
    this.updateFromQuery = DB.instance.updateTable('payment_methods')
    this.deleteFromQuery = DB.instance.deleteFrom('payment_methods')
    this.hasSelect = false
    this.hasSaved = false
  }

  get user_id(): number | undefined {
    return this.attributes.user_id
  }

  get user(): UserModel | undefined {
    return this.attributes.user
  }

  get transactions(): TransactionModel[] | undefined {
    return this.attributes.transactions
  }

  get id(): number | undefined {
    return this.attributes.id
  }

  get uuid(): string | undefined {
    return this.attributes.uuid
  }

  get type(): string | undefined {
    return this.attributes.type
  }

  get last_four(): number | undefined {
    return this.attributes.last_four
  }

  get brand(): string | undefined {
    return this.attributes.brand
  }

  get exp_month(): number | undefined {
    return this.attributes.exp_month
  }

  get exp_year(): number | undefined {
    return this.attributes.exp_year
  }

  get is_default(): boolean | undefined {
    return this.attributes.is_default
  }

  get provider_id(): string | undefined {
    return this.attributes.provider_id
  }

  get created_at(): Date | undefined {
    return this.attributes.created_at
  }

  get updated_at(): Date | undefined {
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

  set updated_at(value: Date) {
    this.attributes.updated_at = value
  }

  getOriginal(column?: keyof PaymentMethodType): Partial<UserType> | any {
    if (column) {
      return this.originalAttributes[column]
    }

    return this.originalAttributes
  }

  getChanges(): Partial<PaymentMethodJsonResponse> {
    return this.fillable.reduce<Partial<PaymentMethodJsonResponse>>((changes, key) => {
      const currentValue = this.attributes[key as keyof PaymentMethodsTable]
      const originalValue = this.originalAttributes[key as keyof PaymentMethodsTable]

      if (currentValue !== originalValue) {
        changes[key] = currentValue
      }

      return changes
    }, {})
  }

  isDirty(column?: keyof PaymentMethodType): boolean {
    if (column) {
      return this.attributes[column] !== this.originalAttributes[column]
    }

    return Object.entries(this.originalAttributes).some(([key, originalValue]) => {
      const currentValue = (this.attributes as any)[key]

      return currentValue !== originalValue
    })
  }

  wasChanged(column?: keyof PaymentMethodType): boolean {
    return this.hasSaved && this.isDirty(column)
  }

  select(params: (keyof PaymentMethodType)[] | RawBuilder<string> | string): PaymentMethodModel {
    return PaymentMethodModel.select(params)
  }

  static select(params: (keyof PaymentMethodType)[] | RawBuilder<string> | string): PaymentMethodModel {
    const instance = new PaymentMethodModel(null)

    // Initialize a query with the table name and selected fields
    instance.selectFromQuery = instance.selectFromQuery.select(params)

    instance.hasSelect = true

    return instance
  }

  async find(id: number): Promise<PaymentMethodModel | undefined> {
    return await PaymentMethodModel.find(id)
  }

  // Method to find a PaymentMethod by ID
  static async find(id: number): Promise<PaymentMethodModel | undefined> {
    const model = await DB.instance.selectFrom('payment_methods').where('id', '=', id).selectAll().executeTakeFirst()

    if (!model)
      return undefined

    const instance = new PaymentMethodModel(null)

    const result = await instance.mapWith(model)

    const data = new PaymentMethodModel(result as PaymentMethodType)

    cache.getOrSet(`paymentmethod:${id}`, JSON.stringify(model))

    return data
  }

  async first(): Promise<PaymentMethodModel | undefined> {
    return await PaymentMethodModel.first()
  }

  static async first(): Promise<PaymentMethodModel | undefined> {
    const model = await DB.instance.selectFrom('payment_methods')
      .selectAll()
      .executeTakeFirst()

    if (!model)
      return undefined

    const instance = new PaymentMethodModel(null)

    const result = await instance.mapWith(model)

    const data = new PaymentMethodModel(result as PaymentMethodType)

    return data
  }

  async firstOrFail(): Promise<PaymentMethodModel | undefined> {
    return await PaymentMethodModel.firstOrFail()
  }

  static async firstOrFail(): Promise<PaymentMethodModel | undefined> {
    const instance = new PaymentMethodModel(null)

    const model = await instance.selectFromQuery.executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, 'No PaymentMethodModel results found for query')

    const result = await instance.mapWith(model)

    const data = new PaymentMethodModel(result as PaymentMethodType)

    return data
  }

  async mapWith(model: PaymentMethodType): Promise<PaymentMethodType> {
    if (this.withRelations.includes('transactions')) {
      model.transactions = await this.transactionsHasMany()
    }

    if (this.withRelations.includes('user')) {
      model.user = await this.userBelong()
    }

    return model
  }

  static async all(): Promise<PaymentMethodModel[]> {
    const models = await DB.instance.selectFrom('payment_methods').selectAll().execute()

    const data = await Promise.all(models.map(async (model: PaymentMethodType) => {
      const instance = new PaymentMethodModel(model)

      const results = await instance.mapWith(model)

      return new PaymentMethodModel(results)
    }))

    return data
  }

  async findOrFail(id: number): Promise<PaymentMethodModel> {
    return await PaymentMethodModel.findOrFail(id)
  }

  static async findOrFail(id: number): Promise<PaymentMethodModel> {
    const model = await DB.instance.selectFrom('payment_methods').where('id', '=', id).selectAll().executeTakeFirst()

    const instance = new PaymentMethodModel(null)

    if (model === undefined)
      throw new ModelNotFoundException(404, `No PaymentMethodModel results for ${id}`)

    cache.getOrSet(`paymentmethod:${id}`, JSON.stringify(model))

    const result = await instance.mapWith(model)

    const data = new PaymentMethodModel(result as PaymentMethodType)

    return data
  }

  static async findMany(ids: number[]): Promise<PaymentMethodModel[]> {
    let query = DB.instance.selectFrom('payment_methods').where('id', 'in', ids)

    const instance = new PaymentMethodModel(null)

    query = query.selectAll()

    const model = await query.execute()

    return model.map((modelItem: PaymentMethodModel) => instance.parseResult(new PaymentMethodModel(modelItem)))
  }

  skip(count: number): PaymentMethodModel {
    return PaymentMethodModel.skip(count)
  }

  static skip(count: number): PaymentMethodModel {
    const instance = new PaymentMethodModel(null)

    instance.selectFromQuery = instance.selectFromQuery.offset(count)

    return instance
  }

  async chunk(size: number, callback: (models: PaymentMethodModel[]) => Promise<void>): Promise<void> {
    await PaymentMethodModel.chunk(size, callback)
  }

  static async chunk(size: number, callback: (models: PaymentMethodModel[]) => Promise<void>): Promise<void> {
    let page = 1
    let hasMore = true

    while (hasMore) {
      const instance = new PaymentMethodModel(null)

      // Get one batch
      const models = await instance.selectFromQuery
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

  take(count: number): PaymentMethodModel {
    return PaymentMethodModel.take(count)
  }

  static take(count: number): PaymentMethodModel {
    const instance = new PaymentMethodModel(null)

    instance.selectFromQuery = instance.selectFromQuery.limit(count)

    return instance
  }

  static async pluck<K extends keyof PaymentMethodModel>(field: K): Promise<PaymentMethodModel[K][]> {
    const instance = new PaymentMethodModel(null)

    if (instance.hasSelect) {
      const model = await instance.selectFromQuery.execute()
      return model.map((modelItem: PaymentMethodModel) => modelItem[field])
    }

    const model = await instance.selectFromQuery.selectAll().execute()

    return model.map((modelItem: PaymentMethodModel) => modelItem[field])
  }

  async pluck<K extends keyof PaymentMethodModel>(field: K): Promise<PaymentMethodModel[K][]> {
    return PaymentMethodModel.pluck(field)
  }

  static async count(): Promise<number> {
    const instance = new PaymentMethodModel(null)

    return instance.selectFromQuery
      .select(sql`COUNT(*) as count`)
      .executeTakeFirst()
  }

  async count(): Promise<number> {
    return PaymentMethodModel.count()
  }

  async max(field: keyof PaymentMethodModel): Promise<number> {
    return await this.selectFromQuery
      .select(sql`MAX(${sql.raw(field as string)}) `)
      .executeTakeFirst()
  }

  async min(field: keyof PaymentMethodModel): Promise<number> {
    return await this.selectFromQuery
      .select(sql`MIN(${sql.raw(field as string)}) `)
      .executeTakeFirst()
  }

  async avg(field: keyof PaymentMethodModel): Promise<number> {
    return this.selectFromQuery
      .select(sql`AVG(${sql.raw(field as string)})`)
      .executeTakeFirst()
  }

  async sum(field: keyof PaymentMethodModel): Promise<number> {
    return this.selectFromQuery
      .select(sql`SUM(${sql.raw(field as string)})`)
      .executeTakeFirst()
  }

  async get(): Promise<PaymentMethodModel[]> {
    return PaymentMethodModel.get()
  }

  static async get(): Promise<PaymentMethodModel[]> {
    const instance = new PaymentMethodModel(null)

    let models

    if (instance.hasSelect) {
      models = await instance.selectFromQuery.execute()
    }
    else {
      models = await instance.selectFromQuery.selectAll().execute()
    }

    const data = await Promise.all(models.map(async (model: PaymentMethodModel) => {
      const instance = new PaymentMethodModel(model)

      const results = await instance.mapWith(model)

      return new PaymentMethodModel(results)
    }))

    return data
  }

  has(relation: string): PaymentMethodModel {
    return PaymentMethodModel.has(relation)
  }

  static has(relation: string): PaymentMethodModel {
    const instance = new PaymentMethodModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(
        selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.paymentmethod_id`, '=', 'payment_methods.id'),
      ),
    )

    return instance
  }

  static whereExists(callback: (qb: any) => any): PaymentMethodModel {
    const instance = new PaymentMethodModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(callback({ exists, selectFrom })),
    )

    return instance
  }

  whereHas(
    relation: string,
    callback: (query: SubqueryBuilder) => void,
  ): PaymentMethodModel {
    return PaymentMethodModel.whereHas(relation, callback)
  }

  static whereHas(
    relation: string,
    callback: (query: SubqueryBuilder) => void,
  ): PaymentMethodModel {
    const instance = new PaymentMethodModel(null)
    const subqueryBuilder = new SubqueryBuilder()

    callback(subqueryBuilder)
    const conditions = subqueryBuilder.getConditions()

    instance.selectFromQuery = instance.selectFromQuery
      .where(({ exists, selectFrom }: any) => {
        let subquery = selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.paymentmethod_id`, '=', 'payment_methods.id')

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

  doesntHave(relation: string): PaymentMethodModel {
    return PaymentMethodModel.doesntHave(relation)
  }

  static doesntHave(relation: string): PaymentMethodModel {
    const instance = new PaymentMethodModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where(({ not, exists, selectFrom }: any) =>
      not(
        exists(
          selectFrom(relation)
            .select('1')
            .whereRef(`${relation}.paymentmethod_id`, '=', 'payment_methods.id'),
        ),
      ),
    )

    return instance
  }

  whereDoesntHave(relation: string, callback: (query: SubqueryBuilder) => void): PaymentMethodModel {
    return PaymentMethodModel.whereDoesntHave(relation, callback)
  }

  static whereDoesntHave(
    relation: string,
    callback: (query: SubqueryBuilder) => void,
  ): PaymentMethodModel {
    const instance = new PaymentMethodModel(null)
    const subqueryBuilder = new SubqueryBuilder()

    callback(subqueryBuilder)
    const conditions = subqueryBuilder.getConditions()

    instance.selectFromQuery = instance.selectFromQuery
      .where(({ exists, selectFrom, not }: any) => {
        let subquery = selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.paymentmethod_id`, '=', 'payment_methods.id')

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

  async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<PaymentMethodResponse> {
    return PaymentMethodModel.paginate(options)
  }

  // Method to get all payment_methods
  static async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<PaymentMethodResponse> {
    const totalRecordsResult = await DB.instance.selectFrom('payment_methods')
      .select(DB.instance.fn.count('id').as('total')) // Use 'id' or another actual column name
      .executeTakeFirst()

    const totalRecords = Number(totalRecordsResult?.total) || 0
    const totalPages = Math.ceil(totalRecords / (options.limit ?? 10))

    const payment_methodsWithExtra = await DB.instance.selectFrom('payment_methods')
      .selectAll()
      .orderBy('id', 'asc') // Assuming 'id' is used for cursor-based pagination
      .limit((options.limit ?? 10) + 1) // Fetch one extra record
      .offset(((options.page ?? 1) - 1) * (options.limit ?? 10)) // Ensure options.page is not undefined
      .execute()

    let nextCursor = null
    if (payment_methodsWithExtra.length > (options.limit ?? 10))
      nextCursor = payment_methodsWithExtra.pop()?.id ?? null

    return {
      data: payment_methodsWithExtra,
      paging: {
        total_records: totalRecords,
        page: options.page || 1,
        total_pages: totalPages,
      },
      next_cursor: nextCursor,
    }
  }

  static async create(newPaymentMethod: NewPaymentMethod): Promise<PaymentMethodModel> {
    const instance = new PaymentMethodModel(null)

    const filteredValues = Object.fromEntries(
      Object.entries(newPaymentMethod).filter(([key]) =>
        !instance.guarded.includes(key) && instance.fillable.includes(key),
      ),
    ) as NewPaymentMethod

    filteredValues.uuid = randomUUIDv7()

    const result = await DB.instance.insertInto('payment_methods')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await instance.find(Number(result.numInsertedOrUpdatedRows)) as PaymentMethodModel

    if (model)
      dispatch('PaymentMethods:created', model)

    return model
  }

  static async createMany(newPaymentMethod: NewPaymentMethod[]): Promise<void> {
    const instance = new PaymentMethodModel(null)

    const filteredValues = newPaymentMethod.map((newPaymentMethod: NewPaymentMethod) => {
      const filtered = Object.fromEntries(
        Object.entries(newPaymentMethod).filter(([key]) =>
          !instance.guarded.includes(key) && instance.fillable.includes(key),
        ),
      ) as NewPaymentMethod

      filteredValues.uuid = randomUUIDv7()

      return filtered
    })

    await DB.instance.insertInto('payment_methods')
      .values(filteredValues)
      .executeTakeFirst()
  }

  static async forceCreate(newPaymentMethod: NewPaymentMethod): Promise<PaymentMethodModel> {
    const result = await DB.instance.insertInto('payment_methods')
      .values(newPaymentMethod)
      .executeTakeFirst()

    const model = await find(Number(result.numInsertedOrUpdatedRows)) as PaymentMethodModel

    return model
  }

  // Method to remove a PaymentMethod
  static async remove(id: number): Promise<any> {
    return await DB.instance.deleteFrom('payment_methods')
      .where('id', '=', id)
      .execute()
  }

  private static applyWhere(instance: PaymentMethodModel, column: string, operator: string, value: any): PaymentMethodModel {
    instance.selectFromQuery = instance.selectFromQuery.where(column, operator, value)
    instance.updateFromQuery = instance.updateFromQuery.where(column, operator, value)
    instance.deleteFromQuery = instance.deleteFromQuery.where(column, operator, value)

    return instance
  }

  where(column: string, operator: string, value: any): PaymentMethodModel {
    return PaymentMethodModel.applyWhere(this, column, operator, value)
  }

  static where(column: string, operator: string, value: any): PaymentMethodModel {
    const instance = new PaymentMethodModel(null)

    return PaymentMethodModel.applyWhere(instance, column, operator, value)
  }

  whereColumn(first: string, operator: string, second: string): PaymentMethodModel {
    return PaymentMethodModel.whereColumn(first, operator, second)
  }

  static whereColumn(first: string, operator: string, second: string): PaymentMethodModel {
    const instance = new PaymentMethodModel(null)

    instance.selectFromQuery = instance.selectFromQuery.whereRef(first, operator, second)

    return instance
  }

  whereRef(column: string, operator: string, value: string): PaymentMethodModel {
    return PaymentMethodModel.whereRef(column, operator, value)
  }

  static whereRef(column: string, operator: string, value: string): PaymentMethodModel {
    const instance = new PaymentMethodModel(null)

    instance.selectFromQuery = instance.selectFromQuery.whereRef(column, operator, value)

    return instance
  }

  whereRaw(sqlStatement: string): PaymentMethodModel {
    return PaymentMethodModel.whereRaw(sqlStatement)
  }

  static whereRaw(sqlStatement: string): PaymentMethodModel {
    const instance = new PaymentMethodModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where(sql`${sqlStatement}`)

    return instance
  }

  orWhere(...args: Array<[string, string, any]>): PaymentMethodModel {
    return PaymentMethodModel.orWhere(...args)
  }

  static orWhere(...args: Array<[string, string, any]>): PaymentMethodModel {
    const instance = new PaymentMethodModel(null)

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
    callback: (query: PaymentMethodModel) => PaymentMethodModel,
  ): PaymentMethodModel {
    return PaymentMethodModel.when(condition, callback)
  }

  static when(
    condition: boolean,
    callback: (query: PaymentMethodModel) => PaymentMethodModel,
  ): PaymentMethodModel {
    let instance = new PaymentMethodModel(null)

    if (condition)
      instance = callback(instance)

    return instance
  }

  whereNull(column: string): PaymentMethodModel {
    return PaymentMethodModel.whereNull(column)
  }

  static whereNull(column: string): PaymentMethodModel {
    const instance = new PaymentMethodModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    instance.updateFromQuery = instance.updateFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    return instance
  }

  static whereType(value: string): PaymentMethodModel {
    const instance = new PaymentMethodModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('type', '=', value)

    return instance
  }

  static whereLastFour(value: string): PaymentMethodModel {
    const instance = new PaymentMethodModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('lastFour', '=', value)

    return instance
  }

  static whereBrand(value: string): PaymentMethodModel {
    const instance = new PaymentMethodModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('brand', '=', value)

    return instance
  }

  static whereExpMonth(value: string): PaymentMethodModel {
    const instance = new PaymentMethodModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('expMonth', '=', value)

    return instance
  }

  static whereExpYear(value: string): PaymentMethodModel {
    const instance = new PaymentMethodModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('expYear', '=', value)

    return instance
  }

  static whereIsDefault(value: string): PaymentMethodModel {
    const instance = new PaymentMethodModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('isDefault', '=', value)

    return instance
  }

  static whereProviderId(value: string): PaymentMethodModel {
    const instance = new PaymentMethodModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('providerId', '=', value)

    return instance
  }

  whereIn(column: keyof PaymentMethodType, values: any[]): PaymentMethodModel {
    return PaymentMethodModel.whereIn(column, values)
  }

  static whereIn(column: keyof PaymentMethodType, values: any[]): PaymentMethodModel {
    const instance = new PaymentMethodModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where(column, 'in', values)

    instance.updateFromQuery = instance.updateFromQuery.where(column, 'in', values)

    instance.deleteFromQuery = instance.deleteFromQuery.where(column, 'in', values)

    return instance
  }

  whereBetween(column: keyof PaymentMethodType, range: [any, any]): PaymentMethodModel {
    return PaymentMethodModel.whereBetween(column, range)
  }

  static whereBetween(column: keyof PaymentMethodType, range: [any, any]): PaymentMethodModel {
    if (range.length !== 2) {
      throw new HttpError(500, 'Range must have exactly two values: [min, max]')
    }

    const instance = new PaymentMethodModel(null)

    const query = sql` ${sql.raw(column as string)} between ${range[0]} and ${range[1]} `

    instance.selectFromQuery = instance.selectFromQuery.where(query)
    instance.updateFromQuery = instance.updateFromQuery.where(query)
    instance.deleteFromQuery = instance.deleteFromQuery.where(query)

    return instance
  }

  whereNotIn(column: keyof PaymentMethodType, values: any[]): PaymentMethodModel {
    return PaymentMethodModel.whereNotIn(column, values)
  }

  static whereNotIn(column: keyof PaymentMethodType, values: any[]): PaymentMethodModel {
    const instance = new PaymentMethodModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where(column, 'not in', values)

    instance.updateFromQuery = instance.updateFromQuery.where(column, 'not in', values)

    instance.deleteFromQuery = instance.deleteFromQuery.where(column, 'not in', values)

    return instance
  }

  async exists(): Promise<boolean> {
    const model = await this.selectFromQuery.executeTakeFirst()

    return model !== null || model !== undefined
  }

  static async latest(): Promise<PaymentMethodType | undefined> {
    const model = await DB.instance.selectFrom('payment_methods')
      .selectAll()
      .orderBy('created_at', 'desc')
      .executeTakeFirst()

    if (!model)
      return undefined

    const instance = new PaymentMethodModel(null)
    const result = await instance.mapWith(model)
    const data = new PaymentMethodModel(result as PaymentMethodType)

    return data
  }

  static async oldest(): Promise<PaymentMethodType | undefined> {
    const model = await DB.instance.selectFrom('payment_methods')
      .selectAll()
      .orderBy('created_at', 'asc')
      .executeTakeFirst()

    if (!model)
      return undefined

    const instance = new PaymentMethodModel(null)
    const result = await instance.mapWith(model)
    const data = new PaymentMethodModel(result as PaymentMethodType)

    return data
  }

  static async firstOrCreate(
    condition: Partial<PaymentMethodType>,
    newPaymentMethod: NewPaymentMethod,
  ): Promise<PaymentMethodModel> {
    // Get the key and value from the condition object
    const key = Object.keys(condition)[0] as keyof PaymentMethodType

    if (!key) {
      throw new HttpError(500, 'Condition must contain at least one key-value pair')
    }

    const value = condition[key]

    // Attempt to find the first record matching the condition
    const existingPaymentMethod = await DB.instance.selectFrom('payment_methods')
      .selectAll()
      .where(key, '=', value)
      .executeTakeFirst()

    if (existingPaymentMethod) {
      const instance = new PaymentMethodModel(null)
      const result = await instance.mapWith(existingPaymentMethod)
      return new PaymentMethodModel(result as PaymentMethodType)
    }
    else {
      return await this.create(newPaymentMethod)
    }
  }

  static async updateOrCreate(
    condition: Partial<PaymentMethodType>,
    newPaymentMethod: NewPaymentMethod,
  ): Promise<PaymentMethodModel> {
    const instance = new PaymentMethodModel(null)

    const key = Object.keys(condition)[0] as keyof PaymentMethodType

    if (!key) {
      throw new HttpError(500, 'Condition must contain at least one key-value pair')
    }

    const value = condition[key]

    // Attempt to find the first record matching the condition
    const existingPaymentMethod = await DB.instance.selectFrom('payment_methods')
      .selectAll()
      .where(key, '=', value)
      .executeTakeFirst()

    if (existingPaymentMethod) {
      // If found, update the existing record
      await DB.instance.updateTable('payment_methods')
        .set(newPaymentMethod)
        .where(key, '=', value)
        .executeTakeFirstOrThrow()

      // Fetch and return the updated record
      const updatedPaymentMethod = await DB.instance.selectFrom('payment_methods')
        .selectAll()
        .where(key, '=', value)
        .executeTakeFirst()

      if (!updatedPaymentMethod) {
        throw new HttpError(500, 'Failed to fetch updated record')
      }

      const result = await instance.mapWith(updatedPaymentMethod)

      instance.hasSaved = true

      return new PaymentMethodModel(result as PaymentMethodType)
    }
    else {
      // If not found, create a new record
      return await this.create(newPaymentMethod)
    }
  }

  with(relations: string[]): PaymentMethodModel {
    return PaymentMethodModel.with(relations)
  }

  static with(relations: string[]): PaymentMethodModel {
    const instance = new PaymentMethodModel(null)

    instance.withRelations = relations

    return instance
  }

  async last(): Promise<PaymentMethodType | undefined> {
    return await DB.instance.selectFrom('payment_methods')
      .selectAll()
      .orderBy('id', 'desc')
      .executeTakeFirst()
  }

  static async last(): Promise<PaymentMethodType | undefined> {
    const model = await DB.instance.selectFrom('payment_methods').selectAll().orderBy('id', 'desc').executeTakeFirst()

    if (!model)
      return undefined

    const instance = new PaymentMethodModel(null)

    const result = await instance.mapWith(model)

    const data = new PaymentMethodModel(result as PaymentMethodType)

    return data
  }

  orderBy(column: keyof PaymentMethodType, order: 'asc' | 'desc'): PaymentMethodModel {
    return PaymentMethodModel.orderBy(column, order)
  }

  static orderBy(column: keyof PaymentMethodType, order: 'asc' | 'desc'): PaymentMethodModel {
    const instance = new PaymentMethodModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, order)

    return instance
  }

  groupBy(column: keyof PaymentMethodType): PaymentMethodModel {
    return PaymentMethodModel.groupBy(column)
  }

  static groupBy(column: keyof PaymentMethodType): PaymentMethodModel {
    const instance = new PaymentMethodModel(null)

    instance.selectFromQuery = instance.selectFromQuery.groupBy(column)

    return instance
  }

  having(column: keyof PaymentMethodType, operator: string, value: any): PaymentMethodModel {
    return PaymentMethodModel.having(column, operator, value)
  }

  static having(column: keyof PaymentMethodType, operator: string, value: any): PaymentMethodModel {
    const instance = new PaymentMethodModel(null)

    instance.selectFromQuery = instance.selectFromQuery.having(column, operator, value)

    return instance
  }

  inRandomOrder(): PaymentMethodModel {
    return PaymentMethodModel.inRandomOrder()
  }

  static inRandomOrder(): PaymentMethodModel {
    const instance = new PaymentMethodModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(sql` ${sql.raw('RANDOM()')} `)

    return instance
  }

  orderByDesc(column: keyof PaymentMethodType): PaymentMethodModel {
    return PaymentMethodModel.orderByDesc(column)
  }

  static orderByDesc(column: keyof PaymentMethodType): PaymentMethodModel {
    const instance = new PaymentMethodModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, 'desc')

    return instance
  }

  orderByAsc(column: keyof PaymentMethodType): PaymentMethodModel {
    return PaymentMethodModel.orderByAsc(column)
  }

  static orderByAsc(column: keyof PaymentMethodType): PaymentMethodModel {
    const instance = new PaymentMethodModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, 'asc')

    return instance
  }

  async update(newPaymentMethod: PaymentMethodUpdate): Promise<PaymentMethodModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newPaymentMethod).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewPaymentMethod

    await DB.instance.updateTable('payment_methods')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      const model = await this.find(this.id)

      return model
    }

    this.hasSaved = true

    return undefined
  }

  async forceUpdate(paymentmethod: PaymentMethodUpdate): Promise<PaymentMethodModel | undefined> {
    if (this.id === undefined) {
      this.updateFromQuery.set(paymentmethod).execute()
    }

    await DB.instance.updateTable('payment_methods')
      .set(paymentmethod)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      const model = await this.find(this.id)

      this.hasSaved = true

      return model
    }

    return undefined
  }

  async save(): Promise<void> {
    if (!this)
      throw new HttpError(500, 'PaymentMethod data is undefined')

    const filteredValues = Object.fromEntries(
      Object.entries(this).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewPaymentMethod

    if (this.id === undefined) {
      await DB.instance.insertInto('payment_methods')
        .values(filteredValues)
        .executeTakeFirstOrThrow()
    }
    else {
      await this.update(this)
    }

    this.hasSaved = true
  }

  fill(data: Partial<PaymentMethodType>): PaymentMethodModel {
    const filteredValues = Object.fromEntries(
      Object.entries(data).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewPaymentMethod

    this.attributes = {
      ...this.attributes,
      ...filteredValues,
    }

    return this
  }

  forceFill(data: Partial<PaymentMethodType>): PaymentMethodModel {
    this.attributes = {
      ...this.attributes,
      ...data,
    }

    return this
  }

  // Method to delete (soft delete) the paymentmethod instance
  async delete(): Promise<any> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()

    return await DB.instance.deleteFrom('payment_methods')
      .where('id', '=', this.id)
      .execute()
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

  async transactionsHasMany(): Promise<TransactionModel[]> {
    if (this.id === undefined)
      throw new HttpError(500, 'Relation Error!')

    const results = await DB.instance.selectFrom('transactions')
      .where('payment_method_id', '=', this.id)
      .limit(5)
      .selectAll()
      .execute()

    return results.map((modelItem: PaymentMethodModel) => new Transaction(modelItem))
  }

  distinct(column: keyof PaymentMethodType): PaymentMethodModel {
    return PaymentMethodModel.distinct(column)
  }

  static distinct(column: keyof PaymentMethodType): PaymentMethodModel {
    const instance = new PaymentMethodModel(null)

    instance.selectFromQuery = instance.selectFromQuery.select(column).distinct()

    instance.hasSelect = true

    return instance
  }

  join(table: string, firstCol: string, secondCol: string): PaymentMethodModel {
    return PaymentMethodModel.join(table, firstCol, secondCol)
  }

  static join(table: string, firstCol: string, secondCol: string): PaymentMethodModel {
    const instance = new PaymentMethodModel(null)

    instance.selectFromQuery = instance.selectFromQuery.innerJoin(table, firstCol, secondCol)

    return instance
  }

  static async rawQuery(rawQuery: string): Promise<any> {
    return await sql`${rawQuery}`.execute(DB.instance)
  }

  toJSON(): Partial<PaymentMethodJsonResponse> {
    const output: Partial<PaymentMethodJsonResponse> = {

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

      user_id: this.user_id,
      user: this.user,
      transactions: this.transactions,
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
}

async function find(id: number): Promise<PaymentMethodModel | undefined> {
  const query = DB.instance.selectFrom('payment_methods').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  return new PaymentMethodModel(model)
}

export async function count(): Promise<number> {
  const results = await PaymentMethodModel.count()

  return results
}

export async function create(newPaymentMethod: NewPaymentMethod): Promise<PaymentMethodModel> {
  const result = await DB.instance.insertInto('payment_methods')
    .values(newPaymentMethod)
    .executeTakeFirstOrThrow()

  return await find(Number(result.numInsertedOrUpdatedRows)) as PaymentMethodModel
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
  const results = await query.execute()

  return results.map((modelItem: PaymentMethodModel) => new PaymentMethodModel(modelItem))
}

export async function whereLastFour(value: number): Promise<PaymentMethodModel[]> {
  const query = DB.instance.selectFrom('payment_methods').where('last_four', '=', value)
  const results = await query.execute()

  return results.map((modelItem: PaymentMethodModel) => new PaymentMethodModel(modelItem))
}

export async function whereBrand(value: string): Promise<PaymentMethodModel[]> {
  const query = DB.instance.selectFrom('payment_methods').where('brand', '=', value)
  const results = await query.execute()

  return results.map((modelItem: PaymentMethodModel) => new PaymentMethodModel(modelItem))
}

export async function whereExpMonth(value: number): Promise<PaymentMethodModel[]> {
  const query = DB.instance.selectFrom('payment_methods').where('exp_month', '=', value)
  const results = await query.execute()

  return results.map((modelItem: PaymentMethodModel) => new PaymentMethodModel(modelItem))
}

export async function whereExpYear(value: number): Promise<PaymentMethodModel[]> {
  const query = DB.instance.selectFrom('payment_methods').where('exp_year', '=', value)
  const results = await query.execute()

  return results.map((modelItem: PaymentMethodModel) => new PaymentMethodModel(modelItem))
}

export async function whereIsDefault(value: boolean): Promise<PaymentMethodModel[]> {
  const query = DB.instance.selectFrom('payment_methods').where('is_default', '=', value)
  const results = await query.execute()

  return results.map((modelItem: PaymentMethodModel) => new PaymentMethodModel(modelItem))
}

export async function whereProviderId(value: string): Promise<PaymentMethodModel[]> {
  const query = DB.instance.selectFrom('payment_methods').where('provider_id', '=', value)
  const results = await query.execute()

  return results.map((modelItem: PaymentMethodModel) => new PaymentMethodModel(modelItem))
}

export const PaymentMethod = PaymentMethodModel

export default PaymentMethod
