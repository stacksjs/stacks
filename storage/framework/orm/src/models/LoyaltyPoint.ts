import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import { randomUUIDv7 } from 'bun'
import { cache } from '@stacksjs/cache'
import { sql } from '@stacksjs/database'
import { HttpError, ModelNotFoundException } from '@stacksjs/error-handling'
import { dispatch } from '@stacksjs/events'
import { DB, SubqueryBuilder } from '@stacksjs/orm'

export interface LoyaltyPointsTable {
  id: Generated<number>
  wallet_id: string
  points: number
  source: string
  source_reference_id?: string
  description?: string
  expiry_date?: string
  is_used?: boolean
  uuid?: string

  created_at?: Date

  updated_at?: Date

}

export interface LoyaltyPointResponse {
  data: LoyaltyPointJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface LoyaltyPointJsonResponse extends Omit<Selectable<LoyaltyPointsTable>, 'password'> {
  [key: string]: any
}

export type NewLoyaltyPoint = Insertable<LoyaltyPointsTable>
export type LoyaltyPointUpdate = Updateable<LoyaltyPointsTable>

      type SortDirection = 'asc' | 'desc'
interface SortOptions { column: LoyaltyPointJsonResponse, order: SortDirection }
// Define a type for the options parameter
interface QueryOptions {
  sort?: SortOptions
  limit?: number
  offset?: number
  page?: number
}

export class LoyaltyPointModel {
  private readonly hidden: Array<keyof LoyaltyPointJsonResponse> = []
  private readonly fillable: Array<keyof LoyaltyPointJsonResponse> = ['wallet_id', 'points', 'source', 'source_reference_id', 'description', 'expiry_date', 'is_used', 'uuid']
  private readonly guarded: Array<keyof LoyaltyPointJsonResponse> = []
  protected attributes = {} as LoyaltyPointJsonResponse
  protected originalAttributes = {} as LoyaltyPointJsonResponse

  protected selectFromQuery: any
  protected withRelations: string[]
  protected updateFromQuery: any
  protected deleteFromQuery: any
  protected hasSelect: boolean
  private hasSaved: boolean
  private customColumns: Record<string, unknown> = {}

  constructor(loyaltyPoint: LoyaltyPointJsonResponse | undefined) {
    if (loyaltyPoint) {
      this.attributes = { ...loyaltyPoint }
      this.originalAttributes = { ...loyaltyPoint }

      Object.keys(loyaltyPoint).forEach((key) => {
        if (!(key in this)) {
          this.customColumns[key] = (loyaltyPoint as LoyaltyPointJsonResponse)[key]
        }
      })
    }

    this.withRelations = []
    this.selectFromQuery = DB.instance.selectFrom('loyalty_points')
    this.updateFromQuery = DB.instance.updateTable('loyalty_points')
    this.deleteFromQuery = DB.instance.deleteFrom('loyalty_points')
    this.hasSelect = false
    this.hasSaved = false
  }

