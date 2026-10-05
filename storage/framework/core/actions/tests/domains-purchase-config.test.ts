import { afterEach, beforeEach, expect, it } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * `buddy domains:purchase` read `config.dns.contactInfo` at import. That is
 * before the app's config/dns.ts has loaded, so it saw the framework default -
 * no contact info - and exited with "You must provide contact info" for every
 * app that had provided it.
 *
 * Run without a domain, the action should get past the contact check and stop
 * at the next one, which is the observable proof that it read the app's config.
 */
let project: string

beforeEach(async () => {
  project = await mkdtemp(join(tmpdir(), 'stacks-domains-purchase-'))
  await mkdir(join(project, 'config'), { recursive: true })
  await writeFile(join(project, 'bunfig.toml'), '# no preload\n')
})

afterEach(async () => {
  await rm(project, { recursive: true, force: true })
})

async function run(): Promise<string> {
  const child = Bun.spawn([process.execPath, `--config=${join(project, 'bunfig.toml')}`, '--no-env-file', join(import.meta.dir, '../src/domains/purchase.ts')], {
    cwd: project,
    env: { ...process.env, APP_ENV: 'local' },
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const [, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
  return `${stdout}${stderr}`
}

it('reads the contact info config/dns.ts provides', async () => {
  await writeFile(join(project, 'config/dns.ts'), `export default {
  driver: 'aws', a: [], aaaa: [], cname: [], mx: [], txt: [],
  contactInfo: { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', countryCode: 'GB' },
}
`)
  const output = await run()

  expect(output).not.toContain('You must provide contact info')
  expect(output).toContain('You must provide a domain name to purchase')
}, 60_000)

it('still refuses when there is no contact info', async () => {
  const output = await run()

  expect(output).toContain('You must provide contact info')
}, 60_000)
