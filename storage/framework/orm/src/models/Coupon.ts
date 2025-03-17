import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import type { OrderModel } from './Order'
import type { ProductModel } from './Product'
import { randomUUIDv7 } from 'bun'
import { cache } from '@stacksjs/cache'
import { sql } from '@stacksjs/database'
import { HttpError, ModelNotFoundException } from '@stacksjs/error-handling'
import { dispatch } from '@stacksjs/events'

import { BaseOrm, DB, SubqueryBuilder } from '@stacksjs/orm'

import Product from './Product'

export interface CouponsTable {
  id: Generated<number>
  product_id: number
  code: string
  description?: string
  discount_type: string
  discount_value: number
  min_order_amount?: number
  max_discount_amount?: number
  free_product_id?: string
  is_active?: boolean
  usage_limit?: number
  usage_count?: number
  start_date: Date | string
  end_date: Date | string
  applicable_products?: string
  applicable_categories?: string
  uuid?: string

  created_at?: Date

  updated_at?: Date

}

export interface CouponResponse {
  data: CouponJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface CouponJsonResponse extends Omit<Selectable<CouponsTable>, 'password'> {
  [key: string]: any
}

export type NewCoupon = Insertable<CouponsTable>
export type CouponUpdate = Updateable<CouponsTable>

      type SortDirection = 'asc' | 'desc'
interface SortOptions { column: CouponJsonResponse, order: SortDirection }
// Define a type for the options parameter
interface QueryOptions {
  sort?: SortOptions
  limit?: number
  offset?: number
  page?: number
}

export class CouponModel extends BaseOrm<CouponModel, CouponsTable, CouponJsonResponse> {
  private readonly hidden: Array<keyof CouponJsonResponse> = []
  private readonly fillable: Array<keyof CouponJsonResponse> = ['code', 'description', 'discount_type', 'discount_value', 'min_order_amount', 'max_discount_amount', 'free_product_id', 'is_active', 'usage_limit', 'usage_count', 'start_date', 'end_date', 'applicable_products', 'applicable_categories', 'uuid']
  private readonly guarded: Array<keyof CouponJsonResponse> = []
  protected attributes = {} as CouponJsonResponse
  protected originalAttributes = {} as CouponJsonResponse

  protected selectFromQuery: any
  protected updateFromQuery: any
  protected deleteFromQuery: any
  protected hasSelect: boolean
  private hasSaved: boolean
  private customColumns: Record<string, unknown> = {}

  constructor(coupon: CouponJsonResponse | undefined) {
    super('coupons')
    if (coupon) {
      this.attributes = { ...coupon }
      this.originalAttributes = { ...coupon }

      Object.keys(coupon).forEach((key) => {
        if (!(key in this)) {
          this.customColumns[key] = (coupon as CouponJsonResponse)[key]
        }
      })
    }

    this.withRelations = []
    this.selectFromQuery = DB.instance.selectFrom('coupons')
    this.updateFromQuery = DB.instance.updateTable('coupons')
    this.deleteFromQuery = DB.instance.deleteFrom('coupons')
    this.hasSelect = false
    this.hasSaved = false
  }

