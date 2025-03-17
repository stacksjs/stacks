import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { OrderModel } from './Order'
import type { ProductModel } from './Product'
import { sql } from '@stacksjs/database'
import { HttpError } from '@stacksjs/error-handling'

import { BaseOrm, DB } from '@stacksjs/orm'

export interface OrderItemsTable {
  id: Generated<number>
  order_id: number
  product_id: number
  quantity: number
  price: number
  special_instructions?: string

  created_at?: Date

  updated_at?: Date

}

export interface OrderItemResponse {
  data: OrderItemJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface OrderItemJsonResponse extends Omit<Selectable<OrderItemsTable>, 'password'> {
  [key: string]: any
}

export type NewOrderItem = Insertable<OrderItemsTable>
export type OrderItemUpdate = Updateable<OrderItemsTable>

export class OrderItemModel extends BaseOrm<OrderItemModel, OrderItemsTable, OrderItemJsonResponse> {
  private readonly hidden: Array<keyof OrderItemJsonResponse> = []
  private readonly fillable: Array<keyof OrderItemJsonResponse> = ['quantity', 'price', 'special_instructions', 'uuid', 'order_id']
  private readonly guarded: Array<keyof OrderItemJsonResponse> = []
  protected attributes = {} as OrderItemJsonResponse
  protected originalAttributes = {} as OrderItemJsonResponse

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

  constructor(orderItem: OrderItemJsonResponse | undefined) {
    super('order_items')
    if (orderItem) {
      this.attributes = { ...orderItem }
      this.originalAttributes = { ...orderItem }

      Object.keys(orderItem).forEach((key) => {
        if (!(key in this)) {
          this.customColumns[key] = (orderItem as OrderItemJsonResponse)[key]
        }
      })
    }

    this.withRelations = []
    this.selectFromQuery = DB.instance.selectFrom('order_items')
    this.updateFromQuery = DB.instance.updateTable('order_items')
    this.deleteFromQuery = DB.instance.deleteFrom('order_items')
    this.hasSelect = false
    this.hasSaved = false
  }

  protected async loadRelations(models: OrderItemJsonResponse | OrderItemJsonResponse[]): Promise<void> {
    // Handle both single model and array of models
    const modelArray = Array.isArray(models) ? models : [models]
    if (!modelArray.length)
      return

    const modelIds = modelArray.map(model => model.id)

    for (const relation of this.withRelations) {
      const relatedRecords = await DB.instance
        .selectFrom(relation)
        .where('orderItem_id', 'in', modelIds)
        .selectAll()
        .execute()

      if (Array.isArray(models)) {
        models.map((model: OrderItemJsonResponse) => {
          const records = relatedRecords.filter((record: { orderItem_id: number }) => {
            return record.orderItem_id === model.id
          })

          model[relation] = records.length === 1 ? records[0] : records
          return model
        })
      }
      else {
        const records = relatedRecords.filter((record: { orderItem_id: number }) => {
          return record.orderItem_id === models.id
        })

        models[relation] = records.length === 1 ? records[0] : records
      }
    }
  }

  static with(relations: string[]): OrderItemModel {
    const instance = new OrderItemModel(undefined)

    return instance.applyWith(relations)
  }

