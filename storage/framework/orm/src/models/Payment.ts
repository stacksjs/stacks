import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { CustomerModel } from './Customer'
import type { OrderModel } from './Order'
import { randomUUIDv7 } from 'bun'
import { cache } from '@stacksjs/cache'
import { sql } from '@stacksjs/database'
import { HttpError, ModelNotFoundException } from '@stacksjs/error-handling'
import { dispatch } from '@stacksjs/events'

import { BaseOrm, DB, SubqueryBuilder } from '@stacksjs/orm'

import Customer from './Customer'

import Order from './Order'

export interface PaymentsTable {
  id: Generated<number>
  order_id: number
  customer_id: number
  amount: number
  method: string
  status: string
  currency?: string
  reference_number?: string
  card_last_four?: string
  card_brand?: string
  billing_email?: string
  transaction_id?: string
  payment_provider?: string
  refund_amount?: number
  notes?: string
  uuid?: string

  created_at?: Date

  updated_at?: Date

}

export interface PaymentResponse {
  data: PaymentJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface PaymentJsonResponse extends Omit<Selectable<PaymentsTable>, 'password'> {
  [key: string]: any
}

export type NewPayment = Insertable<PaymentsTable>
export type PaymentUpdate = Updateable<PaymentsTable>

      type SortDirection = 'asc' | 'desc'
interface SortOptions { column: PaymentJsonResponse, order: SortDirection }
// Define a type for the options parameter
interface QueryOptions {
  sort?: SortOptions
  limit?: number
  offset?: number
  page?: number
}

export class PaymentModel extends BaseOrm<PaymentModel, PaymentsTable, PaymentJsonResponse> {
  private readonly hidden: Array<keyof PaymentJsonResponse> = []
  private readonly fillable: Array<keyof PaymentJsonResponse> = ['amount', 'method', 'status', 'currency', 'reference_number', 'card_last_four', 'card_brand', 'billing_email', 'transaction_id', 'payment_provider', 'refund_amount', 'notes', 'uuid']
  private readonly guarded: Array<keyof PaymentJsonResponse> = []
  protected attributes = {} as PaymentJsonResponse
  protected originalAttributes = {} as PaymentJsonResponse

  protected selectFromQuery: any
  protected updateFromQuery: any
  protected deleteFromQuery: any
  protected hasSelect: boolean
  private hasSaved: boolean
  private customColumns: Record<string, unknown> = {}

  constructor(payment: PaymentJsonResponse | undefined) {
    super('payments')
    if (payment) {
      this.attributes = { ...payment }
      this.originalAttributes = { ...payment }

      Object.keys(payment).forEach((key) => {
        if (!(key in this)) {
          this.customColumns[key] = (payment as PaymentJsonResponse)[key]
        }
      })
    }

    this.withRelations = []
    this.selectFromQuery = DB.instance.selectFrom('payments')
    this.updateFromQuery = DB.instance.updateTable('payments')
    this.deleteFromQuery = DB.instance.deleteFrom('payments')
    this.hasSelect = false
    this.hasSaved = false
  }

