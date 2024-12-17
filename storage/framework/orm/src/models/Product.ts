import type { Generated, Insertable, Selectable, Updateable } from 'kysely'
import { randomUUIDv7 } from 'bun'
import { cache } from '@stacksjs/cache'
import { db, sql } from '@stacksjs/database'
import { HttpError } from '@stacksjs/error-handling'

export interface ProductsTable {
  id?: Generated<number>
  name?: string
  description?: number
  key?: number
  unit_price?: number
  status?: string
  image?: string
  provider_id?: string
  uuid?: string

  created_at?: Date

  updated_at?: Date

  deleted_at?: Date

}

interface ProductResponse {
  data: Products
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export type Product = ProductsTable
export type ProductType = Selectable<Product>
export type NewProduct = Insertable<Product>
export type ProductUpdate = Updateable<Product>
export type Products = ProductType[]

export type ProductColumn = Products
export type ProductColumns = Array<keyof Products>

    type SortDirection = 'asc' | 'desc'
interface SortOptions { column: ProductType, order: SortDirection }
// Define a type for the options parameter
interface QueryOptions {
  sort?: SortOptions
  limit?: number
  offset?: number
  page?: number
}

export class ProductModel {
  private hidden = []
  private fillable = ['name', 'description', 'key', 'unit_price', 'status', 'image', 'provider_id', 'uuid']
  private softDeletes = false
  protected selectFromQuery: any
  protected updateFromQuery: any
  protected deleteFromQuery: any
  protected hasSelect: boolean
  public id: number | undefined
  public uuid: string | undefined
  public name: string | undefined
  public description: number | undefined
  public key: number | undefined
  public unit_price: number | undefined
  public status: string | undefined
  public image: string | undefined
  public provider_id: string | undefined

  public created_at: Date | undefined
  public updated_at: Date | undefined

  constructor(product: Partial<ProductType> | null) {
    this.id = product?.id
    this.uuid = product?.uuid
    this.name = product?.name
    this.description = product?.description
    this.key = product?.key
    this.unit_price = product?.unit_price
    this.status = product?.status
    this.image = product?.image
    this.provider_id = product?.provider_id

    this.created_at = product?.created_at

    this.updated_at = product?.updated_at

    this.selectFromQuery = db.selectFrom('products')
    this.updateFromQuery = db.updateTable('products')
    this.deleteFromQuery = db.deleteFrom('products')
    this.hasSelect = false
  }

  // Method to find a Product by ID
  async find(id: number): Promise<ProductModel | undefined> {
    const query = db.selectFrom('products').where('id', '=', id).selectAll()

    const model = await query.executeTakeFirst()

    if (!model)
      return undefined

    cache.getOrSet(`product:${id}`, JSON.stringify(model))

    return this.parseResult(new ProductModel(model))
  }

  // Method to find a Product by ID
  static async find(id: number): Promise<ProductModel | undefined> {
    const query = db.selectFrom('products').where('id', '=', id).selectAll()

    const instance = new ProductModel(null)

    const model = await query.executeTakeFirst()

    if (!model)
      return undefined

    cache.getOrSet(`product:${id}`, JSON.stringify(model))

    return instance.parseResult(new ProductModel(model))
  }

  static async all(): Promise<ProductModel[]> {
    let query = db.selectFrom('products').selectAll()

    const instance = new ProductModel(null)

    if (instance.softDeletes) {
      query = query.where('deleted_at', 'is', null)
    }

    const results = await query.execute()

    return results.map(modelItem => instance.parseResult(new ProductModel(modelItem)))
  }

  static async findOrFail(id: number): Promise<ProductModel> {
    let query = db.selectFrom('products').where('id', '=', id)

    const instance = new ProductModel(null)

    if (instance.softDeletes) {
      query = query.where('deleted_at', 'is', null)
    }

    query = query.selectAll()

    const model = await query.executeTakeFirst()

    if (model === undefined)
      throw new HttpError(404, `No ProductModel results for ${id}`)

    cache.getOrSet(`product:${id}`, JSON.stringify(model))

    return instance.parseResult(new ProductModel(model))
  }

  static async findMany(ids: number[]): Promise<ProductModel[]> {
    let query = db.selectFrom('products').where('id', 'in', ids)

    const instance = new ProductModel(null)

    if (instance.softDeletes) {
      query = query.where('deleted_at', 'is', null)
    }

    query = query.selectAll()

    const model = await query.execute()

    return model.map(modelItem => instance.parseResult(new ProductModel(modelItem)))
  }

