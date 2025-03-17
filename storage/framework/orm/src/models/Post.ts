import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { UserModel } from './User'
import { sql } from '@stacksjs/database'
import { HttpError } from '@stacksjs/error-handling'
import { BaseOrm, DB } from '@stacksjs/orm'

export interface PostsTable {
  id: Generated<number>
  user_id: number
  title: string
  body: string

  created_at?: Date

  updated_at?: Date

}

export interface PostResponse {
  data: PostJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface PostJsonResponse extends Omit<Selectable<PostsTable>, 'password'> {
  [key: string]: any
}

export type NewPost = Insertable<PostsTable>
export type PostUpdate = Updateable<PostsTable>

export class PostModel extends BaseOrm<PostModel, PostsTable, PostJsonResponse> {
  private readonly hidden: Array<keyof PostJsonResponse> = []
  private readonly fillable: Array<keyof PostJsonResponse> = ['title', 'body', 'uuid', 'user_id']
  private readonly guarded: Array<keyof PostJsonResponse> = []
  protected attributes = {} as PostJsonResponse
  protected originalAttributes = {} as PostJsonResponse

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

  constructor(post: PostJsonResponse | undefined) {
    super('posts')
    if (post) {
      this.attributes = { ...post }
      this.originalAttributes = { ...post }

      Object.keys(post).forEach((key) => {
        if (!(key in this)) {
          this.customColumns[key] = (post as PostJsonResponse)[key]
        }
      })
    }

    this.withRelations = []
    this.selectFromQuery = DB.instance.selectFrom('posts')
    this.updateFromQuery = DB.instance.updateTable('posts')
    this.deleteFromQuery = DB.instance.deleteFrom('posts')
    this.hasSelect = false
    this.hasSaved = false
  }

  protected async loadRelations(models: PostJsonResponse | PostJsonResponse[]): Promise<void> {
    // Handle both single model and array of models
    const modelArray = Array.isArray(models) ? models : [models]
    if (!modelArray.length)
      return

    const modelIds = modelArray.map(model => model.id)

    for (const relation of this.withRelations) {
      const relatedRecords = await DB.instance
        .selectFrom(relation)
        .where('post_id', 'in', modelIds)
        .selectAll()
        .execute()

      if (Array.isArray(models)) {
        models.map((model: PostJsonResponse) => {
          const records = relatedRecords.filter((record: { post_id: number }) => {
            return record.post_id === model.id
          })

          model[relation] = records.length === 1 ? records[0] : records
          return model
        })
      }
      else {
        const records = relatedRecords.filter((record: { post_id: number }) => {
          return record.post_id === models.id
        })

        models[relation] = records.length === 1 ? records[0] : records
      }
    }
  }

  static with(relations: string[]): PostModel {
    const instance = new PostModel(undefined)

    return instance.applyWith(relations)
  }

