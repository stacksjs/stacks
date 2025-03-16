import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import { cache } from '@stacksjs/cache'
import { sql } from '@stacksjs/database'
import { HttpError, ModelNotFoundException } from '@stacksjs/error-handling'
import { BaseOrm, DB, SubqueryBuilder } from '@stacksjs/orm'

export interface ReleasesTable {
  id: Generated<number>
  name: string
  version: string

  created_at?: Date

  updated_at?: Date

}

export interface ReleaseResponse {
  data: ReleaseJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface ReleaseJsonResponse extends Omit<Selectable<ReleasesTable>, 'password'> {
  [key: string]: any
}

export type NewRelease = Insertable<ReleasesTable>
export type ReleaseUpdate = Updateable<ReleasesTable>

      type SortDirection = 'asc' | 'desc'
interface SortOptions { column: ReleaseJsonResponse, order: SortDirection }
// Define a type for the options parameter
interface QueryOptions {
  sort?: SortOptions
  limit?: number
  offset?: number
  page?: number
}

export class ReleaseModel extends BaseOrm<ReleaseModel, ReleasesTable> {
  private readonly hidden: Array<keyof ReleaseJsonResponse> = []
  private readonly fillable: Array<keyof ReleaseJsonResponse> = ['version', 'uuid']
  private readonly guarded: Array<keyof ReleaseJsonResponse> = []
  protected attributes = {} as ReleaseJsonResponse
  protected originalAttributes = {} as ReleaseJsonResponse

  protected selectFromQuery: any
  protected updateFromQuery: any
  protected deleteFromQuery: any
  protected hasSelect: boolean
  private hasSaved: boolean
  private customColumns: Record<string, unknown> = {}

