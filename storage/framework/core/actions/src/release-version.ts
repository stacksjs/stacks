import { incrementVersion, isCiEnvironment, isReleaseType, isValidVersion } from '@stacksjs/bumpx'
import { isCalendarBump, nextCalendarVersion } from './calendar-version'

export function resolveReleaseVersion(current: string | undefined, bump: string, preid?: string): string {
  if (isCalendarBump(bump)) return nextCalendarVersion(current)
  if (!isReleaseType(bump) && !isValidVersion(bump))
    throw new Error(`Invalid --bump "${bump}"; expected a Bumpx release type, calendar, or semantic version`)
  if (!current) throw new Error('Release manifest declares no version')
  return incrementVersion(current, bump, preid)
}

interface ReleaseVersionChoice { label: string, value: string }

/** Collect an explicit version before the release modifies generated files or manifests. */
export async function chooseReleaseVersion(current: string | undefined, options: {
  subject: string
  preid?: string
  choose?: (choices: ReleaseVersionChoice[]) => Promise<string>
  custom?: () => Promise<string>
}): Promise<string> {
  const { subject, preid, choose, custom } = options
  if (!current || !isValidVersion(current)) throw new Error(`The ${subject} release requires a valid project version`)
  if (!choose && (!process.stdin.isTTY || !process.stdout.isTTY || isCiEnvironment()))
    throw new Error(`The ${subject} release needs --bump when stdin is not an interactive terminal`)
  const choices: ReleaseVersionChoice[] = []
  for (const type of ['patch', 'minor', 'major', 'prepatch', 'preminor', 'premajor', 'prerelease', 'pre', 'build', 'release']) {
    try {
      const value = incrementVersion(current, type, preid)
      choices.push({ label: `${type} ${value}`, value })
    }
    catch { /* Bumpx omits increments which do not apply to the current version. */ }
  }
  const calendar = nextCalendarVersion(current)
  choices.push({ label: `calendar ${calendar}`, value: calendar }, { label: 'custom version', value: 'custom' })
  const { select, text } = await import('@stacksjs/cli')
  const selected = choose ? await choose(choices) : await select({ message: `Choose the ${subject} release version:`, choices }) as string
  const version = selected === 'custom' ? custom ? await custom() : await text('Enter the new version:') : selected
  if (!version || !isValidVersion(version)) throw new Error('Release selection requires a valid semantic version')
  return version
}
