import { expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * `runBroadcast(name)` runs the broadcast called `name`, and no other.
 *
 * It took the first file whose path ENDED in `${name}.ts`, so 'Shipped' ran
 * OrderShipped.ts and 'Created' ran whichever of OrderCreated.ts and
 * UserCreated.ts the scan happened to list first.
 */
test('broadcasts are found by their exact name', async () => {
  const project = await mkdtemp(join(tmpdir(), 'stacks-run-broadcast-'))
  try {
    const broadcast = (label: string) => `export default { handle: () => { globalThis.ran = '${label}' } }\n`
    await mkdir(join(project, 'app/Broadcasts/Orders'), { recursive: true })
    await mkdir(join(project, 'app/Broadcasts/Users'), { recursive: true })
    await writeFile(join(project, 'bunfig.toml'), '# no preload\n')
    await writeFile(join(project, 'app/Broadcasts/OrderShipped.ts'), broadcast('OrderShipped'))
    await writeFile(join(project, 'app/Broadcasts/Orders/Created.ts'), broadcast('Orders/Created'))
    await writeFile(join(project, 'app/Broadcasts/Users/Created.ts'), broadcast('Users/Created'))
    await writeFile(join(project, 'app/Broadcasts/Users/Deleted.ts'), broadcast('Users/Deleted'))

    const names = ['OrderShipped', 'Shipped', 'Orders/Created', 'Created', 'Deleted']
    const child = Bun.spawn([process.execPath, `--config=${join(project, 'bunfig.toml')}`, '--no-env-file', join(import.meta.dir, 'fixtures/run-broadcast.ts'), JSON.stringify(names)], {
      cwd: project,
      env: { ...process.env, APP_ENV: 'test' },
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
    expect(code, `${stdout}\n${stderr}`).toBe(0)
    const outcomes = JSON.parse(stdout.trim().split('\n').reverse().find(line => line.startsWith('{'))!)

    expect(outcomes.OrderShipped).toBe('ran OrderShipped')
    expect(outcomes.Shipped).toBe('error Broadcast Shipped not found')
    expect(outcomes['Orders/Created']).toBe('ran Orders/Created')
    expect(outcomes.Created).toMatch(/^error Broadcast Created is ambiguous: (Orders\/Created, Users\/Created|Users\/Created, Orders\/Created)/)
    // A name that is unique in a subdirectory is still found by itself.
    expect(outcomes.Deleted).toBe('ran Users/Deleted')
  }
  finally {
    await rm(project, { recursive: true, force: true })
  }
}, 60_000)
