import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import type { PaymentMethodModel } from './PaymentMethod'
import type { UserModel } from './User'
import { randomUUIDv7 } from 'bun'
import { cache } from '@stacksjs/cache'
import { sql } from '@stacksjs/database'
import { HttpError, ModelNotFoundException } from '@stacksjs/error-handling'

import { DB, SubqueryBuilder } from '@stacksjs/orm'

import PaymentMethod from './PaymentMethod'

import User from './User'

export interface PaymentTransactionsTable {
  id: Generated<number>
  user_id: number
  payment_method_id: number
  name: string
  description?: string
  amount: number
  type: string
  provider_id?: string
  uuid: string

  created_at?: Date

  updated_at?: Date

}

export interface PaymentTransactionResponse {
  data: PaymentTransactionJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface PaymentTransactionJsonResponse extends Omit<Selectable<PaymentTransactionsTable>, 'password'> {
  [key: string]: any
}

export type NewPaymentTransaction = Insertable<PaymentTransactionsTable>
export type PaymentTransactionUpdate = Updateable<PaymentTransactionsTable>

      type SortDirection = 'asc' | 'desc'
interface SortOptions { column: PaymentTransactionJsonResponse, order: SortDirection }
// Define a type for the options parameter
interface QueryOptions {
  sort?: SortOptions
  limit?: number
  offset?: number
  page?: number
}

export class PaymentTransactionModel {
  private readonly hidden: Array<keyof PaymentTransactionJsonResponse> = []
  private readonly fillable: Array<keyof PaymentTransactionJsonResponse> = ['name', 'description', 'amount', 'type', 'provider_id', 'uuid', 'user_id', 'payment_method_id']
  private readonly guarded: Array<keyof PaymentTransactionJsonResponse> = []
  protected attributes = {} as PaymentTransactionJsonResponse
  protected originalAttributes = {} as PaymentTransactionJsonResponse

  protected selectFromQuery: any
  protected withRelations: string[]
  protected updateFromQuery: any
  protected deleteFromQuery: any
  protected hasSelect: boolean
  private hasSaved: boolean
  private customColumns: Record<string, unknown> = {}

  constructor(paymentTransaction: PaymentTransactionJsonResponse | undefined) {
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
    this.hasSaved = false
  }

