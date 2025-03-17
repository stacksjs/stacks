import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { ManufacturerModel } from './Manufacturer'
import type { ProductCategoryModel } from './ProductCategory'
import { randomUUIDv7 } from 'bun'
import { cache } from '@stacksjs/cache'
import { sql } from '@stacksjs/database'
import { HttpError, ModelNotFoundException } from '@stacksjs/error-handling'
import { dispatch } from '@stacksjs/events'

import { BaseOrm, DB } from '@stacksjs/orm'

import Manufacturer from './Manufacturer'

import ProductCategory from './ProductCategory'

export interface ProductsTable {
  id: Generated<number>
  product_category_id: number
  manufacturer_id: number
  name: string
  description?: string
  price: number
  image_url?: string
  is_available?: boolean
  inventory_count?: number
  category_id: string
  preparation_time: number
  allergens?: string
  nutritional_info?: string
  uuid?: string

  created_at?: Date

  updated_at?: Date

}

export interface ProductResponse {
  data: ProductJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface ProductJsonResponse extends Omit<Selectable<ProductsTable>, 'password'> {
  [key: string]: any
}

export type NewProduct = Insertable<ProductsTable>
export type ProductUpdate = Updateable<ProductsTable>

export class ProductModel extends BaseOrm<ProductModel, ProductsTable, ProductJsonResponse> {
  private readonly hidden: Array<keyof ProductJsonResponse> = []
  private readonly fillable: Array<keyof ProductJsonResponse> = ['name', 'description', 'price', 'image_url', 'is_available', 'inventory_count', 'category_id', 'preparation_time', 'allergens', 'nutritional_info', 'uuid', 'manufacturer_id', 'product_category_id']
  private readonly guarded: Array<keyof ProductJsonResponse> = []
  protected attributes = {} as ProductJsonResponse
  protected originalAttributes = {} as ProductJsonResponse

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

  constructor(product: ProductJsonResponse | undefined) {
    super('products')
    if (product) {
      this.attributes = { ...product }
      this.originalAttributes = { ...product }

      Object.keys(product).forEach((key) => {
        if (!(key in this)) {
          this.customColumns[key] = (product as ProductJsonResponse)[key]
        }
      })
    }

    this.withRelations = []
    this.selectFromQuery = DB.instance.selectFrom('products')
    this.updateFromQuery = DB.instance.updateTable('products')
    this.deleteFromQuery = DB.instance.deleteFrom('products')
    this.hasSelect = false
    this.hasSaved = false
  }

  protected async loadRelations(models: ProductJsonResponse | ProductJsonResponse[]): Promise<void> {
    // Handle both single model and array of models
    const modelArray = Array.isArray(models) ? models : [models]
    if (!modelArray.length)
      return

    const modelIds = modelArray.map(model => model.id)

    for (const relation of this.withRelations) {
      const relatedRecords = await DB.instance
        .selectFrom(relation)
        .where('product_id', 'in', modelIds)
        .selectAll()
        .execute()

      if (Array.isArray(models)) {
        models.map((model: ProductJsonResponse) => {
          const records = relatedRecords.filter((record: { product_id: number }) => {
            return record.product_id === model.id
          })

          model[relation] = records.length === 1 ? records[0] : records
          return model
        })
      }
      else {
        const records = relatedRecords.filter((record: { product_id: number }) => {
          return record.product_id === models.id
        })

        models[relation] = records.length === 1 ? records[0] : records
      }
    }
  }

  static with(relations: string[]): ProductModel {
    const instance = new ProductModel(undefined)

    return instance.applyWith(relations)
  }

