import { db } from '@stacksjs/database'
import type { Result } from '@stacksjs/error-handling'
import { err, handleError, ok } from '@stacksjs/error-handling'
import type { ColumnType, Generated, Insertable, Selectable, Updateable } from 'kysely'

// import { Kysely, MysqlDialect, PostgresDialect } from 'kysely'
// import { Pool } from 'pg'

// TODO: we need an action that auto-generates these table interfaces
export interface SubscriberEmailsTable {
  id: Generated<number>
  email: string

  created_at: ColumnType<Date, string | undefined, never>
  updated_at: ColumnType<Date, string | undefined, never>
  deleted_at: ColumnType<Date, string | undefined, never>
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
export type NewSubscriberEmail = Insertable<SubscriberEmailsTable>
export type SubscriberEmailUpdate = Updateable<SubscriberEmailsTable>
export type SubscriberEmails = SubscriberEmailType[]

export type SubscriberEmailColumn = SubscriberEmails
export type SubscriberEmailColumns = Array<keyof SubscriberEmails>

type SortDirection = 'asc' | 'desc'
interface SortOptions {
  column: SubscriberEmailType
  order: SortDirection
}
// Define a type for the options parameter
interface QueryOptions {
  sort?: SortOptions
  limit?: number
  offset?: number
  page?: number
}

export class SubscriberEmailModel {
  private subscriberemail: Partial<SubscriberEmailType> | null
  private results: Partial<SubscriberEmailType>[]
  private hidden = ['password'] // TODO: this hidden functionality needs to be implemented still
  protected query: any
  public id: number | undefined
  public email: string | undefined

  constructor(subscriberemail: Partial<SubscriberEmailType> | null) {
    this.subscriberemail = subscriberemail
    this.id = subscriberemail?.id
    this.email = subscriberemail?.email

    this.query = db.selectFrom('subscriber_emails')
  }

  // Method to find a SubscriberEmail by ID
  async find(id: number, fields?: (keyof SubscriberEmailType)[]): Promise<SubscriberEmailModel | null> {
    let query = db.selectFrom('subscriber_emails').where('id', '=', id)

    if (fields) query = query.select(fields)
    else query = query.selectAll()

    const model = await query.executeTakeFirst()

    if (!model) return null

    return this
  }

  // Method to find a SubscriberEmail by ID
  static async find(id: number, fields?: (keyof SubscriberEmailType)[]): Promise<SubscriberEmailModel | null> {
    let query = db.selectFrom('subscriber_emails').where('id', '=', id)

    if (fields) query = query.select(fields)
    else query = query.selectAll()

    const model = await query.executeTakeFirst()

    if (!model) return null

    return new this(model)
  }

  static async findOrFail(id: number, fields?: (keyof SubscriberEmailType)[]): Promise<SubscriberEmailModel> {
    let query = db.selectFrom('subscriber_emails').where('id', '=', id)

    if (fields) query = query.select(fields)
    else query = query.selectAll()

    const model = await query.executeTakeFirst()

    if (!model) throw `No model results found for ${id} `

    return new this(model)
  }

  static async findMany(ids: number[], fields?: (keyof SubscriberEmailType)[]): Promise<SubscriberEmailModel[]> {
    let query = db.selectFrom('subscriber_emails').where('id', 'in', ids)

    if (fields) query = query.select(fields)
    else query = query.selectAll()

    const model = await query.execute()

    return model.map((modelItem) => new SubscriberEmailModel(modelItem))
  }

  // Method to get a SubscriberEmail by criteria
  static async fetch(
    criteria: Partial<SubscriberEmailType>,
    options: QueryOptions = {},
  ): Promise<SubscriberEmailModel[]> {
    let query = db.selectFrom('subscriber_emails')

    // Apply sorting from options
    if (options.sort) query = query.orderBy(options.sort.column, options.sort.order)

    // Apply limit and offset from options
    if (options.limit !== undefined) query = query.limit(options.limit)

    if (options.offset !== undefined) query = query.offset(options.offset)

    const model = await query.selectAll().execute()
    return model.map((modelItem) => new SubscriberEmailModel(modelItem))
  }

  // Method to get a SubscriberEmail by criteria
  static async get(): Promise<SubscriberEmailModel[]> {
    const query = db.selectFrom('subscriber_emails')

    const model = await query.selectAll().execute()

    return model.map((modelItem) => new SubscriberEmailModel(modelItem))
  }

  // Method to get a SubscriberEmail by criteria
  async get(): Promise<SubscriberEmailModel[]> {
    return await this.query.selectAll().execute()
  }

  // Method to get all subscriber_emails
  static async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<SubscriberEmailResponse> {
    const totalRecordsResult = await db
      .selectFrom('subscriber_emails')
      .select(db.fn.count('id').as('total')) // Use 'id' or another actual column name
      .executeTakeFirst()

    const totalRecords = Number(totalRecordsResult?.total) || 0
    const totalPages = Math.ceil(totalRecords / (options.limit ?? 10))

    const subscriber_emailsWithExtra = await db
      .selectFrom('subscriber_emails')
      .selectAll()
      .orderBy('id', 'asc') // Assuming 'id' is used for cursor-based pagination
      .limit((options.limit ?? 10) + 1) // Fetch one extra record
      .offset((options.page - 1) * (options.limit ?? 10))
      .execute()

    let nextCursor = null
    if (subscriber_emailsWithExtra.length > (options.limit ?? 10)) nextCursor = subscriber_emailsWithExtra.pop()!.id // Use the ID of the extra record as the next cursor

    return {
      data: subscriber_emailsWithExtra,
      paging: {
        total_records: totalRecords,
        page: options.page,
        total_pages: totalPages,
      },
      next_cursor: nextCursor,
    }
  }