  constructor(release: ReleaseJsonResponse | undefined) {
    super('releases')
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

  protected mapCustomGetters(models: ReleaseJsonResponse | ReleaseJsonResponse[]): void {
    const data = models

    if (Array.isArray(data)) {
      data.map((model: ReleaseJsonResponse) => {
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

  async mapCustomSetters(model: NewRelease | ReleaseUpdate): Promise<void> {
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

  get name(): string {
    return this.attributes.name
  }

  get version(): string {
    return this.attributes.version
  }

  get created_at(): Date | undefined {
    return this.attributes.created_at
  }

  get updated_at(): Date | undefined {
    return this.attributes.updated_at
  }

  set name(value: string) {
    this.attributes.name = value
  }

  set version(value: string) {
    this.attributes.version = value
  }

  set updated_at(value: Date) {
    this.attributes.updated_at = value
  }

  getOriginal(column?: keyof ReleaseJsonResponse): Partial<ReleaseJsonResponse> {
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

  isDirty(column?: keyof ReleaseJsonResponse): boolean {
    if (column) {
      return this.attributes[column] !== this.originalAttributes[column]
    }

    return Object.entries(this.originalAttributes).some(([key, originalValue]) => {
      const currentValue = (this.attributes as any)[key]

      return currentValue !== originalValue
    })
  }

  isClean(column?: keyof ReleaseJsonResponse): boolean {
    return !this.isDirty(column)
  }

  wasChanged(column?: keyof ReleaseJsonResponse): boolean {
    return this.hasSaved && this.isDirty(column)
  }

  select(params: (keyof ReleaseJsonResponse)[] | RawBuilder<string> | string): ReleaseModel {
    this.selectFromQuery = this.selectFromQuery.select(params)

    this.hasSelect = true

    return this
  }

  static select(params: (keyof ReleaseJsonResponse)[] | RawBuilder<string> | string): ReleaseModel {
    const instance = new ReleaseModel(undefined)

    // Initialize a query with the table name and selected fields
    instance.selectFromQuery = instance.selectFromQuery.select(params)

    instance.hasSelect = true

    return instance
  }

  // Method to find a Release by ID
  static async find(id: number): Promise<ReleaseModel | undefined> {
    const instance = new ReleaseModel(undefined)

    return await instance.applyFind(id)
  }

  async first(): Promise<ReleaseModel | undefined> {
    const model = await this.applyFirst()

    const data = new ReleaseModel(model)

    return data
  }

  static async first(): Promise<ReleaseModel | undefined> {
    const instance = new ReleaseModel(undefined)

    const model = await instance.applyFirst()

    const data = new ReleaseModel(model)

    return data
  }

  async applyFirstOrFail(): Promise<ReleaseModel | undefined> {
    const model = await this.selectFromQuery.executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, 'No ReleaseModel results found for query')

    if (model) {
      this.mapCustomGetters(model)
      await this.loadRelations(model)
    }

    const data = new ReleaseModel(model)

    return data
  }

  async firstOrFail(): Promise<ReleaseModel | undefined> {
    return await this.applyFirstOrFail()
  }

  static async firstOrFail(): Promise<ReleaseModel | undefined> {
    const instance = new ReleaseModel(undefined)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<ReleaseModel[]> {
    const instance = new ReleaseModel(undefined)

    const models = await DB.instance.selectFrom('releases').selectAll().execute()

    instance.mapCustomGetters(models)

    const data = await Promise.all(models.map(async (model: ReleaseJsonResponse) => {
      return new ReleaseModel(model)
    }))

    return data
  }

  async applyFindOrFail(id: number): Promise<ReleaseModel> {
    const model = await DB.instance.selectFrom('releases').where('id', '=', id).selectAll().executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, `No ReleaseModel results for ${id}`)

    cache.getOrSet(`release:${id}`, JSON.stringify(model))

    this.mapCustomGetters(model)
    await this.loadRelations(model)

    const data = new ReleaseModel(model)

    return data
  }

  async findOrFail(id: number): Promise<ReleaseModel> {
    return await this.applyFindOrFail(id)
  }

  static async findOrFail(id: number): Promise<ReleaseModel> {
    const instance = new ReleaseModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  async applyFindMany(ids: number[]): Promise<ReleaseModel[]> {
    let query = DB.instance.selectFrom('releases').where('id', 'in', ids)

    const instance = new ReleaseModel(undefined)

    query = query.selectAll()

    const models = await query.execute()

    instance.mapCustomGetters(models)
    await instance.loadRelations(models)

    return models.map((modelItem: ReleaseJsonResponse) => instance.parseResult(new ReleaseModel(modelItem)))
  }

  static async findMany(ids: number[]): Promise<ReleaseModel[]> {
    const instance = new ReleaseModel(undefined)

    return await instance.applyFindMany(ids)
  }

  async findMany(ids: number[]): Promise<ReleaseModel[]> {
    return await this.applyFindMany(ids)
  }

  skip(count: number): ReleaseModel {
    this.selectFromQuery = this.selectFromQuery.offset(count)

    return this
  }

  static skip(count: number): ReleaseModel {
    const instance = new ReleaseModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.offset(count)

    return instance
  }

  async applyChunk(size: number, callback: (models: ReleaseModel[]) => Promise<void>): Promise<void> {
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

  async chunk(size: number, callback: (models: ReleaseModel[]) => Promise<void>): Promise<void> {
    await this.applyChunk(size, callback)
  }

  static async chunk(size: number, callback: (models: ReleaseModel[]) => Promise<void>): Promise<void> {
    const instance = new ReleaseModel(undefined)

    await instance.applyChunk(size, callback)
  }

  take(count: number): ReleaseModel {
    this.selectFromQuery = this.selectFromQuery.limit(count)

    return this
  }

  static take(count: number): ReleaseModel {
    const instance = new ReleaseModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.limit(count)

    return instance
  }

  static async pluck<K extends keyof ReleaseModel>(field: K): Promise<ReleaseModel[K][]> {
    const instance = new ReleaseModel(undefined)

    if (instance.hasSelect) {
      const model = await instance.selectFromQuery.execute()
      return model.map((modelItem: ReleaseModel) => modelItem[field])
    }

    const model = await instance.selectFromQuery.selectAll().execute()

    return model.map((modelItem: ReleaseModel) => modelItem[field])
  }

  async pluck<K extends keyof ReleaseModel>(field: K): Promise<ReleaseModel[K][]> {
    if (this.hasSelect) {
      const model = await this.selectFromQuery.execute()
      return model.map((modelItem: ReleaseModel) => modelItem[field])
    }

    const model = await this.selectFromQuery.selectAll().execute()

    return model.map((modelItem: ReleaseModel) => modelItem[field])
  }

  static async count(): Promise<number> {
    const instance = new ReleaseModel(undefined)

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

  static async max(field: keyof ReleaseModel): Promise<number> {
    const instance = new ReleaseModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`MAX(${sql.raw(field as string)}) as max `)
      .executeTakeFirst()

    return result.max
  }

  async max(field: keyof ReleaseModel): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`MAX(${sql.raw(field as string)}) as max`)
      .executeTakeFirst()

    return result.max
  }

  static async min(field: keyof ReleaseModel): Promise<number> {
    const instance = new ReleaseModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`MIN(${sql.raw(field as string)}) as min `)
      .executeTakeFirst()

    return result.min
  }

  async min(field: keyof ReleaseModel): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`MIN(${sql.raw(field as string)}) as min `)
      .executeTakeFirst()

    return result.min
  }

  static async avg(field: keyof ReleaseModel): Promise<number> {
    const instance = new ReleaseModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`AVG(${sql.raw(field as string)}) as avg `)
      .executeTakeFirst()

    return result.avg
  }

  async avg(field: keyof ReleaseModel): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`AVG(${sql.raw(field as string)}) as avg `)
      .executeTakeFirst()

    return result.avg
  }