  mapCustomGetters(models: PaymentTransactionJsonResponse | PaymentTransactionJsonResponse[]): void {
    const data = models

    if (Array.isArray(data)) {
      data.map((model: PaymentTransactionJsonResponse) => {
        const customGetter = {
          default: () => {
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

      }

      for (const [key, fn] of Object.entries(customGetter)) {
        model[key] = fn()
      }
    }
  }

  async mapCustomSetters(model: NewPaymentTransaction | PaymentTransactionUpdate): Promise<void> {
    const customSetter = {
      default: () => {
      },

    }

    for (const [key, fn] of Object.entries(customSetter)) {
      model[key] = await fn()
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

  get uuid(): string {
    return this.attributes.uuid
  }

  get name(): string {
    return this.attributes.name
  }

  get description(): string | undefined {
    return this.attributes.description
  }

  get amount(): number {
    return this.attributes.amount
  }

  get type(): string {
    return this.attributes.type
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

  set updated_at(value: Date) {
    this.attributes.updated_at = value
  }

  getOriginal(column?: keyof PaymentTransactionJsonResponse): Partial<PaymentTransactionJsonResponse> {
    if (column) {
      return this.originalAttributes[column]
    }

    return this.originalAttributes
  }

  getChanges(): Partial<PaymentTransactionJsonResponse> {
    return this.fillable.reduce<Partial<PaymentTransactionJsonResponse>>((changes, key) => {
      const currentValue = this.attributes[key as keyof PaymentTransactionsTable]
      const originalValue = this.originalAttributes[key as keyof PaymentTransactionsTable]

      if (currentValue !== originalValue) {
        changes[key] = currentValue
      }

      return changes
    }, {})
  }

  isDirty(column?: keyof PaymentTransactionJsonResponse): boolean {
    if (column) {
      return this.attributes[column] !== this.originalAttributes[column]
    }

    return Object.entries(this.originalAttributes).some(([key, originalValue]) => {
      const currentValue = (this.attributes as any)[key]

      return currentValue !== originalValue
    })
  }

  isClean(column?: keyof PaymentTransactionJsonResponse): boolean {
    return !this.isDirty(column)
  }

  wasChanged(column?: keyof PaymentTransactionJsonResponse): boolean {
    return this.hasSaved && this.isDirty(column)
  }

  select(params: (keyof PaymentTransactionJsonResponse)[] | RawBuilder<string> | string): PaymentTransactionModel {
    this.selectFromQuery = this.selectFromQuery.select(params)

    this.hasSelect = true

    return this
  }

  static select(params: (keyof PaymentTransactionJsonResponse)[] | RawBuilder<string> | string): PaymentTransactionModel {
    const instance = new PaymentTransactionModel(undefined)

    // Initialize a query with the table name and selected fields
    instance.selectFromQuery = instance.selectFromQuery.select(params)

    instance.hasSelect = true

    return instance
  }

  async applyFind(id: number): Promise<PaymentTransactionModel | undefined> {
    const model = await DB.instance.selectFrom('payment_transactions').where('id', '=', id).selectAll().executeTakeFirst()

    if (!model)
      return undefined

    this.mapCustomGetters(model)
    await this.loadRelations(model)

    const data = new PaymentTransactionModel(model)

    cache.getOrSet(`paymentTransaction:${id}`, JSON.stringify(model))

    return data
  }

  async find(id: number): Promise<PaymentTransactionModel | undefined> {
    return await this.applyFind(id)
  }

  // Method to find a PaymentTransaction by ID
  static async find(id: number): Promise<PaymentTransactionModel | undefined> {
    const instance = new PaymentTransactionModel(undefined)

    return await instance.applyFind(id)
  }

  async first(): Promise<PaymentTransactionModel | undefined> {
    let model: PaymentTransactionJsonResponse | undefined

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

    const data = new PaymentTransactionModel(model)

    return data
  }

  static async first(): Promise<PaymentTransactionModel | undefined> {
    const instance = new PaymentTransactionJsonResponse(null)

    const model = await DB.instance.selectFrom('payment_transactions')
      .selectAll()
      .executeTakeFirst()

    instance.mapCustomGetters(model)

    const data = new PaymentTransactionModel(model)

    return data
  }

  async applyFirstOrFail(): Promise<PaymentTransactionModel | undefined> {
    const model = await this.selectFromQuery.executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, 'No PaymentTransactionModel results found for query')

    if (model) {
      this.mapCustomGetters(model)
      await this.loadRelations(model)
    }

    const data = new PaymentTransactionModel(model)

    return data
  }

  async firstOrFail(): Promise<PaymentTransactionModel | undefined> {
    return await this.applyFirstOrFail()
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

  async applyFindOrFail(id: number): Promise<PaymentTransactionModel> {
    const model = await DB.instance.selectFrom('payment_transactions').where('id', '=', id).selectAll().executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, `No PaymentTransactionModel results for ${id}`)

    cache.getOrSet(`paymentTransaction:${id}`, JSON.stringify(model))

    this.mapCustomGetters(model)
    await this.loadRelations(model)

    const data = new PaymentTransactionModel(model)

    return data
  }

  async findOrFail(id: number): Promise<PaymentTransactionModel> {
    return await this.applyFindOrFail(id)
  }

  static async findOrFail(id: number): Promise<PaymentTransactionModel> {
    const instance = new PaymentTransactionModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  async applyFindMany(ids: number[]): Promise<PaymentTransactionModel[]> {
    let query = DB.instance.selectFrom('payment_transactions').where('id', 'in', ids)

    const instance = new PaymentTransactionModel(undefined)

    query = query.selectAll()

    const models = await query.execute()

    instance.mapCustomGetters(models)
    await instance.loadRelations(models)

    return models.map((modelItem: PaymentTransactionJsonResponse) => instance.parseResult(new PaymentTransactionModel(modelItem)))
  }

  static async findMany(ids: number[]): Promise<PaymentTransactionModel[]> {
    const instance = new PaymentTransactionModel(undefined)

    return await instance.applyFindMany(ids)
  }

  async findMany(ids: number[]): Promise<PaymentTransactionModel[]> {
    return await this.applyFindMany(ids)
  }

  skip(count: number): PaymentTransactionModel {
    this.selectFromQuery = this.selectFromQuery.offset(count)

    return this
  }

  static skip(count: number): PaymentTransactionModel {
    const instance = new PaymentTransactionModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.offset(count)

    return instance
  }

  async applyChunk(size: number, callback: (models: PaymentTransactionModel[]) => Promise<void>): Promise<void> {
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

  async chunk(size: number, callback: (models: PaymentTransactionModel[]) => Promise<void>): Promise<void> {
    await this.applyChunk(size, callback)
  }

  static async chunk(size: number, callback: (models: PaymentTransactionModel[]) => Promise<void>): Promise<void> {
    const instance = new PaymentTransactionModel(undefined)

    await instance.applyChunk(size, callback)
  }

  take(count: number): PaymentTransactionModel {
    this.selectFromQuery = this.selectFromQuery.limit(count)

    return this
  }

  static take(count: number): PaymentTransactionModel {
    const instance = new PaymentTransactionModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.limit(count)

    return instance
  }

  static async pluck<K extends keyof PaymentTransactionModel>(field: K): Promise<PaymentTransactionModel[K][]> {
    const instance = new PaymentTransactionModel(undefined)

    if (instance.hasSelect) {
      const model = await instance.selectFromQuery.execute()
      return model.map((modelItem: PaymentTransactionModel) => modelItem[field])
    }

    const model = await instance.selectFromQuery.selectAll().execute()

    return model.map((modelItem: PaymentTransactionModel) => modelItem[field])
  }

  async pluck<K extends keyof PaymentTransactionModel>(field: K): Promise<PaymentTransactionModel[K][]> {
    if (this.hasSelect) {
      const model = await this.selectFromQuery.execute()
      return model.map((modelItem: PaymentTransactionModel) => modelItem[field])
    }

    const model = await this.selectFromQuery.selectAll().execute()

    return model.map((modelItem: PaymentTransactionModel) => modelItem[field])
  }

  static async count(): Promise<number> {
    const instance = new PaymentTransactionModel(undefined)

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

  static async max(field: keyof PaymentTransactionModel): Promise<number> {
    const instance = new PaymentTransactionModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`MAX(${sql.raw(field as string)}) as max `)
      .executeTakeFirst()

    return result.max
  }

  async max(field: keyof PaymentTransactionModel): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`MAX(${sql.raw(field as string)}) as max`)
      .executeTakeFirst()

    return result.max
  }

  static async min(field: keyof PaymentTransactionModel): Promise<number> {
    const instance = new PaymentTransactionModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`MIN(${sql.raw(field as string)}) as min `)
      .executeTakeFirst()

    return result.min
  }

  async min(field: keyof PaymentTransactionModel): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`MIN(${sql.raw(field as string)}) as min `)
      .executeTakeFirst()

    return result.min
  }

  static async avg(field: keyof PaymentTransactionModel): Promise<number> {
    const instance = new PaymentTransactionModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`AVG(${sql.raw(field as string)}) as avg `)
      .executeTakeFirst()

    return result.avg
  }

  async avg(field: keyof PaymentTransactionModel): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`AVG(${sql.raw(field as string)}) as avg `)
      .executeTakeFirst()

