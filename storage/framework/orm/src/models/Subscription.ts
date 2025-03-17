import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { UserModel } from './User'
import { randomUUIDv7 } from 'bun'
import { cache } from '@stacksjs/cache'
import { sql } from '@stacksjs/database'
import { HttpError, ModelNotFoundException } from '@stacksjs/error-handling'
import { BaseOrm, DB } from '@stacksjs/orm'

import User from './User'

export interface SubscriptionsTable {
  id: Generated<number>
  user_id: number
  type: string
  provider_id: string
  provider_status: string
  unit_price?: number
  provider_type: string
  provider_price_id?: string
  quantity?: number
  trial_ends_at?: string
  ends_at?: string
  last_used_at?: string
  uuid?: string

  created_at?: Date

  updated_at?: Date

}

export interface SubscriptionResponse {
  data: SubscriptionJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface SubscriptionJsonResponse extends Omit<Selectable<SubscriptionsTable>, 'password'> {
  [key: string]: any
}

export type NewSubscription = Insertable<SubscriptionsTable>
export type SubscriptionUpdate = Updateable<SubscriptionsTable>

export class SubscriptionModel extends BaseOrm<SubscriptionModel, SubscriptionsTable, SubscriptionJsonResponse> {
  private readonly hidden: Array<keyof SubscriptionJsonResponse> = []
  private readonly fillable: Array<keyof SubscriptionJsonResponse> = ['type', 'provider_id', 'provider_status', 'unit_price', 'provider_type', 'provider_price_id', 'quantity', 'trial_ends_at', 'ends_at', 'last_used_at', 'uuid', 'user_id']
  private readonly guarded: Array<keyof SubscriptionJsonResponse> = []
  protected attributes = {} as SubscriptionJsonResponse
  protected originalAttributes = {} as SubscriptionJsonResponse

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

  constructor(subscription: SubscriptionJsonResponse | undefined) {
    super('subscriptions')
    if (subscription) {
      this.attributes = { ...subscription }
      this.originalAttributes = { ...subscription }

      Object.keys(subscription).forEach((key) => {
        if (!(key in this)) {
          this.customColumns[key] = (subscription as SubscriptionJsonResponse)[key]
        }
      })
    }

    this.withRelations = []
    this.selectFromQuery = DB.instance.selectFrom('subscriptions')
    this.updateFromQuery = DB.instance.updateTable('subscriptions')
    this.deleteFromQuery = DB.instance.deleteFrom('subscriptions')
    this.hasSelect = false
    this.hasSaved = false
  }

  protected async loadRelations(models: SubscriptionJsonResponse | SubscriptionJsonResponse[]): Promise<void> {
    // Handle both single model and array of models
    const modelArray = Array.isArray(models) ? models : [models]
    if (!modelArray.length)
      return

    const modelIds = modelArray.map(model => model.id)

    for (const relation of this.withRelations) {
      const relatedRecords = await DB.instance
        .selectFrom(relation)
        .where('subscription_id', 'in', modelIds)
        .selectAll()
        .execute()

      if (Array.isArray(models)) {
        models.map((model: SubscriptionJsonResponse) => {
          const records = relatedRecords.filter((record: { subscription_id: number }) => {
            return record.subscription_id === model.id
          })

          model[relation] = records.length === 1 ? records[0] : records
          return model
        })
      }
      else {
        const records = relatedRecords.filter((record: { subscription_id: number }) => {
          return record.subscription_id === models.id
        })

        models[relation] = records.length === 1 ? records[0] : records
      }
    }
  }

  static with(relations: string[]): SubscriptionModel {
    const instance = new SubscriptionModel(undefined)

    return instance.applyWith(relations)
  }

