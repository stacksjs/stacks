import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { Operator } from '@stacksjs/types'
import type { ProductModel } from './Product'
import { randomUUIDv7 } from 'bun'
import { sql } from '@stacksjs/database'
import { HttpError } from '@stacksjs/error-handling'
import { dispatch } from '@stacksjs/events'
import { BaseOrm, DB } from '@stacksjs/orm'

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

export class ProductUnitModel extends BaseOrm<ProductUnitModel, ProductUnitsTable, ProductUnitJsonResponse> {
  private readonly hidden: Array<keyof ProductUnitJsonResponse> = []
  private readonly fillable: Array<keyof ProductUnitJsonResponse> = ['name', 'abbreviation', 'type', 'description', 'is_default', 'uuid']
  private readonly guarded: Array<keyof ProductUnitJsonResponse> = []
  protected attributes = {} as ProductUnitJsonResponse
  protected originalAttributes = {} as ProductUnitJsonResponse

  protected selectFromQuery: any
  protected updateFromQuery: any
  protected deleteFromQuery: any
  protected hasSelect: boolean
  private hasSaved: boolean
  private customColumns: Record<string, unknown> = {}

  /**
   * This model inherits many query methods from BaseOrm:
   * - pluck, chunk, whereExists, has, doesntHave, whereHas, whereDoesntHave
   * - inRandomOrder, max, min, avg, paginate, get, and more
   *
   * See BaseOrm class for the full list of inherited methods.
   */

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

