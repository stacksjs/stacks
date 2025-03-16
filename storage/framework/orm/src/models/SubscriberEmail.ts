import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import { cache } from '@stacksjs/cache'
import { sql } from '@stacksjs/database'
import { HttpError, ModelNotFoundException } from '@stacksjs/error-handling'
import { BaseOrm, DB, SubqueryBuilder } from '@stacksjs/orm'

export interface SubscriberEmailsTable {
  id: Generated<number>
  email: string

  created_at?: Date

  updated_at?: Date

  deleted_at?: Date

}

export interface SubscriberEmailResponse {
  data: SubscriberEmailJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface SubscriberEmailJsonResponse extends Omit<Selectable<SubscriberEmailsTable>, 'password'> {
  [key: string]: any
}

export type NewSubscriberEmail = Insertable<SubscriberEmailsTable>
export type SubscriberEmailUpdate = Updateable<SubscriberEmailsTable>

      type SortDirection = 'asc' | 'desc'
interface SortOptions { column: SubscriberEmailJsonResponse, order: SortDirection }
// Define a type for the options parameter
interface QueryOptions {
  sort?: SortOptions
  limit?: number
  offset?: number
  page?: number
}

export class SubscriberEmailModel extends BaseOrm<SubscriberEmailModel, SubscriberEmailsTable> {
  private readonly hidden: Array<keyof SubscriberEmailJsonResponse> = []
  private readonly fillable: Array<keyof SubscriberEmailJsonResponse> = ['email', 'uuid']
  private readonly guarded: Array<keyof SubscriberEmailJsonResponse> = []
  protected attributes = {} as SubscriberEmailJsonResponse
  protected originalAttributes = {} as SubscriberEmailJsonResponse
  private softDeletes = false
  protected selectFromQuery: any
  protected withRelations: string[]
  protected updateFromQuery: any
  protected deleteFromQuery: any
  protected hasSelect: boolean
  private hasSaved: boolean
  private customColumns: Record<string, unknown> = {}

