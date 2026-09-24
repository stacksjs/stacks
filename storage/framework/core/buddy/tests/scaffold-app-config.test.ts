import { describe, expect, test } from 'bun:test'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { appIdentity, templatePlaceholders } from '../src/scaffold-app'

const APP_CONFIG = join(import.meta.dir, '../../../defaults/scaffold/config')
const CREATE_COMMAND = join(import.meta.dir, '../src/commands/create.ts')

const templates = existsSync(APP_CONFIG)
  ? readdirSync(APP_CONFIG).filter(file => file.endsWith('.ts'))
  : []

describe('the generated app config template', () => {
  test('contains every config file a generated app must not inherit', () => {
    // `buddy-bot.ts` joined the list in stacksjs/stacks#2574: buddy-bot needs
    // `repository.owner`/`name`, and the framework's copy names stacksjs/stacks,
    // so an app without a template here inherits a bot aimed at this repository.
    // app/blog/docs/library/mobile/lint joined when the scaffold stopped
    // shipping stacksjs.com: each named the site (its description and redirect
    // domain, "The Stacks Blog", stacksjs.com/docs, the @stacksjs npm scope,
    // com.stacksjs.app) or counted its pages (lint baselines).
    expect(templates.sort()).toEqual(['app.ts', 'blog.ts', 'buddy-bot.ts', 'cloud.ts', 'dns.ts', 'docs.ts', 'email.ts', 'library.ts', 'lint.ts', 'mobile.ts', 'team.ts'])
  })

  test('contains no Stacks production ownership', () => {
    const forbidden = [
      "attachTo: 'stacks'",
      'Z01455702Q7952O6RCY37',
      'stacks-production-app',
      "domain: 'stacksjs.com'",
      'chris@stacksjs.com',
      // The framework repository, which buddy-bot would otherwise open pull
      // requests against from the app's own CI.
      "owner: 'stacksjs'",
      "name: 'stacks'",
      // stacksjs.com's identity, which app, blog, docs, library and mobile
      // used to carry.
      "redirectUrls: ['stacksjs.com']",
      'https://stacksjs.com/docs',
      "url: 'https://stacksjs.com'",
      'The Stacks Blog',
      'Stacks Documentation',
      "owner: '@stacksjs'",
      'Chris Breuer',
      'com.stacksjs.app',
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
    // Mail-server reconciliation, specifically. This used to be enforced as a
    // repository-wide ban on the substring `enabled: true`, which is not what
    // it means - the first template to legitimately enable something of its own
    // tripped it (stacksjs/stacks#2574).
    expect(email).toContain('enabled: false')
    expect(email).not.toContain('enabled: true')
    expect(email).toContain('mailboxes: []')
    expect(team).toContain('members: {}')
  })
})

describe('buddy new installs the app config template', () => {
  const source = readFileSync(CREATE_COMMAND, 'utf8')

  test('renders project identity tokens', () => {
    expect(source).toContain('applyAppConfigTemplate(path)')
    expect(source).toContain('renderTemplate(template, identity)')
  })

  test('every placeholder a template uses is one the scaffold renders', () => {
    // A misspelt token is not an error anywhere: it ships verbatim, and the
    // app's config says `__APP_NMAE__` until someone reads it.
    const known = Object.keys(templatePlaceholders(appIdentity('/tmp/my-app')))
    const unknown = templates.flatMap(file =>
      [...readFileSync(join(APP_CONFIG, file), 'utf8').matchAll(/__[A-Z_]+__/g)]
        .map(match => match[0])
        .filter(token => !known.includes(token))
        .map(token => `${file}: ${token}`))

    expect(unknown).toEqual([])
  })

  test('runs before the framework tree is removed', () => {
    expect(source.indexOf('applyAppConfigTemplate(path)'))
      .toBeLessThan(source.indexOf('await unvendorCore(path, options)'))
  })
})
