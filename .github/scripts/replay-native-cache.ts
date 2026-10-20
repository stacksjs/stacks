/** Replay the original native cache failure without clearing or saving the cache. */
import { createHash } from 'node:crypto'
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, readlinkSync, realpathSync, writeFileSync } from 'node:fs'
import { isAbsolute, join, resolve } from 'node:path'

const root = process.cwd()
const output = resolve('artifacts/native-cache-replay')
mkdirSync(output, { recursive: true })
const cli = process.env.PANTRY_CLI
const expectedVersion = process.env.EXPECTED_PANTRY_VERSION
if (!cli || !isAbsolute(cli) || !expectedVersion)
  throw new Error('The managed Pantry action must provide its CLI path and expected version')

function metadata(relative: string): Record<string, unknown> {
  const path = join(root, relative)
  try {
    const stat = lstatSync(path)
    let target: string | undefined
    let physical: string | undefined
    if (stat.isSymbolicLink()) target = readlinkSync(path)
    try { physical = realpathSync(path) }
    catch { /* A dangling cached link is evidence, not an absent record. */ }
    return { path: relative, mode: stat.mode, uid: stat.uid, gid: stat.gid, inode: stat.ino, links: stat.nlink, bytes: stat.size, modified: stat.mtimeMs, target, physical }
  }
  catch (error) {
    return { path: relative, error: error instanceof Error ? error.message : String(error) }
  }
}

function snapshot(name: string): void {
  const paths = ['pantry/.bin', 'pantry/.bin/git', 'pantry/.bin/git-receive-pack', 'pantry/.bin/git-upload-pack', 'pantry/git-scm.org']
  const directory = join(root, 'pantry/git-scm.org')
  const errors: Array<Record<string, unknown>> = []
  try {
    if (existsSync(directory)) {
      for (const version of readdirSync(directory).sort().slice(0, 30)) {
        for (const suffix of ['', '/bin', '/bin/git', '/libexec', '/libexec/git-core', '/share/pantry/interfaces.json'])
          paths.push(`pantry/git-scm.org/${version}${suffix}`)
      }
    }
  }
  catch (error) {
    errors.push({ path: 'pantry/git-scm.org', listingError: error instanceof Error ? error.message : String(error) })
  }
  writeFileSync(join(output, `${name}.metadata.json`), JSON.stringify([...paths.map(metadata), ...errors], null, 2))
}

const commands: Array<Record<string, unknown>> = []
const proof: Record<string, unknown> = {
  originalRun: 39353534384,
  originalJob: 118403033002,
  originalCache: 9193127862,
  expectedOriginalCacheKey: process.env.ORIGINAL_CACHE_KEY,
  originalCacheHitRequiresJobLogVerification: true,
  originalActionOutcome: process.env.ORIGINAL_ACTION_OUTCOME,
  root,
  cli,
  cliSha256: createHash('sha256').update(readFileSync(cli)).digest('hex'),
  bun: Bun.version,
  commands,
}

function run(name: string, executable: string, args: string[], timeout = 120_000): string {
  const started = Date.now()
  const result = Bun.spawnSync([executable, ...args], { cwd: root, stdout: 'pipe', stderr: 'pipe', timeout })
  writeFileSync(join(output, `${name}.stdout.log`), result.stdout)
  writeFileSync(join(output, `${name}.stderr.log`), result.stderr)
  commands.push({ name, executable, args, exitCode: result.exitCode, signal: result.signalCode, elapsedMs: Date.now() - started })
  if (result.exitCode !== 0) {
    console.error(result.stdout.toString().slice(-6000), result.stderr.toString().slice(-6000))
    throw new Error(`${name} exited with ${result.exitCode}; original cache and full logs are preserved`)
  }
  return result.stdout.toString()
}

try {
  const version = run('cli-version', cli, ['--version'], 10_000).trim()
  proof.cliVersion = version
  if (version !== `pantry ${expectedVersion}` && !version.startsWith(`pantry ${expectedVersion} `))
    throw new Error(`The managed CLI reported ${version}; expected Pantry ${expectedVersion}`)
  snapshot('after-original-action')
  // These are the same four native installs preceding the failed Git/Curl call.
  for (const [index, spec] of ['postgresql.org@17.11', 'mysql.com@26.7.0', 'redis@8.8.0', 'aws.amazon.com/dynamodb-local@3.3.0'].entries()) {
    run(`service-package-${index + 1}`, cli, ['install', spec, '--no-save', '--verbose'])
    snapshot(`after-service-package-${index + 1}`)
  }
  for (const attempt of [1, 2]) {
    snapshot(`before-git-curl-${attempt}`)
    run(`git-curl-${attempt}`, cli, ['install', 'git-scm.org@2.53.0', 'curl.se@8.22.0', '--no-save', '--verbose'])
    snapshot(`after-git-curl-${attempt}`)
  }
  const gitVersion = run('git-version', join(root, 'pantry/.bin/git'), ['--version'], 10_000).trim()
  if (!/^git version 2\.53\.0(?:\s|$)/.test(gitVersion))
    throw new Error(`The cached Git reported ${gitVersion}; expected 2.53.0`)
  proof.gitVersion = gitVersion
  proof.nativeCommandReplayPassed = true
}
catch (error) {
  proof.nativeCommandReplayPassed = false
  proof.error = error instanceof Error ? error.message : String(error)
  throw error
}
finally {
  snapshot('final-cache')
  const git = join(root, 'pantry/.bin/git')
  try {
    const result = Bun.spawnSync([git, '--version'], { cwd: root, stdout: 'pipe', stderr: 'pipe', timeout: 10_000 })
    writeFileSync(join(output, 'final-git-version.stdout.log'), result.stdout)
    writeFileSync(join(output, 'final-git-version.stderr.log'), result.stderr)
    proof.finalGit = { exitCode: result.exitCode, signal: result.signalCode }
  }
  catch (error) {
    proof.finalGit = { error: error instanceof Error ? error.message : String(error) }
  }
  writeFileSync(join(output, 'proof.json'), `${JSON.stringify(proof, null, 2)}\n`)
}
