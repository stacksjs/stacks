import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import { randomUUIDv7 } from 'bun'
import { cache } from '@stacksjs/cache'
import { sql } from '@stacksjs/database'
import { HttpError, ModelNotFoundException } from '@stacksjs/error-handling'
import { BaseOrm, DB, SubqueryBuilder } from '@stacksjs/orm'

export interface PaymentProductsTable {
  id: Generated<number>
  name: string
  description?: number
  key: number
  unit_price?: number
  status?: string
  image?: string
  provider_id?: string
  uuid?: string

  created_at?: Date

  updated_at?: Date

}

export interface PaymentProductResponse {
  data: PaymentProductJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface PaymentProductJsonResponse extends Omit<Selectable<PaymentProductsTable>, 'password'> {
  [key: string]: any
}

export type NewPaymentProduct = Insertable<PaymentProductsTable>
export type PaymentProductUpdate = Updateable<PaymentProductsTable>

      type SortDirection = 'asc' | 'desc'
interface SortOptions { column: PaymentProductJsonResponse, order: SortDirection }
// Define a type for the options parameter
interface QueryOptions {
  sort?: SortOptions
  limit?: number
  offset?: number
  page?: number
}

export class PaymentProductModel extends BaseOrm<PaymentProductModel, PaymentProductsTable, PaymentProductJsonResponse> {
  private readonly hidden: Array<keyof PaymentProductJsonResponse> = []
  private readonly fillable: Array<keyof PaymentProductJsonResponse> = ['name', 'description', 'key', 'unit_price', 'status', 'image', 'provider_id', 'uuid']
  private readonly guarded: Array<keyof PaymentProductJsonResponse> = []
  protected attributes = {} as PaymentProductJsonResponse
  protected originalAttributes = {} as PaymentProductJsonResponse

  protected selectFromQuery: any
  protected updateFromQuery: any
  protected deleteFromQuery: any
  protected hasSelect: boolean
  private hasSaved: boolean
  private customColumns: Record<string, unknown> = {}

  constructor(paymentProduct: PaymentProductJsonResponse | undefined) {
    super('payment_products')
    if (paymentProduct) {
      this.attributes = { ...paymentProduct }
      this.originalAttributes = { ...paymentProduct }

      Object.keys(paymentProduct).forEach((key) => {
        if (!(key in this)) {
          this.customColumns[key] = (paymentProduct as PaymentProductJsonResponse)[key]
        }
      })
    }

    this.withRelations = []
    this.selectFromQuery = DB.instance.selectFrom('payment_products')
    this.updateFromQuery = DB.instance.updateTable('payment_products')
    this.deleteFromQuery = DB.instance.deleteFrom('payment_products')
    this.hasSelect = false
    this.hasSaved = false
  }

