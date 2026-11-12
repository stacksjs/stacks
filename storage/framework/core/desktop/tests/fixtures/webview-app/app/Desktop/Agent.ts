import type { WebviewAgentModule } from '@stacksjs/desktop-build'
import { appendFileSync } from 'node:fs'
import process from 'node:process'

/**
 * The fixture's agent: one API route, and a line in a file for each thing the
 * launcher tells it, so a test can see what a real launch did.
 */
const record = (line: string): void => {
  if (process.env.WEBVIEW_FIXTURE_LOG) appendFileSync(process.env.WEBVIEW_FIXTURE_LOG, `${line}\n`)
}

export default {
  fetch(request, context) {
    const url = new URL(request.url)
    if (url.pathname === '/api/hello') {
      // The first PATH entry shows whether the launcher widened a bare PATH.
      record(`hello ${(process.env.PATH ?? '').split(':')[0]}`)
      return Response.json({ app: context.appName, version: context.version, path: process.env.PATH })
    }
    return undefined
  },
  start(context) {
    record(`start ${context.origin} ${JSON.stringify(context.launch.args)}`)
  },
  secondInstance(launch) {
    record(`second ${JSON.stringify(launch.args)} ${launch.url ?? ''}`)
  },
  stop() {
    record('stop')
  },
} satisfies WebviewAgentModule
