import type { RawBuilder } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import type { NewPage, PageJsonResponse, PagesTable, PageUpdate } from '../types/PageType'
import type { AuthorModel } from './Author'
import { randomUUIDv7 } from 'bun'
import { sql } from '@stacksjs/database'
import { HttpError } from '@stacksjs/error-handling'
import { DB } from '@stacksjs/orm'

import { BaseOrm } from '../utils/base'

export class PageModel extends BaseOrm<PageModel, PagesTable, PageJsonResponse> {
  private readonly hidden: Array<keyof PageJsonResponse> = []
  private readonly fillable: Array<keyof PageJsonResponse> = ['title', 'template', 'views', 'published_at', 'conversions', 'uuid']
  private readonly guarded: Array<keyof PageJsonResponse> = []
  protected attributes = {} as PageJsonResponse
  protected originalAttributes = {} as PageJsonResponse

  protected selectFromQuery: any
  protected updateFromQuery: any
  protected deleteFromQuery: any
  protected hasSelect: boolean
  private customColumns: Record<string, unknown> = {}

  /**
   * This model inherits many query methods from BaseOrm:
   * - pluck, chunk, whereExists, has, doesntHave, whereHas, whereDoesntHave
   * - inRandomOrder, max, min, avg, paginate, get, and more
   *
   * See BaseOrm class for the full list of inherited methods.
   */

  constructor(page: PageJsonResponse | undefined) {
    super('pages')
    if (page) {
      this.attributes = { ...page }
      this.originalAttributes = { ...page }

      Object.keys(page).forEach((key) => {
        if (!(key in this)) {
          this.customColumns[key] = (page as PageJsonResponse)[key]
        }
      })
    }

    this.withRelations = []
    this.selectFromQuery = DB.instance.selectFrom('pages')
    this.updateFromQuery = DB.instance.updateTable('pages')
    this.deleteFromQuery = DB.instance.deleteFrom('pages')
    this.hasSelect = false
  }

  protected async loadRelations(models: PageJsonResponse | PageJsonResponse[]): Promise<void> {
    // Handle both single model and array of models
    const modelArray = Array.isArray(models) ? models : [models]
    if (!modelArray.length)
      return

    const modelIds = modelArray.map(model => model.id)

    for (const relation of this.withRelations) {
      const relatedRecords = await DB.instance
        .selectFrom(relation)
        .where('page_id', 'in', modelIds)
        .selectAll()
        .execute()

      if (Array.isArray(models)) {
        models.map((model: PageJsonResponse) => {
          const records = relatedRecords.filter((record: { page_id: number }) => {
            return record.page_id === model.id
          })

          model[relation] = records.length === 1 ? records[0] : records
          return model
        })
      }
      else {
        const records = relatedRecords.filter((record: { page_id: number }) => {
          return record.page_id === models.id
        })

        models[relation] = records.length === 1 ? records[0] : records
      }
    }
  }

  static with(relations: string[]): PageModel {
    const instance = new PageModel(undefined)

    return instance.applyWith(relations)
  }