  // Method to get a User by criteria
  static async get(): Promise<ProductModel[]> {
    const instance = new ProductModel(null)

    if (instance.hasSelect) {
      if (instance.softDeletes) {
        instance.selectFromQuery = instance.selectFromQuery.where('deleted_at', 'is', null)
      }

      const model = await instance.selectFromQuery.execute()

      return model.map((modelItem: ProductModel) => new ProductModel(modelItem))
    }

    if (instance.softDeletes) {
      instance.selectFromQuery = instance.selectFromQuery.where('deleted_at', 'is', null)
    }

    const model = await instance.selectFromQuery.selectAll().execute()

    return model.map((modelItem: ProductModel) => new ProductModel(modelItem))
  }

  // Method to get a Product by criteria
  async get(): Promise<ProductModel[]> {
    if (this.hasSelect) {
      if (this.softDeletes) {
        this.selectFromQuery = this.selectFromQuery.where('deleted_at', 'is', null)
      }

      const model = await this.selectFromQuery.execute()

      return model.map((modelItem: ProductModel) => new ProductModel(modelItem))
    }

    if (this.softDeletes) {
      this.selectFromQuery = this.selectFromQuery.where('deleted_at', 'is', null)
    }

    const model = await this.selectFromQuery.selectAll().execute()

    return model.map((modelItem: ProductModel) => new ProductModel(modelItem))
  }

  static async count(): Promise<number> {
    const instance = new ProductModel(null)

    if (instance.softDeletes) {
      instance.selectFromQuery = instance.selectFromQuery.where('deleted_at', 'is', null)
    }

    const results = await instance.selectFromQuery.selectAll().execute()

    return results.length
  }

  async count(): Promise<number> {
    if (this.hasSelect) {
      if (this.softDeletes) {
        this.selectFromQuery = this.selectFromQuery.where('deleted_at', 'is', null)
      }

      const results = await this.selectFromQuery.execute()

      return results.length
    }

    const results = await this.selectFromQuery.execute()

    return results.length
  }

  // Method to get all products
  static async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<ProductResponse> {
    const totalRecordsResult = await db.selectFrom('products')
      .select(db.fn.count('id').as('total')) // Use 'id' or another actual column name
      .executeTakeFirst()

    const totalRecords = Number(totalRecordsResult?.total) || 0
    const totalPages = Math.ceil(totalRecords / (options.limit ?? 10))

    const productsWithExtra = await db.selectFrom('products')
      .selectAll()
      .orderBy('id', 'asc') // Assuming 'id' is used for cursor-based pagination
      .limit((options.limit ?? 10) + 1) // Fetch one extra record
      .offset(((options.page ?? 1) - 1) * (options.limit ?? 10)) // Ensure options.page is not undefined
      .execute()

    let nextCursor = null
    if (productsWithExtra.length > (options.limit ?? 10))
      nextCursor = productsWithExtra.pop()?.id ?? null

    return {
      data: productsWithExtra,
      paging: {
        total_records: totalRecords,
        page: options.page || 1,
        total_pages: totalPages,
      },
      next_cursor: nextCursor,
    }
  }

  // Method to create a new product
  static async create(newProduct: NewProduct): Promise<ProductModel> {
    const instance = new ProductModel(null)

    const filteredValues = Object.fromEntries(
      Object.entries(newProduct).filter(([key]) => instance.fillable.includes(key)),
    ) as NewProduct

    filteredValues.uuid = randomUUIDv7()

    const result = await db.insertInto('products')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await find(Number(result.insertId)) as ProductModel

    return model
  }

  static async createMany(newProducts: NewProduct[]): Promise<void> {
    const instance = new ProductModel(null)

    const filteredValues = newProducts.map(newUser =>
      Object.fromEntries(
        Object.entries(newUser).filter(([key]) => instance.fillable.includes(key)),
      ) as NewProduct,
    )

    filteredValues.forEach((model) => {
      model.uuid = randomUUIDv7()
    })

    await db.insertInto('products')
      .values(filteredValues)
      .executeTakeFirst()
  }

  static async forceCreate(newProduct: NewProduct): Promise<ProductModel> {
    const result = await db.insertInto('products')
      .values(newProduct)
      .executeTakeFirst()

    const model = await find(Number(result.insertId)) as ProductModel

    return model
  }

