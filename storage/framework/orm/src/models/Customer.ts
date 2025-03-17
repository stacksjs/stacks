import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { OrderModel } from './Order'
import type { UserModel } from './User'
import { randomUUIDv7 } from 'bun'
import { cache } from '@stacksjs/cache'
import { sql } from '@stacksjs/database'
import { HttpError, ModelNotFoundException } from '@stacksjs/error-handling'
import { dispatch } from '@stacksjs/events'

import { BaseOrm, DB, SubqueryBuilder } from '@stacksjs/orm'

import User from './User'

export interface CustomersTable {
  id: Generated<number>
  user_id: number
  name: string
  email: string
  phone: string
  total_spent?: number
  last_order?: string
  status: string | string[]
  avatar?: string
  uuid?: string

  created_at?: Date

  updated_at?: Date

}

export interface CustomerResponse {
  data: CustomerJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface CustomerJsonResponse extends Omit<Selectable<CustomersTable>, 'password'> {
  [key: string]: any
}

export type NewCustomer = Insertable<CustomersTable>
export type CustomerUpdate = Updateable<CustomersTable>

      type SortDirection = 'asc' | 'desc'
interface SortOptions { column: CustomerJsonResponse, order: SortDirection }
// Define a type for the options parameter
interface QueryOptions {
  sort?: SortOptions
  limit?: number
  offset?: number
  page?: number
}

export class CustomerModel extends BaseOrm<CustomerModel, CustomersTable, CustomerJsonResponse> {
  private readonly hidden: Array<keyof CustomerJsonResponse> = []
  private readonly fillable: Array<keyof CustomerJsonResponse> = ['name', 'email', 'phone', 'total_spent', 'last_order', 'status', 'avatar', 'uuid']
  private readonly guarded: Array<keyof CustomerJsonResponse> = []
  protected attributes = {} as CustomerJsonResponse
  protected originalAttributes = {} as CustomerJsonResponse

  protected selectFromQuery: any
  protected updateFromQuery: any
  protected deleteFromQuery: any
  protected hasSelect: boolean
  private hasSaved: boolean
  private customColumns: Record<string, unknown> = {}

  constructor(customer: CustomerJsonResponse | undefined) {
    super('customers')
    if (customer) {
      this.attributes = { ...customer }
      this.originalAttributes = { ...customer }

      Object.keys(customer).forEach((key) => {
        if (!(key in this)) {
          this.customColumns[key] = (customer as CustomerJsonResponse)[key]
        }
      })
    }

    this.withRelations = []
    this.selectFromQuery = DB.instance.selectFrom('customers')
    this.updateFromQuery = DB.instance.updateTable('customers')
    this.deleteFromQuery = DB.instance.deleteFrom('customers')
    this.hasSelect = false
    this.hasSaved = false
  }

