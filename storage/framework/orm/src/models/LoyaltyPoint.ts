import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import { randomUUIDv7 } from 'bun'
import { cache } from '@stacksjs/cache'
import { sql } from '@stacksjs/database'
import { ModelNotFoundException } from '@stacksjs/error-handling'
import { dispatch } from '@stacksjs/events'
import { BaseOrm, DB } from '@stacksjs/orm'

export interface LoyaltyPointsTable {
  id: Generated<number>
  wallet_id: string
  points: number
  source: string
  source_reference_id?: string
  description?: string
  expiry_date?: string
  is_used?: boolean
  uuid?: string

  created_at?: Date

  updated_at?: Date

}

export interface LoyaltyPointResponse {
  data: LoyaltyPointJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface LoyaltyPointJsonResponse extends Omit<Selectable<LoyaltyPointsTable>, 'password'> {
  [key: string]: any
}

export type NewLoyaltyPoint = Insertable<LoyaltyPointsTable>
export type LoyaltyPointUpdate = Updateable<LoyaltyPointsTable>

      type SortDirection = 'asc' | 'desc'
interface SortOptions { column: LoyaltyPointJsonResponse, order: SortDirection }
// Define a type for the options parameter
interface QueryOptions {
  sort?: SortOptions
  limit?: number
  offset?: number
  page?: number
}

export class LoyaltyPointModel extends BaseOrm<LoyaltyPointModel, LoyaltyPointsTable, LoyaltyPointJsonResponse> {
  private readonly hidden: Array<keyof LoyaltyPointJsonResponse> = []
  private readonly fillable: Array<keyof LoyaltyPointJsonResponse> = ['wallet_id', 'points', 'source', 'source_reference_id', 'description', 'expiry_date', 'is_used', 'uuid']
  private readonly guarded: Array<keyof LoyaltyPointJsonResponse> = []
  protected attributes = {} as LoyaltyPointJsonResponse
  protected originalAttributes = {} as LoyaltyPointJsonResponse

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

  constructor(loyaltyPoint: LoyaltyPointJsonResponse | undefined) {
    super('loyalty_points')
    if (loyaltyPoint) {
      this.attributes = { ...loyaltyPoint }
      this.originalAttributes = { ...loyaltyPoint }

      Object.keys(loyaltyPoint).forEach((key) => {
        if (!(key in this)) {
          this.customColumns[key] = (loyaltyPoint as LoyaltyPointJsonResponse)[key]
        }
      })
    }

    this.withRelations = []
    this.selectFromQuery = DB.instance.selectFrom('loyalty_points')
    this.updateFromQuery = DB.instance.updateTable('loyalty_points')
    this.deleteFromQuery = DB.instance.deleteFrom('loyalty_points')
    this.hasSelect = false
    this.hasSaved = false
  }

  protected async loadRelations(models: LoyaltyPointJsonResponse | LoyaltyPointJsonResponse[]): Promise<void> {
    // Handle both single model and array of models
    const modelArray = Array.isArray(models) ? models : [models]
    if (!modelArray.length)
      return

    const modelIds = modelArray.map(model => model.id)

    for (const relation of this.withRelations) {
      const relatedRecords = await DB.instance
        .selectFrom(relation)
        .where('loyaltyPoint_id', 'in', modelIds)
        .selectAll()
        .execute()

      if (Array.isArray(models)) {
        models.map((model: LoyaltyPointJsonResponse) => {
          const records = relatedRecords.filter((record: { loyaltyPoint_id: number }) => {
            return record.loyaltyPoint_id === model.id
          })

          model[relation] = records.length === 1 ? records[0] : records
          return model
        })
      }
      else {
        const records = relatedRecords.filter((record: { loyaltyPoint_id: number }) => {
          return record.loyaltyPoint_id === models.id
        })

        models[relation] = records.length === 1 ? records[0] : records
      }
    }
  }

  static with(relations: string[]): LoyaltyPointModel {
    const instance = new LoyaltyPointModel(undefined)

    return instance.applyWith(relations)
  }

