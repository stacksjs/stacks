// Runs the real package upgrade against an in-process Bun registry, so the
// test sees exactly what buddy prints and writes without a live registry.
import { writeFileSync } from 'node:fs'
import process from 'node:process'
import { upgradeStacksPackages } from '../../src/upgrade/packages'

const target = '0.75.318'
const stx = '0.2.691'
const manifests = {
  'stacks': { version: target, dependencies: { '@stacksjs/actions': target } },
  '@stacksjs/actions': { version: target, dependencies: { '@stacksjs/stx': stx, '@stacksjs/components': stx }, peerDependencies: { 'craft-native': '>=0.0.443' } },
  '@stacksjs/stx': { version: stx, dependencies: {} },
  '@stacksjs/components': { version: stx },
  'craft-native': { version: '0.0.443' },
  '@craft-native/ios': { version: '0.0.443' },
}

const registry = Bun.serve({
  hostname: '127.0.0.1',
  port: 0,
  fetch(request) {
    const name = decodeURIComponent(new URL(request.url).pathname.slice(1))
    const metadata = manifests[name as keyof typeof manifests]
    if (!metadata) return new Response('not found', { status: 404 })
    return Response.json({
      'name': name,
      'dist-tags': { latest: metadata.version },
      'versions': { [metadata.version]: { name, ...metadata } },
    })
  },
})
writeFileSync('bunfig.toml', `[install]\nregistry = ${JSON.stringify(registry.url.origin)}\n`)
writeFileSync('.npmrc', `@stacksjs:registry=${registry.url.origin}\n@craft-native:registry=${registry.url.origin}\n`)

try {
  const flags = new Set(process.argv.slice(2))
  await upgradeStacksPackages(process.cwd(), {
    dryRun: flags.has('--dry-run'),
    allowDowngrade: flags.has('--allow-downgrade'),
    noPostinstall: true,
  })
}
finally {
  registry.stop(true)
}