  protected mapCustomGetters(models: CustomerJsonResponse | CustomerJsonResponse[]): void {
    const data = models

    if (Array.isArray(data)) {
      data.map((model: CustomerJsonResponse) => {
        const customGetter = {
          default: () => {
          },

          fullContactInfo: () => {
            return `${model.name} (${model.email}, ${model.phone})`
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

        fullContactInfo: () => {
          return `${model.name} (${model.email}, ${model.phone})`
        },

      }

      for (const [key, fn] of Object.entries(customGetter)) {
        model[key] = fn()
      }
    }
  }

  async mapCustomSetters(model: NewCustomer | CustomerUpdate): Promise<void> {
    const customSetter = {
      default: () => {
      },

    }

    for (const [key, fn] of Object.entries(customSetter)) {
      model[key] = await fn()
    }
  }

  get orders(): OrderModel[] | [] {
    return this.attributes.orders
  }

  get user_id(): number {
    return this.attributes.user_id
  }

  get user(): UserModel | undefined {
    return this.attributes.user
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

  get email(): string {
    return this.attributes.email
  }

  get phone(): string {
    return this.attributes.phone
  }

  get total_spent(): number | undefined {
    return this.attributes.total_spent
  }

  get last_order(): string | undefined {
    return this.attributes.last_order
  }

  get status(): string | string[] {
    return this.attributes.status
  }

  get avatar(): string | undefined {
    return this.attributes.avatar
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

  set email(value: string) {
    this.attributes.email = value
  }

  set phone(value: string) {
    this.attributes.phone = value
  }

  set total_spent(value: number) {
    this.attributes.total_spent = value
  }

  set last_order(value: string) {
    this.attributes.last_order = value
  }

  set status(value: string | string[]) {
    this.attributes.status = value
  }

  set avatar(value: string) {
    this.attributes.avatar = value
  }

  set updated_at(value: Date) {
    this.attributes.updated_at = value
  }

  getOriginal(column?: keyof CustomerJsonResponse): Partial<CustomerJsonResponse> {
    if (column) {
      return this.originalAttributes[column]
    }

    return this.originalAttributes
  }

  getChanges(): Partial<CustomerJsonResponse> {
    return this.fillable.reduce<Partial<CustomerJsonResponse>>((changes, key) => {
      const currentValue = this.attributes[key as keyof CustomersTable]
      const originalValue = this.originalAttributes[key as keyof CustomersTable]

      if (currentValue !== originalValue) {
        changes[key] = currentValue
      }

      return changes
    }, {})
  }

  isDirty(column?: keyof CustomerJsonResponse): boolean {
    if (column) {
      return this.attributes[column] !== this.originalAttributes[column]
    }

    return Object.entries(this.originalAttributes).some(([key, originalValue]) => {
      const currentValue = (this.attributes as any)[key]

      return currentValue !== originalValue
    })
  }

  isClean(column?: keyof CustomerJsonResponse): boolean {
    return !this.isDirty(column)
  }

  wasChanged(column?: keyof CustomerJsonResponse): boolean {
    return this.hasSaved && this.isDirty(column)
  }

  static select(params: (keyof CustomerJsonResponse)[] | RawBuilder<string> | string): CustomerModel {
    const instance = new CustomerModel(undefined)

    return instance.applySelect(params)
  }

  // Method to find a Customer by ID
  static async find(id: number): Promise<CustomerModel | undefined> {
    const instance = new CustomerModel(undefined)

    return await instance.applyFind(id)
  }

  async first(): Promise<CustomerModel | undefined> {
    const model = await this.applyFirst()

    const data = new CustomerModel(model)

    return data
  }

  static async first(): Promise<CustomerModel | undefined> {
    const instance = new CustomerModel(undefined)

    const model = await instance.applyFirst()

    const data = new CustomerModel(model)

    return data
  }

  async applyFirstOrFail(): Promise<CustomerModel | undefined> {
    const model = await this.selectFromQuery.executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, 'No CustomerModel results found for query')

    if (model) {
      this.mapCustomGetters(model)
      await this.loadRelations(model)
    }

    const data = new CustomerModel(model)

    return data
  }

  async firstOrFail(): Promise<CustomerModel | undefined> {
    return await this.applyFirstOrFail()
  }

  static async firstOrFail(): Promise<CustomerModel | undefined> {
    const instance = new CustomerModel(undefined)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<CustomerModel[]> {
    const instance = new CustomerModel(undefined)

    const models = await DB.instance.selectFrom('customers').selectAll().execute()

    instance.mapCustomGetters(models)

    const data = await Promise.all(models.map(async (model: CustomerJsonResponse) => {
      return new CustomerModel(model)
    }))

    return data
  }

  async applyFindOrFail(id: number): Promise<CustomerModel> {
    const model = await DB.instance.selectFrom('customers').where('id', '=', id).selectAll().executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, `No CustomerModel results for ${id}`)

    cache.getOrSet(`customer:${id}`, JSON.stringify(model))

    this.mapCustomGetters(model)
    await this.loadRelations(model)

    const data = new CustomerModel(model)

    return data
  }

  async findOrFail(id: number): Promise<CustomerModel> {
    return await this.applyFindOrFail(id)
  }

  static async findOrFail(id: number): Promise<CustomerModel> {
    const instance = new CustomerModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  static async findMany(ids: number[]): Promise<CustomerModel[]> {
    const instance = new CustomerModel(undefined)

    const models = await instance.applyFindMany(ids)

    return models.map((modelItem: UserJsonResponse) => instance.parseResult(new CustomerModel(modelItem)))
  }

  async findMany(ids: number[]): Promise<CustomerModel[]> {
    const models = await this.applyFindMany(ids)

    return models.map((modelItem: UserJsonResponse) => this.parseResult(new CustomerModel(modelItem)))
  }

  skip(count: number): CustomerModel {
    this.selectFromQuery = this.selectFromQuery.offset(count)

    return this
  }

  static skip(count: number): CustomerModel {
    const instance = new CustomerModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.offset(count)

    return instance
  }

  async applyChunk(size: number, callback: (models: CustomerModel[]) => Promise<void>): Promise<void> {
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

  async chunk(size: number, callback: (models: CustomerModel[]) => Promise<void>): Promise<void> {
    await this.applyChunk(size, callback)
  }

  static async chunk(size: number, callback: (models: CustomerModel[]) => Promise<void>): Promise<void> {
    const instance = new CustomerModel(undefined)

    await instance.applyChunk(size, callback)
  }

  static take(count: number): CustomerModel {
    const instance = new CustomerModel(undefined)

    return instance.applyTake(count)
  }

  static async pluck<K extends keyof CustomerModel>(field: K): Promise<CustomerModel[K][]> {
    const instance = new CustomerModel(undefined)

    if (instance.hasSelect) {
      const model = await instance.selectFromQuery.execute()
      return model.map((modelItem: CustomerModel) => modelItem[field])
    }

    const model = await instance.selectFromQuery.selectAll().execute()

    return model.map((modelItem: CustomerModel) => modelItem[field])
  }

  async pluck<K extends keyof CustomerModel>(field: K): Promise<CustomerModel[K][]> {
    if (this.hasSelect) {
      const model = await this.selectFromQuery.execute()
      return model.map((modelItem: CustomerModel) => modelItem[field])
    }

    const model = await this.selectFromQuery.selectAll().execute()

    return model.map((modelItem: CustomerModel) => modelItem[field])
  }

  static async count(): Promise<number> {
    const instance = new CustomerModel(undefined)

    return instance.applyCount()
  }

  static async max(field: keyof CustomerModel): Promise<number> {
    const instance = new CustomerModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`MAX(${sql.raw(field as string)}) as max `)
      .executeTakeFirst()

    return result.max
  }

  async max(field: keyof CustomerModel): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`MAX(${sql.raw(field as string)}) as max`)
      .executeTakeFirst()

    return result.max
  }

  static async min(field: keyof CustomerModel): Promise<number> {
    const instance = new CustomerModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`MIN(${sql.raw(field as string)}) as min `)
      .executeTakeFirst()

    return result.min
  }

  async min(field: keyof CustomerModel): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`MIN(${sql.raw(field as string)}) as min `)
      .executeTakeFirst()

    return result.min
  }

