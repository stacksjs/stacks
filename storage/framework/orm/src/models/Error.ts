import type { Generated, Insertable, Selectable, Updateable } from 'kysely'
import { cache } from '@stacksjs/cache'
import { db, sql } from '@stacksjs/database'
import { HttpError } from '@stacksjs/error-handling'

export interface ErrorsTable {
  id?: Generated<number>
  type?: undefined
  message?: undefined
  stack?: undefined
  status?: undefined
  user_id?: undefined
  additional_info?: undefined

  created_at?: Date

  updated_at?: Date

  deleted_at?: Date

}

interface ErrorResponse {
  data: Errors
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export type ErrorType = Selectable<ErrorsTable>
export type NewError = Insertable<ErrorsTable>
export type ErrorUpdate = Updateable<ErrorsTable>
export type Errors = ErrorType[]

export type ErrorColumn = Errors
export type ErrorColumns = Array<keyof Errors>

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
  private hidden = []
  private fillable = ['type', 'message', 'stack', 'status', 'user_id', 'additional_info', 'uuid']
  private softDeletes = false
  protected selectFromQuery: any
  protected updateFromQuery: any
  protected deleteFromQuery: any
  protected hasSelect: boolean
  public id: number | undefined
  public type: undefined | undefined
  public message: undefined | undefined
  public stack: undefined | undefined
  public status: undefined | undefined
  public user_id: undefined | undefined
  public additional_info: undefined | undefined

  public created_at: Date | undefined
  public updated_at: Date | undefined

  constructor(error: Partial<ErrorType> | null) {
    this.id = error?.id
    this.type = error?.type
    this.message = error?.message
    this.stack = error?.stack
    this.status = error?.status
    this.user_id = error?.user_id
    this.additional_info = error?.additional_info

    this.created_at = error?.created_at

    this.updated_at = error?.updated_at

    this.selectFromQuery = db.selectFrom('errors')
    this.updateFromQuery = db.updateTable('errors')
    this.deleteFromQuery = db.deleteFrom('errors')
    this.hasSelect = false
  }

  // Method to find a Error by ID
  async find(id: number): Promise<ErrorModel | undefined> {
    const query = db.selectFrom('errors').where('id', '=', id).selectAll()

    const model = await query.executeTakeFirst()

    if (!model)
      return undefined

    cache.getOrSet(`error:${id}`, JSON.stringify(model))

    return this.parseResult(new ErrorModel(model))
  }

  // Method to find a Error by ID
  static async find(id: number): Promise<ErrorModel | undefined> {
    const query = db.selectFrom('errors').where('id', '=', id).selectAll()

    const instance = new ErrorModel(null)

    const model = await query.executeTakeFirst()

    if (!model)
      return undefined

    cache.getOrSet(`error:${id}`, JSON.stringify(model))

    return instance.parseResult(new ErrorModel(model))
  }

  static async all(): Promise<ErrorModel[]> {
    let query = db.selectFrom('errors').selectAll()

    const instance = new ErrorModel(null)

    if (instance.softDeletes) {
      query = query.where('deleted_at', 'is', null)
    }

    const results = await query.execute()

    return results.map(modelItem => instance.parseResult(new ErrorModel(modelItem)))
  }

  static async findOrFail(id: number): Promise<ErrorModel> {
    let query = db.selectFrom('errors').where('id', '=', id)

    const instance = new ErrorModel(null)

    if (instance.softDeletes) {
      query = query.where('deleted_at', 'is', null)
    }

    query = query.selectAll()

    const model = await query.executeTakeFirst()

    if (model === undefined)
      throw new HttpError(404, `No ErrorModel results for ${id}`)

    cache.getOrSet(`error:${id}`, JSON.stringify(model))

    return instance.parseResult(new ErrorModel(model))
  }

  static async findMany(ids: number[]): Promise<ErrorModel[]> {
    let query = db.selectFrom('errors').where('id', 'in', ids)

    const instance = new ErrorModel(null)

    if (instance.softDeletes) {
      query = query.where('deleted_at', 'is', null)
    }

    query = query.selectAll()

    const model = await query.execute()

    return model.map(modelItem => instance.parseResult(new ErrorModel(modelItem)))
  }

  // Method to get a User by criteria
  static async get(): Promise<ErrorModel[]> {
    const instance = new ErrorModel(null)

    if (instance.hasSelect) {
      if (instance.softDeletes) {
        instance.selectFromQuery = instance.selectFromQuery.where('deleted_at', 'is', null)
      }

      const model = await instance.selectFromQuery.execute()

      return model.map((modelItem: ErrorModel) => new ErrorModel(modelItem))
    }

    if (instance.softDeletes) {
      instance.selectFromQuery = instance.selectFromQuery.where('deleted_at', 'is', null)
    }

    const model = await instance.selectFromQuery.selectAll().execute()

    return model.map((modelItem: ErrorModel) => new ErrorModel(modelItem))
  }

