import type { RawBuilder } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import type { GiftCardJsonResponse, GiftCardsTable, GiftCardUpdate, NewGiftCard } from '../types/GiftCardType'
import type { CustomerModel } from './Customer'
import type { OrderModel } from './Order'
import { randomUUIDv7 } from 'bun'
import { sql } from '@stacksjs/database'
import { HttpError } from '@stacksjs/error-handling'
import { dispatch } from '@stacksjs/events'
import { DB } from '@stacksjs/orm'

import { BaseOrm } from '../utils/base'

export class GiftCardModel extends BaseOrm<GiftCardModel, GiftCardsTable, GiftCardJsonResponse> {
  private readonly hidden: Array<keyof GiftCardJsonResponse> = []
  private readonly fillable: Array<keyof GiftCardJsonResponse> = ['code', 'initial_balance', 'current_balance', 'currency', 'status', 'purchaser_id', 'recipient_email', 'recipient_name', 'personal_message', 'is_digital', 'is_reloadable', 'is_active', 'expiry_date', 'last_used_date', 'template_id', 'uuid', 'customer_id']
  private readonly guarded: Array<keyof GiftCardJsonResponse> = []
  protected attributes = {} as GiftCardJsonResponse
  protected originalAttributes = {} as GiftCardJsonResponse

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

  constructor(giftCard: GiftCardJsonResponse | undefined) {
    super('gift_cards')
    if (giftCard) {
      this.attributes = { ...giftCard }
      this.originalAttributes = { ...giftCard }

      Object.keys(giftCard).forEach((key) => {
        if (!(key in this)) {
          this.customColumns[key] = (giftCard as GiftCardJsonResponse)[key]
        }
      })
    }

    this.withRelations = []
    this.selectFromQuery = DB.instance.selectFrom('gift_cards')
    this.updateFromQuery = DB.instance.updateTable('gift_cards')
    this.deleteFromQuery = DB.instance.deleteFrom('gift_cards')
    this.hasSelect = false
  }

  protected async loadRelations(models: GiftCardJsonResponse | GiftCardJsonResponse[]): Promise<void> {
    // Handle both single model and array of models
    const modelArray = Array.isArray(models) ? models : [models]
    if (!modelArray.length)
      return

    const modelIds = modelArray.map(model => model.id)

    for (const relation of this.withRelations) {
      const relatedRecords = await DB.instance
        .selectFrom(relation)
        .where('giftCard_id', 'in', modelIds)
        .selectAll()
        .execute()

      if (Array.isArray(models)) {
        models.map((model: GiftCardJsonResponse) => {
          const records = relatedRecords.filter((record: { giftCard_id: number }) => {
            return record.giftCard_id === model.id
          })

          model[relation] = records.length === 1 ? records[0] : records
          return model
        })
      }
      else {
        const records = relatedRecords.filter((record: { giftCard_id: number }) => {
          return record.giftCard_id === models.id
        })

        models[relation] = records.length === 1 ? records[0] : records
      }
    }
  }

  static with(relations: string[]): GiftCardModel {
    const instance = new GiftCardModel(undefined)

    return instance.applyWith(relations)
  }

