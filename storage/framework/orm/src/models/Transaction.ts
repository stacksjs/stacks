import type { Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import type { OrderModel } from './Order'
import { randomUUIDv7 } from 'bun'
import { cache } from '@stacksjs/cache'
import { sql } from '@stacksjs/database'
import { HttpError, ModelNotFoundException } from '@stacksjs/error-handling'
import { dispatch } from '@stacksjs/events'
import { DB, SubqueryBuilder } from '@stacksjs/orm'

import Order from './Order'

export interface TransactionsTable {
  id: number
  order_id?: number
  order?: OrderModel
  amount?: number
  status?: string
  payment_method?: string
  payment_details?: string
  transaction_reference?: string
  loyalty_points_earned?: number
  loyalty_points_redeemed?: number
  uuid?: string

  created_at?: Date

  updated_at?: Date

}

interface TransactionResponse {
  data: TransactionJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface TransactionJsonResponse extends Omit<TransactionsTable, 'password'> {
  [key: string]: any
}

export type TransactionType = Selectable<TransactionsTable>
export type NewTransaction = Partial<Insertable<TransactionsTable>>
export type TransactionUpdate = Updateable<TransactionsTable>

      type SortDirection = 'asc' | 'desc'
interface SortOptions { column: TransactionType, order: SortDirection }
// Define a type for the options parameter
interface QueryOptions {
  sort?: SortOptions
  limit?: number
  offset?: number
  page?: number
}

export class TransactionModel {
  private readonly hidden: Array<keyof TransactionJsonResponse> = ['payment_details']
  private readonly fillable: Array<keyof TransactionJsonResponse> = ['amount', 'status', 'payment_method', 'payment_details', 'transaction_reference', 'loyalty_points_earned', 'loyalty_points_redeemed', 'uuid']
  private readonly guarded: Array<keyof TransactionJsonResponse> = []
  protected attributes: Partial<TransactionJsonResponse> = {}
  protected originalAttributes: Partial<TransactionJsonResponse> = {}

  protected selectFromQuery: any
  protected withRelations: string[]
  protected updateFromQuery: any
  protected deleteFromQuery: any
  protected hasSelect: boolean
  private hasSaved: boolean
  private customColumns: Record<string, unknown> = {}

  constructor(transaction: TransactionJsonResponse | undefined) {
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
    this.hasSaved = false
  }

  mapCustomGetters(models: TransactionJsonResponse | TransactionJsonResponse[]): void {
    const data = models

    if (Array.isArray(data)) {
      data.map((model: TransactionJsonResponse) => {
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

  async mapCustomSetters(model: NewTransaction): Promise<void> {
    const customSetter = {
      default: () => {
      },

    }

    for (const [key, fn] of Object.entries(customSetter)) {
      model[key] = await fn()
    }
  }

  get order_id(): number | undefined {
    return this.attributes.order_id
  }

  get order(): OrderModel | undefined {
    return this.attributes.order
  }

  get id(): number | undefined {
    return this.attributes.id
  }

  get uuid(): string | undefined {
    return this.attributes.uuid
  }

  get amount(): number | undefined {
    return this.attributes.amount
  }

  get status(): string | undefined {
    return this.attributes.status
  }

  get payment_method(): string | undefined {
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

  get created_at(): Date | undefined {
    return this.attributes.created_at
  }

  get updated_at(): Date | undefined {
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

  set updated_at(value: Date) {
    this.attributes.updated_at = value
  }

  getOriginal(column?: keyof TransactionJsonResponse): Partial<TransactionJsonResponse> {
    if (column) {
      return this.originalAttributes[column]
    }

    return this.originalAttributes
  }

  getChanges(): Partial<TransactionJsonResponse> {
    return this.fillable.reduce<Partial<TransactionJsonResponse>>((changes, key) => {
      const currentValue = this.attributes[key as keyof TransactionsTable]
      const originalValue = this.originalAttributes[key as keyof TransactionsTable]

      if (currentValue !== originalValue) {
        changes[key] = currentValue
      }

      return changes
    }, {})
  }

  isDirty(column?: keyof TransactionType): boolean {
    if (column) {
      return this.attributes[column] !== this.originalAttributes[column]
    }

    return Object.entries(this.originalAttributes).some(([key, originalValue]) => {
      const currentValue = (this.attributes as any)[key]

      return currentValue !== originalValue
    })
  }

  isClean(column?: keyof TransactionType): boolean {
    return !this.isDirty(column)
  }

  wasChanged(column?: keyof TransactionType): boolean {
    return this.hasSaved && this.isDirty(column)
  }

  select(params: (keyof TransactionType)[] | RawBuilder<string> | string): TransactionModel {
    this.selectFromQuery = this.selectFromQuery.select(params)

    this.hasSelect = true

    return this
  }

  static select(params: (keyof TransactionType)[] | RawBuilder<string> | string): TransactionModel {
    const instance = new TransactionModel(undefined)

    // Initialize a query with the table name and selected fields
    instance.selectFromQuery = instance.selectFromQuery.select(params)

    instance.hasSelect = true

    return instance
  }

  async applyFind(id: number): Promise<TransactionModel | undefined> {
    const model = await DB.instance.selectFrom('transactions').where('id', '=', id).selectAll().executeTakeFirst()

    if (!model)
      return undefined

    this.mapCustomGetters(model)
    await this.loadRelations(model)

    const data = new TransactionModel(model)

    cache.getOrSet(`transaction:${id}`, JSON.stringify(model))

    return data
  }

  async find(id: number): Promise<TransactionModel | undefined> {
    return await this.applyFind(id)
  }

  // Method to find a Transaction by ID
  static async find(id: number): Promise<TransactionModel | undefined> {
    const instance = new TransactionModel(undefined)

    return await instance.applyFind(id)
  }

  async first(): Promise<TransactionModel | undefined> {
    let model: TransactionJsonResponse | undefined

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

    const data = new TransactionModel(model)

    return data
  }

  static async first(): Promise<TransactionModel | undefined> {
    const instance = new TransactionJsonResponse(null)

    const model = await DB.instance.selectFrom('transactions')
      .selectAll()
      .executeTakeFirst()

    instance.mapCustomGetters(model)

    const data = new TransactionModel(model)

    return data
  }

  async applyFirstOrFail(): Promise<TransactionModel | undefined> {
    const model = await this.selectFromQuery.executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, 'No TransactionModel results found for query')

    if (model) {
      this.mapCustomGetters(model)
      await this.loadRelations(model)
    }

    const data = new TransactionModel(model)

    return data
  }

  async firstOrFail(): Promise<TransactionModel | undefined> {
    return await this.applyFirstOrFail()
  }

  static async firstOrFail(): Promise<TransactionModel | undefined> {
    const instance = new TransactionModel(undefined)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<TransactionModel[]> {
    const instance = new TransactionModel(undefined)

    const models = await DB.instance.selectFrom('transactions').selectAll().execute()

    instance.mapCustomGetters(models)

    const data = await Promise.all(models.map(async (model: TransactionType) => {
      return new TransactionModel(model)
    }))

    return data
  }

  async applyFindOrFail(id: number): Promise<TransactionModel> {
    const model = await DB.instance.selectFrom('transactions').where('id', '=', id).selectAll().executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, `No TransactionModel results for ${id}`)

    cache.getOrSet(`transaction:${id}`, JSON.stringify(model))

    this.mapCustomGetters(model)
    await this.loadRelations(model)

    const data = new TransactionModel(model)

    return data
  }

  async findOrFail(id: number): Promise<TransactionModel> {
    return await this.applyFindOrFail(id)
  }

  static async findOrFail(id: number): Promise<TransactionModel> {
    const instance = new TransactionModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  async applyFindMany(ids: number[]): Promise<TransactionModel[]> {
    let query = DB.instance.selectFrom('transactions').where('id', 'in', ids)

    const instance = new TransactionModel(undefined)

    query = query.selectAll()

    const models = await query.execute()

    instance.mapCustomGetters(models)
    await instance.loadRelations(models)

    return models.map((modelItem: TransactionJsonResponse) => instance.parseResult(new TransactionModel(modelItem)))
  }

  static async findMany(ids: number[]): Promise<TransactionModel[]> {
    const instance = new TransactionModel(undefined)

    return await instance.applyFindMany(ids)
  }

  async findMany(ids: number[]): Promise<TransactionModel[]> {
    return await this.applyFindMany(ids)
  }

  skip(count: number): TransactionModel {
    this.selectFromQuery = this.selectFromQuery.offset(count)

    return this
  }

  static skip(count: number): TransactionModel {
    const instance = new TransactionModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.offset(count)

    return instance
  }

  async applyChunk(size: number, callback: (models: TransactionModel[]) => Promise<void>): Promise<void> {
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

  async chunk(size: number, callback: (models: TransactionModel[]) => Promise<void>): Promise<void> {
    await this.applyChunk(size, callback)
  }

  static async chunk(size: number, callback: (models: TransactionModel[]) => Promise<void>): Promise<void> {
    const instance = new TransactionModel(undefined)

    await instance.applyChunk(size, callback)
  }

  take(count: number): TransactionModel {
    this.selectFromQuery = this.selectFromQuery.limit(count)

    return this
  }

  static take(count: number): TransactionModel {
    const instance = new TransactionModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.limit(count)

    return instance
  }

  static async pluck<K extends keyof TransactionModel>(field: K): Promise<TransactionModel[K][]> {
    const instance = new TransactionModel(undefined)

    if (instance.hasSelect) {
      const model = await instance.selectFromQuery.execute()
      return model.map((modelItem: TransactionModel) => modelItem[field])
    }

    const model = await instance.selectFromQuery.selectAll().execute()

    return model.map((modelItem: TransactionModel) => modelItem[field])
  }

  async pluck<K extends keyof TransactionModel>(field: K): Promise<TransactionModel[K][]> {
    if (this.hasSelect) {
      const model = await this.selectFromQuery.execute()
      return model.map((modelItem: TransactionModel) => modelItem[field])
    }

    const model = await this.selectFromQuery.selectAll().execute()

    return model.map((modelItem: TransactionModel) => modelItem[field])
  }

  static async count(): Promise<number> {
    const instance = new TransactionModel(undefined)

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

  static async max(field: keyof TransactionModel): Promise<number> {
    const instance = new TransactionModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`MAX(${sql.raw(field as string)}) as max `)
      .executeTakeFirst()

    return result.max
  }

  async max(field: keyof TransactionModel): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`MAX(${sql.raw(field as string)}) as max`)
      .executeTakeFirst()

    return result.max
  }

  static async min(field: keyof TransactionModel): Promise<number> {
    const instance = new TransactionModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`MIN(${sql.raw(field as string)}) as min `)
      .executeTakeFirst()

    return result.min
  }

  async min(field: keyof TransactionModel): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`MIN(${sql.raw(field as string)}) as min `)
      .executeTakeFirst()

    return result.min
  }

  static async avg(field: keyof TransactionModel): Promise<number> {
    const instance = new TransactionModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`AVG(${sql.raw(field as string)}) as avg `)
      .executeTakeFirst()

    return result.avg
  }

  async avg(field: keyof TransactionModel): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`AVG(${sql.raw(field as string)}) as avg `)
      .executeTakeFirst()

    return result.avg
  }

  static async sum(field: keyof TransactionModel): Promise<number> {
    const instance = new TransactionModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`SUM(${sql.raw(field as string)}) as sum `)
      .executeTakeFirst()

    return result.sum
  }

  async sum(field: keyof TransactionModel): Promise<number> {
    const result = this.selectFromQuery
      .select(sql`SUM(${sql.raw(field as string)}) as sum `)
      .executeTakeFirst()

    return result.sum
  }

  async applyGet(): Promise<TransactionModel[]> {
    let models

    if (this.hasSelect) {
      models = await this.selectFromQuery.execute()
    }
    else {
      models = await this.selectFromQuery.selectAll().execute()
    }

    this.mapCustomGetters(models)
    await this.loadRelations(models)

    const data = await Promise.all(models.map(async (model: TransactionJsonResponse) => {
      return new TransactionModel(model)
    }))

    return data
  }

  async get(): Promise<TransactionModel[]> {
    return await this.applyGet()
  }

  static async get(): Promise<TransactionModel[]> {
    const instance = new TransactionModel(undefined)

    return await instance.applyGet()
  }

  has(relation: string): TransactionModel {
    this.selectFromQuery = this.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(
        selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.transaction_id`, '=', 'transactions.id'),
      ),
    )

    return this
  }

  static has(relation: string): TransactionModel {
    const instance = new TransactionModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(
        selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.transaction_id`, '=', 'transactions.id'),
      ),
    )

    return instance
  }

  static whereExists(callback: (qb: any) => any): TransactionModel {
    const instance = new TransactionModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(callback({ exists, selectFrom })),
    )

    return instance
  }

  applyWhereHas(
    relation: string,
    callback: (query: SubqueryBuilder<keyof TransactionModel>) => void,
  ): TransactionModel {
    const subqueryBuilder = new SubqueryBuilder()

    callback(subqueryBuilder)
    const conditions = subqueryBuilder.getConditions()

    this.selectFromQuery = this.selectFromQuery
      .where(({ exists, selectFrom }: any) => {
        let subquery = selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.transaction_id`, '=', 'transactions.id')

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
    callback: (query: SubqueryBuilder<keyof TransactionModel>) => void,
  ): TransactionModel {
    return this.applyWhereHas(relation, callback)
  }

  static whereHas(
    relation: string,
    callback: (query: SubqueryBuilder<keyof TransactionModel>) => void,
  ): TransactionModel {
    const instance = new TransactionModel(undefined)

    return instance.applyWhereHas(relation, callback)
  }

  applyDoesntHave(relation: string): TransactionModel {
    this.selectFromQuery = this.selectFromQuery.where(({ not, exists, selectFrom }: any) =>
      not(
        exists(
          selectFrom(relation)
            .select('1')
            .whereRef(`${relation}.transaction_id`, '=', 'transactions.id'),
        ),
      ),
    )

    return this
  }

  doesntHave(relation: string): TransactionModel {
    return this.applyDoesntHave(relation)
  }

  static doesntHave(relation: string): TransactionModel {
    const instance = new TransactionModel(undefined)

    return instance.applyDoesntHave(relation)
  }

  applyWhereDoesntHave(relation: string, callback: (query: SubqueryBuilder<TransactionsTable>) => void): TransactionModel {
    const subqueryBuilder = new SubqueryBuilder()

    callback(subqueryBuilder)
    const conditions = subqueryBuilder.getConditions()

    this.selectFromQuery = this.selectFromQuery
      .where(({ exists, selectFrom, not }: any) => {
        const subquery = selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.transaction_id`, '=', 'transactions.id')

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

  whereDoesntHave(relation: string, callback: (query: SubqueryBuilder<TransactionsTable>) => void): TransactionModel {
    return this.applyWhereDoesntHave(relation, callback)
  }

  static whereDoesntHave(
    relation: string,
    callback: (query: SubqueryBuilder<TransactionsTable>) => void,
  ): TransactionModel {
    const instance = new TransactionModel(undefined)

    return instance.applyWhereDoesntHave(relation, callback)
  }

  async applyPaginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<TransactionResponse> {
    const totalRecordsResult = await DB.instance.selectFrom('transactions')
      .select(DB.instance.fn.count('id').as('total')) // Use 'id' or another actual column name
      .executeTakeFirst()

    const totalRecords = Number(totalRecordsResult?.total) || 0
    const totalPages = Math.ceil(totalRecords / (options.limit ?? 10))

    const transactionsWithExtra = await DB.instance.selectFrom('transactions')
      .selectAll()
      .orderBy('id', 'asc') // Assuming 'id' is used for cursor-based pagination
      .limit((options.limit ?? 10) + 1) // Fetch one extra record
      .offset(((options.page ?? 1) - 1) * (options.limit ?? 10)) // Ensure options.page is not undefined
      .execute()

    let nextCursor = null
    if (transactionsWithExtra.length > (options.limit ?? 10))
      nextCursor = transactionsWithExtra.pop()?.id ?? null

    return {
      data: transactionsWithExtra,
      paging: {
        total_records: totalRecords,
        page: options.page || 1,
        total_pages: totalPages,
      },
      next_cursor: nextCursor,
    }
  }

  async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<TransactionResponse> {
    return await this.applyPaginate(options)
  }

  // Method to get all transactions
  static async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<TransactionResponse> {
    const instance = new TransactionModel(undefined)

    return await instance.applyPaginate(options)
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

    const model = await this.find(Number(result.numInsertedOrUpdatedRows)) as TransactionModel

    if (model)
      dispatch('transaction:created', model)

    return model
  }

  async create(newTransaction: NewTransaction): Promise<TransactionModel> {
    return await this.applyCreate(newTransaction)
  }

  static async create(newTransaction: NewTransaction): Promise<TransactionModel> {
    const instance = new TransactionModel(undefined)

    return await instance.applyCreate(newTransaction)
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

    const model = await find(Number(result.numInsertedOrUpdatedRows)) as TransactionModel

    if (model)
      dispatch('transaction:created', model)

    return model
  }

  // Method to remove a Transaction
  static async remove(id: number): Promise<any> {
    const instance = new TransactionModel(undefined)

    const model = await instance.find(Number(id))

    if (model)
      dispatch('transaction:deleted', model)

    return await DB.instance.deleteFrom('transactions')
      .where('id', '=', id)
      .execute()
  }

  applyWhere<V>(column: keyof TransactionsTable, ...args: [V] | [Operator, V]): TransactionModel {
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

  where<V = string>(column: keyof TransactionsTable, ...args: [V] | [Operator, V]): TransactionModel {
    return this.applyWhere<V>(column, ...args)
  }

  static where<V = string>(column: keyof TransactionsTable, ...args: [V] | [Operator, V]): TransactionModel {
    const instance = new TransactionModel(undefined)

    return instance.applyWhere<V>(column, ...args)
  }

  whereColumn(first: keyof TransactionsTable, operator: Operator, second: keyof TransactionsTable): TransactionModel {
    this.selectFromQuery = this.selectFromQuery.whereRef(first, operator, second)

    return this
  }

  static whereColumn(first: keyof TransactionsTable, operator: Operator, second: keyof TransactionsTable): TransactionModel {
    const instance = new TransactionModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.whereRef(first, operator, second)

    return instance
  }

  applyWhereRef(column: keyof TransactionsTable, ...args: string[]): TransactionModel {
    const [operatorOrValue, value] = args
    const operator = value === undefined ? '=' : operatorOrValue
    const actualValue = value === undefined ? operatorOrValue : value

    const instance = new TransactionModel(undefined)
    instance.selectFromQuery = instance.selectFromQuery.whereRef(column, operator, actualValue)

    return instance
  }

  whereRef(column: keyof TransactionsTable, ...args: string[]): TransactionModel {
    return this.applyWhereRef(column, ...args)
  }

  static whereRef(column: keyof TransactionsTable, ...args: string[]): TransactionModel {
    const instance = new TransactionModel(undefined)

    return instance.applyWhereRef(column, ...args)
  }

  whereRaw(sqlStatement: string): TransactionModel {
    this.selectFromQuery = this.selectFromQuery.where(sql`${sqlStatement}`)

    return this
  }

  static whereRaw(sqlStatement: string): TransactionModel {
    const instance = new TransactionModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where(sql`${sqlStatement}`)

    return instance
  }

  applyOrWhere(...conditions: [string, any][]): TransactionModel {
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

  orWhere(...conditions: [string, any][]): TransactionModel {
    return this.applyOrWhere(...conditions)
  }

  static orWhere(...conditions: [string, any][]): TransactionModel {
    const instance = new TransactionModel(undefined)

    return instance.applyOrWhere(...conditions)
  }

  when(
    condition: boolean,
    callback: (query: TransactionModel) => TransactionModel,
  ): TransactionModel {
    return TransactionModel.when(condition, callback)
  }

  static when(
    condition: boolean,
    callback: (query: TransactionModel) => TransactionModel,
  ): TransactionModel {
    let instance = new TransactionModel(undefined)

    if (condition)
      instance = callback(instance)

    return instance
  }

  whereNotNull(column: keyof TransactionsTable): TransactionModel {
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

  static whereNotNull(column: keyof TransactionsTable): TransactionModel {
    const instance = new TransactionModel(undefined)

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

  whereNull(column: keyof TransactionsTable): TransactionModel {
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

  static whereNull(column: keyof TransactionsTable): TransactionModel {
    const instance = new TransactionModel(undefined)

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

  applyWhereIn<V>(column: keyof TransactionsTable, values: V[]) {
    this.selectFromQuery = this.selectFromQuery.where(column, 'in', values)

    this.updateFromQuery = this.updateFromQuery.where(column, 'in', values)

    this.deleteFromQuery = this.deleteFromQuery.where(column, 'in', values)

    return this
  }

  whereIn<V = number>(column: keyof TransactionsTable, values: V[]): TransactionModel {
    return this.applyWhereIn<V>(column, values)
  }

  static whereIn<V = number>(column: keyof TransactionsTable, values: V[]): TransactionModel {
    const instance = new TransactionModel(undefined)

    return instance.applyWhereIn<V>(column, values)
  }

  applyWhereBetween<V>(column: keyof TransactionsTable, range: [V, V]): TransactionModel {
    if (range.length !== 2) {
      throw new HttpError(500, 'Range must have exactly two values: [min, max]')
    }

    const query = sql` ${sql.raw(column as string)} between ${range[0]} and ${range[1]} `

    this.selectFromQuery = this.selectFromQuery.where(query)
    this.updateFromQuery = this.updateFromQuery.where(query)
    this.deleteFromQuery = this.deleteFromQuery.where(query)

    return this
  }

  whereBetween<V = number>(column: keyof TransactionsTable, range: [V, V]): TransactionModel {
    return this.applyWhereBetween<V>(column, range)
  }

  static whereBetween<V = number>(column: keyof TransactionsTable, range: [V, V]): TransactionModel {
    const instance = new TransactionModel(undefined)

    return instance.applyWhereBetween<V>(column, range)
  }

  applyWhereLike(column: keyof TransactionsTable, value: string): TransactionModel {
    this.selectFromQuery = this.selectFromQuery.where(sql` ${sql.raw(column as string)} LIKE ${value}`)

    this.updateFromQuery = this.updateFromQuery.where(sql` ${sql.raw(column as string)} LIKE ${value}`)

    this.deleteFromQuery = this.deleteFromQuery.where(sql` ${sql.raw(column as string)} LIKE ${value}`)

    return this
  }

  whereLike(column: keyof TransactionsTable, value: string): TransactionModel {
    return this.applyWhereLike(column, value)
  }

  static whereLike(column: keyof TransactionsTable, value: string): TransactionModel {
    const instance = new TransactionModel(undefined)

    return instance.applyWhereLike(column, value)
  }

  applyWhereNotIn<V>(column: keyof TransactionsTable, values: V[]): TransactionModel {
    this.selectFromQuery = this.selectFromQuery.where(column, 'not in', values)

    this.updateFromQuery = this.updateFromQuery.where(column, 'not in', values)

    this.deleteFromQuery = this.deleteFromQuery.where(column, 'not in', values)

    return this
  }

  whereNotIn<V>(column: keyof TransactionsTable, values: V[]): TransactionModel {
    return this.applyWhereNotIn<V>(column, values)
  }

  static whereNotIn<V = number>(column: keyof TransactionsTable, values: V[]): TransactionModel {
    const instance = new TransactionModel(undefined)

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

  static async latest(): Promise<TransactionModel | undefined> {
    const instance = new TransactionModel(undefined)

    const model = await DB.instance.selectFrom('transactions')
      .selectAll()
      .orderBy('id', 'desc')
      .executeTakeFirst()

    if (!model)
      return undefined

    instance.mapCustomGetters(model)

    const data = new TransactionModel(model)

    return data
  }

  static async oldest(): Promise<TransactionModel | undefined> {
    const instance = new TransactionModel(undefined)

    const model = await DB.instance.selectFrom('transactions')
      .selectAll()
      .orderBy('id', 'asc')
      .executeTakeFirst()

    if (!model)
      return undefined

    instance.mapCustomGetters(model)

    const data = new TransactionModel(model)

    return data
  }

  static async firstOrCreate(
    condition: Partial<TransactionType>,
    newTransaction: NewTransaction,
  ): Promise<TransactionModel> {
    const instance = new TransactionModel(undefined)

    const key = Object.keys(condition)[0] as keyof TransactionType

    if (!key) {
      throw new HttpError(500, 'Condition must contain at least one key-value pair')
    }

    const value = condition[key]

    // Attempt to find the first record matching the condition
    const existingTransaction = await DB.instance.selectFrom('transactions')
      .selectAll()
      .where(key, '=', value)
      .executeTakeFirst()

    if (existingTransaction) {
      instance.mapCustomGetters(existingTransaction)
      await instance.loadRelations(existingTransaction)

      return new TransactionModel(existingTransaction as TransactionType)
    }
    else {
      return await instance.create(newTransaction)
    }
  }

  static async updateOrCreate(
    condition: Partial<TransactionType>,
    newTransaction: NewTransaction,
  ): Promise<TransactionModel> {
    const instance = new TransactionModel(undefined)

    const key = Object.keys(condition)[0] as keyof TransactionType

    if (!key) {
      throw new HttpError(500, 'Condition must contain at least one key-value pair')
    }

    const value = condition[key]

    // Attempt to find the first record matching the condition
    const existingTransaction = await DB.instance.selectFrom('transactions')
      .selectAll()
      .where(key, '=', value)
      .executeTakeFirst()

    if (existingTransaction) {
      // If found, update the existing record
      await DB.instance.updateTable('transactions')
        .set(newTransaction)
        .where(key, '=', value)
        .executeTakeFirstOrThrow()

      // Fetch and return the updated record
      const updatedTransaction = await DB.instance.selectFrom('transactions')
        .selectAll()
        .where(key, '=', value)
        .executeTakeFirst()

      if (!updatedTransaction) {
        throw new HttpError(500, 'Failed to fetch updated record')
      }

      instance.hasSaved = true

      return new TransactionModel(updatedTransaction as TransactionType)
    }
    else {
      // If not found, create a new record
      return await instance.create(newTransaction)
    }
  }

  async loadRelations(models: TransactionJsonResponse | TransactionJsonResponse[]): Promise<void> {
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

  with(relations: string[]): TransactionModel {
    this.withRelations = relations

    return this
  }

  static with(relations: string[]): TransactionModel {
    const instance = new TransactionModel(undefined)

    instance.withRelations = relations

    return instance
  }

  async last(): Promise<TransactionModel | undefined> {
    let model: TransactionJsonResponse | undefined

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

    const data = new TransactionModel(model)

    return data
  }

  static async last(): Promise<TransactionModel | undefined> {
    const model = await DB.instance.selectFrom('transactions').selectAll().orderBy('id', 'desc').executeTakeFirst()

    if (!model)
      return undefined

    const data = new TransactionModel(model)

    return data
  }

  orderBy(column: keyof TransactionsTable, order: 'asc' | 'desc'): TransactionModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, order)

    return this
  }

  static orderBy(column: keyof TransactionsTable, order: 'asc' | 'desc'): TransactionModel {
    const instance = new TransactionModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, order)

    return instance
  }

  groupBy(column: keyof TransactionsTable): TransactionModel {
    this.selectFromQuery = this.selectFromQuery.groupBy(column)

    return this
  }

  static groupBy(column: keyof TransactionsTable): TransactionModel {
    const instance = new TransactionModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.groupBy(column)

    return instance
  }

  having<V = string>(column: keyof TransactionsTable, operator: Operator, value: V): TransactionModel {
    this.selectFromQuery = this.selectFromQuery.having(column, operator, value)

    return this
  }

  static having<V = string>(column: keyof TransactionsTable, operator: Operator, value: V): TransactionModel {
    const instance = new TransactionModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.having(column, operator, value)

    return instance
  }

  inRandomOrder(): TransactionModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(sql` ${sql.raw('RANDOM()')} `)

    return this
  }

  static inRandomOrder(): TransactionModel {
    const instance = new TransactionModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(sql` ${sql.raw('RANDOM()')} `)

    return instance
  }

  orderByDesc(column: keyof TransactionsTable): TransactionModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, 'desc')

    return this
  }

  static orderByDesc(column: keyof TransactionsTable): TransactionModel {
    const instance = new TransactionModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, 'desc')

    return instance
  }

  orderByAsc(column: keyof TransactionsTable): TransactionModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, 'asc')

    return this
  }

  static orderByAsc(column: keyof TransactionsTable): TransactionModel {
    const instance = new TransactionModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, 'asc')

    return instance
  }

  async update(newTransaction: TransactionUpdate): Promise<TransactionModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newTransaction).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewTransaction

    await this.mapCustomSetters(filteredValues)

    await DB.instance.updateTable('transactions')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      const model = await this.find(this.id)

      if (model)
        dispatch('transaction:updated', model)

      return model
    }

    this.hasSaved = true

    return undefined
  }

  async forceUpdate(transaction: TransactionUpdate): Promise<TransactionModel | undefined> {
    if (this.id === undefined) {
      this.updateFromQuery.set(transaction).execute()
    }

    await this.mapCustomSetters(transaction)

    await DB.instance.updateTable('transactions')
      .set(transaction)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      const model = await this.find(this.id)

      if (model)
        dispatch('transaction:updated', model)

      this.hasSaved = true

      return model
    }

    return undefined
  }

  async save(): Promise<void> {
    if (!this)
      throw new HttpError(500, 'Transaction data is undefined')

    await this.mapCustomSetters(this.attributes)

    if (this.id === undefined) {
      await this.create(this.attributes)
    }
    else {
      await this.update(this.attributes)
    }

    this.hasSaved = true
  }

  fill(data: Partial<TransactionType>): TransactionModel {
    const filteredValues = Object.fromEntries(
      Object.entries(data).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewTransaction

    this.attributes = {
      ...this.attributes,
      ...filteredValues,
    }

    return this
  }

  forceFill(data: Partial<TransactionType>): TransactionModel {
    this.attributes = {
      ...this.attributes,
      ...data,
    }

    return this
  }

  // Method to delete (soft delete) the transaction instance
  async delete(): Promise<TransactionsTable> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()
    const model = await this.find(Number(this.id))
    if (model)
      dispatch('transaction:deleted', model)

    return await DB.instance.deleteFrom('transactions')
      .where('id', '=', this.id)
      .execute()
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

  toSearchableObject(): Partial<TransactionsTable> {
    return {
      id: this.id,
      order_id: this.order_id,
      amount: this.amount,
      status: this.status,
      payment_method: this.payment_method,
      created_at: this.created_at,
    }
  }

  distinct(column: keyof TransactionType): TransactionModel {
    this.selectFromQuery = this.selectFromQuery.select(column).distinct()

    this.hasSelect = true

    return this
  }

  static distinct(column: keyof TransactionType): TransactionModel {
    const instance = new TransactionModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.select(column).distinct()

    instance.hasSelect = true

    return instance
  }

  join(table: string, firstCol: string, secondCol: string): TransactionModel {
    this.selectFromQuery = this.selectFromQuery.innerJoin(table, firstCol, secondCol)

    return this
  }

  static join(table: string, firstCol: string, secondCol: string): TransactionModel {
    const instance = new TransactionModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.innerJoin(table, firstCol, secondCol)

    return instance
  }

  toJSON(): Partial<TransactionJsonResponse> {
    const output: Partial<TransactionJsonResponse> = {

      id: this.id,
      amount: this.amount,
      status: this.status,
      payment_method: this.payment_method,
      payment_details: this.payment_details,
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
}

async function find(id: number): Promise<TransactionModel | undefined> {
  const query = DB.instance.selectFrom('transactions').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  return new TransactionModel(model)
}

export async function count(): Promise<number> {
  const results = await TransactionModel.count()

  return results
}

export async function create(newTransaction: NewTransaction): Promise<TransactionModel> {
  const result = await DB.instance.insertInto('transactions')
    .values(newTransaction)
    .executeTakeFirstOrThrow()

  return await find(Number(result.numInsertedOrUpdatedRows)) as TransactionModel
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
  const results = await query.execute()

  return results.map((modelItem: TransactionModel) => new TransactionModel(modelItem))
}

export async function whereStatus(value: string): Promise<TransactionModel[]> {
  const query = DB.instance.selectFrom('transactions').where('status', '=', value)
  const results = await query.execute()

  return results.map((modelItem: TransactionModel) => new TransactionModel(modelItem))
}

export async function wherePaymentMethod(value: string): Promise<TransactionModel[]> {
  const query = DB.instance.selectFrom('transactions').where('payment_method', '=', value)
  const results = await query.execute()

  return results.map((modelItem: TransactionModel) => new TransactionModel(modelItem))
}

export async function wherePaymentDetails(value: string): Promise<TransactionModel[]> {
  const query = DB.instance.selectFrom('transactions').where('payment_details', '=', value)
  const results = await query.execute()

  return results.map((modelItem: TransactionModel) => new TransactionModel(modelItem))
}

export async function whereTransactionReference(value: string): Promise<TransactionModel[]> {
  const query = DB.instance.selectFrom('transactions').where('transaction_reference', '=', value)
  const results = await query.execute()

  return results.map((modelItem: TransactionModel) => new TransactionModel(modelItem))
}

export async function whereLoyaltyPointsEarned(value: number): Promise<TransactionModel[]> {
  const query = DB.instance.selectFrom('transactions').where('loyalty_points_earned', '=', value)
  const results = await query.execute()

  return results.map((modelItem: TransactionModel) => new TransactionModel(modelItem))
}

export async function whereLoyaltyPointsRedeemed(value: number): Promise<TransactionModel[]> {
  const query = DB.instance.selectFrom('transactions').where('loyalty_points_redeemed', '=', value)
  const results = await query.execute()

  return results.map((modelItem: TransactionModel) => new TransactionModel(modelItem))
}

export const Transaction = TransactionModel

export default Transaction
