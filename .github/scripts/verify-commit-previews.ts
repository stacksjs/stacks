import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const sha = process.env.STACKS_PREVIEW_SHA ?? ''
if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error('Set STACKS_PREVIEW_SHA to the published pull request head SHA')
const revision = sha.slice(0, 7)
const directory = mkdtempSync(join(tmpdir(), 'stacks-preview-consumer-'))

function bun(args: string[]) {
  const result = Bun.spawnSync([process.execPath, '--no-env-file', ...args], {
    cwd: directory, stdout: 'inherit', stderr: 'inherit',
    env: {
      ...process.env, APP_ENV: 'test', DB_CONNECTION: 'sqlite', DB_DATABASE_PATH: join(directory, 'auth.sqlite'),
    },
  })
  if (result.exitCode !== 0) throw new Error(`bun ${args.join(' ')} failed with exit ${result.exitCode}`)
}

try {
  const dependencies = Object.fromEntries(['auth', 'support'].map(pkg => [
    `@stacksjs/${pkg}`, `https://pkg.pr.new/@stacksjs/${pkg}@${revision}`,
  ]))
  writeFileSync(join(directory, 'package.json'), JSON.stringify({ name: 'stacks-preview-consumer', private: true, type: 'module', dependencies }))
  writeFileSync(join(directory, 'probe.ts'), `
    for (const name of [
      '@stacksjs/auth',
      '@stacksjs/auth/enterprise-oidc',
      '@stacksjs/auth/enterprise-saml',
      '@stacksjs/support',
      '@stacksjs/support/server',
      '@stacksjs/support/browser',
      '@stacksjs/support/testing',
    ]) {
      const api = await import(name)
      if (Object.keys(api).length === 0) throw new Error('No exports from ' + name)
      console.log('Loaded ' + name)
    }
  `)
  bun(['install', '--ignore-scripts'])
  bun(['install', '--frozen-lockfile', '--ignore-scripts'])
  // A newly available npm release must not hide a broken preview link.
  for (const [consumer, peers] of Object.entries({ orm: ['payments'], types: ['actions', 'scheduler'] })) {
    const manifest = JSON.parse(readFileSync(join(directory, 'node_modules/@stacksjs', consumer, 'package.json'), 'utf8'))
    for (const peer of peers) {
      const link: unknown = manifest.dependencies?.[`@stacksjs/${peer}`]
      if (typeof link !== 'string' || !link.startsWith('https://pkg.pr.new/') || !link.endsWith(`/@stacksjs/${peer}@${revision}`))
        throw new Error(`@stacksjs/${consumer} is missing the same-commit preview link for @stacksjs/${peer}`)
    }
  }
  bun(['run', 'probe.ts'])
}
finally {
  rmSync(directory, { recursive: true, force: true })
}