  constructor(subscriberEmail: SubscriberEmailJsonResponse | undefined) {
    super('subscriber_emails')
    if (subscriberEmail) {
      this.attributes = { ...subscriberEmail }
      this.originalAttributes = { ...subscriberEmail }

      Object.keys(subscriberEmail).forEach((key) => {
        if (!(key in this)) {
          this.customColumns[key] = (subscriberEmail as SubscriberEmailJsonResponse)[key]
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

  protected mapCustomGetters(models: SubscriberEmailJsonResponse | SubscriberEmailJsonResponse[]): void {
    const data = models

    if (Array.isArray(data)) {
      data.map((model: SubscriberEmailJsonResponse) => {
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

  async mapCustomSetters(model: NewSubscriberEmail | SubscriberEmailUpdate): Promise<void> {
    const customSetter = {
      default: () => {
      },

    }

    for (const [key, fn] of Object.entries(customSetter)) {
      model[key] = await fn()
    }
  }

  get id(): number {
    return this.attributes.id
  }

  get email(): string {
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

  getOriginal(column?: keyof SubscriberEmailJsonResponse): Partial<SubscriberEmailJsonResponse> {
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

  isDirty(column?: keyof SubscriberEmailJsonResponse): boolean {
    if (column) {
      return this.attributes[column] !== this.originalAttributes[column]
    }

    return Object.entries(this.originalAttributes).some(([key, originalValue]) => {
      const currentValue = (this.attributes as any)[key]

      return currentValue !== originalValue
    })
  }

  isClean(column?: keyof SubscriberEmailJsonResponse): boolean {
    return !this.isDirty(column)
  }

  wasChanged(column?: keyof SubscriberEmailJsonResponse): boolean {
    return this.hasSaved && this.isDirty(column)
  }

  select(params: (keyof SubscriberEmailJsonResponse)[] | RawBuilder<string> | string): SubscriberEmailModel {
    this.selectFromQuery = this.selectFromQuery.select(params)

    this.hasSelect = true

    return this
  }

  static select(params: (keyof SubscriberEmailJsonResponse)[] | RawBuilder<string> | string): SubscriberEmailModel {
    const instance = new SubscriberEmailModel(undefined)

    // Initialize a query with the table name and selected fields
    instance.selectFromQuery = instance.selectFromQuery.select(params)

    instance.hasSelect = true

    return instance
  }

  // Method to find a SubscriberEmail by ID
  static async find(id: number): Promise<SubscriberEmailModel | undefined> {
    const instance = new SubscriberEmailModel(undefined)

    return await instance.applyFind(id)
  }

  async first(): Promise<SubscriberEmailModel | undefined> {
    const model = await this.applyFirst()

    const data = new SubscriberEmailModel(model)

    return data
  }

  static async first(): Promise<SubscriberEmailModel | undefined> {
    const instance = new SubscriberEmailModel(undefined)

    const model = await instance.applyFirst()

    const data = new SubscriberEmailModel(model)

    return data
  }

  async applyFirstOrFail(): Promise<SubscriberEmailModel | undefined> {
    const model = await this.selectFromQuery.executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, 'No SubscriberEmailModel results found for query')

    if (model) {
      this.mapCustomGetters(model)
      await this.loadRelations(model)
    }

    const data = new SubscriberEmailModel(model)

    return data
  }

  async firstOrFail(): Promise<SubscriberEmailModel | undefined> {
    return await this.applyFirstOrFail()
  }

  static async firstOrFail(): Promise<SubscriberEmailModel | undefined> {
    const instance = new SubscriberEmailModel(undefined)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<SubscriberEmailModel[]> {
    const instance = new SubscriberEmailModel(undefined)

    const models = await DB.instance.selectFrom('subscriber_emails').selectAll().execute()

    instance.mapCustomGetters(models)

    const data = await Promise.all(models.map(async (model: SubscriberEmailJsonResponse) => {
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

    cache.getOrSet(`subscriberEmail:${id}`, JSON.stringify(model))

    this.mapCustomGetters(model)
    await this.loadRelations(model)

    const data = new SubscriberEmailModel(model)

    return data
  }

  async findOrFail(id: number): Promise<SubscriberEmailModel> {
    return await this.applyFindOrFail(id)
  }

  static async findOrFail(id: number): Promise<SubscriberEmailModel> {
    const instance = new SubscriberEmailModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  async applyFindMany(ids: number[]): Promise<SubscriberEmailModel[]> {
    let query = DB.instance.selectFrom('subscriber_emails').where('id', 'in', ids)

    const instance = new SubscriberEmailModel(undefined)

    if (instance.softDeletes) {
      query = query.where('deleted_at', 'is', null)
    }

    query = query.selectAll()

    const models = await query.execute()

    instance.mapCustomGetters(models)
    await instance.loadRelations(models)

    return models.map((modelItem: SubscriberEmailJsonResponse) => instance.parseResult(new SubscriberEmailModel(modelItem)))
  }

  static async findMany(ids: number[]): Promise<SubscriberEmailModel[]> {
    const instance = new SubscriberEmailModel(undefined)

    return await instance.applyFindMany(ids)
  }

  async findMany(ids: number[]): Promise<SubscriberEmailModel[]> {
    return await this.applyFindMany(ids)
  }

  skip(count: number): SubscriberEmailModel {
    this.selectFromQuery = this.selectFromQuery.offset(count)

    return this
  }

  static skip(count: number): SubscriberEmailModel {
    const instance = new SubscriberEmailModel(undefined)

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
    const instance = new SubscriberEmailModel(undefined)

    await instance.applyChunk(size, callback)
  }

  take(count: number): SubscriberEmailModel {
    this.selectFromQuery = this.selectFromQuery.limit(count)

    return this
  }

  static take(count: number): SubscriberEmailModel {
    const instance = new SubscriberEmailModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.limit(count)

    return instance
  }

  static async pluck<K extends keyof SubscriberEmailModel>(field: K): Promise<SubscriberEmailModel[K][]> {
    const instance = new SubscriberEmailModel(undefined)

    if (instance.hasSelect) {
      const model = await instance.selectFromQuery.execute()
      return model.map((modelItem: SubscriberEmailModel) => modelItem[field])
    }

    const model = await instance.selectFromQuery.selectAll().execute()

    return model.map((modelItem: SubscriberEmailModel) => modelItem[field])
  }

  async pluck<K extends keyof SubscriberEmailModel>(field: K): Promise<SubscriberEmailModel[K][]> {
    if (this.hasSelect) {
      const model = await this.selectFromQuery.execute()
      return model.map((modelItem: SubscriberEmailModel) => modelItem[field])
    }

    const model = await this.selectFromQuery.selectAll().execute()

    return model.map((modelItem: SubscriberEmailModel) => modelItem[field])
  }

  static async count(): Promise<number> {
    const instance = new SubscriberEmailModel(undefined)

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
    const instance = new SubscriberEmailModel(undefined)

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
    const instance = new SubscriberEmailModel(undefined)

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
    const instance = new SubscriberEmailModel(undefined)

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
    const instance = new SubscriberEmailModel(undefined)

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

    this.mapCustomGetters(models)
    await this.loadRelations(models)

    const data = await Promise.all(models.map(async (model: SubscriberEmailJsonResponse) => {
      return new SubscriberEmailModel(model)
    }))

    return data
  }

  async get(): Promise<SubscriberEmailModel[]> {
    return await this.applyGet()
  }

  static async get(): Promise<SubscriberEmailModel[]> {
    const instance = new SubscriberEmailModel(undefined)

    return await instance.applyGet()
  }

  has(relation: string): SubscriberEmailModel {
    this.selectFromQuery = this.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(
        selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.subscriberEmail_id`, '=', 'subscriber_emails.id'),
      ),
    )

    return this
  }

  static has(relation: string): SubscriberEmailModel {
    const instance = new SubscriberEmailModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(
        selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.subscriberEmail_id`, '=', 'subscriber_emails.id'),
      ),
    )

    return instance
  }

  static whereExists(callback: (qb: any) => any): SubscriberEmailModel {
    const instance = new SubscriberEmailModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(callback({ exists, selectFrom })),
    )

    return instance
  }

  applyWhereHas(
    relation: string,
    callback: (query: SubqueryBuilder<keyof SubscriberEmailModel>) => void,
  ): SubscriberEmailModel {
    const subqueryBuilder = new SubqueryBuilder()

    callback(subqueryBuilder)
    const conditions = subqueryBuilder.getConditions()

    this.selectFromQuery = this.selectFromQuery
      .where(({ exists, selectFrom }: any) => {
        let subquery = selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.subscriberEmail_id`, '=', 'subscriber_emails.id')

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
    callback: (query: SubqueryBuilder<keyof SubscriberEmailModel>) => void,
  ): SubscriberEmailModel {
    return this.applyWhereHas(relation, callback)
  }

  static whereHas(
    relation: string,
    callback: (query: SubqueryBuilder<keyof SubscriberEmailModel>) => void,
  ): SubscriberEmailModel {
    const instance = new SubscriberEmailModel(undefined)

    return instance.applyWhereHas(relation, callback)
  }

  applyDoesntHave(relation: string): SubscriberEmailModel {
    this.selectFromQuery = this.selectFromQuery.where(({ not, exists, selectFrom }: any) =>
      not(
        exists(
          selectFrom(relation)
            .select('1')
            .whereRef(`${relation}.subscriberEmail_id`, '=', 'subscriber_emails.id'),
        ),
      ),
    )

    return this
  }

  doesntHave(relation: string): SubscriberEmailModel {
    return this.applyDoesntHave(relation)
  }

  static doesntHave(relation: string): SubscriberEmailModel {
    const instance = new SubscriberEmailModel(undefined)

    return instance.applyDoesntHave(relation)
  }

  applyWhereDoesntHave(relation: string, callback: (query: SubqueryBuilder<SubscriberEmailsTable>) => void): SubscriberEmailModel {
    const subqueryBuilder = new SubqueryBuilder()

    callback(subqueryBuilder)
    const conditions = subqueryBuilder.getConditions()

    this.selectFromQuery = this.selectFromQuery
      .where(({ exists, selectFrom, not }: any) => {
        const subquery = selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.subscriberEmail_id`, '=', 'subscriber_emails.id')

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

  whereDoesntHave(relation: string, callback: (query: SubqueryBuilder<SubscriberEmailsTable>) => void): SubscriberEmailModel {
    return this.applyWhereDoesntHave(relation, callback)
  }

  static whereDoesntHave(
    relation: string,
    callback: (query: SubqueryBuilder<SubscriberEmailsTable>) => void,
  ): SubscriberEmailModel {
    const instance = new SubscriberEmailModel(undefined)

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
    const instance = new SubscriberEmailModel(undefined)

    return await instance.applyPaginate(options)
  }

  async applyCreate(newSubscriberEmail: NewSubscriberEmail): Promise<SubscriberEmailModel> {
    const filteredValues = Object.fromEntries(
      Object.entries(newSubscriberEmail).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewSubscriberEmail

    await this.mapCustomSetters(filteredValues)

    const result = await DB.instance.insertInto('subscriber_emails')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await this.find(Number(result.numInsertedOrUpdatedRows)) as SubscriberEmailModel

    return model
  }

  async create(newSubscriberEmail: NewSubscriberEmail): Promise<SubscriberEmailModel> {
    return await this.applyCreate(newSubscriberEmail)
  }

  static async create(newSubscriberEmail: NewSubscriberEmail): Promise<SubscriberEmailModel> {
    const instance = new SubscriberEmailModel(undefined)

    return await instance.applyCreate(newSubscriberEmail)
  }

  static async createMany(newSubscriberEmail: NewSubscriberEmail[]): Promise<void> {
    const instance = new SubscriberEmailModel(undefined)

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
    const instance = new SubscriberEmailModel(undefined)

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

  static where<V = string>(column: keyof SubscriberEmailsTable, ...args: [V] | [Operator, V]): SubscriberEmailModel {
    const instance = new SubscriberEmailModel(undefined)

    return instance.applyWhere<V>(column, ...args)
  }

  whereColumn(first: keyof SubscriberEmailsTable, operator: Operator, second: keyof SubscriberEmailsTable): SubscriberEmailModel {
    this.selectFromQuery = this.selectFromQuery.whereRef(first, operator, second)

    return this
  }

  static whereColumn(first: keyof SubscriberEmailsTable, operator: Operator, second: keyof SubscriberEmailsTable): SubscriberEmailModel {
    const instance = new SubscriberEmailModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.whereRef(first, operator, second)

    return instance
  }

  applyWhereRef(column: keyof SubscriberEmailsTable, ...args: string[]): SubscriberEmailModel {
    const [operatorOrValue, value] = args
    const operator = value === undefined ? '=' : operatorOrValue
    const actualValue = value === undefined ? operatorOrValue : value

    const instance = new SubscriberEmailModel(undefined)
    instance.selectFromQuery = instance.selectFromQuery.whereRef(column, operator, actualValue)

    return instance
  }

  whereRef(column: keyof SubscriberEmailsTable, ...args: string[]): SubscriberEmailModel {
    return this.applyWhereRef(column, ...args)
  }

  static whereRef(column: keyof SubscriberEmailsTable, ...args: string[]): SubscriberEmailModel {
    const instance = new SubscriberEmailModel(undefined)

    return instance.applyWhereRef(column, ...args)
  }

  whereRaw(sqlStatement: string): SubscriberEmailModel {
    this.selectFromQuery = this.selectFromQuery.where(sql`${sqlStatement}`)

    return this
  }

  static whereRaw(sqlStatement: string): SubscriberEmailModel {
    const instance = new SubscriberEmailModel(undefined)

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
    const instance = new SubscriberEmailModel(undefined)

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
    let instance = new SubscriberEmailModel(undefined)

    if (condition)
      instance = callback(instance)

    return instance
  }

  whereNotNull(column: keyof SubscriberEmailsTable): SubscriberEmailModel {
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

  static whereNotNull(column: keyof SubscriberEmailsTable): SubscriberEmailModel {
    const instance = new SubscriberEmailModel(undefined)

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

  whereNull(column: keyof SubscriberEmailsTable): SubscriberEmailModel {
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

  static whereNull(column: keyof SubscriberEmailsTable): SubscriberEmailModel {
    const instance = new SubscriberEmailModel(undefined)

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

  static whereEmail(value: string): SubscriberEmailModel {
    const instance = new SubscriberEmailModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('email', '=', value)

    return instance
  }

  applyWhereIn<V>(column: keyof SubscriberEmailsTable, values: V[]) {
    this.selectFromQuery = this.selectFromQuery.where(column, 'in', values)

    this.updateFromQuery = this.updateFromQuery.where(column, 'in', values)

    this.deleteFromQuery = this.deleteFromQuery.where(column, 'in', values)

    return this
  }

  whereIn<V = number>(column: keyof SubscriberEmailsTable, values: V[]): SubscriberEmailModel {
    return this.applyWhereIn<V>(column, values)
  }

  static whereIn<V = number>(column: keyof SubscriberEmailsTable, values: V[]): SubscriberEmailModel {
    const instance = new SubscriberEmailModel(undefined)

    return instance.applyWhereIn<V>(column, values)
  }

  applyWhereBetween<V>(column: keyof SubscriberEmailsTable, range: [V, V]): SubscriberEmailModel {
    if (range.length !== 2) {
      throw new HttpError(500, 'Range must have exactly two values: [min, max]')
    }

    const query = sql` ${sql.raw(column as string)} between ${range[0]} and ${range[1]} `

    this.selectFromQuery = this.selectFromQuery.where(query)
    this.updateFromQuery = this.updateFromQuery.where(query)
    this.deleteFromQuery = this.deleteFromQuery.where(query)

    return this
  }

  whereBetween<V = number>(column: keyof SubscriberEmailsTable, range: [V, V]): SubscriberEmailModel {
    return this.applyWhereBetween<V>(column, range)
  }

  static whereBetween<V = number>(column: keyof SubscriberEmailsTable, range: [V, V]): SubscriberEmailModel {
    const instance = new SubscriberEmailModel(undefined)

    return instance.applyWhereBetween<V>(column, range)
  }

  applyWhereLike(column: keyof SubscriberEmailsTable, value: string): SubscriberEmailModel {
    this.selectFromQuery = this.selectFromQuery.where(sql` ${sql.raw(column as string)} LIKE ${value}`)

    this.updateFromQuery = this.updateFromQuery.where(sql` ${sql.raw(column as string)} LIKE ${value}`)

    this.deleteFromQuery = this.deleteFromQuery.where(sql` ${sql.raw(column as string)} LIKE ${value}`)

    return this
  }

  whereLike(column: keyof SubscriberEmailsTable, value: string): SubscriberEmailModel {
    return this.applyWhereLike(column, value)
  }

  static whereLike(column: keyof SubscriberEmailsTable, value: string): SubscriberEmailModel {
    const instance = new SubscriberEmailModel(undefined)

    return instance.applyWhereLike(column, value)
  }

  applyWhereNotIn<V>(column: keyof SubscriberEmailsTable, values: V[]): SubscriberEmailModel {
    this.selectFromQuery = this.selectFromQuery.where(column, 'not in', values)

    this.updateFromQuery = this.updateFromQuery.where(column, 'not in', values)

    this.deleteFromQuery = this.deleteFromQuery.where(column, 'not in', values)

    return this
  }

  whereNotIn<V>(column: keyof SubscriberEmailsTable, values: V[]): SubscriberEmailModel {
    return this.applyWhereNotIn<V>(column, values)
  }

  static whereNotIn<V = number>(column: keyof SubscriberEmailsTable, values: V[]): SubscriberEmailModel {
    const instance = new SubscriberEmailModel(undefined)

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

  static async latest(): Promise<SubscriberEmailModel | undefined> {
    const instance = new SubscriberEmailModel(undefined)

    const model = await DB.instance.selectFrom('subscriber_emails')
      .selectAll()
      .orderBy('id', 'desc')
      .executeTakeFirst()

    if (!model)
      return undefined

    instance.mapCustomGetters(model)

    const data = new SubscriberEmailModel(model)

    return data
  }

  static async oldest(): Promise<SubscriberEmailModel | undefined> {
    const instance = new SubscriberEmailModel(undefined)

    const model = await DB.instance.selectFrom('subscriber_emails')
      .selectAll()
      .orderBy('id', 'asc')
      .executeTakeFirst()

    if (!model)
      return undefined

    instance.mapCustomGetters(model)

    const data = new SubscriberEmailModel(model)

    return data
  }

  static async firstOrCreate(
    condition: Partial<SubscriberEmailJsonResponse>,
    newSubscriberEmail: NewSubscriberEmail,
  ): Promise<SubscriberEmailModel> {
    const instance = new SubscriberEmailModel(undefined)

    const key = Object.keys(condition)[0] as keyof SubscriberEmailJsonResponse

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
      instance.mapCustomGetters(existingSubscriberEmail)
      await instance.loadRelations(existingSubscriberEmail)

      return new SubscriberEmailModel(existingSubscriberEmail as SubscriberEmailJsonResponse)
    }
    else {
      return await instance.create(newSubscriberEmail)
    }
  }

  static async updateOrCreate(
    condition: Partial<SubscriberEmailJsonResponse>,
    newSubscriberEmail: NewSubscriberEmail,
  ): Promise<SubscriberEmailModel> {
    const instance = new SubscriberEmailModel(undefined)

    const key = Object.keys(condition)[0] as keyof SubscriberEmailJsonResponse

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

      return new SubscriberEmailModel(updatedSubscriberEmail as SubscriberEmailJsonResponse)
    }
    else {
      // If not found, create a new record
      return await instance.create(newSubscriberEmail)
    }
  }

  protected async loadRelations(models: SubscriberEmailJsonResponse | SubscriberEmailJsonResponse[]): Promise<void> {
    // Handle both single model and array of models
    const modelArray = Array.isArray(models) ? models : [models]
    if (!modelArray.length)
      return

    const modelIds = modelArray.map(model => model.id)

    for (const relation of this.withRelations) {
      const relatedRecords = await DB.instance
        .selectFrom(relation)
        .where('subscriberEmail_id', 'in', modelIds)
        .selectAll()
        .execute()

      if (Array.isArray(models)) {
        models.map((model: SubscriberEmailJsonResponse) => {
          const records = relatedRecords.filter((record: { subscriberEmail_id: number }) => {
            return record.subscriberEmail_id === model.id
          })

          model[relation] = records.length === 1 ? records[0] : records
          return model
        })
      }
      else {
        const records = relatedRecords.filter((record: { subscriberEmail_id: number }) => {
          return record.subscriberEmail_id === models.id
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
    const instance = new SubscriberEmailModel(undefined)

    instance.withRelations = relations

    return instance
  }

  async last(): Promise<SubscriberEmailModel | undefined> {
    let model: SubscriberEmailJsonResponse | undefined

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

    const data = new SubscriberEmailModel(model)

    return data
  }

  static async last(): Promise<SubscriberEmailModel | undefined> {
    const model = await DB.instance.selectFrom('subscriber_emails').selectAll().orderBy('id', 'desc').executeTakeFirst()

    if (!model)
      return undefined

    const data = new SubscriberEmailModel(model)

    return data
  }

  orderBy(column: keyof SubscriberEmailsTable, order: 'asc' | 'desc'): SubscriberEmailModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, order)

    return this
  }

  static orderBy(column: keyof SubscriberEmailsTable, order: 'asc' | 'desc'): SubscriberEmailModel {
    const instance = new SubscriberEmailModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, order)

    return instance
  }

  groupBy(column: keyof SubscriberEmailsTable): SubscriberEmailModel {
    this.selectFromQuery = this.selectFromQuery.groupBy(column)

    return this
  }

  static groupBy(column: keyof SubscriberEmailsTable): SubscriberEmailModel {
    const instance = new SubscriberEmailModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.groupBy(column)

    return instance
  }

  having<V = string>(column: keyof SubscriberEmailsTable, operator: Operator, value: V): SubscriberEmailModel {
    this.selectFromQuery = this.selectFromQuery.having(column, operator, value)

    return this
  }

  static having<V = string>(column: keyof SubscriberEmailsTable, operator: Operator, value: V): SubscriberEmailModel {
    const instance = new SubscriberEmailModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.having(column, operator, value)

    return instance
  }

  inRandomOrder(): SubscriberEmailModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(sql` ${sql.raw('RANDOM()')} `)

    return this
  }

  static inRandomOrder(): SubscriberEmailModel {
    const instance = new SubscriberEmailModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(sql` ${sql.raw('RANDOM()')} `)

    return instance
  }

  orderByDesc(column: keyof SubscriberEmailsTable): SubscriberEmailModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, 'desc')

    return this
  }

  static orderByDesc(column: keyof SubscriberEmailsTable): SubscriberEmailModel {
    const instance = new SubscriberEmailModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, 'desc')

    return instance
  }

  orderByAsc(column: keyof SubscriberEmailsTable): SubscriberEmailModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, 'asc')

    return this
  }

  static orderByAsc(column: keyof SubscriberEmailsTable): SubscriberEmailModel {
    const instance = new SubscriberEmailModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, 'asc')

    return instance
  }

  async update(newSubscriberEmail: SubscriberEmailUpdate): Promise<SubscriberEmailModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newSubscriberEmail).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewSubscriberEmail

    await this.mapCustomSetters(filteredValues)

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

  async forceUpdate(subscriberEmail: SubscriberEmailUpdate): Promise<SubscriberEmailModel | undefined> {
    if (this.id === undefined) {
      this.updateFromQuery.set(subscriberEmail).execute()
    }

    await this.mapCustomSetters(subscriberEmail)

    await DB.instance.updateTable('subscriber_emails')
      .set(subscriberEmail)
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

    await this.mapCustomSetters(this.attributes)

    if (this.id === undefined) {
      await this.create(this.attributes)
    }
    else {
      await this.update(this.attributes)
    }

    this.hasSaved = true
  }

  fill(data: Partial<SubscriberEmailJsonResponse>): SubscriberEmailModel {
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

  forceFill(data: Partial<SubscriberEmailJsonResponse>): SubscriberEmailModel {
    this.attributes = {
      ...this.attributes,
      ...data,
    }

    return this
  }

  // Method to delete (soft delete) the subscriberEmail instance
  async delete(): Promise<SubscriberEmailsTable> {
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

  distinct(column: keyof SubscriberEmailJsonResponse): SubscriberEmailModel {
    this.selectFromQuery = this.selectFromQuery.select(column).distinct()

    this.hasSelect = true

    return this
  }

  static distinct(column: keyof SubscriberEmailJsonResponse): SubscriberEmailModel {
    const instance = new SubscriberEmailModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.select(column).distinct()

    instance.hasSelect = true

    return instance
  }

  join(table: string, firstCol: string, secondCol: string): SubscriberEmailModel {
    this.selectFromQuery = this.selectFromQuery.innerJoin(table, firstCol, secondCol)

    return this
  }

  static join(table: string, firstCol: string, secondCol: string): SubscriberEmailModel {
    const instance = new SubscriberEmailModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.innerJoin(table, firstCol, secondCol)

    return instance
  }

  toJSON(): SubscriberEmailJsonResponse {
    const output = {

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
  const results: SubscriberEmailJsonResponse = await query.execute()

  return results.map((modelItem: SubscriberEmailJsonResponse) => new SubscriberEmailModel(modelItem))
}

export const SubscriberEmail = SubscriberEmailModel

export default SubscriberEmail