  protected mapCustomGetters(models: PaymentJsonResponse | PaymentJsonResponse[]): void {
    const data = models

    if (Array.isArray(data)) {
      data.map((model: PaymentJsonResponse) => {
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

  async mapCustomSetters(model: NewPayment | PaymentUpdate): Promise<void> {
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

  get customer_id(): number {
    return this.attributes.customer_id
  }

  get customer(): CustomerModel | undefined {
    return this.attributes.customer
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

  get method(): string {
    return this.attributes.method
  }

  get status(): string {
    return this.attributes.status
  }

  get currency(): string | undefined {
    return this.attributes.currency
  }

  get reference_number(): string | undefined {
    return this.attributes.reference_number
  }

  get card_last_four(): string | undefined {
    return this.attributes.card_last_four
  }

  get card_brand(): string | undefined {
    return this.attributes.card_brand
  }

  get billing_email(): string | undefined {
    return this.attributes.billing_email
  }

  get transaction_id(): string | undefined {
    return this.attributes.transaction_id
  }

  get payment_provider(): string | undefined {
    return this.attributes.payment_provider
  }

  get refund_amount(): number | undefined {
    return this.attributes.refund_amount
  }

  get notes(): string | undefined {
    return this.attributes.notes
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

  set method(value: string) {
    this.attributes.method = value
  }

  set status(value: string) {
    this.attributes.status = value
  }

  set currency(value: string) {
    this.attributes.currency = value
  }

  set reference_number(value: string) {
    this.attributes.reference_number = value
  }

  set card_last_four(value: string) {
    this.attributes.card_last_four = value
  }

  set card_brand(value: string) {
    this.attributes.card_brand = value
  }

  set billing_email(value: string) {
    this.attributes.billing_email = value
  }

  set transaction_id(value: string) {
    this.attributes.transaction_id = value
  }

  set payment_provider(value: string) {
    this.attributes.payment_provider = value
  }

  set refund_amount(value: number) {
    this.attributes.refund_amount = value
  }

  set notes(value: string) {
    this.attributes.notes = value
  }

  set updated_at(value: Date) {
    this.attributes.updated_at = value
  }

  getOriginal(column?: keyof PaymentJsonResponse): Partial<PaymentJsonResponse> {
    if (column) {
      return this.originalAttributes[column]
    }

    return this.originalAttributes
  }

  getChanges(): Partial<PaymentJsonResponse> {
    return this.fillable.reduce<Partial<PaymentJsonResponse>>((changes, key) => {
      const currentValue = this.attributes[key as keyof PaymentsTable]
      const originalValue = this.originalAttributes[key as keyof PaymentsTable]

      if (currentValue !== originalValue) {
        changes[key] = currentValue
      }

      return changes
    }, {})
  }

  isDirty(column?: keyof PaymentJsonResponse): boolean {
    if (column) {
      return this.attributes[column] !== this.originalAttributes[column]
    }

    return Object.entries(this.originalAttributes).some(([key, originalValue]) => {
      const currentValue = (this.attributes as any)[key]

      return currentValue !== originalValue
    })
  }

  isClean(column?: keyof PaymentJsonResponse): boolean {
    return !this.isDirty(column)
  }

  wasChanged(column?: keyof PaymentJsonResponse): boolean {
    return this.hasSaved && this.isDirty(column)
  }

  static select(params: (keyof PaymentJsonResponse)[] | RawBuilder<string> | string): PaymentModel {
    const instance = new PaymentModel(undefined)

    return instance.applySelect(params)
  }

  // Method to find a Payment by ID
  static async find(id: number): Promise<PaymentModel | undefined> {
    const instance = new PaymentModel(undefined)

    return await instance.applyFind(id)
  }

  async first(): Promise<PaymentModel | undefined> {
    const model = await this.applyFirst()

    const data = new PaymentModel(model)

    return data
  }

  static async first(): Promise<PaymentModel | undefined> {
    const instance = new PaymentModel(undefined)

    const model = await instance.applyFirst()

    const data = new PaymentModel(model)

    return data
  }

  async applyFirstOrFail(): Promise<PaymentModel | undefined> {
    const model = await this.selectFromQuery.executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, 'No PaymentModel results found for query')

    if (model) {
      this.mapCustomGetters(model)
      await this.loadRelations(model)
    }

    const data = new PaymentModel(model)

    return data
  }

  async firstOrFail(): Promise<PaymentModel | undefined> {
    return await this.applyFirstOrFail()
  }

  static async firstOrFail(): Promise<PaymentModel | undefined> {
    const instance = new PaymentModel(undefined)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<PaymentModel[]> {
    const instance = new PaymentModel(undefined)

    const models = await DB.instance.selectFrom('payments').selectAll().execute()

    instance.mapCustomGetters(models)

    const data = await Promise.all(models.map(async (model: PaymentJsonResponse) => {
      return new PaymentModel(model)
    }))

    return data
  }

  async applyFindOrFail(id: number): Promise<PaymentModel> {
    const model = await DB.instance.selectFrom('payments').where('id', '=', id).selectAll().executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, `No PaymentModel results for ${id}`)

    cache.getOrSet(`payment:${id}`, JSON.stringify(model))

    this.mapCustomGetters(model)
    await this.loadRelations(model)

    const data = new PaymentModel(model)

    return data
  }

  async findOrFail(id: number): Promise<PaymentModel> {
    return await this.applyFindOrFail(id)
  }

  static async findOrFail(id: number): Promise<PaymentModel> {
    const instance = new PaymentModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  static async findMany(ids: number[]): Promise<PaymentModel[]> {
    const instance = new PaymentModel(undefined)

    const models = await instance.applyFindMany(ids)

    return models.map((modelItem: UserJsonResponse) => instance.parseResult(new PaymentModel(modelItem)))
  }

  async findMany(ids: number[]): Promise<PaymentModel[]> {
    const models = await this.applyFindMany(ids)

    return models.map((modelItem: UserJsonResponse) => this.parseResult(new PaymentModel(modelItem)))
  }

  skip(count: number): PaymentModel {
    this.selectFromQuery = this.selectFromQuery.offset(count)

    return this
  }

  static skip(count: number): PaymentModel {
    const instance = new PaymentModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.offset(count)

    return instance
  }

  async applyChunk(size: number, callback: (models: PaymentModel[]) => Promise<void>): Promise<void> {
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

  async chunk(size: number, callback: (models: PaymentModel[]) => Promise<void>): Promise<void> {
    await this.applyChunk(size, callback)
  }

  static async chunk(size: number, callback: (models: PaymentModel[]) => Promise<void>): Promise<void> {
    const instance = new PaymentModel(undefined)

    await instance.applyChunk(size, callback)
  }

  static take(count: number): PaymentModel {
    const instance = new PaymentModel(undefined)

    return instance.applyTake(count)
  }

  static async pluck<K extends keyof PaymentModel>(field: K): Promise<PaymentModel[K][]> {
    const instance = new PaymentModel(undefined)

    if (instance.hasSelect) {
      const model = await instance.selectFromQuery.execute()
      return model.map((modelItem: PaymentModel) => modelItem[field])
    }

    const model = await instance.selectFromQuery.selectAll().execute()

    return model.map((modelItem: PaymentModel) => modelItem[field])
  }

  async pluck<K extends keyof PaymentModel>(field: K): Promise<PaymentModel[K][]> {
    if (this.hasSelect) {
      const model = await this.selectFromQuery.execute()
      return model.map((modelItem: PaymentModel) => modelItem[field])
    }

    const model = await this.selectFromQuery.selectAll().execute()

    return model.map((modelItem: PaymentModel) => modelItem[field])
  }

  static async count(): Promise<number> {
    const instance = new PaymentModel(undefined)

    return instance.applyCount()
  }

  static async max(field: keyof PaymentModel): Promise<number> {
    const instance = new PaymentModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`MAX(${sql.raw(field as string)}) as max `)
      .executeTakeFirst()

    return result.max
  }

  async max(field: keyof PaymentModel): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`MAX(${sql.raw(field as string)}) as max`)
      .executeTakeFirst()

    return result.max
  }

  static async min(field: keyof PaymentModel): Promise<number> {
    const instance = new PaymentModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`MIN(${sql.raw(field as string)}) as min `)
      .executeTakeFirst()

    return result.min
  }

  async min(field: keyof PaymentModel): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`MIN(${sql.raw(field as string)}) as min `)
      .executeTakeFirst()

    return result.min
  }

  static async avg(field: keyof PaymentModel): Promise<number> {
    const instance = new PaymentModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`AVG(${sql.raw(field as string)}) as avg `)
      .executeTakeFirst()

    return result.avg
  }

  async avg(field: keyof PaymentModel): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`AVG(${sql.raw(field as string)}) as avg `)
      .executeTakeFirst()

