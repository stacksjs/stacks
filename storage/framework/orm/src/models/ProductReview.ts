import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import type { CustomerModel } from './Customer'
import type { ProductModel } from './Product'
import { randomUUIDv7 } from 'bun'
import { sql } from '@stacksjs/database'
import { HttpError } from '@stacksjs/error-handling'
import { dispatch } from '@stacksjs/events'

import { BaseOrm, DB } from '@stacksjs/orm'

export interface ProductReviewsTable {
  id: Generated<number>
  product_id: number
  customer_id: number
  rating: number
  title: string
  content: string
  is_verified_purchase?: boolean
  is_approved?: boolean
  helpful_votes?: number
  unhelpful_votes?: number
  purchase_date?: string
  images?: string
  uuid?: string

  created_at?: Date

  updated_at?: Date

}

export interface ProductReviewResponse {
  data: ProductReviewJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface ProductReviewJsonResponse extends Omit<Selectable<ProductReviewsTable>, 'password'> {
  [key: string]: any
}

export type NewProductReview = Insertable<ProductReviewsTable>
export type ProductReviewUpdate = Updateable<ProductReviewsTable>

export class ProductReviewModel extends BaseOrm<ProductReviewModel, ProductReviewsTable, ProductReviewJsonResponse> {
  private readonly hidden: Array<keyof ProductReviewJsonResponse> = []
  private readonly fillable: Array<keyof ProductReviewJsonResponse> = ['rating', 'title', 'content', 'is_verified_purchase', 'is_approved', 'helpful_votes', 'unhelpful_votes', 'purchase_date', 'images', 'uuid']
  private readonly guarded: Array<keyof ProductReviewJsonResponse> = []
  protected attributes = {} as ProductReviewJsonResponse
  protected originalAttributes = {} as ProductReviewJsonResponse

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

  constructor(productReview: ProductReviewJsonResponse | undefined) {
    super('product_reviews')
    if (productReview) {
      this.attributes = { ...productReview }
      this.originalAttributes = { ...productReview }

      Object.keys(productReview).forEach((key) => {
        if (!(key in this)) {
          this.customColumns[key] = (productReview as ProductReviewJsonResponse)[key]
        }
      })
    }

    this.withRelations = []
    this.selectFromQuery = DB.instance.selectFrom('product_reviews')
    this.updateFromQuery = DB.instance.updateTable('product_reviews')
    this.deleteFromQuery = DB.instance.deleteFrom('product_reviews')
    this.hasSelect = false
    this.hasSaved = false
  }

  protected async loadRelations(models: ProductReviewJsonResponse | ProductReviewJsonResponse[]): Promise<void> {
    // Handle both single model and array of models
    const modelArray = Array.isArray(models) ? models : [models]
    if (!modelArray.length)
      return

    const modelIds = modelArray.map(model => model.id)

    for (const relation of this.withRelations) {
      const relatedRecords = await DB.instance
        .selectFrom(relation)
        .where('productReview_id', 'in', modelIds)
        .selectAll()
        .execute()

      if (Array.isArray(models)) {
        models.map((model: ProductReviewJsonResponse) => {
          const records = relatedRecords.filter((record: { productReview_id: number }) => {
            return record.productReview_id === model.id
          })

          model[relation] = records.length === 1 ? records[0] : records
          return model
        })
      }
      else {
        const records = relatedRecords.filter((record: { productReview_id: number }) => {
          return record.productReview_id === models.id
        })

        models[relation] = records.length === 1 ? records[0] : records
      }
    }
  }

  static with(relations: string[]): ProductReviewModel {
    const instance = new ProductReviewModel(undefined)

    return instance.applyWith(relations)
  }

