import type { AcceptedPublication } from './npm-publication'
import { join } from 'node:path'
import { assertNpmLatestMayAdvance, npmLatestVersion } from './npm-publication'
import { inParallel, PROMOTE_CONCURRENCY, publishables } from './promote-latest'
import { sampleLibraryNames } from './publish-verified-sample'

type Identity = Pick<AcceptedPublication, 'name' | 'version'>
type ReadLatestTag = NonNullable<Parameters<typeof npmLatestVersion>[2]>
type ReleaseTag = 'latest' | `backfill-${string}`

export async function npmReleaseChannel(packages: readonly Identity[], version: string, read: ReadLatestTag = fetch): Promise<ReleaseTag> {
  const newer = await inParallel(packages, PROMOTE_CONCURRENCY, async (pkg) => {
    const latest = await npmLatestVersion(pkg.name, undefined, read)
    return latest !== undefined && Bun.semver.order(latest, pkg.version) > 0
  })
  return newer.some(Boolean) ? `backfill-${version}` : 'latest'
}

if (import.meta.main) {
  const [flag, directory] = process.argv.slice(2)
  if (flag === '--check-latest' && directory) {
    const pkg: Identity = await Bun.file(join(directory, 'package.json')).json()
    await assertNpmLatestMayAdvance(pkg)
  }
  else if (flag === undefined) {
    const root = process.cwd()
    const umbrella: Identity = await Bun.file(join(root, 'storage/framework/core/package.json')).json()
    const version = /^refs\/tags\/v(\d+\.\d+\.\d+(?:-[\w.-]+)?)$/.exec(process.env.GITHUB_REF ?? '')?.[1]
    if (!version || umbrella.name !== 'stacks' || umbrella.version !== version)
      throw new Error('Expected the tagged Stacks package and its exact release version')
    const samples = (await sampleLibraryNames(root)).map(name => ({ name, version }))
    const tag = await npmReleaseChannel([umbrella, ...await publishables(root), ...samples], version)
    process.stdout.write(`${tag}\n`)
  }
  else {
    throw new Error('Expected --check-latest <package-directory> or a tagged release checkout')
  }
}
