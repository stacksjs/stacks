import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { CustomerModel } from './Customer'
import type { OrderModel } from './Order'
import { randomUUIDv7 } from 'bun'
import { cache } from '@stacksjs/cache'
import { sql } from '@stacksjs/database'
import { HttpError, ModelNotFoundException } from '@stacksjs/error-handling'
import { dispatch } from '@stacksjs/events'

import { BaseOrm, DB, SubqueryBuilder } from '@stacksjs/orm'

import Customer from './Customer'

export interface GiftCardsTable {
  id: Generated<number>
  customer_id: number
  code: string
  initial_balance: number
  current_balance: number
  currency?: string
  status: string
  purchaser_id?: string
  recipient_email?: string
  recipient_name?: string
  personal_message?: string
  is_digital?: boolean
  is_reloadable?: boolean
  is_active?: boolean
  expiry_date?: Date | string
  last_used_date?: Date | string
  template_id?: string
  uuid?: string

  created_at?: Date

  updated_at?: Date

}

export interface GiftCardResponse {
  data: GiftCardJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface GiftCardJsonResponse extends Omit<Selectable<GiftCardsTable>, 'password'> {
  [key: string]: any
}

export type NewGiftCard = Insertable<GiftCardsTable>
export type GiftCardUpdate = Updateable<GiftCardsTable>

      type SortDirection = 'asc' | 'desc'
interface SortOptions { column: GiftCardJsonResponse, order: SortDirection }
// Define a type for the options parameter
interface QueryOptions {
  sort?: SortOptions
  limit?: number
  offset?: number
  page?: number
}

export class GiftCardModel extends BaseOrm<GiftCardModel, GiftCardsTable, GiftCardJsonResponse> {
  private readonly hidden: Array<keyof GiftCardJsonResponse> = []
  private readonly fillable: Array<keyof GiftCardJsonResponse> = ['code', 'initial_balance', 'current_balance', 'currency', 'status', 'purchaser_id', 'recipient_email', 'recipient_name', 'personal_message', 'is_digital', 'is_reloadable', 'is_active', 'expiry_date', 'last_used_date', 'template_id', 'uuid']
  private readonly guarded: Array<keyof GiftCardJsonResponse> = []
  protected attributes = {} as GiftCardJsonResponse
  protected originalAttributes = {} as GiftCardJsonResponse

