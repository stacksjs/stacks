import type { RegisteredProject } from '@stacksjs/path'
import type { SoftwareUpdateReport } from './dashboard-software-update-job'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { installedDefaultsVersion, isProjectRoot, listProjects, registerProject, stacksHome } from '@stacksjs/path'
import { frameworkRegistryFetch, NPM_REGISTRY } from '../framework-registry'
import { readVersion, resolveLatestStableTag } from '../upgrade/framework-utils'
import { hasStacksDependency, installedStacksVersion } from '../upgrade/packages'
import { readSoftwareUpdate, startSoftwareRestart, startSoftwareUpdate } from './dashboard-software-update-job'
import { isTrustedTrayRequest, trayOrigins } from './tray-origin'

type Source = 'vendored' | 'package'
interface ProjectInstall {
  id: string
  name: string
  root: string
  current: boolean
  source: Source | null
  installed: string | null
}

type Latest = Record<Source, string | null>

interface UpdateRoutesOptions {
  root: string
  port: number
  url: () => string
  validateWrite: (request: Request) => Promise<void>
  resolveRelease?: (source: Source) => Promise<string | null>
}

function projectInstall(project: RegisteredProject, current: boolean): ProjectInstall {
  const root = project.path
  const result = { id: project.id, name: project.name, current, root }
  if (existsSync(join(root, 'storage/framework/core'))) {
    return { ...result, source: 'vendored', installed: readVersion(join(root, 'storage/framework/core/buddy/package.json')) }
  }

  try {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
    if (hasStacksDependency(pkg))
      return { ...result, source: 'package', installed: installedStacksVersion(root) ?? installedDefaultsVersion(root) }
  }
  catch {}
  return { ...result, source: null, installed: null }
}

function registeredInstalls(root: string): ProjectInstall[] {
  const current = registerProject(root)
  const others = listProjects().filter(project => project.id !== current?.id && isProjectRoot(project.path))
  return [...(current ? [projectInstall(current, true)] : []), ...others.map(project => projectInstall(project, false))]
}

function isVersion(value: unknown): value is string {
  return typeof value === 'string' && /^\d+\.\d+\.\d+(?:-[\w.-]+)?(?:\+[\w.-]+)?$/.test(value)
}

async function latestRelease(source: Source): Promise<string | null> {
  if (source === 'vendored')
    return (await resolveLatestStableTag(AbortSignal.timeout(10_000)))?.slice(1) ?? null

  try {
    const response = await frameworkRegistryFetch()(`${NPM_REGISTRY}/stacks/latest`, { signal: AbortSignal.timeout(10_000) })
    if (response.ok) {
      const { version } = await response.json() as { version?: unknown }
      if (typeof version === 'string' && /^\d+\.\d+\.\d+$/.test(version))
        return version
    }
  }
  catch {}
  return null
}

function response(data: object, status = 200): Response {
  return Response.json(data, { status, headers: { 'cache-control': 'no-store' } })
}

