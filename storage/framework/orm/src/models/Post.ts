import type { Insertable, Selectable, Updateable } from 'kysely'
import type { UserModel } from './User'
import { cache } from '@stacksjs/cache'
import { db, sql } from '@stacksjs/database'
import { HttpError } from '@stacksjs/error-handling'

import User from './User'

export interface PostsTable {
  id?: number
  user_id?: number
  user?: UserModel
  title?: string
  body?: string

  created_at?: Date

  updated_at?: Date

}

interface PostResponse {
  data: Posts
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export type PostType = Selectable<PostsTable>
export type NewPost = Partial<Insertable<PostsTable>>
export type PostUpdate = Updateable<PostsTable>
export type Posts = PostType[]

export type PostColumn = Posts
export type PostColumns = Array<keyof Posts>

    type SortDirection = 'asc' | 'desc'
interface SortOptions { column: PostType, order: SortDirection }
// Define a type for the options parameter
interface QueryOptions {
  sort?: SortOptions
  limit?: number
  offset?: number
  page?: number
}

export class PostModel {
  private hidden = []
  private fillable = ['title', 'body', 'uuid', 'user_id']
  private softDeletes = false
  protected selectFromQuery: any
  protected withRelations: string[]
  protected updateFromQuery: any
  protected deleteFromQuery: any
  protected hasSelect: boolean
  public user_id: number | undefined
  public user: UserModel | undefined
  public id: number
  public title: string | undefined
  public body: string | undefined

  public created_at: Date | undefined
  public updated_at: Date | undefined

  constructor(post: Partial<PostType> | null) {
    this.user_id = post?.user_id
    this.user = post?.user
    this.id = post?.id || 1
    this.title = post?.title
    this.body = post?.body

    this.created_at = post?.created_at

    this.updated_at = post?.updated_at

    this.withRelations = []
    this.selectFromQuery = db.selectFrom('posts')
    this.updateFromQuery = db.updateTable('posts')
    this.deleteFromQuery = db.deleteFrom('posts')
    this.hasSelect = false
  }

  // Method to find a Post by ID
  async find(id: number): Promise<PostModel | undefined> {
    const query = db.selectFrom('posts').where('id', '=', id).selectAll()

    const model = await query.executeTakeFirst()

    if (!model)
      return undefined

    const result = await this.mapWith(model)

    const data = new PostModel(result as PostType)

    cache.getOrSet(`post:${id}`, JSON.stringify(model))

    return data
  }

  // Method to find a Post by ID
  static async find(id: number): Promise<PostModel | undefined> {
    const model = await db.selectFrom('posts').where('id', '=', id).selectAll().executeTakeFirst()

    if (!model)
      return undefined

    const instance = new PostModel(null)

    const result = await instance.mapWith(model)

    const data = new PostModel(result as PostType)

    cache.getOrSet(`post:${id}`, JSON.stringify(model))

    return data
  }

  async mapWith(model: PostType): Promise<PostType> {
    if (this.withRelations.includes('user')) {
      model.user = await this.userBelong()
    }

    return model
  }

  static async all(): Promise<PostModel[]> {
    const models = await db.selectFrom('posts').selectAll().execute()

    const data = await Promise.all(models.map(async (model: PostType) => {
      const instance = new PostModel(model)

      const results = await instance.mapWith(model)

      return new PostModel(results)
    }))

    return data
  }

  static async findOrFail(id: number): Promise<PostModel> {
    const model = await db.selectFrom('posts').where('id', '=', id).selectAll().executeTakeFirst()

    const instance = new PostModel(null)

    if (model === undefined)
      throw new HttpError(404, `No PostModel results for ${id}`)

    cache.getOrSet(`post:${id}`, JSON.stringify(model))

    const result = await instance.mapWith(model)

    const data = new PostModel(result as PostType)

    return data
  }