  protected selectFromQuery: any
  protected updateFromQuery: any
  protected deleteFromQuery: any
  protected hasSelect: boolean
  private hasSaved: boolean
  private customColumns: Record<string, unknown> = {}

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
    this.hasSaved = false
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
          model[key] = fn()
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
        model[key] = fn()
      }
    }
  }

  async mapCustomSetters(model: NewGiftCard | GiftCardUpdate): Promise<void> {
    const customSetter = {
      default: () => {
      },

    }

    for (const [key, fn] of Object.entries(customSetter)) {
      model[key] = await fn()
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

  get created_at(): Date | undefined {
    return this.attributes.created_at
  }

  get updated_at(): Date | undefined {
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

  set updated_at(value: Date) {
    this.attributes.updated_at = value
  }

  getOriginal(column?: keyof GiftCardJsonResponse): Partial<GiftCardJsonResponse> {
    if (column) {
      return this.originalAttributes[column]
    }

    return this.originalAttributes
  }

  getChanges(): Partial<GiftCardJsonResponse> {
    return this.fillable.reduce<Partial<GiftCardJsonResponse>>((changes, key) => {
      const currentValue = this.attributes[key as keyof GiftCardsTable]
      const originalValue = this.originalAttributes[key as keyof GiftCardsTable]

      if (currentValue !== originalValue) {
        changes[key] = currentValue
      }

      return changes
    }, {})
  }

  isDirty(column?: keyof GiftCardJsonResponse): boolean {
    if (column) {
      return this.attributes[column] !== this.originalAttributes[column]
    }

    return Object.entries(this.originalAttributes).some(([key, originalValue]) => {
      const currentValue = (this.attributes as any)[key]

      return currentValue !== originalValue
    })
  }

  isClean(column?: keyof GiftCardJsonResponse): boolean {
    return !this.isDirty(column)
  }

  wasChanged(column?: keyof GiftCardJsonResponse): boolean {
    return this.hasSaved && this.isDirty(column)
  }

  static select(params: (keyof GiftCardJsonResponse)[] | RawBuilder<string> | string): GiftCardModel {
    const instance = new GiftCardModel(undefined)

    return instance.applySelect(params)
  }

  // Method to find a GiftCard by ID
  static async find(id: number): Promise<GiftCardModel | undefined> {
    const instance = new GiftCardModel(undefined)

    return await instance.applyFind(id)
  }

  async first(): Promise<GiftCardModel | undefined> {
    const model = await this.applyFirst()

    const data = new GiftCardModel(model)

    return data
  }

  static async first(): Promise<GiftCardModel | undefined> {
    const instance = new GiftCardModel(undefined)

    const model = await instance.applyFirst()

    const data = new GiftCardModel(model)

    return data
  }

  async applyFirstOrFail(): Promise<GiftCardModel | undefined> {
    const model = await this.selectFromQuery.executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, 'No GiftCardModel results found for query')

    if (model) {
      this.mapCustomGetters(model)
      await this.loadRelations(model)
    }

    const data = new GiftCardModel(model)

    return data
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

  async applyFindOrFail(id: number): Promise<GiftCardModel> {
    const model = await DB.instance.selectFrom('gift_cards').where('id', '=', id).selectAll().executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, `No GiftCardModel results for ${id}`)

    cache.getOrSet(`giftCard:${id}`, JSON.stringify(model))

    this.mapCustomGetters(model)
    await this.loadRelations(model)

    const data = new GiftCardModel(model)

    return data
  }

  async findOrFail(id: number): Promise<GiftCardModel> {
    return await this.applyFindOrFail(id)
  }

  static async findOrFail(id: number): Promise<GiftCardModel> {
    const instance = new GiftCardModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  static async findMany(ids: number[]): Promise<GiftCardModel[]> {
    const instance = new GiftCardModel(undefined)

    const models = await instance.applyFindMany(ids)

    return models.map((modelItem: UserJsonResponse) => instance.parseResult(new GiftCardModel(modelItem)))
  }

  async findMany(ids: number[]): Promise<GiftCardModel[]> {
    const models = await this.applyFindMany(ids)

    return models.map((modelItem: UserJsonResponse) => this.parseResult(new GiftCardModel(modelItem)))
  }

  static skip(count: number): GiftCardModel {
    const instance = new GiftCardModel(undefined)

    return instance.applySkip(count)
  }

  async applyChunk(size: number, callback: (models: GiftCardModel[]) => Promise<void>): Promise<void> {
    let page = 1
    let hasMore = true

    while (hasMore) {
      // Get one batch
      const models = await this.selectFromQuery
        .selectAll()
        .limit(size)
        .offset((page - 1) * size)
        .execute()

      // If we got fewer results than chunk size, this is the last batch
      if (models.length < size) {
        hasMore = false
      }

      // Process this batch
      if (models.length > 0) {
        await callback(models)
      }

      page++
    }
  }

  async chunk(size: number, callback: (models: GiftCardModel[]) => Promise<void>): Promise<void> {
    await this.applyChunk(size, callback)
  }

  static async chunk(size: number, callback: (models: GiftCardModel[]) => Promise<void>): Promise<void> {
    const instance = new GiftCardModel(undefined)

    await instance.applyChunk(size, callback)
  }

  static take(count: number): GiftCardModel {
    const instance = new GiftCardModel(undefined)

    return instance.applyTake(count)
  }

  static async pluck<K extends keyof GiftCardModel>(field: K): Promise<GiftCardModel[K][]> {
    const instance = new GiftCardModel(undefined)

    if (instance.hasSelect) {
      const model = await instance.selectFromQuery.execute()
      return model.map((modelItem: GiftCardModel) => modelItem[field])
    }

    const model = await instance.selectFromQuery.selectAll().execute()

    return model.map((modelItem: GiftCardModel) => modelItem[field])
  }

  async pluck<K extends keyof GiftCardModel>(field: K): Promise<GiftCardModel[K][]> {
    if (this.hasSelect) {
      const model = await this.selectFromQuery.execute()
      return model.map((modelItem: GiftCardModel) => modelItem[field])
    }

    const model = await this.selectFromQuery.selectAll().execute()

    return model.map((modelItem: GiftCardModel) => modelItem[field])
  }

  static async count(): Promise<number> {
    const instance = new GiftCardModel(undefined)

    return instance.applyCount()
  }

  static async max(field: keyof GiftCardModel): Promise<number> {
    const instance = new GiftCardModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`MAX(${sql.raw(field as string)}) as max `)
      .executeTakeFirst()

    return result.max
  }

  async max(field: keyof GiftCardModel): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`MAX(${sql.raw(field as string)}) as max`)
      .executeTakeFirst()

    return result.max
  }

  static async min(field: keyof GiftCardModel): Promise<number> {
    const instance = new GiftCardModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`MIN(${sql.raw(field as string)}) as min `)
      .executeTakeFirst()

    return result.min
  }

  async min(field: keyof GiftCardModel): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`MIN(${sql.raw(field as string)}) as min `)
      .executeTakeFirst()

    return result.min
  }

  static async avg(field: keyof GiftCardModel): Promise<number> {
    const instance = new GiftCardModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`AVG(${sql.raw(field as string)}) as avg `)
      .executeTakeFirst()

    return result.avg
  }

  async avg(field: keyof GiftCardModel): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`AVG(${sql.raw(field as string)}) as avg `)
      .executeTakeFirst()

    return result.avg
  }

  static async sum(field: keyof GiftCardModel): Promise<number> {
    const instance = new GiftCardModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`SUM(${sql.raw(field as string)}) as sum `)
      .executeTakeFirst()

    return result.sum
  }

  async sum(field: keyof GiftCardModel): Promise<number> {
    const result = this.selectFromQuery
      .select(sql`SUM(${sql.raw(field as string)}) as sum `)
      .executeTakeFirst()

    return result.sum
  }

  async applyGet(): Promise<GiftCardModel[]> {
    let models

    if (this.hasSelect) {
      models = await this.selectFromQuery.execute()
    }
    else {
      models = await this.selectFromQuery.selectAll().execute()
    }

    this.mapCustomGetters(models)
    await this.loadRelations(models)

    const data = await Promise.all(models.map(async (model: GiftCardJsonResponse) => {
      return new GiftCardModel(model)
    }))

    return data
  }

  async get(): Promise<GiftCardModel[]> {
    return await this.applyGet()
  }

  static async get(): Promise<GiftCardModel[]> {
    const instance = new GiftCardModel(undefined)

    return await instance.applyGet()
  }

  has(relation: string): GiftCardModel {
    this.selectFromQuery = this.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(
        selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.giftCard_id`, '=', 'gift_cards.id'),
      ),
    )

    return this
  }

  static has(relation: string): GiftCardModel {
    const instance = new GiftCardModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(
        selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.giftCard_id`, '=', 'gift_cards.id'),
      ),
    )

    return instance
  }

  static whereExists(callback: (qb: any) => any): GiftCardModel {
    const instance = new GiftCardModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(callback({ exists, selectFrom })),
    )

    return instance
  }

  applyWhereHas(
    relation: string,
    callback: (query: SubqueryBuilder<keyof GiftCardModel>) => void,
  ): GiftCardModel {
    const subqueryBuilder = new SubqueryBuilder()

    callback(subqueryBuilder)
    const conditions = subqueryBuilder.getConditions()

    this.selectFromQuery = this.selectFromQuery
      .where(({ exists, selectFrom }: any) => {
        let subquery = selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.giftCard_id`, '=', 'gift_cards.id')

        conditions.forEach((condition) => {
          switch (condition.method) {
            case 'where':
              if (condition.type === 'and') {
                subquery = subquery.where(condition.column, condition.operator!, condition.value)
              }
              else {
                subquery = subquery.orWhere(condition.column, condition.operator!, condition.value)
              }
              break

            case 'whereIn':
              if (condition.operator === 'is not') {
                subquery = subquery.whereNotIn(condition.column, condition.values)
              }
              else {
                subquery = subquery.whereIn(condition.column, condition.values)
              }

              break

            case 'whereNull':
              subquery = subquery.whereNull(condition.column)
              break

            case 'whereNotNull':
              subquery = subquery.whereNotNull(condition.column)
              break

            case 'whereBetween':
              subquery = subquery.whereBetween(condition.column, condition.values)
              break

            case 'whereExists': {
              const nestedBuilder = new SubqueryBuilder()
              condition.callback!(nestedBuilder)
              break
            }
          }
        })

        return exists(subquery)
      })

    return this
  }

  whereHas(
    relation: string,
    callback: (query: SubqueryBuilder<keyof GiftCardModel>) => void,
  ): GiftCardModel {
    return this.applyWhereHas(relation, callback)
  }

  static whereHas(
    relation: string,
    callback: (query: SubqueryBuilder<keyof GiftCardModel>) => void,
  ): GiftCardModel {
    const instance = new GiftCardModel(undefined)

    return instance.applyWhereHas(relation, callback)
  }

  applyDoesntHave(relation: string): GiftCardModel {
    this.selectFromQuery = this.selectFromQuery.where(({ not, exists, selectFrom }: any) =>
      not(
        exists(
          selectFrom(relation)
            .select('1')
            .whereRef(`${relation}.giftCard_id`, '=', 'gift_cards.id'),
        ),
      ),
    )

    return this
  }

  doesntHave(relation: string): GiftCardModel {
    return this.applyDoesntHave(relation)
  }

  static doesntHave(relation: string): GiftCardModel {
    const instance = new GiftCardModel(undefined)

    return instance.applyDoesntHave(relation)
  }

  applyWhereDoesntHave(relation: string, callback: (query: SubqueryBuilder<GiftCardsTable>) => void): GiftCardModel {
    const subqueryBuilder = new SubqueryBuilder()

    callback(subqueryBuilder)
    const conditions = subqueryBuilder.getConditions()

    this.selectFromQuery = this.selectFromQuery
      .where(({ exists, selectFrom, not }: any) => {
        const subquery = selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.giftCard_id`, '=', 'gift_cards.id')

        return not(exists(subquery))
      })

    conditions.forEach((condition) => {
      switch (condition.method) {
        case 'where':
          if (condition.type === 'and') {
            this.where(condition.column, condition.operator!, condition.value || [])
          }
          break

        case 'whereIn':
          if (condition.operator === 'is not') {
            this.whereNotIn(condition.column, condition.values || [])
          }
          else {
            this.whereIn(condition.column, condition.values || [])
          }

          break

        case 'whereNull':
          this.whereNull(condition.column)
          break

        case 'whereNotNull':
          this.whereNotNull(condition.column)
          break

        case 'whereBetween':
          this.whereBetween(condition.column, condition.range || [0, 0])
          break

        case 'whereExists': {
          const nestedBuilder = new SubqueryBuilder()
          condition.callback!(nestedBuilder)
          break
        }
      }
    })

    return this
  }

  whereDoesntHave(relation: string, callback: (query: SubqueryBuilder<GiftCardsTable>) => void): GiftCardModel {
    return this.applyWhereDoesntHave(relation, callback)
  }

  static whereDoesntHave(
    relation: string,
    callback: (query: SubqueryBuilder<GiftCardsTable>) => void,
  ): GiftCardModel {
    const instance = new GiftCardModel(undefined)

    return instance.applyWhereDoesntHave(relation, callback)
  }

  async applyPaginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<GiftCardResponse> {
    const totalRecordsResult = await DB.instance.selectFrom('gift_cards')
      .select(DB.instance.fn.count('id').as('total')) // Use 'id' or another actual column name
      .executeTakeFirst()

    const totalRecords = Number(totalRecordsResult?.total) || 0
    const totalPages = Math.ceil(totalRecords / (options.limit ?? 10))

    const gift_cardsWithExtra = await DB.instance.selectFrom('gift_cards')
      .selectAll()
      .orderBy('id', 'asc') // Assuming 'id' is used for cursor-based pagination
      .limit((options.limit ?? 10) + 1) // Fetch one extra record
      .offset(((options.page ?? 1) - 1) * (options.limit ?? 10)) // Ensure options.page is not undefined
      .execute()

    let nextCursor = null
    if (gift_cardsWithExtra.length > (options.limit ?? 10))
      nextCursor = gift_cardsWithExtra.pop()?.id ?? null

    return {
      data: gift_cardsWithExtra,
      paging: {
        total_records: totalRecords,
        page: options.page || 1,
        total_pages: totalPages,
      },
      next_cursor: nextCursor,
    }
  }

  async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<GiftCardResponse> {
    return await this.applyPaginate(options)
  }

  // Method to get all gift_cards
  static async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<GiftCardResponse> {
    const instance = new GiftCardModel(undefined)

    return await instance.applyPaginate(options)
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

    const model = await this.find(Number(result.numInsertedOrUpdatedRows)) as GiftCardModel

    if (model)
      dispatch('giftCard:created', model)

    return model
  }

  async create(newGiftCard: NewGiftCard): Promise<GiftCardModel> {
    return await this.applyCreate(newGiftCard)
  }

  static async create(newGiftCard: NewGiftCard): Promise<GiftCardModel> {
    const instance = new GiftCardModel(undefined)

    return await instance.applyCreate(newGiftCard)
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

    const model = await find(Number(result.numInsertedOrUpdatedRows)) as GiftCardModel

    if (model)
      dispatch('giftCard:created', model)

    return model
  }

  // Method to remove a GiftCard
  async delete(): Promise<GiftCardsTable> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()
    const model = await this.find(Number(this.id))
    if (model)
      dispatch('giftCard:deleted', model)

    return await DB.instance.deleteFrom('gift_cards')
      .where('id', '=', this.id)
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

  distinct(column: keyof GiftCardJsonResponse): GiftCardModel {
    return this.applyDistinct(column)
  }

  static distinct(column: keyof GiftCardJsonResponse): GiftCardModel {
    const instance = new GiftCardModel(undefined)

    return instance.applyDistinct(column)
  }

  join(table: string, firstCol: string, secondCol: string): GiftCardModel {
    return this.applyJoin(table, firstCol, secondCol)
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
}

async function find(id: number): Promise<GiftCardModel | undefined> {
  const query = DB.instance.selectFrom('gift_cards').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  return new GiftCardModel(model)
}

export async function count(): Promise<number> {
  const results = await GiftCardModel.count()

  return results
}

export async function create(newGiftCard: NewGiftCard): Promise<GiftCardModel> {
  const result = await DB.instance.insertInto('gift_cards')
    .values(newGiftCard)
    .executeTakeFirstOrThrow()

  return await find(Number(result.numInsertedOrUpdatedRows)) as GiftCardModel
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