  static async avg(field: keyof CustomerModel): Promise<number> {
    const instance = new CustomerModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`AVG(${sql.raw(field as string)}) as avg `)
      .executeTakeFirst()

    return result.avg
  }

  async avg(field: keyof CustomerModel): Promise<number> {
    const result = await this.selectFromQuery
      .select(sql`AVG(${sql.raw(field as string)}) as avg `)
      .executeTakeFirst()

    return result.avg
  }

  static async sum(field: keyof CustomerModel): Promise<number> {
    const instance = new CustomerModel(undefined)

    const result = await instance.selectFromQuery
      .select(sql`SUM(${sql.raw(field as string)}) as sum `)
      .executeTakeFirst()

    return result.sum
  }

  async sum(field: keyof CustomerModel): Promise<number> {
    const result = this.selectFromQuery
      .select(sql`SUM(${sql.raw(field as string)}) as sum `)
      .executeTakeFirst()

    return result.sum
  }

  async applyGet(): Promise<CustomerModel[]> {
    let models

    if (this.hasSelect) {
      models = await this.selectFromQuery.execute()
    }
    else {
      models = await this.selectFromQuery.selectAll().execute()
    }

    this.mapCustomGetters(models)
    await this.loadRelations(models)

    const data = await Promise.all(models.map(async (model: CustomerJsonResponse) => {
      return new CustomerModel(model)
    }))

    return data
  }