  protected mapCustomGetters(models: CouponJsonResponse | CouponJsonResponse[]): void {
    const data = models

    if (Array.isArray(data)) {
      data.map((model: CouponJsonResponse) => {
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

  async mapCustomSetters(model: NewCoupon | CouponUpdate): Promise<void> {
    const customSetter = {
      default: () => {
      },

    }

    for (const [key, fn] of Object.entries(customSetter)) {
      model[key] = await fn()
    }
  }

  get orders(): OrderModel[] | [] {
    return this.attributes.orders
  }

  get product_id(): number {
    return this.attributes.product_id
  }

  get product(): ProductModel | undefined {
    return this.attributes.product
  }

  get id(): number {
    return this.attributes.id
  }

  get uuid(): string | undefined {
    return this.attributes.uuid
  }

  get code(): string {
    return this.attributes.code
  }

  get description(): string | undefined {
    return this.attributes.description
  }

  get discount_type(): string {
    return this.attributes.discount_type
  }

  get discount_value(): number {
    return this.attributes.discount_value
  }

  get min_order_amount(): number | undefined {
    return this.attributes.min_order_amount
  }

  get max_discount_amount(): number | undefined {
    return this.attributes.max_discount_amount
  }

  get free_product_id(): string | undefined {
    return this.attributes.free_product_id
  }

  get is_active(): boolean | undefined {
    return this.attributes.is_active
  }

  get usage_limit(): number | undefined {
    return this.attributes.usage_limit
  }

  get usage_count(): number | undefined {
    return this.attributes.usage_count
  }

  get start_date(): Date | string {
    return this.attributes.start_date
  }

  get end_date(): Date | string {
    return this.attributes.end_date
  }

  get applicable_products(): string | undefined {
    return this.attributes.applicable_products
  }

  get applicable_categories(): string | undefined {
    return this.attributes.applicable_categories
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

  set code(value: string) {
    this.attributes.code = value
  }

  set description(value: string) {
    this.attributes.description = value
  }

  set discount_type(value: string) {
    this.attributes.discount_type = value
  }

  set discount_value(value: number) {
    this.attributes.discount_value = value
  }

  set min_order_amount(value: number) {
    this.attributes.min_order_amount = value
  }

  set max_discount_amount(value: number) {
    this.attributes.max_discount_amount = value
  }

  set free_product_id(value: string) {
    this.attributes.free_product_id = value
  }

  set is_active(value: boolean) {
    this.attributes.is_active = value
  }

  set usage_limit(value: number) {
    this.attributes.usage_limit = value
  }

  set usage_count(value: number) {
    this.attributes.usage_count = value
  }

  set start_date(value: Date | string) {
    this.attributes.start_date = value
  }

  set end_date(value: Date | string) {
    this.attributes.end_date = value
  }

  set applicable_products(value: string) {
    this.attributes.applicable_products = value
  }

  set applicable_categories(value: string) {
    this.attributes.applicable_categories = value
  }

  set updated_at(value: Date) {
    this.attributes.updated_at = value
  }

  getOriginal(column?: keyof CouponJsonResponse): Partial<CouponJsonResponse> {
    if (column) {
      return this.originalAttributes[column]
    }

    return this.originalAttributes
  }

  getChanges(): Partial<CouponJsonResponse> {
    return this.fillable.reduce<Partial<CouponJsonResponse>>((changes, key) => {
      const currentValue = this.attributes[key as keyof CouponsTable]
      const originalValue = this.originalAttributes[key as keyof CouponsTable]

      if (currentValue !== originalValue) {
        changes[key] = currentValue
      }

      return changes
    }, {})
  }

  isDirty(column?: keyof CouponJsonResponse): boolean {
    if (column) {
      return this.attributes[column] !== this.originalAttributes[column]
    }

    return Object.entries(this.originalAttributes).some(([key, originalValue]) => {
      const currentValue = (this.attributes as any)[key]

      return currentValue !== originalValue
    })
  }

  isClean(column?: keyof CouponJsonResponse): boolean {
    return !this.isDirty(column)
  }

  wasChanged(column?: keyof CouponJsonResponse): boolean {
    return this.hasSaved && this.isDirty(column)
  }

  static select(params: (keyof CouponJsonResponse)[] | RawBuilder<string> | string): CouponModel {
    const instance = new CouponModel(undefined)

    return instance.applySelect(params)
  }

  // Method to find a Coupon by ID
  static async find(id: number): Promise<CouponModel | undefined> {
    const instance = new CouponModel(undefined)

    return await instance.applyFind(id)
  }

  async first(): Promise<CouponModel | undefined> {
    const model = await this.applyFirst()

    const data = new CouponModel(model)

    return data
  }

  static async first(): Promise<CouponModel | undefined> {
    const instance = new CouponModel(undefined)

    const model = await instance.applyFirst()

    const data = new CouponModel(model)

    return data
  }

  async applyFirstOrFail(): Promise<CouponModel | undefined> {
    const model = await this.selectFromQuery.executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, 'No CouponModel results found for query')

    if (model) {
      this.mapCustomGetters(model)
      await this.loadRelations(model)
    }

    const data = new CouponModel(model)

    return data
  }

  async firstOrFail(): Promise<CouponModel | undefined> {
    return await this.applyFirstOrFail()
  }

  static async firstOrFail(): Promise<CouponModel | undefined> {
    const instance = new CouponModel(undefined)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<CouponModel[]> {
    const instance = new CouponModel(undefined)

    const models = await DB.instance.selectFrom('coupons').selectAll().execute()

    instance.mapCustomGetters(models)

    const data = await Promise.all(models.map(async (model: CouponJsonResponse) => {
      return new CouponModel(model)
    }))

    return data
  }

  async applyFindOrFail(id: number): Promise<CouponModel> {
    const model = await DB.instance.selectFrom('coupons').where('id', '=', id).selectAll().executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, `No CouponModel results for ${id}`)

    cache.getOrSet(`coupon:${id}`, JSON.stringify(model))

    this.mapCustomGetters(model)
    await this.loadRelations(model)

    const data = new CouponModel(model)

    return data
  }

  async findOrFail(id: number): Promise<CouponModel> {
    return await this.applyFindOrFail(id)
  }

  static async findOrFail(id: number): Promise<CouponModel> {
    const instance = new CouponModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  static async findMany(ids: number[]): Promise<CouponModel[]> {
    const instance = new CouponModel(undefined)

    const models = await instance.applyFindMany(ids)

    return models.map((modelItem: UserJsonResponse) => instance.parseResult(new CouponModel(modelItem)))
  }

  async findMany(ids: number[]): Promise<CouponModel[]> {
    const models = await this.applyFindMany(ids)

    return models.map((modelItem: UserJsonResponse) => this.parseResult(new CouponModel(modelItem)))
  }

  skip(count: number): CouponModel {
    this.selectFromQuery = this.selectFromQuery.offset(count)

    return this
  }

  static skip(count: number): CouponModel {
    const instance = new CouponModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.offset(count)

    return instance
  }

  async applyChunk(size: number, callback: (models: CouponModel[]) => Promise<void>): Promise<void> {
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

  async chunk(size: number, callback: (models: CouponModel[]) => Promise<void>): Promise<void> {
    await this.applyChunk(size, callback)
  }

  static async chunk(size: number, callback: (models: CouponModel[]) => Promise<void>): Promise<void> {
    const instance = new CouponModel(undefined)

    await instance.applyChunk(size, callback)
  }

  static take(count: number): CouponModel {
    const instance = new CouponModel(undefined)

    return instance.applyTake(count)
  }

  static async pluck<K extends keyof CouponModel>(field: K): Promise<CouponModel[K][]> {
    const instance = new CouponModel(undefined)

    if (instance.hasSelect) {
      const model = await instance.selectFromQuery.execute()
      return model.map((modelItem: CouponModel) => modelItem[field])
    }

    const model = await instance.selectFromQuery.selectAll().execute()

    return model.map((modelItem: CouponModel) => modelItem[field])
  }

  async pluck<K extends keyof CouponModel>(field: K): Promise<CouponModel[K][]> {
    if (this.hasSelect) {
      const model = await this.selectFromQuery.execute()
      return model.map((modelItem: CouponModel) => modelItem[field])
    }

    const model = await this.selectFromQuery.selectAll().execute()

    return model.map((modelItem: CouponModel) => modelItem[field])
  }

  static async count(): Promise<number> {
    const instance = new CouponModel(undefined)

    return instance.applyCount()
  }

  static async max(field: keyof CouponModel): Promise<number> {
    const instance = new CouponModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`MAX(${sql.raw(field as string)}) as max `)
      .executeTakeFirst()

    return result.max
  }

  async max(field: keyof CouponModel): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`MAX(${sql.raw(field as string)}) as max`)
      .executeTakeFirst()

    return result.max
  }

  static async min(field: keyof CouponModel): Promise<number> {
    const instance = new CouponModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`MIN(${sql.raw(field as string)}) as min `)
      .executeTakeFirst()

    return result.min
  }

  async min(field: keyof CouponModel): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`MIN(${sql.raw(field as string)}) as min `)
      .executeTakeFirst()

    return result.min
  }

