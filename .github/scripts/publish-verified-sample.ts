import type { AcceptedPublication } from './npm-publication'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { publicationMatchesOriginal, verifyAcceptedPublications } from './npm-publication'

const registry = 'https://registry.npmjs.org'
type Identity = Pick<AcceptedPublication, 'name' | 'version'>
type ReadRegistry = NonNullable<Parameters<typeof publicationMatchesOriginal>[1]>
type Upload = (archive: string, dryRun: boolean) => Promise<{ ok: boolean, code?: string }>

export async function sampleLibraryNames(root: string): Promise<string[]> {
  const names: string[] = []
  for (const folder of ['components', 'functions']) {
    const cwd = join(root, 'storage/framework/libs', folder)
    if (!existsSync(cwd)) continue
    for await (const path of new Bun.Glob('**/package.json').scan({ cwd })) {
      if (path.split(/[\\/]/).includes('node_modules')) continue
      const manifest = await Bun.file(join(cwd, path)).json()
      if (manifest.name && !manifest.private) names.push(manifest.name)
    }
  }
  return names
}

async function uploadWithNpm(archive: string, dryRun: boolean): ReturnType<Upload> {
  const result = Bun.spawnSync([
    'npm', 'publish', archive, '--access', 'public', '--ignore-scripts',
    '--registry', registry, '--fetch-retries=0', '--json', ...(dryRun ? ['--dry-run'] : []),
  ], { stdout: 'pipe', stderr: 'pipe', timeout: 120_000 })
  if (result.exitCode === 0) return { ok: true }
  const code = /npm (?:error|ERR!) code (E[A-Z0-9_]+)/.exec(result.stderr.toString())?.[1]
  return { ok: false, code }
}

export async function publishVerifiedSample(archive: string, identity: Identity, options: {
  dryRun?: boolean
  prior?: readonly AcceptedPublication[]
  read?: ReadRegistry
  upload?: Upload
  budgetMs?: number
  pollMs?: number
} = {}): Promise<void> {
  const { name, version } = identity
  if (!/^@stacksjs\/[a-z0-9-]+$/.test(name) || !/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(version))
    throw new Error('Expected a scoped Stacks sample and its exact version')
  const label = `${name}@${version}`
  const read = options.read ?? fetch
  const upload = options.upload ?? uploadWithNpm
  if (options.dryRun) {
    if (!(await upload(archive, true)).ok) throw new Error(`npm dry-run failed for ${label}`)
    return
  }

  const prior = options.prior?.find(entry => entry.name === name && entry.version === version)
  if (prior) {
    if (!await publicationMatchesOriginal(prior, read)) throw new Error(`The original ${label} is not verified`)
    console.log(`Verified original ${label}; skipping upload`)
    return
  }

  const bytes = new Uint8Array(await Bun.file(archive).arrayBuffer())
  const receipt = {
    name, version,
    integrity: `sha512-${createHash('sha512').update(bytes).digest('base64')}`,
    shasum: createHash('sha1').update(bytes).digest('hex'),
  }
  const metadata = await read(`${registry}/${encodeURIComponent(name)}/${encodeURIComponent(version)}`, { method: 'GET', signal: AbortSignal.timeout(30_000) })
  await metadata.body?.cancel()
  if (metadata.status === 200) {
    if (!await publicationMatchesOriginal(receipt, read)) throw new Error(`Public ${label} differs from the verified archive`)
    console.log(`Verified existing ${label}; skipping upload`)
    return
  }
  if (metadata.status !== 404) throw new Error(`Could not check ${label}: npm HTTP ${metadata.status}`)

  console.log(`Publishing ${label}...\nIntegrity: ${receipt.integrity}\nShasum: ${receipt.shasum}`)
  const result = await upload(archive, false)
  if (!result.ok && result.code && ['E401', 'E403', 'E404', 'ENEEDAUTH', 'EOTP'].includes(result.code))
    throw new Error(`npm rejected trusted publication of ${label} (${result.code}). Check this package's publisher for release.yml.`)
  console.log(result.ok
    ? 'Upload accepted; publication is pending public metadata'
    : 'Upload outcome is pending public verification. Do not send another upload while this version may be staged.')
  await verifyAcceptedPublications([receipt], { read, budgetMs: options.budgetMs, pollMs: options.pollMs })
}

if (import.meta.main) {
  const [archive, name, version] = process.argv.slice(2)
  if (!archive || !name || !version) throw new Error('Expected the verified archive, package name and version')
  const packed = Bun.spawnSync(['tar', '-xOzf', archive, 'package/package.json'], { stdout: 'pipe', stderr: 'pipe' })
  if (packed.exitCode !== 0) throw new Error('Could not read the verified sample manifest')
  const manifest = JSON.parse(packed.stdout.toString()) as Identity
  if (manifest.name !== name || manifest.version !== version)
    throw new Error('The verified archive does not match the sample package identity')
  const path = process.env.STACKS_NPM_RESUME_RECEIPTS
  const prior = path ? await Bun.file(path).json() as AcceptedPublication[] : []
  await publishVerifiedSample(archive, { name, version }, { prior, dryRun: process.env.PUBLISH_DRY_RUN === '1' })
}