  protected mapCustomGetters(models: LoyaltyPointJsonResponse | LoyaltyPointJsonResponse[]): void {
    const data = models

    if (Array.isArray(data)) {
      data.map((model: LoyaltyPointJsonResponse) => {
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

  async mapCustomSetters(model: NewLoyaltyPoint | LoyaltyPointUpdate): Promise<void> {
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

  get uuid(): string | undefined {
    return this.attributes.uuid
  }

  get wallet_id(): string {
    return this.attributes.wallet_id
  }

  get points(): number {
    return this.attributes.points
  }

  get source(): string {
    return this.attributes.source
  }

  get source_reference_id(): string | undefined {
    return this.attributes.source_reference_id
  }

  get description(): string | undefined {
    return this.attributes.description
  }

  get expiry_date(): string | undefined {
    return this.attributes.expiry_date
  }

  get is_used(): boolean | undefined {
    return this.attributes.is_used
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

  set wallet_id(value: string) {
    this.attributes.wallet_id = value
  }

  set points(value: number) {
    this.attributes.points = value
  }

  set source(value: string) {
    this.attributes.source = value
  }

  set source_reference_id(value: string) {
    this.attributes.source_reference_id = value
  }

  set description(value: string) {
    this.attributes.description = value
  }

  set expiry_date(value: string) {
    this.attributes.expiry_date = value
  }

  set is_used(value: boolean) {
    this.attributes.is_used = value
  }

  set updated_at(value: Date) {
    this.attributes.updated_at = value
  }

  getOriginal(column?: keyof LoyaltyPointJsonResponse): Partial<LoyaltyPointJsonResponse> {
    if (column) {
      return this.originalAttributes[column]
    }

    return this.originalAttributes
  }

  getChanges(): Partial<LoyaltyPointJsonResponse> {
    return this.fillable.reduce<Partial<LoyaltyPointJsonResponse>>((changes, key) => {
      const currentValue = this.attributes[key as keyof LoyaltyPointsTable]
      const originalValue = this.originalAttributes[key as keyof LoyaltyPointsTable]

      if (currentValue !== originalValue) {
        changes[key] = currentValue
      }

      return changes
    }, {})
  }

  isDirty(column?: keyof LoyaltyPointJsonResponse): boolean {
    if (column) {
      return this.attributes[column] !== this.originalAttributes[column]
    }

    return Object.entries(this.originalAttributes).some(([key, originalValue]) => {
      const currentValue = (this.attributes as any)[key]

      return currentValue !== originalValue
    })
  }

  isClean(column?: keyof LoyaltyPointJsonResponse): boolean {
    return !this.isDirty(column)
  }

  wasChanged(column?: keyof LoyaltyPointJsonResponse): boolean {
    return this.hasSaved && this.isDirty(column)
  }

  static select(params: (keyof LoyaltyPointJsonResponse)[] | RawBuilder<string> | string): LoyaltyPointModel {
    const instance = new LoyaltyPointModel(undefined)

    return instance.applySelect(params)
  }

  // Method to find a LoyaltyPoint by ID
  static async find(id: number): Promise<LoyaltyPointModel | undefined> {
    const instance = new LoyaltyPointModel(undefined)

    return await instance.applyFind(id)
  }

  async first(): Promise<LoyaltyPointModel | undefined> {
    const model = await this.applyFirst()

    const data = new LoyaltyPointModel(model)

    return data
  }

  static async first(): Promise<LoyaltyPointModel | undefined> {
    const instance = new LoyaltyPointModel(undefined)

    const model = await instance.applyFirst()

    const data = new LoyaltyPointModel(model)

    return data
  }

  async applyFirstOrFail(): Promise<LoyaltyPointModel | undefined> {
    const model = await this.selectFromQuery.executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, `No LoyaltyPointModel results found for query`)

    if (model) {
      this.mapCustomGetters(model)
      await this.loadRelations(model)
    }

    const data = new LoyaltyPointModel(model)

    return data
  }

  static async firstOrFail(): Promise<LoyaltyPointModel | undefined> {
    const instance = new LoyaltyPointModel(undefined)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<LoyaltyPointModel[]> {
    const instance = new LoyaltyPointModel(undefined)

    const models = await DB.instance.selectFrom('loyalty_points').selectAll().execute()

    instance.mapCustomGetters(models)

    const data = await Promise.all(models.map(async (model: LoyaltyPointJsonResponse) => {
      return new LoyaltyPointModel(model)
    }))

    return data
  }

  async applyFindOrFail(id: number): Promise<LoyaltyPointModel> {
    const model = await DB.instance.selectFrom('loyalty_points').where('id', '=', id).selectAll().executeTakeFirst()

    if (model === undefined)
      throw new ModelNotFoundException(404, `No LoyaltyPointModel results for ${id}`)

    cache.getOrSet(`loyaltyPoint:${id}`, JSON.stringify(model))

    this.mapCustomGetters(model)
    await this.loadRelations(model)

    const data = new LoyaltyPointModel(model)

    return data
  }

  async findOrFail(id: number): Promise<LoyaltyPointModel> {
    return await this.applyFindOrFail(id)
  }

  static async findOrFail(id: number): Promise<LoyaltyPointModel> {
    const instance = new LoyaltyPointModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  static async findMany(ids: number[]): Promise<LoyaltyPointModel[]> {
    const instance = new LoyaltyPointModel(undefined)

    const models = await instance.applyFindMany(ids)

    return models.map((modelItem: UserJsonResponse) => instance.parseResult(new LoyaltyPointModel(modelItem)))
  }

  async findMany(ids: number[]): Promise<LoyaltyPointModel[]> {
    const models = await this.applyFindMany(ids)

    return models.map((modelItem: UserJsonResponse) => this.parseResult(new LoyaltyPointModel(modelItem)))
  }

  static skip(count: number): LoyaltyPointModel {
    const instance = new LoyaltyPointModel(undefined)

    return instance.applySkip(count)
  }

  static take(count: number): LoyaltyPointModel {
    const instance = new LoyaltyPointModel(undefined)

    return instance.applyTake(count)
  }

  static async count(): Promise<number> {
    const instance = new LoyaltyPointModel(undefined)

    return instance.applyCount()
  }

  async applyCreate(newLoyaltyPoint: NewLoyaltyPoint): Promise<LoyaltyPointModel> {
    const filteredValues = Object.fromEntries(
      Object.entries(newLoyaltyPoint).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewLoyaltyPoint

    await this.mapCustomSetters(filteredValues)

    filteredValues.uuid = randomUUIDv7()

    const result = await DB.instance.insertInto('loyalty_points')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await this.find(Number(result.numInsertedOrUpdatedRows)) as LoyaltyPointModel

    if (model)
      dispatch('loyaltyPoint:created', model)

    return model
  }

  async create(newLoyaltyPoint: NewLoyaltyPoint): Promise<LoyaltyPointModel> {
    return await this.applyCreate(newLoyaltyPoint)
  }

  static async create(newLoyaltyPoint: NewLoyaltyPoint): Promise<LoyaltyPointModel> {
    const instance = new LoyaltyPointModel(undefined)

    return await instance.applyCreate(newLoyaltyPoint)
  }

  async update(newLoyaltyPoint: LoyaltyPointUpdate): Promise<LoyaltyPointModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newLoyaltyPoint).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as LoyaltyPointUpdate

    await this.mapCustomSetters(filteredValues)

    await DB.instance.updateTable('loyalty_points')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      const model = await this.find(this.id)

      if (model)
        dispatch('loyaltyPoint:updated', model)

      return model
    }

    this.hasSaved = true

    return undefined
  }

  async forceUpdate(newLoyaltyPoint: LoyaltyPointUpdate): Promise<LoyaltyPointModel | undefined> {
    await DB.instance.updateTable('loyalty_points')
      .set(newLoyaltyPoint)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      const model = await this.find(this.id)

      if (model)
        dispatch('loyaltyPoint:updated', model)

      return model
    }

    return undefined
  }

  static async createMany(newLoyaltyPoint: NewLoyaltyPoint[]): Promise<void> {
    const instance = new LoyaltyPointModel(undefined)

    const valuesFiltered = newLoyaltyPoint.map((newLoyaltyPoint: NewLoyaltyPoint) => {
      const filteredValues = Object.fromEntries(
        Object.entries(newLoyaltyPoint).filter(([key]) =>
          !instance.guarded.includes(key) && instance.fillable.includes(key),
        ),
      ) as NewLoyaltyPoint

      filteredValues.uuid = randomUUIDv7()

      return filteredValues
    })

    await DB.instance.insertInto('loyalty_points')
      .values(valuesFiltered)
      .executeTakeFirst()
  }

  static async forceCreate(newLoyaltyPoint: NewLoyaltyPoint): Promise<LoyaltyPointModel> {
    const result = await DB.instance.insertInto('loyalty_points')
      .values(newLoyaltyPoint)
      .executeTakeFirst()

    const model = await find(Number(result.numInsertedOrUpdatedRows)) as LoyaltyPointModel

    if (model)
      dispatch('loyaltyPoint:created', model)

    return model
  }

  // Method to remove a LoyaltyPoint
  async delete(): Promise<LoyaltyPointsTable> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()
    const model = await this.find(Number(this.id))

    if (model)
      dispatch('loyaltyPoint:deleted', model)

    await DB.instance.deleteFrom('loyalty_points')
      .where('id', '=', this.id)
      .execute()
  }

  static async remove(id: number): Promise<any> {
    const instance = new LoyaltyPointModel(undefined)

    const model = await instance.find(Number(id))

    if (model)
      dispatch('loyaltyPoint:deleted', model)

    return await DB.instance.deleteFrom('loyalty_points')
      .where('id', '=', id)
      .execute()
  }

  static whereWalletId(value: string): LoyaltyPointModel {
    const instance = new LoyaltyPointModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('wallet_id', '=', value)

    return instance
  }

  static wherePoints(value: string): LoyaltyPointModel {
    const instance = new LoyaltyPointModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('points', '=', value)

    return instance
  }

  static whereSource(value: string): LoyaltyPointModel {
    const instance = new LoyaltyPointModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('source', '=', value)

    return instance
  }

  static whereSourceReferenceId(value: string): LoyaltyPointModel {
    const instance = new LoyaltyPointModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('source_reference_id', '=', value)

    return instance
  }

  static whereDescription(value: string): LoyaltyPointModel {
    const instance = new LoyaltyPointModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('description', '=', value)

    return instance
  }

  static whereExpiryDate(value: string): LoyaltyPointModel {
    const instance = new LoyaltyPointModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('expiry_date', '=', value)

    return instance
  }

  static whereIsUsed(value: string): LoyaltyPointModel {
    const instance = new LoyaltyPointModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('is_used', '=', value)

    return instance
  }

  static whereIn<V = number>(column: keyof LoyaltyPointsTable, values: V[]): LoyaltyPointModel {
    const instance = new LoyaltyPointModel(undefined)

    return instance.applyWhereIn<V>(column, values)
  }

  toSearchableObject(): Partial<LoyaltyPointJsonResponse> {
    return {
      id: this.id,
      wallet_id: this.wallet_id,
      points: this.points,
      source: this.source,
      description: this.description,
      expiry_date: this.expiry_date,
      is_used: this.is_used,
    }
  }

  static distinct(column: keyof LoyaltyPointJsonResponse): LoyaltyPointModel {
    const instance = new LoyaltyPointModel(undefined)

    return instance.applyDistinct(column)
  }

  static join(table: string, firstCol: string, secondCol: string): LoyaltyPointModel {
    const instance = new LoyaltyPointModel(undefined)

    return instance.applyJoin(table, firstCol, secondCol)
  }

  toJSON(): LoyaltyPointJsonResponse {
    const output = {

      uuid: this.uuid,

      id: this.id,
      wallet_id: this.wallet_id,
      points: this.points,
      source: this.source,
      source_reference_id: this.source_reference_id,
      description: this.description,
      expiry_date: this.expiry_date,
      is_used: this.is_used,

      created_at: this.created_at,

      updated_at: this.updated_at,

      ...this.customColumns,
    }

    return output
  }

  parseResult(model: LoyaltyPointModel): LoyaltyPointModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof LoyaltyPointModel]
    }

    return model
  }
}

async function find(id: number): Promise<LoyaltyPointModel | undefined> {
  const query = DB.instance.selectFrom('loyalty_points').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  return new LoyaltyPointModel(model)
}

export async function count(): Promise<number> {
  const results = await LoyaltyPointModel.count()

  return results
}

export async function create(newLoyaltyPoint: NewLoyaltyPoint): Promise<LoyaltyPointModel> {
  const result = await DB.instance.insertInto('loyalty_points')
    .values(newLoyaltyPoint)
    .executeTakeFirstOrThrow()

  return await find(Number(result.numInsertedOrUpdatedRows)) as LoyaltyPointModel
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(DB.instance)
}

export async function remove(id: number): Promise<void> {
  await DB.instance.deleteFrom('loyalty_points')
    .where('id', '=', id)
    .execute()
}

export async function whereWalletId(value: string): Promise<LoyaltyPointModel[]> {
  const query = DB.instance.selectFrom('loyalty_points').where('wallet_id', '=', value)
  const results: LoyaltyPointJsonResponse = await query.execute()

  return results.map((modelItem: LoyaltyPointJsonResponse) => new LoyaltyPointModel(modelItem))
}

export async function wherePoints(value: number): Promise<LoyaltyPointModel[]> {
  const query = DB.instance.selectFrom('loyalty_points').where('points', '=', value)
  const results: LoyaltyPointJsonResponse = await query.execute()

  return results.map((modelItem: LoyaltyPointJsonResponse) => new LoyaltyPointModel(modelItem))
}

export async function whereSource(value: string): Promise<LoyaltyPointModel[]> {
  const query = DB.instance.selectFrom('loyalty_points').where('source', '=', value)
  const results: LoyaltyPointJsonResponse = await query.execute()

  return results.map((modelItem: LoyaltyPointJsonResponse) => new LoyaltyPointModel(modelItem))
}

export async function whereSourceReferenceId(value: string): Promise<LoyaltyPointModel[]> {
  const query = DB.instance.selectFrom('loyalty_points').where('source_reference_id', '=', value)
  const results: LoyaltyPointJsonResponse = await query.execute()

  return results.map((modelItem: LoyaltyPointJsonResponse) => new LoyaltyPointModel(modelItem))
}

export async function whereDescription(value: string): Promise<LoyaltyPointModel[]> {
  const query = DB.instance.selectFrom('loyalty_points').where('description', '=', value)
  const results: LoyaltyPointJsonResponse = await query.execute()

  return results.map((modelItem: LoyaltyPointJsonResponse) => new LoyaltyPointModel(modelItem))
}

export async function whereExpiryDate(value: string): Promise<LoyaltyPointModel[]> {
  const query = DB.instance.selectFrom('loyalty_points').where('expiry_date', '=', value)
  const results: LoyaltyPointJsonResponse = await query.execute()

  return results.map((modelItem: LoyaltyPointJsonResponse) => new LoyaltyPointModel(modelItem))
}

export async function whereIsUsed(value: boolean): Promise<LoyaltyPointModel[]> {
  const query = DB.instance.selectFrom('loyalty_points').where('is_used', '=', value)
  const results: LoyaltyPointJsonResponse = await query.execute()

  return results.map((modelItem: LoyaltyPointJsonResponse) => new LoyaltyPointModel(modelItem))
}

export const LoyaltyPoint = LoyaltyPointModel

export default LoyaltyPoint
