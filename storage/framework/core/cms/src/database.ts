type StacksDatabase = typeof import('@stacksjs/database').db

let dbPromise: Promise<StacksDatabase> | undefined

export async function getDb(): Promise<StacksDatabase> {
  dbPromise ??= import('@stacksjs/database').then(module => module.db)

  return dbPromise
}