  protected mapCustomGetters(models: GiftCardJsonResponse | GiftCardJsonResponse[]): void {
    const data = models

    if (Array.isArray(data)) {
      data.map((model: GiftCardJsonResponse) => {
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

  async mapCustomSetters(model: NewGiftCard | GiftCardUpdate): Promise<void> {
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

  get code(): string {
    return this.attributes.code
  }

  get initial_balance(): number {
    return this.attributes.initial_balance
  }

  get current_balance(): number {
    return this.attributes.current_balance
  }

  get currency(): string | undefined {
    return this.attributes.currency
  }

  get status(): string {
    return this.attributes.status
  }

  get purchaser_id(): string | undefined {
    return this.attributes.purchaser_id
  }

  get recipient_email(): string | undefined {
    return this.attributes.recipient_email
  }

  get recipient_name(): string | undefined {
    return this.attributes.recipient_name
  }

  get personal_message(): string | undefined {
    return this.attributes.personal_message
  }

  get is_digital(): boolean | undefined {
    return this.attributes.is_digital
  }

  get is_reloadable(): boolean | undefined {
    return this.attributes.is_reloadable
  }

  get is_active(): boolean | undefined {
    return this.attributes.is_active
  }

  get expiry_date(): Date | string | undefined {
    return this.attributes.expiry_date
  }

  get last_used_date(): Date | string | undefined {
    return this.attributes.last_used_date
  }

  get template_id(): string | undefined {
    return this.attributes.template_id
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

  set initial_balance(value: number) {
    this.attributes.initial_balance = value
  }

  set current_balance(value: number) {
    this.attributes.current_balance = value
  }

  set currency(value: string) {
    this.attributes.currency = value
  }

  set status(value: string) {
    this.attributes.status = value
  }

  set purchaser_id(value: string) {
    this.attributes.purchaser_id = value
  }

  set recipient_email(value: string) {
    this.attributes.recipient_email = value
  }

  set recipient_name(value: string) {
    this.attributes.recipient_name = value
  }

  set personal_message(value: string) {
    this.attributes.personal_message = value
  }

  set is_digital(value: boolean) {
    this.attributes.is_digital = value
  }

  set is_reloadable(value: boolean) {
    this.attributes.is_reloadable = value
  }

  set is_active(value: boolean) {
    this.attributes.is_active = value
  }

  set expiry_date(value: Date | string) {
    this.attributes.expiry_date = value
  }

  set last_used_date(value: Date | string) {
    this.attributes.last_used_date = value
  }

  set template_id(value: string) {
    this.attributes.template_id = value
  }

  set updated_at(value: string) {
    this.attributes.updated_at = value
  }

  static select(params: (keyof GiftCardJsonResponse)[] | RawBuilder<string> | string): GiftCardModel {
    const instance = new GiftCardModel(undefined)

    return instance.applySelect(params)
  }

  // Method to find a GiftCard by ID
  static async find(id: number): Promise<GiftCardModel | undefined> {
    const query = DB.instance.selectFrom('gift_cards').where('id', '=', id).selectAll()

    const model = await query.executeTakeFirst()

    if (!model)
      return undefined

    const instance = new GiftCardModel(undefined)
    return instance.createInstance(model)
  }

  static async first(): Promise<GiftCardModel | undefined> {
    const instance = new GiftCardModel(undefined)

    const model = await instance.applyFirst()

    const data = new GiftCardModel(model)

    return data
  }

  static async last(): Promise<GiftCardModel | undefined> {
    const instance = new GiftCardModel(undefined)

    const model = await instance.applyLast()

    if (!model)
      return undefined

    return new GiftCardModel(model)
  }

  static async firstOrFail(): Promise<GiftCardModel | undefined> {
    const instance = new GiftCardModel(undefined)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<GiftCardModel[]> {
    const instance = new GiftCardModel(undefined)

    const models = await DB.instance.selectFrom('gift_cards').selectAll().execute()

    instance.mapCustomGetters(models)

    const data = await Promise.all(models.map(async (model: GiftCardJsonResponse) => {
      return new GiftCardModel(model)
    }))

    return data
  }

  static async findOrFail(id: number): Promise<GiftCardModel | undefined> {
    const instance = new GiftCardModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  static async findMany(ids: number[]): Promise<GiftCardModel[]> {
    const instance = new GiftCardModel(undefined)

    const models = await instance.applyFindMany(ids)

    return models.map((modelItem: GiftCardJsonResponse) => instance.parseResult(new GiftCardModel(modelItem)))
  }

  static async latest(column: keyof GiftCardsTable = 'created_at'): Promise<GiftCardModel | undefined> {
    const instance = new GiftCardModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'desc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new GiftCardModel(model)
  }

  static async oldest(column: keyof GiftCardsTable = 'created_at'): Promise<GiftCardModel | undefined> {
    const instance = new GiftCardModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'asc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new GiftCardModel(model)
  }

  static skip(count: number): GiftCardModel {
    const instance = new GiftCardModel(undefined)

    return instance.applySkip(count)
  }

  static take(count: number): GiftCardModel {
    const instance = new GiftCardModel(undefined)

    return instance.applyTake(count)
  }

  static where<V = string>(column: keyof GiftCardsTable, ...args: [V] | [Operator, V]): GiftCardModel {
    const instance = new GiftCardModel(undefined)

    return instance.applyWhere<V>(column, ...args)
  }

  static orWhere(...conditions: [string, any][]): GiftCardModel {
    const instance = new GiftCardModel(undefined)

    return instance.applyOrWhere(...conditions)
  }

  static whereNotIn<V = number>(column: keyof GiftCardsTable, values: V[]): GiftCardModel {
    const instance = new GiftCardModel(undefined)

    return instance.applyWhereNotIn<V>(column, values)
  }

  static whereBetween<V = number>(column: keyof GiftCardsTable, range: [V, V]): GiftCardModel {
    const instance = new GiftCardModel(undefined)

    return instance.applyWhereBetween<V>(column, range)
  }

  static whereRef(column: keyof GiftCardsTable, ...args: string[]): GiftCardModel {
    const instance = new GiftCardModel(undefined)

    return instance.applyWhereRef(column, ...args)
  }

  static when(condition: boolean, callback: (query: GiftCardModel) => GiftCardModel): GiftCardModel {
    const instance = new GiftCardModel(undefined)

    return instance.applyWhen(condition, callback as any)
  }

  static whereNull(column: keyof GiftCardsTable): GiftCardModel {
    const instance = new GiftCardModel(undefined)

    return instance.applyWhereNull(column)
  }

  static whereNotNull(column: keyof GiftCardsTable): GiftCardModel {
    const instance = new GiftCardModel(undefined)

    return instance.applyWhereNotNull(column)
  }

  static whereLike(column: keyof GiftCardsTable, value: string): GiftCardModel {
    const instance = new GiftCardModel(undefined)

    return instance.applyWhereLike(column, value)
  }

  static orderBy(column: keyof GiftCardsTable, order: 'asc' | 'desc'): GiftCardModel {
    const instance = new GiftCardModel(undefined)

    return instance.applyOrderBy(column, order)
  }

  static orderByAsc(column: keyof GiftCardsTable): GiftCardModel {
    const instance = new GiftCardModel(undefined)

    return instance.applyOrderByAsc(column)
  }

  static orderByDesc(column: keyof GiftCardsTable): GiftCardModel {
    const instance = new GiftCardModel(undefined)

    return instance.applyOrderByDesc(column)
  }

  static groupBy(column: keyof GiftCardsTable): GiftCardModel {
    const instance = new GiftCardModel(undefined)

    return instance.applyGroupBy(column)
  }

  static having<V = string>(column: keyof GiftCardsTable, operator: Operator, value: V): GiftCardModel {
    const instance = new GiftCardModel(undefined)

    return instance.applyHaving<V>(column, operator, value)
  }

  static inRandomOrder(): GiftCardModel {
    const instance = new GiftCardModel(undefined)

    return instance.applyInRandomOrder()
  }

  static whereColumn(first: keyof GiftCardsTable, operator: Operator, second: keyof GiftCardsTable): GiftCardModel {
    const instance = new GiftCardModel(undefined)

    return instance.applyWhereColumn(first, operator, second)
  }

  static async max(field: keyof GiftCardsTable): Promise<number> {
    const instance = new GiftCardModel(undefined)

    return await instance.applyMax(field)
  }

  static async min(field: keyof GiftCardsTable): Promise<number> {
    const instance = new GiftCardModel(undefined)

    return await instance.applyMin(field)
  }

  static async avg(field: keyof GiftCardsTable): Promise<number> {
    const instance = new GiftCardModel(undefined)

    return await instance.applyAvg(field)
  }

  static async sum(field: keyof GiftCardsTable): Promise<number> {
    const instance = new GiftCardModel(undefined)

    return await instance.applySum(field)
  }

  static async count(): Promise<number> {
    const instance = new GiftCardModel(undefined)

    return instance.applyCount()
  }

  static async get(): Promise<GiftCardModel[]> {
    const instance = new GiftCardModel(undefined)

    const results = await instance.applyGet()

    return results.map((item: GiftCardJsonResponse) => instance.createInstance(item))
  }

  static async pluck<K extends keyof GiftCardModel>(field: K): Promise<GiftCardModel[K][]> {
    const instance = new GiftCardModel(undefined)

    return await instance.applyPluck(field)
  }

  static async chunk(size: number, callback: (models: GiftCardModel[]) => Promise<void>): Promise<void> {
    const instance = new GiftCardModel(undefined)

    await instance.applyChunk(size, async (models) => {
      const modelInstances = models.map((item: GiftCardJsonResponse) => instance.createInstance(item))
      await callback(modelInstances)
    })
  }

  static async paginate(options: { limit?: number, offset?: number, page?: number } = { limit: 10, offset: 0, page: 1 }): Promise<{
    data: GiftCardModel[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }> {
    const instance = new GiftCardModel(undefined)

    const result = await instance.applyPaginate(options)

    return {
      data: result.data.map((item: GiftCardJsonResponse) => instance.createInstance(item)),
      paging: result.paging,
      next_cursor: result.next_cursor,
    }
  }

  // Instance method for creating model instances
  createInstance(data: GiftCardJsonResponse): GiftCardModel {
    return new GiftCardModel(data)
  }

  async applyCreate(newGiftCard: NewGiftCard): Promise<GiftCardModel> {
    const filteredValues = Object.fromEntries(
      Object.entries(newGiftCard).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewGiftCard

    await this.mapCustomSetters(filteredValues)

    filteredValues.uuid = randomUUIDv7()

    const result = await DB.instance.insertInto('gift_cards')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await DB.instance.selectFrom('gift_cards')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created GiftCard')
    }

    if (model)
      dispatch('giftCard:created', model)
    return this.createInstance(model)
  }

  async create(newGiftCard: NewGiftCard): Promise<GiftCardModel> {
    return await this.applyCreate(newGiftCard)
  }

  static async create(newGiftCard: NewGiftCard): Promise<GiftCardModel> {
    const instance = new GiftCardModel(undefined)
    return await instance.applyCreate(newGiftCard)
  }

  static async firstOrCreate(search: Partial<GiftCardsTable>, values: NewGiftCard = {} as NewGiftCard): Promise<GiftCardModel> {
    // First try to find a record matching the search criteria
    const instance = new GiftCardModel(undefined)

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
    const createData = { ...search, ...values } as NewGiftCard
    return await GiftCardModel.create(createData)
  }

  static async updateOrCreate(search: Partial<GiftCardsTable>, values: NewGiftCard = {} as NewGiftCard): Promise<GiftCardModel> {
    // First try to find a record matching the search criteria
    const instance = new GiftCardModel(undefined)

    // Apply all search conditions
    for (const [key, value] of Object.entries(search)) {
      instance.selectFromQuery = instance.selectFromQuery.where(key, '=', value)
    }

    // Try to find the record
    const existingRecord = await instance.applyFirst()

    if (existingRecord) {
      // If record exists, update it with the new values
      const model = instance.createInstance(existingRecord)
      const updatedModel = await model.update(values as GiftCardUpdate)

      // Return the updated model instance
      if (updatedModel) {
        return updatedModel
      }

      // If update didn't return a model, fetch it again to ensure we have latest data
      const refreshedModel = await instance.applyFirst()
      return instance.createInstance(refreshedModel!)
    }

    // If no record exists, create a new one with combined search criteria and values
    const createData = { ...search, ...values } as NewGiftCard
    return await GiftCardModel.create(createData)
  }

  async update(newGiftCard: GiftCardUpdate): Promise<GiftCardModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newGiftCard).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as GiftCardUpdate

    await this.mapCustomSetters(filteredValues)

    filteredValues.updated_at = new Date().toISOString()

    await DB.instance.updateTable('gift_cards')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('gift_cards')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated GiftCard')
      }

      if (model)
        dispatch('giftCard:updated', model)
      return this.createInstance(model)
    }

    return undefined
  }

  async forceUpdate(newGiftCard: GiftCardUpdate): Promise<GiftCardModel | undefined> {
    await DB.instance.updateTable('gift_cards')
      .set(newGiftCard)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('gift_cards')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated GiftCard')
      }

      if (this)
        dispatch('giftCard:updated', model)
      return this.createInstance(model)
    }

    return undefined
  }

  async save(): Promise<GiftCardModel> {
    // If the model has an ID, update it; otherwise, create a new record
    if (this.id) {
      // Update existing record
      await DB.instance.updateTable('gift_cards')
        .set(this.attributes as GiftCardUpdate)
        .where('id', '=', this.id)
        .executeTakeFirst()

      // Get the updated data
      const model = await DB.instance.selectFrom('gift_cards')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated GiftCard')
      }

      if (this)
        dispatch('giftCard:updated', model)
      return this.createInstance(model)
    }
    else {
      // Create new record
      const result = await DB.instance.insertInto('gift_cards')
        .values(this.attributes as NewGiftCard)
        .executeTakeFirst()

      // Get the created data
      const model = await DB.instance.selectFrom('gift_cards')
        .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve created GiftCard')
      }

      if (this)
        dispatch('giftCard:created', model)
      return this.createInstance(model)
    }
  }

  static async createMany(newGiftCard: NewGiftCard[]): Promise<void> {
    const instance = new GiftCardModel(undefined)

    const valuesFiltered = newGiftCard.map((newGiftCard: NewGiftCard) => {
      const filteredValues = Object.fromEntries(
        Object.entries(newGiftCard).filter(([key]) =>
          !instance.guarded.includes(key) && instance.fillable.includes(key),
        ),
      ) as NewGiftCard

      filteredValues.uuid = randomUUIDv7()

      return filteredValues
    })

    await DB.instance.insertInto('gift_cards')
      .values(valuesFiltered)
      .executeTakeFirst()
  }

  static async forceCreate(newGiftCard: NewGiftCard): Promise<GiftCardModel> {
    const result = await DB.instance.insertInto('gift_cards')
      .values(newGiftCard)
      .executeTakeFirst()

    const instance = new GiftCardModel(undefined)
    const model = await DB.instance.selectFrom('gift_cards')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created GiftCard')
    }

    if (model)
      dispatch('giftCard:created', model)

    return instance.createInstance(model)
  }

