/**
 * Native environment detection utilities
 * Replaces std-env with native implementations
 */

import process from 'node:process'
import { platform as osPlatform } from 'node:os'

// Runtime detection
export const isBun: boolean = typeof Bun !== 'undefined'
export const isNode: boolean = typeof process !== 'undefined' && process.versions?.node !== undefined
export const runtime: 'bun' | 'node' | 'unknown' = isBun ? 'bun' : isNode ? 'node' : 'unknown'
export const runtimeInfo: { name: 'bun' | 'node' | 'unknown', version: string | undefined } = {
  name: runtime,
  version: isBun ? Bun.version : isNode ? process.version : undefined,
}

// Platform detection
export const platform: NodeJS.Platform = osPlatform()
export const isWindows: boolean = platform === 'win32'
export const isMacOS: boolean = platform === 'darwin'
export const isLinux: boolean = platform === 'linux'

// TTY detection
export const hasTTY: boolean = Boolean(process.stdout?.isTTY)

// Window detection (browser environment)
export const hasWindow: boolean = typeof globalThis.window !== 'undefined'

/**
 * Which environment the application is running as.
 *
 * These are FUNCTIONS, unlike the runtime and platform flags above, which are
 * `const`s evaluated at import. `APP_ENV` is routinely set after the module
 * graph is loaded - a test harness pinning `APP_ENV=test`, a CLI resolving
 * `--env` - so a const would freeze whatever happened to be set when the first
 * import ran and report the wrong environment for the rest of the process
 * (stacksjs/stacks#2581).
 *
 * `NODE_ENV` is the fallback, since a plain `bun test` sets it and nothing
 * else.
 */
export function appEnv(): string {
  return process.env.APP_ENV || process.env.NODE_ENV || 'local'
}

/** Running as `local`. This is the default when nothing is set. */
export function isLocal(): boolean {
  return appEnv() === 'local'
}

/**
 * Running as `development` OR `local`.
 *
 * The two are one question at almost every call site - "is this a developer's
 * machine" - and Stacks uses `local` where other frameworks use `development`,
 * so a check for one that silently missed the other would be a trap.
 */
export function isDevelopment(): boolean {
  const name = appEnv()
  return name === 'development' || name === 'dev' || name === 'local'
}

/** Running as `staging`. */
export function isStaging(): boolean {
  return appEnv() === 'staging'
}

/** Running as `production`. */
export function isProduction(): boolean {
  const name = appEnv()
  return name === 'production' || name === 'prod'
}

/** Running under a test runner. */
export function isTesting(): boolean {
  const name = appEnv()
  return name === 'test' || name === 'testing'
}

// CI detection
export const isCI: boolean = Boolean(
  process.env.CI
  || process.env.CONTINUOUS_INTEGRATION
  || process.env.BUILD_NUMBER
  || process.env.RUN_ID,
)

// Debug mode detection
export const isDebug: boolean = Boolean(
  process.env.DEBUG
  || process.env.VERBOSE
  || process.argv.includes('--debug')
  || process.argv.includes('--verbose'),
)

// Minimal mode detection (CI or non-interactive)
export const isMinimal: boolean = isCI || !hasTTY

// Color support detection
export const isColorSupported: boolean = Boolean(
  !isMinimal
  && (
    hasTTY
    || process.env.COLORTERM
    || process.env.FORCE_COLOR
    || (process.env.TERM && process.env.TERM !== 'dumb')
  ),
)

// Provider detection (CI/CD platform)
const providers: Record<string, { name: string, detected: boolean }> = {
  github: {
    name: 'GitHub Actions',
    detected: Boolean(process.env.GITHUB_ACTIONS),
  },
  gitlab: {
    name: 'GitLab CI',
    detected: Boolean(process.env.GITLAB_CI),
  },
  circle: {
    name: 'CircleCI',
    detected: Boolean(process.env.CIRCLECI),
  },
  travis: {
    name: 'Travis CI',
    detected: Boolean(process.env.TRAVIS),
  },
  jenkins: {
    name: 'Jenkins',
    detected: Boolean(process.env.JENKINS_URL),
  },
  vercel: {
    name: 'Vercel',
    detected: Boolean(process.env.VERCEL),
  },
  netlify: {
    name: 'Netlify',
    detected: Boolean(process.env.NETLIFY),
  },
  heroku: {
    name: 'Heroku',
    detected: Boolean(process.env.DYNO),
  },
  aws: {
    name: 'AWS',
    detected: Boolean(process.env.AWS_REGION || process.env.AWS_LAMBDA_FUNCTION_NAME),
  },
  azure: {
    name: 'Azure',
    detected: Boolean(process.env.AZURE_HTTP_USER_AGENT),
  },
  cloudflare: {
    name: 'Cloudflare',
    detected: Boolean(process.env.CF_PAGES),
  },
  railway: {
    name: 'Railway',
    detected: Boolean(process.env.RAILWAY_ENVIRONMENT),
  },
  render: {
    name: 'Render',
    detected: Boolean(process.env.RENDER),
  },
}

export const provider: string = Object.keys(providers).find((key) => {
  const entry = providers[key]
  return entry !== undefined && entry.detected
}) || 'unknown'
export const providerInfo: { name: string, detected: boolean } = providers[provider] || { name: 'Unknown', detected: false }