  protected mapCustomGetters(models: PaymentProductJsonResponse | PaymentProductJsonResponse[]): void {
    const data = models

    if (Array.isArray(data)) {
      data.map((model: PaymentProductJsonResponse) => {
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

  async mapCustomSetters(model: NewPaymentProduct | PaymentProductUpdate): Promise<void> {
    const customSetter = {
      default: () => {
      },

    }

    for (const [key, fn] of Object.entries(customSetter)) {
      model[key] = await fn()
    }
  }

  get id(): number {
    return this.attributes.id
  }

  get uuid(): string | undefined {
    return this.attributes.uuid
  }

  get name(): string {
    return this.attributes.name
  }

  get description(): number | undefined {
    return this.attributes.description
  }

  get key(): number {
    return this.attributes.key
  }

  get unit_price(): number | undefined {
    return this.attributes.unit_price
  }

  get status(): string | undefined {
    return this.attributes.status
  }

  get image(): string | undefined {
    return this.attributes.image
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

  set description(value: number) {
    this.attributes.description = value
  }

  set key(value: number) {
    this.attributes.key = value
  }

  set unit_price(value: number) {
    this.attributes.unit_price = value
  }

  set status(value: string) {
    this.attributes.status = value
  }

  set image(value: string) {
    this.attributes.image = value
  }

  set provider_id(value: string) {
    this.attributes.provider_id = value
  }

  set updated_at(value: Date) {
    this.attributes.updated_at = value
  }

  getOriginal(column?: keyof PaymentProductJsonResponse): Partial<PaymentProductJsonResponse> {
    if (column) {
      return this.originalAttributes[column]
    }

    return this.originalAttributes
  }

  getChanges(): Partial<PaymentProductJsonResponse> {
    return this.fillable.reduce<Partial<PaymentProductJsonResponse>>((changes, key) => {
      const currentValue = this.attributes[key as keyof PaymentProductsTable]
      const originalValue = this.originalAttributes[key as keyof PaymentProductsTable]

      if (currentValue !== originalValue) {
        changes[key] = currentValue
      }

      return changes
    }, {})
  }

  isDirty(column?: keyof PaymentProductJsonResponse): boolean {
    if (column) {
      return this.attributes[column] !== this.originalAttributes[column]
    }

    return Object.entries(this.originalAttributes).some(([key, originalValue]) => {
      const currentValue = (this.attributes as any)[key]

      return currentValue !== originalValue
    })
  }

  isClean(column?: keyof PaymentProductJsonResponse): boolean {
    return !this.isDirty(column)
  }

  wasChanged(column?: keyof PaymentProductJsonResponse): boolean {
    return this.hasSaved && this.isDirty(column)
  }

  static select(params: (keyof PaymentProductJsonResponse)[] | RawBuilder<string> | string): PaymentProductModel {
    const instance = new PaymentProductModel(undefined)

    return instance.applySelect(params)
  }

  // Method to find a PaymentProduct by ID
  static async find(id: number): Promise<PaymentProductModel | undefined> {
    const instance = new PaymentProductModel(undefined)

    return await instance.applyFind(id)
  }

  async first(): Promise<PaymentProductModel | undefined> {
    const model = await this.applyFirst()

    const data = new PaymentProductModel(model)

    return data
  }

  static async first(): Promise<PaymentProductModel | undefined> {
    const instance = new PaymentProductModel(undefined)

    const model = await instance.applyFirst()

    const data = new PaymentProductModel(model)

    return data
  }

  async applyFirstOrFail(): Promise<PaymentProductModel | undefined> {
    const model = await this.selectFromQuery.executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, 'No PaymentProductModel results found for query')

    if (model) {
      this.mapCustomGetters(model)
      await this.loadRelations(model)
    }

    const data = new PaymentProductModel(model)

    return data
  }

  async firstOrFail(): Promise<PaymentProductModel | undefined> {
    return await this.applyFirstOrFail()
  }

  static async firstOrFail(): Promise<PaymentProductModel | undefined> {
    const instance = new PaymentProductModel(undefined)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<PaymentProductModel[]> {
    const instance = new PaymentProductModel(undefined)

    const models = await DB.instance.selectFrom('payment_products').selectAll().execute()

    instance.mapCustomGetters(models)

    const data = await Promise.all(models.map(async (model: PaymentProductJsonResponse) => {
      return new PaymentProductModel(model)
    }))

    return data
  }

  async applyFindOrFail(id: number): Promise<PaymentProductModel> {
    const model = await DB.instance.selectFrom('payment_products').where('id', '=', id).selectAll().executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, `No PaymentProductModel results for ${id}`)

    cache.getOrSet(`paymentProduct:${id}`, JSON.stringify(model))

    this.mapCustomGetters(model)
    await this.loadRelations(model)

    const data = new PaymentProductModel(model)

    return data
  }

  async findOrFail(id: number): Promise<PaymentProductModel> {
    return await this.applyFindOrFail(id)
  }

  static async findOrFail(id: number): Promise<PaymentProductModel> {
    const instance = new PaymentProductModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  static async findMany(ids: number[]): Promise<PaymentProductModel[]> {
    const instance = new PaymentProductModel(undefined)

    const models = await instance.applyFindMany(ids)

    return models.map((modelItem: UserJsonResponse) => instance.parseResult(new PaymentProductModel(modelItem)))
  }

  async findMany(ids: number[]): Promise<PaymentProductModel[]> {
    const models = await this.applyFindMany(ids)

    return models.map((modelItem: UserJsonResponse) => this.parseResult(new PaymentProductModel(modelItem)))
  }

  skip(count: number): PaymentProductModel {
    this.selectFromQuery = this.selectFromQuery.offset(count)

    return this
  }

  static skip(count: number): PaymentProductModel {
    const instance = new PaymentProductModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.offset(count)

    return instance
  }

  async applyChunk(size: number, callback: (models: PaymentProductModel[]) => Promise<void>): Promise<void> {
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

  async chunk(size: number, callback: (models: PaymentProductModel[]) => Promise<void>): Promise<void> {
    await this.applyChunk(size, callback)
  }

  static async chunk(size: number, callback: (models: PaymentProductModel[]) => Promise<void>): Promise<void> {
    const instance = new PaymentProductModel(undefined)

    await instance.applyChunk(size, callback)
  }

  take(count: number): PaymentProductModel {
    this.selectFromQuery = this.selectFromQuery.limit(count)

    return this
  }

  static take(count: number): PaymentProductModel {
    const instance = new PaymentProductModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.limit(count)

    return instance
  }

  static async pluck<K extends keyof PaymentProductModel>(field: K): Promise<PaymentProductModel[K][]> {
    const instance = new PaymentProductModel(undefined)

    if (instance.hasSelect) {
      const model = await instance.selectFromQuery.execute()
      return model.map((modelItem: PaymentProductModel) => modelItem[field])
    }

    const model = await instance.selectFromQuery.selectAll().execute()

    return model.map((modelItem: PaymentProductModel) => modelItem[field])
  }

  async pluck<K extends keyof PaymentProductModel>(field: K): Promise<PaymentProductModel[K][]> {
    if (this.hasSelect) {
      const model = await this.selectFromQuery.execute()
      return model.map((modelItem: PaymentProductModel) => modelItem[field])
    }

    const model = await this.selectFromQuery.selectAll().execute()

    return model.map((modelItem: PaymentProductModel) => modelItem[field])
  }

  static async count(): Promise<number> {
    const instance = new PaymentProductModel(undefined)

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

  static async max(field: keyof PaymentProductModel): Promise<number> {
    const instance = new PaymentProductModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`MAX(${sql.raw(field as string)}) as max `)
      .executeTakeFirst()

    return result.max
  }

  async max(field: keyof PaymentProductModel): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`MAX(${sql.raw(field as string)}) as max`)
      .executeTakeFirst()

    return result.max
  }

  static async min(field: keyof PaymentProductModel): Promise<number> {
    const instance = new PaymentProductModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`MIN(${sql.raw(field as string)}) as min `)
      .executeTakeFirst()

    return result.min
  }

  async min(field: keyof PaymentProductModel): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`MIN(${sql.raw(field as string)}) as min `)
      .executeTakeFirst()

    return result.min
  }

  static async avg(field: keyof PaymentProductModel): Promise<number> {
    const instance = new PaymentProductModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`AVG(${sql.raw(field as string)}) as avg `)
      .executeTakeFirst()

    return result.avg
  }

