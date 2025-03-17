import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { Operator } from '@stacksjs/types'
import type { ProductModel } from './Product'
import { randomUUIDv7 } from 'bun'
import { sql } from '@stacksjs/database'
import { HttpError } from '@stacksjs/error-handling'
import { dispatch } from '@stacksjs/events'
import { BaseOrm, DB } from '@stacksjs/orm'

export interface ProductVariantsTable {
  id: Generated<number>
  product_id: number
  variant: string
  type: string
  description?: string
  options?: string
  status: string | string[]
  uuid?: string

  created_at?: Date

  updated_at?: Date

}

export interface ProductVariantResponse {
  data: ProductVariantJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface ProductVariantJsonResponse extends Omit<Selectable<ProductVariantsTable>, 'password'> {
  [key: string]: any
}

export type NewProductVariant = Insertable<ProductVariantsTable>
export type ProductVariantUpdate = Updateable<ProductVariantsTable>

export class ProductVariantModel extends BaseOrm<ProductVariantModel, ProductVariantsTable, ProductVariantJsonResponse> {
  private readonly hidden: Array<keyof ProductVariantJsonResponse> = []
  private readonly fillable: Array<keyof ProductVariantJsonResponse> = ['variant', 'type', 'description', 'options', 'status', 'uuid']
  private readonly guarded: Array<keyof ProductVariantJsonResponse> = []
  protected attributes = {} as ProductVariantJsonResponse
  protected originalAttributes = {} as ProductVariantJsonResponse

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

  constructor(productVariant: ProductVariantJsonResponse | undefined) {
    super('product_variants')
    if (productVariant) {
      this.attributes = { ...productVariant }
      this.originalAttributes = { ...productVariant }

      Object.keys(productVariant).forEach((key) => {
        if (!(key in this)) {
          this.customColumns[key] = (productVariant as ProductVariantJsonResponse)[key]
        }
      })
    }

    this.withRelations = []
    this.selectFromQuery = DB.instance.selectFrom('product_variants')
    this.updateFromQuery = DB.instance.updateTable('product_variants')
    this.deleteFromQuery = DB.instance.deleteFrom('product_variants')
    this.hasSelect = false
    this.hasSaved = false
  }

  protected async loadRelations(models: ProductVariantJsonResponse | ProductVariantJsonResponse[]): Promise<void> {
    // Handle both single model and array of models
    const modelArray = Array.isArray(models) ? models : [models]
    if (!modelArray.length)
      return

    const modelIds = modelArray.map(model => model.id)

    for (const relation of this.withRelations) {
      const relatedRecords = await DB.instance
        .selectFrom(relation)
        .where('productVariant_id', 'in', modelIds)
        .selectAll()
        .execute()

      if (Array.isArray(models)) {
        models.map((model: ProductVariantJsonResponse) => {
          const records = relatedRecords.filter((record: { productVariant_id: number }) => {
            return record.productVariant_id === model.id
          })

          model[relation] = records.length === 1 ? records[0] : records
          return model
        })
      }
      else {
        const records = relatedRecords.filter((record: { productVariant_id: number }) => {
          return record.productVariant_id === models.id
        })

        models[relation] = records.length === 1 ? records[0] : records
      }
    }
  }

  static with(relations: string[]): ProductVariantModel {
    const instance = new ProductVariantModel(undefined)

    return instance.applyWith(relations)
  }

