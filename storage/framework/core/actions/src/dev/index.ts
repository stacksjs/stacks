import type { DevOptions } from '@stacksjs/types'
import { Action } from '@stacksjs/enums'
import { runAction } from '../helpers'

export async function runDevServer(options: DevOptions): Promise<void> {
  await runAction(Action.Dev, options)
}

export async function runFrontendDevServer(options: DevOptions): Promise<void> {
  await runAction(Action.Dev, options)
}

export async function runBackendDevServer(options: DevOptions): Promise<void> {
  runApiDevServer(options)
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
