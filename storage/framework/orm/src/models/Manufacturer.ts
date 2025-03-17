import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { ProductModel } from './Product'
import { randomUUIDv7 } from 'bun'
import { cache } from '@stacksjs/cache'
import { sql } from '@stacksjs/database'
import { ModelNotFoundException } from '@stacksjs/error-handling'
import { dispatch } from '@stacksjs/events'
import { BaseOrm, DB, SubqueryBuilder } from '@stacksjs/orm'

export interface ManufacturersTable {
  id: Generated<number>
  manufacturer: string
  description?: string
  country: string
  featured?: boolean
  uuid?: string

  created_at?: Date

  updated_at?: Date

}

export interface ManufacturerResponse {
  data: ManufacturerJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface ManufacturerJsonResponse extends Omit<Selectable<ManufacturersTable>, 'password'> {
  [key: string]: any
}

export type NewManufacturer = Insertable<ManufacturersTable>
export type ManufacturerUpdate = Updateable<ManufacturersTable>

      type SortDirection = 'asc' | 'desc'
interface SortOptions { column: ManufacturerJsonResponse, order: SortDirection }
// Define a type for the options parameter
interface QueryOptions {
  sort?: SortOptions
  limit?: number
  offset?: number
  page?: number
}

export class ManufacturerModel extends BaseOrm<ManufacturerModel, ManufacturersTable, ManufacturerJsonResponse> {
  private readonly hidden: Array<keyof ManufacturerJsonResponse> = []
  private readonly fillable: Array<keyof ManufacturerJsonResponse> = ['manufacturer', 'description', 'country', 'featured', 'uuid']
  private readonly guarded: Array<keyof ManufacturerJsonResponse> = []
  protected attributes = {} as ManufacturerJsonResponse
  protected originalAttributes = {} as ManufacturerJsonResponse

  protected selectFromQuery: any
  protected updateFromQuery: any
  protected deleteFromQuery: any
  protected hasSelect: boolean
  private hasSaved: boolean
  private customColumns: Record<string, unknown> = {}

  constructor(manufacturer: ManufacturerJsonResponse | undefined) {
    super('manufacturers')
    if (manufacturer) {
      this.attributes = { ...manufacturer }
      this.originalAttributes = { ...manufacturer }

      Object.keys(manufacturer).forEach((key) => {
        if (!(key in this)) {
          this.customColumns[key] = (manufacturer as ManufacturerJsonResponse)[key]
        }
      })
    }

    this.withRelations = []
    this.selectFromQuery = DB.instance.selectFrom('manufacturers')
    this.updateFromQuery = DB.instance.updateTable('manufacturers')
    this.deleteFromQuery = DB.instance.deleteFrom('manufacturers')
    this.hasSelect = false
    this.hasSaved = false
  }

  protected async loadRelations(models: ManufacturerJsonResponse | ManufacturerJsonResponse[]): Promise<void> {
    // Handle both single model and array of models
    const modelArray = Array.isArray(models) ? models : [models]
    if (!modelArray.length)
      return

    const modelIds = modelArray.map(model => model.id)

    for (const relation of this.withRelations) {
      const relatedRecords = await DB.instance
        .selectFrom(relation)
        .where('manufacturer_id', 'in', modelIds)
        .selectAll()
        .execute()

      if (Array.isArray(models)) {
        models.map((model: ManufacturerJsonResponse) => {
          const records = relatedRecords.filter((record: { manufacturer_id: number }) => {
            return record.manufacturer_id === model.id
          })

          model[relation] = records.length === 1 ? records[0] : records
          return model
        })
      }
      else {
        const records = relatedRecords.filter((record: { manufacturer_id: number }) => {
          return record.manufacturer_id === models.id
        })

        models[relation] = records.length === 1 ? records[0] : records
      }
    }
  }

  static with(relations: string[]): ManufacturerModel {
    const instance = new ManufacturerModel(undefined)

    return instance.applyWith(relations)
  }

