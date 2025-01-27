import type { Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import { cache } from '@stacksjs/cache'
import { db, sql } from '@stacksjs/database'
import { HttpError, ModelNotFoundException } from '@stacksjs/error-handling'

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

  protected selectFromQuery: any
  protected withRelations: string[]
  protected updateFromQuery: any
  protected deleteFromQuery: any
  protected hasSelect: boolean
  private customColumns: Record<string, unknown> = {}
  public id: number | undefined
  public version: string | undefined

  public created_at: Date | undefined
  public updated_at: Date | undefined

  constructor(release: Partial<ReleaseType> | null) {
    if (release) {
      this.id = release?.id || 1
      this.version = release?.version

      this.created_at = release?.created_at

      this.updated_at = release?.updated_at

      Object.keys(release).forEach((key) => {
        if (!(key in this)) {
          this.customColumns[key] = (release as ReleaseJsonResponse)[key]
        }
      })
    }

    this.withRelations = []
    this.selectFromQuery = db.selectFrom('releases')
    this.updateFromQuery = db.updateTable('releases')
    this.deleteFromQuery = db.deleteFrom('releases')
    this.hasSelect = false
  }

  static select(params: (keyof ReleaseType)[] | RawBuilder<string>): ReleaseModel {
    const instance = new ReleaseModel(null)

    // Initialize a query with the table name and selected fields
    instance.selectFromQuery = instance.selectFromQuery.select(params)

    instance.hasSelect = true

    return instance
  }

  // Method to find a Release by ID
  async find(id: number): Promise<ReleaseModel | undefined> {
    const query = db.selectFrom('releases').where('id', '=', id).selectAll()

    const model = await query.executeTakeFirst()

    if (!model)
      return undefined

    const result = await this.mapWith(model)

    const data = new ReleaseModel(result as ReleaseType)

    cache.getOrSet(`release:${id}`, JSON.stringify(model))

    return data
  }

  // Method to find a Release by ID
  static async find(id: number): Promise<ReleaseModel | undefined> {
    const model = await db.selectFrom('releases').where('id', '=', id).selectAll().executeTakeFirst()

    if (!model)
      return undefined

    const instance = new ReleaseModel(null)

    const result = await instance.mapWith(model)

    const data = new ReleaseModel(result as ReleaseType)

    cache.getOrSet(`release:${id}`, JSON.stringify(model))

    return data
  }

  async mapWith(model: ReleaseType): Promise<ReleaseType> {
    return model
  }

  static async all(): Promise<ReleaseModel[]> {
    const models = await db.selectFrom('releases').selectAll().execute()

    const data = await Promise.all(models.map(async (model: ReleaseType) => {
      const instance = new ReleaseModel(model)

      const results = await instance.mapWith(model)

      return new ReleaseModel(results)
    }))

    return data
  }

  static async findOrFail(id: number): Promise<ReleaseModel> {
    const model = await db.selectFrom('releases').where('id', '=', id).selectAll().executeTakeFirst()

    const instance = new ReleaseModel(null)

    if (model === undefined)
      throw new ModelNotFoundException(404, `No ReleaseModel results for ${id}`)

    cache.getOrSet(`release:${id}`, JSON.stringify(model))

    const result = await instance.mapWith(model)

    const data = new ReleaseModel(result as ReleaseType)

    return data
  }

  async findOrFail(id: number): Promise<ReleaseModel> {
    const model = await db.selectFrom('releases').where('id', '=', id).selectAll().executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, `No ReleaseModel results for ${id}`)

    cache.getOrSet(`release:${id}`, JSON.stringify(model))

    const result = await this.mapWith(model)

    const data = new ReleaseModel(result as ReleaseType)

    return data
  }

  static async findMany(ids: number[]): Promise<ReleaseModel[]> {
    let query = db.selectFrom('releases').where('id', 'in', ids)

    const instance = new ReleaseModel(null)

    query = query.selectAll()

    const model = await query.execute()

    return model.map(modelItem => instance.parseResult(new ReleaseModel(modelItem)))
  }

  static skip(count: number): ReleaseModel {
    const instance = new ReleaseModel(null)

    instance.selectFromQuery = instance.selectFromQuery.offset(count)

    return instance
  }

  skip(count: number): ReleaseModel {
    this.selectFromQuery = this.selectFromQuery.offset(count)

    return this
  }

  static take(count: number): ReleaseModel {
    const instance = new ReleaseModel(null)

    instance.selectFromQuery = instance.selectFromQuery.limit(count)

    return instance
  }

  take(count: number): this {
    this.selectFromQuery = this.selectFromQuery.limit(count)

    return this
  }

  async pluck<K extends keyof ReleaseModel>(field: K): Promise<ReleaseModel[K][]> {
    if (this.hasSelect) {
      const model = await this.selectFromQuery.execute()
      return model.map((modelItem: ReleaseModel) => modelItem[field])
    }

    const model = await this.selectFromQuery.selectAll().execute()
    return model.map((modelItem: ReleaseModel) => modelItem[field])
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

  static async get(): Promise<ReleaseModel[]> {
    const instance = new ReleaseModel(null)

    let models

    if (instance.hasSelect) {
      models = await instance.selectFromQuery.execute()
    }
    else {
      models = await instance.selectFromQuery.selectAll().execute()
    }

    const data = await Promise.all(models.map(async (model: ReleaseModel) => {
      const instance = new ReleaseModel(model)

      const results = await instance.mapWith(model)

      return new ReleaseModel(results)
    }))

    return data
  }

  // Method to get a Release by criteria
  async get(): Promise<ReleaseModel[]> {
    if (this.hasSelect) {
      const model = await this.selectFromQuery.execute()

      return model.map((modelItem: ReleaseModel) => new ReleaseModel(modelItem))
    }

    const model = await this.selectFromQuery.selectAll().execute()

    return model.map((modelItem: ReleaseModel) => new ReleaseModel(modelItem))
  }

  static async count(): Promise<number> {
    const instance = new ReleaseModel(null)

    const results = await instance.selectFromQuery.selectAll().execute()

    return results.length
  }

  async count(): Promise<number> {
    if (this.hasSelect) {
      const results = await this.selectFromQuery.execute()

      return results.length
    }

    const results = await this.selectFromQuery.execute()

    return results.length
  }

  async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<ReleaseResponse> {
    const totalRecordsResult = await db.selectFrom('releases')
      .select(db.fn.count('id').as('total')) // Use 'id' or another actual column name
      .executeTakeFirst()

    const totalRecords = Number(totalRecordsResult?.total) || 0
    const totalPages = Math.ceil(totalRecords / (options.limit ?? 10))

    if (this.hasSelect) {
      const releasesWithExtra = await this.selectFromQuery.orderBy('id', 'asc')
        .limit((options.limit ?? 10) + 1)
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

    const releasesWithExtra = await this.selectFromQuery.orderBy('id', 'asc')
      .limit((options.limit ?? 10) + 1)
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

  // Method to get all releases
  static async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<ReleaseResponse> {
    const totalRecordsResult = await db.selectFrom('releases')
      .select(db.fn.count('id').as('total')) // Use 'id' or another actual column name
      .executeTakeFirst()

    const totalRecords = Number(totalRecordsResult?.total) || 0
    const totalPages = Math.ceil(totalRecords / (options.limit ?? 10))

    const releasesWithExtra = await db.selectFrom('releases')
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

  // Method to create a new release
  static async create(newRelease: NewRelease): Promise<ReleaseModel> {
    const instance = new ReleaseModel(null)

    const filteredValues = Object.fromEntries(
      Object.entries(newRelease).filter(([key]) => instance.fillable.includes(key)),
    ) as NewRelease

    const result = await db.insertInto('releases')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await find(Number(result.numInsertedOrUpdatedRows)) as ReleaseModel

    return model
  }

  static async createMany(newReleases: NewRelease[]): Promise<void> {
    const instance = new ReleaseModel(null)

    const filteredValues = newReleases.map(newUser =>
      Object.fromEntries(
        Object.entries(newUser).filter(([key]) => instance.fillable.includes(key)),
      ) as NewRelease,
    )

    await db.insertInto('releases')
      .values(filteredValues)
      .executeTakeFirst()
  }

  static async forceCreate(newRelease: NewRelease): Promise<ReleaseModel> {
    const result = await db.insertInto('releases')
      .values(newRelease)
      .executeTakeFirst()

    const model = await find(Number(result.numInsertedOrUpdatedRows)) as ReleaseModel

    return model
  }

  // Method to remove a Release
  static async remove(id: number): Promise<any> {
    return await db.deleteFrom('releases')
      .where('id', '=', id)
      .execute()
  }

  where(...args: (string | number | boolean | undefined | null)[]): ReleaseModel {
    let column: any
    let operator: any
    let value: any

    if (args.length === 2) {
      [column, value] = args
      operator = '='
    }
    else if (args.length === 3) {
      [column, operator, value] = args
    }
    else {
      throw new HttpError(500, 'Invalid number of arguments')
    }

    this.selectFromQuery = this.selectFromQuery.where(column, operator, value)

    this.updateFromQuery = this.updateFromQuery.where(column, operator, value)
    this.deleteFromQuery = this.deleteFromQuery.where(column, operator, value)

    return this
  }

  orWhere(...args: Array<[string, string, any]>): ReleaseModel {
    if (args.length === 0) {
      throw new HttpError(500, 'At least one condition must be provided')
    }

    // Use the expression builder to append the OR conditions
    this.selectFromQuery = this.selectFromQuery.where((eb: any) =>
      eb.or(
        args.map(([column, operator, value]) => eb(column, operator, value)),
      ),
    )

    this.updateFromQuery = this.updateFromQuery.where((eb: any) =>
      eb.or(
        args.map(([column, operator, value]) => eb(column, operator, value)),
      ),
    )

    this.deleteFromQuery = this.deleteFromQuery.where((eb: any) =>
      eb.or(
        args.map(([column, operator, value]) => eb(column, operator, value)),
      ),
    )

    return this
  }

  static orWhere(...args: Array<[string, string, any]>): ReleaseModel {
    const instance = new ReleaseModel(null)

    if (args.length === 0) {
      throw new HttpError(500, 'At least one condition must be provided')
    }

    // Use the expression builder to append the OR conditions
    instance.selectFromQuery = instance.selectFromQuery.where((eb: any) =>
      eb.or(
        args.map(([column, operator, value]) => eb(column, operator, value)),
      ),
    )

    instance.updateFromQuery = instance.updateFromQuery.where((eb: any) =>
      eb.or(
        args.map(([column, operator, value]) => eb(column, operator, value)),
      ),
    )

    instance.deleteFromQuery = instance.deleteFromQuery.where((eb: any) =>
      eb.or(
        args.map(([column, operator, value]) => eb(column, operator, value)),
      ),
    )

    return instance
  }

  static where(...args: (string | number | boolean | undefined | null)[]): ReleaseModel {
    let column: any
    let operator: any
    let value: any

    const instance = new ReleaseModel(null)

    if (args.length === 2) {
      [column, value] = args
      operator = '='
    }
    else if (args.length === 3) {
      [column, operator, value] = args
    }
    else {
      throw new HttpError(500, 'Invalid number of arguments')
    }

    instance.selectFromQuery = instance.selectFromQuery.where(column, operator, value)

    instance.updateFromQuery = instance.updateFromQuery.where(column, operator, value)

    instance.deleteFromQuery = instance.deleteFromQuery.where(column, operator, value)

    return instance
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

  when(
    condition: boolean,
    callback: (query: ReleaseModel) => ReleaseModel,
  ): ReleaseModel {
    if (condition)
      callback(this.selectFromQuery)

    return this
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

  whereNull(column: string): ReleaseModel {
    this.selectFromQuery = this.selectFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    this.updateFromQuery = this.updateFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    return this
  }

  static whereVersion(value: string): ReleaseModel {
    const instance = new ReleaseModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('version', '=', value)

    return instance
  }

  whereIn(column: keyof ReleaseType, values: any[]): ReleaseModel {
    this.selectFromQuery = this.selectFromQuery.where(column, 'in', values)

    this.updateFromQuery = this.updateFromQuery.where(column, 'in', values)

    this.deleteFromQuery = this.deleteFromQuery.where(column, 'in', values)

    return this
  }

  static whereIn(column: keyof ReleaseType, values: any[]): ReleaseModel {
    const instance = new ReleaseModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where(column, 'in', values)

    instance.updateFromQuery = instance.updateFromQuery.where(column, 'in', values)

    instance.deleteFromQuery = instance.deleteFromQuery.where(column, 'in', values)

    return instance
  }

  static whereBetween(column: keyof ReleaseType, range: [any, any]): ReleaseModel {
    if (range.length !== 2) {
      throw new Error('Range must have exactly two values: [min, max]')
    }

    const instance = new ReleaseModel(null)

    const query = sql` ${sql.raw(column as string)} between ${range[0]} and ${range[1]} `

    instance.selectFromQuery = instance.selectFromQuery.where(query)
    instance.updateFromQuery = instance.updateFromQuery.where(query)
    instance.deleteFromQuery = instance.deleteFromQuery.where(query)

    return instance
  }

  static whereNotIn(column: keyof ReleaseType, values: any[]): ReleaseModel {
    const instance = new ReleaseModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where(column, 'not in', values)

    instance.updateFromQuery = instance.updateFromQuery.where(column, 'not in', values)

    instance.deleteFromQuery = instance.deleteFromQuery.where(column, 'not in', values)

    return instance
  }

  whereNotIn(column: keyof ReleaseType, values: any[]): ReleaseModel {
    this.selectFromQuery = this.selectFromQuery.where(column, 'not in', values)

    this.updateFromQuery = this.updateFromQuery.where(column, 'not in', values)

    this.deleteFromQuery = this.deleteFromQuery.where(column, 'not in', values)

    return this
  }

  async first(): Promise<ReleaseModel | undefined> {
    const model = await this.selectFromQuery.selectAll().executeTakeFirst()

    if (!model)
      return undefined

    const result = await this.mapWith(model)

    const data = new ReleaseModel(result as ReleaseType)

    return data
  }

  async firstOrFail(): Promise<ReleaseModel | undefined> {
    const model = await this.selectFromQuery.executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, 'No ReleaseModel results found for query')

    const instance = new ReleaseModel(null)

    const result = await instance.mapWith(model)

    const data = new ReleaseModel(result as ReleaseType)

    return data
  }

  async exists(): Promise<boolean> {
    const model = await this.selectFromQuery.executeTakeFirst()

    return model !== null || model !== undefined
  }

  static async first(): Promise<ReleaseType | undefined> {
    const model = await db.selectFrom('releases')
      .selectAll()
      .executeTakeFirst()

    if (!model)
      return undefined

    const instance = new ReleaseModel(null)

    const result = await instance.mapWith(model)

    const data = new ReleaseModel(result as ReleaseType)

    return data
  }

  static async latest(): Promise<ReleaseType | undefined> {
    const model = await db.selectFrom('releases')
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
    const model = await db.selectFrom('releases')
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
      throw new Error('Condition must contain at least one key-value pair')
    }

    const value = condition[key]

    // Attempt to find the first record matching the condition
    const existingRelease = await db.selectFrom('releases')
      .selectAll()
      .where(key, '=', value)
      .executeTakeFirst()

    if (existingRelease) {
      const instance = new ReleaseModel(null)
      const result = await instance.mapWith(existingRelease)
      return new ReleaseModel(result as ReleaseType)
    }
    else {
      // If not found, create a new user
      return await this.create(newRelease)
    }
  }

  static async updateOrCreate(
    condition: Partial<ReleaseType>,
    newRelease: NewRelease,
  ): Promise<ReleaseModel> {
    const key = Object.keys(condition)[0] as keyof ReleaseType

    if (!key) {
      throw new Error('Condition must contain at least one key-value pair')
    }

    const value = condition[key]

    // Attempt to find the first record matching the condition
    const existingRelease = await db.selectFrom('releases')
      .selectAll()
      .where(key, '=', value)
      .executeTakeFirst()

    if (existingRelease) {
      // If found, update the existing record
      await db.updateTable('releases')
        .set(newRelease)
        .where(key, '=', value)
        .executeTakeFirstOrThrow()

      // Fetch and return the updated record
      const updatedRelease = await db.selectFrom('releases')
        .selectAll()
        .where(key, '=', value)
        .executeTakeFirst()

      if (!updatedRelease) {
        throw new Error('Failed to fetch updated record')
      }

      const instance = new ReleaseModel(null)
      const result = await instance.mapWith(updatedRelease)
      return new ReleaseModel(result as ReleaseType)
    }
    else {
      // If not found, create a new record
      return await this.create(newRelease)
    }
  }

  with(relations: string[]): ReleaseModel {
    this.withRelations = relations

    return this
  }

  static with(relations: string[]): ReleaseModel {
    const instance = new ReleaseModel(null)

    instance.withRelations = relations

    return instance
  }

  async last(): Promise<ReleaseType | undefined> {
    return await db.selectFrom('releases')
      .selectAll()
      .orderBy('id', 'desc')
      .executeTakeFirst()
  }

  static async last(): Promise<ReleaseType | undefined> {
    const model = await db.selectFrom('releases').selectAll().orderBy('id', 'desc').executeTakeFirst()

    if (!model)
      return undefined

    const instance = new ReleaseModel(null)

    const result = await instance.mapWith(model)

    const data = new ReleaseModel(result as ReleaseType)

    return data
  }

  static orderBy(column: keyof ReleaseType, order: 'asc' | 'desc'): ReleaseModel {
    const instance = new ReleaseModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, order)

    return instance
  }

  static groupBy(column: keyof ReleaseType): ReleaseModel {
    const instance = new ReleaseModel(null)

    instance.selectFromQuery = instance.selectFromQuery.groupBy(column)

    return instance
  }

  static having(column: keyof ReleaseType, operator: string, value: any): ReleaseModel {
    const instance = new ReleaseModel(null)

    instance.selectFromQuery = instance.selectFromQuery.having(column, operator, value)

    return instance
  }

  orderBy(column: keyof ReleaseType, order: 'asc' | 'desc'): ReleaseModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, order)

    return this
  }

  static inRandomOrder(): ReleaseModel {
    const instance = new ReleaseModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(sql` ${sql.raw('RANDOM()')} `)

    return instance
  }

  inRandomOrder(): ReleaseModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(sql` ${sql.raw('RANDOM()')} `)

    return this
  }

  having(column: keyof ReleaseType, operator: string, value: any): ReleaseModel {
    this.selectFromQuery = this.selectFromQuery.having(column, operator, value)

    return this
  }

  groupBy(column: keyof ReleaseType): ReleaseModel {
    this.selectFromQuery = this.selectFromQuery.groupBy(column)

    return this
  }

  static orderByDesc(column: keyof ReleaseType): ReleaseModel {
    const instance = new ReleaseModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, 'desc')

    return instance
  }

  orderByDesc(column: keyof ReleaseType): ReleaseModel {
    this.selectFromQuery = this.orderBy(column, 'desc')

    return this
  }

  static orderByAsc(column: keyof ReleaseType): ReleaseModel {
    const instance = new ReleaseModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, 'asc')

    return instance
  }

  orderByAsc(column: keyof ReleaseType): ReleaseModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, 'desc')

    return this
  }

  async update(release: ReleaseUpdate): Promise<ReleaseModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(release).filter(([key]) => this.fillable.includes(key)),
    ) as NewRelease

    await db.updateTable('releases')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      const model = await this.find(this.id)

      return model
    }

    return undefined
  }

  async forceUpdate(release: ReleaseUpdate): Promise<ReleaseModel | undefined> {
    if (this.id === undefined) {
      this.updateFromQuery.set(release).execute()
    }

    await db.updateTable('releases')
      .set(release)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      const model = await this.find(this.id)

      return model
    }

    return undefined
  }

  async save(): Promise<void> {
    if (!this)
      throw new HttpError(500, 'Release data is undefined')

    if (this.id === undefined) {
      await db.insertInto('releases')
        .values(this as NewRelease)
        .executeTakeFirstOrThrow()
    }
    else {
      await this.update(this)
    }
  }

  // Method to delete (soft delete) the release instance
  async delete(): Promise<any> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()

    return await db.deleteFrom('releases')
      .where('id', '=', this.id)
      .execute()
  }

  distinct(column: keyof ReleaseType): ReleaseModel {
    this.selectFromQuery = this.selectFromQuery.select(column).distinct()

    this.hasSelect = true

    return this
  }

  static distinct(column: keyof ReleaseType): ReleaseModel {
    const instance = new ReleaseModel(null)

    instance.selectFromQuery = instance.selectFromQuery.select(column).distinct()

    instance.hasSelect = true

    return instance
  }

  join(table: string, firstCol: string, secondCol: string): ReleaseModel {
    this.selectFromQuery = this.selectFromQuery.innerJoin(table, firstCol, secondCol)

    return this
  }

  static join(table: string, firstCol: string, secondCol: string): ReleaseModel {
    const instance = new ReleaseModel(null)

    instance.selectFromQuery = instance.selectFromQuery.innerJoin(table, firstCol, secondCol)

    return instance
  }

  static async rawQuery(rawQuery: string): Promise<any> {
    return await sql`${rawQuery}`.execute(db)
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
  const query = db.selectFrom('releases').where('id', '=', id).selectAll()

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
  const result = await db.insertInto('releases')
    .values(newRelease)
    .executeTakeFirstOrThrow()

  return await find(Number(result.numInsertedOrUpdatedRows)) as ReleaseModel
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(db)
}

export async function remove(id: number): Promise<void> {
  await db.deleteFrom('releases')
    .where('id', '=', id)
    .execute()
}

export async function whereVersion(value: string): Promise<ReleaseModel[]> {
  const query = db.selectFrom('releases').where('version', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new ReleaseModel(modelItem))
}

export const Release = ReleaseModel

export default Release