  async findOrFail(id: number): Promise<PostModel> {
    const model = await db.selectFrom('posts').where('id', '=', id).selectAll().executeTakeFirst()

    if (model === undefined)
      throw new HttpError(404, `No PostModel results for ${id}`)

    cache.getOrSet(`post:${id}`, JSON.stringify(model))

    const result = await this.mapWith(model)

    const data = new PostModel(result as PostType)

    return data
  }

  static async findMany(ids: number[]): Promise<PostModel[]> {
    let query = db.selectFrom('posts').where('id', 'in', ids)

    const instance = new PostModel(null)

    query = query.selectAll()

    const model = await query.execute()

    return model.map(modelItem => instance.parseResult(new PostModel(modelItem)))
  }

  static async get(): Promise<PostModel[]> {
    const instance = new PostModel(null)

    let models

    if (instance.hasSelect) {
      models = await instance.selectFromQuery.execute()
    }
    else {
      models = await instance.selectFromQuery.selectAll().execute()
    }

    const data = await Promise.all(models.map(async (model: PostModel) => {
      const instance = new PostModel(model)

      const results = await instance.mapWith(model)

      return new PostModel(results)
    }))

    return data
  }

  // Method to get a Post by criteria
  async get(): Promise<PostModel[]> {
    if (this.hasSelect) {
      const model = await this.selectFromQuery.execute()

      return model.map((modelItem: PostModel) => new PostModel(modelItem))
    }

    const model = await this.selectFromQuery.selectAll().execute()

    return model.map((modelItem: PostModel) => new PostModel(modelItem))
  }

  static async count(): Promise<number> {
    const instance = new PostModel(null)

    const results = await instance.selectFromQuery.selectAll().execute()

    return results.length
  }

  async count(): Promise<number> {
    if (this.hasSelect) {
      const results = await this.selectFromQuery.execute()

      return results.length
    }

    const results = await this.selectFromQuery.execute()

    return results.length
  }

  // Method to get all posts
  static async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<PostResponse> {
    const totalRecordsResult = await db.selectFrom('posts')
      .select(db.fn.count('id').as('total')) // Use 'id' or another actual column name
      .executeTakeFirst()

    const totalRecords = Number(totalRecordsResult?.total) || 0
    const totalPages = Math.ceil(totalRecords / (options.limit ?? 10))

    const postsWithExtra = await db.selectFrom('posts')
      .selectAll()
      .orderBy('id', 'asc') // Assuming 'id' is used for cursor-based pagination
      .limit((options.limit ?? 10) + 1) // Fetch one extra record
      .offset(((options.page ?? 1) - 1) * (options.limit ?? 10)) // Ensure options.page is not undefined
      .execute()

    let nextCursor = null
    if (postsWithExtra.length > (options.limit ?? 10))
      nextCursor = postsWithExtra.pop()?.id ?? null

    return {
      data: postsWithExtra,
      paging: {
        total_records: totalRecords,
        page: options.page || 1,
        total_pages: totalPages,
      },
      next_cursor: nextCursor,
    }
  }

  // Method to create a new post
  static async create(newPost: NewPost): Promise<PostModel> {
    const instance = new PostModel(null)

    const filteredValues = Object.fromEntries(
      Object.entries(newPost).filter(([key]) => instance.fillable.includes(key)),
    ) as NewPost

    const result = await db.insertInto('posts')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await find(Number(result.numInsertedOrUpdatedRows)) as PostModel

    return model
  }

  static async createMany(newPosts: NewPost[]): Promise<void> {
    const instance = new PostModel(null)

    const filteredValues = newPosts.map(newUser =>
      Object.fromEntries(
        Object.entries(newUser).filter(([key]) => instance.fillable.includes(key)),
      ) as NewPost,
    )

    await db.insertInto('posts')
      .values(filteredValues)
      .executeTakeFirst()
  }

  static async forceCreate(newPost: NewPost): Promise<PostModel> {
    const result = await db.insertInto('posts')
      .values(newPost)
      .executeTakeFirst()

    const model = await find(Number(result.numInsertedOrUpdatedRows)) as PostModel

    return model
  }

