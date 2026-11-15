import type { DevOptions } from '@stacksjs/types'
import { Action } from '@stacksjs/enums'
import { runAction } from '../helpers'

export async function runDevServer(options: DevOptions): Promise<void> {
  await runAction(Action.Dev, options)
}

/**
 * Start the frontend dev server, and fail when it does not start.
 *
 * The views entry is imported in this process, so `runAction` reports a module
 * that could not load (an STX older than the framework expects, say) as an
 * `err` result. That result used to be dropped here: `buddy dev:frontend`
 * printed nothing, exited 0 and left no server, and `buddy dev` announced a
 * frontend URL that never answered.
 */
export async function runFrontendDevServer(options: DevOptions): Promise<void> {
  const result = await runAction(Action.Dev, options)
  if (result.isErr)
    throw result.error
}

export async function runBackendDevServer(options: DevOptions): Promise<void> {
  await runApiDevServer(options)
}

export async function runApiDevServer(options: DevOptions): Promise<void> {
  await runAction(Action.DevApi, options)
}

export async function runComponentsDevServer(options: DevOptions): Promise<void> {
  await runAction(Action.DevComponents, options)
}

export async function runDashboardDevServer(options: DevOptions): Promise<void> {
  await runAction(Action.DevDashboard, options)
}

export async function runSystemTrayDevServer(options: DevOptions): Promise<void> {
  await runAction(Action.DevSystemTray, options)
}

export async function runDesktopDevServer(options: DevOptions): Promise<void> {
  await runAction(Action.DevDesktop, options)
}

export async function runDocsDevServer(options: DevOptions): Promise<void> {
  await runAction(Action.DevDocs, options)
}