  async avg(field: keyof PaymentProductModel): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`AVG(${sql.raw(field as string)}) as avg `)
      .executeTakeFirst()

    return result.avg
  }

  static async sum(field: keyof PaymentProductModel): Promise<number> {
    const instance = new PaymentProductModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`SUM(${sql.raw(field as string)}) as sum `)
      .executeTakeFirst()

    return result.sum
  }

  async sum(field: keyof PaymentProductModel): Promise<number> {
    const result = this.selectFromQuery
      .select(sql`SUM(${sql.raw(field as string)}) as sum `)
      .executeTakeFirst()

    return result.sum
  }

  async applyGet(): Promise<PaymentProductModel[]> {
    let models

    if (this.hasSelect) {
      models = await this.selectFromQuery.execute()
    }
    else {
      models = await this.selectFromQuery.selectAll().execute()
    }

    this.mapCustomGetters(models)
    await this.loadRelations(models)

    const data = await Promise.all(models.map(async (model: PaymentProductJsonResponse) => {
      return new PaymentProductModel(model)
    }))

    return data
  }

  async get(): Promise<PaymentProductModel[]> {
    return await this.applyGet()
  }

  static async get(): Promise<PaymentProductModel[]> {
    const instance = new PaymentProductModel(undefined)

    return await instance.applyGet()
  }

  has(relation: string): PaymentProductModel {
    this.selectFromQuery = this.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(
        selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.paymentProduct_id`, '=', 'payment_products.id'),
      ),
    )

    return this
  }

  static has(relation: string): PaymentProductModel {
    const instance = new PaymentProductModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(
        selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.paymentProduct_id`, '=', 'payment_products.id'),
      ),
    )

    return instance
  }

  static whereExists(callback: (qb: any) => any): PaymentProductModel {
    const instance = new PaymentProductModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(callback({ exists, selectFrom })),
    )

    return instance
  }

  applyWhereHas(
    relation: string,
    callback: (query: SubqueryBuilder<keyof PaymentProductModel>) => void,
  ): PaymentProductModel {
    const subqueryBuilder = new SubqueryBuilder()

    callback(subqueryBuilder)
    const conditions = subqueryBuilder.getConditions()

    this.selectFromQuery = this.selectFromQuery
      .where(({ exists, selectFrom }: any) => {
        let subquery = selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.paymentProduct_id`, '=', 'payment_products.id')

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
    callback: (query: SubqueryBuilder<keyof PaymentProductModel>) => void,
  ): PaymentProductModel {
    return this.applyWhereHas(relation, callback)
  }

  static whereHas(
    relation: string,
    callback: (query: SubqueryBuilder<keyof PaymentProductModel>) => void,
  ): PaymentProductModel {
    const instance = new PaymentProductModel(undefined)

    return instance.applyWhereHas(relation, callback)
  }

  applyDoesntHave(relation: string): PaymentProductModel {
    this.selectFromQuery = this.selectFromQuery.where(({ not, exists, selectFrom }: any) =>
      not(
        exists(
          selectFrom(relation)
            .select('1')
            .whereRef(`${relation}.paymentProduct_id`, '=', 'payment_products.id'),
        ),
      ),
    )

    return this
  }

  doesntHave(relation: string): PaymentProductModel {
    return this.applyDoesntHave(relation)
  }

  static doesntHave(relation: string): PaymentProductModel {
    const instance = new PaymentProductModel(undefined)

    return instance.applyDoesntHave(relation)
  }

  applyWhereDoesntHave(relation: string, callback: (query: SubqueryBuilder<PaymentProductsTable>) => void): PaymentProductModel {
    const subqueryBuilder = new SubqueryBuilder()

    callback(subqueryBuilder)
    const conditions = subqueryBuilder.getConditions()

    this.selectFromQuery = this.selectFromQuery
      .where(({ exists, selectFrom, not }: any) => {
        const subquery = selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.paymentProduct_id`, '=', 'payment_products.id')

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

  whereDoesntHave(relation: string, callback: (query: SubqueryBuilder<PaymentProductsTable>) => void): PaymentProductModel {
    return this.applyWhereDoesntHave(relation, callback)
  }

  static whereDoesntHave(
    relation: string,
    callback: (query: SubqueryBuilder<PaymentProductsTable>) => void,
  ): PaymentProductModel {
    const instance = new PaymentProductModel(undefined)

    return instance.applyWhereDoesntHave(relation, callback)
  }

  async applyPaginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<PaymentProductResponse> {
    const totalRecordsResult = await DB.instance.selectFrom('payment_products')
      .select(DB.instance.fn.count('id').as('total')) // Use 'id' or another actual column name
      .executeTakeFirst()

    const totalRecords = Number(totalRecordsResult?.total) || 0
    const totalPages = Math.ceil(totalRecords / (options.limit ?? 10))

    const payment_productsWithExtra = await DB.instance.selectFrom('payment_products')
      .selectAll()
      .orderBy('id', 'asc') // Assuming 'id' is used for cursor-based pagination
      .limit((options.limit ?? 10) + 1) // Fetch one extra record
      .offset(((options.page ?? 1) - 1) * (options.limit ?? 10)) // Ensure options.page is not undefined
      .execute()

    let nextCursor = null
    if (payment_productsWithExtra.length > (options.limit ?? 10))
      nextCursor = payment_productsWithExtra.pop()?.id ?? null

    return {
      data: payment_productsWithExtra,
      paging: {
        total_records: totalRecords,
        page: options.page || 1,
        total_pages: totalPages,
      },
      next_cursor: nextCursor,
    }
  }

  async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<PaymentProductResponse> {
    return await this.applyPaginate(options)
  }

  // Method to get all payment_products
  static async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<PaymentProductResponse> {
    const instance = new PaymentProductModel(undefined)

    return await instance.applyPaginate(options)
  }

  async applyCreate(newPaymentProduct: NewPaymentProduct): Promise<PaymentProductModel> {
    const filteredValues = Object.fromEntries(
      Object.entries(newPaymentProduct).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewPaymentProduct

    await this.mapCustomSetters(filteredValues)

    filteredValues.uuid = randomUUIDv7()

    const result = await DB.instance.insertInto('payment_products')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await this.find(Number(result.numInsertedOrUpdatedRows)) as PaymentProductModel

    return model
  }

  async create(newPaymentProduct: NewPaymentProduct): Promise<PaymentProductModel> {
    return await this.applyCreate(newPaymentProduct)
  }

  static async create(newPaymentProduct: NewPaymentProduct): Promise<PaymentProductModel> {
    const instance = new PaymentProductModel(undefined)

    return await instance.applyCreate(newPaymentProduct)
  }

  static async createMany(newPaymentProduct: NewPaymentProduct[]): Promise<void> {
    const instance = new PaymentProductModel(undefined)

    const valuesFiltered = newPaymentProduct.map((newPaymentProduct: NewPaymentProduct) => {
      const filteredValues = Object.fromEntries(
        Object.entries(newPaymentProduct).filter(([key]) =>
          !instance.guarded.includes(key) && instance.fillable.includes(key),
        ),
      ) as NewPaymentProduct

      filteredValues.uuid = randomUUIDv7()

      return filteredValues
    })

    await DB.instance.insertInto('payment_products')
      .values(valuesFiltered)
      .executeTakeFirst()
  }

  static async forceCreate(newPaymentProduct: NewPaymentProduct): Promise<PaymentProductModel> {
    const result = await DB.instance.insertInto('payment_products')
      .values(newPaymentProduct)
      .executeTakeFirst()

    const model = await find(Number(result.numInsertedOrUpdatedRows)) as PaymentProductModel

    return model
  }

  // Method to remove a PaymentProduct
  static async remove(id: number): Promise<any> {
    return await DB.instance.deleteFrom('payment_products')
      .where('id', '=', id)
      .execute()
  }

  static where<V = string>(column: keyof PaymentProductsTable, ...args: [V] | [Operator, V]): PaymentProductModel {
    const instance = new PaymentProductModel(undefined)

    return instance.applyWhere<V>(column, ...args)
  }

  static whereColumn(first: keyof PaymentProductsTable, operator: Operator, second: keyof PaymentProductsTable): PaymentProductModel {
    const instance = new PaymentProductModel(undefined)

    instance.selectFromQuery = instance.applyWhereColumn(first, operator, second)

    return instance
  }

  static whereRef(column: keyof PaymentProductsTable, ...args: string[]): PaymentProductModel {
    const instance = new PaymentProductModel(undefined)

    return instance.applyWhereRef(column, ...args)
  }

  static whereRaw(sqlStatement: string): PaymentProductModel {
    const instance = new PaymentProductModel(undefined)

    instance.selectFromQuery = instance.applyWhereRaw(sqlStatement)

    return instance
  }

  static orWhere(...conditions: [string, any][]): PaymentProductModel {
    const instance = new PaymentProductModel(undefined)

    return instance.applyOrWhere(...conditions)
  }

  static when(condition: boolean, callback: (query: PaymentProductModel) => PaymentProductModel): PaymentProductModel {
    const instance = new PaymentProductModel(undefined)

    return instance.applyWhen(condition, callback)
  }

  static whereNotNull(column: keyof PaymentProductsTable): PaymentProductModel {
    const instance = new UserModel(undefined)

    return instance.applyWhereNotNull(column)
  }

  static whereNull(column: keyof PaymentProductsTable): PaymentProductModel {
    const instance = new PaymentProductModel(undefined)

    return instance.applyWhereNull(column)
  }

  static whereName(value: string): PaymentProductModel {
    const instance = new PaymentProductModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('name', '=', value)

    return instance
  }

  static whereDescription(value: string): PaymentProductModel {
    const instance = new PaymentProductModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('description', '=', value)

    return instance
  }

  static whereKey(value: string): PaymentProductModel {
    const instance = new PaymentProductModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('key', '=', value)

    return instance
  }

  static whereUnitPrice(value: string): PaymentProductModel {
    const instance = new PaymentProductModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('unitPrice', '=', value)

    return instance
  }

  static whereStatus(value: string): PaymentProductModel {
    const instance = new PaymentProductModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('status', '=', value)

    return instance
  }

  static whereImage(value: string): PaymentProductModel {
    const instance = new PaymentProductModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('image', '=', value)

    return instance
  }

  static whereProviderId(value: string): PaymentProductModel {
    const instance = new PaymentProductModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('providerId', '=', value)

    return instance
  }

  static whereIn<V = number>(column: keyof PaymentProductsTable, values: V[]): PaymentProductModel {
    const instance = new PaymentProductModel(undefined)

    return instance.applyWhereIn<V>(column, values)
  }

  static whereBetween<V = number>(column: keyof PaymentProductsTable, range: [V, V]): PaymentProductModel {
    const instance = new PaymentProductModel(undefined)

    return instance.applyWhereBetween<V>(column, range)
  }

  static whereLike(column: keyof PaymentProductsTable, value: string): PaymentProductModel {
    const instance = new PaymentProductModel(undefined)

    return instance.applyWhereLike(column, value)
  }

  static whereNotIn<V = number>(column: keyof PaymentProductsTable, values: V[]): PaymentProductModel {
    const instance = new PaymentProductModel(undefined)

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

  static async latest(): Promise<PaymentProductModel | undefined> {
    const instance = new PaymentProductModel(undefined)

    const model = await DB.instance.selectFrom('payment_products')
      .selectAll()
      .orderBy('id', 'desc')
      .executeTakeFirst()

    if (!model)
      return undefined

    instance.mapCustomGetters(model)

    const data = new PaymentProductModel(model)

    return data
  }

  static async oldest(): Promise<PaymentProductModel | undefined> {
    const instance = new PaymentProductModel(undefined)

    const model = await DB.instance.selectFrom('payment_products')
      .selectAll()
      .orderBy('id', 'asc')
      .executeTakeFirst()

    if (!model)
      return undefined

    instance.mapCustomGetters(model)

    const data = new PaymentProductModel(model)

    return data
  }

  static async firstOrCreate(
    condition: Partial<PaymentProductJsonResponse>,
    newPaymentProduct: NewPaymentProduct,
  ): Promise<PaymentProductModel> {
    const instance = new PaymentProductModel(undefined)

    const key = Object.keys(condition)[0] as keyof PaymentProductJsonResponse

    if (!key) {
      throw new HttpError(500, 'Condition must contain at least one key-value pair')
    }

    const value = condition[key]

    // Attempt to find the first record matching the condition
    const existingPaymentProduct = await DB.instance.selectFrom('payment_products')
      .selectAll()
      .where(key, '=', value)
      .executeTakeFirst()

    if (existingPaymentProduct) {
      instance.mapCustomGetters(existingPaymentProduct)
      await instance.loadRelations(existingPaymentProduct)

      return new PaymentProductModel(existingPaymentProduct as PaymentProductJsonResponse)
    }
    else {
      return await instance.create(newPaymentProduct)
    }
  }

  static async updateOrCreate(
    condition: Partial<PaymentProductJsonResponse>,
    newPaymentProduct: NewPaymentProduct,
  ): Promise<PaymentProductModel> {
    const instance = new PaymentProductModel(undefined)

    const key = Object.keys(condition)[0] as keyof PaymentProductJsonResponse

    if (!key) {
      throw new HttpError(500, 'Condition must contain at least one key-value pair')
    }

    const value = condition[key]

    // Attempt to find the first record matching the condition
    const existingPaymentProduct = await DB.instance.selectFrom('payment_products')
      .selectAll()
      .where(key, '=', value)
      .executeTakeFirst()

    if (existingPaymentProduct) {
      // If found, update the existing record
      await DB.instance.updateTable('payment_products')
        .set(newPaymentProduct)
        .where(key, '=', value)
        .executeTakeFirstOrThrow()

      // Fetch and return the updated record
      const updatedPaymentProduct = await DB.instance.selectFrom('payment_products')
        .selectAll()
        .where(key, '=', value)
        .executeTakeFirst()

      if (!updatedPaymentProduct) {
        throw new HttpError(500, 'Failed to fetch updated record')
      }

      instance.hasSaved = true

      return new PaymentProductModel(updatedPaymentProduct as PaymentProductJsonResponse)
    }
    else {
      // If not found, create a new record
      return await instance.create(newPaymentProduct)
    }
  }

  protected async loadRelations(models: PaymentProductJsonResponse | PaymentProductJsonResponse[]): Promise<void> {
    // Handle both single model and array of models
    const modelArray = Array.isArray(models) ? models : [models]
    if (!modelArray.length)
      return

    const modelIds = modelArray.map(model => model.id)

    for (const relation of this.withRelations) {
      const relatedRecords = await DB.instance
        .selectFrom(relation)
        .where('paymentProduct_id', 'in', modelIds)
        .selectAll()
        .execute()

      if (Array.isArray(models)) {
        models.map((model: PaymentProductJsonResponse) => {
          const records = relatedRecords.filter((record: { paymentProduct_id: number }) => {
            return record.paymentProduct_id === model.id
          })

          model[relation] = records.length === 1 ? records[0] : records
          return model
        })
      }
      else {
        const records = relatedRecords.filter((record: { paymentProduct_id: number }) => {
          return record.paymentProduct_id === models.id
        })

        models[relation] = records.length === 1 ? records[0] : records
      }
    }
  }

  static with(relations: string[]): PaymentProductModel {
    const instance = new PaymentProductModel(undefined)

    instance.withRelations = relations

    return instance
  }

  async last(): Promise<PaymentProductModel | undefined> {
    const model = await this.applyLast()

    const data = new PaymentProductModel(model)

    return data
  }

  static async last(): Promise<PaymentProductModel | undefined> {
    const instance = new PaymentProductModel(undefined)

    const model = await instance.applyLast()

    if (!model)
      return undefined

    const data = new PaymentProductModel(model)

    return data
  }

  static orderBy(column: keyof PaymentProductsTable, order: 'asc' | 'desc'): PaymentProductModel {
    const instance = new UserModel(undefined)

    return instance.applyOrderBy(column, order)
  }

  static groupBy(column: keyof PaymentProductsTable): PaymentProductModel {
    const instance = new PaymentProductModel(undefined)

    return instance.applyGroupBy(column)
  }

  static having<V = string>(column: keyof PaymentProductsTable, operator: Operator, value: V): PaymentProductModel {
    const instance = new PaymentProductModel(undefined)

    return instance.applyHaving(column, operator, value)
  }

  static inRandomOrder(): PaymentProductModel {
    const instance = new PaymentProductModel(undefined)

    return instance.applyInRandomOrder()
  }

  static orderByDesc(column: keyof PaymentProductsTable): PaymentProductModel {
    const instance = new PaymentProductModel(undefined)

    return instance.applyOrderByDesc(column)
  }

  static orderByAsc(column: keyof PaymentProductsTable): PaymentProductModel {
    const instance = new PaymentProductModel(undefined)

    return instance.applyOrderByAsc(column)
  }

  async update(newPaymentProduct: PaymentProductUpdate): Promise<PaymentProductModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newPaymentProduct).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewPaymentProduct

    await this.mapCustomSetters(filteredValues)

    await DB.instance.updateTable('payment_products')
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

  async forceUpdate(paymentProduct: PaymentProductUpdate): Promise<PaymentProductModel | undefined> {
    if (this.id === undefined) {
      this.updateFromQuery.set(paymentProduct).execute()
    }

    await this.mapCustomSetters(paymentProduct)

    await DB.instance.updateTable('payment_products')
      .set(paymentProduct)
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
      throw new HttpError(500, 'PaymentProduct data is undefined')

    await this.mapCustomSetters(this.attributes)

    if (this.id === undefined) {
      await this.create(this.attributes)
    }
    else {
      await this.update(this.attributes)
    }

    this.hasSaved = true
  }

  fill(data: Partial<PaymentProductJsonResponse>): PaymentProductModel {
    const filteredValues = Object.fromEntries(
      Object.entries(data).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewPaymentProduct

    this.attributes = {
      ...this.attributes,
      ...filteredValues,
    }

    return this
  }

  forceFill(data: Partial<PaymentProductJsonResponse>): PaymentProductModel {
    this.attributes = {
      ...this.attributes,
      ...data,
    }

    return this
  }

  // Method to delete (soft delete) the paymentProduct instance
  async delete(): Promise<PaymentProductsTable> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()

    return await DB.instance.deleteFrom('payment_products')
      .where('id', '=', this.id)
      .execute()
  }

  distinct(column: keyof PaymentProductJsonResponse): PaymentProductModel {
    this.selectFromQuery = this.selectFromQuery.select(column).distinct()

    this.hasSelect = true

    return this
  }

  static distinct(column: keyof PaymentProductJsonResponse): PaymentProductModel {
    const instance = new PaymentProductModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.select(column).distinct()

    instance.hasSelect = true

    return instance
  }

  join(table: string, firstCol: string, secondCol: string): PaymentProductModel {
    this.selectFromQuery = this.selectFromQuery.innerJoin(table, firstCol, secondCol)

    return this
  }

  static join(table: string, firstCol: string, secondCol: string): PaymentProductModel {
    const instance = new PaymentProductModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.innerJoin(table, firstCol, secondCol)

    return instance
  }

  toJSON(): PaymentProductJsonResponse {
    const output = {

      uuid: this.uuid,

      id: this.id,
      name: this.name,
      description: this.description,
      key: this.key,
      unit_price: this.unit_price,
      status: this.status,
      image: this.image,
      provider_id: this.provider_id,

      created_at: this.created_at,

      updated_at: this.updated_at,

      ...this.customColumns,
    }

    return output
  }

  parseResult(model: PaymentProductModel): PaymentProductModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof PaymentProductModel]
    }

    return model
  }
}