  // Method to remove a Post
  static async remove(id: number): Promise<any> {
    return await db.deleteFrom('posts')
      .where('id', '=', id)
      .execute()
  }

  where(...args: (string | number | boolean | undefined | null)[]): PostModel {
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

  orWhere(...args: Array<[string, string, any]>): PostModel {
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

  static orWhere(...args: Array<[string, string, any]>): PostModel {
    const instance = new PostModel(null)

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

  static where(...args: (string | number | boolean | undefined | null)[]): PostModel {
    let column: any
    let operator: any
    let value: any

    const instance = new PostModel(null)

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
    callback: () => void,
  ): PostModel {
    const instance = new PostModel(null)

    // Execute callback if condition is true
    if (condition) {
      callback(instance.query)
    }

    return instance
  }

  static whereNull(column: string): PostModel {
    const instance = new PostModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    instance.updateFromQuery = instance.updateFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    return instance
  }

  whereNull(column: string): PostModel {
    this.selectFromQuery = this.selectFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    this.updateFromQuery = this.updateFromQuery.where((eb: any) =>
      eb(column, '=', '').or(column, 'is', null),
    )

    return this
  }

  static whereTitle(value: string): PostModel {
    const instance = new PostModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('title', '=', value)

    return instance
  }

  static whereBody(value: string): PostModel {
    const instance = new PostModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where('body', '=', value)

    return instance
  }

  static whereIn(column: keyof PostType, values: any[]): PostModel {
    const instance = new PostModel(null)

    instance.selectFromQuery = instance.selectFromQuery.where(column, 'in', values)

    instance.updateFromQuery = instance.updateFromQuery.where(column, 'in', values)

    instance.deleteFromQuery = instance.deleteFromQuery.where(column, 'in', values)

    return instance
  }

  async first(): Promise<PostModel | undefined> {
    const model = await this.selectFromQuery.selectAll().executeTakeFirst()

    if (!model)
      return undefined

    const result = await this.mapWith(model)

    const data = new PostModel(result as PostType)

    return data
  }

  async firstOrFail(): Promise<PostModel | undefined> {
    const model = await this.selectFromQuery.executeTakeFirst()

    if (model === undefined)
      throw new HttpError(404, 'No PostModel results found for query')

    const instance = new PostModel(null)

    const result = await instance.mapWith(model)

    const data = new PostModel(result as PostType)

    return data
  }

  async exists(): Promise<boolean> {
    const model = await this.selectFromQuery.executeTakeFirst()

    return model !== null || model !== undefined
  }

  static async first(): Promise<PostType | undefined> {
    const model = await db.selectFrom('posts')
      .selectAll()
      .executeTakeFirst()

    if (!model)
      return undefined

    const instance = new PostModel(null)

    const result = await instance.mapWith(model)

    const data = new PostModel(result as PostType)

    return data
  }

  with(relations: string[]): PostModel {
    this.withRelations = relations

    return this
  }

  static with(relations: string[]): PostModel {
    const instance = new PostModel(null)

    instance.withRelations = relations

    return instance
  }

  async last(): Promise<PostType | undefined> {
    return await db.selectFrom('posts')
      .selectAll()
      .orderBy('id', 'desc')
      .executeTakeFirst()
  }

  static async last(): Promise<PostType | undefined> {
    const model = await db.selectFrom('posts').selectAll().orderBy('id', 'desc').executeTakeFirst()

    if (!model)
      return undefined

    const instance = new PostModel(null)

    const result = await instance.mapWith(model)

    const data = new PostModel(result as PostType)

    return data
  }

  static orderBy(column: keyof PostType, order: 'asc' | 'desc'): PostModel {
    const instance = new PostModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, order)

    return instance
  }

  orderBy(column: keyof PostType, order: 'asc' | 'desc'): PostModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, order)

    return this
  }

