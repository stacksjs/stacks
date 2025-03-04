import type { Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import type { PaymentTransactionModel } from './PaymentTransaction'
import type { UserModel } from './User'
import { randomUUIDv7 } from 'bun'
import { cache } from '@stacksjs/cache'
import { sql } from '@stacksjs/database'
import { HttpError, ModelNotFoundException } from '@stacksjs/error-handling'

import { DB, SubqueryBuilder } from '@stacksjs/orm'

import User from './User'

export interface PaymentMethodsTable {
  id?: number
  payment_transactions?: PaymentTransactionModel[] | undefined
  user_id?: number
  user?: UserModel
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
  protected attributes: Partial<PaymentMethodJsonResponse> = {}
  protected originalAttributes: Partial<PaymentMethodJsonResponse> = {}

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

  mapCustomGetters(models: PaymentMethodJsonResponse | PaymentMethodJsonResponse[]): void {
    const data = models

    if (Array.isArray(data)) {
      data.map((model: PaymentMethodJsonResponse) => {
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

  async mapCustomSetters(model: PaymentMethodJsonResponse): Promise<void> {
    const customSetter = {
      default: () => {
      },

    }

    for (const [key, fn] of Object.entries(customSetter)) {
      model[key] = await fn()
    }
  }

  get payment_transactions(): PaymentTransactionModel[] | undefined {
    return this.attributes.payment_transactions
  }

  get user_id(): number | undefined {
    return this.attributes.user_id
  }

  get user(): UserModel | undefined {
    return this.attributes.user
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

  getOriginal(column?: keyof PaymentMethodJsonResponse): Partial<PaymentMethodJsonResponse> {
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

  isClean(column?: keyof PaymentMethodType): boolean {
    return !this.isDirty(column)
  }

  wasChanged(column?: keyof PaymentMethodType): boolean {
    return this.hasSaved && this.isDirty(column)
  }

  select(params: (keyof PaymentMethodType)[] | RawBuilder<string> | string): PaymentMethodModel {
    this.selectFromQuery = this.selectFromQuery.select(params)

    this.hasSelect = true

    return this
  }

  static select(params: (keyof PaymentMethodType)[] | RawBuilder<string> | string): PaymentMethodModel {
    const instance = new PaymentMethodModel(null)

    // Initialize a query with the table name and selected fields
    instance.selectFromQuery = instance.selectFromQuery.select(params)

    instance.hasSelect = true

    return instance
  }

  async applyFind(id: number): Promise<PaymentMethodModel | undefined> {
    const model = await DB.instance.selectFrom('payment_methods').where('id', '=', id).selectAll().executeTakeFirst()

    if (!model)
      return undefined

    this.mapCustomGetters(model)
    await this.loadRelations(model)

    const data = new PaymentMethodModel(model as PaymentMethodType)

    cache.getOrSet(`paymentmethod:${id}`, JSON.stringify(model))

    return data
  }

  async find(id: number): Promise<PaymentMethodModel | undefined> {
    return await this.applyFind(id)
  }

  // Method to find a PaymentMethod by ID
  static async find(id: number): Promise<PaymentMethodModel | undefined> {
    const instance = new PaymentMethodModel(null)

    return await instance.applyFind(id)
  }

  async first(): Promise<PaymentMethodModel | undefined> {
    let model: PaymentMethodModel | undefined

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

    const data = new PaymentMethodModel(model as PaymentMethodType)

    return data
  }

  static async first(): Promise<PaymentMethodModel | undefined> {
    const instance = new PaymentMethodModel(null)

    const model = await DB.instance.selectFrom('payment_methods')
      .selectAll()
      .executeTakeFirst()

    instance.mapCustomGetters(model)

    const data = new PaymentMethodModel(model as PaymentMethodType)

    return data
  }

  async applyFirstOrFail(): Promise<PaymentMethodModel | undefined> {
    const model = await this.selectFromQuery.executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, 'No PaymentMethodModel results found for query')

    if (model) {
      this.mapCustomGetters(model)
      await this.loadRelations(model)
    }

    const data = new PaymentMethodModel(model as PaymentMethodType)

    return data
  }

  async firstOrFail(): Promise<PaymentMethodModel | undefined> {
    return await this.applyFirstOrFail()
  }

  static async firstOrFail(): Promise<PaymentMethodModel | undefined> {
    const instance = new PaymentMethodModel(null)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<PaymentMethodModel[]> {
    const instance = new PaymentMethodModel(null)

    const models = await DB.instance.selectFrom('payment_methods').selectAll().execute()

    instance.mapCustomGetters(models)

    const data = await Promise.all(models.map(async (model: PaymentMethodType) => {
      return new PaymentMethodModel(model)
    }))

    return data
  }

  async applyFindOrFail(id: number): Promise<PaymentMethodModel> {
    const model = await DB.instance.selectFrom('payment_methods').where('id', '=', id).selectAll().executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, `No PaymentMethodModel results for ${id}`)

    cache.getOrSet(`paymentmethod:${id}`, JSON.stringify(model))

    this.mapCustomGetters(model)
    await this.loadRelations(model)

    const data = new PaymentMethodModel(model as PaymentMethodType)

    return data
  }

  async findOrFail(id: number): Promise<PaymentMethodModel> {
    return await this.applyFindOrFail(id)
  }

  static async findOrFail(id: number): Promise<PaymentMethodModel> {
    const instance = new PaymentMethodModel(null)

    return await instance.applyFindOrFail(id)
  }

  async applyFindMany(ids: number[]): Promise<PaymentMethodModel[]> {
    let query = DB.instance.selectFrom('payment_methods').where('id', 'in', ids)

    const instance = new PaymentMethodModel(null)

    query = query.selectAll()

    const models = await query.execute()

    instance.mapCustomGetters(models)
    await instance.loadRelations(models)

    return models.map((modelItem: PaymentMethodModel) => instance.parseResult(new PaymentMethodModel(modelItem)))
  }

  static async findMany(ids: number[]): Promise<PaymentMethodModel[]> {
    const instance = new PaymentMethodModel(null)

    return await instance.applyFindMany(ids)
  }

  async findMany(ids: number[]): Promise<PaymentMethodModel[]> {
    return await this.applyFindMany(ids)
  }

  skip(count: number): PaymentMethodModel {
    this.selectFromQuery = this.selectFromQuery.offset(count)

    return this
  }

  static skip(count: number): PaymentMethodModel {
    const instance = new PaymentMethodModel(null)

    instance.selectFromQuery = instance.selectFromQuery.offset(count)

    return instance
  }

  async applyChunk(size: number, callback: (models: PaymentMethodModel[]) => Promise<void>): Promise<void> {
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

  async chunk(size: number, callback: (models: PaymentMethodModel[]) => Promise<void>): Promise<void> {
    await this.applyChunk(size, callback)
  }

  static async chunk(size: number, callback: (models: PaymentMethodModel[]) => Promise<void>): Promise<void> {
    const instance = new PaymentMethodModel(null)

    await instance.applyChunk(size, callback)
  }

  take(count: number): PaymentMethodModel {
    this.selectFromQuery = this.selectFromQuery.limit(count)

    return this
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

  static async max(field: keyof PaymentMethodModel): Promise<number> {
    const instance = new PaymentMethodModel(null)

    const result = await instance.selectFromQuery
      .select(sql`MAX(${sql.raw(field as string)}) as max `)
      .executeTakeFirst()

    return result.max
  }

  async max(field: keyof PaymentMethodModel): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`MAX(${sql.raw(field as string)}) as max`)
      .executeTakeFirst()

    return result.max
  }

  static async min(field: keyof PaymentMethodModel): Promise<number> {
    const instance = new PaymentMethodModel(null)

    const result = await instance.selectFromQuery
      .select(sql`MIN(${sql.raw(field as string)}) as min `)
      .executeTakeFirst()

    return result.min
  }

  async min(field: keyof PaymentMethodModel): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`MIN(${sql.raw(field as string)}) as min `)
      .executeTakeFirst()

    return result.min
  }

  static async avg(field: keyof PaymentMethodModel): Promise<number> {
    const instance = new PaymentMethodModel(null)

    const result = await instance.selectFromQuery
      .select(sql`AVG(${sql.raw(field as string)}) as avg `)
      .executeTakeFirst()

    return result.avg
  }

  async avg(field: keyof PaymentMethodModel): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`AVG(${sql.raw(field as string)}) as avg `)
      .executeTakeFirst()

    return result.avg
  }

  static async sum(field: keyof PaymentMethodModel): Promise<number> {
    const instance = new PaymentMethodModel(null)

    const result = await instance.selectFromQuery
      .select(sql`SUM(${sql.raw(field as string)}) as sum `)
      .executeTakeFirst()

    return result.sum
  }

  async sum(field: keyof PaymentMethodModel): Promise<number> {
    const result = this.selectFromQuery
      .select(sql`SUM(${sql.raw(field as string)}) as sum `)
      .executeTakeFirst()

    return result.sum
  }

  async applyGet(): Promise<PaymentMethodModel[]> {
    let models

    if (this.hasSelect) {
      models = await this.selectFromQuery.execute()
    }
    else {
      models = await this.selectFromQuery.selectAll().execute()
    }

    this.mapCustomGetters(models)
    await this.loadRelations(models)

    const data = await Promise.all(models.map(async (model: PaymentMethodModel) => {
      return new PaymentMethodModel(model)
    }))

    return data
  }

  async get(): Promise<PaymentMethodModel[]> {
    return await this.applyGet()
  }

  static async get(): Promise<PaymentMethodModel[]> {
    const instance = new PaymentMethodModel(null)

    return await instance.applyGet()
  }

  has(relation: string): PaymentMethodModel {
    this.selectFromQuery = this.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(
        selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.paymentmethod_id`, '=', 'payment_methods.id'),
      ),
    )

    return this
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

  applyWhereHas(
    relation: string,
    callback: (query: SubqueryBuilder<keyof PaymentMethodModel>) => void,
  ): PaymentMethodModel {
    const subqueryBuilder = new SubqueryBuilder()

    callback(subqueryBuilder)
    const conditions = subqueryBuilder.getConditions()

    this.selectFromQuery = this.selectFromQuery
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
    callback: (query: SubqueryBuilder<keyof PaymentMethodModel>) => void,
  ): PaymentMethodModel {
    return this.applyWhereHas(relation, callback)
  }

  static whereHas(
    relation: string,
    callback: (query: SubqueryBuilder<keyof PaymentMethodModel>) => void,
  ): PaymentMethodModel {
    const instance = new PaymentMethodModel(null)

    return instance.applyWhereHas(relation, callback)
  }

  applyDoesntHave(relation: string): PaymentMethodModel {
    this.selectFromQuery = this.selectFromQuery.where(({ not, exists, selectFrom }: any) =>
      not(
        exists(
          selectFrom(relation)
            .select('1')
            .whereRef(`${relation}.paymentmethod_id`, '=', 'payment_methods.id'),
        ),
      ),
    )

    return this
  }

  doesntHave(relation: string): PaymentMethodModel {
    return this.applyDoesntHave(relation)
  }

  static doesntHave(relation: string): PaymentMethodModel {
    const instance = new PaymentMethodModel(null)

    return instance.applyDoesntHave(relation)
  }

  applyWhereDoesntHave(relation: string, callback: (query: SubqueryBuilder<PaymentMethodsTable>) => void): PaymentMethodModel {
    const subqueryBuilder = new SubqueryBuilder()

    callback(subqueryBuilder)
    const conditions = subqueryBuilder.getConditions()

    this.selectFromQuery = this.selectFromQuery
      .where(({ exists, selectFrom, not }: any) => {
        const subquery = selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.paymentmethod_id`, '=', 'payment_methods.id')

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

  whereDoesntHave(relation: string, callback: (query: SubqueryBuilder<PaymentMethodsTable>) => void): PaymentMethodModel {
    return this.applyWhereDoesntHave(relation, callback)
  }

  static whereDoesntHave(
    relation: string,
    callback: (query: SubqueryBuilder<PaymentMethodsTable>) => void,
  ): PaymentMethodModel {
    const instance = new PaymentMethodModel(null)

    return instance.applyWhereDoesntHave(relation, callback)
  }

  async applyPaginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<PaymentMethodResponse> {
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

  async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<PaymentMethodResponse> {
    return await this.applyPaginate(options)
  }

  // Method to get all payment_methods
  static async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<PaymentMethodResponse> {
    const instance = new PaymentMethodModel(null)

    return await instance.applyPaginate(options)
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

    const model = await this.find(Number(result.numInsertedOrUpdatedRows)) as PaymentMethodModel

    return model
  }

  async create(newPaymentMethod: NewPaymentMethod): Promise<PaymentMethodModel> {
    return await this.applyCreate(newPaymentMethod)
  }

  static async create(newPaymentMethod: NewPaymentMethod): Promise<PaymentMethodModel> {
    const instance = new PaymentMethodModel(null)

    return await instance.applyCreate(newPaymentMethod)
  }

  static async createMany(newPaymentMethod: NewPaymentMethod[]): Promise<void> {
    const instance = new PaymentMethodModel(null)

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

    const model = await find(Number(result.numInsertedOrUpdatedRows)) as PaymentMethodModel

    return model
  }

  // Method to remove a PaymentMethod
  static async remove(id: number): Promise<any> {
    return await DB.instance.deleteFrom('payment_methods')
      .where('id', '=', id)
      .execute()
  }

  applyWhere<V>(column: keyof PaymentMethodsTable, ...args: [V] | [Operator, V]): PaymentMethodModel {
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

  where<V = string>(column: keyof PaymentMethodsTable, ...args: [V] | [Operator, V]): PaymentMethodModel {
    return this.applyWhere<V>(column, ...args)
  }

  static where<V = string>(column: keyof PaymentMethodsTable, ...args: [V] | [Operator, V]): PaymentMethodModel {
    const instance = new PaymentMethodModel(null)

    return instance.applyWhere<V>(column, ...args)
  }

  whereColumn(first: keyof PaymentMethodsTable, operator: Operator, second: keyof PaymentMethodsTable): PaymentMethodModel {
    this.selectFromQuery = this.selectFromQuery.whereRef(first, operator, second)

    return this
  }

  static whereColumn(first: keyof PaymentMethodsTable, operator: Operator, second: keyof PaymentMethodsTable): PaymentMethodModel {
    const instance = new PaymentMethodModel(null)

    instance.selectFromQuery = instance.selectFromQuery.whereRef(first, operator, second)

    return instance
  }

  applyWhereRef(column: keyof PaymentMethodsTable, ...args: string[]): PaymentMethodModel {
    const [operatorOrValue, value] = args
    const operator = value === undefined ? '=' : operatorOrValue
    const actualValue = value === undefined ? operatorOrValue : value

    const instance = new PaymentMethodModel(null)
    instance.selectFromQuery = instance.selectFromQuery.whereRef(column, operator, actualValue)

    return instance
  }

  whereRef(column: keyof PaymentMethodsTable, ...args: string[]): PaymentMethodModel {
    return this.applyWhereRef(column, ...args)
  }

  static whereRef(column: keyof PaymentMethodsTable, ...args: string[]): PaymentMethodModel {
    const instance = new PaymentMethodModel(null)

    return instance.applyWhereRef(column, ...args)
  }

  whereRaw(sqlStatement: string): PaymentMethodModel {
    this.selectFromQuery = this.selectFromQuery.where(sql`${sqlStatement}`)

    return this
  }

  static whereRaw(sqlStatement: string): PaymentMethodModel {
    const instance = new PaymentMethodModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where(sql`${sqlStatement}`)

    return instance
  }

  applyOrWhere(...conditions: [string, any][]): PaymentMethodModel {
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

  orWhere(...conditions: [string, any][]): PaymentMethodModel {
    return this.applyOrWhere(...conditions)
  }

  static orWhere(...conditions: [string, any][]): PaymentMethodModel {
    const instance = new PaymentMethodModel(null)

    return instance.applyOrWhere(...conditions)
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

  whereNotNull(column: keyof PaymentMethodsTable): PaymentMethodModel {
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

  static whereNotNull(column: keyof PaymentMethodsTable): PaymentMethodModel {
    const instance = new PaymentMethodModel(null)

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

  whereNull(column: keyof PaymentMethodsTable): PaymentMethodModel {
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

  static whereNull(column: keyof PaymentMethodsTable): PaymentMethodModel {
    const instance = new PaymentMethodModel(null)

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

  applyWhereIn<V>(column: keyof PaymentMethodsTable, values: V[]) {
    this.selectFromQuery = this.selectFromQuery.where(column, 'in', values)

    this.updateFromQuery = this.updateFromQuery.where(column, 'in', values)

    this.deleteFromQuery = this.deleteFromQuery.where(column, 'in', values)

    return this
  }

  whereIn<V = number>(column: keyof PaymentMethodsTable, values: V[]): PaymentMethodModel {
    return this.applyWhereIn<V>(column, values)
  }

  static whereIn<V = number>(column: keyof PaymentMethodsTable, values: V[]): PaymentMethodModel {
    const instance = new PaymentMethodModel(null)

    return instance.applyWhereIn<V>(column, values)
  }

  applyWhereBetween<V>(column: keyof PaymentMethodsTable, range: [V, V]): PaymentMethodModel {
    if (range.length !== 2) {
      throw new HttpError(500, 'Range must have exactly two values: [min, max]')
    }

    const query = sql` ${sql.raw(column as string)} between ${range[0]} and ${range[1]} `

    this.selectFromQuery = this.selectFromQuery.where(query)
    this.updateFromQuery = this.updateFromQuery.where(query)
    this.deleteFromQuery = this.deleteFromQuery.where(query)

    return this
  }

  whereBetween<V = number>(column: keyof PaymentMethodsTable, range: [V, V]): PaymentMethodModel {
    return this.applyWhereBetween<V>(column, range)
  }

  static whereBetween<V = number>(column: keyof PaymentMethodsTable, range: [V, V]): PaymentMethodModel {
    const instance = new PaymentMethodModel(null)

    return instance.applyWhereBetween<V>(column, range)
  }

  applyWhereLike(column: keyof PaymentMethodsTable, value: string): PaymentMethodModel {
    this.selectFromQuery = this.selectFromQuery.where(sql` ${sql.raw(column as string)} LIKE ${value}`)

    this.updateFromQuery = this.updateFromQuery.where(sql` ${sql.raw(column as string)} LIKE ${value}`)

    this.deleteFromQuery = this.deleteFromQuery.where(sql` ${sql.raw(column as string)} LIKE ${value}`)

    return this
  }

  whereLike(column: keyof PaymentMethodsTable, value: string): PaymentMethodModel {
    return this.applyWhereLike(column, value)
  }

  static whereLike(column: keyof PaymentMethodsTable, value: string): PaymentMethodModel {
    const instance = new PaymentMethodModel(null)

    return instance.applyWhereLike(column, value)
  }

  applyWhereNotIn<V>(column: keyof PaymentMethodsTable, values: V[]): PaymentMethodModel {
    this.selectFromQuery = this.selectFromQuery.where(column, 'not in', values)

    this.updateFromQuery = this.updateFromQuery.where(column, 'not in', values)

    this.deleteFromQuery = this.deleteFromQuery.where(column, 'not in', values)

    return this
  }

  whereNotIn<V>(column: keyof PaymentMethodsTable, values: V[]): PaymentMethodModel {
    return this.applyWhereNotIn<V>(column, values)
  }

  static whereNotIn<V = number>(column: keyof PaymentMethodsTable, values: V[]): PaymentMethodModel {
    const instance = new PaymentMethodModel(null)

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

  static async latest(): Promise<PaymentMethodType | undefined> {
    const instance = new PaymentMethodModel(null)

    const model = await DB.instance.selectFrom('payment_methods')
      .selectAll()
      .orderBy('id', 'desc')
      .executeTakeFirst()

    if (!model)
      return undefined

    instance.mapCustomGetters(model)

    const data = new PaymentMethodModel(model as PaymentMethodType)

    return data
  }

  static async oldest(): Promise<PaymentMethodType | undefined> {
    const instance = new PaymentMethodModel(null)

    const model = await DB.instance.selectFrom('payment_methods')
      .selectAll()
      .orderBy('id', 'asc')
      .executeTakeFirst()

    if (!model)
      return undefined

    instance.mapCustomGetters(model)

    const data = new PaymentMethodModel(model as PaymentMethodType)

    return data
  }

  static async firstOrCreate(
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
      instance.mapCustomGetters(existingPaymentMethod)
      await instance.loadRelations(existingPaymentMethod)

      return new PaymentMethodModel(existingPaymentMethod as PaymentMethodType)
    }
    else {
      return await instance.create(newPaymentMethod)
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

      instance.hasSaved = true

      return new PaymentMethodModel(updatedPaymentMethod as PaymentMethodType)
    }
    else {
      // If not found, create a new record
      return await instance.create(newPaymentMethod)
    }
  }

  async loadRelations(models: PaymentMethodJsonResponse | PaymentMethodJsonResponse[]): Promise<void> {
    // Handle both single model and array of models
    const modelArray = Array.isArray(models) ? models : [models]
    if (!modelArray.length)
      return

    const modelIds = modelArray.map(model => model.id)

    for (const relation of this.withRelations) {
      const relatedRecords = await DB.instance
        .selectFrom(relation)
        .where('paymentmethod_id', 'in', modelIds)
        .selectAll()
        .execute()

      if (Array.isArray(models)) {
        models.map((model: PaymentMethodJsonResponse) => {
          const records = relatedRecords.filter((record: { paymentmethod_id: number }) => {
            return record.paymentmethod_id === model.id
          })

          model[relation] = records.length === 1 ? records[0] : records
          return model
        })
      }
      else {
        const records = relatedRecords.filter((record: { paymentmethod_id: number }) => {
          return record.paymentmethod_id === models.id
        })

        models[relation] = records.length === 1 ? records[0] : records
      }
    }
  }

  with(relations: string[]): PaymentMethodModel {
    this.withRelations = relations

    return this
  }

  static with(relations: string[]): PaymentMethodModel {
    const instance = new PaymentMethodModel(null)

    instance.withRelations = relations

    return instance
  }

  async last(): Promise<PaymentMethodType | undefined> {
    let model: PaymentMethodModel | undefined

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

    const data = new PaymentMethodModel(model as PaymentMethodType)

    return data
  }

  static async last(): Promise<PaymentMethodType | undefined> {
    const model = await DB.instance.selectFrom('payment_methods').selectAll().orderBy('id', 'desc').executeTakeFirst()

    if (!model)
      return undefined

    const data = new PaymentMethodModel(model as PaymentMethodType)

    return data
  }

  orderBy(column: keyof PaymentMethodsTable, order: 'asc' | 'desc'): PaymentMethodModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, order)

    return this
  }

  static orderBy(column: keyof PaymentMethodsTable, order: 'asc' | 'desc'): PaymentMethodModel {
    const instance = new PaymentMethodModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, order)

    return instance
  }

  groupBy(column: keyof PaymentMethodsTable): PaymentMethodModel {
    this.selectFromQuery = this.selectFromQuery.groupBy(column)

    return this
  }

  static groupBy(column: keyof PaymentMethodsTable): PaymentMethodModel {
    const instance = new PaymentMethodModel(null)

    instance.selectFromQuery = instance.selectFromQuery.groupBy(column)

    return instance
  }

  having<V = string>(column: keyof PaymentMethodsTable, operator: Operator, value: V): PaymentMethodModel {
    this.selectFromQuery = this.selectFromQuery.having(column, operator, value)

    return this
  }

  static having<V = string>(column: keyof PaymentMethodsTable, operator: Operator, value: V): PaymentMethodModel {
    const instance = new PaymentMethodModel(null)

    instance.selectFromQuery = instance.selectFromQuery.having(column, operator, value)

    return instance
  }

  inRandomOrder(): PaymentMethodModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(sql` ${sql.raw('RANDOM()')} `)

    return this
  }

  static inRandomOrder(): PaymentMethodModel {
    const instance = new PaymentMethodModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(sql` ${sql.raw('RANDOM()')} `)

    return instance
  }

  orderByDesc(column: keyof PaymentMethodsTable): PaymentMethodModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, 'desc')

    return this
  }

  static orderByDesc(column: keyof PaymentMethodsTable): PaymentMethodModel {
    const instance = new PaymentMethodModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, 'desc')

    return instance
  }

  orderByAsc(column: keyof PaymentMethodsTable): PaymentMethodModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, 'asc')

    return this
  }

  static orderByAsc(column: keyof PaymentMethodsTable): PaymentMethodModel {
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

    await this.mapCustomSetters(filteredValues)

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

    await this.mapCustomSetters(paymentmethod)

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

    await this.mapCustomSetters(this.attributes)

    if (this.id === undefined) {
      await this.create(this.attributes)
    }
    else {
      await this.update(this.attributes)
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
  async delete(): Promise<PaymentMethodsTable> {
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

  distinct(column: keyof PaymentMethodType): PaymentMethodModel {
    this.selectFromQuery = this.selectFromQuery.select(column).distinct()

    this.hasSelect = true

    return this
  }

  static distinct(column: keyof PaymentMethodType): PaymentMethodModel {
    const instance = new PaymentMethodModel(null)

    instance.selectFromQuery = instance.selectFromQuery.select(column).distinct()

    instance.hasSelect = true

    return instance
  }

  join(table: string, firstCol: string, secondCol: string): PaymentMethodModel {
    this.selectFromQuery = this.selectFromQuery.innerJoin(table, firstCol, secondCol)

    return this
  }

  static join(table: string, firstCol: string, secondCol: string): PaymentMethodModel {
    const instance = new PaymentMethodModel(null)

    instance.selectFromQuery = instance.selectFromQuery.innerJoin(table, firstCol, secondCol)

    return instance
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
