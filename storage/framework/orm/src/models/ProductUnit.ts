import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import type { ProductModel } from './Product'
import { randomUUIDv7 } from 'bun'
import { cache } from '@stacksjs/cache'
import { sql } from '@stacksjs/database'
import { HttpError, ModelNotFoundException } from '@stacksjs/error-handling'
import { dispatch } from '@stacksjs/events'
import { BaseOrm, DB, SubqueryBuilder } from '@stacksjs/orm'

import Product from './Product'

export interface ProductUnitsTable {
  id: Generated<number>
  product_id: number
  name: string
  abbreviation: string
  type: string
  description?: string
  is_default?: boolean
  uuid?: string

  created_at?: Date

  updated_at?: Date

}

export interface ProductUnitResponse {
  data: ProductUnitJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface ProductUnitJsonResponse extends Omit<Selectable<ProductUnitsTable>, 'password'> {
  [key: string]: any
}

export type NewProductUnit = Insertable<ProductUnitsTable>
export type ProductUnitUpdate = Updateable<ProductUnitsTable>

      type SortDirection = 'asc' | 'desc'
interface SortOptions { column: ProductUnitJsonResponse, order: SortDirection }
// Define a type for the options parameter
interface QueryOptions {
  sort?: SortOptions
  limit?: number
  offset?: number
  page?: number
}

export class ProductUnitModel extends BaseOrm<ProductUnitModel, ProductUnitsTable> {
  private readonly hidden: Array<keyof ProductUnitJsonResponse> = []
  private readonly fillable: Array<keyof ProductUnitJsonResponse> = ['name', 'abbreviation', 'type', 'description', 'is_default', 'uuid']
  private readonly guarded: Array<keyof ProductUnitJsonResponse> = []
  protected attributes = {} as ProductUnitJsonResponse
  protected originalAttributes = {} as ProductUnitJsonResponse

  protected selectFromQuery: any
  protected withRelations: string[]
  protected updateFromQuery: any
  protected deleteFromQuery: any
  protected hasSelect: boolean
  private hasSaved: boolean
  private customColumns: Record<string, unknown> = {}

  constructor(productUnit: ProductUnitJsonResponse | undefined) {
    super('product_units')
    if (productUnit) {
      this.attributes = { ...productUnit }
      this.originalAttributes = { ...productUnit }

      Object.keys(productUnit).forEach((key) => {
        if (!(key in this)) {
          this.customColumns[key] = (productUnit as ProductUnitJsonResponse)[key]
        }
      })
    }

    this.withRelations = []
    this.selectFromQuery = DB.instance.selectFrom('product_units')
    this.updateFromQuery = DB.instance.updateTable('product_units')
    this.deleteFromQuery = DB.instance.deleteFrom('product_units')
    this.hasSelect = false
    this.hasSaved = false
  }