  mapCustomGetters(models: LoyaltyPointJsonResponse | LoyaltyPointJsonResponse[]): void {
    const data = models

    if (Array.isArray(data)) {
      data.map((model: LoyaltyPointJsonResponse) => {
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

  async mapCustomSetters(model: NewLoyaltyPoint | LoyaltyPointUpdate): Promise<void> {
    const customSetter = {
      default: () => {
      },

    }

    for (const [key, fn] of Object.entries(customSetter)) {
      model[key] = await fn()
    }
  }

  get id(): number {
    return this.attributes.id
  }

  get uuid(): string | undefined {
    return this.attributes.uuid
  }

  get wallet_id(): string {
    return this.attributes.wallet_id
  }

  get points(): number {
    return this.attributes.points
  }

  get source(): string {
    return this.attributes.source
  }

  get source_reference_id(): string | undefined {
    return this.attributes.source_reference_id
  }

  get description(): string | undefined {
    return this.attributes.description
  }

  get expiry_date(): string | undefined {
    return this.attributes.expiry_date
  }

  get is_used(): boolean | undefined {
    return this.attributes.is_used
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

  set wallet_id(value: string) {
    this.attributes.wallet_id = value
  }

  set points(value: number) {
    this.attributes.points = value
  }

  set source(value: string) {
    this.attributes.source = value
  }

  set source_reference_id(value: string) {
    this.attributes.source_reference_id = value
  }

  set description(value: string) {
    this.attributes.description = value
  }

  set expiry_date(value: string) {
    this.attributes.expiry_date = value
  }

  set is_used(value: boolean) {
    this.attributes.is_used = value
  }

  set updated_at(value: Date) {
    this.attributes.updated_at = value
  }

  getOriginal(column?: keyof LoyaltyPointJsonResponse): Partial<LoyaltyPointJsonResponse> {
    if (column) {
      return this.originalAttributes[column]
    }

    return this.originalAttributes
  }

  getChanges(): Partial<LoyaltyPointJsonResponse> {
    return this.fillable.reduce<Partial<LoyaltyPointJsonResponse>>((changes, key) => {
      const currentValue = this.attributes[key as keyof LoyaltyPointsTable]
      const originalValue = this.originalAttributes[key as keyof LoyaltyPointsTable]

      if (currentValue !== originalValue) {
        changes[key] = currentValue
      }

      return changes
    }, {})
  }

  isDirty(column?: keyof LoyaltyPointJsonResponse): boolean {
    if (column) {
      return this.attributes[column] !== this.originalAttributes[column]
    }

    return Object.entries(this.originalAttributes).some(([key, originalValue]) => {
      const currentValue = (this.attributes as any)[key]

      return currentValue !== originalValue
    })
  }

  isClean(column?: keyof LoyaltyPointJsonResponse): boolean {
    return !this.isDirty(column)
  }

  wasChanged(column?: keyof LoyaltyPointJsonResponse): boolean {
    return this.hasSaved && this.isDirty(column)
  }

  select(params: (keyof LoyaltyPointJsonResponse)[] | RawBuilder<string> | string): LoyaltyPointModel {
    this.selectFromQuery = this.selectFromQuery.select(params)

    this.hasSelect = true

    return this
  }

  static select(params: (keyof LoyaltyPointJsonResponse)[] | RawBuilder<string> | string): LoyaltyPointModel {
    const instance = new LoyaltyPointModel(undefined)

    // Initialize a query with the table name and selected fields
    instance.selectFromQuery = instance.selectFromQuery.select(params)

    instance.hasSelect = true

    return instance
  }

  async applyFind(id: number): Promise<LoyaltyPointModel | undefined> {
    const model = await DB.instance.selectFrom('loyalty_points').where('id', '=', id).selectAll().executeTakeFirst()

    if (!model)
      return undefined

    this.mapCustomGetters(model)
    await this.loadRelations(model)

    const data = new LoyaltyPointModel(model)

    cache.getOrSet(`loyaltyPoint:${id}`, JSON.stringify(model))

    return data
  }

  async find(id: number): Promise<LoyaltyPointModel | undefined> {
    return await this.applyFind(id)
  }

  // Method to find a LoyaltyPoint by ID
  static async find(id: number): Promise<LoyaltyPointModel | undefined> {
    const instance = new LoyaltyPointModel(undefined)

    return await instance.applyFind(id)
  }

  async first(): Promise<LoyaltyPointModel | undefined> {
    let model: LoyaltyPointJsonResponse | undefined

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

    const data = new LoyaltyPointModel(model)

    return data
  }

  static async first(): Promise<LoyaltyPointModel | undefined> {
    const instance = new LoyaltyPointJsonResponse(null)

    const model = await DB.instance.selectFrom('loyalty_points')
      .selectAll()
      .executeTakeFirst()

    instance.mapCustomGetters(model)

    const data = new LoyaltyPointModel(model)

    return data
  }

  async applyFirstOrFail(): Promise<LoyaltyPointModel | undefined> {
    const model = await this.selectFromQuery.executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, 'No LoyaltyPointModel results found for query')

    if (model) {
      this.mapCustomGetters(model)
      await this.loadRelations(model)
    }

    const data = new LoyaltyPointModel(model)

    return data
  }

  async firstOrFail(): Promise<LoyaltyPointModel | undefined> {
    return await this.applyFirstOrFail()
  }

  static async firstOrFail(): Promise<LoyaltyPointModel | undefined> {
    const instance = new LoyaltyPointModel(undefined)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<LoyaltyPointModel[]> {
    const instance = new LoyaltyPointModel(undefined)

    const models = await DB.instance.selectFrom('loyalty_points').selectAll().execute()

    instance.mapCustomGetters(models)

    const data = await Promise.all(models.map(async (model: LoyaltyPointJsonResponse) => {
      return new LoyaltyPointModel(model)
    }))

    return data
  }

  async applyFindOrFail(id: number): Promise<LoyaltyPointModel> {
    const model = await DB.instance.selectFrom('loyalty_points').where('id', '=', id).selectAll().executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, `No LoyaltyPointModel results for ${id}`)

    cache.getOrSet(`loyaltyPoint:${id}`, JSON.stringify(model))

    this.mapCustomGetters(model)
    await this.loadRelations(model)

    const data = new LoyaltyPointModel(model)

    return data
  }

  async findOrFail(id: number): Promise<LoyaltyPointModel> {
    return await this.applyFindOrFail(id)
  }

  static async findOrFail(id: number): Promise<LoyaltyPointModel> {
    const instance = new LoyaltyPointModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  async applyFindMany(ids: number[]): Promise<LoyaltyPointModel[]> {
    let query = DB.instance.selectFrom('loyalty_points').where('id', 'in', ids)

    const instance = new LoyaltyPointModel(undefined)

    query = query.selectAll()

    const models = await query.execute()

    instance.mapCustomGetters(models)
    await instance.loadRelations(models)

    return models.map((modelItem: LoyaltyPointJsonResponse) => instance.parseResult(new LoyaltyPointModel(modelItem)))
  }

  static async findMany(ids: number[]): Promise<LoyaltyPointModel[]> {
    const instance = new LoyaltyPointModel(undefined)

    return await instance.applyFindMany(ids)
  }

  async findMany(ids: number[]): Promise<LoyaltyPointModel[]> {
    return await this.applyFindMany(ids)
  }

  skip(count: number): LoyaltyPointModel {
    this.selectFromQuery = this.selectFromQuery.offset(count)

    return this
  }

  static skip(count: number): LoyaltyPointModel {
    const instance = new LoyaltyPointModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.offset(count)

    return instance
  }

  async applyChunk(size: number, callback: (models: LoyaltyPointModel[]) => Promise<void>): Promise<void> {
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

  async chunk(size: number, callback: (models: LoyaltyPointModel[]) => Promise<void>): Promise<void> {
    await this.applyChunk(size, callback)
  }

  static async chunk(size: number, callback: (models: LoyaltyPointModel[]) => Promise<void>): Promise<void> {
    const instance = new LoyaltyPointModel(undefined)

    await instance.applyChunk(size, callback)
  }

  take(count: number): LoyaltyPointModel {
    this.selectFromQuery = this.selectFromQuery.limit(count)

    return this
  }

  static take(count: number): LoyaltyPointModel {
    const instance = new LoyaltyPointModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.limit(count)

    return instance
  }

  static async pluck<K extends keyof LoyaltyPointModel>(field: K): Promise<LoyaltyPointModel[K][]> {
    const instance = new LoyaltyPointModel(undefined)

    if (instance.hasSelect) {
      const model = await instance.selectFromQuery.execute()
      return model.map((modelItem: LoyaltyPointModel) => modelItem[field])
    }

    const model = await instance.selectFromQuery.selectAll().execute()

    return model.map((modelItem: LoyaltyPointModel) => modelItem[field])
  }

  async pluck<K extends keyof LoyaltyPointModel>(field: K): Promise<LoyaltyPointModel[K][]> {
    if (this.hasSelect) {
      const model = await this.selectFromQuery.execute()
      return model.map((modelItem: LoyaltyPointModel) => modelItem[field])
    }

    const model = await this.selectFromQuery.selectAll().execute()

    return model.map((modelItem: LoyaltyPointModel) => modelItem[field])
  }

  static async count(): Promise<number> {
    const instance = new LoyaltyPointModel(undefined)

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

  static async max(field: keyof LoyaltyPointModel): Promise<number> {
    const instance = new LoyaltyPointModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`MAX(${sql.raw(field as string)}) as max `)
      .executeTakeFirst()

    return result.max
  }

  async max(field: keyof LoyaltyPointModel): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`MAX(${sql.raw(field as string)}) as max`)
      .executeTakeFirst()

    return result.max
  }

  static async min(field: keyof LoyaltyPointModel): Promise<number> {
    const instance = new LoyaltyPointModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`MIN(${sql.raw(field as string)}) as min `)
      .executeTakeFirst()

    return result.min
  }

  async min(field: keyof LoyaltyPointModel): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`MIN(${sql.raw(field as string)}) as min `)
      .executeTakeFirst()

    return result.min
  }

  static async avg(field: keyof LoyaltyPointModel): Promise<number> {
    const instance = new LoyaltyPointModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`AVG(${sql.raw(field as string)}) as avg `)
      .executeTakeFirst()

    return result.avg
  }