  protected mapCustomGetters(models: PostJsonResponse | PostJsonResponse[]): void {
    const data = models

    if (Array.isArray(data)) {
      data.map((model: PostJsonResponse) => {
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

  async mapCustomSetters(model: NewPost | PostUpdate): Promise<void> {
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

  get title(): string {
    return this.attributes.title
  }

  get body(): string {
    return this.attributes.body
  }

  get created_at(): Date | undefined {
    return this.attributes.created_at
  }

  get updated_at(): Date | undefined {
    return this.attributes.updated_at
  }

  set title(value: string) {
    this.attributes.title = value
  }

  set body(value: string) {
    this.attributes.body = value
  }

  set updated_at(value: Date) {
    this.attributes.updated_at = value
  }

  static select(params: (keyof PostJsonResponse)[] | RawBuilder<string> | string): PostModel {
    const instance = new PostModel(undefined)

    return instance.applySelect(params)
  }

  // Method to find a Post by ID
  static async find(id: number): Promise<PostModel | undefined> {
    const instance = new PostModel(undefined)

    return await instance.applyFind(id)
  }

  static async first(): Promise<PostModel | undefined> {
    const instance = new PostModel(undefined)

    const model = await instance.applyFirst()

    const data = new PostModel(model)

    return data
  }

  static async firstOrFail(): Promise<PostModel | undefined> {
    const instance = new PostModel(undefined)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<PostModel[]> {
    const instance = new PostModel(undefined)

    const models = await DB.instance.selectFrom('posts').selectAll().execute()

    instance.mapCustomGetters(models)

    const data = await Promise.all(models.map(async (model: PostJsonResponse) => {
      return new PostModel(model)
    }))

    return data
  }

  static async findOrFail(id: number): Promise<PostModel | undefined> {
    const instance = new PostModel(undefined)

    return await instance.applyFindOrFail(id)
  }

  static async findMany(ids: number[]): Promise<PostModel[]> {
    const instance = new PostModel(undefined)

    const models = await instance.applyFindMany(ids)

    return models.map((modelItem: UserJsonResponse) => instance.parseResult(new PostModel(modelItem)))
  }

  static skip(count: number): PostModel {
    const instance = new PostModel(undefined)

    return instance.applySkip(count)
  }

  static take(count: number): PostModel {
    const instance = new PostModel(undefined)

    return instance.applyTake(count)
  }

  static where<V = string>(column: keyof PostsTable, ...args: [V] | [Operator, V]): PostModel {
    const instance = new PostModel(undefined)

    return instance.applyWhere<V>(column, ...args)
  }

  static whereLike(column: keyof PostsTable, value: string): PostModel {
    const instance = new PostModel(undefined)

    return instance.applyWhereLike(column, value)
  }

  static orderBy(column: keyof PostsTable, order: 'asc' | 'desc'): PostModel {
    const instance = new PostModel(undefined)

    return instance.applyOrderBy(column, order)
  }

  static orderByAsc(column: keyof PostsTable): PostModel {
    const instance = new PostModel(undefined)

    return instance.applyOrderByAsc(column)
  }

  static orderByDesc(column: keyof PostsTable): PostModel {
    const instance = new PostModel(undefined)

    return instance.applyOrderByDesc(column)
  }

  static async max(field: keyof PostsTable): Promise<number> {
    const instance = new PostModel(undefined)

    return await instance.applyMax(field)
  }

  static async min(field: keyof PostsTable): Promise<number> {
    const instance = new PostModel(undefined)

    return await instance.applyMin(field)
  }

  static async avg(field: keyof PostsTable): Promise<number> {
    const instance = new PostModel(undefined)

    return await instance.applyAvg(field)
  }

  static async sum(field: keyof PostsTable): Promise<number> {
    const instance = new PostModel(undefined)

    return await instance.applySum(field)
  }

  static async count(): Promise<number> {
    const instance = new PostModel(undefined)

    return instance.applyCount()
  }

  static async paginate(options: { limit?: number, offset?: number, page?: number } = { limit: 10, offset: 0, page: 1 }): Promise<{
    data: PostModel[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }> {
    const instance = new PostModel(undefined)

    const result = await instance.applyPaginate(options)

    return {
      data: result.data.map((item: PostJsonResponse) => new PostModel(item)),
      paging: result.paging,
      next_cursor: result.next_cursor,
    }
  }

  async applyCreate(newPost: NewPost): Promise<PostModel> {
    const filteredValues = Object.fromEntries(
      Object.entries(newPost).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as NewPost

    await this.mapCustomSetters(filteredValues)

    const result = await DB.instance.insertInto('posts')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await this.find(Number(result.numInsertedOrUpdatedRows)) as PostModel

    return model
  }

  async create(newPost: NewPost): Promise<PostModel> {
    return await this.applyCreate(newPost)
  }

  static async create(newPost: NewPost): Promise<PostModel> {
    const instance = new PostModel(undefined)

    return await instance.applyCreate(newPost)
  }

  async update(newPost: PostUpdate): Promise<PostModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(newPost).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key),
      ),
    ) as PostUpdate

    await this.mapCustomSetters(filteredValues)

    await DB.instance.updateTable('posts')
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

  async forceUpdate(newPost: PostUpdate): Promise<PostModel | undefined> {
    await DB.instance.updateTable('posts')
      .set(newPost)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      const model = await this.find(this.id)

      return model
    }

    return undefined
  }

  static async createMany(newPost: NewPost[]): Promise<void> {
    const instance = new PostModel(undefined)

    const valuesFiltered = newPost.map((newPost: NewPost) => {
      const filteredValues = Object.fromEntries(
        Object.entries(newPost).filter(([key]) =>
          !instance.guarded.includes(key) && instance.fillable.includes(key),
        ),
      ) as NewPost

      return filteredValues
    })

    await DB.instance.insertInto('posts')
      .values(valuesFiltered)
      .executeTakeFirst()
  }

  static async forceCreate(newPost: NewPost): Promise<PostModel> {
    const result = await DB.instance.insertInto('posts')
      .values(newPost)
      .executeTakeFirst()

    const model = await find(Number(result.numInsertedOrUpdatedRows)) as PostModel

    return model
  }

  // Method to remove a Post
  async delete(): Promise<number> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()

    const deleted = await DB.instance.deleteFrom('posts')
      .where('id', '=', this.id)
      .execute()

    return deleted.numDeletedRows
  }

  static async remove(id: number): Promise<any> {
    return await DB.instance.deleteFrom('posts')
      .where('id', '=', id)
      .execute()
  }

  static whereTitle(value: string): PostModel {
    const instance = new PostModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('title', '=', value)

    return instance
  }

  static whereBody(value: string): PostModel {
    const instance = new PostModel(undefined)

    instance.selectFromQuery = instance.selectFromQuery.where('body', '=', value)

    return instance
  }

  static whereIn<V = number>(column: keyof PostsTable, values: V[]): PostModel {
    const instance = new PostModel(undefined)

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

  static distinct(column: keyof PostJsonResponse): PostModel {
    const instance = new PostModel(undefined)

    return instance.applyDistinct(column)
  }

  static join(table: string, firstCol: string, secondCol: string): PostModel {
    const instance = new PostModel(undefined)

    return instance.applyJoin(table, firstCol, secondCol)
  }

  toJSON(): PostJsonResponse {
    const output = {

      id: this.id,
      title: this.title,
      body: this.body,

      created_at: this.created_at,

      updated_at: this.updated_at,

      user_id: this.user_id,
      user: this.user,
      ...this.customColumns,
    }

    return output
  }

  parseResult(model: PostModel): PostModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof PostModel]
    }

    return model
  }
}

async function find(id: number): Promise<PostModel | undefined> {
  const query = DB.instance.selectFrom('posts').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model)
    return undefined

  return new PostModel(model)
}

export async function count(): Promise<number> {
  const results = await PostModel.count()

  return results
}

export async function create(newPost: NewPost): Promise<PostModel> {
  const result = await DB.instance.insertInto('posts')
    .values(newPost)
    .executeTakeFirstOrThrow()

  return await find(Number(result.numInsertedOrUpdatedRows)) as PostModel
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(DB.instance)
}

export async function remove(id: number): Promise<void> {
  await DB.instance.deleteFrom('posts')
    .where('id', '=', id)
    .execute()
}

export async function whereTitle(value: string): Promise<PostModel[]> {
  const query = DB.instance.selectFrom('posts').where('title', '=', value)
  const results: PostJsonResponse = await query.execute()

  return results.map((modelItem: PostJsonResponse) => new PostModel(modelItem))
}

export async function whereBody(value: string): Promise<PostModel[]> {
  const query = DB.instance.selectFrom('posts').where('body', '=', value)
  const results: PostJsonResponse = await query.execute()

  return results.map((modelItem: PostJsonResponse) => new PostModel(modelItem))
}

export const Post = PostModel

export default Post
