import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { findProjectRoot, isProjectRoot, listProjects, readProjectService, registerProject } from '@stacksjs/path'

/**
 * The dashboard server's side of the project switcher.
 *
 * A dashboard serves one project, so "switching" is going to another
 * project's dashboard, at its own address. These routes tell the page which
 * projects there are and which already have a dashboard up, and bring one up
 * when a project is picked.
 *
 * They are served under `/__buddy/`, a prefix of the dev dashboard's own, and
 * not under `/api/`: `/api/projects` is a route an application is quite likely
 * to have for a model of its own. They exist only here, on the developer's
 * machine. A deployed dashboard has one project and no switcher.
 */

export interface SwitcherProject {
  id: string
  name: string
  path: string
  /** The project this dashboard is serving. */
  current: boolean
  /** Whether a dashboard for it is up right now. */
  running: boolean
  /** Where that dashboard is, when it is up. */
  url: string | null
}

export interface SwitcherListing {
  ok: true
  current: SwitcherProject
  projects: SwitcherProject[]
  /**
   * How often an open page should let the server know it is still open, when
   * the server stops itself after sitting unused. Null when it does not.
   */
  keepAliveMs: number | null
}

export interface ProjectRoutesOptions {
  /** The project this dashboard serves. */
  root: string
  /** This dashboard's own address. */
  url: string
  /** Set when this server exits after that long without a request. */
  idleExitMs: number
  /** Refuses a write that did not come from the dashboard's own page. */
  validateWrite: (request: Request) => Promise<void>
  /** Bring a project's dashboard up and return where it is. */
  openDashboard: (root: string) => Promise<{ url: string }>
}

type RouteHandler = (request: Request) => Response | Promise<Response>

/** `~/Code/shop` for a path under the home directory, as a person would write it. */
export function displayPath(path: string, home: string = homedir()): string {
  return path === home || path.startsWith(`${home}/`) ? `~${path.slice(home.length)}` : path
}

export function listSwitcherProjects(options: Pick<ProjectRoutesOptions, 'root' | 'url'>): { current: SwitcherProject, projects: SwitcherProject[] } {
  // Served straight from its source file (a test, a script), a dashboard may
  // be the first thing ever to run in its project.
  const self = registerProject(options.root)
  const current: SwitcherProject = {
    id: self?.id ?? '',
    name: self?.name ?? options.root.split('/').pop() ?? options.root,
    path: displayPath(options.root),
    current: true,
    running: true,
    url: options.url,
  }

  const others = listProjects()
    // A project that was deleted or moved is still on the list until someone
    // prunes it. It is not something to offer.
    .filter(project => project.id !== current.id && isProjectRoot(project.path))
    .map((project): SwitcherProject => {
      const dashboard = readProjectService(project.path, 'dashboard')
      return {
        id: project.id,
        name: project.name,
        path: displayPath(project.path),
        current: false,
        running: dashboard !== null,
        url: dashboard?.url ?? null,
      }
    })

  return { current, projects: [current, ...others] }
}

function failure(status: number, error: string): Response {
  return Response.json({ ok: false, error }, { status })
}

async function guardedWrite(request: Request, options: ProjectRoutesOptions, handle: (body: Record<string, unknown>) => Promise<Response>): Promise<Response> {
  if (request.method !== 'POST')
    return failure(405, 'Method not allowed')

  try {
    await options.validateWrite(request)
  }
  catch {
    return failure(403, 'This request did not come from the dashboard.')
  }

  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  if (!body || typeof body !== 'object')
    return failure(400, 'A JSON body is required.')

  try {
    return await handle(body)
  }
  catch (error) {
    const status = (error as { status?: number })?.status
    return failure(typeof status === 'number' && status >= 400 ? status : 500, (error as Error)?.message || 'That did not work.')
  }
}

export function projectSwitcherRoutes(options: ProjectRoutesOptions): Record<string, RouteHandler> {
  return {
    '/__buddy/projects': () => {
      const keepAliveMs = options.idleExitMs > 0 ? Math.max(5_000, Math.min(60_000, Math.floor(options.idleExitMs / 3))) : null
      return Response.json({ ok: true, ...listSwitcherProjects(options), keepAliveMs } satisfies SwitcherListing)
    },

    // Any request counts as use; this one exists so an open page that is only
    // being read has something to send.
    '/__buddy/alive': () => new Response(null, { status: 204 }),

    '/__buddy/projects/open': request => guardedWrite(request, options, async (body) => {
      const project = listProjects().find(candidate => candidate.id === body.id)
      if (!project)
        return failure(404, 'That project is no longer on this machine\'s list.')

      const { url } = await options.openDashboard(project.path)
      // Used just now: it moves to the top of the list.
      registerProject(project.path)
      return Response.json({ ok: true, url })
    }),

    '/__buddy/projects/add': request => guardedWrite(request, options, async (body) => {
      const typed = typeof body.path === 'string' ? body.path.trim() : ''
      if (!typed)
        return failure(422, 'Enter the path of a Stacks project.')

      const expanded = typed === '~' || typed.startsWith('~/') ? join(homedir(), typed.slice(1)) : typed
      // Anywhere inside the project will do, the way it does for `buddy`.
      const root = findProjectRoot(resolve(expanded))
      const project = root ? registerProject(root) : null
      if (!project)
        return failure(422, `There is no Stacks project at ${typed}.`)

      return Response.json({ ok: true, project: { id: project.id, name: project.name, path: displayPath(project.path) } })
    }),
  }
}

export interface IdleExit {
  /** Note that the server was just used. */
  touch: () => void
  stop: () => void
}

/**
 * Call `onIdle` once the server has gone `idleMs` without a `touch`.
 *
 * A dashboard the background daemon started is nobody's terminal session:
 * left alone it would hold its memory until the machine restarts, and so
 * would the next project's, and the one after. This is what lets it go.
 *
 * A laptop that slept did not sit idle. The clock jumps while the page that
 * was open had no chance to say so, so a gap between two checks much longer
 * than the interval between them counts as a touch.
 */
export function createIdleExit(idleMs: number, onIdle: () => void, now: () => number = Date.now): IdleExit {
  if (!(idleMs > 0))
    return { touch: () => {}, stop: () => {} }

  const checkEveryMs = Math.max(250, Math.min(60_000, Math.floor(idleMs / 4)))
  let lastUsed = now()
  let lastCheck = lastUsed

  const timer = setInterval(() => {
    const time = now()
    if (time - lastCheck > checkEveryMs * 3)
      lastUsed = time
    lastCheck = time

    if (time - lastUsed >= idleMs) {
      clearInterval(timer)
      onIdle()
    }
  }, checkEveryMs)

  return {
    touch: () => {
      lastUsed = now()
    },
    stop: () => clearInterval(timer),
  }
}