  static orderByDesc(column: keyof PostType): PostModel {
    const instance = new PostModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, 'desc')

    return instance
  }

  orderByDesc(column: keyof PostType): PostModel {
    this.selectFromQuery = this.orderBy(column, 'desc')

    return this
  }

  static orderByAsc(column: keyof PostType): PostModel {
    const instance = new PostModel(null)

    instance.selectFromQuery = instance.selectFromQuery.orderBy(column, 'asc')

    return instance
  }

  orderByAsc(column: keyof PostType): PostModel {
    this.selectFromQuery = this.selectFromQuery.orderBy(column, 'desc')

    return this
  }

  async update(post: PostUpdate): Promise<PostModel | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(post).filter(([key]) => this.fillable.includes(key)),
    ) as NewPost

    if (this.id === undefined) {
      this.updateFromQuery.set(filteredValues).execute()
    }

    await db.updateTable('posts')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    const model = await this.find(this.id)

    return model
  }

  async forceUpdate(post: PostUpdate): Promise<PostModel | undefined> {
    if (this.id === undefined) {
      this.updateFromQuery.set(post).execute()
    }

    await db.updateTable('posts')
      .set(post)
      .where('id', '=', this.id)
      .executeTakeFirst()

    const model = await this.find(this.id)

    return model
  }

  async save(): Promise<void> {
    if (!this)
      throw new HttpError(500, 'Post data is undefined')

    if (this.id === undefined) {
      await db.insertInto('posts')
        .values(this as NewPost)
        .executeTakeFirstOrThrow()
    }
    else {
      await this.update(this)
    }
  }

  // Method to delete (soft delete) the post instance
  async delete(): Promise<any> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()

    return await db.deleteFrom('posts')
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

  distinct(column: keyof PostType): PostModel {
    this.selectFromQuery = this.selectFromQuery.select(column).distinct()

    this.hasSelect = true

    return this
  }

  static distinct(column: keyof PostType): PostModel {
    const instance = new PostModel(null)

    instance.selectFromQuery = instance.selectFromQuery.select(column).distinct()

    instance.hasSelect = true

    return instance
  }

  join(table: string, firstCol: string, secondCol: string): PostModel {
    this.selectFromQuery = this.selectFromQuery(table, firstCol, secondCol)

    return this
  }

  static join(table: string, firstCol: string, secondCol: string): PostModel {
    const instance = new PostModel(null)

    instance.selectFromQuery = instance.selectFromQuery.innerJoin(table, firstCol, secondCol)

    return instance
  }

  static async rawQuery(rawQuery: string): Promise<any> {
    return await sql`${rawQuery}`.execute(db)
  }

  toJSON() {
    const output: Partial<PostType> = {
      user_id: this.user_id,
      user: this.user,

      id: this.id,
      title: this.title,
      body: this.body,

      created_at: this.created_at,

      updated_at: this.updated_at,

    }

        type Post = Omit<PostType, 'password'>

        return output as Post
  }

  parseResult(model: PostModel): PostModel {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof PostModel]
    }

    return model
  }
}

async function find(id: number): Promise<PostModel | undefined> {
  const query = db.selectFrom('posts').where('id', '=', id).selectAll()

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
  const result = await db.insertInto('posts')
    .values(newPost)
    .executeTakeFirstOrThrow()

  return await find(Number(result.numInsertedOrUpdatedRows)) as PostModel
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql`${rawQuery}`.execute(db)
}

export async function remove(id: number): Promise<void> {
  await db.deleteFrom('posts')
    .where('id', '=', id)
    .execute()
}

export async function whereTitle(value: string): Promise<PostModel[]> {
  const query = db.selectFrom('posts').where('title', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new PostModel(modelItem))
}

export async function whereBody(value: string): Promise<PostModel[]> {
  const query = db.selectFrom('posts').where('body', '=', value)
  const results = await query.execute()

  return results.map(modelItem => new PostModel(modelItem))
}

export const Post = PostModel

export default Post
