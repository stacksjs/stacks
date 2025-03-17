import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import { sql } from '@stacksjs/database'
import { BaseOrm, DB } from '@stacksjs/orm'

export interface SubscribersTable {
  id: Generated<number>
  subscribed: boolean

  created_at?: Date

  updated_at?: Date

}

export interface SubscriberResponse {
  data: SubscriberJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface SubscriberJsonResponse extends Omit<Selectable<SubscribersTable>, 'password'> {
  [key: string]: any
}

export type NewSubscriber = Insertable<SubscribersTable>
export type SubscriberUpdate = Updateable<SubscribersTable>

export class SubscriberModel extends BaseOrm<SubscriberModel, SubscribersTable, SubscriberJsonResponse> {
  private readonly hidden: Array<keyof SubscriberJsonResponse> = []
  private readonly fillable: Array<keyof SubscriberJsonResponse> = ['subscribed', 'uuid', 'user_id']
  private readonly guarded: Array<keyof SubscriberJsonResponse> = []
  protected attributes = {} as SubscriberJsonResponse
  protected originalAttributes = {} as SubscriberJsonResponse

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

  constructor(subscriber: SubscriberJsonResponse | undefined) {
    super('subscribers')
    if (subscriber) {
      this.attributes = { ...subscriber }
      this.originalAttributes = { ...subscriber }

      Object.keys(subscriber).forEach((key) => {
        if (!(key in this)) {
          this.customColumns[key] = (subscriber as SubscriberJsonResponse)[key]
        }
      })
    }

    this.withRelations = []
    this.selectFromQuery = DB.instance.selectFrom('subscribers')
    this.updateFromQuery = DB.instance.updateTable('subscribers')
    this.deleteFromQuery = DB.instance.deleteFrom('subscribers')
    this.hasSelect = false
    this.hasSaved = false
  }

  protected async loadRelations(models: SubscriberJsonResponse | SubscriberJsonResponse[]): Promise<void> {
    // Handle both single model and array of models
    const modelArray = Array.isArray(models) ? models : [models]
    if (!modelArray.length)
      return

    const modelIds = modelArray.map(model => model.id)

    for (const relation of this.withRelations) {
      const relatedRecords = await DB.instance
        .selectFrom(relation)
        .where('subscriber_id', 'in', modelIds)
        .selectAll()
        .execute()

      if (Array.isArray(models)) {
        models.map((model: SubscriberJsonResponse) => {
          const records = relatedRecords.filter((record: { subscriber_id: number }) => {
            return record.subscriber_id === model.id
          })

          model[relation] = records.length === 1 ? records[0] : records
          return model
        })
      }
      else {
        const records = relatedRecords.filter((record: { subscriber_id: number }) => {
          return record.subscriber_id === models.id
        })

        models[relation] = records.length === 1 ? records[0] : records
      }
    }
  }

  static with(relations: string[]): SubscriberModel {
    const instance = new SubscriberModel(undefined)

    return instance.applyWith(relations)
  }

