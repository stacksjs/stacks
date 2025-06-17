import type { RawBuilder } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import type { NewReview, ReviewJsonResponse, ReviewsTable, ReviewUpdate } from '../types/ReviewType'
import type { CustomerModel } from './Customer'
import type { ProductModel } from './Product'
import { randomUUIDv7 } from 'bun'
import { sql } from '@stacksjs/database'
import { HttpError } from '@stacksjs/error-handling'
import { dispatch } from '@stacksjs/events'
import { DB } from '@stacksjs/orm'

import { BaseOrm } from '../utils/base'

export class ReviewModel extends BaseOrm<ReviewModel, ReviewsTable, ReviewJsonResponse> {
  private readonly hidden: Array<keyof ReviewJsonResponse> = []
  private readonly fillable: Array<keyof ReviewJsonResponse> = ['rating', 'title', 'content', 'is_verified_purchase', 'is_approved', 'is_featured', 'helpful_votes', 'unhelpful_votes', 'purchase_date', 'images', 'uuid', 'customer_id', 'product_id']
  private readonly guarded: Array<keyof ReviewJsonResponse> = []
  protected attributes = {} as ReviewJsonResponse
  protected originalAttributes = {} as ReviewJsonResponse

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

  constructor(review: ReviewJsonResponse | undefined) {
    super('reviews')
    if (review) {
      this.attributes = { ...review }
      this.originalAttributes = { ...review }

      Object.keys(review).forEach((key) => {
        if (!(key in this)) {
          this.customColumns[key] = (review as ReviewJsonResponse)[key]
        }
      })
    }

    this.withRelations = []
    this.selectFromQuery = DB.instance.selectFrom('reviews')
    this.updateFromQuery = DB.instance.updateTable('reviews')
    this.deleteFromQuery = DB.instance.deleteFrom('reviews')
    this.hasSelect = false
  }

  protected async loadRelations(models: ReviewJsonResponse | ReviewJsonResponse[]): Promise<void> {
    // Handle both single model and array of models
    const modelArray = Array.isArray(models) ? models : [models]
    if (!modelArray.length)
      return

    const modelIds = modelArray.map(model => model.id)

    for (const relation of this.withRelations) {
      const relatedRecords = await DB.instance
        .selectFrom(relation)
        .where('review_id', 'in', modelIds)
        .selectAll()
        .execute()

      if (Array.isArray(models)) {
        models.map((model: ReviewJsonResponse) => {
          const records = relatedRecords.filter((record: { review_id: number }) => {
            return record.review_id === model.id
          })

          model[relation] = records.length === 1 ? records[0] : records
          return model
        })
      }
      else {
        const records = relatedRecords.filter((record: { review_id: number }) => {
          return record.review_id === models.id
        })

        models[relation] = records.length === 1 ? records[0] : records
      }
    }
  }

  static with(relations: string[]): ReviewModel {
    const instance = new ReviewModel(undefined)

    return instance.applyWith(relations)
  }

