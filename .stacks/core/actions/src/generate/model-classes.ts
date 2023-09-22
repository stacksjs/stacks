import type { Database } from '@stacksjs/database'
import { db } from '@stacksjs/database'

class UserModel {
  queryBuilder = db.selectFrom('users')// Initialize queryBuilder
  queryBuilderStore = db.insertInto('users')// Initialize queryBuilder
  queryBuilderUpdate = db.updateTable('users')// Initialize queryBuilder
  queryBuilderDelete = db.deleteFrom('users')// Initialize queryBuilder

  private _isSelectInvoked = false
  private cols: string[] = []
  // private so = false

  public async find(id: number) {
    return this.queryBuilder.selectAll()
      .where('id', '=', id)
      .executeTakeFirst()
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

  public where(...args) {
    // TODO: resolve this
    // @ts-expect-error resolve this
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
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

  public innerJoin(...args: string[]) {
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

  public update(obj: any) {
    // Execute the query using queryBuilder
    return this.queryBuilderUpdate.set(obj)
      .where('id', '=', 1)
      .executeTakeFirst()
  }

  public delete() {
    // Execute the query using queryBuilder
    return this.queryBuilderDelete
      .where('id', '=', 1)
      .executeTakeFirst()
  }
}

export const User = new UserModel()

process.exit(0)
