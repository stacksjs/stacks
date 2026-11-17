import { basename } from 'node:path'
import process from 'node:process'

/**
 * What the dashboard layout needs to draw the project switcher on the first
 * paint: the name of the project being served, and whether there is a
 * switcher at all.
 *
 * There is one only on the developer's machine, where `buddy` knows the other
 * projects and can start their dashboards; the dev dashboard server says so
 * by setting `STACKS_DASHBOARD_PROJECTS`. A deployed dashboard serves the one
 * project it was deployed with, and draws nothing here.
 *
 * Node built-ins only: this runs in the layout's server script.
 */
export interface DashboardProjectIdentity {
  enabled: boolean
  name: string
}

export function dashboardProjectIdentity(root: string = process.cwd(), env: Record<string, string | undefined> = process.env): DashboardProjectIdentity {
  return {
    enabled: env.STACKS_DASHBOARD_PROJECTS === '1',
    // The directory name is what a developer calls the project, and it is the
    // name `buddy projects` and `--project` use for it.
    name: basename(root),
  }
}