  // Method to remove a Product
  static async remove(id: number): Promise<void> {
    const instance = new ProductModel(null)

    if (instance.softDeletes) {
      await db.updateTable('products')
        .set({
          deleted_at: sql.raw('CURRENT_TIMESTAMP'),
        })
        .where('id', '=', id)
        .execute()
    }
    else {
      await db.deleteFrom('products')
        .where('id', '=', id)
        .execute()
    }
  }

  where(...args: (string | number | boolean | undefined | null)[]): ProductModel {
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

  orWhere(...args: Array<[string, string, any]>): ProductModel {
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

  static orWhere(...args: Array<[string, string, any]>): ProductModel {
    const instance = new ProductModel(null)

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

  static where(...args: (string | number | boolean | undefined | null)[]): ProductModel {
    let column: any
    let operator: any
    let value: any

    const instance = new ProductModel(null)

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

  static whereNull(column: string): ProductModel {
    const instance = new ProductModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    instance.updateFromQuery = instance.updateFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    return instance
  }

  whereNull(column: string): ProductModel {
    this.selectFromQuery = this.selectFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    this.updateFromQuery = this.updateFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    return this
  }

  static whereName(value: string): ProductModel {
    const instance = new ProductModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('name', '=', value)

    return instance
  }

  static whereDescription(value: string): ProductModel {
    const instance = new ProductModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('description', '=', value)

    return instance
  }

  static whereKey(value: string): ProductModel {
    const instance = new ProductModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('key', '=', value)

    return instance
  }

  static whereUnitPrice(value: string): ProductModel {
    const instance = new ProductModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('unitPrice', '=', value)

    return instance
  }

  static whereStatus(value: string): ProductModel {
    const instance = new ProductModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('status', '=', value)

    return instance
  }

  static whereImage(value: string): ProductModel {
    const instance = new ProductModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('image', '=', value)

    return instance
  }

  static whereProviderId(value: string): ProductModel {
    const instance = new ProductModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('providerId', '=', value)

    return instance
  }

  static whereIn(column: keyof ProductType, values: any[]): ProductModel {
    const instance = new ProductModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where(column, 'in', values)

    instance.updateFromQuery = instance.updateFromQuery.where(column, 'in', values)

    instance.deleteFromQuery = instance.deleteFromQuery.where(column, 'in', values)

    return instance
  }

  async first(): Promise<ProductModel | undefined> {
    const model = await this.selectFromQuery.selectAll().executeTakeFirst()

    if (!model) {
      return undefined
    }

    return this.parseResult(new ProductModel(model))
  }

  async firstOrFail(): Promise<ProductModel | undefined> {
    const model = await this.selectFromQuery.executeTakeFirst()

    if (model === undefined)
      throw new HttpError(404, 'No ProductModel results found for query')

    return this.parseResult(new ProductModel(model))
  }

  async exists(): Promise<boolean> {
    const model = await this.selectFromQuery.executeTakeFirst()

    return model !== null || model !== undefined
  }

  static async first(): Promise<ProductType | undefined> {
    return await db.selectFrom('products')
      .selectAll()
      .executeTakeFirst()
  }

  async last(): Promise<ProductType | undefined> {
    return await db.selectFrom('products')
      .selectAll()
      .orderBy('id', 'desc')
      .executeTakeFirst()
  }

  static async last(): Promise<ProductType | undefined> {
    return await db.selectFrom('products').selectAll().orderBy('id', 'desc').executeTakeFirst()
  }

  static orderBy(column: keyof ProductType, order: 'asc' | 'desc'): ProductModel {
    const instance = new ProductModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, order)

    return instance
  }

  orderBy(column: keyof ProductType, order: 'asc' | 'desc'): ProductModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, order)

    return this
  }

  static orderByDesc(column: keyof ProductType): ProductModel {
    const instance = new ProductModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, 'desc')

    return instance
  }

  orderByDesc(column: keyof ProductType): ProductModel {
    this.selectFromQuery = this.orderBy(column, 'desc')

    return this
  }

  static orderByAsc(column: keyof ProductType): ProductModel {
    const instance = new ProductModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, 'asc')

    return instance
  }

