import type { Generated, Insertable, Selectable, Updateable } from 'kysely'
import { cache } from '@stacksjs/cache'
import { db, sql } from '@stacksjs/database'
import { HttpError } from '@stacksjs/error-handling'
import User from './User'

// import { Kysely, MysqlDialect, PostgresDialect } from 'kysely'
// import { Pool } from 'pg'

export interface PostsTable {
  id: Generated<number>
  title?: string
  body?: string
  user_id?: number

  created_at?: Date

  updated_at?: Date

  deleted_at?: Date

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
export type NewPost = Insertable<PostsTable>
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
  private fillable = ['stripe_id', 'public_key', 'two_factor_secret']
  private softDeletes = false
  protected query: any
  protected hasSelect: boolean
  public id: number | undefined
  public title: string | undefined
  public body: string | undefined

  public created_at: Date | undefined
  public updated_at: Date | undefined
  public user_id: number | undefined

  constructor(post: Partial<PostType> | null) {
    this.id = post?.id
    this.title = post?.title
    this.body = post?.body

    this.created_at = post?.created_at

    this.updated_at = post?.updated_at

    this.user_id = post?.user_id

    this.query = db.selectFrom('posts')
    this.hasSelect = false
  }

  // Method to find a Post by ID
  async find(id: number): Promise<PostModel | undefined> {
    const query = db.selectFrom('posts').where('id', '=', id).selectAll()

    const model = await query.executeTakeFirst()

    if (!model)
      return undefined

    cache.getOrSet(`post:${id}`, JSON.stringify(model))

    return this.parseResult(new PostModel(model))
  }

  // Method to find a Post by ID
  static async find(id: number): Promise<PostModel | undefined> {
    const query = db.selectFrom('posts').where('id', '=', id).selectAll()

    const instance = new PostModel(null)

    const model = await query.executeTakeFirst()

    if (!model)
      return undefined

    cache.getOrSet(`post:${id}`, JSON.stringify(model))

    return instance.parseResult(new PostModel(model))
  }

  static async all(): Promise<PostModel[]> {
    let query = db.selectFrom('posts').selectAll()

    const instance = new PostModel(null)

    if (instance.softDeletes) {
      query = query.where('deleted_at', 'is', null)
    }

    const results = await query.execute()

    return results.map(modelItem => instance.parseResult(new PostModel(modelItem)))
  }

  static async findOrFail(id: number): Promise<PostModel> {
    let query = db.selectFrom('posts').where('id', '=', id)

    const instance = new PostModel(null)

    if (instance.softDeletes) {
      query = query.where('deleted_at', 'is', null)
    }

    query = query.selectAll()

    const model = await query.executeTakeFirst()

    if (model === undefined)
      throw new HttpError(404, `No PostModel results for ${id}`)

    cache.getOrSet(`post:${id}`, JSON.stringify(model))

    return instance.parseResult(new PostModel(model))
  }

  static async findMany(ids: number[]): Promise<PostModel[]> {
    let query = db.selectFrom('posts').where('id', 'in', ids)

    const instance = new PostModel(null)

    if (instance.softDeletes) {
      query = query.where('deleted_at', 'is', null)
    }

    query = query.selectAll()

    const model = await query.execute()

    return model.map(modelItem => instance.parseResult(new PostModel(modelItem)))
  }

  // Method to get a User by criteria
  static async get(): Promise<PostModel[]> {
    const instance = new PostModel(null)

    if (instance.hasSelect) {
      if (instance.softDeletes) {
        instance.query = instance.query.where('deleted_at', 'is', null)
      }

      const model = await instance.query.execute()

      return model.map((modelItem: PostModel) => new PostModel(modelItem))
    }

    if (instance.softDeletes) {
      instance.query = instance.query.where('deleted_at', 'is', null)
    }

    const model = await instance.query.selectAll().execute()

    return model.map((modelItem: PostModel) => new PostModel(modelItem))
  }

  // Method to get a Post by criteria
  async get(): Promise<PostModel[]> {
    if (this.hasSelect) {
      if (this.softDeletes) {
        this.query = this.query.where('deleted_at', 'is', null)
      }

      const model = await this.query.execute()

      return model.map((modelItem: PostModel) => new PostModel(modelItem))
    }

    if (this.softDeletes) {
      this.query = this.query.where('deleted_at', 'is', null)
    }

    const model = await this.query.selectAll().execute()

    return model.map((modelItem: PostModel) => new PostModel(modelItem))
  }

  static async count(): Promise<number> {
    const instance = new PostModel(null)

    if (instance.softDeletes) {
      instance.query = instance.query.where('deleted_at', 'is', null)
    }

    const results = await instance.query.selectAll().execute()

    return results.length
  }

  async count(): Promise<number> {
    if (this.hasSelect) {
      if (this.softDeletes) {
        this.query = this.query.where('deleted_at', 'is', null)
      }

      const results = await this.query.execute()

      return results.length
    }

    const results = await this.query.selectAll().execute()

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

    const model = await find(Number(result.insertId)) as PostModel

    return model
  }

  static async forceCreate(newPost: NewPost): Promise<PostModel> {
    const result = await db.insertInto('posts')
      .values(newPost)
      .executeTakeFirst()

    const model = await find(Number(result.insertId)) as PostModel

    return model
  }

