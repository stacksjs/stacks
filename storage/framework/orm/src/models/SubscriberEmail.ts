import type { Insertable, Selectable, Updateable } from 'kysely'
import { cache } from '@stacksjs/cache'
import { db, sql } from '@stacksjs/database'
import { HttpError } from '@stacksjs/error-handling'

export interface SubscriberEmailsTable {
  id?: number
  email?: string

  created_at?: Date

  updated_at?: Date

  deleted_at?: Date

}

interface SubscriberEmailResponse {
  data: SubscriberEmails
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export type SubscriberEmailType = Selectable<SubscriberEmailsTable>
export type NewSubscriberEmail = Partial<Insertable<SubscriberEmailsTable>>
export type SubscriberEmailUpdate = Updateable<SubscriberEmailsTable>
export type SubscriberEmails = SubscriberEmailType[]

export type SubscriberEmailColumn = SubscriberEmails
export type SubscriberEmailColumns = Array<keyof SubscriberEmails>

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
  private hidden = []
  private fillable = ['email', 'uuid']
  private softDeletes = true
  protected selectFromQuery: any
  protected withRelations: string[]
  protected updateFromQuery: any
  protected deleteFromQuery: any
  protected hasSelect: boolean
  public id: number
  public email: string | undefined

  public created_at: Date | undefined
  public updated_at: Date | undefined

  public deleted_at: Date | undefined

  constructor(subscriberemail: Partial<SubscriberEmailType> | null) {
    this.id = subscriberemail?.id || 1
    this.email = subscriberemail?.email

    this.created_at = subscriberemail?.created_at

    this.updated_at = subscriberemail?.updated_at

    this.deleted_at = subscriberemail?.deleted_at

    this.withRelations = []
    this.selectFromQuery = db.selectFrom('subscriber_emails')
    this.updateFromQuery = db.updateTable('subscriber_emails')
    this.deleteFromQuery = db.deleteFrom('subscriber_emails')
    this.hasSelect = false
  }

  // Method to find a SubscriberEmail by ID
  async find(id: number): Promise<SubscriberEmailModel | undefined> {
    const query = db.selectFrom('subscriber_emails').where('id', '=', id).selectAll()

    const model = await query.executeTakeFirst()

    if (!model)
      return undefined

    const result = await this.mapWith(model)

    const data = new SubscriberEmailModel(result as SubscriberEmailType)

    cache.getOrSet(`subscriberemail:${id}`, JSON.stringify(model))

    return data
  }

  // Method to find a SubscriberEmail by ID
  static async find(id: number): Promise<SubscriberEmailModel | undefined> {
    const model = await db.selectFrom('subscriber_emails').where('id', '=', id).selectAll().executeTakeFirst()

    if (!model)
      return undefined

    const instance = new SubscriberEmailModel(null)

    const result = await instance.mapWith(model)

    const data = new SubscriberEmailModel(result as SubscriberEmailType)

    cache.getOrSet(`subscriberemail:${id}`, JSON.stringify(model))

    return data
  }

  async mapWith(model: SubscriberEmailType): Promise<SubscriberEmailType> {
    return model
  }

  static async all(): Promise<SubscriberEmailModel[]> {
    const models = await db.selectFrom('subscriber_emails').selectAll().execute()

    const data = await Promise.all(models.map(async (model: SubscriberEmailType) => {
      const instance = new SubscriberEmailModel(model)

      const results = await instance.mapWith(model)

      return new SubscriberEmailModel(results)
    }))

    return data
  }

  static async findOrFail(id: number): Promise<SubscriberEmailModel> {
    const model = await db.selectFrom('subscriber_emails').where('id', '=', id).selectAll().executeTakeFirst()

    const instance = new SubscriberEmailModel(null)

    if (instance.softDeletes) {
      query = query.where('deleted_at', 'is', null)
    }

    if (model === undefined)
      throw new HttpError(404, `No SubscriberEmailModel results for ${id}`)

    cache.getOrSet(`subscriberemail:${id}`, JSON.stringify(model))

    const result = await instance.mapWith(model)

    const data = new SubscriberEmailModel(result as SubscriberEmailType)

    return data
  }

  async findOrFail(id: number): Promise<SubscriberEmailModel> {
    const model = await db.selectFrom('subscriber_emails').where('id', '=', id).selectAll().executeTakeFirst()

    if (this.softDeletes) {
      this.selectFromQuery = this.selectFromQuery.where('deleted_at', 'is', null)
    }

    if (model === undefined)
      throw new HttpError(404, `No SubscriberEmailModel results for ${id}`)

    cache.getOrSet(`subscriberemail:${id}`, JSON.stringify(model))

    const result = await this.mapWith(model)

    const data = new SubscriberEmailModel(result as SubscriberEmailType)

    return data
  }

