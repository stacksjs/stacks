import type { Insertable, Selectable, Updateable } from 'kysely'
import { randomUUIDv7 } from 'bun'
import { cache } from '@stacksjs/cache'
import { db, sql } from '@stacksjs/database'
import { HttpError } from '@stacksjs/error-handling'

import PaymentMethod from './PaymentMethod'

import User from './User'

export interface TransactionsTable {
  id?: number
  user?: any
  payment_method?: any
  name?: string
  description?: string
  amount?: number
  type?: string
  provider_id?: string
  user_id?: number
  paymentmethod_id?: number
  uuid?: string

  created_at?: Date

  updated_at?: Date

}

interface TransactionResponse {
  data: Transactions
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export type TransactionType = Selectable<TransactionsTable>
export type NewTransaction = Partial<Insertable<TransactionsTable>>
export type TransactionUpdate = Updateable<TransactionsTable>
export type Transactions = TransactionType[]

export type TransactionColumn = Transactions
export type TransactionColumns = Array<keyof Transactions>

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
  private hidden = []
  private fillable = ['name', 'description', 'amount', 'type', 'provider_id', 'uuid', 'user_id', 'paymentmethod_id']
  private softDeletes = false
  protected selectFromQuery: any
  protected updateFromQuery: any
  protected deleteFromQuery: any
  protected hasSelect: boolean
  public user: any
  public payment_method: any
  public id: number
  public uuid: string | undefined
  public name: string | undefined
  public description: string | undefined
  public amount: number | undefined
  public type: string | undefined
  public provider_id: string | undefined

  public created_at: Date | undefined
  public updated_at: Date | undefined
  public user_id: number | undefined
  public paymentmethod_id: number | undefined

  constructor(transaction: Partial<TransactionType> | null) {
    this.user = transaction?.user
    this.payment_method = transaction?.payment_method
    this.id = transaction?.id || 1
    this.uuid = transaction?.uuid
    this.name = transaction?.name
    this.description = transaction?.description
    this.amount = transaction?.amount
    this.type = transaction?.type
    this.provider_id = transaction?.provider_id

    this.created_at = transaction?.created_at

    this.updated_at = transaction?.updated_at

    this.user_id = transaction?.user_id
    this.paymentmethod_id = transaction?.paymentmethod_id

    this.selectFromQuery = db.selectFrom('transactions')
    this.updateFromQuery = db.updateTable('transactions')
    this.deleteFromQuery = db.deleteFrom('transactions')
    this.hasSelect = false
  }

  // Method to find a Transaction by ID
  async find(id: number): Promise<TransactionModel | undefined> {
    const query = db.selectFrom('transactions').where('id', '=', id).selectAll()

    const model = await query.executeTakeFirst()

    if (!model)
      return undefined

    cache.getOrSet(`transaction:${id}`, JSON.stringify(model))

    return this.parseResult(new TransactionModel(model))
  }

  // Method to find a Transaction by ID
  static async find(id: number): Promise<TransactionModel | undefined> {
    const query = db.selectFrom('transactions').where('id', '=', id).selectAll()

    const instance = new TransactionModel(null)

    const model = await query.executeTakeFirst()

    if (!model)
      return undefined

    cache.getOrSet(`transaction:${id}`, JSON.stringify(model))

    return instance.parseResult(new TransactionModel(model))
  }

  static async all(): Promise<TransactionModel[]> {
    const query = db.selectFrom('transactions').selectAll()

    const instance = new TransactionModel(null)

    const results = await query.execute()

    return results.map(modelItem => instance.parseResult(new TransactionModel(modelItem)))
  }

  static async findOrFail(id: number): Promise<TransactionModel> {
    let query = db.selectFrom('transactions').where('id', '=', id)

    const instance = new TransactionModel(null)

    query = query.selectAll()

    const model = await query.executeTakeFirst()

    if (model === undefined)
      throw new HttpError(404, `No TransactionModel results for ${id}`)

    cache.getOrSet(`transaction:${id}`, JSON.stringify(model))

    return instance.parseResult(new TransactionModel(model))
  }

  static async findMany(ids: number[]): Promise<TransactionModel[]> {
    let query = db.selectFrom('transactions').where('id', 'in', ids)

    const instance = new TransactionModel(null)

    query = query.selectAll()

    const model = await query.execute()

    return model.map(modelItem => instance.parseResult(new TransactionModel(modelItem)))
  }

  // Method to get a User by criteria
  static async get(): Promise<TransactionModel[]> {
    const instance = new TransactionModel(null)

    if (instance.hasSelect) {
      const model = await instance.selectFromQuery.execute()

      return model.map((modelItem: TransactionModel) => new TransactionModel(modelItem))
    }

    const model = await instance.selectFromQuery.selectAll().execute()

    return model.map((modelItem: TransactionModel) => new TransactionModel(modelItem))
  }