  async avg(field: keyof LoyaltyPointModel): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`AVG(${sql.raw(field as string)}) as avg `)
      .executeTakeFirst()

    return result.avg
  }

  static async sum(field: keyof LoyaltyPointModel): Promise<number> {
    const instance = new LoyaltyPointModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`SUM(${sql.raw(field as string)}) as sum `)
      .executeTakeFirst()

    return result.sum
  }

  async sum(field: keyof LoyaltyPointModel): Promise<number> {
    const result = this.selectFromQuery
      .select(sql`SUM(${sql.raw(field as string)}) as sum `)
      .executeTakeFirst()

    return result.sum
  }

  async applyGet(): Promise<LoyaltyPointModel[]> {
    let models

    if (this.hasSelect) {
      models = await this.selectFromQuery.execute()
    }
    else {
      models = await this.selectFromQuery.selectAll().execute()
    }

    this.mapCustomGetters(models)
    await this.loadRelations(models)

    const data = await Promise.all(models.map(async (model: LoyaltyPointJsonResponse) => {
      return new LoyaltyPointModel(model)
    }))

    return data
  }

  async get(): Promise<LoyaltyPointModel[]> {
    return await this.applyGet()
  }

  static async get(): Promise<LoyaltyPointModel[]> {
    const instance = new LoyaltyPointModel(undefined)

    return await instance.applyGet()
  }

  has(relation: string): LoyaltyPointModel {
    this.selectFromQuery = this.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(
        selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.loyaltyPoint_id`, '=', 'loyalty_points.id'),
      ),
    )

    return this
  }

  static has(relation: string): LoyaltyPointModel {
    const instance = new LoyaltyPointModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(
        selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.loyaltyPoint_id`, '=', 'loyalty_points.id'),
      ),
    )

    return instance
  }

  static whereExists(callback: (qb: any) => any): LoyaltyPointModel {
    const instance = new LoyaltyPointModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(callback({ exists, selectFrom })),
    )

    return instance
  }

  applyWhereHas(
    relation: string,
    callback: (query: SubqueryBuilder<keyof LoyaltyPointModel>) => void,
  ): LoyaltyPointModel {
    const subqueryBuilder = new SubqueryBuilder()

    callback(subqueryBuilder)
    const conditions = subqueryBuilder.getConditions()

    this.selectFromQuery = this.selectFromQuery
      .where(({ exists, selectFrom }: any) => {
        let subquery = selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.loyaltyPoint_id`, '=', 'loyalty_points.id')

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
    callback: (query: SubqueryBuilder<keyof LoyaltyPointModel>) => void,
  ): LoyaltyPointModel {
    return this.applyWhereHas(relation, callback)
  }

  static whereHas(
    relation: string,
    callback: (query: SubqueryBuilder<keyof LoyaltyPointModel>) => void,
  ): LoyaltyPointModel {
    const instance = new LoyaltyPointModel(undefined)

    return instance.applyWhereHas(relation, callback)
  }

  applyDoesntHave(relation: string): LoyaltyPointModel {
    this.selectFromQuery = this.selectFromQuery.where(({ not, exists, selectFrom }: any) =>
      not(
        exists(
          selectFrom(relation)
            .select('1')
            .whereRef(`${relation}.loyaltyPoint_id`, '=', 'loyalty_points.id'),
        ),
      ),
    )

    return this
  }

  doesntHave(relation: string): LoyaltyPointModel {
    return this.applyDoesntHave(relation)
  }

  static doesntHave(relation: string): LoyaltyPointModel {
    const instance = new LoyaltyPointModel(undefined)

    return instance.applyDoesntHave(relation)
  }

  applyWhereDoesntHave(relation: string, callback: (query: SubqueryBuilder<LoyaltyPointsTable>) => void): LoyaltyPointModel {
    const subqueryBuilder = new SubqueryBuilder()

    callback(subqueryBuilder)
    const conditions = subqueryBuilder.getConditions()

    this.selectFromQuery = this.selectFromQuery
      .where(({ exists, selectFrom, not }: any) => {
        const subquery = selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.loyaltyPoint_id`, '=', 'loyalty_points.id')

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

  whereDoesntHave(relation: string, callback: (query: SubqueryBuilder<LoyaltyPointsTable>) => void): LoyaltyPointModel {
    return this.applyWhereDoesntHave(relation, callback)
  }

  static whereDoesntHave(
    relation: string,
    callback: (query: SubqueryBuilder<LoyaltyPointsTable>) => void,
  ): LoyaltyPointModel {
    const instance = new LoyaltyPointModel(undefined)

    return instance.applyWhereDoesntHave(relation, callback)
  }

  async applyPaginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<LoyaltyPointResponse> {
    const totalRecordsResult = await DB.instance.selectFrom('loyalty_points')
      .select(DB.instance.fn.count('id').as('total')) // Use 'id' or another actual column name
      .executeTakeFirst()

    const totalRecords = Number(totalRecordsResult?.total) || 0
    const totalPages = Math.ceil(totalRecords / (options.limit ?? 10))

    const loyalty_pointsWithExtra = await DB.instance.selectFrom('loyalty_points')
      .selectAll()
      .orderBy('id', 'asc') // Assuming 'id' is used for cursor-based pagination
      .limit((options.limit ?? 10) + 1) // Fetch one extra record
      .offset(((options.page ?? 1) - 1) * (options.limit ?? 10)) // Ensure options.page is not undefined
      .execute()

    let nextCursor = null
    if (loyalty_pointsWithExtra.length > (options.limit ?? 10))
      nextCursor = loyalty_pointsWithExtra.pop()?.id ?? null

    return {
      data: loyalty_pointsWithExtra,
      paging: {
        total_records: totalRecords,
        page: options.page || 1,
        total_pages: totalPages,
      },
      next_cursor: nextCursor,
    }
  }

  async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<LoyaltyPointResponse> {
    return await this.applyPaginate(options)
  }

  // Method to get all loyalty_points
  static async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<LoyaltyPointResponse> {
    const instance = new LoyaltyPointModel(undefined)

    return await instance.applyPaginate(options)
  }

  async applyCreate(newLoyaltyPoint: NewLoyaltyPoint): Promise<LoyaltyPointModel> {
    const filteredValues = Object.fromEntries(
      Object.entries(newLoyaltyPoint).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewLoyaltyPoint

    await this.mapCustomSetters(filteredValues)

    filteredValues.uuid = randomUUIDv7()

    const result = await DB.instance.insertInto('loyalty_points')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await this.find(Number(result.numInsertedOrUpdatedRows)) as LoyaltyPointModel

    if (model)
      dispatch('loyaltyPoint:created', model)

    return model
  }

  async create(newLoyaltyPoint: NewLoyaltyPoint): Promise<LoyaltyPointModel> {
    return await this.applyCreate(newLoyaltyPoint)
  }

  static async create(newLoyaltyPoint: NewLoyaltyPoint): Promise<LoyaltyPointModel> {
    const instance = new LoyaltyPointModel(undefined)

    return await instance.applyCreate(newLoyaltyPoint)
  }

  static async createMany(newLoyaltyPoint: NewLoyaltyPoint[]): Promise<void> {
    const instance = new LoyaltyPointModel(undefined)

    const valuesFiltered = newLoyaltyPoint.map((newLoyaltyPoint: NewLoyaltyPoint) => {
      const filteredValues = Object.fromEntries(
        Object.entries(newLoyaltyPoint).filter(([key]) =>
          !instance.guarded.includes(key) && instance.fillable.includes(key),
        ),
      ) as NewLoyaltyPoint

      filteredValues.uuid = randomUUIDv7()

      return filteredValues
    })

    await DB.instance.insertInto('loyalty_points')
      .values(valuesFiltered)
      .executeTakeFirst()
  }

  static async forceCreate(newLoyaltyPoint: NewLoyaltyPoint): Promise<LoyaltyPointModel> {
    const result = await DB.instance.insertInto('loyalty_points')
      .values(newLoyaltyPoint)
      .executeTakeFirst()

    const model = await find(Number(result.numInsertedOrUpdatedRows)) as LoyaltyPointModel

    if (model)
      dispatch('loyaltyPoint:created', model)

    return model
  }

  // Method to remove a LoyaltyPoint
  static async remove(id: number): Promise<any> {
    const instance = new LoyaltyPointModel(undefined)

    const model = await instance.find(Number(id))

    if (model)
      dispatch('loyaltyPoint:deleted', model)

    return await DB.instance.deleteFrom('loyalty_points')
      .where('id', '=', id)
      .execute()
  }

  applyWhere<V>(column: keyof LoyaltyPointsTable, ...args: [V] | [Operator, V]): LoyaltyPointModel {
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

  where<V = string>(column: keyof LoyaltyPointsTable, ...args: [V] | [Operator, V]): LoyaltyPointModel {
    return this.applyWhere<V>(column, ...args)
  }

  static where<V = string>(column: keyof LoyaltyPointsTable, ...args: [V] | [Operator, V]): LoyaltyPointModel {
    const instance = new LoyaltyPointModel(undefined)

    return instance.applyWhere<V>(column, ...args)
  }

  whereColumn(first: keyof LoyaltyPointsTable, operator: Operator, second: keyof LoyaltyPointsTable): LoyaltyPointModel {
    this.selectFromQuery = this.selectFromQuery.whereRef(first, operator, second)

    return this
  }

  static whereColumn(first: keyof LoyaltyPointsTable, operator: Operator, second: keyof LoyaltyPointsTable): LoyaltyPointModel {
    const instance = new LoyaltyPointModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.whereRef(first, operator, second)

    return instance
  }

  applyWhereRef(column: keyof LoyaltyPointsTable, ...args: string[]): LoyaltyPointModel {
    const [operatorOrValue, value] = args
    const operator = value === undefined ? '=' : operatorOrValue
    const actualValue = value === undefined ? operatorOrValue : value

    const instance = new LoyaltyPointModel(undefined)
    instance.selectFromQuery = instance.selectFromQuery.whereRef(column, operator, actualValue)

    return instance
  }

  whereRef(column: keyof LoyaltyPointsTable, ...args: string[]): LoyaltyPointModel {
    return this.applyWhereRef(column, ...args)
  }

  static whereRef(column: keyof LoyaltyPointsTable, ...args: string[]): LoyaltyPointModel {
    const instance = new LoyaltyPointModel(undefined)

    return instance.applyWhereRef(column, ...args)
  }

  whereRaw(sqlStatement: string): LoyaltyPointModel {
    this.selectFromQuery = this.selectFromQuery.where(sql`${sqlStatement}`)

    return this
  }

  static whereRaw(sqlStatement: string): LoyaltyPointModel {
    const instance = new LoyaltyPointModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where(sql`${sqlStatement}`)

    return instance
  }

  applyOrWhere(...conditions: [string, any][]): LoyaltyPointModel {
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

  orWhere(...conditions: [string, any][]): LoyaltyPointModel {
    return this.applyOrWhere(...conditions)
  }

  static orWhere(...conditions: [string, any][]): LoyaltyPointModel {
    const instance = new LoyaltyPointModel(undefined)

    return instance.applyOrWhere(...conditions)
  }

  when(
    condition: boolean,
    callback: (query: LoyaltyPointModel) => LoyaltyPointModel,
  ): LoyaltyPointModel {
    return LoyaltyPointModel.when(condition, callback)
  }

  static when(
    condition: boolean,
    callback: (query: LoyaltyPointModel) => LoyaltyPointModel,
  ): LoyaltyPointModel {
    let instance = new LoyaltyPointModel(undefined)

    if (condition)
      instance = callback(instance)

    return instance
  }

  whereNotNull(column: keyof LoyaltyPointsTable): LoyaltyPointModel {
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

  static whereNotNull(column: keyof LoyaltyPointsTable): LoyaltyPointModel {
    const instance = new LoyaltyPointModel(undefined)

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

  whereNull(column: keyof LoyaltyPointsTable): LoyaltyPointModel {
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

  static whereNull(column: keyof LoyaltyPointsTable): LoyaltyPointModel {
    const instance = new LoyaltyPointModel(undefined)

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

  static whereWalletId(value: string): LoyaltyPointModel {
    const instance = new LoyaltyPointModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('wallet_id', '=', value)

    return instance
  }

  static wherePoints(value: string): LoyaltyPointModel {
    const instance = new LoyaltyPointModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('points', '=', value)

    return instance
  }

  static whereSource(value: string): LoyaltyPointModel {
    const instance = new LoyaltyPointModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('source', '=', value)

    return instance
  }

  static whereSourceReferenceId(value: string): LoyaltyPointModel {
    const instance = new LoyaltyPointModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('source_reference_id', '=', value)

    return instance
  }

  static whereDescription(value: string): LoyaltyPointModel {
    const instance = new LoyaltyPointModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('description', '=', value)

    return instance
  }

  static whereExpiryDate(value: string): LoyaltyPointModel {
    const instance = new LoyaltyPointModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('expiry_date', '=', value)

    return instance
  }

  static whereIsUsed(value: string): LoyaltyPointModel {
    const instance = new LoyaltyPointModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('is_used', '=', value)

    return instance
  }

  applyWhereIn<V>(column: keyof LoyaltyPointsTable, values: V[]) {
    this.selectFromQuery = this.selectFromQuery.where(column, 'in', values)

    this.updateFromQuery = this.updateFromQuery.where(column, 'in', values)

    this.deleteFromQuery = this.deleteFromQuery.where(column, 'in', values)

    return this
  }

  whereIn<V = number>(column: keyof LoyaltyPointsTable, values: V[]): LoyaltyPointModel {
    return this.applyWhereIn<V>(column, values)
  }

  static whereIn<V = number>(column: keyof LoyaltyPointsTable, values: V[]): LoyaltyPointModel {
    const instance = new LoyaltyPointModel(undefined)

    return instance.applyWhereIn<V>(column, values)
  }

  applyWhereBetween<V>(column: keyof LoyaltyPointsTable, range: [V, V]): LoyaltyPointModel {
    if (range.length !== 2) {
      throw new HttpError(500, 'Range must have exactly two values: [min, max]')
    }

    const query = sql` ${sql.raw(column as string)} between ${range[0]} and ${range[1]} `

    this.selectFromQuery = this.selectFromQuery.where(query)
    this.updateFromQuery = this.updateFromQuery.where(query)
    this.deleteFromQuery = this.deleteFromQuery.where(query)

    return this
  }

  whereBetween<V = number>(column: keyof LoyaltyPointsTable, range: [V, V]): LoyaltyPointModel {
    return this.applyWhereBetween<V>(column, range)
  }

  static whereBetween<V = number>(column: keyof LoyaltyPointsTable, range: [V, V]): LoyaltyPointModel {
    const instance = new LoyaltyPointModel(undefined)

    return instance.applyWhereBetween<V>(column, range)
  }

  applyWhereLike(column: keyof LoyaltyPointsTable, value: string): LoyaltyPointModel {
    this.selectFromQuery = this.selectFromQuery.where(sql` ${sql.raw(column as string)} LIKE ${value}`)

    this.updateFromQuery = this.updateFromQuery.where(sql` ${sql.raw(column as string)} LIKE ${value}`)

    this.deleteFromQuery = this.deleteFromQuery.where(sql` ${sql.raw(column as string)} LIKE ${value}`)

    return this
  }

  whereLike(column: keyof LoyaltyPointsTable, value: string): LoyaltyPointModel {
    return this.applyWhereLike(column, value)
  }

  static whereLike(column: keyof LoyaltyPointsTable, value: string): LoyaltyPointModel {
    const instance = new LoyaltyPointModel(undefined)

    return instance.applyWhereLike(column, value)
  }

  applyWhereNotIn<V>(column: keyof LoyaltyPointsTable, values: V[]): LoyaltyPointModel {
    this.selectFromQuery = this.selectFromQuery.where(column, 'not in', values)

    this.updateFromQuery = this.updateFromQuery.where(column, 'not in', values)

    this.deleteFromQuery = this.deleteFromQuery.where(column, 'not in', values)

    return this
  }

  whereNotIn<V>(column: keyof LoyaltyPointsTable, values: V[]): LoyaltyPointModel {
    return this.applyWhereNotIn<V>(column, values)
  }

  static whereNotIn<V = number>(column: keyof LoyaltyPointsTable, values: V[]): LoyaltyPointModel {
    const instance = new LoyaltyPointModel(undefined)

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

  static async latest(): Promise<LoyaltyPointModel | undefined> {
    const instance = new LoyaltyPointModel(undefined)

    const model = await DB.instance.selectFrom('loyalty_points')
      .selectAll()
      .orderBy('id', 'desc')
      .executeTakeFirst()

    if (!model)
      return undefined

    instance.mapCustomGetters(model)

    const data = new LoyaltyPointModel(model)

    return data
  }

  static async oldest(): Promise<LoyaltyPointModel | undefined> {
    const instance = new LoyaltyPointModel(undefined)

    const model = await DB.instance.selectFrom('loyalty_points')
      .selectAll()
      .orderBy('id', 'asc')
      .executeTakeFirst()

    if (!model)
      return undefined

    instance.mapCustomGetters(model)

    const data = new LoyaltyPointModel(model)

    return data
  }

  static async firstOrCreate(
    condition: Partial<LoyaltyPointJsonResponse>,
    newLoyaltyPoint: NewLoyaltyPoint,
  ): Promise<LoyaltyPointModel> {
    const instance = new LoyaltyPointModel(undefined)

    const key = Object.keys(condition)[0] as keyof LoyaltyPointJsonResponse

    if (!key) {
      throw new HttpError(500, 'Condition must contain at least one key-value pair')
    }

    const value = condition[key]

    // Attempt to find the first record matching the condition
    const existingLoyaltyPoint = await DB.instance.selectFrom('loyalty_points')
      .selectAll()
      .where(key, '=', value)
      .executeTakeFirst()

    if (existingLoyaltyPoint) {
      instance.mapCustomGetters(existingLoyaltyPoint)
      await instance.loadRelations(existingLoyaltyPoint)

      return new LoyaltyPointModel(existingLoyaltyPoint as LoyaltyPointJsonResponse)
    }
    else {
      return await instance.create(newLoyaltyPoint)
    }
  }

  static async updateOrCreate(
    condition: Partial<LoyaltyPointJsonResponse>,
    newLoyaltyPoint: NewLoyaltyPoint,
  ): Promise<LoyaltyPointModel> {
    const instance = new LoyaltyPointModel(undefined)

    const key = Object.keys(condition)[0] as keyof LoyaltyPointJsonResponse

    if (!key) {
      throw new HttpError(500, 'Condition must contain at least one key-value pair')
    }

    const value = condition[key]

    // Attempt to find the first record matching the condition
    const existingLoyaltyPoint = await DB.instance.selectFrom('loyalty_points')
      .selectAll()
      .where(key, '=', value)
      .executeTakeFirst()

    if (existingLoyaltyPoint) {
      // If found, update the existing record
      await DB.instance.updateTable('loyalty_points')
        .set(newLoyaltyPoint)
        .where(key, '=', value)
        .executeTakeFirstOrThrow()

      // Fetch and return the updated record
      const updatedLoyaltyPoint = await DB.instance.selectFrom('loyalty_points')
        .selectAll()
        .where(key, '=', value)
        .executeTakeFirst()

      if (!updatedLoyaltyPoint) {
        throw new HttpError(500, 'Failed to fetch updated record')
      }

      instance.hasSaved = true

      return new LoyaltyPointModel(updatedLoyaltyPoint as LoyaltyPointJsonResponse)
    }
    else {
      // If not found, create a new record
      return await instance.create(newLoyaltyPoint)
    }
  }

  async loadRelations(models: LoyaltyPointJsonResponse | LoyaltyPointJsonResponse[]): Promise<void> {
    // Handle both single model and array of models
    const modelArray = Array.isArray(models) ? models : [models]
    if (!modelArray.length)
      return

    const modelIds = modelArray.map(model => model.id)

    for (const relation of this.withRelations) {
      const relatedRecords = await DB.instance
        .selectFrom(relation)
        .where('loyaltyPoint_id', 'in', modelIds)
        .selectAll()
        .execute()

      if (Array.isArray(models)) {
        models.map((model: LoyaltyPointJsonResponse) => {
          const records = relatedRecords.filter((record: { loyaltyPoint_id: number }) => {
            return record.loyaltyPoint_id === model.id
          })

          model[relation] = records.length === 1 ? records[0] : records
          return model
        })
      }
      else {
        const records = relatedRecords.filter((record: { loyaltyPoint_id: number }) => {
          return record.loyaltyPoint_id === models.id
        })

        models[relation] = records.length === 1 ? records[0] : records
      }
    }
  }

  with(relations: string[]): LoyaltyPointModel {
    this.withRelations = relations

    return this
  }

  static with(relations: string[]): LoyaltyPointModel {
    const instance = new LoyaltyPointModel(undefined)

    instance.withRelations = relations

    return instance
  }

  async last(): Promise<LoyaltyPointModel | undefined> {
    let model: LoyaltyPointJsonResponse | undefined

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

    const data = new LoyaltyPointModel(model)

    return data
  }

  static async last(): Promise<LoyaltyPointModel | undefined> {
    const model = await DB.instance.selectFrom('loyalty_points').selectAll().orderBy('id', 'desc').executeTakeFirst()

    if (!model)
      return undefined

    const data = new LoyaltyPointModel(model)

    return data
  }

  orderBy(column: keyof LoyaltyPointsTable, order: 'asc' | 'desc'): LoyaltyPointModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, order)

    return this
  }

  static orderBy(column: keyof LoyaltyPointsTable, order: 'asc' | 'desc'): LoyaltyPointModel {
    const instance = new LoyaltyPointModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, order)

    return instance
  }

  groupBy(column: keyof LoyaltyPointsTable): LoyaltyPointModel {
    this.selectFromQuery = this.selectFromQuery.groupBy(column)

    return this
  }

  static groupBy(column: keyof LoyaltyPointsTable): LoyaltyPointModel {
    const instance = new LoyaltyPointModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.groupBy(column)

    return instance
  }

  having<V = string>(column: keyof LoyaltyPointsTable, operator: Operator, value: V): LoyaltyPointModel {
    this.selectFromQuery = this.selectFromQuery.having(column, operator, value)

    return this
  }

  static having<V = string>(column: keyof LoyaltyPointsTable, operator: Operator, value: V): LoyaltyPointModel {
    const instance = new LoyaltyPointModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.having(column, operator, value)

    return instance
  }

  inRandomOrder(): LoyaltyPointModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(sql` ${sql.raw('RANDOM()')} `)

    return this
  }

  static inRandomOrder(): LoyaltyPointModel {
    const instance = new LoyaltyPointModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(sql` ${sql.raw('RANDOM()')} `)

    return instance
  }

  orderByDesc(column: keyof LoyaltyPointsTable): LoyaltyPointModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, 'desc')

    return this
  }

  static orderByDesc(column: keyof LoyaltyPointsTable): LoyaltyPointModel {
    const instance = new LoyaltyPointModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, 'desc')

    return instance
  }

  orderByAsc(column: keyof LoyaltyPointsTable): LoyaltyPointModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, 'asc')

    return this
  }

  static orderByAsc(column: keyof LoyaltyPointsTable): LoyaltyPointModel {
    const instance = new LoyaltyPointModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, 'asc')

    return instance
  }

  async update(newLoyaltyPoint: LoyaltyPointUpdate): Promise<LoyaltyPointModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newLoyaltyPoint).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewLoyaltyPoint

    await this.mapCustomSetters(filteredValues)

    await DB.instance.updateTable('loyalty_points')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      const model = await this.find(this.id)

      if (model)
        dispatch('loyaltyPoint:updated', model)

      return model
    }

    this.hasSaved = true

    return undefined
  }

  async forceUpdate(loyaltyPoint: LoyaltyPointUpdate): Promise<LoyaltyPointModel | undefined> {
    if (this.id === undefined) {
      this.updateFromQuery.set(loyaltyPoint).execute()
    }

    await this.mapCustomSetters(loyaltyPoint)

    await DB.instance.updateTable('loyalty_points')
      .set(loyaltyPoint)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      const model = await this.find(this.id)

      if (model)
        dispatch('loyaltyPoint:updated', model)

      this.hasSaved = true

      return model
    }

    return undefined
  }

  async save(): Promise<void> {
    if (!this)
      throw new HttpError(500, 'LoyaltyPoint data is undefined')

    await this.mapCustomSetters(this.attributes)

    if (this.id === undefined) {
      await this.create(this.attributes)
    }
    else {
      await this.update(this.attributes)
    }

    this.hasSaved = true
  }

  fill(data: Partial<LoyaltyPointJsonResponse>): LoyaltyPointModel {
    const filteredValues = Object.fromEntries(
      Object.entries(data).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewLoyaltyPoint

    this.attributes = {
      ...this.attributes,
      ...filteredValues,
    }

    return this
  }

  forceFill(data: Partial<LoyaltyPointJsonResponse>): LoyaltyPointModel {
    this.attributes = {
      ...this.attributes,
      ...data,
    }

    return this
  }

  // Method to delete (soft delete) the loyaltyPoint instance
  async delete(): Promise<LoyaltyPointsTable> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()
    const model = await this.find(Number(this.id))
    if (model)
      dispatch('loyaltyPoint:deleted', model)

    return await DB.instance.deleteFrom('loyalty_points')
      .where('id', '=', this.id)
      .execute()
  }

  toSearchableObject(): Partial<LoyaltyPointJsonResponse> {
    return {
      id: this.id,
      wallet_id: this.wallet_id,
      points: this.points,
      source: this.source,
      description: this.description,
      expiry_date: this.expiry_date,
      is_used: this.is_used,
    }
  }

  distinct(column: keyof LoyaltyPointJsonResponse): LoyaltyPointModel {
    this.selectFromQuery = this.selectFromQuery.select(column).distinct()

    this.hasSelect = true

    return this
  }

  static distinct(column: keyof LoyaltyPointJsonResponse): LoyaltyPointModel {
    const instance = new LoyaltyPointModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.select(column).distinct()

    instance.hasSelect = true

    return instance
  }

  join(table: string, firstCol: string, secondCol: string): LoyaltyPointModel {
    this.selectFromQuery = this.selectFromQuery.innerJoin(table, firstCol, secondCol)

    return this
  }

  static join(table: string, firstCol: string, secondCol: string): LoyaltyPointModel {
    const instance = new LoyaltyPointModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.innerJoin(table, firstCol, secondCol)

    return instance
  }

  toJSON(): LoyaltyPointJsonResponse {
    const output = {

      uuid: this.uuid,

      id: this.id,
      wallet_id: this.wallet_id,
      points: this.points,
      source: this.source,
      source_reference_id: this.source_reference_id,
      description: this.description,
      expiry_date: this.expiry_date,
      is_used: this.is_used,

      created_at: this.created_at,

      updated_at: this.updated_at,

      ...this.customColumns,
    }

    return output
  }

  parseResult(model: LoyaltyPointModel): LoyaltyPointModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof LoyaltyPointModel]
    }

    return model
  }
}

