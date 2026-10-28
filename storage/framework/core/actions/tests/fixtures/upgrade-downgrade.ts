// Runs the real package upgrade against an in-process registry, so the test
// sees exactly what `buddy upgrade` prints and writes without the network.
// The registry is the shape #3011 was found on: stacks@0.75.318 ships an
// actions manifest pinning @stacksjs/stx 0.2.691.
import process from 'node:process'
import { upgradeStacksPackages } from '../../src/upgrade/packages'

const target = '0.75.318'
const stx = '0.2.691'
const documents: Record<string, unknown> = {
  'https://registry.npmjs.org/stacks': {
    'dist-tags': { latest: target },
    'versions': { [target]: { dependencies: { '@stacksjs/actions': target } } },
  },
  [`https://registry.npmjs.org/@stacksjs%2factions/${target}`]: { version: target, dependencies: { '@stacksjs/stx': stx, '@stacksjs/components': stx } },
  [`https://registry.npmjs.org/@stacksjs%2fstx/${stx}`]: { name: '@stacksjs/stx', version: stx, dependencies: {} },
}
globalThis.fetch = (async (input: string | URL | Request) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  const document = documents[url]
  return document ? Response.json(document) : new Response('not found', { status: 404 })
}) as typeof fetch

const flags = new Set(process.argv.slice(2))
await upgradeStacksPackages(process.cwd(), {
  dryRun: flags.has('--dry-run'),
  allowDowngrade: flags.has('--allow-downgrade'),
  noPostinstall: true,
})