  static async avg(field: keyof CouponModel): Promise<number> {
    const instance = new CouponModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`AVG(${sql.raw(field as string)}) as avg `)
      .executeTakeFirst()

    return result.avg
  }

  async avg(field: keyof CouponModel): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`AVG(${sql.raw(field as string)}) as avg `)
      .executeTakeFirst()

    return result.avg
  }

  static async sum(field: keyof CouponModel): Promise<number> {
    const instance = new CouponModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`SUM(${sql.raw(field as string)}) as sum `)
      .executeTakeFirst()

    return result.sum
  }

  async sum(field: keyof CouponModel): Promise<number> {
    const result = this.selectFromQuery
      .select(sql`SUM(${sql.raw(field as string)}) as sum `)
      .executeTakeFirst()

    return result.sum
  }

  async applyGet(): Promise<CouponModel[]> {
    let models

    if (this.hasSelect) {
      models = await this.selectFromQuery.execute()
    }
    else {
      models = await this.selectFromQuery.selectAll().execute()
    }

    this.mapCustomGetters(models)
    await this.loadRelations(models)

    const data = await Promise.all(models.map(async (model: CouponJsonResponse) => {
      return new CouponModel(model)
    }))

    return data
  }

  async get(): Promise<CouponModel[]> {
    return await this.applyGet()
  }

  static async get(): Promise<CouponModel[]> {
    const instance = new CouponModel(undefined)

    return await instance.applyGet()
  }

  has(relation: string): CouponModel {
    this.selectFromQuery = this.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(
        selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.coupon_id`, '=', 'coupons.id'),
      ),
    )

    return this
  }

  static has(relation: string): CouponModel {
    const instance = new CouponModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(
        selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.coupon_id`, '=', 'coupons.id'),
      ),
    )

    return instance
  }

  static whereExists(callback: (qb: any) => any): CouponModel {
    const instance = new CouponModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(callback({ exists, selectFrom })),
    )

    return instance
  }

  applyWhereHas(
    relation: string,
    callback: (query: SubqueryBuilder<keyof CouponModel>) => void,
  ): CouponModel {
    const subqueryBuilder = new SubqueryBuilder()

    callback(subqueryBuilder)
    const conditions = subqueryBuilder.getConditions()

    this.selectFromQuery = this.selectFromQuery
      .where(({ exists, selectFrom }: any) => {
        let subquery = selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.coupon_id`, '=', 'coupons.id')

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
    callback: (query: SubqueryBuilder<keyof CouponModel>) => void,
  ): CouponModel {
    return this.applyWhereHas(relation, callback)
  }

  static whereHas(
    relation: string,
    callback: (query: SubqueryBuilder<keyof CouponModel>) => void,
  ): CouponModel {
    const instance = new CouponModel(undefined)

    return instance.applyWhereHas(relation, callback)
  }

  applyDoesntHave(relation: string): CouponModel {
    this.selectFromQuery = this.selectFromQuery.where(({ not, exists, selectFrom }: any) =>
      not(
        exists(
          selectFrom(relation)
            .select('1')
            .whereRef(`${relation}.coupon_id`, '=', 'coupons.id'),
        ),
      ),
    )

    return this
  }

  doesntHave(relation: string): CouponModel {
    return this.applyDoesntHave(relation)
  }

  static doesntHave(relation: string): CouponModel {
    const instance = new CouponModel(undefined)

    return instance.applyDoesntHave(relation)
  }

  applyWhereDoesntHave(relation: string, callback: (query: SubqueryBuilder<CouponsTable>) => void): CouponModel {
    const subqueryBuilder = new SubqueryBuilder()

    callback(subqueryBuilder)
    const conditions = subqueryBuilder.getConditions()

    this.selectFromQuery = this.selectFromQuery
      .where(({ exists, selectFrom, not }: any) => {
        const subquery = selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.coupon_id`, '=', 'coupons.id')

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

  whereDoesntHave(relation: string, callback: (query: SubqueryBuilder<CouponsTable>) => void): CouponModel {
    return this.applyWhereDoesntHave(relation, callback)
  }

  static whereDoesntHave(
    relation: string,
    callback: (query: SubqueryBuilder<CouponsTable>) => void,
  ): CouponModel {
    const instance = new CouponModel(undefined)

    return instance.applyWhereDoesntHave(relation, callback)
  }

  async applyPaginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<CouponResponse> {
    const totalRecordsResult = await DB.instance.selectFrom('coupons')
      .select(DB.instance.fn.count('id').as('total')) // Use 'id' or another actual column name
      .executeTakeFirst()

    const totalRecords = Number(totalRecordsResult?.total) || 0
    const totalPages = Math.ceil(totalRecords / (options.limit ?? 10))

    const couponsWithExtra = await DB.instance.selectFrom('coupons')
      .selectAll()
      .orderBy('id', 'asc') // Assuming 'id' is used for cursor-based pagination
      .limit((options.limit ?? 10) + 1) // Fetch one extra record
      .offset(((options.page ?? 1) - 1) * (options.limit ?? 10)) // Ensure options.page is not undefined
      .execute()

    let nextCursor = null
    if (couponsWithExtra.length > (options.limit ?? 10))
      nextCursor = couponsWithExtra.pop()?.id ?? null

    return {
      data: couponsWithExtra,
      paging: {
        total_records: totalRecords,
        page: options.page || 1,
        total_pages: totalPages,
      },
      next_cursor: nextCursor,
    }
  }

  async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<CouponResponse> {
    return await this.applyPaginate(options)
  }

  // Method to get all coupons
  static async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<CouponResponse> {
    const instance = new CouponModel(undefined)

    return await instance.applyPaginate(options)
  }

  async applyCreate(newCoupon: NewCoupon): Promise<CouponModel> {
    const filteredValues = Object.fromEntries(
      Object.entries(newCoupon).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewCoupon

    await this.mapCustomSetters(filteredValues)

    filteredValues.uuid = randomUUIDv7()

    const result = await DB.instance.insertInto('coupons')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await this.find(Number(result.numInsertedOrUpdatedRows)) as CouponModel

    if (model)
      dispatch('coupon:created', model)

    return model
  }

  async create(newCoupon: NewCoupon): Promise<CouponModel> {
    return await this.applyCreate(newCoupon)
  }

  static async create(newCoupon: NewCoupon): Promise<CouponModel> {
    const instance = new CouponModel(undefined)

    return await instance.applyCreate(newCoupon)
  }

  static async createMany(newCoupon: NewCoupon[]): Promise<void> {
    const instance = new CouponModel(undefined)

    const valuesFiltered = newCoupon.map((newCoupon: NewCoupon) => {
      const filteredValues = Object.fromEntries(
        Object.entries(newCoupon).filter(([key]) =>
          !instance.guarded.includes(key) && instance.fillable.includes(key),
        ),
      ) as NewCoupon

      filteredValues.uuid = randomUUIDv7()

      return filteredValues
    })

    await DB.instance.insertInto('coupons')
      .values(valuesFiltered)
      .executeTakeFirst()
  }

  static async forceCreate(newCoupon: NewCoupon): Promise<CouponModel> {
    const result = await DB.instance.insertInto('coupons')
      .values(newCoupon)
      .executeTakeFirst()

    const model = await find(Number(result.numInsertedOrUpdatedRows)) as CouponModel

    if (model)
      dispatch('coupon:created', model)

    return model
  }

  // Method to remove a Coupon
  static async remove(id: number): Promise<any> {
    const instance = new CouponModel(undefined)

    const model = await instance.find(Number(id))

    if (model)
      dispatch('coupon:deleted', model)

    return await DB.instance.deleteFrom('coupons')
      .where('id', '=', id)
      .execute()
  }

  static where<V = string>(column: keyof CouponsTable, ...args: [V] | [Operator, V]): CouponModel {
    const instance = new CouponModel(undefined)

    return instance.applyWhere<V>(column, ...args)
  }

  static whereColumn(first: keyof CouponsTable, operator: Operator, second: keyof CouponsTable): CouponModel {
    const instance = new CouponModel(undefined)

    instance.selectFromQuery = instance.applyWhereColumn(first, operator, second)

    return instance
  }

  static whereRef(column: keyof CouponsTable, ...args: string[]): CouponModel {
    const instance = new CouponModel(undefined)

    return instance.applyWhereRef(column, ...args)
  }

  static whereRaw(sqlStatement: string): CouponModel {
    const instance = new CouponModel(undefined)

    instance.selectFromQuery = instance.applyWhereRaw(sqlStatement)

    return instance
  }

  static orWhere(...conditions: [string, any][]): CouponModel {
    const instance = new CouponModel(undefined)

    return instance.applyOrWhere(...conditions)
  }

  static when(condition: boolean, callback: (query: CouponModel) => CouponModel): CouponModel {
    const instance = new CouponModel(undefined)

    return instance.applyWhen(condition, callback)
  }

  static whereNotNull(column: keyof CouponsTable): CouponModel {
    const instance = new UserModel(undefined)

    return instance.applyWhereNotNull(column)
  }

  static whereNull(column: keyof CouponsTable): CouponModel {
    const instance = new CouponModel(undefined)

    return instance.applyWhereNull(column)
  }

  static whereCode(value: string): CouponModel {
    const instance = new CouponModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('code', '=', value)

    return instance
  }

  static whereDescription(value: string): CouponModel {
    const instance = new CouponModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('description', '=', value)

    return instance
  }

  static whereDiscountType(value: string): CouponModel {
    const instance = new CouponModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('discount_type', '=', value)

    return instance
  }

  static whereDiscountValue(value: string): CouponModel {
    const instance = new CouponModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('discount_value', '=', value)

    return instance
  }

  static whereMinOrderAmount(value: string): CouponModel {
    const instance = new CouponModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('min_order_amount', '=', value)

    return instance
  }

  static whereMaxDiscountAmount(value: string): CouponModel {
    const instance = new CouponModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('max_discount_amount', '=', value)

    return instance
  }

  static whereFreeProductId(value: string): CouponModel {
    const instance = new CouponModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('free_product_id', '=', value)

    return instance
  }

  static whereIsActive(value: string): CouponModel {
    const instance = new CouponModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('is_active', '=', value)

    return instance
  }

  static whereUsageLimit(value: string): CouponModel {
    const instance = new CouponModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('usage_limit', '=', value)

    return instance
  }

  static whereUsageCount(value: string): CouponModel {
    const instance = new CouponModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('usage_count', '=', value)

    return instance
  }

  static whereStartDate(value: string): CouponModel {
    const instance = new CouponModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('start_date', '=', value)

    return instance
  }

  static whereEndDate(value: string): CouponModel {
    const instance = new CouponModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('end_date', '=', value)

    return instance
  }

  static whereApplicableProducts(value: string): CouponModel {
    const instance = new CouponModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('applicable_products', '=', value)

    return instance
  }

  static whereApplicableCategories(value: string): CouponModel {
    const instance = new CouponModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('applicable_categories', '=', value)

    return instance
  }

  static whereIn<V = number>(column: keyof CouponsTable, values: V[]): CouponModel {
    const instance = new CouponModel(undefined)

    return instance.applyWhereIn<V>(column, values)
  }

  static whereBetween<V = number>(column: keyof CouponsTable, range: [V, V]): CouponModel {
    const instance = new CouponModel(undefined)

    return instance.applyWhereBetween<V>(column, range)
  }

  static whereLike(column: keyof CouponsTable, value: string): CouponModel {
    const instance = new CouponModel(undefined)

    return instance.applyWhereLike(column, value)
  }

  static whereNotIn<V = number>(column: keyof CouponsTable, values: V[]): CouponModel {
    const instance = new CouponModel(undefined)

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

  static async latest(): Promise<CouponModel | undefined> {
    const instance = new CouponModel(undefined)

    const model = await DB.instance.selectFrom('coupons')
      .selectAll()
      .orderBy('id', 'desc')
      .executeTakeFirst()

    if (!model)
      return undefined

    instance.mapCustomGetters(model)

    const data = new CouponModel(model)

    return data
  }

  static async oldest(): Promise<CouponModel | undefined> {
    const instance = new CouponModel(undefined)

    const model = await DB.instance.selectFrom('coupons')
      .selectAll()
      .orderBy('id', 'asc')
      .executeTakeFirst()

    if (!model)
      return undefined

    instance.mapCustomGetters(model)

    const data = new CouponModel(model)

    return data
  }

  static async firstOrCreate(
    condition: Partial<CouponJsonResponse>,
    newCoupon: NewCoupon,
  ): Promise<CouponModel> {
    const instance = new CouponModel(undefined)

    const key = Object.keys(condition)[0] as keyof CouponJsonResponse

    if (!key) {
      throw new HttpError(500, 'Condition must contain at least one key-value pair')
    }

    const value = condition[key]

    // Attempt to find the first record matching the condition
    const existingCoupon = await DB.instance.selectFrom('coupons')
      .selectAll()
      .where(key, '=', value)
      .executeTakeFirst()

    if (existingCoupon) {
      instance.mapCustomGetters(existingCoupon)
      await instance.loadRelations(existingCoupon)

      return new CouponModel(existingCoupon as CouponJsonResponse)
    }
    else {
      return await instance.create(newCoupon)
    }
  }

  static async updateOrCreate(
    condition: Partial<CouponJsonResponse>,
    newCoupon: NewCoupon,
  ): Promise<CouponModel> {
    const instance = new CouponModel(undefined)

    const key = Object.keys(condition)[0] as keyof CouponJsonResponse

    if (!key) {
      throw new HttpError(500, 'Condition must contain at least one key-value pair')
    }

    const value = condition[key]

    // Attempt to find the first record matching the condition
    const existingCoupon = await DB.instance.selectFrom('coupons')
      .selectAll()
      .where(key, '=', value)
      .executeTakeFirst()

    if (existingCoupon) {
      // If found, update the existing record
      await DB.instance.updateTable('coupons')
        .set(newCoupon)
        .where(key, '=', value)
        .executeTakeFirstOrThrow()

      // Fetch and return the updated record
      const updatedCoupon = await DB.instance.selectFrom('coupons')
        .selectAll()
        .where(key, '=', value)
        .executeTakeFirst()

      if (!updatedCoupon) {
        throw new HttpError(500, 'Failed to fetch updated record')
      }

      instance.hasSaved = true

      return new CouponModel(updatedCoupon as CouponJsonResponse)
    }
    else {
      // If not found, create a new record
      return await instance.create(newCoupon)
    }
  }

  protected async loadRelations(models: CouponJsonResponse | CouponJsonResponse[]): Promise<void> {
    // Handle both single model and array of models
    const modelArray = Array.isArray(models) ? models : [models]
    if (!modelArray.length)
      return

    const modelIds = modelArray.map(model => model.id)

    for (const relation of this.withRelations) {
      const relatedRecords = await DB.instance
        .selectFrom(relation)
        .where('coupon_id', 'in', modelIds)
        .selectAll()
        .execute()

      if (Array.isArray(models)) {
        models.map((model: CouponJsonResponse) => {
          const records = relatedRecords.filter((record: { coupon_id: number }) => {
            return record.coupon_id === model.id
          })

          model[relation] = records.length === 1 ? records[0] : records
          return model
        })
      }
      else {
        const records = relatedRecords.filter((record: { coupon_id: number }) => {
          return record.coupon_id === models.id
        })

        models[relation] = records.length === 1 ? records[0] : records
      }
    }
  }

  static with(relations: string[]): CouponModel {
    const instance = new CouponModel(undefined)

    instance.withRelations = relations

    return instance
  }

  async last(): Promise<CouponModel | undefined> {
    const model = await this.applyLast()

    const data = new CouponModel(model)

    return data
  }

  static async last(): Promise<CouponModel | undefined> {
    const instance = new CouponModel(undefined)

    const model = await instance.applyLast()

    if (!model)
      return undefined

    const data = new CouponModel(model)

    return data
  }

  static orderBy(column: keyof CouponsTable, order: 'asc' | 'desc'): CouponModel {
    const instance = new UserModel(undefined)

    return instance.applyOrderBy(column, order)
  }

  static groupBy(column: keyof CouponsTable): CouponModel {
    const instance = new CouponModel(undefined)

    return instance.applyGroupBy(column)
  }

  static having<V = string>(column: keyof CouponsTable, operator: Operator, value: V): CouponModel {
    const instance = new CouponModel(undefined)

    return instance.applyHaving(column, operator, value)
  }

  static inRandomOrder(): CouponModel {
    const instance = new CouponModel(undefined)

    return instance.applyInRandomOrder()
  }

  static orderByDesc(column: keyof CouponsTable): CouponModel {
    const instance = new CouponModel(undefined)

    return instance.applyOrderByDesc(column)
  }

  static orderByAsc(column: keyof CouponsTable): CouponModel {
    const instance = new CouponModel(undefined)

    return instance.applyOrderByAsc(column)
  }

  async update(newCoupon: CouponUpdate): Promise<CouponModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newCoupon).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewCoupon

    await this.mapCustomSetters(filteredValues)

    await DB.instance.updateTable('coupons')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      const model = await this.find(this.id)

      if (model)
        dispatch('coupon:updated', model)

      return model
    }

    this.hasSaved = true

    return undefined
  }

  async forceUpdate(coupon: CouponUpdate): Promise<CouponModel | undefined> {
    if (this.id === undefined) {
      this.updateFromQuery.set(coupon).execute()
    }

    await this.mapCustomSetters(coupon)

    await DB.instance.updateTable('coupons')
      .set(coupon)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      const model = await this.find(this.id)

      if (model)
        dispatch('coupon:updated', model)

      this.hasSaved = true

      return model
    }

    return undefined
  }

  async save(): Promise<void> {
    if (!this)
      throw new HttpError(500, 'Coupon data is undefined')

    await this.mapCustomSetters(this.attributes)

    if (this.id === undefined) {
      await this.create(this.attributes)
    }
    else {
      await this.update(this.attributes)
    }

    this.hasSaved = true
  }

  fill(data: Partial<CouponJsonResponse>): CouponModel {
    const filteredValues = Object.fromEntries(
      Object.entries(data).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewCoupon

    this.attributes = {
      ...this.attributes,
      ...filteredValues,
    }

    return this
  }

  forceFill(data: Partial<CouponJsonResponse>): CouponModel {
    this.attributes = {
      ...this.attributes,
      ...data,
    }

    return this
  }

  // Method to delete (soft delete) the coupon instance
  async delete(): Promise<CouponsTable> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()
    const model = await this.find(Number(this.id))
    if (model)
      dispatch('coupon:deleted', model)

    return await DB.instance.deleteFrom('coupons')
      .where('id', '=', this.id)
      .execute()
  }

  async productBelong(): Promise<ProductModel> {
    if (this.product_id === undefined)
      throw new HttpError(500, 'Relation Error!')

    const model = await Product
      .where('id', '=', this.product_id)
      .first()

    if (!model)
      throw new HttpError(500, 'Model Relation Not Found!')

    return model
  }

  toSearchableObject(): Partial<CouponJsonResponse> {
    return {
      id: this.id,
      code: this.code,
      discount_type: this.discount_type,
      discount_value: this.discount_value,
      is_active: this.is_active,
      start_date: this.start_date,
      end_date: this.end_date,
    }
  }

  distinct(column: keyof CouponJsonResponse): CouponModel {
    this.selectFromQuery = this.selectFromQuery.select(column).distinct()

    this.hasSelect = true

    return this
  }

  static distinct(column: keyof CouponJsonResponse): CouponModel {
    const instance = new CouponModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.select(column).distinct()

    instance.hasSelect = true

    return instance
  }

  join(table: string, firstCol: string, secondCol: string): CouponModel {
    this.selectFromQuery = this.selectFromQuery.innerJoin(table, firstCol, secondCol)

    return this
  }

  static join(table: string, firstCol: string, secondCol: string): CouponModel {
    const instance = new CouponModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.innerJoin(table, firstCol, secondCol)

    return instance
  }

  toJSON(): CouponJsonResponse {
    const output = {

      uuid: this.uuid,

      id: this.id,
      code: this.code,
      description: this.description,
      discount_type: this.discount_type,
      discount_value: this.discount_value,
      min_order_amount: this.min_order_amount,
      max_discount_amount: this.max_discount_amount,
      free_product_id: this.free_product_id,
      is_active: this.is_active,
      usage_limit: this.usage_limit,
      usage_count: this.usage_count,
      start_date: this.start_date,
      end_date: this.end_date,
      applicable_products: this.applicable_products,
      applicable_categories: this.applicable_categories,

      created_at: this.created_at,

      updated_at: this.updated_at,

      orders: this.orders,
      product_id: this.product_id,
      product: this.product,
      ...this.customColumns,
    }

    return output
  }

  parseResult(model: CouponModel): CouponModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof CouponModel]
    }

    return model
  }
}

