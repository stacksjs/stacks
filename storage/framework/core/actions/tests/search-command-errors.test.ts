import { expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test('search maintenance scripts propagate provider failures to their exit status', async () => {
  const root = mkdtempSync(join(tmpdir(), 'stacks-search-exit-'))
  try {
    for (const action of ['import', 'flush', 'settings', 'settings-list']) {
      for (const failed of [false, true]) {
        const built = await Bun.build({
          entrypoints: [new URL(`../src/search/${action}.ts`, import.meta.url).pathname],
          outdir: root,
          target: 'bun',
          plugins: [{
            name: 'search-provider-fixture',
            setup(build) {
              build.onResolve({ filter: /^@stacksjs\/(?:cli|logging|search-engine)$/ }, args => ({ path: args.path, namespace: 'fixture' }))
              build.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({
                contents: args.path.endsWith('/cli')
                  ? 'export const parseOptions = () => ({model:"Repository"})'
                  : args.path.endsWith('/logging')
                    ? 'export const log = {error:async()=>{}}'
                    : `const result={isErr:${failed},error:"search provider refused the request"}; export const importModelDocuments=async()=>result; export const flushModelDocuments=async()=>result; export const updateIndexSettings=async()=>result; export const listIndexSettings=async()=>result;`,
                loader: 'js',
              }))
            },
          }],
        })
        expect(built.success).toBe(true)
        const child = Bun.spawnSync([process.execPath, built.outputs[0]!.path], { cwd: root, stdout: 'pipe', stderr: 'pipe' })
        expect(child.exitCode).toBe(failed ? 1 : 0)
        if (failed) expect(child.stderr.toString()).toContain('search provider refused the request')
      }
    }
  }
  finally {
    rmSync(root, { recursive: true, force: true })
  }
}, 30_000)
