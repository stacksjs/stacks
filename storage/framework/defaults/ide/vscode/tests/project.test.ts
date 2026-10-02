import { describe, expect, it } from 'bun:test'
import {
  argumentHint,
  buddyCommandLine,
  choosePreviewUrl,
  configuredAppPath,
  freeTextCommandLine,
  isLoopbackUrl,
  loadProjectEnv,
  parseBuddyList,
  parseBuddyListJson,
  parseBuddyListText,
  parseDevBannerUrl,
  parseEnvFile,
  pickProjectRoot,
  planPreview,
  resolvePrettyDomain,
} from '../src/project'

describe('parseEnvFile', () => {
  it('reads plain, exported, quoted and commented values', () => {
    const env = parseEnvFile([
      '# a comment',
      'APP_NAME=Stacks',
      'export PORT=3100',
      'APP_URL="my-app.localhost"',
      'QUOTED=\'single # not a comment\'',
      'TRAILING=value # a comment',
      'EMPTY=',
      'not a pair',
      '',
    ].join('\n'))

    expect(env).toEqual({
      APP_NAME: 'Stacks',
      PORT: '3100',
      APP_URL: 'my-app.localhost',
      QUOTED: 'single # not a comment',
      TRAILING: 'value',
      EMPTY: '',
    })
  })

  it('handles CRLF line endings', () => {
    expect(parseEnvFile('PORT=3200\r\nAPP_URL=x.test\r\n')).toEqual({ PORT: '3200', APP_URL: 'x.test' })
  })
})

describe('loadProjectEnv', () => {
  it('lets later dev env files override earlier ones, as @stacksjs/env loads them', () => {
    const files: Record<string, string> = {
      '.env': 'PORT=3000\nAPP_URL=stacks.localhost',
      '.env.local': 'PORT=3100',
      '.env.development.local': 'APP_URL=override.localhost',
    }

    expect(loadProjectEnv(file => files[file])).toEqual({ PORT: '3100', APP_URL: 'override.localhost' })
  })

  it('skips dotenvx ciphertext instead of returning it', () => {
    const env = loadProjectEnv(file => file === '.env' ? 'PORT=3000\nAPP_URL=encrypted:BCx9abc' : undefined)
    expect(env).toEqual({ PORT: '3000' })
  })
})

describe('resolvePrettyDomain', () => {
  it('mirrors buddy dev: a non-loopback APP_URL is a pretty domain', () => {
    expect(resolvePrettyDomain('stacks.localhost')).toBe('stacks.localhost')
    expect(resolvePrettyDomain('https://My-App.test/path')).toBe('my-app.test')
    expect(resolvePrettyDomain('localhost:3000')).toBeNull()
    expect(resolvePrettyDomain('http://127.0.0.1')).toBeNull()
    expect(resolvePrettyDomain(undefined)).toBeNull()
  })
})

describe('configuredAppPath', () => {
  it('prefers APP_PATH, then appPath in config/app.ts, then /', () => {
    const config = 'export default {\n  name: \'x\',\n  appPath: \'/dashboard\',\n}'
    expect(configuredAppPath({ APP_PATH: 'admin' }, config)).toBe('/admin')
    expect(configuredAppPath({}, config)).toBe('/dashboard')
    expect(configuredAppPath({}, 'export default { name: \'x\' }')).toBe('/')
    expect(configuredAppPath({})).toBe('/')
  })
})