  // Method to get a Transaction by criteria
  async get(): Promise<TransactionModel[]> {
    if (this.hasSelect) {
      const model = await this.selectFromQuery.execute()

      return model.map((modelItem: TransactionModel) => new TransactionModel(modelItem))
    }

    const model = await this.selectFromQuery.selectAll().execute()

    return model.map((modelItem: TransactionModel) => new TransactionModel(modelItem))
  }

  static async count(): Promise<number> {
    const instance = new TransactionModel(null)

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

  // Method to get all transactions
  static async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<TransactionResponse> {
    const totalRecordsResult = await db.selectFrom('transactions')
      .select(db.fn.count('id').as('total')) // Use 'id' or another actual column name
      .executeTakeFirst()

    const totalRecords = Number(totalRecordsResult?.total) || 0
    const totalPages = Math.ceil(totalRecords / (options.limit ?? 10))

    const transactionsWithExtra = await db.selectFrom('transactions')
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

  // Method to create a new transaction
  static async create(newTransaction: NewTransaction): Promise<TransactionModel> {
    const instance = new TransactionModel(null)

    const filteredValues = Object.fromEntries(
      Object.entries(newTransaction).filter(([key]) => instance.fillable.includes(key)),
    ) as NewTransaction

    filteredValues.uuid = randomUUIDv7()

    const result = await db.insertInto('transactions')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await find(Number(result.numInsertedOrUpdatedRows)) as TransactionModel

    return model
  }

  static async createMany(newTransactions: NewTransaction[]): Promise<void> {
    const instance = new TransactionModel(null)

    const filteredValues = newTransactions.map(newUser =>
      Object.fromEntries(
        Object.entries(newUser).filter(([key]) => instance.fillable.includes(key)),
      ) as NewTransaction,
    )

    filteredValues.forEach((model) => {
      model.uuid = randomUUIDv7()
    })

    await db.insertInto('transactions')
      .values(filteredValues)
      .executeTakeFirst()
  }

  static async forceCreate(newTransaction: NewTransaction): Promise<TransactionModel> {
    const result = await db.insertInto('transactions')
      .values(newTransaction)
      .executeTakeFirst()

    const model = await find(Number(result.numInsertedOrUpdatedRows)) as TransactionModel

    return model
  }

  // Method to remove a Transaction
  static async remove(id: number): Promise<any> {
    return await db.deleteFrom('transactions')
      .where('id', '=', id)
      .execute()
  }

  where(...args: (string | number | boolean | undefined | null)[]): TransactionModel {
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

  orWhere(...args: Array<[string, string, any]>): TransactionModel {
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

  static orWhere(...args: Array<[string, string, any]>): TransactionModel {
    const instance = new TransactionModel(null)

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

  static where(...args: (string | number | boolean | undefined | null)[]): TransactionModel {
    let column: any
    let operator: any
    let value: any

    const instance = new TransactionModel(null)

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

  static whereNull(column: string): TransactionModel {
    const instance = new TransactionModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    instance.updateFromQuery = instance.updateFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    return instance
  }

  whereNull(column: string): TransactionModel {
    this.selectFromQuery = this.selectFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    this.updateFromQuery = this.updateFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    return this
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

  static whereIn(column: keyof TransactionType, values: any[]): TransactionModel {
    const instance = new TransactionModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where(column, 'in', values)

    instance.updateFromQuery = instance.updateFromQuery.where(column, 'in', values)

    instance.deleteFromQuery = instance.deleteFromQuery.where(column, 'in', values)

    return instance
  }

  async first(): Promise<TransactionModel | undefined> {
    const model = await this.selectFromQuery.selectAll().executeTakeFirst()

    if (!model) {
      return undefined
    }

    return this.parseResult(new TransactionModel(model))
  }

  async firstOrFail(): Promise<TransactionModel | undefined> {
    const model = await this.selectFromQuery.executeTakeFirst()

    if (model === undefined)
      throw new HttpError(404, 'No TransactionModel results found for query')

    return this.parseResult(new TransactionModel(model))
  }

  async exists(): Promise<boolean> {
    const model = await this.selectFromQuery.executeTakeFirst()

    return model !== null || model !== undefined
  }

  static async first(): Promise<TransactionType | undefined> {
    const model = await db.selectFrom('transactions')
      .selectAll()
      .executeTakeFirst()

    if (!model)
      return undefined

    const instance = new TransactionModel(model as TransactionType)

    model.user = await instance.userBelong()

    model.payment_method = await instance.paymentMethodBelong()

    const data = new TransactionModel(model as TransactionType)

    return data
  }

  async last(): Promise<TransactionType | undefined> {
    return await db.selectFrom('transactions')
      .selectAll()
      .orderBy('id', 'desc')
      .executeTakeFirst()
  }

  static async last(): Promise<TransactionType | undefined> {
    return await db.selectFrom('transactions').selectAll().orderBy('id', 'desc').executeTakeFirst()
  }

  static orderBy(column: keyof TransactionType, order: 'asc' | 'desc'): TransactionModel {
    const instance = new TransactionModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, order)

    return instance
  }

  orderBy(column: keyof TransactionType, order: 'asc' | 'desc'): TransactionModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, order)

    return this
  }

  static orderByDesc(column: keyof TransactionType): TransactionModel {
    const instance = new TransactionModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, 'desc')

    return instance
  }

  orderByDesc(column: keyof TransactionType): TransactionModel {
    this.selectFromQuery = this.orderBy(column, 'desc')

    return this
  }

  static orderByAsc(column: keyof TransactionType): TransactionModel {
    const instance = new TransactionModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, 'asc')

    return instance
  }

  orderByAsc(column: keyof TransactionType): TransactionModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, 'desc')

    return this
  }

