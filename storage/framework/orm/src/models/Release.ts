import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import { sql } from '@stacksjs/database'
import { BaseOrm, DB } from '@stacksjs/orm'

export interface ReleasesTable {
  id: Generated<number>
  name: string
  version: string

  created_at?: Date

  updated_at?: Date

}

export interface ReleaseResponse {
  data: ReleaseJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface ReleaseJsonResponse extends Omit<Selectable<ReleasesTable>, 'password'> {
  [key: string]: any
}

export type NewRelease = Insertable<ReleasesTable>
export type ReleaseUpdate = Updateable<ReleasesTable>

export class ReleaseModel extends BaseOrm<ReleaseModel, ReleasesTable, ReleaseJsonResponse> {
  private readonly hidden: Array<keyof ReleaseJsonResponse> = []
  private readonly fillable: Array<keyof ReleaseJsonResponse> = ['version', 'uuid']
  private readonly guarded: Array<keyof ReleaseJsonResponse> = []
  protected attributes = {} as ReleaseJsonResponse
  protected originalAttributes = {} as ReleaseJsonResponse

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

  constructor(release: ReleaseJsonResponse | undefined) {
    super('releases')
    if (release) {
      this.attributes = { ...release }
      this.originalAttributes = { ...release }

      Object.keys(release).forEach((key) => {
        if (!(key in this)) {
          this.customColumns[key] = (release as ReleaseJsonResponse)[key]
        }
      })
    }

    this.withRelations = []
    this.selectFromQuery = DB.instance.selectFrom('releases')
    this.updateFromQuery = DB.instance.updateTable('releases')
    this.deleteFromQuery = DB.instance.deleteFrom('releases')
    this.hasSelect = false
    this.hasSaved = false
  }

  protected async loadRelations(models: ReleaseJsonResponse | ReleaseJsonResponse[]): Promise<void> {
    // Handle both single model and array of models
    const modelArray = Array.isArray(models) ? models : [models]
    if (!modelArray.length)
      return

    const modelIds = modelArray.map(model => model.id)

    for (const relation of this.withRelations) {
      const relatedRecords = await DB.instance
        .selectFrom(relation)
        .where('release_id', 'in', modelIds)
        .selectAll()
        .execute()

      if (Array.isArray(models)) {
        models.map((model: ReleaseJsonResponse) => {
          const records = relatedRecords.filter((record: { release_id: number }) => {
            return record.release_id === model.id
          })

          model[relation] = records.length === 1 ? records[0] : records
          return model
        })
      }
      else {
        const records = relatedRecords.filter((record: { release_id: number }) => {
          return record.release_id === models.id
        })

        models[relation] = records.length === 1 ? records[0] : records
      }
    }
  }

  static with(relations: string[]): ReleaseModel {
    const instance = new ReleaseModel(undefined)

    return instance.applyWith(relations)
  }

