import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { OrderModel } from './Order'
import { randomUUIDv7 } from 'bun'
import { cache } from '@stacksjs/cache'
import { sql } from '@stacksjs/database'
import { HttpError, ModelNotFoundException } from '@stacksjs/error-handling'
import { dispatch } from '@stacksjs/events'
import { BaseOrm, DB, SubqueryBuilder } from '@stacksjs/orm'

import Order from './Order'

export interface TransactionsTable {
  id: Generated<number>
  order_id: number
  amount: number
  status: string
  payment_method: string
  payment_details?: string
  transaction_reference?: string
  loyalty_points_earned?: number
  loyalty_points_redeemed?: number
  uuid?: string

  created_at?: Date

  updated_at?: Date

}

export interface TransactionResponse {
  data: TransactionJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface TransactionJsonResponse extends Omit<Selectable<TransactionsTable>, 'password'> {
  [key: string]: any
}

export type NewTransaction = Insertable<TransactionsTable>
export type TransactionUpdate = Updateable<TransactionsTable>

      type SortDirection = 'asc' | 'desc'
interface SortOptions { column: TransactionJsonResponse, order: SortDirection }
// Define a type for the options parameter
interface QueryOptions {
  sort?: SortOptions
  limit?: number
  offset?: number
  page?: number
}

export class TransactionModel extends BaseOrm<TransactionModel, TransactionsTable, TransactionJsonResponse> {
  private readonly hidden: Array<keyof TransactionJsonResponse> = ['payment_details']
  private readonly fillable: Array<keyof TransactionJsonResponse> = ['amount', 'status', 'payment_method', 'payment_details', 'transaction_reference', 'loyalty_points_earned', 'loyalty_points_redeemed', 'uuid']
  private readonly guarded: Array<keyof TransactionJsonResponse> = []
  protected attributes = {} as TransactionJsonResponse
  protected originalAttributes = {} as TransactionJsonResponse

  protected selectFromQuery: any
  protected updateFromQuery: any
  protected deleteFromQuery: any
  protected hasSelect: boolean
  private hasSaved: boolean
  private customColumns: Record<string, unknown> = {}

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
    this.hasSaved = false
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

  async mapCustomSetters(model: NewTransaction | TransactionUpdate): Promise<void> {
    const customSetter = {
      default: () => {
      },

    }

    for (const [key, fn] of Object.entries(customSetter)) {
      model[key] = await fn()
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

  isDirty(column?: keyof TransactionJsonResponse): boolean {
    if (column) {
      return this.attributes[column] !== this.originalAttributes[column]
    }

    return Object.entries(this.originalAttributes).some(([key, originalValue]) => {
      const currentValue = (this.attributes as any)[key]

      return currentValue !== originalValue
    })
  }

  isClean(column?: keyof TransactionJsonResponse): boolean {
    return !this.isDirty(column)
  }

  wasChanged(column?: keyof TransactionJsonResponse): boolean {
    return this.hasSaved && this.isDirty(column)
  }

  static select(params: (keyof TransactionJsonResponse)[] | RawBuilder<string> | string): TransactionModel {
    const instance = new TransactionModel(undefined)

    return instance.applySelect(params)
  }

  // Method to find a Transaction by ID
  static async find(id: number): Promise<TransactionModel | undefined> {
    const instance = new TransactionModel(undefined)

    return await instance.applyFind(id)
  }

  async first(): Promise<TransactionModel | undefined> {
    const model = await this.applyFirst()

    const data = new TransactionModel(model)

    return data
  }

  static async first(): Promise<TransactionModel | undefined> {
    const instance = new TransactionModel(undefined)

    const model = await instance.applyFirst()

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

    const data = await Promise.all(models.map(async (model: TransactionJsonResponse) => {
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

  static async findMany(ids: number[]): Promise<TransactionModel[]> {
    const instance = new TransactionModel(undefined)

    const models = await instance.applyFindMany(ids)

    return models.map((modelItem: UserJsonResponse) => instance.parseResult(new TransactionModel(modelItem)))
  }

  async findMany(ids: number[]): Promise<TransactionModel[]> {
    const models = await this.applyFindMany(ids)

    return models.map((modelItem: UserJsonResponse) => this.parseResult(new TransactionModel(modelItem)))
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

  static take(count: number): TransactionModel {
    const instance = new TransactionModel(undefined)

    return instance.applyTake(count)
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

    return instance.applyCount()
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

  distinct(column: keyof TransactionJsonResponse): TransactionModel {
    return this.applyDistinct(column)
  }

  static distinct(column: keyof TransactionJsonResponse): TransactionModel {
    const instance = new TransactionModel(undefined)

    return instance.applyDistinct(column)
  }

  join(table: string, firstCol: string, secondCol: string): TransactionModel {
    return this.applyJoin(table, firstCol, secondCol)
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