  protected mapCustomGetters(models: PageJsonResponse | PageJsonResponse[]): void {
    const data = models

    if (Array.isArray(data)) {
      data.map((model: PageJsonResponse) => {
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

  async mapCustomSetters(model: NewPage | PageUpdate): Promise<void> {
    const customSetter = {
      default: () => {
      },

    }

    for (const [key, fn] of Object.entries(customSetter)) {
      (model as any)[key] = await fn()
    }
  }

  get author_id(): number {
    return this.attributes.author_id
  }

  get author(): AuthorModel | undefined {
    return this.attributes.author
  }

  get id(): number {
    return this.attributes.id
  }

  get uuid(): string | undefined {
    return this.attributes.uuid
  }

  get title(): string | undefined {
    return this.attributes.title
  }

  get template(): string | undefined {
    return this.attributes.template
  }

  get views(): number | undefined {
    return this.attributes.views
  }

  get published_at(): Date | string | undefined {
    return this.attributes.published_at
  }

  get conversions(): number | undefined {
    return this.attributes.conversions
  }

  get created_at(): string | undefined {
    return this.attributes.created_at
  }

  get updated_at(): string | undefined {
    return this.attributes.updated_at
  }

  set uuid(value: string) {
    this.attributes.uuid = value
  }

  set title(value: string) {
    this.attributes.title = value
  }

  set template(value: string) {
    this.attributes.template = value
  }

  set views(value: number) {
    this.attributes.views = value
  }

  set published_at(value: Date | string) {
    this.attributes.published_at = value
  }

  set conversions(value: number) {
    this.attributes.conversions = value
  }

  set updated_at(value: string) {
    this.attributes.updated_at = value
  }

  static select(params: (keyof PageJsonResponse)[] | RawBuilder<string> | string): PageModel {
    const instance = new PageModel(undefined)

    return instance.applySelect(params)
  }

  // Method to find a Page by ID
  static async find(id: number): Promise<PageModel | undefined> {
    const query = DB.instance.selectFrom('pages').where('id', '=', id).selectAll()

    const model = await query.executeTakeFirst()

    if (!model)
      return undefined

    const instance = new PageModel(undefined)
    return instance.createInstance(model)
  }

  static async first(): Promise<PageModel | undefined> {
    const instance = new PageModel(undefined)

    const model = await instance.applyFirst()

    const data = new PageModel(model)

    return data
  }

  static async last(): Promise<PageModel | undefined> {
    const instance = new PageModel(undefined)

    const model = await instance.applyLast()

    if (!model)
      return undefined

    return new PageModel(model)
  }

  static async firstOrFail(): Promise<PageModel | undefined> {
    const instance = new PageModel(undefined)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<PageModel[]> {
    const instance = new PageModel(undefined)

    const models = await DB.instance.selectFrom('pages').selectAll().execute()

    instance.mapCustomGetters(models)

    const data = await Promise.all(models.map(async (model: PageJsonResponse) => {
      return new PageModel(model)
    }))

    return data
  }

  static async findOrFail(id: number): Promise<PageModel | undefined> {
    const instance = new PageModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  static async findMany(ids: number[]): Promise<PageModel[]> {
    const instance = new PageModel(undefined)

    const models = await instance.applyFindMany(ids)

    return models.map((modelItem: PageJsonResponse) => instance.parseResult(new PageModel(modelItem)))
  }

  static async latest(column: keyof PagesTable = 'created_at'): Promise<PageModel | undefined> {
    const instance = new PageModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'desc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new PageModel(model)
  }

  static async oldest(column: keyof PagesTable = 'created_at'): Promise<PageModel | undefined> {
    const instance = new PageModel(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'asc')
      .limit(1)
      .executeTakeFirst()

    if (!model)
      return undefined

    return new PageModel(model)
  }

  static skip(count: number): PageModel {
    const instance = new PageModel(undefined)

    return instance.applySkip(count)
  }

  static take(count: number): PageModel {
    const instance = new PageModel(undefined)

    return instance.applyTake(count)
  }

  static where<V = string>(column: keyof PagesTable, ...args: [V] | [Operator, V]): PageModel {
    const instance = new PageModel(undefined)

    return instance.applyWhere<V>(column, ...args)
  }

  static orWhere(...conditions: [string, any][]): PageModel {
    const instance = new PageModel(undefined)

    return instance.applyOrWhere(...conditions)
  }

  static whereNotIn<V = number>(column: keyof PagesTable, values: V[]): PageModel {
    const instance = new PageModel(undefined)

    return instance.applyWhereNotIn<V>(column, values)
  }

  static whereBetween<V = number>(column: keyof PagesTable, range: [V, V]): PageModel {
    const instance = new PageModel(undefined)

    return instance.applyWhereBetween<V>(column, range)
  }

  static whereRef(column: keyof PagesTable, ...args: string[]): PageModel {
    const instance = new PageModel(undefined)

    return instance.applyWhereRef(column, ...args)
  }

  static when(condition: boolean, callback: (query: PageModel) => PageModel): PageModel {
    const instance = new PageModel(undefined)

    return instance.applyWhen(condition, callback as any)
  }

  static whereNull(column: keyof PagesTable): PageModel {
    const instance = new PageModel(undefined)

    return instance.applyWhereNull(column)
  }

  static whereNotNull(column: keyof PagesTable): PageModel {
    const instance = new PageModel(undefined)

    return instance.applyWhereNotNull(column)
  }

  static whereLike(column: keyof PagesTable, value: string): PageModel {
    const instance = new PageModel(undefined)

    return instance.applyWhereLike(column, value)
  }

  static orderBy(column: keyof PagesTable, order: 'asc' | 'desc'): PageModel {
    const instance = new PageModel(undefined)

    return instance.applyOrderBy(column, order)
  }

  static orderByAsc(column: keyof PagesTable): PageModel {
    const instance = new PageModel(undefined)

    return instance.applyOrderByAsc(column)
  }

  static orderByDesc(column: keyof PagesTable): PageModel {
    const instance = new PageModel(undefined)

    return instance.applyOrderByDesc(column)
  }

  static groupBy(column: keyof PagesTable): PageModel {
    const instance = new PageModel(undefined)

    return instance.applyGroupBy(column)
  }

  static having<V = string>(column: keyof PagesTable, operator: Operator, value: V): PageModel {
    const instance = new PageModel(undefined)

    return instance.applyHaving<V>(column, operator, value)
  }

  static inRandomOrder(): PageModel {
    const instance = new PageModel(undefined)

    return instance.applyInRandomOrder()
  }

  static whereColumn(first: keyof PagesTable, operator: Operator, second: keyof PagesTable): PageModel {
    const instance = new PageModel(undefined)

    return instance.applyWhereColumn(first, operator, second)
  }

  static async max(field: keyof PagesTable): Promise<number> {
    const instance = new PageModel(undefined)

    return await instance.applyMax(field)
  }

  static async min(field: keyof PagesTable): Promise<number> {
    const instance = new PageModel(undefined)

    return await instance.applyMin(field)
  }

  static async avg(field: keyof PagesTable): Promise<number> {
    const instance = new PageModel(undefined)

    return await instance.applyAvg(field)
  }

  static async sum(field: keyof PagesTable): Promise<number> {
    const instance = new PageModel(undefined)

    return await instance.applySum(field)
  }

  static async count(): Promise<number> {
    const instance = new PageModel(undefined)

    return instance.applyCount()
  }

  static async get(): Promise<PageModel[]> {
    const instance = new PageModel(undefined)

    const results = await instance.applyGet()

    return results.map((item: PageJsonResponse) => instance.createInstance(item))
  }

  static async pluck<K extends keyof PageModel>(field: K): Promise<PageModel[K][]> {
    const instance = new PageModel(undefined)

    return await instance.applyPluck(field)
  }

  static async chunk(size: number, callback: (models: PageModel[]) => Promise<void>): Promise<void> {
    const instance = new PageModel(undefined)

    await instance.applyChunk(size, async (models) => {
      const modelInstances = models.map((item: PageJsonResponse) => instance.createInstance(item))
      await callback(modelInstances)
    })
  }

  static async paginate(options: { limit?: number, offset?: number, page?: number } = { limit: 10, offset: 0, page: 1 }): Promise<{
    data: PageModel[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }> {
    const instance = new PageModel(undefined)

    const result = await instance.applyPaginate(options)

    return {
      data: result.data.map((item: PageJsonResponse) => instance.createInstance(item)),
      paging: result.paging,
      next_cursor: result.next_cursor,
    }
  }

  // Instance method for creating model instances
  createInstance(data: PageJsonResponse): PageModel {
    return new PageModel(data)
  }

  async applyCreate(newPage: NewPage): Promise<PageModel> {
    const filteredValues = Object.fromEntries(
      Object.entries(newPage).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewPage

    await this.mapCustomSetters(filteredValues)

    filteredValues.uuid = randomUUIDv7()

    const result = await DB.instance.insertInto('pages')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await DB.instance.selectFrom('pages')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created Page')
    }

    return this.createInstance(model)
  }

  async create(newPage: NewPage): Promise<PageModel> {
    return await this.applyCreate(newPage)
  }

  static async create(newPage: NewPage): Promise<PageModel> {
    const instance = new PageModel(undefined)
    return await instance.applyCreate(newPage)
  }

  static async firstOrCreate(search: Partial<PagesTable>, values: NewPage = {} as NewPage): Promise<PageModel> {
    // First try to find a record matching the search criteria
    const instance = new PageModel(undefined)

    // Apply all search conditions
    for (const [key, value] of Object.entries(search)) {
      instance.selectFromQuery = instance.selectFromQuery.where(key, '=', value)
    }

    // Try to find the record
    const existingRecord = await instance.applyFirst()

    if (existingRecord) {
      return instance.createInstance(existingRecord)
    }

    // If no record exists, create a new one with combined search criteria and values
    const createData = { ...search, ...values } as NewPage
    return await PageModel.create(createData)
  }

  static async updateOrCreate(search: Partial<PagesTable>, values: NewPage = {} as NewPage): Promise<PageModel> {
    // First try to find a record matching the search criteria
    const instance = new PageModel(undefined)

    // Apply all search conditions
    for (const [key, value] of Object.entries(search)) {
      instance.selectFromQuery = instance.selectFromQuery.where(key, '=', value)
    }

    // Try to find the record
    const existingRecord = await instance.applyFirst()

    if (existingRecord) {
      // If record exists, update it with the new values
      const model = instance.createInstance(existingRecord)
      const updatedModel = await model.update(values as PageUpdate)

      // Return the updated model instance
      if (updatedModel) {
        return updatedModel
      }

      // If update didn't return a model, fetch it again to ensure we have latest data
      const refreshedModel = await instance.applyFirst()
      return instance.createInstance(refreshedModel!)
    }

    // If no record exists, create a new one with combined search criteria and values
    const createData = { ...search, ...values } as NewPage
    return await PageModel.create(createData)
  }

  async update(newPage: PageUpdate): Promise<PageModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newPage).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as PageUpdate

    await this.mapCustomSetters(filteredValues)

    filteredValues.updated_at = new Date().toISOString()

    await DB.instance.updateTable('pages')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('pages')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated Page')
      }

      return this.createInstance(model)
    }

    return undefined
  }

  async forceUpdate(newPage: PageUpdate): Promise<PageModel | undefined> {
    await DB.instance.updateTable('pages')
      .set(newPage)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('pages')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated Page')
      }

      return this.createInstance(model)
    }

    return undefined
  }

  async save(): Promise<PageModel> {
    // If the model has an ID, update it; otherwise, create a new record
    if (this.id) {
      // Update existing record
      await DB.instance.updateTable('pages')
        .set(this.attributes as PageUpdate)
        .where('id', '=', this.id)
        .executeTakeFirst()

      // Get the updated data
      const model = await DB.instance.selectFrom('pages')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated Page')
      }

      return this.createInstance(model)
    }
    else {
      // Create new record
      const result = await DB.instance.insertInto('pages')
        .values(this.attributes as NewPage)
        .executeTakeFirst()

      // Get the created data
      const model = await DB.instance.selectFrom('pages')
        .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve created Page')
      }

      return this.createInstance(model)
    }
  }

  static async createMany(newPage: NewPage[]): Promise<void> {
    const instance = new PageModel(undefined)

    const valuesFiltered = newPage.map((newPage: NewPage) => {
      const filteredValues = Object.fromEntries(
        Object.entries(newPage).filter(([key]) =>
          !instance.guarded.includes(key) && instance.fillable.includes(key),
        ),
      ) as NewPage

      filteredValues.uuid = randomUUIDv7()

      return filteredValues
    })

    await DB.instance.insertInto('pages')
      .values(valuesFiltered)
      .executeTakeFirst()
  }

  static async forceCreate(newPage: NewPage): Promise<PageModel> {
    const result = await DB.instance.insertInto('pages')
      .values(newPage)
      .executeTakeFirst()

    const instance = new PageModel(undefined)
    const model = await DB.instance.selectFrom('pages')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created Page')
    }

    return instance.createInstance(model)
  }

  // Method to remove a Page
  async delete(): Promise<number> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()

    const deleted = await DB.instance.deleteFrom('pages')
      .where('id', '=', this.id)
      .execute()

    return deleted.numDeletedRows
  }

  static async remove(id: number): Promise<any> {
    return await DB.instance.deleteFrom('pages')
      .where('id', '=', id)
      .execute()
  }

  static whereTitle(value: string): PageModel {
    const instance = new PageModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('title', '=', value)

    return instance
  }

  static whereTemplate(value: string): PageModel {
    const instance = new PageModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('template', '=', value)

    return instance
  }

  static whereViews(value: string): PageModel {
    const instance = new PageModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('views', '=', value)

    return instance
  }

  static wherePublishedAt(value: string): PageModel {
    const instance = new PageModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('published_at', '=', value)

    return instance
  }

  static whereConversions(value: string): PageModel {
    const instance = new PageModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('conversions', '=', value)

    return instance
  }

  static whereIn<V = number>(column: keyof PagesTable, values: V[]): PageModel {
    const instance = new PageModel(undefined)

    return instance.applyWhereIn<V>(column, values)
  }

  async authorBelong(): Promise<AuthorModel> {
    if (this.author_id === undefined)
      throw new HttpError(500, 'Relation Error!')

    const model = await Author
      .where('id', '=', this.author_id)
      .first()

    if (!model)
      throw new HttpError(500, 'Model Relation Not Found!')

    return model
  }

  toSearchableObject(): Partial<PageJsonResponse> {
    return {
      id: this.id,
      title: this.title,
      author: this.author,
      template: this.template,
      views: this.views,
      conversions: this.conversions,
    }
  }

  static distinct(column: keyof PageJsonResponse): PageModel {
    const instance = new PageModel(undefined)

    return instance.applyDistinct(column)
  }

  static join(table: string, firstCol: string, secondCol: string): PageModel {
    const instance = new PageModel(undefined)

    return instance.applyJoin(table, firstCol, secondCol)
  }

  toJSON(): PageJsonResponse {
    const output = {

      uuid: this.uuid,

      id: this.id,
      title: this.title,
      template: this.template,
      views: this.views,
      published_at: this.published_at,
      conversions: this.conversions,

      created_at: this.created_at,

      updated_at: this.updated_at,

      author_id: this.author_id,
      author: this.author,
      ...this.customColumns,
    }

    return output
  }

  parseResult(model: PageModel): PageModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof PageModel]
    }

    return model
  }

  // Add a protected applyFind implementation
  protected async applyFind(id: number): Promise<PageModel | undefined> {
    const model = await DB.instance.selectFrom(this.tableName)
      .where('id', '=', id)
      .selectAll()
      .executeTakeFirst()

    if (!model)
      return undefined

    this.mapCustomGetters(model)

    await this.loadRelations(model)

    // Return a proper instance using the factory method
    return this.createInstance(model)
  }
}

