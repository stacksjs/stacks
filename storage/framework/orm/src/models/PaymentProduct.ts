import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import { randomUUIDv7 } from 'bun'
import { sql } from '@stacksjs/database'
import { BaseOrm, DB } from '@stacksjs/orm'

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

  /**
   * This model inherits many query methods from BaseOrm:
   * - pluck, chunk, whereExists, has, doesntHave, whereHas, whereDoesntHave
   * - inRandomOrder, max, min, avg, paginate, get, and more
   *
   * See BaseOrm class for the full list of inherited methods.
   */

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

    return instance.applyWith(relations)
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

  async mapCustomSetters(model: NewPaymentProduct | PaymentProductUpdate): Promise<void> {
    const customSetter = {
      default: () => {
      },

    }

    for (const [key, fn] of Object.entries(customSetter)) {
      (model as any)[key] = await fn()
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

  static select(params: (keyof PaymentProductJsonResponse)[] | RawBuilder<string> | string): PaymentProductModel {
    const instance = new PaymentProductModel(undefined)

    return instance.applySelect(params)
  }

  // Method to find a PaymentProduct by ID
  static async find(id: number): Promise<PaymentProductModel | undefined> {
    const instance = new PaymentProductModel(undefined)

    return await instance.applyFind(id)
  }

  static async first(): Promise<PaymentProductModel | undefined> {
    const instance = new PaymentProductModel(undefined)

    const model = await instance.applyFirst()

    const data = new PaymentProductModel(model)

    return data
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

  static async findOrFail(id: number): Promise<PaymentProductModel | undefined> {
    const instance = new PaymentProductModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  static async findMany(ids: number[]): Promise<PaymentProductModel[]> {
    const instance = new PaymentProductModel(undefined)

    const models = await instance.applyFindMany(ids)

    return models.map((modelItem: UserJsonResponse) => instance.parseResult(new PaymentProductModel(modelItem)))
  }

  static async latest(column: keyof PaymentProductsTable = 'created_at'): Promise<PaymentProductModel | undefined> {
    const instance = new PaymentProductModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'desc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new PaymentProductModel(model)
  }

  static async oldest(column: keyof PaymentProductsTable = 'created_at'): Promise<PaymentProductModel | undefined> {
    const instance = new PaymentProductModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'asc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new PaymentProductModel(model)
  }

  static skip(count: number): PaymentProductModel {
    const instance = new PaymentProductModel(undefined)

    return instance.applySkip(count)
  }

  static take(count: number): PaymentProductModel {
    const instance = new PaymentProductModel(undefined)

    return instance.applyTake(count)
  }

  static where<V = string>(column: keyof PaymentProductsTable, ...args: [V] | [Operator, V]): PaymentProductModel {
    const instance = new PaymentProductModel(undefined)

    return instance.applyWhere<V>(column, ...args)
  }

  static orWhere(...conditions: [string, any][]): PaymentProductModel {
    const instance = new PaymentProductModel(undefined)

    return instance.applyOrWhere(...conditions)
  }

  static whereNotIn<V = number>(column: keyof PaymentProductsTable, values: V[]): PaymentProductModel {
    const instance = new PaymentProductModel(undefined)

    return instance.applyWhereNotIn<V>(column, values)
  }

  static whereBetween<V = number>(column: keyof PaymentProductsTable, range: [V, V]): PaymentProductModel {
    const instance = new PaymentProductModel(undefined)

    return instance.applyWhereBetween<V>(column, range)
  }

  static whereRef(column: keyof PaymentProductsTable, ...args: string[]): PaymentProductModel {
    const instance = new PaymentProductModel(undefined)

    return instance.applyWhereRef(column, ...args)
  }

  static when(condition: boolean, callback: (query: PaymentProductModel) => PaymentProductModel): PaymentProductModel {
    const instance = new PaymentProductModel(undefined)

    return instance.applyWhen(condition, callback as any)
  }

  static whereNull(column: keyof PaymentProductsTable): PaymentProductModel {
    const instance = new PaymentProductModel(undefined)

    return instance.applyWhereNull(column)
  }

  static whereNotNull(column: keyof PaymentProductsTable): PaymentProductModel {
    const instance = new PaymentProductModel(undefined)

    return instance.applyWhereNotNull(column)
  }

  static whereLike(column: keyof PaymentProductsTable, value: string): PaymentProductModel {
    const instance = new PaymentProductModel(undefined)

    return instance.applyWhereLike(column, value)
  }

  static orderBy(column: keyof PaymentProductsTable, order: 'asc' | 'desc'): PaymentProductModel {
    const instance = new PaymentProductModel(undefined)

    return instance.applyOrderBy(column, order)
  }

  static orderByAsc(column: keyof PaymentProductsTable): PaymentProductModel {
    const instance = new PaymentProductModel(undefined)

    return instance.applyOrderByAsc(column)
  }

  static orderByDesc(column: keyof PaymentProductsTable): PaymentProductModel {
    const instance = new PaymentProductModel(undefined)

    return instance.applyOrderByDesc(column)
  }

  static inRandomOrder(): PaymentProductModel {
    const instance = new PaymentProductModel(undefined)

    return instance.applyInRandomOrder()
  }

  static whereColumn(first: keyof PaymentProductsTable, operator: Operator, second: keyof PaymentProductsTable): PaymentProductModel {
    const instance = new PaymentProductModel(undefined)

    return instance.applyWhereColumn(first, operator, second)
  }

  static async max(field: keyof PaymentProductsTable): Promise<number> {
    const instance = new PaymentProductModel(undefined)

    return await instance.applyMax(field)
  }

  static async min(field: keyof PaymentProductsTable): Promise<number> {
    const instance = new PaymentProductModel(undefined)

    return await instance.applyMin(field)
  }

  static async avg(field: keyof PaymentProductsTable): Promise<number> {
    const instance = new PaymentProductModel(undefined)

    return await instance.applyAvg(field)
  }

  static async sum(field: keyof PaymentProductsTable): Promise<number> {
    const instance = new PaymentProductModel(undefined)

    return await instance.applySum(field)
  }

  static async count(): Promise<number> {
    const instance = new PaymentProductModel(undefined)

    return instance.applyCount()
  }

  static async get(): Promise<PaymentProductModel[]> {
    const instance = new PaymentProductModel(undefined)

    const results = await instance.applyGet()

    return results.map((item: PaymentProductJsonResponse) => new PaymentProductModel(item))
  }

  static async pluck<K extends keyof PaymentProductModel>(field: K): Promise<PaymentProductModel[K][]> {
    const instance = new PaymentProductModel(undefined)

    return await instance.applyPluck(field)
  }

  static async chunk(size: number, callback: (models: PaymentProductModel[]) => Promise<void>): Promise<void> {
    const instance = new PaymentProductModel(undefined)

    await instance.applyChunk(size, async (models) => {
      const modelInstances = models.map((item: PaymentProductJsonResponse) => new PaymentProductModel(item))
      await callback(modelInstances)
    })
  }

  static async paginate(options: { limit?: number, offset?: number, page?: number } = { limit: 10, offset: 0, page: 1 }): Promise<{
    data: PaymentProductModel[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }> {
    const instance = new PaymentProductModel(undefined)

    const result = await instance.applyPaginate(options)

    return {
      data: result.data.map((item: PaymentProductJsonResponse) => new PaymentProductModel(item)),
      paging: result.paging,
      next_cursor: result.next_cursor,
    }
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

  static async firstOrCreate(search: Partial<PaymentProductsTable>, values: NewPaymentProduct = {} as NewPaymentProduct): Promise<PaymentProductModel> {
    // First try to find a record matching the search criteria
    const instance = new PaymentProductModel(undefined)

    // Apply all search conditions
    for (const [key, value] of Object.entries(search)) {
      instance.selectFromQuery = instance.selectFromQuery.where(key, '=', value)
    }

    // Try to find the record
    const existingRecord = await instance.applyFirst()

    if (existingRecord) {
      return new PaymentProductModel(existingRecord)
    }

    // If no record exists, create a new one with combined search criteria and values
    const createData = { ...search, ...values } as NewPaymentProduct
    return await PaymentProductModel.create(createData)
  }

  static async updateOrCreate(search: Partial<PaymentProductsTable>, values: NewPaymentProduct = {} as NewPaymentProduct): Promise<PaymentProductModel> {
    // First try to find a record matching the search criteria
    const instance = new PaymentProductModel(undefined)

    // Apply all search conditions
    for (const [key, value] of Object.entries(search)) {
      instance.selectFromQuery = instance.selectFromQuery.where(key, '=', value)
    }

    // Try to find the record
    const existingRecord = await instance.applyFirst()

    if (existingRecord) {
      // If record exists, update it with the new values
      const model = new PaymentProductModel(existingRecord)
      await model.update(values as PaymentProductUpdate)
      return model
    }

    // If no record exists, create a new one with combined search criteria and values
    const createData = { ...search, ...values } as NewPaymentProduct
    return await PaymentProductModel.create(createData)
  }

  async update(newPaymentProduct: PaymentProductUpdate): Promise<PaymentProductModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newPaymentProduct).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as PaymentProductUpdate

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

  async forceUpdate(newPaymentProduct: PaymentProductUpdate): Promise<PaymentProductModel | undefined> {
    await DB.instance.updateTable('payment_products')
      .set(newPaymentProduct)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      const model = await this.find(this.id)

      return model
    }

    return undefined
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
  async delete(): Promise<number> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()

    const deleted = await DB.instance.deleteFrom('payment_products')
      .where('id', '=', this.id)
      .execute()

    return deleted.numDeletedRows
  }

  static async remove(id: number): Promise<any> {
    return await DB.instance.deleteFrom('payment_products')
      .where('id', '=', id)
      .execute()
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

  static distinct(column: keyof PaymentProductJsonResponse): PaymentProductModel {
    const instance = new PaymentProductModel(undefined)

    return instance.applyDistinct(column)
  }

  static join(table: string, firstCol: string, secondCol: string): PaymentProductModel {
    const instance = new PaymentProductModel(undefined)

    return instance.applyJoin(table, firstCol, secondCol)
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
