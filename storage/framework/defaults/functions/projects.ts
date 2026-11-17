import { dashboardApi } from './dashboard-api'

/**
 * The project switcher's client.
 *
 * A dashboard serves one project. The other projects on the machine each have
 * a dashboard of their own, at their own address, and switching is going
 * there. These calls reach the dev dashboard's own `/__buddy/` routes
 * (`core/actions/src/dev/dashboard-projects.ts`), which know the machine's
 * project list and can bring another project's dashboard up.
 */

export interface SwitcherProject {
  id: string
  name: string
  /** As a person would write it: `~/Code/shop`. */
  path: string
  current: boolean
  /** Whether a dashboard for it is up right now. */
  running: boolean
  url: string | null
}

export interface SwitcherListing {
  current: SwitcherProject
  projects: SwitcherProject[]
  /** How often an open page should report in, or null when it need not. */
  keepAliveMs: number | null
}

export function fetchProjects(signal?: AbortSignal): Promise<SwitcherListing> {
  return dashboardApi<SwitcherListing>('/__buddy/projects', { signal })
}

/**
 * Bring a project's dashboard up and return its address. Resolves once it is
 * answering, which takes a few seconds the first time.
 */
export async function openProject(id: string): Promise<string> {
  const { url } = await dashboardApi<{ url: string }>('/__buddy/projects/open', { method: 'POST', body: { id } })
  return url
}

/** Put the project at `path` on the machine's list. */
export async function addProject(path: string): Promise<SwitcherProject> {
  const { project } = await dashboardApi<{ project: Pick<SwitcherProject, 'id' | 'name' | 'path'> }>('/__buddy/projects/add', { method: 'POST', body: { path } })
  return { ...project, current: false, running: false, url: null }
}

/**
 * Tell the server this page is still open. A dashboard started in the
 * background stops itself when nothing has asked it for anything in a while,
 * and a page that is only being read asks for nothing.
 */
function reportAlive(): void {
  void fetch('/__buddy/alive', { credentials: 'same-origin' }).catch(() => {})
}

/**
 * Go to another project's dashboard. Its home page, not the page the user is
 * on: a record, a setting or a whole section here may not exist there.
 */
export function goToProject(url: string): void {
  window.location.assign(new URL('/', url).href)
}

/**
 * Report in every `everyMs` until the returned function is called. A no-op
 * when the server does not ask for it.
 */
export function keepAlive(everyMs: number | null): () => void {
  if (!everyMs || everyMs <= 0)
    return () => {}

  const timer = setInterval(reportAlive, everyMs)
  return () => clearInterval(timer)
}

/**
 * Where a project lives: the folder that holds it. Its own name is already on
 * the line above, and in a narrow menu the end of a long path is what gets cut
 * off, which is the only part that tells two projects apart.
 */
export function projectLocation(path: string): string {
  const cut = path.lastIndexOf('/')
  return cut > 0 ? path.slice(0, cut) : path
}

/** The projects whose name or path contains every word typed. */
export function filterProjects(projects: SwitcherProject[], query: string): SwitcherProject[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0)
    return projects

  return projects.filter((project) => {
    const haystack = `${project.name} ${project.path}`.toLowerCase()
    return words.every(word => haystack.includes(word))
  })
}
