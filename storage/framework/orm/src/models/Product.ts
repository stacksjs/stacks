import type { RawBuilder } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import type { NewProduct, ProductJsonResponse, ProductsTable, ProductUpdate } from '../types/ProductType'
import type { CategoryModel } from './Category'
import type { CouponModel } from './Coupon'
import type { LicenseKeyModel } from './LicenseKey'
import type { ManufacturerModel } from './Manufacturer'
import type { ProductUnitModel } from './ProductUnit'
import type { ProductVariantModel } from './ProductVariant'
import type { ReviewModel } from './Review'
import type { WaitlistProductModel } from './WaitlistProduct'
import { randomUUIDv7 } from 'bun'

import { sql } from '@stacksjs/database'

import { HttpError } from '@stacksjs/error-handling'

import { dispatch } from '@stacksjs/events'

import { DB } from '@stacksjs/orm'

import { BaseOrm } from '../utils/base'

export class ProductModel extends BaseOrm<ProductModel, ProductsTable, ProductJsonResponse> {
  private readonly hidden: Array<keyof ProductJsonResponse> = []
  private readonly fillable: Array<keyof ProductJsonResponse> = ['name', 'description', 'price', 'image_url', 'is_available', 'inventory_count', 'preparation_time', 'allergens', 'nutritional_info', 'uuid', 'category_id', 'manufacturer_id']
  private readonly guarded: Array<keyof ProductJsonResponse> = []
  protected attributes = {} as ProductJsonResponse
  protected originalAttributes = {} as ProductJsonResponse

  protected selectFromQuery: any
  protected updateFromQuery: any
  protected deleteFromQuery: any
  protected hasSelect: boolean
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

  async mapCustomSetters(model: NewProduct): Promise<void> {
    const customSetter = {
      default: () => {
      },

    }

    for (const [key, fn] of Object.entries(customSetter)) {
      (model as any)[key] = await fn()
    }
  }

  get reviews(): ReviewModel[] | [] {
    return this.attributes.reviews
  }

  get product_units(): ProductUnitModel[] | [] {
    return this.attributes.product_units
  }

  get product_variants(): ProductVariantModel[] | [] {
    return this.attributes.product_variants
  }

  get license_keys(): LicenseKeyModel[] | [] {
    return this.attributes.license_keys
  }

  get waitlist_products(): WaitlistProductModel[] | [] {
    return this.attributes.waitlist_products
  }

  get coupons(): CouponModel[] | [] {
    return this.attributes.coupons
  }

  get category_id(): number {
    return this.attributes.category_id
  }