  protected mapCustomGetters(models: ProductReviewJsonResponse | ProductReviewJsonResponse[]): void {
    const data = models

    if (Array.isArray(data)) {
      data.map((model: ProductReviewJsonResponse) => {
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

  async mapCustomSetters(model: NewProductReview | ProductReviewUpdate): Promise<void> {
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

  get rating(): number {
    return this.attributes.rating
  }

  get title(): string {
    return this.attributes.title
  }

  get content(): string {
    return this.attributes.content
  }

  get is_verified_purchase(): boolean | undefined {
    return this.attributes.is_verified_purchase
  }

  get is_approved(): boolean | undefined {
    return this.attributes.is_approved
  }

  get helpful_votes(): number | undefined {
    return this.attributes.helpful_votes
  }

  get unhelpful_votes(): number | undefined {
    return this.attributes.unhelpful_votes
  }

  get purchase_date(): string | undefined {
    return this.attributes.purchase_date
  }

  get images(): string | undefined {
    return this.attributes.images
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

  set rating(value: number) {
    this.attributes.rating = value
  }

  set title(value: string) {
    this.attributes.title = value
  }

  set content(value: string) {
    this.attributes.content = value
  }

  set is_verified_purchase(value: boolean) {
    this.attributes.is_verified_purchase = value
  }

  set is_approved(value: boolean) {
    this.attributes.is_approved = value
  }

  set helpful_votes(value: number) {
    this.attributes.helpful_votes = value
  }

  set unhelpful_votes(value: number) {
    this.attributes.unhelpful_votes = value
  }

  set purchase_date(value: string) {
    this.attributes.purchase_date = value
  }

  set images(value: string) {
    this.attributes.images = value
  }

  set updated_at(value: Date) {
    this.attributes.updated_at = value
  }

  static select(params: (keyof ProductReviewJsonResponse)[] | RawBuilder<string> | string): ProductReviewModel {
    const instance = new ProductReviewModel(undefined)

    return instance.applySelect(params)
  }

  // Method to find a ProductReview by ID
  static async find(id: number): Promise<ProductReviewModel | undefined> {
    const query = DB.instance.selectFrom('product_reviews').where('id', '=', id).selectAll()

    const model = await query.executeTakeFirst()

    if (!model)
      return undefined

    const instance = new ProductReviewModel(undefined)
    return instance.createInstance(model)
  }

  static async first(): Promise<ProductReviewModel | undefined> {
    const instance = new ProductReviewModel(undefined)

    const model = await instance.applyFirst()

    const data = new ProductReviewModel(model)

    return data
  }

  static async last(): Promise<ProductReviewModel | undefined> {
    const instance = new ProductReviewModel(undefined)

    const model = await instance.applyLast()

    if (!model)
      return undefined

    return new ProductReviewModel(model)
  }

  static async firstOrFail(): Promise<ProductReviewModel | undefined> {
    const instance = new ProductReviewModel(undefined)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<ProductReviewModel[]> {
    const instance = new ProductReviewModel(undefined)

    const models = await DB.instance.selectFrom('product_reviews').selectAll().execute()

    instance.mapCustomGetters(models)

    const data = await Promise.all(models.map(async (model: ProductReviewJsonResponse) => {
      return new ProductReviewModel(model)
    }))

    return data
  }

  static async findOrFail(id: number): Promise<ProductReviewModel | undefined> {
    const instance = new ProductReviewModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  static async findMany(ids: number[]): Promise<ProductReviewModel[]> {
    const instance = new ProductReviewModel(undefined)

    const models = await instance.applyFindMany(ids)

    return models.map((modelItem: ProductReviewJsonResponse) => instance.parseResult(new ProductReviewModel(modelItem)))
  }

  static async latest(column: keyof ProductReviewsTable = 'created_at'): Promise<ProductReviewModel | undefined> {
    const instance = new ProductReviewModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'desc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new ProductReviewModel(model)
  }

  static async oldest(column: keyof ProductReviewsTable = 'created_at'): Promise<ProductReviewModel | undefined> {
    const instance = new ProductReviewModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'asc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new ProductReviewModel(model)
  }

  static skip(count: number): ProductReviewModel {
    const instance = new ProductReviewModel(undefined)

    return instance.applySkip(count)
  }

  static take(count: number): ProductReviewModel {
    const instance = new ProductReviewModel(undefined)

    return instance.applyTake(count)
  }

  static where<V = string>(column: keyof ProductReviewsTable, ...args: [V] | [Operator, V]): ProductReviewModel {
    const instance = new ProductReviewModel(undefined)

    return instance.applyWhere<V>(column, ...args)
  }

  static orWhere(...conditions: [string, any][]): ProductReviewModel {
    const instance = new ProductReviewModel(undefined)

    return instance.applyOrWhere(...conditions)
  }

  static whereNotIn<V = number>(column: keyof ProductReviewsTable, values: V[]): ProductReviewModel {
    const instance = new ProductReviewModel(undefined)

    return instance.applyWhereNotIn<V>(column, values)
  }

  static whereBetween<V = number>(column: keyof ProductReviewsTable, range: [V, V]): ProductReviewModel {
    const instance = new ProductReviewModel(undefined)

    return instance.applyWhereBetween<V>(column, range)
  }

  static whereRef(column: keyof ProductReviewsTable, ...args: string[]): ProductReviewModel {
    const instance = new ProductReviewModel(undefined)

    return instance.applyWhereRef(column, ...args)
  }

  static when(condition: boolean, callback: (query: ProductReviewModel) => ProductReviewModel): ProductReviewModel {
    const instance = new ProductReviewModel(undefined)

    return instance.applyWhen(condition, callback as any)
  }

  static whereNull(column: keyof ProductReviewsTable): ProductReviewModel {
    const instance = new ProductReviewModel(undefined)

    return instance.applyWhereNull(column)
  }

  static whereNotNull(column: keyof ProductReviewsTable): ProductReviewModel {
    const instance = new ProductReviewModel(undefined)

    return instance.applyWhereNotNull(column)
  }

  static whereLike(column: keyof ProductReviewsTable, value: string): ProductReviewModel {
    const instance = new ProductReviewModel(undefined)

    return instance.applyWhereLike(column, value)
  }

  static orderBy(column: keyof ProductReviewsTable, order: 'asc' | 'desc'): ProductReviewModel {
    const instance = new ProductReviewModel(undefined)

    return instance.applyOrderBy(column, order)
  }

  static orderByAsc(column: keyof ProductReviewsTable): ProductReviewModel {
    const instance = new ProductReviewModel(undefined)

    return instance.applyOrderByAsc(column)
  }

  static orderByDesc(column: keyof ProductReviewsTable): ProductReviewModel {
    const instance = new ProductReviewModel(undefined)

    return instance.applyOrderByDesc(column)
  }

  static groupBy(column: keyof ProductReviewsTable): ProductReviewModel {
    const instance = new ProductReviewModel(undefined)

    return instance.applyGroupBy(column)
  }

  static having<V = string>(column: keyof ProductReviewsTable, operator: Operator, value: V): ProductReviewModel {
    const instance = new ProductReviewModel(undefined)

    return instance.applyHaving<V>(column, operator, value)
  }

  static inRandomOrder(): ProductReviewModel {
    const instance = new ProductReviewModel(undefined)

    return instance.applyInRandomOrder()
  }

  static whereColumn(first: keyof ProductReviewsTable, operator: Operator, second: keyof ProductReviewsTable): ProductReviewModel {
    const instance = new ProductReviewModel(undefined)

    return instance.applyWhereColumn(first, operator, second)
  }

  static async max(field: keyof ProductReviewsTable): Promise<number> {
    const instance = new ProductReviewModel(undefined)

    return await instance.applyMax(field)
  }

  static async min(field: keyof ProductReviewsTable): Promise<number> {
    const instance = new ProductReviewModel(undefined)

    return await instance.applyMin(field)
  }

  static async avg(field: keyof ProductReviewsTable): Promise<number> {
    const instance = new ProductReviewModel(undefined)

    return await instance.applyAvg(field)
  }

  static async sum(field: keyof ProductReviewsTable): Promise<number> {
    const instance = new ProductReviewModel(undefined)

    return await instance.applySum(field)
  }

  static async count(): Promise<number> {
    const instance = new ProductReviewModel(undefined)

    return instance.applyCount()
  }

  static async get(): Promise<ProductReviewModel[]> {
    const instance = new ProductReviewModel(undefined)

    const results = await instance.applyGet()

    return results.map((item: ProductReviewJsonResponse) => instance.createInstance(item))
  }

  static async pluck<K extends keyof ProductReviewModel>(field: K): Promise<ProductReviewModel[K][]> {
    const instance = new ProductReviewModel(undefined)

    return await instance.applyPluck(field)
  }

  static async chunk(size: number, callback: (models: ProductReviewModel[]) => Promise<void>): Promise<void> {
    const instance = new ProductReviewModel(undefined)

    await instance.applyChunk(size, async (models) => {
      const modelInstances = models.map((item: ProductReviewJsonResponse) => instance.createInstance(item))
      await callback(modelInstances)
    })
  }

  static async paginate(options: { limit?: number, offset?: number, page?: number } = { limit: 10, offset: 0, page: 1 }): Promise<{
    data: ProductReviewModel[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }> {
    const instance = new ProductReviewModel(undefined)

    const result = await instance.applyPaginate(options)

    return {
      data: result.data.map((item: ProductReviewJsonResponse) => instance.createInstance(item)),
      paging: result.paging,
      next_cursor: result.next_cursor,
    }
  }

  // Instance method for creating model instances
  createInstance(data: ProductReviewJsonResponse): ProductReviewModel {
    return new ProductReviewModel(data)
  }

  async applyCreate(newProductReview: NewProductReview): Promise<ProductReviewModel> {
    const filteredValues = Object.fromEntries(
      Object.entries(newProductReview).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewProductReview

    await this.mapCustomSetters(filteredValues)

    filteredValues.uuid = randomUUIDv7()

    const result = await DB.instance.insertInto('product_reviews')
      .values(filteredValues)
      .executeTakeFirst()

    const modelData = await DB.instance.selectFrom('product_reviews')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!modelData) {
      throw new HttpError(500, 'Failed to retrieve created ProductReview')
    }

    if (model)
      dispatch('productReview:created', model)
    return this.createInstance(modelData)
  }

  async create(newProductReview: NewProductReview): Promise<ProductReviewModel> {
    return await this.applyCreate(newProductReview)
  }

  static async create(newProductReview: NewProductReview): Promise<ProductReviewModel> {
    const instance = new ProductReviewModel(undefined)
    return await instance.applyCreate(newProductReview)
  }

  static async firstOrCreate(search: Partial<ProductReviewsTable>, values: NewProductReview = {} as NewProductReview): Promise<ProductReviewModel> {
    // First try to find a record matching the search criteria
    const instance = new ProductReviewModel(undefined)

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
    const createData = { ...search, ...values } as NewProductReview
    return await ProductReviewModel.create(createData)
  }

  static async updateOrCreate(search: Partial<ProductReviewsTable>, values: NewProductReview = {} as NewProductReview): Promise<ProductReviewModel> {
    // First try to find a record matching the search criteria
    const instance = new ProductReviewModel(undefined)

    // Apply all search conditions
    for (const [key, value] of Object.entries(search)) {
      instance.selectFromQuery = instance.selectFromQuery.where(key, '=', value)
    }

    // Try to find the record
    const existingRecord = await instance.applyFirst()

    if (existingRecord) {
      // If record exists, update it with the new values
      const model = instance.createInstance(existingRecord)
      await model.update(values as ProductReviewUpdate)
      return model
    }

    // If no record exists, create a new one with combined search criteria and values
    const createData = { ...search, ...values } as NewProductReview
    return await ProductReviewModel.create(createData)
  }

  async update(newProductReview: ProductReviewUpdate): Promise<ProductReviewModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newProductReview).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as ProductReviewUpdate

    await this.mapCustomSetters(filteredValues)

    await DB.instance.updateTable('product_reviews')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const modelData = await DB.instance.selectFrom('product_reviews')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!modelData) {
        throw new HttpError(500, 'Failed to retrieve updated ProductReview')
      }

      if (model)
        dispatch('productReview:updated', model)
      return this.createInstance(modelData)
    }

    this.hasSaved = true

    return undefined
  }

  async forceUpdate(newProductReview: ProductReviewUpdate): Promise<ProductReviewModel | undefined> {
    await DB.instance.updateTable('product_reviews')
      .set(newProductReview)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const modelData = await DB.instance.selectFrom('product_reviews')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!modelData) {
        throw new HttpError(500, 'Failed to retrieve updated ProductReview')
      }

      if (this)
        dispatch('productReview:updated', model)
      return this.createInstance(modelData)
    }

    return undefined
  }

  async save(): Promise<ProductReviewModel> {
    // If the model has an ID, update it; otherwise, create a new record
    if (this.id) {
      // Update existing record
      await DB.instance.updateTable('product_reviews')
        .set(this.attributes as ProductReviewUpdate)
        .where('id', '=', this.id)
        .executeTakeFirst()

      // Get the updated data
      const modelData = await DB.instance.selectFrom('product_reviews')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!modelData) {
        throw new HttpError(500, 'Failed to retrieve updated ProductReview')
      }

      if (this)
        dispatch('productReview:updated', model)
      return this.createInstance(modelData)
    }
    else {
      // Create new record
      const result = await DB.instance.insertInto('product_reviews')
        .values(this.attributes as NewProductReview)
        .executeTakeFirst()

      // Get the created data
      const modelData = await DB.instance.selectFrom('product_reviews')
        .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
        .selectAll()
        .executeTakeFirst()

      if (!modelData) {
        throw new HttpError(500, 'Failed to retrieve created ProductReview')
      }

      if (this)
        dispatch('productReview:created', model)
      return this.createInstance(modelData)
    }
  }

  static async createMany(newProductReview: NewProductReview[]): Promise<void> {
    const instance = new ProductReviewModel(undefined)

    const valuesFiltered = newProductReview.map((newProductReview: NewProductReview) => {
      const filteredValues = Object.fromEntries(
        Object.entries(newProductReview).filter(([key]) =>
          !instance.guarded.includes(key) && instance.fillable.includes(key),
        ),
      ) as NewProductReview

      filteredValues.uuid = randomUUIDv7()

      return filteredValues
    })

    await DB.instance.insertInto('product_reviews')
      .values(valuesFiltered)
      .executeTakeFirst()
  }

  static async forceCreate(newProductReview: NewProductReview): Promise<ProductReviewModel> {
    const result = await DB.instance.insertInto('product_reviews')
      .values(newProductReview)
      .executeTakeFirst()

    const instance = new ProductReviewModel(undefined)
    const modelData = await DB.instance.selectFrom('product_reviews')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!modelData) {
      throw new HttpError(500, 'Failed to retrieve created ProductReview')
    }

    if (model)
      dispatch('productReview:created', model)

    return instance.createInstance(modelData)
  }

  // Method to remove a ProductReview
  async delete(): Promise<number> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()
    const model = await this.find(Number(this.id))

    if (model)
      dispatch('productReview:deleted', model)

    const deleted = await DB.instance.deleteFrom('product_reviews')
      .where('id', '=', this.id)
      .execute()

    return deleted.numDeletedRows
  }