  protected mapCustomGetters(models: SubscriptionJsonResponse | SubscriptionJsonResponse[]): void {
    const data = models

    if (Array.isArray(data)) {
      data.map((model: SubscriptionJsonResponse) => {
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

  async mapCustomSetters(model: NewSubscription | SubscriptionUpdate): Promise<void> {
    const customSetter = {
      default: () => {
      },

    }

    for (const [key, fn] of Object.entries(customSetter)) {
      (model as any)[key] = await fn()
    }
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

  get type(): string {
    return this.attributes.type
  }

  get provider_id(): string {
    return this.attributes.provider_id
  }

  get provider_status(): string {
    return this.attributes.provider_status
  }

  get unit_price(): number | undefined {
    return this.attributes.unit_price
  }

  get provider_type(): string {
    return this.attributes.provider_type
  }

  get provider_price_id(): string | undefined {
    return this.attributes.provider_price_id
  }

  get quantity(): number | undefined {
    return this.attributes.quantity
  }

  get trial_ends_at(): string | undefined {
    return this.attributes.trial_ends_at
  }

  get ends_at(): string | undefined {
    return this.attributes.ends_at
  }

  get last_used_at(): string | undefined {
    return this.attributes.last_used_at
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

  set type(value: string) {
    this.attributes.type = value
  }

  set provider_id(value: string) {
    this.attributes.provider_id = value
  }

  set provider_status(value: string) {
    this.attributes.provider_status = value
  }

  set unit_price(value: number) {
    this.attributes.unit_price = value
  }

  set provider_type(value: string) {
    this.attributes.provider_type = value
  }

  set provider_price_id(value: string) {
    this.attributes.provider_price_id = value
  }

  set quantity(value: number) {
    this.attributes.quantity = value
  }

  set trial_ends_at(value: string) {
    this.attributes.trial_ends_at = value
  }

  set ends_at(value: string) {
    this.attributes.ends_at = value
  }

  set last_used_at(value: string) {
    this.attributes.last_used_at = value
  }

  set updated_at(value: Date) {
    this.attributes.updated_at = value
  }

  static select(params: (keyof SubscriptionJsonResponse)[] | RawBuilder<string> | string): SubscriptionModel {
    const instance = new SubscriptionModel(undefined)

    return instance.applySelect(params)
  }

  // Method to find a Subscription by ID
  static async find(id: number): Promise<SubscriptionModel | undefined> {
    const instance = new SubscriptionModel(undefined)

    return await instance.applyFind(id)
  }

  async first(): Promise<SubscriptionModel | undefined> {
    const model = await this.applyFirst()

    const data = new SubscriptionModel(model)

    return data
  }

  static async first(): Promise<SubscriptionModel | undefined> {
    const instance = new SubscriptionModel(undefined)

    const model = await instance.applyFirst()

    const data = new SubscriptionModel(model)

    return data
  }

  async applyFirstOrFail(): Promise<SubscriptionModel | undefined> {
    const model = await this.selectFromQuery.executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, `No SubscriptionModel results found for query`)

    if (model) {
      this.mapCustomGetters(model)
      await this.loadRelations(model)
    }

    const data = new SubscriptionModel(model)

    return data
  }

  static async firstOrFail(): Promise<SubscriptionModel | undefined> {
    const instance = new SubscriptionModel(undefined)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<SubscriptionModel[]> {
    const instance = new SubscriptionModel(undefined)

    const models = await DB.instance.selectFrom('subscriptions').selectAll().execute()

    instance.mapCustomGetters(models)

    const data = await Promise.all(models.map(async (model: SubscriptionJsonResponse) => {
      return new SubscriptionModel(model)
    }))

    return data
  }

  async applyFindOrFail(id: number): Promise<SubscriptionModel> {
    const model = await DB.instance.selectFrom('subscriptions').where('id', '=', id).selectAll().executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, `No SubscriptionModel results for ${id}`)

    cache.getOrSet(`subscription:${id}`, JSON.stringify(model))

    this.mapCustomGetters(model)
    await this.loadRelations(model)

    const data = new SubscriptionModel(model)

    return data
  }

  async findOrFail(id: number): Promise<SubscriptionModel> {
    return await this.applyFindOrFail(id)
  }

  static async findOrFail(id: number): Promise<SubscriptionModel> {
    const instance = new SubscriptionModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  static async findMany(ids: number[]): Promise<SubscriptionModel[]> {
    const instance = new SubscriptionModel(undefined)

    const models = await instance.applyFindMany(ids)

    return models.map((modelItem: UserJsonResponse) => instance.parseResult(new SubscriptionModel(modelItem)))
  }

  async findMany(ids: number[]): Promise<SubscriptionModel[]> {
    const models = await this.applyFindMany(ids)

    return models.map((modelItem: UserJsonResponse) => this.parseResult(new SubscriptionModel(modelItem)))
  }

  static skip(count: number): SubscriptionModel {
    const instance = new SubscriptionModel(undefined)

    return instance.applySkip(count)
  }

  static take(count: number): SubscriptionModel {
    const instance = new SubscriptionModel(undefined)

    return instance.applyTake(count)
  }

  static async count(): Promise<number> {
    const instance = new SubscriptionModel(undefined)

    return instance.applyCount()
  }

  async applyCreate(newSubscription: NewSubscription): Promise<SubscriptionModel> {
    const filteredValues = Object.fromEntries(
      Object.entries(newSubscription).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewSubscription

    await this.mapCustomSetters(filteredValues)

    filteredValues.uuid = randomUUIDv7()

    const result = await DB.instance.insertInto('subscriptions')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await this.find(Number(result.numInsertedOrUpdatedRows)) as SubscriptionModel

    return model
  }

  async create(newSubscription: NewSubscription): Promise<SubscriptionModel> {
    return await this.applyCreate(newSubscription)
  }

  static async create(newSubscription: NewSubscription): Promise<SubscriptionModel> {
    const instance = new SubscriptionModel(undefined)

    return await instance.applyCreate(newSubscription)
  }

  async update(newSubscription: SubscriptionUpdate): Promise<SubscriptionModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newSubscription).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as SubscriptionUpdate

    await this.mapCustomSetters(filteredValues)

    await DB.instance.updateTable('subscriptions')
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

  async forceUpdate(newSubscription: SubscriptionUpdate): Promise<SubscriptionModel | undefined> {
    await DB.instance.updateTable('subscriptions')
      .set(newSubscription)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      const model = await this.find(this.id)

      return model
    }

    return undefined
  }

  static async createMany(newSubscription: NewSubscription[]): Promise<void> {
    const instance = new SubscriptionModel(undefined)

    const valuesFiltered = newSubscription.map((newSubscription: NewSubscription) => {
      const filteredValues = Object.fromEntries(
        Object.entries(newSubscription).filter(([key]) =>
          !instance.guarded.includes(key) && instance.fillable.includes(key),
        ),
      ) as NewSubscription

      filteredValues.uuid = randomUUIDv7()

      return filteredValues
    })

    await DB.instance.insertInto('subscriptions')
      .values(valuesFiltered)
      .executeTakeFirst()
  }

  static async forceCreate(newSubscription: NewSubscription): Promise<SubscriptionModel> {
    const result = await DB.instance.insertInto('subscriptions')
      .values(newSubscription)
      .executeTakeFirst()

    const model = await find(Number(result.numInsertedOrUpdatedRows)) as SubscriptionModel

    return model
  }

  // Method to remove a Subscription
  async delete(): Promise<number> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()

    const deleted = await DB.instance.deleteFrom('subscriptions')
      .where('id', '=', this.id)
      .execute()

    return deleted.numDeletedRows
  }

  static async remove(id: number): Promise<any> {
    return await DB.instance.deleteFrom('subscriptions')
      .where('id', '=', id)
      .execute()
  }

  static whereType(value: string): SubscriptionModel {
    const instance = new SubscriptionModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('type', '=', value)

    return instance
  }

  static whereProviderId(value: string): SubscriptionModel {
    const instance = new SubscriptionModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('providerId', '=', value)

    return instance
  }

  static whereProviderStatus(value: string): SubscriptionModel {
    const instance = new SubscriptionModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('providerStatus', '=', value)

    return instance
  }

  static whereUnitPrice(value: string): SubscriptionModel {
    const instance = new SubscriptionModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('unitPrice', '=', value)

    return instance
  }

  static whereProviderType(value: string): SubscriptionModel {
    const instance = new SubscriptionModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('providerType', '=', value)

    return instance
  }

  static whereProviderPriceId(value: string): SubscriptionModel {
    const instance = new SubscriptionModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('providerPriceId', '=', value)

    return instance
  }

  static whereQuantity(value: string): SubscriptionModel {
    const instance = new SubscriptionModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('quantity', '=', value)

    return instance
  }

  static whereTrialEndsAt(value: string): SubscriptionModel {
    const instance = new SubscriptionModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('trialEndsAt', '=', value)

    return instance
  }

  static whereEndsAt(value: string): SubscriptionModel {
    const instance = new SubscriptionModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('endsAt', '=', value)

    return instance
  }

  static whereLastUsedAt(value: string): SubscriptionModel {
    const instance = new SubscriptionModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('lastUsedAt', '=', value)

    return instance
  }

  static whereIn<V = number>(column: keyof SubscriptionsTable, values: V[]): SubscriptionModel {
    const instance = new SubscriptionModel(undefined)

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

  static distinct(column: keyof SubscriptionJsonResponse): SubscriptionModel {
    const instance = new SubscriptionModel(undefined)

    return instance.applyDistinct(column)
  }

  static join(table: string, firstCol: string, secondCol: string): SubscriptionModel {
    const instance = new SubscriptionModel(undefined)

    return instance.applyJoin(table, firstCol, secondCol)
  }

  toJSON(): SubscriptionJsonResponse {
    const output = {

      uuid: this.uuid,

      id: this.id,
      type: this.type,
      provider_id: this.provider_id,
      provider_status: this.provider_status,
      unit_price: this.unit_price,
      provider_type: this.provider_type,
      provider_price_id: this.provider_price_id,
      quantity: this.quantity,
      trial_ends_at: this.trial_ends_at,
      ends_at: this.ends_at,
      last_used_at: this.last_used_at,

      created_at: this.created_at,

      updated_at: this.updated_at,

      user_id: this.user_id,
      user: this.user,
      ...this.customColumns,
    }

    return output
  }

  parseResult(model: SubscriptionModel): SubscriptionModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof SubscriptionModel]
    }

    return model
  }
}

async function find(id: number): Promise<SubscriptionModel | undefined> {
  const query = DB.instance.selectFrom('subscriptions').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  return new SubscriptionModel(model)
}

export async function count(): Promise<number> {
  const results = await SubscriptionModel.count()

  return results
}

export async function create(newSubscription: NewSubscription): Promise<SubscriptionModel> {
  const result = await DB.instance.insertInto('subscriptions')
    .values(newSubscription)
    .executeTakeFirstOrThrow()

  return await find(Number(result.numInsertedOrUpdatedRows)) as SubscriptionModel
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(DB.instance)
}

export async function remove(id: number): Promise<void> {
  await DB.instance.deleteFrom('subscriptions')
    .where('id', '=', id)
    .execute()
}

export async function whereType(value: string): Promise<SubscriptionModel[]> {
  const query = DB.instance.selectFrom('subscriptions').where('type', '=', value)
  const results: SubscriptionJsonResponse = await query.execute()

  return results.map((modelItem: SubscriptionJsonResponse) => new SubscriptionModel(modelItem))
}

export async function whereProviderId(value: string): Promise<SubscriptionModel[]> {
  const query = DB.instance.selectFrom('subscriptions').where('provider_id', '=', value)
  const results: SubscriptionJsonResponse = await query.execute()

  return results.map((modelItem: SubscriptionJsonResponse) => new SubscriptionModel(modelItem))
}

export async function whereProviderStatus(value: string): Promise<SubscriptionModel[]> {
  const query = DB.instance.selectFrom('subscriptions').where('provider_status', '=', value)
  const results: SubscriptionJsonResponse = await query.execute()

  return results.map((modelItem: SubscriptionJsonResponse) => new SubscriptionModel(modelItem))
}

export async function whereUnitPrice(value: number): Promise<SubscriptionModel[]> {
  const query = DB.instance.selectFrom('subscriptions').where('unit_price', '=', value)
  const results: SubscriptionJsonResponse = await query.execute()

  return results.map((modelItem: SubscriptionJsonResponse) => new SubscriptionModel(modelItem))
}

export async function whereProviderType(value: string): Promise<SubscriptionModel[]> {
  const query = DB.instance.selectFrom('subscriptions').where('provider_type', '=', value)
  const results: SubscriptionJsonResponse = await query.execute()

  return results.map((modelItem: SubscriptionJsonResponse) => new SubscriptionModel(modelItem))
}

export async function whereProviderPriceId(value: string): Promise<SubscriptionModel[]> {
  const query = DB.instance.selectFrom('subscriptions').where('provider_price_id', '=', value)
  const results: SubscriptionJsonResponse = await query.execute()

  return results.map((modelItem: SubscriptionJsonResponse) => new SubscriptionModel(modelItem))
}

export async function whereQuantity(value: number): Promise<SubscriptionModel[]> {
  const query = DB.instance.selectFrom('subscriptions').where('quantity', '=', value)
  const results: SubscriptionJsonResponse = await query.execute()

  return results.map((modelItem: SubscriptionJsonResponse) => new SubscriptionModel(modelItem))
}

export async function whereTrialEndsAt(value: string): Promise<SubscriptionModel[]> {
  const query = DB.instance.selectFrom('subscriptions').where('trial_ends_at', '=', value)
  const results: SubscriptionJsonResponse = await query.execute()

  return results.map((modelItem: SubscriptionJsonResponse) => new SubscriptionModel(modelItem))
}

export async function whereEndsAt(value: string): Promise<SubscriptionModel[]> {
  const query = DB.instance.selectFrom('subscriptions').where('ends_at', '=', value)
  const results: SubscriptionJsonResponse = await query.execute()

  return results.map((modelItem: SubscriptionJsonResponse) => new SubscriptionModel(modelItem))
}

export async function whereLastUsedAt(value: string): Promise<SubscriptionModel[]> {
  const query = DB.instance.selectFrom('subscriptions').where('last_used_at', '=', value)
  const results: SubscriptionJsonResponse = await query.execute()

  return results.map((modelItem: SubscriptionJsonResponse) => new SubscriptionModel(modelItem))
}

export const Subscription = SubscriptionModel

export default Subscription
