import { db } from '@stacksjs/database'

export interface User {
  id: number

  name: string
  email: string

  password: string

  created_at: Date
}

export class UserModel {
  private _data: User | undefined = undefined

  private _isSelectInvoked = false
  public _id: number | undefined = undefined
  private cols: string[] = []

  queryBuilder = db.selectFrom('users')// Initialize queryBuilder
  queryBuilderStore = db.insertInto('users')// Initialize queryBuilder
  queryBuilderUpdate = db.updateTable('users')// Initialize queryBuilder
  queryBuilderDelete = db.deleteFrom('users')// Initialize queryBuilder

  public async find(id: number): Promise<User> {
    this._data = await this.queryBuilder.selectAll()
      .where('id', '=', id)
      .executeTakeFirst()

    if (this._data === undefined)
      throw new Error('User not found!')

    return this._createProxy()
  }

  private _createProxy(): User & { [key: string]: Function } {
    return new Proxy(this._data || {}, {
      get: (target, prop: keyof User | string): any => {
        // Property lookup in the User data
        if (prop in target)
          return target[prop as keyof User]

        // If it's a method on the UserModel, bind it
        const method = this[prop as keyof this]
        if (typeof method === 'function')
          return method.bind(this)

        return undefined
      },
    })
  }

  public update(obj: Partial<User>) {
    if (this._data && this._data?.id) {
      return this.queryBuilderUpdate.set(obj)
        .where('id', '=', this._data?.id)
        .executeTakeFirst()
    }
  }

  public async all() {
    return await this.queryBuilder.selectAll()
      .execute()
  }

  public async get() {
    if (this._isSelectInvoked)
      return await this.queryBuilder.select(this.cols).execute()

    return await this.queryBuilder.selectAll().execute()
  }

  public where(...args: (string | number | boolean)[]) {
    // TODO: resolve this
    // @ts-expect-error resolve this

    this.queryBuilder = this.queryBuilder.where(...args)

    return this
  }

  public distinct() {
    this.queryBuilder = this.queryBuilder.distinct()

    return this
  }

  public distinctOn(col: string) {
    this.queryBuilder = this.queryBuilder.distinctOn(col)

    return this
  }

  public limit(limit: number) {
    this.queryBuilder = this.queryBuilder.limit(limit)

    return this
  }

  public orderBy(col: string) {
    this.queryBuilder = this.queryBuilder.orderBy(col)

    return this
  }

  public groupBy(col: string) {
    this.queryBuilder = this.queryBuilder.groupBy(col)

    return this
  }

  public innerJoin(...args: (string)[]) {
    this.queryBuilder = this.queryBuilder.innerJoin(...args)

    return this
  }

  public join(...args: string[]) {
    this.queryBuilder = this.queryBuilder.innerJoin(...args)

    return this
  }

  public rightJoin(...args: string[]) {
    this.queryBuilder = this.queryBuilder.rightJoin(...args)

    return this
  }

  public leftJoin(...args: string[]) {
    this.queryBuilder = this.queryBuilder.leftJoin(...args)

    return this
  }

  public offset(offset: number) {
    this.queryBuilder = this.queryBuilder.offset(offset)

    return this
  }

  public fullJoin(...args: string[]) {
    this.queryBuilder = this.queryBuilder.fullJoin(...args)

    return this
  }

  public orderByDesc(col: string) {
    this.queryBuilder = this.queryBuilder.orderBy(col, 'desc')

    return this
  }

  public select(...args: string[]) {
    this.cols = args
    this._isSelectInvoked = true
    // TODO: resolve this
    // @ts-expect-error resolve this

    this.queryBuilder = this.queryBuilder.select(...args)

    return this
  }

  public first(): Promise<any> {
    // Execute the query using queryBuilder
    return this.queryBuilder.executeTakeFirst()
  }

  public store(obj: any[]) {
    // Execute the query using queryBuilder
    return this.queryBuilderStore.values(obj)
      .executeTakeFirst()
  }

  public createMany(obj: any[]) {
    // Execute the query using queryBuilder
    return this.queryBuilderStore.values(obj)
      .executeTakeFirst()
  }

  public delete() {
    // Execute the query using queryBuilder
    return this.queryBuilderDelete
      .where('id', '=', 1)
      .executeTakeFirst()
  }
}

process.exit(0)