  protected mapCustomGetters(models: ProductUnitJsonResponse | ProductUnitJsonResponse[]): void {
    const data = models

    if (Array.isArray(data)) {
      data.map((model: ProductUnitJsonResponse) => {
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

  async mapCustomSetters(model: NewProductUnit | ProductUnitUpdate): Promise<void> {
    const customSetter = {
      default: () => {
      },

    }

    for (const [key, fn] of Object.entries(customSetter)) {
      model[key] = await fn()
    }
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

  get name(): string {
    return this.attributes.name
  }

  get abbreviation(): string {
    return this.attributes.abbreviation
  }

  get type(): string {
    return this.attributes.type
  }

  get description(): string | undefined {
    return this.attributes.description
  }

  get is_default(): boolean | undefined {
    return this.attributes.is_default
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

  set abbreviation(value: string) {
    this.attributes.abbreviation = value
  }

  set type(value: string) {
    this.attributes.type = value
  }

  set description(value: string) {
    this.attributes.description = value
  }

  set is_default(value: boolean) {
    this.attributes.is_default = value
  }

  set updated_at(value: Date) {
    this.attributes.updated_at = value
  }

  getOriginal(column?: keyof ProductUnitJsonResponse): Partial<ProductUnitJsonResponse> {
    if (column) {
      return this.originalAttributes[column]
    }

    return this.originalAttributes
  }

  getChanges(): Partial<ProductUnitJsonResponse> {
    return this.fillable.reduce<Partial<ProductUnitJsonResponse>>((changes, key) => {
      const currentValue = this.attributes[key as keyof ProductUnitsTable]
      const originalValue = this.originalAttributes[key as keyof ProductUnitsTable]

      if (currentValue !== originalValue) {
        changes[key] = currentValue
      }

      return changes
    }, {})
  }

  isDirty(column?: keyof ProductUnitJsonResponse): boolean {
    if (column) {
      return this.attributes[column] !== this.originalAttributes[column]
    }

    return Object.entries(this.originalAttributes).some(([key, originalValue]) => {
      const currentValue = (this.attributes as any)[key]

      return currentValue !== originalValue
    })
  }

  isClean(column?: keyof ProductUnitJsonResponse): boolean {
    return !this.isDirty(column)
  }

  wasChanged(column?: keyof ProductUnitJsonResponse): boolean {
    return this.hasSaved && this.isDirty(column)
  }

  select(params: (keyof ProductUnitJsonResponse)[] | RawBuilder<string> | string): ProductUnitModel {
    this.selectFromQuery = this.selectFromQuery.select(params)

    this.hasSelect = true

    return this
  }

  static select(params: (keyof ProductUnitJsonResponse)[] | RawBuilder<string> | string): ProductUnitModel {
    const instance = new ProductUnitModel(undefined)

    // Initialize a query with the table name and selected fields
    instance.selectFromQuery = instance.selectFromQuery.select(params)

    instance.hasSelect = true

    return instance
  }

  // Method to find a ProductUnit by ID
  static async find(id: number): Promise<ProductUnitModel | undefined> {
    const instance = new ProductUnitModel(undefined)

    return await instance.applyFind(id)
  }

  async first(): Promise<ProductUnitModel | undefined> {
    const model = await this.applyFirst()

    const data = new ProductUnitModel(model)

    return data
  }

  static async first(): Promise<ProductUnitModel | undefined> {
    const instance = new ProductUnitModel(undefined)

    const model = await instance.applyFirst()

    const data = new ProductUnitModel(model)

    return data
  }

  async applyFirstOrFail(): Promise<ProductUnitModel | undefined> {
    const model = await this.selectFromQuery.executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, 'No ProductUnitModel results found for query')

    if (model) {
      this.mapCustomGetters(model)
      await this.loadRelations(model)
    }

    const data = new ProductUnitModel(model)

    return data
  }

  async firstOrFail(): Promise<ProductUnitModel | undefined> {
    return await this.applyFirstOrFail()
  }

  static async firstOrFail(): Promise<ProductUnitModel | undefined> {
    const instance = new ProductUnitModel(undefined)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<ProductUnitModel[]> {
    const instance = new ProductUnitModel(undefined)

    const models = await DB.instance.selectFrom('product_units').selectAll().execute()

    instance.mapCustomGetters(models)

    const data = await Promise.all(models.map(async (model: ProductUnitJsonResponse) => {
      return new ProductUnitModel(model)
    }))

    return data
  }

  async applyFindOrFail(id: number): Promise<ProductUnitModel> {
    const model = await DB.instance.selectFrom('product_units').where('id', '=', id).selectAll().executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, `No ProductUnitModel results for ${id}`)

    cache.getOrSet(`productUnit:${id}`, JSON.stringify(model))

    this.mapCustomGetters(model)
    await this.loadRelations(model)

    const data = new ProductUnitModel(model)

    return data
  }

  async findOrFail(id: number): Promise<ProductUnitModel> {
    return await this.applyFindOrFail(id)
  }

  static async findOrFail(id: number): Promise<ProductUnitModel> {
    const instance = new ProductUnitModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  async applyFindMany(ids: number[]): Promise<ProductUnitModel[]> {
    let query = DB.instance.selectFrom('product_units').where('id', 'in', ids)

    const instance = new ProductUnitModel(undefined)

    query = query.selectAll()

    const models = await query.execute()

    instance.mapCustomGetters(models)
    await instance.loadRelations(models)

    return models.map((modelItem: ProductUnitJsonResponse) => instance.parseResult(new ProductUnitModel(modelItem)))
  }

  static async findMany(ids: number[]): Promise<ProductUnitModel[]> {
    const instance = new ProductUnitModel(undefined)

    return await instance.applyFindMany(ids)
  }

  async findMany(ids: number[]): Promise<ProductUnitModel[]> {
    return await this.applyFindMany(ids)
  }

  skip(count: number): ProductUnitModel {
    this.selectFromQuery = this.selectFromQuery.offset(count)

    return this
  }

  static skip(count: number): ProductUnitModel {
    const instance = new ProductUnitModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.offset(count)

    return instance
  }

  async applyChunk(size: number, callback: (models: ProductUnitModel[]) => Promise<void>): Promise<void> {
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

  async chunk(size: number, callback: (models: ProductUnitModel[]) => Promise<void>): Promise<void> {
    await this.applyChunk(size, callback)
  }

  static async chunk(size: number, callback: (models: ProductUnitModel[]) => Promise<void>): Promise<void> {
    const instance = new ProductUnitModel(undefined)

    await instance.applyChunk(size, callback)
  }

  take(count: number): ProductUnitModel {
    this.selectFromQuery = this.selectFromQuery.limit(count)

    return this
  }

  static take(count: number): ProductUnitModel {
    const instance = new ProductUnitModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.limit(count)

    return instance
  }

  static async pluck<K extends keyof ProductUnitModel>(field: K): Promise<ProductUnitModel[K][]> {
    const instance = new ProductUnitModel(undefined)

    if (instance.hasSelect) {
      const model = await instance.selectFromQuery.execute()
      return model.map((modelItem: ProductUnitModel) => modelItem[field])
    }

    const model = await instance.selectFromQuery.selectAll().execute()

    return model.map((modelItem: ProductUnitModel) => modelItem[field])
  }

  async pluck<K extends keyof ProductUnitModel>(field: K): Promise<ProductUnitModel[K][]> {
    if (this.hasSelect) {
      const model = await this.selectFromQuery.execute()
      return model.map((modelItem: ProductUnitModel) => modelItem[field])
    }

    const model = await this.selectFromQuery.selectAll().execute()

    return model.map((modelItem: ProductUnitModel) => modelItem[field])
  }

  static async count(): Promise<number> {
    const instance = new ProductUnitModel(undefined)

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

  static async max(field: keyof ProductUnitModel): Promise<number> {
    const instance = new ProductUnitModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`MAX(${sql.raw(field as string)}) as max `)
      .executeTakeFirst()

    return result.max
  }

  async max(field: keyof ProductUnitModel): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`MAX(${sql.raw(field as string)}) as max`)
      .executeTakeFirst()

    return result.max
  }

  static async min(field: keyof ProductUnitModel): Promise<number> {
    const instance = new ProductUnitModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`MIN(${sql.raw(field as string)}) as min `)
      .executeTakeFirst()

    return result.min
  }

  async min(field: keyof ProductUnitModel): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`MIN(${sql.raw(field as string)}) as min `)
      .executeTakeFirst()

    return result.min
  }

  static async avg(field: keyof ProductUnitModel): Promise<number> {
    const instance = new ProductUnitModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`AVG(${sql.raw(field as string)}) as avg `)
      .executeTakeFirst()

    return result.avg
  }

  async avg(field: keyof ProductUnitModel): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`AVG(${sql.raw(field as string)}) as avg `)
      .executeTakeFirst()