  protected mapCustomGetters(models: ProductJsonResponse | ProductJsonResponse[]): void {
    const data = models

    if (Array.isArray(data)) {
      data.map((model: ProductJsonResponse) => {
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

  async mapCustomSetters(model: NewProduct | ProductUpdate): Promise<void> {
    const customSetter = {
      default: () => {
      },

    }

    for (const [key, fn] of Object.entries(customSetter)) {
      (model as any)[key] = await fn()
    }
  }

  get product_category_id(): number {
    return this.attributes.product_category_id
  }

  get product_category(): ProductCategoryModel | undefined {
    return this.attributes.product_category
  }

  get manufacturer_id(): number {
    return this.attributes.manufacturer_id
  }

  get manufacturer(): ManufacturerModel | undefined {
    return this.attributes.manufacturer
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

  get category_id(): string {
    return this.attributes.category_id
  }

  get preparation_time(): number {
    return this.attributes.preparation_time
  }

  get allergens(): string | undefined {
    return this.attributes.allergens
  }

  get nutritional_info(): string | undefined {
    return this.attributes.nutritional_info
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

  set category_id(value: string) {
    this.attributes.category_id = value
  }

  set preparation_time(value: number) {
    this.attributes.preparation_time = value
  }

  set allergens(value: string) {
    this.attributes.allergens = value
  }

  set nutritional_info(value: string) {
    this.attributes.nutritional_info = value
  }

  set updated_at(value: Date) {
    this.attributes.updated_at = value
  }

  static select(params: (keyof ProductJsonResponse)[] | RawBuilder<string> | string): ProductModel {
    const instance = new ProductModel(undefined)

    return instance.applySelect(params)
  }

  // Method to find a Product by ID
  static async find(id: number): Promise<ProductModel | undefined> {
    const instance = new ProductModel(undefined)

    return await instance.applyFind(id)
  }

  async first(): Promise<ProductModel | undefined> {
    const model = await this.applyFirst()

    const data = new ProductModel(model)

    return data
  }

  static async first(): Promise<ProductModel | undefined> {
    const instance = new ProductModel(undefined)

    const model = await instance.applyFirst()

    const data = new ProductModel(model)

    return data
  }

  async applyFirstOrFail(): Promise<ProductModel | undefined> {
    const model = await this.selectFromQuery.executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, `No ProductModel results found for query`)

    if (model) {
      this.mapCustomGetters(model)
      await this.loadRelations(model)
    }

    const data = new ProductModel(model)

    return data
  }

  static async firstOrFail(): Promise<ProductModel | undefined> {
    const instance = new ProductModel(undefined)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<ProductModel[]> {
    const instance = new ProductModel(undefined)

    const models = await DB.instance.selectFrom('products').selectAll().execute()

    instance.mapCustomGetters(models)

    const data = await Promise.all(models.map(async (model: ProductJsonResponse) => {
      return new ProductModel(model)
    }))

    return data
  }

  async applyFindOrFail(id: number): Promise<ProductModel> {
    const model = await DB.instance.selectFrom('products').where('id', '=', id).selectAll().executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, `No ProductModel results for ${id}`)

    cache.getOrSet(`product:${id}`, JSON.stringify(model))

    this.mapCustomGetters(model)
    await this.loadRelations(model)

    const data = new ProductModel(model)

    return data
  }

  async findOrFail(id: number): Promise<ProductModel> {
    return await this.applyFindOrFail(id)
  }

  static async findOrFail(id: number): Promise<ProductModel> {
    const instance = new ProductModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  static async findMany(ids: number[]): Promise<ProductModel[]> {
    const instance = new ProductModel(undefined)

    const models = await instance.applyFindMany(ids)

    return models.map((modelItem: UserJsonResponse) => instance.parseResult(new ProductModel(modelItem)))
  }

  async findMany(ids: number[]): Promise<ProductModel[]> {
    const models = await this.applyFindMany(ids)

    return models.map((modelItem: UserJsonResponse) => this.parseResult(new ProductModel(modelItem)))
  }

  static skip(count: number): ProductModel {
    const instance = new ProductModel(undefined)

    return instance.applySkip(count)
  }

  static take(count: number): ProductModel {
    const instance = new ProductModel(undefined)

    return instance.applyTake(count)
  }

  static async count(): Promise<number> {
    const instance = new ProductModel(undefined)

    return instance.applyCount()
  }

  async applyCreate(newProduct: NewProduct): Promise<ProductModel> {
    const filteredValues = Object.fromEntries(
      Object.entries(newProduct).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewProduct

    await this.mapCustomSetters(filteredValues)

    filteredValues.uuid = randomUUIDv7()

    const result = await DB.instance.insertInto('products')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await this.find(Number(result.numInsertedOrUpdatedRows)) as ProductModel

    if (model)
      dispatch('product:created', model)

    return model
  }

  async create(newProduct: NewProduct): Promise<ProductModel> {
    return await this.applyCreate(newProduct)
  }

  static async create(newProduct: NewProduct): Promise<ProductModel> {
    const instance = new ProductModel(undefined)

    return await instance.applyCreate(newProduct)
  }

  async update(newProduct: ProductUpdate): Promise<ProductModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newProduct).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as ProductUpdate

    await this.mapCustomSetters(filteredValues)

    await DB.instance.updateTable('products')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      const model = await this.find(this.id)

      if (model)
        dispatch('product:updated', model)

      return model
    }

    this.hasSaved = true

    return undefined
  }

  async forceUpdate(newProduct: ProductUpdate): Promise<ProductModel | undefined> {
    await DB.instance.updateTable('products')
      .set(newProduct)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      const model = await this.find(this.id)

      if (model)
        dispatch('product:updated', model)

      return model
    }

    return undefined
  }

  static async createMany(newProduct: NewProduct[]): Promise<void> {
    const instance = new ProductModel(undefined)

    const valuesFiltered = newProduct.map((newProduct: NewProduct) => {
      const filteredValues = Object.fromEntries(
        Object.entries(newProduct).filter(([key]) =>
          !instance.guarded.includes(key) && instance.fillable.includes(key),
        ),
      ) as NewProduct

      filteredValues.uuid = randomUUIDv7()

      return filteredValues
    })

    await DB.instance.insertInto('products')
      .values(valuesFiltered)
      .executeTakeFirst()
  }

  static async forceCreate(newProduct: NewProduct): Promise<ProductModel> {
    const result = await DB.instance.insertInto('products')
      .values(newProduct)
      .executeTakeFirst()

    const model = await find(Number(result.numInsertedOrUpdatedRows)) as ProductModel

    if (model)
      dispatch('product:created', model)

    return model
  }

  // Method to remove a Product
  async delete(): Promise<number> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()
    const model = await this.find(Number(this.id))

    if (model)
      dispatch('product:deleted', model)

    const deleted = await DB.instance.deleteFrom('products')
      .where('id', '=', this.id)
      .execute()

    return deleted.numDeletedRows
  }

  static async remove(id: number): Promise<any> {
    const instance = new ProductModel(undefined)

    const model = await instance.find(Number(id))

    if (model)
      dispatch('product:deleted', model)

    return await DB.instance.deleteFrom('products')
      .where('id', '=', id)
      .execute()
  }

  static whereName(value: string): ProductModel {
    const instance = new ProductModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('name', '=', value)

    return instance
  }

  static whereDescription(value: string): ProductModel {
    const instance = new ProductModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('description', '=', value)

    return instance
  }

  static wherePrice(value: string): ProductModel {
    const instance = new ProductModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('price', '=', value)

    return instance
  }

  static whereImageUrl(value: string): ProductModel {
    const instance = new ProductModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('image_url', '=', value)

    return instance
  }

  static whereIsAvailable(value: string): ProductModel {
    const instance = new ProductModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('is_available', '=', value)

    return instance
  }

  static whereInventoryCount(value: string): ProductModel {
    const instance = new ProductModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('inventory_count', '=', value)

    return instance
  }

  static whereCategoryId(value: string): ProductModel {
    const instance = new ProductModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('category_id', '=', value)

    return instance
  }

  static wherePreparationTime(value: string): ProductModel {
    const instance = new ProductModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('preparation_time', '=', value)

    return instance
  }

  static whereAllergens(value: string): ProductModel {
    const instance = new ProductModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('allergens', '=', value)

    return instance
  }

  static whereNutritionalInfo(value: string): ProductModel {
    const instance = new ProductModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('nutritional_info', '=', value)

    return instance
  }

  static whereIn<V = number>(column: keyof ProductsTable, values: V[]): ProductModel {
    const instance = new ProductModel(undefined)

    return instance.applyWhereIn<V>(column, values)
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

  toSearchableObject(): Partial<ProductJsonResponse> {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      price: this.price,
      category_id: this.category_id,
      is_available: this.is_available,
      inventory_count: this.inventory_count,
    }
  }

  static distinct(column: keyof ProductJsonResponse): ProductModel {
    const instance = new ProductModel(undefined)

    return instance.applyDistinct(column)
  }

  static join(table: string, firstCol: string, secondCol: string): ProductModel {
    const instance = new ProductModel(undefined)

    return instance.applyJoin(table, firstCol, secondCol)
  }

  toJSON(): ProductJsonResponse {
    const output = {

      uuid: this.uuid,

      id: this.id,
      name: this.name,
      description: this.description,
      price: this.price,
      image_url: this.image_url,
      is_available: this.is_available,
      inventory_count: this.inventory_count,
      category_id: this.category_id,
      preparation_time: this.preparation_time,
      allergens: this.allergens,
      nutritional_info: this.nutritional_info,

      created_at: this.created_at,

      updated_at: this.updated_at,

      product_category_id: this.product_category_id,
      product_category: this.product_category,
      manufacturer_id: this.manufacturer_id,
      manufacturer: this.manufacturer,
      ...this.customColumns,
    }

    return output
  }

  parseResult(model: ProductModel): ProductModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof ProductModel]
    }

