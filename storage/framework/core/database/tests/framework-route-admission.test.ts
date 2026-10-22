import { afterAll, describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { frameworkRouteAdmission } from '../src/framework-route-admission'
import { excludedFrameworkModels } from '../src/model-sources'

/**
 * Which framework default routes can work in an app that excluded the
 * framework's models from its schema (stacksjs/stacks#2943).
 */
const scratch = mkdtempSync(join(tmpdir(), 'stacks-route-admission-'))
afterAll(() => rmSync(scratch, { recursive: true, force: true }))

function fixture(actions: Record<string, string>, appActions: Record<string, string> = {}) {
  const root = mkdtempSync(join(scratch, 'case-'))
  const write = (dir: string, files: Record<string, string>) => {
    for (const [name, code] of Object.entries(files)) {
      mkdirSync(join(root, dir, name, '..'), { recursive: true })
      writeFileSync(join(root, dir, `${name}.ts`), code)
    }
  }
  write('framework', actions)
  write('app', appActions)
  mkdirSync(join(root, 'models'), { recursive: true })
  writeFileSync(join(root, 'models', 'Subscriber.ts'), `export default { name: 'Subscriber', table: 'subscribers' }\n`)
  writeFileSync(join(root, 'models', 'Error.ts'), `export default { name: 'Error', table: 'errors' }\n`)
  return {
    excluded: [
      { name: 'Subscriber', file: join(root, 'models', 'Subscriber.ts'), origin: 'framework' as const },
      { name: 'Error', file: join(root, 'models', 'Error.ts'), origin: 'framework' as const },
    ],
    frameworkActionsRoot: join(root, 'framework'),
    appActionsRoot: join(root, 'app'),
  }
}

const tables = (...names: string[]) => async () => new Set(names)

describe('frameworkRouteAdmission', () => {
  const actions = {
    Subscribe: `import { Subscriber } from '@stacksjs/orm'\nexport default { handle: () => Subscriber.where('email', 'x').first() }\n`,
    BareGlobal: `export default { handle: () => Subscriber.all() }\n`,
    RawTable: `import { db } from '@stacksjs/database'\nexport default { handle: () => db.selectFrom('subscribers').execute() }\n`,
    Unrelated: `export default { handle: () => 'ok' }\n`,
    ThrowsError: `export default { handle: () => { throw new Error('nope') } }\n`,
    Commented: `// Subscriber is mentioned only here\nexport default { handle: () => 'ok' }\n`,
    'Nested/Deep': `import { Subscriber as S } from '@stacksjs/orm'\nexport default { handle: () => S.all() }\n`,
  }

  it('withholds an action that imports, names or queries a model whose table is missing', async () => {
    const admit = (await frameworkRouteAdmission({ ...fixture(actions), liveTables: tables('users') }))!
    expect(admit('Actions/Subscribe')).toContain('Subscriber (table "subscribers" does not exist)')
    expect(admit('Actions/BareGlobal')).toContain('Subscriber')
    expect(admit('Actions/RawTable')).toContain('Subscriber')
    expect(admit('Actions/Nested/Deep')).toContain('Subscriber')
  })

  it('admits actions that do not depend on it, including a builtin that shares a model name and prose in a comment', async () => {
    const admit = (await frameworkRouteAdmission({ ...fixture(actions), liveTables: tables('users') }))!
    expect(admit('Actions/Unrelated')).toBeUndefined()
    expect(admit('Actions/ThrowsError')).toBeUndefined()
    expect(admit('Actions/Commented')).toBeUndefined()
    expect(admit('Controllers/Thing@index')).toBeUndefined()
    expect(admit('Actions/DoesNotExist')).toBeUndefined()
  })

  it('admits everything when the table exists, as it does in an app that created it before #2220', async () => {
    expect(await frameworkRouteAdmission({ ...fixture(actions), liveTables: tables('users', 'subscribers', 'errors') })).toBeUndefined()
  })

  it('admits an action the app overrides', async () => {
    const admit = (await frameworkRouteAdmission({ ...fixture(actions, { Subscribe: 'export default {}\n' }), liveTables: tables('users') }))!
    expect(admit('Actions/Subscribe')).toBeUndefined()
  })

  it('admits everything when the table list cannot be read', async () => {
    expect(await frameworkRouteAdmission({ ...fixture(actions), liveTables: tables() })).toBeUndefined()
    expect(await frameworkRouteAdmission({ ...fixture(actions), liveTables: async () => { throw new Error('down') } })).toBeUndefined()
  })

  it('does nothing when no framework model is excluded', async () => {
    expect(await frameworkRouteAdmission({ ...fixture(actions), excluded: [], liveTables: tables('users') })).toBeUndefined()
  })

  it('withholds the real newsletter route in an app with only its own User model', async () => {
    // The reporter's app: app/Models holds User and nothing else.
    const userRoot = mkdtempSync(join(scratch, 'user-models-'))
    writeFileSync(join(userRoot, 'User.ts'), `export default { name: 'User', table: 'users' }\n`)
    const excluded = excludedFrameworkModels({ userRoot, includeFrameworkDefaults: false })
    expect(excluded.map(m => m.name)).toContain('Subscriber')

    const admit = (await frameworkRouteAdmission({
      excluded,
      liveTables: tables('users'),
      appActionsRoot: join(userRoot, 'Actions'),
      frameworkActionsRoot: resolve(import.meta.dir, '../../../defaults/app/Actions'),
    }))!
    expect(admit('Actions/SubscriberEmailAction')).toContain('Subscriber (table "subscribers" does not exist)')
    expect(admit('Actions/HealthAction')).toBeUndefined()
  })
})