async function find(id: number): Promise<CouponModel | undefined> {
  const query = DB.instance.selectFrom('coupons').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  return new CouponModel(model)
}

export async function count(): Promise<number> {
  const results = await CouponModel.count()

  return results
}

export async function create(newCoupon: NewCoupon): Promise<CouponModel> {
  const result = await DB.instance.insertInto('coupons')
    .values(newCoupon)
    .executeTakeFirstOrThrow()

  return await find(Number(result.numInsertedOrUpdatedRows)) as CouponModel
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(DB.instance)
}

export async function remove(id: number): Promise<void> {
  await DB.instance.deleteFrom('coupons')
    .where('id', '=', id)
    .execute()
}

export async function whereCode(value: string): Promise<CouponModel[]> {
  const query = DB.instance.selectFrom('coupons').where('code', '=', value)
  const results: CouponJsonResponse = await query.execute()

  return results.map((modelItem: CouponJsonResponse) => new CouponModel(modelItem))
}

export async function whereDescription(value: string): Promise<CouponModel[]> {
  const query = DB.instance.selectFrom('coupons').where('description', '=', value)
  const results: CouponJsonResponse = await query.execute()

  return results.map((modelItem: CouponJsonResponse) => new CouponModel(modelItem))
}

export async function whereDiscountType(value: string): Promise<CouponModel[]> {
  const query = DB.instance.selectFrom('coupons').where('discount_type', '=', value)
  const results: CouponJsonResponse = await query.execute()

  return results.map((modelItem: CouponJsonResponse) => new CouponModel(modelItem))
}