describe('planPreview', () => {
  it('defaults to https://stacks.localhost with localhost:3000 behind it', () => {
    expect(planPreview({ env: {} })).toEqual({
      server: { host: 'localhost', port: 3000 },
      candidates: [
        { url: 'https://stacks.localhost', host: 'stacks.localhost', port: 443 },
        { url: 'http://localhost:3000', host: 'localhost', port: 3000 },
      ],
    })
  })

  it('uses PORT, APP_URL and the entry path', () => {
    const plan = planPreview({ env: { PORT: '3140', APP_URL: 'https://shop.test', APP_PATH: '/admin' } })
    expect(plan.server).toEqual({ host: 'localhost', port: 3140 })
    expect(plan.candidates.map(candidate => candidate.url)).toEqual(['https://shop.test/admin', 'http://localhost:3140/admin'])
  })

  it('stays on localhost for STACKS_DEV_LOCALHOST=1, a loopback APP_URL, or the setting', () => {
    const only = (plan: ReturnType<typeof planPreview>) => plan.candidates.map(candidate => candidate.url)
    expect(only(planPreview({ env: { STACKS_DEV_LOCALHOST: '1' } }))).toEqual(['http://localhost:3000'])
    expect(only(planPreview({ env: { APP_URL: 'http://localhost:3000' } }))).toEqual(['http://localhost:3000'])
    expect(only(planPreview({ env: {}, preferLocalhost: true }))).toEqual(['http://localhost:3000'])
  })

  it('ignores a PORT that is not a number', () => {
    expect(planPreview({ env: { PORT: 'abc', STACKS_DEV_LOCALHOST: '1' } }).server.port).toBe(3000)
  })
})

describe('choosePreviewUrl', () => {
  const plan = planPreview({ env: {} })
  const probeOf = (open: string[]) => async (host: string, port: number) => open.includes(`${host}:${port}`)

  it('returns nothing when the frontend port is closed, even if the shared proxy answers', async () => {
    expect(await choosePreviewUrl(plan, probeOf(['stacks.localhost:443']))).toBeUndefined()
  })

  it('prefers the pretty URL when both the server and the proxy answer', async () => {
    expect(await choosePreviewUrl(plan, probeOf(['localhost:3000', 'stacks.localhost:443']))).toBe('https://stacks.localhost')
  })

  it('falls back to localhost when the proxy is down', async () => {
    expect(await choosePreviewUrl(plan, probeOf(['localhost:3000']))).toBe('http://localhost:3000')
  })
})

describe('parseDevBannerUrl', () => {
  it('reads the App/Site line of the buddy dev banner, colors and all', () => {
    const banner = [
      '\u001B[32m➜\u001B[39m  \u001B[1mApp     \u001B[22m:    \u001B[36mhttps://stacks.localhost/dashboard\u001B[39m',
      '  ➜  Site:        https://stacks.localhost',
      '  ➜  API:         https://stacks.localhost/api',
    ].join('\n')

    expect(parseDevBannerUrl(banner)).toBe('https://stacks.localhost/dashboard')
    expect(parseDevBannerUrl('  ➜  Site    :    http://localhost:3001')).toBe('http://localhost:3001')
  })

  it('returns undefined before the banner is printed', () => {
    expect(parseDevBannerUrl('Starting dev server...\n  ➜  API:  http://localhost:3008')).toBeUndefined()
  })
})

const LIST_TEXT = `[env] loaded 33/49 variables from .env

Available Commands:

Development:
  build                Build any of your libraries (packages) for production use
  dev                  Start development server

make:
  make:model           Create a new Model
  make:action          Create a new Action

upgrade:
  upgrade:dependencies Upgrade your dependencies (pantry.yaml & package.json)
  upgrade:bun          Upgrade Bun to the latest version

Total: 6 commands
`

describe('parseBuddyListText', () => {
  it('reads the indented command lines and skips headings and the total', () => {
    expect(parseBuddyListText(LIST_TEXT).map(command => [command.name, command.description])).toEqual([
      ['build', 'Build any of your libraries (packages) for production use'],
      ['dev', 'Start development server'],
      ['make:action', 'Create a new Action'],
      ['make:model', 'Create a new Model'],
      ['upgrade:bun', 'Upgrade Bun to the latest version'],
      ['upgrade:dependencies', 'Upgrade your dependencies (pantry.yaml & package.json)'],
    ])
  })
})

const LIST_JSON = `[env] loaded 33/49 variables from .env
${JSON.stringify({
  commands: [
    { name: 'make:model', description: 'Create a new Model', usage: '$ buddy make:model <name>', arguments: [{ name: 'name', required: true, variadic: false }], options: [] },
    { name: 'dev', description: 'Start development server', usage: '$ buddy dev [server]', arguments: [{ name: 'server', required: false, variadic: false }], options: [] },
    { name: 'rm -rf /; x', description: 'not a command name' },
  ],
  total: 3,
}, null, 2)}`