  protected mapCustomGetters(models: ReviewJsonResponse | ReviewJsonResponse[]): void {
    const data = models

    if (Array.isArray(data)) {
      data.map((model: ReviewJsonResponse) => {
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

  async mapCustomSetters(model: NewReview | ReviewUpdate): Promise<void> {
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

  get is_featured(): boolean | undefined {
    return this.attributes.is_featured
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

  get created_at(): string | undefined {
    return this.attributes.created_at
  }

  get updated_at(): string | undefined {
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

  set is_featured(value: boolean) {
    this.attributes.is_featured = value
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

  set updated_at(value: string) {
    this.attributes.updated_at = value
  }

  static select(params: (keyof ReviewJsonResponse)[] | RawBuilder<string> | string): ReviewModel {
    const instance = new ReviewModel(undefined)

    return instance.applySelect(params)
  }

  // Method to find a Review by ID
  static async find(id: number): Promise<ReviewModel | undefined> {
    const query = DB.instance.selectFrom('reviews').where('id', '=', id).selectAll()

    const model = await query.executeTakeFirst()

    if (!model)
      return undefined

    const instance = new ReviewModel(undefined)
    return instance.createInstance(model)
  }

  static async first(): Promise<ReviewModel | undefined> {
    const instance = new ReviewModel(undefined)

    const model = await instance.applyFirst()

    const data = new ReviewModel(model)

    return data
  }

  static async last(): Promise<ReviewModel | undefined> {
    const instance = new ReviewModel(undefined)

    const model = await instance.applyLast()

    if (!model)
      return undefined

    return new ReviewModel(model)
  }

  static async firstOrFail(): Promise<ReviewModel | undefined> {
    const instance = new ReviewModel(undefined)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<ReviewModel[]> {
    const instance = new ReviewModel(undefined)

    const models = await DB.instance.selectFrom('reviews').selectAll().execute()

    instance.mapCustomGetters(models)

    const data = await Promise.all(models.map(async (model: ReviewJsonResponse) => {
      return new ReviewModel(model)
    }))

    return data
  }

  static async findOrFail(id: number): Promise<ReviewModel | undefined> {
    const instance = new ReviewModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  static async findMany(ids: number[]): Promise<ReviewModel[]> {
    const instance = new ReviewModel(undefined)

    const models = await instance.applyFindMany(ids)

    return models.map((modelItem: ReviewJsonResponse) => instance.parseResult(new ReviewModel(modelItem)))
  }

  static async latest(column: keyof ReviewsTable = 'created_at'): Promise<ReviewModel | undefined> {
    const instance = new ReviewModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'desc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new ReviewModel(model)
  }

  static async oldest(column: keyof ReviewsTable = 'created_at'): Promise<ReviewModel | undefined> {
    const instance = new ReviewModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'asc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new ReviewModel(model)
  }

  static skip(count: number): ReviewModel {
    const instance = new ReviewModel(undefined)

    return instance.applySkip(count)
  }

  static take(count: number): ReviewModel {
    const instance = new ReviewModel(undefined)

    return instance.applyTake(count)
  }

  static where<V = string>(column: keyof ReviewsTable, ...args: [V] | [Operator, V]): ReviewModel {
    const instance = new ReviewModel(undefined)

    return instance.applyWhere<V>(column, ...args)
  }

  static orWhere(...conditions: [string, any][]): ReviewModel {
    const instance = new ReviewModel(undefined)

    return instance.applyOrWhere(...conditions)
  }

  static whereNotIn<V = number>(column: keyof ReviewsTable, values: V[]): ReviewModel {
    const instance = new ReviewModel(undefined)

    return instance.applyWhereNotIn<V>(column, values)
  }

  static whereBetween<V = number>(column: keyof ReviewsTable, range: [V, V]): ReviewModel {
    const instance = new ReviewModel(undefined)

    return instance.applyWhereBetween<V>(column, range)
  }

  static whereRef(column: keyof ReviewsTable, ...args: string[]): ReviewModel {
    const instance = new ReviewModel(undefined)

    return instance.applyWhereRef(column, ...args)
  }

  static when(condition: boolean, callback: (query: ReviewModel) => ReviewModel): ReviewModel {
    const instance = new ReviewModel(undefined)

    return instance.applyWhen(condition, callback as any)
  }

  static whereNull(column: keyof ReviewsTable): ReviewModel {
    const instance = new ReviewModel(undefined)

    return instance.applyWhereNull(column)
  }

  static whereNotNull(column: keyof ReviewsTable): ReviewModel {
    const instance = new ReviewModel(undefined)

    return instance.applyWhereNotNull(column)
  }

  static whereLike(column: keyof ReviewsTable, value: string): ReviewModel {
    const instance = new ReviewModel(undefined)

    return instance.applyWhereLike(column, value)
  }

  static orderBy(column: keyof ReviewsTable, order: 'asc' | 'desc'): ReviewModel {
    const instance = new ReviewModel(undefined)

    return instance.applyOrderBy(column, order)
  }

  static orderByAsc(column: keyof ReviewsTable): ReviewModel {
    const instance = new ReviewModel(undefined)

    return instance.applyOrderByAsc(column)
  }

  static orderByDesc(column: keyof ReviewsTable): ReviewModel {
    const instance = new ReviewModel(undefined)

    return instance.applyOrderByDesc(column)
  }

  static groupBy(column: keyof ReviewsTable): ReviewModel {
    const instance = new ReviewModel(undefined)

    return instance.applyGroupBy(column)
  }

  static having<V = string>(column: keyof ReviewsTable, operator: Operator, value: V): ReviewModel {
    const instance = new ReviewModel(undefined)

    return instance.applyHaving<V>(column, operator, value)
  }

  static inRandomOrder(): ReviewModel {
    const instance = new ReviewModel(undefined)

    return instance.applyInRandomOrder()
  }

  static whereColumn(first: keyof ReviewsTable, operator: Operator, second: keyof ReviewsTable): ReviewModel {
    const instance = new ReviewModel(undefined)

    return instance.applyWhereColumn(first, operator, second)
  }

  static async max(field: keyof ReviewsTable): Promise<number> {
    const instance = new ReviewModel(undefined)

    return await instance.applyMax(field)
  }

  static async min(field: keyof ReviewsTable): Promise<number> {
    const instance = new ReviewModel(undefined)

    return await instance.applyMin(field)
  }

  static async avg(field: keyof ReviewsTable): Promise<number> {
    const instance = new ReviewModel(undefined)

    return await instance.applyAvg(field)
  }

  static async sum(field: keyof ReviewsTable): Promise<number> {
    const instance = new ReviewModel(undefined)

    return await instance.applySum(field)
  }

  static async count(): Promise<number> {
    const instance = new ReviewModel(undefined)

    return instance.applyCount()
  }

  static async get(): Promise<ReviewModel[]> {
    const instance = new ReviewModel(undefined)

    const results = await instance.applyGet()

    return results.map((item: ReviewJsonResponse) => instance.createInstance(item))
  }

  static async pluck<K extends keyof ReviewModel>(field: K): Promise<ReviewModel[K][]> {
    const instance = new ReviewModel(undefined)

    return await instance.applyPluck(field)
  }

  static async chunk(size: number, callback: (models: ReviewModel[]) => Promise<void>): Promise<void> {
    const instance = new ReviewModel(undefined)

    await instance.applyChunk(size, async (models) => {
      const modelInstances = models.map((item: ReviewJsonResponse) => instance.createInstance(item))
      await callback(modelInstances)
    })
  }

  static async paginate(options: { limit?: number, offset?: number, page?: number } = { limit: 10, offset: 0, page: 1 }): Promise<{
    data: ReviewModel[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }> {
    const instance = new ReviewModel(undefined)

    const result = await instance.applyPaginate(options)

    return {
      data: result.data.map((item: ReviewJsonResponse) => instance.createInstance(item)),
      paging: result.paging,
      next_cursor: result.next_cursor,
    }
  }

  // Instance method for creating model instances
  createInstance(data: ReviewJsonResponse): ReviewModel {
    return new ReviewModel(data)
  }

  async applyCreate(newReview: NewReview): Promise<ReviewModel> {
    const filteredValues = Object.fromEntries(
      Object.entries(newReview).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewReview

    await this.mapCustomSetters(filteredValues)

    filteredValues.uuid = randomUUIDv7()

    const result = await DB.instance.insertInto('reviews')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await DB.instance.selectFrom('reviews')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created Review')
    }

    if (model)
      dispatch('review:created', model)
    return this.createInstance(model)
  }

  async create(newReview: NewReview): Promise<ReviewModel> {
    return await this.applyCreate(newReview)
  }

  static async create(newReview: NewReview): Promise<ReviewModel> {
    const instance = new ReviewModel(undefined)
    return await instance.applyCreate(newReview)
  }

  static async firstOrCreate(search: Partial<ReviewsTable>, values: NewReview = {} as NewReview): Promise<ReviewModel> {
    // First try to find a record matching the search criteria
    const instance = new ReviewModel(undefined)

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
    const createData = { ...search, ...values } as NewReview
    return await ReviewModel.create(createData)
  }

  static async updateOrCreate(search: Partial<ReviewsTable>, values: NewReview = {} as NewReview): Promise<ReviewModel> {
    // First try to find a record matching the search criteria
    const instance = new ReviewModel(undefined)

    // Apply all search conditions
    for (const [key, value] of Object.entries(search)) {
      instance.selectFromQuery = instance.selectFromQuery.where(key, '=', value)
    }

    // Try to find the record
    const existingRecord = await instance.applyFirst()

    if (existingRecord) {
      // If record exists, update it with the new values
      const model = instance.createInstance(existingRecord)
      const updatedModel = await model.update(values as ReviewUpdate)

      // Return the updated model instance
      if (updatedModel) {
        return updatedModel
      }

      // If update didn't return a model, fetch it again to ensure we have latest data
      const refreshedModel = await instance.applyFirst()
      return instance.createInstance(refreshedModel!)
    }

    // If no record exists, create a new one with combined search criteria and values
    const createData = { ...search, ...values } as NewReview
    return await ReviewModel.create(createData)
  }

  async update(newReview: ReviewUpdate): Promise<ReviewModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newReview).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as ReviewUpdate

    await this.mapCustomSetters(filteredValues)

    filteredValues.updated_at = new Date().toISOString()

    await DB.instance.updateTable('reviews')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('reviews')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated Review')
      }

      if (model)
        dispatch('review:updated', model)
      return this.createInstance(model)
    }

    return undefined
  }

  async forceUpdate(newReview: ReviewUpdate): Promise<ReviewModel | undefined> {
    await DB.instance.updateTable('reviews')
      .set(newReview)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('reviews')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated Review')
      }

      if (this)
        dispatch('review:updated', model)
      return this.createInstance(model)
    }

    return undefined
  }

  async save(): Promise<ReviewModel> {
    // If the model has an ID, update it; otherwise, create a new record
    if (this.id) {
      // Update existing record
      await DB.instance.updateTable('reviews')
        .set(this.attributes as ReviewUpdate)
        .where('id', '=', this.id)
        .executeTakeFirst()

      // Get the updated data
      const model = await DB.instance.selectFrom('reviews')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated Review')
      }

      if (this)
        dispatch('review:updated', model)
      return this.createInstance(model)
    }
    else {
      // Create new record
      const result = await DB.instance.insertInto('reviews')
        .values(this.attributes as NewReview)
        .executeTakeFirst()

      // Get the created data
      const model = await DB.instance.selectFrom('reviews')
        .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve created Review')
      }

      if (this)
        dispatch('review:created', model)
      return this.createInstance(model)
    }
  }

  static async createMany(newReview: NewReview[]): Promise<void> {
    const instance = new ReviewModel(undefined)

    const valuesFiltered = newReview.map((newReview: NewReview) => {
      const filteredValues = Object.fromEntries(
        Object.entries(newReview).filter(([key]) =>
          !instance.guarded.includes(key) && instance.fillable.includes(key),
        ),
      ) as NewReview

      filteredValues.uuid = randomUUIDv7()

      return filteredValues
    })

    await DB.instance.insertInto('reviews')
      .values(valuesFiltered)
      .executeTakeFirst()
  }

  static async forceCreate(newReview: NewReview): Promise<ReviewModel> {
    const result = await DB.instance.insertInto('reviews')
      .values(newReview)
      .executeTakeFirst()

    const instance = new ReviewModel(undefined)
    const model = await DB.instance.selectFrom('reviews')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created Review')
    }

    if (model)
      dispatch('review:created', model)

    return instance.createInstance(model)
  }

  // Method to remove a Review
  async delete(): Promise<number> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()
    const model = await this.find(Number(this.id))

    if (model)
      dispatch('review:deleted', model)

    const deleted = await DB.instance.deleteFrom('reviews')
      .where('id', '=', this.id)
      .execute()

    return deleted.numDeletedRows
  }

  static async remove(id: number): Promise<any> {
    const instance = new ReviewModel(undefined)

    const model = await instance.find(Number(id))

    if (model)
      dispatch('review:deleted', model)

    return await DB.instance.deleteFrom('reviews')
      .where('id', '=', id)
      .execute()
  }

  static whereRating(value: string): ReviewModel {
    const instance = new ReviewModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('rating', '=', value)

    return instance
  }

  static whereTitle(value: string): ReviewModel {
    const instance = new ReviewModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('title', '=', value)

    return instance
  }

  static whereContent(value: string): ReviewModel {
    const instance = new ReviewModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('content', '=', value)

    return instance
  }

  static whereIsVerifiedPurchase(value: string): ReviewModel {
    const instance = new ReviewModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('is_verified_purchase', '=', value)

    return instance
  }

  static whereIsApproved(value: string): ReviewModel {
    const instance = new ReviewModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('is_approved', '=', value)

    return instance
  }

  static whereIsFeatured(value: string): ReviewModel {
    const instance = new ReviewModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('is_featured', '=', value)

    return instance
  }

  static whereHelpfulVotes(value: string): ReviewModel {
    const instance = new ReviewModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('helpful_votes', '=', value)

    return instance
  }

  static whereUnhelpfulVotes(value: string): ReviewModel {
    const instance = new ReviewModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('unhelpful_votes', '=', value)

    return instance
  }

  static wherePurchaseDate(value: string): ReviewModel {
    const instance = new ReviewModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('purchase_date', '=', value)

    return instance
  }

  static whereImages(value: string): ReviewModel {
    const instance = new ReviewModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('images', '=', value)

    return instance
  }

  static whereIn<V = number>(column: keyof ReviewsTable, values: V[]): ReviewModel {
    const instance = new ReviewModel(undefined)

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

  toSearchableObject(): Partial<ReviewJsonResponse> {
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

  static distinct(column: keyof ReviewJsonResponse): ReviewModel {
    const instance = new ReviewModel(undefined)

    return instance.applyDistinct(column)
  }

  static join(table: string, firstCol: string, secondCol: string): ReviewModel {
    const instance = new ReviewModel(undefined)

    return instance.applyJoin(table, firstCol, secondCol)
  }

  toJSON(): ReviewJsonResponse {
    const output = {

      uuid: this.uuid,

      id: this.id,
      rating: this.rating,
      title: this.title,
      content: this.content,
      is_verified_purchase: this.is_verified_purchase,
      is_approved: this.is_approved,
      is_featured: this.is_featured,
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

  parseResult(model: ReviewModel): ReviewModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof ReviewModel]
    }

    return model
  }

  // Add a protected applyFind implementation
  protected async applyFind(id: number): Promise<ReviewModel | undefined> {
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

export async function find(id: number): Promise<ReviewModel | undefined> {
  const query = DB.instance.selectFrom('reviews').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  const instance = new ReviewModel(undefined)
  return instance.createInstance(model)
}

export async function count(): Promise<number> {
  const results = await ReviewModel.count()

  return results
}

export async function create(newReview: NewReview): Promise<ReviewModel> {
  const instance = new ReviewModel(undefined)
  return await instance.applyCreate(newReview)
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(DB.instance)
}

export async function remove(id: number): Promise<void> {
  await DB.instance.deleteFrom('reviews')
    .where('id', '=', id)
    .execute()
}

export async function whereRating(value: number): Promise<ReviewModel[]> {
  const query = DB.instance.selectFrom('reviews').where('rating', '=', value)
  const results: ReviewJsonResponse = await query.execute()

  return results.map((modelItem: ReviewJsonResponse) => new ReviewModel(modelItem))
}

export async function whereTitle(value: string): Promise<ReviewModel[]> {
  const query = DB.instance.selectFrom('reviews').where('title', '=', value)
  const results: ReviewJsonResponse = await query.execute()

  return results.map((modelItem: ReviewJsonResponse) => new ReviewModel(modelItem))
}

export async function whereContent(value: string): Promise<ReviewModel[]> {
  const query = DB.instance.selectFrom('reviews').where('content', '=', value)
  const results: ReviewJsonResponse = await query.execute()

  return results.map((modelItem: ReviewJsonResponse) => new ReviewModel(modelItem))
}

export async function whereIsVerifiedPurchase(value: boolean): Promise<ReviewModel[]> {
  const query = DB.instance.selectFrom('reviews').where('is_verified_purchase', '=', value)
  const results: ReviewJsonResponse = await query.execute()

  return results.map((modelItem: ReviewJsonResponse) => new ReviewModel(modelItem))
}

export async function whereIsApproved(value: boolean): Promise<ReviewModel[]> {
  const query = DB.instance.selectFrom('reviews').where('is_approved', '=', value)
  const results: ReviewJsonResponse = await query.execute()

  return results.map((modelItem: ReviewJsonResponse) => new ReviewModel(modelItem))
}

export async function whereIsFeatured(value: boolean): Promise<ReviewModel[]> {
  const query = DB.instance.selectFrom('reviews').where('is_featured', '=', value)
  const results: ReviewJsonResponse = await query.execute()

  return results.map((modelItem: ReviewJsonResponse) => new ReviewModel(modelItem))
}

export async function whereHelpfulVotes(value: number): Promise<ReviewModel[]> {
  const query = DB.instance.selectFrom('reviews').where('helpful_votes', '=', value)
  const results: ReviewJsonResponse = await query.execute()

  return results.map((modelItem: ReviewJsonResponse) => new ReviewModel(modelItem))
}

export async function whereUnhelpfulVotes(value: number): Promise<ReviewModel[]> {
  const query = DB.instance.selectFrom('reviews').where('unhelpful_votes', '=', value)
  const results: ReviewJsonResponse = await query.execute()

  return results.map((modelItem: ReviewJsonResponse) => new ReviewModel(modelItem))
}

export async function wherePurchaseDate(value: string): Promise<ReviewModel[]> {
  const query = DB.instance.selectFrom('reviews').where('purchase_date', '=', value)
  const results: ReviewJsonResponse = await query.execute()

  return results.map((modelItem: ReviewJsonResponse) => new ReviewModel(modelItem))
}

export async function whereImages(value: string): Promise<ReviewModel[]> {
  const query = DB.instance.selectFrom('reviews').where('images', '=', value)
  const results: ReviewJsonResponse = await query.execute()

  return results.map((modelItem: ReviewJsonResponse) => new ReviewModel(modelItem))
}

export const Review = ReviewModel

export default Review