  static async sum(field: keyof ReleaseModel): Promise<number> {
    const instance = new ReleaseModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`SUM(${sql.raw(field as string)}) as sum `)
      .executeTakeFirst()

    return result.sum
  }

  async sum(field: keyof ReleaseModel): Promise<number> {
    const result = this.selectFromQuery
      .select(sql`SUM(${sql.raw(field as string)}) as sum `)
      .executeTakeFirst()

    return result.sum
  }

  async applyGet(): Promise<ReleaseModel[]> {
    let models

    if (this.hasSelect) {
      models = await this.selectFromQuery.execute()
    }
    else {
      models = await this.selectFromQuery.selectAll().execute()
    }

    this.mapCustomGetters(models)
    await this.loadRelations(models)

    const data = await Promise.all(models.map(async (model: ReleaseJsonResponse) => {
      return new ReleaseModel(model)
    }))

    return data
  }

  async get(): Promise<ReleaseModel[]> {
    return await this.applyGet()
  }

  static async get(): Promise<ReleaseModel[]> {
    const instance = new ReleaseModel(undefined)

    return await instance.applyGet()
  }

  has(relation: string): ReleaseModel {
    this.selectFromQuery = this.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(
        selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.release_id`, '=', 'releases.id'),
      ),
    )

    return this
  }

  static has(relation: string): ReleaseModel {
    const instance = new ReleaseModel(undefined)

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
    const instance = new ReleaseModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(callback({ exists, selectFrom })),
    )

    return instance
  }

  applyWhereHas(
    relation: string,
    callback: (query: SubqueryBuilder<keyof ReleaseModel>) => void,
  ): ReleaseModel {
    const subqueryBuilder = new SubqueryBuilder()

    callback(subqueryBuilder)
    const conditions = subqueryBuilder.getConditions()

    this.selectFromQuery = this.selectFromQuery
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
    callback: (query: SubqueryBuilder<keyof ReleaseModel>) => void,
  ): ReleaseModel {
    return this.applyWhereHas(relation, callback)
  }

  static whereHas(
    relation: string,
    callback: (query: SubqueryBuilder<keyof ReleaseModel>) => void,
  ): ReleaseModel {
    const instance = new ReleaseModel(undefined)

    return instance.applyWhereHas(relation, callback)
  }

  applyDoesntHave(relation: string): ReleaseModel {
    this.selectFromQuery = this.selectFromQuery.where(({ not, exists, selectFrom }: any) =>
      not(
        exists(
          selectFrom(relation)
            .select('1')
            .whereRef(`${relation}.release_id`, '=', 'releases.id'),
        ),
      ),
    )

    return this
  }

  doesntHave(relation: string): ReleaseModel {
    return this.applyDoesntHave(relation)
  }

  static doesntHave(relation: string): ReleaseModel {
    const instance = new ReleaseModel(undefined)

    return instance.applyDoesntHave(relation)
  }

  applyWhereDoesntHave(relation: string, callback: (query: SubqueryBuilder<ReleasesTable>) => void): ReleaseModel {
    const subqueryBuilder = new SubqueryBuilder()

    callback(subqueryBuilder)
    const conditions = subqueryBuilder.getConditions()

    this.selectFromQuery = this.selectFromQuery
      .where(({ exists, selectFrom, not }: any) => {
        const subquery = selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.release_id`, '=', 'releases.id')

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

  whereDoesntHave(relation: string, callback: (query: SubqueryBuilder<ReleasesTable>) => void): ReleaseModel {
    return this.applyWhereDoesntHave(relation, callback)
  }

  static whereDoesntHave(
    relation: string,
    callback: (query: SubqueryBuilder<ReleasesTable>) => void,
  ): ReleaseModel {
    const instance = new ReleaseModel(undefined)

    return instance.applyWhereDoesntHave(relation, callback)
  }

  async applyPaginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<ReleaseResponse> {
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

  async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<ReleaseResponse> {
    return await this.applyPaginate(options)
  }

  // Method to get all releases
  static async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<ReleaseResponse> {
    const instance = new ReleaseModel(undefined)

    return await instance.applyPaginate(options)
  }

  async applyCreate(newRelease: NewRelease): Promise<ReleaseModel> {
    const filteredValues = Object.fromEntries(
      Object.entries(newRelease).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewRelease

    await this.mapCustomSetters(filteredValues)

    const result = await DB.instance.insertInto('releases')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await this.find(Number(result.numInsertedOrUpdatedRows)) as ReleaseModel

    return model
  }

  async create(newRelease: NewRelease): Promise<ReleaseModel> {
    return await this.applyCreate(newRelease)
  }

  static async create(newRelease: NewRelease): Promise<ReleaseModel> {
    const instance = new ReleaseModel(undefined)

    return await instance.applyCreate(newRelease)
  }

  static async createMany(newRelease: NewRelease[]): Promise<void> {
    const instance = new ReleaseModel(undefined)

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

  static where<V = string>(column: keyof ReleasesTable, ...args: [V] | [Operator, V]): ReleaseModel {
    const instance = new ReleaseModel(undefined)

    return instance.applyWhere<V>(column, ...args)
  }

  static whereColumn(first: keyof ReleasesTable, operator: Operator, second: keyof ReleasesTable): ReleaseModel {
    const instance = new ReleaseModel(undefined)

    instance.selectFromQuery = instance.applyWhereColumn(first, operator, second)

    return instance
  }

  static whereRef(column: keyof ReleasesTable, ...args: string[]): ReleaseModel {
    const instance = new ReleaseModel(undefined)

    return instance.applyWhereRef(column, ...args)
  }

  static whereRaw(sqlStatement: string): ReleaseModel {
    const instance = new ReleaseModel(undefined)

    instance.selectFromQuery = instance.applyWhereRaw(sqlStatement)

    return instance
  }

  static orWhere(...conditions: [string, any][]): ReleaseModel {
    const instance = new ReleaseModel(undefined)

    return instance.applyOrWhere(...conditions)
  }

  static when(condition: boolean, callback: (query: ReleaseModel) => ReleaseModel): ReleaseModel {
    const instance = new ReleaseModel(undefined)

    return instance.applyWhen(condition, callback)
  }

  static whereNotNull(column: keyof ReleasesTable): ReleaseModel {
    const instance = new UserModel(undefined)

    return instance.applyWhereNotNull(column)
  }

  static whereNull(column: keyof ReleasesTable): ReleaseModel {
    const instance = new ReleaseModel(undefined)

    return instance.applyWhereNull(column)
  }

  static whereName(value: string): ReleaseModel {
    const instance = new ReleaseModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('name', '=', value)

    return instance
  }

  static whereVersion(value: string): ReleaseModel {
    const instance = new ReleaseModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('version', '=', value)

    return instance
  }

  static whereIn<V = number>(column: keyof ReleasesTable, values: V[]): ReleaseModel {
    const instance = new ReleaseModel(undefined)

    return instance.applyWhereIn<V>(column, values)
  }

  static whereBetween<V = number>(column: keyof ReleasesTable, range: [V, V]): ReleaseModel {
    const instance = new ReleaseModel(undefined)

    return instance.applyWhereBetween<V>(column, range)
  }

  static whereLike(column: keyof ReleasesTable, value: string): ReleaseModel {
    const instance = new ReleaseModel(undefined)

    return instance.applyWhereLike(column, value)
  }

  static whereNotIn<V = number>(column: keyof ReleasesTable, values: V[]): ReleaseModel {
    const instance = new ReleaseModel(undefined)

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

  static async latest(): Promise<ReleaseModel | undefined> {
    const instance = new ReleaseModel(undefined)

    const model = await DB.instance.selectFrom('releases')
      .selectAll()
      .orderBy('id', 'desc')
      .executeTakeFirst()

    if (!model)
      return undefined

    instance.mapCustomGetters(model)

    const data = new ReleaseModel(model)

    return data
  }

  static async oldest(): Promise<ReleaseModel | undefined> {
    const instance = new ReleaseModel(undefined)

    const model = await DB.instance.selectFrom('releases')
      .selectAll()
      .orderBy('id', 'asc')
      .executeTakeFirst()

    if (!model)
      return undefined

    instance.mapCustomGetters(model)

    const data = new ReleaseModel(model)

    return data
  }

  static async firstOrCreate(
    condition: Partial<ReleaseJsonResponse>,
    newRelease: NewRelease,
  ): Promise<ReleaseModel> {
    const instance = new ReleaseModel(undefined)

    const key = Object.keys(condition)[0] as keyof ReleaseJsonResponse

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
      instance.mapCustomGetters(existingRelease)
      await instance.loadRelations(existingRelease)

      return new ReleaseModel(existingRelease as ReleaseJsonResponse)
    }
    else {
      return await instance.create(newRelease)
    }
  }

  static async updateOrCreate(
    condition: Partial<ReleaseJsonResponse>,
    newRelease: NewRelease,
  ): Promise<ReleaseModel> {
    const instance = new ReleaseModel(undefined)

    const key = Object.keys(condition)[0] as keyof ReleaseJsonResponse

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

      instance.hasSaved = true

      return new ReleaseModel(updatedRelease as ReleaseJsonResponse)
    }
    else {
      // If not found, create a new record
      return await instance.create(newRelease)
    }
  }

  protected async loadRelations(models: ReleaseJsonResponse | ReleaseJsonResponse[]): Promise<void> {
    // Handle both single model and array of models
    const modelArray = Array.isArray(models) ? models : [models]
    if (!modelArray.length)
      return

    const modelIds = modelArray.map(model => model.id)

    for (const relation of this.withRelations) {
      const relatedRecords = await DB.instance
        .selectFrom(relation)
        .where('release_id', 'in', modelIds)
        .selectAll()
        .execute()

      if (Array.isArray(models)) {
        models.map((model: ReleaseJsonResponse) => {
          const records = relatedRecords.filter((record: { release_id: number }) => {
            return record.release_id === model.id
          })

          model[relation] = records.length === 1 ? records[0] : records
          return model
        })
      }
      else {
        const records = relatedRecords.filter((record: { release_id: number }) => {
          return record.release_id === models.id
        })

        models[relation] = records.length === 1 ? records[0] : records
      }
    }
  }

  static with(relations: string[]): ReleaseModel {
    const instance = new ReleaseModel(undefined)

    instance.withRelations = relations

    return instance
  }

  async last(): Promise<ReleaseModel | undefined> {
    const model = await this.applyLast()

    const data = new ReleaseModel(model)

    return data
  }

  static async last(): Promise<ReleaseModel | undefined> {
    const instance = new ReleaseModel(undefined)

    const model = await instance.applyLast()

    if (!model)
      return undefined

    const data = new ReleaseModel(model)

    return data
  }

  static orderBy(column: keyof ReleasesTable, order: 'asc' | 'desc'): ReleaseModel {
    const instance = new UserModel(undefined)

    return instance.applyOrderBy(column, order)
  }

  static groupBy(column: keyof ReleasesTable): ReleaseModel {
    const instance = new ReleaseModel(undefined)

    return instance.applyGroupBy(column)
  }

  static having<V = string>(column: keyof ReleasesTable, operator: Operator, value: V): ReleaseModel {
    const instance = new ReleaseModel(undefined)

    return instance.applyHaving(column, operator, value)
  }

  inRandomOrder(): ReleaseModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(sql` ${sql.raw('RANDOM()')} `)

    return this
  }

  static inRandomOrder(): ReleaseModel {
    const instance = new ReleaseModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(sql` ${sql.raw('RANDOM()')} `)

    return instance
  }

  orderByDesc(column: keyof ReleasesTable): ReleaseModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, 'desc')

    return this
  }

