import { describe, expect, it } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const root = resolve('storage/framework/defaults/ai/skills/stacks-technical-diagrams')
const launcher = join(root, 'bin/diagrams')

describe('technical diagrams pinned port', () => {
  it('renders a native ERD without inheriting the application preloader or env file', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'stacks-erd-port-'))
    try {
      await Bun.write(join(directory, 'bunfig.toml'), 'preload = ["./must-not-run.ts"]\n')
      await Bun.write(join(directory, 'must-not-run.ts'), 'throw new Error("Application preload leaked")\n')
      await Bun.write(join(directory, '.env'), 'ARCHIFY_UPDATE_CHECK_DISABLED=0\n')
      const output = join(directory, 'index.html')
      const result = Bun.spawn([launcher, 'render', 'erd', join(root, 'examples/orders.erd.json'), output], { cwd: directory, stdout: 'pipe', stderr: 'pipe' })
      const [status, stderr] = await Promise.all([result.exited, new Response(result.stderr).text()])
      expect({ status, stderr }).toEqual({ status: 0, stderr: '' })
      const html = await Bun.file(output).text()
      expect(html).toContain('Order management schema')
      expect(html).toContain('customer_id')
      expect(html).not.toContain('Application preload leaked')
      const check = Bun.spawn([launcher, 'check', output], { cwd: directory, stdout: 'pipe', stderr: 'pipe' })
      expect(await check.exited).toBe(0)
      expect(JSON.parse(await new Response(check.stdout).text()).ok).toBe(true)
    }
    finally { await rm(directory, { recursive: true, force: true }) }
  }, 30_000)

  it('never schedules an upstream update check during delivery', async () => {
    const { startDeliveryUpdateCheck } = await import(join(root, 'bin/delivery-update.mjs'))
    expect(await startDeliveryUpdateCheck({ env: { ARCHIFY_UPDATE_CHECK_DISABLED: '0' }, checkerPath: '/must-not-run' })).toMatchObject({ status: 'unavailable', reason: 'stacks-pinned-port', noticeRequired: false })
  })
})
