import type { Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import { cache } from '@stacksjs/cache'
import { sql } from '@stacksjs/database'
import { HttpError, ModelNotFoundException } from '@stacksjs/error-handling'
import { dispatch } from '@stacksjs/events'
import { DB, SubqueryBuilder } from '@stacksjs/orm'

export interface ReleasesTable {
  id?: number
  version?: string

  created_at?: Date

  updated_at?: Date

}

interface ReleaseResponse {
  data: ReleaseJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface ReleaseJsonResponse extends Omit<ReleasesTable, 'password'> {
  [key: string]: any
}

export type ReleaseType = Selectable<ReleasesTable>
export type NewRelease = Partial<Insertable<ReleasesTable>>
export type ReleaseUpdate = Updateable<ReleasesTable>

      type SortDirection = 'asc' | 'desc'
interface SortOptions { column: ReleaseType, order: SortDirection }
// Define a type for the options parameter
interface QueryOptions {
  sort?: SortOptions
  limit?: number
  offset?: number
  page?: number
}

export class ReleaseModel {
  private readonly hidden: Array<keyof ReleaseJsonResponse> = []
  private readonly fillable: Array<keyof ReleaseJsonResponse> = ['version', 'uuid']
  private readonly guarded: Array<keyof ReleaseJsonResponse> = []
  protected attributes: Partial<ReleaseType> = {}
  protected originalAttributes: Partial<ReleaseType> = {}

  protected selectFromQuery: any
  protected withRelations: string[]
  protected updateFromQuery: any
  protected deleteFromQuery: any
  protected hasSelect: boolean
  private hasSaved: boolean
  private customColumns: Record<string, unknown> = {}

  constructor(release: Partial<ReleaseType> | null) {
    if (release) {
      this.attributes = { ...release }
      this.originalAttributes = { ...release }

      Object.keys(release).forEach((key) => {
        if (!(key in this)) {
          this.customColumns[key] = (release as ReleaseJsonResponse)[key]
        }
      })
    }

    this.withRelations = []
    this.selectFromQuery = DB.instance.selectFrom('releases')
    this.updateFromQuery = DB.instance.updateTable('releases')
    this.deleteFromQuery = DB.instance.deleteFrom('releases')
    this.hasSelect = false
    this.hasSaved = false
  }

  get id(): number | undefined {
    return this.attributes.id
  }

  get version(): string | undefined {
    return this.attributes.version
  }

  get created_at(): Date | undefined {
    return this.attributes.created_at
  }

  get updated_at(): Date | undefined {
    return this.attributes.updated_at
  }

  set version(value: string) {
    this.attributes.version = value
  }

  set updated_at(value: Date) {
    this.attributes.updated_at = value
  }

  getOriginal(column?: keyof ReleaseType): Partial<ReleaseType> | any {
    if (column) {
      return this.originalAttributes[column]
    }

    return this.originalAttributes
  }

  getChanges(): Partial<ReleaseJsonResponse> {
    return this.fillable.reduce<Partial<ReleaseJsonResponse>>((changes, key) => {
      const currentValue = this.attributes[key as keyof ReleasesTable]
      const originalValue = this.originalAttributes[key as keyof ReleasesTable]

      if (currentValue !== originalValue) {
        changes[key] = currentValue
      }

      return changes
    }, {})
  }

  isDirty(column?: keyof ReleaseType): boolean {
    if (column) {
      return this.attributes[column] !== this.originalAttributes[column]
    }

    return Object.entries(this.originalAttributes).some(([key, originalValue]) => {
      const currentValue = (this.attributes as any)[key]

      return currentValue !== originalValue
    })
  }

  isClean(column?: keyof ReleaseType): boolean {
    return !this.isDirty(column)
  }

  wasChanged(column?: keyof ReleaseType): boolean {
    return this.hasSaved && this.isDirty(column)
  }

  select(params: (keyof ReleaseType)[] | RawBuilder<string> | string): ReleaseModel {
    return ReleaseModel.select(params)
  }

  static select(params: (keyof ReleaseType)[] | RawBuilder<string> | string): ReleaseModel {
    const instance = new ReleaseModel(null)

    // Initialize a query with the table name and selected fields
    instance.selectFromQuery = instance.selectFromQuery.select(params)

    instance.hasSelect = true

    return instance
  }

  async find(id: number): Promise<ReleaseModel | undefined> {
    return await ReleaseModel.find(id)
  }

  // Method to find a Release by ID
  static async find(id: number): Promise<ReleaseModel | undefined> {
    const model = await DB.instance.selectFrom('releases').where('id', '=', id).selectAll().executeTakeFirst()

    if (!model)
      return undefined

    const instance = new ReleaseModel(null)

    const result = await instance.mapWith(model)

    const data = new ReleaseModel(result as ReleaseType)

    cache.getOrSet(`release:${id}`, JSON.stringify(model))

    return data
  }

  async first(): Promise<ReleaseModel | undefined> {
    return await ReleaseModel.first()
  }

  static async first(): Promise<ReleaseModel | undefined> {
    const model = await DB.instance.selectFrom('releases')
      .selectAll()
      .executeTakeFirst()

    if (!model)
      return undefined

    const instance = new ReleaseModel(null)

    const result = await instance.mapWith(model)

    const data = new ReleaseModel(result as ReleaseType)

    return data
  }

  async firstOrFail(): Promise<ReleaseModel | undefined> {
    return await ReleaseModel.firstOrFail()
  }

  static async firstOrFail(): Promise<ReleaseModel | undefined> {
    const instance = new ReleaseModel(null)

    const model = await instance.selectFromQuery.executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, 'No ReleaseModel results found for query')

    const result = await instance.mapWith(model)

    const data = new ReleaseModel(result as ReleaseType)

    return data
  }

  async mapWith(model: ReleaseType): Promise<ReleaseType> {
    return model
  }

  static async all(): Promise<ReleaseModel[]> {
    const models = await DB.instance.selectFrom('releases').selectAll().execute()

    const data = await Promise.all(models.map(async (model: ReleaseType) => {
      const instance = new ReleaseModel(model)

      const results = await instance.mapWith(model)

      return new ReleaseModel(results)
    }))

    return data
  }

  async findOrFail(id: number): Promise<ReleaseModel> {
    return await ReleaseModel.findOrFail(id)
  }

  static async findOrFail(id: number): Promise<ReleaseModel> {
    const model = await DB.instance.selectFrom('releases').where('id', '=', id).selectAll().executeTakeFirst()

    const instance = new ReleaseModel(null)

    if (model === undefined)
      throw new ModelNotFoundException(404, `No ReleaseModel results for ${id}`)

    cache.getOrSet(`release:${id}`, JSON.stringify(model))

    const result = await instance.mapWith(model)

    const data = new ReleaseModel(result as ReleaseType)

    return data
  }

  static async findMany(ids: number[]): Promise<ReleaseModel[]> {
    let query = DB.instance.selectFrom('releases').where('id', 'in', ids)

    const instance = new ReleaseModel(null)

    query = query.selectAll()

    const model = await query.execute()

    return model.map((modelItem: ReleaseModel) => instance.parseResult(new ReleaseModel(modelItem)))
  }

  skip(count: number): ReleaseModel {
    return ReleaseModel.skip(count)
  }

  static skip(count: number): ReleaseModel {
    const instance = new ReleaseModel(null)

    instance.selectFromQuery = instance.selectFromQuery.offset(count)

    return instance
  }

  async chunk(size: number, callback: (models: ReleaseModel[]) => Promise<void>): Promise<void> {
    await ReleaseModel.chunk(size, callback)
  }

  static async chunk(size: number, callback: (models: ReleaseModel[]) => Promise<void>): Promise<void> {
    let page = 1
    let hasMore = true

    while (hasMore) {
      const instance = new ReleaseModel(null)

      // Get one batch
      const models = await instance.selectFromQuery
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

  take(count: number): ReleaseModel {
    return ReleaseModel.take(count)
  }

  static take(count: number): ReleaseModel {
    const instance = new ReleaseModel(null)

    instance.selectFromQuery = instance.selectFromQuery.limit(count)

    return instance
  }

  static async pluck<K extends keyof ReleaseModel>(field: K): Promise<ReleaseModel[K][]> {
    const instance = new ReleaseModel(null)

    if (instance.hasSelect) {
      const model = await instance.selectFromQuery.execute()
      return model.map((modelItem: ReleaseModel) => modelItem[field])
    }

    const model = await instance.selectFromQuery.selectAll().execute()

    return model.map((modelItem: ReleaseModel) => modelItem[field])
  }

  async pluck<K extends keyof ReleaseModel>(field: K): Promise<ReleaseModel[K][]> {
    return ReleaseModel.pluck(field)
  }

  static async count(): Promise<number> {
    const instance = new ReleaseModel(null)

    const result = instance.selectFromQuery
      .select(sql`COUNT(*) as count`)
      .executeTakeFirst()

    return result.count || 0
  }

  async count(): Promise<number> {
    return ReleaseModel.count()
  }

  async max(field: keyof ReleaseModel): Promise<number> {
    return await this.selectFromQuery
      .select(sql`MAX(${sql.raw(field as string)}) `)
      .executeTakeFirst()
  }

  async min(field: keyof ReleaseModel): Promise<number> {
    return await this.selectFromQuery
      .select(sql`MIN(${sql.raw(field as string)}) `)
      .executeTakeFirst()
  }

  async avg(field: keyof ReleaseModel): Promise<number> {
    return this.selectFromQuery
      .select(sql`AVG(${sql.raw(field as string)})`)
      .executeTakeFirst()
  }

  async sum(field: keyof ReleaseModel): Promise<number> {
    return this.selectFromQuery
      .select(sql`SUM(${sql.raw(field as string)})`)
      .executeTakeFirst()
  }

  async applyGet(): Promise<ReleaseModel[]> {
    let models

    if (this.hasSelect) {
      models = await this.selectFromQuery.execute()
    }
    else {
      models = await this.selectFromQuery.selectAll().execute()
    }

    const data = await Promise.all(models.map(async (model: ReleaseModel) => {
      const instance = new ReleaseModel(model)

      const results = await instance.mapWith(model)

      return new ReleaseModel(results)
    }))

    return data
  }

  async get(): Promise<ReleaseModel[]> {
    return await this.applyGet()
  }

  static async get(): Promise<ReleaseModel[]> {
    const instance = new ReleaseModel(null)

    return await instance.applyGet()
  }

  has(relation: string): ReleaseModel {
    return ReleaseModel.has(relation)
  }

  static has(relation: string): ReleaseModel {
    const instance = new ReleaseModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(
        selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.release_id`, '=', 'releases.id'),
      ),
    )

    return instance
  }

  static whereExists(callback: (qb: any) => any): ReleaseModel {
    const instance = new ReleaseModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(callback({ exists, selectFrom })),
    )

    return instance
  }

  whereHas(
    relation: string,
    callback: (query: SubqueryBuilder) => void,
  ): ReleaseModel {
    return ReleaseModel.whereHas(relation, callback)
  }

  static whereHas(
    relation: string,
    callback: (query: SubqueryBuilder) => void,
  ): ReleaseModel {
    const instance = new ReleaseModel(null)
    const subqueryBuilder = new SubqueryBuilder()

    callback(subqueryBuilder)
    const conditions = subqueryBuilder.getConditions()

    instance.selectFromQuery = instance.selectFromQuery
      .where(({ exists, selectFrom }: any) => {
        let subquery = selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.release_id`, '=', 'releases.id')

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
              if (condition.operator === 'not') {
                subquery = subquery.whereNotIn(condition.column, condition.values!)
              }
              else {
                subquery = subquery.whereIn(condition.column, condition.values!)
              }

              break

            case 'whereNull':
              subquery = subquery.whereNull(condition.column)
              break

            case 'whereNotNull':
              subquery = subquery.whereNotNull(condition.column)
              break

            case 'whereBetween':
              subquery = subquery.whereBetween(condition.column, condition.values!)
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

    return instance
  }

  doesntHave(relation: string): ReleaseModel {
    return ReleaseModel.doesntHave(relation)
  }

  static doesntHave(relation: string): ReleaseModel {
    const instance = new ReleaseModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where(({ not, exists, selectFrom }: any) =>
      not(
        exists(
          selectFrom(relation)
            .select('1')
            .whereRef(`${relation}.release_id`, '=', 'releases.id'),
        ),
      ),
    )

    return instance
  }

  whereDoesntHave(relation: string, callback: (query: SubqueryBuilder) => void): ReleaseModel {
    return ReleaseModel.whereDoesntHave(relation, callback)
  }

  static whereDoesntHave(
    relation: string,
    callback: (query: SubqueryBuilder) => void,
  ): ReleaseModel {
    const instance = new ReleaseModel(null)
    const subqueryBuilder = new SubqueryBuilder()

    callback(subqueryBuilder)
    const conditions = subqueryBuilder.getConditions()

    instance.selectFromQuery = instance.selectFromQuery
      .where(({ exists, selectFrom, not }: any) => {
        let subquery = selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.release_id`, '=', 'releases.id')

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
              if (condition.operator === 'not') {
                subquery = subquery.whereNotIn(condition.column, condition.values!)
              }
              else {
                subquery = subquery.whereIn(condition.column, condition.values!)
              }

              break

            case 'whereNull':
              subquery = subquery.whereNull(condition.column)
              break

            case 'whereNotNull':
              subquery = subquery.whereNotNull(condition.column)
              break

            case 'whereBetween':
              subquery = subquery.whereBetween(condition.column, condition.values!)
              break

            case 'whereExists': {
              const nestedBuilder = new SubqueryBuilder()
              condition.callback!(nestedBuilder)
              break
            }
          }
        })

        return not(exists(subquery))
      })

    return instance
  }

  async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<ReleaseResponse> {
    return ReleaseModel.paginate(options)
  }

  // Method to get all releases
  static async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<ReleaseResponse> {
    const totalRecordsResult = await DB.instance.selectFrom('releases')
      .select(DB.instance.fn.count('id').as('total')) // Use 'id' or another actual column name
      .executeTakeFirst()

    const totalRecords = Number(totalRecordsResult?.total) || 0
    const totalPages = Math.ceil(totalRecords / (options.limit ?? 10))

    const releasesWithExtra = await DB.instance.selectFrom('releases')
      .selectAll()
      .orderBy('id', 'asc') // Assuming 'id' is used for cursor-based pagination
      .limit((options.limit ?? 10) + 1) // Fetch one extra record
      .offset(((options.page ?? 1) - 1) * (options.limit ?? 10)) // Ensure options.page is not undefined
      .execute()

    let nextCursor = null
    if (releasesWithExtra.length > (options.limit ?? 10))
      nextCursor = releasesWithExtra.pop()?.id ?? null

    return {
      data: releasesWithExtra,
      paging: {
        total_records: totalRecords,
        page: options.page || 1,
        total_pages: totalPages,
      },
      next_cursor: nextCursor,
    }
  }

  static async create(newRelease: NewRelease): Promise<ReleaseModel> {
    const instance = new ReleaseModel(null)

    const filteredValues = Object.fromEntries(
      Object.entries(newRelease).filter(([key]) =>
        !instance.guarded.includes(key) && instance.fillable.includes(key),
      ),
    ) as NewRelease

    const result = await DB.instance.insertInto('releases')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await instance.find(Number(result.numInsertedOrUpdatedRows)) as ReleaseModel

    if (model)
      dispatch('release:created', model)

    return model
  }

  static async createMany(newRelease: NewRelease[]): Promise<void> {
    const instance = new ReleaseModel(null)

    const valuesFiltered = newRelease.map((newRelease: NewRelease) => {
      const filteredValues = Object.fromEntries(
        Object.entries(newRelease).filter(([key]) =>
          !instance.guarded.includes(key) && instance.fillable.includes(key),
        ),
      ) as NewRelease

      return filteredValues
    })

    await DB.instance.insertInto('releases')
      .values(valuesFiltered)
      .executeTakeFirst()
  }

  static async forceCreate(newRelease: NewRelease): Promise<ReleaseModel> {
    const result = await DB.instance.insertInto('releases')
      .values(newRelease)
      .executeTakeFirst()

    const model = await find(Number(result.numInsertedOrUpdatedRows)) as ReleaseModel

    return model
  }

  // Method to remove a Release
  static async remove(id: number): Promise<any> {
    return await DB.instance.deleteFrom('releases')
      .where('id', '=', id)
      .execute()
  }

  private static applyWhere(instance: ReleaseModel, column: string, ...args: any[]): ReleaseModel {
    const [operatorOrValue, value] = args
    const operator = value === undefined ? '=' : operatorOrValue
    const actualValue = value === undefined ? operatorOrValue : value

    instance.selectFromQuery = instance.selectFromQuery.where(column, operator, actualValue)
    instance.updateFromQuery = instance.updateFromQuery.where(column, operator, actualValue)
    instance.deleteFromQuery = instance.deleteFromQuery.where(column, operator, actualValue)

    return instance
  }

  where(column: string, ...args: any[]): ReleaseModel {
    return ReleaseModel.applyWhere(this, column, ...args)
  }

  static where(column: string, ...args: any[]): ReleaseModel {
    const instance = new ReleaseModel(null)
    return ReleaseModel.applyWhere(instance, column, ...args)
  }

  whereColumn(first: string, operator: string, second: string): ReleaseModel {
    return ReleaseModel.whereColumn(first, operator, second)
  }

  static whereColumn(first: string, operator: string, second: string): ReleaseModel {
    const instance = new ReleaseModel(null)

    instance.selectFromQuery = instance.selectFromQuery.whereRef(first, operator, second)

    return instance
  }

  whereRef(column: string, ...args: string[]): ReleaseModel {
    return ReleaseModel.whereRef(column, ...args)
  }

  static whereRef(column: string, ...args: string[]): ReleaseModel {
    const [operatorOrValue, value] = args
    const operator = value === undefined ? '=' : operatorOrValue
    const actualValue = value === undefined ? operatorOrValue : value

    const instance = new ReleaseModel(null)
    instance.selectFromQuery = instance.selectFromQuery.whereRef(column, operator, actualValue)
    return instance
  }

  whereRaw(sqlStatement: string): ReleaseModel {
    return ReleaseModel.whereRaw(sqlStatement)
  }

  static whereRaw(sqlStatement: string): ReleaseModel {
    const instance = new ReleaseModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where(sql`${sqlStatement}`)

    return instance
  }

  orWhere(...conditions: (string | [string, any] | [string, string, any])[]): ReleaseModel {
    return ReleaseModel.orWhere(...conditions)
  }

  static orWhere(...conditions: (string | [string, any] | [string, string, any])[]): ReleaseModel {
    const instance = new ReleaseModel(null)

    if (conditions.length === 0) {
      throw new HttpError(500, 'At least one condition must be provided')
    }

    // Process conditions to handle different formats
    const processedConditions = conditions.map((condition) => {
      if (Array.isArray(condition)) {
        if (condition.length === 2) {
          return [condition[0], '=', condition[1]]
        }
        return condition
      }
      throw new Error('Invalid condition format')
    })

    // Use the expression builder to append the OR conditions
    instance.selectFromQuery = instance.selectFromQuery.where((eb: any) =>
      eb.or(
        processedConditions.map(([column, operator, value]) => eb(column, operator, value)),
      ),
    )

    instance.updateFromQuery = instance.updateFromQuery.where((eb: any) =>
      eb.or(
        processedConditions.map(([column, operator, value]) => eb(column, operator, value)),
      ),
    )

    instance.deleteFromQuery = instance.deleteFromQuery.where((eb: any) =>
      eb.or(
        processedConditions.map(([column, operator, value]) => eb(column, operator, value)),
      ),
    )

    return instance
  }

  when(
    condition: boolean,
    callback: (query: ReleaseModel) => ReleaseModel,
  ): ReleaseModel {
    return ReleaseModel.when(condition, callback)
  }

  static when(
    condition: boolean,
    callback: (query: ReleaseModel) => ReleaseModel,
  ): ReleaseModel {
    let instance = new ReleaseModel(null)

    if (condition)
      instance = callback(instance)

    return instance
  }

  whereNull(column: string): ReleaseModel {
    return ReleaseModel.whereNull(column)
  }

  static whereNull(column: string): ReleaseModel {
    const instance = new ReleaseModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    instance.updateFromQuery = instance.updateFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    return instance
  }

  static whereVersion(value: string): ReleaseModel {
    const instance = new ReleaseModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('version', '=', value)

    return instance
  }

  whereIn(column: keyof ReleaseType, values: any[]): ReleaseModel {
    return ReleaseModel.whereIn(column, values)
  }

  static whereIn(column: keyof ReleaseType, values: any[]): ReleaseModel {
    const instance = new ReleaseModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where(column, 'in', values)

    instance.updateFromQuery = instance.updateFromQuery.where(column, 'in', values)

    instance.deleteFromQuery = instance.deleteFromQuery.where(column, 'in', values)

    return instance
  }

  whereBetween(column: keyof ReleaseType, range: [any, any]): ReleaseModel {
    return ReleaseModel.whereBetween(column, range)
  }

  whereLike(column: keyof ReleaseType, value: string): ReleaseModel {
    return ReleaseModel.whereLike(column, value)
  }

  static whereLike(column: keyof ReleaseType, value: string): ReleaseModel {
    const instance = new ReleaseModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where(sql` ${sql.raw(column as string)} LIKE ${value}`)

    instance.updateFromQuery = instance.updateFromQuery.where(sql` ${sql.raw(column as string)} LIKE ${value}`)

    instance.deleteFromQuery = instance.deleteFromQuery.where(sql` ${sql.raw(column as string)} LIKE ${value}`)

    return instance
  }

  static whereBetween(column: keyof ReleaseType, range: [any, any]): ReleaseModel {
    if (range.length !== 2) {
      throw new HttpError(500, 'Range must have exactly two values: [min, max]')
    }

    const instance = new ReleaseModel(null)

    const query = sql` ${sql.raw(column as string)} between ${range[0]} and ${range[1]} `

    instance.selectFromQuery = instance.selectFromQuery.where(query)
    instance.updateFromQuery = instance.updateFromQuery.where(query)
    instance.deleteFromQuery = instance.deleteFromQuery.where(query)

    return instance
  }

  whereNotIn(column: keyof ReleaseType, values: any[]): ReleaseModel {
    return ReleaseModel.whereNotIn(column, values)
  }

  static whereNotIn(column: keyof ReleaseType, values: any[]): ReleaseModel {
    const instance = new ReleaseModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where(column, 'not in', values)

    instance.updateFromQuery = instance.updateFromQuery.where(column, 'not in', values)

    instance.deleteFromQuery = instance.deleteFromQuery.where(column, 'not in', values)

    return instance
  }

  async exists(): Promise<boolean> {
    const model = await this.selectFromQuery.executeTakeFirst()

    return model !== null || model !== undefined
  }

  static async latest(): Promise<ReleaseType | undefined> {
    const model = await DB.instance.selectFrom('releases')
      .selectAll()
      .orderBy('created_at', 'desc')
      .executeTakeFirst()

    if (!model)
      return undefined

    const instance = new ReleaseModel(null)
    const result = await instance.mapWith(model)
    const data = new ReleaseModel(result as ReleaseType)

    return data
  }

  static async oldest(): Promise<ReleaseType | undefined> {
    const model = await DB.instance.selectFrom('releases')
      .selectAll()
      .orderBy('created_at', 'asc')
      .executeTakeFirst()

    if (!model)
      return undefined

    const instance = new ReleaseModel(null)
    const result = await instance.mapWith(model)
    const data = new ReleaseModel(result as ReleaseType)

    return data
  }

  static async firstOrCreate(
    condition: Partial<ReleaseType>,
    newRelease: NewRelease,
  ): Promise<ReleaseModel> {
    // Get the key and value from the condition object
    const key = Object.keys(condition)[0] as keyof ReleaseType

    if (!key) {
      throw new HttpError(500, 'Condition must contain at least one key-value pair')
    }

    const value = condition[key]

    // Attempt to find the first record matching the condition
    const existingRelease = await DB.instance.selectFrom('releases')
      .selectAll()
      .where(key, '=', value)
      .executeTakeFirst()

    if (existingRelease) {
      const instance = new ReleaseModel(null)
      const result = await instance.mapWith(existingRelease)
      return new ReleaseModel(result as ReleaseType)
    }
    else {
      return await this.create(newRelease)
    }
  }

  static async updateOrCreate(
    condition: Partial<ReleaseType>,
    newRelease: NewRelease,
  ): Promise<ReleaseModel> {
    const instance = new ReleaseModel(null)

    const key = Object.keys(condition)[0] as keyof ReleaseType

    if (!key) {
      throw new HttpError(500, 'Condition must contain at least one key-value pair')
    }

    const value = condition[key]

    // Attempt to find the first record matching the condition
    const existingRelease = await DB.instance.selectFrom('releases')
      .selectAll()
      .where(key, '=', value)
      .executeTakeFirst()

    if (existingRelease) {
      // If found, update the existing record
      await DB.instance.updateTable('releases')
        .set(newRelease)
        .where(key, '=', value)
        .executeTakeFirstOrThrow()

      // Fetch and return the updated record
      const updatedRelease = await DB.instance.selectFrom('releases')
        .selectAll()
        .where(key, '=', value)
        .executeTakeFirst()

      if (!updatedRelease) {
        throw new HttpError(500, 'Failed to fetch updated record')
      }

      const result = await instance.mapWith(updatedRelease)

      instance.hasSaved = true

      return new ReleaseModel(result as ReleaseType)
    }
    else {
      // If not found, create a new record
      return await this.create(newRelease)
    }
  }

  with(relations: string[]): ReleaseModel {
    return ReleaseModel.with(relations)
  }

  static with(relations: string[]): ReleaseModel {
    const instance = new ReleaseModel(null)

    instance.withRelations = relations

    return instance
  }

  async last(): Promise<ReleaseType | undefined> {
    return await DB.instance.selectFrom('releases')
      .selectAll()
      .orderBy('id', 'desc')
      .executeTakeFirst()
  }

  static async last(): Promise<ReleaseType | undefined> {
    const model = await DB.instance.selectFrom('releases').selectAll().orderBy('id', 'desc').executeTakeFirst()

    if (!model)
      return undefined

    const instance = new ReleaseModel(null)

    const result = await instance.mapWith(model)

    const data = new ReleaseModel(result as ReleaseType)

    return data
  }

  orderBy(column: keyof ReleaseType, order: 'asc' | 'desc'): ReleaseModel {
    return ReleaseModel.orderBy(column, order)
  }

  static orderBy(column: keyof ReleaseType, order: 'asc' | 'desc'): ReleaseModel {
    const instance = new ReleaseModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, order)

    return instance
  }

  groupBy(column: keyof ReleaseType): ReleaseModel {
    return ReleaseModel.groupBy(column)
  }

  static groupBy(column: keyof ReleaseType): ReleaseModel {
    const instance = new ReleaseModel(null)

    instance.selectFromQuery = instance.selectFromQuery.groupBy(column)

    return instance
  }

  having(column: keyof ReleaseType, operator: string, value: any): ReleaseModel {
    return ReleaseModel.having(column, operator, value)
  }

  static having(column: keyof ReleaseType, operator: string, value: any): ReleaseModel {
    const instance = new ReleaseModel(null)

    instance.selectFromQuery = instance.selectFromQuery.having(column, operator, value)

    return instance
  }

  inRandomOrder(): ReleaseModel {
    return ReleaseModel.inRandomOrder()
  }

  static inRandomOrder(): ReleaseModel {
    const instance = new ReleaseModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(sql` ${sql.raw('RANDOM()')} `)

    return instance
  }

  orderByDesc(column: keyof ReleaseType): ReleaseModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, 'desc')

    return this
  }

  static orderByDesc(column: keyof ReleaseType): ReleaseModel {
    const instance = new ReleaseModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, 'desc')

    return instance
  }

  orderByAsc(column: keyof ReleaseType): ReleaseModel {
    return ReleaseModel.orderByAsc(column)
  }

  static orderByAsc(column: keyof ReleaseType): ReleaseModel {
    const instance = new ReleaseModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, 'asc')

    return instance
  }

  async update(newRelease: ReleaseUpdate): Promise<ReleaseModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newRelease).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewRelease

    await DB.instance.updateTable('releases')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      const model = await this.find(this.id)

      return model
    }

    this.hasSaved = true

    return undefined
  }

  async forceUpdate(release: ReleaseUpdate): Promise<ReleaseModel | undefined> {
    if (this.id === undefined) {
      this.updateFromQuery.set(release).execute()
    }

    await DB.instance.updateTable('releases')
      .set(release)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      const model = await this.find(this.id)

      this.hasSaved = true

      return model
    }

    return undefined
  }

  async save(): Promise<void> {
    if (!this)
      throw new HttpError(500, 'Release data is undefined')

    const filteredValues = Object.fromEntries(
      Object.entries(this).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewRelease

    if (this.id === undefined) {
      await DB.instance.insertInto('releases')
        .values(filteredValues)
        .executeTakeFirstOrThrow()
    }
    else {
      await this.update(this)
    }

    this.hasSaved = true
  }

  fill(data: Partial<ReleaseType>): ReleaseModel {
    const filteredValues = Object.fromEntries(
      Object.entries(data).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewRelease

    this.attributes = {
      ...this.attributes,
      ...filteredValues,
    }

    return this
  }

  forceFill(data: Partial<ReleaseType>): ReleaseModel {
    this.attributes = {
      ...this.attributes,
      ...data,
    }

    return this
  }

  // Method to delete (soft delete) the release instance
  async delete(): Promise<any> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()

    return await DB.instance.deleteFrom('releases')
      .where('id', '=', this.id)
      .execute()
  }

  distinct(column: keyof ReleaseType): ReleaseModel {
    return ReleaseModel.distinct(column)
  }

  static distinct(column: keyof ReleaseType): ReleaseModel {
    const instance = new ReleaseModel(null)

    instance.selectFromQuery = instance.selectFromQuery.select(column).distinct()

    instance.hasSelect = true

    return instance
  }

  join(table: string, firstCol: string, secondCol: string): ReleaseModel {
    return ReleaseModel.join(table, firstCol, secondCol)
  }

  static join(table: string, firstCol: string, secondCol: string): ReleaseModel {
    const instance = new ReleaseModel(null)

    instance.selectFromQuery = instance.selectFromQuery.innerJoin(table, firstCol, secondCol)

    return instance
  }

  static async rawQuery(rawQuery: string): Promise<any> {
    return await sql`${rawQuery}`.execute(DB.instance)
  }

  toJSON(): Partial<ReleaseJsonResponse> {
    const output: Partial<ReleaseJsonResponse> = {

      id: this.id,
      version: this.version,

      created_at: this.created_at,

      updated_at: this.updated_at,

      ...this.customColumns,
    }

    return output
  }

  parseResult(model: ReleaseModel): ReleaseModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof ReleaseModel]
    }

    return model
  }
}

async function find(id: number): Promise<ReleaseModel | undefined> {
  const query = DB.instance.selectFrom('releases').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  return new ReleaseModel(model)
}

export async function count(): Promise<number> {
  const results = await ReleaseModel.count()

  return results
}

export async function create(newRelease: NewRelease): Promise<ReleaseModel> {
  const result = await DB.instance.insertInto('releases')
    .values(newRelease)
    .executeTakeFirstOrThrow()

  return await find(Number(result.numInsertedOrUpdatedRows)) as ReleaseModel
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(DB.instance)
}

export async function remove(id: number): Promise<void> {
  await DB.instance.deleteFrom('releases')
    .where('id', '=', id)
    .execute()
}

export async function whereVersion(value: string): Promise<ReleaseModel[]> {
  const query = DB.instance.selectFrom('releases').where('version', '=', value)
  const results = await query.execute()

  return results.map((modelItem: ReleaseModel) => new ReleaseModel(modelItem))
}

export const Release = ReleaseModel

export default Release
