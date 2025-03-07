import type { Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import type { ProductModel } from './Product'
import { randomUUIDv7 } from 'bun'
import { cache } from '@stacksjs/cache'
import { sql } from '@stacksjs/database'
import { HttpError, ModelNotFoundException } from '@stacksjs/error-handling'
import { dispatch } from '@stacksjs/events'
import { DB, SubqueryBuilder } from '@stacksjs/orm'

import Product from './Product'

export interface LoyaltyRewardsTable {
  id: number
  product_id: number
  product?: ProductModel
  name: string
  description?: string
  points_required: number
  reward_type: string
  discount_percentage?: number
  free_product_id?: string
  is_active?: boolean
  expiry_days?: number
  image_url?: string
  uuid?: string

  created_at?: Date

  updated_at?: Date

}

export interface LoyaltyRewardResponse {
  data: LoyaltyRewardJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface LoyaltyRewardJsonResponse extends Omit<LoyaltyRewardsTable, 'password'> {
  [key: string]: any
}

export type LoyaltyRewardType = Selectable<LoyaltyRewardsTable>
export type NewLoyaltyReward = Partial<Insertable<LoyaltyRewardsTable>>
export type LoyaltyRewardUpdate = Updateable<LoyaltyRewardsTable>

      type SortDirection = 'asc' | 'desc'
interface SortOptions { column: LoyaltyRewardType, order: SortDirection }
// Define a type for the options parameter
interface QueryOptions {
  sort?: SortOptions
  limit?: number
  offset?: number
  page?: number
}

export class LoyaltyRewardModel {
  private readonly hidden: Array<keyof LoyaltyRewardJsonResponse> = []
  private readonly fillable: Array<keyof LoyaltyRewardJsonResponse> = ['name', 'description', 'points_required', 'reward_type', 'discount_percentage', 'free_product_id', 'is_active', 'expiry_days', 'image_url', 'uuid']
  private readonly guarded: Array<keyof LoyaltyRewardJsonResponse> = []
  protected attributes: Partial<LoyaltyRewardJsonResponse> = {}
  protected originalAttributes: Partial<LoyaltyRewardJsonResponse> = {}

  protected selectFromQuery: any
  protected withRelations: string[]
  protected updateFromQuery: any
  protected deleteFromQuery: any
  protected hasSelect: boolean
  private hasSaved: boolean
  private customColumns: Record<string, unknown> = {}

  constructor(loyaltyreward: LoyaltyRewardJsonResponse | undefined) {
    if (loyaltyreward) {
      this.attributes = { ...loyaltyreward }
      this.originalAttributes = { ...loyaltyreward }

      Object.keys(loyaltyreward).forEach((key) => {
        if (!(key in this)) {
          this.customColumns[key] = (loyaltyreward as LoyaltyRewardJsonResponse)[key]
        }
      })
    }

    this.withRelations = []
    this.selectFromQuery = DB.instance.selectFrom('loyalty_rewards')
    this.updateFromQuery = DB.instance.updateTable('loyalty_rewards')
    this.deleteFromQuery = DB.instance.deleteFrom('loyalty_rewards')
    this.hasSelect = false
    this.hasSaved = false
  }

  mapCustomGetters(models: LoyaltyRewardJsonResponse | LoyaltyRewardJsonResponse[]): void {
    const data = models

    if (Array.isArray(data)) {
      data.map((model: LoyaltyRewardJsonResponse) => {
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

  async mapCustomSetters(model: NewLoyaltyReward): Promise<void> {
    const customSetter = {
      default: () => {
      },

    }

    for (const [key, fn] of Object.entries(customSetter)) {
      model[key] = await fn()
    }
  }

  get product_id(): number | undefined {
    return this.attributes.product_id
  }

  get product(): ProductModel | undefined {
    return this.attributes.product
  }

  get id(): number | undefined {
    return this.attributes.id
  }

  get uuid(): string | undefined {
    return this.attributes.uuid
  }

  get name(): string | undefined {
    return this.attributes.name
  }

  get description(): string | undefined {
    return this.attributes.description
  }

  get points_required(): number | undefined {
    return this.attributes.points_required
  }

  get reward_type(): string | undefined {
    return this.attributes.reward_type
  }

  get discount_percentage(): number | undefined {
    return this.attributes.discount_percentage
  }

  get free_product_id(): string | undefined {
    return this.attributes.free_product_id
  }

  get is_active(): boolean | undefined {
    return this.attributes.is_active
  }

  get expiry_days(): number | undefined {
    return this.attributes.expiry_days
  }

  get image_url(): string | undefined {
    return this.attributes.image_url
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

  set points_required(value: number) {
    this.attributes.points_required = value
  }

  set reward_type(value: string) {
    this.attributes.reward_type = value
  }

  set discount_percentage(value: number) {
    this.attributes.discount_percentage = value
  }

  set free_product_id(value: string) {
    this.attributes.free_product_id = value
  }

  set is_active(value: boolean) {
    this.attributes.is_active = value
  }

  set expiry_days(value: number) {
    this.attributes.expiry_days = value
  }

  set image_url(value: string) {
    this.attributes.image_url = value
  }

  set updated_at(value: Date) {
    this.attributes.updated_at = value
  }

  getOriginal(column?: keyof LoyaltyRewardJsonResponse): Partial<LoyaltyRewardJsonResponse> {
    if (column) {
      return this.originalAttributes[column]
    }

    return this.originalAttributes
  }

  getChanges(): Partial<LoyaltyRewardJsonResponse> {
    return this.fillable.reduce<Partial<LoyaltyRewardJsonResponse>>((changes, key) => {
      const currentValue = this.attributes[key as keyof LoyaltyRewardsTable]
      const originalValue = this.originalAttributes[key as keyof LoyaltyRewardsTable]

      if (currentValue !== originalValue) {
        changes[key] = currentValue
      }

      return changes
    }, {})
  }

  isDirty(column?: keyof LoyaltyRewardType): boolean {
    if (column) {
      return this.attributes[column] !== this.originalAttributes[column]
    }

    return Object.entries(this.originalAttributes).some(([key, originalValue]) => {
      const currentValue = (this.attributes as any)[key]

      return currentValue !== originalValue
    })
  }

  isClean(column?: keyof LoyaltyRewardType): boolean {
    return !this.isDirty(column)
  }

  wasChanged(column?: keyof LoyaltyRewardType): boolean {
    return this.hasSaved && this.isDirty(column)
  }

  select(params: (keyof LoyaltyRewardType)[] | RawBuilder<string> | string): LoyaltyRewardModel {
    this.selectFromQuery = this.selectFromQuery.select(params)

    this.hasSelect = true

    return this
  }

  static select(params: (keyof LoyaltyRewardType)[] | RawBuilder<string> | string): LoyaltyRewardModel {
    const instance = new LoyaltyRewardModel(undefined)

    // Initialize a query with the table name and selected fields
    instance.selectFromQuery = instance.selectFromQuery.select(params)

    instance.hasSelect = true

    return instance
  }

  async applyFind(id: number): Promise<LoyaltyRewardModel | undefined> {
    const model = await DB.instance.selectFrom('loyalty_rewards').where('id', '=', id).selectAll().executeTakeFirst()

    if (!model)
      return undefined

    this.mapCustomGetters(model)
    await this.loadRelations(model)

    const data = new LoyaltyRewardModel(model)

    cache.getOrSet(`loyaltyreward:${id}`, JSON.stringify(model))

    return data
  }

  async find(id: number): Promise<LoyaltyRewardModel | undefined> {
    return await this.applyFind(id)
  }

  // Method to find a LoyaltyReward by ID
  static async find(id: number): Promise<LoyaltyRewardModel | undefined> {
    const instance = new LoyaltyRewardModel(undefined)

    return await instance.applyFind(id)
  }

  async first(): Promise<LoyaltyRewardModel | undefined> {
    let model: LoyaltyRewardJsonResponse | undefined

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

    const data = new LoyaltyRewardModel(model)

    return data
  }

  static async first(): Promise<LoyaltyRewardModel | undefined> {
    const instance = new LoyaltyRewardJsonResponse(null)

    const model = await DB.instance.selectFrom('loyalty_rewards')
      .selectAll()
      .executeTakeFirst()

    instance.mapCustomGetters(model)

    const data = new LoyaltyRewardModel(model)

    return data
  }

  async applyFirstOrFail(): Promise<LoyaltyRewardModel | undefined> {
    const model = await this.selectFromQuery.executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, 'No LoyaltyRewardModel results found for query')

    if (model) {
      this.mapCustomGetters(model)
      await this.loadRelations(model)
    }

    const data = new LoyaltyRewardModel(model)

    return data
  }

  async firstOrFail(): Promise<LoyaltyRewardModel | undefined> {
    return await this.applyFirstOrFail()
  }

  static async firstOrFail(): Promise<LoyaltyRewardModel | undefined> {
    const instance = new LoyaltyRewardModel(undefined)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<LoyaltyRewardModel[]> {
    const instance = new LoyaltyRewardModel(undefined)

    const models = await DB.instance.selectFrom('loyalty_rewards').selectAll().execute()

    instance.mapCustomGetters(models)

    const data = await Promise.all(models.map(async (model: LoyaltyRewardType) => {
      return new LoyaltyRewardModel(model)
    }))

    return data
  }

  async applyFindOrFail(id: number): Promise<LoyaltyRewardModel> {
    const model = await DB.instance.selectFrom('loyalty_rewards').where('id', '=', id).selectAll().executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, `No LoyaltyRewardModel results for ${id}`)

    cache.getOrSet(`loyaltyreward:${id}`, JSON.stringify(model))

    this.mapCustomGetters(model)
    await this.loadRelations(model)

    const data = new LoyaltyRewardModel(model)

    return data
  }

  async findOrFail(id: number): Promise<LoyaltyRewardModel> {
    return await this.applyFindOrFail(id)
  }

  static async findOrFail(id: number): Promise<LoyaltyRewardModel> {
    const instance = new LoyaltyRewardModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  async applyFindMany(ids: number[]): Promise<LoyaltyRewardModel[]> {
    let query = DB.instance.selectFrom('loyalty_rewards').where('id', 'in', ids)

    const instance = new LoyaltyRewardModel(undefined)

    query = query.selectAll()

    const models = await query.execute()

    instance.mapCustomGetters(models)
    await instance.loadRelations(models)

    return models.map((modelItem: LoyaltyRewardJsonResponse) => instance.parseResult(new LoyaltyRewardModel(modelItem)))
  }

  static async findMany(ids: number[]): Promise<LoyaltyRewardModel[]> {
    const instance = new LoyaltyRewardModel(undefined)

    return await instance.applyFindMany(ids)
  }

  async findMany(ids: number[]): Promise<LoyaltyRewardModel[]> {
    return await this.applyFindMany(ids)
  }

  skip(count: number): LoyaltyRewardModel {
    this.selectFromQuery = this.selectFromQuery.offset(count)

    return this
  }

  static skip(count: number): LoyaltyRewardModel {
    const instance = new LoyaltyRewardModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.offset(count)

    return instance
  }

  async applyChunk(size: number, callback: (models: LoyaltyRewardModel[]) => Promise<void>): Promise<void> {
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

  async chunk(size: number, callback: (models: LoyaltyRewardModel[]) => Promise<void>): Promise<void> {
    await this.applyChunk(size, callback)
  }

  static async chunk(size: number, callback: (models: LoyaltyRewardModel[]) => Promise<void>): Promise<void> {
    const instance = new LoyaltyRewardModel(undefined)

    await instance.applyChunk(size, callback)
  }

  take(count: number): LoyaltyRewardModel {
    this.selectFromQuery = this.selectFromQuery.limit(count)

    return this
  }

  static take(count: number): LoyaltyRewardModel {
    const instance = new LoyaltyRewardModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.limit(count)

    return instance
  }

  static async pluck<K extends keyof LoyaltyRewardModel>(field: K): Promise<LoyaltyRewardModel[K][]> {
    const instance = new LoyaltyRewardModel(undefined)

    if (instance.hasSelect) {
      const model = await instance.selectFromQuery.execute()
      return model.map((modelItem: LoyaltyRewardModel) => modelItem[field])
    }

    const model = await instance.selectFromQuery.selectAll().execute()

    return model.map((modelItem: LoyaltyRewardModel) => modelItem[field])
  }

  async pluck<K extends keyof LoyaltyRewardModel>(field: K): Promise<LoyaltyRewardModel[K][]> {
    if (this.hasSelect) {
      const model = await this.selectFromQuery.execute()
      return model.map((modelItem: LoyaltyRewardModel) => modelItem[field])
    }

    const model = await this.selectFromQuery.selectAll().execute()

    return model.map((modelItem: LoyaltyRewardModel) => modelItem[field])
  }

  static async count(): Promise<number> {
    const instance = new LoyaltyRewardModel(undefined)

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

  static async max(field: keyof LoyaltyRewardModel): Promise<number> {
    const instance = new LoyaltyRewardModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`MAX(${sql.raw(field as string)}) as max `)
      .executeTakeFirst()

    return result.max
  }

  async max(field: keyof LoyaltyRewardModel): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`MAX(${sql.raw(field as string)}) as max`)
      .executeTakeFirst()

    return result.max
  }

  static async min(field: keyof LoyaltyRewardModel): Promise<number> {
    const instance = new LoyaltyRewardModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`MIN(${sql.raw(field as string)}) as min `)
      .executeTakeFirst()

    return result.min
  }

  async min(field: keyof LoyaltyRewardModel): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`MIN(${sql.raw(field as string)}) as min `)
      .executeTakeFirst()

    return result.min
  }

  static async avg(field: keyof LoyaltyRewardModel): Promise<number> {
    const instance = new LoyaltyRewardModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`AVG(${sql.raw(field as string)}) as avg `)
      .executeTakeFirst()

    return result.avg
  }

  async avg(field: keyof LoyaltyRewardModel): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`AVG(${sql.raw(field as string)}) as avg `)
      .executeTakeFirst()

    return result.avg
  }

  static async sum(field: keyof LoyaltyRewardModel): Promise<number> {
    const instance = new LoyaltyRewardModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`SUM(${sql.raw(field as string)}) as sum `)
      .executeTakeFirst()

    return result.sum
  }

  async sum(field: keyof LoyaltyRewardModel): Promise<number> {
    const result = this.selectFromQuery
      .select(sql`SUM(${sql.raw(field as string)}) as sum `)
      .executeTakeFirst()

    return result.sum
  }

  async applyGet(): Promise<LoyaltyRewardModel[]> {
    let models

    if (this.hasSelect) {
      models = await this.selectFromQuery.execute()
    }
    else {
      models = await this.selectFromQuery.selectAll().execute()
    }

    this.mapCustomGetters(models)
    await this.loadRelations(models)

    const data = await Promise.all(models.map(async (model: LoyaltyRewardJsonResponse) => {
      return new LoyaltyRewardModel(model)
    }))

    return data
  }

  async get(): Promise<LoyaltyRewardModel[]> {
    return await this.applyGet()
  }

  static async get(): Promise<LoyaltyRewardModel[]> {
    const instance = new LoyaltyRewardModel(undefined)

    return await instance.applyGet()
  }

  has(relation: string): LoyaltyRewardModel {
    this.selectFromQuery = this.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(
        selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.loyaltyreward_id`, '=', 'loyalty_rewards.id'),
      ),
    )

    return this
  }

  static has(relation: string): LoyaltyRewardModel {
    const instance = new LoyaltyRewardModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(
        selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.loyaltyreward_id`, '=', 'loyalty_rewards.id'),
      ),
    )

    return instance
  }

  static whereExists(callback: (qb: any) => any): LoyaltyRewardModel {
    const instance = new LoyaltyRewardModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(callback({ exists, selectFrom })),
    )

    return instance
  }

  applyWhereHas(
    relation: string,
    callback: (query: SubqueryBuilder<keyof LoyaltyRewardModel>) => void,
  ): LoyaltyRewardModel {
    const subqueryBuilder = new SubqueryBuilder()

    callback(subqueryBuilder)
    const conditions = subqueryBuilder.getConditions()

    this.selectFromQuery = this.selectFromQuery
      .where(({ exists, selectFrom }: any) => {
        let subquery = selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.loyaltyreward_id`, '=', 'loyalty_rewards.id')

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
    callback: (query: SubqueryBuilder<keyof LoyaltyRewardModel>) => void,
  ): LoyaltyRewardModel {
    return this.applyWhereHas(relation, callback)
  }

  static whereHas(
    relation: string,
    callback: (query: SubqueryBuilder<keyof LoyaltyRewardModel>) => void,
  ): LoyaltyRewardModel {
    const instance = new LoyaltyRewardModel(undefined)

    return instance.applyWhereHas(relation, callback)
  }

  applyDoesntHave(relation: string): LoyaltyRewardModel {
    this.selectFromQuery = this.selectFromQuery.where(({ not, exists, selectFrom }: any) =>
      not(
        exists(
          selectFrom(relation)
            .select('1')
            .whereRef(`${relation}.loyaltyreward_id`, '=', 'loyalty_rewards.id'),
        ),
      ),
    )

    return this
  }

  doesntHave(relation: string): LoyaltyRewardModel {
    return this.applyDoesntHave(relation)
  }

  static doesntHave(relation: string): LoyaltyRewardModel {
    const instance = new LoyaltyRewardModel(undefined)

    return instance.applyDoesntHave(relation)
  }

  applyWhereDoesntHave(relation: string, callback: (query: SubqueryBuilder<LoyaltyRewardsTable>) => void): LoyaltyRewardModel {
    const subqueryBuilder = new SubqueryBuilder()

    callback(subqueryBuilder)
    const conditions = subqueryBuilder.getConditions()

    this.selectFromQuery = this.selectFromQuery
      .where(({ exists, selectFrom, not }: any) => {
        const subquery = selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.loyaltyreward_id`, '=', 'loyalty_rewards.id')

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

  whereDoesntHave(relation: string, callback: (query: SubqueryBuilder<LoyaltyRewardsTable>) => void): LoyaltyRewardModel {
    return this.applyWhereDoesntHave(relation, callback)
  }

  static whereDoesntHave(
    relation: string,
    callback: (query: SubqueryBuilder<LoyaltyRewardsTable>) => void,
  ): LoyaltyRewardModel {
    const instance = new LoyaltyRewardModel(undefined)

    return instance.applyWhereDoesntHave(relation, callback)
  }

  async applyPaginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<LoyaltyRewardResponse> {
    const totalRecordsResult = await DB.instance.selectFrom('loyalty_rewards')
      .select(DB.instance.fn.count('id').as('total')) // Use 'id' or another actual column name
      .executeTakeFirst()

    const totalRecords = Number(totalRecordsResult?.total) || 0
    const totalPages = Math.ceil(totalRecords / (options.limit ?? 10))

    const loyalty_rewardsWithExtra = await DB.instance.selectFrom('loyalty_rewards')
      .selectAll()
      .orderBy('id', 'asc') // Assuming 'id' is used for cursor-based pagination
      .limit((options.limit ?? 10) + 1) // Fetch one extra record
      .offset(((options.page ?? 1) - 1) * (options.limit ?? 10)) // Ensure options.page is not undefined
      .execute()

    let nextCursor = null
    if (loyalty_rewardsWithExtra.length > (options.limit ?? 10))
      nextCursor = loyalty_rewardsWithExtra.pop()?.id ?? null

    return {
      data: loyalty_rewardsWithExtra,
      paging: {
        total_records: totalRecords,
        page: options.page || 1,
        total_pages: totalPages,
      },
      next_cursor: nextCursor,
    }
  }

  async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<LoyaltyRewardResponse> {
    return await this.applyPaginate(options)
  }

  // Method to get all loyalty_rewards
  static async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<LoyaltyRewardResponse> {
    const instance = new LoyaltyRewardModel(undefined)

    return await instance.applyPaginate(options)
  }

  async applyCreate(newLoyaltyReward: NewLoyaltyReward): Promise<LoyaltyRewardModel> {
    const filteredValues = Object.fromEntries(
      Object.entries(newLoyaltyReward).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewLoyaltyReward

    await this.mapCustomSetters(filteredValues)

    filteredValues.uuid = randomUUIDv7()

    const result = await DB.instance.insertInto('loyalty_rewards')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await this.find(Number(result.numInsertedOrUpdatedRows)) as LoyaltyRewardModel

    if (model)
      dispatch('loyaltyreward:created', model)

    return model
  }

  async create(newLoyaltyReward: NewLoyaltyReward): Promise<LoyaltyRewardModel> {
    return await this.applyCreate(newLoyaltyReward)
  }

  static async create(newLoyaltyReward: NewLoyaltyReward): Promise<LoyaltyRewardModel> {
    const instance = new LoyaltyRewardModel(undefined)

    return await instance.applyCreate(newLoyaltyReward)
  }

  static async createMany(newLoyaltyReward: NewLoyaltyReward[]): Promise<void> {
    const instance = new LoyaltyRewardModel(undefined)

    const valuesFiltered = newLoyaltyReward.map((newLoyaltyReward: NewLoyaltyReward) => {
      const filteredValues = Object.fromEntries(
        Object.entries(newLoyaltyReward).filter(([key]) =>
          !instance.guarded.includes(key) && instance.fillable.includes(key),
        ),
      ) as NewLoyaltyReward

      filteredValues.uuid = randomUUIDv7()

      return filteredValues
    })

    await DB.instance.insertInto('loyalty_rewards')
      .values(valuesFiltered)
      .executeTakeFirst()
  }

  static async forceCreate(newLoyaltyReward: NewLoyaltyReward): Promise<LoyaltyRewardModel> {
    const result = await DB.instance.insertInto('loyalty_rewards')
      .values(newLoyaltyReward)
      .executeTakeFirst()

    const model = await find(Number(result.numInsertedOrUpdatedRows)) as LoyaltyRewardModel

    if (model)
      dispatch('loyaltyreward:created', model)

    return model
  }

  // Method to remove a LoyaltyReward
  static async remove(id: number): Promise<any> {
    const instance = new LoyaltyRewardModel(undefined)

    const model = await instance.find(Number(id))

    if (model)
      dispatch('loyaltyreward:deleted', model)

    return await DB.instance.deleteFrom('loyalty_rewards')
      .where('id', '=', id)
      .execute()
  }

  applyWhere<V>(column: keyof LoyaltyRewardsTable, ...args: [V] | [Operator, V]): LoyaltyRewardModel {
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

  where<V = string>(column: keyof LoyaltyRewardsTable, ...args: [V] | [Operator, V]): LoyaltyRewardModel {
    return this.applyWhere<V>(column, ...args)
  }

  static where<V = string>(column: keyof LoyaltyRewardsTable, ...args: [V] | [Operator, V]): LoyaltyRewardModel {
    const instance = new LoyaltyRewardModel(undefined)

    return instance.applyWhere<V>(column, ...args)
  }

  whereColumn(first: keyof LoyaltyRewardsTable, operator: Operator, second: keyof LoyaltyRewardsTable): LoyaltyRewardModel {
    this.selectFromQuery = this.selectFromQuery.whereRef(first, operator, second)

    return this
  }

  static whereColumn(first: keyof LoyaltyRewardsTable, operator: Operator, second: keyof LoyaltyRewardsTable): LoyaltyRewardModel {
    const instance = new LoyaltyRewardModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.whereRef(first, operator, second)

    return instance
  }

  applyWhereRef(column: keyof LoyaltyRewardsTable, ...args: string[]): LoyaltyRewardModel {
    const [operatorOrValue, value] = args
    const operator = value === undefined ? '=' : operatorOrValue
    const actualValue = value === undefined ? operatorOrValue : value

    const instance = new LoyaltyRewardModel(undefined)
    instance.selectFromQuery = instance.selectFromQuery.whereRef(column, operator, actualValue)

    return instance
  }

  whereRef(column: keyof LoyaltyRewardsTable, ...args: string[]): LoyaltyRewardModel {
    return this.applyWhereRef(column, ...args)
  }

  static whereRef(column: keyof LoyaltyRewardsTable, ...args: string[]): LoyaltyRewardModel {
    const instance = new LoyaltyRewardModel(undefined)

    return instance.applyWhereRef(column, ...args)
  }

  whereRaw(sqlStatement: string): LoyaltyRewardModel {
    this.selectFromQuery = this.selectFromQuery.where(sql`${sqlStatement}`)

    return this
  }

  static whereRaw(sqlStatement: string): LoyaltyRewardModel {
    const instance = new LoyaltyRewardModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where(sql`${sqlStatement}`)

    return instance
  }

  applyOrWhere(...conditions: [string, any][]): LoyaltyRewardModel {
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

  orWhere(...conditions: [string, any][]): LoyaltyRewardModel {
    return this.applyOrWhere(...conditions)
  }

  static orWhere(...conditions: [string, any][]): LoyaltyRewardModel {
    const instance = new LoyaltyRewardModel(undefined)

    return instance.applyOrWhere(...conditions)
  }

  when(
    condition: boolean,
    callback: (query: LoyaltyRewardModel) => LoyaltyRewardModel,
  ): LoyaltyRewardModel {
    return LoyaltyRewardModel.when(condition, callback)
  }

  static when(
    condition: boolean,
    callback: (query: LoyaltyRewardModel) => LoyaltyRewardModel,
  ): LoyaltyRewardModel {
    let instance = new LoyaltyRewardModel(undefined)

    if (condition)
      instance = callback(instance)

    return instance
  }

  whereNotNull(column: keyof LoyaltyRewardsTable): LoyaltyRewardModel {
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

  static whereNotNull(column: keyof LoyaltyRewardsTable): LoyaltyRewardModel {
    const instance = new LoyaltyRewardModel(undefined)

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

  whereNull(column: keyof LoyaltyRewardsTable): LoyaltyRewardModel {
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

  static whereNull(column: keyof LoyaltyRewardsTable): LoyaltyRewardModel {
    const instance = new LoyaltyRewardModel(undefined)

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

  static whereName(value: string): LoyaltyRewardModel {
    const instance = new LoyaltyRewardModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('name', '=', value)

    return instance
  }

  static whereDescription(value: string): LoyaltyRewardModel {
    const instance = new LoyaltyRewardModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('description', '=', value)

    return instance
  }

  static wherePointsRequired(value: string): LoyaltyRewardModel {
    const instance = new LoyaltyRewardModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('points_required', '=', value)

    return instance
  }

  static whereRewardType(value: string): LoyaltyRewardModel {
    const instance = new LoyaltyRewardModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('reward_type', '=', value)

    return instance
  }

  static whereDiscountPercentage(value: string): LoyaltyRewardModel {
    const instance = new LoyaltyRewardModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('discount_percentage', '=', value)

    return instance
  }

  static whereFreeProductId(value: string): LoyaltyRewardModel {
    const instance = new LoyaltyRewardModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('free_product_id', '=', value)

    return instance
  }

  static whereIsActive(value: string): LoyaltyRewardModel {
    const instance = new LoyaltyRewardModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('is_active', '=', value)

    return instance
  }

  static whereExpiryDays(value: string): LoyaltyRewardModel {
    const instance = new LoyaltyRewardModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('expiry_days', '=', value)

    return instance
  }

  static whereImageUrl(value: string): LoyaltyRewardModel {
    const instance = new LoyaltyRewardModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('image_url', '=', value)

    return instance
  }

  applyWhereIn<V>(column: keyof LoyaltyRewardsTable, values: V[]) {
    this.selectFromQuery = this.selectFromQuery.where(column, 'in', values)

    this.updateFromQuery = this.updateFromQuery.where(column, 'in', values)

    this.deleteFromQuery = this.deleteFromQuery.where(column, 'in', values)

    return this
  }

  whereIn<V = number>(column: keyof LoyaltyRewardsTable, values: V[]): LoyaltyRewardModel {
    return this.applyWhereIn<V>(column, values)
  }

  static whereIn<V = number>(column: keyof LoyaltyRewardsTable, values: V[]): LoyaltyRewardModel {
    const instance = new LoyaltyRewardModel(undefined)

    return instance.applyWhereIn<V>(column, values)
  }

  applyWhereBetween<V>(column: keyof LoyaltyRewardsTable, range: [V, V]): LoyaltyRewardModel {
    if (range.length !== 2) {
      throw new HttpError(500, 'Range must have exactly two values: [min, max]')
    }

    const query = sql` ${sql.raw(column as string)} between ${range[0]} and ${range[1]} `

    this.selectFromQuery = this.selectFromQuery.where(query)
    this.updateFromQuery = this.updateFromQuery.where(query)
    this.deleteFromQuery = this.deleteFromQuery.where(query)

    return this
  }

  whereBetween<V = number>(column: keyof LoyaltyRewardsTable, range: [V, V]): LoyaltyRewardModel {
    return this.applyWhereBetween<V>(column, range)
  }

  static whereBetween<V = number>(column: keyof LoyaltyRewardsTable, range: [V, V]): LoyaltyRewardModel {
    const instance = new LoyaltyRewardModel(undefined)

    return instance.applyWhereBetween<V>(column, range)
  }

  applyWhereLike(column: keyof LoyaltyRewardsTable, value: string): LoyaltyRewardModel {
    this.selectFromQuery = this.selectFromQuery.where(sql` ${sql.raw(column as string)} LIKE ${value}`)

    this.updateFromQuery = this.updateFromQuery.where(sql` ${sql.raw(column as string)} LIKE ${value}`)

    this.deleteFromQuery = this.deleteFromQuery.where(sql` ${sql.raw(column as string)} LIKE ${value}`)

    return this
  }

  whereLike(column: keyof LoyaltyRewardsTable, value: string): LoyaltyRewardModel {
    return this.applyWhereLike(column, value)
  }

  static whereLike(column: keyof LoyaltyRewardsTable, value: string): LoyaltyRewardModel {
    const instance = new LoyaltyRewardModel(undefined)

    return instance.applyWhereLike(column, value)
  }

  applyWhereNotIn<V>(column: keyof LoyaltyRewardsTable, values: V[]): LoyaltyRewardModel {
    this.selectFromQuery = this.selectFromQuery.where(column, 'not in', values)

    this.updateFromQuery = this.updateFromQuery.where(column, 'not in', values)

    this.deleteFromQuery = this.deleteFromQuery.where(column, 'not in', values)

    return this
  }

  whereNotIn<V>(column: keyof LoyaltyRewardsTable, values: V[]): LoyaltyRewardModel {
    return this.applyWhereNotIn<V>(column, values)
  }

  static whereNotIn<V = number>(column: keyof LoyaltyRewardsTable, values: V[]): LoyaltyRewardModel {
    const instance = new LoyaltyRewardModel(undefined)

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

  static async latest(): Promise<LoyaltyRewardModel | undefined> {
    const instance = new LoyaltyRewardModel(undefined)

    const model = await DB.instance.selectFrom('loyalty_rewards')
      .selectAll()
      .orderBy('id', 'desc')
      .executeTakeFirst()

    if (!model)
      return undefined

    instance.mapCustomGetters(model)

    const data = new LoyaltyRewardModel(model)

    return data
  }

  static async oldest(): Promise<LoyaltyRewardModel | undefined> {
    const instance = new LoyaltyRewardModel(undefined)

    const model = await DB.instance.selectFrom('loyalty_rewards')
      .selectAll()
      .orderBy('id', 'asc')
      .executeTakeFirst()

    if (!model)
      return undefined

    instance.mapCustomGetters(model)

    const data = new LoyaltyRewardModel(model)

    return data
  }

  static async firstOrCreate(
    condition: Partial<LoyaltyRewardType>,
    newLoyaltyReward: NewLoyaltyReward,
  ): Promise<LoyaltyRewardModel> {
    const instance = new LoyaltyRewardModel(undefined)

    const key = Object.keys(condition)[0] as keyof LoyaltyRewardType

    if (!key) {
      throw new HttpError(500, 'Condition must contain at least one key-value pair')
    }

    const value = condition[key]

    // Attempt to find the first record matching the condition
    const existingLoyaltyReward = await DB.instance.selectFrom('loyalty_rewards')
      .selectAll()
      .where(key, '=', value)
      .executeTakeFirst()

    if (existingLoyaltyReward) {
      instance.mapCustomGetters(existingLoyaltyReward)
      await instance.loadRelations(existingLoyaltyReward)

      return new LoyaltyRewardModel(existingLoyaltyReward as LoyaltyRewardType)
    }
    else {
      return await instance.create(newLoyaltyReward)
    }
  }

  static async updateOrCreate(
    condition: Partial<LoyaltyRewardType>,
    newLoyaltyReward: NewLoyaltyReward,
  ): Promise<LoyaltyRewardModel> {
    const instance = new LoyaltyRewardModel(undefined)

    const key = Object.keys(condition)[0] as keyof LoyaltyRewardType

    if (!key) {
      throw new HttpError(500, 'Condition must contain at least one key-value pair')
    }

    const value = condition[key]

    // Attempt to find the first record matching the condition
    const existingLoyaltyReward = await DB.instance.selectFrom('loyalty_rewards')
      .selectAll()
      .where(key, '=', value)
      .executeTakeFirst()

    if (existingLoyaltyReward) {
      // If found, update the existing record
      await DB.instance.updateTable('loyalty_rewards')
        .set(newLoyaltyReward)
        .where(key, '=', value)
        .executeTakeFirstOrThrow()

      // Fetch and return the updated record
      const updatedLoyaltyReward = await DB.instance.selectFrom('loyalty_rewards')
        .selectAll()
        .where(key, '=', value)
        .executeTakeFirst()

      if (!updatedLoyaltyReward) {
        throw new HttpError(500, 'Failed to fetch updated record')
      }

      instance.hasSaved = true

      return new LoyaltyRewardModel(updatedLoyaltyReward as LoyaltyRewardType)
    }
    else {
      // If not found, create a new record
      return await instance.create(newLoyaltyReward)
    }
  }

  async loadRelations(models: LoyaltyRewardJsonResponse | LoyaltyRewardJsonResponse[]): Promise<void> {
    // Handle both single model and array of models
    const modelArray = Array.isArray(models) ? models : [models]
    if (!modelArray.length)
      return

    const modelIds = modelArray.map(model => model.id)

    for (const relation of this.withRelations) {
      const relatedRecords = await DB.instance
        .selectFrom(relation)
        .where('loyaltyreward_id', 'in', modelIds)
        .selectAll()
        .execute()

      if (Array.isArray(models)) {
        models.map((model: LoyaltyRewardJsonResponse) => {
          const records = relatedRecords.filter((record: { loyaltyreward_id: number }) => {
            return record.loyaltyreward_id === model.id
          })

          model[relation] = records.length === 1 ? records[0] : records
          return model
        })
      }
      else {
        const records = relatedRecords.filter((record: { loyaltyreward_id: number }) => {
          return record.loyaltyreward_id === models.id
        })

        models[relation] = records.length === 1 ? records[0] : records
      }
    }
  }

  with(relations: string[]): LoyaltyRewardModel {
    this.withRelations = relations

    return this
  }

  static with(relations: string[]): LoyaltyRewardModel {
    const instance = new LoyaltyRewardModel(undefined)

    instance.withRelations = relations

    return instance
  }

  async last(): Promise<LoyaltyRewardModel | undefined> {
    let model: LoyaltyRewardJsonResponse | undefined

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

    const data = new LoyaltyRewardModel(model)

    return data
  }

  static async last(): Promise<LoyaltyRewardModel | undefined> {
    const model = await DB.instance.selectFrom('loyalty_rewards').selectAll().orderBy('id', 'desc').executeTakeFirst()

    if (!model)
      return undefined

    const data = new LoyaltyRewardModel(model)

    return data
  }

  orderBy(column: keyof LoyaltyRewardsTable, order: 'asc' | 'desc'): LoyaltyRewardModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, order)

    return this
  }

  static orderBy(column: keyof LoyaltyRewardsTable, order: 'asc' | 'desc'): LoyaltyRewardModel {
    const instance = new LoyaltyRewardModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, order)

    return instance
  }

  groupBy(column: keyof LoyaltyRewardsTable): LoyaltyRewardModel {
    this.selectFromQuery = this.selectFromQuery.groupBy(column)

    return this
  }

  static groupBy(column: keyof LoyaltyRewardsTable): LoyaltyRewardModel {
    const instance = new LoyaltyRewardModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.groupBy(column)

    return instance
  }

  having<V = string>(column: keyof LoyaltyRewardsTable, operator: Operator, value: V): LoyaltyRewardModel {
    this.selectFromQuery = this.selectFromQuery.having(column, operator, value)

    return this
  }

  static having<V = string>(column: keyof LoyaltyRewardsTable, operator: Operator, value: V): LoyaltyRewardModel {
    const instance = new LoyaltyRewardModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.having(column, operator, value)

    return instance
  }

  inRandomOrder(): LoyaltyRewardModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(sql` ${sql.raw('RANDOM()')} `)

    return this
  }

  static inRandomOrder(): LoyaltyRewardModel {
    const instance = new LoyaltyRewardModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(sql` ${sql.raw('RANDOM()')} `)

    return instance
  }

  orderByDesc(column: keyof LoyaltyRewardsTable): LoyaltyRewardModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, 'desc')

    return this
  }

  static orderByDesc(column: keyof LoyaltyRewardsTable): LoyaltyRewardModel {
    const instance = new LoyaltyRewardModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, 'desc')

    return instance
  }

  orderByAsc(column: keyof LoyaltyRewardsTable): LoyaltyRewardModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, 'asc')

    return this
  }

  static orderByAsc(column: keyof LoyaltyRewardsTable): LoyaltyRewardModel {
    const instance = new LoyaltyRewardModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, 'asc')

    return instance
  }

  async update(newLoyaltyReward: LoyaltyRewardUpdate): Promise<LoyaltyRewardModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newLoyaltyReward).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewLoyaltyReward

    await this.mapCustomSetters(filteredValues)

    await DB.instance.updateTable('loyalty_rewards')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      const model = await this.find(this.id)

      if (model)
        dispatch('loyaltyreward:updated', model)

      return model
    }

    this.hasSaved = true

    return undefined
  }

  async forceUpdate(loyaltyreward: LoyaltyRewardUpdate): Promise<LoyaltyRewardModel | undefined> {
    if (this.id === undefined) {
      this.updateFromQuery.set(loyaltyreward).execute()
    }

    await this.mapCustomSetters(loyaltyreward)

    await DB.instance.updateTable('loyalty_rewards')
      .set(loyaltyreward)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      const model = await this.find(this.id)

      if (model)
        dispatch('loyaltyreward:updated', model)

      this.hasSaved = true

      return model
    }

    return undefined
  }

  async save(): Promise<void> {
    if (!this)
      throw new HttpError(500, 'LoyaltyReward data is undefined')

    await this.mapCustomSetters(this.attributes)

    if (this.id === undefined) {
      await this.create(this.attributes)
    }
    else {
      await this.update(this.attributes)
    }

    this.hasSaved = true
  }

  fill(data: Partial<LoyaltyRewardType>): LoyaltyRewardModel {
    const filteredValues = Object.fromEntries(
      Object.entries(data).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewLoyaltyReward

    this.attributes = {
      ...this.attributes,
      ...filteredValues,
    }

    return this
  }

  forceFill(data: Partial<LoyaltyRewardType>): LoyaltyRewardModel {
    this.attributes = {
      ...this.attributes,
      ...data,
    }

    return this
  }

  // Method to delete (soft delete) the loyaltyreward instance
  async delete(): Promise<LoyaltyRewardsTable> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()
    const model = await this.find(Number(this.id))
    if (model)
      dispatch('loyaltyreward:deleted', model)

    return await DB.instance.deleteFrom('loyalty_rewards')
      .where('id', '=', this.id)
      .execute()
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

  toSearchableObject(): Partial<LoyaltyRewardsTable> {
    return {
      id: this.id,
      name: this.name,
      points_required: this.points_required,
      reward_type: this.reward_type,
      is_active: this.is_active,
    }
  }

  distinct(column: keyof LoyaltyRewardType): LoyaltyRewardModel {
    this.selectFromQuery = this.selectFromQuery.select(column).distinct()

    this.hasSelect = true

    return this
  }

  static distinct(column: keyof LoyaltyRewardType): LoyaltyRewardModel {
    const instance = new LoyaltyRewardModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.select(column).distinct()

    instance.hasSelect = true

    return instance
  }

  join(table: string, firstCol: string, secondCol: string): LoyaltyRewardModel {
    this.selectFromQuery = this.selectFromQuery.innerJoin(table, firstCol, secondCol)

    return this
  }

  static join(table: string, firstCol: string, secondCol: string): LoyaltyRewardModel {
    const instance = new LoyaltyRewardModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.innerJoin(table, firstCol, secondCol)

    return instance
  }

  toJSON(): Partial<LoyaltyRewardJsonResponse> {
    const output: Partial<LoyaltyRewardJsonResponse> = {

      id: this.id,
      name: this.name,
      description: this.description,
      points_required: this.points_required,
      reward_type: this.reward_type,
      discount_percentage: this.discount_percentage,
      free_product_id: this.free_product_id,
      is_active: this.is_active,
      expiry_days: this.expiry_days,
      image_url: this.image_url,

      created_at: this.created_at,

      updated_at: this.updated_at,

      product_id: this.product_id,
      product: this.product,
      ...this.customColumns,
    }

    return output
  }

  parseResult(model: LoyaltyRewardModel): LoyaltyRewardModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof LoyaltyRewardModel]
    }

    return model
  }
}