    return result.avg
  }

  static async sum(field: keyof PaymentModel): Promise<number> {
    const instance = new PaymentModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`SUM(${sql.raw(field as string)}) as sum `)
      .executeTakeFirst()

    return result.sum
  }

  async sum(field: keyof PaymentModel): Promise<number> {
    const result = this.selectFromQuery
      .select(sql`SUM(${sql.raw(field as string)}) as sum `)
      .executeTakeFirst()

    return result.sum
  }

  async applyGet(): Promise<PaymentModel[]> {
    let models

    if (this.hasSelect) {
      models = await this.selectFromQuery.execute()
    }
    else {
      models = await this.selectFromQuery.selectAll().execute()
    }

    this.mapCustomGetters(models)
    await this.loadRelations(models)

    const data = await Promise.all(models.map(async (model: PaymentJsonResponse) => {
      return new PaymentModel(model)
    }))

    return data
  }

  async get(): Promise<PaymentModel[]> {
    return await this.applyGet()
  }

  static async get(): Promise<PaymentModel[]> {
    const instance = new PaymentModel(undefined)

    return await instance.applyGet()
  }

  has(relation: string): PaymentModel {
    this.selectFromQuery = this.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(
        selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.payment_id`, '=', 'payments.id'),
      ),
    )

    return this
  }

  static has(relation: string): PaymentModel {
    const instance = new PaymentModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(
        selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.payment_id`, '=', 'payments.id'),
      ),
    )

    return instance
  }

  static whereExists(callback: (qb: any) => any): PaymentModel {
    const instance = new PaymentModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(callback({ exists, selectFrom })),
    )

    return instance
  }

  applyWhereHas(
    relation: string,
    callback: (query: SubqueryBuilder<keyof PaymentModel>) => void,
  ): PaymentModel {
    const subqueryBuilder = new SubqueryBuilder()

    callback(subqueryBuilder)
    const conditions = subqueryBuilder.getConditions()

    this.selectFromQuery = this.selectFromQuery
      .where(({ exists, selectFrom }: any) => {
        let subquery = selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.payment_id`, '=', 'payments.id')

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
    callback: (query: SubqueryBuilder<keyof PaymentModel>) => void,
  ): PaymentModel {
    return this.applyWhereHas(relation, callback)
  }

  static whereHas(
    relation: string,
    callback: (query: SubqueryBuilder<keyof PaymentModel>) => void,
  ): PaymentModel {
    const instance = new PaymentModel(undefined)

    return instance.applyWhereHas(relation, callback)
  }

  applyDoesntHave(relation: string): PaymentModel {
    this.selectFromQuery = this.selectFromQuery.where(({ not, exists, selectFrom }: any) =>
      not(
        exists(
          selectFrom(relation)
            .select('1')
            .whereRef(`${relation}.payment_id`, '=', 'payments.id'),
        ),
      ),
    )

    return this
  }

  doesntHave(relation: string): PaymentModel {
    return this.applyDoesntHave(relation)
  }

  static doesntHave(relation: string): PaymentModel {
    const instance = new PaymentModel(undefined)

    return instance.applyDoesntHave(relation)
  }

  applyWhereDoesntHave(relation: string, callback: (query: SubqueryBuilder<PaymentsTable>) => void): PaymentModel {
    const subqueryBuilder = new SubqueryBuilder()

    callback(subqueryBuilder)
    const conditions = subqueryBuilder.getConditions()

    this.selectFromQuery = this.selectFromQuery
      .where(({ exists, selectFrom, not }: any) => {
        const subquery = selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.payment_id`, '=', 'payments.id')

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

  whereDoesntHave(relation: string, callback: (query: SubqueryBuilder<PaymentsTable>) => void): PaymentModel {
    return this.applyWhereDoesntHave(relation, callback)
  }

  static whereDoesntHave(
    relation: string,
    callback: (query: SubqueryBuilder<PaymentsTable>) => void,
  ): PaymentModel {
    const instance = new PaymentModel(undefined)

    return instance.applyWhereDoesntHave(relation, callback)
  }

  async applyPaginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<PaymentResponse> {
    const totalRecordsResult = await DB.instance.selectFrom('payments')
      .select(DB.instance.fn.count('id').as('total')) // Use 'id' or another actual column name
      .executeTakeFirst()

    const totalRecords = Number(totalRecordsResult?.total) || 0
    const totalPages = Math.ceil(totalRecords / (options.limit ?? 10))

    const paymentsWithExtra = await DB.instance.selectFrom('payments')
      .selectAll()
      .orderBy('id', 'asc') // Assuming 'id' is used for cursor-based pagination
      .limit((options.limit ?? 10) + 1) // Fetch one extra record
      .offset(((options.page ?? 1) - 1) * (options.limit ?? 10)) // Ensure options.page is not undefined
      .execute()

    let nextCursor = null
    if (paymentsWithExtra.length > (options.limit ?? 10))
      nextCursor = paymentsWithExtra.pop()?.id ?? null

    return {
      data: paymentsWithExtra,
      paging: {
        total_records: totalRecords,
        page: options.page || 1,
        total_pages: totalPages,
      },
      next_cursor: nextCursor,
    }
  }

  async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<PaymentResponse> {
    return await this.applyPaginate(options)
  }

  // Method to get all payments
  static async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<PaymentResponse> {
    const instance = new PaymentModel(undefined)

    return await instance.applyPaginate(options)
  }

  async applyCreate(newPayment: NewPayment): Promise<PaymentModel> {
    const filteredValues = Object.fromEntries(
      Object.entries(newPayment).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewPayment

    await this.mapCustomSetters(filteredValues)

    filteredValues.uuid = randomUUIDv7()

    const result = await DB.instance.insertInto('payments')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await this.find(Number(result.numInsertedOrUpdatedRows)) as PaymentModel

    if (model)
      dispatch('payment:created', model)

    return model
  }

  async create(newPayment: NewPayment): Promise<PaymentModel> {
    return await this.applyCreate(newPayment)
  }

  static async create(newPayment: NewPayment): Promise<PaymentModel> {
    const instance = new PaymentModel(undefined)

    return await instance.applyCreate(newPayment)
  }

  static async createMany(newPayment: NewPayment[]): Promise<void> {
    const instance = new PaymentModel(undefined)

    const valuesFiltered = newPayment.map((newPayment: NewPayment) => {
      const filteredValues = Object.fromEntries(
        Object.entries(newPayment).filter(([key]) =>
          !instance.guarded.includes(key) && instance.fillable.includes(key),
        ),
      ) as NewPayment

      filteredValues.uuid = randomUUIDv7()

      return filteredValues
    })

    await DB.instance.insertInto('payments')
      .values(valuesFiltered)
      .executeTakeFirst()
  }

  static async forceCreate(newPayment: NewPayment): Promise<PaymentModel> {
    const result = await DB.instance.insertInto('payments')
      .values(newPayment)
      .executeTakeFirst()

    const model = await find(Number(result.numInsertedOrUpdatedRows)) as PaymentModel

    if (model)
      dispatch('payment:created', model)

    return model
  }

  // Method to remove a Payment
  async delete(): Promise<PaymentsTable> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()
    const model = await this.find(Number(this.id))
    if (model)
      dispatch('payment:deleted', model)

    return await DB.instance.deleteFrom('payments')
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

  async customerBelong(): Promise<CustomerModel> {
    if (this.customer_id === undefined)
      throw new HttpError(500, 'Relation Error!')

    const model = await Customer
      .where('id', '=', this.customer_id)
      .first()

    if (!model)
      throw new HttpError(500, 'Model Relation Not Found!')

    return model
  }

  toSearchableObject(): Partial<PaymentJsonResponse> {
    return {
      id: this.id,
      order_id: this.order_id,
      customer_id: this.customer_id,
      amount: this.amount,
      method: this.method,
      status: this.status,
      date: this.date,
    }
  }

  distinct(column: keyof PaymentJsonResponse): PaymentModel {
    return this.applyDistinct(column)
  }

  static distinct(column: keyof PaymentJsonResponse): PaymentModel {
    const instance = new PaymentModel(undefined)

    return instance.applyDistinct(column)
  }

  join(table: string, firstCol: string, secondCol: string): PaymentModel {
    return this.applyJoin(table, firstCol, secondCol)
  }

  static join(table: string, firstCol: string, secondCol: string): PaymentModel {
    const instance = new PaymentModel(undefined)

    return instance.applyJoin(table, firstCol, secondCol)
  }

  toJSON(): PaymentJsonResponse {
    const output = {

      uuid: this.uuid,

      id: this.id,
      amount: this.amount,
      method: this.method,
      status: this.status,
      currency: this.currency,
      reference_number: this.reference_number,
      card_last_four: this.card_last_four,
      card_brand: this.card_brand,
      billing_email: this.billing_email,
      transaction_id: this.transaction_id,
      payment_provider: this.payment_provider,
      refund_amount: this.refund_amount,
      notes: this.notes,

      created_at: this.created_at,

      updated_at: this.updated_at,

      order_id: this.order_id,
      order: this.order,
      customer_id: this.customer_id,
      customer: this.customer,
      ...this.customColumns,
    }

    return output
  }

  parseResult(model: PaymentModel): PaymentModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof PaymentModel]
    }

    return model
  }
}

