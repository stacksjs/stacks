import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { PaymentMethodModel } from './PaymentMethod'
import type { UserModel } from './User'
import { randomUUIDv7 } from 'bun'
import { cache } from '@stacksjs/cache'
import { sql } from '@stacksjs/database'
import { HttpError, ModelNotFoundException } from '@stacksjs/error-handling'

import { BaseOrm, DB } from '@stacksjs/orm'

import PaymentMethod from './PaymentMethod'

import User from './User'

export interface PaymentTransactionsTable {
  id: Generated<number>
  user_id: number
  payment_method_id: number
  name: string
  description?: string
  amount: number
  type: string
  provider_id?: string
  uuid?: string

  created_at?: Date

  updated_at?: Date

}

export interface PaymentTransactionResponse {
  data: PaymentTransactionJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface PaymentTransactionJsonResponse extends Omit<Selectable<PaymentTransactionsTable>, 'password'> {
  [key: string]: any
}

export type NewPaymentTransaction = Insertable<PaymentTransactionsTable>
export type PaymentTransactionUpdate = Updateable<PaymentTransactionsTable>

export class PaymentTransactionModel extends BaseOrm<PaymentTransactionModel, PaymentTransactionsTable, PaymentTransactionJsonResponse> {
  private readonly hidden: Array<keyof PaymentTransactionJsonResponse> = []
  private readonly fillable: Array<keyof PaymentTransactionJsonResponse> = ['name', 'description', 'amount', 'type', 'provider_id', 'uuid', 'user_id', 'payment_method_id']
  private readonly guarded: Array<keyof PaymentTransactionJsonResponse> = []
  protected attributes = {} as PaymentTransactionJsonResponse
  protected originalAttributes = {} as PaymentTransactionJsonResponse

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

  constructor(paymentTransaction: PaymentTransactionJsonResponse | undefined) {
    super('payment_transactions')
    if (paymentTransaction) {
      this.attributes = { ...paymentTransaction }
      this.originalAttributes = { ...paymentTransaction }

      Object.keys(paymentTransaction).forEach((key) => {
        if (!(key in this)) {
          this.customColumns[key] = (paymentTransaction as PaymentTransactionJsonResponse)[key]
        }
      })
    }

    this.withRelations = []
    this.selectFromQuery = DB.instance.selectFrom('payment_transactions')
    this.updateFromQuery = DB.instance.updateTable('payment_transactions')
    this.deleteFromQuery = DB.instance.deleteFrom('payment_transactions')
    this.hasSelect = false
    this.hasSaved = false
  }

  protected async loadRelations(models: PaymentTransactionJsonResponse | PaymentTransactionJsonResponse[]): Promise<void> {
    // Handle both single model and array of models
    const modelArray = Array.isArray(models) ? models : [models]
    if (!modelArray.length)
      return

    const modelIds = modelArray.map(model => model.id)

    for (const relation of this.withRelations) {
      const relatedRecords = await DB.instance
        .selectFrom(relation)
        .where('paymentTransaction_id', 'in', modelIds)
        .selectAll()
        .execute()

      if (Array.isArray(models)) {
        models.map((model: PaymentTransactionJsonResponse) => {
          const records = relatedRecords.filter((record: { paymentTransaction_id: number }) => {
            return record.paymentTransaction_id === model.id
          })

          model[relation] = records.length === 1 ? records[0] : records
          return model
        })
      }
      else {
        const records = relatedRecords.filter((record: { paymentTransaction_id: number }) => {
          return record.paymentTransaction_id === models.id
        })

        models[relation] = records.length === 1 ? records[0] : records
      }
    }
  }

  static with(relations: string[]): PaymentTransactionModel {
    const instance = new PaymentTransactionModel(undefined)

    return instance.applyWith(relations)
  }