async function find(id: number): Promise<LoyaltyPointModel | undefined> {
  const query = DB.instance.selectFrom('loyalty_points').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  return new LoyaltyPointModel(model)
}

export async function count(): Promise<number> {
  const results = await LoyaltyPointModel.count()

  return results
}

export async function create(newLoyaltyPoint: NewLoyaltyPoint): Promise<LoyaltyPointModel> {
  const result = await DB.instance.insertInto('loyalty_points')
    .values(newLoyaltyPoint)
    .executeTakeFirstOrThrow()

  return await find(Number(result.numInsertedOrUpdatedRows)) as LoyaltyPointModel
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(DB.instance)
}

export async function remove(id: number): Promise<void> {
  await DB.instance.deleteFrom('loyalty_points')
    .where('id', '=', id)
    .execute()
}

export async function whereWalletId(value: string): Promise<LoyaltyPointModel[]> {
  const query = DB.instance.selectFrom('loyalty_points').where('wallet_id', '=', value)
  const results: LoyaltyPointJsonResponse = await query.execute()

  return results.map((modelItem: LoyaltyPointJsonResponse) => new LoyaltyPointModel(modelItem))
}

export async function wherePoints(value: number): Promise<LoyaltyPointModel[]> {
  const query = DB.instance.selectFrom('loyalty_points').where('points', '=', value)
  const results: LoyaltyPointJsonResponse = await query.execute()

  return results.map((modelItem: LoyaltyPointJsonResponse) => new LoyaltyPointModel(modelItem))
}

