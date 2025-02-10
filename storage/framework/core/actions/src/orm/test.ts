// // TODO: this whole file needs to be auto-generated
// // currently only used for testing
// // ultimately, it is generated to storage/framework/orm/UserModel.ts

// import process from 'node:process'
// import type { Collection } from '@stacksjs/collections'
// import { collect } from '@stacksjs/collections'
// import { db } from '@stacksjs/database'

// export interface User {
//   id: number
//   name: string
//   email: string
//   password: string
//   created_at: Date
//   deleted_at: Date
// }

// export type UserColumn = keyof User
// export type UserColumns = Array<keyof User>

// export class UserModel {
//   private _data: User | undefined = undefined

//   private _isSelectInvoked = false
//   public _id: number | undefined = undefined
//   private cols: UserColumns = []
//   private useSoftDeletes = true
//   private keyName: keyof User = 'id'

//   queryBuilder = db.selectFrom('users') // Initialize queryBuilder
//   queryBuilderStore = db.insertInto('users') // Initialize queryBuilder
//   queryBuilderUpdate = DB.instance.updateTable('users') // Initialize queryBuilder
//   queryBuilderDelete = db.deleteFrom('users') // Initialize queryBuilder

//   public async find(id: number | number[]): Promise<User | Collection<User>> {
//     if (Array.isArray(id)) return await this.findMany(id)

//     let query = this.queryBuilder.selectAll().where(this.keyName, '=', id)

//     if (this.useSoftDeletes) query = query.where('deleted_at', 'is', null)

//     this._data = await query.executeTakeFirst()

//     if (!this._data) throw new Error('User not found!')

//     return this._createProxy()
//   }

//   public async findMany(id: number[] | string[]): Promise<User | Collection<User>> {
//     return await this.whereIn(this.keyName, id).get()
//   }

//   private _createProxy() {
//     return new Proxy(this._data || {}, {
//       get: (target: User, prop: UserColumn) => {
//         // Property lookup in the User data
//         if (prop in target) return target[prop]

//         // If it’s a method on the UserModel, bind it
//         const method = this[prop as keyof this]
//         if (typeof method === 'function') return method.bind(this)

//         return undefined
//       },
//     })
//   }

//   public async update(obj: Partial<User>): Promise<User | undefined | Collection<User>> {
//     if (this._data?.id) {
//       await this.queryBuilderUpdate.set(obj).where(this.keyName, '=', this._data?.id).executeTakeFirst()

//       return await this.find(this._data?.id)
//     }

//     return undefined
//   }

//   public async all() {
//     return await this.queryBuilder.selectAll().execute()
//   }

//   public async get(): Promise<Collection<User>> {
//     if (this.useSoftDeletes) return collect(await this.getSoftDeletes())

//     if (this._isSelectInvoked) return collect(await this.queryBuilder.select(this.cols).execute())

//     return collect(await this.queryBuilder.selectAll().execute())
//   }

//   public async trashed() {
//     if (this._isSelectInvoked)
//       return await this.queryBuilder.where('deleted_at', 'is not', null).select(this.cols).execute()

//     return await this.queryBuilder.where('deleted_at', 'is not', null).selectAll().execute()
//   }

//   private async getSoftDeletes() {
//     if (this._isSelectInvoked)
//       return await this.queryBuilder.where('deleted_at', 'is', null).select(this.cols).execute()

//     return await this.queryBuilder.where('deleted_at', 'is', null).selectAll().execute()
//   }

//   public where(...args: (string | number | boolean)[]): this {
//     if (args.length === 2) {
//       const [column, value] = args
//       this.queryBuilder = this.queryBuilder.where(column as UserColumn, '=', value)
//     } else {
//       this.queryBuilder = this.queryBuilder.where(...args)
//     }

//     return this
//   }

//   public orWhere(...args: (string | number | boolean)[]): this {
//     this.queryBuilder = this.queryBuilder.where((eb) => eb.or([eb(...args)]))

//     return this
//   }

