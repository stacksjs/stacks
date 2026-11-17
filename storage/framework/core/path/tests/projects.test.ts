import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { findProjectRoot, isProjectRoot, isVisitingCli, projectCliEntry } from '../src/project'
import {
  clearProjectService,
  findProject,
  forgetProject,
  listProjects,
  pruneProjects,
  readProjectService,
  recordProjectService,
  registerProject,
  reserveProjectPort,
  stacksHome,
} from '../src/projects'

let sandbox: string
let previousHome: string | undefined

/** A directory that is a Stacks project the way a package-based app is one. */
function makeProject(...segments: string[]): string {
  const root = join(sandbox, ...segments)
  mkdirSync(join(root, 'config'), { recursive: true })
  writeFileSync(join(root, 'package.json'), JSON.stringify({ name: segments.at(-1) }))
  writeFileSync(join(root, 'config/app.ts'), 'export default {}')
  return realpathSync(root)
}

beforeEach(() => {
  sandbox = realpathSync(mkdtempSync(join(tmpdir(), 'stacks-projects-')))
  previousHome = process.env.STACKS_HOME
  process.env.STACKS_HOME = join(sandbox, 'home')
})

afterEach(() => {
  if (previousHome === undefined)
    delete process.env.STACKS_HOME
  else
    process.env.STACKS_HOME = previousHome
  rmSync(sandbox, { recursive: true, force: true })
})

describe('findProjectRoot', () => {
  it('finds the project a nested directory belongs to', () => {
    const root = makeProject('shop')
    const nested = join(root, 'app/Models/Billing')
    mkdirSync(nested, { recursive: true })

    expect(findProjectRoot(root)).toBe(root)
    expect(findProjectRoot(nested)).toBe(root)
  })

  it('picks the nearest project when one is staged inside another', () => {
    const outer = makeProject('host')
    mkdirSync(join(outer, 'storage/framework'), { recursive: true })
    const inner = makeProject('host', 'storage/framework/runtime/sites/web')

    expect(findProjectRoot(join(inner, 'config'))).toBe(inner)
    expect(findProjectRoot(join(outer, 'storage/framework/runtime'))).toBe(outer)
  })

  it('answers null outside every project', () => {
    const loose = join(sandbox, 'notes/2026')
    mkdirSync(loose, { recursive: true })
    writeFileSync(join(sandbox, 'notes/package.json'), '{}')

    // A package.json alone is a package, not a Stacks project.
    expect(isProjectRoot(join(sandbox, 'notes'))).toBe(false)
    expect(findProjectRoot(loose)).toBeNull()
  })

  it('does not take the runtime directory a stray process left behind for a project', () => {
    // What a command started in a code folder leaves there.
    const code = join(sandbox, 'Code')
    mkdirSync(join(code, 'storage/framework/runtime'), { recursive: true })
    const real = makeProject('Code', 'shop')

    expect(isProjectRoot(code)).toBe(false)
    expect(findProjectRoot(join(code, 'scratch'))).toBeNull()
    expect(findProjectRoot(real)).toBe(real)
  })
})

describe('whose buddy is running', () => {
  function install(root: string): string {
    const entry = join(root, 'node_modules/@stacksjs/buddy/dist/cli.js')
    mkdirSync(join(entry, '..'), { recursive: true })
    writeFileSync(entry, '')
    return entry
  }

  it('finds the CLI a project has installed, and none before it is', () => {
    const shop = makeProject('shop')
    expect(projectCliEntry(shop)).toBeNull()

    const entry = install(shop)
    expect(projectCliEntry(shop)).toBe(entry)
  })

  it('tells a buddy from elsewhere apart from the project\'s own', () => {
    const shop = makeProject('shop')
    const own = install(shop)
    const global = install(makeProject('global-install'))

    expect(isVisitingCli(shop, global)).toBe(true)
    expect(isVisitingCli(shop, own)).toBe(false)
    // A compiled binary has no file for an entry: it is not the project's.
    expect(isVisitingCli(shop, '/$bunfs/root/buddy')).toBe(true)
  })

  it('is not visiting a project that has no buddy of its own to hand over to', () => {
    const fresh = makeProject('fresh')
    expect(isVisitingCli(fresh, install(makeProject('global-install')))).toBe(false)
  })
})