  // Method to get a Error by criteria
  async get(): Promise<ErrorModel[]> {
    if (this.hasSelect) {
      if (this.softDeletes) {
        this.selectFromQuery = this.selectFromQuery.where('deleted_at', 'is', null)
      }

      const model = await this.selectFromQuery.execute()

      return model.map((modelItem: ErrorModel) => new ErrorModel(modelItem))
    }

    if (this.softDeletes) {
      this.selectFromQuery = this.selectFromQuery.where('deleted_at', 'is', null)
    }

    const model = await this.selectFromQuery.selectAll().execute()

    return model.map((modelItem: ErrorModel) => new ErrorModel(modelItem))
  }

  static async count(): Promise<number> {
    const instance = new ErrorModel(null)

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

  // Method to get all errors
  static async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<ErrorResponse> {
    const totalRecordsResult = await db.selectFrom('errors')
      .select(db.fn.count('id').as('total')) // Use 'id' or another actual column name
      .executeTakeFirst()

    const totalRecords = Number(totalRecordsResult?.total) || 0
    const totalPages = Math.ceil(totalRecords / (options.limit ?? 10))

    const errorsWithExtra = await db.selectFrom('errors')
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

  // Method to create a new error
  static async create(newError: NewError): Promise<ErrorModel> {
    const instance = new ErrorModel(null)

    const filteredValues = Object.fromEntries(
      Object.entries(newError).filter(([key]) => instance.fillable.includes(key)),
    ) as NewError

    const result = await db.insertInto('errors')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await find(Number(result.insertId)) as ErrorModel

    return model
  }

  static async createMany(newErrors: NewError[]): Promise<void> {
    const instance = new ErrorModel(null)

    const filteredValues = newErrors.map(newUser =>
      Object.fromEntries(
        Object.entries(newUser).filter(([key]) => instance.fillable.includes(key)),
      ) as NewError,
    )

    await db.insertInto('errors')
      .values(filteredValues)
      .executeTakeFirst()
  }

  static async forceCreate(newError: NewError): Promise<ErrorModel> {
    const result = await db.insertInto('errors')
      .values(newError)
      .executeTakeFirst()

    const model = await find(Number(result.insertId)) as ErrorModel

    return model
  }

  // Method to remove a Error
  static async remove(id: number): Promise<void> {
    const instance = new ErrorModel(null)

    if (instance.softDeletes) {
      await db.updateTable('errors')
        .set({
          deleted_at: sql.raw('CURRENT_TIMESTAMP'),
        })
        .where('id', '=', id)
        .execute()
    }
    else {
      await db.deleteFrom('errors')
        .where('id', '=', id)
        .execute()
    }
  }

  where(...args: (string | number | boolean | undefined | null)[]): ErrorModel {
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

  orWhere(...args: Array<[string, string, any]>): ErrorModel {
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

  static orWhere(...args: Array<[string, string, any]>): ErrorModel {
    const instance = new ErrorModel(null)

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

  static where(...args: (string | number | boolean | undefined | null)[]): ErrorModel {
    let column: any
    let operator: any
    let value: any

    const instance = new ErrorModel(null)

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

  whereNull(column: string): ErrorModel {
    this.selectFromQuery = this.selectFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    this.updateFromQuery = this.updateFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    return this
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

  static whereUserId(value: string): ErrorModel {
    const instance = new ErrorModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('user_id', '=', value)

    return instance
  }

  static whereAdditionalInfo(value: string): ErrorModel {
    const instance = new ErrorModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('additional_info', '=', value)

    return instance
  }

  static whereIn(column: keyof ErrorType, values: any[]): ErrorModel {
    const instance = new ErrorModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where(column, 'in', values)

    instance.updateFromQuery = instance.updateFromQuery.where(column, 'in', values)

    instance.deleteFromQuery = instance.deleteFromQuery.where(column, 'in', values)

    return instance
  }

  async first(): Promise<ErrorModel | undefined> {
    const model = await this.selectFromQuery.selectAll().executeTakeFirst()

    if (!model) {
      return undefined
    }

    return this.parseResult(new ErrorModel(model))
  }

  async firstOrFail(): Promise<ErrorModel | undefined> {
    const model = await this.selectFromQuery.executeTakeFirst()

    if (model === undefined)
      throw new HttpError(404, 'No ErrorModel results found for query')

    return this.parseResult(new ErrorModel(model))
  }

  async exists(): Promise<boolean> {
    const model = await this.selectFromQuery.executeTakeFirst()

    return model !== null || model !== undefined
  }

  static async first(): Promise<ErrorType | undefined> {
    return await db.selectFrom('errors')
      .selectAll()
      .executeTakeFirst()
  }

  async last(): Promise<ErrorType | undefined> {
    return await db.selectFrom('errors')
      .selectAll()
      .orderBy('id', 'desc')
      .executeTakeFirst()
  }

  static async last(): Promise<ErrorType | undefined> {
    return await db.selectFrom('errors').selectAll().orderBy('id', 'desc').executeTakeFirst()
  }

  static orderBy(column: keyof ErrorType, order: 'asc' | 'desc'): ErrorModel {
    const instance = new ErrorModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, order)

    return instance
  }

  orderBy(column: keyof ErrorType, order: 'asc' | 'desc'): ErrorModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, order)

    return this
  }

  static orderByDesc(column: keyof ErrorType): ErrorModel {
    const instance = new ErrorModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, 'desc')

    return instance
  }

  orderByDesc(column: keyof ErrorType): ErrorModel {
    this.selectFromQuery = this.orderBy(column, 'desc')

    return this
  }

  static orderByAsc(column: keyof ErrorType): ErrorModel {
    const instance = new ErrorModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, 'asc')

    return instance
  }

  orderByAsc(column: keyof ErrorType): ErrorModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, 'desc')

    return this
  }

