type MaybePromise<T> = T | Promise<T>

interface Index {
  name: string
}
type Indexes = Index[]
type Record = string
type Records = Record[]

export interface SearchEngineDriver {
  // Indexes
  createIndex: (name: string) => MaybePromise<Index>
  getIndex: (name: string) => MaybePromise<Index>
  updateIndex?: (name: string, options: string) => MaybePromise<Index>
  deleteIndex?: (name: string) => MaybePromise<void>
  updateIndexSettings: (name: string) => MaybePromise<Index>
  listAllIndexes: () => MaybePromise<Indexes>
  listAllIndices: () => MaybePromise<Indexes> // alternatives plural spelling

  // Records (MeiliSearch uses the term "documents")
  getRecord?: (key: string) => MaybePromise<Record>
  getRecords?: (key: string) => MaybePromise<Record>
  createRecord?: (key: string) => MaybePromise<Record>
  createRecords?: (key: string[]) => MaybePromise<Records>
  createOrReplaceRecord?: (key: string) => MaybePromise<Record>
  createOrUpdateRecord?: (key: string) => MaybePromise<Record>
  deleteRecord?: (key: string) => MaybePromise<void>
  deleteAllRecords?: (key: string) => MaybePromise<void>
  batchDeleteRecords?: (key: string) => MaybePromise<void>

  // Search
  search?: (key: string) => MaybePromise<void>
}
