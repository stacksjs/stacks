import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const skill = readFileSync(
  resolve('storage/framework/defaults/ai/skills/stacks-dashboard/SKILL.md'),
  'utf8',
)
const developmentSkill = readFileSync(
  resolve('storage/framework/defaults/ai/skills/stacks-development/SKILL.md'),
  'utf8',
)
const stxSkill = readFileSync(
  resolve('storage/framework/defaults/ai/skills/stacks-stx/SKILL.md'),
  'utf8',
)

describe('dashboard skill contract', () => {
  test('documents root-mounted page routes and dashboard-prefixed APIs', () => {
    expect(skill).toContain('Do not prefix\npage links with `/dashboard`')
    expect(skill).toContain('The `/api/dashboard/*` prefix is reserved for')
    expect(skill).toContain('- `/commerce/products` - product management')
    expect(skill).toContain('- `/content/posts` - blog post CRUD')
    expect(skill).toContain('- `/settings` - typed `config/*.ts` browser and editor')
    expect(skill).not.toContain('/dashboard/commerce/products')
    expect(skill).not.toContain('/dashboard/content/posts')
    expect(skill).not.toContain('/dashboard/settings/app')
  })

  test('documents canonical component build and deployment behavior', () => {
    expect(skill).toContain('buddy build components       # build component libraries')
    expect(skill).toContain('`buddy build:components` remains the direct command alias')
    expect(skill).toContain('GET|PUT /api/dashboard/deployments/script')
    expect(skill).toContain('GET /api/dashboard/deployments/terminal')
    expect(skill).toContain('pauses polling while the document')
  })

  test('documents native rendered shell caching boundaries', () => {
    expect(skill).toContain("`renderCache: true`, `renderCacheVary: 'source'`")
    expect(skill).toContain('four prewarm workers')
    expect(skill).toContain('set `const __stx_skip_cache = true`')
    expect(skill).toContain('Dynamic file routes remain uncached')
  })

  test('documents the complete live dashboard audit', () => {
    expect(skill).toContain('scripts/audit.ts')
    expect(skill).toContain('--base-url http://127.0.0.1:3002')
    expect(skill).toContain('both a full\ndocument and an `X-STX-Router` fragment')
    expect(skill).toContain('crawls every registered GET\ndashboard API')
    expect(skill).toContain('HTTP-200 error payloads')
  })

  test('documents component and native input case semantics', () => {
    expect(stxSkill).toContain('**Component tag case is semantic**')
    expect(stxSkill).toContain('<Input v-model:value=\"query\">')
    expect(stxSkill).toContain('<input v-model=\"query\">')
  })

  test('documents server import aliases and browser bundle boundaries', () => {
    expect(stxSkill).toContain('**Project-root server imports**')
    expect(stxSkill).toContain('use `~/path` or `@/path` inside `<script server>`')
    expect(stxSkill).toContain('**Browser package inputs are bundled**')
    expect(stxSkill).toContain('must never contain a bare `import \'@stacksjs/browser\'`')
    expect(stxSkill).toContain('**Server-to-client values are explicit**')
  })

  test('keeps generated guidance free of separator dash typography', () => {
    expect(skill).not.toContain('—')
    expect(skill).not.toContain('–')
  })

  test('documents the same-origin dashboard config API', () => {
    expect(developmentSkill).toContain('Mounts the config API on the same dashboard origin')
    expect(developmentSkill).toContain('atomically modifies top-level scalar literals')
    expect(developmentSkill).not.toContain('Config API runs on `dashboardPort + 1`')
    expect(developmentSkill).not.toContain('dashboard config API (port 3003)')
  })

  test('documents the shared client and direct-handler CSRF boundary', () => {
    expect(skill).toContain('Use the shared `dashboardApi()` client for every dashboard network request')
    expect(skill).toContain('Do not call `fetch()` directly')
    expect(skill).toContain('Pass `auth: false` only for a deliberately public route')
    expect(skill).toContain('call\n`validateDevCsrfRequest()` before reading or mutating state')
  })

  test('keeps dashboard client and server imports in their native runtimes', () => {
    expect(developmentSkill).toContain('framework server helpers use explicit imports')
    expect(developmentSkill).toContain('Leaves `resources/functions` to the STX client auto-import pipeline')
  })
})