  async update(error: ErrorUpdate): Promise<ErrorModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(error).filter(([key]) => this.fillable.includes(key)),
    ) as NewError

    if (this.id === undefined) {
      this.updateFromQuery.set(filteredValues).execute()
    }

    await db.updateTable('errors')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    const model = await this.find(Number(this.id))

    return model
  }

  async forceUpdate(error: ErrorUpdate): Promise<ErrorModel | undefined> {
    if (this.id === undefined) {
      this.updateFromQuery.set(error).execute()
    }

    await db.updateTable('errors')
      .set(error)
      .where('id', '=', this.id)
      .executeTakeFirst()

    const model = await this.find(Number(this.id))

    return model
  }

  async save(): Promise<void> {
    if (!this)
      throw new HttpError(500, 'Error data is undefined')

    if (this.id === undefined) {
      await db.insertInto('errors')
        .values(this as NewError)
        .executeTakeFirstOrThrow()
    }
    else {
      await this.update(this)
    }
  }

  // Method to delete (soft delete) the error instance
  async delete(): Promise<void> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()

    // Check if soft deletes are enabled
    if (this.softDeletes) {
      // Update the deleted_at column with the current timestamp
      await db.updateTable('errors')
        .set({
          deleted_at: sql.raw('CURRENT_TIMESTAMP'),
        })
        .where('id', '=', this.id)
        .execute()
    }
    else {
      // Perform a hard delete
      await db.deleteFrom('errors')
        .where('id', '=', this.id)
        .execute()
    }
  }

  distinct(column: keyof ErrorType): ErrorModel {
    this.selectFromQuery = this.selectFromQuery.select(column).distinct()

    this.hasSelect = true

    return this
  }

  static distinct(column: keyof ErrorType): ErrorModel {
    const instance = new ErrorModel(null)

    instance.selectFromQuery = instance.selectFromQuery.select(column).distinct()

    instance.hasSelect = true

    return instance
  }

  join(table: string, firstCol: string, secondCol: string): ErrorModel {
    this.selectFromQuery = this.selectFromQuery(table, firstCol, secondCol)

    return this
  }

  static join(table: string, firstCol: string, secondCol: string): ErrorModel {
    const instance = new ErrorModel(null)

    instance.selectFromQuery = instance.selectFromQuery.innerJoin(table, firstCol, secondCol)

    return instance
  }

  static async rawQuery(rawQuery: string): Promise<any> {
    return await sql`${rawQuery}`.execute(db)
  }

  toJSON() {
    const output: Partial<ErrorType> = {

      id: this.id,
      type: this.type,
      message: this.message,
      stack: this.stack,
      status: this.status,
      user_id: this.user_id,
      additional_info: this.additional_info,

      created_at: this.created_at,

      updated_at: this.updated_at,

    }

        type Error = Omit<ErrorType, 'password'>

        return output as Error
  }

  parseResult(model: ErrorModel): ErrorModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof ErrorModel]
    }

    return model
  }
}

async function find(id: number): Promise<ErrorModel | undefined> {
  const query = db.selectFrom('errors').where('id', '=', id).selectAll()

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
  const result = await db.insertInto('errors')
    .values(newError)
    .executeTakeFirstOrThrow()

  return await find(Number(result.insertId)) as ErrorModel
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(db)
}

export async function remove(id: number): Promise<void> {
  await db.deleteFrom('errors')
    .where('id', '=', id)
    .execute()
}

export async function whereType(value: undefined): Promise<ErrorModel[]> {
  const query = db.selectFrom('errors').where('type', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new ErrorModel(modelItem))
}

export async function whereMessage(value: undefined): Promise<ErrorModel[]> {
  const query = db.selectFrom('errors').where('message', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new ErrorModel(modelItem))
}

export async function whereStack(value: undefined): Promise<ErrorModel[]> {
  const query = db.selectFrom('errors').where('stack', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new ErrorModel(modelItem))
}

export async function whereStatus(value: undefined): Promise<ErrorModel[]> {
  const query = db.selectFrom('errors').where('status', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new ErrorModel(modelItem))
}

export async function whereUserId(value: undefined): Promise<ErrorModel[]> {
  const query = db.selectFrom('errors').where('user_id', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new ErrorModel(modelItem))
}

export async function whereAdditionalInfo(value: undefined): Promise<ErrorModel[]> {
  const query = db.selectFrom('errors').where('additional_info', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new ErrorModel(modelItem))
}

export const Error = ErrorModel

export default Error
