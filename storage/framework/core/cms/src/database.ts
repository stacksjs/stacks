type StacksDatabase = typeof import('@stacksjs/database/runtime').db

let dbPromise: Promise<StacksDatabase> | undefined

export async function getDb(): Promise<StacksDatabase> {
  dbPromise ??= import('@stacksjs/database/runtime').then(module => module.db)

  return dbPromise
}