  async get(): Promise<CustomerModel[]> {
    return await this.applyGet()
  }

  static async get(): Promise<CustomerModel[]> {
    const instance = new CustomerModel(undefined)

    return await instance.applyGet()
  }

  has(relation: string): CustomerModel {
    this.selectFromQuery = this.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(
        selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.customer_id`, '=', 'customers.id'),
      ),
    )

    return this
  }

  static has(relation: string): CustomerModel {
    const instance = new CustomerModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(
        selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.customer_id`, '=', 'customers.id'),
      ),
    )

    return instance
  }

  static whereExists(callback: (qb: any) => any): CustomerModel {
    const instance = new CustomerModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where(({ exists, selectFrom }: any) =>
      exists(callback({ exists, selectFrom })),
    )

    return instance
  }

  applyWhereHas(
    relation: string,
    callback: (query: SubqueryBuilder<keyof CustomerModel>) => void,
  ): CustomerModel {
    const subqueryBuilder = new SubqueryBuilder()

    callback(subqueryBuilder)
    const conditions = subqueryBuilder.getConditions()

    this.selectFromQuery = this.selectFromQuery
      .where(({ exists, selectFrom }: any) => {
        let subquery = selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.customer_id`, '=', 'customers.id')

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
    callback: (query: SubqueryBuilder<keyof CustomerModel>) => void,
  ): CustomerModel {
    return this.applyWhereHas(relation, callback)
  }

  static whereHas(
    relation: string,
    callback: (query: SubqueryBuilder<keyof CustomerModel>) => void,
  ): CustomerModel {
    const instance = new CustomerModel(undefined)

    return instance.applyWhereHas(relation, callback)
  }

  applyDoesntHave(relation: string): CustomerModel {
    this.selectFromQuery = this.selectFromQuery.where(({ not, exists, selectFrom }: any) =>
      not(
        exists(
          selectFrom(relation)
            .select('1')
            .whereRef(`${relation}.customer_id`, '=', 'customers.id'),
        ),
      ),
    )

    return this
  }

  doesntHave(relation: string): CustomerModel {
    return this.applyDoesntHave(relation)
  }

  static doesntHave(relation: string): CustomerModel {
    const instance = new CustomerModel(undefined)

    return instance.applyDoesntHave(relation)
  }

  applyWhereDoesntHave(relation: string, callback: (query: SubqueryBuilder<CustomersTable>) => void): CustomerModel {
    const subqueryBuilder = new SubqueryBuilder()

    callback(subqueryBuilder)
    const conditions = subqueryBuilder.getConditions()

    this.selectFromQuery = this.selectFromQuery
      .where(({ exists, selectFrom, not }: any) => {
        const subquery = selectFrom(relation)
          .select('1')
          .whereRef(`${relation}.customer_id`, '=', 'customers.id')

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

  whereDoesntHave(relation: string, callback: (query: SubqueryBuilder<CustomersTable>) => void): CustomerModel {
    return this.applyWhereDoesntHave(relation, callback)
  }

  static whereDoesntHave(
    relation: string,
    callback: (query: SubqueryBuilder<CustomersTable>) => void,
  ): CustomerModel {
    const instance = new CustomerModel(undefined)

    return instance.applyWhereDoesntHave(relation, callback)
  }

  async applyPaginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<CustomerResponse> {
    const totalRecordsResult = await DB.instance.selectFrom('customers')
      .select(DB.instance.fn.count('id').as('total')) // Use 'id' or another actual column name
      .executeTakeFirst()

    const totalRecords = Number(totalRecordsResult?.total) || 0
    const totalPages = Math.ceil(totalRecords / (options.limit ?? 10))

    const customersWithExtra = await DB.instance.selectFrom('customers')
      .selectAll()
      .orderBy('id', 'asc') // Assuming 'id' is used for cursor-based pagination
      .limit((options.limit ?? 10) + 1) // Fetch one extra record
      .offset(((options.page ?? 1) - 1) * (options.limit ?? 10)) // Ensure options.page is not undefined
      .execute()

    let nextCursor = null
    if (customersWithExtra.length > (options.limit ?? 10))
      nextCursor = customersWithExtra.pop()?.id ?? null

    return {
      data: customersWithExtra,
      paging: {
        total_records: totalRecords,
        page: options.page || 1,
        total_pages: totalPages,
      },
      next_cursor: nextCursor,
    }
  }

  async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<CustomerResponse> {
    return await this.applyPaginate(options)
  }

  // Method to get all customers
  static async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<CustomerResponse> {
    const instance = new CustomerModel(undefined)

    return await instance.applyPaginate(options)
  }

  async applyCreate(newCustomer: NewCustomer): Promise<CustomerModel> {
    const filteredValues = Object.fromEntries(
      Object.entries(newCustomer).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewCustomer

    await this.mapCustomSetters(filteredValues)

    filteredValues.uuid = randomUUIDv7()

    const result = await DB.instance.insertInto('customers')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await this.find(Number(result.numInsertedOrUpdatedRows)) as CustomerModel

    if (model)
      dispatch('customer:created', model)

    return model
  }

  async create(newCustomer: NewCustomer): Promise<CustomerModel> {
    return await this.applyCreate(newCustomer)
  }

  static async create(newCustomer: NewCustomer): Promise<CustomerModel> {
    const instance = new CustomerModel(undefined)

    return await instance.applyCreate(newCustomer)
  }

  static async createMany(newCustomer: NewCustomer[]): Promise<void> {
    const instance = new CustomerModel(undefined)

    const valuesFiltered = newCustomer.map((newCustomer: NewCustomer) => {
      const filteredValues = Object.fromEntries(
        Object.entries(newCustomer).filter(([key]) =>
          !instance.guarded.includes(key) && instance.fillable.includes(key),
        ),
      ) as NewCustomer

      filteredValues.uuid = randomUUIDv7()

      return filteredValues
    })

    await DB.instance.insertInto('customers')
      .values(valuesFiltered)
      .executeTakeFirst()
  }

  static async forceCreate(newCustomer: NewCustomer): Promise<CustomerModel> {
    const result = await DB.instance.insertInto('customers')
      .values(newCustomer)
      .executeTakeFirst()

    const model = await find(Number(result.numInsertedOrUpdatedRows)) as CustomerModel

    if (model)
      dispatch('customer:created', model)

    return model
  }

  // Method to remove a Customer
  async delete(): Promise<CustomersTable> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()
    const model = await this.find(Number(this.id))
    if (model)
      dispatch('customer:deleted', model)

    return await DB.instance.deleteFrom('customers')
      .where('id', '=', this.id)
      .execute()
  }

  async userBelong(): Promise<UserModel> {
    if (this.user_id === undefined)
      throw new HttpError(500, 'Relation Error!')

    const model = await User
      .where('id', '=', this.user_id)
      .first()

    if (!model)
      throw new HttpError(500, 'Model Relation Not Found!')

    return model
  }

  toSearchableObject(): Partial<CustomerJsonResponse> {
    return {
      id: this.id,
      name: this.name,
      email: this.email,
      phone: this.phone,
      status: this.status,
    }
  }

  distinct(column: keyof CustomerJsonResponse): CustomerModel {
    return this.applyDistinct(column)
  }

  static distinct(column: keyof CustomerJsonResponse): CustomerModel {
    const instance = new CustomerModel(undefined)

    return instance.applyDistinct(column)
  }

  join(table: string, firstCol: string, secondCol: string): CustomerModel {
    return this.applyJoin(table, firstCol, secondCol)
  }

  static join(table: string, firstCol: string, secondCol: string): CustomerModel {
    const instance = new CustomerModel(undefined)

    return instance.applyJoin(table, firstCol, secondCol)
  }

  toJSON(): CustomerJsonResponse {
    const output = {

      uuid: this.uuid,

      id: this.id,
      name: this.name,
      email: this.email,
      phone: this.phone,
      total_spent: this.total_spent,
      last_order: this.last_order,
      status: this.status,
      avatar: this.avatar,

      created_at: this.created_at,

      updated_at: this.updated_at,

      orders: this.orders,
      user_id: this.user_id,
      user: this.user,
      ...this.customColumns,
    }

    return output
  }

  parseResult(model: CustomerModel): CustomerModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof CustomerModel]
    }

    return model
  }
}

async function find(id: number): Promise<CustomerModel | undefined> {
  const query = DB.instance.selectFrom('customers').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  return new CustomerModel(model)
}

export async function count(): Promise<number> {
  const results = await CustomerModel.count()

  return results
}

export async function create(newCustomer: NewCustomer): Promise<CustomerModel> {
  const result = await DB.instance.insertInto('customers')
    .values(newCustomer)
    .executeTakeFirstOrThrow()

  return await find(Number(result.numInsertedOrUpdatedRows)) as CustomerModel
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(DB.instance)
}

export async function remove(id: number): Promise<void> {
  await DB.instance.deleteFrom('customers')
    .where('id', '=', id)
    .execute()
}

export async function whereName(value: string): Promise<CustomerModel[]> {
  const query = DB.instance.selectFrom('customers').where('name', '=', value)
  const results: CustomerJsonResponse = await query.execute()

  return results.map((modelItem: CustomerJsonResponse) => new CustomerModel(modelItem))
}

export async function whereEmail(value: string): Promise<CustomerModel[]> {
  const query = DB.instance.selectFrom('customers').where('email', '=', value)
  const results: CustomerJsonResponse = await query.execute()

  return results.map((modelItem: CustomerJsonResponse) => new CustomerModel(modelItem))
}

export async function wherePhone(value: string): Promise<CustomerModel[]> {
  const query = DB.instance.selectFrom('customers').where('phone', '=', value)
  const results: CustomerJsonResponse = await query.execute()

  return results.map((modelItem: CustomerJsonResponse) => new CustomerModel(modelItem))
}

export async function whereTotalSpent(value: number): Promise<CustomerModel[]> {
  const query = DB.instance.selectFrom('customers').where('total_spent', '=', value)
  const results: CustomerJsonResponse = await query.execute()

  return results.map((modelItem: CustomerJsonResponse) => new CustomerModel(modelItem))
}

export async function whereLastOrder(value: string): Promise<CustomerModel[]> {
  const query = DB.instance.selectFrom('customers').where('last_order', '=', value)
  const results: CustomerJsonResponse = await query.execute()

  return results.map((modelItem: CustomerJsonResponse) => new CustomerModel(modelItem))
}

export async function whereStatus(value: string | string[]): Promise<CustomerModel[]> {
  const query = DB.instance.selectFrom('customers').where('status', '=', value)
  const results: CustomerJsonResponse = await query.execute()

  return results.map((modelItem: CustomerJsonResponse) => new CustomerModel(modelItem))
}

export async function whereAvatar(value: string): Promise<CustomerModel[]> {
  const query = DB.instance.selectFrom('customers').where('avatar', '=', value)
  const results: CustomerJsonResponse = await query.execute()

  return results.map((modelItem: CustomerJsonResponse) => new CustomerModel(modelItem))
}

export const Customer = CustomerModel

export default Customer