describe('parseBuddyListJson', () => {
  it('reads the inventory past any leading log line and drops malformed names', () => {
    expect(parseBuddyListJson(LIST_JSON)).toEqual([
      { name: 'dev', description: 'Start development server', usage: 'buddy dev [server]', arguments: [{ name: 'server', required: false, variadic: false }] },
      { name: 'make:model', description: 'Create a new Model', usage: 'buddy make:model <name>', arguments: [{ name: 'name', required: true, variadic: false }] },
    ])
  })

  it('returns undefined for output that is not the JSON inventory', () => {
    expect(parseBuddyListJson(LIST_TEXT)).toBeUndefined()
    expect(parseBuddyListJson('{ not json')).toBeUndefined()
    expect(parseBuddyListJson('{"something":"else"}')).toBeUndefined()
  })

  it('parseBuddyList falls back to the text listing', () => {
    expect(parseBuddyList(LIST_TEXT)).toHaveLength(6)
    expect(parseBuddyList(LIST_JSON)).toHaveLength(2)
  })
})

describe('command lines', () => {
  it('always runs the project ./buddy', () => {
    expect(buddyCommandLine('dev')).toBe('./buddy dev')
    expect(buddyCommandLine('make:model', 'Post')).toBe('./buddy make:model Post')
    expect(buddyCommandLine('dev', ['frontend', '--with-localhost'])).toBe('./buddy dev frontend --with-localhost')
    expect(buddyCommandLine('migrate', '   ')).toBe('./buddy migrate')
  })

  it('refuses a name that is not a buddy command', () => {
    expect(() => buddyCommandLine('dev; rm -rf ~')).toThrow()
    expect(() => buddyCommandLine('')).toThrow()
  })

  it('turns free text into a ./buddy line, dropping a typed buddy/bud/stacks prefix', () => {
    expect(freeTextCommandLine('migrate --diff')).toBe('./buddy migrate --diff')
    expect(freeTextCommandLine('buddy migrate --diff')).toBe('./buddy migrate --diff')
    expect(freeTextCommandLine('./buddy make:model Post')).toBe('./buddy make:model Post')
    expect(freeTextCommandLine('bud test')).toBe('./buddy test')
    expect(freeTextCommandLine('stacks list')).toBe('./buddy list')
    expect(freeTextCommandLine('buddyfile')).toBe('./buddy buddyfile')
    expect(freeTextCommandLine('buddy')).toBe('./buddy')
    expect(freeTextCommandLine('   ')).toBeUndefined()
  })

  it('hints positional arguments', () => {
    expect(argumentHint({
      name: 'x',
      description: '',
      arguments: [
        { name: 'name', required: true, variadic: false },
        { name: 'files', required: false, variadic: true },
      ],
    })).toBe('<name> [files...]')
  })
})

describe('pickProjectRoot', () => {
  const projects = new Set(['/work/app', '/work/other-app'])
  const isProject = (folder: string) => projects.has(folder)

  it('prefers the active editor folder when it is a Stacks project', () => {
    expect(pickProjectRoot(['/work/docs', '/work/app', '/work/other-app'], '/work/other-app', isProject)).toBe('/work/other-app')
  })

  it('falls back to the first Stacks folder', () => {
    expect(pickProjectRoot(['/work/docs', '/work/app'], '/work/docs', isProject)).toBe('/work/app')
    expect(pickProjectRoot(['/work/docs'], undefined, isProject)).toBeUndefined()
  })
})

describe('isLoopbackUrl', () => {
  it('detects URLs that need port forwarding in a remote window', () => {
    expect(isLoopbackUrl('http://localhost:3000')).toBe(true)
    expect(isLoopbackUrl('http://[::1]:3000')).toBe(true)
    expect(isLoopbackUrl('https://stacks.localhost')).toBe(false)
    expect(isLoopbackUrl('not a url')).toBe(false)
  })
})
