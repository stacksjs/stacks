import { generateTwoFactorSecret } from '@stacksjs/auth'
import { db } from '@stacksjs/database'
import type { ColumnType, Generated, Insertable, Selectable, Updateable } from 'kysely'
import User from './User'

// import { Kysely, MysqlDialect, PostgresDialect } from 'kysely'
// import { Pool } from 'pg'

// TODO: we need an action that auto-generates these table interfaces
export interface PostsTable {
  id: Generated<number>
  title: string
  body: string
  user_id: number

  created_at: ColumnType<Date, string | undefined, never>
  updated_at: ColumnType<Date, string | undefined, never>
  deleted_at: ColumnType<Date, string | undefined, never>
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
interface SortOptions {
  column: PostType
  order: SortDirection
}
// Define a type for the options parameter
interface QueryOptions {
  sort?: SortOptions
  limit?: number
  offset?: number
  page?: number
}

export class PostModel {
  private post: Partial<PostType> | null
  private results: Partial<PostType>[]
  private hidden = ['password'] // TODO: this hidden functionality needs to be implemented still
  protected query: any
  protected hasSelect: boolean
  public id: number | undefined
  public title: string | undefined
  public body: string | undefined
  public user_id: number | undefined

  constructor(post: Partial<PostType> | null) {
    this.post = post
    this.id = post?.id
    this.title = post?.title
    this.body = post?.body
    this.user_id = post?.user_id

    this.query = db.selectFrom('posts')
    this.hasSelect = false
  }

  // Method to find a Post by ID
  async find(id: number, fields?: (keyof PostType)[]): Promise<PostModel | null> {
    let query = db.selectFrom('posts').where('id', '=', id)

    if (fields) query = query.select(fields)
    else query = query.selectAll()

    const model = await query.executeTakeFirst()

    if (!model) return null

    return this
  }

  // Method to find a Post by ID
  static async find(id: number, fields?: (keyof PostType)[]): Promise<PostModel | null> {
    let query = db.selectFrom('posts').where('id', '=', id)

    if (fields) query = query.select(fields)
    else query = query.selectAll()

    const model = await query.executeTakeFirst()

    if (!model) return null

    return new this(model)
  }

  static async findOrFail(id: number, fields?: (keyof PostType)[]): Promise<PostModel> {
    let query = db.selectFrom('posts').where('id', '=', id)

    if (fields) query = query.select(fields)
    else query = query.selectAll()

    const model = await query.executeTakeFirst()

    if (!model) throw `No model results found for ${id} `

    return new this(model)
  }

  static async findMany(ids: number[], fields?: (keyof PostType)[]): Promise<PostModel[]> {
    let query = db.selectFrom('posts').where('id', 'in', ids)

    if (fields) query = query.select(fields)
    else query = query.selectAll()

    const model = await query.execute()

    return model.map((modelItem) => new PostModel(modelItem))
  }

  // Method to get a Post by criteria
  static async fetch(criteria: Partial<PostType>, options: QueryOptions = {}): Promise<PostModel[]> {
    let query = db.selectFrom('posts')

    // Apply sorting from options
    if (options.sort) query = query.orderBy(options.sort.column, options.sort.order)

    // Apply limit and offset from options
    if (options.limit !== undefined) query = query.limit(options.limit)

    if (options.offset !== undefined) query = query.offset(options.offset)

    const model = await query.selectAll().execute()
    return model.map((modelItem) => new PostModel(modelItem))
  }

  // Method to get a Post by criteria
  static async get(): Promise<PostModel[]> {
    const query = db.selectFrom('posts')

    const model = await query.selectAll().execute()

    return model.map((modelItem) => new PostModel(modelItem))
  }

  // Method to get a Post by criteria
  async get(): Promise<PostModel[]> {
    if (this.hasSelect) {
      const model = await this.query.execute()

      return model.map((modelItem: PostModel) => new PostModel(modelItem))
    }

    const model = await this.query.selectAll().execute()

    return model.map((modelItem: PostModel) => new PostModel(modelItem))
  }

  static async count(): Promise<number> {
    const instance = new this(null)

    const results = await instance.query.selectAll().execute()

    return results.length
  }

  async count(): Promise<number> {
    if (this.hasSelect) {
      const results = await this.query.execute()

      return results.length
    }

    const results = await this.query.selectAll().execute()

    return results.length
  }

  // Method to get all posts
  static async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<PostResponse> {
    const totalRecordsResult = await db
      .selectFrom('posts')
      .select(db.fn.count('id').as('total')) // Use 'id' or another actual column name
      .executeTakeFirst()

    const totalRecords = Number(totalRecordsResult?.total) || 0
    const totalPages = Math.ceil(totalRecords / (options.limit ?? 10))

    const postsWithExtra = await db
      .selectFrom('posts')
      .selectAll()
      .orderBy('id', 'asc') // Assuming 'id' is used for cursor-based pagination
      .limit((options.limit ?? 10) + 1) // Fetch one extra record
      .offset((options.page - 1) * (options.limit ?? 10))
      .execute()

    let nextCursor = null
    if (postsWithExtra.length > (options.limit ?? 10)) nextCursor = postsWithExtra.pop()!.id // Use the ID of the extra record as the next cursor

    return {
      data: postsWithExtra,
      paging: {
        total_records: totalRecords,
        page: options.page,
        total_pages: totalPages,
      },
      next_cursor: nextCursor,
    }
  }

  // Method to create a new post
  static async create(newPost: NewPost): Promise<PostModel> {
    const result = await db.insertInto('posts').values(newPost).executeTakeFirstOrThrow()

    return (await find(Number(result.insertId))) as PostModel
  }