describe('the machine project list', () => {
  it('keeps one entry per project and reads them back most recently used first', () => {
    const shop = makeProject('shop')
    const blog = makeProject('blog')

    expect(registerProject(shop, new Date('2026-01-01T00:00:00Z'))).toMatchObject({ id: 'shop', name: 'shop', path: shop })
    registerProject(blog, new Date('2026-01-02T00:00:00Z'))

    expect(listProjects().map(project => project.name)).toEqual(['blog', 'shop'])
    expect(readdirSync(stacksHome('projects')).sort()).toEqual(['blog.json', 'shop.json'])
  })

  it('refuses a directory that is not a project', () => {
    const loose = join(sandbox, 'loose')
    mkdirSync(loose)

    expect(registerProject(loose)).toBeNull()
    expect(listProjects()).toEqual([])
  })

  it('does not rewrite the entry on every run', () => {
    const shop = makeProject('shop')
    const first = registerProject(shop, new Date('2026-01-01T00:00:00Z'))!
    const file = join(stacksHome('projects'), 'shop.json')
    const written = readFileSync(file, 'utf8')

    // A minute later: still the same entry, and the file untouched.
    expect(registerProject(shop, new Date('2026-01-01T00:01:00Z'))).toEqual(first)
    expect(readFileSync(file, 'utf8')).toBe(written)

    // An hour later it counts as used again, and keeps when it was added.
    const later = registerProject(shop, new Date('2026-01-01T01:00:00Z'))!
    expect(later.lastUsedAt).toBe('2026-01-01T01:00:00.000Z')
    expect(later.addedAt).toBe(first.addedAt)
  })

  it('tells two projects of the same name apart without moving the first', () => {
    const first = makeProject('clients/acme/app')
    const second = makeProject('clients/globex/app')

    const a = registerProject(first)!
    const b = registerProject(second)!

    expect(a.id).toBe('app')
    expect(b.id).toMatch(/^app-[0-9a-f]{8}$/)
    // Registering either again finds its own entry rather than minting a third.
    expect(registerProject(first)!.id).toBe('app')
    expect(registerProject(second)!.id).toBe(b.id)
    expect(listProjects()).toHaveLength(2)
  })

  it('hands a deleted project\'s name to the one that is still there', () => {
    const gone = makeProject('old/app')
    registerProject(gone)
    rmSync(gone, { recursive: true, force: true })

    expect(registerProject(makeProject('new/app'))!.id).toBe('app')
  })

  it('forgets and prunes entries without touching the projects', () => {
    const shop = makeProject('shop')
    const blog = makeProject('blog')
    registerProject(shop)
    const entry = registerProject(blog)!

    rmSync(shop, { recursive: true, force: true })
    expect(pruneProjects().map(project => project.name)).toEqual(['shop'])
    expect(listProjects().map(project => project.name)).toEqual(['blog'])

    expect(forgetProject(entry)).toBe(true)
    expect(forgetProject(entry)).toBe(false)
    expect(isProjectRoot(blog)).toBe(true)
  })

  it('gives each project its own port and gives it the same one again', () => {
    const shop = makeProject('shop')
    const blog = makeProject('blog')

    expect(reserveProjectPort(shop, 'dashboard', 3900)).toBe(3900)
    expect(reserveProjectPort(blog, 'dashboard', 3900)).toBe(3901)
    expect(reserveProjectPort(shop, 'dashboard', 3900)).toBe(3900)
    // Another service is numbered on its own.
    expect(reserveProjectPort(blog, 'api', 4100)).toBe(4100)
    expect(reserveProjectPort(join(sandbox, 'nowhere'), 'dashboard', 3900)).toBeNull()

    // Using the project later keeps what it was given.
    registerProject(blog, new Date(Date.now() + 60 * 60 * 1000))
    expect(listProjects().find(project => project.name === 'blog')?.ports).toEqual({ dashboard: 3901, api: 4100 })
  })

  it('skips an entry it cannot read rather than failing the list', () => {
    registerProject(makeProject('shop'))
    writeFileSync(join(stacksHome('projects'), 'broken.json'), '{ "path": ')

    expect(listProjects().map(project => project.name)).toEqual(['shop'])
  })
})

describe('findProject', () => {
  it('matches a name exactly before it matches part of one', () => {
    const shop = makeProject('shop')
    const admin = makeProject('shop-admin')
    registerProject(shop)
    registerProject(admin)

    expect(findProject('shop').project?.path).toBe(shop)
    expect(findProject('SHOP-ADMIN').project?.path).toBe(admin)
    expect(findProject('adm').project?.path).toBe(admin)
  })

  it('reports every candidate when a name is ambiguous', () => {
    registerProject(makeProject('shop-admin'))
    registerProject(makeProject('shop-api'))

    const match = findProject('shop')
    expect(match.project).toBeNull()
    expect(match.candidates.map(project => project.name).sort()).toEqual(['shop-admin', 'shop-api'])
  })

  it('takes a path to the root or to anywhere inside it', () => {
    const shop = makeProject('shop')
    mkdirSync(join(shop, 'app/Models'), { recursive: true })

    expect(findProject(join(shop, 'app/Models')).project).toEqual({ name: 'shop', path: shop })
    expect(findProject('../shop/app', join(sandbox, 'elsewhere')).project?.path).toBe(shop)
    // A bare word that names no listed project is tried as a directory.
    expect(findProject('shop', sandbox).project?.path).toBe(shop)
  })

  it('answers nothing for a name that is neither listed nor a directory', () => {
    expect(findProject('nowhere', sandbox)).toEqual({ project: null, candidates: [] })
    expect(findProject('   ', sandbox)).toEqual({ project: null, candidates: [] })
  })
})

describe('service records', () => {
  it('reads back what a running server recorded', () => {
    const shop = makeProject('shop')
    const service = { name: 'dashboard', pid: process.pid, port: 3900, url: 'http://localhost:3900', startedAt: '2026-01-01T00:00:00.000Z' }
    recordProjectService(shop, service)

    expect(readProjectService(shop, 'dashboard')).toEqual(service)
    expect(readProjectService(shop, 'api')).toBeNull()
  })

  it('drops the record of a server that died without taking it down', async () => {
    const shop = makeProject('shop')
    const child = Bun.spawn([process.execPath, '-e', ''], { stdout: 'ignore', stderr: 'ignore' })
    await child.exited
    recordProjectService(shop, { name: 'dashboard', pid: child.pid, port: 3900, url: 'http://localhost:3900', startedAt: '2026-01-01T00:00:00.000Z' })

    expect(readProjectService(shop, 'dashboard')).toBeNull()
    expect(readdirSync(join(shop, 'storage/framework/runtime/services'))).toEqual([])
  })

  it('lets only the process that wrote a record take it down', () => {
    const shop = makeProject('shop')
    recordProjectService(shop, { name: 'dashboard', pid: process.pid, port: 3900, url: 'http://localhost:3900', startedAt: '2026-01-01T00:00:00.000Z' })

    clearProjectService(shop, 'dashboard', process.pid + 1)
    expect(readProjectService(shop, 'dashboard')).not.toBeNull()

    clearProjectService(shop, 'dashboard')
    expect(readProjectService(shop, 'dashboard')).toBeNull()
  })
})