  protected mapCustomGetters(models: ManufacturerJsonResponse | ManufacturerJsonResponse[]): void {
    const data = models

    if (Array.isArray(data)) {
      data.map((model: ManufacturerJsonResponse) => {
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

  async mapCustomSetters(model: NewManufacturer | ManufacturerUpdate): Promise<void> {
    const customSetter = {
      default: () => {
      },

    }

    for (const [key, fn] of Object.entries(customSetter)) {
      model[key] = await fn()
    }
  }

  get products(): ProductModel[] | [] {
    return this.attributes.products
  }

  get id(): number {
    return this.attributes.id
  }

  get uuid(): string | undefined {
    return this.attributes.uuid
  }

  get manufacturer(): string {
    return this.attributes.manufacturer
  }

  get description(): string | undefined {
    return this.attributes.description
  }

  get country(): string {
    return this.attributes.country
  }

  get featured(): boolean | undefined {
    return this.attributes.featured
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

  set manufacturer(value: string) {
    this.attributes.manufacturer = value
  }

  set description(value: string) {
    this.attributes.description = value
  }

  set country(value: string) {
    this.attributes.country = value
  }

  set featured(value: boolean) {
    this.attributes.featured = value
  }

  set updated_at(value: Date) {
    this.attributes.updated_at = value
  }

  getOriginal(column?: keyof ManufacturerJsonResponse): Partial<ManufacturerJsonResponse> {
    if (column) {
      return this.originalAttributes[column]
    }

    return this.originalAttributes
  }

  getChanges(): Partial<ManufacturerJsonResponse> {
    return this.fillable.reduce<Partial<ManufacturerJsonResponse>>((changes, key) => {
      const currentValue = this.attributes[key as keyof ManufacturersTable]
      const originalValue = this.originalAttributes[key as keyof ManufacturersTable]

      if (currentValue !== originalValue) {
        changes[key] = currentValue
      }

      return changes
    }, {})
  }

  isDirty(column?: keyof ManufacturerJsonResponse): boolean {
    if (column) {
      return this.attributes[column] !== this.originalAttributes[column]
    }

    return Object.entries(this.originalAttributes).some(([key, originalValue]) => {
      const currentValue = (this.attributes as any)[key]

      return currentValue !== originalValue
    })
  }

  isClean(column?: keyof ManufacturerJsonResponse): boolean {
    return !this.isDirty(column)
  }

  wasChanged(column?: keyof ManufacturerJsonResponse): boolean {
    return this.hasSaved && this.isDirty(column)
  }

  static select(params: (keyof ManufacturerJsonResponse)[] | RawBuilder<string> | string): ManufacturerModel {
    const instance = new ManufacturerModel(undefined)

    return instance.applySelect(params)
  }

  // Method to find a Manufacturer by ID
  static async find(id: number): Promise<ManufacturerModel | undefined> {
    const instance = new ManufacturerModel(undefined)

    return await instance.applyFind(id)
  }

  async first(): Promise<ManufacturerModel | undefined> {
    const model = await this.applyFirst()

    const data = new ManufacturerModel(model)

    return data
  }

  static async first(): Promise<ManufacturerModel | undefined> {
    const instance = new ManufacturerModel(undefined)

    const model = await instance.applyFirst()

    const data = new ManufacturerModel(model)

    return data
  }

  async applyFirstOrFail(): Promise<ManufacturerModel | undefined> {
    const model = await this.selectFromQuery.executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, 'No ManufacturerModel results found for query')

    if (model) {
      this.mapCustomGetters(model)
      await this.loadRelations(model)
    }

    const data = new ManufacturerModel(model)

    return data
  }

  static async firstOrFail(): Promise<ManufacturerModel | undefined> {
    const instance = new ManufacturerModel(undefined)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<ManufacturerModel[]> {
    const instance = new ManufacturerModel(undefined)

    const models = await DB.instance.selectFrom('manufacturers').selectAll().execute()

    instance.mapCustomGetters(models)

    const data = await Promise.all(models.map(async (model: ManufacturerJsonResponse) => {
      return new ManufacturerModel(model)
    }))

    return data
  }

  async applyFindOrFail(id: number): Promise<ManufacturerModel> {
    const model = await DB.instance.selectFrom('manufacturers').where('id', '=', id).selectAll().executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, `No ManufacturerModel results for ${id}`)

    cache.getOrSet(`manufacturer:${id}`, JSON.stringify(model))

    this.mapCustomGetters(model)
    await this.loadRelations(model)

    const data = new ManufacturerModel(model)

    return data
  }

  async findOrFail(id: number): Promise<ManufacturerModel> {
    return await this.applyFindOrFail(id)
  }

  static async findOrFail(id: number): Promise<ManufacturerModel> {
    const instance = new ManufacturerModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  static async findMany(ids: number[]): Promise<ManufacturerModel[]> {
    const instance = new ManufacturerModel(undefined)

    const models = await instance.applyFindMany(ids)

    return models.map((modelItem: UserJsonResponse) => instance.parseResult(new ManufacturerModel(modelItem)))
  }

  async findMany(ids: number[]): Promise<ManufacturerModel[]> {
    const models = await this.applyFindMany(ids)

    return models.map((modelItem: UserJsonResponse) => this.parseResult(new ManufacturerModel(modelItem)))
  }

  static skip(count: number): ManufacturerModel {
    const instance = new ManufacturerModel(undefined)

    return instance.applySkip(count)
  }

  async applyChunk(size: number, callback: (models: ManufacturerModel[]) => Promise<void>): Promise<void> {
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

  async chunk(size: number, callback: (models: ManufacturerModel[]) => Promise<void>): Promise<void> {
    await this.applyChunk(size, callback)
  }

  static async chunk(size: number, callback: (models: ManufacturerModel[]) => Promise<void>): Promise<void> {
    const instance = new ManufacturerModel(undefined)

    await instance.applyChunk(size, callback)
  }

  static take(count: number): ManufacturerModel {
    const instance = new ManufacturerModel(undefined)

    return instance.applyTake(count)
  }

  static async pluck<K extends keyof ManufacturerModel>(field: K): Promise<ManufacturerModel[K][]> {
    const instance = new ManufacturerModel(undefined)

    if (instance.hasSelect) {
      const model = await instance.selectFromQuery.execute()
      return model.map((modelItem: ManufacturerModel) => modelItem[field])
    }

    const model = await instance.selectFromQuery.selectAll().execute()

    return model.map((modelItem: ManufacturerModel) => modelItem[field])
  }

  async pluck<K extends keyof ManufacturerModel>(field: K): Promise<ManufacturerModel[K][]> {
    if (this.hasSelect) {
      const model = await this.selectFromQuery.execute()
      return model.map((modelItem: ManufacturerModel) => modelItem[field])
    }

    const model = await this.selectFromQuery.selectAll().execute()

    return model.map((modelItem: ManufacturerModel) => modelItem[field])
  }

  static async count(): Promise<number> {
    const instance = new ManufacturerModel(undefined)

    return instance.applyCount()
  }

  static async max(field: keyof ManufacturerModel): Promise<number> {
    const instance = new ManufacturerModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`MAX(${sql.raw(field as string)}) as max `)
      .executeTakeFirst()

    return result.max
  }

  async max(field: keyof ManufacturerModel): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`MAX(${sql.raw(field as string)}) as max`)
      .executeTakeFirst()

    return result.max
  }

  static async min(field: keyof ManufacturerModel): Promise<number> {
    const instance = new ManufacturerModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`MIN(${sql.raw(field as string)}) as min `)
      .executeTakeFirst()

    return result.min
  }

  async min(field: keyof ManufacturerModel): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`MIN(${sql.raw(field as string)}) as min `)
      .executeTakeFirst()

    return result.min
  }