    return model
  }
}

async function find(id: number): Promise<ProductModel | undefined> {
  const query = DB.instance.selectFrom('products').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  return new ProductModel(model)
}

export async function count(): Promise<number> {
  const results = await ProductModel.count()

  return results
}

export async function create(newProduct: NewProduct): Promise<ProductModel> {
  const result = await DB.instance.insertInto('products')
    .values(newProduct)
    .executeTakeFirstOrThrow()

  return await find(Number(result.numInsertedOrUpdatedRows)) as ProductModel
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(DB.instance)
}

export async function remove(id: number): Promise<void> {
  await DB.instance.deleteFrom('products')
    .where('id', '=', id)
    .execute()
}

export async function whereName(value: string): Promise<ProductModel[]> {
  const query = DB.instance.selectFrom('products').where('name', '=', value)
  const results: ProductJsonResponse = await query.execute()

  return results.map((modelItem: ProductJsonResponse) => new ProductModel(modelItem))
}

export async function whereDescription(value: string): Promise<ProductModel[]> {
  const query = DB.instance.selectFrom('products').where('description', '=', value)
  const results: ProductJsonResponse = await query.execute()

  return results.map((modelItem: ProductJsonResponse) => new ProductModel(modelItem))
}

export async function wherePrice(value: number): Promise<ProductModel[]> {
  const query = DB.instance.selectFrom('products').where('price', '=', value)
  const results: ProductJsonResponse = await query.execute()

  return results.map((modelItem: ProductJsonResponse) => new ProductModel(modelItem))
}