async function find(id: number): Promise<PaymentProductModel | undefined> {
  const query = DB.instance.selectFrom('payment_products').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  return new PaymentProductModel(model)
}

export async function count(): Promise<number> {
  const results = await PaymentProductModel.count()

  return results
}

export async function create(newPaymentProduct: NewPaymentProduct): Promise<PaymentProductModel> {
  const result = await DB.instance.insertInto('payment_products')
    .values(newPaymentProduct)
    .executeTakeFirstOrThrow()

  return await find(Number(result.numInsertedOrUpdatedRows)) as PaymentProductModel
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(DB.instance)
}

export async function remove(id: number): Promise<void> {
  await DB.instance.deleteFrom('payment_products')
    .where('id', '=', id)
    .execute()
}

export async function whereName(value: string): Promise<PaymentProductModel[]> {
  const query = DB.instance.selectFrom('payment_products').where('name', '=', value)
  const results: PaymentProductJsonResponse = await query.execute()

  return results.map((modelItem: PaymentProductJsonResponse) => new PaymentProductModel(modelItem))
}

export async function whereDescription(value: number): Promise<PaymentProductModel[]> {
  const query = DB.instance.selectFrom('payment_products').where('description', '=', value)
  const results: PaymentProductJsonResponse = await query.execute()

  return results.map((modelItem: PaymentProductJsonResponse) => new PaymentProductModel(modelItem))
}