  static async avg(field: keyof ManufacturerModel): Promise<number> {
    const instance = new ManufacturerModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`AVG(${sql.raw(field as string)}) as avg `)
      .executeTakeFirst()

    return result.avg
  }

  async avg(field: keyof ManufacturerModel): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`AVG(${sql.raw(field as string)}) as avg `)
      .executeTakeFirst()

    return result.avg
  }

  static async sum(field: keyof ManufacturerModel): Promise<number> {
    const instance = new ManufacturerModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`SUM(${sql.raw(field as string)}) as sum `)
      .executeTakeFirst()

    return result.sum
  }

  async sum(field: keyof ManufacturerModel): Promise<number> {
    const result = this.selectFromQuery
      .select(sql`SUM(${sql.raw(field as string)}) as sum `)
      .executeTakeFirst()

    return result.sum
  }

  async applyGet(): Promise<ManufacturerModel[]> {
    let models

    if (this.hasSelect) {
      models = await this.selectFromQuery.execute()
    }
    else {
      models = await this.selectFromQuery.selectAll().execute()
    }

    this.mapCustomGetters(models)
    await this.loadRelations(models)

    const data = await Promise.all(models.map(async (model: ManufacturerJsonResponse) => {
      return new ManufacturerModel(model)
    }))

    return data
  }

  async get(): Promise<ManufacturerModel[]> {
    return await this.applyGet()
  }

  static async get(): Promise<ManufacturerModel[]> {
    const instance = new ManufacturerModel(undefined)

    return await instance.applyGet()
  }

  has(relation: string): ManufacturerModel {
    this.selectFromQuery = this.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(
        selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.manufacturer_id`, '=', 'manufacturers.id'),
      ),
    )

    return this
  }

  static has(relation: string): ManufacturerModel {
    const instance = new ManufacturerModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(
        selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.manufacturer_id`, '=', 'manufacturers.id'),
      ),
    )

    return instance
  }

  static whereExists(callback: (qb: any) => any): ManufacturerModel {
    const instance = new ManufacturerModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(callback({ exists, selectFrom })),
    )

    return instance
  }

  applyWhereHas(
    relation: string,
    callback: (query: SubqueryBuilder<keyof ManufacturerModel>) => void,
  ): ManufacturerModel {
    const subqueryBuilder = new SubqueryBuilder()

    callback(subqueryBuilder)
    const conditions = subqueryBuilder.getConditions()

    this.selectFromQuery = this.selectFromQuery
      .where(({ exists, selectFrom }: any) => {
        let subquery = selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.manufacturer_id`, '=', 'manufacturers.id')

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
    callback: (query: SubqueryBuilder<keyof ManufacturerModel>) => void,
  ): ManufacturerModel {
    return this.applyWhereHas(relation, callback)
  }

  static whereHas(
    relation: string,
    callback: (query: SubqueryBuilder<keyof ManufacturerModel>) => void,
  ): ManufacturerModel {
    const instance = new ManufacturerModel(undefined)

    return instance.applyWhereHas(relation, callback)
  }

  applyDoesntHave(relation: string): ManufacturerModel {
    this.selectFromQuery = this.selectFromQuery.where(({ not, exists, selectFrom }: any) =>
      not(
        exists(
          selectFrom(relation)
            .select('1')
            .whereRef(`${relation}.manufacturer_id`, '=', 'manufacturers.id'),
        ),
      ),
    )

    return this
  }

  doesntHave(relation: string): ManufacturerModel {
    return this.applyDoesntHave(relation)
  }

  static doesntHave(relation: string): ManufacturerModel {
    const instance = new ManufacturerModel(undefined)

    return instance.applyDoesntHave(relation)
  }

  applyWhereDoesntHave(relation: string, callback: (query: SubqueryBuilder<ManufacturersTable>) => void): ManufacturerModel {
    const subqueryBuilder = new SubqueryBuilder()

    callback(subqueryBuilder)
    const conditions = subqueryBuilder.getConditions()

    this.selectFromQuery = this.selectFromQuery
      .where(({ exists, selectFrom, not }: any) => {
        const subquery = selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.manufacturer_id`, '=', 'manufacturers.id')

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

  whereDoesntHave(relation: string, callback: (query: SubqueryBuilder<ManufacturersTable>) => void): ManufacturerModel {
    return this.applyWhereDoesntHave(relation, callback)
  }

  static whereDoesntHave(
    relation: string,
    callback: (query: SubqueryBuilder<ManufacturersTable>) => void,
  ): ManufacturerModel {
    const instance = new ManufacturerModel(undefined)

    return instance.applyWhereDoesntHave(relation, callback)
  }

  async applyPaginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<ManufacturerResponse> {
    const totalRecordsResult = await DB.instance.selectFrom('manufacturers')
      .select(DB.instance.fn.count('id').as('total')) // Use 'id' or another actual column name
      .executeTakeFirst()

    const totalRecords = Number(totalRecordsResult?.total) || 0
    const totalPages = Math.ceil(totalRecords / (options.limit ?? 10))

    const manufacturersWithExtra = await DB.instance.selectFrom('manufacturers')
      .selectAll()
      .orderBy('id', 'asc') // Assuming 'id' is used for cursor-based pagination
      .limit((options.limit ?? 10) + 1) // Fetch one extra record
      .offset(((options.page ?? 1) - 1) * (options.limit ?? 10)) // Ensure options.page is not undefined
      .execute()

    let nextCursor = null
    if (manufacturersWithExtra.length > (options.limit ?? 10))
      nextCursor = manufacturersWithExtra.pop()?.id ?? null

    return {
      data: manufacturersWithExtra,
      paging: {
        total_records: totalRecords,
        page: options.page || 1,
        total_pages: totalPages,
      },
      next_cursor: nextCursor,
    }
  }

  async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<ManufacturerResponse> {
    return await this.applyPaginate(options)
  }

  // Method to get all manufacturers
  static async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<ManufacturerResponse> {
    const instance = new ManufacturerModel(undefined)

    return await instance.applyPaginate(options)
  }

  async applyCreate(newManufacturer: NewManufacturer): Promise<ManufacturerModel> {
    const filteredValues = Object.fromEntries(
      Object.entries(newManufacturer).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewManufacturer

    await this.mapCustomSetters(filteredValues)

    filteredValues.uuid = randomUUIDv7()

    const result = await DB.instance.insertInto('manufacturers')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await this.find(Number(result.numInsertedOrUpdatedRows)) as ManufacturerModel

    if (model)
      dispatch('manufacturer:created', model)

    return model
  }

  async create(newManufacturer: NewManufacturer): Promise<ManufacturerModel> {
    return await this.applyCreate(newManufacturer)
  }

  static async create(newManufacturer: NewManufacturer): Promise<ManufacturerModel> {
    const instance = new ManufacturerModel(undefined)

    return await instance.applyCreate(newManufacturer)
  }

  static async createMany(newManufacturer: NewManufacturer[]): Promise<void> {
    const instance = new ManufacturerModel(undefined)

    const valuesFiltered = newManufacturer.map((newManufacturer: NewManufacturer) => {
      const filteredValues = Object.fromEntries(
        Object.entries(newManufacturer).filter(([key]) =>
          !instance.guarded.includes(key) && instance.fillable.includes(key),
        ),
      ) as NewManufacturer

      filteredValues.uuid = randomUUIDv7()

      return filteredValues
    })

    await DB.instance.insertInto('manufacturers')
      .values(valuesFiltered)
      .executeTakeFirst()
  }

  static async forceCreate(newManufacturer: NewManufacturer): Promise<ManufacturerModel> {
    const result = await DB.instance.insertInto('manufacturers')
      .values(newManufacturer)
      .executeTakeFirst()

    const model = await find(Number(result.numInsertedOrUpdatedRows)) as ManufacturerModel

    if (model)
      dispatch('manufacturer:created', model)

    return model
  }

  // Method to remove a Manufacturer
  async delete(): Promise<ManufacturersTable> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()
    const model = await this.find(Number(this.id))
    if (model)
      dispatch('manufacturer:deleted', model)

    return await DB.instance.deleteFrom('manufacturers')
      .where('id', '=', this.id)
      .execute()
  }

  static whereManufacturer(value: string): ManufacturerModel {
    const instance = new ManufacturerModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('manufacturer', '=', value)

    return instance
  }

  static whereDescription(value: string): ManufacturerModel {
    const instance = new ManufacturerModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('description', '=', value)

    return instance
  }

  static whereCountry(value: string): ManufacturerModel {
    const instance = new ManufacturerModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('country', '=', value)

    return instance
  }

  static whereFeatured(value: string): ManufacturerModel {
    const instance = new ManufacturerModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('featured', '=', value)

    return instance
  }

  toSearchableObject(): Partial<ManufacturerJsonResponse> {
    return {
      id: this.id,
      manufacturer: this.manufacturer,
      description: this.description,
      country: this.country,
      featured: this.featured,
    }
  }

  distinct(column: keyof ManufacturerJsonResponse): ManufacturerModel {
    return this.applyDistinct(column)
  }

  static distinct(column: keyof ManufacturerJsonResponse): ManufacturerModel {
    const instance = new ManufacturerModel(undefined)

    return instance.applyDistinct(column)
  }

  join(table: string, firstCol: string, secondCol: string): ManufacturerModel {
    return this.applyJoin(table, firstCol, secondCol)
  }

  static join(table: string, firstCol: string, secondCol: string): ManufacturerModel {
    const instance = new ManufacturerModel(undefined)

    return instance.applyJoin(table, firstCol, secondCol)
  }

  toJSON(): ManufacturerJsonResponse {
    const output = {

      uuid: this.uuid,

      id: this.id,
      manufacturer: this.manufacturer,
      description: this.description,
      country: this.country,
      featured: this.featured,

      created_at: this.created_at,

      updated_at: this.updated_at,

      products: this.products,
      ...this.customColumns,
    }

    return output
  }

  parseResult(model: ManufacturerModel): ManufacturerModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof ManufacturerModel]
    }

    return model
  }
}