  protected mapCustomGetters(models: SubscriberJsonResponse | SubscriberJsonResponse[]): void {
    const data = models

    if (Array.isArray(data)) {
      data.map((model: SubscriberJsonResponse) => {
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

  async mapCustomSetters(model: NewSubscriber | SubscriberUpdate): Promise<void> {
    const customSetter = {
      default: () => {
      },

    }

    for (const [key, fn] of Object.entries(customSetter)) {
      (model as any)[key] = await fn()
    }
  }

  get id(): number {
    return this.attributes.id
  }

  get subscribed(): boolean {
    return this.attributes.subscribed
  }

  get created_at(): Date | undefined {
    return this.attributes.created_at
  }

  get updated_at(): Date | undefined {
    return this.attributes.updated_at
  }

  set subscribed(value: boolean) {
    this.attributes.subscribed = value
  }

  set updated_at(value: Date) {
    this.attributes.updated_at = value
  }

  static select(params: (keyof SubscriberJsonResponse)[] | RawBuilder<string> | string): SubscriberModel {
    const instance = new SubscriberModel(undefined)

    return instance.applySelect(params)
  }

  // Method to find a Subscriber by ID
  static async find(id: number): Promise<SubscriberModel | undefined> {
    const instance = new SubscriberModel(undefined)

    return await instance.applyFind(id)
  }

  static async first(): Promise<SubscriberModel | undefined> {
    const instance = new SubscriberModel(undefined)

    const model = await instance.applyFirst()

    const data = new SubscriberModel(model)

    return data
  }

  static async firstOrFail(): Promise<SubscriberModel | undefined> {
    const instance = new SubscriberModel(undefined)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<SubscriberModel[]> {
    const instance = new SubscriberModel(undefined)

    const models = await DB.instance.selectFrom('subscribers').selectAll().execute()

    instance.mapCustomGetters(models)

    const data = await Promise.all(models.map(async (model: SubscriberJsonResponse) => {
      return new SubscriberModel(model)
    }))

    return data
  }

  static async findOrFail(id: number): Promise<SubscriberModel> {
    const instance = new SubscriberModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  static async findMany(ids: number[]): Promise<SubscriberModel[]> {
    const instance = new SubscriberModel(undefined)

    const models = await instance.applyFindMany(ids)

    return models.map((modelItem: UserJsonResponse) => instance.parseResult(new SubscriberModel(modelItem)))
  }

  async findMany(ids: number[]): Promise<SubscriberModel[]> {
    const models = await this.applyFindMany(ids)

    return models.map((modelItem: UserJsonResponse) => this.parseResult(new SubscriberModel(modelItem)))
  }

  static skip(count: number): SubscriberModel {
    const instance = new SubscriberModel(undefined)

    return instance.applySkip(count)
  }

  static take(count: number): SubscriberModel {
    const instance = new SubscriberModel(undefined)

    return instance.applyTake(count)
  }

  static async count(): Promise<number> {
    const instance = new SubscriberModel(undefined)

    return instance.applyCount()
  }

  async applyCreate(newSubscriber: NewSubscriber): Promise<SubscriberModel> {
    const filteredValues = Object.fromEntries(
      Object.entries(newSubscriber).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewSubscriber

    await this.mapCustomSetters(filteredValues)

    const result = await DB.instance.insertInto('subscribers')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await this.find(Number(result.numInsertedOrUpdatedRows)) as SubscriberModel

    return model
  }

  async create(newSubscriber: NewSubscriber): Promise<SubscriberModel> {
    return await this.applyCreate(newSubscriber)
  }

  static async create(newSubscriber: NewSubscriber): Promise<SubscriberModel> {
    const instance = new SubscriberModel(undefined)

    return await instance.applyCreate(newSubscriber)
  }

  async update(newSubscriber: SubscriberUpdate): Promise<SubscriberModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newSubscriber).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as SubscriberUpdate

    await this.mapCustomSetters(filteredValues)

    await DB.instance.updateTable('subscribers')
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

  async forceUpdate(newSubscriber: SubscriberUpdate): Promise<SubscriberModel | undefined> {
    await DB.instance.updateTable('subscribers')
      .set(newSubscriber)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      const model = await this.find(this.id)

      return model
    }

    return undefined
  }

  static async createMany(newSubscriber: NewSubscriber[]): Promise<void> {
    const instance = new SubscriberModel(undefined)

    const valuesFiltered = newSubscriber.map((newSubscriber: NewSubscriber) => {
      const filteredValues = Object.fromEntries(
        Object.entries(newSubscriber).filter(([key]) =>
          !instance.guarded.includes(key) && instance.fillable.includes(key),
        ),
      ) as NewSubscriber

      return filteredValues
    })

    await DB.instance.insertInto('subscribers')
      .values(valuesFiltered)
      .executeTakeFirst()
  }

  static async forceCreate(newSubscriber: NewSubscriber): Promise<SubscriberModel> {
    const result = await DB.instance.insertInto('subscribers')
      .values(newSubscriber)
      .executeTakeFirst()

    const model = await find(Number(result.numInsertedOrUpdatedRows)) as SubscriberModel

    return model
  }

  // Method to remove a Subscriber
  async delete(): Promise<number> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()

    const deleted = await DB.instance.deleteFrom('subscribers')
      .where('id', '=', this.id)
      .execute()

    return deleted.numDeletedRows
  }

  static async remove(id: number): Promise<any> {
    return await DB.instance.deleteFrom('subscribers')
      .where('id', '=', id)
      .execute()
  }

  static whereSubscribed(value: string): SubscriberModel {
    const instance = new SubscriberModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('subscribed', '=', value)

    return instance
  }

  static whereIn<V = number>(column: keyof SubscribersTable, values: V[]): SubscriberModel {
    const instance = new SubscriberModel(undefined)

    return instance.applyWhereIn<V>(column, values)
  }

  static distinct(column: keyof SubscriberJsonResponse): SubscriberModel {
    const instance = new SubscriberModel(undefined)

    return instance.applyDistinct(column)
  }

  static join(table: string, firstCol: string, secondCol: string): SubscriberModel {
    const instance = new SubscriberModel(undefined)

    return instance.applyJoin(table, firstCol, secondCol)
  }

  toJSON(): SubscriberJsonResponse {
    const output = {

      id: this.id,
      subscribed: this.subscribed,

      created_at: this.created_at,

      updated_at: this.updated_at,

      ...this.customColumns,
    }

    return output
  }

  parseResult(model: SubscriberModel): SubscriberModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof SubscriberModel]
    }

    return model
  }
}

async function find(id: number): Promise<SubscriberModel | undefined> {
  const query = DB.instance.selectFrom('subscribers').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  return new SubscriberModel(model)
}

export async function count(): Promise<number> {
  const results = await SubscriberModel.count()

  return results
}

export async function create(newSubscriber: NewSubscriber): Promise<SubscriberModel> {
  const result = await DB.instance.insertInto('subscribers')
    .values(newSubscriber)
    .executeTakeFirstOrThrow()

  return await find(Number(result.numInsertedOrUpdatedRows)) as SubscriberModel
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(DB.instance)
}

export async function remove(id: number): Promise<void> {
  await DB.instance.deleteFrom('subscribers')
    .where('id', '=', id)
    .execute()
}

export async function whereSubscribed(value: boolean): Promise<SubscriberModel[]> {
  const query = DB.instance.selectFrom('subscribers').where('subscribed', '=', value)
  const results: SubscriberJsonResponse = await query.execute()

  return results.map((modelItem: SubscriberJsonResponse) => new SubscriberModel(modelItem))
}

export const Subscriber = SubscriberModel

export default Subscriber