  static async remove(id: number): Promise<any> {
    const instance = new ProductReviewModel(undefined)

    const model = await instance.find(Number(id))

    if (model)
      dispatch('productReview:deleted', model)

    return await DB.instance.deleteFrom('product_reviews')
      .where('id', '=', id)
      .execute()
  }

  static whereRating(value: string): ProductReviewModel {
    const instance = new ProductReviewModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('rating', '=', value)

    return instance
  }

  static whereTitle(value: string): ProductReviewModel {
    const instance = new ProductReviewModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('title', '=', value)

    return instance
  }

  static whereContent(value: string): ProductReviewModel {
    const instance = new ProductReviewModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('content', '=', value)

    return instance
  }

  static whereIsVerifiedPurchase(value: string): ProductReviewModel {
    const instance = new ProductReviewModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('is_verified_purchase', '=', value)

    return instance
  }

  static whereIsApproved(value: string): ProductReviewModel {
    const instance = new ProductReviewModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('is_approved', '=', value)

    return instance
  }

  static whereHelpfulVotes(value: string): ProductReviewModel {
    const instance = new ProductReviewModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('helpful_votes', '=', value)

    return instance
  }

  static whereUnhelpfulVotes(value: string): ProductReviewModel {
    const instance = new ProductReviewModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('unhelpful_votes', '=', value)

    return instance
  }