async function find(id: number): Promise<LoyaltyRewardModel | undefined> {
  const query = DB.instance.selectFrom('loyalty_rewards').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  return new LoyaltyRewardModel(model)
}

export async function count(): Promise<number> {
  const results = await LoyaltyRewardModel.count()

  return results
}

export async function create(newLoyaltyReward: NewLoyaltyReward): Promise<LoyaltyRewardModel> {
  const result = await DB.instance.insertInto('loyalty_rewards')
    .values(newLoyaltyReward)
    .executeTakeFirstOrThrow()

  return await find(Number(result.numInsertedOrUpdatedRows)) as LoyaltyRewardModel
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(DB.instance)
}

export async function remove(id: number): Promise<void> {
  await DB.instance.deleteFrom('loyalty_rewards')
    .where('id', '=', id)
    .execute()
}

export async function whereName(value: string): Promise<LoyaltyRewardModel[]> {
  const query = DB.instance.selectFrom('loyalty_rewards').where('name', '=', value)
  const results: LoyaltyRewardJsonResponse = await query.execute()

  return results.map((modelItem: LoyaltyRewardJsonResponse) => new LoyaltyRewardModel(modelItem))
}

export async function whereDescription(value: string): Promise<LoyaltyRewardModel[]> {
  const query = DB.instance.selectFrom('loyalty_rewards').where('description', '=', value)
  const results: LoyaltyRewardJsonResponse = await query.execute()

  return results.map((modelItem: LoyaltyRewardJsonResponse) => new LoyaltyRewardModel(modelItem))
}