  async update(transaction: TransactionUpdate): Promise<TransactionModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(transaction).filter(([key]) => this.fillable.includes(key)),
    ) as NewTransaction

    if (this.id === undefined) {
      this.updateFromQuery.set(filteredValues).execute()
    }

    await db.updateTable('transactions')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    const model = await this.find(this.id)

    return model
  }

  async forceUpdate(transaction: TransactionUpdate): Promise<TransactionModel | undefined> {
    if (this.id === undefined) {
      this.updateFromQuery.set(transaction).execute()
    }

    await db.updateTable('transactions')
      .set(transaction)
      .where('id', '=', this.id)
      .executeTakeFirst()

    const model = await this.find(this.id)

    return model
  }

  async save(): Promise<void> {
    if (!this)
      throw new HttpError(500, 'Transaction data is undefined')

    if (this.id === undefined) {
      await db.insertInto('transactions')
        .values(this as NewTransaction)
        .executeTakeFirstOrThrow()
    }
    else {
      await this.update(this)
    }
  }

  // Method to delete (soft delete) the transaction instance
  async delete(): Promise<any> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()

    return await db.deleteFrom('transactions')
      .where('id', '=', this.id)
      .execute()
  }

  async userBelong() {
    if (this.user_id === undefined)
      throw new HttpError(500, 'Relation Error!')

    const model = await User
      .where('id', '=', this.user_id)
      .first()

    if (!model)
      throw new HttpError(500, 'Model Relation Not Found!')

    return model
  }

  async paymentMethodBelong() {
    if (this.paymentmethod_id === undefined)
      throw new HttpError(500, 'Relation Error!')

    const model = await PaymentMethod
      .where('id', '=', this.paymentmethod_id)
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
    this.selectFromQuery = this.selectFromQuery(table, firstCol, secondCol)

    return this
  }

  static join(table: string, firstCol: string, secondCol: string): TransactionModel {
    const instance = new TransactionModel(null)

    instance.selectFromQuery = instance.selectFromQuery.innerJoin(table, firstCol, secondCol)

    return instance
  }

  static async rawQuery(rawQuery: string): Promise<any> {
    return await sql`${rawQuery}`.execute(db)
  }

  toJSON() {
    const output: Partial<TransactionType> = {
      user: this.user,
      payment_method: this.payment_method,

      id: this.id,
      name: this.name,
      description: this.description,
      amount: this.amount,
      type: this.type,
      provider_id: this.provider_id,

      created_at: this.created_at,

      updated_at: this.updated_at,

    }

        type Transaction = Omit<TransactionType, 'password'>

        return output as Transaction
  }

  parseResult(model: TransactionModel): TransactionModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof TransactionModel]
    }

    return model
  }
}

async function find(id: number): Promise<TransactionModel | undefined> {
  const query = db.selectFrom('transactions').where('id', '=', id).selectAll()

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
  const result = await db.insertInto('transactions')
    .values(newTransaction)
    .executeTakeFirstOrThrow()

  return await find(Number(result.numInsertedOrUpdatedRows)) as TransactionModel
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(db)
}

export async function remove(id: number): Promise<void> {
  await db.deleteFrom('transactions')
    .where('id', '=', id)
    .execute()
}

export async function whereName(value: string): Promise<TransactionModel[]> {
  const query = db.selectFrom('transactions').where('name', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new TransactionModel(modelItem))
}

export async function whereDescription(value: string): Promise<TransactionModel[]> {
  const query = db.selectFrom('transactions').where('description', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new TransactionModel(modelItem))
}

export async function whereAmount(value: number): Promise<TransactionModel[]> {
  const query = db.selectFrom('transactions').where('amount', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new TransactionModel(modelItem))
}

export async function whereType(value: string): Promise<TransactionModel[]> {
  const query = db.selectFrom('transactions').where('type', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new TransactionModel(modelItem))
}

export async function whereProviderId(value: string): Promise<TransactionModel[]> {
  const query = db.selectFrom('transactions').where('provider_id', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new TransactionModel(modelItem))
}

export const Transaction = TransactionModel

export default Transaction