  static wherePurchaseDate(value: string): ProductReviewModel {
    const instance = new ProductReviewModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('purchase_date', '=', value)

    return instance
  }

  static whereImages(value: string): ProductReviewModel {
    const instance = new ProductReviewModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('images', '=', value)

    return instance
  }

  static whereIn<V = number>(column: keyof ProductReviewsTable, values: V[]): ProductReviewModel {
    const instance = new ProductReviewModel(undefined)

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

  toSearchableObject(): Partial<ProductReviewJsonResponse> {
    return {
      id: this.id,
      product_id: this.product_id,
      rating: this.rating,
      title: this.title,
      content: this.content,
      is_verified_purchase: this.is_verified_purchase,
      is_approved: this.is_approved,
    }
  }

  static distinct(column: keyof ProductReviewJsonResponse): ProductReviewModel {
    const instance = new ProductReviewModel(undefined)

    return instance.applyDistinct(column)
  }

  static join(table: string, firstCol: string, secondCol: string): ProductReviewModel {
    const instance = new ProductReviewModel(undefined)

    return instance.applyJoin(table, firstCol, secondCol)
  }

  toJSON(): ProductReviewJsonResponse {
    const output = {

      uuid: this.uuid,

      id: this.id,
      rating: this.rating,
      title: this.title,
      content: this.content,
      is_verified_purchase: this.is_verified_purchase,
      is_approved: this.is_approved,
      helpful_votes: this.helpful_votes,
      unhelpful_votes: this.unhelpful_votes,
      purchase_date: this.purchase_date,
      images: this.images,

      created_at: this.created_at,

      updated_at: this.updated_at,

      product_id: this.product_id,
      product: this.product,
      customer_id: this.customer_id,
      customer: this.customer,
      ...this.customColumns,
    }

    return output
  }

  parseResult(model: ProductReviewModel): ProductReviewModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof ProductReviewModel]
    }