  get category(): CategoryModel | undefined {
    return this.attributes.category
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

  get preparation_time(): number {
    return this.attributes.preparation_time
  }

  get allergens(): string | undefined {
    return this.attributes.allergens
  }

  get nutritional_info(): string | undefined {
    return this.attributes.nutritional_info
  }

  get created_at(): string | undefined {
    return this.attributes.created_at
  }

  get updated_at(): string | undefined {
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

  set preparation_time(value: number) {
    this.attributes.preparation_time = value
  }

  set allergens(value: string) {
    this.attributes.allergens = value
  }

  set nutritional_info(value: string) {
    this.attributes.nutritional_info = value
  }

  set updated_at(value: string) {
    this.attributes.updated_at = value
  }

  static select(params: (keyof ProductJsonResponse)[] | RawBuilder<string> | string): ProductModel {
    const instance = new ProductModel(undefined)

    return instance.applySelect(params)
  }

  // Method to find a Product by ID
  static async find(id: number): Promise<ProductModel | undefined> {
    const query = DB.instance.selectFrom('products').where('id', '=', id).selectAll()

    const model = await query.executeTakeFirst()

    if (!model)
      return undefined

    const instance = new ProductModel(undefined)
    return instance.createInstance(model)
  }

  static async first(): Promise<ProductModel | undefined> {
    const instance = new ProductModel(undefined)

    const model = await instance.applyFirst()

    const data = new ProductModel(model)

    return data
  }

  static async last(): Promise<ProductModel | undefined> {
    const instance = new ProductModel(undefined)

    const model = await instance.applyLast()

    if (!model)
      return undefined

    return new ProductModel(model)
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

  static async findOrFail(id: number): Promise<ProductModel | undefined> {
    const instance = new ProductModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  static async findMany(ids: number[]): Promise<ProductModel[]> {
    const instance = new ProductModel(undefined)

    const models = await instance.applyFindMany(ids)

    return models.map((modelItem: ProductJsonResponse) => instance.parseResult(new ProductModel(modelItem)))
  }

  static async latest(column: keyof ProductsTable = 'created_at'): Promise<ProductModel | undefined> {
    const instance = new ProductModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'desc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new ProductModel(model)
  }

  static async oldest(column: keyof ProductsTable = 'created_at'): Promise<ProductModel | undefined> {
    const instance = new ProductModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'asc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new ProductModel(model)
  }

  static skip(count: number): ProductModel {
    const instance = new ProductModel(undefined)

    return instance.applySkip(count)
  }

  static take(count: number): ProductModel {
    const instance = new ProductModel(undefined)

    return instance.applyTake(count)
  }

  static where<V = string>(column: keyof ProductsTable, ...args: [V] | [Operator, V]): ProductModel {
    const instance = new ProductModel(undefined)

    return instance.applyWhere<V>(column, ...args)
  }

  static orWhere(...conditions: [string, any][]): ProductModel {
    const instance = new ProductModel(undefined)

    return instance.applyOrWhere(...conditions)
  }

  static whereNotIn<V = number>(column: keyof ProductsTable, values: V[]): ProductModel {
    const instance = new ProductModel(undefined)

    return instance.applyWhereNotIn<V>(column, values)
  }

  static whereBetween<V = number>(column: keyof ProductsTable, range: [V, V]): ProductModel {
    const instance = new ProductModel(undefined)

    return instance.applyWhereBetween<V>(column, range)
  }

  static whereRef(column: keyof ProductsTable, ...args: string[]): ProductModel {
    const instance = new ProductModel(undefined)

    return instance.applyWhereRef(column, ...args)
  }

  static when(condition: boolean, callback: (query: ProductModel) => ProductModel): ProductModel {
    const instance = new ProductModel(undefined)

    return instance.applyWhen(condition, callback as any)
  }

  static whereNull(column: keyof ProductsTable): ProductModel {
    const instance = new ProductModel(undefined)

    return instance.applyWhereNull(column)
  }

  static whereNotNull(column: keyof ProductsTable): ProductModel {
    const instance = new ProductModel(undefined)

    return instance.applyWhereNotNull(column)
  }

  static whereLike(column: keyof ProductsTable, value: string): ProductModel {
    const instance = new ProductModel(undefined)

    return instance.applyWhereLike(column, value)
  }

  static orderBy(column: keyof ProductsTable, order: 'asc' | 'desc'): ProductModel {
    const instance = new ProductModel(undefined)

    return instance.applyOrderBy(column, order)
  }

  static orderByAsc(column: keyof ProductsTable): ProductModel {
    const instance = new ProductModel(undefined)

    return instance.applyOrderByAsc(column)
  }

  static orderByDesc(column: keyof ProductsTable): ProductModel {
    const instance = new ProductModel(undefined)

    return instance.applyOrderByDesc(column)
  }

  static groupBy(column: keyof ProductsTable): ProductModel {
    const instance = new ProductModel(undefined)

    return instance.applyGroupBy(column)
  }

  static having<V = string>(column: keyof ProductsTable, operator: Operator, value: V): ProductModel {
    const instance = new ProductModel(undefined)

    return instance.applyHaving<V>(column, operator, value)
  }

  static inRandomOrder(): ProductModel {
    const instance = new ProductModel(undefined)

    return instance.applyInRandomOrder()
  }

  static whereColumn(first: keyof ProductsTable, operator: Operator, second: keyof ProductsTable): ProductModel {
    const instance = new ProductModel(undefined)

    return instance.applyWhereColumn(first, operator, second)
  }

  static async max(field: keyof ProductsTable): Promise<number> {
    const instance = new ProductModel(undefined)

    return await instance.applyMax(field)
  }

  static async min(field: keyof ProductsTable): Promise<number> {
    const instance = new ProductModel(undefined)

    return await instance.applyMin(field)
  }

  static async avg(field: keyof ProductsTable): Promise<number> {
    const instance = new ProductModel(undefined)

    return await instance.applyAvg(field)
  }

  static async sum(field: keyof ProductsTable): Promise<number> {
    const instance = new ProductModel(undefined)

    return await instance.applySum(field)
  }

  static async count(): Promise<number> {
    const instance = new ProductModel(undefined)

    return instance.applyCount()
  }

  static async get(): Promise<ProductModel[]> {
    const instance = new ProductModel(undefined)

    const results = await instance.applyGet()

    return results.map((item: ProductJsonResponse) => instance.createInstance(item))
  }

  static async pluck<K extends keyof ProductModel>(field: K): Promise<ProductModel[K][]> {
    const instance = new ProductModel(undefined)

    return await instance.applyPluck(field)
  }

  static async chunk(size: number, callback: (models: ProductModel[]) => Promise<void>): Promise<void> {
    const instance = new ProductModel(undefined)

    await instance.applyChunk(size, async (models) => {
      const modelInstances = models.map((item: ProductJsonResponse) => instance.createInstance(item))
      await callback(modelInstances)
    })
  }

  static async paginate(options: { limit?: number, offset?: number, page?: number } = { limit: 10, offset: 0, page: 1 }): Promise<{
    data: ProductModel[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }> {
    const instance = new ProductModel(undefined)

    const result = await instance.applyPaginate(options)

    return {
      data: result.data.map((item: ProductJsonResponse) => instance.createInstance(item)),
      paging: result.paging,
      next_cursor: result.next_cursor,
    }
  }

  // Instance method for creating model instances
  createInstance(data: ProductJsonResponse): ProductModel {
    return new ProductModel(data)
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

    const model = await DB.instance.selectFrom('products')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created Product')
    }

    if (model)
      dispatch('product:created', model)
    return this.createInstance(model)
  }

  async create(newProduct: NewProduct): Promise<ProductModel> {
    return await this.applyCreate(newProduct)
  }

  static async create(newProduct: NewProduct): Promise<ProductModel> {
    const instance = new ProductModel(undefined)
    return await instance.applyCreate(newProduct)
  }

  static async firstOrCreate(search: Partial<ProductsTable>, values: NewProduct = {} as NewProduct): Promise<ProductModel> {
    // First try to find a record matching the search criteria
    const instance = new ProductModel(undefined)

    // Apply all search conditions
    for (const [key, value] of Object.entries(search)) {
      instance.selectFromQuery = instance.selectFromQuery.where(key, '=', value)
    }

    // Try to find the record
    const existingRecord = await instance.applyFirst()

    if (existingRecord) {
      return instance.createInstance(existingRecord)
    }

    // If no record exists, create a new one with combined search criteria and values
    const createData = { ...search, ...values } as NewProduct
    return await ProductModel.create(createData)
  }

  static async updateOrCreate(search: Partial<ProductsTable>, values: NewProduct = {} as NewProduct): Promise<ProductModel> {
    // First try to find a record matching the search criteria
    const instance = new ProductModel(undefined)

    // Apply all search conditions
    for (const [key, value] of Object.entries(search)) {
      instance.selectFromQuery = instance.selectFromQuery.where(key, '=', value)
    }

    // Try to find the record
    const existingRecord = await instance.applyFirst()

    if (existingRecord) {
      // If record exists, update it with the new values
      const model = instance.createInstance(existingRecord)
      const updatedModel = await model.update(values as ProductUpdate)

      // Return the updated model instance
      if (updatedModel) {
        return updatedModel
      }

      // If update didn't return a model, fetch it again to ensure we have latest data
      const refreshedModel = await instance.applyFirst()
      return instance.createInstance(refreshedModel!)
    }

    // If no record exists, create a new one with combined search criteria and values
    const createData = { ...search, ...values } as NewProduct
    return await ProductModel.create(createData)
  }

  async update(newProduct: ProductUpdate): Promise<ProductModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newProduct).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as ProductUpdate

    await this.mapCustomSetters(filteredValues)

    filteredValues.updated_at = new Date().toISOString()

    await DB.instance.updateTable('products')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('products')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated Product')
      }

      if (model)
        dispatch('product:updated', model)
      return this.createInstance(model)
    }

    return undefined
  }

