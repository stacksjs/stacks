import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { ManufacturerModel } from './Manufacturer'
import type { ProductModel } from './Product'
import type { ProductCategoryModel } from './ProductCategory'
import { randomUUIDv7 } from 'bun'
import { cache } from '@stacksjs/cache'
import { sql } from '@stacksjs/database'
import { HttpError, ModelNotFoundException } from '@stacksjs/error-handling'

import { dispatch } from '@stacksjs/events'

import { BaseOrm, DB } from '@stacksjs/orm'

import Manufacturer from './Manufacturer'

import Product from './Product'

import ProductCategory from './ProductCategory'

export interface ProductItemsTable {
  id: Generated<number>
  product_id: number
  manufacturer_id: number
  product_category_id: number
  name: string
  size?: string
  color?: string
  price: number
  image_url?: string
  is_available?: boolean
  inventory_count?: number
  sku: string
  custom_options?: string
  uuid?: string

  created_at?: Date

  updated_at?: Date

}

export interface ProductItemResponse {
  data: ProductItemJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface ProductItemJsonResponse extends Omit<Selectable<ProductItemsTable>, 'password'> {
  [key: string]: any
}

export type NewProductItem = Insertable<ProductItemsTable>
export type ProductItemUpdate = Updateable<ProductItemsTable>

export class ProductItemModel extends BaseOrm<ProductItemModel, ProductItemsTable, ProductItemJsonResponse> {
  private readonly hidden: Array<keyof ProductItemJsonResponse> = []
  private readonly fillable: Array<keyof ProductItemJsonResponse> = ['name', 'size', 'color', 'price', 'image_url', 'is_available', 'inventory_count', 'sku', 'custom_options', 'uuid']
  private readonly guarded: Array<keyof ProductItemJsonResponse> = []
  protected attributes = {} as ProductItemJsonResponse
  protected originalAttributes = {} as ProductItemJsonResponse

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

  constructor(productItem: ProductItemJsonResponse | undefined) {
    super('product_items')
    if (productItem) {
      this.attributes = { ...productItem }
      this.originalAttributes = { ...productItem }

      Object.keys(productItem).forEach((key) => {
        if (!(key in this)) {
          this.customColumns[key] = (productItem as ProductItemJsonResponse)[key]
        }
      })
    }

    this.withRelations = []
    this.selectFromQuery = DB.instance.selectFrom('product_items')
    this.updateFromQuery = DB.instance.updateTable('product_items')
    this.deleteFromQuery = DB.instance.deleteFrom('product_items')
    this.hasSelect = false
    this.hasSaved = false
  }

  protected async loadRelations(models: ProductItemJsonResponse | ProductItemJsonResponse[]): Promise<void> {
    // Handle both single model and array of models
    const modelArray = Array.isArray(models) ? models : [models]
    if (!modelArray.length)
      return

    const modelIds = modelArray.map(model => model.id)

    for (const relation of this.withRelations) {
      const relatedRecords = await DB.instance
        .selectFrom(relation)
        .where('productItem_id', 'in', modelIds)
        .selectAll()
        .execute()

      if (Array.isArray(models)) {
        models.map((model: ProductItemJsonResponse) => {
          const records = relatedRecords.filter((record: { productItem_id: number }) => {
            return record.productItem_id === model.id
          })

          model[relation] = records.length === 1 ? records[0] : records
          return model
        })
      }
      else {
        const records = relatedRecords.filter((record: { productItem_id: number }) => {
          return record.productItem_id === models.id
        })

        models[relation] = records.length === 1 ? records[0] : records
      }
    }
  }

  static with(relations: string[]): ProductItemModel {
    const instance = new ProductItemModel(undefined)

    return instance.applyWith(relations)
  }

