import { dts } from 'bun-plugin-dtsx'
import { frameworkExternal, intro, outro } from '../build/src'

const { startTime } = await intro({
  dir: import.meta.dir,
})

/**
 * Compile the server entrypoint into a standalone binary using
 * `bun build --compile`.
 *
 * Targets:
 * - Default: host platform (`bun-darwin-arm64` on dev machines). Always
 *   succeeds because the runtime asset is the same Bun the developer is
 *   already running.
 * - When `STACKS_SERVER_TARGETS` is set (comma-separated, e.g.
 *   `bun-linux-x64,bun-linux-arm64`), each target gets its own output
 *   binary. CI sets this for production deploys (AWS ECS Fargate is
 *   linux/x64 by default, ARM64 for Graviton).
 *
 * Cross-compile assets are downloaded by Bun on first use; canary builds
 * sometimes don't have a published cross-target asset, in which case this
 * was previously a hard failure that broke the whole framework build. Now:
 * an unavailable cross-target logs a warning and falls through, while the
 * host build still produces a usable binary for local testing. Production
 * runs use a stable Bun release where every target is available, so the
 * warning never fires there.
 */

const requestedTargets = (process.env.STACKS_SERVER_TARGETS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean)

// Compile standalone binaries ONLY when targets are explicitly requested —
// deploys set STACKS_SERVER_TARGETS (e.g. `bun-linux-x64`). A normal package
// build/publish requests nothing and ships ONLY the library entry
// (dist/index.js); the ~90 MB host binary must never land in the npm tarball
// (it embeds the whole Bun runtime and is rebuilt fresh at deploy time).
const targets = requestedTargets

const externalArgs: string[] = []
for (const ext of frameworkExternal()) {
  externalArgs.push('--external', ext)
}

const failures: string[] = []
const successes: string[] = []

if (targets.length === 0) {
  console.log('[server/build] no STACKS_SERVER_TARGETS set — skipping standalone binary compile (library-only build)')
}

for (const target of targets) {
  const isHost = target === 'host'
  const outfile = isHost ? './dist/server' : `./dist/server-${target.replace(/^bun-/, '')}`
  const args = ['build', '--compile', '--minify', '--sourcemap']
  if (!isHost) args.push(`--target=${target}`)
  args.push(...externalArgs, './src/start.ts', '--outfile', outfile)

  console.log(`[server/build] compiling ${target} → ${outfile}`)
  const proc = Bun.spawn(['bun', ...args], { stdout: 'pipe', stderr: 'pipe' })
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])

  if (exitCode === 0) {
    successes.push(target)
    continue
  }

  // Cross-compile asset not published for this Bun version — log and skip
  // the target rather than failing the whole framework build.
  const combined = `${stdout}\n${stderr}`
  if (/Target platform .* is not available for download/i.test(combined)) {
    console.warn(`[server/build] ${target} cross-compile unavailable for this Bun version; skipping`)
    failures.push(`${target} (cross-compile asset unavailable)`)
    continue
  }

  // Anything else is a real build error — surface it.
  console.error(stdout)
  console.error(stderr)
  throw new Error(`bun build for ${target} exited with code ${exitCode}`)
}

if (targets.length > 0 && successes.length === 0) {
  throw new Error(
    `[server/build] all targets failed: ${failures.join(', ')}`,
  )
}

console.log(`✓ Server compiled for: ${successes.join(', ')}`)
if (failures.length > 0) {
  console.log(`  (skipped: ${failures.join(', ')})`)
}

// The standalone binary above is one artifact; the package also has a library
// entry (`@stacksjs/server`'s `.` export — maintenanceGate, proxyToBackend,
// injectGlobalAutoImports, …) that `buddy serve` imports. Build it to
// dist/index.js so npm consumers resolve it.
console.log('[server/build] building library entry → ./dist/index.js')
await Bun.build({
  entrypoints: ['./src/index.ts'],
  outdir: './dist',
  root: './src',
  target: 'bun',
  format: 'esm',
  external: frameworkExternal(),
  plugins: [dts({ root: './src', outdir: './dist' })],
})

await outro({
  dir: import.meta.dir,
  startTime,
  result: { errors: [], warnings: [] },
})