  protected mapCustomGetters(models: PaymentTransactionJsonResponse | PaymentTransactionJsonResponse[]): void {
    const data = models

    if (Array.isArray(data)) {
      data.map((model: PaymentTransactionJsonResponse) => {
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

  async mapCustomSetters(model: NewPaymentTransaction | PaymentTransactionUpdate): Promise<void> {
    const customSetter = {
      default: () => {
      },

    }

    for (const [key, fn] of Object.entries(customSetter)) {
      (model as any)[key] = await fn()
    }
  }

  get user_id(): number {
    return this.attributes.user_id
  }

  get user(): UserModel | undefined {
    return this.attributes.user
  }

  get payment_method_id(): number {
    return this.attributes.payment_method_id
  }

  get payment_method(): PaymentMethodModel | undefined {
    return this.attributes.payment_method
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

  get description(): string | undefined {
    return this.attributes.description
  }

  get amount(): number {
    return this.attributes.amount
  }

  get type(): string {
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

  getOriginal(column?: keyof PaymentTransactionJsonResponse): Partial<PaymentTransactionJsonResponse> {
    if (column) {
      return this.originalAttributes[column]
    }

    return this.originalAttributes
  }

  getChanges(): Partial<PaymentTransactionJsonResponse> {
    return this.fillable.reduce<Partial<PaymentTransactionJsonResponse>>((changes, key) => {
      const currentValue = this.attributes[key as keyof PaymentTransactionsTable]
      const originalValue = this.originalAttributes[key as keyof PaymentTransactionsTable]

      if (currentValue !== originalValue) {
        changes[key] = currentValue
      }

      return changes
    }, {})
  }

  isDirty(column?: keyof PaymentTransactionJsonResponse): boolean {
    if (column) {
      return this.attributes[column] !== this.originalAttributes[column]
    }

    return Object.entries(this.originalAttributes).some(([key, originalValue]) => {
      const currentValue = (this.attributes as any)[key]

      return currentValue !== originalValue
    })
  }

  isClean(column?: keyof PaymentTransactionJsonResponse): boolean {
    return !this.isDirty(column)
  }

  wasChanged(column?: keyof PaymentTransactionJsonResponse): boolean {
    return this.hasSaved && this.isDirty(column)
  }

  static select(params: (keyof PaymentTransactionJsonResponse)[] | RawBuilder<string> | string): PaymentTransactionModel {
    const instance = new PaymentTransactionModel(undefined)

    return instance.applySelect(params)
  }

  // Method to find a PaymentTransaction by ID
  static async find(id: number): Promise<PaymentTransactionModel | undefined> {
    const instance = new PaymentTransactionModel(undefined)

    return await instance.applyFind(id)
  }

  async first(): Promise<PaymentTransactionModel | undefined> {
    const model = await this.applyFirst()

    const data = new PaymentTransactionModel(model)

    return data
  }

  static async first(): Promise<PaymentTransactionModel | undefined> {
    const instance = new PaymentTransactionModel(undefined)

    const model = await instance.applyFirst()

    const data = new PaymentTransactionModel(model)

    return data
  }

  async applyFirstOrFail(): Promise<PaymentTransactionModel | undefined> {
    const model = await this.selectFromQuery.executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, `No PaymentTransactionModel results found for query`)

    if (model) {
      this.mapCustomGetters(model)
      await this.loadRelations(model)
    }

    const data = new PaymentTransactionModel(model)

    return data
  }

  static async firstOrFail(): Promise<PaymentTransactionModel | undefined> {
    const instance = new PaymentTransactionModel(undefined)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<PaymentTransactionModel[]> {
    const instance = new PaymentTransactionModel(undefined)

    const models = await DB.instance.selectFrom('payment_transactions').selectAll().execute()

    instance.mapCustomGetters(models)

    const data = await Promise.all(models.map(async (model: PaymentTransactionJsonResponse) => {
      return new PaymentTransactionModel(model)
    }))

    return data
  }

  async applyFindOrFail(id: number): Promise<PaymentTransactionModel> {
    const model = await DB.instance.selectFrom('payment_transactions').where('id', '=', id).selectAll().executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, `No PaymentTransactionModel results for ${id}`)

    cache.getOrSet(`paymentTransaction:${id}`, JSON.stringify(model))

    this.mapCustomGetters(model)
    await this.loadRelations(model)

    const data = new PaymentTransactionModel(model)

    return data
  }

  async findOrFail(id: number): Promise<PaymentTransactionModel> {
    return await this.applyFindOrFail(id)
  }

  static async findOrFail(id: number): Promise<PaymentTransactionModel> {
    const instance = new PaymentTransactionModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  static async findMany(ids: number[]): Promise<PaymentTransactionModel[]> {
    const instance = new PaymentTransactionModel(undefined)

    const models = await instance.applyFindMany(ids)

    return models.map((modelItem: UserJsonResponse) => instance.parseResult(new PaymentTransactionModel(modelItem)))
  }

  async findMany(ids: number[]): Promise<PaymentTransactionModel[]> {
    const models = await this.applyFindMany(ids)

    return models.map((modelItem: UserJsonResponse) => this.parseResult(new PaymentTransactionModel(modelItem)))
  }

  static skip(count: number): PaymentTransactionModel {
    const instance = new PaymentTransactionModel(undefined)

    return instance.applySkip(count)
  }

  static take(count: number): PaymentTransactionModel {
    const instance = new PaymentTransactionModel(undefined)

    return instance.applyTake(count)
  }

  static async count(): Promise<number> {
    const instance = new PaymentTransactionModel(undefined)

    return instance.applyCount()
  }

  async applyCreate(newPaymentTransaction: NewPaymentTransaction): Promise<PaymentTransactionModel> {
    const filteredValues = Object.fromEntries(
      Object.entries(newPaymentTransaction).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewPaymentTransaction

    await this.mapCustomSetters(filteredValues)

    filteredValues.uuid = randomUUIDv7()

    const result = await DB.instance.insertInto('payment_transactions')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await this.find(Number(result.numInsertedOrUpdatedRows)) as PaymentTransactionModel

    return model
  }

  async create(newPaymentTransaction: NewPaymentTransaction): Promise<PaymentTransactionModel> {
    return await this.applyCreate(newPaymentTransaction)
  }

  static async create(newPaymentTransaction: NewPaymentTransaction): Promise<PaymentTransactionModel> {
    const instance = new PaymentTransactionModel(undefined)

    return await instance.applyCreate(newPaymentTransaction)
  }

  async update(newPaymentTransaction: PaymentTransactionUpdate): Promise<PaymentTransactionModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newPaymentTransaction).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as PaymentTransactionUpdate

    await this.mapCustomSetters(filteredValues)

    await DB.instance.updateTable('payment_transactions')
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

  async forceUpdate(newPaymentTransaction: PaymentTransactionUpdate): Promise<PaymentTransactionModel | undefined> {
    await DB.instance.updateTable('payment_transactions')
      .set(newPaymentTransaction)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      const model = await this.find(this.id)

      return model
    }

    return undefined
  }

  static async createMany(newPaymentTransaction: NewPaymentTransaction[]): Promise<void> {
    const instance = new PaymentTransactionModel(undefined)

    const valuesFiltered = newPaymentTransaction.map((newPaymentTransaction: NewPaymentTransaction) => {
      const filteredValues = Object.fromEntries(
        Object.entries(newPaymentTransaction).filter(([key]) =>
          !instance.guarded.includes(key) && instance.fillable.includes(key),
        ),
      ) as NewPaymentTransaction

      filteredValues.uuid = randomUUIDv7()

      return filteredValues
    })

    await DB.instance.insertInto('payment_transactions')
      .values(valuesFiltered)
      .executeTakeFirst()
  }

  static async forceCreate(newPaymentTransaction: NewPaymentTransaction): Promise<PaymentTransactionModel> {
    const result = await DB.instance.insertInto('payment_transactions')
      .values(newPaymentTransaction)
      .executeTakeFirst()

    const model = await find(Number(result.numInsertedOrUpdatedRows)) as PaymentTransactionModel

    return model
  }

  // Method to remove a PaymentTransaction
  async delete(): Promise<number> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()

    const deleted = await DB.instance.deleteFrom('payment_transactions')
      .where('id', '=', this.id)
      .execute()

    return deleted.numDeletedRows
  }

  static async remove(id: number): Promise<any> {
    return await DB.instance.deleteFrom('payment_transactions')
      .where('id', '=', id)
      .execute()
  }

  static whereName(value: string): PaymentTransactionModel {
    const instance = new PaymentTransactionModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('name', '=', value)

    return instance
  }

  static whereDescription(value: string): PaymentTransactionModel {
    const instance = new PaymentTransactionModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('description', '=', value)

    return instance
  }

  static whereAmount(value: string): PaymentTransactionModel {
    const instance = new PaymentTransactionModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('amount', '=', value)

    return instance
  }

  static whereType(value: string): PaymentTransactionModel {
    const instance = new PaymentTransactionModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('type', '=', value)

    return instance
  }

  static whereProviderId(value: string): PaymentTransactionModel {
    const instance = new PaymentTransactionModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('providerId', '=', value)

    return instance
  }

  static whereIn<V = number>(column: keyof PaymentTransactionsTable, values: V[]): PaymentTransactionModel {
    const instance = new PaymentTransactionModel(undefined)

    return instance.applyWhereIn<V>(column, values)
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

  static distinct(column: keyof PaymentTransactionJsonResponse): PaymentTransactionModel {
    const instance = new PaymentTransactionModel(undefined)

    return instance.applyDistinct(column)
  }

  static join(table: string, firstCol: string, secondCol: string): PaymentTransactionModel {
    const instance = new PaymentTransactionModel(undefined)

    return instance.applyJoin(table, firstCol, secondCol)
  }

  toJSON(): PaymentTransactionJsonResponse {
    const output = {

      uuid: this.uuid,

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

  parseResult(model: PaymentTransactionModel): PaymentTransactionModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof PaymentTransactionModel]
    }

    return model
  }
}

async function find(id: number): Promise<PaymentTransactionModel | undefined> {
  const query = DB.instance.selectFrom('payment_transactions').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  return new PaymentTransactionModel(model)
}

export async function count(): Promise<number> {
  const results = await PaymentTransactionModel.count()

  return results
}

export async function create(newPaymentTransaction: NewPaymentTransaction): Promise<PaymentTransactionModel> {
  const result = await DB.instance.insertInto('payment_transactions')
    .values(newPaymentTransaction)
    .executeTakeFirstOrThrow()

  return await find(Number(result.numInsertedOrUpdatedRows)) as PaymentTransactionModel
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(DB.instance)
}

export async function remove(id: number): Promise<void> {
  await DB.instance.deleteFrom('payment_transactions')
    .where('id', '=', id)
    .execute()
}

export async function whereName(value: string): Promise<PaymentTransactionModel[]> {
  const query = DB.instance.selectFrom('payment_transactions').where('name', '=', value)
  const results: PaymentTransactionJsonResponse = await query.execute()

  return results.map((modelItem: PaymentTransactionJsonResponse) => new PaymentTransactionModel(modelItem))
}

export async function whereDescription(value: string): Promise<PaymentTransactionModel[]> {
  const query = DB.instance.selectFrom('payment_transactions').where('description', '=', value)
  const results: PaymentTransactionJsonResponse = await query.execute()

  return results.map((modelItem: PaymentTransactionJsonResponse) => new PaymentTransactionModel(modelItem))
}

export async function whereAmount(value: number): Promise<PaymentTransactionModel[]> {
  const query = DB.instance.selectFrom('payment_transactions').where('amount', '=', value)
  const results: PaymentTransactionJsonResponse = await query.execute()

  return results.map((modelItem: PaymentTransactionJsonResponse) => new PaymentTransactionModel(modelItem))
}

export async function whereType(value: string): Promise<PaymentTransactionModel[]> {
  const query = DB.instance.selectFrom('payment_transactions').where('type', '=', value)
  const results: PaymentTransactionJsonResponse = await query.execute()

  return results.map((modelItem: PaymentTransactionJsonResponse) => new PaymentTransactionModel(modelItem))
}

export async function whereProviderId(value: string): Promise<PaymentTransactionModel[]> {
  const query = DB.instance.selectFrom('payment_transactions').where('provider_id', '=', value)
  const results: PaymentTransactionJsonResponse = await query.execute()

  return results.map((modelItem: PaymentTransactionJsonResponse) => new PaymentTransactionModel(modelItem))
}

export const PaymentTransaction = PaymentTransactionModel

export default PaymentTransaction