async function find(id: number): Promise<PaymentModel | undefined> {
  const query = DB.instance.selectFrom('payments').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  return new PaymentModel(model)
}

export async function count(): Promise<number> {
  const results = await PaymentModel.count()

  return results
}

export async function create(newPayment: NewPayment): Promise<PaymentModel> {
  const result = await DB.instance.insertInto('payments')
    .values(newPayment)
    .executeTakeFirstOrThrow()

  return await find(Number(result.numInsertedOrUpdatedRows)) as PaymentModel
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(DB.instance)
}

export async function remove(id: number): Promise<void> {
  await DB.instance.deleteFrom('payments')
    .where('id', '=', id)
    .execute()
}

export async function whereAmount(value: number): Promise<PaymentModel[]> {
  const query = DB.instance.selectFrom('payments').where('amount', '=', value)
  const results: PaymentJsonResponse = await query.execute()

  return results.map((modelItem: PaymentJsonResponse) => new PaymentModel(modelItem))
}

export async function whereMethod(value: string): Promise<PaymentModel[]> {
  const query = DB.instance.selectFrom('payments').where('method', '=', value)
  const results: PaymentJsonResponse = await query.execute()

  return results.map((modelItem: PaymentJsonResponse) => new PaymentModel(modelItem))
}

export async function whereStatus(value: string): Promise<PaymentModel[]> {
  const query = DB.instance.selectFrom('payments').where('status', '=', value)
  const results: PaymentJsonResponse = await query.execute()

  return results.map((modelItem: PaymentJsonResponse) => new PaymentModel(modelItem))
}