export async function find(id: number): Promise<PageModel | undefined> {
  const query = DB.instance.selectFrom('pages').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  const instance = new PageModel(undefined)
  return instance.createInstance(model)
}

export async function count(): Promise<number> {
  const results = await PageModel.count()

  return results
}

export async function create(newPage: NewPage): Promise<PageModel> {
  const instance = new PageModel(undefined)
  return await instance.applyCreate(newPage)
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(DB.instance)
}

export async function remove(id: number): Promise<void> {
  await DB.instance.deleteFrom('pages')
    .where('id', '=', id)
    .execute()
}

export async function whereTitle(value: string): Promise<PageModel[]> {
  const query = DB.instance.selectFrom('pages').where('title', '=', value)
  const results: PageJsonResponse = await query.execute()

  return results.map((modelItem: PageJsonResponse) => new PageModel(modelItem))
}

export async function whereTemplate(value: string): Promise<PageModel[]> {
  const query = DB.instance.selectFrom('pages').where('template', '=', value)
  const results: PageJsonResponse = await query.execute()

  return results.map((modelItem: PageJsonResponse) => new PageModel(modelItem))
}

export async function whereViews(value: number): Promise<PageModel[]> {
  const query = DB.instance.selectFrom('pages').where('views', '=', value)
  const results: PageJsonResponse = await query.execute()

  return results.map((modelItem: PageJsonResponse) => new PageModel(modelItem))
}

export async function wherePublishedAt(value: Date | string): Promise<PageModel[]> {
  const query = DB.instance.selectFrom('pages').where('published_at', '=', value)
  const results: PageJsonResponse = await query.execute()

  return results.map((modelItem: PageJsonResponse) => new PageModel(modelItem))
}

export async function whereConversions(value: number): Promise<PageModel[]> {
  const query = DB.instance.selectFrom('pages').where('conversions', '=', value)
  const results: PageJsonResponse = await query.execute()

  return results.map((modelItem: PageJsonResponse) => new PageModel(modelItem))
}

export const Page = PageModel

export default Page
