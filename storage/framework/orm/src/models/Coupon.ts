import type { RawBuilder } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import type { CouponJsonResponse, CouponsTable, CouponUpdate, NewCoupon } from '../types/CouponType'
import type { OrderModel } from './Order'
import type { ProductModel } from './Product'
import { randomUUIDv7 } from 'bun'
import { sql } from '@stacksjs/database'
import { HttpError } from '@stacksjs/error-handling'
import { dispatch } from '@stacksjs/events'
import { DB } from '@stacksjs/orm'

import { BaseOrm } from '../utils/base'

export class CouponModel extends BaseOrm<CouponModel, CouponsTable, CouponJsonResponse> {
  private readonly hidden: Array<keyof CouponJsonResponse> = []
  private readonly fillable: Array<keyof CouponJsonResponse> = ['code', 'description', 'discount_type', 'discount_value', 'min_order_amount', 'max_discount_amount', 'free_product_id', 'status', 'usage_limit', 'usage_count', 'start_date', 'end_date', 'uuid', 'product_id']
  private readonly guarded: Array<keyof CouponJsonResponse> = []
  protected attributes = {} as CouponJsonResponse
  protected originalAttributes = {} as CouponJsonResponse

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

  constructor(coupon: CouponJsonResponse | undefined) {
    super('coupons')
    if (coupon) {
      this.attributes = { ...coupon }
      this.originalAttributes = { ...coupon }

      Object.keys(coupon).forEach((key) => {
        if (!(key in this)) {
          this.customColumns[key] = (coupon as CouponJsonResponse)[key]
        }
      })
    }

    this.withRelations = []
    this.selectFromQuery = DB.instance.selectFrom('coupons')
    this.updateFromQuery = DB.instance.updateTable('coupons')
    this.deleteFromQuery = DB.instance.deleteFrom('coupons')
    this.hasSelect = false
  }

  protected async loadRelations(models: CouponJsonResponse | CouponJsonResponse[]): Promise<void> {
    // Handle both single model and array of models
    const modelArray = Array.isArray(models) ? models : [models]
    if (!modelArray.length)
      return

    const modelIds = modelArray.map(model => model.id)

    for (const relation of this.withRelations) {
      const relatedRecords = await DB.instance
        .selectFrom(relation)
        .where('coupon_id', 'in', modelIds)
        .selectAll()
        .execute()

      if (Array.isArray(models)) {
        models.map((model: CouponJsonResponse) => {
          const records = relatedRecords.filter((record: { coupon_id: number }) => {
            return record.coupon_id === model.id
          })

          model[relation] = records.length === 1 ? records[0] : records
          return model
        })
      }
      else {
        const records = relatedRecords.filter((record: { coupon_id: number }) => {
          return record.coupon_id === models.id
        })

        models[relation] = records.length === 1 ? records[0] : records
      }
    }
  }

  static with(relations: string[]): CouponModel {
    const instance = new CouponModel(undefined)

    return instance.applyWith(relations)
  }