export async function whereImageUrl(value: string): Promise<ProductModel[]> {
  const query = DB.instance.selectFrom('products').where('image_url', '=', value)
  const results: ProductJsonResponse = await query.execute()

  return results.map((modelItem: ProductJsonResponse) => new ProductModel(modelItem))
}

export async function whereIsAvailable(value: boolean): Promise<ProductModel[]> {
  const query = DB.instance.selectFrom('products').where('is_available', '=', value)
  const results: ProductJsonResponse = await query.execute()

  return results.map((modelItem: ProductJsonResponse) => new ProductModel(modelItem))
}

export async function whereInventoryCount(value: number): Promise<ProductModel[]> {
  const query = DB.instance.selectFrom('products').where('inventory_count', '=', value)
  const results: ProductJsonResponse = await query.execute()

  return results.map((modelItem: ProductJsonResponse) => new ProductModel(modelItem))
}

export async function whereCategoryId(value: string): Promise<ProductModel[]> {
  const query = DB.instance.selectFrom('products').where('category_id', '=', value)
  const results: ProductJsonResponse = await query.execute()

  return results.map((modelItem: ProductJsonResponse) => new ProductModel(modelItem))
}

export async function wherePreparationTime(value: number): Promise<ProductModel[]> {
  const query = DB.instance.selectFrom('products').where('preparation_time', '=', value)
  const results: ProductJsonResponse = await query.execute()

  return results.map((modelItem: ProductJsonResponse) => new ProductModel(modelItem))
}

export async function whereAllergens(value: string): Promise<ProductModel[]> {
  const query = DB.instance.selectFrom('products').where('allergens', '=', value)
  const results: ProductJsonResponse = await query.execute()

  return results.map((modelItem: ProductJsonResponse) => new ProductModel(modelItem))
}

export async function whereNutritionalInfo(value: string): Promise<ProductModel[]> {
  const query = DB.instance.selectFrom('products').where('nutritional_info', '=', value)
  const results: ProductJsonResponse = await query.execute()

  return results.map((modelItem: ProductJsonResponse) => new ProductModel(modelItem))
}

export const Product = ProductModel

export default Product