async function find(id: number): Promise<ManufacturerModel | undefined> {
  const query = DB.instance.selectFrom('manufacturers').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  return new ManufacturerModel(model)
}

export async function count(): Promise<number> {
  const results = await ManufacturerModel.count()

  return results
}

export async function create(newManufacturer: NewManufacturer): Promise<ManufacturerModel> {
  const result = await DB.instance.insertInto('manufacturers')
    .values(newManufacturer)
    .executeTakeFirstOrThrow()

  return await find(Number(result.numInsertedOrUpdatedRows)) as ManufacturerModel
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(DB.instance)
}

export async function remove(id: number): Promise<void> {
  await DB.instance.deleteFrom('manufacturers')
    .where('id', '=', id)
    .execute()
}

export async function whereManufacturer(value: string): Promise<ManufacturerModel[]> {
  const query = DB.instance.selectFrom('manufacturers').where('manufacturer', '=', value)
  const results: ManufacturerJsonResponse = await query.execute()

  return results.map((modelItem: ManufacturerJsonResponse) => new ManufacturerModel(modelItem))
}

export async function whereDescription(value: string): Promise<ManufacturerModel[]> {
  const query = DB.instance.selectFrom('manufacturers').where('description', '=', value)
  const results: ManufacturerJsonResponse = await query.execute()

  return results.map((modelItem: ManufacturerJsonResponse) => new ManufacturerModel(modelItem))
}

export async function whereCountry(value: string): Promise<ManufacturerModel[]> {
  const query = DB.instance.selectFrom('manufacturers').where('country', '=', value)
  const results: ManufacturerJsonResponse = await query.execute()

  return results.map((modelItem: ManufacturerJsonResponse) => new ManufacturerModel(modelItem))
}

export async function whereFeatured(value: boolean): Promise<ManufacturerModel[]> {
  const query = DB.instance.selectFrom('manufacturers').where('featured', '=', value)
  const results: ManufacturerJsonResponse = await query.execute()

  return results.map((modelItem: ManufacturerJsonResponse) => new ManufacturerModel(modelItem))
}

export const Manufacturer = ManufacturerModel

export default Manufacturer