  static orderByDesc(column: keyof ReleasesTable): ReleaseModel {
    const instance = new ReleaseModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, 'desc')

    return instance
  }

  orderByAsc(column: keyof ReleasesTable): ReleaseModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, 'asc')

    return this
  }

  static orderByAsc(column: keyof ReleasesTable): ReleaseModel {
    const instance = new ReleaseModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, 'asc')

    return instance
  }

  async update(newRelease: ReleaseUpdate): Promise<ReleaseModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newRelease).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewRelease

    await this.mapCustomSetters(filteredValues)

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

    await this.mapCustomSetters(release)

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

    await this.mapCustomSetters(this.attributes)

    if (this.id === undefined) {
      await this.create(this.attributes)
    }
    else {
      await this.update(this.attributes)
    }

    this.hasSaved = true
  }

  fill(data: Partial<ReleaseJsonResponse>): ReleaseModel {
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

  forceFill(data: Partial<ReleaseJsonResponse>): ReleaseModel {
    this.attributes = {
      ...this.attributes,
      ...data,
    }

    return this
  }

  // Method to delete (soft delete) the release instance
  async delete(): Promise<ReleasesTable> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()

    return await DB.instance.deleteFrom('releases')
      .where('id', '=', this.id)
      .execute()
  }

  distinct(column: keyof ReleaseJsonResponse): ReleaseModel {
    this.selectFromQuery = this.selectFromQuery.select(column).distinct()

    this.hasSelect = true

    return this
  }

  static distinct(column: keyof ReleaseJsonResponse): ReleaseModel {
    const instance = new ReleaseModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.select(column).distinct()

    instance.hasSelect = true

    return instance
  }

  join(table: string, firstCol: string, secondCol: string): ReleaseModel {
    this.selectFromQuery = this.selectFromQuery.innerJoin(table, firstCol, secondCol)

    return this
  }

  static join(table: string, firstCol: string, secondCol: string): ReleaseModel {
    const instance = new ReleaseModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.innerJoin(table, firstCol, secondCol)

    return instance
  }

  toJSON(): ReleaseJsonResponse {
    const output = {

      id: this.id,
      name: this.name,
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

export async function whereName(value: string): Promise<ReleaseModel[]> {
  const query = DB.instance.selectFrom('releases').where('name', '=', value)
  const results: ReleaseJsonResponse = await query.execute()

  return results.map((modelItem: ReleaseJsonResponse) => new ReleaseModel(modelItem))
}

export async function whereVersion(value: string): Promise<ReleaseModel[]> {
  const query = DB.instance.selectFrom('releases').where('version', '=', value)
  const results: ReleaseJsonResponse = await query.execute()

  return results.map((modelItem: ReleaseJsonResponse) => new ReleaseModel(modelItem))
}

export const Release = ReleaseModel

export default Release
