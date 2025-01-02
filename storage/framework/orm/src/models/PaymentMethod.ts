import type { Insertable, Selectable, Updateable } from 'kysely'
import type { TransactionModel } from './Transaction'
import type { UserModel } from './User'
import { randomUUIDv7 } from 'bun'
import { cache } from '@stacksjs/cache'
import { db, sql } from '@stacksjs/database'
import { HttpError } from '@stacksjs/error-handling'

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
  data: PaymentMethods
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export type PaymentMethodType = Selectable<PaymentMethodsTable>
export type NewPaymentMethod = Partial<Insertable<PaymentMethodsTable>>
export type PaymentMethodUpdate = Updateable<PaymentMethodsTable>
export type PaymentMethods = PaymentMethodType[]

export type PaymentMethodColumn = PaymentMethods
export type PaymentMethodColumns = Array<keyof PaymentMethods>

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
  private hidden = []
  private fillable = ['type', 'last_four', 'brand', 'exp_month', 'exp_year', 'is_default', 'provider_id', 'uuid', 'user_id', 'transaction_id']
  private softDeletes = false
  protected selectFromQuery: any
  protected withRelations: string[]
  protected updateFromQuery: any
  protected deleteFromQuery: any
  protected hasSelect: boolean
  public user_id: number | undefined
  public user: UserModel | undefined
  public transactions: TransactionModel[] | undefined
  public id: number
  public uuid: string | undefined
  public type: string | undefined
  public last_four: number | undefined
  public brand: string | undefined
  public exp_month: number | undefined
  public exp_year: number | undefined
  public is_default: boolean | undefined
  public provider_id: string | undefined

  public created_at: Date | undefined
  public updated_at: Date | undefined

  constructor(paymentmethod: Partial<PaymentMethodType> | null) {
    this.user_id = paymentmethod?.user_id
    this.user = paymentmethod?.user
    this.transactions = paymentmethod?.transactions
    this.id = paymentmethod?.id || 1
    this.uuid = paymentmethod?.uuid
    this.type = paymentmethod?.type
    this.last_four = paymentmethod?.last_four
    this.brand = paymentmethod?.brand
    this.exp_month = paymentmethod?.exp_month
    this.exp_year = paymentmethod?.exp_year
    this.is_default = paymentmethod?.is_default
    this.provider_id = paymentmethod?.provider_id

    this.created_at = paymentmethod?.created_at

    this.updated_at = paymentmethod?.updated_at

    this.withRelations = []
    this.selectFromQuery = db.selectFrom('payment_methods')
    this.updateFromQuery = db.updateTable('payment_methods')
    this.deleteFromQuery = db.deleteFrom('payment_methods')
    this.hasSelect = false
  }

  // Method to find a PaymentMethod by ID
  async find(id: number): Promise<PaymentMethodModel | undefined> {
    const query = db.selectFrom('payment_methods').where('id', '=', id).selectAll()

    const model = await query.executeTakeFirst()

    if (!model)
      return undefined

    model.transactions = await this.transactionsHasMany()

    model.user = await this.userBelong()

    const data = new PaymentMethodModel(model as PaymentMethodType)

    cache.getOrSet(`paymentmethod:${id}`, JSON.stringify(model))

    return data
  }

  // Method to find a PaymentMethod by ID
  static async find(id: number): Promise<PaymentMethodModel | undefined> {
    const model = await db.selectFrom('payment_methods').where('id', '=', id).selectAll().executeTakeFirst()

    if (!model)
      return undefined

    const instance = new PaymentMethodModel(null)

    const result = await instance.mapWith(model)

    const data = new PaymentMethodModel(result as PaymentMethodType)

    cache.getOrSet(`paymentmethod:${id}`, JSON.stringify(model))

    return data
  }

  async mapWith(model: PaymentMethodType): Promise<PaymentMethodType> {
    model.transactions = await this.transactionsHasMany()

    model.user = await this.userBelong()

    return model
  }

  static async all(): Promise<PaymentMethodModel[]> {
    const models = await db.selectFrom('payment_methods').selectAll().execute()

    const data = await Promise.all(models.map(async (model: PaymentMethodType) => {
      const instance = new PaymentMethodModel(model as PaymentMethodType)

      model.transactions = await instance.transactionsHasMany()

      model.user = await instance.userBelong()

      return new PaymentMethodModel(model)
    }))

    return data
  }

  static async findOrFail(id: number): Promise<PaymentMethodModel> {
    const model = await db.selectFrom('payment_methods').where('id', '=', id).selectAll().executeTakeFirst()

    if (model === undefined)
      throw new HttpError(404, `No PaymentMethodModel results for ${id}`)

    cache.getOrSet(`paymentmethod:${id}`, JSON.stringify(model))

    const instance = new PaymentMethodModel(model as PaymentMethodType)

    model.transactions = await instance.transactionsHasMany()

    model.user = await instance.userBelong()

    const data = new PaymentMethodModel(model as PaymentMethodType)

    return data
  }

  static async findMany(ids: number[]): Promise<PaymentMethodModel[]> {
    let query = db.selectFrom('payment_methods').where('id', 'in', ids)

    const instance = new PaymentMethodModel(null)

    query = query.selectAll()

    const model = await query.execute()

    return model.map(modelItem => instance.parseResult(new PaymentMethodModel(modelItem)))
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
      const instance = new PaymentMethodModel(model as PaymentMethodType)

      model.transactions = await instance.transactionsHasMany()

      model.user = await instance.userBelong()

      return model
    }))

    return data
  }

  // Method to get a PaymentMethod by criteria
  async get(): Promise<PaymentMethodModel[]> {
    if (this.hasSelect) {
      const model = await this.selectFromQuery.execute()

      return model.map((modelItem: PaymentMethodModel) => new PaymentMethodModel(modelItem))
    }

    const model = await this.selectFromQuery.selectAll().execute()

    return model.map((modelItem: PaymentMethodModel) => new PaymentMethodModel(modelItem))
  }

  static async count(): Promise<number> {
    const instance = new PaymentMethodModel(null)

    const results = await instance.selectFromQuery.selectAll().execute()

    return results.length
  }

  async count(): Promise<number> {
    if (this.hasSelect) {
      const results = await this.selectFromQuery.execute()

      return results.length
    }

    const results = await this.selectFromQuery.execute()

    return results.length
  }

  // Method to get all payment_methods
  static async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<PaymentMethodResponse> {
    const totalRecordsResult = await db.selectFrom('payment_methods')
      .select(db.fn.count('id').as('total')) // Use 'id' or another actual column name
      .executeTakeFirst()

    const totalRecords = Number(totalRecordsResult?.total) || 0
    const totalPages = Math.ceil(totalRecords / (options.limit ?? 10))

    const payment_methodsWithExtra = await db.selectFrom('payment_methods')
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

  // Method to create a new paymentmethod
  static async create(newPaymentMethod: NewPaymentMethod): Promise<PaymentMethodModel> {
    const instance = new PaymentMethodModel(null)

    const filteredValues = Object.fromEntries(
      Object.entries(newPaymentMethod).filter(([key]) => instance.fillable.includes(key)),
    ) as NewPaymentMethod

    filteredValues.uuid = randomUUIDv7()

    const result = await db.insertInto('payment_methods')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await find(Number(result.numInsertedOrUpdatedRows)) as PaymentMethodModel

    return model
  }

  static async createMany(newPaymentMethods: NewPaymentMethod[]): Promise<void> {
    const instance = new PaymentMethodModel(null)

    const filteredValues = newPaymentMethods.map(newUser =>
      Object.fromEntries(
        Object.entries(newUser).filter(([key]) => instance.fillable.includes(key)),
      ) as NewPaymentMethod,
    )

    filteredValues.forEach((model) => {
      model.uuid = randomUUIDv7()
    })

    await db.insertInto('payment_methods')
      .values(filteredValues)
      .executeTakeFirst()
  }

  static async forceCreate(newPaymentMethod: NewPaymentMethod): Promise<PaymentMethodModel> {
    const result = await db.insertInto('payment_methods')
      .values(newPaymentMethod)
      .executeTakeFirst()

    const model = await find(Number(result.numInsertedOrUpdatedRows)) as PaymentMethodModel

    return model
  }

  // Method to remove a PaymentMethod
  static async remove(id: number): Promise<any> {
    return await db.deleteFrom('payment_methods')
      .where('id', '=', id)
      .execute()
  }

  where(...args: (string | number | boolean | undefined | null)[]): PaymentMethodModel {
    let column: any
    let operator: any
    let value: any

    if (args.length === 2) {
      [column, value] = args
      operator = '='
    }
    else if (args.length === 3) {
      [column, operator, value] = args
    }
    else {
      throw new HttpError(500, 'Invalid number of arguments')
    }

    this.selectFromQuery = this.selectFromQuery.where(column, operator, value)

    this.updateFromQuery = this.updateFromQuery.where(column, operator, value)
    this.deleteFromQuery = this.deleteFromQuery.where(column, operator, value)

    return this
  }

  orWhere(...args: Array<[string, string, any]>): PaymentMethodModel {
    if (args.length === 0) {
      throw new HttpError(500, 'At least one condition must be provided')
    }

    // Use the expression builder to append the OR conditions
    this.selectFromQuery = this.selectFromQuery.where((eb: any) =>
      eb.or(
        args.map(([column, operator, value]) => eb(column, operator, value)),
      ),
    )

    this.updateFromQuery = this.updateFromQuery.where((eb: any) =>
      eb.or(
        args.map(([column, operator, value]) => eb(column, operator, value)),
      ),
    )

    this.deleteFromQuery = this.deleteFromQuery.where((eb: any) =>
      eb.or(
        args.map(([column, operator, value]) => eb(column, operator, value)),
      ),
    )

    return this
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

  static where(...args: (string | number | boolean | undefined | null)[]): PaymentMethodModel {
    let column: any
    let operator: any
    let value: any

    const instance = new PaymentMethodModel(null)

    if (args.length === 2) {
      [column, value] = args
      operator = '='
    }
    else if (args.length === 3) {
      [column, operator, value] = args
    }
    else {
      throw new HttpError(500, 'Invalid number of arguments')
    }

    instance.selectFromQuery = instance.selectFromQuery.where(column, operator, value)

    instance.updateFromQuery = instance.updateFromQuery.where(column, operator, value)

    instance.deleteFromQuery = instance.deleteFromQuery.where(column, operator, value)

    return instance
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

  whereNull(column: string): PaymentMethodModel {
    this.selectFromQuery = this.selectFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    this.updateFromQuery = this.updateFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    return this
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

  static whereIn(column: keyof PaymentMethodType, values: any[]): PaymentMethodModel {
    const instance = new PaymentMethodModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where(column, 'in', values)

    instance.updateFromQuery = instance.updateFromQuery.where(column, 'in', values)

    instance.deleteFromQuery = instance.deleteFromQuery.where(column, 'in', values)

    return instance
  }

  async first(): Promise<PaymentMethodModel | undefined> {
    const model = await this.selectFromQuery.selectAll().executeTakeFirst()

    if (!model)
      return undefined

    model.transactions = await this.transactionsHasMany()

    model.user = await this.userBelong()

    const data = new PaymentMethodModel(model as PaymentMethodType)

    return data
  }

  async firstOrFail(): Promise<PaymentMethodModel | undefined> {
    const model = await this.selectFromQuery.executeTakeFirst()

    if (model === undefined)
      throw new HttpError(404, 'No PaymentMethodModel results found for query')

    const instance = new PaymentMethodModel(null)

    const result = await instance.mapWith(model)

    const data = new PaymentMethodModel(result as PaymentMethodType)

    return data
  }

  async exists(): Promise<boolean> {
    const model = await this.selectFromQuery.executeTakeFirst()

    return model !== null || model !== undefined
  }

  static async first(): Promise<PaymentMethodType | undefined> {
    const model = await db.selectFrom('payment_methods')
      .selectAll()
      .executeTakeFirst()

    if (!model)
      return undefined

    const instance = new PaymentMethodModel(null)

    const result = await instance.mapWith(model)

    const data = new PaymentMethodModel(result as PaymentMethodType)

    return data
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
    return await db.selectFrom('payment_methods')
      .selectAll()
      .orderBy('id', 'desc')
      .executeTakeFirst()
  }

  static async last(): Promise<PaymentMethodType | undefined> {
    return await db.selectFrom('payment_methods').selectAll().orderBy('id', 'desc').executeTakeFirst()
  }

  static orderBy(column: keyof PaymentMethodType, order: 'asc' | 'desc'): PaymentMethodModel {
    const instance = new PaymentMethodModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, order)

    return instance
  }

  orderBy(column: keyof PaymentMethodType, order: 'asc' | 'desc'): PaymentMethodModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, order)

    return this
  }

  static orderByDesc(column: keyof PaymentMethodType): PaymentMethodModel {
    const instance = new PaymentMethodModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, 'desc')

    return instance
  }

  orderByDesc(column: keyof PaymentMethodType): PaymentMethodModel {
    this.selectFromQuery = this.orderBy(column, 'desc')

    return this
  }

  static orderByAsc(column: keyof PaymentMethodType): PaymentMethodModel {
    const instance = new PaymentMethodModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, 'asc')

    return instance
  }

  orderByAsc(column: keyof PaymentMethodType): PaymentMethodModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, 'desc')

    return this
  }

  async update(paymentmethod: PaymentMethodUpdate): Promise<PaymentMethodModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(paymentmethod).filter(([key]) => this.fillable.includes(key)),
    ) as NewPaymentMethod

    if (this.id === undefined) {
      this.updateFromQuery.set(filteredValues).execute()
    }

    await db.updateTable('payment_methods')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    const model = await this.find(this.id)

    return model
  }

  async forceUpdate(paymentmethod: PaymentMethodUpdate): Promise<PaymentMethodModel | undefined> {
    if (this.id === undefined) {
      this.updateFromQuery.set(paymentmethod).execute()
    }

    await db.updateTable('payment_methods')
      .set(paymentmethod)
      .where('id', '=', this.id)
      .executeTakeFirst()

    const model = await this.find(this.id)

    return model
  }

  async save(): Promise<void> {
    if (!this)
      throw new HttpError(500, 'PaymentMethod data is undefined')

    if (this.id === undefined) {
      await db.insertInto('payment_methods')
        .values(this as NewPaymentMethod)
        .executeTakeFirstOrThrow()
    }
    else {
      await this.update(this)
    }
  }

  // Method to delete (soft delete) the paymentmethod instance
  async delete(): Promise<any> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()

    return await db.deleteFrom('payment_methods')
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

    const results = await db.selectFrom('transactions')
      .where('paymentmethod_id', '=', this.id)
      .limit(5)
      .selectAll()
      .execute()

    return results.map(modelItem => new Transaction(modelItem))
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
    this.selectFromQuery = this.selectFromQuery(table, firstCol, secondCol)

    return this
  }

  static join(table: string, firstCol: string, secondCol: string): PaymentMethodModel {
    const instance = new PaymentMethodModel(null)

    instance.selectFromQuery = instance.selectFromQuery.innerJoin(table, firstCol, secondCol)

    return instance
  }

  static async rawQuery(rawQuery: string): Promise<any> {
    return await sql`${rawQuery}`.execute(db)
  }

  toJSON() {
    const output: Partial<PaymentMethodType> = {
      user: this.user,
      transactions: this.transactions,

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

    }

        type PaymentMethod = Omit<PaymentMethodType, 'password'>

        return output as PaymentMethod
  }

  parseResult(model: PaymentMethodModel): PaymentMethodModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof PaymentMethodModel]
    }

    return model
  }
}

