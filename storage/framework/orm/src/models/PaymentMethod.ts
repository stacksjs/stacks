import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { PaymentTransactionModel } from './PaymentTransaction'
import type { UserModel } from './User'
import { randomUUIDv7 } from 'bun'
import { cache } from '@stacksjs/cache'
import { sql } from '@stacksjs/database'
import { HttpError, ModelNotFoundException } from '@stacksjs/error-handling'

import { BaseOrm, DB, SubqueryBuilder } from '@stacksjs/orm'

import User from './User'

export interface PaymentMethodsTable {
  id: Generated<number>
  user_id: number
  type: string
  last_four: number
  brand: string
  exp_month: number
  exp_year: number
  is_default?: boolean
  provider_id?: string
  uuid?: string

  created_at?: Date

  updated_at?: Date

}

export interface PaymentMethodResponse {
  data: PaymentMethodJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface PaymentMethodJsonResponse extends Omit<Selectable<PaymentMethodsTable>, 'password'> {
  [key: string]: any
}

export type NewPaymentMethod = Insertable<PaymentMethodsTable>
export type PaymentMethodUpdate = Updateable<PaymentMethodsTable>

      type SortDirection = 'asc' | 'desc'
interface SortOptions { column: PaymentMethodJsonResponse, order: SortDirection }
// Define a type for the options parameter
interface QueryOptions {
  sort?: SortOptions
  limit?: number
  offset?: number
  page?: number
}

export class PaymentMethodModel extends BaseOrm<PaymentMethodModel, PaymentMethodsTable, PaymentMethodJsonResponse> {
  private readonly hidden: Array<keyof PaymentMethodJsonResponse> = []
  private readonly fillable: Array<keyof PaymentMethodJsonResponse> = ['type', 'last_four', 'brand', 'exp_month', 'exp_year', 'is_default', 'provider_id', 'uuid', 'user_id']
  private readonly guarded: Array<keyof PaymentMethodJsonResponse> = []
  protected attributes = {} as PaymentMethodJsonResponse
  protected originalAttributes = {} as PaymentMethodJsonResponse

  protected selectFromQuery: any
  protected updateFromQuery: any
  protected deleteFromQuery: any
  protected hasSelect: boolean
  private hasSaved: boolean
  private customColumns: Record<string, unknown> = {}

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
    this.hasSaved = false
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