    return result.avg
  }

  static async sum(field: keyof ProductUnitModel): Promise<number> {
    const instance = new ProductUnitModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`SUM(${sql.raw(field as string)}) as sum `)
      .executeTakeFirst()

    return result.sum
  }

  async sum(field: keyof ProductUnitModel): Promise<number> {
    const result = this.selectFromQuery
      .select(sql`SUM(${sql.raw(field as string)}) as sum `)
      .executeTakeFirst()

    return result.sum
  }

  async applyGet(): Promise<ProductUnitModel[]> {
    let models

    if (this.hasSelect) {
      models = await this.selectFromQuery.execute()
    }
    else {
      models = await this.selectFromQuery.selectAll().execute()
    }

    this.mapCustomGetters(models)
    await this.loadRelations(models)

    const data = await Promise.all(models.map(async (model: ProductUnitJsonResponse) => {
      return new ProductUnitModel(model)
    }))

    return data
  }

  async get(): Promise<ProductUnitModel[]> {
    return await this.applyGet()
  }

  static async get(): Promise<ProductUnitModel[]> {
    const instance = new ProductUnitModel(undefined)

    return await instance.applyGet()
  }

  has(relation: string): ProductUnitModel {
    this.selectFromQuery = this.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(
        selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.productUnit_id`, '=', 'product_units.id'),
      ),
    )

    return this
  }

  static has(relation: string): ProductUnitModel {
    const instance = new ProductUnitModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(
        selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.productUnit_id`, '=', 'product_units.id'),
      ),
    )

    return instance
  }

  static whereExists(callback: (qb: any) => any): ProductUnitModel {
    const instance = new ProductUnitModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(callback({ exists, selectFrom })),
    )

    return instance
  }

  applyWhereHas(
    relation: string,
    callback: (query: SubqueryBuilder<keyof ProductUnitModel>) => void,
  ): ProductUnitModel {
    const subqueryBuilder = new SubqueryBuilder()

    callback(subqueryBuilder)
    const conditions = subqueryBuilder.getConditions()

    this.selectFromQuery = this.selectFromQuery
      .where(({ exists, selectFrom }: any) => {
        let subquery = selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.productUnit_id`, '=', 'product_units.id')

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
    callback: (query: SubqueryBuilder<keyof ProductUnitModel>) => void,
  ): ProductUnitModel {
    return this.applyWhereHas(relation, callback)
  }

  static whereHas(
    relation: string,
    callback: (query: SubqueryBuilder<keyof ProductUnitModel>) => void,
  ): ProductUnitModel {
    const instance = new ProductUnitModel(undefined)

    return instance.applyWhereHas(relation, callback)
  }

  applyDoesntHave(relation: string): ProductUnitModel {
    this.selectFromQuery = this.selectFromQuery.where(({ not, exists, selectFrom }: any) =>
      not(
        exists(
          selectFrom(relation)
            .select('1')
            .whereRef(`${relation}.productUnit_id`, '=', 'product_units.id'),
        ),
      ),
    )

    return this
  }

  doesntHave(relation: string): ProductUnitModel {
    return this.applyDoesntHave(relation)
  }

  static doesntHave(relation: string): ProductUnitModel {
    const instance = new ProductUnitModel(undefined)

    return instance.applyDoesntHave(relation)
  }

  applyWhereDoesntHave(relation: string, callback: (query: SubqueryBuilder<ProductUnitsTable>) => void): ProductUnitModel {
    const subqueryBuilder = new SubqueryBuilder()

    callback(subqueryBuilder)
    const conditions = subqueryBuilder.getConditions()

    this.selectFromQuery = this.selectFromQuery
      .where(({ exists, selectFrom, not }: any) => {
        const subquery = selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.productUnit_id`, '=', 'product_units.id')

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

  whereDoesntHave(relation: string, callback: (query: SubqueryBuilder<ProductUnitsTable>) => void): ProductUnitModel {
    return this.applyWhereDoesntHave(relation, callback)
  }

  static whereDoesntHave(
    relation: string,
    callback: (query: SubqueryBuilder<ProductUnitsTable>) => void,
  ): ProductUnitModel {
    const instance = new ProductUnitModel(undefined)

    return instance.applyWhereDoesntHave(relation, callback)
  }

  async applyPaginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<ProductUnitResponse> {
    const totalRecordsResult = await DB.instance.selectFrom('product_units')
      .select(DB.instance.fn.count('id').as('total')) // Use 'id' or another actual column name
      .executeTakeFirst()

    const totalRecords = Number(totalRecordsResult?.total) || 0
    const totalPages = Math.ceil(totalRecords / (options.limit ?? 10))

    const product_unitsWithExtra = await DB.instance.selectFrom('product_units')
      .selectAll()
      .orderBy('id', 'asc') // Assuming 'id' is used for cursor-based pagination
      .limit((options.limit ?? 10) + 1) // Fetch one extra record
      .offset(((options.page ?? 1) - 1) * (options.limit ?? 10)) // Ensure options.page is not undefined
      .execute()

    let nextCursor = null
    if (product_unitsWithExtra.length > (options.limit ?? 10))
      nextCursor = product_unitsWithExtra.pop()?.id ?? null

    return {
      data: product_unitsWithExtra,
      paging: {
        total_records: totalRecords,
        page: options.page || 1,
        total_pages: totalPages,
      },
      next_cursor: nextCursor,
    }
  }

  async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<ProductUnitResponse> {
    return await this.applyPaginate(options)
  }

  // Method to get all product_units
  static async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<ProductUnitResponse> {
    const instance = new ProductUnitModel(undefined)

    return await instance.applyPaginate(options)
  }

  async applyCreate(newProductUnit: NewProductUnit): Promise<ProductUnitModel> {
    const filteredValues = Object.fromEntries(
      Object.entries(newProductUnit).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewProductUnit

    await this.mapCustomSetters(filteredValues)

    filteredValues.uuid = randomUUIDv7()

    const result = await DB.instance.insertInto('product_units')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await this.find(Number(result.numInsertedOrUpdatedRows)) as ProductUnitModel

    if (model)
      dispatch('productUnit:created', model)

    return model
  }

  async create(newProductUnit: NewProductUnit): Promise<ProductUnitModel> {
    return await this.applyCreate(newProductUnit)
  }

  static async create(newProductUnit: NewProductUnit): Promise<ProductUnitModel> {
    const instance = new ProductUnitModel(undefined)

    return await instance.applyCreate(newProductUnit)
  }

  static async createMany(newProductUnit: NewProductUnit[]): Promise<void> {
    const instance = new ProductUnitModel(undefined)

    const valuesFiltered = newProductUnit.map((newProductUnit: NewProductUnit) => {
      const filteredValues = Object.fromEntries(
        Object.entries(newProductUnit).filter(([key]) =>
          !instance.guarded.includes(key) && instance.fillable.includes(key),
        ),
      ) as NewProductUnit

      filteredValues.uuid = randomUUIDv7()

      return filteredValues
    })

    await DB.instance.insertInto('product_units')
      .values(valuesFiltered)
      .executeTakeFirst()
  }

  static async forceCreate(newProductUnit: NewProductUnit): Promise<ProductUnitModel> {
    const result = await DB.instance.insertInto('product_units')
      .values(newProductUnit)
      .executeTakeFirst()

    const model = await find(Number(result.numInsertedOrUpdatedRows)) as ProductUnitModel

    if (model)
      dispatch('productUnit:created', model)

    return model
  }

  // Method to remove a ProductUnit
  static async remove(id: number): Promise<any> {
    const instance = new ProductUnitModel(undefined)

    const model = await instance.find(Number(id))

    if (model)
      dispatch('productUnit:deleted', model)

    return await DB.instance.deleteFrom('product_units')
      .where('id', '=', id)
      .execute()
  }

  applyWhere<V>(column: keyof ProductUnitsTable, ...args: [V] | [Operator, V]): ProductUnitModel {
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

  where<V = string>(column: keyof ProductUnitsTable, ...args: [V] | [Operator, V]): ProductUnitModel {
    return this.applyWhere<V>(column, ...args)
  }

  static where<V = string>(column: keyof ProductUnitsTable, ...args: [V] | [Operator, V]): ProductUnitModel {
    const instance = new ProductUnitModel(undefined)

    return instance.applyWhere<V>(column, ...args)
  }

  whereColumn(first: keyof ProductUnitsTable, operator: Operator, second: keyof ProductUnitsTable): ProductUnitModel {
    this.selectFromQuery = this.selectFromQuery.whereRef(first, operator, second)

    return this
  }

  static whereColumn(first: keyof ProductUnitsTable, operator: Operator, second: keyof ProductUnitsTable): ProductUnitModel {
    const instance = new ProductUnitModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.whereRef(first, operator, second)

    return instance
  }

  applyWhereRef(column: keyof ProductUnitsTable, ...args: string[]): ProductUnitModel {
    const [operatorOrValue, value] = args
    const operator = value === undefined ? '=' : operatorOrValue
    const actualValue = value === undefined ? operatorOrValue : value

    const instance = new ProductUnitModel(undefined)
    instance.selectFromQuery = instance.selectFromQuery.whereRef(column, operator, actualValue)

    return instance
  }

  whereRef(column: keyof ProductUnitsTable, ...args: string[]): ProductUnitModel {
    return this.applyWhereRef(column, ...args)
  }

  static whereRef(column: keyof ProductUnitsTable, ...args: string[]): ProductUnitModel {
    const instance = new ProductUnitModel(undefined)

    return instance.applyWhereRef(column, ...args)
  }

  whereRaw(sqlStatement: string): ProductUnitModel {
    this.selectFromQuery = this.selectFromQuery.where(sql`${sqlStatement}`)

    return this
  }

  static whereRaw(sqlStatement: string): ProductUnitModel {
    const instance = new ProductUnitModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where(sql`${sqlStatement}`)

    return instance
  }

  applyOrWhere(...conditions: [string, any][]): ProductUnitModel {
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

  orWhere(...conditions: [string, any][]): ProductUnitModel {
    return this.applyOrWhere(...conditions)
  }

  static orWhere(...conditions: [string, any][]): ProductUnitModel {
    const instance = new ProductUnitModel(undefined)

    return instance.applyOrWhere(...conditions)
  }

  when(
    condition: boolean,
    callback: (query: ProductUnitModel) => ProductUnitModel,
  ): ProductUnitModel {
    return ProductUnitModel.when(condition, callback)
  }

  static when(
    condition: boolean,
    callback: (query: ProductUnitModel) => ProductUnitModel,
  ): ProductUnitModel {
    let instance = new ProductUnitModel(undefined)

    if (condition)
      instance = callback(instance)

    return instance
  }

  whereNotNull(column: keyof ProductUnitsTable): ProductUnitModel {
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

  static whereNotNull(column: keyof ProductUnitsTable): ProductUnitModel {
    const instance = new ProductUnitModel(undefined)

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

  whereNull(column: keyof ProductUnitsTable): ProductUnitModel {
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

  static whereNull(column: keyof ProductUnitsTable): ProductUnitModel {
    const instance = new ProductUnitModel(undefined)

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

  static whereName(value: string): ProductUnitModel {
    const instance = new ProductUnitModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('name', '=', value)

    return instance
  }

  static whereAbbreviation(value: string): ProductUnitModel {
    const instance = new ProductUnitModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('abbreviation', '=', value)

    return instance
  }

  static whereType(value: string): ProductUnitModel {
    const instance = new ProductUnitModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('type', '=', value)

    return instance
  }

  static whereDescription(value: string): ProductUnitModel {
    const instance = new ProductUnitModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('description', '=', value)

    return instance
  }

  static whereIsDefault(value: string): ProductUnitModel {
    const instance = new ProductUnitModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('is_default', '=', value)

    return instance
  }

  applyWhereIn<V>(column: keyof ProductUnitsTable, values: V[]) {
    this.selectFromQuery = this.selectFromQuery.where(column, 'in', values)

    this.updateFromQuery = this.updateFromQuery.where(column, 'in', values)

    this.deleteFromQuery = this.deleteFromQuery.where(column, 'in', values)

    return this
  }

  whereIn<V = number>(column: keyof ProductUnitsTable, values: V[]): ProductUnitModel {
    return this.applyWhereIn<V>(column, values)
  }

  static whereIn<V = number>(column: keyof ProductUnitsTable, values: V[]): ProductUnitModel {
    const instance = new ProductUnitModel(undefined)

    return instance.applyWhereIn<V>(column, values)
  }

  applyWhereBetween<V>(column: keyof ProductUnitsTable, range: [V, V]): ProductUnitModel {
    if (range.length !== 2) {
      throw new HttpError(500, 'Range must have exactly two values: [min, max]')
    }

    const query = sql` ${sql.raw(column as string)} between ${range[0]} and ${range[1]} `

    this.selectFromQuery = this.selectFromQuery.where(query)
    this.updateFromQuery = this.updateFromQuery.where(query)
    this.deleteFromQuery = this.deleteFromQuery.where(query)

    return this
  }

  whereBetween<V = number>(column: keyof ProductUnitsTable, range: [V, V]): ProductUnitModel {
    return this.applyWhereBetween<V>(column, range)
  }

  static whereBetween<V = number>(column: keyof ProductUnitsTable, range: [V, V]): ProductUnitModel {
    const instance = new ProductUnitModel(undefined)

    return instance.applyWhereBetween<V>(column, range)
  }

  applyWhereLike(column: keyof ProductUnitsTable, value: string): ProductUnitModel {
    this.selectFromQuery = this.selectFromQuery.where(sql` ${sql.raw(column as string)} LIKE ${value}`)

    this.updateFromQuery = this.updateFromQuery.where(sql` ${sql.raw(column as string)} LIKE ${value}`)

    this.deleteFromQuery = this.deleteFromQuery.where(sql` ${sql.raw(column as string)} LIKE ${value}`)

    return this
  }

  whereLike(column: keyof ProductUnitsTable, value: string): ProductUnitModel {
    return this.applyWhereLike(column, value)
  }

  static whereLike(column: keyof ProductUnitsTable, value: string): ProductUnitModel {
    const instance = new ProductUnitModel(undefined)

    return instance.applyWhereLike(column, value)
  }

  applyWhereNotIn<V>(column: keyof ProductUnitsTable, values: V[]): ProductUnitModel {
    this.selectFromQuery = this.selectFromQuery.where(column, 'not in', values)

    this.updateFromQuery = this.updateFromQuery.where(column, 'not in', values)

    this.deleteFromQuery = this.deleteFromQuery.where(column, 'not in', values)

    return this
  }

  whereNotIn<V>(column: keyof ProductUnitsTable, values: V[]): ProductUnitModel {
    return this.applyWhereNotIn<V>(column, values)
  }

  static whereNotIn<V = number>(column: keyof ProductUnitsTable, values: V[]): ProductUnitModel {
    const instance = new ProductUnitModel(undefined)

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

  static async latest(): Promise<ProductUnitModel | undefined> {
    const instance = new ProductUnitModel(undefined)

    const model = await DB.instance.selectFrom('product_units')
      .selectAll()
      .orderBy('id', 'desc')
      .executeTakeFirst()

    if (!model)
      return undefined

    instance.mapCustomGetters(model)

    const data = new ProductUnitModel(model)

    return data
  }

  static async oldest(): Promise<ProductUnitModel | undefined> {
    const instance = new ProductUnitModel(undefined)

    const model = await DB.instance.selectFrom('product_units')
      .selectAll()
      .orderBy('id', 'asc')
      .executeTakeFirst()

    if (!model)
      return undefined

    instance.mapCustomGetters(model)

    const data = new ProductUnitModel(model)

    return data
  }

  static async firstOrCreate(
    condition: Partial<ProductUnitJsonResponse>,
    newProductUnit: NewProductUnit,
  ): Promise<ProductUnitModel> {
    const instance = new ProductUnitModel(undefined)

    const key = Object.keys(condition)[0] as keyof ProductUnitJsonResponse

    if (!key) {
      throw new HttpError(500, 'Condition must contain at least one key-value pair')
    }

    const value = condition[key]

    // Attempt to find the first record matching the condition
    const existingProductUnit = await DB.instance.selectFrom('product_units')
      .selectAll()
      .where(key, '=', value)
      .executeTakeFirst()

    if (existingProductUnit) {
      instance.mapCustomGetters(existingProductUnit)
      await instance.loadRelations(existingProductUnit)

      return new ProductUnitModel(existingProductUnit as ProductUnitJsonResponse)
    }
    else {
      return await instance.create(newProductUnit)
    }
  }

  static async updateOrCreate(
    condition: Partial<ProductUnitJsonResponse>,
    newProductUnit: NewProductUnit,
  ): Promise<ProductUnitModel> {
    const instance = new ProductUnitModel(undefined)

    const key = Object.keys(condition)[0] as keyof ProductUnitJsonResponse

    if (!key) {
      throw new HttpError(500, 'Condition must contain at least one key-value pair')
    }

    const value = condition[key]

    // Attempt to find the first record matching the condition
    const existingProductUnit = await DB.instance.selectFrom('product_units')
      .selectAll()
      .where(key, '=', value)
      .executeTakeFirst()

    if (existingProductUnit) {
      // If found, update the existing record
      await DB.instance.updateTable('product_units')
        .set(newProductUnit)
        .where(key, '=', value)
        .executeTakeFirstOrThrow()

      // Fetch and return the updated record
      const updatedProductUnit = await DB.instance.selectFrom('product_units')
        .selectAll()
        .where(key, '=', value)
        .executeTakeFirst()

      if (!updatedProductUnit) {
        throw new HttpError(500, 'Failed to fetch updated record')
      }

      instance.hasSaved = true

      return new ProductUnitModel(updatedProductUnit as ProductUnitJsonResponse)
    }
    else {
      // If not found, create a new record
      return await instance.create(newProductUnit)
    }
  }

  protected async loadRelations(models: ProductUnitJsonResponse | ProductUnitJsonResponse[]): Promise<void> {
    // Handle both single model and array of models
    const modelArray = Array.isArray(models) ? models : [models]
    if (!modelArray.length)
      return

    const modelIds = modelArray.map(model => model.id)

    for (const relation of this.withRelations) {
      const relatedRecords = await DB.instance
        .selectFrom(relation)
        .where('productUnit_id', 'in', modelIds)
        .selectAll()
        .execute()

      if (Array.isArray(models)) {
        models.map((model: ProductUnitJsonResponse) => {
          const records = relatedRecords.filter((record: { productUnit_id: number }) => {
            return record.productUnit_id === model.id
          })

          model[relation] = records.length === 1 ? records[0] : records
          return model
        })
      }
      else {
        const records = relatedRecords.filter((record: { productUnit_id: number }) => {
          return record.productUnit_id === models.id
        })

        models[relation] = records.length === 1 ? records[0] : records
      }
    }
  }

  with(relations: string[]): ProductUnitModel {
    this.withRelations = relations

    return this
  }

  static with(relations: string[]): ProductUnitModel {
    const instance = new ProductUnitModel(undefined)

    instance.withRelations = relations

    return instance
  }

  async last(): Promise<ProductUnitModel | undefined> {
    let model: ProductUnitJsonResponse | undefined

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

    const data = new ProductUnitModel(model)

    return data
  }

  static async last(): Promise<ProductUnitModel | undefined> {
    const model = await DB.instance.selectFrom('product_units').selectAll().orderBy('id', 'desc').executeTakeFirst()

    if (!model)
      return undefined

    const data = new ProductUnitModel(model)

    return data
  }

  orderBy(column: keyof ProductUnitsTable, order: 'asc' | 'desc'): ProductUnitModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, order)

    return this
  }

  static orderBy(column: keyof ProductUnitsTable, order: 'asc' | 'desc'): ProductUnitModel {
    const instance = new ProductUnitModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, order)

    return instance
  }

  groupBy(column: keyof ProductUnitsTable): ProductUnitModel {
    this.selectFromQuery = this.selectFromQuery.groupBy(column)

    return this
  }

  static groupBy(column: keyof ProductUnitsTable): ProductUnitModel {
    const instance = new ProductUnitModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.groupBy(column)

    return instance
  }

  having<V = string>(column: keyof ProductUnitsTable, operator: Operator, value: V): ProductUnitModel {
    this.selectFromQuery = this.selectFromQuery.having(column, operator, value)

    return this
  }

  static having<V = string>(column: keyof ProductUnitsTable, operator: Operator, value: V): ProductUnitModel {
    const instance = new ProductUnitModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.having(column, operator, value)

    return instance
  }

  inRandomOrder(): ProductUnitModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(sql` ${sql.raw('RANDOM()')} `)

    return this
  }

  static inRandomOrder(): ProductUnitModel {
    const instance = new ProductUnitModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(sql` ${sql.raw('RANDOM()')} `)

    return instance
  }

  orderByDesc(column: keyof ProductUnitsTable): ProductUnitModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, 'desc')

    return this
  }

  static orderByDesc(column: keyof ProductUnitsTable): ProductUnitModel {
    const instance = new ProductUnitModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, 'desc')

    return instance
  }

  orderByAsc(column: keyof ProductUnitsTable): ProductUnitModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, 'asc')

    return this
  }

  static orderByAsc(column: keyof ProductUnitsTable): ProductUnitModel {
    const instance = new ProductUnitModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, 'asc')

    return instance
  }

  async update(newProductUnit: ProductUnitUpdate): Promise<ProductUnitModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newProductUnit).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewProductUnit

    await this.mapCustomSetters(filteredValues)

    await DB.instance.updateTable('product_units')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      const model = await this.find(this.id)

      if (model)
        dispatch('productUnit:updated', model)

      return model
    }

    this.hasSaved = true

    return undefined
  }

  async forceUpdate(productUnit: ProductUnitUpdate): Promise<ProductUnitModel | undefined> {
    if (this.id === undefined) {
      this.updateFromQuery.set(productUnit).execute()
    }

    await this.mapCustomSetters(productUnit)

    await DB.instance.updateTable('product_units')
      .set(productUnit)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      const model = await this.find(this.id)

      if (model)
        dispatch('productUnit:updated', model)

      this.hasSaved = true

      return model
    }

    return undefined
  }

  async save(): Promise<void> {
    if (!this)
      throw new HttpError(500, 'ProductUnit data is undefined')

    await this.mapCustomSetters(this.attributes)

    if (this.id === undefined) {
      await this.create(this.attributes)
    }
    else {
      await this.update(this.attributes)
    }

    this.hasSaved = true
  }

  fill(data: Partial<ProductUnitJsonResponse>): ProductUnitModel {
    const filteredValues = Object.fromEntries(
      Object.entries(data).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewProductUnit

    this.attributes = {
      ...this.attributes,
      ...filteredValues,
    }

    return this
  }

  forceFill(data: Partial<ProductUnitJsonResponse>): ProductUnitModel {
    this.attributes = {
      ...this.attributes,
      ...data,
    }

    return this
  }

  // Method to delete (soft delete) the productUnit instance
  async delete(): Promise<ProductUnitsTable> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()
    const model = await this.find(Number(this.id))
    if (model)
      dispatch('productUnit:deleted', model)

    return await DB.instance.deleteFrom('product_units')
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

  toSearchableObject(): Partial<ProductUnitJsonResponse> {
    return {
      id: this.id,
      name: this.name,
      abbreviation: this.abbreviation,
      type: this.type,
      description: this.description,
      is_default: this.is_default,
    }
  }

  distinct(column: keyof ProductUnitJsonResponse): ProductUnitModel {
    this.selectFromQuery = this.selectFromQuery.select(column).distinct()

    this.hasSelect = true

    return this
  }

  static distinct(column: keyof ProductUnitJsonResponse): ProductUnitModel {
    const instance = new ProductUnitModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.select(column).distinct()

    instance.hasSelect = true

    return instance
  }

  join(table: string, firstCol: string, secondCol: string): ProductUnitModel {
    this.selectFromQuery = this.selectFromQuery.innerJoin(table, firstCol, secondCol)

    return this
  }

  static join(table: string, firstCol: string, secondCol: string): ProductUnitModel {
    const instance = new ProductUnitModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.innerJoin(table, firstCol, secondCol)

    return instance
  }

  toJSON(): ProductUnitJsonResponse {
    const output = {

      uuid: this.uuid,

      id: this.id,
      name: this.name,
      abbreviation: this.abbreviation,
      type: this.type,
      description: this.description,
      is_default: this.is_default,

      created_at: this.created_at,

      updated_at: this.updated_at,

      product_id: this.product_id,
      product: this.product,
      ...this.customColumns,
    }

    return output
  }

  parseResult(model: ProductUnitModel): ProductUnitModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof ProductUnitModel]
    }

    return model
  }
}

