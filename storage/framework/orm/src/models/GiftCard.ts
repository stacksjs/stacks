import type { Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import type { OrderModel } from './Order'
import type { UserModel } from './User'
import { randomUUIDv7 } from 'bun'
import { cache } from '@stacksjs/cache'
import { sql } from '@stacksjs/database'
import { HttpError, ModelNotFoundException } from '@stacksjs/error-handling'
import { dispatch } from '@stacksjs/events'

import { DB, SubqueryBuilder } from '@stacksjs/orm'

import User from './User'

export interface GiftCardsTable {
  id: number
  orders: OrderModel[] | []
  user_id: number
  user?: UserModel
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
  expiry_date?: string
  last_used_date?: string
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

export interface GiftCardJsonResponse extends Omit<GiftCardsTable, 'password'> {
  [key: string]: any
}

export type GiftCardType = Selectable<GiftCardsTable>
export type NewGiftCard = Partial<Insertable<GiftCardsTable>>
export type GiftCardUpdate = Updateable<GiftCardsTable>

      type SortDirection = 'asc' | 'desc'
interface SortOptions { column: GiftCardType, order: SortDirection }
// Define a type for the options parameter
interface QueryOptions {
  sort?: SortOptions
  limit?: number
  offset?: number
  page?: number
}

export class GiftCardModel {
  private readonly hidden: Array<keyof GiftCardJsonResponse> = []
  private readonly fillable: Array<keyof GiftCardJsonResponse> = ['code', 'initial_balance', 'current_balance', 'currency', 'status', 'purchaser_id', 'recipient_email', 'recipient_name', 'personal_message', 'is_digital', 'is_reloadable', 'is_active', 'expiry_date', 'last_used_date', 'template_id', 'uuid']
  private readonly guarded: Array<keyof GiftCardJsonResponse> = []
  protected attributes: Partial<GiftCardJsonResponse> = {}
  protected originalAttributes: Partial<GiftCardJsonResponse> = {}

  protected selectFromQuery: any
  protected withRelations: string[]
  protected updateFromQuery: any
  protected deleteFromQuery: any
  protected hasSelect: boolean
  private hasSaved: boolean
  private customColumns: Record<string, unknown> = {}

  constructor(giftcard: GiftCardJsonResponse | undefined) {
    if (giftcard) {
      this.attributes = { ...giftcard }
      this.originalAttributes = { ...giftcard }

      Object.keys(giftcard).forEach((key) => {
        if (!(key in this)) {
          this.customColumns[key] = (giftcard as GiftCardJsonResponse)[key]
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

  mapCustomGetters(models: GiftCardJsonResponse | GiftCardJsonResponse[]): void {
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

  async mapCustomSetters(model: NewGiftCard): Promise<void> {
    const customSetter = {
      default: () => {
      },

    }

    for (const [key, fn] of Object.entries(customSetter)) {
      model[key] = await fn()
    }
  }

  get orders(): OrderModel[] | undefined {
    return this.attributes.orders
  }

  get user_id(): number | undefined {
    return this.attributes.user_id
  }

  get user(): UserModel | undefined {
    return this.attributes.user
  }

  get id(): number | undefined {
    return this.attributes.id
  }

  get uuid(): string | undefined {
    return this.attributes.uuid
  }

  get code(): string | undefined {
    return this.attributes.code
  }

  get initial_balance(): number | undefined {
    return this.attributes.initial_balance
  }

  get current_balance(): number | undefined {
    return this.attributes.current_balance
  }

  get currency(): string | undefined {
    return this.attributes.currency
  }

  get status(): string | undefined {
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

  get expiry_date(): string | undefined {
    return this.attributes.expiry_date
  }

  get last_used_date(): string | undefined {
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

  set expiry_date(value: string) {
    this.attributes.expiry_date = value
  }

  set last_used_date(value: string) {
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

  isDirty(column?: keyof GiftCardType): boolean {
    if (column) {
      return this.attributes[column] !== this.originalAttributes[column]
    }

    return Object.entries(this.originalAttributes).some(([key, originalValue]) => {
      const currentValue = (this.attributes as any)[key]

      return currentValue !== originalValue
    })
  }

  isClean(column?: keyof GiftCardType): boolean {
    return !this.isDirty(column)
  }

  wasChanged(column?: keyof GiftCardType): boolean {
    return this.hasSaved && this.isDirty(column)
  }

  select(params: (keyof GiftCardType)[] | RawBuilder<string> | string): GiftCardModel {
    this.selectFromQuery = this.selectFromQuery.select(params)

    this.hasSelect = true

    return this
  }

  static select(params: (keyof GiftCardType)[] | RawBuilder<string> | string): GiftCardModel {
    const instance = new GiftCardModel(undefined)

    // Initialize a query with the table name and selected fields
    instance.selectFromQuery = instance.selectFromQuery.select(params)

    instance.hasSelect = true

    return instance
  }

  async applyFind(id: number): Promise<GiftCardModel | undefined> {
    const model = await DB.instance.selectFrom('gift_cards').where('id', '=', id).selectAll().executeTakeFirst()

    if (!model)
      return undefined

    this.mapCustomGetters(model)
    await this.loadRelations(model)

    const data = new GiftCardModel(model)

    cache.getOrSet(`giftcard:${id}`, JSON.stringify(model))

    return data
  }

  async find(id: number): Promise<GiftCardModel | undefined> {
    return await this.applyFind(id)
  }

  // Method to find a GiftCard by ID
  static async find(id: number): Promise<GiftCardModel | undefined> {
    const instance = new GiftCardModel(undefined)

    return await instance.applyFind(id)
  }

  async first(): Promise<GiftCardModel | undefined> {
    let model: GiftCardJsonResponse | undefined

    if (this.hasSelect) {
      model = await this.selectFromQuery.executeTakeFirst()
    }
    else {
      model = await this.selectFromQuery.selectAll().executeTakeFirst()
    }

    if (model) {
      this.mapCustomGetters(model)
      await this.loadRelations(model)
    }

    const data = new GiftCardModel(model)

    return data
  }

  static async first(): Promise<GiftCardModel | undefined> {
    const instance = new GiftCardJsonResponse(null)

    const model = await DB.instance.selectFrom('gift_cards')
      .selectAll()
      .executeTakeFirst()

    instance.mapCustomGetters(model)

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

  async firstOrFail(): Promise<GiftCardModel | undefined> {
    return await this.applyFirstOrFail()
  }

  static async firstOrFail(): Promise<GiftCardModel | undefined> {
    const instance = new GiftCardModel(undefined)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<GiftCardModel[]> {
    const instance = new GiftCardModel(undefined)

    const models = await DB.instance.selectFrom('gift_cards').selectAll().execute()

    instance.mapCustomGetters(models)

    const data = await Promise.all(models.map(async (model: GiftCardType) => {
      return new GiftCardModel(model)
    }))

    return data
  }

  async applyFindOrFail(id: number): Promise<GiftCardModel> {
    const model = await DB.instance.selectFrom('gift_cards').where('id', '=', id).selectAll().executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, `No GiftCardModel results for ${id}`)

    cache.getOrSet(`giftcard:${id}`, JSON.stringify(model))

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

  async applyFindMany(ids: number[]): Promise<GiftCardModel[]> {
    let query = DB.instance.selectFrom('gift_cards').where('id', 'in', ids)

    const instance = new GiftCardModel(undefined)

    query = query.selectAll()

    const models = await query.execute()

    instance.mapCustomGetters(models)
    await instance.loadRelations(models)

    return models.map((modelItem: GiftCardJsonResponse) => instance.parseResult(new GiftCardModel(modelItem)))
  }

  static async findMany(ids: number[]): Promise<GiftCardModel[]> {
    const instance = new GiftCardModel(undefined)

    return await instance.applyFindMany(ids)
  }

  async findMany(ids: number[]): Promise<GiftCardModel[]> {
    return await this.applyFindMany(ids)
  }

  skip(count: number): GiftCardModel {
    this.selectFromQuery = this.selectFromQuery.offset(count)

    return this
  }

  static skip(count: number): GiftCardModel {
    const instance = new GiftCardModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.offset(count)

    return instance
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

  take(count: number): GiftCardModel {
    this.selectFromQuery = this.selectFromQuery.limit(count)

    return this
  }

  static take(count: number): GiftCardModel {
    const instance = new GiftCardModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.limit(count)

    return instance
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

    const result = await instance.selectFromQuery
      .select(sql`COUNT(*) as count`)
      .executeTakeFirst()

    return result.count || 0
  }

  async count(): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`COUNT(*) as count`)
      .executeTakeFirst()

    return result.count || 0
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
          .whereRef(`${relation}.giftcard_id`, '=', 'gift_cards.id'),
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
          .whereRef(`${relation}.giftcard_id`, '=', 'gift_cards.id'),
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
          .whereRef(`${relation}.giftcard_id`, '=', 'gift_cards.id')

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
            .whereRef(`${relation}.giftcard_id`, '=', 'gift_cards.id'),
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
          .whereRef(`${relation}.giftcard_id`, '=', 'gift_cards.id')

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
      dispatch('giftcard:created', model)

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
      dispatch('giftcard:created', model)

    return model
  }

  // Method to remove a GiftCard
  static async remove(id: number): Promise<any> {
    const instance = new GiftCardModel(undefined)

    const model = await instance.find(Number(id))

    if (model)
      dispatch('giftcard:deleted', model)

    return await DB.instance.deleteFrom('gift_cards')
      .where('id', '=', id)
      .execute()
  }

  applyWhere<V>(column: keyof GiftCardsTable, ...args: [V] | [Operator, V]): GiftCardModel {
    if (args.length === 1) {
      const [value] = args
      this.selectFromQuery = this.selectFromQuery.where(column, '=', value)
      this.updateFromQuery = this.updateFromQuery.where(column, '=', value)
      this.deleteFromQuery = this.deleteFromQuery.where(column, '=', value)
    }
    else {
      const [operator, value] = args as [Operator, V]
      this.selectFromQuery = this.selectFromQuery.where(column, operator, value)
      this.updateFromQuery = this.updateFromQuery.where(column, operator, value)
      this.deleteFromQuery = this.deleteFromQuery.where(column, operator, value)
    }

    return this
  }

  where<V = string>(column: keyof GiftCardsTable, ...args: [V] | [Operator, V]): GiftCardModel {
    return this.applyWhere<V>(column, ...args)
  }

  static where<V = string>(column: keyof GiftCardsTable, ...args: [V] | [Operator, V]): GiftCardModel {
    const instance = new GiftCardModel(undefined)

    return instance.applyWhere<V>(column, ...args)
  }

  whereColumn(first: keyof GiftCardsTable, operator: Operator, second: keyof GiftCardsTable): GiftCardModel {
    this.selectFromQuery = this.selectFromQuery.whereRef(first, operator, second)

    return this
  }

  static whereColumn(first: keyof GiftCardsTable, operator: Operator, second: keyof GiftCardsTable): GiftCardModel {
    const instance = new GiftCardModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.whereRef(first, operator, second)

    return instance
  }

  applyWhereRef(column: keyof GiftCardsTable, ...args: string[]): GiftCardModel {
    const [operatorOrValue, value] = args
    const operator = value === undefined ? '=' : operatorOrValue
    const actualValue = value === undefined ? operatorOrValue : value

    const instance = new GiftCardModel(undefined)
    instance.selectFromQuery = instance.selectFromQuery.whereRef(column, operator, actualValue)

    return instance
  }

  whereRef(column: keyof GiftCardsTable, ...args: string[]): GiftCardModel {
    return this.applyWhereRef(column, ...args)
  }

  static whereRef(column: keyof GiftCardsTable, ...args: string[]): GiftCardModel {
    const instance = new GiftCardModel(undefined)

    return instance.applyWhereRef(column, ...args)
  }

  whereRaw(sqlStatement: string): GiftCardModel {
    this.selectFromQuery = this.selectFromQuery.where(sql`${sqlStatement}`)

    return this
  }

  static whereRaw(sqlStatement: string): GiftCardModel {
    const instance = new GiftCardModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where(sql`${sqlStatement}`)

    return instance
  }

  applyOrWhere(...conditions: [string, any][]): GiftCardModel {
    this.selectFromQuery = this.selectFromQuery.where((eb: any) => {
      return eb.or(
        conditions.map(([column, value]) => eb(column, '=', value)),
      )
    })

    this.updateFromQuery = this.updateFromQuery.where((eb: any) => {
      return eb.or(
        conditions.map(([column, value]) => eb(column, '=', value)),
      )
    })

    this.deleteFromQuery = this.deleteFromQuery.where((eb: any) => {
      return eb.or(
        conditions.map(([column, value]) => eb(column, '=', value)),
      )
    })

    return this
  }

  orWhere(...conditions: [string, any][]): GiftCardModel {
    return this.applyOrWhere(...conditions)
  }

  static orWhere(...conditions: [string, any][]): GiftCardModel {
    const instance = new GiftCardModel(undefined)

    return instance.applyOrWhere(...conditions)
  }

  when(
    condition: boolean,
    callback: (query: GiftCardModel) => GiftCardModel,
  ): GiftCardModel {
    return GiftCardModel.when(condition, callback)
  }

  static when(
    condition: boolean,
    callback: (query: GiftCardModel) => GiftCardModel,
  ): GiftCardModel {
    let instance = new GiftCardModel(undefined)

    if (condition)
      instance = callback(instance)

    return instance
  }

  whereNotNull(column: keyof GiftCardsTable): GiftCardModel {
    this.selectFromQuery = this.selectFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is not', null),
    )

    this.updateFromQuery = this.updateFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is not', null),
    )

    this.deleteFromQuery = this.deleteFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is not', null),
    )

    return this
  }

  static whereNotNull(column: keyof GiftCardsTable): GiftCardModel {
    const instance = new GiftCardModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is not', null),
    )

    instance.updateFromQuery = instance.updateFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is not', null),
    )

    instance.deleteFromQuery = instance.deleteFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is not', null),
    )

    return instance
  }

  whereNull(column: keyof GiftCardsTable): GiftCardModel {
    this.selectFromQuery = this.selectFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    this.updateFromQuery = this.updateFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    this.deleteFromQuery = this.deleteFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    return this
  }

  static whereNull(column: keyof GiftCardsTable): GiftCardModel {
    const instance = new GiftCardModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    instance.updateFromQuery = instance.updateFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    instance.deleteFromQuery = instance.deleteFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    return instance
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

  applyWhereIn<V>(column: keyof GiftCardsTable, values: V[]) {
    this.selectFromQuery = this.selectFromQuery.where(column, 'in', values)

    this.updateFromQuery = this.updateFromQuery.where(column, 'in', values)

    this.deleteFromQuery = this.deleteFromQuery.where(column, 'in', values)

    return this
  }

  whereIn<V = number>(column: keyof GiftCardsTable, values: V[]): GiftCardModel {
    return this.applyWhereIn<V>(column, values)
  }

  static whereIn<V = number>(column: keyof GiftCardsTable, values: V[]): GiftCardModel {
    const instance = new GiftCardModel(undefined)

    return instance.applyWhereIn<V>(column, values)
  }

  applyWhereBetween<V>(column: keyof GiftCardsTable, range: [V, V]): GiftCardModel {
    if (range.length !== 2) {
      throw new HttpError(500, 'Range must have exactly two values: [min, max]')
    }

    const query = sql` ${sql.raw(column as string)} between ${range[0]} and ${range[1]} `

    this.selectFromQuery = this.selectFromQuery.where(query)
    this.updateFromQuery = this.updateFromQuery.where(query)
    this.deleteFromQuery = this.deleteFromQuery.where(query)

    return this
  }

  whereBetween<V = number>(column: keyof GiftCardsTable, range: [V, V]): GiftCardModel {
    return this.applyWhereBetween<V>(column, range)
  }

  static whereBetween<V = number>(column: keyof GiftCardsTable, range: [V, V]): GiftCardModel {
    const instance = new GiftCardModel(undefined)

    return instance.applyWhereBetween<V>(column, range)
  }

  applyWhereLike(column: keyof GiftCardsTable, value: string): GiftCardModel {
    this.selectFromQuery = this.selectFromQuery.where(sql` ${sql.raw(column as string)} LIKE ${value}`)

    this.updateFromQuery = this.updateFromQuery.where(sql` ${sql.raw(column as string)} LIKE ${value}`)

    this.deleteFromQuery = this.deleteFromQuery.where(sql` ${sql.raw(column as string)} LIKE ${value}`)

    return this
  }

  whereLike(column: keyof GiftCardsTable, value: string): GiftCardModel {
    return this.applyWhereLike(column, value)
  }

  static whereLike(column: keyof GiftCardsTable, value: string): GiftCardModel {
    const instance = new GiftCardModel(undefined)

    return instance.applyWhereLike(column, value)
  }

  applyWhereNotIn<V>(column: keyof GiftCardsTable, values: V[]): GiftCardModel {
    this.selectFromQuery = this.selectFromQuery.where(column, 'not in', values)

    this.updateFromQuery = this.updateFromQuery.where(column, 'not in', values)

    this.deleteFromQuery = this.deleteFromQuery.where(column, 'not in', values)

    return this
  }

  whereNotIn<V>(column: keyof GiftCardsTable, values: V[]): GiftCardModel {
    return this.applyWhereNotIn<V>(column, values)
  }

  static whereNotIn<V = number>(column: keyof GiftCardsTable, values: V[]): GiftCardModel {
    const instance = new GiftCardModel(undefined)

    return instance.applyWhereNotIn<V>(column, values)
  }

  async exists(): Promise<boolean> {
    let model

    if (this.hasSelect) {
      model = await this.selectFromQuery.executeTakeFirst()
    }
    else {
      model = await this.selectFromQuery.selectAll().executeTakeFirst()
    }

    return model !== null && model !== undefined
  }

  static async latest(): Promise<GiftCardModel | undefined> {
    const instance = new GiftCardModel(undefined)

    const model = await DB.instance.selectFrom('gift_cards')
      .selectAll()
      .orderBy('id', 'desc')
      .executeTakeFirst()

    if (!model)
      return undefined

    instance.mapCustomGetters(model)

    const data = new GiftCardModel(model)

    return data
  }

  static async oldest(): Promise<GiftCardModel | undefined> {
    const instance = new GiftCardModel(undefined)

    const model = await DB.instance.selectFrom('gift_cards')
      .selectAll()
      .orderBy('id', 'asc')
      .executeTakeFirst()

    if (!model)
      return undefined

    instance.mapCustomGetters(model)

    const data = new GiftCardModel(model)

    return data
  }

  static async firstOrCreate(
    condition: Partial<GiftCardType>,
    newGiftCard: NewGiftCard,
  ): Promise<GiftCardModel> {
    const instance = new GiftCardModel(undefined)

    const key = Object.keys(condition)[0] as keyof GiftCardType

    if (!key) {
      throw new HttpError(500, 'Condition must contain at least one key-value pair')
    }

    const value = condition[key]

    // Attempt to find the first record matching the condition
    const existingGiftCard = await DB.instance.selectFrom('gift_cards')
      .selectAll()
      .where(key, '=', value)
      .executeTakeFirst()

    if (existingGiftCard) {
      instance.mapCustomGetters(existingGiftCard)
      await instance.loadRelations(existingGiftCard)

      return new GiftCardModel(existingGiftCard as GiftCardType)
    }
    else {
      return await instance.create(newGiftCard)
    }
  }

  static async updateOrCreate(
    condition: Partial<GiftCardType>,
    newGiftCard: NewGiftCard,
  ): Promise<GiftCardModel> {
    const instance = new GiftCardModel(undefined)

    const key = Object.keys(condition)[0] as keyof GiftCardType

    if (!key) {
      throw new HttpError(500, 'Condition must contain at least one key-value pair')
    }

    const value = condition[key]

    // Attempt to find the first record matching the condition
    const existingGiftCard = await DB.instance.selectFrom('gift_cards')
      .selectAll()
      .where(key, '=', value)
      .executeTakeFirst()

    if (existingGiftCard) {
      // If found, update the existing record
      await DB.instance.updateTable('gift_cards')
        .set(newGiftCard)
        .where(key, '=', value)
        .executeTakeFirstOrThrow()

      // Fetch and return the updated record
      const updatedGiftCard = await DB.instance.selectFrom('gift_cards')
        .selectAll()
        .where(key, '=', value)
        .executeTakeFirst()

      if (!updatedGiftCard) {
        throw new HttpError(500, 'Failed to fetch updated record')
      }

      instance.hasSaved = true

      return new GiftCardModel(updatedGiftCard as GiftCardType)
    }
    else {
      // If not found, create a new record
      return await instance.create(newGiftCard)
    }
  }

  async loadRelations(models: GiftCardJsonResponse | GiftCardJsonResponse[]): Promise<void> {
    // Handle both single model and array of models
    const modelArray = Array.isArray(models) ? models : [models]
    if (!modelArray.length)
      return

    const modelIds = modelArray.map(model => model.id)

    for (const relation of this.withRelations) {
      const relatedRecords = await DB.instance
        .selectFrom(relation)
        .where('giftcard_id', 'in', modelIds)
        .selectAll()
        .execute()

      if (Array.isArray(models)) {
        models.map((model: GiftCardJsonResponse) => {
          const records = relatedRecords.filter((record: { giftcard_id: number }) => {
            return record.giftcard_id === model.id
          })

          model[relation] = records.length === 1 ? records[0] : records
          return model
        })
      }
      else {
        const records = relatedRecords.filter((record: { giftcard_id: number }) => {
          return record.giftcard_id === models.id
        })

        models[relation] = records.length === 1 ? records[0] : records
      }
    }
  }

  with(relations: string[]): GiftCardModel {
    this.withRelations = relations

    return this
  }

  static with(relations: string[]): GiftCardModel {
    const instance = new GiftCardModel(undefined)

    instance.withRelations = relations

    return instance
  }

  async last(): Promise<GiftCardModel | undefined> {
    let model: GiftCardJsonResponse | undefined

    if (this.hasSelect) {
      model = await this.selectFromQuery.executeTakeFirst()
    }
    else {
      model = await this.selectFromQuery.selectAll().orderBy('id', 'desc').executeTakeFirst()
    }

    if (model) {
      this.mapCustomGetters(model)
      await this.loadRelations(model)
    }

    const data = new GiftCardModel(model)

    return data
  }

  static async last(): Promise<GiftCardModel | undefined> {
    const model = await DB.instance.selectFrom('gift_cards').selectAll().orderBy('id', 'desc').executeTakeFirst()

    if (!model)
      return undefined

    const data = new GiftCardModel(model)

    return data
  }

  orderBy(column: keyof GiftCardsTable, order: 'asc' | 'desc'): GiftCardModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, order)

    return this
  }

  static orderBy(column: keyof GiftCardsTable, order: 'asc' | 'desc'): GiftCardModel {
    const instance = new GiftCardModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, order)

    return instance
  }

  groupBy(column: keyof GiftCardsTable): GiftCardModel {
    this.selectFromQuery = this.selectFromQuery.groupBy(column)

    return this
  }

  static groupBy(column: keyof GiftCardsTable): GiftCardModel {
    const instance = new GiftCardModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.groupBy(column)

    return instance
  }

  having<V = string>(column: keyof GiftCardsTable, operator: Operator, value: V): GiftCardModel {
    this.selectFromQuery = this.selectFromQuery.having(column, operator, value)

    return this
  }

  static having<V = string>(column: keyof GiftCardsTable, operator: Operator, value: V): GiftCardModel {
    const instance = new GiftCardModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.having(column, operator, value)

    return instance
  }

  inRandomOrder(): GiftCardModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(sql` ${sql.raw('RANDOM()')} `)

    return this
  }

  static inRandomOrder(): GiftCardModel {
    const instance = new GiftCardModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(sql` ${sql.raw('RANDOM()')} `)

    return instance
  }

  orderByDesc(column: keyof GiftCardsTable): GiftCardModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, 'desc')

    return this
  }

  static orderByDesc(column: keyof GiftCardsTable): GiftCardModel {
    const instance = new GiftCardModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, 'desc')

    return instance
  }

  orderByAsc(column: keyof GiftCardsTable): GiftCardModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, 'asc')

    return this
  }

  static orderByAsc(column: keyof GiftCardsTable): GiftCardModel {
    const instance = new GiftCardModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, 'asc')

    return instance
  }

  async update(newGiftCard: GiftCardUpdate): Promise<GiftCardModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newGiftCard).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewGiftCard

    await this.mapCustomSetters(filteredValues)

    await DB.instance.updateTable('gift_cards')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      const model = await this.find(this.id)

      if (model)
        dispatch('giftcard:updated', model)

      return model
    }

    this.hasSaved = true

    return undefined
  }

  async forceUpdate(giftcard: GiftCardUpdate): Promise<GiftCardModel | undefined> {
    if (this.id === undefined) {
      this.updateFromQuery.set(giftcard).execute()
    }

    await this.mapCustomSetters(giftcard)

    await DB.instance.updateTable('gift_cards')
      .set(giftcard)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      const model = await this.find(this.id)

      if (model)
        dispatch('giftcard:updated', model)

      this.hasSaved = true

      return model
    }

    return undefined
  }

  async save(): Promise<void> {
    if (!this)
      throw new HttpError(500, 'GiftCard data is undefined')

    await this.mapCustomSetters(this.attributes)

    if (this.id === undefined) {
      await this.create(this.attributes)
    }
    else {
      await this.update(this.attributes)
    }

    this.hasSaved = true
  }

  fill(data: Partial<GiftCardType>): GiftCardModel {
    const filteredValues = Object.fromEntries(
      Object.entries(data).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewGiftCard

    this.attributes = {
      ...this.attributes,
      ...filteredValues,
    }

    return this
  }

  forceFill(data: Partial<GiftCardType>): GiftCardModel {
    this.attributes = {
      ...this.attributes,
      ...data,
    }

    return this
  }

  // Method to delete (soft delete) the giftcard instance
  async delete(): Promise<GiftCardsTable> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()
    const model = await this.find(Number(this.id))
    if (model)
      dispatch('giftcard:deleted', model)

    return await DB.instance.deleteFrom('gift_cards')
      .where('id', '=', this.id)
      .execute()
  }

  async userBelong(): Promise<UserModel> {
    if (this.user_id === undefined)
      throw new HttpError(500, 'Relation Error!')

    const model = await User
      .where('id', '=', this.user_id)
      .first()

    if (!model)
      throw new HttpError(500, 'Model Relation Not Found!')

    return model
  }

  toSearchableObject(): Partial<GiftCardsTable> {
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

  distinct(column: keyof GiftCardType): GiftCardModel {
    this.selectFromQuery = this.selectFromQuery.select(column).distinct()

    this.hasSelect = true

    return this
  }

  static distinct(column: keyof GiftCardType): GiftCardModel {
    const instance = new GiftCardModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.select(column).distinct()

    instance.hasSelect = true

    return instance
  }

  join(table: string, firstCol: string, secondCol: string): GiftCardModel {
    this.selectFromQuery = this.selectFromQuery.innerJoin(table, firstCol, secondCol)

    return this
  }

  static join(table: string, firstCol: string, secondCol: string): GiftCardModel {
    const instance = new GiftCardModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.innerJoin(table, firstCol, secondCol)

    return instance
  }

  toJSON(): Partial<GiftCardJsonResponse> {
    const output: Partial<GiftCardJsonResponse> = {

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
      user_id: this.user_id,
      user: this.user,
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

export async function whereExpiryDate(value: string): Promise<GiftCardModel[]> {
  const query = DB.instance.selectFrom('gift_cards').where('expiry_date', '=', value)
  const results: GiftCardJsonResponse = await query.execute()

  return results.map((modelItem: GiftCardJsonResponse) => new GiftCardModel(modelItem))
}

export async function whereLastUsedDate(value: string): Promise<GiftCardModel[]> {
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