  orderByAsc(column: keyof ProductType): ProductModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, 'desc')

    return this
  }

  async update(product: ProductUpdate): Promise<ProductModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(product).filter(([key]) => this.fillable.includes(key)),
    ) as NewProduct

    if (this.id === undefined) {
      this.updateFromQuery.set(filteredValues).execute()
    }

    await db.updateTable('products')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    const model = await this.find(Number(this.id))

    return model
  }

  async forceUpdate(product: ProductUpdate): Promise<ProductModel | undefined> {
    if (this.id === undefined) {
      this.updateFromQuery.set(product).execute()
    }

    await db.updateTable('products')
      .set(product)
      .where('id', '=', this.id)
      .executeTakeFirst()

    const model = await this.find(Number(this.id))

    return model
  }

  async save(): Promise<void> {
    if (!this)
      throw new HttpError(500, 'Product data is undefined')

    if (this.id === undefined) {
      await db.insertInto('products')
        .values(this as NewProduct)
        .executeTakeFirstOrThrow()
    }
    else {
      await this.update(this)
    }
  }

  // Method to delete (soft delete) the product instance
  async delete(): Promise<void> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()

    // Check if soft deletes are enabled
    if (this.softDeletes) {
      // Update the deleted_at column with the current timestamp
      await db.updateTable('products')
        .set({
          deleted_at: sql.raw('CURRENT_TIMESTAMP'),
        })
        .where('id', '=', this.id)
        .execute()
    }
    else {
      // Perform a hard delete
      await db.deleteFrom('products')
        .where('id', '=', this.id)
        .execute()
    }
  }

  distinct(column: keyof ProductType): ProductModel {
    this.selectFromQuery = this.selectFromQuery.select(column).distinct()

    this.hasSelect = true

    return this
  }

  static distinct(column: keyof ProductType): ProductModel {
    const instance = new ProductModel(null)

    instance.selectFromQuery = instance.selectFromQuery.select(column).distinct()

    instance.hasSelect = true

    return instance
  }

  join(table: string, firstCol: string, secondCol: string): ProductModel {
    this.selectFromQuery = this.selectFromQuery(table, firstCol, secondCol)

    return this
  }

  static join(table: string, firstCol: string, secondCol: string): ProductModel {
    const instance = new ProductModel(null)

    instance.selectFromQuery = instance.selectFromQuery.innerJoin(table, firstCol, secondCol)

    return instance
  }

  static async rawQuery(rawQuery: string): Promise<any> {
    return await sql`${rawQuery}`.execute(db)
  }

  toJSON() {
    const output: Partial<ProductType> = {

      id: this.id,
      name: this.name,
      description: this.description,
      key: this.key,
      unit_price: this.unit_price,
      status: this.status,
      image: this.image,
      provider_id: this.provider_id,

      created_at: this.created_at,

      updated_at: this.updated_at,

    }

        type Product = Omit<ProductType, 'password'>

        return output as Product
  }

  parseResult(model: ProductModel): ProductModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof ProductModel]
    }

    return model
  }
}

async function find(id: number): Promise<ProductModel | undefined> {
  const query = db.selectFrom('products').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  return new ProductModel(model)
}

export async function count(): Promise<number> {
  const results = await ProductModel.count()

  return results
}

export async function create(newProduct: NewProduct): Promise<ProductModel> {
  const result = await db.insertInto('products')
    .values(newProduct)
    .executeTakeFirstOrThrow()

  return await find(Number(result.insertId)) as ProductModel
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(db)
}

export async function remove(id: number): Promise<void> {
  await db.deleteFrom('products')
    .where('id', '=', id)
    .execute()
}

export async function whereName(value: string): Promise<ProductModel[]> {
  const query = db.selectFrom('products').where('name', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new ProductModel(modelItem))
}

export async function whereDescription(value: number): Promise<ProductModel[]> {
  const query = db.selectFrom('products').where('description', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new ProductModel(modelItem))
}

export async function whereKey(value: number): Promise<ProductModel[]> {
  const query = db.selectFrom('products').where('key', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new ProductModel(modelItem))
}

export async function whereUnitPrice(value: number): Promise<ProductModel[]> {
  const query = db.selectFrom('products').where('unit_price', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new ProductModel(modelItem))
}

export async function whereStatus(value: string): Promise<ProductModel[]> {
  const query = db.selectFrom('products').where('status', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new ProductModel(modelItem))
}

export async function whereImage(value: string): Promise<ProductModel[]> {
  const query = db.selectFrom('products').where('image', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new ProductModel(modelItem))
}

export async function whereProviderId(value: string): Promise<ProductModel[]> {
  const query = db.selectFrom('products').where('provider_id', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new ProductModel(modelItem))
}

export const Product = ProductModel

export default Product