export async function whereCurrency(value: string): Promise<PaymentModel[]> {
  const query = DB.instance.selectFrom('payments').where('currency', '=', value)
  const results: PaymentJsonResponse = await query.execute()

  return results.map((modelItem: PaymentJsonResponse) => new PaymentModel(modelItem))
}

export async function whereReferenceNumber(value: string): Promise<PaymentModel[]> {
  const query = DB.instance.selectFrom('payments').where('reference_number', '=', value)
  const results: PaymentJsonResponse = await query.execute()

  return results.map((modelItem: PaymentJsonResponse) => new PaymentModel(modelItem))
}

export async function whereCardLastFour(value: string): Promise<PaymentModel[]> {
  const query = DB.instance.selectFrom('payments').where('card_last_four', '=', value)
  const results: PaymentJsonResponse = await query.execute()

  return results.map((modelItem: PaymentJsonResponse) => new PaymentModel(modelItem))
}

export async function whereCardBrand(value: string): Promise<PaymentModel[]> {
  const query = DB.instance.selectFrom('payments').where('card_brand', '=', value)
  const results: PaymentJsonResponse = await query.execute()

  return results.map((modelItem: PaymentJsonResponse) => new PaymentModel(modelItem))
}

export async function whereBillingEmail(value: string): Promise<PaymentModel[]> {
  const query = DB.instance.selectFrom('payments').where('billing_email', '=', value)
  const results: PaymentJsonResponse = await query.execute()

  return results.map((modelItem: PaymentJsonResponse) => new PaymentModel(modelItem))
}