//   public whereIn(...args: (string[] | string | number[] | boolean[])[]): this {
//     if (args.length === 2) {
//       const [column, value] = args
//       this.queryBuilder = this.queryBuilder.where(column, 'in', value)
//     } else {
//       this.queryBuilder = this.queryBuilder.where(...args)
//     }

//     return this
//   }

//   public whereNull(col: UserColumn): this {
//     this.queryBuilder = this.queryBuilder.where(col, 'is', null)

//     return this
//   }

//   public when(condition: boolean, callback: (instance: this) => any): this {
//     if (condition) callback(this)

//     return this
//   }

//   public whereNotNull(col: UserColumn): this {
//     this.queryBuilder = this.queryBuilder.where(col, 'is not', null)

//     return this
//   }

//   public distinct() {
//     this.queryBuilder = this.queryBuilder.distinct()

//     return this
//   }

//   public distinctOn(col: UserColumn): this {
//     this.queryBuilder = this.queryBuilder.distinctOn(col)

//     return this
//   }

//   public limit(limit: number): this {
//     this.queryBuilder = this.queryBuilder.limit(limit)

//     return this
//   }

//   public orderBy(col: UserColumn) {
//     this.queryBuilder = this.queryBuilder.orderBy(col)

//     return this
//   }

//   public groupBy(col: UserColumn) {
//     this.queryBuilder = this.queryBuilder.groupBy(col)

//     return this
//   }

//   public innerJoin(...args: string[]): this {
//     this.queryBuilder = this.queryBuilder.innerJoin(...args)

//     return this
//   }

//   public join(...args: string[]): this {
//     this.queryBuilder = this.queryBuilder.innerJoin(...args)

//     return this
//   }

//   public having(...args: string[]): this {
//     this.queryBuilder = this.queryBuilder.having(...args)

//     return this
//   }

//   public rightJoin(...args: string[]): this {
//     this.queryBuilder = this.queryBuilder.rightJoin(...args)

//     return this
//   }

//   public leftJoin(...args: string[]): this {
//     this.queryBuilder = this.queryBuilder.leftJoin(...args)

//     return this
//   }

//   public offset(offset: number): this {
//     this.queryBuilder = this.queryBuilder.offset(offset)

//     return this
//   }

//   public fullJoin(...args: string[]): this {
//     this.queryBuilder = this.queryBuilder.fullJoin(...args)

//     return this
//   }

//   public innerJoinLateral(...args: string[]) {
//     this.queryBuilder.innerJoinLateral(...args)

//     return this
//   }

//   public leftJoinLateral(...args) {
//     this.queryBuilder.leftJoinLateral(...args)

//     return this
//   }

//   public orderByDesc(col: UserColumn): this {
//     this.queryBuilder = this.queryBuilder.orderBy(col, 'desc')

//     return this
//   }

//   public select(...args: UserColumns): this {
//     this.cols = args
//     this._isSelectInvoked = true

//     // TODO: resolve this
//     // @ts-expect-error resolve this
//     this.queryBuilder = this.queryBuilder.select(...args)

//     return this
//   }

//   public async first(): Promise<User> {
//     // Execute the query using queryBuilder
//     if (this._isSelectInvoked) this._data = await this.queryBuilder.select(this.cols).executeTakeFirst()
//     else this._data = await this.queryBuilder.selectAll().executeTakeFirst()

//     return this._createProxy()
//   }

//   public store(obj: any[]): User {
//     // Execute the query using queryBuilder
//     return this.queryBuilderStore.values(obj).executeTakeFirst()
//   }

//   public createMany(obj: any[]): User[] {
//     // Execute the query using queryBuilder
//     return this.queryBuilderStore.values(obj).executeTakeFirst()
//   }

//   public async delete(): Promise<any> {
//     if (this._data?.id) {
//       if (this.useSoftDeletes) return await this.update({ deleted_at: new Date() })

//       return this.forceDelete()
//     }
//   }

//   public forceDelete(): any {
//     if (this._data?.id) {
//       return this.queryBuilderDelete.where(this.keyName, '=', this._data?.id).executeTakeFirst()
//     }
//   }
// }

// process.exit(0)
