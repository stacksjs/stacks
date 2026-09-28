import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

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
