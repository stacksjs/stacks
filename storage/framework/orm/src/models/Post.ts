import { db } from '@stacksjs/database'
import type { Result } from '@stacksjs/error-handling'
import { err, handleError, ok } from '@stacksjs/error-handling'
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
  private post: Partial<PostType>
  private results: Partial<PostType>[]
  private hidden = ['password'] // TODO: this hidden functionality needs to be implemented still

  constructor(post: Partial<PostType>) {
    this.post = post
  }

  // Method to find a post by ID
  static async find(id: number, fields?: (keyof PostType)[]): Promise<PostModel> {
    let query = db.selectFrom('posts').where('id', '=', id)

    if (fields) query = query.select(fields)
    else query = query.selectAll()

    const model = await query.executeTakeFirst()

    if (!model) return null

    return new PostModel(model)
  }

  static async findOrFail(id: number, fields?: (keyof PostType)[]): Promise<PostModel> {
    let query = db.selectFrom('posts').where('id', '=', id)

    if (fields) query = query.select(fields)
    else query = query.selectAll()

    const model = await query.executeTakeFirst()

    if (!model) throw `No model results found for ${id} `

    return new PostModel(model)
  }

  static async findMany(ids: number[], fields?: (keyof PostType)[]): Promise<PostModel[]> {
    let query = db.selectFrom('posts').where('id', 'in', ids)

    if (fields) query = query.select(fields)
    else query = query.selectAll()

    const model = await query.execute()

    return model.map((modelItem) => new PostModel(modelItem))
  }

  // Method to get a post by criteria
  static async get(criteria: Partial<PostType>, options: QueryOptions = {}): Promise<PostModel[]> {
    let query = db.selectFrom('posts')

    // Apply sorting from options
    if (options.sort) query = query.orderBy(options.sort.column, options.sort.order)

    // Apply limit and offset from options
    if (options.limit !== undefined) query = query.limit(options.limit)

    if (options.offset !== undefined) query = query.offset(options.offset)

    const model = await query.selectAll().execute()
    return model.map((modelItem) => new PostModel(modelItem))
  }

  // Method to get all posts
  static async all(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<PostResponse> {
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

  // Method to remove a post
  static async remove(id: number): Promise<PostModel> {
    const model = await db.deleteFrom('posts').where('id', '=', id).executeTakeFirstOrThrow()

    return new PostModel(model)
  }

  async where(...args: (string | number)[]): Promise<PostType[]> {
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

    let query = db.selectFrom('posts')

    query = query.where(column, operator, value)

    return await query.selectAll().execute()
  }

  async whereIs(criteria: Partial<PostType>, options: QueryOptions = {}) {
    let query = db.selectFrom('posts')

    // Existing criteria checks
    if (criteria.id) query = query.where('id', '=', criteria.id) // Kysely is immutable, we must re-assign

    if (criteria.email) query = query.where('email', '=', criteria.email)

    if (criteria.name !== undefined) {
      query = query.where('name', criteria.name === null ? 'is' : '=', criteria.name)
    }

    if (criteria.password) query = query.where('password', '=', criteria.password)

    if (criteria.created_at) query = query.where('created_at', '=', criteria.created_at)

    if (criteria.updated_at) query = query.where('updated_at', '=', criteria.updated_at)

    if (criteria.deleted_at) query = query.where('deleted_at', '=', criteria.deleted_at)

    // Apply sorting from options
    if (options.sort) query = query.orderBy(options.sort.column, options.sort.order)

    // Apply pagination from options
    if (options.limit !== undefined) query = query.limit(options.limit)

    if (options.offset !== undefined) query = query.offset(options.offset)

    return await query.selectAll().execute()
  }

  async whereIn(column: keyof PostType, values: any[], options: QueryOptions = {}): Promise<PostType[]> {
    let query = db.selectFrom('posts')

    query = query.where(column, 'in', values)

    // Apply sorting from options
    if (options.sort) query = query.orderBy(options.sort.column, options.sort.order)

    // Apply pagination from options
    if (options.limit !== undefined) query = query.limit(options.limit)

    if (options.offset !== undefined) query = query.offset(options.offset)

    return await query.selectAll().execute()
  }

  async first(): Promise<PostType> {
    return await db.selectFrom('posts').selectAll().executeTakeFirst()
  }

  async last(): Promise<PostType> {
    return await db.selectFrom('posts').selectAll().orderBy('id', 'desc').executeTakeFirst()
  }

  async orderBy(column: keyof PostType, order: 'asc' | 'desc'): Promise<PostType[]> {
    return await db.selectFrom('posts').selectAll().orderBy(column, order).execute()
  }

  async orderByDesc(column: keyof PostType): Promise<PostType[]> {
    return await db.selectFrom('posts').selectAll().orderBy(column, 'desc').execute()
  }

  async orderByAsc(column: keyof PostType): Promise<PostType[]> {
    return await db.selectFrom('posts').selectAll().orderBy(column, 'asc').execute()
  }

  // Method to get the post instance itself
  self(): PostModel {
    return this
  }

  // Method to get the post instance data
  get() {
    return this.post
  }

  // Method to update the post instance
  async update(post: PostUpdate): Promise<Result<PostType, Error>> {
    if (this.post.id === undefined) return err(handleError('Post ID is undefined'))

    const updatedModel = await db.updateTable('posts').set(post).where('id', '=', this.post.id).executeTakeFirst()

    if (!updatedModel) return err(handleError('Post not found'))

    return ok(updatedModel)
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
    if (this.post.id === undefined) throw new Error('Post ID is undefined')

    await db.deleteFrom('posts').where('id', '=', this.post.id).execute()

    this.post = {}
  }

  // Method to refresh the post instance data from the database
  async refresh(): Promise<void> {
    if (this.post.id === undefined) throw new Error('Post ID is undefined')

    const refreshedModel = await db.selectFrom('posts').where('id', '=', this.post.id).selectAll().executeTakeFirst()

    if (!refreshedModel) throw new Error('Post not found')

    this.post = refreshedModel
  }

  async user() {
    if (this.post_id === undefined) throw new Error('Relation Error!')

    const model = await db.selectFrom('users').where('id', '=', post_id).selectAll().executeTakeFirst()

    if (!model) throw new Error('Model Relation Not Found!')

    return new User.modelInstance(model)
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

const Model = PostModel

// starting here, ORM functions
export async function find(id: number, fields?: (keyof PostType)[]) {
  let query = db.selectFrom('posts').where('id', '=', id)

  if (fields) query = query.select(fields)
  else query = query.selectAll()

  const model = await query.executeTakeFirst()

  if (!model) return null

  return new PostModel(model)
}

export async function findOrFail(id: number, fields?: (keyof PostType)[]) {
  let query = db.selectFrom('posts').where('id', '=', id)

  if (fields) query = query.select(fields)
  else query = query.selectAll()

  const model = await query.executeTakeFirst()

  if (!model) throw `No model results found for ${id} `

  return new PostModel(model)
}

export async function findMany(ids: number[], fields?: (keyof PostType)[]) {
  let query = db.selectFrom('posts').where('id', 'in', ids)

  if (fields) query = query.select(fields)
  else query = query.selectAll()

  const model = await query.execute()

  return model.map((modelItem) => new PostModel(modelItem))
}

export async function count(): Number {
  const results = await db.selectFrom('posts').selectAll().execute()

  return results.length
}

export async function get(
  criteria: Partial<PostType>,
  sort: { column: keyof PostType; order: 'asc' | 'desc' } = { column: 'created_at', order: 'desc' },
) {
  let query = db.selectFrom('posts')

  if (criteria.id) query = query.where('id', '=', criteria.id) // Kysely is immutable, we must re-assign

  if (criteria.email) query = query.where('email', '=', criteria.email)

  if (criteria.name !== undefined) {
    query = query.where('name', criteria.name === null ? 'is' : '=', criteria.name)
  }

  if (criteria.password) query = query.where('password', '=', criteria.password)

  if (criteria.created_at) query = query.where('created_at', '=', criteria.created_at)

  if (criteria.updated_at) query = query.where('updated_at', '=', criteria.updated_at)

  if (criteria.deleted_at) query = query.where('deleted_at', '=', criteria.deleted_at)

  // Apply sorting based on the 'sort' parameter
  query = query.orderBy(sort.column, sort.order)

  return await query.selectAll().execute()
}

export async function all(limit = 10, offset = 0): Promise<PostType[]> {
  return await db.selectFrom('posts').selectAll().orderBy('created_at', 'desc').limit(limit).offset(offset).execute()
}

export async function create(newPost: NewPost): Promise<PostModel> {
  const result = await db.insertInto('posts').values(newPost).executeTakeFirstOrThrow()

  return await find(Number(result.insertId))
}

export async function first(): Promise<PostModel> {
  return await db.selectFrom('posts').selectAll().executeTakeFirst()
}

export async function recent(limit: number): Promise<PostModel[]> {
  return await db.selectFrom('posts').selectAll().limit(limit).execute()
}

export async function last(limit: number): Promise<PostType> {
  return await db.selectFrom('posts').selectAll().orderBy('id', 'desc').limit(limit).execute()
}

export async function update(id: number, postUpdate: PostUpdate) {
  return await db.updateTable('posts').set(postUpdate).where('id', '=', id).execute()
}

export async function remove(id: number) {
  return await db.deleteFrom('posts').where('id', '=', id).executeTakeFirst()
}

export async function where(...args: (string | number)[]) {
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

  let query = db.selectFrom('posts')

  query = query.where(column, operator, value)

  return await query.selectAll().execute()
}

export async function whereIs(criteria: Partial<PostType>, options: QueryOptions = {}) {
  let query = db.selectFrom('posts')

  // Apply criteria
  if (criteria.id) query = query.where('id', '=', criteria.id)

  if (criteria.email) query = query.where('email', '=', criteria.email)

  if (criteria.name !== undefined) {
    query = query.where('name', criteria.name === null ? 'is' : '=', criteria.name)
  }

  if (criteria.password) query = query.where('password', '=', criteria.password)

  if (criteria.created_at) query = query.where('created_at', '=', criteria.created_at)

  if (criteria.updated_at) query = query.where('updated_at', '=', criteria.updated_at)

  if (criteria.deleted_at) query = query.where('deleted_at', '=', criteria.deleted_at)

  // Apply sorting from options
  if (options.sort) query = query.orderBy(options.sort.column, options.sort.order)

  // Apply pagination from options
  if (options.limit !== undefined) query = query.limit(options.limit)

  if (options.offset !== undefined) query = query.offset(options.offset)

  return await query.selectAll().execute()
}

export async function whereIn(column: keyof PostType, values: any[], options: QueryOptions = {}) {
  let query = db.selectFrom('posts')

  query = query.where(column, 'in', values)

  // Apply sorting from options
  if (options.sort) query = query.orderBy(options.sort.column, options.sort.order)

  // Apply pagination from options
  if (options.limit !== undefined) query = query.limit(options.limit)

  if (options.offset !== undefined) query = query.offset(options.offset)

  return await query.selectAll().execute()
}

export const Post = {
  find,
  findOrFail,
  findMany,
  get,
  count,
  all,
  create,
  update,
  remove,
  Model,
  first,
  last,
  recent,
  where,
  whereIn,
  model: PostModel,
}

export default Post