export async function whereDiscountValue(value: number): Promise<CouponModel[]> {
  const query = DB.instance.selectFrom('coupons').where('discount_value', '=', value)
  const results: CouponJsonResponse = await query.execute()

  return results.map((modelItem: CouponJsonResponse) => new CouponModel(modelItem))
}

export async function whereMinOrderAmount(value: number): Promise<CouponModel[]> {
  const query = DB.instance.selectFrom('coupons').where('min_order_amount', '=', value)
  const results: CouponJsonResponse = await query.execute()

  return results.map((modelItem: CouponJsonResponse) => new CouponModel(modelItem))
}

export async function whereMaxDiscountAmount(value: number): Promise<CouponModel[]> {
  const query = DB.instance.selectFrom('coupons').where('max_discount_amount', '=', value)
  const results: CouponJsonResponse = await query.execute()

  return results.map((modelItem: CouponJsonResponse) => new CouponModel(modelItem))
}

export async function whereFreeProductId(value: string): Promise<CouponModel[]> {
  const query = DB.instance.selectFrom('coupons').where('free_product_id', '=', value)
  const results: CouponJsonResponse = await query.execute()

  return results.map((modelItem: CouponJsonResponse) => new CouponModel(modelItem))
}

export async function whereIsActive(value: boolean): Promise<CouponModel[]> {
  const query = DB.instance.selectFrom('coupons').where('is_active', '=', value)
  const results: CouponJsonResponse = await query.execute()

  return results.map((modelItem: CouponJsonResponse) => new CouponModel(modelItem))
}