  // Method to remove a Post
  static async remove(id: number): Promise<void> {
    const instance = new PostModel(null)

    if (instance.softDeletes) {
      await db.updateTable('posts')
        .set({
          deleted_at: sql.raw('CURRENT_TIMESTAMP'),
        })
        .where('id', '=', id)
        .execute()
    }
    else {
      await db.deleteFrom('posts')
        .where('id', '=', id)
        .execute()
    }
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

    this.query = this.query.where(column, operator, value)

    return this
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

    instance.query = instance.query.where(column, operator, value)

    return instance
  }

  static whereTitle(value: string): PostModel {
    const instance = new PostModel(null)

    instance.query = instance.query.where('title', '=', value)

    return instance
  }

  static whereBody(value: string): PostModel {
    const instance = new PostModel(null)

    instance.query = instance.query.where('body', '=', value)

    return instance
  }

  static whereIn(column: keyof PostType, values: any[]): PostModel {
    const instance = new PostModel(null)

    instance.query = instance.query.where(column, 'in', values)

    return instance
  }

  async first(): Promise<PostModel | undefined> {
    const model = await this.query.selectAll().executeTakeFirst()

    if (!model) {
      return undefined
    }

    return this.parseResult(new PostModel(model))
  }

  async firstOrFail(): Promise<PostModel | undefined> {
    const model = await this.query.selectAll().executeTakeFirst()

    if (model === undefined)
      throw new HttpError(404, 'No PostModel results found for query')

    return this.parseResult(new PostModel(model))
  }

  async exists(): Promise<boolean> {
    const model = await this.query.selectAll().executeTakeFirst()

    return model !== null || model !== undefined
  }

  static async first(): Promise<PostType | undefined> {
    return await db.selectFrom('posts')
      .selectAll()
      .executeTakeFirst()
  }

  async last(): Promise<PostType | undefined> {
    return await db.selectFrom('posts')
      .selectAll()
      .orderBy('id', 'desc')
      .executeTakeFirst()
  }

  static async last(): Promise<PostType | undefined> {
    return await db.selectFrom('posts').selectAll().orderBy('id', 'desc').executeTakeFirst()
  }

  static orderBy(column: keyof PostType, order: 'asc' | 'desc'): PostModel {
    const instance = new PostModel(null)

    instance.query = instance.query.orderBy(column, order)

    return instance
  }

  orderBy(column: keyof PostType, order: 'asc' | 'desc'): PostModel {
    this.query = this.query.orderBy(column, order)

    return this
  }

  static orderByDesc(column: keyof PostType): PostModel {
    const instance = new PostModel(null)

    instance.query = instance.query.orderBy(column, 'desc')

    return instance
  }

  orderByDesc(column: keyof PostType): PostModel {
    this.query = this.orderBy(column, 'desc')

    return this
  }

  static orderByAsc(column: keyof PostType): PostModel {
    const instance = new PostModel(null)

    instance.query = instance.query.orderBy(column, 'asc')

    return instance
  }

  orderByAsc(column: keyof PostType): PostModel {
    this.query = this.query.orderBy(column, 'desc')

    return this
  }

  async update(post: PostUpdate): Promise<PostModel | undefined> {
    if (this.id === undefined)
      throw new HttpError(500, 'Post ID is undefined')

    const filteredValues = Object.fromEntries(
      Object.entries(post).filter(([key]) => this.fillable.includes(key)),
    ) as NewPost

    await db.updateTable('posts')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    const model = await this.find(Number(this.id))

    return model
  }

  async forceUpdate(post: PostUpdate): Promise<PostModel | undefined> {
    if (this.id === undefined)
      throw new HttpError(500, 'Post ID is undefined')

    await db.updateTable('posts')
      .set(post)
      .where('id', '=', this.id)
      .executeTakeFirst()

    const model = await this.find(Number(this.id))

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
  async delete(): Promise<void> {
    if (this.id === undefined)
      throw new HttpError(500, 'Post ID is undefined')

    // Check if soft deletes are enabled
    if (this.softDeletes) {
      // Update the deleted_at column with the current timestamp
      await db.updateTable('posts')
        .set({
          deleted_at: sql.raw('CURRENT_TIMESTAMP'),
        })
        .where('id', '=', this.id)
        .execute()
    }
    else {
      // Perform a hard delete
      await db.deleteFrom('posts')
        .where('id', '=', this.id)
        .execute()
    }
  }

  async user() {
    if (this.post_id === undefined)
      throw new HttpError(500, 'Relation Error!')

    const model = await User
      .where('id', '=', post_id)
      .first()

    if (!model)
      throw new HttpError(500, 'Model Relation Not Found!')

    return model
  }

  distinct(column: keyof PostType): PostModel {
    this.query = this.query.select(column).distinct()

    this.hasSelect = true

    return this
  }

  static distinct(column: keyof PostType): PostModel {
    const instance = new PostModel(null)

    instance.query = instance.query.select(column).distinct()

    instance.hasSelect = true

    return instance
  }

  join(table: string, firstCol: string, secondCol: string): PostModel {
    this.query = this.query.innerJoin(table, firstCol, secondCol)

    return this
  }

  static join(table: string, firstCol: string, secondCol: string): PostModel {
    const instance = new PostModel(null)

    instance.query = instance.query.innerJoin(table, firstCol, secondCol)

    return instance
  }

  static async rawQuery(rawQuery: string): Promise<any> {
    return await sql`${rawQuery}`.execute(db)
  }

  toJSON() {
    const output: Partial<PostType> = {

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

  return await find(Number(result.insertId)) as PostModel
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
