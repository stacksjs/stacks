import type { Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import { cache } from '@stacksjs/cache'
import { sql } from '@stacksjs/database'
import { HttpError, ModelNotFoundException } from '@stacksjs/error-handling'
import { dispatch } from '@stacksjs/events'
import { DB, SubqueryBuilder } from '@stacksjs/orm'

export interface ErrorsTable {
  id?: number
  type?: string
  message?: string
  stack?: string
  status?: number
  additional_info?: string

  created_at?: Date

  updated_at?: Date

}

interface ErrorResponse {
  data: ErrorJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface ErrorJsonResponse extends Omit<ErrorsTable, 'password'> {
  [key: string]: any
}

export type ErrorType = Selectable<ErrorsTable>
export type NewError = Partial<Insertable<ErrorsTable>>
export type ErrorUpdate = Updateable<ErrorsTable>

      type SortDirection = 'asc' | 'desc'
interface SortOptions { column: ErrorType, order: SortDirection }
// Define a type for the options parameter
interface QueryOptions {
  sort?: SortOptions
  limit?: number
  offset?: number
  page?: number
}

export class ErrorModel {
  private readonly hidden: Array<keyof ErrorJsonResponse> = []
  private readonly fillable: Array<keyof ErrorJsonResponse> = ['type', 'message', 'stack', 'status', 'additional_info', 'uuid']
  private readonly guarded: Array<keyof ErrorJsonResponse> = []
  protected attributes: Partial<ErrorType> = {}
  protected originalAttributes: Partial<ErrorType> = {}

  protected selectFromQuery: any
  protected withRelations: string[]
  protected updateFromQuery: any
  protected deleteFromQuery: any
  protected hasSelect: boolean
  private hasSaved: boolean
  private customColumns: Record<string, unknown> = {}

  constructor(error: Partial<ErrorType> | null) {
    if (error) {
      this.attributes = { ...error }
      this.originalAttributes = { ...error }

      Object.keys(error).forEach((key) => {
        if (!(key in this)) {
          this.customColumns[key] = (error as ErrorJsonResponse)[key]
        }
      })
    }

    this.withRelations = []
    this.selectFromQuery = DB.instance.selectFrom('errors')
    this.updateFromQuery = DB.instance.updateTable('errors')
    this.deleteFromQuery = DB.instance.deleteFrom('errors')
    this.hasSelect = false
    this.hasSaved = false
  }

  get id(): number | undefined {
    return this.attributes.id
  }

  get type(): string | undefined {
    return this.attributes.type
  }

  get message(): string | undefined {
    return this.attributes.message
  }

  get stack(): string | undefined {
    return this.attributes.stack
  }

  get status(): number | undefined {
    return this.attributes.status
  }

  get additional_info(): string | undefined {
    return this.attributes.additional_info
  }

  get created_at(): Date | undefined {
    return this.attributes.created_at
  }

  get updated_at(): Date | undefined {
    return this.attributes.updated_at
  }

  set type(value: string) {
    this.attributes.type = value
  }

  set message(value: string) {
    this.attributes.message = value
  }

  set stack(value: string) {
    this.attributes.stack = value
  }

  set status(value: number) {
    this.attributes.status = value
  }

  set additional_info(value: string) {
    this.attributes.additional_info = value
  }

  set updated_at(value: Date) {
    this.attributes.updated_at = value
  }

  getOriginal(column?: keyof ErrorType): Partial<UserType> | any {
    if (column) {
      return this.originalAttributes[column]
    }

    return this.originalAttributes
  }

  getChanges(): Partial<ErrorJsonResponse> {
    return this.fillable.reduce<Partial<ErrorJsonResponse>>((changes, key) => {
      const currentValue = this.attributes[key as keyof ErrorsTable]
      const originalValue = this.originalAttributes[key as keyof ErrorsTable]

      if (currentValue !== originalValue) {
        changes[key] = currentValue
      }

      return changes
    }, {})
  }

  isDirty(column?: keyof ErrorType): boolean {
    if (column) {
      return this.attributes[column] !== this.originalAttributes[column]
    }

    return Object.entries(this.originalAttributes).some(([key, originalValue]) => {
      const currentValue = (this.attributes as any)[key]

      return currentValue !== originalValue
    })
  }

  isClean(column?: keyof ErrorType): boolean {
    return !this.isDirty(column)
  }

  wasChanged(column?: keyof ErrorType): boolean {
    return this.hasSaved && this.isDirty(column)
  }

  select(params: (keyof ErrorType)[] | RawBuilder<string> | string): ErrorModel {
    return ErrorModel.select(params)
  }

  static select(params: (keyof ErrorType)[] | RawBuilder<string> | string): ErrorModel {
    const instance = new ErrorModel(null)

    // Initialize a query with the table name and selected fields
    instance.selectFromQuery = instance.selectFromQuery.select(params)

    instance.hasSelect = true

    return instance
  }

  async find(id: number): Promise<ErrorModel | undefined> {
    return await ErrorModel.find(id)
  }

  // Method to find a Error by ID
  static async find(id: number): Promise<ErrorModel | undefined> {
    const model = await DB.instance.selectFrom('errors').where('id', '=', id).selectAll().executeTakeFirst()

    if (!model)
      return undefined

    const instance = new ErrorModel(null)

    const result = await instance.mapWith(model)

    const data = new ErrorModel(result as ErrorType)

    cache.getOrSet(`error:${id}`, JSON.stringify(model))

    return data
  }

  async first(): Promise<ErrorModel | undefined> {
    return await ErrorModel.first()
  }

  static async first(): Promise<ErrorModel | undefined> {
    const model = await DB.instance.selectFrom('errors')
      .selectAll()
      .executeTakeFirst()

    if (!model)
      return undefined

    const instance = new ErrorModel(null)

    const result = await instance.mapWith(model)

    const data = new ErrorModel(result as ErrorType)

    return data
  }

  async firstOrFail(): Promise<ErrorModel | undefined> {
    return await ErrorModel.firstOrFail()
  }

  static async firstOrFail(): Promise<ErrorModel | undefined> {
    const instance = new ErrorModel(null)

    const model = await instance.selectFromQuery.executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, 'No ErrorModel results found for query')

    const result = await instance.mapWith(model)

    const data = new ErrorModel(result as ErrorType)

    return data
  }

  async mapWith(model: ErrorType): Promise<ErrorType> {
    return model
  }

  static async all(): Promise<ErrorModel[]> {
    const models = await DB.instance.selectFrom('errors').selectAll().execute()

    const data = await Promise.all(models.map(async (model: ErrorType) => {
      const instance = new ErrorModel(model)

      const results = await instance.mapWith(model)

      return new ErrorModel(results)
    }))

    return data
  }

  async findOrFail(id: number): Promise<ErrorModel> {
    return await ErrorModel.findOrFail(id)
  }

  static async findOrFail(id: number): Promise<ErrorModel> {
    const model = await DB.instance.selectFrom('errors').where('id', '=', id).selectAll().executeTakeFirst()

    const instance = new ErrorModel(null)

    if (model === undefined)
      throw new ModelNotFoundException(404, `No ErrorModel results for ${id}`)

    cache.getOrSet(`error:${id}`, JSON.stringify(model))

    const result = await instance.mapWith(model)

    const data = new ErrorModel(result as ErrorType)

    return data
  }

  static async findMany(ids: number[]): Promise<ErrorModel[]> {
    let query = DB.instance.selectFrom('errors').where('id', 'in', ids)

    const instance = new ErrorModel(null)

    query = query.selectAll()

    const model = await query.execute()

    return model.map((modelItem: ErrorModel) => instance.parseResult(new ErrorModel(modelItem)))
  }

  skip(count: number): ErrorModel {
    return ErrorModel.skip(count)
  }

  static skip(count: number): ErrorModel {
    const instance = new ErrorModel(null)

    instance.selectFromQuery = instance.selectFromQuery.offset(count)

    return instance
  }

  async chunk(size: number, callback: (models: ErrorModel[]) => Promise<void>): Promise<void> {
    await ErrorModel.chunk(size, callback)
  }

  static async chunk(size: number, callback: (models: ErrorModel[]) => Promise<void>): Promise<void> {
    let page = 1
    let hasMore = true

    while (hasMore) {
      const instance = new ErrorModel(null)

      // Get one batch
      const models = await instance.selectFromQuery
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

  take(count: number): ErrorModel {
    return ErrorModel.take(count)
  }

  static take(count: number): ErrorModel {
    const instance = new ErrorModel(null)

    instance.selectFromQuery = instance.selectFromQuery.limit(count)

    return instance
  }

  static async pluck<K extends keyof ErrorModel>(field: K): Promise<ErrorModel[K][]> {
    const instance = new ErrorModel(null)

    if (instance.hasSelect) {
      const model = await instance.selectFromQuery.execute()
      return model.map((modelItem: ErrorModel) => modelItem[field])
    }

    const model = await instance.selectFromQuery.selectAll().execute()

    return model.map((modelItem: ErrorModel) => modelItem[field])
  }

  async pluck<K extends keyof ErrorModel>(field: K): Promise<ErrorModel[K][]> {
    return ErrorModel.pluck(field)
  }

  static async count(): Promise<number> {
    const instance = new ErrorModel(null)

    return instance.selectFromQuery
      .select(sql`COUNT(*) as count`)
      .executeTakeFirst()
  }

  async count(): Promise<number> {
    return ErrorModel.count()
  }

  async max(field: keyof ErrorModel): Promise<number> {
    return await this.selectFromQuery
      .select(sql`MAX(${sql.raw(field as string)}) `)
      .executeTakeFirst()
  }

  async min(field: keyof ErrorModel): Promise<number> {
    return await this.selectFromQuery
      .select(sql`MIN(${sql.raw(field as string)}) `)
      .executeTakeFirst()
  }

  async avg(field: keyof ErrorModel): Promise<number> {
    return this.selectFromQuery
      .select(sql`AVG(${sql.raw(field as string)})`)
      .executeTakeFirst()
  }

  async sum(field: keyof ErrorModel): Promise<number> {
    return this.selectFromQuery
      .select(sql`SUM(${sql.raw(field as string)})`)
      .executeTakeFirst()
  }

  async get(): Promise<ErrorModel[]> {
    return ErrorModel.get()
  }

  static async get(): Promise<ErrorModel[]> {
    const instance = new ErrorModel(null)

    let models

    if (instance.hasSelect) {
      models = await instance.selectFromQuery.execute()
    }
    else {
      models = await instance.selectFromQuery.selectAll().execute()
    }

    const data = await Promise.all(models.map(async (model: ErrorModel) => {
      const instance = new ErrorModel(model)

      const results = await instance.mapWith(model)

      return new ErrorModel(results)
    }))

    return data
  }

  has(relation: string): ErrorModel {
    return ErrorModel.has(relation)
  }

  static has(relation: string): ErrorModel {
    const instance = new ErrorModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(
        selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.error_id`, '=', 'errors.id'),
      ),
    )

    return instance
  }

  static whereExists(callback: (qb: any) => any): ErrorModel {
    const instance = new ErrorModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(callback({ exists, selectFrom })),
    )

    return instance
  }

  whereHas(
    relation: string,
    callback: (query: SubqueryBuilder) => void,
  ): ErrorModel {
    return ErrorModel.whereHas(relation, callback)
  }

  static whereHas(
    relation: string,
    callback: (query: SubqueryBuilder) => void,
  ): ErrorModel {
    const instance = new ErrorModel(null)
    const subqueryBuilder = new SubqueryBuilder()

    callback(subqueryBuilder)
    const conditions = subqueryBuilder.getConditions()

    instance.selectFromQuery = instance.selectFromQuery
      .where(({ exists, selectFrom }: any) => {
        let subquery = selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.error_id`, '=', 'errors.id')

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

    return instance
  }

  doesntHave(relation: string): ErrorModel {
    return ErrorModel.doesntHave(relation)
  }

  static doesntHave(relation: string): ErrorModel {
    const instance = new ErrorModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where(({ not, exists, selectFrom }: any) =>
      not(
        exists(
          selectFrom(relation)
            .select('1')
            .whereRef(`${relation}.error_id`, '=', 'errors.id'),
        ),
      ),
    )

    return instance
  }

  whereDoesntHave(relation: string, callback: (query: SubqueryBuilder) => void): ErrorModel {
    return ErrorModel.whereDoesntHave(relation, callback)
  }

  static whereDoesntHave(
    relation: string,
    callback: (query: SubqueryBuilder) => void,
  ): ErrorModel {
    const instance = new ErrorModel(null)
    const subqueryBuilder = new SubqueryBuilder()

    callback(subqueryBuilder)
    const conditions = subqueryBuilder.getConditions()

    instance.selectFromQuery = instance.selectFromQuery
      .where(({ exists, selectFrom, not }: any) => {
        let subquery = selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.error_id`, '=', 'errors.id')

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

    return instance
  }

  async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<ErrorResponse> {
    return ErrorModel.paginate(options)
  }

  // Method to get all errors
  static async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<ErrorResponse> {
    const totalRecordsResult = await DB.instance.selectFrom('errors')
      .select(DB.instance.fn.count('id').as('total')) // Use 'id' or another actual column name
      .executeTakeFirst()

    const totalRecords = Number(totalRecordsResult?.total) || 0
    const totalPages = Math.ceil(totalRecords / (options.limit ?? 10))

    const errorsWithExtra = await DB.instance.selectFrom('errors')
      .selectAll()
      .orderBy('id', 'asc') // Assuming 'id' is used for cursor-based pagination
      .limit((options.limit ?? 10) + 1) // Fetch one extra record
      .offset(((options.page ?? 1) - 1) * (options.limit ?? 10)) // Ensure options.page is not undefined
      .execute()

    let nextCursor = null
    if (errorsWithExtra.length > (options.limit ?? 10))
      nextCursor = errorsWithExtra.pop()?.id ?? null

    return {
      data: errorsWithExtra,
      paging: {
        total_records: totalRecords,
        page: options.page || 1,
        total_pages: totalPages,
      },
      next_cursor: nextCursor,
    }
  }

  static async create(newError: NewError): Promise<ErrorModel> {
    const instance = new ErrorModel(null)

    const filteredValues = Object.fromEntries(
      Object.entries(newError).filter(([key]) =>
        !instance.guarded.includes(key) && instance.fillable.includes(key),
      ),
    ) as NewError

    const result = await DB.instance.insertInto('errors')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await instance.find(Number(result.numInsertedOrUpdatedRows)) as ErrorModel

    if (model)
      dispatch('error:created', model)

    return model
  }

  static async createMany(newError: NewError[]): Promise<void> {
    const instance = new ErrorModel(null)

    const valuesFiltered = newError.map((newError: NewError) => {
      const filteredValues = Object.fromEntries(
        Object.entries(newError).filter(([key]) =>
          !instance.guarded.includes(key) && instance.fillable.includes(key),
        ),
      ) as NewError

      return filteredValues
    })

    await DB.instance.insertInto('errors')
      .values(valuesFiltered)
      .executeTakeFirst()
  }

  static async forceCreate(newError: NewError): Promise<ErrorModel> {
    const result = await DB.instance.insertInto('errors')
      .values(newError)
      .executeTakeFirst()

    const model = await find(Number(result.numInsertedOrUpdatedRows)) as ErrorModel

    return model
  }

  // Method to remove a Error
  static async remove(id: number): Promise<any> {
    return await DB.instance.deleteFrom('errors')
      .where('id', '=', id)
      .execute()
  }

  private static applyWhere(instance: ErrorModel, column: string, ...args: any[]): ErrorModel {
    const [operatorOrValue, value] = args
    const operator = value === undefined ? '=' : operatorOrValue
    const actualValue = value === undefined ? operatorOrValue : value

    instance.selectFromQuery = instance.selectFromQuery.where(column, operator, actualValue)
    instance.updateFromQuery = instance.updateFromQuery.where(column, operator, actualValue)
    instance.deleteFromQuery = instance.deleteFromQuery.where(column, operator, actualValue)

    return instance
  }

  where(column: string, ...args: any[]): ErrorModel {
    return ErrorModel.applyWhere(this, column, ...args)
  }

  static where(column: string, ...args: any[]): ErrorModel {
    const instance = new ErrorModel(null)
    return ErrorModel.applyWhere(instance, column, ...args)
  }

  whereColumn(first: string, operator: string, second: string): ErrorModel {
    return ErrorModel.whereColumn(first, operator, second)
  }

  static whereColumn(first: string, operator: string, second: string): ErrorModel {
    const instance = new ErrorModel(null)

    instance.selectFromQuery = instance.selectFromQuery.whereRef(first, operator, second)

    return instance
  }

  whereRef(column: string, ...args: string[]): ErrorModel {
    return ErrorModel.whereRef(column, ...args)
  }

  static whereRef(column: string, ...args: string[]): ErrorModel {
    const [operatorOrValue, value] = args
    const operator = value === undefined ? '=' : operatorOrValue
    const actualValue = value === undefined ? operatorOrValue : value

    const instance = new ErrorModel(null)
    instance.selectFromQuery = instance.selectFromQuery.whereRef(column, operator, actualValue)
    return instance
  }

  whereRaw(sqlStatement: string): ErrorModel {
    return ErrorModel.whereRaw(sqlStatement)
  }

  static whereRaw(sqlStatement: string): ErrorModel {
    const instance = new ErrorModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where(sql`${sqlStatement}`)

    return instance
  }

  orWhere(...conditions: (string | [string, any] | [string, string, any])[]): ErrorModel {
    return ErrorModel.orWhere(...conditions)
  }

  static orWhere(...conditions: (string | [string, any] | [string, string, any])[]): ErrorModel {
    const instance = new ErrorModel(null)

    if (conditions.length === 0) {
      throw new HttpError(500, 'At least one condition must be provided')
    }

    // Process conditions to handle different formats
    const processedConditions = conditions.map((condition) => {
      if (Array.isArray(condition)) {
        if (condition.length === 2) {
          return [condition[0], '=', condition[1]]
        }
        return condition
      }
      throw new Error('Invalid condition format')
    })

    // Use the expression builder to append the OR conditions
    instance.selectFromQuery = instance.selectFromQuery.where((eb: any) =>
      eb.or(
        processedConditions.map(([column, operator, value]) => eb(column, operator, value)),
      ),
    )

    instance.updateFromQuery = instance.updateFromQuery.where((eb: any) =>
      eb.or(
        processedConditions.map(([column, operator, value]) => eb(column, operator, value)),
      ),
    )

    instance.deleteFromQuery = instance.deleteFromQuery.where((eb: any) =>
      eb.or(
        processedConditions.map(([column, operator, value]) => eb(column, operator, value)),
      ),
    )

    return instance
  }

  when(
    condition: boolean,
    callback: (query: ErrorModel) => ErrorModel,
  ): ErrorModel {
    return ErrorModel.when(condition, callback)
  }

  static when(
    condition: boolean,
    callback: (query: ErrorModel) => ErrorModel,
  ): ErrorModel {
    let instance = new ErrorModel(null)

    if (condition)
      instance = callback(instance)

    return instance
  }

  whereNull(column: string): ErrorModel {
    return ErrorModel.whereNull(column)
  }

  static whereNull(column: string): ErrorModel {
    const instance = new ErrorModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    instance.updateFromQuery = instance.updateFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    return instance
  }

  static whereType(value: string): ErrorModel {
    const instance = new ErrorModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('type', '=', value)

    return instance
  }

  static whereMessage(value: string): ErrorModel {
    const instance = new ErrorModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('message', '=', value)

    return instance
  }

  static whereStack(value: string): ErrorModel {
    const instance = new ErrorModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('stack', '=', value)

    return instance
  }

  static whereStatus(value: string): ErrorModel {
    const instance = new ErrorModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('status', '=', value)

    return instance
  }

  static whereAdditionalInfo(value: string): ErrorModel {
    const instance = new ErrorModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('additional_info', '=', value)

    return instance
  }

  whereIn(column: keyof ErrorType, values: any[]): ErrorModel {
    return ErrorModel.whereIn(column, values)
  }

  static whereIn(column: keyof ErrorType, values: any[]): ErrorModel {
    const instance = new ErrorModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where(column, 'in', values)

    instance.updateFromQuery = instance.updateFromQuery.where(column, 'in', values)

    instance.deleteFromQuery = instance.deleteFromQuery.where(column, 'in', values)

    return instance
  }

  whereBetween(column: keyof ErrorType, range: [any, any]): ErrorModel {
    return ErrorModel.whereBetween(column, range)
  }

  whereLike(column: keyof ErrorType, value: string): ErrorModel {
    return ErrorModel.whereLike(column, value)
  }

  static whereLike(column: keyof ErrorType, value: string): ErrorModel {
    const instance = new ErrorModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where(sql` ${sql.raw(column as string)} LIKE ${value}`)

    instance.updateFromQuery = instance.updateFromQuery.where(sql` ${sql.raw(column as string)} LIKE ${value}`)

    instance.deleteFromQuery = instance.deleteFromQuery.where(sql` ${sql.raw(column as string)} LIKE ${value}`)

    return instance
  }

  static whereBetween(column: keyof ErrorType, range: [any, any]): ErrorModel {
    if (range.length !== 2) {
      throw new HttpError(500, 'Range must have exactly two values: [min, max]')
    }

    const instance = new ErrorModel(null)

    const query = sql` ${sql.raw(column as string)} between ${range[0]} and ${range[1]} `

    instance.selectFromQuery = instance.selectFromQuery.where(query)
    instance.updateFromQuery = instance.updateFromQuery.where(query)
    instance.deleteFromQuery = instance.deleteFromQuery.where(query)

    return instance
  }

  whereNotIn(column: keyof ErrorType, values: any[]): ErrorModel {
    return ErrorModel.whereNotIn(column, values)
  }

  static whereNotIn(column: keyof ErrorType, values: any[]): ErrorModel {
    const instance = new ErrorModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where(column, 'not in', values)

    instance.updateFromQuery = instance.updateFromQuery.where(column, 'not in', values)

    instance.deleteFromQuery = instance.deleteFromQuery.where(column, 'not in', values)

    return instance
  }

  async exists(): Promise<boolean> {
    const model = await this.selectFromQuery.executeTakeFirst()

    return model !== null || model !== undefined
  }

  static async latest(): Promise<ErrorType | undefined> {
    const model = await DB.instance.selectFrom('errors')
      .selectAll()
      .orderBy('created_at', 'desc')
      .executeTakeFirst()

    if (!model)
      return undefined

    const instance = new ErrorModel(null)
    const result = await instance.mapWith(model)
    const data = new ErrorModel(result as ErrorType)

    return data
  }

  static async oldest(): Promise<ErrorType | undefined> {
    const model = await DB.instance.selectFrom('errors')
      .selectAll()
      .orderBy('created_at', 'asc')
      .executeTakeFirst()

    if (!model)
      return undefined

    const instance = new ErrorModel(null)
    const result = await instance.mapWith(model)
    const data = new ErrorModel(result as ErrorType)

    return data
  }

  static async firstOrCreate(
    condition: Partial<ErrorType>,
    newError: NewError,
  ): Promise<ErrorModel> {
    // Get the key and value from the condition object
    const key = Object.keys(condition)[0] as keyof ErrorType

    if (!key) {
      throw new HttpError(500, 'Condition must contain at least one key-value pair')
    }

    const value = condition[key]

    // Attempt to find the first record matching the condition
    const existingError = await DB.instance.selectFrom('errors')
      .selectAll()
      .where(key, '=', value)
      .executeTakeFirst()

    if (existingError) {
      const instance = new ErrorModel(null)
      const result = await instance.mapWith(existingError)
      return new ErrorModel(result as ErrorType)
    }
    else {
      return await this.create(newError)
    }
  }

  static async updateOrCreate(
    condition: Partial<ErrorType>,
    newError: NewError,
  ): Promise<ErrorModel> {
    const instance = new ErrorModel(null)

    const key = Object.keys(condition)[0] as keyof ErrorType

    if (!key) {
      throw new HttpError(500, 'Condition must contain at least one key-value pair')
    }

    const value = condition[key]

    // Attempt to find the first record matching the condition
    const existingError = await DB.instance.selectFrom('errors')
      .selectAll()
      .where(key, '=', value)
      .executeTakeFirst()

    if (existingError) {
      // If found, update the existing record
      await DB.instance.updateTable('errors')
        .set(newError)
        .where(key, '=', value)
        .executeTakeFirstOrThrow()

      // Fetch and return the updated record
      const updatedError = await DB.instance.selectFrom('errors')
        .selectAll()
        .where(key, '=', value)
        .executeTakeFirst()

      if (!updatedError) {
        throw new HttpError(500, 'Failed to fetch updated record')
      }

      const result = await instance.mapWith(updatedError)

      instance.hasSaved = true

      return new ErrorModel(result as ErrorType)
    }
    else {
      // If not found, create a new record
      return await this.create(newError)
    }
  }

  with(relations: string[]): ErrorModel {
    return ErrorModel.with(relations)
  }

  static with(relations: string[]): ErrorModel {
    const instance = new ErrorModel(null)

    instance.withRelations = relations

    return instance
  }

  async last(): Promise<ErrorType | undefined> {
    return await DB.instance.selectFrom('errors')
      .selectAll()
      .orderBy('id', 'desc')
      .executeTakeFirst()
  }

  static async last(): Promise<ErrorType | undefined> {
    const model = await DB.instance.selectFrom('errors').selectAll().orderBy('id', 'desc').executeTakeFirst()

    if (!model)
      return undefined

    const instance = new ErrorModel(null)

    const result = await instance.mapWith(model)

    const data = new ErrorModel(result as ErrorType)

    return data
  }

  orderBy(column: keyof ErrorType, order: 'asc' | 'desc'): ErrorModel {
    return ErrorModel.orderBy(column, order)
  }

  static orderBy(column: keyof ErrorType, order: 'asc' | 'desc'): ErrorModel {
    const instance = new ErrorModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, order)

    return instance
  }

  groupBy(column: keyof ErrorType): ErrorModel {
    return ErrorModel.groupBy(column)
  }

  static groupBy(column: keyof ErrorType): ErrorModel {
    const instance = new ErrorModel(null)

    instance.selectFromQuery = instance.selectFromQuery.groupBy(column)

    return instance
  }

  having(column: keyof ErrorType, operator: string, value: any): ErrorModel {
    return ErrorModel.having(column, operator, value)
  }

  static having(column: keyof ErrorType, operator: string, value: any): ErrorModel {
    const instance = new ErrorModel(null)

    instance.selectFromQuery = instance.selectFromQuery.having(column, operator, value)

    return instance
  }

  inRandomOrder(): ErrorModel {
    return ErrorModel.inRandomOrder()
  }

  static inRandomOrder(): ErrorModel {
    const instance = new ErrorModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(sql` ${sql.raw('RANDOM()')} `)

    return instance
  }

  orderByDesc(column: keyof ErrorType): ErrorModel {
    return ErrorModel.orderByDesc(column)
  }

  static orderByDesc(column: keyof ErrorType): ErrorModel {
    const instance = new ErrorModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, 'desc')

    return instance
  }

  orderByAsc(column: keyof ErrorType): ErrorModel {
    return ErrorModel.orderByAsc(column)
  }

  static orderByAsc(column: keyof ErrorType): ErrorModel {
    const instance = new ErrorModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, 'asc')

    return instance
  }

  async update(newError: ErrorUpdate): Promise<ErrorModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newError).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewError

    await DB.instance.updateTable('errors')
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

  async forceUpdate(error: ErrorUpdate): Promise<ErrorModel | undefined> {
    if (this.id === undefined) {
      this.updateFromQuery.set(error).execute()
    }

    await DB.instance.updateTable('errors')
      .set(error)
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
      throw new HttpError(500, 'Error data is undefined')

    const filteredValues = Object.fromEntries(
      Object.entries(this).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewError

    if (this.id === undefined) {
      await DB.instance.insertInto('errors')
        .values(filteredValues)
        .executeTakeFirstOrThrow()
    }
    else {
      await this.update(this)
    }

    this.hasSaved = true
  }

  fill(data: Partial<ErrorType>): ErrorModel {
    const filteredValues = Object.fromEntries(
      Object.entries(data).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewError

    this.attributes = {
      ...this.attributes,
      ...filteredValues,
    }

    return this
  }

  forceFill(data: Partial<ErrorType>): ErrorModel {
    this.attributes = {
      ...this.attributes,
      ...data,
    }

    return this
  }

  // Method to delete (soft delete) the error instance
  async delete(): Promise<any> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()

    return await DB.instance.deleteFrom('errors')
      .where('id', '=', this.id)
      .execute()
  }

  distinct(column: keyof ErrorType): ErrorModel {
    return ErrorModel.distinct(column)
  }

  static distinct(column: keyof ErrorType): ErrorModel {
    const instance = new ErrorModel(null)

    instance.selectFromQuery = instance.selectFromQuery.select(column).distinct()

    instance.hasSelect = true

    return instance
  }

  join(table: string, firstCol: string, secondCol: string): ErrorModel {
    return ErrorModel.join(table, firstCol, secondCol)
  }

  static join(table: string, firstCol: string, secondCol: string): ErrorModel {
    const instance = new ErrorModel(null)

    instance.selectFromQuery = instance.selectFromQuery.innerJoin(table, firstCol, secondCol)

    return instance
  }

  static async rawQuery(rawQuery: string): Promise<any> {
    return await sql`${rawQuery}`.execute(DB.instance)
  }

  toJSON(): Partial<ErrorJsonResponse> {
    const output: Partial<ErrorJsonResponse> = {

      id: this.id,
      type: this.type,
      message: this.message,
      stack: this.stack,
      status: this.status,
      additional_info: this.additional_info,

      created_at: this.created_at,

      updated_at: this.updated_at,

      ...this.customColumns,
    }

    return output
  }

  parseResult(model: ErrorModel): ErrorModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof ErrorModel]
    }

    return model
  }
}

async function find(id: number): Promise<ErrorModel | undefined> {
  const query = DB.instance.selectFrom('errors').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  return new ErrorModel(model)
}

export async function count(): Promise<number> {
  const results = await ErrorModel.count()

  return results
}

export async function create(newError: NewError): Promise<ErrorModel> {
  const result = await DB.instance.insertInto('errors')
    .values(newError)
    .executeTakeFirstOrThrow()

  return await find(Number(result.numInsertedOrUpdatedRows)) as ErrorModel
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(DB.instance)
}

export async function remove(id: number): Promise<void> {
  await DB.instance.deleteFrom('errors')
    .where('id', '=', id)
    .execute()
}

export async function whereType(value: string): Promise<ErrorModel[]> {
  const query = DB.instance.selectFrom('errors').where('type', '=', value)
  const results = await query.execute()

  return results.map((modelItem: ErrorModel) => new ErrorModel(modelItem))
}

export async function whereMessage(value: string): Promise<ErrorModel[]> {
  const query = DB.instance.selectFrom('errors').where('message', '=', value)
  const results = await query.execute()

  return results.map((modelItem: ErrorModel) => new ErrorModel(modelItem))
}

export async function whereStack(value: string): Promise<ErrorModel[]> {
  const query = DB.instance.selectFrom('errors').where('stack', '=', value)
  const results = await query.execute()

  return results.map((modelItem: ErrorModel) => new ErrorModel(modelItem))
}

export async function whereStatus(value: number): Promise<ErrorModel[]> {
  const query = DB.instance.selectFrom('errors').where('status', '=', value)
  const results = await query.execute()

  return results.map((modelItem: ErrorModel) => new ErrorModel(modelItem))
}

export async function whereAdditionalInfo(value: string): Promise<ErrorModel[]> {
  const query = DB.instance.selectFrom('errors').where('additional_info', '=', value)
  const results = await query.execute()

  return results.map((modelItem: ErrorModel) => new ErrorModel(modelItem))
}

export const Error = ErrorModel

export default Error
