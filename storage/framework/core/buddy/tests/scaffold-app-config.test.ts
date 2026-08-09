import { describe, expect, test } from 'bun:test'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const APP_CONFIG = join(import.meta.dir, '../../../defaults/scaffold/config')
const CREATE_COMMAND = join(import.meta.dir, '../src/commands/create.ts')

const templates = existsSync(APP_CONFIG)
  ? readdirSync(APP_CONFIG).filter(file => file.endsWith('.ts'))
  : []

describe('the generated app config template', () => {
  test('contains every infrastructure-sensitive config file', () => {
    expect(templates.sort()).toEqual(['cloud.ts', 'dns.ts', 'email.ts', 'team.ts'])
  })

  test('contains no Stacks production ownership', () => {
    const forbidden = [
      "attachTo: 'stacks'",
      'Z01455702Q7952O6RCY37',
      'stacks-production-app',
      "domain: 'stacksjs.com'",
      "enabled: true",
      "chris@stacksjs.com",
    ]

    const offenders: string[] = []
    for (const file of templates) {
      const source = readFileSync(join(APP_CONFIG, file), 'utf8')
      for (const value of forbidden) {
        if (source.includes(value))
          offenders.push(`${file}: ${value}`)
      }
    }

    expect(offenders).toEqual([])
  })

  test('keeps external infrastructure opt-in', () => {
    const cloud = readFileSync(join(APP_CONFIG, 'cloud.ts'), 'utf8')
    const dns = readFileSync(join(APP_CONFIG, 'dns.ts'), 'utf8')
    const email = readFileSync(join(APP_CONFIG, 'email.ts'), 'utf8')
    const team = readFileSync(join(APP_CONFIG, 'team.ts'), 'utf8')

    expect(cloud).toContain('APP_DOMAIN = env.APP_DOMAIN || undefined')
    expect(cloud).not.toContain('hostedZoneId')
    expect(dns).toContain('a: []')
    expect(email).toContain('enabled: false')
    expect(email).toContain('mailboxes: []')
    expect(team).toContain('members: {}')
  })
})

describe('buddy new installs the app config template', () => {
  const source = readFileSync(CREATE_COMMAND, 'utf8')

  test('renders project identity tokens', () => {
    expect(source).toContain('applyAppConfigTemplate(path)')
    expect(source).toContain("replaceAll('__APP_NAME__', displayName)")
    expect(source).toContain("replaceAll('__APP_SLUG__', slug)")
  })

  test('runs before the framework tree is removed', () => {
    expect(source.indexOf('applyAppConfigTemplate(path)'))
      .toBeLessThan(source.indexOf('await unvendorCore(path, options)'))
  })
})