  // Method to remove a GiftCard
  async delete(): Promise<number> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()
    const model = await this.find(Number(this.id))

    if (model)
      dispatch('giftCard:deleted', model)

    const deleted = await DB.instance.deleteFrom('gift_cards')
      .where('id', '=', this.id)
      .execute()

    return deleted.numDeletedRows
  }

  static async remove(id: number): Promise<any> {
    const instance = new GiftCardModel(undefined)

    const model = await instance.find(Number(id))

    if (model)
      dispatch('giftCard:deleted', model)

    return await DB.instance.deleteFrom('gift_cards')
      .where('id', '=', id)
      .execute()
  }

  static whereCode(value: string): GiftCardModel {
    const instance = new GiftCardModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('code', '=', value)

    return instance
  }

  static whereInitialBalance(value: string): GiftCardModel {
    const instance = new GiftCardModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('initial_balance', '=', value)

    return instance
  }

  static whereCurrentBalance(value: string): GiftCardModel {
    const instance = new GiftCardModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('current_balance', '=', value)

    return instance
  }

  static whereCurrency(value: string): GiftCardModel {
    const instance = new GiftCardModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('currency', '=', value)

    return instance
  }

  static whereStatus(value: string): GiftCardModel {
    const instance = new GiftCardModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('status', '=', value)

    return instance
  }

  static wherePurchaserId(value: string): GiftCardModel {
    const instance = new GiftCardModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('purchaser_id', '=', value)

    return instance
  }

  static whereRecipientEmail(value: string): GiftCardModel {
    const instance = new GiftCardModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('recipient_email', '=', value)

    return instance
  }

  static whereRecipientName(value: string): GiftCardModel {
    const instance = new GiftCardModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('recipient_name', '=', value)

    return instance
  }

  static wherePersonalMessage(value: string): GiftCardModel {
    const instance = new GiftCardModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('personal_message', '=', value)

    return instance
  }

  static whereIsDigital(value: string): GiftCardModel {
    const instance = new GiftCardModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('is_digital', '=', value)

    return instance
  }

  static whereIsReloadable(value: string): GiftCardModel {
    const instance = new GiftCardModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('is_reloadable', '=', value)

    return instance
  }

  static whereIsActive(value: string): GiftCardModel {
    const instance = new GiftCardModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('is_active', '=', value)

    return instance
  }

  static whereExpiryDate(value: string): GiftCardModel {
    const instance = new GiftCardModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('expiry_date', '=', value)

    return instance
  }

  static whereLastUsedDate(value: string): GiftCardModel {
    const instance = new GiftCardModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('last_used_date', '=', value)

    return instance
  }

  static whereTemplateId(value: string): GiftCardModel {
    const instance = new GiftCardModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('template_id', '=', value)

    return instance
  }

  static whereIn<V = number>(column: keyof GiftCardsTable, values: V[]): GiftCardModel {
    const instance = new GiftCardModel(undefined)

    return instance.applyWhereIn<V>(column, values)
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

  toSearchableObject(): Partial<GiftCardJsonResponse> {
    return {
      id: this.id,
      code: this.code,
      initial_balance: this.initial_balance,
      current_balance: this.current_balance,
      status: this.status,
      expiry_date: this.expiry_date,
      is_active: this.is_active,
    }
  }

  static distinct(column: keyof GiftCardJsonResponse): GiftCardModel {
    const instance = new GiftCardModel(undefined)

    return instance.applyDistinct(column)
  }

  static join(table: string, firstCol: string, secondCol: string): GiftCardModel {
    const instance = new GiftCardModel(undefined)

    return instance.applyJoin(table, firstCol, secondCol)
  }

  toJSON(): GiftCardJsonResponse {
    const output = {

      uuid: this.uuid,

      id: this.id,
      code: this.code,
      initial_balance: this.initial_balance,
      current_balance: this.current_balance,
      currency: this.currency,
      status: this.status,
      purchaser_id: this.purchaser_id,
      recipient_email: this.recipient_email,
      recipient_name: this.recipient_name,
      personal_message: this.personal_message,
      is_digital: this.is_digital,
      is_reloadable: this.is_reloadable,
      is_active: this.is_active,
      expiry_date: this.expiry_date,
      last_used_date: this.last_used_date,
      template_id: this.template_id,

      created_at: this.created_at,

      updated_at: this.updated_at,

      orders: this.orders,
      customer_id: this.customer_id,
      customer: this.customer,
      ...this.customColumns,
    }

    return output
  }

  parseResult(model: GiftCardModel): GiftCardModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof GiftCardModel]
    }

    return model
  }

  // Add a protected applyFind implementation
  protected async applyFind(id: number): Promise<GiftCardModel | undefined> {
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

export async function find(id: number): Promise<GiftCardModel | undefined> {
  const query = DB.instance.selectFrom('gift_cards').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  const instance = new GiftCardModel(undefined)
  return instance.createInstance(model)
}

export async function count(): Promise<number> {
  const results = await GiftCardModel.count()

  return results
}

export async function create(newGiftCard: NewGiftCard): Promise<GiftCardModel> {
  const instance = new GiftCardModel(undefined)
  return await instance.applyCreate(newGiftCard)
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(DB.instance)
}

export async function remove(id: number): Promise<void> {
  await DB.instance.deleteFrom('gift_cards')
    .where('id', '=', id)
    .execute()
}

export async function whereCode(value: string): Promise<GiftCardModel[]> {
  const query = DB.instance.selectFrom('gift_cards').where('code', '=', value)
  const results: GiftCardJsonResponse = await query.execute()

  return results.map((modelItem: GiftCardJsonResponse) => new GiftCardModel(modelItem))
}

export async function whereInitialBalance(value: number): Promise<GiftCardModel[]> {
  const query = DB.instance.selectFrom('gift_cards').where('initial_balance', '=', value)
  const results: GiftCardJsonResponse = await query.execute()

  return results.map((modelItem: GiftCardJsonResponse) => new GiftCardModel(modelItem))
}

export async function whereCurrentBalance(value: number): Promise<GiftCardModel[]> {
  const query = DB.instance.selectFrom('gift_cards').where('current_balance', '=', value)
  const results: GiftCardJsonResponse = await query.execute()

  return results.map((modelItem: GiftCardJsonResponse) => new GiftCardModel(modelItem))
}

export async function whereCurrency(value: string): Promise<GiftCardModel[]> {
  const query = DB.instance.selectFrom('gift_cards').where('currency', '=', value)
  const results: GiftCardJsonResponse = await query.execute()

  return results.map((modelItem: GiftCardJsonResponse) => new GiftCardModel(modelItem))
}

export async function whereStatus(value: string): Promise<GiftCardModel[]> {
  const query = DB.instance.selectFrom('gift_cards').where('status', '=', value)
  const results: GiftCardJsonResponse = await query.execute()

  return results.map((modelItem: GiftCardJsonResponse) => new GiftCardModel(modelItem))
}

export async function wherePurchaserId(value: string): Promise<GiftCardModel[]> {
  const query = DB.instance.selectFrom('gift_cards').where('purchaser_id', '=', value)
  const results: GiftCardJsonResponse = await query.execute()

  return results.map((modelItem: GiftCardJsonResponse) => new GiftCardModel(modelItem))
}

export async function whereRecipientEmail(value: string): Promise<GiftCardModel[]> {
  const query = DB.instance.selectFrom('gift_cards').where('recipient_email', '=', value)
  const results: GiftCardJsonResponse = await query.execute()

  return results.map((modelItem: GiftCardJsonResponse) => new GiftCardModel(modelItem))
}

export async function whereRecipientName(value: string): Promise<GiftCardModel[]> {
  const query = DB.instance.selectFrom('gift_cards').where('recipient_name', '=', value)
  const results: GiftCardJsonResponse = await query.execute()

  return results.map((modelItem: GiftCardJsonResponse) => new GiftCardModel(modelItem))
}

export async function wherePersonalMessage(value: string): Promise<GiftCardModel[]> {
  const query = DB.instance.selectFrom('gift_cards').where('personal_message', '=', value)
  const results: GiftCardJsonResponse = await query.execute()

  return results.map((modelItem: GiftCardJsonResponse) => new GiftCardModel(modelItem))
}

export async function whereIsDigital(value: boolean): Promise<GiftCardModel[]> {
  const query = DB.instance.selectFrom('gift_cards').where('is_digital', '=', value)
  const results: GiftCardJsonResponse = await query.execute()

  return results.map((modelItem: GiftCardJsonResponse) => new GiftCardModel(modelItem))
}

export async function whereIsReloadable(value: boolean): Promise<GiftCardModel[]> {
  const query = DB.instance.selectFrom('gift_cards').where('is_reloadable', '=', value)
  const results: GiftCardJsonResponse = await query.execute()

  return results.map((modelItem: GiftCardJsonResponse) => new GiftCardModel(modelItem))
}

export async function whereIsActive(value: boolean): Promise<GiftCardModel[]> {
  const query = DB.instance.selectFrom('gift_cards').where('is_active', '=', value)
  const results: GiftCardJsonResponse = await query.execute()

  return results.map((modelItem: GiftCardJsonResponse) => new GiftCardModel(modelItem))
}

export async function whereExpiryDate(value: Date | string): Promise<GiftCardModel[]> {
  const query = DB.instance.selectFrom('gift_cards').where('expiry_date', '=', value)
  const results: GiftCardJsonResponse = await query.execute()

  return results.map((modelItem: GiftCardJsonResponse) => new GiftCardModel(modelItem))
}

export async function whereLastUsedDate(value: Date | string): Promise<GiftCardModel[]> {
  const query = DB.instance.selectFrom('gift_cards').where('last_used_date', '=', value)
  const results: GiftCardJsonResponse = await query.execute()

  return results.map((modelItem: GiftCardJsonResponse) => new GiftCardModel(modelItem))
}

export async function whereTemplateId(value: string): Promise<GiftCardModel[]> {
  const query = DB.instance.selectFrom('gift_cards').where('template_id', '=', value)
  const results: GiftCardJsonResponse = await query.execute()

  return results.map((modelItem: GiftCardJsonResponse) => new GiftCardModel(modelItem))
}

export const GiftCard = GiftCardModel

export default GiftCard