  protected mapCustomGetters(models: ProductItemJsonResponse | ProductItemJsonResponse[]): void {
    const data = models

    if (Array.isArray(data)) {
      data.map((model: ProductItemJsonResponse) => {
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

  async mapCustomSetters(model: NewProductItem | ProductItemUpdate): Promise<void> {
    const customSetter = {
      default: () => {
      },

    }

    for (const [key, fn] of Object.entries(customSetter)) {
      (model as any)[key] = await fn()
    }
  }

  get product_id(): number {
    return this.attributes.product_id
  }

  get product(): ProductModel | undefined {
    return this.attributes.product
  }

  get manufacturer_id(): number {
    return this.attributes.manufacturer_id
  }

  get manufacturer(): ManufacturerModel | undefined {
    return this.attributes.manufacturer
  }

  get product_category_id(): number {
    return this.attributes.product_category_id
  }

  get product_category(): ProductCategoryModel | undefined {
    return this.attributes.product_category
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

  get size(): string | undefined {
    return this.attributes.size
  }

  get color(): string | undefined {
    return this.attributes.color
  }

  get price(): number {
    return this.attributes.price
  }

  get image_url(): string | undefined {
    return this.attributes.image_url
  }

  get is_available(): boolean | undefined {
    return this.attributes.is_available
  }

  get inventory_count(): number | undefined {
    return this.attributes.inventory_count
  }

  get sku(): string {
    return this.attributes.sku
  }

  get custom_options(): string | undefined {
    return this.attributes.custom_options
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

  set size(value: string) {
    this.attributes.size = value
  }

  set color(value: string) {
    this.attributes.color = value
  }

  set price(value: number) {
    this.attributes.price = value
  }

  set image_url(value: string) {
    this.attributes.image_url = value
  }

  set is_available(value: boolean) {
    this.attributes.is_available = value
  }

  set inventory_count(value: number) {
    this.attributes.inventory_count = value
  }

  set sku(value: string) {
    this.attributes.sku = value
  }

  set custom_options(value: string) {
    this.attributes.custom_options = value
  }

  set updated_at(value: Date) {
    this.attributes.updated_at = value
  }

  getOriginal(column?: keyof ProductItemJsonResponse): Partial<ProductItemJsonResponse> {
    if (column) {
      return this.originalAttributes[column]
    }

    return this.originalAttributes
  }

  getChanges(): Partial<ProductItemJsonResponse> {
    return this.fillable.reduce<Partial<ProductItemJsonResponse>>((changes, key) => {
      const currentValue = this.attributes[key as keyof ProductItemsTable]
      const originalValue = this.originalAttributes[key as keyof ProductItemsTable]

      if (currentValue !== originalValue) {
        changes[key] = currentValue
      }

      return changes
    }, {})
  }

  isDirty(column?: keyof ProductItemJsonResponse): boolean {
    if (column) {
      return this.attributes[column] !== this.originalAttributes[column]
    }

    return Object.entries(this.originalAttributes).some(([key, originalValue]) => {
      const currentValue = (this.attributes as any)[key]

      return currentValue !== originalValue
    })
  }

  isClean(column?: keyof ProductItemJsonResponse): boolean {
    return !this.isDirty(column)
  }

  wasChanged(column?: keyof ProductItemJsonResponse): boolean {
    return this.hasSaved && this.isDirty(column)
  }

  static select(params: (keyof ProductItemJsonResponse)[] | RawBuilder<string> | string): ProductItemModel {
    const instance = new ProductItemModel(undefined)

    return instance.applySelect(params)
  }

  // Method to find a ProductItem by ID
  static async find(id: number): Promise<ProductItemModel | undefined> {
    const instance = new ProductItemModel(undefined)

    return await instance.applyFind(id)
  }

  async first(): Promise<ProductItemModel | undefined> {
    const model = await this.applyFirst()

    const data = new ProductItemModel(model)

    return data
  }

  static async first(): Promise<ProductItemModel | undefined> {
    const instance = new ProductItemModel(undefined)

    const model = await instance.applyFirst()

    const data = new ProductItemModel(model)

    return data
  }

  async applyFirstOrFail(): Promise<ProductItemModel | undefined> {
    const model = await this.selectFromQuery.executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, `No ProductItemModel results found for query`)

    if (model) {
      this.mapCustomGetters(model)
      await this.loadRelations(model)
    }

    const data = new ProductItemModel(model)

    return data
  }

  static async firstOrFail(): Promise<ProductItemModel | undefined> {
    const instance = new ProductItemModel(undefined)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<ProductItemModel[]> {
    const instance = new ProductItemModel(undefined)

    const models = await DB.instance.selectFrom('product_items').selectAll().execute()

    instance.mapCustomGetters(models)

    const data = await Promise.all(models.map(async (model: ProductItemJsonResponse) => {
      return new ProductItemModel(model)
    }))

    return data
  }

  async applyFindOrFail(id: number): Promise<ProductItemModel> {
    const model = await DB.instance.selectFrom('product_items').where('id', '=', id).selectAll().executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, `No ProductItemModel results for ${id}`)

    cache.getOrSet(`productItem:${id}`, JSON.stringify(model))

    this.mapCustomGetters(model)
    await this.loadRelations(model)

    const data = new ProductItemModel(model)

    return data
  }

  async findOrFail(id: number): Promise<ProductItemModel> {
    return await this.applyFindOrFail(id)
  }

  static async findOrFail(id: number): Promise<ProductItemModel> {
    const instance = new ProductItemModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  static async findMany(ids: number[]): Promise<ProductItemModel[]> {
    const instance = new ProductItemModel(undefined)

    const models = await instance.applyFindMany(ids)

    return models.map((modelItem: UserJsonResponse) => instance.parseResult(new ProductItemModel(modelItem)))
  }

  async findMany(ids: number[]): Promise<ProductItemModel[]> {
    const models = await this.applyFindMany(ids)

    return models.map((modelItem: UserJsonResponse) => this.parseResult(new ProductItemModel(modelItem)))
  }

  static skip(count: number): ProductItemModel {
    const instance = new ProductItemModel(undefined)

    return instance.applySkip(count)
  }

  static take(count: number): ProductItemModel {
    const instance = new ProductItemModel(undefined)

    return instance.applyTake(count)
  }

  static async count(): Promise<number> {
    const instance = new ProductItemModel(undefined)

    return instance.applyCount()
  }

  async applyCreate(newProductItem: NewProductItem): Promise<ProductItemModel> {
    const filteredValues = Object.fromEntries(
      Object.entries(newProductItem).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewProductItem

    await this.mapCustomSetters(filteredValues)

    filteredValues.uuid = randomUUIDv7()

    const result = await DB.instance.insertInto('product_items')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await this.find(Number(result.numInsertedOrUpdatedRows)) as ProductItemModel

    if (model)
      dispatch('productItem:created', model)

    return model
  }

  async create(newProductItem: NewProductItem): Promise<ProductItemModel> {
    return await this.applyCreate(newProductItem)
  }

  static async create(newProductItem: NewProductItem): Promise<ProductItemModel> {
    const instance = new ProductItemModel(undefined)

    return await instance.applyCreate(newProductItem)
  }

  async update(newProductItem: ProductItemUpdate): Promise<ProductItemModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newProductItem).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as ProductItemUpdate

    await this.mapCustomSetters(filteredValues)

    await DB.instance.updateTable('product_items')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      const model = await this.find(this.id)

      if (model)
        dispatch('productItem:updated', model)

      return model
    }

    this.hasSaved = true

    return undefined
  }

  async forceUpdate(newProductItem: ProductItemUpdate): Promise<ProductItemModel | undefined> {
    await DB.instance.updateTable('product_items')
      .set(newProductItem)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      const model = await this.find(this.id)

      if (model)
        dispatch('productItem:updated', model)

      return model
    }

    return undefined
  }

  static async createMany(newProductItem: NewProductItem[]): Promise<void> {
    const instance = new ProductItemModel(undefined)

    const valuesFiltered = newProductItem.map((newProductItem: NewProductItem) => {
      const filteredValues = Object.fromEntries(
        Object.entries(newProductItem).filter(([key]) =>
          !instance.guarded.includes(key) && instance.fillable.includes(key),
        ),
      ) as NewProductItem

      filteredValues.uuid = randomUUIDv7()

      return filteredValues
    })

    await DB.instance.insertInto('product_items')
      .values(valuesFiltered)
      .executeTakeFirst()
  }

  static async forceCreate(newProductItem: NewProductItem): Promise<ProductItemModel> {
    const result = await DB.instance.insertInto('product_items')
      .values(newProductItem)
      .executeTakeFirst()

    const model = await find(Number(result.numInsertedOrUpdatedRows)) as ProductItemModel

    if (model)
      dispatch('productItem:created', model)

    return model
  }

  // Method to remove a ProductItem
  async delete(): Promise<number> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()
    const model = await this.find(Number(this.id))

    if (model)
      dispatch('productItem:deleted', model)

    const deleted = await DB.instance.deleteFrom('product_items')
      .where('id', '=', this.id)
      .execute()

    return deleted.numDeletedRows
  }

  static async remove(id: number): Promise<any> {
    const instance = new ProductItemModel(undefined)

    const model = await instance.find(Number(id))

    if (model)
      dispatch('productItem:deleted', model)

    return await DB.instance.deleteFrom('product_items')
      .where('id', '=', id)
      .execute()
  }

  static whereName(value: string): ProductItemModel {
    const instance = new ProductItemModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('name', '=', value)

    return instance
  }

  static whereSize(value: string): ProductItemModel {
    const instance = new ProductItemModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('size', '=', value)

    return instance
  }

  static whereColor(value: string): ProductItemModel {
    const instance = new ProductItemModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('color', '=', value)

    return instance
  }

  static wherePrice(value: string): ProductItemModel {
    const instance = new ProductItemModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('price', '=', value)

    return instance
  }

  static whereImageUrl(value: string): ProductItemModel {
    const instance = new ProductItemModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('image_url', '=', value)

    return instance
  }

  static whereIsAvailable(value: string): ProductItemModel {
    const instance = new ProductItemModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('is_available', '=', value)

    return instance
  }

  static whereInventoryCount(value: string): ProductItemModel {
    const instance = new ProductItemModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('inventory_count', '=', value)

    return instance
  }

  static whereSku(value: string): ProductItemModel {
    const instance = new ProductItemModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('sku', '=', value)

    return instance
  }

  static whereCustomOptions(value: string): ProductItemModel {
    const instance = new ProductItemModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('custom_options', '=', value)

    return instance
  }

  static whereIn<V = number>(column: keyof ProductItemsTable, values: V[]): ProductItemModel {
    const instance = new ProductItemModel(undefined)

    return instance.applyWhereIn<V>(column, values)
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

  async manufacturerBelong(): Promise<ManufacturerModel> {
    if (this.manufacturer_id === undefined)
      throw new HttpError(500, 'Relation Error!')

    const model = await Manufacturer
      .where('id', '=', this.manufacturer_id)
      .first()

    if (!model)
      throw new HttpError(500, 'Model Relation Not Found!')

    return model
  }

  async productCategoryBelong(): Promise<ProductCategoryModel> {
    if (this.product_category_id === undefined)
      throw new HttpError(500, 'Relation Error!')

    const model = await ProductCategory
      .where('id', '=', this.product_category_id)
      .first()

    if (!model)
      throw new HttpError(500, 'Model Relation Not Found!')

    return model
  }

  toSearchableObject(): Partial<ProductItemJsonResponse> {
    return {
      id: this.id,
      name: this.name,
      product_id: this.product_id,
      size: this.size,
      color: this.color,
      price: this.price,
      is_available: this.is_available,
      inventory_count: this.inventory_count,
    }
  }

  static distinct(column: keyof ProductItemJsonResponse): ProductItemModel {
    const instance = new ProductItemModel(undefined)

    return instance.applyDistinct(column)
  }

  static join(table: string, firstCol: string, secondCol: string): ProductItemModel {
    const instance = new ProductItemModel(undefined)

    return instance.applyJoin(table, firstCol, secondCol)
  }

  toJSON(): ProductItemJsonResponse {
    const output = {

      uuid: this.uuid,

      id: this.id,
      name: this.name,
      size: this.size,
      color: this.color,
      price: this.price,
      image_url: this.image_url,
      is_available: this.is_available,
      inventory_count: this.inventory_count,
      sku: this.sku,
      custom_options: this.custom_options,

      created_at: this.created_at,

      updated_at: this.updated_at,

      product_id: this.product_id,
      product: this.product,
      manufacturer_id: this.manufacturer_id,
      manufacturer: this.manufacturer,
      product_category_id: this.product_category_id,
      product_category: this.product_category,
      ...this.customColumns,
    }

    return output
  }

  parseResult(model: ProductItemModel): ProductItemModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof ProductItemModel]
    }

    return model
  }
}

async function find(id: number): Promise<ProductItemModel | undefined> {
  const query = DB.instance.selectFrom('product_items').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  return new ProductItemModel(model)
}

export async function count(): Promise<number> {
  const results = await ProductItemModel.count()

  return results
}

export async function create(newProductItem: NewProductItem): Promise<ProductItemModel> {
  const result = await DB.instance.insertInto('product_items')
    .values(newProductItem)
    .executeTakeFirstOrThrow()

  return await find(Number(result.numInsertedOrUpdatedRows)) as ProductItemModel
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(DB.instance)
}

export async function remove(id: number): Promise<void> {
  await DB.instance.deleteFrom('product_items')
    .where('id', '=', id)
    .execute()
}

export async function whereName(value: string): Promise<ProductItemModel[]> {
  const query = DB.instance.selectFrom('product_items').where('name', '=', value)
  const results: ProductItemJsonResponse = await query.execute()

  return results.map((modelItem: ProductItemJsonResponse) => new ProductItemModel(modelItem))
}

export async function whereSize(value: string): Promise<ProductItemModel[]> {
  const query = DB.instance.selectFrom('product_items').where('size', '=', value)
  const results: ProductItemJsonResponse = await query.execute()

  return results.map((modelItem: ProductItemJsonResponse) => new ProductItemModel(modelItem))
}

export async function whereColor(value: string): Promise<ProductItemModel[]> {
  const query = DB.instance.selectFrom('product_items').where('color', '=', value)
  const results: ProductItemJsonResponse = await query.execute()

  return results.map((modelItem: ProductItemJsonResponse) => new ProductItemModel(modelItem))
}

export async function wherePrice(value: number): Promise<ProductItemModel[]> {
  const query = DB.instance.selectFrom('product_items').where('price', '=', value)
  const results: ProductItemJsonResponse = await query.execute()

  return results.map((modelItem: ProductItemJsonResponse) => new ProductItemModel(modelItem))
}

export async function whereImageUrl(value: string): Promise<ProductItemModel[]> {
  const query = DB.instance.selectFrom('product_items').where('image_url', '=', value)
  const results: ProductItemJsonResponse = await query.execute()

  return results.map((modelItem: ProductItemJsonResponse) => new ProductItemModel(modelItem))
}

export async function whereIsAvailable(value: boolean): Promise<ProductItemModel[]> {
  const query = DB.instance.selectFrom('product_items').where('is_available', '=', value)
  const results: ProductItemJsonResponse = await query.execute()

  return results.map((modelItem: ProductItemJsonResponse) => new ProductItemModel(modelItem))
}

export async function whereInventoryCount(value: number): Promise<ProductItemModel[]> {
  const query = DB.instance.selectFrom('product_items').where('inventory_count', '=', value)
  const results: ProductItemJsonResponse = await query.execute()

  return results.map((modelItem: ProductItemJsonResponse) => new ProductItemModel(modelItem))
}

export async function whereSku(value: string): Promise<ProductItemModel[]> {
  const query = DB.instance.selectFrom('product_items').where('sku', '=', value)
  const results: ProductItemJsonResponse = await query.execute()

  return results.map((modelItem: ProductItemJsonResponse) => new ProductItemModel(modelItem))
}

export async function whereCustomOptions(value: string): Promise<ProductItemModel[]> {
  const query = DB.instance.selectFrom('product_items').where('custom_options', '=', value)
  const results: ProductItemJsonResponse = await query.execute()

  return results.map((modelItem: ProductItemJsonResponse) => new ProductItemModel(modelItem))
}

export const ProductItem = ProductItemModel

export default ProductItem