async function find(id: number): Promise<PaymentMethodModel | undefined> {
  const query = db.selectFrom('payment_methods').where('id', '=', id).selectAll()

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
  const result = await db.insertInto('payment_methods')
    .values(newPaymentMethod)
    .executeTakeFirstOrThrow()

  return await find(Number(result.numInsertedOrUpdatedRows)) as PaymentMethodModel
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(db)
}

export async function remove(id: number): Promise<void> {
  await db.deleteFrom('payment_methods')
    .where('id', '=', id)
    .execute()
}

export async function whereType(value: string): Promise<PaymentMethodModel[]> {
  const query = db.selectFrom('payment_methods').where('type', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new PaymentMethodModel(modelItem))
}

export async function whereLastFour(value: number): Promise<PaymentMethodModel[]> {
  const query = db.selectFrom('payment_methods').where('last_four', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new PaymentMethodModel(modelItem))
}

export async function whereBrand(value: string): Promise<PaymentMethodModel[]> {
  const query = db.selectFrom('payment_methods').where('brand', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new PaymentMethodModel(modelItem))
}

export async function whereExpMonth(value: number): Promise<PaymentMethodModel[]> {
  const query = db.selectFrom('payment_methods').where('exp_month', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new PaymentMethodModel(modelItem))
}

export async function whereExpYear(value: number): Promise<PaymentMethodModel[]> {
  const query = db.selectFrom('payment_methods').where('exp_year', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new PaymentMethodModel(modelItem))
}

export async function whereIsDefault(value: boolean): Promise<PaymentMethodModel[]> {
  const query = db.selectFrom('payment_methods').where('is_default', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new PaymentMethodModel(modelItem))
}

export async function whereProviderId(value: string): Promise<PaymentMethodModel[]> {
  const query = db.selectFrom('payment_methods').where('provider_id', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new PaymentMethodModel(modelItem))
}

export const PaymentMethod = PaymentMethodModel

export default PaymentMethod
