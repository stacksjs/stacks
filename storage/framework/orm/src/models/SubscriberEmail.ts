import type { Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import { cache } from '@stacksjs/cache'
import { sql } from '@stacksjs/database'
import { HttpError, ModelNotFoundException } from '@stacksjs/error-handling'
import { dispatch } from '@stacksjs/events'
import { DB, SubqueryBuilder } from '@stacksjs/orm'

export interface SubscriberEmailsTable {
  id?: number
  email?: string

  created_at?: Date

  updated_at?: Date

  deleted_at?: Date

}

interface SubscriberEmailResponse {
  data: SubscriberEmailJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface SubscriberEmailJsonResponse extends Omit<SubscriberEmailsTable, 'password'> {
  [key: string]: any
}

export type SubscriberEmailType = Selectable<SubscriberEmailsTable>
export type NewSubscriberEmail = Partial<Insertable<SubscriberEmailsTable>>
export type SubscriberEmailUpdate = Updateable<SubscriberEmailsTable>

      type SortDirection = 'asc' | 'desc'
interface SortOptions { column: SubscriberEmailType, order: SortDirection }
// Define a type for the options parameter
interface QueryOptions {
  sort?: SortOptions
  limit?: number
  offset?: number
  page?: number
}

export class SubscriberEmailModel {
  private readonly hidden: Array<keyof SubscriberEmailJsonResponse> = []
  private readonly fillable: Array<keyof SubscriberEmailJsonResponse> = ['email', 'uuid']
  private readonly guarded: Array<keyof SubscriberEmailJsonResponse> = []
  protected attributes: Partial<SubscriberEmailJsonResponse> = {}
  protected originalAttributes: Partial<SubscriberEmailJsonResponse> = {}
  private softDeletes = false
  protected selectFromQuery: any
  protected withRelations: string[]
  protected updateFromQuery: any
  protected deleteFromQuery: any
  protected hasSelect: boolean
  private hasSaved: boolean
  private customColumns: Record<string, unknown> = {}

  constructor(subscriberemail: Partial<SubscriberEmailType> | null) {
    if (subscriberemail) {
      this.attributes = { ...subscriberemail }
      this.originalAttributes = { ...subscriberemail }

      Object.keys(subscriberemail).forEach((key) => {
        if (!(key in this)) {
          this.customColumns[key] = (subscriberemail as SubscriberEmailJsonResponse)[key]
        }
      })
    }

    this.withRelations = []
    this.selectFromQuery = DB.instance.selectFrom('subscriber_emails')
    this.updateFromQuery = DB.instance.updateTable('subscriber_emails')
    this.deleteFromQuery = DB.instance.deleteFrom('subscriber_emails')
    this.hasSelect = false
    this.hasSaved = false
  }

  get id(): number | undefined {
    return this.attributes.id
  }

  get email(): string | undefined {
    return this.attributes.email
  }

  get created_at(): Date | undefined {
    return this.attributes.created_at
  }

  get updated_at(): Date | undefined {
    return this.attributes.updated_at
  }

  get deleted_at(): Date | undefined {
    return this.attributes.deleted_at
  }

  set email(value: string) {
    this.attributes.email = value
  }

  set updated_at(value: Date) {
    this.attributes.updated_at = value
  }

  set deleted_at(value: Date) {
    this.attributes.deleted_at = value
  }

  getOriginal(column?: keyof SubscriberEmailType): Partial<SubscriberEmailType> {
    if (column) {
      return this.originalAttributes[column]
    }

    return this.originalAttributes
  }

  getChanges(): Partial<SubscriberEmailJsonResponse> {
    return this.fillable.reduce<Partial<SubscriberEmailJsonResponse>>((changes, key) => {
      const currentValue = this.attributes[key as keyof SubscriberEmailsTable]
      const originalValue = this.originalAttributes[key as keyof SubscriberEmailsTable]

      if (currentValue !== originalValue) {
        changes[key] = currentValue
      }

      return changes
    }, {})
  }

  isDirty(column?: keyof SubscriberEmailType): boolean {
    if (column) {
      return this.attributes[column] !== this.originalAttributes[column]
    }

    return Object.entries(this.originalAttributes).some(([key, originalValue]) => {
      const currentValue = (this.attributes as any)[key]

      return currentValue !== originalValue
    })
  }

  isClean(column?: keyof SubscriberEmailType): boolean {
    return !this.isDirty(column)
  }

  wasChanged(column?: keyof SubscriberEmailType): boolean {
    return this.hasSaved && this.isDirty(column)
  }

  select(params: (keyof SubscriberEmailType)[] | RawBuilder<string> | string): SubscriberEmailModel {
    this.selectFromQuery = this.selectFromQuery.select(params)

    this.hasSelect = true

    return this
  }

  static select(params: (keyof SubscriberEmailType)[] | RawBuilder<string> | string): SubscriberEmailModel {
    const instance = new SubscriberEmailModel(null)

    // Initialize a query with the table name and selected fields
    instance.selectFromQuery = instance.selectFromQuery.select(params)

    instance.hasSelect = true

    return instance
  }

  async applyFind(id: number): Promise<SubscriberEmailModel | undefined> {
    const model = await DB.instance.selectFrom('subscriber_emails').where('id', '=', id).selectAll().executeTakeFirst()

    if (!model)
      return undefined

    await this.loadRelations(model)

    const data = new SubscriberEmailModel(model as SubscriberEmailType)

    cache.getOrSet(`subscriberemail:${id}`, JSON.stringify(model))

    return data
  }

  async find(id: number): Promise<SubscriberEmailModel | undefined> {
    return await this.applyFind(id)
  }

  // Method to find a SubscriberEmail by ID
  static async find(id: number): Promise<SubscriberEmailModel | undefined> {
    const instance = new SubscriberEmailModel(null)

    return await instance.applyFind(id)
  }

  async first(): Promise<SubscriberEmailModel | undefined> {
    let model: SubscriberEmailModel | undefined

    if (this.hasSelect) {
      model = await this.selectFromQuery.executeTakeFirst()
    }
    else {
      model = await this.selectFromQuery.selectAll().executeTakeFirst()
    }

    if (model)
      await this.loadRelations(model)

    const data = new SubscriberEmailModel(model as SubscriberEmailType)

    return data
  }

  static async first(): Promise<SubscriberEmailModel | undefined> {
    const model = await DB.instance.selectFrom('subscriber_emails')
      .selectAll()
      .executeTakeFirst()

    const data = new SubscriberEmailModel(model as SubscriberEmailType)

    return data
  }

  async applyFirstOrFail(): Promise<SubscriberEmailModel | undefined> {
    const model = await this.selectFromQuery.executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, 'No SubscriberEmailModel results found for query')

    if (model)
      await this.loadRelations(model)

    const data = new SubscriberEmailModel(model as SubscriberEmailType)

    return data
  }

  async firstOrFail(): Promise<SubscriberEmailModel | undefined> {
    return await this.applyFirstOrFail()
  }

  static async firstOrFail(): Promise<SubscriberEmailModel | undefined> {
    const instance = new SubscriberEmailModel(null)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<SubscriberEmailModel[]> {
    const models = await DB.instance.selectFrom('subscriber_emails').selectAll().execute()

    const data = await Promise.all(models.map(async (model: SubscriberEmailType) => {
      return new SubscriberEmailModel(model)
    }))

    return data
  }

  async applyFindOrFail(id: number): Promise<SubscriberEmailModel> {
    const model = await DB.instance.selectFrom('subscriber_emails').where('id', '=', id).selectAll().executeTakeFirst()

    if (instance.softDeletes) {
      instance.selectFromQuery = instance.selectFromQuery.where('deleted_at', 'is', null)
    }

    if (model === undefined)
      throw new ModelNotFoundException(404, `No SubscriberEmailModel results for ${id}`)

    cache.getOrSet(`subscriberemail:${id}`, JSON.stringify(model))

    await this.loadRelations(model)

    const data = new SubscriberEmailModel(model as SubscriberEmailType)

    return data
  }

  async findOrFail(id: number): Promise<SubscriberEmailModel> {
    return await this.applyFindOrFail(id)
  }

  static async findOrFail(id: number): Promise<SubscriberEmailModel> {
    const instance = new SubscriberEmailModel(null)

    return await instance.applyFindOrFail(id)
  }

  static async findMany(ids: number[]): Promise<SubscriberEmailModel[]> {
    let query = DB.instance.selectFrom('subscriber_emails').where('id', 'in', ids)

    const instance = new SubscriberEmailModel(null)

    if (instance.softDeletes) {
      query = query.where('deleted_at', 'is', null)
    }

    query = query.selectAll()

    const models = await query.execute()

    await instance.loadRelations(models)

    return models.map((modelItem: SubscriberEmailModel) => instance.parseResult(new SubscriberEmailModel(modelItem)))
  }

  skip(count: number): SubscriberEmailModel {
    this.selectFromQuery = this.selectFromQuery.offset(count)

    return this
  }

  static skip(count: number): SubscriberEmailModel {
    const instance = new SubscriberEmailModel(null)

    instance.selectFromQuery = instance.selectFromQuery.offset(count)

    return instance
  }

  async applyChunk(size: number, callback: (models: SubscriberEmailModel[]) => Promise<void>): Promise<void> {
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

  async chunk(size: number, callback: (models: SubscriberEmailModel[]) => Promise<void>): Promise<void> {
    await this.applyChunk(size, callback)
  }

  static async chunk(size: number, callback: (models: SubscriberEmailModel[]) => Promise<void>): Promise<void> {
    const instance = new SubscriberEmailModel(null)

    await instance.applyChunk(size, callback)
  }

  take(count: number): SubscriberEmailModel {
    this.selectFromQuery = this.selectFromQuery.limit(count)

    return this
  }

  static take(count: number): SubscriberEmailModel {
    const instance = new SubscriberEmailModel(null)

    instance.selectFromQuery = instance.selectFromQuery.limit(count)

    return instance
  }

  static async pluck<K extends keyof SubscriberEmailModel>(field: K): Promise<SubscriberEmailModel[K][]> {
    const instance = new SubscriberEmailModel(null)

    if (instance.hasSelect) {
      const model = await instance.selectFromQuery.execute()
      return model.map((modelItem: SubscriberEmailModel) => modelItem[field])
    }

    const model = await instance.selectFromQuery.selectAll().execute()

    return model.map((modelItem: SubscriberEmailModel) => modelItem[field])
  }

  async pluck<K extends keyof SubscriberEmailModel>(field: K): Promise<SubscriberEmailModel[K][]> {
    return SubscriberEmailModel.pluck(field)
  }

  static async count(): Promise<number> {
    const instance = new SubscriberEmailModel(null)

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

  static async max(field: keyof SubscriberEmailModel): Promise<number> {
    const instance = new SubscriberEmailModel(null)

    const result = await instance.selectFromQuery
      .select(sql`MAX(${sql.raw(field as string)}) as max `)
      .executeTakeFirst()

    return result.max
  }

  async max(field: keyof SubscriberEmailModel): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`MAX(${sql.raw(field as string)}) as max`)
      .executeTakeFirst()

    return result.max
  }

  static async min(field: keyof SubscriberEmailModel): Promise<number> {
    const instance = new SubscriberEmailModel(null)

    const result = await instance.selectFromQuery
      .select(sql`MIN(${sql.raw(field as string)}) as min `)
      .executeTakeFirst()

    return result.min
  }

  async min(field: keyof SubscriberEmailModel): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`MIN(${sql.raw(field as string)}) as min `)
      .executeTakeFirst()

    return result.min
  }

  static async avg(field: keyof SubscriberEmailModel): Promise<number> {
    const instance = new SubscriberEmailModel(null)

    const result = await instance.selectFromQuery
      .select(sql`AVG(${sql.raw(field as string)}) as avg `)
      .executeTakeFirst()

    return result.avg
  }

  async avg(field: keyof SubscriberEmailModel): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`AVG(${sql.raw(field as string)}) as avg `)
      .executeTakeFirst()

    return result.avg
  }

  static async sum(field: keyof SubscriberEmailModel): Promise<number> {
    const instance = new SubscriberEmailModel(null)

    const result = await instance.selectFromQuery
      .select(sql`SUM(${sql.raw(field as string)}) as sum `)
      .executeTakeFirst()

    return result.sum
  }

  async sum(field: keyof SubscriberEmailModel): Promise<number> {
    const result = this.selectFromQuery
      .select(sql`SUM(${sql.raw(field as string)}) as sum `)
      .executeTakeFirst()

    return result.sum
  }

  async applyGet(): Promise<SubscriberEmailModel[]> {
    let models

    if (this.hasSelect) {
      models = await this.selectFromQuery.execute()
    }
    else {
      models = await this.selectFromQuery.selectAll().execute()
    }

    await this.loadRelations(models)

    const data = await Promise.all(models.map(async (model: SubscriberEmailModel) => {
      return new SubscriberEmailModel(model)
    }))

    return data
  }

  async get(): Promise<SubscriberEmailModel[]> {
    return await this.applyGet()
  }

  static async get(): Promise<SubscriberEmailModel[]> {
    const instance = new SubscriberEmailModel(null)

    return await instance.applyGet()
  }

  has(relation: string): SubscriberEmailModel {
    this.selectFromQuery = this.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(
        selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.subscriberemail_id`, '=', 'subscriber_emails.id'),
      ),
    )

    return this
  }

  static has(relation: string): SubscriberEmailModel {
    const instance = new SubscriberEmailModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(
        selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.subscriberemail_id`, '=', 'subscriber_emails.id'),
      ),
    )

    return instance
  }

  static whereExists(callback: (qb: any) => any): SubscriberEmailModel {
    const instance = new SubscriberEmailModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(callback({ exists, selectFrom })),
    )

    return instance
  }

  applyWhereHas(
    relation: string,
    callback: (query: SubqueryBuilder) => void,
  ): SubscriberEmailModel {
    const subqueryBuilder = new SubqueryBuilder()

    callback(subqueryBuilder)
    const conditions = subqueryBuilder.getConditions()

    this.selectFromQuery = this.selectFromQuery
      .where(({ exists, selectFrom }: any) => {
        let subquery = selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.subscriberemail_id`, '=', 'subscriber_emails.id')

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
              if (condition.operator === 'not') {
                subquery = subquery.whereNotIn(condition.column, condition.values!)
              }
              else {
                subquery = subquery.whereIn(condition.column, condition.values!)
              }

              break

            case 'whereNull':
              subquery = subquery.whereNull(condition.column)
              break

            case 'whereNotNull':
              subquery = subquery.whereNotNull(condition.column)
              break

            case 'whereBetween':
              subquery = subquery.whereBetween(condition.column, condition.values!)
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
    callback: (query: SubqueryBuilder) => void,
  ): SubscriberEmailModel {
    return this.applyWhereHas(relation, callback)
  }

  static whereHas(
    relation: string,
    callback: (query: SubqueryBuilder) => void,
  ): SubscriberEmailModel {
    const instance = new SubscriberEmailModel(null)

    return instance.applyWhereHas(relation, callback)
  }

  applyDoesntHave(relation: string): SubscriberEmailModel {
    this.selectFromQuery = this.selectFromQuery.where(({ not, exists, selectFrom }: any) =>
      not(
        exists(
          selectFrom(relation)
            .select('1')
            .whereRef(`${relation}.subscriberemail_id`, '=', 'subscriber_emails.id'),
        ),
      ),
    )

    return this
  }

  doesntHave(relation: string): SubscriberEmailModel {
    return this.applyDoesntHave(relation)
  }

  static doesntHave(relation: string): SubscriberEmailModel {
    const instance = new SubscriberEmailModel(null)

    return instance.doesntHave(relation)
  }

  applyWhereDoesntHave(relation: string, callback: (query: SubqueryBuilder) => void): SubscriberEmailModel {
    const subqueryBuilder = new SubqueryBuilder()

    callback(subqueryBuilder)
    const conditions = subqueryBuilder.getConditions()

    this.selectFromQuery = this.selectFromQuery
      .where(({ exists, selectFrom, not }: any) => {
        let subquery = selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.subscriberemail_id`, '=', 'subscriber_emails.id')

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
              if (condition.operator === 'not') {
                subquery = subquery.whereNotIn(condition.column, condition.values!)
              }
              else {
                subquery = subquery.whereIn(condition.column, condition.values!)
              }

              break

            case 'whereNull':
              subquery = subquery.whereNull(condition.column)
              break

            case 'whereNotNull':
              subquery = subquery.whereNotNull(condition.column)
              break

            case 'whereBetween':
              subquery = subquery.whereBetween(condition.column, condition.values!)
              break

            case 'whereExists': {
              const nestedBuilder = new SubqueryBuilder()
              condition.callback!(nestedBuilder)
              break
            }
          }
        })

        return not(exists(subquery))
      })

    return this
  }

  whereDoesntHave(relation: string, callback: (query: SubqueryBuilder) => void): SubscriberEmailModel {
    return this.applyWhereDoesntHave(relation, callback)
  }

  static whereDoesntHave(
    relation: string,
    callback: (query: SubqueryBuilder) => void,
  ): SubscriberEmailModel {
    const instance = new SubscriberEmailModel(null)

    return instance.applyWhereDoesntHave(relation, callback)
  }

  async applyPaginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<SubscriberEmailResponse> {
    const totalRecordsResult = await DB.instance.selectFrom('subscriber_emails')
      .select(DB.instance.fn.count('id').as('total')) // Use 'id' or another actual column name
      .executeTakeFirst()

    const totalRecords = Number(totalRecordsResult?.total) || 0
    const totalPages = Math.ceil(totalRecords / (options.limit ?? 10))

    const subscriber_emailsWithExtra = await DB.instance.selectFrom('subscriber_emails')
      .selectAll()
      .orderBy('id', 'asc') // Assuming 'id' is used for cursor-based pagination
      .limit((options.limit ?? 10) + 1) // Fetch one extra record
      .offset(((options.page ?? 1) - 1) * (options.limit ?? 10)) // Ensure options.page is not undefined
      .execute()

    let nextCursor = null
    if (subscriber_emailsWithExtra.length > (options.limit ?? 10))
      nextCursor = subscriber_emailsWithExtra.pop()?.id ?? null

    return {
      data: subscriber_emailsWithExtra,
      paging: {
        total_records: totalRecords,
        page: options.page || 1,
        total_pages: totalPages,
      },
      next_cursor: nextCursor,
    }
  }

  async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<SubscriberEmailResponse> {
    return await this.applyPaginate(options)
  }

  // Method to get all subscriber_emails
  static async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<SubscriberEmailResponse> {
    const instance = new SubscriberEmailModel(null)

    return await instance.applyPaginate(options)
  }

  static async create(newSubscriberEmail: NewSubscriberEmail): Promise<SubscriberEmailModel> {
    const instance = new SubscriberEmailModel(null)

    const filteredValues = Object.fromEntries(
      Object.entries(newSubscriberEmail).filter(([key]) =>
        !instance.guarded.includes(key) && instance.fillable.includes(key),
      ),
    ) as NewSubscriberEmail

    const result = await DB.instance.insertInto('subscriber_emails')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await instance.find(Number(result.numInsertedOrUpdatedRows)) as SubscriberEmailModel

    if (model)
      dispatch('subscriberemail:created', model)

    return model
  }

  static async createMany(newSubscriberEmail: NewSubscriberEmail[]): Promise<void> {
    const instance = new SubscriberEmailModel(null)

    const valuesFiltered = newSubscriberEmail.map((newSubscriberEmail: NewSubscriberEmail) => {
      const filteredValues = Object.fromEntries(
        Object.entries(newSubscriberEmail).filter(([key]) =>
          !instance.guarded.includes(key) && instance.fillable.includes(key),
        ),
      ) as NewSubscriberEmail

      return filteredValues
    })

    await DB.instance.insertInto('subscriber_emails')
      .values(valuesFiltered)
      .executeTakeFirst()
  }

  static async forceCreate(newSubscriberEmail: NewSubscriberEmail): Promise<SubscriberEmailModel> {
    const result = await DB.instance.insertInto('subscriber_emails')
      .values(newSubscriberEmail)
      .executeTakeFirst()

    const model = await find(Number(result.numInsertedOrUpdatedRows)) as SubscriberEmailModel

    return model
  }

  // Method to remove a SubscriberEmail
  static async remove(id: number): Promise<any> {
    const instance = new SubscriberEmailModel(null)

    if (instance.softDeletes) {
      return await DB.instance.updateTable('subscriber_emails')
        .set({
          deleted_at: sql.raw('CURRENT_TIMESTAMP'),
        })
        .where('id', '=', id)
        .execute()
    }

    return await DB.instance.deleteFrom('subscriber_emails')
      .where('id', '=', id)
      .execute()
  }

  applyWhere(instance: SubscriberEmailModel, column: string, ...args: any[]): SubscriberEmailModel {
    const [operatorOrValue, value] = args
    const operator = value === undefined ? '=' : operatorOrValue
    const actualValue = value === undefined ? operatorOrValue : value

    instance.selectFromQuery = instance.selectFromQuery.where(column, operator, actualValue)
    instance.updateFromQuery = instance.updateFromQuery.where(column, operator, actualValue)
    instance.deleteFromQuery = instance.deleteFromQuery.where(column, operator, actualValue)

    return instance
  }

  where(column: string, ...args: any[]): SubscriberEmailModel {
    return this.applyWhere(this, column, ...args)
  }

  static where(column: string, ...args: any[]): SubscriberEmailModel {
    const instance = new SubscriberEmailModel(null)

    return instance.applyWhere(instance, column, ...args)
  }

  whereColumn(first: string, operator: string, second: string): SubscriberEmailModel {
    this.selectFromQuery = this.selectFromQuery.whereRef(first, operator, second)

    return this
  }

  static whereColumn(first: string, operator: string, second: string): SubscriberEmailModel {
    const instance = new SubscriberEmailModel(null)

    instance.selectFromQuery = instance.selectFromQuery.whereRef(first, operator, second)

    return instance
  }

  applyWhereRef(column: string, ...args: string[]): SubscriberEmailModel {
    const [operatorOrValue, value] = args
    const operator = value === undefined ? '=' : operatorOrValue
    const actualValue = value === undefined ? operatorOrValue : value

    const instance = new SubscriberEmailModel(null)
    instance.selectFromQuery = instance.selectFromQuery.whereRef(column, operator, actualValue)

    return instance
  }

  whereRef(column: string, ...args: string[]): SubscriberEmailModel {
    return this.applyWhereRef(column, ...args)
  }

  static whereRef(column: string, ...args: string[]): SubscriberEmailModel {
    const instance = new SubscriberEmailModel(null)

    return instance.applyWhereRef(column, ...args)
  }

  whereRaw(sqlStatement: string): SubscriberEmailModel {
    this.selectFromQuery = this.selectFromQuery.where(sql`${sqlStatement}`)

    return this
  }

  static whereRaw(sqlStatement: string): SubscriberEmailModel {
    const instance = new SubscriberEmailModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where(sql`${sqlStatement}`)

    return instance
  }

  applyOrWhere(...conditions: [string, any][]): SubscriberEmailModel {
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

  orWhere(...conditions: [string, any][]): SubscriberEmailModel {
    return this.applyOrWhere(...conditions)
  }

  static orWhere(...conditions: [string, any][]): SubscriberEmailModel {
    const instance = new SubscriberEmailModel(null)

    return instance.applyOrWhere(...conditions)
  }

  when(
    condition: boolean,
    callback: (query: SubscriberEmailModel) => SubscriberEmailModel,
  ): SubscriberEmailModel {
    return SubscriberEmailModel.when(condition, callback)
  }

  static when(
    condition: boolean,
    callback: (query: SubscriberEmailModel) => SubscriberEmailModel,
  ): SubscriberEmailModel {
    let instance = new SubscriberEmailModel(null)

    if (condition)
      instance = callback(instance)

    return instance
  }

  whereNull(column: string): SubscriberEmailModel {
    return SubscriberEmailModel.whereNull(column)
  }

  static whereNull(column: string): SubscriberEmailModel {
    const instance = new SubscriberEmailModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    instance.updateFromQuery = instance.updateFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    return instance
  }

  static whereEmail(value: string): SubscriberEmailModel {
    const instance = new SubscriberEmailModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('email', '=', value)

    return instance
  }

  whereIn(column: keyof SubscriberEmailType, values: any[]): SubscriberEmailModel {
    return SubscriberEmailModel.whereIn(column, values)
  }

  static whereIn(column: keyof SubscriberEmailType, values: any[]): SubscriberEmailModel {
    const instance = new SubscriberEmailModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where(column, 'in', values)

    instance.updateFromQuery = instance.updateFromQuery.where(column, 'in', values)

    instance.deleteFromQuery = instance.deleteFromQuery.where(column, 'in', values)

    return instance
  }

  applyWhereBetween(column: keyof SubscriberEmailType, range: [any, any]): SubscriberEmailModel {
    if (range.length !== 2) {
      throw new HttpError(500, 'Range must have exactly two values: [min, max]')
    }

    const query = sql` ${sql.raw(column as string)} between ${range[0]} and ${range[1]} `

    this.selectFromQuery = this.selectFromQuery.where(query)
    this.updateFromQuery = this.updateFromQuery.where(query)
    this.deleteFromQuery = this.deleteFromQuery.where(query)

    return this
  }

  whereBetween(column: keyof SubscriberEmailType, range: [any, any]): SubscriberEmailModel {
    return this.applyWhereBetween(column, range)
  }

  static whereBetween(column: keyof SubscriberEmailType, range: [any, any]): SubscriberEmailModel {
    const instance = new SubscriberEmailModel(null)

    return instance.applyWhereBetween(column, range)
  }

  applyWhereLike(column: keyof SubscriberEmailType, value: string): SubscriberEmailModel {
    this.selectFromQuery = this.selectFromQuery.where(sql` ${sql.raw(column as string)} LIKE ${value}`)

    this.updateFromQuery = this.updateFromQuery.where(sql` ${sql.raw(column as string)} LIKE ${value}`)

    this.deleteFromQuery = this.deleteFromQuery.where(sql` ${sql.raw(column as string)} LIKE ${value}`)

    return this
  }

  whereLike(column: keyof SubscriberEmailType, value: string): SubscriberEmailModel {
    return this.applyWhereLike(column, value)
  }

  static whereLike(column: keyof SubscriberEmailType, value: string): SubscriberEmailModel {
    const instance = new SubscriberEmailModel(null)

    return instance.applyWhereLike(column, value)
  }

  applyWhereNotIn(column: keyof SubscriberEmailType, values: any[]): SubscriberEmailModel {
    this.selectFromQuery = this.selectFromQuery.where(column, 'not in', values)

    this.updateFromQuery = this.updateFromQuery.where(column, 'not in', values)

    this.deleteFromQuery = this.deleteFromQuery.where(column, 'not in', values)

    return this
  }

  whereNotIn(column: keyof SubscriberEmailType, values: any[]): SubscriberEmailModel {
    return this.applyWhereNotIn(column, values)
  }

  static whereNotIn(column: keyof SubscriberEmailType, values: any[]): SubscriberEmailModel {
    const instance = new SubscriberEmailModel(null)

    return instance.applyWhereNotIn(column, values)
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

  static async latest(): Promise<SubscriberEmailType | undefined> {
    const model = await DB.instance.selectFrom('subscriber_emails')
      .selectAll()
      .orderBy('id', 'desc')
      .executeTakeFirst()

    if (!model)
      return undefined

    const data = new SubscriberEmailModel(model as SubscriberEmailType)

    return data
  }

  static async oldest(): Promise<SubscriberEmailType | undefined> {
    const model = await DB.instance.selectFrom('subscriber_emails')
      .selectAll()
      .orderBy('id', 'asc')
      .executeTakeFirst()

    if (!model)
      return undefined

    const data = new SubscriberEmailModel(model as SubscriberEmailType)

    return data
  }

  static async firstOrCreate(
    condition: Partial<SubscriberEmailType>,
    newSubscriberEmail: NewSubscriberEmail,
  ): Promise<SubscriberEmailModel> {
    // Get the key and value from the condition object
    const key = Object.keys(condition)[0] as keyof SubscriberEmailType

    if (!key) {
      throw new HttpError(500, 'Condition must contain at least one key-value pair')
    }

    const value = condition[key]

    // Attempt to find the first record matching the condition
    const existingSubscriberEmail = await DB.instance.selectFrom('subscriber_emails')
      .selectAll()
      .where(key, '=', value)
      .executeTakeFirst()

    if (existingSubscriberEmail) {
      return new SubscriberEmailModel(existingSubscriberEmail as SubscriberEmailType)
    }
    else {
      return await this.create(newSubscriberEmail)
    }
  }

  static async updateOrCreate(
    condition: Partial<SubscriberEmailType>,
    newSubscriberEmail: NewSubscriberEmail,
  ): Promise<SubscriberEmailModel> {
    const instance = new SubscriberEmailModel(null)

    const key = Object.keys(condition)[0] as keyof SubscriberEmailType

    if (!key) {
      throw new HttpError(500, 'Condition must contain at least one key-value pair')
    }

    const value = condition[key]

    // Attempt to find the first record matching the condition
    const existingSubscriberEmail = await DB.instance.selectFrom('subscriber_emails')
      .selectAll()
      .where(key, '=', value)
      .executeTakeFirst()

    if (existingSubscriberEmail) {
      // If found, update the existing record
      await DB.instance.updateTable('subscriber_emails')
        .set(newSubscriberEmail)
        .where(key, '=', value)
        .executeTakeFirstOrThrow()

      // Fetch and return the updated record
      const updatedSubscriberEmail = await DB.instance.selectFrom('subscriber_emails')
        .selectAll()
        .where(key, '=', value)
        .executeTakeFirst()

      if (!updatedSubscriberEmail) {
        throw new HttpError(500, 'Failed to fetch updated record')
      }

      instance.hasSaved = true

      return new SubscriberEmailModel(updatedSubscriberEmail as SubscriberEmailType)
    }
    else {
      // If not found, create a new record
      return await this.create(newSubscriberEmail)
    }
  }

  async loadRelations(models: SubscriberEmailModel | SubscriberEmailModel[]): Promise<void> {
    // Handle both single model and array of models
    const modelArray = Array.isArray(models) ? models : [models]
    if (!modelArray.length)
      return

    const modelIds = modelArray.map(model => model.id)

    for (const relation of this.withRelations) {
      const relatedRecords = await DB.instance
        .selectFrom(relation)
        .where('subscriberemail_id', 'in', modelIds)
        .selectAll()
        .execute()

      if (Array.isArray(models)) {
        models.map((model: SubscriberEmailModel) => {
          const records = relatedRecords.filter((record: { subscriberemail_id: number }) => {
            return record.subscriberemail_id === model.id
          })

          model[relation] = records.length === 1 ? records[0] : records
          return model
        })
      }
      else {
        const records = relatedRecords.filter((record: { subscriberemail_id: number }) => {
          return record.subscriberemail_id === models.id
        })

        models[relation] = records.length === 1 ? records[0] : records
      }
    }
  }

  with(relations: string[]): SubscriberEmailModel {
    this.withRelations = relations

    return this
  }

  static with(relations: string[]): SubscriberEmailModel {
    const instance = new SubscriberEmailModel(null)

    instance.withRelations = relations

    return instance
  }

  async last(): Promise<SubscriberEmailType | undefined> {
    let model: SubscriberEmailModel | undefined

    if (this.hasSelect) {
      model = await this.selectFromQuery.executeTakeFirst()
    }
    else {
      model = await this.selectFromQuery.selectAll().orderBy('id', 'desc').executeTakeFirst()
    }

    if (model)
      await this.loadRelations(model)

    const data = new SubscriberEmailModel(model as SubscriberEmailType)

    return data
  }

  static async last(): Promise<SubscriberEmailType | undefined> {
    const model = await DB.instance.selectFrom('subscriber_emails').selectAll().orderBy('id', 'desc').executeTakeFirst()

    if (!model)
      return undefined

    const data = new SubscriberEmailModel(model as SubscriberEmailType)

    return data
  }

  orderBy(column: keyof SubscriberEmailType, order: 'asc' | 'desc'): SubscriberEmailModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, order)

    return this
  }

  static orderBy(column: keyof SubscriberEmailType, order: 'asc' | 'desc'): SubscriberEmailModel {
    const instance = new SubscriberEmailModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, order)

    return instance
  }

  groupBy(column: keyof SubscriberEmailType): SubscriberEmailModel {
    this.selectFromQuery = this.selectFromQuery.groupBy(column)

    return this
  }

  static groupBy(column: keyof SubscriberEmailType): SubscriberEmailModel {
    const instance = new SubscriberEmailModel(null)

    instance.selectFromQuery = instance.selectFromQuery.groupBy(column)

    return instance
  }

  having(column: keyof SubscriberEmailType, operator: string, value: any): SubscriberEmailModel {
    this.selectFromQuery = this.selectFromQuery.having(column, operator, value)

    return this
  }

  static having(column: keyof SubscriberEmailType, operator: string, value: any): SubscriberEmailModel {
    const instance = new SubscriberEmailModel(null)

    instance.selectFromQuery = instance.selectFromQuery.having(column, operator, value)

    return instance
  }

  inRandomOrder(): SubscriberEmailModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(sql` ${sql.raw('RANDOM()')} `)

    return this
  }

  static inRandomOrder(): SubscriberEmailModel {
    const instance = new SubscriberEmailModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(sql` ${sql.raw('RANDOM()')} `)

    return instance
  }

  orderByDesc(column: keyof SubscriberEmailType): SubscriberEmailModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, 'desc')

    return this
  }

  static orderByDesc(column: keyof SubscriberEmailType): SubscriberEmailModel {
    const instance = new SubscriberEmailModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, 'desc')

    return instance
  }

  orderByAsc(column: keyof SubscriberEmailType): SubscriberEmailModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, 'asc')

    return this
  }

  static orderByAsc(column: keyof SubscriberEmailType): SubscriberEmailModel {
    const instance = new SubscriberEmailModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, 'asc')

    return instance
  }

  async update(newSubscriberEmail: SubscriberEmailUpdate): Promise<SubscriberEmailModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newSubscriberEmail).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewSubscriberEmail

    await DB.instance.updateTable('subscriber_emails')
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

  async forceUpdate(subscriberemail: SubscriberEmailUpdate): Promise<SubscriberEmailModel | undefined> {
    if (this.id === undefined) {
      this.updateFromQuery.set(subscriberemail).execute()
    }

    await DB.instance.updateTable('subscriber_emails')
      .set(subscriberemail)
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
      throw new HttpError(500, 'SubscriberEmail data is undefined')

    const filteredValues = Object.fromEntries(
      Object.entries(this.attributes).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewSubscriberEmail

    if (this.id === undefined) {
      await DB.instance.insertInto('subscriber_emails')
        .values(filteredValues)
        .executeTakeFirstOrThrow()
    }
    else {
      await this.update(this.attributes)
    }

    this.hasSaved = true
  }

  fill(data: Partial<SubscriberEmailType>): SubscriberEmailModel {
    const filteredValues = Object.fromEntries(
      Object.entries(data).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewSubscriberEmail

    this.attributes = {
      ...this.attributes,
      ...filteredValues,
    }

    return this
  }

  forceFill(data: Partial<SubscriberEmailType>): SubscriberEmailModel {
    this.attributes = {
      ...this.attributes,
      ...data,
    }

    return this
  }

  // Method to delete (soft delete) the subscriberemail instance
  async delete(): Promise<any> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()

    if (this.softDeletes) {
      return await DB.instance.updateTable('subscriber_emails')
        .set({
          deleted_at: sql.raw('CURRENT_TIMESTAMP'),
        })
        .where('id', '=', this.id)
        .execute()
    }

    return await DB.instance.deleteFrom('subscriber_emails')
      .where('id', '=', this.id)
      .execute()
  }

  distinct(column: keyof SubscriberEmailType): SubscriberEmailModel {
    this.selectFromQuery = this.selectFromQuery.select(column).distinct()

    this.hasSelect = true

    return this
  }

  static distinct(column: keyof SubscriberEmailType): SubscriberEmailModel {
    const instance = new SubscriberEmailModel(null)

    instance.selectFromQuery = instance.selectFromQuery.select(column).distinct()

    instance.hasSelect = true

    return instance
  }

  join(table: string, firstCol: string, secondCol: string): SubscriberEmailModel {
    this.selectFromQuery = this.selectFromQuery.innerJoin(table, firstCol, secondCol)

    return this
  }

  static join(table: string, firstCol: string, secondCol: string): SubscriberEmailModel {
    const instance = new SubscriberEmailModel(null)

    instance.selectFromQuery = instance.selectFromQuery.innerJoin(table, firstCol, secondCol)

    return instance
  }

  toJSON(): Partial<SubscriberEmailJsonResponse> {
    const output: Partial<SubscriberEmailJsonResponse> = {

      id: this.id,
      email: this.email,

      created_at: this.created_at,

      updated_at: this.updated_at,

      deleted_at: this.deleted_at,

      ...this.customColumns,
    }

    return output
  }

  parseResult(model: SubscriberEmailModel): SubscriberEmailModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof SubscriberEmailModel]
    }

    return model
  }
}

async function find(id: number): Promise<SubscriberEmailModel | undefined> {
  const query = DB.instance.selectFrom('subscriber_emails').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  return new SubscriberEmailModel(model)
}

export async function count(): Promise<number> {
  const results = await SubscriberEmailModel.count()

  return results
}

export async function create(newSubscriberEmail: NewSubscriberEmail): Promise<SubscriberEmailModel> {
  const result = await DB.instance.insertInto('subscriber_emails')
    .values(newSubscriberEmail)
    .executeTakeFirstOrThrow()

  return await find(Number(result.numInsertedOrUpdatedRows)) as SubscriberEmailModel
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(DB.instance)
}

export async function remove(id: number): Promise<void> {
  await DB.instance.deleteFrom('subscriber_emails')
    .where('id', '=', id)
    .execute()
}

export async function whereEmail(value: string): Promise<SubscriberEmailModel[]> {
  const query = DB.instance.selectFrom('subscriber_emails').where('email', '=', value)
  const results = await query.execute()

  return results.map((modelItem: SubscriberEmailModel) => new SubscriberEmailModel(modelItem))
}

export const SubscriberEmail = SubscriberEmailModel

export default SubscriberEmail
