import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { OrderModel } from './Order'
import type { UserModel } from './User'
import { randomUUIDv7 } from 'bun'
import { sql } from '@stacksjs/database'
import { HttpError } from '@stacksjs/error-handling'
import { dispatch } from '@stacksjs/events'

import { BaseOrm, DB } from '@stacksjs/orm'

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

  /**
   * This model inherits many query methods from BaseOrm:
   * - pluck, chunk, whereExists, has, doesntHave, whereHas, whereDoesntHave
   * - inRandomOrder, max, min, avg, paginate, get, and more
   *
   * See BaseOrm class for the full list of inherited methods.
   */

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

  protected async loadRelations(models: CustomerJsonResponse | CustomerJsonResponse[]): Promise<void> {
    // Handle both single model and array of models
    const modelArray = Array.isArray(models) ? models : [models]
    if (!modelArray.length)
      return

    const modelIds = modelArray.map(model => model.id)

    for (const relation of this.withRelations) {
      const relatedRecords = await DB.instance
        .selectFrom(relation)
        .where('customer_id', 'in', modelIds)
        .selectAll()
        .execute()

      if (Array.isArray(models)) {
        models.map((model: CustomerJsonResponse) => {
          const records = relatedRecords.filter((record: { customer_id: number }) => {
            return record.customer_id === model.id
          })

          model[relation] = records.length === 1 ? records[0] : records
          return model
        })
      }
      else {
        const records = relatedRecords.filter((record: { customer_id: number }) => {
          return record.customer_id === models.id
        })

        models[relation] = records.length === 1 ? records[0] : records
      }
    }
  }

  static with(relations: string[]): CustomerModel {
    const instance = new CustomerModel(undefined)

    return instance.applyWith(relations)
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

        fullContactInfo: () => {
          return `${model.name} (${model.email}, ${model.phone})`
        },

      }

      for (const [key, fn] of Object.entries(customGetter)) {
        (model as any)[key] = fn()
      }
    }
  }

  async mapCustomSetters(model: NewCustomer | CustomerUpdate): Promise<void> {
    const customSetter = {
      default: () => {
      },

    }

    for (const [key, fn] of Object.entries(customSetter)) {
      (model as any)[key] = await fn()
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

  static select(params: (keyof CustomerJsonResponse)[] | RawBuilder<string> | string): CustomerModel {
    const instance = new CustomerModel(undefined)

    return instance.applySelect(params)
  }

  // Method to find a Customer by ID
  static async find(id: number): Promise<CustomerModel | undefined> {
    const instance = new CustomerModel(undefined)

    return await instance.applyFind(id)
  }

  static async first(): Promise<CustomerModel | undefined> {
    const instance = new CustomerModel(undefined)

    const model = await instance.applyFirst()

    const data = new CustomerModel(model)

    return data
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

  static async findOrFail(id: number): Promise<CustomerModel | undefined> {
    const instance = new CustomerModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  static async findMany(ids: number[]): Promise<CustomerModel[]> {
    const instance = new CustomerModel(undefined)

    const models = await instance.applyFindMany(ids)

    return models.map((modelItem: UserJsonResponse) => instance.parseResult(new CustomerModel(modelItem)))
  }

  static skip(count: number): CustomerModel {
    const instance = new CustomerModel(undefined)

    return instance.applySkip(count)
  }

  static take(count: number): CustomerModel {
    const instance = new CustomerModel(undefined)

    return instance.applyTake(count)
  }

  static where<V = string>(column: keyof CustomersTable, ...args: [V] | [Operator, V]): CustomerModel {
    const instance = new CustomerModel(undefined)

    return instance.applyWhere<V>(column, ...args)
  }

  static orWhere(...conditions: [string, any][]): CustomerModel {
    const instance = new CustomerModel(undefined)

    return instance.applyOrWhere(...conditions)
  }

  static whereNotIn<V = number>(column: keyof CustomersTable, values: V[]): CustomerModel {
    const instance = new CustomerModel(undefined)

    return instance.applyWhereNotIn<V>(column, values)
  }

  static whereLike(column: keyof CustomersTable, value: string): CustomerModel {
    const instance = new CustomerModel(undefined)

    return instance.applyWhereLike(column, value)
  }

  static orderBy(column: keyof CustomersTable, order: 'asc' | 'desc'): CustomerModel {
    const instance = new CustomerModel(undefined)

    return instance.applyOrderBy(column, order)
  }

  static orderByAsc(column: keyof CustomersTable): CustomerModel {
    const instance = new CustomerModel(undefined)

    return instance.applyOrderByAsc(column)
  }

  static orderByDesc(column: keyof CustomersTable): CustomerModel {
    const instance = new CustomerModel(undefined)

    return instance.applyOrderByDesc(column)
  }

  static async max(field: keyof CustomersTable): Promise<number> {
    const instance = new CustomerModel(undefined)

    return await instance.applyMax(field)
  }

  static async min(field: keyof CustomersTable): Promise<number> {
    const instance = new CustomerModel(undefined)

    return await instance.applyMin(field)
  }

  static async avg(field: keyof CustomersTable): Promise<number> {
    const instance = new CustomerModel(undefined)

    return await instance.applyAvg(field)
  }

  static async sum(field: keyof CustomersTable): Promise<number> {
    const instance = new CustomerModel(undefined)

    return await instance.applySum(field)
  }

  static async count(): Promise<number> {
    const instance = new CustomerModel(undefined)

    return instance.applyCount()
  }

  static async paginate(options: { limit?: number, offset?: number, page?: number } = { limit: 10, offset: 0, page: 1 }): Promise<{
    data: CustomerModel[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }> {
    const instance = new CustomerModel(undefined)

    const result = await instance.applyPaginate(options)

    return {
      data: result.data.map((item: CustomerJsonResponse) => new CustomerModel(item)),
      paging: result.paging,
      next_cursor: result.next_cursor,
    }
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

  async update(newCustomer: CustomerUpdate): Promise<CustomerModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newCustomer).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as CustomerUpdate

    await this.mapCustomSetters(filteredValues)

    await DB.instance.updateTable('customers')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      const model = await this.find(this.id)

      if (model)
        dispatch('customer:updated', model)

      return model
    }

    this.hasSaved = true

    return undefined
  }

  async forceUpdate(newCustomer: CustomerUpdate): Promise<CustomerModel | undefined> {
    await DB.instance.updateTable('customers')
      .set(newCustomer)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      const model = await this.find(this.id)

      if (model)
        dispatch('customer:updated', model)

      return model
    }

    return undefined
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
  async delete(): Promise<number> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()
    const model = await this.find(Number(this.id))

    if (model)
      dispatch('customer:deleted', model)

    const deleted = await DB.instance.deleteFrom('customers')
      .where('id', '=', this.id)
      .execute()

    return deleted.numDeletedRows
  }

  static async remove(id: number): Promise<any> {
    const instance = new CustomerModel(undefined)

    const model = await instance.find(Number(id))

    if (model)
      dispatch('customer:deleted', model)

    return await DB.instance.deleteFrom('customers')
      .where('id', '=', id)
      .execute()
  }

  static whereName(value: string): CustomerModel {
    const instance = new CustomerModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('name', '=', value)

    return instance
  }

  static whereEmail(value: string): CustomerModel {
    const instance = new CustomerModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('email', '=', value)

    return instance
  }

  static wherePhone(value: string): CustomerModel {
    const instance = new CustomerModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('phone', '=', value)

    return instance
  }

  static whereTotalSpent(value: string): CustomerModel {
    const instance = new CustomerModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('totalSpent', '=', value)

    return instance
  }

  static whereLastOrder(value: string): CustomerModel {
    const instance = new CustomerModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('lastOrder', '=', value)

    return instance
  }

  static whereStatus(value: string): CustomerModel {
    const instance = new CustomerModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('status', '=', value)

    return instance
  }

  static whereAvatar(value: string): CustomerModel {
    const instance = new CustomerModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('avatar', '=', value)

    return instance
  }

  static whereIn<V = number>(column: keyof CustomersTable, values: V[]): CustomerModel {
    const instance = new CustomerModel(undefined)

    return instance.applyWhereIn<V>(column, values)
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

  static distinct(column: keyof CustomerJsonResponse): CustomerModel {
    const instance = new CustomerModel(undefined)

    return instance.applyDistinct(column)
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