export function dashboardSoftwareUpdateRoutes(options: UpdateRoutesOptions) {
  const resolveRelease = options.resolveRelease ?? latestRelease
  const stateFile = stacksHome('buddy/software-update/status.sqlite')
  let checked: { at: number, latest: Latest } | undefined
  let checking: Promise<Latest> | undefined

  function checkReleases(projects: ProjectInstall[]): Promise<Latest> {
    if (checked && Date.now() - checked.at < 30_000 && projects.every(project => !project.source || checked?.latest[project.source]))
      return Promise.resolve(checked.latest)
    checking ??= Promise.all([
      projects.some(project => project.source === 'vendored') ? resolveRelease('vendored') : null,
      projects.some(project => project.source === 'package') ? resolveRelease('package') : null,
    ]).then(([vendored, packaged]) => {
      const latest = { vendored, package: packaged }
      checked = { at: Date.now(), latest }
      return latest
    }).finally(() => { checking = undefined })
    return checking
  }

  function trusted(request: Request): boolean {
    const publicUrl = new URL(options.url())
    const origins = [...trayOrigins(options.port, null), publicUrl.origin]
    const url = new URL(request.url)
    // The pretty HTTPS proxy can forward over plain HTTP with its public host.
    return origins.some(origin => new URL(origin).host === url.host) && isTrustedTrayRequest(request, origins)
  }

  function targetFor(project: ProjectInstall, latest: Latest, previous: SoftwareUpdateReport | null): string | null {
    const target = project.source && latest[project.source]
    if (!target || !isVersion(project.installed))
      return null
    const order = Bun.semver.order(project.installed, target)
    const incomplete = previous?.projects.some(step =>
      step.id === project.id && step.version === target && (step.status === 'failed' || step.status === 'interrupted'),
    )
    return order < 0 || (order === 0 && incomplete) ? target : null
  }

  async function inspect(request: Request): Promise<Response> {
    if (!trusted(request))
      return response({ error: 'Open the local Buddy dashboard to check for software updates.' }, 403)
    if (request.method !== 'GET')
      return response({ error: 'Method not allowed.' }, 405)

    const projects = registeredInstalls(options.root)
    const check = new URL(request.url).searchParams.get('check') === '1'
    const latest = check ? await checkReleases(projects) : checked?.latest
    const update = readSoftwareUpdate(stateFile)
    return response({
      checked: Boolean(latest),
      projects: projects.map(project => ({
        id: project.id,
        name: project.name,
        current: project.current,
        installed: project.installed,
        latest: project.source && latest ? latest[project.source] : null,
        available: latest ? Boolean(targetFor(project, latest, update)) : false,
        supported: Boolean(project.source && isVersion(project.installed)),
      })),
      update,
    })
  }

  async function guardWrite(request: Request): Promise<Response | null> {
    if (request.method !== 'POST')
      return response({ error: 'Method not allowed.' }, 405)
    if (!trusted(request))
      return response({ error: 'Open the local Buddy dashboard to manage software updates.' }, 403)
    try {
      await options.validateWrite(request)
    }
    catch {
      return response({ error: 'This request did not come from the dashboard.' }, 403)
    }
    return null
  }

  async function install(request: Request): Promise<Response> {
    const refused = await guardWrite(request)
    if (refused)
      return refused
    const body = await request.json().catch(() => null) as { projects?: unknown } | null
    if (!Array.isArray(body?.projects) || !body.projects.length || !body.projects.every(id => typeof id === 'string'))
      return response({ error: 'Select at least one registered project.' }, 400)
    const selected = new Set(body.projects as string[])
    const projects = registeredInstalls(options.root)
    if (projects.filter(project => selected.has(project.id)).length !== selected.size)
      return response({ error: 'A selected project is no longer registered.' }, 404)

    const latest = await checkReleases(projects)
    const previous = readSoftwareUpdate(stateFile)
    const targets = projects.filter(project => selected.has(project.id)).flatMap((project) => {
      const version = targetFor(project, latest, previous)
      return version ? [{ id: project.id, name: project.name, root: project.root, version }] : []
    })
    if (targets.length !== selected.size)
      return response({ error: 'The selected updates changed. Check for updates again.' }, 409)

    try {
      const update = startSoftwareUpdate(stateFile, targets)
      return update ? response({ update }, 202) : response({ error: 'A Buddy software update is already running.' }, 409)
    }
    catch {
      return response({ error: 'Buddy could not start the software update. Check that its local state directory is writable.' }, 500)
    }
  }

  async function restart(request: Request): Promise<Response> {
    const refused = await guardWrite(request)
    if (refused)
      return refused

    const body = await request.json().catch(() => null) as { updateId?: unknown } | null
    if (typeof body?.updateId !== 'string' || !body.updateId)
      return response({ error: 'An installed update is required.' }, 400)

    try {
      const update = startSoftwareRestart(stateFile, body.updateId)
      return update
        ? response({ update }, 202)
        : response({ error: 'There are no updated projects ready to restart.' }, 409)
    }
    catch {
      return response({ error: 'Buddy could not start the restart.' }, 500)
    }
  }

  return {
    '/__buddy/software-update': inspect,
    '/__buddy/software-update/install': install,
    '/__buddy/software-update/restart': restart,
  }
}