async function find(id: number): Promise<ProductUnitModel | undefined> {
  const query = DB.instance.selectFrom('product_units').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  return new ProductUnitModel(model)
}

export async function count(): Promise<number> {
  const results = await ProductUnitModel.count()

  return results
}

export async function create(newProductUnit: NewProductUnit): Promise<ProductUnitModel> {
  const result = await DB.instance.insertInto('product_units')
    .values(newProductUnit)
    .executeTakeFirstOrThrow()

  return await find(Number(result.numInsertedOrUpdatedRows)) as ProductUnitModel
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(DB.instance)
}

export async function remove(id: number): Promise<void> {
  await DB.instance.deleteFrom('product_units')
    .where('id', '=', id)
    .execute()
}

export async function whereName(value: string): Promise<ProductUnitModel[]> {
  const query = DB.instance.selectFrom('product_units').where('name', '=', value)
  const results: ProductUnitJsonResponse = await query.execute()

  return results.map((modelItem: ProductUnitJsonResponse) => new ProductUnitModel(modelItem))
}

export async function whereAbbreviation(value: string): Promise<ProductUnitModel[]> {
  const query = DB.instance.selectFrom('product_units').where('abbreviation', '=', value)
  const results: ProductUnitJsonResponse = await query.execute()

  return results.map((modelItem: ProductUnitJsonResponse) => new ProductUnitModel(modelItem))
}

export async function whereType(value: string): Promise<ProductUnitModel[]> {
  const query = DB.instance.selectFrom('product_units').where('type', '=', value)
  const results: ProductUnitJsonResponse = await query.execute()

  return results.map((modelItem: ProductUnitJsonResponse) => new ProductUnitModel(modelItem))
}

export async function whereDescription(value: string): Promise<ProductUnitModel[]> {
  const query = DB.instance.selectFrom('product_units').where('description', '=', value)
  const results: ProductUnitJsonResponse = await query.execute()

  return results.map((modelItem: ProductUnitJsonResponse) => new ProductUnitModel(modelItem))
}

export async function whereIsDefault(value: boolean): Promise<ProductUnitModel[]> {
  const query = DB.instance.selectFrom('product_units').where('is_default', '=', value)
  const results: ProductUnitJsonResponse = await query.execute()

  return results.map((modelItem: ProductUnitJsonResponse) => new ProductUnitModel(modelItem))
}

export const ProductUnit = ProductUnitModel

export default ProductUnit
