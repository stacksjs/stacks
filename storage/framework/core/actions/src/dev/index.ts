import { log } from '@stacksjs/logging'
import type { DevOptions } from '@stacksjs/types'
import { Action } from '@stacksjs/enums'
import { runAction } from '../helpers'

export async function runDevServer(options: DevOptions) {
  log.info('Starting your Frontend Engine...')
  await runAction(Action.Dev, options)
}

export async function runFrontendDevServer(options: DevOptions) {
  log.info('Starting your UI Engine...')
  await runAction(Action.Dev, options)
}

export async function runBackendDevServer(options: DevOptions) {
  runApiDevServer(options)
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
  await runAction(Action.DevDesktop, options)
}

export async function runDocsDevServer(options: DevOptions) {
  log.info('Starting your Docs Engine...')
  await runAction(Action.DevDocs, options)
}
