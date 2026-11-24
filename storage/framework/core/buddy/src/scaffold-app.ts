import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { PANTRY_NPM_REGISTRY } from '@stacksjs/actions/framework-registry'

/** The names a new app goes by, all derived from the directory `buddy new` created. */
export interface AppIdentity {
  /** The directory name, as typed: `my-app`. */
  slug: string
  /** For people: `My App`. APP_NAME, page titles, mail sender name. */
  displayName: string
  /** For hostnames and custom-element tags: lowercase letters, digits and hyphens, starting with a letter. */
  kebab: string
  /** For SQL identifiers and key prefixes: `my_app`. */
  snake: string
  /** An iOS bundle id that is valid but plainly a placeholder: `com.example.my-app`. */
  bundleId: string
}

export function appIdentity(path: string): AppIdentity {
  const slug = path.replace(/\/+$/, '').split('/').pop() || 'stacks-app'

  const words = slug.split(/[^a-z0-9]+/i).filter(Boolean)
  const displayName = words
    .map(word => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(' ') || 'My App'

  const kebab = words.join('-').toLowerCase().replace(/^[^a-z]+/, '') || 'app'

  return {
    slug,
    displayName,
    kebab,
    snake: kebab.replaceAll('-', '_'),
    bundleId: `com.example.${kebab}`,
  }
}

/** The placeholders `defaults/scaffold/config/*.ts` may use, and what each becomes. */
export function templatePlaceholders(identity: AppIdentity): Record<string, string> {
  return {
    __APP_NAME__: identity.displayName,
    __APP_SLUG__: identity.slug,
    __APP_TAG_PREFIX__: identity.kebab,
    __APP_BUNDLE_ID__: identity.bundleId,
  }
}

export function renderTemplate(source: string, identity: AppIdentity): string {
  let rendered = source
  for (const [placeholder, value] of Object.entries(templatePlaceholders(identity)))
    rendered = rendered.replaceAll(placeholder, value)
  return rendered
}

/**
 * The `.env.example` values that name stacksjs.com rather than the app, and
 * what a new app gets instead. `null` drops the line: those variables only
 * mean something on the stacks box.
 *
 * `.env` is copied from `.env.example` a step later, so rewriting the example
 * fixes both, and the example the app commits describes the app.
 */
export function appEnvValues(identity: AppIdentity): Record<string, string | null> {
  return {
    APP_NAME: `"${identity.displayName.replaceAll('"', '')}"`,
    APP_URL: `${identity.kebab}.localhost`,
    DB_DATABASE: identity.snake,
    MAIL_FROM_ADDRESS: `"no-reply@${identity.kebab}.localhost"`,
    QUEUE_PREFIX: `${identity.snake}:queue`,
    PREDICTHQ_DB_PASSWORD: null,
  }
}

/**
 * Rewrite `.env.example` for the new app. Only the keys `appEnvValues` names
 * are touched, and only where they are set (`KEY=...` at the start of a line),
 * so comments and every other default survive as written.
 *
 * Returns the keys it changed.
 */
export function applyAppEnvTemplate(root: string, identity: AppIdentity): string[] {
  const file = join(root, '.env.example')
  if (!existsSync(file))
    return []

  const values = appEnvValues(identity)
  const changed: string[] = []

  const lines = readFileSync(file, 'utf8').split('\n').flatMap((line) => {
    const key = /^([A-Z0-9_]+)=/.exec(line)?.[1]
    if (!key || !(key in values))
      return [line]

    changed.push(key)
    const value = values[key]
    return value === null ? [] : [`${key}=${value}`]
  })

  writeFileSync(file, lines.join('\n'))
  return changed
}

/**
 * The `package.json` keys that describe the Stacks repository rather than the
 * app, since the download IS that repository. Every app was named `stacks` at
 * the framework's version, credited its maintainer, and pointed `repository`,
 * `bugs`, `homepage` and `funding` at stacksjs/stacks - so tooling that reads
 * them (npm, GitHub's dependency graph, buddy-bot's PR links) described the
 * framework instead. `undefined` removes the key.
 */
export function appPackageValues(identity: AppIdentity): Record<string, unknown> {
  return {
    name: identity.kebab,
    version: '0.0.0',
    description: identity.displayName,
    author: undefined,
    contributors: undefined,
    funding: undefined,
    homepage: undefined,
    repository: undefined,
    bugs: undefined,
    // The app's licence is its owner's call. MIT was the framework's.
    license: undefined,
  }
}

/**
 * Rewrite `package.json` for the new app, touching only the keys
 * `appPackageValues` names and keeping the rest (scripts, dependencies,
 * engines, git hooks) in their original order. Returns the keys it changed.
 */
export function applyAppPackageTemplate(root: string, identity: AppIdentity): string[] {
  const file = join(root, 'package.json')
  if (!existsSync(file))
    return []

  const pkg = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>
  const changed: string[] = []

  for (const [key, value] of Object.entries(appPackageValues(identity))) {
    if (value === undefined) {
      if (key in pkg) {
        delete pkg[key]
        changed.push(key)
      }
    }
    else if (pkg[key] !== value) {
      pkg[key] = value
      changed.push(key)
    }
  }

  writeFileSync(file, `${JSON.stringify(pkg, null, 2)}\n`)
  return changed
}

/**
 * Drop the framework's LICENSE.md: "MIT License, Copyright (c) 2023 Open Web
 * Foundation", which every app then claimed as its own terms and copyright
 * holder. Only that file - an app that already has its own licence keeps it.
 * Returns whether it was removed.
 */
export function removeFrameworkLicense(root: string): boolean {
  const file = join(root, 'LICENSE.md')
  if (!existsSync(file) || !readFileSync(file, 'utf8').includes('Open Web Foundation'))
    return false

  rmSync(file)
  return true
}

/**
 * The framework repository's AGENTS.md tells agents to publish "to
 * `origin/main` as Chris (`chris@stacksjs.com`), without coauthor trailers".
 * Right for the framework, and every app inherited it: an agent working on
 * somebody else's app committed under the framework author's name. Replaced
 * with the rule the `buddy setup:ai` starter already gives; the rest of the
 * file is the same guidance in both. Returns whether it changed the file.
 */
const FRAMEWORK_PUBLISH_RULE = /^- Publish completed work to [\s\S]*?(?=\n\n|\n- |\n#)/m
export const APP_PUBLISH_RULE = '- Only commit or push when asked.'

export function applyAppAgentsTemplate(root: string): boolean {
  const file = join(root, 'AGENTS.md')
  if (!existsSync(file))
    return false

  const raw = readFileSync(file, 'utf8')
  const next = raw.replace(FRAMEWORK_PUBLISH_RULE, APP_PUBLISH_RULE)
  if (next === raw)
    return false

  writeFileSync(file, next)
  return true
}

/**
 * Replace the framework's CHANGELOG.md with an empty one for the app.
 *
 * The download carried "# Stacks Changelog": about a megabyte of the
 * framework's own release history, which every app then committed, and which
 * the app's first `release` appended its own notes onto. Returns whether a
 * changelog was replaced.
 */
export function applyAppChangelogTemplate(root: string, identity: AppIdentity): boolean {
  const file = join(root, 'CHANGELOG.md')
  if (!existsSync(file))
    return false

  writeFileSync(file, `# ${identity.displayName} Changelog\n`)
  return true
}

/** The registry line a new app's `bunfig.toml` carries. */
export const APP_REGISTRY_LINE = `registry = "${PANTRY_NPM_REGISTRY}/"`

/** The framework's scope, pinned to Pantry in a new app's install config. */
export const FRAMEWORK_SCOPE = '@stacksjs'

/**
 * Install the app's packages from the Pantry registry.
 *
 * The framework publishes every release to Pantry (and to npm), and Pantry's
 * `/npm/` endpoint speaks npm's registry protocol: it serves the framework's
 * packages and redirects every other name to npm. The registry itself moves,
 * because the app also depends on the unscoped `stacks` package, and the
 * `@stacksjs` scope is named as well: a user-level `.npmrc` that pins the
 * scope to npm (`@stacksjs:registry=...`, common on a machine that has
 * published Stacks packages) outranks a project's default registry but not
 * its scope entry.
 *
 * Two files, because the app has two installers. Bun reads `bunfig.toml`,
 * whose template is the framework repository's and points at npm with the
 * token the framework's release publishes with (an app has no use for it).
 * Pantry's installer reads `.npmrc`, not `bunfig.toml`. Returns the files it
 * changed.
 */
export function applyAppRegistryTemplate(root: string): string[] {
  const changed: string[] = []
  const registry = `${PANTRY_NPM_REGISTRY}/`

  const bunfigFile = join(root, 'bunfig.toml')
  if (existsSync(bunfigFile)) {
    const raw = readFileSync(bunfigFile, 'utf8')
    let next = setTomlKey(raw, 'install', 'registry', `"${registry}"`)
    next = setTomlKey(next, 'install.scopes', `"${FRAMEWORK_SCOPE}"`, `"${registry}"`)
    if (next !== raw) {
      writeFileSync(bunfigFile, next)
      changed.push('bunfig.toml')
    }
  }

  const npmrcFile = join(root, '.npmrc')
  const npmrc = existsSync(npmrcFile) ? readFileSync(npmrcFile, 'utf8') : ''
  let nextNpmrc = setNpmrcKey(npmrc, 'registry', registry)
  nextNpmrc = setNpmrcKey(nextNpmrc, `${FRAMEWORK_SCOPE}:registry`, registry)
  if (nextNpmrc !== npmrc) {
    writeFileSync(npmrcFile, nextNpmrc)
    changed.push('.npmrc')
  }

  return changed
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Set `key = value` in `[table]`, adding the key, or the table, when missing. */
function setTomlKey(raw: string, table: string, key: string, value: string): string {
  const line = `${key} = ${value}`
  const header = new RegExp(`^\\[${escapeRegExp(table)}\\][^\\n]*\\n(?:(?!\\[)[^\\n]*\\n?)*`, 'm')
  const section = raw.match(header)
  if (!section)
    return `${raw.endsWith('\n') || raw === '' ? raw : `${raw}\n`}\n[${table}]\n${line}\n`
  const existing = new RegExp(`^${escapeRegExp(key)}\\s*=.*$`, 'm')
  const body = existing.test(section[0])
    ? section[0].replace(existing, line)
    : section[0].replace(/^[^\n]*\n/, match => `${match}${line}\n`)
  return raw.replace(section[0], body)
}

/** Set `key=value` in an `.npmrc`, keeping every other line. */
function setNpmrcKey(raw: string, key: string, value: string): string {
  const existing = new RegExp(`^${escapeRegExp(key)}\\s*=.*$`, 'm')
  return existing.test(raw) ? raw.replace(existing, `${key}=${value}`) : `${raw}${raw === '' || raw.endsWith('\n') ? '' : '\n'}${key}=${value}\n`
}
