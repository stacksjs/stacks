import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { OrderModel } from './Order'
import { randomUUIDv7 } from 'bun'
import { sql } from '@stacksjs/database'
import { HttpError } from '@stacksjs/error-handling'
import { dispatch } from '@stacksjs/events'
import { BaseOrm, DB } from '@stacksjs/orm'

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

  /**
   * This model inherits many query methods from BaseOrm:
   * - pluck, chunk, whereExists, has, doesntHave, whereHas, whereDoesntHave
   * - inRandomOrder, max, min, avg, paginate, get, and more
   *
   * See BaseOrm class for the full list of inherited methods.
   */

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

  protected async loadRelations(models: TransactionJsonResponse | TransactionJsonResponse[]): Promise<void> {
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

  static with(relations: string[]): TransactionModel {
    const instance = new TransactionModel(undefined)

    return instance.applyWith(relations)
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
          (model as any)[key] = fn()
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
        (model as any)[key] = fn()
      }
    }
  }

  async mapCustomSetters(model: NewTransaction | TransactionUpdate): Promise<void> {
    const customSetter = {
      default: () => {
      },

    }

    for (const [key, fn] of Object.entries(customSetter)) {
      (model as any)[key] = await fn()
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

  static select(params: (keyof TransactionJsonResponse)[] | RawBuilder<string> | string): TransactionModel {
    const instance = new TransactionModel(undefined)

    return instance.applySelect(params)
  }

  // Method to find a Transaction by ID
  static async find(id: number): Promise<TransactionModel | undefined> {
    const instance = new TransactionModel(undefined)

    return await instance.applyFind(id)
  }

  static async first(): Promise<TransactionModel | undefined> {
    const instance = new TransactionModel(undefined)

    const model = await instance.applyFirst()

    const data = new TransactionModel(model)

    return data
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

  static async findOrFail(id: number): Promise<TransactionModel | undefined> {
    const instance = new TransactionModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  static async findMany(ids: number[]): Promise<TransactionModel[]> {
    const instance = new TransactionModel(undefined)

    const models = await instance.applyFindMany(ids)

    return models.map((modelItem: UserJsonResponse) => instance.parseResult(new TransactionModel(modelItem)))
  }

  static skip(count: number): TransactionModel {
    const instance = new TransactionModel(undefined)

    return instance.applySkip(count)
  }

  static take(count: number): TransactionModel {
    const instance = new TransactionModel(undefined)

    return instance.applyTake(count)
  }

  static async count(): Promise<number> {
    const instance = new TransactionModel(undefined)

    return instance.applyCount()
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

  async update(newTransaction: TransactionUpdate): Promise<TransactionModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newTransaction).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as TransactionUpdate

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

  async forceUpdate(newTransaction: TransactionUpdate): Promise<TransactionModel | undefined> {
    await DB.instance.updateTable('transactions')
      .set(newTransaction)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      const model = await this.find(this.id)

      if (model)
        dispatch('transaction:updated', model)

      return model
    }

    return undefined
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
  async delete(): Promise<number> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()
    const model = await this.find(Number(this.id))

    if (model)
      dispatch('transaction:deleted', model)

    const deleted = await DB.instance.deleteFrom('transactions')
      .where('id', '=', this.id)
      .execute()

    return deleted.numDeletedRows
  }

  static async remove(id: number): Promise<any> {
    const instance = new TransactionModel(undefined)

    const model = await instance.find(Number(id))

    if (model)
      dispatch('transaction:deleted', model)

    return await DB.instance.deleteFrom('transactions')
      .where('id', '=', id)
      .execute()
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

  static whereIn<V = number>(column: keyof TransactionsTable, values: V[]): TransactionModel {
    const instance = new TransactionModel(undefined)

    return instance.applyWhereIn<V>(column, values)
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

  static distinct(column: keyof TransactionJsonResponse): TransactionModel {
    const instance = new TransactionModel(undefined)

    return instance.applyDistinct(column)
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