  protected mapCustomGetters(models: CouponJsonResponse | CouponJsonResponse[]): void {
    const data = models

    if (Array.isArray(data)) {
      data.map((model: CouponJsonResponse) => {
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

  async mapCustomSetters(model: NewCoupon | CouponUpdate): Promise<void> {
    const customSetter = {
      default: () => {
      },

    }

    for (const [key, fn] of Object.entries(customSetter)) {
      (model as any)[key] = await fn()
    }
  }

  get orders(): OrderModel[] | [] {
    return this.attributes.orders
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

  get uuid(): string | undefined {
    return this.attributes.uuid
  }

  get code(): string {
    return this.attributes.code
  }

  get description(): string | undefined {
    return this.attributes.description
  }

  get discount_type(): string | string[] {
    return this.attributes.discount_type
  }

  get discount_value(): number {
    return this.attributes.discount_value
  }

  get min_order_amount(): number | undefined {
    return this.attributes.min_order_amount
  }

  get max_discount_amount(): number | undefined {
    return this.attributes.max_discount_amount
  }

  get free_product_id(): string | undefined {
    return this.attributes.free_product_id
  }

  get status(): string | string[] | undefined {
    return this.attributes.status
  }

  get usage_limit(): number | undefined {
    return this.attributes.usage_limit
  }

  get usage_count(): number | undefined {
    return this.attributes.usage_count
  }

  get start_date(): Date | string | undefined {
    return this.attributes.start_date
  }

  get end_date(): Date | string | undefined {
    return this.attributes.end_date
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

  set code(value: string) {
    this.attributes.code = value
  }

  set description(value: string) {
    this.attributes.description = value
  }

  set discount_type(value: string | string[]) {
    this.attributes.discount_type = value
  }

  set discount_value(value: number) {
    this.attributes.discount_value = value
  }

  set min_order_amount(value: number) {
    this.attributes.min_order_amount = value
  }

  set max_discount_amount(value: number) {
    this.attributes.max_discount_amount = value
  }

  set free_product_id(value: string) {
    this.attributes.free_product_id = value
  }

  set status(value: string | string[]) {
    this.attributes.status = value
  }

  set usage_limit(value: number) {
    this.attributes.usage_limit = value
  }

  set usage_count(value: number) {
    this.attributes.usage_count = value
  }

  set start_date(value: Date | string) {
    this.attributes.start_date = value
  }

  set end_date(value: Date | string) {
    this.attributes.end_date = value
  }

  set updated_at(value: string) {
    this.attributes.updated_at = value
  }

  static select(params: (keyof CouponJsonResponse)[] | RawBuilder<string> | string): CouponModel {
    const instance = new CouponModel(undefined)

    return instance.applySelect(params)
  }

  // Method to find a Coupon by ID
  static async find(id: number): Promise<CouponModel | undefined> {
    const query = DB.instance.selectFrom('coupons').where('id', '=', id).selectAll()

    const model = await query.executeTakeFirst()

    if (!model)
      return undefined

    const instance = new CouponModel(undefined)
    return instance.createInstance(model)
  }

  static async first(): Promise<CouponModel | undefined> {
    const instance = new CouponModel(undefined)

    const model = await instance.applyFirst()

    const data = new CouponModel(model)

    return data
  }

  static async last(): Promise<CouponModel | undefined> {
    const instance = new CouponModel(undefined)

    const model = await instance.applyLast()

    if (!model)
      return undefined

    return new CouponModel(model)
  }

  static async firstOrFail(): Promise<CouponModel | undefined> {
    const instance = new CouponModel(undefined)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<CouponModel[]> {
    const instance = new CouponModel(undefined)

    const models = await DB.instance.selectFrom('coupons').selectAll().execute()

    instance.mapCustomGetters(models)

    const data = await Promise.all(models.map(async (model: CouponJsonResponse) => {
      return new CouponModel(model)
    }))

    return data
  }

  static async findOrFail(id: number): Promise<CouponModel | undefined> {
    const instance = new CouponModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  static async findMany(ids: number[]): Promise<CouponModel[]> {
    const instance = new CouponModel(undefined)

    const models = await instance.applyFindMany(ids)

    return models.map((modelItem: CouponJsonResponse) => instance.parseResult(new CouponModel(modelItem)))
  }

  static async latest(column: keyof CouponsTable = 'created_at'): Promise<CouponModel | undefined> {
    const instance = new CouponModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'desc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new CouponModel(model)
  }

  static async oldest(column: keyof CouponsTable = 'created_at'): Promise<CouponModel | undefined> {
    const instance = new CouponModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'asc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new CouponModel(model)
  }

  static skip(count: number): CouponModel {
    const instance = new CouponModel(undefined)

    return instance.applySkip(count)
  }

  static take(count: number): CouponModel {
    const instance = new CouponModel(undefined)

    return instance.applyTake(count)
  }

  static where<V = string>(column: keyof CouponsTable, ...args: [V] | [Operator, V]): CouponModel {
    const instance = new CouponModel(undefined)

    return instance.applyWhere<V>(column, ...args)
  }

  static orWhere(...conditions: [string, any][]): CouponModel {
    const instance = new CouponModel(undefined)

    return instance.applyOrWhere(...conditions)
  }

  static whereNotIn<V = number>(column: keyof CouponsTable, values: V[]): CouponModel {
    const instance = new CouponModel(undefined)

    return instance.applyWhereNotIn<V>(column, values)
  }

  static whereBetween<V = number>(column: keyof CouponsTable, range: [V, V]): CouponModel {
    const instance = new CouponModel(undefined)

    return instance.applyWhereBetween<V>(column, range)
  }

  static whereRef(column: keyof CouponsTable, ...args: string[]): CouponModel {
    const instance = new CouponModel(undefined)

    return instance.applyWhereRef(column, ...args)
  }

  static when(condition: boolean, callback: (query: CouponModel) => CouponModel): CouponModel {
    const instance = new CouponModel(undefined)

    return instance.applyWhen(condition, callback as any)
  }

  static whereNull(column: keyof CouponsTable): CouponModel {
    const instance = new CouponModel(undefined)

    return instance.applyWhereNull(column)
  }

  static whereNotNull(column: keyof CouponsTable): CouponModel {
    const instance = new CouponModel(undefined)

    return instance.applyWhereNotNull(column)
  }

  static whereLike(column: keyof CouponsTable, value: string): CouponModel {
    const instance = new CouponModel(undefined)

    return instance.applyWhereLike(column, value)
  }

  static orderBy(column: keyof CouponsTable, order: 'asc' | 'desc'): CouponModel {
    const instance = new CouponModel(undefined)

    return instance.applyOrderBy(column, order)
  }

  static orderByAsc(column: keyof CouponsTable): CouponModel {
    const instance = new CouponModel(undefined)

    return instance.applyOrderByAsc(column)
  }

  static orderByDesc(column: keyof CouponsTable): CouponModel {
    const instance = new CouponModel(undefined)

    return instance.applyOrderByDesc(column)
  }

  static groupBy(column: keyof CouponsTable): CouponModel {
    const instance = new CouponModel(undefined)

    return instance.applyGroupBy(column)
  }

  static having<V = string>(column: keyof CouponsTable, operator: Operator, value: V): CouponModel {
    const instance = new CouponModel(undefined)

    return instance.applyHaving<V>(column, operator, value)
  }

  static inRandomOrder(): CouponModel {
    const instance = new CouponModel(undefined)

    return instance.applyInRandomOrder()
  }

  static whereColumn(first: keyof CouponsTable, operator: Operator, second: keyof CouponsTable): CouponModel {
    const instance = new CouponModel(undefined)

    return instance.applyWhereColumn(first, operator, second)
  }

  static async max(field: keyof CouponsTable): Promise<number> {
    const instance = new CouponModel(undefined)

    return await instance.applyMax(field)
  }

  static async min(field: keyof CouponsTable): Promise<number> {
    const instance = new CouponModel(undefined)

    return await instance.applyMin(field)
  }

  static async avg(field: keyof CouponsTable): Promise<number> {
    const instance = new CouponModel(undefined)

    return await instance.applyAvg(field)
  }

  static async sum(field: keyof CouponsTable): Promise<number> {
    const instance = new CouponModel(undefined)

    return await instance.applySum(field)
  }

  static async count(): Promise<number> {
    const instance = new CouponModel(undefined)

    return instance.applyCount()
  }

  static async get(): Promise<CouponModel[]> {
    const instance = new CouponModel(undefined)

    const results = await instance.applyGet()

    return results.map((item: CouponJsonResponse) => instance.createInstance(item))
  }

  static async pluck<K extends keyof CouponModel>(field: K): Promise<CouponModel[K][]> {
    const instance = new CouponModel(undefined)

    return await instance.applyPluck(field)
  }

  static async chunk(size: number, callback: (models: CouponModel[]) => Promise<void>): Promise<void> {
    const instance = new CouponModel(undefined)

    await instance.applyChunk(size, async (models) => {
      const modelInstances = models.map((item: CouponJsonResponse) => instance.createInstance(item))
      await callback(modelInstances)
    })
  }

  static async paginate(options: { limit?: number, offset?: number, page?: number } = { limit: 10, offset: 0, page: 1 }): Promise<{
    data: CouponModel[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }> {
    const instance = new CouponModel(undefined)

    const result = await instance.applyPaginate(options)

    return {
      data: result.data.map((item: CouponJsonResponse) => instance.createInstance(item)),
      paging: result.paging,
      next_cursor: result.next_cursor,
    }
  }

  // Instance method for creating model instances
  createInstance(data: CouponJsonResponse): CouponModel {
    return new CouponModel(data)
  }

  async applyCreate(newCoupon: NewCoupon): Promise<CouponModel> {
    const filteredValues = Object.fromEntries(
      Object.entries(newCoupon).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewCoupon

    await this.mapCustomSetters(filteredValues)

    filteredValues.uuid = randomUUIDv7()

    const result = await DB.instance.insertInto('coupons')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await DB.instance.selectFrom('coupons')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created Coupon')
    }

    if (model)
      dispatch('coupon:created', model)
    return this.createInstance(model)
  }

  async create(newCoupon: NewCoupon): Promise<CouponModel> {
    return await this.applyCreate(newCoupon)
  }

  static async create(newCoupon: NewCoupon): Promise<CouponModel> {
    const instance = new CouponModel(undefined)
    return await instance.applyCreate(newCoupon)
  }

  static async firstOrCreate(search: Partial<CouponsTable>, values: NewCoupon = {} as NewCoupon): Promise<CouponModel> {
    // First try to find a record matching the search criteria
    const instance = new CouponModel(undefined)

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
    const createData = { ...search, ...values } as NewCoupon
    return await CouponModel.create(createData)
  }

  static async updateOrCreate(search: Partial<CouponsTable>, values: NewCoupon = {} as NewCoupon): Promise<CouponModel> {
    // First try to find a record matching the search criteria
    const instance = new CouponModel(undefined)

    // Apply all search conditions
    for (const [key, value] of Object.entries(search)) {
      instance.selectFromQuery = instance.selectFromQuery.where(key, '=', value)
    }

    // Try to find the record
    const existingRecord = await instance.applyFirst()

    if (existingRecord) {
      // If record exists, update it with the new values
      const model = instance.createInstance(existingRecord)
      const updatedModel = await model.update(values as CouponUpdate)

      // Return the updated model instance
      if (updatedModel) {
        return updatedModel
      }

      // If update didn't return a model, fetch it again to ensure we have latest data
      const refreshedModel = await instance.applyFirst()
      return instance.createInstance(refreshedModel!)
    }

    // If no record exists, create a new one with combined search criteria and values
    const createData = { ...search, ...values } as NewCoupon
    return await CouponModel.create(createData)
  }

  async update(newCoupon: CouponUpdate): Promise<CouponModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newCoupon).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as CouponUpdate

    await this.mapCustomSetters(filteredValues)

    filteredValues.updated_at = new Date().toISOString()

    await DB.instance.updateTable('coupons')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('coupons')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated Coupon')
      }

      if (model)
        dispatch('coupon:updated', model)
      return this.createInstance(model)
    }

    return undefined
  }

  async forceUpdate(newCoupon: CouponUpdate): Promise<CouponModel | undefined> {
    await DB.instance.updateTable('coupons')
      .set(newCoupon)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('coupons')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated Coupon')
      }

      if (this)
        dispatch('coupon:updated', model)
      return this.createInstance(model)
    }

    return undefined
  }

  async save(): Promise<CouponModel> {
    // If the model has an ID, update it; otherwise, create a new record
    if (this.id) {
      // Update existing record
      await DB.instance.updateTable('coupons')
        .set(this.attributes as CouponUpdate)
        .where('id', '=', this.id)
        .executeTakeFirst()

      // Get the updated data
      const model = await DB.instance.selectFrom('coupons')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated Coupon')
      }

      if (this)
        dispatch('coupon:updated', model)
      return this.createInstance(model)
    }
    else {
      // Create new record
      const result = await DB.instance.insertInto('coupons')
        .values(this.attributes as NewCoupon)
        .executeTakeFirst()

      // Get the created data
      const model = await DB.instance.selectFrom('coupons')
        .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve created Coupon')
      }

      if (this)
        dispatch('coupon:created', model)
      return this.createInstance(model)
    }
  }

  static async createMany(newCoupon: NewCoupon[]): Promise<void> {
    const instance = new CouponModel(undefined)

    const valuesFiltered = newCoupon.map((newCoupon: NewCoupon) => {
      const filteredValues = Object.fromEntries(
        Object.entries(newCoupon).filter(([key]) =>
          !instance.guarded.includes(key) && instance.fillable.includes(key),
        ),
      ) as NewCoupon

      filteredValues.uuid = randomUUIDv7()

      return filteredValues
    })

    await DB.instance.insertInto('coupons')
      .values(valuesFiltered)
      .executeTakeFirst()
  }

  static async forceCreate(newCoupon: NewCoupon): Promise<CouponModel> {
    const result = await DB.instance.insertInto('coupons')
      .values(newCoupon)
      .executeTakeFirst()

    const instance = new CouponModel(undefined)
    const model = await DB.instance.selectFrom('coupons')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created Coupon')
    }

    if (model)
      dispatch('coupon:created', model)

    return instance.createInstance(model)
  }