  // Method to create a new subscriberemail
  static async create(subscriber_emails: NewSubscriberEmail): Promise<SubscriberEmailModel> {
    const result = await db.insertInto('subscriber_emails').values(newSubscriberEmail).executeTakeFirstOrThrow()

    return (await find(Number(result.insertId))) as SubscriberEmailModel
  }

  // Method to remove a SubscriberEmail
  static async remove(id: number): Promise<void> {
    await db.deleteFrom('subscriber_emails').where('id', '=', id).execute()
  }

  where(...args: (string | number)[]): SubscriberEmailModel {
    let column: any
    let operator: any
    let value: any

    if (args.length === 2) {
      ;[column, value] = args
      operator = '='
    } else if (args.length === 3) {
      ;[column, operator, value] = args
    } else {
      throw new Error('Invalid number of arguments')
    }

    this.query = this.query.where(column, operator, value)

    return this
  }

  static where(...args: (string | number)[]): SubscriberEmailModel {
    let column: any
    let operator: any
    let value: any

    const instance = new this(null)

    if (args.length === 2) {
      ;[column, value] = args
      operator = '='
    } else if (args.length === 3) {
      ;[column, operator, value] = args
    } else {
      throw new Error('Invalid number of arguments')
    }

    instance.query = instance.query.where(column, operator, value)

    return instance
  }

  static whereIn(column: keyof SubscriberEmailType, values: any[]): SubscriberEmailModel {
    const instance = new this(null)

    instance.query = instance.query.where(column, 'in', values)

    return instance
  }

  async first(): Promise<SubscriberEmailModel | undefined> {
    const model = await this.query.selectAll().executeTakeFirst()

    return new SubscriberEmailModel(model)
  }

  static async first(): Promise<SubscriberEmailType | undefined> {
    return await db.selectFrom('subscriber_emails').selectAll().executeTakeFirst()
  }

  async last(): Promise<SubscriberEmailType | undefined> {
    return await db.selectFrom('subscriber_emails').selectAll().orderBy('id', 'desc').executeTakeFirst()
  }

  static orderBy(column: keyof SubscriberEmailType, order: 'asc' | 'desc'): SubscriberEmailModel {
    const instance = new this(null)

    instance.query.orderBy(column, order)

    return instance
  }

  orderBy(column: keyof SubscriberEmailType, order: 'asc' | 'desc'): SubscriberEmailModel {
    this.query.orderBy(column, order)

    return this
  }

  static orderByDesc(column: keyof SubscriberEmailType): SubscriberEmailModel {
    const instance = new this(null)

    instance.query.orderBy(column, 'desc')

    return instance
  }

  orderByDesc(column: keyof SubscriberEmailType): SubscriberEmailModel {
    this.query.orderBy(column, 'desc')

    return this
  }

  static orderByAsc(column: keyof SubscriberEmailType): SubscriberEmailModel {
    const instance = new this(null)

    instance.query.orderBy(column, 'desc')

    return instance
  }

  orderByAsc(column: keyof SubscriberEmailType): SubscriberEmailModel {
    this.query.orderBy(column, 'desc')

    return this
  }

  // Method to update the subscriber_emails instance
  async update(subscriberemail: SubscriberEmailUpdate): Promise<SubscriberEmailModel | null> {
    if (this.id === undefined) throw new Error('SubscriberEmail ID is undefined')

    const updatedModel = await db
      .updateTable('subscriber_emails')
      .set(subscriberemail)
      .where('id', '=', this.id)
      .executeTakeFirst()

    return await this.find(Number(this.id))
  }

  // Method to save (insert or update) the subscriberemail instance
  async save(): Promise<void> {
    if (!this.subscriberemail) throw new Error('SubscriberEmail data is undefined')

    if (this.subscriberemail.id === undefined) {
      // Insert new subscriberemail
      const newModel = await db
        .insertInto('subscriber_emails')
        .values(this.subscriberemail as NewSubscriberEmail)
        .executeTakeFirstOrThrow()
    } else {
      // Update existing subscriberemail
      await this.update(this.subscriberemail)
    }
  }

  // Method to delete the subscriberemail instance
  async delete(): Promise<void> {
    if (this.id === undefined) throw new Error('SubscriberEmail ID is undefined')

    await db.deleteFrom('subscriber_emails').where('id', '=', this.id).execute()
  }

  toJSON() {
    const output: Partial<SubscriberEmailType> = { ...this.subscriberemail }

    this.hidden.forEach((attr) => {
      if (attr in output) delete output[attr as keyof Partial<SubscriberEmailType>]
    })

    type SubscriberEmail = Omit<SubscriberEmailType, 'password'>

    return output as SubscriberEmail
  }
}

const SubscriberEmail = SubscriberEmailModel

export default SubscriberEmail
