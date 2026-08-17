/**
 * Getting at the models, in both the places this package runs.
 *
 * Every function here used to open with
 * `const { EmailList } = await import('@stacksjs/orm')`. That works inside the
 * framework repo, where the ORM package exports generated models complete with
 * their query statics.
 *
 * It does NOT work in an installed app. There, the live models are the
 * auto-import globals the preloader wires up, and the package's named export
 * is a bare definition with no `.where()` on it - so every call in this file
 * failed with "EmailList.where is not a function", and the whole package was
 * unusable in exactly the apps it exists for.
 *
 * `model()` asks for the live one first and falls back to the package export,
 * so the same code works in the framework, in an app, and in a test.
 */

export interface QueryableModel {
  find: (id: number) => Promise<any>
  where: (...args: any[]) => any
  create: (data: Record<string, unknown>) => Promise<any>
  [key: string]: any
}

function isQueryable(candidate: unknown): candidate is QueryableModel {
  return Boolean(candidate) && typeof (candidate as { where?: unknown })?.where === 'function'
}

/**
 * The live model called `name`.
 *
 * Throws with the model's name rather than letting `undefined.where` surface
 * three frames later: a missing model almost always means the feature's
 * models were never published into the app (`buddy marketing:install`), and
 * the message should say which one is missing.
 */
export async function model(name: string): Promise<QueryableModel> {
  const global = (globalThis as Record<string, unknown>)[name]
  if (isQueryable(global))
    return global

  const orm = await import('@stacksjs/orm') as Record<string, unknown>
  const exported = orm[name]
  if (isQueryable(exported))
    return exported

  throw new Error(
    `[newsletter] Model '${name}' is not available. Its feature's models may not be installed in this app - try \`buddy marketing:install\`.`,
  )
}