export async function wherePointsRequired(value: number): Promise<LoyaltyRewardModel[]> {
  const query = DB.instance.selectFrom('loyalty_rewards').where('points_required', '=', value)
  const results: LoyaltyRewardJsonResponse = await query.execute()

  return results.map((modelItem: LoyaltyRewardJsonResponse) => new LoyaltyRewardModel(modelItem))
}

export async function whereRewardType(value: string): Promise<LoyaltyRewardModel[]> {
  const query = DB.instance.selectFrom('loyalty_rewards').where('reward_type', '=', value)
  const results: LoyaltyRewardJsonResponse = await query.execute()

  return results.map((modelItem: LoyaltyRewardJsonResponse) => new LoyaltyRewardModel(modelItem))
}

export async function whereDiscountPercentage(value: number): Promise<LoyaltyRewardModel[]> {
  const query = DB.instance.selectFrom('loyalty_rewards').where('discount_percentage', '=', value)
  const results: LoyaltyRewardJsonResponse = await query.execute()

  return results.map((modelItem: LoyaltyRewardJsonResponse) => new LoyaltyRewardModel(modelItem))
}

export async function whereFreeProductId(value: string): Promise<LoyaltyRewardModel[]> {
  const query = DB.instance.selectFrom('loyalty_rewards').where('free_product_id', '=', value)
  const results: LoyaltyRewardJsonResponse = await query.execute()

  return results.map((modelItem: LoyaltyRewardJsonResponse) => new LoyaltyRewardModel(modelItem))
}

export async function whereIsActive(value: boolean): Promise<LoyaltyRewardModel[]> {
  const query = DB.instance.selectFrom('loyalty_rewards').where('is_active', '=', value)
  const results: LoyaltyRewardJsonResponse = await query.execute()

  return results.map((modelItem: LoyaltyRewardJsonResponse) => new LoyaltyRewardModel(modelItem))
}

export async function whereExpiryDays(value: number): Promise<LoyaltyRewardModel[]> {
  const query = DB.instance.selectFrom('loyalty_rewards').where('expiry_days', '=', value)
  const results: LoyaltyRewardJsonResponse = await query.execute()

  return results.map((modelItem: LoyaltyRewardJsonResponse) => new LoyaltyRewardModel(modelItem))
}

export async function whereImageUrl(value: string): Promise<LoyaltyRewardModel[]> {
  const query = DB.instance.selectFrom('loyalty_rewards').where('image_url', '=', value)
  const results: LoyaltyRewardJsonResponse = await query.execute()

  return results.map((modelItem: LoyaltyRewardJsonResponse) => new LoyaltyRewardModel(modelItem))
}

export const LoyaltyReward = LoyaltyRewardModel

export default LoyaltyReward