  static async findMany(ids: number[]): Promise<SubscriberEmailModel[]> {
    let query = db.selectFrom('subscriber_emails').where('id', 'in', ids)

    const instance = new SubscriberEmailModel(null)

    if (instance.softDeletes) {
      query = query.where('deleted_at', 'is', null)
    }

    query = query.selectAll()

    const model = await query.execute()

    return model.map(modelItem => instance.parseResult(new SubscriberEmailModel(modelItem)))
  }

  static async get(): Promise<SubscriberEmailModel[]> {
    const instance = new SubscriberEmailModel(null)

    let models

    if (instance.hasSelect) {
      if (instance.softDeletes) {
        query = query.where('deleted_at', 'is', null)
      }

      models = await instance.selectFromQuery.execute()
    }
    else {
      if (instance.softDeletes) {
        query = query.where('deleted_at', 'is', null)
      }

      models = await instance.selectFromQuery.selectAll().execute()
    }

    const data = await Promise.all(models.map(async (model: SubscriberEmailModel) => {
      const instance = new SubscriberEmailModel(model)

      const results = await instance.mapWith(model)

      return new SubscriberEmailModel(results)
    }))

    return data
  }

  // Method to get a SubscriberEmail by criteria
  async get(): Promise<SubscriberEmailModel[]> {
    if (this.hasSelect) {
      if (this.softDeletes) {
        this.selectFromQuery = this.selectFromQuery.where('deleted_at', 'is', null)
      }

      const model = await this.selectFromQuery.execute()

      return model.map((modelItem: SubscriberEmailModel) => new SubscriberEmailModel(modelItem))
    }

    if (this.softDeletes) {
      this.selectFromQuery = this.selectFromQuery.where('deleted_at', 'is', null)
    }

    const model = await this.selectFromQuery.selectAll().execute()

    return model.map((modelItem: SubscriberEmailModel) => new SubscriberEmailModel(modelItem))
  }

