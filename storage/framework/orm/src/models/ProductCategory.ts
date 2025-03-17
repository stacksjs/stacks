import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { ProductModel } from './Product'
import { randomUUIDv7 } from 'bun'
import { sql } from '@stacksjs/database'
import { dispatch } from '@stacksjs/events'
import { BaseOrm, DB } from '@stacksjs/orm'

export interface ProductCategoriesTable {
  id: Generated<number>
  name: string
  description?: string
  image_url?: string
  is_active?: boolean
  parent_category_id?: string
  display_order: number
  uuid?: string

  created_at?: Date

  updated_at?: Date

}

export interface ProductCategoryResponse {
  data: ProductCategoryJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface ProductCategoryJsonResponse extends Omit<Selectable<ProductCategoriesTable>, 'password'> {
  [key: string]: any
}

export type NewProductCategory = Insertable<ProductCategoriesTable>
export type ProductCategoryUpdate = Updateable<ProductCategoriesTable>

export class ProductCategoryModel extends BaseOrm<ProductCategoryModel, ProductCategoriesTable, ProductCategoryJsonResponse> {
  private readonly hidden: Array<keyof ProductCategoryJsonResponse> = []
  private readonly fillable: Array<keyof ProductCategoryJsonResponse> = ['name', 'description', 'image_url', 'is_active', 'parent_category_id', 'display_order', 'uuid']
  private readonly guarded: Array<keyof ProductCategoryJsonResponse> = []
  protected attributes = {} as ProductCategoryJsonResponse
  protected originalAttributes = {} as ProductCategoryJsonResponse

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

  constructor(productCategory: ProductCategoryJsonResponse | undefined) {
    super('product_categories')
    if (productCategory) {
      this.attributes = { ...productCategory }
      this.originalAttributes = { ...productCategory }

      Object.keys(productCategory).forEach((key) => {
        if (!(key in this)) {
          this.customColumns[key] = (productCategory as ProductCategoryJsonResponse)[key]
        }
      })
    }

    this.withRelations = []
    this.selectFromQuery = DB.instance.selectFrom('product_categories')
    this.updateFromQuery = DB.instance.updateTable('product_categories')
    this.deleteFromQuery = DB.instance.deleteFrom('product_categories')
    this.hasSelect = false
    this.hasSaved = false
  }

  protected async loadRelations(models: ProductCategoryJsonResponse | ProductCategoryJsonResponse[]): Promise<void> {
    // Handle both single model and array of models
    const modelArray = Array.isArray(models) ? models : [models]
    if (!modelArray.length)
      return

    const modelIds = modelArray.map(model => model.id)

    for (const relation of this.withRelations) {
      const relatedRecords = await DB.instance
        .selectFrom(relation)
        .where('productCategory_id', 'in', modelIds)
        .selectAll()
        .execute()

      if (Array.isArray(models)) {
        models.map((model: ProductCategoryJsonResponse) => {
          const records = relatedRecords.filter((record: { productCategory_id: number }) => {
            return record.productCategory_id === model.id
          })

          model[relation] = records.length === 1 ? records[0] : records
          return model
        })
      }
      else {
        const records = relatedRecords.filter((record: { productCategory_id: number }) => {
          return record.productCategory_id === models.id
        })

        models[relation] = records.length === 1 ? records[0] : records
      }
    }
  }

  static with(relations: string[]): ProductCategoryModel {
    const instance = new ProductCategoryModel(undefined)

    return instance.applyWith(relations)
  }

