import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'
import type { UserModelType } from './UserType'

export interface DeploymentsTable {
  id: Generated<number>
  commit_sha?: string
  commit_message?: string
  branch?: string
  status?: string
  execution_time?: number
  deploy_script?: string
  terminal_output?: string
  uuid?: string
  created_at?: string
  updated_at?: string
}

export type DeploymentRead = DeploymentsTable

export type DeploymentWrite = Omit<DeploymentsTable, 'created_at'> & {
  created_at?: string
}

export interface DeploymentResponse {
  data: DeploymentJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface DeploymentJsonResponse extends Omit<Selectable<DeploymentRead>, 'password'> {
  [key: string]: any
}

export type NewDeployment = Insertable<DeploymentWrite>
export type DeploymentUpdate = Updateable<DeploymentWrite>

export interface DeploymentModelType {
  // Properties
  readonly id: number
  get commitSha(): string | undefined
  set commitSha(value: string)
  get commitMessage(): string | undefined
  set commitMessage(value: string)
  get branch(): string | undefined
  set branch(value: string)
  get status(): string | undefined
  set status(value: string)
  get executionTime(): number | undefined
  set executionTime(value: number)
  get deployScript(): string | undefined
  set deployScript(value: string)
  get terminalOutput(): string | undefined
  set terminalOutput(value: string)
  get user(): UserModelType | undefined

  get uuid(): string | undefined
  set uuid(value: string)

  get created_at(): string | undefined
  get updated_at(): string | undefined
  set updated_at(value: string)

  // Static methods
  with: (relations: string[]) => DeploymentModelType
  select: (params: (keyof DeploymentJsonResponse)[] | RawBuilder<string> | string) => DeploymentModelType
  find: (id: number) => Promise<DeploymentModelType | undefined>
  first: () => Promise<DeploymentModelType | undefined>
  last: () => Promise<DeploymentModelType | undefined>
  firstOrFail: () => Promise<DeploymentModelType | undefined>
  all: () => Promise<DeploymentModelType[]>
  findOrFail: (id: number) => Promise<DeploymentModelType | undefined>
  findMany: (ids: number[]) => Promise<DeploymentModelType[]>
  latest: (column?: keyof DeploymentsTable) => Promise<DeploymentModelType | undefined>
  oldest: (column?: keyof DeploymentsTable) => Promise<DeploymentModelType | undefined>
  skip: (count: number) => DeploymentModelType
  take: (count: number) => DeploymentModelType
  where: <V = string>(column: keyof DeploymentsTable, ...args: [V] | [Operator, V]) => DeploymentModelType
  orWhere: (...conditions: [string, any][]) => DeploymentModelType
  whereNotIn: <V = number>(column: keyof DeploymentsTable, values: V[]) => DeploymentModelType
  whereBetween: <V = number>(column: keyof DeploymentsTable, range: [V, V]) => DeploymentModelType
  whereRef: (column: keyof DeploymentsTable, ...args: string[]) => DeploymentModelType
  when: (condition: boolean, callback: (query: DeploymentModelType) => DeploymentModelType) => DeploymentModelType
  whereNull: (column: keyof DeploymentsTable) => DeploymentModelType
  whereNotNull: (column: keyof DeploymentsTable) => DeploymentModelType
  whereLike: (column: keyof DeploymentsTable, value: string) => DeploymentModelType
  orderBy: (column: keyof DeploymentsTable, order: 'asc' | 'desc') => DeploymentModelType
  orderByAsc: (column: keyof DeploymentsTable) => DeploymentModelType
  orderByDesc: (column: keyof DeploymentsTable) => DeploymentModelType
  groupBy: (column: keyof DeploymentsTable) => DeploymentModelType
  having: <V = string>(column: keyof DeploymentsTable, operator: Operator, value: V) => DeploymentModelType
  inRandomOrder: () => DeploymentModelType
  whereColumn: (first: keyof DeploymentsTable, operator: Operator, second: keyof DeploymentsTable) => DeploymentModelType
  max: (field: keyof DeploymentsTable) => Promise<number>
  min: (field: keyof DeploymentsTable) => Promise<number>
  avg: (field: keyof DeploymentsTable) => Promise<number>
  sum: (field: keyof DeploymentsTable) => Promise<number>
  count: () => Promise<number>
  get: () => Promise<DeploymentModelType[]>
  pluck: <K extends keyof DeploymentModelType>(field: K) => Promise<DeploymentModelType[K][]>
  chunk: (size: number, callback: (models: DeploymentModelType[]) => Promise<void>) => Promise<void>
  paginate: (options?: { limit?: number, offset?: number, page?: number }) => Promise<{
    data: DeploymentModelType[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }>
  create: (newDeployment: NewDeployment) => Promise<DeploymentModelType>
  firstOrCreate: (search: Partial<DeploymentsTable>, values?: NewDeployment) => Promise<DeploymentModelType>
  updateOrCreate: (search: Partial<DeploymentsTable>, values?: NewDeployment) => Promise<DeploymentModelType>
  createMany: (newDeployment: NewDeployment[]) => Promise<void>
  forceCreate: (newDeployment: NewDeployment) => Promise<DeploymentModelType>
  remove: (id: number) => Promise<any>
  whereIn: <V = number>(column: keyof DeploymentsTable, values: V[]) => DeploymentModelType
  distinct: (column: keyof DeploymentJsonResponse) => DeploymentModelType
  join: (table: string, firstCol: string, secondCol: string) => DeploymentModelType

  // Instance methods
  createInstance: (data: DeploymentJsonResponse) => DeploymentModelType
  update: (newDeployment: DeploymentUpdate) => Promise<DeploymentModelType | undefined>
  forceUpdate: (newDeployment: DeploymentUpdate) => Promise<DeploymentModelType | undefined>
  save: () => Promise<DeploymentModelType>
  delete: () => Promise<number>
  toSearchableObject: () => Partial<DeploymentJsonResponse>
  toJSON: () => DeploymentJsonResponse
  parseResult: (model: DeploymentModelType) => DeploymentModelType

  userBelong: () => Promise<UserModelType>
}
