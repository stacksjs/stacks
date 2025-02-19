import type { Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { PaymentMethodModel } from './PaymentMethod'
import type { UserModel } from './User'
import { randomUUIDv7 } from 'bun'
import { cache } from '@stacksjs/cache'
import { sql } from '@stacksjs/database'
import { HttpError, ModelNotFoundException } from '@stacksjs/error-handling'

import { DB, SubqueryBuilder } from '@stacksjs/orm'

import PaymentMethod from './PaymentMethod'

import User from './User'

export interface TransactionsTable {
  id?: number
  user_id?: number
  user?: UserModel
  payment_method_id?: number
  payment_method?: PaymentMethodModel
  name?: string
  description?: string
  amount?: number
  type?: string
  provider_id?: string
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
  private readonly hidden: Array<keyof TransactionJsonResponse> = []
  private readonly fillable: Array<keyof TransactionJsonResponse> = ['name', 'description', 'amount', 'type', 'provider_id', 'uuid', 'user_id', 'payment_method_id']
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

  constructor(transaction: Partial<TransactionType> | null) {
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

  async mapCustomSetters(model: TransactionJsonResponse): Promise<void> {
    const customSetter = {
      default: () => {
      },

    }

    for (const [key, fn] of Object.entries(customSetter)) {
      model[key] = await fn()
    }
  }

  get user_id(): number | undefined {
    return this.attributes.user_id
  }

  get user(): UserModel | undefined {
    return this.attributes.user
  }

  get payment_method_id(): number | undefined {
    return this.attributes.payment_method_id
  }

  get payment_method(): PaymentMethodModel | undefined {
    return this.attributes.payment_method
  }

  get id(): number | undefined {
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
    const instance = new TransactionModel(null)

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

    const data = new TransactionModel(model as TransactionType)

    cache.getOrSet(`transaction:${id}`, JSON.stringify(model))

    return data
  }

  async find(id: number): Promise<TransactionModel | undefined> {
    return await this.applyFind(id)
  }

  // Method to find a Transaction by ID
  static async find(id: number): Promise<TransactionModel | undefined> {
    const instance = new TransactionModel(null)

    return await instance.applyFind(id)
  }

  async first(): Promise<TransactionModel | undefined> {
    let model: TransactionModel | undefined

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

    const data = new TransactionModel(model as TransactionType)

    return data
  }

  static async first(): Promise<TransactionModel | undefined> {
    const instance = new TransactionModel(null)

    const model = await DB.instance.selectFrom('transactions')
      .selectAll()
      .executeTakeFirst()

    instance.mapCustomGetters(model)

    const data = new TransactionModel(model as TransactionType)

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

    const data = new TransactionModel(model as TransactionType)

    return data
  }

  async firstOrFail(): Promise<TransactionModel | undefined> {
    return await this.applyFirstOrFail()
  }

  static async firstOrFail(): Promise<TransactionModel | undefined> {
    const instance = new TransactionModel(null)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<TransactionModel[]> {
    const instance = new TransactionModel(null)

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

    const data = new TransactionModel(model as TransactionType)

    return data
  }

  async findOrFail(id: number): Promise<TransactionModel> {
    return await this.applyFindOrFail(id)
  }

  static async findOrFail(id: number): Promise<TransactionModel> {
    const instance = new TransactionModel(null)

    return await instance.applyFindOrFail(id)
  }

  async applyFindMany(ids: number[]): Promise<TransactionModel[]> {
    let query = DB.instance.selectFrom('transactions').where('id', 'in', ids)

    const instance = new TransactionModel(null)

    query = query.selectAll()

    const models = await query.execute()

    instance.mapCustomGetters(models)
    await instance.loadRelations(models)

    return models.map((modelItem: TransactionModel) => instance.parseResult(new TransactionModel(modelItem)))
  }

  static async findMany(ids: number[]): Promise<TransactionModel[]> {
    const instance = new TransactionModel(null)

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
    const instance = new TransactionModel(null)

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
    const instance = new TransactionModel(null)

    await instance.applyChunk(size, callback)
  }

  take(count: number): TransactionModel {
    this.selectFromQuery = this.selectFromQuery.limit(count)

    return this
  }

  static take(count: number): TransactionModel {
    const instance = new TransactionModel(null)

    instance.selectFromQuery = instance.selectFromQuery.limit(count)

    return instance
  }

  static async pluck<K extends keyof TransactionModel>(field: K): Promise<TransactionModel[K][]> {
    const instance = new TransactionModel(null)

    if (instance.hasSelect) {
      const model = await instance.selectFromQuery.execute()
      return model.map((modelItem: TransactionModel) => modelItem[field])
    }

    const model = await instance.selectFromQuery.selectAll().execute()

    return model.map((modelItem: TransactionModel) => modelItem[field])
  }

  async pluck<K extends keyof TransactionModel>(field: K): Promise<TransactionModel[K][]> {
    return TransactionModel.pluck(field)
  }

  static async count(): Promise<number> {
    const instance = new TransactionModel(null)

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
    const instance = new TransactionModel(null)

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
    const instance = new TransactionModel(null)

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
    const instance = new TransactionModel(null)

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
    const instance = new TransactionModel(null)

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

    const data = await Promise.all(models.map(async (model: TransactionModel) => {
      return new TransactionModel(model)
    }))

    return data
  }

  async get(): Promise<TransactionModel[]> {
    return await this.applyGet()
  }

  static async get(): Promise<TransactionModel[]> {
    const instance = new TransactionModel(null)

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
    const instance = new TransactionModel(null)

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
    const instance = new TransactionModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(callback({ exists, selectFrom })),
    )

    return instance
  }

  applyWhereHas(
    relation: string,
    callback: (query: SubqueryBuilder) => void,
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

    return this
  }

  whereHas(
    relation: string,
    callback: (query: SubqueryBuilder) => void,
  ): TransactionModel {
    return this.applyWhereHas(relation, callback)
  }

  static whereHas(
    relation: string,
    callback: (query: SubqueryBuilder) => void,
  ): TransactionModel {
    const instance = new TransactionModel(null)

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
    const instance = new TransactionModel(null)

    return instance.applyDoesntHave(relation)
  }

  applyWhereDoesntHave(relation: string, callback: (query: SubqueryBuilder) => void): TransactionModel {
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
            this.where(condition.column, condition.operator!, condition.value)
          }
          break

        case 'whereIn':
          if (condition.operator === 'not') {
            this.whereNotIn(condition.column, condition.values!)
          }
          else {
            this.whereIn(condition.column, condition.values!)
          }

          break

        case 'whereNull':
          this.whereNull(condition.column)
          break

        case 'whereNotNull':
          this.whereNotNull(condition.column)
          break

        case 'whereBetween':
          this.whereBetween(condition.column, condition.values!)
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

  whereDoesntHave(relation: string, callback: (query: SubqueryBuilder) => void): TransactionModel {
    return this.applyWhereDoesntHave(relation, callback)
  }

  static whereDoesntHave(
    relation: string,
    callback: (query: SubqueryBuilder) => void,
  ): TransactionModel {
    const instance = new TransactionModel(null)

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
    const instance = new TransactionModel(null)

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

    return model
  }

  async create(newTransaction: NewTransaction): Promise<TransactionModel> {
    return await this.applyCreate(newTransaction)
  }

  static async create(newTransaction: NewTransaction): Promise<TransactionModel> {
    const instance = new TransactionModel(null)

    return await instance.applyCreate(newTransaction)
  }

  static async createMany(newTransaction: NewTransaction[]): Promise<void> {
    const instance = new TransactionModel(null)

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

    return model
  }

  // Method to remove a Transaction
  static async remove(id: number): Promise<any> {
    return await DB.instance.deleteFrom('transactions')
      .where('id', '=', id)
      .execute()
  }

  applyWhere(instance: TransactionModel, column: keyof TransactionsTable, ...args: any[]): TransactionModel {
    const [operatorOrValue, value] = args
    const operator = value === undefined ? '=' : operatorOrValue
    const actualValue = value === undefined ? operatorOrValue : value

    instance.selectFromQuery = instance.selectFromQuery.where(column, operator, actualValue)
    instance.updateFromQuery = instance.updateFromQuery.where(column, operator, actualValue)
    instance.deleteFromQuery = instance.deleteFromQuery.where(column, operator, actualValue)

    return instance
  }

  where(column: keyof TransactionsTable, ...args: any[]): TransactionModel {
    return this.applyWhere(this, column, ...args)
  }

  static where(column: keyof TransactionsTable, ...args: any[]): TransactionModel {
    const instance = new TransactionModel(null)

    return instance.applyWhere(instance, column, ...args)
  }

  whereColumn(first: keyof TransactionsTable, operator: string, second: keyof TransactionsTable): TransactionModel {
    this.selectFromQuery = this.selectFromQuery.whereRef(first, operator, second)

    return this
  }

  static whereColumn(first: keyof TransactionsTable, operator: string, second: keyof TransactionsTable): TransactionModel {
    const instance = new TransactionModel(null)

    instance.selectFromQuery = instance.selectFromQuery.whereRef(first, operator, second)

    return instance
  }

  applyWhereRef(column: keyof TransactionsTable, ...args: string[]): TransactionModel {
    const [operatorOrValue, value] = args
    const operator = value === undefined ? '=' : operatorOrValue
    const actualValue = value === undefined ? operatorOrValue : value

    const instance = new TransactionModel(null)
    instance.selectFromQuery = instance.selectFromQuery.whereRef(column, operator, actualValue)

    return instance
  }

  whereRef(column: keyof TransactionsTable, ...args: string[]): TransactionModel {
    return this.applyWhereRef(column, ...args)
  }

  static whereRef(column: keyof TransactionsTable, ...args: string[]): TransactionModel {
    const instance = new TransactionModel(null)

    return instance.applyWhereRef(column, ...args)
  }

  whereRaw(sqlStatement: string): TransactionModel {
    this.selectFromQuery = this.selectFromQuery.where(sql`${sqlStatement}`)

    return this
  }

  static whereRaw(sqlStatement: string): TransactionModel {
    const instance = new TransactionModel(null)

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
    const instance = new TransactionModel(null)

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
    let instance = new TransactionModel(null)

    if (condition)
      instance = callback(instance)

    return instance
  }

  whereNotNull(column: keyof TransactionsTable): TransactionModel {
    this.selectFromQuery = this.selectFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'not', null),
    )

    this.updateFromQuery = this.updateFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'not', null),
    )

    this.deleteFromQuery = this.deleteFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'not', null),
    )

    return this
  }

  static whereNotNull(column: keyof TransactionsTable): TransactionModel {
    const instance = new TransactionModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'not', null),
    )

    instance.updateFromQuery = instance.updateFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'not', null),
    )

    instance.deleteFromQuery = instance.deleteFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'not', null),
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
    const instance = new TransactionModel(null)

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

  static whereName(value: string): TransactionModel {
    const instance = new TransactionModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('name', '=', value)

    return instance
  }

  static whereDescription(value: string): TransactionModel {
    const instance = new TransactionModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('description', '=', value)

    return instance
  }

  static whereAmount(value: string): TransactionModel {
    const instance = new TransactionModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('amount', '=', value)

    return instance
  }

  static whereType(value: string): TransactionModel {
    const instance = new TransactionModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('type', '=', value)

    return instance
  }

  static whereProviderId(value: string): TransactionModel {
    const instance = new TransactionModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('providerId', '=', value)

    return instance
  }

  whereIn(column: keyof TransactionsTable, values: any[]): TransactionModel {
    return TransactionModel.whereIn(column, values)
  }

  static whereIn(column: keyof TransactionsTable, values: any[]): TransactionModel {
    const instance = new TransactionModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where(column, 'in', values)

    instance.updateFromQuery = instance.updateFromQuery.where(column, 'in', values)

    instance.deleteFromQuery = instance.deleteFromQuery.where(column, 'in', values)

    return instance
  }

  applyWhereBetween(column: keyof TransactionsTable, range: [any, any]): TransactionModel {
    if (range.length !== 2) {
      throw new HttpError(500, 'Range must have exactly two values: [min, max]')
    }

    const query = sql` ${sql.raw(column as string)} between ${range[0]} and ${range[1]} `

    this.selectFromQuery = this.selectFromQuery.where(query)
    this.updateFromQuery = this.updateFromQuery.where(query)
    this.deleteFromQuery = this.deleteFromQuery.where(query)

    return this
  }

  whereBetween(column: keyof TransactionsTable, range: [any, any]): TransactionModel {
    return this.applyWhereBetween(column, range)
  }

  static whereBetween(column: keyof TransactionsTable, range: [any, any]): TransactionModel {
    const instance = new TransactionModel(null)

    return instance.applyWhereBetween(column, range)
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
    const instance = new TransactionModel(null)

    return instance.applyWhereLike(column, value)
  }

  applyWhereNotIn(column: keyof TransactionsTable, values: any[]): TransactionModel {
    this.selectFromQuery = this.selectFromQuery.where(column, 'not in', values)

    this.updateFromQuery = this.updateFromQuery.where(column, 'not in', values)

    this.deleteFromQuery = this.deleteFromQuery.where(column, 'not in', values)

    return this
  }

  whereNotIn(column: keyof TransactionsTable, values: any[]): TransactionModel {
    return this.applyWhereNotIn(column, values)
  }

  static whereNotIn(column: keyof TransactionsTable, values: any[]): TransactionModel {
    const instance = new TransactionModel(null)

    return instance.applyWhereNotIn(column, values)
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

  static async latest(): Promise<TransactionType | undefined> {
    const instance = new TransactionModel(null)

    const model = await DB.instance.selectFrom('transactions')
      .selectAll()
      .orderBy('id', 'desc')
      .executeTakeFirst()

    if (!model)
      return undefined

    instance.mapCustomGetters(model)

    const data = new TransactionModel(model as TransactionType)

    return data
  }

  static async oldest(): Promise<TransactionType | undefined> {
    const instance = new TransactionModel(null)

    const model = await DB.instance.selectFrom('transactions')
      .selectAll()
      .orderBy('id', 'asc')
      .executeTakeFirst()

    if (!model)
      return undefined

    instance.mapCustomGetters(model)

    const data = new TransactionModel(model as TransactionType)

    return data
  }

  static async firstOrCreate(
    condition: Partial<TransactionType>,
    newTransaction: NewTransaction,
  ): Promise<TransactionModel> {
    const instance = new TransactionModel(null)

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
    const instance = new TransactionModel(null)

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
    const instance = new TransactionModel(null)

    instance.withRelations = relations

    return instance
  }

  async last(): Promise<TransactionType | undefined> {
    let model: TransactionModel | undefined

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

    const data = new TransactionModel(model as TransactionType)

    return data
  }

  static async last(): Promise<TransactionType | undefined> {
    const model = await DB.instance.selectFrom('transactions').selectAll().orderBy('id', 'desc').executeTakeFirst()

    if (!model)
      return undefined

    const data = new TransactionModel(model as TransactionType)

    return data
  }

  orderBy(column: keyof TransactionsTable, order: 'asc' | 'desc'): TransactionModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, order)

    return this
  }

  static orderBy(column: keyof TransactionsTable, order: 'asc' | 'desc'): TransactionModel {
    const instance = new TransactionModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, order)

    return instance
  }

  groupBy(column: keyof TransactionsTable): TransactionModel {
    this.selectFromQuery = this.selectFromQuery.groupBy(column)

    return this
  }

  static groupBy(column: keyof TransactionsTable): TransactionModel {
    const instance = new TransactionModel(null)

    instance.selectFromQuery = instance.selectFromQuery.groupBy(column)

    return instance
  }

  having(column: keyof TransactionsTable, operator: string, value: any): TransactionModel {
    this.selectFromQuery = this.selectFromQuery.having(column, operator, value)

    return this
  }

  static having(column: keyof TransactionsTable, operator: string, value: any): TransactionModel {
    const instance = new TransactionModel(null)

    instance.selectFromQuery = instance.selectFromQuery.having(column, operator, value)

    return instance
  }

  inRandomOrder(): TransactionModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(sql` ${sql.raw('RANDOM()')} `)

    return this
  }

  static inRandomOrder(): TransactionModel {
    const instance = new TransactionModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(sql` ${sql.raw('RANDOM()')} `)

    return instance
  }

  orderByDesc(column: keyof TransactionsTable): TransactionModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, 'desc')

    return this
  }

  static orderByDesc(column: keyof TransactionsTable): TransactionModel {
    const instance = new TransactionModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, 'desc')

    return instance
  }

  orderByAsc(column: keyof TransactionsTable): TransactionModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, 'asc')

    return this
  }

  static orderByAsc(column: keyof TransactionsTable): TransactionModel {
    const instance = new TransactionModel(null)

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
  async delete(): Promise<any> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()

    return await DB.instance.deleteFrom('transactions')
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

  distinct(column: keyof TransactionType): TransactionModel {
    this.selectFromQuery = this.selectFromQuery.select(column).distinct()

    this.hasSelect = true

    return this
  }

  static distinct(column: keyof TransactionType): TransactionModel {
    const instance = new TransactionModel(null)

    instance.selectFromQuery = instance.selectFromQuery.select(column).distinct()

    instance.hasSelect = true

    return instance
  }

  join(table: string, firstCol: string, secondCol: string): TransactionModel {
    this.selectFromQuery = this.selectFromQuery.innerJoin(table, firstCol, secondCol)

    return this
  }

  static join(table: string, firstCol: string, secondCol: string): TransactionModel {
    const instance = new TransactionModel(null)

    instance.selectFromQuery = instance.selectFromQuery.innerJoin(table, firstCol, secondCol)

    return instance
  }

  toJSON(): Partial<TransactionJsonResponse> {
    const output: Partial<TransactionJsonResponse> = {

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

export async function whereName(value: string): Promise<TransactionModel[]> {
  const query = DB.instance.selectFrom('transactions').where('name', '=', value)
  const results = await query.execute()

  return results.map((modelItem: TransactionModel) => new TransactionModel(modelItem))
}

export async function whereDescription(value: string): Promise<TransactionModel[]> {
  const query = DB.instance.selectFrom('transactions').where('description', '=', value)
  const results = await query.execute()

  return results.map((modelItem: TransactionModel) => new TransactionModel(modelItem))
}

export async function whereAmount(value: number): Promise<TransactionModel[]> {
  const query = DB.instance.selectFrom('transactions').where('amount', '=', value)
  const results = await query.execute()

  return results.map((modelItem: TransactionModel) => new TransactionModel(modelItem))
}

export async function whereType(value: string): Promise<TransactionModel[]> {
  const query = DB.instance.selectFrom('transactions').where('type', '=', value)
  const results = await query.execute()

  return results.map((modelItem: TransactionModel) => new TransactionModel(modelItem))
}

export async function whereProviderId(value: string): Promise<TransactionModel[]> {
  const query = DB.instance.selectFrom('transactions').where('provider_id', '=', value)
  const results = await query.execute()

  return results.map((modelItem: TransactionModel) => new TransactionModel(modelItem))
}

export const Transaction = TransactionModel

export default Transaction