  // Method to remove a Coupon
  async delete(): Promise<number> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()
    const model = await this.find(Number(this.id))

    if (model)
      dispatch('coupon:deleted', model)

    const deleted = await DB.instance.deleteFrom('coupons')
      .where('id', '=', this.id)
      .execute()

    return deleted.numDeletedRows
  }

  static async remove(id: number): Promise<any> {
    const instance = new CouponModel(undefined)

    const model = await instance.find(Number(id))

    if (model)
      dispatch('coupon:deleted', model)

    return await DB.instance.deleteFrom('coupons')
      .where('id', '=', id)
      .execute()
  }

  static whereCode(value: string): CouponModel {
    const instance = new CouponModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('code', '=', value)

    return instance
  }

  static whereDescription(value: string): CouponModel {
    const instance = new CouponModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('description', '=', value)

    return instance
  }

  static whereDiscountType(value: string): CouponModel {
    const instance = new CouponModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('discount_type', '=', value)

    return instance
  }

  static whereDiscountValue(value: string): CouponModel {
    const instance = new CouponModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('discount_value', '=', value)

    return instance
  }

  static whereMinOrderAmount(value: string): CouponModel {
    const instance = new CouponModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('min_order_amount', '=', value)

    return instance
  }

  static whereMaxDiscountAmount(value: string): CouponModel {
    const instance = new CouponModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('max_discount_amount', '=', value)

    return instance
  }

  static whereFreeProductId(value: string): CouponModel {
    const instance = new CouponModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('free_product_id', '=', value)

    return instance
  }

  static whereStatus(value: string): CouponModel {
    const instance = new CouponModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('status', '=', value)

    return instance
  }

  static whereUsageLimit(value: string): CouponModel {
    const instance = new CouponModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('usage_limit', '=', value)

    return instance
  }

  static whereUsageCount(value: string): CouponModel {
    const instance = new CouponModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('usage_count', '=', value)

    return instance
  }

  static whereStartDate(value: string): CouponModel {
    const instance = new CouponModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('start_date', '=', value)

    return instance
  }

  static whereEndDate(value: string): CouponModel {
    const instance = new CouponModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('end_date', '=', value)

    return instance
  }

  static whereIn<V = number>(column: keyof CouponsTable, values: V[]): CouponModel {
    const instance = new CouponModel(undefined)

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

  toSearchableObject(): Partial<CouponJsonResponse> {
    return {
      id: this.id,
      code: this.code,
      discount_type: this.discount_type,
      discount_value: this.discount_value,
      start_date: this.start_date,
      end_date: this.end_date,
    }
  }

  static distinct(column: keyof CouponJsonResponse): CouponModel {
    const instance = new CouponModel(undefined)

    return instance.applyDistinct(column)
  }

  static join(table: string, firstCol: string, secondCol: string): CouponModel {
    const instance = new CouponModel(undefined)

    return instance.applyJoin(table, firstCol, secondCol)
  }

  toJSON(): CouponJsonResponse {
    const output = {

      uuid: this.uuid,

      id: this.id,
      code: this.code,
      description: this.description,
      discount_type: this.discount_type,
      discount_value: this.discount_value,
      min_order_amount: this.min_order_amount,
      max_discount_amount: this.max_discount_amount,
      free_product_id: this.free_product_id,
      status: this.status,
      usage_limit: this.usage_limit,
      usage_count: this.usage_count,
      start_date: this.start_date,
      end_date: this.end_date,

      created_at: this.created_at,

      updated_at: this.updated_at,

      orders: this.orders,
      product_id: this.product_id,
      product: this.product,
      ...this.customColumns,
    }

    return output
  }

  parseResult(model: CouponModel): CouponModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof CouponModel]
    }

    return model
  }

  // Add a protected applyFind implementation
  protected async applyFind(id: number): Promise<CouponModel | undefined> {
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

export async function find(id: number): Promise<CouponModel | undefined> {
  const query = DB.instance.selectFrom('coupons').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  const instance = new CouponModel(undefined)
  return instance.createInstance(model)
}

export async function count(): Promise<number> {
  const results = await CouponModel.count()

  return results
}

export async function create(newCoupon: NewCoupon): Promise<CouponModel> {
  const instance = new CouponModel(undefined)
  return await instance.applyCreate(newCoupon)
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(DB.instance)
}

export async function remove(id: number): Promise<void> {
  await DB.instance.deleteFrom('coupons')
    .where('id', '=', id)
    .execute()
}

export async function whereCode(value: string): Promise<CouponModel[]> {
  const query = DB.instance.selectFrom('coupons').where('code', '=', value)
  const results: CouponJsonResponse = await query.execute()

  return results.map((modelItem: CouponJsonResponse) => new CouponModel(modelItem))
}

export async function whereDescription(value: string): Promise<CouponModel[]> {
  const query = DB.instance.selectFrom('coupons').where('description', '=', value)
  const results: CouponJsonResponse = await query.execute()

  return results.map((modelItem: CouponJsonResponse) => new CouponModel(modelItem))
}

export async function whereDiscountType(value: string | string[]): Promise<CouponModel[]> {
  const query = DB.instance.selectFrom('coupons').where('discount_type', '=', value)
  const results: CouponJsonResponse = await query.execute()

  return results.map((modelItem: CouponJsonResponse) => new CouponModel(modelItem))
}

export async function whereDiscountValue(value: number): Promise<CouponModel[]> {
  const query = DB.instance.selectFrom('coupons').where('discount_value', '=', value)
  const results: CouponJsonResponse = await query.execute()

  return results.map((modelItem: CouponJsonResponse) => new CouponModel(modelItem))
}

export async function whereMinOrderAmount(value: number): Promise<CouponModel[]> {
  const query = DB.instance.selectFrom('coupons').where('min_order_amount', '=', value)
  const results: CouponJsonResponse = await query.execute()

  return results.map((modelItem: CouponJsonResponse) => new CouponModel(modelItem))
}

export async function whereMaxDiscountAmount(value: number): Promise<CouponModel[]> {
  const query = DB.instance.selectFrom('coupons').where('max_discount_amount', '=', value)
  const results: CouponJsonResponse = await query.execute()

  return results.map((modelItem: CouponJsonResponse) => new CouponModel(modelItem))
}

export async function whereFreeProductId(value: string): Promise<CouponModel[]> {
  const query = DB.instance.selectFrom('coupons').where('free_product_id', '=', value)
  const results: CouponJsonResponse = await query.execute()

  return results.map((modelItem: CouponJsonResponse) => new CouponModel(modelItem))
}

export async function whereStatus(value: string | string[]): Promise<CouponModel[]> {
  const query = DB.instance.selectFrom('coupons').where('status', '=', value)
  const results: CouponJsonResponse = await query.execute()

  return results.map((modelItem: CouponJsonResponse) => new CouponModel(modelItem))
}

export async function whereUsageLimit(value: number): Promise<CouponModel[]> {
  const query = DB.instance.selectFrom('coupons').where('usage_limit', '=', value)
  const results: CouponJsonResponse = await query.execute()

  return results.map((modelItem: CouponJsonResponse) => new CouponModel(modelItem))
}

export async function whereUsageCount(value: number): Promise<CouponModel[]> {
  const query = DB.instance.selectFrom('coupons').where('usage_count', '=', value)
  const results: CouponJsonResponse = await query.execute()

  return results.map((modelItem: CouponJsonResponse) => new CouponModel(modelItem))
}

export async function whereStartDate(value: Date | string): Promise<CouponModel[]> {
  const query = DB.instance.selectFrom('coupons').where('start_date', '=', value)
  const results: CouponJsonResponse = await query.execute()

  return results.map((modelItem: CouponJsonResponse) => new CouponModel(modelItem))
}

export async function whereEndDate(value: Date | string): Promise<CouponModel[]> {
  const query = DB.instance.selectFrom('coupons').where('end_date', '=', value)
  const results: CouponJsonResponse = await query.execute()

  return results.map((modelItem: CouponJsonResponse) => new CouponModel(modelItem))
}

export const Coupon = CouponModel

export default Coupon