  protected mapCustomGetters(models: OrderItemJsonResponse | OrderItemJsonResponse[]): void {
    const data = models

    if (Array.isArray(data)) {
      data.map((model: OrderItemJsonResponse) => {
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

  async mapCustomSetters(model: NewOrderItem | OrderItemUpdate): Promise<void> {
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

  get product_id(): number {
    return this.attributes.product_id
  }

  get product(): ProductModel | undefined {
    return this.attributes.product
  }

  get id(): number {
    return this.attributes.id
  }

  get quantity(): number {
    return this.attributes.quantity
  }

  get price(): number {
    return this.attributes.price
  }

  get special_instructions(): string | undefined {
    return this.attributes.special_instructions
  }

  get created_at(): Date | undefined {
    return this.attributes.created_at
  }

  get updated_at(): Date | undefined {
    return this.attributes.updated_at
  }

  set quantity(value: number) {
    this.attributes.quantity = value
  }

  set price(value: number) {
    this.attributes.price = value
  }

  set special_instructions(value: string) {
    this.attributes.special_instructions = value
  }

  set updated_at(value: Date) {
    this.attributes.updated_at = value
  }

  static select(params: (keyof OrderItemJsonResponse)[] | RawBuilder<string> | string): OrderItemModel {
    const instance = new OrderItemModel(undefined)

    return instance.applySelect(params)
  }

  // Method to find a OrderItem by ID
  static async find(id: number): Promise<OrderItemModel | undefined> {
    const instance = new OrderItemModel(undefined)

    return await instance.applyFind(id)
  }

  static async first(): Promise<OrderItemModel | undefined> {
    const instance = new OrderItemModel(undefined)

    const model = await instance.applyFirst()

    const data = new OrderItemModel(model)

    return data
  }

  static async firstOrFail(): Promise<OrderItemModel | undefined> {
    const instance = new OrderItemModel(undefined)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<OrderItemModel[]> {
    const instance = new OrderItemModel(undefined)

    const models = await DB.instance.selectFrom('order_items').selectAll().execute()

    instance.mapCustomGetters(models)

    const data = await Promise.all(models.map(async (model: OrderItemJsonResponse) => {
      return new OrderItemModel(model)
    }))

    return data
  }

  static async findOrFail(id: number): Promise<OrderItemModel | undefined> {
    const instance = new OrderItemModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  static async findMany(ids: number[]): Promise<OrderItemModel[]> {
    const instance = new OrderItemModel(undefined)

    const models = await instance.applyFindMany(ids)

    return models.map((modelItem: UserJsonResponse) => instance.parseResult(new OrderItemModel(modelItem)))
  }

  static skip(count: number): OrderItemModel {
    const instance = new OrderItemModel(undefined)

    return instance.applySkip(count)
  }

  static take(count: number): OrderItemModel {
    const instance = new OrderItemModel(undefined)

    return instance.applyTake(count)
  }

  static async count(): Promise<number> {
    const instance = new OrderItemModel(undefined)

    return instance.applyCount()
  }

  async applyCreate(newOrderItem: NewOrderItem): Promise<OrderItemModel> {
    const filteredValues = Object.fromEntries(
      Object.entries(newOrderItem).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewOrderItem

    await this.mapCustomSetters(filteredValues)

    const result = await DB.instance.insertInto('order_items')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await this.find(Number(result.numInsertedOrUpdatedRows)) as OrderItemModel

    return model
  }

  async create(newOrderItem: NewOrderItem): Promise<OrderItemModel> {
    return await this.applyCreate(newOrderItem)
  }

  static async create(newOrderItem: NewOrderItem): Promise<OrderItemModel> {
    const instance = new OrderItemModel(undefined)

    return await instance.applyCreate(newOrderItem)
  }

  async update(newOrderItem: OrderItemUpdate): Promise<OrderItemModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newOrderItem).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as OrderItemUpdate

    await this.mapCustomSetters(filteredValues)

    await DB.instance.updateTable('order_items')
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

  async forceUpdate(newOrderItem: OrderItemUpdate): Promise<OrderItemModel | undefined> {
    await DB.instance.updateTable('order_items')
      .set(newOrderItem)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      const model = await this.find(this.id)

      return model
    }

    return undefined
  }

  static async createMany(newOrderItem: NewOrderItem[]): Promise<void> {
    const instance = new OrderItemModel(undefined)

    const valuesFiltered = newOrderItem.map((newOrderItem: NewOrderItem) => {
      const filteredValues = Object.fromEntries(
        Object.entries(newOrderItem).filter(([key]) =>
          !instance.guarded.includes(key) && instance.fillable.includes(key),
        ),
      ) as NewOrderItem

      return filteredValues
    })

    await DB.instance.insertInto('order_items')
      .values(valuesFiltered)
      .executeTakeFirst()
  }

  static async forceCreate(newOrderItem: NewOrderItem): Promise<OrderItemModel> {
    const result = await DB.instance.insertInto('order_items')
      .values(newOrderItem)
      .executeTakeFirst()

    const model = await find(Number(result.numInsertedOrUpdatedRows)) as OrderItemModel

    return model
  }

  // Method to remove a OrderItem
  async delete(): Promise<number> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()

    const deleted = await DB.instance.deleteFrom('order_items')
      .where('id', '=', this.id)
      .execute()

    return deleted.numDeletedRows
  }

  static async remove(id: number): Promise<any> {
    return await DB.instance.deleteFrom('order_items')
      .where('id', '=', id)
      .execute()
  }

  static whereQuantity(value: string): OrderItemModel {
    const instance = new OrderItemModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('quantity', '=', value)

    return instance
  }

  static wherePrice(value: string): OrderItemModel {
    const instance = new OrderItemModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('price', '=', value)

    return instance
  }

  static whereSpecialInstructions(value: string): OrderItemModel {
    const instance = new OrderItemModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('special_instructions', '=', value)

    return instance
  }

  static whereIn<V = number>(column: keyof OrderItemsTable, values: V[]): OrderItemModel {
    const instance = new OrderItemModel(undefined)

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

  static distinct(column: keyof OrderItemJsonResponse): OrderItemModel {
    const instance = new OrderItemModel(undefined)

    return instance.applyDistinct(column)
  }

  static join(table: string, firstCol: string, secondCol: string): OrderItemModel {
    const instance = new OrderItemModel(undefined)

    return instance.applyJoin(table, firstCol, secondCol)
  }

  toJSON(): OrderItemJsonResponse {
    const output = {

      id: this.id,
      quantity: this.quantity,
      price: this.price,
      special_instructions: this.special_instructions,

      created_at: this.created_at,

      updated_at: this.updated_at,

      order_id: this.order_id,
      order: this.order,
      product_id: this.product_id,
      product: this.product,
      ...this.customColumns,
    }

    return output
  }

  parseResult(model: OrderItemModel): OrderItemModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof OrderItemModel]
    }

    return model
  }
}

async function find(id: number): Promise<OrderItemModel | undefined> {
  const query = DB.instance.selectFrom('order_items').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  return new OrderItemModel(model)
}

export async function count(): Promise<number> {
  const results = await OrderItemModel.count()

  return results
}

export async function create(newOrderItem: NewOrderItem): Promise<OrderItemModel> {
  const result = await DB.instance.insertInto('order_items')
    .values(newOrderItem)
    .executeTakeFirstOrThrow()

  return await find(Number(result.numInsertedOrUpdatedRows)) as OrderItemModel
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(DB.instance)
}

export async function remove(id: number): Promise<void> {
  await DB.instance.deleteFrom('order_items')
    .where('id', '=', id)
    .execute()
}

export async function whereQuantity(value: number): Promise<OrderItemModel[]> {
  const query = DB.instance.selectFrom('order_items').where('quantity', '=', value)
  const results: OrderItemJsonResponse = await query.execute()

  return results.map((modelItem: OrderItemJsonResponse) => new OrderItemModel(modelItem))
}

export async function wherePrice(value: number): Promise<OrderItemModel[]> {
  const query = DB.instance.selectFrom('order_items').where('price', '=', value)
  const results: OrderItemJsonResponse = await query.execute()

  return results.map((modelItem: OrderItemJsonResponse) => new OrderItemModel(modelItem))
}

export async function whereSpecialInstructions(value: string): Promise<OrderItemModel[]> {
  const query = DB.instance.selectFrom('order_items').where('special_instructions', '=', value)
  const results: OrderItemJsonResponse = await query.execute()

  return results.map((modelItem: OrderItemJsonResponse) => new OrderItemModel(modelItem))
}

export const OrderItem = OrderItemModel

export default OrderItem
