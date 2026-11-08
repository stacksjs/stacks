import { expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

test('the native unsubscribe action typechecks without scaffold ambient declarations', async () => {
  const root = resolve(import.meta.dir, '../../../../..')
  const fixture = mkdtempSync(join(tmpdir(), 'stacks-action-types-'))
  try {
    writeFileSync(join(fixture, 'consumer.ts'), `import action from ${JSON.stringify(join(root, 'storage/framework/defaults/app/Actions/UnsubscribeAction.ts'))}\nvoid action\n`)
    writeFileSync(join(fixture, 'tsconfig.json'), JSON.stringify({
      compilerOptions: { target: 'ESNext', module: 'ESNext', moduleResolution: 'Bundler', strict: true, noEmit: true, skipLibCheck: true, allowImportingTsExtensions: true, types: ['bun'], typeRoots: [join(root, 'node_modules/@types')] },
      files: ['consumer.ts'],
    }))
    const child = Bun.spawn([process.execPath, join(root, 'node_modules/typescript/bin/tsc'), '--project', join(fixture, 'tsconfig.json'), '--pretty', 'false'], { cwd: fixture, stdout: 'pipe', stderr: 'pipe' })
    const [status, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
    expect(status, `${stdout}\n${stderr}`).toBe(0)
  }
  finally { rmSync(fixture, { recursive: true }) }
}, 30000)