    return model
  }

  // Add a protected applyFind implementation
  protected async applyFind(id: number): Promise<ProductReviewModel | undefined> {
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

export async function find(id: number): Promise<ProductReviewModel | undefined> {
  const query = DB.instance.selectFrom('product_reviews').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  const instance = new ProductReviewModel(undefined)
  return instance.createInstance(model)
}

export async function count(): Promise<number> {
  const results = await ProductReviewModel.count()

  return results
}

export async function create(newProductReview: NewProductReview): Promise<ProductReviewModel> {
  const instance = new ProductReviewModel(undefined)
  return await instance.applyCreate(newProductReview)
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(DB.instance)
}

export async function remove(id: number): Promise<void> {
  await DB.instance.deleteFrom('product_reviews')
    .where('id', '=', id)
    .execute()
}

export async function whereRating(value: number): Promise<ProductReviewModel[]> {
  const query = DB.instance.selectFrom('product_reviews').where('rating', '=', value)
  const results: ProductReviewJsonResponse = await query.execute()

  return results.map((modelItem: ProductReviewJsonResponse) => new ProductReviewModel(modelItem))
}

export async function whereTitle(value: string): Promise<ProductReviewModel[]> {
  const query = DB.instance.selectFrom('product_reviews').where('title', '=', value)
  const results: ProductReviewJsonResponse = await query.execute()

  return results.map((modelItem: ProductReviewJsonResponse) => new ProductReviewModel(modelItem))
}

export async function whereContent(value: string): Promise<ProductReviewModel[]> {
  const query = DB.instance.selectFrom('product_reviews').where('content', '=', value)
  const results: ProductReviewJsonResponse = await query.execute()

  return results.map((modelItem: ProductReviewJsonResponse) => new ProductReviewModel(modelItem))
}

export async function whereIsVerifiedPurchase(value: boolean): Promise<ProductReviewModel[]> {
  const query = DB.instance.selectFrom('product_reviews').where('is_verified_purchase', '=', value)
  const results: ProductReviewJsonResponse = await query.execute()

  return results.map((modelItem: ProductReviewJsonResponse) => new ProductReviewModel(modelItem))
}

export async function whereIsApproved(value: boolean): Promise<ProductReviewModel[]> {
  const query = DB.instance.selectFrom('product_reviews').where('is_approved', '=', value)
  const results: ProductReviewJsonResponse = await query.execute()

  return results.map((modelItem: ProductReviewJsonResponse) => new ProductReviewModel(modelItem))
}

export async function whereHelpfulVotes(value: number): Promise<ProductReviewModel[]> {
  const query = DB.instance.selectFrom('product_reviews').where('helpful_votes', '=', value)
  const results: ProductReviewJsonResponse = await query.execute()

  return results.map((modelItem: ProductReviewJsonResponse) => new ProductReviewModel(modelItem))
}

export async function whereUnhelpfulVotes(value: number): Promise<ProductReviewModel[]> {
  const query = DB.instance.selectFrom('product_reviews').where('unhelpful_votes', '=', value)
  const results: ProductReviewJsonResponse = await query.execute()

  return results.map((modelItem: ProductReviewJsonResponse) => new ProductReviewModel(modelItem))
}

export async function wherePurchaseDate(value: string): Promise<ProductReviewModel[]> {
  const query = DB.instance.selectFrom('product_reviews').where('purchase_date', '=', value)
  const results: ProductReviewJsonResponse = await query.execute()

  return results.map((modelItem: ProductReviewJsonResponse) => new ProductReviewModel(modelItem))
}

export async function whereImages(value: string): Promise<ProductReviewModel[]> {
  const query = DB.instance.selectFrom('product_reviews').where('images', '=', value)
  const results: ProductReviewJsonResponse = await query.execute()

  return results.map((modelItem: ProductReviewJsonResponse) => new ProductReviewModel(modelItem))
}

export const ProductReview = ProductReviewModel

export default ProductReview
