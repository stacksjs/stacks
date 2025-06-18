import type { Generated, Insertable, RawBuilder, Selectable, Updateable } from '@stacksjs/database'
import type { Operator } from '@stacksjs/orm'

export interface ProjectsTable {
  id: Generated<number>
  name: string
  description: string
  url: string
  status: string
  created_at?: string
  updated_at?: string
}

export type ProjectRead = ProjectsTable

export type ProjectWrite = Omit<ProjectsTable, 'created_at'> & {
  created_at?: string
}

export interface ProjectResponse {
  data: ProjectJsonResponse[]
  paging: {
    total_records: number
    page: number
    total_pages: number
  }
  next_cursor: number | null
}

export interface ProjectJsonResponse extends Omit<Selectable<ProjectRead>, 'password'> {
  [key: string]: any
}

export type NewProject = Insertable<ProjectWrite>
export type ProjectUpdate = Updateable<ProjectWrite>

export interface ProjectModelType {
  // Properties
  readonly id: number
  get name(): string
  set name(value: string)
  get description(): string
  set description(value: string)
  get url(): string
  set url(value: string)
  get status(): string
  set status(value: string)

  get created_at(): string | undefined
  get updated_at(): string | undefined
  set updated_at(value: string)

  // Static methods
  with: (relations: string[]) => ProjectModelType
  select: (params: (keyof ProjectJsonResponse)[] | RawBuilder<string> | string) => ProjectModelType
  find: (id: number) => Promise<ProjectModelType | undefined>
  first: () => Promise<ProjectModelType | undefined>
  last: () => Promise<ProjectModelType | undefined>
  firstOrFail: () => Promise<ProjectModelType | undefined>
  all: () => Promise<ProjectModelType[]>
  findOrFail: (id: number) => Promise<ProjectModelType | undefined>
  findMany: (ids: number[]) => Promise<ProjectModelType[]>
  latest: (column?: keyof ProjectsTable) => Promise<ProjectModelType | undefined>
  oldest: (column?: keyof ProjectsTable) => Promise<ProjectModelType | undefined>
  skip: (count: number) => ProjectModelType
  take: (count: number) => ProjectModelType
  where: <V = string>(column: keyof ProjectsTable, ...args: [V] | [Operator, V]) => ProjectModelType
  orWhere: (...conditions: [string, any][]) => ProjectModelType
  whereNotIn: <V = number>(column: keyof ProjectsTable, values: V[]) => ProjectModelType
  whereBetween: <V = number>(column: keyof ProjectsTable, range: [V, V]) => ProjectModelType
  whereRef: (column: keyof ProjectsTable, ...args: string[]) => ProjectModelType
  when: (condition: boolean, callback: (query: ProjectModelType) => ProjectModelType) => ProjectModelType
  whereNull: (column: keyof ProjectsTable) => ProjectModelType
  whereNotNull: (column: keyof ProjectsTable) => ProjectModelType
  whereLike: (column: keyof ProjectsTable, value: string) => ProjectModelType
  orderBy: (column: keyof ProjectsTable, order: 'asc' | 'desc') => ProjectModelType
  orderByAsc: (column: keyof ProjectsTable) => ProjectModelType
  orderByDesc: (column: keyof ProjectsTable) => ProjectModelType
  groupBy: (column: keyof ProjectsTable) => ProjectModelType
  having: <V = string>(column: keyof ProjectsTable, operator: Operator, value: V) => ProjectModelType
  inRandomOrder: () => ProjectModelType
  whereColumn: (first: keyof ProjectsTable, operator: Operator, second: keyof ProjectsTable) => ProjectModelType
  max: (field: keyof ProjectsTable) => Promise<number>
  min: (field: keyof ProjectsTable) => Promise<number>
  avg: (field: keyof ProjectsTable) => Promise<number>
  sum: (field: keyof ProjectsTable) => Promise<number>
  count: () => Promise<number>
  get: () => Promise<ProjectModelType[]>
  pluck: <K extends keyof ProjectModelType>(field: K) => Promise<ProjectModelType[K][]>
  chunk: (size: number, callback: (models: ProjectModelType[]) => Promise<void>) => Promise<void>
  paginate: (options?: { limit?: number, offset?: number, page?: number }) => Promise<{
    data: ProjectModelType[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }>
  create: (newProject: NewProject) => Promise<ProjectModelType>
  firstOrCreate: (search: Partial<ProjectsTable>, values?: NewProject) => Promise<ProjectModelType>
  updateOrCreate: (search: Partial<ProjectsTable>, values?: NewProject) => Promise<ProjectModelType>
  createMany: (newProject: NewProject[]) => Promise<void>
  forceCreate: (newProject: NewProject) => Promise<ProjectModelType>
  remove: (id: number) => Promise<any>
  whereIn: <V = number>(column: keyof ProjectsTable, values: V[]) => ProjectModelType
  distinct: (column: keyof ProjectJsonResponse) => ProjectModelType
  join: (table: string, firstCol: string, secondCol: string) => ProjectModelType

  // Instance methods
  createInstance: (data: ProjectJsonResponse) => ProjectModelType
  update: (newProject: ProjectUpdate) => Promise<ProjectModelType | undefined>
  forceUpdate: (newProject: ProjectUpdate) => Promise<ProjectModelType | undefined>
  save: () => Promise<ProjectModelType>
  delete: () => Promise<number>
  toSearchableObject: () => Partial<ProjectJsonResponse>
  toJSON: () => ProjectJsonResponse
  parseResult: (model: ProjectModelType) => ProjectModelType

}
