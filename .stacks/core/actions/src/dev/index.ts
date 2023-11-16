import { log } from '@stacksjs/logging'
import { runCommand } from '@stacksjs/cli'
import type { DevOptions } from '@stacksjs/types'
import { Action, NpmScript } from '@stacksjs/types'
import { runAction } from '../helpers'

export async function runDevServer(options: DevOptions) {
  log.info('Starting your Frontend Engine...')
  await runAction(Action.Dev, options)
}

export async function runFrontendDevServer(options: DevOptions) {
  log.info('Starting your UI Engine...')
  await runAction(Action.DevViews, options)
}

export async function runBackendDevServer(options: DevOptions) {
  log.info('Starting your API...')
  await runAction(Action.DevApi, options)
}

export async function runApiDevServer(options: DevOptions) {
  log.info('Starting your API...')
  await runAction(Action.DevApi, options)
}

export async function runComponentsDevServer(options: DevOptions) {
  log.info('Starting your Library Engine...')
  await runAction(Action.DevComponents, options)
}

export async function runDesktopDevServer(options: DevOptions) {
  log.info('Starting your Desktop Engine...')
  await runCommand(NpmScript.DevDesktop, options)
}

export async function runDocsDevServer(options: DevOptions) {
  log.info('Starting your Docs Engine...')
  await runAction(Action.DevDocs, options)
}