  protected mapCustomGetters(models: ProductVariantJsonResponse | ProductVariantJsonResponse[]): void {
    const data = models

    if (Array.isArray(data)) {
      data.map((model: ProductVariantJsonResponse) => {
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

  async mapCustomSetters(model: NewProductVariant | ProductVariantUpdate): Promise<void> {
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

  get variant(): string {
    return this.attributes.variant
  }

  get type(): string {
    return this.attributes.type
  }

  get description(): string | undefined {
    return this.attributes.description
  }

  get options(): string | undefined {
    return this.attributes.options
  }

  get status(): string | string[] {
    return this.attributes.status
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

  set variant(value: string) {
    this.attributes.variant = value
  }

  set type(value: string) {
    this.attributes.type = value
  }

  set description(value: string) {
    this.attributes.description = value
  }

  set options(value: string) {
    this.attributes.options = value
  }

  set status(value: string | string[]) {
    this.attributes.status = value
  }

  set updated_at(value: Date) {
    this.attributes.updated_at = value
  }

  static select(params: (keyof ProductVariantJsonResponse)[] | RawBuilder<string> | string): ProductVariantModel {
    const instance = new ProductVariantModel(undefined)

    return instance.applySelect(params)
  }

  // Method to find a ProductVariant by ID
  static async find(id: number): Promise<ProductVariantModel | undefined> {
    const instance = new ProductVariantModel(undefined)

    return await instance.applyFind(id)
  }

  static async first(): Promise<ProductVariantModel | undefined> {
    const instance = new ProductVariantModel(undefined)

    const model = await instance.applyFirst()

    const data = new ProductVariantModel(model)

    return data
  }

  static async firstOrFail(): Promise<ProductVariantModel | undefined> {
    const instance = new ProductVariantModel(undefined)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<ProductVariantModel[]> {
    const instance = new ProductVariantModel(undefined)

    const models = await DB.instance.selectFrom('product_variants').selectAll().execute()

    instance.mapCustomGetters(models)

    const data = await Promise.all(models.map(async (model: ProductVariantJsonResponse) => {
      return new ProductVariantModel(model)
    }))

    return data
  }

  static async findOrFail(id: number): Promise<ProductVariantModel | undefined> {
    const instance = new ProductVariantModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  static async findMany(ids: number[]): Promise<ProductVariantModel[]> {
    const instance = new ProductVariantModel(undefined)

    const models = await instance.applyFindMany(ids)

    return models.map((modelItem: UserJsonResponse) => instance.parseResult(new ProductVariantModel(modelItem)))
  }

  static skip(count: number): ProductVariantModel {
    const instance = new ProductVariantModel(undefined)

    return instance.applySkip(count)
  }

  static take(count: number): ProductVariantModel {
    const instance = new ProductVariantModel(undefined)

    return instance.applyTake(count)
  }

  static where<V = string>(column: keyof ProductVariantsTable, ...args: [V] | [Operator, V]): ProductVariantModel {
    const instance = new ProductVariantModel(undefined)

    return instance.applyWhere<V>(column, ...args)
  }

  static orWhere(...conditions: [string, any][]): ProductVariantModel {
    const instance = new ProductVariantModel(undefined)

    return instance.applyOrWhere(...conditions)
  }

  static whereNotIn<V = number>(column: keyof ProductVariantsTable, values: V[]): ProductVariantModel {
    const instance = new ProductVariantModel(undefined)

    return instance.applyWhereNotIn<V>(column, values)
  }

  static whereBetween<V = number>(column: keyof ProductVariantsTable, range: [V, V]): ProductVariantModel {
    const instance = new ProductVariantModel(undefined)

    return instance.applyWhereBetween<V>(column, range)
  }

  static whereRef(column: keyof ProductVariantsTable, ...args: string[]): ProductVariantModel {
    const instance = new ProductVariantModel(undefined)

    return instance.applyWhereRef(column, ...args)
  }

  static when(condition: boolean, callback: (query: ProductVariantModel) => ProductVariantModel): ProductVariantModel {
    const instance = new ProductVariantModel(undefined)

    return instance.applyWhen(condition, callback as any)
  }

  static whereLike(column: keyof ProductVariantsTable, value: string): ProductVariantModel {
    const instance = new ProductVariantModel(undefined)

    return instance.applyWhereLike(column, value)
  }

  static orderBy(column: keyof ProductVariantsTable, order: 'asc' | 'desc'): ProductVariantModel {
    const instance = new ProductVariantModel(undefined)

    return instance.applyOrderBy(column, order)
  }

  static orderByAsc(column: keyof ProductVariantsTable): ProductVariantModel {
    const instance = new ProductVariantModel(undefined)

    return instance.applyOrderByAsc(column)
  }

  static orderByDesc(column: keyof ProductVariantsTable): ProductVariantModel {
    const instance = new ProductVariantModel(undefined)

    return instance.applyOrderByDesc(column)
  }

  static inRandomOrder(): ProductVariantModel {
    const instance = new ProductVariantModel(undefined)

    return instance.applyInRandomOrder()
  }

  static whereColumn(first: keyof ProductVariantsTable, operator: Operator, second: keyof ProductVariantsTable): ProductVariantModel {
    const instance = new ProductVariantModel(undefined)

    return instance.applyWhereColumn(first, operator, second)
  }

  static async max(field: keyof ProductVariantsTable): Promise<number> {
    const instance = new ProductVariantModel(undefined)

    return await instance.applyMax(field)
  }

  static async min(field: keyof ProductVariantsTable): Promise<number> {
    const instance = new ProductVariantModel(undefined)

    return await instance.applyMin(field)
  }

  static async avg(field: keyof ProductVariantsTable): Promise<number> {
    const instance = new ProductVariantModel(undefined)

    return await instance.applyAvg(field)
  }

  static async sum(field: keyof ProductVariantsTable): Promise<number> {
    const instance = new ProductVariantModel(undefined)

    return await instance.applySum(field)
  }

  static async count(): Promise<number> {
    const instance = new ProductVariantModel(undefined)

    return instance.applyCount()
  }

  static async get(): Promise<ProductVariantModel[]> {
    const instance = new ProductVariantModel(undefined)

    const results = await instance.applyGet()

    return results.map((item: ProductVariantJsonResponse) => new ProductVariantModel(item))
  }

  static async pluck<K extends keyof ProductVariantModel>(field: K): Promise<ProductVariantModel[K][]> {
    const instance = new ProductVariantModel(undefined)

    return await instance.applyPluck(field)
  }

  static async chunk(size: number, callback: (models: ProductVariantModel[]) => Promise<void>): Promise<void> {
    const instance = new ProductVariantModel(undefined)

    await instance.applyChunk(size, async (models) => {
      const modelInstances = models.map((item: ProductVariantJsonResponse) => new ProductVariantModel(item))
      await callback(modelInstances)
    })
  }

  static async paginate(options: { limit?: number, offset?: number, page?: number } = { limit: 10, offset: 0, page: 1 }): Promise<{
    data: ProductVariantModel[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }> {
    const instance = new ProductVariantModel(undefined)

    const result = await instance.applyPaginate(options)

    return {
      data: result.data.map((item: ProductVariantJsonResponse) => new ProductVariantModel(item)),
      paging: result.paging,
      next_cursor: result.next_cursor,
    }
  }

  async applyCreate(newProductVariant: NewProductVariant): Promise<ProductVariantModel> {
    const filteredValues = Object.fromEntries(
      Object.entries(newProductVariant).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewProductVariant

    await this.mapCustomSetters(filteredValues)

    filteredValues.uuid = randomUUIDv7()

    const result = await DB.instance.insertInto('product_variants')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await this.find(Number(result.numInsertedOrUpdatedRows)) as ProductVariantModel

    if (model)
      dispatch('productVariant:created', model)

    return model
  }

  async create(newProductVariant: NewProductVariant): Promise<ProductVariantModel> {
    return await this.applyCreate(newProductVariant)
  }

  static async create(newProductVariant: NewProductVariant): Promise<ProductVariantModel> {
    const instance = new ProductVariantModel(undefined)

    return await instance.applyCreate(newProductVariant)
  }

  static async firstOrCreate(search: Partial<ProductVariantsTable>, values: NewProductVariant = {} as NewProductVariant): Promise<ProductVariantModel> {
    // First try to find a record matching the search criteria
    const instance = new ProductVariantModel(undefined)

    // Apply all search conditions
    for (const [key, value] of Object.entries(search)) {
      instance.selectFromQuery = instance.selectFromQuery.where(key, '=', value)
    }

    // Try to find the record
    const existingRecord = await instance.applyFirst()

    if (existingRecord) {
      return new ProductVariantModel(existingRecord)
    }

    // If no record exists, create a new one with combined search criteria and values
    const createData = { ...search, ...values } as NewProductVariant
    return await ProductVariantModel.create(createData)
  }

  async update(newProductVariant: ProductVariantUpdate): Promise<ProductVariantModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newProductVariant).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as ProductVariantUpdate

    await this.mapCustomSetters(filteredValues)

    await DB.instance.updateTable('product_variants')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      const model = await this.find(this.id)

      if (model)
        dispatch('productVariant:updated', model)

      return model
    }

    this.hasSaved = true

    return undefined
  }

  async forceUpdate(newProductVariant: ProductVariantUpdate): Promise<ProductVariantModel | undefined> {
    await DB.instance.updateTable('product_variants')
      .set(newProductVariant)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      const model = await this.find(this.id)

      if (model)
        dispatch('productVariant:updated', model)

      return model
    }

    return undefined
  }

  static async createMany(newProductVariant: NewProductVariant[]): Promise<void> {
    const instance = new ProductVariantModel(undefined)

    const valuesFiltered = newProductVariant.map((newProductVariant: NewProductVariant) => {
      const filteredValues = Object.fromEntries(
        Object.entries(newProductVariant).filter(([key]) =>
          !instance.guarded.includes(key) && instance.fillable.includes(key),
        ),
      ) as NewProductVariant

      filteredValues.uuid = randomUUIDv7()

      return filteredValues
    })

    await DB.instance.insertInto('product_variants')
      .values(valuesFiltered)
      .executeTakeFirst()
  }

  static async forceCreate(newProductVariant: NewProductVariant): Promise<ProductVariantModel> {
    const result = await DB.instance.insertInto('product_variants')
      .values(newProductVariant)
      .executeTakeFirst()

    const model = await find(Number(result.numInsertedOrUpdatedRows)) as ProductVariantModel

    if (model)
      dispatch('productVariant:created', model)

    return model
  }

  // Method to remove a ProductVariant
  async delete(): Promise<number> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()
    const model = await this.find(Number(this.id))

    if (model)
      dispatch('productVariant:deleted', model)

    const deleted = await DB.instance.deleteFrom('product_variants')
      .where('id', '=', this.id)
      .execute()

    return deleted.numDeletedRows
  }

  static async remove(id: number): Promise<any> {
    const instance = new ProductVariantModel(undefined)

    const model = await instance.find(Number(id))

    if (model)
      dispatch('productVariant:deleted', model)

    return await DB.instance.deleteFrom('product_variants')
      .where('id', '=', id)
      .execute()
  }

  static whereVariant(value: string): ProductVariantModel {
    const instance = new ProductVariantModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('variant', '=', value)

    return instance
  }

  static whereType(value: string): ProductVariantModel {
    const instance = new ProductVariantModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('type', '=', value)

    return instance
  }

  static whereDescription(value: string): ProductVariantModel {
    const instance = new ProductVariantModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('description', '=', value)

    return instance
  }

  static whereOptions(value: string): ProductVariantModel {
    const instance = new ProductVariantModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('options', '=', value)

    return instance
  }

  static whereStatus(value: string): ProductVariantModel {
    const instance = new ProductVariantModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('status', '=', value)

    return instance
  }

  static whereIn<V = number>(column: keyof ProductVariantsTable, values: V[]): ProductVariantModel {
    const instance = new ProductVariantModel(undefined)

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

  toSearchableObject(): Partial<ProductVariantJsonResponse> {
    return {
      id: this.id,
      product_id: this.product_id,
      variant: this.variant,
      type: this.type,
      description: this.description,
      options: this.options,
      status: this.status,
    }
  }

  static distinct(column: keyof ProductVariantJsonResponse): ProductVariantModel {
    const instance = new ProductVariantModel(undefined)

    return instance.applyDistinct(column)
  }

  static join(table: string, firstCol: string, secondCol: string): ProductVariantModel {
    const instance = new ProductVariantModel(undefined)

    return instance.applyJoin(table, firstCol, secondCol)
  }

  toJSON(): ProductVariantJsonResponse {
    const output = {

      uuid: this.uuid,

      id: this.id,
      variant: this.variant,
      type: this.type,
      description: this.description,
      options: this.options,
      status: this.status,

      created_at: this.created_at,

      updated_at: this.updated_at,

      product_id: this.product_id,
      product: this.product,
      ...this.customColumns,
    }

    return output
  }

  parseResult(model: ProductVariantModel): ProductVariantModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof ProductVariantModel]
    }

    return model
  }
}

async function find(id: number): Promise<ProductVariantModel | undefined> {
  const query = DB.instance.selectFrom('product_variants').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  return new ProductVariantModel(model)
}

export async function count(): Promise<number> {
  const results = await ProductVariantModel.count()

  return results
}

export async function create(newProductVariant: NewProductVariant): Promise<ProductVariantModel> {
  const result = await DB.instance.insertInto('product_variants')
    .values(newProductVariant)
    .executeTakeFirstOrThrow()

  return await find(Number(result.numInsertedOrUpdatedRows)) as ProductVariantModel
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(DB.instance)
}

export async function remove(id: number): Promise<void> {
  await DB.instance.deleteFrom('product_variants')
    .where('id', '=', id)
    .execute()
}

export async function whereVariant(value: string): Promise<ProductVariantModel[]> {
  const query = DB.instance.selectFrom('product_variants').where('variant', '=', value)
  const results: ProductVariantJsonResponse = await query.execute()

  return results.map((modelItem: ProductVariantJsonResponse) => new ProductVariantModel(modelItem))
}

export async function whereType(value: string): Promise<ProductVariantModel[]> {
  const query = DB.instance.selectFrom('product_variants').where('type', '=', value)
  const results: ProductVariantJsonResponse = await query.execute()

  return results.map((modelItem: ProductVariantJsonResponse) => new ProductVariantModel(modelItem))
}

export async function whereDescription(value: string): Promise<ProductVariantModel[]> {
  const query = DB.instance.selectFrom('product_variants').where('description', '=', value)
  const results: ProductVariantJsonResponse = await query.execute()

  return results.map((modelItem: ProductVariantJsonResponse) => new ProductVariantModel(modelItem))
}

export async function whereOptions(value: string): Promise<ProductVariantModel[]> {
  const query = DB.instance.selectFrom('product_variants').where('options', '=', value)
  const results: ProductVariantJsonResponse = await query.execute()

  return results.map((modelItem: ProductVariantJsonResponse) => new ProductVariantModel(modelItem))
}

export async function whereStatus(value: string | string[]): Promise<ProductVariantModel[]> {
  const query = DB.instance.selectFrom('product_variants').where('status', '=', value)
  const results: ProductVariantJsonResponse = await query.execute()

  return results.map((modelItem: ProductVariantJsonResponse) => new ProductVariantModel(modelItem))
}

export const ProductVariant = ProductVariantModel

export default ProductVariant
