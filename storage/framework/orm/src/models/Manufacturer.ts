import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { ProductModel } from './Product'
import { randomUUIDv7 } from 'bun'
import { sql } from '@stacksjs/database'
import { dispatch } from '@stacksjs/events'
import { BaseOrm, DB } from '@stacksjs/orm'

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

  /**
   * This model inherits many query methods from BaseOrm:
   * - pluck, chunk, whereExists, has, doesntHave, whereHas, whereDoesntHave
   * - inRandomOrder, max, min, avg, paginate, get, and more
   *
   * See BaseOrm class for the full list of inherited methods.
   */

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

  async mapCustomSetters(model: NewManufacturer | ManufacturerUpdate): Promise<void> {
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

  static select(params: (keyof ManufacturerJsonResponse)[] | RawBuilder<string> | string): ManufacturerModel {
    const instance = new ManufacturerModel(undefined)

    return instance.applySelect(params)
  }

  // Method to find a Manufacturer by ID
  static async find(id: number): Promise<ManufacturerModel | undefined> {
    const instance = new ManufacturerModel(undefined)

    return await instance.applyFind(id)
  }

  static async first(): Promise<ManufacturerModel | undefined> {
    const instance = new ManufacturerModel(undefined)

    const model = await instance.applyFirst()

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

  static async findOrFail(id: number): Promise<ManufacturerModel | undefined> {
    const instance = new ManufacturerModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  static async findMany(ids: number[]): Promise<ManufacturerModel[]> {
    const instance = new ManufacturerModel(undefined)

    const models = await instance.applyFindMany(ids)

    return models.map((modelItem: UserJsonResponse) => instance.parseResult(new ManufacturerModel(modelItem)))
  }

  static skip(count: number): ManufacturerModel {
    const instance = new ManufacturerModel(undefined)

    return instance.applySkip(count)
  }

  static take(count: number): ManufacturerModel {
    const instance = new ManufacturerModel(undefined)

    return instance.applyTake(count)
  }

  static where<V = string>(column: keyof ManufacturersTable, ...args: [V] | [Operator, V]): ManufacturerModel {
    const instance = new ManufacturerModel(undefined)

    return instance.applyWhere<V>(column, ...args)
  }

  static whereLike(column: keyof ManufacturersTable, value: string): ManufacturerModel {
    const instance = new ManufacturerModel(undefined)

    return instance.applyWhereLike(column, value)
  }

  static orderBy(column: keyof ManufacturersTable, order: 'asc' | 'desc'): ManufacturerModel {
    const instance = new ManufacturerModel(undefined)

    return instance.applyOrderBy(column, order)
  }

  static orderByAsc(column: keyof ManufacturersTable): ManufacturerModel {
    const instance = new ManufacturerModel(undefined)

    return instance.applyOrderByAsc(column)
  }

  static orderByDesc(column: keyof ManufacturersTable): ManufacturerModel {
    const instance = new ManufacturerModel(undefined)

    return instance.applyOrderByDesc(column)
  }

  static async max(field: keyof ManufacturersTable): Promise<number> {
    const instance = new ManufacturerModel(undefined)

    return await instance.applyMax(field)
  }

  static async min(field: keyof ManufacturersTable): Promise<number> {
    const instance = new ManufacturerModel(undefined)

    return await instance.applyMin(field)
  }

  static async avg(field: keyof ManufacturersTable): Promise<number> {
    const instance = new ManufacturerModel(undefined)

    return await instance.applyAvg(field)
  }

  static async sum(field: keyof ManufacturersTable): Promise<number> {
    const instance = new ManufacturerModel(undefined)

    return await instance.applySum(field)
  }

  static async count(): Promise<number> {
    const instance = new ManufacturerModel(undefined)

    return instance.applyCount()
  }

  static async paginate(options: { limit?: number, offset?: number, page?: number } = { limit: 10, offset: 0, page: 1 }): Promise<{
    data: ManufacturerModel[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }> {
    const instance = new ManufacturerModel(undefined)

    const result = await instance.applyPaginate(options)

    return {
      data: result.data.map((item: ManufacturerJsonResponse) => new ManufacturerModel(item)),
      paging: result.paging,
      next_cursor: result.next_cursor,
    }
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

  async update(newManufacturer: ManufacturerUpdate): Promise<ManufacturerModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newManufacturer).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as ManufacturerUpdate

    await this.mapCustomSetters(filteredValues)

    await DB.instance.updateTable('manufacturers')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      const model = await this.find(this.id)

      if (model)
        dispatch('manufacturer:updated', model)

      return model
    }

    this.hasSaved = true

    return undefined
  }

  async forceUpdate(newManufacturer: ManufacturerUpdate): Promise<ManufacturerModel | undefined> {
    await DB.instance.updateTable('manufacturers')
      .set(newManufacturer)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      const model = await this.find(this.id)

      if (model)
        dispatch('manufacturer:updated', model)

      return model
    }

    return undefined
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
  async delete(): Promise<number> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()
    const model = await this.find(Number(this.id))

    if (model)
      dispatch('manufacturer:deleted', model)

    const deleted = await DB.instance.deleteFrom('manufacturers')
      .where('id', '=', this.id)
      .execute()

    return deleted.numDeletedRows
  }

  static async remove(id: number): Promise<any> {
    const instance = new ManufacturerModel(undefined)

    const model = await instance.find(Number(id))

    if (model)
      dispatch('manufacturer:deleted', model)

    return await DB.instance.deleteFrom('manufacturers')
      .where('id', '=', id)
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

  static whereIn<V = number>(column: keyof ManufacturersTable, values: V[]): ManufacturerModel {
    const instance = new ManufacturerModel(undefined)

    return instance.applyWhereIn<V>(column, values)
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

  static distinct(column: keyof ManufacturerJsonResponse): ManufacturerModel {
    const instance = new ManufacturerModel(undefined)

    return instance.applyDistinct(column)
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