  static with(relations: string[]): ProductUnitModel {
    const instance = new ProductUnitModel(undefined)

    return instance.applyWith(relations)
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

  async mapCustomSetters(model: NewProductUnit | ProductUnitUpdate): Promise<void> {
    const customSetter = {
      default: () => {
      },

    }

    for (const [key, fn] of Object.entries(customSetter)) {
      (model as any)[key] = await fn()
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

  static select(params: (keyof ProductUnitJsonResponse)[] | RawBuilder<string> | string): ProductUnitModel {
    const instance = new ProductUnitModel(undefined)

    return instance.applySelect(params)
  }

  // Method to find a ProductUnit by ID
  static async find(id: number): Promise<ProductUnitModel | undefined> {
    const instance = new ProductUnitModel(undefined)

    return await instance.applyFind(id)
  }

  static async first(): Promise<ProductUnitModel | undefined> {
    const instance = new ProductUnitModel(undefined)

    const model = await instance.applyFirst()

    const data = new ProductUnitModel(model)

    return data
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

  static async findOrFail(id: number): Promise<ProductUnitModel | undefined> {
    const instance = new ProductUnitModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  static async findMany(ids: number[]): Promise<ProductUnitModel[]> {
    const instance = new ProductUnitModel(undefined)

    const models = await instance.applyFindMany(ids)

    return models.map((modelItem: UserJsonResponse) => instance.parseResult(new ProductUnitModel(modelItem)))
  }

  static skip(count: number): ProductUnitModel {
    const instance = new ProductUnitModel(undefined)

    return instance.applySkip(count)
  }

  static take(count: number): ProductUnitModel {
    const instance = new ProductUnitModel(undefined)

    return instance.applyTake(count)
  }

  static where<V = string>(column: keyof ProductUnitsTable, ...args: [V] | [Operator, V]): ProductUnitModel {
    const instance = new ProductUnitModel(undefined)

    return instance.applyWhere<V>(column, ...args)
  }

  static orWhere(...conditions: [string, any][]): ProductUnitModel {
    const instance = new ProductUnitModel(undefined)

    return instance.applyOrWhere(...conditions)
  }

  static whereNotIn<V = number>(column: keyof ProductUnitsTable, values: V[]): ProductUnitModel {
    const instance = new ProductUnitModel(undefined)

    return instance.applyWhereNotIn<V>(column, values)
  }

  static whereBetween<V = number>(column: keyof ProductUnitsTable, range: [V, V]): ProductUnitModel {
    const instance = new ProductUnitModel(undefined)

    return instance.applyWhereBetween<V>(column, range)
  }

  static whereRef(column: keyof ProductUnitsTable, ...args: string[]): ProductUnitModel {
    const instance = new ProductUnitModel(undefined)

    return instance.applyWhereRef(column, ...args)
  }

  static when(condition: boolean, callback: (query: ProductUnitModel) => ProductUnitModel): ProductUnitModel {
    const instance = new ProductUnitModel(undefined)

    return instance.applyWhen(condition, callback as any)
  }

  static whereLike(column: keyof ProductUnitsTable, value: string): ProductUnitModel {
    const instance = new ProductUnitModel(undefined)

    return instance.applyWhereLike(column, value)
  }

  static orderBy(column: keyof ProductUnitsTable, order: 'asc' | 'desc'): ProductUnitModel {
    const instance = new ProductUnitModel(undefined)

    return instance.applyOrderBy(column, order)
  }

  static orderByAsc(column: keyof ProductUnitsTable): ProductUnitModel {
    const instance = new ProductUnitModel(undefined)

    return instance.applyOrderByAsc(column)
  }

  static orderByDesc(column: keyof ProductUnitsTable): ProductUnitModel {
    const instance = new ProductUnitModel(undefined)

    return instance.applyOrderByDesc(column)
  }

  static inRandomOrder(): ProductUnitModel {
    const instance = new ProductUnitModel(undefined)

    return instance.applyInRandomOrder()
  }

  static whereColumn(first: keyof ProductUnitsTable, operator: Operator, second: keyof ProductUnitsTable): ProductUnitModel {
    const instance = new ProductUnitModel(undefined)

    return instance.applyWhereColumn(first, operator, second)
  }

  static async max(field: keyof ProductUnitsTable): Promise<number> {
    const instance = new ProductUnitModel(undefined)

    return await instance.applyMax(field)
  }

  static async min(field: keyof ProductUnitsTable): Promise<number> {
    const instance = new ProductUnitModel(undefined)

    return await instance.applyMin(field)
  }

  static async avg(field: keyof ProductUnitsTable): Promise<number> {
    const instance = new ProductUnitModel(undefined)

    return await instance.applyAvg(field)
  }

  static async sum(field: keyof ProductUnitsTable): Promise<number> {
    const instance = new ProductUnitModel(undefined)

    return await instance.applySum(field)
  }

  static async count(): Promise<number> {
    const instance = new ProductUnitModel(undefined)

    return instance.applyCount()
  }

  static async get(): Promise<ProductUnitModel[]> {
    const instance = new ProductUnitModel(undefined)

    const results = await instance.applyGet()

    return results.map((item: ProductUnitJsonResponse) => new ProductUnitModel(item))
  }

  static async pluck<K extends keyof ProductUnitModel>(field: K): Promise<ProductUnitModel[K][]> {
    const instance = new ProductUnitModel(undefined)

    return await instance.applyPluck(field)
  }

  static async chunk(size: number, callback: (models: ProductUnitModel[]) => Promise<void>): Promise<void> {
    const instance = new ProductUnitModel(undefined)

    await instance.applyChunk(size, async (models) => {
      const modelInstances = models.map((item: ProductUnitJsonResponse) => new ProductUnitModel(item))
      await callback(modelInstances)
    })
  }

  static async paginate(options: { limit?: number, offset?: number, page?: number } = { limit: 10, offset: 0, page: 1 }): Promise<{
    data: ProductUnitModel[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }> {
    const instance = new ProductUnitModel(undefined)

    const result = await instance.applyPaginate(options)

    return {
      data: result.data.map((item: ProductUnitJsonResponse) => new ProductUnitModel(item)),
      paging: result.paging,
      next_cursor: result.next_cursor,
    }
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

  static async firstOrCreate(search: Partial<ProductUnitsTable>, values: NewProductUnit = {} as NewProductUnit): Promise<ProductUnitModel> {
    // First try to find a record matching the search criteria
    const instance = new ProductUnitModel(undefined)

    // Apply all search conditions
    for (const [key, value] of Object.entries(search)) {
      instance.selectFromQuery = instance.selectFromQuery.where(key, '=', value)
    }

    // Try to find the record
    const existingRecord = await instance.applyFirst()

    if (existingRecord) {
      return new ProductUnitModel(existingRecord)
    }

    // If no record exists, create a new one with combined search criteria and values
    const createData = { ...search, ...values } as NewProductUnit
    return await ProductUnitModel.create(createData)
  }

  async update(newProductUnit: ProductUnitUpdate): Promise<ProductUnitModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newProductUnit).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as ProductUnitUpdate

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

  async forceUpdate(newProductUnit: ProductUnitUpdate): Promise<ProductUnitModel | undefined> {
    await DB.instance.updateTable('product_units')
      .set(newProductUnit)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      const model = await this.find(this.id)

      if (model)
        dispatch('productUnit:updated', model)

      return model
    }

    return undefined
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
  async delete(): Promise<number> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()
    const model = await this.find(Number(this.id))

    if (model)
      dispatch('productUnit:deleted', model)

    const deleted = await DB.instance.deleteFrom('product_units')
      .where('id', '=', this.id)
      .execute()

    return deleted.numDeletedRows
  }

  static async remove(id: number): Promise<any> {
    const instance = new ProductUnitModel(undefined)

    const model = await instance.find(Number(id))

    if (model)
      dispatch('productUnit:deleted', model)

    return await DB.instance.deleteFrom('product_units')
      .where('id', '=', id)
      .execute()
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

  static whereIn<V = number>(column: keyof ProductUnitsTable, values: V[]): ProductUnitModel {
    const instance = new ProductUnitModel(undefined)

    return instance.applyWhereIn<V>(column, values)
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

  static distinct(column: keyof ProductUnitJsonResponse): ProductUnitModel {
    const instance = new ProductUnitModel(undefined)

    return instance.applyDistinct(column)
  }

  static join(table: string, firstCol: string, secondCol: string): ProductUnitModel {
    const instance = new ProductUnitModel(undefined)

    return instance.applyJoin(table, firstCol, secondCol)
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