    return result.avg
  }

  static async sum(field: keyof PaymentTransactionModel): Promise<number> {
    const instance = new PaymentTransactionModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`SUM(${sql.raw(field as string)}) as sum `)
      .executeTakeFirst()

    return result.sum
  }

  async sum(field: keyof PaymentTransactionModel): Promise<number> {
    const result = this.selectFromQuery
      .select(sql`SUM(${sql.raw(field as string)}) as sum `)
      .executeTakeFirst()

    return result.sum
  }

  async applyGet(): Promise<PaymentTransactionModel[]> {
    let models

    if (this.hasSelect) {
      models = await this.selectFromQuery.execute()
    }
    else {
      models = await this.selectFromQuery.selectAll().execute()
    }

    this.mapCustomGetters(models)
    await this.loadRelations(models)

    const data = await Promise.all(models.map(async (model: PaymentTransactionJsonResponse) => {
      return new PaymentTransactionModel(model)
    }))

    return data
  }

  async get(): Promise<PaymentTransactionModel[]> {
    return await this.applyGet()
  }

  static async get(): Promise<PaymentTransactionModel[]> {
    const instance = new PaymentTransactionModel(undefined)

    return await instance.applyGet()
  }

  has(relation: string): PaymentTransactionModel {
    this.selectFromQuery = this.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(
        selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.paymentTransaction_id`, '=', 'payment_transactions.id'),
      ),
    )

    return this
  }

  static has(relation: string): PaymentTransactionModel {
    const instance = new PaymentTransactionModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(
        selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.paymentTransaction_id`, '=', 'payment_transactions.id'),
      ),
    )

    return instance
  }

  static whereExists(callback: (qb: any) => any): PaymentTransactionModel {
    const instance = new PaymentTransactionModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(callback({ exists, selectFrom })),
    )

    return instance
  }

  applyWhereHas(
    relation: string,
    callback: (query: SubqueryBuilder<keyof PaymentTransactionModel>) => void,
  ): PaymentTransactionModel {
    const subqueryBuilder = new SubqueryBuilder()

    callback(subqueryBuilder)
    const conditions = subqueryBuilder.getConditions()

    this.selectFromQuery = this.selectFromQuery
      .where(({ exists, selectFrom }: any) => {
        let subquery = selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.paymentTransaction_id`, '=', 'payment_transactions.id')

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
    callback: (query: SubqueryBuilder<keyof PaymentTransactionModel>) => void,
  ): PaymentTransactionModel {
    return this.applyWhereHas(relation, callback)
  }

  static whereHas(
    relation: string,
    callback: (query: SubqueryBuilder<keyof PaymentTransactionModel>) => void,
  ): PaymentTransactionModel {
    const instance = new PaymentTransactionModel(undefined)

    return instance.applyWhereHas(relation, callback)
  }

  applyDoesntHave(relation: string): PaymentTransactionModel {
    this.selectFromQuery = this.selectFromQuery.where(({ not, exists, selectFrom }: any) =>
      not(
        exists(
          selectFrom(relation)
            .select('1')
            .whereRef(`${relation}.paymentTransaction_id`, '=', 'payment_transactions.id'),
        ),
      ),
    )

    return this
  }

  doesntHave(relation: string): PaymentTransactionModel {
    return this.applyDoesntHave(relation)
  }

  static doesntHave(relation: string): PaymentTransactionModel {
    const instance = new PaymentTransactionModel(undefined)

    return instance.applyDoesntHave(relation)
  }

  applyWhereDoesntHave(relation: string, callback: (query: SubqueryBuilder<PaymentTransactionsTable>) => void): PaymentTransactionModel {
    const subqueryBuilder = new SubqueryBuilder()

    callback(subqueryBuilder)
    const conditions = subqueryBuilder.getConditions()

    this.selectFromQuery = this.selectFromQuery
      .where(({ exists, selectFrom, not }: any) => {
        const subquery = selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.paymentTransaction_id`, '=', 'payment_transactions.id')

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

  whereDoesntHave(relation: string, callback: (query: SubqueryBuilder<PaymentTransactionsTable>) => void): PaymentTransactionModel {
    return this.applyWhereDoesntHave(relation, callback)
  }

  static whereDoesntHave(
    relation: string,
    callback: (query: SubqueryBuilder<PaymentTransactionsTable>) => void,
  ): PaymentTransactionModel {
    const instance = new PaymentTransactionModel(undefined)

    return instance.applyWhereDoesntHave(relation, callback)
  }

  async applyPaginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<PaymentTransactionResponse> {
    const totalRecordsResult = await DB.instance.selectFrom('payment_transactions')
      .select(DB.instance.fn.count('id').as('total')) // Use 'id' or another actual column name
      .executeTakeFirst()

    const totalRecords = Number(totalRecordsResult?.total) || 0
    const totalPages = Math.ceil(totalRecords / (options.limit ?? 10))

    const payment_transactionsWithExtra = await DB.instance.selectFrom('payment_transactions')
      .selectAll()
      .orderBy('id', 'asc') // Assuming 'id' is used for cursor-based pagination
      .limit((options.limit ?? 10) + 1) // Fetch one extra record
      .offset(((options.page ?? 1) - 1) * (options.limit ?? 10)) // Ensure options.page is not undefined
      .execute()

    let nextCursor = null
    if (payment_transactionsWithExtra.length > (options.limit ?? 10))
      nextCursor = payment_transactionsWithExtra.pop()?.id ?? null

    return {
      data: payment_transactionsWithExtra,
      paging: {
        total_records: totalRecords,
        page: options.page || 1,
        total_pages: totalPages,
      },
      next_cursor: nextCursor,
    }
  }

  async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<PaymentTransactionResponse> {
    return await this.applyPaginate(options)
  }

  // Method to get all payment_transactions
  static async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<PaymentTransactionResponse> {
    const instance = new PaymentTransactionModel(undefined)

    return await instance.applyPaginate(options)
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

    const model = await this.find(Number(result.numInsertedOrUpdatedRows)) as PaymentTransactionModel

    return model
  }

  async create(newPaymentTransaction: NewPaymentTransaction): Promise<PaymentTransactionModel> {
    return await this.applyCreate(newPaymentTransaction)
  }

  static async create(newPaymentTransaction: NewPaymentTransaction): Promise<PaymentTransactionModel> {
    const instance = new PaymentTransactionModel(undefined)

    return await instance.applyCreate(newPaymentTransaction)
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

    const model = await find(Number(result.numInsertedOrUpdatedRows)) as PaymentTransactionModel

    return model
  }

  // Method to remove a PaymentTransaction
  static async remove(id: number): Promise<any> {
    return await DB.instance.deleteFrom('payment_transactions')
      .where('id', '=', id)
      .execute()
  }

  applyWhere<V>(column: keyof PaymentTransactionsTable, ...args: [V] | [Operator, V]): PaymentTransactionModel {
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

  where<V = string>(column: keyof PaymentTransactionsTable, ...args: [V] | [Operator, V]): PaymentTransactionModel {
    return this.applyWhere<V>(column, ...args)
  }

  static where<V = string>(column: keyof PaymentTransactionsTable, ...args: [V] | [Operator, V]): PaymentTransactionModel {
    const instance = new PaymentTransactionModel(undefined)

    return instance.applyWhere<V>(column, ...args)
  }

  whereColumn(first: keyof PaymentTransactionsTable, operator: Operator, second: keyof PaymentTransactionsTable): PaymentTransactionModel {
    this.selectFromQuery = this.selectFromQuery.whereRef(first, operator, second)

    return this
  }

  static whereColumn(first: keyof PaymentTransactionsTable, operator: Operator, second: keyof PaymentTransactionsTable): PaymentTransactionModel {
    const instance = new PaymentTransactionModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.whereRef(first, operator, second)

    return instance
  }

  applyWhereRef(column: keyof PaymentTransactionsTable, ...args: string[]): PaymentTransactionModel {
    const [operatorOrValue, value] = args
    const operator = value === undefined ? '=' : operatorOrValue
    const actualValue = value === undefined ? operatorOrValue : value

    const instance = new PaymentTransactionModel(undefined)
    instance.selectFromQuery = instance.selectFromQuery.whereRef(column, operator, actualValue)

    return instance
  }

  whereRef(column: keyof PaymentTransactionsTable, ...args: string[]): PaymentTransactionModel {
    return this.applyWhereRef(column, ...args)
  }

  static whereRef(column: keyof PaymentTransactionsTable, ...args: string[]): PaymentTransactionModel {
    const instance = new PaymentTransactionModel(undefined)

    return instance.applyWhereRef(column, ...args)
  }

  whereRaw(sqlStatement: string): PaymentTransactionModel {
    this.selectFromQuery = this.selectFromQuery.where(sql`${sqlStatement}`)

    return this
  }

  static whereRaw(sqlStatement: string): PaymentTransactionModel {
    const instance = new PaymentTransactionModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where(sql`${sqlStatement}`)

    return instance
  }

  applyOrWhere(...conditions: [string, any][]): PaymentTransactionModel {
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

  orWhere(...conditions: [string, any][]): PaymentTransactionModel {
    return this.applyOrWhere(...conditions)
  }

  static orWhere(...conditions: [string, any][]): PaymentTransactionModel {
    const instance = new PaymentTransactionModel(undefined)

    return instance.applyOrWhere(...conditions)
  }

  when(
    condition: boolean,
    callback: (query: PaymentTransactionModel) => PaymentTransactionModel,
  ): PaymentTransactionModel {
    return PaymentTransactionModel.when(condition, callback)
  }

  static when(
    condition: boolean,
    callback: (query: PaymentTransactionModel) => PaymentTransactionModel,
  ): PaymentTransactionModel {
    let instance = new PaymentTransactionModel(undefined)

    if (condition)
      instance = callback(instance)

    return instance
  }

  whereNotNull(column: keyof PaymentTransactionsTable): PaymentTransactionModel {
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

  static whereNotNull(column: keyof PaymentTransactionsTable): PaymentTransactionModel {
    const instance = new PaymentTransactionModel(undefined)

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

  whereNull(column: keyof PaymentTransactionsTable): PaymentTransactionModel {
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

  static whereNull(column: keyof PaymentTransactionsTable): PaymentTransactionModel {
    const instance = new PaymentTransactionModel(undefined)

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

    instance.selectFromQuery = instance.selectFromQuery.where('providerId', '=', value)

    return instance
  }

  applyWhereIn<V>(column: keyof PaymentTransactionsTable, values: V[]) {
    this.selectFromQuery = this.selectFromQuery.where(column, 'in', values)

    this.updateFromQuery = this.updateFromQuery.where(column, 'in', values)

    this.deleteFromQuery = this.deleteFromQuery.where(column, 'in', values)

    return this
  }

  whereIn<V = number>(column: keyof PaymentTransactionsTable, values: V[]): PaymentTransactionModel {
    return this.applyWhereIn<V>(column, values)
  }

  static whereIn<V = number>(column: keyof PaymentTransactionsTable, values: V[]): PaymentTransactionModel {
    const instance = new PaymentTransactionModel(undefined)

    return instance.applyWhereIn<V>(column, values)
  }

  applyWhereBetween<V>(column: keyof PaymentTransactionsTable, range: [V, V]): PaymentTransactionModel {
    if (range.length !== 2) {
      throw new HttpError(500, 'Range must have exactly two values: [min, max]')
    }

    const query = sql` ${sql.raw(column as string)} between ${range[0]} and ${range[1]} `

    this.selectFromQuery = this.selectFromQuery.where(query)
    this.updateFromQuery = this.updateFromQuery.where(query)
    this.deleteFromQuery = this.deleteFromQuery.where(query)

    return this
  }

  whereBetween<V = number>(column: keyof PaymentTransactionsTable, range: [V, V]): PaymentTransactionModel {
    return this.applyWhereBetween<V>(column, range)
  }

  static whereBetween<V = number>(column: keyof PaymentTransactionsTable, range: [V, V]): PaymentTransactionModel {
    const instance = new PaymentTransactionModel(undefined)

    return instance.applyWhereBetween<V>(column, range)
  }

  applyWhereLike(column: keyof PaymentTransactionsTable, value: string): PaymentTransactionModel {
    this.selectFromQuery = this.selectFromQuery.where(sql` ${sql.raw(column as string)} LIKE ${value}`)

    this.updateFromQuery = this.updateFromQuery.where(sql` ${sql.raw(column as string)} LIKE ${value}`)

    this.deleteFromQuery = this.deleteFromQuery.where(sql` ${sql.raw(column as string)} LIKE ${value}`)

    return this
  }

  whereLike(column: keyof PaymentTransactionsTable, value: string): PaymentTransactionModel {
    return this.applyWhereLike(column, value)
  }

  static whereLike(column: keyof PaymentTransactionsTable, value: string): PaymentTransactionModel {
    const instance = new PaymentTransactionModel(undefined)

    return instance.applyWhereLike(column, value)
  }

  applyWhereNotIn<V>(column: keyof PaymentTransactionsTable, values: V[]): PaymentTransactionModel {
    this.selectFromQuery = this.selectFromQuery.where(column, 'not in', values)

    this.updateFromQuery = this.updateFromQuery.where(column, 'not in', values)

    this.deleteFromQuery = this.deleteFromQuery.where(column, 'not in', values)

    return this
  }

  whereNotIn<V>(column: keyof PaymentTransactionsTable, values: V[]): PaymentTransactionModel {
    return this.applyWhereNotIn<V>(column, values)
  }

  static whereNotIn<V = number>(column: keyof PaymentTransactionsTable, values: V[]): PaymentTransactionModel {
    const instance = new PaymentTransactionModel(undefined)

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

  static async latest(): Promise<PaymentTransactionModel | undefined> {
    const instance = new PaymentTransactionModel(undefined)

    const model = await DB.instance.selectFrom('payment_transactions')
      .selectAll()
      .orderBy('id', 'desc')
      .executeTakeFirst()

    if (!model)
      return undefined

    instance.mapCustomGetters(model)

    const data = new PaymentTransactionModel(model)

    return data
  }

  static async oldest(): Promise<PaymentTransactionModel | undefined> {
    const instance = new PaymentTransactionModel(undefined)

    const model = await DB.instance.selectFrom('payment_transactions')
      .selectAll()
      .orderBy('id', 'asc')
      .executeTakeFirst()

    if (!model)
      return undefined

    instance.mapCustomGetters(model)

    const data = new PaymentTransactionModel(model)

    return data
  }

  static async firstOrCreate(
    condition: Partial<PaymentTransactionJsonResponse>,
    newPaymentTransaction: NewPaymentTransaction,
  ): Promise<PaymentTransactionModel> {
    const instance = new PaymentTransactionModel(undefined)

    const key = Object.keys(condition)[0] as keyof PaymentTransactionJsonResponse

    if (!key) {
      throw new HttpError(500, 'Condition must contain at least one key-value pair')
    }

    const value = condition[key]

    // Attempt to find the first record matching the condition
    const existingPaymentTransaction = await DB.instance.selectFrom('payment_transactions')
      .selectAll()
      .where(key, '=', value)
      .executeTakeFirst()

    if (existingPaymentTransaction) {
      instance.mapCustomGetters(existingPaymentTransaction)
      await instance.loadRelations(existingPaymentTransaction)

      return new PaymentTransactionModel(existingPaymentTransaction as PaymentTransactionJsonResponse)
    }
    else {
      return await instance.create(newPaymentTransaction)
    }
  }

  static async updateOrCreate(
    condition: Partial<PaymentTransactionJsonResponse>,
    newPaymentTransaction: NewPaymentTransaction,
  ): Promise<PaymentTransactionModel> {
    const instance = new PaymentTransactionModel(undefined)

    const key = Object.keys(condition)[0] as keyof PaymentTransactionJsonResponse

    if (!key) {
      throw new HttpError(500, 'Condition must contain at least one key-value pair')
    }

    const value = condition[key]

    // Attempt to find the first record matching the condition
    const existingPaymentTransaction = await DB.instance.selectFrom('payment_transactions')
      .selectAll()
      .where(key, '=', value)
      .executeTakeFirst()

    if (existingPaymentTransaction) {
      // If found, update the existing record
      await DB.instance.updateTable('payment_transactions')
        .set(newPaymentTransaction)
        .where(key, '=', value)
        .executeTakeFirstOrThrow()

      // Fetch and return the updated record
      const updatedPaymentTransaction = await DB.instance.selectFrom('payment_transactions')
        .selectAll()
        .where(key, '=', value)
        .executeTakeFirst()

      if (!updatedPaymentTransaction) {
        throw new HttpError(500, 'Failed to fetch updated record')
      }

      instance.hasSaved = true

      return new PaymentTransactionModel(updatedPaymentTransaction as PaymentTransactionJsonResponse)
    }
    else {
      // If not found, create a new record
      return await instance.create(newPaymentTransaction)
    }
  }

  async loadRelations(models: PaymentTransactionJsonResponse | PaymentTransactionJsonResponse[]): Promise<void> {
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

  with(relations: string[]): PaymentTransactionModel {
    this.withRelations = relations

    return this
  }

  static with(relations: string[]): PaymentTransactionModel {
    const instance = new PaymentTransactionModel(undefined)

    instance.withRelations = relations

    return instance
  }

  async last(): Promise<PaymentTransactionModel | undefined> {
    let model: PaymentTransactionJsonResponse | undefined

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

    const data = new PaymentTransactionModel(model)

    return data
  }

  static async last(): Promise<PaymentTransactionModel | undefined> {
    const model = await DB.instance.selectFrom('payment_transactions').selectAll().orderBy('id', 'desc').executeTakeFirst()

    if (!model)
      return undefined

    const data = new PaymentTransactionModel(model)

    return data
  }

  orderBy(column: keyof PaymentTransactionsTable, order: 'asc' | 'desc'): PaymentTransactionModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, order)

    return this
  }

  static orderBy(column: keyof PaymentTransactionsTable, order: 'asc' | 'desc'): PaymentTransactionModel {
    const instance = new PaymentTransactionModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, order)

    return instance
  }

  groupBy(column: keyof PaymentTransactionsTable): PaymentTransactionModel {
    this.selectFromQuery = this.selectFromQuery.groupBy(column)

    return this
  }

  static groupBy(column: keyof PaymentTransactionsTable): PaymentTransactionModel {
    const instance = new PaymentTransactionModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.groupBy(column)

    return instance
  }

  having<V = string>(column: keyof PaymentTransactionsTable, operator: Operator, value: V): PaymentTransactionModel {
    this.selectFromQuery = this.selectFromQuery.having(column, operator, value)

    return this
  }

  static having<V = string>(column: keyof PaymentTransactionsTable, operator: Operator, value: V): PaymentTransactionModel {
    const instance = new PaymentTransactionModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.having(column, operator, value)

    return instance
  }

  inRandomOrder(): PaymentTransactionModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(sql` ${sql.raw('RANDOM()')} `)

    return this
  }

  static inRandomOrder(): PaymentTransactionModel {
    const instance = new PaymentTransactionModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(sql` ${sql.raw('RANDOM()')} `)

    return instance
  }

  orderByDesc(column: keyof PaymentTransactionsTable): PaymentTransactionModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, 'desc')

    return this
  }

  static orderByDesc(column: keyof PaymentTransactionsTable): PaymentTransactionModel {
    const instance = new PaymentTransactionModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, 'desc')

    return instance
  }

  orderByAsc(column: keyof PaymentTransactionsTable): PaymentTransactionModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, 'asc')

    return this
  }

  static orderByAsc(column: keyof PaymentTransactionsTable): PaymentTransactionModel {
    const instance = new PaymentTransactionModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, 'asc')

    return instance
  }

  async update(newPaymentTransaction: PaymentTransactionUpdate): Promise<PaymentTransactionModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newPaymentTransaction).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewPaymentTransaction

    await this.mapCustomSetters(filteredValues)

    await DB.instance.updateTable('payment_transactions')
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

  async forceUpdate(paymentTransaction: PaymentTransactionUpdate): Promise<PaymentTransactionModel | undefined> {
    if (this.id === undefined) {
      this.updateFromQuery.set(paymentTransaction).execute()
    }

    await this.mapCustomSetters(paymentTransaction)

    await DB.instance.updateTable('payment_transactions')
      .set(paymentTransaction)
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
      throw new HttpError(500, 'PaymentTransaction data is undefined')

    await this.mapCustomSetters(this.attributes)

    if (this.id === undefined) {
      await this.create(this.attributes)
    }
    else {
      await this.update(this.attributes)
    }

    this.hasSaved = true
  }

  fill(data: Partial<PaymentTransactionJsonResponse>): PaymentTransactionModel {
    const filteredValues = Object.fromEntries(
      Object.entries(data).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewPaymentTransaction

    this.attributes = {
      ...this.attributes,
      ...filteredValues,
    }

    return this
  }

  forceFill(data: Partial<PaymentTransactionJsonResponse>): PaymentTransactionModel {
    this.attributes = {
      ...this.attributes,
      ...data,
    }

    return this
  }

  // Method to delete (soft delete) the paymentTransaction instance
  async delete(): Promise<PaymentTransactionsTable> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()

    return await DB.instance.deleteFrom('payment_transactions')
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

  distinct(column: keyof PaymentTransactionJsonResponse): PaymentTransactionModel {
    this.selectFromQuery = this.selectFromQuery.select(column).distinct()

    this.hasSelect = true

    return this
  }

  static distinct(column: keyof PaymentTransactionJsonResponse): PaymentTransactionModel {
    const instance = new PaymentTransactionModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.select(column).distinct()

    instance.hasSelect = true

    return instance
  }

  join(table: string, firstCol: string, secondCol: string): PaymentTransactionModel {
    this.selectFromQuery = this.selectFromQuery.innerJoin(table, firstCol, secondCol)

    return this
  }

  static join(table: string, firstCol: string, secondCol: string): PaymentTransactionModel {
    const instance = new PaymentTransactionModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.innerJoin(table, firstCol, secondCol)

    return instance
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
}

async function find(id: number): Promise<PaymentTransactionModel | undefined> {
  const query = DB.instance.selectFrom('payment_transactions').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  return new PaymentTransactionModel(model)
}

export async function count(): Promise<number> {
  const results = await PaymentTransactionModel.count()

  return results
}

export async function create(newPaymentTransaction: NewPaymentTransaction): Promise<PaymentTransactionModel> {
  const result = await DB.instance.insertInto('payment_transactions')
    .values(newPaymentTransaction)
    .executeTakeFirstOrThrow()

  return await find(Number(result.numInsertedOrUpdatedRows)) as PaymentTransactionModel
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