export async function whereUsageLimit(value: number): Promise<CouponModel[]> {
  const query = DB.instance.selectFrom('coupons').where('usage_limit', '=', value)
  const results: CouponJsonResponse = await query.execute()

  return results.map((modelItem: CouponJsonResponse) => new CouponModel(modelItem))
}

export async function whereUsageCount(value: number): Promise<CouponModel[]> {
  const query = DB.instance.selectFrom('coupons').where('usage_count', '=', value)
  const results: CouponJsonResponse = await query.execute()

  return results.map((modelItem: CouponJsonResponse) => new CouponModel(modelItem))
}

export async function whereStartDate(value: Date | string): Promise<CouponModel[]> {
  const query = DB.instance.selectFrom('coupons').where('start_date', '=', value)
  const results: CouponJsonResponse = await query.execute()

  return results.map((modelItem: CouponJsonResponse) => new CouponModel(modelItem))
}

export async function whereEndDate(value: Date | string): Promise<CouponModel[]> {
  const query = DB.instance.selectFrom('coupons').where('end_date', '=', value)
  const results: CouponJsonResponse = await query.execute()

  return results.map((modelItem: CouponJsonResponse) => new CouponModel(modelItem))
}

export async function whereApplicableProducts(value: string): Promise<CouponModel[]> {
  const query = DB.instance.selectFrom('coupons').where('applicable_products', '=', value)
  const results: CouponJsonResponse = await query.execute()

  return results.map((modelItem: CouponJsonResponse) => new CouponModel(modelItem))
}

export async function whereApplicableCategories(value: string): Promise<CouponModel[]> {
  const query = DB.instance.selectFrom('coupons').where('applicable_categories', '=', value)
  const results: CouponJsonResponse = await query.execute()

  return results.map((modelItem: CouponJsonResponse) => new CouponModel(modelItem))
}

export const Coupon = CouponModel

export default Coupon