  protected mapCustomGetters(models: ReleaseJsonResponse | ReleaseJsonResponse[]): void {
    const data = models

    if (Array.isArray(data)) {
      data.map((model: ReleaseJsonResponse) => {
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

  async mapCustomSetters(model: NewRelease | ReleaseUpdate): Promise<void> {
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

  get name(): string {
    return this.attributes.name
  }

  get version(): string {
    return this.attributes.version
  }

  get created_at(): Date | undefined {
    return this.attributes.created_at
  }

  get updated_at(): Date | undefined {
    return this.attributes.updated_at
  }

  set name(value: string) {
    this.attributes.name = value
  }

  set version(value: string) {
    this.attributes.version = value
  }

  set updated_at(value: Date) {
    this.attributes.updated_at = value
  }

  static select(params: (keyof ReleaseJsonResponse)[] | RawBuilder<string> | string): ReleaseModel {
    const instance = new ReleaseModel(undefined)

    return instance.applySelect(params)
  }

  // Method to find a Release by ID
  static async find(id: number): Promise<ReleaseModel | undefined> {
    const instance = new ReleaseModel(undefined)

    return await instance.applyFind(id)
  }

  static async first(): Promise<ReleaseModel | undefined> {
    const instance = new ReleaseModel(undefined)

    const model = await instance.applyFirst()

    const data = new ReleaseModel(model)

    return data
  }

  static async firstOrFail(): Promise<ReleaseModel | undefined> {
    const instance = new ReleaseModel(undefined)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<ReleaseModel[]> {
    const instance = new ReleaseModel(undefined)

    const models = await DB.instance.selectFrom('releases').selectAll().execute()

    instance.mapCustomGetters(models)

    const data = await Promise.all(models.map(async (model: ReleaseJsonResponse) => {
      return new ReleaseModel(model)
    }))

    return data
  }

  static async findOrFail(id: number): Promise<ReleaseModel | undefined> {
    const instance = new ReleaseModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  static async findMany(ids: number[]): Promise<ReleaseModel[]> {
    const instance = new ReleaseModel(undefined)

    const models = await instance.applyFindMany(ids)

    return models.map((modelItem: UserJsonResponse) => instance.parseResult(new ReleaseModel(modelItem)))
  }

  static skip(count: number): ReleaseModel {
    const instance = new ReleaseModel(undefined)

    return instance.applySkip(count)
  }

  static take(count: number): ReleaseModel {
    const instance = new ReleaseModel(undefined)

    return instance.applyTake(count)
  }

  static async count(): Promise<number> {
    const instance = new ReleaseModel(undefined)

    return instance.applyCount()
  }

  static async paginate(options: { limit?: number, offset?: number, page?: number } = { limit: 10, offset: 0, page: 1 }): Promise<{
    data: ReleaseModel[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }> {
    const instance = new ReleaseModel(undefined)

    const result = await instance.applyPaginate(options)

    return {
      data: result.data.map((item: ReleaseJsonResponse) => new ReleaseModel(item)),
      paging: result.paging,
      next_cursor: result.next_cursor,
    }
  }

  async applyCreate(newRelease: NewRelease): Promise<ReleaseModel> {
    const filteredValues = Object.fromEntries(
      Object.entries(newRelease).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewRelease

    await this.mapCustomSetters(filteredValues)

    const result = await DB.instance.insertInto('releases')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await this.find(Number(result.numInsertedOrUpdatedRows)) as ReleaseModel

    return model
  }

  async create(newRelease: NewRelease): Promise<ReleaseModel> {
    return await this.applyCreate(newRelease)
  }

  static async create(newRelease: NewRelease): Promise<ReleaseModel> {
    const instance = new ReleaseModel(undefined)

    return await instance.applyCreate(newRelease)
  }

  async update(newRelease: ReleaseUpdate): Promise<ReleaseModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newRelease).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as ReleaseUpdate

    await this.mapCustomSetters(filteredValues)

    await DB.instance.updateTable('releases')
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

  async forceUpdate(newRelease: ReleaseUpdate): Promise<ReleaseModel | undefined> {
    await DB.instance.updateTable('releases')
      .set(newRelease)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      const model = await this.find(this.id)

      return model
    }

    return undefined
  }

  static async createMany(newRelease: NewRelease[]): Promise<void> {
    const instance = new ReleaseModel(undefined)

    const valuesFiltered = newRelease.map((newRelease: NewRelease) => {
      const filteredValues = Object.fromEntries(
        Object.entries(newRelease).filter(([key]) =>
          !instance.guarded.includes(key) && instance.fillable.includes(key),
        ),
      ) as NewRelease

      return filteredValues
    })

    await DB.instance.insertInto('releases')
      .values(valuesFiltered)
      .executeTakeFirst()
  }

  static async forceCreate(newRelease: NewRelease): Promise<ReleaseModel> {
    const result = await DB.instance.insertInto('releases')
      .values(newRelease)
      .executeTakeFirst()

    const model = await find(Number(result.numInsertedOrUpdatedRows)) as ReleaseModel

    return model
  }

  // Method to remove a Release
  async delete(): Promise<number> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()

    const deleted = await DB.instance.deleteFrom('releases')
      .where('id', '=', this.id)
      .execute()

    return deleted.numDeletedRows
  }

  static async remove(id: number): Promise<any> {
    return await DB.instance.deleteFrom('releases')
      .where('id', '=', id)
      .execute()
  }

  static whereName(value: string): ReleaseModel {
    const instance = new ReleaseModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('name', '=', value)

    return instance
  }

  static whereVersion(value: string): ReleaseModel {
    const instance = new ReleaseModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('version', '=', value)

    return instance
  }

  static whereIn<V = number>(column: keyof ReleasesTable, values: V[]): ReleaseModel {
    const instance = new ReleaseModel(undefined)

    return instance.applyWhereIn<V>(column, values)
  }

  static distinct(column: keyof ReleaseJsonResponse): ReleaseModel {
    const instance = new ReleaseModel(undefined)

    return instance.applyDistinct(column)
  }

  static join(table: string, firstCol: string, secondCol: string): ReleaseModel {
    const instance = new ReleaseModel(undefined)

    return instance.applyJoin(table, firstCol, secondCol)
  }

  toJSON(): ReleaseJsonResponse {
    const output = {

      id: this.id,
      name: this.name,
      version: this.version,

      created_at: this.created_at,

      updated_at: this.updated_at,

      ...this.customColumns,
    }

    return output
  }

  parseResult(model: ReleaseModel): ReleaseModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof ReleaseModel]
    }

    return model
  }
}

async function find(id: number): Promise<ReleaseModel | undefined> {
  const query = DB.instance.selectFrom('releases').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  return new ReleaseModel(model)
}

export async function count(): Promise<number> {
  const results = await ReleaseModel.count()

  return results
}

export async function create(newRelease: NewRelease): Promise<ReleaseModel> {
  const result = await DB.instance.insertInto('releases')
    .values(newRelease)
    .executeTakeFirstOrThrow()

  return await find(Number(result.numInsertedOrUpdatedRows)) as ReleaseModel
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(DB.instance)
}

export async function remove(id: number): Promise<void> {
  await DB.instance.deleteFrom('releases')
    .where('id', '=', id)
    .execute()
}

export async function whereName(value: string): Promise<ReleaseModel[]> {
  const query = DB.instance.selectFrom('releases').where('name', '=', value)
  const results: ReleaseJsonResponse = await query.execute()

  return results.map((modelItem: ReleaseJsonResponse) => new ReleaseModel(modelItem))
}

export async function whereVersion(value: string): Promise<ReleaseModel[]> {
  const query = DB.instance.selectFrom('releases').where('version', '=', value)
  const results: ReleaseJsonResponse = await query.execute()

  return results.map((modelItem: ReleaseJsonResponse) => new ReleaseModel(modelItem))
}

export const Release = ReleaseModel

export default Release