export async function whereKey(value: number): Promise<PaymentProductModel[]> {
  const query = DB.instance.selectFrom('payment_products').where('key', '=', value)
  const results: PaymentProductJsonResponse = await query.execute()

  return results.map((modelItem: PaymentProductJsonResponse) => new PaymentProductModel(modelItem))
}

export async function whereUnitPrice(value: number): Promise<PaymentProductModel[]> {
  const query = DB.instance.selectFrom('payment_products').where('unit_price', '=', value)
  const results: PaymentProductJsonResponse = await query.execute()

  return results.map((modelItem: PaymentProductJsonResponse) => new PaymentProductModel(modelItem))
}

export async function whereStatus(value: string): Promise<PaymentProductModel[]> {
  const query = DB.instance.selectFrom('payment_products').where('status', '=', value)
  const results: PaymentProductJsonResponse = await query.execute()

  return results.map((modelItem: PaymentProductJsonResponse) => new PaymentProductModel(modelItem))
}

export async function whereImage(value: string): Promise<PaymentProductModel[]> {
  const query = DB.instance.selectFrom('payment_products').where('image', '=', value)
  const results: PaymentProductJsonResponse = await query.execute()

  return results.map((modelItem: PaymentProductJsonResponse) => new PaymentProductModel(modelItem))
}

export async function whereProviderId(value: string): Promise<PaymentProductModel[]> {
  const query = DB.instance.selectFrom('payment_products').where('provider_id', '=', value)
  const results: PaymentProductJsonResponse = await query.execute()

  return results.map((modelItem: PaymentProductJsonResponse) => new PaymentProductModel(modelItem))
}

export const PaymentProduct = PaymentProductModel

export default PaymentProduct