  static async count(): Promise<number> {
    const instance = new SubscriberEmailModel(null)

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

  async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<SubscriberEmailResponse> {
    const totalRecordsResult = await db.selectFrom('subscriber_emails')
      .select(db.fn.count('id').as('total')) // Use 'id' or another actual column name
      .executeTakeFirst()

    const totalRecords = Number(totalRecordsResult?.total) || 0
    const totalPages = Math.ceil(totalRecords / (options.limit ?? 10))

    if (this.hasSelect) {
      if (this.softDeletes) {
        this.selectFromQuery = this.selectFromQuery.where('deleted_at', 'is', null)
      }

      const subscriber_emailsWithExtra = await this.selectFromQuery.orderBy('id', 'asc')
        .limit((options.limit ?? 10) + 1)
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

    if (this.softDeletes) {
      this.selectFromQuery = this.selectFromQuery.where('deleted_at', 'is', null)
    }

    const subscriber_emailsWithExtra = await this.selectFromQuery.orderBy('id', 'asc')
      .limit((options.limit ?? 10) + 1)
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

  // Method to get all subscriber_emails
  static async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<SubscriberEmailResponse> {
    const totalRecordsResult = await db.selectFrom('subscriber_emails')
      .select(db.fn.count('id').as('total')) // Use 'id' or another actual column name
      .executeTakeFirst()

    const totalRecords = Number(totalRecordsResult?.total) || 0
    const totalPages = Math.ceil(totalRecords / (options.limit ?? 10))

    const subscriber_emailsWithExtra = await db.selectFrom('subscriber_emails')
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

  // Method to create a new subscriberemail
  static async create(newSubscriberEmail: NewSubscriberEmail): Promise<SubscriberEmailModel> {
    const instance = new SubscriberEmailModel(null)

    const filteredValues = Object.fromEntries(
      Object.entries(newSubscriberEmail).filter(([key]) => instance.fillable.includes(key)),
    ) as NewSubscriberEmail

    const result = await db.insertInto('subscriber_emails')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await find(Number(result.numInsertedOrUpdatedRows)) as SubscriberEmailModel

    return model
  }

  static async createMany(newSubscriberEmails: NewSubscriberEmail[]): Promise<void> {
    const instance = new SubscriberEmailModel(null)

    const filteredValues = newSubscriberEmails.map(newUser =>
      Object.fromEntries(
        Object.entries(newUser).filter(([key]) => instance.fillable.includes(key)),
      ) as NewSubscriberEmail,
    )

    await db.insertInto('subscriber_emails')
      .values(filteredValues)
      .executeTakeFirst()
  }

  static async forceCreate(newSubscriberEmail: NewSubscriberEmail): Promise<SubscriberEmailModel> {
    const result = await db.insertInto('subscriber_emails')
      .values(newSubscriberEmail)
      .executeTakeFirst()

    const model = await find(Number(result.numInsertedOrUpdatedRows)) as SubscriberEmailModel

    return model
  }

  // Method to remove a SubscriberEmail
  static async remove(id: number): Promise<any> {
    const instance = new SubscriberEmailModel(null)

    if (instance.softDeletes) {
      return await db.updateTable('transactions')
        .set({
          deleted_at: sql.raw('CURRENT_TIMESTAMP'),
        })
        .where('id', '=', id)
        .execute()
    }

    return await db.deleteFrom('subscriber_emails')
      .where('id', '=', id)
      .execute()
  }

  where(...args: (string | number | boolean | undefined | null)[]): SubscriberEmailModel {
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

  orWhere(...args: Array<[string, string, any]>): SubscriberEmailModel {
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

  static orWhere(...args: Array<[string, string, any]>): SubscriberEmailModel {
    const instance = new SubscriberEmailModel(null)

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

  static where(...args: (string | number | boolean | undefined | null)[]): SubscriberEmailModel {
    let column: any
    let operator: any
    let value: any

    const instance = new SubscriberEmailModel(null)

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

  static when(
    condition: boolean,
    callback: (query: SubscriberEmailModel) => SubscriberEmailModel,
  ): SubscriberEmailModel {
    let instance = new SubscriberEmailModel(null)

    if (condition)
      instance = callback(instance)

    return instance
  }

  when(
    condition: boolean,
    callback: (query: SubscriberEmailModel) => SubscriberEmailModel,
  ): SubscriberEmailModel {
    if (condition)
      callback(this.selectFromQuery)

    return this
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

  whereNull(column: string): SubscriberEmailModel {
    this.selectFromQuery = this.selectFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    this.updateFromQuery = this.updateFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    return this
  }

  static whereEmail(value: string): SubscriberEmailModel {
    const instance = new SubscriberEmailModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('email', '=', value)

    return instance
  }

  static whereIn(column: keyof SubscriberEmailType, values: any[]): SubscriberEmailModel {
    const instance = new SubscriberEmailModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where(column, 'in', values)

    instance.updateFromQuery = instance.updateFromQuery.where(column, 'in', values)

    instance.deleteFromQuery = instance.deleteFromQuery.where(column, 'in', values)

    return instance
  }

  async first(): Promise<SubscriberEmailModel | undefined> {
    const model = await this.selectFromQuery.selectAll().executeTakeFirst()

    if (!model)
      return undefined

    const result = await this.mapWith(model)

    const data = new SubscriberEmailModel(result as SubscriberEmailType)

    return data
  }

  async firstOrFail(): Promise<SubscriberEmailModel | undefined> {
    const model = await this.selectFromQuery.executeTakeFirst()

    if (model === undefined)
      throw new HttpError(404, 'No SubscriberEmailModel results found for query')

    const instance = new SubscriberEmailModel(null)

    const result = await instance.mapWith(model)

    const data = new SubscriberEmailModel(result as SubscriberEmailType)

    return data
  }

  async exists(): Promise<boolean> {
    const model = await this.selectFromQuery.executeTakeFirst()

    return model !== null || model !== undefined
  }

  static async first(): Promise<SubscriberEmailType | undefined> {
    const model = await db.selectFrom('subscriber_emails')
      .selectAll()
      .executeTakeFirst()

    if (!model)
      return undefined

    const instance = new SubscriberEmailModel(null)

    const result = await instance.mapWith(model)

    const data = new SubscriberEmailModel(result as SubscriberEmailType)

    return data
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
    return await db.selectFrom('subscriber_emails')
      .selectAll()
      .orderBy('id', 'desc')
      .executeTakeFirst()
  }

  static async last(): Promise<SubscriberEmailType | undefined> {
    const model = await db.selectFrom('subscriber_emails').selectAll().orderBy('id', 'desc').executeTakeFirst()

    if (!model)
      return undefined

    const instance = new SubscriberEmailModel(null)

    const result = await instance.mapWith(model)

    const data = new SubscriberEmailModel(result as SubscriberEmailType)

    return data
  }

  static orderBy(column: keyof SubscriberEmailType, order: 'asc' | 'desc'): SubscriberEmailModel {
    const instance = new SubscriberEmailModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, order)

    return instance
  }

  orderBy(column: keyof SubscriberEmailType, order: 'asc' | 'desc'): SubscriberEmailModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, order)

    return this
  }

  static orderByDesc(column: keyof SubscriberEmailType): SubscriberEmailModel {
    const instance = new SubscriberEmailModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, 'desc')

    return instance
  }

  orderByDesc(column: keyof SubscriberEmailType): SubscriberEmailModel {
    this.selectFromQuery = this.orderBy(column, 'desc')

    return this
  }

  static orderByAsc(column: keyof SubscriberEmailType): SubscriberEmailModel {
    const instance = new SubscriberEmailModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, 'asc')

    return instance
  }

  orderByAsc(column: keyof SubscriberEmailType): SubscriberEmailModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, 'desc')

    return this
  }

  async update(subscriberemail: SubscriberEmailUpdate): Promise<SubscriberEmailModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(subscriberemail).filter(([key]) => this.fillable.includes(key)),
    ) as NewSubscriberEmail

    if (this.id === undefined) {
      this.updateFromQuery.set(filteredValues).execute()
    }

    await db.updateTable('subscriber_emails')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    const model = await this.find(this.id)

    return model
  }

