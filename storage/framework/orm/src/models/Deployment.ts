import type { ColumnType, Generated, Insertable, Selectable, Updateable } from 'kysely'
    import type { Result } from '@stacksjs/error-handling'
    import { err, handleError, ok } from '@stacksjs/error-handling'
    import { db } from '@stacksjs/database'
    import User from './User'


    // import { Kysely, MysqlDialect, PostgresDialect } from 'kysely'
    // import { Pool } from 'pg'

    // TODO: we need an action that auto-generates these table interfaces
    export interface DeploymentsTable {
      id: Generated<number>
      commitSha: string
      commitMessage: string
      branch: string
      status: string
      executionTime: number
      deployScript: string
      terminalOutput: string
      user_id: number 

      created_at: ColumnType<Date, string | undefined, never>
      updated_at: ColumnType<Date, string | undefined, never>
      deleted_at: ColumnType<Date, string | undefined, never>
    }

    interface DeploymentResponse {
      data: Deployments
      paging: {
        total_records: number
        page: number
        total_pages: number
      }
      next_cursor: number | null
    }

    export type DeploymentType = Selectable<DeploymentsTable>
    export type NewDeployment = Insertable<DeploymentsTable>
    export type DeploymentUpdate = Updateable<DeploymentsTable>
    export type Deployments = DeploymentType[]

    export type DeploymentColumn = Deployments
    export type DeploymentColumns = Array<keyof Deployments>

    type SortDirection = 'asc' | 'desc'
    interface SortOptions { column: DeploymentType, order: SortDirection }
    // Define a type for the options parameter
    interface QueryOptions {
      sort?: SortOptions
      limit?: number
      offset?: number
      page?: number
    }

    export class DeploymentModel {
      private deployment: Partial<DeploymentType>
      private results: Partial<DeploymentType>[]
      private hidden = ['password'] // TODO: this hidden functionality needs to be implemented still

      constructor(deployment: Partial<DeploymentType>) {
        this.deployment = deployment
      }

      // Method to find a deployment by ID
      static async find(id: number, fields?: (keyof DeploymentType)[]) {
        let query = db.selectFrom('deployments').where('id', '=', id)

        if (fields)
          query = query.select(fields)
        else
          query = query.selectAll()

        const model = await query.executeTakeFirst()

        if (!model)
          return null

        return new DeploymentModel(model)
      }

      static async findMany(ids: number[], fields?: (keyof DeploymentType)[]) {
        let query = db.selectFrom('deployments').where('id', 'in', ids)

        if (fields)
          query = query.select(fields)
        else
          query = query.selectAll()

        const model = await query.execute()

        return model.map(modelItem => new DeploymentModel(modelItem))
      }

      // Method to get a deployment by criteria
      static async get(criteria: Partial<DeploymentType>, options: QueryOptions = {}): Promise<DeploymentModel[]> {
        let query = db.selectFrom('deployments')

        // Apply sorting from options
        if (options.sort)
          query = query.orderBy(options.sort.column, options.sort.order)

        // Apply limit and offset from options
        if (options.limit !== undefined)
          query = query.limit(options.limit)

        if (options.offset !== undefined)
          query = query.offset(options.offset)

        const model = await query.selectAll().execute()
        return model.map(modelItem => new DeploymentModel(modelItem))
      }

      // Method to get all deployments
      static async all(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<DeploymentResponse> {
        const totalRecordsResult = await db.selectFrom('deployments')
          .select(db.fn.count('id').as('total')) // Use 'id' or another actual column name
          .executeTakeFirst()

        const totalRecords = Number(totalRecordsResult?.total) || 0
        const totalPages = Math.ceil(totalRecords / (options.limit ?? 10))

        const deploymentsWithExtra = await db.selectFrom('deployments')
          .selectAll()
          .orderBy('id', 'asc') // Assuming 'id' is used for cursor-based pagination
          .limit((options.limit ?? 10) + 1) // Fetch one extra record
          .offset((options.page - 1) * (options.limit ?? 10))
          .execute()

        let nextCursor = null
        if (deploymentsWithExtra.length > (options.limit ?? 10))
          nextCursor = deploymentsWithExtra.pop()!.id // Use the ID of the extra record as the next cursor

        return {
          data: deploymentsWithExtra,
          paging: {
            total_records: totalRecords,
            page: options.page,
            total_pages: totalPages,
          },
          next_cursor: nextCursor,
        }
      }

      // Method to create a new deployment
      static async create(newDeployment: NewDeployment): Promise<DeploymentModel> {
        const model = await db.insertInto('deployments')
          .values(newDeployment)
          .executeTakeFirstOrThrow()

          const result = await db.insertInto('users')
          .values(newUser)
          .executeTakeFirstOrThrow()
  
        return await find(Number(result.insertId))
      }

      // Method to update a deployment
      static async update(id: number, deploymentUpdate: DeploymentUpdate): Promise<DeploymentModel> {
        const model = await db.updateTable('deployments')
          .set(deploymentUpdate)
          .where('id', '=', id)
          .executeTakeFirstOrThrow()

        return new DeploymentModel(model)
      }

      // Method to remove a deployment
      static async remove(id: number): Promise<DeploymentModel> {
        const model = await db.deleteFrom('deployments')
          .where('id', '=', id)
          .executeTakeFirstOrThrow()

        return new DeploymentModel(model)
      }

      async where(column: string, operator = '=', value: any) {
        let query = db.selectFrom('deployments')

        query = query.where(column, operator, value)

        return await query.selectAll().execute()
      }

      async whereIs(criteria: Partial<DeploymentType>, options: QueryOptions = {}) {
        let query = db.selectFrom('deployments')

        // Existing criteria checks
        if (criteria.id)
          query = query.where('id', '=', criteria.id) // Kysely is immutable, we must re-assign

        if (criteria.email)
          query = query.where('email', '=', criteria.email)

        if (criteria.name !== undefined) {
          query = query.where(
            'name',
            criteria.name === null ? 'is' : '=',
            criteria.name,
          )
        }

        if (criteria.password)
          query = query.where('password', '=', criteria.password)

        if (criteria.created_at)
          query = query.where('created_at', '=', criteria.created_at)

        if (criteria.updated_at)
          query = query.where('updated_at', '=', criteria.updated_at)

        if (criteria.deleted_at)
          query = query.where('deleted_at', '=', criteria.deleted_at)

        // Apply sorting from options
        if (options.sort)
          query = query.orderBy(options.sort.column, options.sort.order)

        // Apply pagination from options
        if (options.limit !== undefined)
          query = query.limit(options.limit)

        if (options.offset !== undefined)
          query = query.offset(options.offset)

        return await query.selectAll().execute()
      }

      async whereIn(column: keyof DeploymentType, values: any[], options: QueryOptions = {}) {
        let query = db.selectFrom('deployments')

        query = query.where(column, 'in', values)

        // Apply sorting from options
        if (options.sort)
          query = query.orderBy(options.sort.column, options.sort.order)

        // Apply pagination from options
        if (options.limit !== undefined)
          query = query.limit(options.limit)

        if (options.offset !== undefined)
          query = query.offset(options.offset)

        return await query.selectAll().execute()
      }

      async first() {
        return await db.selectFrom('deployments')
          .selectAll()
          .executeTakeFirst()
      }

      async last() {
        return await db.selectFrom('deployments')
          .selectAll()
          .orderBy('id', 'desc')
          .executeTakeFirst()
      }

      async orderBy(column: keyof DeploymentType, order: 'asc' | 'desc') {
        return await db.selectFrom('deployments')
          .selectAll()
          .orderBy(column, order)
          .execute()
      }

      async orderByDesc(column: keyof DeploymentType) {
        return await db.selectFrom('deployments')
          .selectAll()
          .orderBy(column, 'desc')
          .execute()
      }

      async orderByAsc(column: keyof DeploymentType) {
        return await db.selectFrom('deployments')
          .selectAll()
          .orderBy(column, 'asc')
          .execute()
      }

      // Method to get the deployment instance itself
      self() {
        return this
      }

      // Method to get the deployment instance data
      get() {
        return this.deployment
      }

      // Method to update the deployment instance
      async update(deployment: DeploymentUpdate): Promise<Result<DeploymentType, Error>> {
        if (this.deployment.id === undefined)
          return err(handleError('Deployment ID is undefined'))

        const updatedModel = await db.updateTable('deployments')
          .set(deployment)
          .where('id', '=', this.deployment.id)
          .executeTakeFirst()

        if (!updatedModel)
          return err(handleError('Deployment not found'))

        this.deployment = updatedModel

        return ok(updatedModel)
      }

      // Method to save (insert or update) the deployment instance
      async save(): Promise<void> {
        if (!this.deployment)
          throw new Error('Deployment data is undefined')

        if (this.deployment.id === undefined) {
          // Insert new deployment
          const newModel = await db.insertInto('deployments')
            .values(this.deployment as NewDeployment)
            .executeTakeFirstOrThrow()
          this.deployment = newModel
        }
        else {
          // Update existing deployment
          await this.update(this.deployment)
        }
      }

      // Method to delete the deployment instance
      async delete(): Promise<void> {
        if (this.deployment.id === undefined)
          throw new Error('Deployment ID is undefined')

        await db.deleteFrom('deployments')
          .where('id', '=', this.deployment.id)
          .execute()

        this.deployment = {}
      }

      // Method to refresh the deployment instance data from the database
      async refresh(): Promise<void> {
        if (this.deployment.id === undefined)
          throw new Error('Deployment ID is undefined')

        const refreshedModel = await db.selectFrom('deployments')
          .where('id', '=', this.deployment.id)
          .selectAll()
          .executeTakeFirst()

        if (!refreshedModel)
          throw new Error('Deployment not found')

        this.deployment = refreshedModel
      }

      
      async user() {
        if (this.deployment_id === undefined)
          throw new Error('Relation Error!')

        const model = await db.selectFrom('users')
        .where('id', '=', deployment_id)
        .selectAll()
        .executeTakeFirst()

        if (! model)
          throw new Error('Model Relation Not Found!')

        return new User.modelInstance(model)
      }



      toJSON() {
        const output: Partial<DeploymentType> = { ...this.deployment }

        this.hidden.forEach((attr) => {
          if (attr in output)
            delete output[attr as keyof Partial<DeploymentType>]
        })

        type Deployment = Omit<DeploymentType, 'password'>

        return output as Deployment
      }
    }

    const Model = DeploymentModel

    // starting here, ORM functions
    export async function find(id: number, fields?: (keyof DeploymentType)[]) {
      let query = db.selectFrom('deployments').where('id', '=', id)

      if (fields)
        query = query.select(fields)
      else
        query = query.selectAll()

      const model = await query.executeTakeFirst()

      if (!model)
        return null

      return new DeploymentModel(model)
    }

    export async function findMany(ids: number[], fields?: (keyof DeploymentType)[]) {
      let query = db.selectFrom('deployments').where('id', 'in', ids)

      if (fields)
        query = query.select(fields)
      else
        query = query.selectAll()

      const model = await query.execute()

      return model.map(modelItem => new DeploymentModel(modelItem))
    }

    export async function count() {
      const results = await db.selectFrom('deployments')
        .selectAll()
        .execute()

      return results.length
    }

    export async function get(criteria: Partial<DeploymentType>, sort: { column: keyof DeploymentType, order: 'asc' | 'desc' } = { column: 'created_at', order: 'desc' }) {
      let query = db.selectFrom('deployments')

      if (criteria.id)
        query = query.where('id', '=', criteria.id) // Kysely is immutable, we must re-assign

      if (criteria.email)
        query = query.where('email', '=', criteria.email)

      if (criteria.name !== undefined) {
        query = query.where(
          'name',
          criteria.name === null ? 'is' : '=',
          criteria.name,
        )
      }

      if (criteria.password)
        query = query.where('password', '=', criteria.password)

      if (criteria.created_at)
        query = query.where('created_at', '=', criteria.created_at)

      if (criteria.updated_at)
        query = query.where('updated_at', '=', criteria.updated_at)

      if (criteria.deleted_at)
        query = query.where('deleted_at', '=', criteria.deleted_at)

      // Apply sorting based on the 'sort' parameter
      query = query.orderBy(sort.column, sort.order)

      return await query.selectAll().execute()
    }

    export async function all(limit: number = 10, offset: number = 0) {
      return await db.selectFrom('deployments')
        .selectAll()
        .orderBy('created_at', 'desc')
        .limit(limit)
        .offset(offset)
        .execute()
    }

    export async function create(newDeployment: NewDeployment) {
      const result = await db.insertInto('users')
      .values(newUser)
      .executeTakeFirstOrThrow()

      return await find(Number(result.insertId))
    }

    export async function first() {
     return await db.selectFrom('deployments')
        .selectAll()
        .executeTakeFirst()
    }

    export async function recent(limit: number) {
      return await db.selectFrom('deployments')
         .selectAll()
         .limit(limit)
         .execute()
     }

     export async function last(limit: number) {
      return await db.selectFrom('deployments')
         .selectAll()
         .orderBy('id', 'desc')
         .limit(limit)
         .execute()
     }

    export async function update(id: number, deploymentUpdate: DeploymentUpdate) {
      return await db.updateTable('deployments')
        .set(deploymentUpdate)
        .where('id', '=', id)
        .execute()
    }

    export async function remove(id: number) {
      return await db.deleteFrom('deployments')
        .where('id', '=', id)
        .executeTakeFirst()
    }

    export async function where(column: string, operator = '=', value: any) {
      let query = db.selectFrom('deployments')

      query = query.where(column, operator, value)

      return await query.selectAll().execute()
    }

    export async function whereIs(
      criteria: Partial<DeploymentType>,
      options: QueryOptions = {},
    ) {
      let query = db.selectFrom('deployments')

      // Apply criteria
      if (criteria.id)
        query = query.where('id', '=', criteria.id)

      if (criteria.email)
        query = query.where('email', '=', criteria.email)

      if (criteria.name !== undefined) {
        query = query.where(
          'name',
          criteria.name === null ? 'is' : '=',
          criteria.name,
        )
      }

      if (criteria.password)
        query = query.where('password', '=', criteria.password)

      if (criteria.created_at)
        query = query.where('created_at', '=', criteria.created_at)

      if (criteria.updated_at)
        query = query.where('updated_at', '=', criteria.updated_at)

      if (criteria.deleted_at)
        query = query.where('deleted_at', '=', criteria.deleted_at)

      // Apply sorting from options
      if (options.sort)
        query = query.orderBy(options.sort.column, options.sort.order)

      // Apply pagination from options
      if (options.limit !== undefined)
        query = query.limit(options.limit)

      if (options.offset !== undefined)
        query = query.offset(options.offset)

      return await query.selectAll().execute()
    }

    export async function whereIn(
      column: keyof DeploymentType,
      values: any[],
      options: QueryOptions = {},
    ) {
      let query = db.selectFrom('deployments')

      query = query.where(column, 'in', values)

      // Apply sorting from options
      if (options.sort)
        query = query.orderBy(options.sort.column, options.sort.order)

      // Apply pagination from options
      if (options.limit !== undefined)
        query = query.limit(options.limit)

      if (options.offset !== undefined)
        query = query.offset(options.offset)

      return await query.selectAll().execute()
    }

    export const Deployment = {
      find,
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
      model: DeploymentModel
    }

    export default Deployment
    