  // Method to remove a Post
  static async remove(id: number): Promise<void> {
    await db.deleteFrom('posts').where('id', '=', id).execute()
  }

  where(...args: (string | number | boolean | undefined | null)[]): PostModel {
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

  static where(...args: (string | number | boolean | undefined | null)[]): PostModel {
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

  static whereTitle(value: string | number | boolean | undefined | null): PostModel {
    const instance = new this(null)

    instance.query = instance.query.where('title', '=', value)

    return instance
  }

  static whereBody(value: string | number | boolean | undefined | null): PostModel {
    const instance = new this(null)

    instance.query = instance.query.where('body', '=', value)

    return instance
  }

  static whereIn(column: keyof PostType, values: any[]): PostModel {
    const instance = new this(null)

    instance.query = instance.query.where(column, 'in', values)

    return instance
  }

  async first(): Promise<PostModel | undefined> {
    const model = await this.query.selectAll().executeTakeFirst()

    return new PostModel(model)
  }

  async exists(): Promise<boolean> {
    const model = await this.query.selectAll().executeTakeFirst()

    return model !== null || model !== undefined
  }

  static async first(): Promise<PostType | undefined> {
    return await db.selectFrom('posts').selectAll().executeTakeFirst()
  }

  async last(): Promise<PostType | undefined> {
    return await db.selectFrom('posts').selectAll().orderBy('id', 'desc').executeTakeFirst()
  }

  static orderBy(column: keyof PostType, order: 'asc' | 'desc'): PostModel {
    const instance = new this(null)

    instance.query = instance.orderBy(column, order)

    return instance
  }

  orderBy(column: keyof PostType, order: 'asc' | 'desc'): PostModel {
    this.query = this.query.orderBy(column, order)

    return this
  }

  static orderByDesc(column: keyof PostType): PostModel {
    const instance = new this(null)

    instance.query = instance.query.orderBy(column, 'desc')

    return instance
  }

  orderByDesc(column: keyof PostType): PostModel {
    this.query = this.orderBy(column, 'desc')

    return this
  }

  static orderByAsc(column: keyof PostType): PostModel {
    const instance = new this(null)

    instance.query = instance.query.orderBy(column, 'desc')

    return instance
  }

  orderByAsc(column: keyof PostType): PostModel {
    this.query = this.query.orderBy(column, 'desc')

    return this
  }

  // Method to update the posts instance
  async update(post: PostUpdate): Promise<PostModel | null> {
    if (this.id === undefined) throw new Error('Post ID is undefined')

    await db.updateTable('posts').set(post).where('id', '=', this.id).executeTakeFirst()

    return await this.find(Number(this.id))
  }

  // Method to save (insert or update) the post instance
  async save(): Promise<void> {
    if (!this.post) throw new Error('Post data is undefined')

    if (this.post.id === undefined) {
      // Insert new post
      const newModel = await db
        .insertInto('posts')
        .values(this.post as NewPost)
        .executeTakeFirstOrThrow()
    } else {
      // Update existing post
      await this.update(this.post)
    }
  }

  // Method to delete the post instance
  async delete(): Promise<void> {
    if (this.id === undefined) throw new Error('Post ID is undefined')

    await db.deleteFrom('posts').where('id', '=', this.id).execute()
  }

  async user() {
    if (this.post_id === undefined) throw new Error('Relation Error!')

    const model = await User.where('id', '=', post_id).first()

    if (!model) throw new Error('Model Relation Not Found!')

    return model
  }

  distinct(column: keyof PostType): PostModel {
    this.query = this.query.distinctOn(column)

    return this
  }

  static distinct(column: keyof PostType): PostModel {
    const instance = new this(null)

    instance.query = instance.query.distinctOn(column)

    return instance
  }

  join(table: string, firstCol: string, secondCol: string): PostModel {
    this.query = this.query.innerJoin(table, firstCol, secondCol)

    return this
  }

  static join(table: string, firstCol: string, secondCol: string): PostModel {
    const instance = new this(null)

    instance.query = instance.query.innerJoin(table, firstCol, secondCol)

    return instance
  }

  toJSON() {
    const output: Partial<PostType> = { ...this.post }

    this.hidden.forEach((attr) => {
      if (attr in output) delete output[attr as keyof Partial<PostType>]
    })

    type Post = Omit<PostType, 'password'>

    return output as Post
  }
}

async function find(id: number, fields?: (keyof PostType)[]): Promise<PostModel | null> {
  let query = db.selectFrom('posts').where('id', '=', id)

  if (fields) query = query.select(fields)
  else query = query.selectAll()

  const model = await query.executeTakeFirst()

  if (!model) return null

  return new PostModel(model)
}

export async function count(): Promise<number> {
  const results = await PostModel.count()

  return results
}

export async function create(newPost: NewPost): Promise<PostModel> {
  const result = await db.insertInto('posts').values(newPost).executeTakeFirstOrThrow()

  return (await find(Number(result.insertId))) as PostModel
}

async function remove(id: number): Promise<void> {
  await db.deleteFrom('posts').where('id', '=', id).execute()
}

export async function whereTitle(value: string | number | boolean | undefined | null): Promise<PostModel[]> {
  const query = db.selectFrom('posts').where('title', '=', value)

  const results = await query.execute()

  return results.map((modelItem) => new PostModel(modelItem))
}

export async function whereBody(value: string | number | boolean | undefined | null): Promise<PostModel[]> {
  const query = db.selectFrom('posts').where('body', '=', value)

  const results = await query.execute()

  return results.map((modelItem) => new PostModel(modelItem))
}

const Post = PostModel

export default Post