  protected mapCustomGetters(models: ProductCategoryJsonResponse | ProductCategoryJsonResponse[]): void {
    const data = models

    if (Array.isArray(data)) {
      data.map((model: ProductCategoryJsonResponse) => {
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

  async mapCustomSetters(model: NewProductCategory | ProductCategoryUpdate): Promise<void> {
    const customSetter = {
      default: () => {
      },

    }

    for (const [key, fn] of Object.entries(customSetter)) {
      (model as any)[key] = await fn()
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

  get name(): string {
    return this.attributes.name
  }

  get description(): string | undefined {
    return this.attributes.description
  }

  get image_url(): string | undefined {
    return this.attributes.image_url
  }

  get is_active(): boolean | undefined {
    return this.attributes.is_active
  }

  get parent_category_id(): string | undefined {
    return this.attributes.parent_category_id
  }

  get display_order(): number {
    return this.attributes.display_order
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

  set image_url(value: string) {
    this.attributes.image_url = value
  }

  set is_active(value: boolean) {
    this.attributes.is_active = value
  }

  set parent_category_id(value: string) {
    this.attributes.parent_category_id = value
  }

  set display_order(value: number) {
    this.attributes.display_order = value
  }

  set updated_at(value: Date) {
    this.attributes.updated_at = value
  }

  static select(params: (keyof ProductCategoryJsonResponse)[] | RawBuilder<string> | string): ProductCategoryModel {
    const instance = new ProductCategoryModel(undefined)

    return instance.applySelect(params)
  }

  // Method to find a ProductCategory by ID
  static async find(id: number): Promise<ProductCategoryModel | undefined> {
    const instance = new ProductCategoryModel(undefined)

    return await instance.applyFind(id)
  }

  static async first(): Promise<ProductCategoryModel | undefined> {
    const instance = new ProductCategoryModel(undefined)

    const model = await instance.applyFirst()

    const data = new ProductCategoryModel(model)

    return data
  }

  static async firstOrFail(): Promise<ProductCategoryModel | undefined> {
    const instance = new ProductCategoryModel(undefined)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<ProductCategoryModel[]> {
    const instance = new ProductCategoryModel(undefined)

    const models = await DB.instance.selectFrom('product_categories').selectAll().execute()

    instance.mapCustomGetters(models)

    const data = await Promise.all(models.map(async (model: ProductCategoryJsonResponse) => {
      return new ProductCategoryModel(model)
    }))

    return data
  }

  static async findOrFail(id: number): Promise<ProductCategoryModel | undefined> {
    const instance = new ProductCategoryModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  static async findMany(ids: number[]): Promise<ProductCategoryModel[]> {
    const instance = new ProductCategoryModel(undefined)

    const models = await instance.applyFindMany(ids)

    return models.map((modelItem: UserJsonResponse) => instance.parseResult(new ProductCategoryModel(modelItem)))
  }

  static skip(count: number): ProductCategoryModel {
    const instance = new ProductCategoryModel(undefined)

    return instance.applySkip(count)
  }

  static take(count: number): ProductCategoryModel {
    const instance = new ProductCategoryModel(undefined)

    return instance.applyTake(count)
  }

  static async count(): Promise<number> {
    const instance = new ProductCategoryModel(undefined)

    return instance.applyCount()
  }

  async applyCreate(newProductCategory: NewProductCategory): Promise<ProductCategoryModel> {
    const filteredValues = Object.fromEntries(
      Object.entries(newProductCategory).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewProductCategory

    await this.mapCustomSetters(filteredValues)

    filteredValues.uuid = randomUUIDv7()

    const result = await DB.instance.insertInto('product_categories')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await this.find(Number(result.numInsertedOrUpdatedRows)) as ProductCategoryModel

    if (model)
      dispatch('productCategory:created', model)

    return model
  }

  async create(newProductCategory: NewProductCategory): Promise<ProductCategoryModel> {
    return await this.applyCreate(newProductCategory)
  }

  static async create(newProductCategory: NewProductCategory): Promise<ProductCategoryModel> {
    const instance = new ProductCategoryModel(undefined)

    return await instance.applyCreate(newProductCategory)
  }

  async update(newProductCategory: ProductCategoryUpdate): Promise<ProductCategoryModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newProductCategory).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as ProductCategoryUpdate

    await this.mapCustomSetters(filteredValues)

    await DB.instance.updateTable('product_categories')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      const model = await this.find(this.id)

      if (model)
        dispatch('productCategory:updated', model)

      return model
    }

    this.hasSaved = true

    return undefined
  }

  async forceUpdate(newProductCategory: ProductCategoryUpdate): Promise<ProductCategoryModel | undefined> {
    await DB.instance.updateTable('product_categories')
      .set(newProductCategory)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      const model = await this.find(this.id)

      if (model)
        dispatch('productCategory:updated', model)

      return model
    }

    return undefined
  }

  static async createMany(newProductCategory: NewProductCategory[]): Promise<void> {
    const instance = new ProductCategoryModel(undefined)

    const valuesFiltered = newProductCategory.map((newProductCategory: NewProductCategory) => {
      const filteredValues = Object.fromEntries(
        Object.entries(newProductCategory).filter(([key]) =>
          !instance.guarded.includes(key) && instance.fillable.includes(key),
        ),
      ) as NewProductCategory

      filteredValues.uuid = randomUUIDv7()

      return filteredValues
    })

    await DB.instance.insertInto('product_categories')
      .values(valuesFiltered)
      .executeTakeFirst()
  }

  static async forceCreate(newProductCategory: NewProductCategory): Promise<ProductCategoryModel> {
    const result = await DB.instance.insertInto('product_categories')
      .values(newProductCategory)
      .executeTakeFirst()

    const model = await find(Number(result.numInsertedOrUpdatedRows)) as ProductCategoryModel

    if (model)
      dispatch('productCategory:created', model)

    return model
  }

  // Method to remove a ProductCategory
  async delete(): Promise<number> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()
    const model = await this.find(Number(this.id))

    if (model)
      dispatch('productCategory:deleted', model)

    const deleted = await DB.instance.deleteFrom('product_categories')
      .where('id', '=', this.id)
      .execute()

    return deleted.numDeletedRows
  }

  static async remove(id: number): Promise<any> {
    const instance = new ProductCategoryModel(undefined)

    const model = await instance.find(Number(id))

    if (model)
      dispatch('productCategory:deleted', model)

    return await DB.instance.deleteFrom('product_categories')
      .where('id', '=', id)
      .execute()
  }

  static whereName(value: string): ProductCategoryModel {
    const instance = new ProductCategoryModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('name', '=', value)

    return instance
  }

  static whereDescription(value: string): ProductCategoryModel {
    const instance = new ProductCategoryModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('description', '=', value)

    return instance
  }

  static whereImageUrl(value: string): ProductCategoryModel {
    const instance = new ProductCategoryModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('image_url', '=', value)

    return instance
  }

  static whereIsActive(value: string): ProductCategoryModel {
    const instance = new ProductCategoryModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('is_active', '=', value)

    return instance
  }

  static whereParentCategoryId(value: string): ProductCategoryModel {
    const instance = new ProductCategoryModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('parent_category_id', '=', value)

    return instance
  }

  static whereDisplayOrder(value: string): ProductCategoryModel {
    const instance = new ProductCategoryModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('display_order', '=', value)

    return instance
  }

  static whereIn<V = number>(column: keyof ProductCategoriesTable, values: V[]): ProductCategoryModel {
    const instance = new ProductCategoryModel(undefined)

    return instance.applyWhereIn<V>(column, values)
  }

  toSearchableObject(): Partial<ProductCategoryJsonResponse> {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      is_active: this.is_active,
      parent_category_id: this.parent_category_id,
      display_order: this.display_order,
    }
  }

  static distinct(column: keyof ProductCategoryJsonResponse): ProductCategoryModel {
    const instance = new ProductCategoryModel(undefined)

    return instance.applyDistinct(column)
  }

  static join(table: string, firstCol: string, secondCol: string): ProductCategoryModel {
    const instance = new ProductCategoryModel(undefined)

    return instance.applyJoin(table, firstCol, secondCol)
  }

  toJSON(): ProductCategoryJsonResponse {
    const output = {

      uuid: this.uuid,

      id: this.id,
      name: this.name,
      description: this.description,
      image_url: this.image_url,
      is_active: this.is_active,
      parent_category_id: this.parent_category_id,
      display_order: this.display_order,

      created_at: this.created_at,

      updated_at: this.updated_at,

      products: this.products,
      ...this.customColumns,
    }

    return output
  }

  parseResult(model: ProductCategoryModel): ProductCategoryModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof ProductCategoryModel]
    }

    return model
  }
}

async function find(id: number): Promise<ProductCategoryModel | undefined> {
  const query = DB.instance.selectFrom('product_categories').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  return new ProductCategoryModel(model)
}

export async function count(): Promise<number> {
  const results = await ProductCategoryModel.count()

  return results
}

export async function create(newProductCategory: NewProductCategory): Promise<ProductCategoryModel> {
  const result = await DB.instance.insertInto('product_categories')
    .values(newProductCategory)
    .executeTakeFirstOrThrow()

  return await find(Number(result.numInsertedOrUpdatedRows)) as ProductCategoryModel
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(DB.instance)
}

export async function remove(id: number): Promise<void> {
  await DB.instance.deleteFrom('product_categories')
    .where('id', '=', id)
    .execute()
}

export async function whereName(value: string): Promise<ProductCategoryModel[]> {
  const query = DB.instance.selectFrom('product_categories').where('name', '=', value)
  const results: ProductCategoryJsonResponse = await query.execute()

  return results.map((modelItem: ProductCategoryJsonResponse) => new ProductCategoryModel(modelItem))
}

export async function whereDescription(value: string): Promise<ProductCategoryModel[]> {
  const query = DB.instance.selectFrom('product_categories').where('description', '=', value)
  const results: ProductCategoryJsonResponse = await query.execute()

  return results.map((modelItem: ProductCategoryJsonResponse) => new ProductCategoryModel(modelItem))
}

export async function whereImageUrl(value: string): Promise<ProductCategoryModel[]> {
  const query = DB.instance.selectFrom('product_categories').where('image_url', '=', value)
  const results: ProductCategoryJsonResponse = await query.execute()

  return results.map((modelItem: ProductCategoryJsonResponse) => new ProductCategoryModel(modelItem))
}

export async function whereIsActive(value: boolean): Promise<ProductCategoryModel[]> {
  const query = DB.instance.selectFrom('product_categories').where('is_active', '=', value)
  const results: ProductCategoryJsonResponse = await query.execute()

  return results.map((modelItem: ProductCategoryJsonResponse) => new ProductCategoryModel(modelItem))
}

export async function whereParentCategoryId(value: string): Promise<ProductCategoryModel[]> {
  const query = DB.instance.selectFrom('product_categories').where('parent_category_id', '=', value)
  const results: ProductCategoryJsonResponse = await query.execute()

  return results.map((modelItem: ProductCategoryJsonResponse) => new ProductCategoryModel(modelItem))
}

export async function whereDisplayOrder(value: number): Promise<ProductCategoryModel[]> {
  const query = DB.instance.selectFrom('product_categories').where('display_order', '=', value)
  const results: ProductCategoryJsonResponse = await query.execute()

  return results.map((modelItem: ProductCategoryJsonResponse) => new ProductCategoryModel(modelItem))
}

export const ProductCategory = ProductCategoryModel

export default ProductCategory
