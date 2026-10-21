import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { runProjectScripts } from './project-scripts'

export const publicationChannels = ['web', 'preview', 'desktop', 'ios', 'android', 'github-release'] as const
export type PublicationChannel = typeof publicationChannels[number]
export const PUBLICATION_CHECK_SCRIPT = 'publication:check'

/** A declared application policy is mandatory before any publication mutation. */
export async function assertPublicationAllowed(options: { cwd: string, channel: PublicationChannel, signal?: AbortSignal }) {
  if (!publicationChannels.includes(options.channel)) throw new Error('Unknown publication channel')
  const pkg = JSON.parse(readFileSync(join(options.cwd, 'package.json'), 'utf8')) as { scripts?: Record<string, unknown> }
  if (!Object.hasOwn(pkg.scripts ?? {}, PUBLICATION_CHECK_SCRIPT))
    return { status: 'not-configured' as const, channel: options.channel }
  if (typeof pkg.scripts?.[PUBLICATION_CHECK_SCRIPT] !== 'string' || !pkg.scripts[PUBLICATION_CHECK_SCRIPT].trim())
    throw new Error('publication:check must declare a nonempty application policy')
  const checks = await runProjectScripts({
    cwd: options.cwd, scripts: [PUBLICATION_CHECK_SCRIPT], signal: options.signal,
    env: { STACKS_PUBLICATION_CHANNEL: options.channel },
  })
  return { status: 'passed' as const, channel: options.channel, ...checks }
}