  async forceUpdate(newProduct: ProductUpdate): Promise<ProductModel | undefined> {
    await DB.instance.updateTable('products')
      .set(newProduct)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('products')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated Product')
      }

      if (this)
        dispatch('product:updated', model)
      return this.createInstance(model)
    }

    return undefined
  }

  async save(): Promise<ProductModel> {
    // If the model has an ID, update it; otherwise, create a new record
    if (this.id) {
      // Update existing record
      await DB.instance.updateTable('products')
        .set(this.attributes as ProductUpdate)
        .where('id', '=', this.id)
        .executeTakeFirst()

      // Get the updated data
      const model = await DB.instance.selectFrom('products')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated Product')
      }

      if (this)
        dispatch('product:updated', model)
      return this.createInstance(model)
    }
    else {
      // Create new record
      const result = await DB.instance.insertInto('products')
        .values(this.attributes as NewProduct)
        .executeTakeFirst()

      // Get the created data
      const model = await DB.instance.selectFrom('products')
        .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve created Product')
      }

      if (this)
        dispatch('product:created', model)
      return this.createInstance(model)
    }
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

    const instance = new ProductModel(undefined)
    const model = await DB.instance.selectFrom('products')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created Product')
    }

    if (model)
      dispatch('product:created', model)

    return instance.createInstance(model)
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

  async categoryBelong(): Promise<CategoryModel> {
    if (this.category_id === undefined)
      throw new HttpError(500, 'Relation Error!')

    const model = await Category
      .where('id', '=', this.category_id)
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
      preparation_time: this.preparation_time,
      allergens: this.allergens,
      nutritional_info: this.nutritional_info,

      created_at: this.created_at,

      updated_at: this.updated_at,

      reviews: this.reviews,
      product_units: this.product_units,
      product_variants: this.product_variants,
      license_keys: this.license_keys,
      waitlist_products: this.waitlist_products,
      coupons: this.coupons,
      category_id: this.category_id,
      category: this.category,
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

  // Add a protected applyFind implementation
  protected async applyFind(id: number): Promise<ProductModel | undefined> {
    const model = await DB.instance.selectFrom(this.tableName)
      .where('id', '=', id)
      .selectAll()
      .executeTakeFirst()

    if (!model)
      return undefined

    this.mapCustomGetters(model)

    await this.loadRelations(model)

    // Return a proper instance using the factory method
    return this.createInstance(model)
  }
}

export async function find(id: number): Promise<ProductModel | undefined> {
  const query = DB.instance.selectFrom('products').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  const instance = new ProductModel(undefined)
  return instance.createInstance(model)
}

export async function count(): Promise<number> {
  const results = await ProductModel.count()

  return results
}

export async function create(newProduct: NewProduct): Promise<ProductModel> {
  const instance = new ProductModel(undefined)
  return await instance.applyCreate(newProduct)
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