export async function whereSource(value: string): Promise<LoyaltyPointModel[]> {
  const query = DB.instance.selectFrom('loyalty_points').where('source', '=', value)
  const results: LoyaltyPointJsonResponse = await query.execute()

  return results.map((modelItem: LoyaltyPointJsonResponse) => new LoyaltyPointModel(modelItem))
}

export async function whereSourceReferenceId(value: string): Promise<LoyaltyPointModel[]> {
  const query = DB.instance.selectFrom('loyalty_points').where('source_reference_id', '=', value)
  const results: LoyaltyPointJsonResponse = await query.execute()

  return results.map((modelItem: LoyaltyPointJsonResponse) => new LoyaltyPointModel(modelItem))
}

export async function whereDescription(value: string): Promise<LoyaltyPointModel[]> {
  const query = DB.instance.selectFrom('loyalty_points').where('description', '=', value)
  const results: LoyaltyPointJsonResponse = await query.execute()

  return results.map((modelItem: LoyaltyPointJsonResponse) => new LoyaltyPointModel(modelItem))
}

export async function whereExpiryDate(value: string): Promise<LoyaltyPointModel[]> {
  const query = DB.instance.selectFrom('loyalty_points').where('expiry_date', '=', value)
  const results: LoyaltyPointJsonResponse = await query.execute()

  return results.map((modelItem: LoyaltyPointJsonResponse) => new LoyaltyPointModel(modelItem))
}

export async function whereIsUsed(value: boolean): Promise<LoyaltyPointModel[]> {
  const query = DB.instance.selectFrom('loyalty_points').where('is_used', '=', value)
  const results: LoyaltyPointJsonResponse = await query.execute()

  return results.map((modelItem: LoyaltyPointJsonResponse) => new LoyaltyPointModel(modelItem))
}

export const LoyaltyPoint = LoyaltyPointModel

export default LoyaltyPoint