export async function whereTransactionId(value: string): Promise<PaymentModel[]> {
  const query = DB.instance.selectFrom('payments').where('transaction_id', '=', value)
  const results: PaymentJsonResponse = await query.execute()

  return results.map((modelItem: PaymentJsonResponse) => new PaymentModel(modelItem))
}

export async function wherePaymentProvider(value: string): Promise<PaymentModel[]> {
  const query = DB.instance.selectFrom('payments').where('payment_provider', '=', value)
  const results: PaymentJsonResponse = await query.execute()

  return results.map((modelItem: PaymentJsonResponse) => new PaymentModel(modelItem))
}

export async function whereRefundAmount(value: number): Promise<PaymentModel[]> {
  const query = DB.instance.selectFrom('payments').where('refund_amount', '=', value)
  const results: PaymentJsonResponse = await query.execute()

  return results.map((modelItem: PaymentJsonResponse) => new PaymentModel(modelItem))
}

export async function whereNotes(value: string): Promise<PaymentModel[]> {
  const query = DB.instance.selectFrom('payments').where('notes', '=', value)
  const results: PaymentJsonResponse = await query.execute()

  return results.map((modelItem: PaymentJsonResponse) => new PaymentModel(modelItem))
}

export const Payment = PaymentModel

export default Payment