  async mapCustomSetters(model: NewPaymentMethod | PaymentMethodUpdate): Promise<void> {
    const customSetter = {
      default: () => {
      },

    }

    for (const [key, fn] of Object.entries(customSetter)) {
      model[key] = await fn()
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

  isDirty(column?: keyof PaymentMethodJsonResponse): boolean {
    if (column) {
      return this.attributes[column] !== this.originalAttributes[column]
    }

    return Object.entries(this.originalAttributes).some(([key, originalValue]) => {
      const currentValue = (this.attributes as any)[key]

      return currentValue !== originalValue
    })
  }

  isClean(column?: keyof PaymentMethodJsonResponse): boolean {
    return !this.isDirty(column)
  }

  wasChanged(column?: keyof PaymentMethodJsonResponse): boolean {
    return this.hasSaved && this.isDirty(column)
  }

  static select(params: (keyof PaymentMethodJsonResponse)[] | RawBuilder<string> | string): PaymentMethodModel {
    const instance = new PaymentMethodModel(undefined)

    return instance.applySelect(params)
  }

  // Method to find a PaymentMethod by ID
  static async find(id: number): Promise<PaymentMethodModel | undefined> {
    const instance = new PaymentMethodModel(undefined)

    return await instance.applyFind(id)
  }

  async first(): Promise<PaymentMethodModel | undefined> {
    const model = await this.applyFirst()

    const data = new PaymentMethodModel(model)

    return data
  }

  static async first(): Promise<PaymentMethodModel | undefined> {
    const instance = new PaymentMethodModel(undefined)

    const model = await instance.applyFirst()

    const data = new PaymentMethodModel(model)

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

    const data = new PaymentMethodModel(model)

    return data
  }

  async firstOrFail(): Promise<PaymentMethodModel | undefined> {
    return await this.applyFirstOrFail()
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

  async applyFindOrFail(id: number): Promise<PaymentMethodModel> {
    const model = await DB.instance.selectFrom('payment_methods').where('id', '=', id).selectAll().executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, `No PaymentMethodModel results for ${id}`)

    cache.getOrSet(`paymentMethod:${id}`, JSON.stringify(model))

    this.mapCustomGetters(model)
    await this.loadRelations(model)

    const data = new PaymentMethodModel(model)

    return data
  }

  async findOrFail(id: number): Promise<PaymentMethodModel> {
    return await this.applyFindOrFail(id)
  }

  static async findOrFail(id: number): Promise<PaymentMethodModel> {
    const instance = new PaymentMethodModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  static async findMany(ids: number[]): Promise<PaymentMethodModel[]> {
    const instance = new PaymentMethodModel(undefined)

    const models = await instance.applyFindMany(ids)

    return models.map((modelItem: UserJsonResponse) => instance.parseResult(new PaymentMethodModel(modelItem)))
  }

  async findMany(ids: number[]): Promise<PaymentMethodModel[]> {
    const models = await this.applyFindMany(ids)

    return models.map((modelItem: UserJsonResponse) => this.parseResult(new PaymentMethodModel(modelItem)))
  }

  skip(count: number): PaymentMethodModel {
    this.selectFromQuery = this.selectFromQuery.offset(count)

    return this
  }

  static skip(count: number): PaymentMethodModel {
    const instance = new PaymentMethodModel(undefined)

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
    const instance = new PaymentMethodModel(undefined)

    await instance.applyChunk(size, callback)
  }

  static take(count: number): PaymentMethodModel {
    const instance = new PaymentMethodModel(undefined)

    return instance.applyTake(count)
  }

  static async pluck<K extends keyof PaymentMethodModel>(field: K): Promise<PaymentMethodModel[K][]> {
    const instance = new PaymentMethodModel(undefined)

    if (instance.hasSelect) {
      const model = await instance.selectFromQuery.execute()
      return model.map((modelItem: PaymentMethodModel) => modelItem[field])
    }

    const model = await instance.selectFromQuery.selectAll().execute()

    return model.map((modelItem: PaymentMethodModel) => modelItem[field])
  }

  async pluck<K extends keyof PaymentMethodModel>(field: K): Promise<PaymentMethodModel[K][]> {
    if (this.hasSelect) {
      const model = await this.selectFromQuery.execute()
      return model.map((modelItem: PaymentMethodModel) => modelItem[field])
    }

    const model = await this.selectFromQuery.selectAll().execute()

    return model.map((modelItem: PaymentMethodModel) => modelItem[field])
  }

  static async count(): Promise<number> {
    const instance = new PaymentMethodModel(undefined)

    return instance.applyCount()
  }

  static async max(field: keyof PaymentMethodModel): Promise<number> {
    const instance = new PaymentMethodModel(undefined)

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
    const instance = new PaymentMethodModel(undefined)

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
    const instance = new PaymentMethodModel(undefined)

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
    const instance = new PaymentMethodModel(undefined)

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

    const data = await Promise.all(models.map(async (model: PaymentMethodJsonResponse) => {
      return new PaymentMethodModel(model)
    }))

    return data
  }

  async get(): Promise<PaymentMethodModel[]> {
    return await this.applyGet()
  }

  static async get(): Promise<PaymentMethodModel[]> {
    const instance = new PaymentMethodModel(undefined)

    return await instance.applyGet()
  }

  has(relation: string): PaymentMethodModel {
    this.selectFromQuery = this.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(
        selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.paymentMethod_id`, '=', 'payment_methods.id'),
      ),
    )

    return this
  }

  static has(relation: string): PaymentMethodModel {
    const instance = new PaymentMethodModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(
        selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.paymentMethod_id`, '=', 'payment_methods.id'),
      ),
    )

    return instance
  }

  static whereExists(callback: (qb: any) => any): PaymentMethodModel {
    const instance = new PaymentMethodModel(undefined)

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
          .whereRef(`${relation}.paymentMethod_id`, '=', 'payment_methods.id')

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
    const instance = new PaymentMethodModel(undefined)

    return instance.applyWhereHas(relation, callback)
  }

  applyDoesntHave(relation: string): PaymentMethodModel {
    this.selectFromQuery = this.selectFromQuery.where(({ not, exists, selectFrom }: any) =>
      not(
        exists(
          selectFrom(relation)
            .select('1')
            .whereRef(`${relation}.paymentMethod_id`, '=', 'payment_methods.id'),
        ),
      ),
    )

    return this
  }

  doesntHave(relation: string): PaymentMethodModel {
    return this.applyDoesntHave(relation)
  }

  static doesntHave(relation: string): PaymentMethodModel {
    const instance = new PaymentMethodModel(undefined)

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
          .whereRef(`${relation}.paymentMethod_id`, '=', 'payment_methods.id')

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
    const instance = new PaymentMethodModel(undefined)

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
    const instance = new PaymentMethodModel(undefined)

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
    const instance = new PaymentMethodModel(undefined)

    return await instance.applyCreate(newPaymentMethod)
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

    const model = await find(Number(result.numInsertedOrUpdatedRows)) as PaymentMethodModel

    return model
  }

  // Method to remove a PaymentMethod
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

  distinct(column: keyof PaymentMethodJsonResponse): PaymentMethodModel {
    return this.applyDistinct(column)
  }

  static distinct(column: keyof PaymentMethodJsonResponse): PaymentMethodModel {
    const instance = new PaymentMethodModel(undefined)

    return instance.applyDistinct(column)
  }

  join(table: string, firstCol: string, secondCol: string): PaymentMethodModel {
    return this.applyJoin(table, firstCol, secondCol)
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