  async forceUpdate(subscriberemail: SubscriberEmailUpdate): Promise<SubscriberEmailModel | undefined> {
    if (this.id === undefined) {
      this.updateFromQuery.set(subscriberemail).execute()
    }

    await db.updateTable('subscriber_emails')
      .set(subscriberemail)
      .where('id', '=', this.id)
      .executeTakeFirst()

    const model = await this.find(this.id)

    return model
  }

  async save(): Promise<void> {
    if (!this)
      throw new HttpError(500, 'SubscriberEmail data is undefined')

    if (this.id === undefined) {
      await db.insertInto('subscriber_emails')
        .values(this as NewSubscriberEmail)
        .executeTakeFirstOrThrow()
    }
    else {
      await this.update(this)
    }
  }

  // Method to delete (soft delete) the subscriberemail instance
  async delete(): Promise<any> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()

    if (this.softDeletes) {
      return await db.updateTable('subscriber_emails')
        .set({
          deleted_at: sql.raw('CURRENT_TIMESTAMP'),
        })
        .where('id', '=', this.id)
        .execute()
    }

    return await db.deleteFrom('subscriber_emails')
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
    this.selectFromQuery = this.selectFromQuery(table, firstCol, secondCol)

    return this
  }

  static join(table: string, firstCol: string, secondCol: string): SubscriberEmailModel {
    const instance = new SubscriberEmailModel(null)

    instance.selectFromQuery = instance.selectFromQuery.innerJoin(table, firstCol, secondCol)

    return instance
  }

  static async rawQuery(rawQuery: string): Promise<any> {
    return await sql`${rawQuery}`.execute(db)
  }

  toJSON() {
    const output: Partial<SubscriberEmailType> = {

      id: this.id,
      email: this.email,

      created_at: this.created_at,

      updated_at: this.updated_at,

      deleted_at: this.deleted_at,

    }

        type SubscriberEmail = Omit<SubscriberEmailType, 'password'>

        return output as SubscriberEmail
  }

  parseResult(model: SubscriberEmailModel): SubscriberEmailModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof SubscriberEmailModel]
    }

    return model
  }
}

async function find(id: number): Promise<SubscriberEmailModel | undefined> {
  const query = db.selectFrom('subscriber_emails').where('id', '=', id).selectAll()

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
  const result = await db.insertInto('subscriber_emails')
    .values(newSubscriberEmail)
    .executeTakeFirstOrThrow()

  return await find(Number(result.numInsertedOrUpdatedRows)) as SubscriberEmailModel
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(db)
}

export async function remove(id: number): Promise<void> {
  await db.deleteFrom('subscriber_emails')
    .where('id', '=', id)
    .execute()
}

export async function whereEmail(value: string): Promise<SubscriberEmailModel[]> {
  const query = db.selectFrom('subscriber_emails').where('email', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new SubscriberEmailModel(modelItem))
}

export const SubscriberEmail = SubscriberEmailModel

export default SubscriberEmail
